export const THEME_KEY = 'taohe-portfolio-theme-v1';
export const THEMES = ['dark', 'light', 'soft'];

export function validTheme(value) {
  return THEMES.includes(value) ? value : 'dark';
}

export function readTheme(storage) {
  try { return validTheme(storage.getItem(THEME_KEY)); }
  catch { return 'dark'; }
}

export function saveTheme(storage, theme) {
  try { storage.setItem(THEME_KEY, validTheme(theme)); }
  catch { /* The selected theme still works when storage is unavailable. */ }
}

// A small top-edge tolerance prevents rounding at an anchor from selecting
// the previous chapter. Before the first chapter, keep README selected.
export function activeSection(sections, offset = 24) {
  let current = sections[0]?.id;
  for (const section of sections) {
    if (section.top <= offset + 2) current = section.id;
  }
  return current;
}

export function applyTheme(root, buttons, value) {
  const theme = validTheme(value);
  root.dataset.theme = theme;
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  }
  return theme;
}

export function initPortfolio(doc = document, win = window) {
  const root = doc.documentElement;
  const buttons = [...doc.querySelectorAll('[data-theme-choice]')];
  // The blocking head bootstrap has already applied the saved palette before
  // paint. Do not reset it when this module finishes loading.
  applyTheme(root, buttons, root.dataset.theme);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const theme = applyTheme(root, buttons, button.dataset.themeChoice);
      try { saveTheme(win.localStorage, theme); } catch { /* Optional storage. */ }
    });
  }
  win.addEventListener('storage', event => {
    if (event.key === THEME_KEY || event.key === null) applyTheme(root, buttons, event.newValue);
  });

  const links = [...doc.querySelectorAll('.files a[href^="#"], .mobile-nav a[href^="#"]')];
  const ids = [...new Set(links.map(link => link.hash.slice(1)))];
  const sections = ids.map(id => doc.getElementById(id)).filter(Boolean);
  let scheduled = false;
  const updateNavigation = () => {
    scheduled = false;
    const offset = parseFloat(win.getComputedStyle(root).getPropertyValue('--anchor-offset')) || 24;
    const current = activeSection(sections.map(section => ({ id: section.id, top: section.getBoundingClientRect().top })), offset);
    for (const link of links) {
      const selected = link.hash === `#${current}`;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  const scheduleNavigation = () => {
    if (!scheduled) {
      scheduled = true;
      win.requestAnimationFrame(updateNavigation);
    }
  };
  // Keep normal anchors and browser history, including keyboard activation,
  // repeated clicks, direct fragment URLs, Back/Forward and interrupted scrolls.
  win.addEventListener('scroll', scheduleNavigation, { passive: true });
  for (const event of ['resize', 'hashchange', 'popstate', 'pageshow']) {
    win.addEventListener(event, scheduleNavigation);
  }
  doc.fonts?.ready.then(scheduleNavigation);
  updateNavigation();
}

if (typeof document !== 'undefined') initPortfolio();
