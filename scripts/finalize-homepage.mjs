import {readFile,writeFile,mkdir,cp,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(), out=path.join(root,'publish');
const config=JSON.parse(await readFile('lib/site-config.json','utf8'));
const origin=new URL(config.publicContentOrigin).origin;
const content=JSON.parse(await readFile('lib/blog/content.json','utf8'));
const oldSlugs=JSON.parse(await readFile('lib/blog/legacy-slugs.json','utf8'));
let html=await readFile(path.join(out,'index.html'),'utf8');
html=html.replaceAll('href="/ai-infra-daily-notes/', 'href="'+origin+'/')
 .replaceAll('href="/projects/', 'href="'+origin+'/projects/');
await writeFile(path.join(out,'index.html'),html);
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const redirect=target=>'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="'+esc(target)+'"><meta http-equiv="refresh" content="0;url='+esc(target)+'"><title>内容已迁移</title><script>location.replace('+JSON.stringify(target)+'+location.search+location.hash)</script><body><p>内容已迁移至<a href="'+esc(target)+'">研究站</a>。</p></body></html>';
const routes=new Map();
for(const prefix of ['', '/ai-infra-daily-notes']){
 for(const section of ['daily','experiments','research','notes'])routes.set(prefix+'/'+section+'/',origin+'/'+(section==='notes'?'':section+'/'));
 for(const slug of new Set([...oldSlugs,...content.posts.filter(p=>p.kind!=='project').map(p=>p.slug)]))routes.set(prefix+'/notes/'+slug+'/',origin+'/notes/'+slug+'/');
}
routes.set('/ai-infra-daily-notes/',origin+'/');
for(const slug of new Set(['mla-tp-l2-cache-deduplication',...content.posts.filter(p=>p.kind==='project').map(p=>p.slug)]))routes.set('/projects/'+slug+'/',origin+'/projects/'+slug+'/');
for(const [route,target] of routes){
 const folder=path.join(out,route);await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'index.html'),redirect(target));
}
await cp('public/favicon.svg',path.join(out,'ai-infra-daily-notes/favicon.svg'));
await mkdir(path.join(out,'ai-infra-daily-notes/diagrams'),{recursive:true});
await cp('public/diagrams',path.join(out,'ai-infra-daily-notes/diagrams'),{recursive:true});
await cp('public/downloads',path.join(out,'ai-infra-daily-notes/downloads'),{recursive:true});
await writeFile(path.join(out,'404.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>页面未找到</title><body><h1>页面未找到</h1><p><a href="/">个人主页</a> · <a href="'+origin+'/">研究站</a></p><script>const p=location.pathname.replace(/^\\/ai-infra-daily-notes(?=\\/)/,"");if(/^\\/(notes|projects|daily|research|experiments)(\\/|$)/.test(p))location.replace('+JSON.stringify(origin)+'+p+location.search+location.hash)</script></body></html>');
if(content.posts.some(p=>p.kind==='project'&&p.slug==='mla-tp-l2-cache-deduplication'))assert(html.includes(origin+'/projects/mla-tp-l2-cache-deduplication/'));
assert(html.includes(origin+'/daily/'));
assert(html.includes('data-review-countdown')&&html.includes('data-visit-counter'));
assert(html.includes('class="sidebar"')&&html.includes('class="theme-picker"'));
assert(!html.includes('id="personal-content-system"'));
assert(!html.includes('{{'));
for(const [route,target]of routes){const h=await readFile(path.join(out,route,'index.html'),'utf8');assert(h.includes(target));assert(h.includes('+location.search+location.hash'));}
for(const [,url] of html.matchAll(/(?:src|href)="(\/assets\/[^"#?]+)/g))await access(path.join(out,url));
await access(path.join(out,'assets/ttaohe-resume.pdf'));
console.log('Verified personal homepage, resume, assets and '+routes.size+' VPS redirects.');
