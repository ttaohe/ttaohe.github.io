import test from 'node:test';
import assert from 'node:assert/strict';
import { VISITS_ENDPOINT, validVisitCount, recordHomepageVisit, initVisits } from '../portfolio/visits.mjs';

const ok = (views = 7) => ({ ok: true, json: async () => ({ page: 'home', views, startedAt: '2026-09-30T09:00:00.000Z' }) });
const fixture = () => {
  const value = { textContent: '' };
  const counter = { dataset: {}, querySelector: () => value };
  return { value, counter, doc: { querySelector: () => counter }, win: {} };
};

test('pageviews require a matching page and an exact non-negative safe integer', () => {
  assert(validVisitCount({ page: 'home', views: 0 }));
  assert(validVisitCount({ page: 'home', views: 1234 }));
  for (const views of [-1, 1.2, '12', null, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validVisitCount({ page: 'home', views }), false);
  }
  assert.equal(validVisitCount({ page: 'other', views: 1 }), false);
  assert.equal(validVisitCount(null), false);
});

test('one document records exactly one credential-free pageview and renders a grouped count', async () => {
  const { doc, win, value, counter } = fixture();
  const calls = [];
  const fetcher = async (...args) => { calls.push(args); return ok(1234); };
  const first = initVisits(doc, win, fetcher);
  assert.equal(counter.dataset.state, 'loading');
  assert.strictEqual(initVisits(doc, win, fetcher), first);
  await first;
  assert.strictEqual(initVisits(doc, win, fetcher), first);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], VISITS_ENDPOINT);
  const request = calls[0][1];
  assert.equal(request.method, 'POST');
  assert.equal(request.mode, 'cors');
  assert.equal(request.credentials, 'omit');
  assert.equal(request.referrerPolicy, 'no-referrer');
  assert.equal(request.cache, 'no-store');
  assert.deepEqual(request.headers, { 'Content-Type': 'application/json' });
  assert.equal(request.body, '{"page":"home"}');
  assert.equal(value.textContent, '👀 首页累计访问 1,234 次');
  assert.equal(counter.dataset.state, 'ready');
});

test('each new document or reload can record once; a restored document cannot recount', async () => {
  const first = fixture();
  const second = fixture();
  let calls = 0;
  const fetcher = async () => { calls++; return ok(calls); };
  await initVisits(first.doc, first.win, fetcher);
  await initVisits(first.doc, first.win, fetcher); // Same Document after BFCache restoration.
  assert.equal(calls, 1);
  await initVisits(second.doc, first.win, fetcher); // New Document, even if a WindowProxy is reused.
  assert.equal(calls, 2);
});

test('no counter means no request and no document listeners are registered', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return ok(); };
  await initVisits({ querySelector: () => null }, {}, fetcher);
  assert.equal(calls, 0);
  const { doc, win } = fixture();
  const unexpectedListener = () => { throw new Error('Visits must not listen to navigation, theme or scroll events'); };
  doc.addEventListener = win.addEventListener = unexpectedListener;
  await initVisits(doc, win, fetcher);
  assert.equal(calls, 1);
});

test('an ambiguous network failure performs one read, never a second write', async () => {
  const calls = [];
  const result = await recordHomepageVisit(async (_url, request) => {
    calls.push(request);
    if (request.method === 'POST') throw new TypeError('Network interrupted');
    return ok(8);
  });
  assert.equal(result.views, 8);
  assert.deepEqual(calls.map(call => call.method), ['POST', 'GET']);
  assert.equal(calls[1].body, undefined);
  assert.equal(calls[1].credentials, 'omit');
});

test('a timeout aborts the request and recovers with a bounded read only', async () => {
  const calls = [];
  const result = await recordHomepageVisit(async (_url, request) => {
    calls.push(request.method);
    if (request.method === 'GET') return ok(9);
    return new Promise((_resolve, reject) => request.signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true }));
  }, 5);
  assert.equal(result.views, 9);
  assert.deepEqual(calls, ['POST', 'GET']);
});

test('HTTP failure and invalid payloads do not retry or invent a zero', async () => {
  for (const response of [
    { ok: false, status: 503 },
    { ok: false, status: 403 },
    { ok: true, json: async () => ({ page: 'home', views: '12' }) },
    { ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } },
  ]) {
    const { doc, win, value, counter } = fixture();
    let calls = 0;
    await initVisits(doc, win, async () => { calls++; return response; });
    await initVisits(doc, win, async () => { calls++; return ok(99); });
    assert.equal(calls, 1);
    assert.equal(counter.dataset.state, 'unavailable');
    assert.equal(value.textContent, '👀 首页累计访问暂不可用');
  }
});

test('a failed recovery remains unavailable without another retry', async () => {
  const { doc, win, counter, value } = fixture();
  const methods = [];
  await initVisits(doc, win, async (_url, request) => {
    methods.push(request.method);
    throw new TypeError('Offline');
  });
  assert.deepEqual(methods, ['POST', 'GET']);
  assert.equal(counter.dataset.state, 'unavailable');
  assert(!value.textContent.includes('0'));
});
