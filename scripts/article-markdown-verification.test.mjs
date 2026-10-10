import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMarkdownSection} from './article-markdown-verification.mjs';
const section={paragraphs:['### Heading\n\n**Body** and `code`.\n\n[Source](https://example.com)']};
const html='<section id="section-1"><h3>Heading</h3><p><strong>Body</strong> and <code>code</code>.</p><p><a href="https://example.com">Source</a></p></section>';
test('export verification understands formatting but still requires every block in order and every link',()=>{
 assert.doesNotThrow(()=>verifyMarkdownSection(html,section,0));
 assert.throws(()=>verifyMarkdownSection(html.replace('Body','Deleted'),section,0),/Missing or reordered/);
 assert.throws(()=>verifyMarkdownSection(html.replace('<h3>Heading</h3>','<p>Heading</p>'),section,0),/semantic h3/);
 assert.throws(()=>verifyMarkdownSection(html.replace('href="https://example.com"','href="https://wrong.example"'),section,0),/Missing Markdown link/);
 const reverse='<section id="section-1"><p><a href="https://example.com">Source</a></p><h3>Heading</h3><p>Body and code.</p></section>';
 assert.throws(()=>verifyMarkdownSection(reverse,section,0),/Missing or reordered/);
});
