import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source=path.resolve(process.argv[2]||'../resume-ng');
const git=(...args)=>execFileSync('git',['-C',source,...args],{encoding:'utf8'}).trim();
const origin=git('remote','get-url','origin').replace(/^git@github.com:/,'https://github.com/').replace(/\.git$/,'');
if(new URL(origin).hostname!=='github.com'||new URL(origin).pathname!=='/ttaohe/resume-ng')throw Error('Expected the canonical resume repository');
if(git('status','--porcelain','--','main.tex','main.pdf','resume.cls','fonts','Makefile'))throw Error('Commit the reviewed resume source and PDF before synchronization');
await readFile(path.join(source,'main.tex'));
const bytes=await readFile(path.join(source,'main.pdf'));
if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||bytes.length>5*1024*1024)throw Error('Invalid reviewed PDF');
const record={repository:'https://github.com/ttaohe/resume-ng',commit:git('log','-1','--format=%H','--','main.tex','main.pdf','resume.cls','fonts','Makefile'),source:'main.tex',pdf:'main.pdf',sha256:createHash('sha256').update(bytes).digest('hex')};
console.log(JSON.stringify(record,null,2));
if(process.argv.includes('--apply')){
 await copyFile(path.join(source,'main.pdf'),'portfolio/resume/ttaohe-resume.pdf');
 await writeFile('portfolio/resume/source.json',JSON.stringify(record,null,2)+'\n');
 console.log('Synchronized the reviewed PDF and source reference; website not published.');
}
