export const VISITS_ENDPOINT = 'https://ai-infra-daily.ttaohe.chatgpt.site/api/visits';
const VISIT_STATE = Symbol.for('taohe.portfolio.homepage-visit');

export function validVisitCount(data) {
  return data?.page === 'home' && Number.isSafeInteger(data.views) && data.views >= 0;
}

async function requestVisits(fetcher, method, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(VISITS_ENDPOINT, {
      method,
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
      ...(method === 'POST' ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 'home' }),
      } : {}),
    });
    if (!response.ok) throw new Error(`Visits unavailable (${response.status})`);
    const data = await response.json();
    if (!validVisitCount(data)) throw new Error('Invalid visits response');
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function recordHomepageVisit(fetcher, timeoutMs = 6000) {
  try {
    return await requestVisits(fetcher, 'POST', timeoutMs);
  } catch (error) {
    // A network failure may happen after the server records the view. Never
    // retry the write: one read can recover the current total without adding.
    if (error?.name !== 'TypeError' && error?.name !== 'AbortError') throw error;
    return requestVisits(fetcher, 'GET', timeoutMs);
  }
}

export function initVisits(doc = document, win = window, fetcher = win.fetch.bind(win)) {
  const counter = doc.querySelector('[data-visit-counter]');
  const value = counter?.querySelector('[data-visit-value]');
  if (!value) return Promise.resolve(null);
  if (win[VISIT_STATE]?.document === doc) return win[VISIT_STATE].promise;

  counter.dataset.state = 'loading';
  value.textContent = '👀 首页累计访问：加载中';
  const promise = Promise.resolve().then(() => recordHomepageVisit(fetcher)).then(data => {
    value.textContent = `👀 首页累计访问 ${new Intl.NumberFormat('zh-CN').format(data.views)} 次`;
    counter.dataset.state = 'ready';
    return data;
  }).catch(() => {
    value.textContent = '👀 首页累计访问暂不可用';
    counter.dataset.state = 'unavailable';
    return null;
  });
  // State belongs to the current Document, not a visitor or session identifier.
  // Hash changes, scrolling, theme changes and BFCache restoration do not call
  // this module again; this guard also makes repeated initialization harmless.
  win[VISIT_STATE] = { document: doc, promise };
  return promise;
}

if (typeof document !== 'undefined') initVisits();
