import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncContent, validateContent, readLimitedResponse, MAX_FEED_BYTES } from './sync-content.mjs';
const rawFixture = await readFile(new URL('../lib/blog/content.json', import.meta.url), 'utf8');
const fixture = JSON.parse(rawFixture);

async function withProject(fn) {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'infra-feed-test-'));
  await mkdir(path.join(projectRoot, 'lib/blog'), { recursive: true });
  await writeFile(path.join(projectRoot, 'lib/blog/content.json'), JSON.stringify(fixture));
  await writeFile(path.join(projectRoot, 'lib/blog/feed-config.json'), JSON.stringify({ fileId: 'public-test-feed' }));
  try { await fn(projectRoot); } finally { await rm(projectRoot, { recursive: true, force: true }); }
}

// Keep byte-boundary fixtures independent of growth in the published archive.
const sizeTestContent = {
  schemaVersion: fixture.schemaVersion,
  updatedAt: fixture.updatedAt,
  posts: [{ ...fixture.posts[0], relatedSlugs: [] }],
};

function feedWithByteLength(size) {
  const content = { ...sizeTestContent, futureHistory: '修订记录' };
  const paddingBytes = size - Buffer.byteLength(JSON.stringify(content));
  assert.ok(paddingBytes >= 0, 'Test feed must fit within the requested byte length');
  content.futureHistory += 'x'.repeat(paddingBytes);
  const raw = JSON.stringify(content);
  assert.equal(Buffer.byteLength(raw), size);
  return raw;
}

function streamedResponse(raw, headers = {}) {
  const bytes = Buffer.from(raw);
  let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      // Split UTF-8 sequences across chunks as a real network stream can do.
      const end = Math.min(offset + 65_536, bytes.length);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  }), { headers });
}

test('feed limit is 15 MB in bytes', () => {
  assert.equal(MAX_FEED_BYTES, 15_000_000);
});

test('a valid 7.85 MB feed refreshes and is mirrored byte-for-byte', () => withProject(async projectRoot => {
  const raw = feedWithByteLength(7_850_000);
  await writeFile(path.join(projectRoot, 'lib/blog/content.json'), JSON.stringify(sizeTestContent));
  const result = await syncContent({
    projectRoot,
    fetchImpl: async () => streamedResponse(raw, { 'content-length': String(Buffer.byteLength(raw)) }),
  });
  assert.equal(result.status.stale, false);
  assert.deepEqual(result.content.posts, sizeTestContent.posts);
  assert.equal(await readFile(path.join(projectRoot, 'lib/blog/content.json'), 'utf8'), raw);
}));

test('a streamed UTF-8 response exactly at 15 MB is accepted', async t => {
  const raw = '界'.repeat(MAX_FEED_BYTES / 3);
  assert.equal(Buffer.byteLength(raw), MAX_FEED_BYTES);
  for (const [name, headers] of [
    ['declared content length', { 'content-length': String(MAX_FEED_BYTES) }],
    ['unknown content length', {}],
  ]) {
    await t.test(name, async () => {
      assert.equal(await readLimitedResponse(streamedResponse(raw, headers)), raw);
    });
  }
});

test('streamed UTF-8 overflow counts bytes even without a reliable content length', async t => {
  const raw = `${'界'.repeat(MAX_FEED_BYTES / 3)}x`;
  assert.equal(Buffer.byteLength(raw), MAX_FEED_BYTES + 1);
  assert.ok(raw.length < MAX_FEED_BYTES);
  for (const [name, headers] of [
    ['unknown content length', {}],
    ['understated content length', { 'content-length': '1' }],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(readLimitedResponse(streamedResponse(raw, headers)), /size limit/);
    });
  }
});

test('oversized feeds preserve the exact saved snapshot and stale-data notice', async t => {
  const raw = feedWithByteLength(MAX_FEED_BYTES + 1);
  for (const [name, headers] of [
    ['declared overflow', { 'content-length': String(Buffer.byteLength(raw)) }],
    ['streamed overflow', {}],
  ]) {
    await t.test(name, () => withProject(async projectRoot => {
      const contentPath = path.join(projectRoot, 'lib/blog/content.json');
      const before = await readFile(contentPath, 'utf8');
      const result = await syncContent({ projectRoot, fetchImpl: async () => streamedResponse(raw, headers) });
      assert.equal(result.status.stale, true);
      assert.equal(result.status.contentUpdatedAt, fixture.updatedAt);
      assert.deepEqual(result.content, fixture);
      assert.equal(await readFile(contentPath, 'utf8'), before);
      assert.deepEqual(JSON.parse(await readFile(path.join(projectRoot, 'lib/blog/feed-status.json'), 'utf8')), result.status);
    }));
  }
});

