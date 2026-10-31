import {execFileSync} from 'node:child_process';
import {cp,mkdtemp,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const apply=process.argv.includes('--apply');
const root=process.cwd();
const git=(...args)=>execFileSync('git',['-c','credential.helper=','-c','credential.helper=!gh auth git-credential',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const origin=git('remote','get-url','origin').replace(/^git@github.com:/,'https://github.com/').replace(/\.git$/,'');
if(new URL(origin).hostname!=='github.com'||new URL(origin).pathname!=='/ttaohe/ttaohe.github.io')throw Error('Refusing to publish an unexpected repository');
if(git('status','--porcelain'))throw Error('Commit reviewed source changes before preparing a release');
for(const script of ['check-maintenance.mjs','prepare-publish.mjs','finalize-homepage.mjs'])execFileSync(process.execPath,['scripts/'+script],{stdio:'inherit'});
const tests=(await readdir('scripts')).filter(n=>/^portfolio-.*\.test\.mjs$/.test(n)).sort().map(n=>'scripts/'+n);
execFileSync(process.execPath,['--test',...tests],{stdio:'inherit'});
git('fetch','origin','gh-pages');
const temporary=await mkdtemp(path.join(os.tmpdir(),'homepage-publish-'));
const worktree=path.join(temporary,'site');let added=false;
try{
 git('worktree','add','--detach',worktree,'refs/remotes/origin/gh-pages');added=true;
 for(const item of await readdir(worktree))if(item!=='.git')await rm(path.join(worktree,item),{recursive:true,force:true});
 for(const item of await readdir('publish'))await cp(path.join(root,'publish',item),path.join(worktree,item),{recursive:true});
 const changed=git('-C',worktree,'status','--porcelain');
 console.log(changed||'No publication changes.');
 if(changed&&apply){
  git('-C',worktree,'add','-A');
  console.log(git('-C',worktree,'commit','-m','Publish reviewed homepage'));
  console.log(git('-C',worktree,'push','origin','HEAD:gh-pages'));
 }else if(changed)console.log('Preview only. Review publish/ and run again with --apply to publish.');
}finally{
 if(added)git('worktree','remove','--force',worktree);
 await rm(temporary,{recursive:true,force:true});
}
