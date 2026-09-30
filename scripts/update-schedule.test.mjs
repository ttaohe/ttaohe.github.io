import test from 'node:test';
import assert from 'node:assert/strict';
import { nextScheduledBoundary, remainingClock, selectReviewDeadline, shanghaiTimestamp } from '../lib/update-schedule.ts';
const at = value => Date.parse(`2026-09-30T${value}Z`);
const updated = '2026-09-30T08:14:00Z';

test('next boundary before, exactly at, and just after a scheduled check', () => {
  assert.equal(nextScheduledBoundary(at('11:59:59')), at('12:00:00'));
  assert.equal(nextScheduledBoundary(at('12:00:00')), at('12:00:00'));
  assert.equal(nextScheduledBoundary(at('12:00:01')), at('16:00:00'));
  assert.equal(nextScheduledBoundary(at('23:59:59')), Date.parse('2026-10-01T00:00:00Z'));
});
test('the clock reaches waiting state without claiming success or rolling over', () => {
  assert.equal(remainingClock(at('11:59:59'), at('12:00:00')), '00:00:01');
  assert.equal(remainingClock(at('12:00:00'), at('12:00:00')), null);
  assert.equal(remainingClock(at('15:00:00'), at('12:00:00')), null);
});
test('unchanged or older content preserves a passed deadline across reloads', () => {
  const previous = { target: at('12:00:00'), contentUpdatedAt: updated };
  assert.deepEqual(selectReviewDeadline(at('12:30:00'), updated, previous), previous);
  assert.deepEqual(selectReviewDeadline(at('12:30:00'), '2026-09-30T07:00:00Z', previous), previous);
});
test('only a newer content timestamp permits a new planned deadline', () => {
  const previous = { target: at('12:00:00'), contentUpdatedAt: updated };
  assert.deepEqual(selectReviewDeadline(at('12:30:00'), '2026-09-30T12:10:00Z', previous), { target: at('16:00:00'), contentUpdatedAt: '2026-09-30T12:10:00Z' });
});
test('displayed timestamps are deterministic UTC+8 with day rollover', () => {
  assert.equal(shanghaiTimestamp('2026-09-30T08:14:00Z'), '2026-09-30 16:14 · UTC+8');
  assert.equal(shanghaiTimestamp('2026-09-30T20:30:00Z'), '2026-10-01 04:30 · UTC+8');
});
