import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
const noteMarkup = selected.map((post, index) => `<li class="note"><span class="note-number">0${index + 1}</span><article><a href="${config.basePath}/notes/${post.slug}/">${escapeHtml(post.title)}</a><p class="note-meta">${escapeHtml(post.category)} · <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time></p><p class="note-summary">${escapeHtml(post.summary)}</p><div class="note-tags">${post.tags.slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div></article></li>`).join('');
// Topic shortcuts lead to real related articles. A missing article falls back to the full map.
const topics = [
  ['引擎与调度', 'pd-c2c-coordination'],
  ['缓存与状态', 'state-recovery'],
  ['通信与流水', 'pd-c2c-coordination'],
  ['异构内存', 'pd-c2c-coordination'],
  ['混合注意力', 'direct-linker'],
  ['MoE 与算子', 'vllm-fp4-moe-live-rows'],
];
const topicMarkup = topics.map(([label, slug]) => {
  const post = content.posts.find(post => post.slug === slug);
  const href = post ? `${config.basePath}/notes/${post.slug}/` : `${config.basePath}/`;
  const accessibleLabel = post ? `${label}：${post.title}` : `${label}：查看完整知识地图`;
  return `<li><a href="${href}" aria-label="${escapeHtml(accessibleLabel)}">${label}</a></li>`;
}).join('');
const daily = content.daily;
const latestDaily = daily && [...daily.dates].sort((a, b) => b.key.localeCompare(a.key)).find(date => daily.reports[date.key]?.length);
const focusDate = latestDaily ? `${daily.year}-${latestDaily.key.replace('.', '-')}` : '';
const focusMarkup = latestDaily ? daily.reports[latestDaily.key].slice(0, 2).map(item => `<li><a class="focus-title" href="${escapeHtml(item.source)}">${escapeHtml(item.title)} <span aria-hidden="true">↗</span></a><span class="focus-source">${escapeHtml(item.sourceLabel)} · 简报收录</span></li>`).join('') : '<li class="panel-caption">暂未收录每日简报</li>';
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
const scheduleModel = await readFile(path.join(root, 'lib/update-schedule.ts'), 'utf8');
const schedulePath = await publishAsset('update-schedule.js', ts.transpileModule(scheduleModel, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText);
const countdownSource = (await readFile(path.join(root, 'portfolio/countdown.mjs'), 'utf8')).replace("'./update-schedule.js'", `'./${path.basename(schedulePath)}'`);
const assets = {
  '/assets/resume-ng-template.pdf': await publishAsset('resume-ng-template.pdf', await readFile(path.join(root, 'portfolio/resume/resume-ng-template.pdf'))),
  '/assets/xiaomi-logo.png': await publishAsset('xiaomi-logo.png', await readFile(path.join(root, 'portfolio/companies/xiaomi-logo.png'))),
  '/assets/ant-group-logo.png': await publishAsset('ant-group-logo.png', await readFile(path.join(root, 'portfolio/companies/ant-group-logo.png'))),
  '/assets/infinigence-ai-logo.ico': await publishAsset('infinigence-ai-logo.ico', await readFile(path.join(root, 'portfolio/companies/infinigence-ai-logo.ico'))),

  '/assets/nwpu-emblem.gif': await publishAsset('nwpu-emblem.gif', await readFile(path.join(root, 'portfolio/schools/nwpu-emblem.gif'))),
  '/assets/whu-emblem.png': await publishAsset('whu-emblem.png', await readFile(path.join(root, 'portfolio/schools/whu-emblem.png'))),
  '/assets/portfolio-avatar.jpg': await publishAsset('portfolio-avatar.jpg', await readFile(path.join(root, 'portfolio/avatar.jpg'))),
  '/assets/portfolio.css': await publishAsset('portfolio.css', await readFile(path.join(root, 'portfolio/styles.css'))),
  '/assets/portfolio-ui.js': await publishAsset('portfolio-ui.js', await readFile(path.join(root, 'portfolio/ui.mjs'))),
  '/assets/portfolio-countdown.js': await publishAsset('portfolio-countdown.js', countdownSource),
  '/assets/portfolio-visits.js': await publishAsset('portfolio-visits.js', await readFile(path.join(root, 'portfolio/visits.mjs'))),
};
let landing = (await readFile(path.join(root, 'portfolio/index.html'), 'utf8'))
  .replaceAll('{{CONTENT_UPDATED_AT}}', escapeHtml(content.updatedAt))
  .replaceAll('{{LAST_CONTENT_UPDATE}}', escapeHtml(shanghaiTimestamp(content.updatedAt)))
  .replaceAll('{{NOTE_COUNT}}', String(content.posts.length).padStart(2, '0'))
  .replace('<!-- FOCUS_DATE -->', focusDate ? `<time datetime="${escapeHtml(focusDate)}">${escapeHtml(focusDate)}</time>` : '')
  .replace('<!-- SELECTED_NOTES -->', noteMarkup)
  .replace('<!-- TOPIC_LINKS -->', topicMarkup)
  .replace('<!-- RECENT_FOCUS -->', focusMarkup);
for (const [unversioned, versioned] of Object.entries(assets)) landing = landing.replaceAll(unversioned, versioned);
await writeFile(path.join(publish, 'index.html'), landing);
// Project documents have stable, independent URLs and share the same theme assets.
for (const slug of ['mla-tp-l2-cache-deduplication']) {
  let document = await readFile(path.join(root, 'portfolio/projects', slug, 'index.html'), 'utf8');
  for (const [unversioned, versioned] of Object.entries(assets)) document = document.replaceAll(unversioned, versioned);
  const directory = path.join(publish, 'projects', slug);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), document);
}
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
