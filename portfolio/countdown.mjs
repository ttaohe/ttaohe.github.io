import { selectReviewDeadline, remainingClock } from './update-schedule.js';
const storageKey = 'tao-infra-review-deadline-v1';
for (const section of document.querySelectorAll('[data-review-countdown]')) {
  const updatedAt = section.dataset.updatedAt;
  const clock = section.querySelector('[data-clock]');
  let previous = null;
  try { previous = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { /* Storage is optional. */ }
  const deadline = selectReviewDeadline(Date.now(), updatedAt, previous);
  try { sessionStorage.setItem(storageKey, JSON.stringify(deadline)); } catch { /* Storage is optional. */ }
  let interval;
  const tick = () => {
    const value = remainingClock(Date.now(), deadline.target);
    clock.textContent = value ?? '等待更新检查';
    clock.classList.toggle('waiting', value === null);
    if (value === null) {
      clock.setAttribute('role', 'status');
      clock.setAttribute('aria-live', 'polite');
      if (interval) clearInterval(interval);
    }
  };
  const stop = () => { if (interval) clearInterval(interval); interval = undefined; };
  const start = () => { stop(); tick(); if (Date.now() < deadline.target) interval = setInterval(tick, 1000); };
  start();
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => { if (event.persisted) start(); });
}
