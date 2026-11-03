import fs from 'node:fs';
import path from 'node:path';
import {project,json} from '../../../scripts/git-compat/lib.mjs';
const spec=(id,title,run)=>({id,variant:'real-conpty',title,profile:'N0',tier:'broad',phase:'NATIVE_BASELINE',productStatus:'NOT_ASSESSED',capabilities:['win32'],timeout:60000,run});
async function pty(c,argv,steps){
  const request=path.join(c.root,'pty-request-'+c.commands.length+'.json');json(request,{executable:c.gitPath,argv,cwd:c.repo,steps,timeout:20000});
  const response=await c.run(process.execPath,[path.join(project,'scripts/git-compat/pty-call.mjs'),request],{timeout:25000});const result=JSON.parse(response.stdout);
  c.eq('PTY child exit',result.code,0);c.eq('All interactive prompts answered',result.steps_completed,steps.length);c.eq('real backend',result.backend,'node-pty 1.1.0 / real ConPTY');
  json(path.join(c.artifactDir,'pty-'+c.commands.length+'.json'),{...result,cwd:'<FIXTURE>/repo'});return result;
}
async function changes(c){await c.init();const lines=Array.from({length:60},(_,i)=>`line ${i+1}`);const original=lines.join('\n')+'\n';c.write('base.txt',original);await c.git(['add','base.txt']);await c.git(['commit','-m','separated hunks']);const first=[...lines],both=[...lines];first[2]='changed first hunk';both[2]=first[2];both[49]='changed second hunk';c.write('base.txt',both.join('\n')+'\n');return {original,first:first.join('\n')+'\n',both:both.join('\n')+'\n',second:lines.map((line,i)=>i===49?both[i]:line).join('\n')+'\n'};}
export const cases=[
  spec('INDEX-008','Real PTY add -p stages one hunk and preserves the other on disk',async c=>{
    const f=await changes(c);await pty(c,['add','-p','--','base.txt'],[{pattern:'Stage this hunk',send:'y\r'},{pattern:'Stage this hunk',send:'n\r'}]);
    c.eq('only selected hunk staged',(await c.git(['show',':base.txt'])).stdout,f.first,'Git 2.53 git-add -p');c.eq('both edits on disk',c.read('base.txt'),f.both);c.eq('HEAD unmodified',(await c.git(['show','HEAD:base.txt'])).stdout,f.original);
  }),
  spec('STASH-005','Real PTY stash patch and pathspec variants keep the unselected change',async c=>{
    const f=await changes(c);await pty(c,['stash','push','-p','-m','synthetic patch','--','base.txt'],[{pattern:'Stash this hunk',send:'y\r'},{pattern:'Stash this hunk',send:'n\r'}]);
    c.eq('stash tree selected hunk',(await c.git(['show','stash@{0}:base.txt'])).stdout,f.first);c.eq('unselected hunk remains',c.read('base.txt'),f.second);c.eq('index unchanged',(await c.git(['show',':base.txt'])).stdout,f.original);
    await c.git(['stash','apply'],{ok:[1]});c.eq('dirty-worktree apply refusal preserves unselected hunk',c.read('base.txt'),f.second);
    await c.git(['restore','--source=HEAD','--worktree','--','base.txt']);await c.git(['stash','apply']);c.eq('apply into clean worktree restores selected hunk',c.read('base.txt'),f.first);
    c.write('base.txt',f.both);c.write('other.txt','other\n');await c.git(['add','other.txt']);await c.git(['commit','-m','other tracked']);c.write('other.txt','other dirty\n');await c.git(['stash','push','-m','path only','--','base.txt']);c.eq('pathspec excludes other dirty file',c.read('other.txt'),'other dirty\n');c.eq('pathspec resets requested file',c.read('base.txt'),f.original);
  }),
  spec('STASH-012','Real interactive clean respects excludes and requires double force for nested repositories',async c=>{
    await c.init();c.write('.gitignore','ignored.tmp\n');await c.git(['add','.gitignore']);await c.git(['commit','-m','ignore fixture']);c.write('ordinary.tmp','remove\n');c.write('save.keep','keep\n');c.write('ignored.tmp','ignored\n');const nested=path.join(c.repo,'nested-repo');fs.mkdirSync(nested);await c.git(['init','-b','main'],{cwd:nested});fs.writeFileSync(path.join(nested,'sentinel'),'nested\n');
    await pty(c,['clean','-di','-e','*.keep'],[{pattern:'What now>',send:'1\r'}]);
    c.eq('interactive ordinary removed',c.exists('ordinary.tmp'),false);c.eq('explicit exclude preserved',c.read('save.keep'),'keep\n');c.eq('ignored preserved',c.read('ignored.tmp'),'ignored\n');c.eq('nested repo protected with interactive single force',c.exists('nested-repo/.git'),true);
    await c.git(['clean','-ffd','-e','*.keep']);c.eq('explicit double force removes own nested fixture',c.exists('nested-repo'),false);c.eq('exclude still kept',c.read('save.keep'),'keep\n');
  }),
];
