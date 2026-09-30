import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');

test('editor chrome combines the active file and path into one bounded row', () => {
  assert.match(html, /<div class="editor-bar"><span class="tab">[^]*?<span class="breadcrumb">[^]*?<\/span><\/div>\s*<main class="content">/);
  assert(!html.includes('class="tabs"'));
  assert(html.includes('<span class="window-title"><em>ttaohe.github.io</em></span>'));
  assert(!html.includes('personal-workspace'));
  assert.match(css, /\.editor-bar\{height:38px;/);
  assert.match(css, /\.breadcrumb\{[^}]*min-width:0;[^}]*overflow:hidden;[^}]*text-overflow:ellipsis/);
});

test('content insets are bounded on wide screens and remain readable on phones', () => {
  assert(css.includes('--editor-gutter:clamp(28px,2.5vw,40px)'));
  assert(css.includes('.content{padding:32px var(--editor-gutter) 30px}'));
  assert(css.includes('.content{padding:26px 20px 24px}'));
  assert(css.includes('--anchor-offset:24px'));
  assert(css.includes('--anchor-offset:64px'));
});

test('research rhythm aligns natural-size panels without forced rail heights', () => {
  assert.match(css, /\.research-grid\{[^}]*align-items:stretch/);
  assert.match(css, /\.research-context\{display:grid;gap:16px;align-content:space-between\}/);
  assert(css.includes('.research-context .clock-face{width:100px}'));
  assert(!/\.(research-context|research-panel|note|notes|countdown)\{[^}]*(?:min-)?height:/.test(css));
  assert(css.includes('align-items:start;align-content:start'));
  assert(css.includes('.research-reading{display:block}'));
  assert(!css.includes('line-clamp'));
});

test('profile portrait preserves the supplied pixels and has an intrinsic responsive size', async () => {
  assert.match(html, /<img class="profile-avatar" src="\/assets\/portfolio-avatar.jpg" width="1254" height="1254" alt="何涛的头像：夕阳下的男生与猫"/);
  assert(css.includes('clamp(148px,16vw,216px)'));
  assert(css.includes('.profile-avatar{grid-column:2;grid-row:1/3;'));
  assert(css.includes('.hero .intro,.hero .focus-line,.hero .actions{grid-column:1/-1}'));
  const avatar = await readFile(new URL('../portfolio/avatar.jpg', import.meta.url));
  assert.equal(avatar.length, 288808);
  assert.equal(createHash('sha256').update(avatar).digest('hex'), '3dfd3eb916cf2eb9467a093f852c3bac2a9386bf33ad252a7bcf23a6f17d3989');
});
