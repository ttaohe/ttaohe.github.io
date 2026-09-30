import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'out');
const content = JSON.parse(await readFile(path.join(root, 'lib/blog/content.json'), 'utf8'));
const status = JSON.parse(await readFile(path.join(root, 'lib/blog/feed-status.json'), 'utf8'));
const routes = ['', 'daily', 'research', 'experiments', ...content.posts.map(post => `notes/${post.slug}`)];
for (const route of routes) {
  const html = await readFile(path.join(output, route, 'index.html'), 'utf8');
  assert(html.includes('<html'), `Missing static HTML for /${route}`);
  assert(html.includes('内容源暂时无法更新') === status.stale, `Incorrect stale-data notice on /${route}`);
  if (route.startsWith('notes/')) {
    const post = content.posts.find(post => route.endsWith(post.slug));
    assert(html.includes(post.title), `Missing article title for ${post.slug}`);
    assert(html.includes(post.sections[0].paragraphs[0]), `Missing full article content for ${post.slug}`);
  }
}
await access(path.join(output, '.nojekyll'));
await access(path.join(output, '404.html'));
for (const file of await readdir(path.join(root, 'public/diagrams'))) await access(path.join(output, 'diagrams', file));
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
console.log(`Verified ${routes.length} routes, ${content.posts.length} full articles, all internal links and diagram assets.`);
