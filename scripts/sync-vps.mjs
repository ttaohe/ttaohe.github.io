import {readFile,writeFile} from 'node:fs/promises';
const {publicContentOrigin}=JSON.parse(await readFile('lib/site-config.json','utf8'));
const response=await fetch(new URL('/api/content',publicContentOrigin),{signal:AbortSignal.timeout(30000),cache:'no-store'});
if(!response.ok)throw new Error('VPS content unavailable: '+response.status);
const content=await response.json();
if(!Array.isArray(content.posts)||!content.daily?.reports||!Array.isArray(content.experiments)||!content.updatedAt)throw new Error('Invalid VPS public content');
await writeFile('lib/blog/content.json',JSON.stringify(content,null,2)+'\n');
console.log('Read public homepage excerpts from VPS.');
