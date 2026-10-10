import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArticleParagraph,ArticleSourceLabel,safeArticleUrl} from './article-render-test-helpers.mjs';
const render = text => renderToStaticMarkup(createElement(ArticleParagraph,{slug:'sglang-deepseek-v41-decoder-swa-bounded-replay',text,markdown:true}));
test('Markdown creates semantic headings, emphasis, lists, code and paragraph boundaries',()=>{
 const html=render('### 2.1 尾部边界\n\n**核验范围** 与 `token`。\n\n下一段。\n\n1. 第一项\n2. 第二项\n\n- 全局\n- 局部\n\n```python\nT = min(E, 128)\n```');
 for(const tag of ['h3','strong','code','ol','ul','pre'])assert.match(html,new RegExp('<'+tag+'\\b'));
 assert.equal((html.match(/<p\b/g)||[]).length,2);assert.match(html,/T = min\(E, 128\)/);assert.doesNotMatch(html,/###|\*\*|```/);
});
test('GFM tables stay in place between surrounding prose, fenced code keeps whitespace',()=>{
 const html=render('before\n\n| 名称 | 长度 |\n| --- | --- |\n| T | `128` |\n\nafter\n\n```text\n  A\n    B\n```');
 assert.ok(html.indexOf('before')<html.indexOf('<table'));assert.ok(html.indexOf('</table>')<html.indexOf('after'));assert.match(html,/<th\b/);assert.match(html,/<td\b/);assert.match(html,/  A\n    B/);
});
test('raw HTML, event handlers, unsafe links and arbitrary external images cannot execute',()=>{
 const html=render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29) [data](data:text/html,x)\n\n![tracking](https://evil.example/tracker.svg)\n\n[good](https://github.com/sgl-project/sglang)');
 assert.doesNotMatch(html,/<script|onerror=|href="javascript:|href="data:|src="https:\/\/evil/);assert.match(html,/href="https:\/\/github.com\/sgl-project\/sglang"/);
 for(const value of ['javascript:alert(1)','data:image/svg+xml,x','http://example.com','//evil.example/x','https://user:pass@example.com','https://example.com\\evil','https://example.com\n'])assert.equal(safeArticleUrl(value),'');
 assert.equal(safeArticleUrl('https://evil.example/image.svg',true),'');
 assert.equal(safeArticleUrl('/ai-infra-daily-notes/diagrams/a.svg',true),'/ai-infra-daily-notes/diagrams/a.svg');
});
test('image-only blocks produce a figure without nesting it in a paragraph',()=>{
 const html=render('![图](https://ttaohe.github.io/ai-infra-daily-notes/diagrams/a.svg)');assert.match(html,/<figure>/);assert.doesNotMatch(html,/<p[^>]*><figure/);
});
test('mixed prose and image never nests a figure in p',()=>{assert.doesNotMatch(render('说明 ![图](https://ttaohe.github.io/ai-infra-daily-notes/diagrams/a.svg) 完成'),/<p[^>]*>[\s\S]*?<figure/);});
test('plain-text articles keep their previous rendering and do not interpret Markdown',()=>{
 const html=renderToStaticMarkup(createElement(ArticleParagraph,{slug:'state-recovery',text:'**原文**\n\n下一段。'}));assert.match(html,/\*\*原文\*\*/);assert.doesNotMatch(html,/<strong|article-markdown/);
});

test('source labels render inline code without nested anchors, blocks or raw HTML',()=>{
 const html=renderToStaticMarkup(createElement(ArticleSourceLabel,{text:'`37ae292` [来源](https://example.com) <img src=x onerror=alert(1)>'}));
 assert.match(html,/<code>37ae292<\/code>/);assert.match(html,/来源/);assert.doesNotMatch(html,/<p|<a|<img|onerror/);
});
