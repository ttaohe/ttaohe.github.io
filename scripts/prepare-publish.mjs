import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { shanghaiTimestamp } from '../lib/update-schedule.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'lib/site-config.json'), 'utf8'));
const content = JSON.parse(await readFile(path.join(root, 'lib/blog/content.json'), 'utf8'));
const publish = path.join(root, 'publish');
await rm(publish, { recursive: true, force: true });
await mkdir(publish, { recursive: true });
await cp(path.join(root, 'out'), path.join(publish, config.basePath), { recursive: true });
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
const selected = [...content.posts].reverse().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
const noteMarkup = selected.map((post, index) => `<li class="note"><span class="note-number">0${index + 1}</span><div><a href="${config.basePath}/notes/${post.slug}/">${escapeHtml(post.title)}</a><p class="note-meta">${escapeHtml(post.category)} · ${escapeHtml(post.date)}</p></div></li>`).join('');
const landing = (await readFile(path.join(root, 'portfolio/index.html'), 'utf8'))
  .replaceAll('{{CONTENT_UPDATED_AT}}', escapeHtml(content.updatedAt))
  .replaceAll('{{LAST_CONTENT_UPDATE}}', escapeHtml(shanghaiTimestamp(content.updatedAt)))
  .replaceAll('{{NOTE_COUNT}}', String(content.posts.length).padStart(2, '0'))
  .replace('<!-- SELECTED_NOTES -->', noteMarkup);
await writeFile(path.join(publish, 'index.html'), landing);
await mkdir(path.join(publish, 'assets'), { recursive: true });
const scheduleModel = await readFile(path.join(root, 'lib/update-schedule.ts'), 'utf8');
await writeFile(path.join(publish, 'assets/update-schedule.js'), ts.transpileModule(scheduleModel, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText);
await cp(path.join(root, 'portfolio/countdown.mjs'), path.join(publish, 'assets/portfolio-countdown.js'));
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
