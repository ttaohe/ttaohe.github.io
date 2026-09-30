import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
  assert(!/portfolio-visits(?:\.[a-f0-9]+)?\.js/.test(html), `Homepage-only counter must not load on ${basePath}/${route}`);
  assert(html.includes('内容源暂时无法更新') === status.stale, `Incorrect stale-data notice on ${basePath}/${route}`);
  if (route.startsWith('notes/')) {
    const post = content.posts.find(post => route.endsWith(post.slug));
    assert(text.includes(post.title), `Missing article title for ${post.slug}`);
    assert(text.includes(post.sections[0].paragraphs[0]), `Missing full article content for ${post.slug}`);
  }
  // Drive download endpoints can return valid SVG bytes but block browser image embedding.
  assert(!/<img[^>]+src="https:\/\/drive\.google\.com\/uc\?/.test(html), `Non-embeddable Drive image on ${route}; publish a static mirror first`);
  // Every app-internal route and asset must remain inside its portfolio section.
  for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)[^"]*"/g)) {
    if (!match[1].startsWith('//')) assert(match[1].startsWith(`${basePath}/`), `Unprefixed app URL ${match[1]} on ${route}`);
  }
}
const landing = await readFile(path.join(output, 'index.html'), 'utf8');
assert(landing.includes(`href="${basePath}/"`), 'Portfolio landing page does not link to the notes section');
assert(!landing.includes('知识地图 <'), 'Root must remain the portfolio landing page');
for (const text of ['TaoHe', '何涛', 'Northwestern Polytechnical University', 'Wuhan University', '西北工业大学 · 本科 · 电子信息工程', '武汉大学 · 硕士 · 计算机应用技术', 'Electronic Information Engineering', 'Computer Application Technology', '经历与项目', 'MLA L2 Host Cache Deduplication', '完整研究记录待补充', '距离下次资料检查', '上次内容更新']) assert(landing.includes(text), `Missing confirmed portfolio content: ${text}`);
assert(landing.includes('id="mla-tp-l2-cache-deduplication"') && landing.includes('href="#mla-tp-l2-cache-deduplication"'), 'Project index must resolve to its stable on-page summary');
for (const years of [['2019', '2023'], ['2023', '2026']]) assert(landing.includes(`<time datetime="${years[0]}">${years[0]}</time>–<time datetime="${years[1]}">${years[1]}</time>`), `Missing confirmed education years ${years.join('–')}`);
for (const [school, extension] of [['nwpu', 'gif'], ['whu', 'png']]) assert(new RegExp(`src="/assets/${school}-emblem\\.[a-f0-9]{16}\\.${extension}"`).test(landing), `Missing fingerprinted official ${school} emblem`);
for (const [company, extension] of [['xiaomi', 'png'], ['ant-group', 'png'], ['infinigence-ai', 'ico']]) assert(new RegExp(`src="/assets/${company}-logo\\.[a-f0-9]{16}\\.${extension}"`).test(landing), `Missing fingerprinted official ${company} logo`);
for (const text of ['Experience', 'Xiaomi', 'Ant Group', 'Infinigence AI', 'On-device Inference Infrastructure', 'LLM Inference Infrastructure']) assert(landing.includes(text), `Missing approved Experience content: ${text}`);
assert(!landing.includes('{{'), 'Unresolved portfolio template marker');
assert(landing.includes('class="research-grid"') && landing.includes('class="research-context"'), 'Research two-column layout is missing');
assert(landing.includes('/favicon.svg?v=walnut-1'), 'Homepage must use the walnut favicon');
const topicLinks = landing.match(/<ul class="topic-branches">([^]*?)<\/ul>/)?.[1] ?? '';
assert.equal([...topicLinks.matchAll(/<li>/g)].length, 6, 'Homepage must contain six linked topic shortcuts');
const latestFocusDate = content.daily && [...content.daily.dates].sort((a, b) => b.key.localeCompare(a.key)).find(date => content.daily.reports[date.key]?.length);
if (latestFocusDate) {
  assert(landing.includes(`datetime="${content.daily.year}-${latestFocusDate.key.replace('.', '-')}"`), 'Focus panel must date the actual Daily issue');
  const focus = decodeText(landing.match(/<ul class="focus-items">([^]*?)<\/ul>/)?.[1] ?? '');
  for (const item of content.daily.reports[latestFocusDate.key].slice(0, 2)) {
    assert(focus.includes(item.title) && focus.includes(item.source) && focus.includes(item.sourceLabel), 'Focus content must retain its exact source and title');
  }
}
assert(!landing.includes('冯开宇') && !landing.includes('北京理工大学') && !landing.includes('GPA:'), 'Upstream sample resume content must never appear on the personal homepage');
assert(!/href="[^"]*\.pdf/i.test(landing), 'No personal PDF resume has been supplied');
assert(landing.includes(content.updatedAt), 'Homepage countdown must use the authoritative content timestamp');
assert(landing.includes('data-visit-counter') && landing.includes('统计首页加载次数，不是独立访客人数'), 'Homepage counter must disclose its pageview scope');
assert(/src="\/assets\/portfolio-visits\.[a-f0-9]{16}\.js"/.test(landing), 'Homepage counter must use a fingerprinted asset');
const assetUrls = [...landing.matchAll(/(?:href|src)="(\/assets\/[^"?#]+)"/g)].map(match => match[1]);
assert.equal(assetUrls.length, 10, 'Homepage must load its portrait, two school emblems, three company logos, stylesheet and three modules');
for (const assetUrl of assetUrls) {
  assert(/\.[a-f0-9]{16}\.(?:css|js|jpg|gif|png|ico)$/.test(assetUrl), `Unversioned homepage asset ${assetUrl}`);
}
for (const filename of await readdir(path.join(output, 'assets'))) {
  const match = filename.match(/\.([a-f0-9]{16})\.(?:css|js|jpg|gif|png|ico)$/);
  if (!match) continue; // Compatibility aliases are not referenced by fresh HTML.
  const bytes = await readFile(path.join(output, 'assets', filename));
  assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0, 16), match[1], `Asset hash mismatch: ${filename}`);
  if (filename.startsWith('portfolio-countdown.')) {
    const schedule = bytes.toString().match(/from '\.\/(update-schedule\.[a-f0-9]{16}\.js)'/);
    assert(schedule, 'Countdown must import a fingerprinted schedule module');
    await access(path.join(output, 'assets', schedule[1]));
  }
}
assert(!/首页累计访问\s*\d/.test(landing), 'A pageview count must come from the live API, never a seeded HTML value');
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
