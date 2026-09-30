import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');
const document = await readFile(new URL('../portfolio/projects/mla-tp-l2-cache-deduplication/index.html', import.meta.url), 'utf8');
const project = html.match(/<article tabindex="-1" id="mla-tp-l2-cache-deduplication"[^]*?<\/article>/)?.[0];

test('first project has a stable accessible index and links to its real document page', () => {
  assert(project);
  assert(project.includes('aria-labelledby="mla-project-title"'));
  assert(project.includes('id="mla-project-title"'));
  assert(project.includes('<span class="project-index" aria-hidden="true">01</span>'));
  assert.deepEqual([...project.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['/projects/mla-tp-l2-cache-deduplication/']);
  assert(!project.includes('project-record'));
  assert(!html.includes('整理中，后续补充'));
});

test('project index aligns with the title and compact keywords wrap as a semantic list', () => {
  const keywords = project.match(/<ul class="project-keywords"[^]*?<\/ul>/)?.[0];
  assert(keywords?.includes('aria-label="项目关键词"'));
  assert.equal((keywords.match(/<li>/g) ?? []).length, 4);
  assert(css.includes('.project-card h3 a{display:flex;align-items:baseline;gap:10px;'));
  assert(css.includes('.project-card .project-keywords{display:flex;flex-wrap:wrap;'));
  assert(css.includes('.project-card h3 a>span[lang]{min-width:0}'));
});

test('project document is explicitly pending, navigable and respects reduced motion', () => {
  assert(document.includes('href="/#mla-tp-l2-cache-deduplication"'));
  assert(document.includes('id="record-status">待补充'));
  assert(document.includes('后续文档提纲'));
  assert(document.includes('class="document-hourglass"'));
  assert(!document.includes('data-review-countdown'));
  assert(css.includes('@media(prefers-reduced-motion:reduce){.document-hourglass{animation:none}}'));
  assert(document.includes('/assets/portfolio-ui.js'));
});

test('project measurements preserve supplied scope and approximate qualifiers', () => {
  for (const text of ['Kimi 2.6 / 2.7', 'HiCache', 'TP0', '再广播到其余 Rank', '8×', '约 94%', '80% 多', '理论约 95%', '约 40%', '高峰期一小时吞吐', '相同并发下', '项目实测中', '完整负载、硬件与统计口径待补充']) assert(project.includes(text), text);
  assert.equal((project.match(/class="project-summary"/g) ?? []).length, 1);
  assert.equal((project.match(/<strong>/g) ?? []).length, 3);
  assert(!project.includes('<dl'));
  assert(!/TP\s*=\s*8|TP8|tokens\/s|requests\/s|独立复现|提升 8 倍|GPU Cache 去重/.test(project));
  assert(!project.includes('36800'));
});

test('project entry is compact, theme-aware and naturally wraps its single paragraph', () => {
  assert(!css.includes('.project-metrics'));
  assert.doesNotMatch(css, /\.project-summary\{[^}]*max-width:/);
  assert(css.includes('.project-card{padding:15px 16px}'));
  assert.match(css, /\.project-card\{[^}]*background:var\(--card\);scroll-margin-top:var\(--anchor-offset\)/);
  assert.match(css, /\.project-card h3\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.project-summary strong\{color:var\(--heading\);font-weight:600\}/);
  assert(!/\.project-(?:card|summary|metrics)\{[^}]*[;{](?:min-)?height:/.test(css));
});
