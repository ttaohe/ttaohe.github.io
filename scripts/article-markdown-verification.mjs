import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import remarkGfm from 'remark-gfm';
// Resolve the exact parser dependencies already pinned by react-markdown.
const require=createRequire(import.meta.resolve('react-markdown'));
const {unified}=await import(pathToFileURL(require.resolve('unified')));
const {default:remarkParse}=await import(pathToFileURL(require.resolve('remark-parse')));
const parse=text=>unified().use(remarkParse).use(remarkGfm).parse(text);
const decode=value=>value.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&amp;','&');
const normalized=value=>value.replace(/\s/g,'');
const visible=html=>normalized(decode(html.replace(/<[^>]*>/g,'')));
const words=node=>['text','inlineCode','code'].includes(node.type)?node.value:node.type==='image'?node.alt||'':node.type==='html'?'':(node.children||[]).map(words).join('');
const descendants=node=>[node,...(node.children||[]).flatMap(descendants)];
export function verifyMarkdownSection(articleHtml,section,index){
 const html=articleHtml.match(new RegExp(`<section\\b[^>]*id="section-${index+1}"[^>]*>([^]*?)<\\/section>`))?.[1];
 assert(html,`Missing Markdown section ${index+1}`);
 const text=visible(html);let cursor=0;
 for(const input of section.paragraphs){
  const tree=parse(input);
  for(const block of tree.children){
   const expected=normalized(words(block));if(!expected)continue;
   const found=text.indexOf(expected,cursor);assert(found>=0,`Missing or reordered Markdown content in section ${index+1}: ${expected.slice(0,80)}`);cursor=found+expected.length;
   for(const node of descendants(block)){
    if(node.type==='heading'){
     const level=node.depth<=3?3:node.depth;
     const titles=[...html.matchAll(new RegExp(`<h${level}\\b[^>]*>([^]*?)<\\/h${level}>`,'g'))].map(m=>visible(m[1]));
     assert(titles.includes(normalized(words(node))),`Missing semantic h${level}: ${words(node)}`);
    }
    if(node.type==='link')assert(decode(html).includes(`href="${node.url}"`),`Missing Markdown link ${node.url}`);
    if(node.type==='image')assert(decode(html).includes(`src="${node.url}"`),`Missing selected image ${node.url}`);
    if(node.type==='table')assert(/<table\b/.test(html),'Table rendered as plain text');
    if(node.type==='code')assert([...html.matchAll(/<pre\b[^>]*>([^]*?)<\/pre>/g)].some(m=>visible(m[1])===normalized(node.value)),'Code fence missing or altered');
   }
  }
 }
}
