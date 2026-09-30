import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(root, 'portfolio/index.html'), 'utf8');
const css = await readFile(path.join(root, 'portfolio/styles.css'), 'utf8');
const source = JSON.parse(await readFile(path.join(root, 'lib/blog/content.json'), 'utf8'));
const decode = value => value.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&');

async function render(content) {
  const fixture = await mkdtemp(path.join(tmpdir(), 'portfolio-research-'));
  try {
    for (const dir of ['scripts', 'lib/blog', 'out']) await mkdir(path.join(fixture, dir), { recursive: true });
    await cp(path.join(root, 'portfolio'), path.join(fixture, 'portfolio'), { recursive: true });
    await cp(path.join(root, 'scripts/prepare-publish.mjs'), path.join(fixture, 'scripts/prepare-publish.mjs'));
    await cp(path.join(root, 'lib/update-schedule.ts'), path.join(fixture, 'lib/update-schedule.ts'));
    await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
    await writeFile(path.join(fixture, 'lib/site-config.json'), JSON.stringify({ basePath: '/ai-infra-daily-notes', siteOrigin: 'https://example.test' }));
    await writeFile(path.join(fixture, 'lib/blog/content.json'), JSON.stringify(content));
    await writeFile(path.join(fixture, 'out/404.html'), '<!doctype html><title>Not found</title>');
    execFileSync(process.execPath, [path.join(fixture, 'scripts/prepare-publish.mjs')], { encoding: 'utf8' });
    return await readFile(path.join(fixture, 'publish/index.html'), 'utf8');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

test('research reading precedes the supporting rail and clock in semantic order', () => {
  assert(html.includes('class="research-grid"'));
  assert(html.indexOf('class="research-reading"') < html.indexOf('class="research-context"'));
  assert(html.indexOf('RECENT_FOCUS') < html.indexOf('data-review-countdown'));
  for (const id of ['mini-map-title', 'recent-focus-title']) {
    assert(html.includes(`aria-labelledby="${id}"`));
    assert(html.includes(`id="${id}"`));
  }
  assert(css.includes('grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr)'));
  assert(css.includes('@media(max-width:1150px)'));
  assert(css.includes('.research-context{grid-template-columns:minmax(0,1fr)'));
});

test('homepage panels render full sourced content and six working topic shortcuts', async () => {
  const rendered = await render(source);
  const text = decode(rendered);
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
  assert(rendered.includes('portfolio-visits.js'));
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
