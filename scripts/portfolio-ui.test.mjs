import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { THEME_KEY, THEMES, validTheme, readTheme, saveTheme, activeSection, applyTheme, initPortfolio } from '../portfolio/ui.mjs';

const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');
const bootstrap = html.match(/<script>(.*?)<\/script>/s)[1];
const palettes = Object.fromEntries(THEMES.map(theme => {
  const block = css.match(new RegExp(`:root\\[data-theme="${theme}"\\]\\{([^}]+)\\}`))[1];
  return [theme, Object.fromEntries([...block.matchAll(/--([\w-]+):([^;]+);/g)].map(([, key, value]) => [key, value]))];
}));
const storage = (value = null) => ({ value, getItem(key) { assert.equal(key, THEME_KEY); return this.value; }, setItem(key, value) { assert.equal(key, THEME_KEY); this.value = value; } });

test('theme bootstrap runs before the stylesheet and preserves all saved themes', () => {
  assert(html.indexOf('<script>') < html.indexOf('rel="stylesheet"'));
  for (const theme of THEMES) {
    const document = { documentElement: { dataset: { theme: 'dark' } } };
    runInNewContext(bootstrap, { document, localStorage: storage(theme) });
    assert.equal(document.documentElement.dataset.theme, theme);
    assert.equal(readTheme(storage(theme)), theme);
  }
});

test('invalid, missing, or blocked storage safely keeps the default dark palette', () => {
  for (const value of [null, 'auto', '', '<script>', undefined]) {
    assert.equal(validTheme(value), 'dark');
    assert.equal(readTheme(storage(value)), 'dark');
  }
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readTheme(blocked), 'dark');
  assert.doesNotThrow(() => saveTheme(blocked, 'soft'));
  const document = { documentElement: { dataset: { theme: 'dark' } } };
  assert.doesNotThrow(() => runInNewContext(bootstrap, { document, get localStorage() { throw new Error('blocked'); } }));
  assert.equal(document.documentElement.dataset.theme, 'dark');
});

test('repeated theme choices stay selected and persist for the next visit', () => {
  const root = { dataset: {} };
  const buttons = THEMES.map(theme => ({ dataset: { themeChoice: theme }, setAttribute(key, value) { this[key] = value; } }));
  const store = storage();
  for (const theme of ['light', 'soft', 'dark', 'soft', 'soft']) {
    saveTheme(store, applyTheme(root, buttons, theme));
    assert.equal(root.dataset.theme, theme);
    assert.equal(readTheme(store), theme);
    assert.deepEqual(buttons.map(button => button['aria-pressed']), THEMES.map(value => String(value === theme)));
  }
});

