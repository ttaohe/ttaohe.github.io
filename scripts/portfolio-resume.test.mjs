import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');
const section = html.match(/<section tabindex="-1" id="resume"[^]*?<\/section>/)?.[0];

test('resume preview clearly identifies the template and provides native PDF controls and fallbacks', () => {
  assert(section.includes('LaTeX 模板预览'));
  assert(section.includes('不代表个人经历；个人 LaTeX 版本待补充'));
  assert(section.includes('<iframe class="resume-pdf"'));
  assert(section.includes('#toolbar=1&amp;navpanes=0&amp;view=FitH'));
  assert(section.includes('download="resume-ng-template.pdf"'));
  assert(section.includes('target="_blank" rel="noopener"'));
  assert(section.includes('若浏览器未显示内嵌预览或工具栏'));
});

test('template PDF preserves the exact original binary and text is not substituted into the profile', async () => {
  const pdf = await readFile(new URL('../portfolio/resume/resume-ng-template.pdf', import.meta.url));
  assert.equal(pdf.length, 214434);
  assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${pdf.length}\0`), pdf])).digest('hex'), '0e2f3224a7288370cc640952df29f99b213249b7');
  assert(!html.includes('冯开宇'));
  assert(!html.includes('北京理工大学'));
  assert.match(css, /\.resume-pdf\{[^}]*width:100%;[^}]*background:#fff;color-scheme:light/);
});
