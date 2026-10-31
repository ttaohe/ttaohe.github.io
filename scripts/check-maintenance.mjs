import {execFileSync} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const paths=new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(Boolean));
for(const name of paths){
 try{await stat(name)}catch{continue}
 if(/^content\/(daily|journal)\//.test(name))continue;
 if(/20\d{2}[-_]?[01]\d[-_]?[0-3]\d/.test(name))throw Error('Dated repository copy: '+name);
 if(/\.(md|json|pdf|tex|svg|drawio|zip)$/i.test(name)&&/(?:^|[-_.])(backup|before|final|bak)(?:[-_.]|$)/i.test(path.basename(name)))throw Error('Ad-hoc copy: '+name);
}
const source=JSON.parse(await readFile('portfolio/resume/source.json','utf8'));
const pdf=await readFile('portfolio/resume/ttaohe-resume.pdf');
if(createHash('sha256').update(pdf).digest('hex')!==source.sha256)throw Error('Resume PDF differs from its recorded source');
if(!/^[a-f0-9]{40}$/.test(source.commit)||source.repository!=='https://github.com/ttaohe/resume-ng')throw Error('Invalid canonical resume reference');
for(const name of ['README.md',...execFileSync('git',['ls-files','docs/*.md'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)]){
 if(/(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)/.test(await readFile(name,'utf8')))throw Error('Infrastructure IP in public documentation: '+name);
}
console.log('PASS: stable paths, resume provenance and public documentation boundaries');
