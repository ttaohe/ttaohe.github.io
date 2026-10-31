import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=(dir,...args)=>execFileSync('git',['-C',dir,...args],{encoding:'utf8'}).trim();
async function fixture(){const dir=await mkdtemp(path.join(os.tmpdir(),'portfolio-maintenance-'));run(dir,'init','-q');run(dir,'config','user.name','Fixture');run(dir,'config','user.email','fixture@example.test');return dir;}

test('resume synchronization rejects uncommitted canonical changes',async()=>{
 const source=await fixture(),target=await mkdtemp(path.join(os.tmpdir(),'resume-target-'));
 try{
  run(source,'remote','add','origin','https://github.com/ttaohe/resume-ng.git');
  await writeFile(path.join(source,'main.tex'),'Reviewed source');await writeFile(path.join(source,'main.pdf'),'%PDF-1.7\nFixture');
  run(source,'add','.');run(source,'commit','-qm','Reviewed fixture');await writeFile(path.join(source,'main.tex'),'Unreviewed change');
  assert.throws(()=>execFileSync(process.execPath,[path.join(root,'scripts/sync-resume.mjs'),source,'--apply'],{cwd:target,stdio:'pipe'}),/Command failed/);
 }finally{await rm(source,{recursive:true,force:true});await rm(target,{recursive:true,force:true});}
});

test('a clean reviewed resume records its exact source commit and artifact',async()=>{
 const source=await fixture(),target=await mkdtemp(path.join(os.tmpdir(),'resume-target-'));
 try{
  run(source,'remote','add','origin','https://github.com/ttaohe/resume-ng.git');
  const pdf=Buffer.from('%PDF-1.7\nReviewed fixture');
  await writeFile(path.join(source,'main.tex'),'Reviewed source');await writeFile(path.join(source,'main.pdf'),pdf);
  run(source,'add','.');run(source,'commit','-qm','Reviewed fixture');await mkdir(path.join(target,'portfolio/resume'),{recursive:true});
  execFileSync(process.execPath,[path.join(root,'scripts/sync-resume.mjs'),source,'--apply'],{cwd:target,stdio:'pipe'});
  const record=JSON.parse(await readFile(path.join(target,'portfolio/resume/source.json'),'utf8'));
  assert.equal(record.commit,run(source,'rev-parse','HEAD'));assert.equal(record.sha256,createHash('sha256').update(pdf).digest('hex'));
  assert.deepEqual(await readFile(path.join(target,'portfolio/resume/ttaohe-resume.pdf')),pdf);
 }finally{await rm(source,{recursive:true,force:true});await rm(target,{recursive:true,force:true});}
});

test('publisher refuses another repository or dirty source before any remote operation',async()=>{
 const dir=await fixture();try{
  run(dir,'remote','add','origin','https://github.com/example/other.git');
  assert.throws(()=>execFileSync(process.execPath,[path.join(root,'scripts/publish-homepage.mjs'),'--apply'],{cwd:dir,stdio:'pipe'}),/Command failed/);
  run(dir,'remote','set-url','origin','https://github.com/ttaohe/ttaohe.github.io.git');await writeFile(path.join(dir,'draft.txt'),'Unreviewed draft');
  assert.throws(()=>execFileSync(process.execPath,[path.join(root,'scripts/publish-homepage.mjs'),'--apply'],{cwd:dir,stdio:'pipe'}),/Command failed/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
