import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'publish');
const { basePath } = JSON.parse(await readFile(path.join(root, 'lib/site-config.json'), 'utf8'));
const appOutput = path.join(output, basePath);
const content = JSON.parse(await readFile(path.join(root, 'lib/blog/content.json'), 'utf8'));
const status = JSON.parse(await readFile(path.join(root, 'lib/blog/feed-status.json'), 'utf8'));
const decodeText = value => value.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&#39;', "'").replaceAll('&amp;', '&');
const routes = ['', 'daily', 'research', 'experiments', ...content.posts.map(post => `notes/${post.slug}`)];
for (const route of routes) {
  const html = await readFile(path.join(appOutput, route, 'index.html'), 'utf8');
  const text = decodeText(html);
  assert(html.includes('<html'), `Missing static HTML for ${basePath}/${route}`);
  assert(html.includes('内容源暂时无法更新') === status.stale, `Incorrect stale-data notice on ${basePath}/${route}`);
  if (route.startsWith('notes/')) {
    const post = content.posts.find(post => route.endsWith(post.slug));
    assert(text.includes(post.title), `Missing article title for ${post.slug}`);
    assert(text.includes(post.sections[0].paragraphs[0]), `Missing full article content for ${post.slug}`);
  }
  // Every app-internal route and asset must remain inside its portfolio section.
  for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)[^"]*"/g)) {
    if (!match[1].startsWith('//')) assert(match[1].startsWith(`${basePath}/`), `Unprefixed app URL ${match[1]} on ${route}`);
  }
}
const landing = await readFile(path.join(output, 'index.html'), 'utf8');
assert(landing.includes(`href="${basePath}/"`), 'Portfolio landing page does not link to the notes section');
assert(!landing.includes('知识地图 <'), 'Root must remain the portfolio landing page');
if (content.daily) {
  const dailyHtml = decodeText(await readFile(path.join(appOutput, 'daily/index.html'), 'utf8'));
  const latest = content.daily.dates[0].key;
  for (const item of content.daily.reports[latest] ?? []) assert(dailyHtml.includes(item.title), `Missing current Daily item ${item.id}`);
}
if (content.experiments) {
  const experimentHtml = decodeText(await readFile(path.join(appOutput, 'experiments/index.html'), 'utf8'));
  for (const item of content.experiments) assert(experimentHtml.includes(item.title), `Missing experiment ${item.id}`);
}
await access(path.join(output, '.nojekyll'));
await access(path.join(output, '404.html'));
for (const file of await readdir(path.join(root, 'public/diagrams'))) await access(path.join(appOutput, 'diagrams', file));
const allHtml = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (entry.name.endsWith('.html')) allHtml.push(target);
  }
}
await walk(output);
for (const file of allHtml) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)[^"]*"/g)) {
    const pathname = decodeURI(match[1]);
    if (pathname.startsWith('//')) continue;
    const local = path.join(output, pathname);
    let found = false;
    for (const candidate of [local, path.join(local, 'index.html'), `${local}.html`]) {
      try { await access(candidate); found = true; break; } catch {}
    }
    assert(found, `Broken static asset or route ${pathname} in ${path.relative(output, file)}`);
  }
}
const dailyCount = content.daily ? Object.values(content.daily.reports).flat().length : 0;
console.log(`Verified portfolio root, ${routes.length} prefixed routes, ${content.posts.length} full articles, ${dailyCount} Daily records, ${content.experiments?.length ?? 0} experiments, all internal links and diagram assets.`);
