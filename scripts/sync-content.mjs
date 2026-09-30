import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { blogSchema } from '../lib/blog/schema.ts';

export const MAX_FEED_BYTES = 5_000_000;
const root = fileURLToPath(new URL('../', import.meta.url));

export function validateContent(value) {
  const content = blogSchema.parse(value);
  const slugs = new Set(content.posts.map(post => post.slug));
  for (const post of content.posts) {
    for (const slug of post.relatedSlugs) {
      if (slug === post.slug || !slugs.has(slug)) throw new Error(`Invalid related article in ${post.slug}`);
    }
  }
  if (content.daily) {
    const { reports, dates, columns } = content.daily;
    if (!dates.length) throw new Error('Daily dates cannot be empty');
    const dateKeys = new Set(dates.map(item => item.key));
    if (dateKeys.size !== dates.length) throw new Error('Duplicate Daily date');
    const columnIds = new Set(columns.map(item => item.id));
    const itemIds = new Set();
    for (const [date, items] of Object.entries(reports)) {
      if (!dateKeys.has(date)) throw new Error('Daily report date is missing from archive');
      for (const item of items) {
        if (itemIds.has(item.id)) throw new Error('Duplicate Daily item');
        itemIds.add(item.id);
        if (item.columns.some(column => !columnIds.has(column))) throw new Error('Unknown Daily column');
      }
    }
  }
  if (content.experiments) {
    if (new Set(content.experiments.map(item => item.id)).size !== content.experiments.length) throw new Error('Duplicate experiment');
    for (const experiment of content.experiments) {
      if (experiment.related.some(slug => !slugs.has(slug))) throw new Error('Experiment references an unknown article');
    }
  }
  if (!Number.isFinite(Date.parse(content.updatedAt))) throw new Error('Invalid content update timestamp');
  return content;
}

export async function readLimitedResponse(response) {
  if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_FEED_BYTES) throw new Error('Feed exceeds size limit');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of response.body ?? []) {
    bytes += chunk.length;
    if (bytes > MAX_FEED_BYTES) throw new Error('Feed exceeds size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function atomicJson(file, value) {
  const temp = `${file}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, file);
}

export async function syncContent({ projectRoot = root, fetchImpl = fetch, now = new Date() } = {}) {
  const contentPath = path.join(projectRoot, 'lib/blog/content.json');
  const statusPath = path.join(projectRoot, 'lib/blog/feed-status.json');
  const config = JSON.parse(await readFile(path.join(projectRoot, 'lib/blog/feed-config.json'), 'utf8'));
  const fallback = validateContent(JSON.parse(await readFile(contentPath, 'utf8')));
  let content = fallback;
  let stale = true;
  let reason = 'Public feed unavailable; using the saved snapshot.';
  try {
    if (!config.fileId || !/^[a-zA-Z0-9_-]+$/.test(config.fileId)) throw new Error('Invalid public feed ID');
    const response = await fetchImpl(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(config.fileId)}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'application/json' },
    });
    content = validateContent(JSON.parse(await readLimitedResponse(response)));
    // A malformed or truncated feed must never silently remove published routes.
    const incoming = new Set(content.posts.map(post => post.slug));
    if (fallback.posts.some(post => !incoming.has(post.slug))) throw new Error('Feed omits a previously published article');
    if (Date.parse(content.updatedAt) < Date.parse(fallback.updatedAt)) throw new Error('Feed is older than the saved snapshot');
    const missingSections = [];
    for (const key of ['daily', 'experiments']) {
      if (fallback[key] && !content[key]) {
        content[key] = fallback[key];
        missingSections.push(key);
      }
    }
    if (fallback.daily && content.daily) {
      const incomingIds = new Set(Object.values(content.daily.reports).flat().map(item => item.id));
      if (Object.values(fallback.daily.reports).flat().some(item => !incomingIds.has(item.id))) throw new Error('Feed omits an archived Daily item');
    }
    if (fallback.experiments && content.experiments) {
      const incomingIds = new Set(content.experiments.map(item => item.id));
      if (fallback.experiments.some(item => !incomingIds.has(item.id))) throw new Error('Feed omits a saved experiment');
    }
    content = validateContent(content);
    await atomicJson(contentPath, content);
    stale = missingSections.length > 0;
    reason = stale ? `Feed did not include ${missingSections.join(', ')}; saved sections retained.` : '';
    if (stale) console.warn(`::warning::${reason}`);
  } catch (error) {
    content = fallback;
    console.warn(`::warning::${error.message}. Published snapshot retained with a visible stale-data notice.`);
  }
  const status = { stale, checkedAt: now.toISOString(), contentUpdatedAt: content.updatedAt, reason };
  await atomicJson(statusPath, status);
  console.log(`Content: ${content.posts.length} articles; ${stale ? 'saved snapshot (stale notice enabled)' : 'public feed verified'}`);
  return { content, status };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await syncContent();
