import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'lib/site-config.json'), 'utf8'));
const content = JSON.parse(await readFile(path.join(root, 'lib/blog/content.json'), 'utf8'));
const publish = path.join(root, 'publish');
await rm(publish, { recursive: true, force: true });
await mkdir(publish, { recursive: true });
await cp(path.join(root, 'out'), path.join(publish, config.basePath), { recursive: true });
await cp(path.join(root, 'portfolio/index.html'), path.join(publish, 'index.html'));
await cp(path.join(root, 'out/404.html'), path.join(publish, '404.html'));
await writeFile(path.join(publish, '.nojekyll'), '');
// Keep the first publication's direct article links useful after moving the section.
for (const route of ['daily', 'research', 'experiments', ...content.posts.map(post => `notes/${post.slug}`)]) {
  const target = `${config.basePath}/${route}/`;
  const directory = path.join(publish, route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="${config.siteOrigin}${target}"><title>AI Infra Notes · 页面已迁移</title><body><p>文章已迁移到 <a href="${target}">AI Infra Daily Notes</a>。</p></body></html>`);
}
console.log(`Prepared portfolio root and ${config.basePath}/ for GitHub Pages.`);
