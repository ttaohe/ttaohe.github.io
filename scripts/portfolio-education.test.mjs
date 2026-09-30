import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../portfolio/styles.css', import.meta.url), 'utf8');
const education = html.match(/<ol class="education">([^]*?)<\/ol>/)?.[1];

test('education spells out confirmed institutions and subjects without guessed credentials', () => {
  assert(education);
  assert.equal([...education.matchAll(/<li>/g)].length, 2);
  for (const value of ['Northwestern Polytechnical University', 'Wuhan University', '西北工业大学 · 本科 · 电子信息工程', '武汉大学 · 硕士 · 计算机应用技术', 'Electronic Information Engineering', 'Computer Application Technology']) assert(education.includes(value), value);
  assert.doesNotMatch(education, /\b(?:NWPU|WHU|EE|CS|GPA)\b|B\.Eng|M\.Eng/);
  assert.match(education, /datetime="2019">2019<\/time>–<time datetime="2023">2023/);
  assert.match(education, /datetime="2023">2023<\/time>–<time datetime="2026">2026/);
});

test('both official school emblems have stable local bytes, dimensions, and accessible names', async () => {
  for (const [name, extension, digest, label, width, height] of [
    ['nwpu', 'gif', 'fd9a04147739b2fdd80de46e487b6bf16cab4353a1c643ede2735ea4642b3755', '西北工业大学校徽', 355, 355],
    ['whu', 'png', '5354164cc78556aa08958fabbd07c301f015474b90c0406f732e0a03d8e0d6d7', '武汉大学校徽', 1796, 1795],
  ]) {
    const bytes = await readFile(new URL(`../portfolio/schools/${name}-emblem.${extension}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
    assert(education.includes(`src="/assets/${name}-emblem.${extension}" width="${width}" height="${height}" alt="${label}"`));
  }
  assert.doesNotMatch(education, /<img[^>]+src="https?:/);
});

test('education keeps a shrinkable text column and smaller emblems on phones', () => {
  assert.match(css, /\.education li\{[^}]*grid-template-columns:80px minmax\(0,1fr\)/);
  assert.match(css, /\.education li\{[^}]*grid-template-columns:56px minmax\(0,1fr\)/);
  assert.match(css, /\.school\{min-width:0\}/);
  assert.match(css, /\.school-emblem\{[^}]*object-fit:contain/);
  assert.match(css, /\.school h3\{[^}]*overflow-wrap:anywhere/);
});
