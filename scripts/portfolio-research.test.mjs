import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(root, 'portfolio/index.html'), 'utf8');
const css = await readFile(path.join(root, 'portfolio/styles.css'), 'utf8');
const source = JSON.parse(await readFile(path.join(root, 'lib/blog/content.json'), 'utf8'));
const decode = value => value.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&');

async function render(content, { cssSuffix = '', verifyAssets = false } = {}) {
  const fixture = await mkdtemp(path.join(tmpdir(), 'portfolio-research-'));
  try {
    for (const dir of ['scripts', 'lib/blog', 'out']) await mkdir(path.join(fixture, dir), { recursive: true });
    await cp(path.join(root, 'portfolio'), path.join(fixture, 'portfolio'), { recursive: true });
    if (cssSuffix) await writeFile(path.join(fixture, 'portfolio/styles.css'), css + cssSuffix);
    await cp(path.join(root, 'scripts/prepare-publish.mjs'), path.join(fixture, 'scripts/prepare-publish.mjs'));
    await cp(path.join(root, 'lib/update-schedule.ts'), path.join(fixture, 'lib/update-schedule.ts'));
    await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
    await writeFile(path.join(fixture, 'lib/site-config.json'), JSON.stringify({ basePath: '/ai-infra-daily-notes', siteOrigin: 'https://example.test' }));
    await writeFile(path.join(fixture, 'lib/blog/content.json'), JSON.stringify(content));
    await writeFile(path.join(fixture, 'out/404.html'), '<!doctype html><title>Not found</title>');
    execFileSync(process.execPath, [path.join(fixture, 'scripts/prepare-publish.mjs')], { encoding: 'utf8' });
    const landing = await readFile(path.join(fixture, 'publish/index.html'), 'utf8');
    if (verifyAssets) {
      const assetDir = path.join(fixture, 'publish/assets');
      const filenames = await readdir(assetDir);
      const hashed = filenames.filter(name => /\.[a-f0-9]{16}\.(css|js|jpg|gif|png|ico)$/.test(name));
      assert.equal(hashed.length, 10);
      for (const name of hashed) {
        const bytes = await readFile(path.join(assetDir, name));
        assert.equal(name.match(/\.([a-f0-9]{16})\./)[1], createHash('sha256').update(bytes).digest('hex').slice(0, 16));
      }
      assert(!filenames.some(name => /countdown|update-schedule/.test(name)));
    }
    return landing;
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

test('research reading keeps its supporting rail without the retired clock', () => {
  assert(html.includes('class="research-grid"'));
  assert(css.includes('.research-context .countdown{display:block;width:100%;max-width:none;margin:0;justify-self:stretch;'));
  assert(html.indexOf('class="research-reading"') < html.indexOf('class="research-context"'));
  assert(!html.includes('data-review-countdown') && !html.includes('portfolio-countdown'));
  for (const id of ['research-tracks-title', 'research-progress-title']) {
    assert(html.includes(`aria-labelledby="${id}"`));
    assert(html.includes(`id="${id}"`));
  }
  assert(css.includes('grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr)'));
  assert(css.includes('@media(max-width:1150px)'));
  assert(css.includes('@media(max-width:900px){\n  .research-context{grid-template-columns:minmax(0,1fr)}'));
  assert(css.includes('.research-context{grid-template-columns:minmax(0,1fr)'));
});

test('research tracks connect questions to public notes and the progress log uses their dates', async () => {
  const rendered = await render(source);
  assert(rendered.includes(`class="research-tag">${source.posts.filter(p => p.kind !== 'project').length} 篇笔记</span>`));
  const tracks = rendered.match(/<ol class="research-track-list">([^]*?)<\/ol>/)[1];
  assert.equal([...tracks.matchAll(/<li>/g)].length, 3);
  for (const [, slug] of tracks.matchAll(/href="\/ai-infra-daily-notes\/notes\/([^/]+)\/"/g)) assert(source.posts.some(post => post.kind !== 'project' && post.slug === slug));
  const timeline = rendered.match(/<ol class="progress-timeline">([^]*?)<\/ol>/)[1];
  assert.equal([...timeline.matchAll(/<li>/g)].length, 3);
  for (const [, date] of timeline.matchAll(/datetime="([^"]+)"/g)) assert(source.posts.some(post => post.date === date || post.lastRevisedAt?.startsWith(date)));
  assert(rendered.includes('href="/ai-infra-daily-notes/daily/"'));
  assert(!rendered.includes('{{') && !rendered.includes('<!-- RESEARCH_PROGRESS -->'));
});

test('news updates and build timestamps never become personal progress', async () => {
  const changed = structuredClone(source);
  changed.updatedAt = '2030-12-31T00:00:00Z';
  changed.daily.dates.unshift({key:'12.31',day:'31',week:'THU'});
  changed.daily.reports['12.31'] = [{...changed.daily.reports[changed.daily.dates[1].key][0], title:'NEWS_ONLY_MARKER'}];
  const first = await render(source), second = await render(changed);
  const log = value => value.match(/<ol class="progress-timeline">([^]*?)<\/ol>/)[1];
  assert.equal(log(first),log(second));
  assert(!second.includes('NEWS_ONLY_MARKER') && !second.includes('2030-12-31'));
});

test('hidden notes disappear from both tracks and progress; empty states make no claims', async () => {
  const changed = structuredClone(source);
  changed.posts=[];delete changed.daily;
  const rendered=await render(changed);
  assert(rendered.includes('研究主线会随公开笔记逐步展开'));
  assert(rendered.includes('有新的公开笔记后，会记录在这里'));
  assert(!rendered.includes('/notes/') && !rendered.includes('datetime=""'));
});

test('a reviewed revision appears on its own date with escaped descriptive text', async () => {
  const changed=structuredClone(source);
  const post=changed.posts.find(p=>p.kind !== 'project');
  post.lastRevisedAt='2026-10-30T10:00:00Z';
  post.progressSummary='<script>untrusted</script>';
  post.summary='<unsafe summary>';post.tags=['<unsafe tag>'];
  post.date='2026-10-29';
  const rendered=await render(changed);
  const log=rendered.match(/<ol class="progress-timeline">([^]*?)<\/ol>/)[1];
  assert(log.includes('datetime="2026-10-30"') && log.includes('<span>修订</span>'));
  assert(log.includes('&lt;script&gt;untrusted&lt;/script&gt;'));
  assert(!log.includes('<script>untrusted'));
  assert(rendered.includes('&lt;unsafe summary&gt;') && rendered.includes('&lt;unsafe tag&gt;'));
});


test('fresh HTML references exact content hashes and CSS edits change only its asset URL', async () => {
  const initial = await render(source, { verifyAssets: true });
  const changed = await render(source, { cssSuffix: '\n/* changed layout fixture */\n', verifyAssets: true });
  const cssUrl = html => html.match(/href="(\/assets\/portfolio\.[a-f0-9]{16}\.css)"/)?.[1];
  assert(cssUrl(initial));
  assert(cssUrl(changed));
  assert.notEqual(cssUrl(initial), cssUrl(changed));
  const modules = html => [...html.matchAll(/src="(\/assets\/[^"?#]+\.js)"/g)].map(match => match[1]);
  assert.deepEqual(modules(initial), modules(changed));
  assert.equal(modules(initial).length, 2);
  for (const url of modules(initial)) assert(/\.[a-f0-9]{16}\.js$/.test(url));
  assert(!initial.includes('href="/assets/portfolio.css"'));
});


test('sidebar quote is attributed and the redundant visible counter note is removed', () => {
  assert(html.includes('抽象不是为了模糊，而是为了在新的层次上做到精确。'));
  assert(html.includes('https://www.cs.utexas.edu/~EWD/transcriptions/EWD03xx/EWD340.html'));
  assert(html.includes('E. W. Dijkstra'));
  assert(html.includes('<em>The purpose of abstracting is not to be vague, but to create a new semantic level in which one can be absolutely precise.</em>'));
  assert(html.includes('class="sidebar-quote-original" lang="en"'));
  assert(css.includes('.sidebar-quote-original{font:12px/1.85'));
  assert(css.includes('overflow-y:auto'));
  assert(html.includes('中文为意译'));
  assert(!html.includes('A notebook for'));
  assert(!html.includes('<small>自启用起；非独立人数</small>'));
  assert(html.includes('统计首页加载次数，不是独立访客人数'));
});
