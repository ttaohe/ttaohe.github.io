import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {presentArticle,presentBlogContent,canonicalArticle} from "../lib/blog/article-presentation.mjs";
const original=JSON.parse(await readFile(new URL("./fixtures/bounded-replay-legacy.json",import.meta.url),"utf8"));
const content={schemaVersion:1,updatedAt:"fixture",posts:[original,{slug:"unrelated",opaque:{keep:true}}],unknown:{preserved:true}};
const slug="sglang-deepseek-v41-decoder-swa-bounded-replay";
const post=content.posts.find(p=>p.slug===slug);
test("verified legacy article restores Markdown structure without mutating authority",async()=>{
 const before=canonicalArticle(content);const view=await presentBlogContent(content);const article=view.posts.find(p=>p.slug===slug);
 assert.equal(canonicalArticle(content),before);assert.equal(article.bodyFormat,"markdown");
 assert.equal(article.sections.flatMap(s=>s.paragraphs).join("\n").match(/```/g).length,8);
 assert.equal(article.sections.flatMap(s=>s.paragraphs).join("\n").match(/!\[/g).length,3);
 assert.deepEqual(article.sources.map(s=>s.url),post.sources.map(s=>s.url));
 assert.equal(article.sources[6].title,"尾部布局函数");
 for(const p of content.posts)if(p.slug!==slug)assert.equal(view.posts.find(q=>q.slug===p.slug),p);
 for(const k of Object.keys(content))if(k!=="posts")assert.equal(view[k],content[k]);
 for(const k of Object.keys(post))if(!["bodyFormat","sections","outline","sources"].includes(k))assert.deepEqual(article[k],post[k]);
});
test("concurrent title or body changes do not apply an obsolete presentation",async()=>{
 for(const changed of [{...post,title:post.title+" updated"},{...post,sections:[{...post.sections[0],paragraphs:[post.sections[0].paragraphs[0]+" changed",...post.sections[0].paragraphs.slice(1)]},...post.sections.slice(1)]}])assert.equal(await presentArticle(changed),changed);
});
test("explicit Markdown and unrelated articles are left intact",async()=>{
 const modern={...post,bodyFormat:"markdown"};assert.equal(await presentArticle(modern),modern);
 const other=content.posts.find(p=>p.slug!==slug);assert.equal(await presentArticle(other),other);
});
test("canonical digest matches the verified Python source digest",()=>assert.equal(createHash("sha256").update(canonicalArticle(post)).digest("hex"),"13ef45d94373ad73535849db27a97106fab84cfb3ccc6328988c15fa99692c72"));
