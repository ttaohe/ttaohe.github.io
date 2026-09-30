/** Research checks are planned every four hours at 00/04/08/12/16/20 UTC.
 * These are also 00/04/08/12/16/20 in Asia/Shanghai, in a different order.
 * A deadline says nothing about whether a check actually ran or published.
 */
export const REVIEW_INTERVAL_MS = 4 * 60 * 60 * 1000;
export type ReviewDeadline = { target: number; contentUpdatedAt: string };

export function nextScheduledBoundary(now: number): number {
  return Math.ceil(now / REVIEW_INTERVAL_MS) * REVIEW_INTERVAL_MS;
}

export function selectReviewDeadline(now: number, contentUpdatedAt: string, previous?: ReviewDeadline | null): ReviewDeadline {
  if (previous && Number.isFinite(previous.target) && Number.isFinite(Date.parse(previous.contentUpdatedAt))) {
    // Keep the fixed deadline across navigation/reloads until genuinely newer content is observed.
    if (Date.parse(contentUpdatedAt) <= Date.parse(previous.contentUpdatedAt)) return previous;
  }
  return { target: nextScheduledBoundary(now), contentUpdatedAt };
}

export function remainingClock(now: number, target: number): string | null {
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  if (seconds === 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export function shanghaiTimestamp(iso: string): string {
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) return '暂无时间记录';
  return `${new Date(epoch + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ')} · UTC+8`;
}
