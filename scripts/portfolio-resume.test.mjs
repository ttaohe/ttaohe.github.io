import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');
const section = html.match(/<section tabindex="-1" id="resume"[^]*?<\/section>/)?.[0];

test('resume preview clearly identifies the personal resume and provides native PDF controls and fallbacks', () => {
  assert(section.includes('id="resume-title">简历'));
  assert(section.includes('ttaohe 个人简历 PDF'));
  assert(section.includes('<iframe class="resume-pdf"'));
  assert(section.includes('#toolbar=1&amp;navpanes=0&amp;view=FitH'));
  assert(section.includes('resume.pdf ↗'));
  assert(section.includes('target="_blank" rel="noopener"'));
  assert(!section.includes('resume-preview-heading'));
  assert(!section.includes('resume-preview-toolbar'));
  assert(!section.includes('resume-preview-note'));
});

test('personal PDF matches the reviewed LaTeX build and sample identity stays absent', async () => {
  const pdf = await readFile(new URL('../portfolio/resume/ttaohe-resume.pdf', import.meta.url));
  assert.equal(pdf.length, 31061);
  assert.equal(createHash('sha256').update(pdf).digest('hex'), 'f4f631e10ba7887372e24d953406cfd0504748852ca9e65e57cba02ad90747fc');
  assert(!section.includes('template'));
  assert(!html.includes('冯开宇'));
  assert(!html.includes('北京理工大学'));
  assert.match(css, /\.resume-pdf\{[^}]*width:100%;[^}]*background:#fff;color-scheme:light/);
});
