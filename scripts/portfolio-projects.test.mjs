import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');
const project = html.match(/<article tabindex="-1" id="mla-tp-l2-cache-deduplication"[^]*?<\/article>/)?.[0];

test('first project has a stable accessible index and no nonexistent article link', () => {
  assert(project);
  assert(project.includes('aria-labelledby="mla-project-title"'));
  assert(project.includes('id="mla-project-title"'));
  assert(project.includes('<span>01</span> / KV CACHE OPTIMIZATION'));
  assert.deepEqual([...project.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['#mla-tp-l2-cache-deduplication']);
  assert(project.includes('完整研究记录待补充'));
  assert(!html.includes('整理中，后续补充'));
});

test('project measurements preserve supplied scope and approximate qualifiers', () => {
  for (const text of ['Kimi 2.6 / 2.7', 'HiCache L2', 'TP0', '再广播至其他 Rank', '8×', '≈94%', '80% 多', '理论约 95%', '≈+40%', '高峰期一小时吞吐', '相同并发下', '该项目配置下', '项目实测摘要；完整负载、硬件与统计口径待补充']) assert(project.includes(text), text);
  assert.equal((project.match(/<dt>/g) ?? []).length, 3);
  assert(!/TP\s*=\s*8|TP8|tokens\/s|requests\/s|独立复现|提升 8 倍|GPU Cache 去重/.test(project));
  assert(!project.includes('36800'));
});

test('project card uses scoped theme colors, natural wrapping and content-width metric layout', () => {
  assert(css.includes('#experience{container:experience / inline-size}'));
  assert(css.includes('@container experience (min-width:620px){.project-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}'));
  assert.match(css, /\.project-card\{[^}]*background:var\(--card\);scroll-margin-top:var\(--anchor-offset\)/);
  assert.match(css, /\.project-card h3\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.project-metrics>div\{[^}]*min-width:0/);
  assert(!/\.project-(?:card|summary|metrics)\{[^}]*[;{](?:min-)?height:/.test(css));
});
