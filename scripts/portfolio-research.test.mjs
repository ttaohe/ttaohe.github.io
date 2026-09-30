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
      assert.equal(hashed.length, 11);
      for (const name of hashed) {
        const bytes = await readFile(path.join(assetDir, name));
        assert.equal(name.match(/\.([a-f0-9]{16})\./)[1], createHash('sha256').update(bytes).digest('hex').slice(0, 16));
      }
      const countdownName = hashed.find(name => name.startsWith('portfolio-countdown.'));
      const countdown = await readFile(path.join(assetDir, countdownName), 'utf8');
      const scheduleName = countdown.match(/from '\.\/(update-schedule\.[a-f0-9]{16}\.js)'/)?.[1];
      assert(scheduleName && filenames.includes(scheduleName));
    }
    return landing;
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

test('research reading precedes the supporting rail and clock in semantic order', () => {
  assert(html.includes('class="research-grid"'));
  assert(css.includes('.research-context .countdown{display:block;width:100%;max-width:none;margin:0;justify-self:stretch;'));
  assert(html.indexOf('class="research-reading"') < html.indexOf('class="research-context"'));
  assert(html.indexOf('RECENT_FOCUS') < html.indexOf('data-review-countdown'));
  for (const id of ['mini-map-title', 'recent-focus-title']) {
    assert(html.includes(`aria-labelledby="${id}"`));
    assert(html.includes(`id="${id}"`));
  }
  assert(css.includes('grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr)'));
  assert(css.includes('@media(max-width:1150px)'));
  assert(css.includes('@media(max-width:900px){\n  .research-context{grid-template-columns:minmax(0,1fr)}'));
  assert(css.includes('.research-context{grid-template-columns:minmax(0,1fr)'));
});

test('homepage panels render full sourced content and six working topic shortcuts', async () => {
  const rendered = await render(source);
  const text = decode(rendered);
  assert(rendered.includes(`class="research-tag">${source.posts.length} 篇笔记</span>`));
  const notes = [...source.posts].reverse().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  for (const post of notes) {
    assert(text.includes(post.title));
    assert(text.includes(post.summary));
    assert(rendered.includes(`href="/ai-infra-daily-notes/notes/${post.slug}/"`));
  }
  const branches = rendered.match(/<ul class="topic-branches">([^]*?)<\/ul>/)[1];
  assert.equal([...branches.matchAll(/<li>/g)].length, 6);
  for (const [, slug] of branches.matchAll(/href="\/ai-infra-daily-notes\/notes\/([^/]+)\/"/g)) {
    assert(source.posts.some(post => post.slug === slug));
  }
  const latest = [...source.daily.dates].sort((a, b) => b.key.localeCompare(a.key))[0].key;
  const focus = rendered.match(/<ul class="focus-items">([^]*?)<\/ul>/)[1];
  assert.equal([...focus.matchAll(/<li>/g)].length, 2);
  assert(rendered.includes(`datetime="${source.daily.year}-${latest.replace('.', '-')}"`));
  for (const item of source.daily.reports[latest].slice(0, 2)) {
    assert(decode(focus).includes(item.title));
    assert(decode(focus).includes(item.source));
    assert(decode(focus).includes(item.sourceLabel));
  }
  assert(!rendered.includes('{{'));
  assert(!rendered.includes('<!-- RECENT_FOCUS -->'));
  assert(/portfolio-visits\.[a-f0-9]{16}\.js/.test(rendered));
});

test('focus uses the latest populated issue even when the archive order changes', async () => {
  const content = structuredClone(source);
  content.daily.dates.reverse();
  content.daily.dates.unshift({ key: '12.31', day: '31', week: 'THU' });
  content.daily.reports['12.31'] = [];
  const rendered = await render(content);
  const latest = [...source.daily.dates].sort((a, b) => b.key.localeCompare(a.key))[0].key;
  assert(rendered.includes(`datetime="${source.daily.year}-${latest.replace('.', '-')}"`));
  assert(!rendered.includes('datetime="2026-12-31"'));
});

test('missing articles lead to the full map and absent Daily has an honest empty state', async () => {
  const content = structuredClone(source);
  content.posts = [];
  delete content.daily;
  const rendered = await render(content);
  const branches = rendered.match(/<ul class="topic-branches">([^]*?)<\/ul>/)[1];
  assert.equal([...branches.matchAll(/href="\/ai-infra-daily-notes\/"/g)].length, 6);
  assert(!branches.includes('/notes/'));
  assert(rendered.includes('暂未收录每日简报'));
  assert(!rendered.includes('datetime=""'));
});

test('feed titles, summaries, tags and original source attributes are escaped', async () => {
  const content = structuredClone(source);
  content.posts.at(-1).summary = '<script>alert("unsafe")</script>';
  content.posts.at(-1).tags = ['<unsafe>'];
  const latest = [...content.daily.dates].sort((a, b) => b.key.localeCompare(a.key))[0].key;
  content.daily.reports[latest][0].title = '<unsafe title>';
  content.daily.reports[latest][0].source = 'https://example.test/?a=1&b="quote"';
  const rendered = await render(content);
  assert(rendered.includes('&lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt;'));
  assert(rendered.includes('&lt;unsafe&gt;'));
  assert(rendered.includes('&lt;unsafe title&gt;'));
  assert(rendered.includes('href="https://example.test/?a=1&amp;b=&quot;quote&quot;"'));
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
  assert.equal(modules(initial).length, 3);
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
