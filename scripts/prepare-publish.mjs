import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'lib/site-config.json'), 'utf8'));
const content = JSON.parse(await readFile(path.join(root, 'lib/blog/content.json'), 'utf8'));
const publish = path.join(root, 'publish');
await rm(publish, { recursive: true, force: true });
await mkdir(publish, { recursive: true });
if (!config.publicContentOrigin) await cp(path.join(root, 'out'), path.join(publish, config.basePath), { recursive: true });
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
const researchPosts = content.posts.filter(post => post.kind !== 'project');
const selected = [...researchPosts].reverse().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
const noteMarkup = selected.map((post, index) => `<li class="note"><span class="note-number">0${index + 1}</span><article><a href="${config.basePath}/notes/${post.slug}/">${escapeHtml(post.title)}</a><p class="note-meta">${escapeHtml(post.category)} · <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time></p><p class="note-summary">${escapeHtml(post.summary)}</p><div class="note-tags">${post.tags.slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div></article></li>`).join('');
// Curated questions connect only to currently public notes. News is kept out of the progress log.
const progress = JSON.parse(await readFile(path.join(root, 'portfolio/research-progress.json'), 'utf8'));
const articleHref = post => `${config.basePath}/notes/${post.slug}/`;
const byDate = (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);
const trackMarkup = progress.tracks.map(track => {
  const posts = track.slugs.map(slug => researchPosts.find(post => post.slug === slug)).filter(Boolean);
  if (!posts.length) return '';
  return `<li><span class="track-label">${escapeHtml(track.title)}</span><p class="track-question">${escapeHtml(track.question)}</p><div class="track-notes">${posts.map(post => `<a href="${articleHref(post)}" title="${escapeHtml(post.title)}" aria-label="${escapeHtml(post.title)}">${escapeHtml(progress.labels?.[post.slug] || post.title)} <span aria-hidden="true">↗</span></a>`).join('')}</div></li>`;
}).join('') || '<li class="progress-empty">研究主线会随公开笔记逐步展开</li>';
const noteUpdateDate = post => {
  const revised = typeof post.lastRevisedAt === 'string' ? post.lastRevisedAt.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(revised) && Number.isFinite(Date.parse(revised)) && revised > post.date ? revised : post.date;
};
const updates = [...researchPosts].sort((a, b) => noteUpdateDate(b).localeCompare(noteUpdateDate(a)) || byDate(a, b)).slice(0, 3);
const progressMarkup = updates.map(post => {
  const entry = progress.milestones.find(item => item.slug === post.slug);
  const summary = post.progressSummary || entry?.summary || post.title;
  const date = noteUpdateDate(post);
  const kind = date > post.date ? '修订' : '笔记';
  return `<li><div class="progress-meta"><time datetime="${escapeHtml(date)}">${escapeHtml(date.replaceAll('-', '.'))}</time><span>${kind}</span></div><a href="${articleHref(post)}" aria-label="${escapeHtml(summary + '：' + post.title)}">${escapeHtml(summary)} <span aria-hidden="true">↗</span></a></li>`;
}).join('') || '<li class="progress-empty">有新的公开笔记后，会记录在这里</li>';
// Content-addressed filenames keep fresh HTML from reusing an older cached asset.
await mkdir(path.join(publish, 'assets'), { recursive: true });
async function publishAsset(name, content) {
  const extension = path.extname(name);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const filename = `${name.slice(0, -extension.length)}.${hash}${extension}`;
  await writeFile(path.join(publish, 'assets', filename), content);
  // Retain aliases so previously cached HTML and module imports still resolve.
  await writeFile(path.join(publish, 'assets', name), content);
  return `/assets/${filename}`;
}
const assets = {
  '/assets/wechat-qr.png': await publishAsset('wechat-qr.png', await readFile(path.join(root, 'portfolio/contact/wechat-qr.png'))),
  '/assets/ttaohe-resume.pdf': await publishAsset('ttaohe-resume.pdf', await readFile(path.join(root, 'portfolio/resume/ttaohe-resume.pdf'))),
  '/assets/xiaomi-logo.png': await publishAsset('xiaomi-logo.png', await readFile(path.join(root, 'portfolio/companies/xiaomi-logo.png'))),
  '/assets/ant-group-logo.png': await publishAsset('ant-group-logo.png', await readFile(path.join(root, 'portfolio/companies/ant-group-logo.png'))),
  '/assets/infinigence-ai-logo.ico': await publishAsset('infinigence-ai-logo.ico', await readFile(path.join(root, 'portfolio/companies/infinigence-ai-logo.ico'))),

  '/assets/nwpu-emblem.gif': await publishAsset('nwpu-emblem.gif', await readFile(path.join(root, 'portfolio/schools/nwpu-emblem.gif'))),
  '/assets/whu-emblem.png': await publishAsset('whu-emblem.png', await readFile(path.join(root, 'portfolio/schools/whu-emblem.png'))),
  '/assets/portfolio-avatar.jpg': await publishAsset('portfolio-avatar.jpg', await readFile(path.join(root, 'portfolio/avatar.jpg'))),
  '/assets/portfolio.css': await publishAsset('portfolio.css', await readFile(path.join(root, 'portfolio/styles.css'))),
  '/assets/portfolio-ui.js': await publishAsset('portfolio-ui.js', await readFile(path.join(root, 'portfolio/ui.mjs'))),
  '/assets/portfolio-visits.js': await publishAsset('portfolio-visits.js', await readFile(path.join(root, 'portfolio/visits.mjs'))),
};
let landing = (await readFile(path.join(root, 'portfolio/index.html'), 'utf8'))
  .replaceAll('{{NOTE_COUNT}}', String(researchPosts.length))
  .replace('<!-- SELECTED_NOTES -->', noteMarkup)
  .replace('<!-- RESEARCH_TRACKS -->', trackMarkup)
  .replace('<!-- RESEARCH_PROGRESS -->', progressMarkup);
for (const [unversioned, versioned] of Object.entries(assets)) landing = landing.replaceAll(unversioned, versioned);
await writeFile(path.join(publish, 'index.html'), landing);
if (!config.publicContentOrigin) await cp(path.join(root, 'out/404.html'), path.join(publish, '404.html'));
await writeFile(path.join(publish, '.nojekyll'), '');
// Keep the first publication's direct article links useful after moving the section.
for (const route of ['daily', 'research', 'experiments', ...content.posts.map(post => `notes/${post.slug}`)]) {
  const target = `${config.basePath}/${route}/`;
  const directory = path.join(publish, route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="${config.siteOrigin}${target}"><title>AI Infra Notes · 页面已迁移</title><body><p>文章已迁移到 <a href="${target}">AI Infra Daily Notes</a>。</p></body></html>`);
}
console.log(`Prepared portfolio root and ${config.basePath}/ for GitHub Pages.`);
