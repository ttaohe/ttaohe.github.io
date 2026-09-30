import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncContent, validateContent, readLimitedResponse, MAX_FEED_BYTES } from './sync-content.mjs';
const fixture = JSON.parse(await readFile(new URL('../lib/blog/content.json', import.meta.url), 'utf8'));

async function withProject(fn) {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'infra-feed-test-'));
  await mkdir(path.join(projectRoot, 'lib/blog'), { recursive: true });
  await writeFile(path.join(projectRoot, 'lib/blog/content.json'), JSON.stringify(fixture));
  await writeFile(path.join(projectRoot, 'lib/blog/feed-config.json'), JSON.stringify({ fileId: 'public-test-feed' }));
  try { await fn(projectRoot); } finally { await rm(projectRoot, { recursive: true, force: true }); }
}

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
