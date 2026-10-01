import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('shared blog brand returns to personal home while map navigation stays local', async () => {
  const header = await readFile(new URL('../components/blog/header.tsx', import.meta.url), 'utf8');
  assert.match(header, /<a href="https:\/\/ttaohe\.github\.io\/" aria-label="ttaohe · 返回个人主页"/);
  assert.match(header, />ttaohe<span/);
  assert.match(header, /<a href=\{sitePath\("\/"\)\}[^]*?>知识地图<\/a>/);
  assert.match(header, /focus-visible:outline/);
});

test('project titlebar has a native same-tab home link and retains summary return', async () => {
  const document = await readFile(new URL('../portfolio/projects/mla-tp-l2-cache-deduplication/index.html', import.meta.url), 'utf8');
  assert.match(document, /<a href="\/" aria-label="ttaohe · 返回个人主页"><em>ttaohe<\/em><\/a>/);
  assert.match(document, /href="\/#mla-tp-l2-cache-deduplication"/);
  const titlebar = document.match(/<span class="window-title">([^]*?)<\/span>/)?.[1];
  assert.doesNotMatch(titlebar, /target=|onclick=/);
});