test('bundled snapshot is valid, with stable unique article routes', () => {
  assert.equal(validateContent(fixture).posts.length, fixture.posts.length);
  const invalid = structuredClone(fixture);
  invalid.posts.push(invalid.posts[0]);
  assert.throws(() => validateContent(invalid), /Duplicate/);
});
test('invalid external links and dangling related article links are rejected', () => {
  const invalid = structuredClone(fixture);
  invalid.posts[0].sources[0].url = 'javascript:alert(1)';
  assert.throws(() => validateContent(invalid));
  invalid.posts[0].sources[0].url = 'https://example.com';
  invalid.posts[0].relatedSlugs = ['unpublished-article'];
  assert.throws(() => validateContent(invalid), /Invalid related/);
});
test('successful refresh is validated, saved and marked current', () => withProject(async projectRoot => {
  const result = await syncContent({ projectRoot, fetchImpl: async () => new Response(JSON.stringify(fixture)) });
  assert.equal(result.status.stale, false);
  assert.deepEqual(JSON.parse(await readFile(path.join(projectRoot, 'lib/blog/content.json'), 'utf8')), fixture);
}));
test('network failure preserves all articles and enables stale-data notice', () => withProject(async projectRoot => {
  const result = await syncContent({ projectRoot, fetchImpl: async () => { throw new Error('Network unavailable'); } });
  assert.equal(result.status.stale, true);
  assert.deepEqual(result.content, fixture);
}));
test('HTML/invalid feed responses preserve saved snapshot', () => withProject(async projectRoot => {
  const result = await syncContent({ projectRoot, fetchImpl: async () => new Response('<html>login</html>') });
  assert.equal(result.status.stale, true);
  assert.deepEqual(result.content, fixture);
}));
test('a feed cannot silently remove published articles', () => withProject(async projectRoot => {
  const incoming = structuredClone(fixture);
  incoming.posts.pop();
  incoming.posts.forEach(post => post.relatedSlugs = []);
  const result = await syncContent({ projectRoot, fetchImpl: async () => new Response(JSON.stringify(incoming)) });
  assert.equal(result.status.stale, true);
  assert.deepEqual(result.content, fixture);
}));
test('oversized response is rejected before parsing', async () => {
  await assert.rejects(readLimitedResponse(new Response('{}', { headers: { 'content-length': String(MAX_FEED_BYTES + 1) } })), /size limit/);
});

test('legacy post-only feeds remain compatible while missing sections keep a visible fallback notice', () => withProject(async projectRoot => {
  const legacy = structuredClone(fixture);
  delete legacy.daily;
  delete legacy.experiments;
  assert.equal(validateContent(legacy).posts.length, fixture.posts.length);
  const result = await syncContent({ projectRoot, fetchImpl: async () => new Response(JSON.stringify(legacy)) });
  assert.equal(result.status.stale, true);
  assert.deepEqual(result.content.daily, fixture.daily);
  assert.deepEqual(result.content.experiments, fixture.experiments);
}));
test('archived Daily items cannot silently disappear during synchronization', () => withProject(async projectRoot => {
  const incoming = structuredClone(fixture);
  incoming.daily.reports[incoming.daily.dates[0].key].pop();
  const result = await syncContent({ projectRoot, fetchImpl: async () => new Response(JSON.stringify(incoming)) });
  assert.equal(result.status.stale, true);
  assert.deepEqual(result.content.daily, fixture.daily);
}));
test('Daily data requires valid date, column and experiment relationships', () => {
  const invalid = structuredClone(fixture);
  invalid.daily.dates = [];
  assert.throws(() => validateContent(invalid), /Daily dates/);
  const experiment = structuredClone(fixture);
  experiment.experiments[0].related = ['does-not-exist'];
  assert.throws(() => validateContent(experiment), /unknown article/);
});

test('unknown extension fields survive validation and mirroring', () => withProject(async projectRoot => {
  const expanded = structuredClone(fixture);
  expanded.futureSection = { revision: 2, title: 'Preserve future content' };
  expanded.posts[0].futureNote = 'Keep this extension';
  const result = await syncContent({ projectRoot, fetchImpl: async () => new Response(JSON.stringify(expanded)) });
  assert.equal(result.status.stale, false);
  assert.deepEqual(result.content.futureSection, expanded.futureSection);
  const saved = JSON.parse(await readFile(path.join(projectRoot, 'lib/blog/content.json'), 'utf8'));
  assert.equal(saved.posts[0].futureNote, expanded.posts[0].futureNote);
}));

test('complete Drive JSON is mirrored byte-for-byte', () => withProject(async projectRoot => {
  assert.ok(Buffer.byteLength(rawFixture) <= MAX_FEED_BYTES, 'Published fixture must fit the feed byte limit');
  const result = await syncContent({ projectRoot, fetchImpl: async () => new Response(rawFixture) });
  assert.equal(result.status.stale, false);
  assert.equal(await readFile(path.join(projectRoot, 'lib/blog/content.json'), 'utf8'), rawFixture);
}));

test('formatted JSON and future fields are mirrored byte-for-byte', () => withProject(async projectRoot => {
  const expanded = { ...sizeTestContent, futureSection: { revision: 2, title: 'Preserve formatting' } };
  const raw = JSON.stringify(expanded, null, 3) + '\n\n';
  await writeFile(path.join(projectRoot, 'lib/blog/content.json'), JSON.stringify(sizeTestContent));
  const result = await syncContent({ projectRoot, fetchImpl: async () => new Response(raw) });
  assert.equal(result.status.stale, false);
  assert.deepEqual(result.content, expanded);
  assert.equal(await readFile(path.join(projectRoot, 'lib/blog/content.json'), 'utf8'), raw);
}));
