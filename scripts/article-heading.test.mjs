import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { parseArticleHeading } from '../lib/blog/article-heading.ts';

const slug = 'pcie-rdma-networking-foundations';
const normalize = text => text.replace(/\s/g, '');
const { ArticleParagraph } = await import('./article-render-test-helpers.mjs');
const render = (articleSlug, text) => renderToStaticMarkup(createElement(ArticleParagraph, { slug: articleSlug, text }));

test('chapter and glossary prefixes become level-three headings', () => {
  assert.deepEqual(parseArticleHeading(slug, '【1 先把四个层次分开】'), { level: 3, title: '1 先把四个层次分开', body: '' });
  assert.deepEqual(parseArticleHeading(slug, '【10 再读代码】 正文'), { level: 3, title: '10 再读代码', body: '正文' });
  assert.deepEqual(parseArticleHeading(slug, '【术语速查】 NIC / RNIC'), { level: 3, title: '术语速查', body: 'NIC / RNIC' });
});

test('subheadings separate from the following body without losing punctuation or lines', () => {
  assert.deepEqual(parseArticleHeading(slug, '【1.1 应用想做什么】 在最上面，应用关心的是：保存 KV。\n下一段。[1]'), {
    level: 4, title: '1.1 应用想做什么', body: '在最上面，应用关心的是：保存 KV。\n下一段。[1]',
  });
  assert.equal(parseArticleHeading(slug, '【8.4 吞吐的倒数通常是完成间隔】').body, '');
});

test('other articles and unrecognized bracketed prose stay ordinary paragraphs', () => {
  for (const text of ['【1 标题】 正文', '【1.1 标题】 正文', '【术语速查】 正文']) {
    assert.equal(parseArticleHeading('state-recovery', text), null);
  }
  for (const text of ['普通正文', '正文中的【1 标题】', '【注意】 正文', '【1.1】 正文', '【未闭合', '']) {
    assert.equal(parseArticleHeading(slug, text), null);
  }
});

test('the article renderer uses semantic h3/h4 and a separate unchanged paragraph style', () => {
  const component = readFileSync(new URL('../components/blog/article-paragraph.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/notes/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(component, /<h3\b/);
  assert.match(component, /<h4\b/);
  assert.match(component, /heading\.body && <p/);
  assert.match(component, /mb-5 text-\[17px\] leading-\[1\.95\] text-\[#465d64\]/);
  assert.match(page, /<ArticleParagraph key=\{j\} slug=\{p\.slug\} text=\{t\}/);
});

test('rendered HTML separates titles from body and does not emit empty paragraphs', () => {
  assert.match(render(slug, '【1 先把四个层次分开】'), /^<h3\b[^>]*>1 先把四个层次分开<\/h3>$/);
  assert.match(render(slug, '【1.1 应用想做什么】 保存 KV。'), /^<h4\b[^>]*>1\.1 应用想做什么<\/h4><p\b[^>]*>保存 KV。<\/p>$/);
  assert.doesNotMatch(render(slug, '【1.1 应用想做什么】 保存 KV。'), /【|】/);
});

test('all current article text is conserved and other posts remain unchanged', () => {
  const content = JSON.parse(readFileSync(new URL('../lib/blog/content.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(content);
  for (const post of content.posts) {
    for (const section of post.sections) {
      for (const text of section.paragraphs) {
        const parsed = parseArticleHeading(post.slug, text);
        if (post.slug !== slug) {
          assert.equal(parsed, null);
          const original = renderToStaticMarkup(createElement('p', { className: 'mb-5 text-[17px] leading-[1.95] text-[#465d64]' }, text));
          assert.equal(render(post.slug, text), original);
        }
        if (parsed) assert.equal(normalize(parsed.title + parsed.body), normalize(text.replace(/^【([^】]+)】/, '$1')));
      }
    }
  }
  assert.equal(JSON.stringify(content), before);
});
