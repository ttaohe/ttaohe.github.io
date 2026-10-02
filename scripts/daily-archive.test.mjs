import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { archiveDateLabel, archiveDateFromSearch, archiveDateUrl } from '../lib/daily-archive.ts';

const keys = ['10.02', '10.01', '09.30', '09.08'];
test('archive dates are complete and unambiguous across months', () => {
  assert.equal(archiveDateLabel(2026, '10.02'), '2026-10-02');
  assert.equal(archiveDateLabel(2026, '09.30'), '2026-09-30');
});
test('an older date resolves after refresh or direct linking', () => {
  assert.equal(archiveDateFromSearch('?date=2026-09-30', 2026, keys), '09.30');
  assert.equal(archiveDateFromSearch('?other=1&date=2026-09-08', 2026, keys), '09.08');
});
test('missing, unavailable, wrong-year and malformed dates fall back to latest', () => {
  for (const value of ['', '?date=', '?date=not-a-date', '?date=2025-10-01', '?date=2026-09-13', '?date=10.01']) {
    assert.equal(archiveDateFromSearch(value, 2026, keys), '10.02');
  }
  assert.equal(archiveDateFromSearch('?date=2026-10-02', 2026, []), '');
});
test('date navigation preserves prefix, unrelated parameters and fragment', () => {
  assert.equal(archiveDateUrl('https://example.com/ai-infra-daily-notes/daily/?view=brief#top', 2026, '09.30', '10.02'), '/ai-infra-daily-notes/daily/?view=brief&date=2026-09-30#top');
  assert.equal(archiveDateUrl('https://example.com/ai-infra-daily-notes/daily/?date=2026-09-30&view=brief#top', 2026, '10.02', '10.02'), '/ai-infra-daily-notes/daily/?view=brief#top');
});
test('archive UI exposes top-level entry, full dates, populated issues and history restoration', async () => {
  const source = await readFile(new URL('../components/blog/daily-dashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label="简报日期导航"/);
  assert.match(source, /<SheetTitle[^>]*>往期归档<\/SheetTitle>/);
  assert.match(source, /dates\.filter\(\(item\) => reports\[item.key\]\?\.length\)/);
  assert.match(source, /window\.addEventListener\("popstate", restoreDate\)/);
  assert.match(source, /window\.removeEventListener\("popstate", restoreDate\)/);
  assert.match(source, /nextUrl !== currentUrl/);
  assert.match(source, /onCloseAutoFocus/);
  assert.doesNotMatch(source, /dates\.slice\(1\)/);
});
