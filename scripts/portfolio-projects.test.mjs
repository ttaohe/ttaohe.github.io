import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../portfolio/index.html', import.meta.url), 'utf8');
const section = html.match(/<section[^>]+id="experience"[^]*?<\/section>/)?.[0];
test('project section stays navigable while published project details are cleared', () => {
  assert(section?.includes('project-placeholder'));
  assert(section.includes('aria-label="项目经历暂未填写"'));
  assert(!section.includes('<a ') && !section.includes('MLA') && !section.includes('TP0'));
  assert(html.includes('href="#experience"'));
});
