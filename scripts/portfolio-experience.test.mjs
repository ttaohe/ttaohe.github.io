import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');
const experience = html.match(/<section class="profile-experience"([^]*?)<\/section>/)?.[1];

test('profile Experience contains only the approved companies and inference directions', () => {
  assert(experience);
  assert.equal([...experience.matchAll(/<li>/g)].length, 3);
  assert.match(experience, /aria-labelledby="profile-experience-title" lang="en"/);
  assert.match(experience, /id="profile-experience-title">Experience<\/h2>/);
  assert(html.indexOf('class="intro"') < html.indexOf('class="profile-experience"'));
  assert(html.indexOf('class="profile-experience"') < html.indexOf('class="focus-code"'));
  const items = [...experience.matchAll(/<li>([^]*?)<\/li>/g)].map(match => match[1]);
  for (const [index, company, direction] of [
    [0, 'Xiaomi', 'On-device Inference Infrastructure'],
    [1, 'Ant Group', 'LLM Inference Infrastructure'],
    [2, 'Infinigence AI', 'LLM Inference Infrastructure'],
  ]) {
    assert(items[index].includes(`class="company-name">${company}</span>`));
    assert(items[index].includes(`class="company-direction">${direction}</span>`));
  }
  assert.doesNotMatch(experience, /\b(?:Current|Internship|Engineer)\b/i);
  assert.match(html, /id="experience"[^]*?经历与项目[^]*?id="mla-tp-l2-cache-deduplication"/);
});

test('company marks preserve the original official bytes and avoid repeated accessible names', async () => {
  const hashes = JSON.parse(await readFile(new URL('../portfolio/companies/manifest.json', import.meta.url), 'utf8'));
  assert.equal(hashes.length, 3);
  for (const asset of hashes) {
    const bytes = await readFile(new URL(`../portfolio/companies/${asset.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert(experience.includes(`src="/assets/${asset.file}" width="36" height="36" alt=""`));
    assert.match(asset.page, /^https:\/\/(?:www\.mi\.com|www\.antgroup\.com|www\.infinigence-ai\.com)\//);
    assert.match(asset.source, /^https:\/\//);
  }
  assert.doesNotMatch(experience, /<img[^>]+src="https?:/);
  assert.match(css, /\.company-logo\{[^}]*object-fit:contain;[^}]*background:#fff/);
  assert.doesNotMatch(css, /\.company-logo\{[^}]*(?:filter|mix-blend-mode):/);
});

test('company strip responds to its own available width and stacks with the mobile profile', () => {
  assert.match(css, /\.profile-copy\{min-width:0;container:profile \/ inline-size\}/);
  assert.match(css, /\.company-list\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /@container profile \(min-width:540px\)\{\s*\.company-list\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.company-list li\{[^}]*grid-template-columns:36px minmax\(0,1fr\)/);
  assert.match(css, /\.hero \.profile-experience\{grid-column:1\/-1;margin-top:0/);
  assert.doesNotMatch(css, /\.company-direction\{[^}]*(?:height|white-space:nowrap|overflow:hidden)/);
});


test('company dates and internship labels preserve the user-provided overlapping periods', () => {
  const items = [...experience.matchAll(/<li>([^]*?)<\/li>/g)].map(match => match[1]);
  const expected = [
    '<time datetime="2025-12">2025.12</time>–<time datetime="2026-03">2026.03</time> · Intern',
    '<time datetime="2026-05">2026.05</time>–<time datetime="2026-09">2026.09</time> · Intern',
    '<time datetime="2026-06">2026.06</time>–Present',
  ];
  for (const [index, dates] of expected.entries()) assert(items[index].includes(`class="company-dates">${dates}</span>`));
  assert.equal([...experience.matchAll(/ · Intern/g)].length, 2);
  assert.doesNotMatch(items[2], /Intern/);
  assert(css.includes('.company-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px .6em;font:14px/1.5 var(--sans)}'));
  for (const item of items) assert.match(item, /class="company-heading"><span class="company-name">[^]*?<span class="company-dates">[^]*?<\/span><\/div><span class="company-direction">/);
  assert(css.includes('.company-dates{font:11px/1.6 var(--sans);color:var(--dim);white-space:nowrap}'));
  assert(css.includes('.company-dates time{white-space:nowrap}'));
});
