import { readFileSync } from 'node:fs';
import ts from 'typescript';
const data = value => `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`;
const mockDiagram = data(`import React from ${JSON.stringify(import.meta.resolve('react'))};export function DiagramBoard({url,caption}) {return React.createElement('figure',null,React.createElement('img',{src:url,alt:caption}));}`);
const compile = (path, replacements={}) => {
  let js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText;
  for(const name of ['react/jsx-runtime','react-markdown','remark-gfm']) js=js.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name)));
  for(const [from,to] of Object.entries(replacements)) js=js.replaceAll(JSON.stringify(from),JSON.stringify(to));
  return data(js);
};
export const markdownModule=compile('../components/blog/article-markdown.tsx',{'./diagram-board':mockDiagram});
export const {ArticleMarkdown,ArticleSourceLabel,safeArticleUrl}=await import(markdownModule);
export const {ArticleParagraph}=await import(compile('../components/blog/article-paragraph.tsx',{'./article-markdown':markdownModule,'@/lib/blog/article-heading':new URL('../lib/blog/article-heading.ts',import.meta.url).href}));
