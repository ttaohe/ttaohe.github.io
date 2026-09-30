import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initContactDialog } from '../portfolio/ui.mjs';
const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');

test('site navigation and contact links use only the supplied destinations', () => {
  const nav = html.match(/<nav class="editor-bar site-nav"[^]*?<\/nav>/)[0];
  for (const label of ['Home', 'Projects', 'Notes', 'GitHub']) assert(nav.includes(label));
  assert(nav.includes('href="/" aria-current="page"'));
  assert(nav.includes('href="#experience"'));
  assert(nav.includes('href="/ai-infra-daily-notes/"'));
  assert(nav.includes('href="https://github.com/ttaohe"'));
  assert(html.includes('href="https://www.zhihu.com/people/shi-he-yuan-fang-48-94"'));
  assert(html.includes('href="mailto:ttaohe828@gmail.com"'));
  assert(html.includes('aria-haspopup="dialog" aria-controls="wechat-dialog" aria-label="微信二维码"'));
  assert.match(css, /\.profile-social a\{[^}]*width:36px;height:36px/);
});

test('QR dialog keeps a local no-JavaScript fallback and accessible native close control', async () => {
  assert(html.includes('href="/assets/wechat-qr.png" data-wechat-open'));
  assert(html.includes('aria-labelledby="wechat-title" aria-describedby="wechat-description"'));
  assert(html.includes('<form method="dialog"><button type="submit" aria-label="关闭微信二维码" autofocus>'));
  assert(html.includes('download="taohe-wechat-qr.png"'));
  const qr = await readFile(new URL('../portfolio/contact/wechat-qr.svg', import.meta.url), 'utf8');
  assert(qr.includes('viewBox="0 0 41 41"'));
  assert.doesNotMatch(qr, /script|href=|image|foreignObject|安徽|潘多拉/);
});

test('dialog repeated open, backdrop close and focus return remain safe', () => {
  const handlers = {};
  let clicks, focusReturns = 0, openings = 0, closings = 0;
  const classes = new Set();
  const link = { addEventListener(_, handler) { clicks = handler; }, focus(options) { assert(options.preventScroll); focusReturns++; } };
  const dialog = { open: false, showModal() { this.open = true; openings++; }, close() { this.open = false; closings++; handlers.close(); }, addEventListener(name, handler) { handlers[name] = handler; }, getBoundingClientRect() { return {left:10,right:100,top:10,bottom:100}; } };
  const doc = { getElementById() { return dialog; }, querySelectorAll() { return [link]; }, documentElement: { classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); } } } };
  initContactDialog(doc);
  const event = { preventDefault() {} };
  clicks(event); clicks(event);
  assert.equal(openings, 1); assert(classes.has('contact-open'));
  handlers.click({target:dialog,clientX:20,clientY:20}); assert.equal(closings, 0);
  handlers.click({target:link,clientX:0,clientY:0}); assert.equal(closings, 0);
  handlers.click({target:dialog,clientX:0,clientY:0}); assert.equal(closings, 1);
  assert.equal(focusReturns, 1); assert(!classes.has('contact-open'));
  clicks(event); dialog.close(); assert.equal(focusReturns, 2);
  assert.doesNotThrow(() => initContactDialog({getElementById() { return null; }}));
  assert.doesNotThrow(() => initContactDialog({getElementById() { return {}; }}));
});