test('all three palettes define the same semantic colors, including the clock', () => {
  for (const theme of THEMES) {
    assert.deepEqual(Object.keys(palettes[theme]).sort(), Object.keys(palettes.dark).sort());
    for (const [, key] of (css + html).matchAll(/var\(--([\w-]+)\)/g)) {
      assert(key in palettes[theme] || ['mono', 'sans', 'page-gutter', 'editor-gutter', 'anchor-offset'].includes(key), `Missing ${key} in ${theme}`);
    }
  }
  assert(!/<svg[^]*#[0-9a-f]{6}[^]*<\/svg>/i.test(html), 'Clock SVG must use the palette');
});

const luminance = hex => {
  const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
};
test('text and controls meet 4.5:1 contrast in every palette', () => {
  const pairs = [['fg','surface'],['muted','surface'],['dim','surface'],['dim','bg'],['dim','sidebar'],['muted','sidebar'],['muted','tabs'],['folder','sidebar'],['active-fg','active'],['green','surface'],['blue','surface'],['purple','surface'],['gold','sidebar'],['strong','surface'],['value','surface'],['button-fg','button-bg'],['primary-fg','green'],['heading','card'],['clock-fg','clock-face'],['clock-muted','clock-bg'],['clock-label','clock-bg'],['link','surface'],['status-fg','status-bg']];
  for (const [theme, palette] of Object.entries(palettes)) for (const [fg, bg] of pairs) {
    const values = [luminance(palette[fg]), luminance(palette[bg])].sort((a,b) => b-a);
    const ratio = (values[0]+.05)/(values[1]+.05);
    assert(ratio >= 4.5, `${theme} ${fg}/${bg}: ${ratio.toFixed(2)}`);
  }
});

test('scroll position selects first, middle and last chapters without hash dependence', () => {
  const ids = ['profile','education','experience','research','resume'];
  for (let selected = 0; selected < ids.length; selected++) {
    const sections = ids.map((id,index) => ({ id, top: (index-selected)*300+24 }));
    assert.equal(activeSection(sections), ids[selected]);
  }
  assert.equal(activeSection([{id:'profile',top:160},{id:'education',top:450}]), 'profile');
  assert.equal(activeSection([{id:'profile',top:-100},{id:'education',top:26}]), 'education');
  assert.equal(activeSection([{id:'profile',top:-100},{id:'education',top:27}]), 'profile');
  assert.equal(activeSection([{id:'profile',top:-100},{id:'education',top:65}],64), 'education');
  assert.equal(activeSection([]), undefined);
});

test('desktop and mobile links target all real focusable chapters', () => {
  for (const id of ['profile','education','experience','research','resume']) {
    assert.equal([...html.matchAll(new RegExp(`href="#${id}"`, 'g'))].length, 2);
    assert(html.includes(`tabindex="-1" id="${id}"`));
  }
  for (const theme of THEMES) assert(html.includes(`type="button" data-theme-choice="${theme}"`));
  assert(html.includes('aria-label="页面主题"'));
  assert(html.includes('href="/ai-infra-daily-notes/"'));
  assert(css.includes('position:sticky'));
  assert(css.includes('max-height:calc(100dvh - 48px)'));
  assert(css.includes('overflow-y:auto'));
  assert(css.includes('scroll-margin-top:var(--anchor-offset)'));
  assert(css.includes('prefers-reduced-motion:reduce'));
  assert(css.includes('max-width:min(100%,440px)'));
  assert(css.includes('.content>.section:last-of-type{min-height:calc(100svh'));
});

test('native chapter focus is indicated on its heading, never around the whole section', () => {
  // Fragment targets stay focusable so Enter and the next Tab retain native
  // navigation semantics. Only their oversized browser outline is replaced.
  assert.match(css, /@supports selector\(:focus-visible\)\s*\{\s*\.content\s*>\s*:is\(\.hero,\s*\.section\)\[tabindex="-1"\]:focus\s*\{\s*outline:\s*none;?\s*\}/);
  assert.match(css, /\.content\s*>\s*\.hero:focus-visible\s+h1,\s*\.content\s*>\s*\.section:focus-visible\s*>\s*\.section-heading\s+h2\s*\{[^}]*outline:\s*2px solid var\(--green\);[^}]*outline-offset:\s*6px/);
  assert.match(css, /a:focus-visible,button:focus-visible\{outline:2px solid var\(--green\);outline-offset:5px\}/);
  assert.doesNotMatch(css, /(?:^|\})\s*(?:\*|:focus|:focus-visible)\s*\{[^}]*outline:\s*(?:none|0)/);
});

test('navigation coalesces scrolling and refreshes after history, resize and restored pages', () => {
  const events = new Map();
  const frames = [];
  let educationTop = 500;
  const links = ['profile','education','profile','education'].map(id => ({ hash:`#${id}`, classList: {toggle(key,value) { this[key] = value; }}, setAttribute(key,value) { this[key] = value; }, removeAttribute(key) { delete this[key]; } }));
  const doc = { documentElement: {dataset:{theme:'dark'}}, querySelectorAll(query) { return query.includes('data-theme-choice') ? [] : links; }, getElementById(id) { return { id, getBoundingClientRect() { return {top:id === 'profile' ? -200 : educationTop}; } }; } };
  const win = { addEventListener(name,fn) { events.set(name,fn); }, getComputedStyle() { return { getPropertyValue() { return '24px'; } }; }, requestAnimationFrame(fn) {frames.push(fn);} };
  initPortfolio(doc,win);
  assert.equal(links[0]['aria-current'], 'location');
  educationTop = 24;
  events.get('scroll')(); events.get('scroll')();
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(links[0]['aria-current'], undefined);
  assert.equal(links[1]['aria-current'], 'location');
  assert.equal(links[3]['aria-current'], 'location');
  for (const event of ['resize','hashchange','popstate','pageshow']) {
    events.get(event)();
    assert.equal(frames.length,1);
    frames.shift()();
  }
  events.get('storage')({key:THEME_KEY,newValue:'soft'});
  assert.equal(doc.documentElement.dataset.theme, 'soft');
});
