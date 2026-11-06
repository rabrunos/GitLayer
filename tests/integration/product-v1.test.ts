import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { writeJournalFixture } from '../helpers/read-journal.js';

// Independent observer: invoke the installed executable by absolute path/argv.
const officialGit = execFileSync(process.platform === 'win32' ? 'where.exe' : '/usr/bin/which', [process.platform === 'win32' ? 'git.exe' : 'git'], { encoding:'utf8' }).trim().split(/\r?\n/)[0]!;
const sha=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex');
async function fixture(t:TestContext){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gl-impl-'));const nonce=randomUUID();fs.writeFileSync(path.join(root,'.owned'),nonce);const home=path.join(root,'home');fs.mkdirSync(home);const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const keys=['HOME','USERPROFILE','XDG_CONFIG_HOME','GIT_CONFIG_NOSYSTEM','GIT_CONFIG_SYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL','GIT_LAYERS_FAILPOINT'];const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{HOME:home,USERPROFILE:home,XDG_CONFIG_HOME:home,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:path.join(home,'none-system'),GIT_CONFIG_GLOBAL:path.join(home,'none-global'),GIT_AUTHOR_NAME:'Implementation Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Implementation Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'});delete process.env.GIT_LAYERS_FAILPOINT;
  const env={...process.env,GIT_TERMINAL_PROMPT:'0',GIT_EDITOR:'false',GIT_PAGER:'cat'};
  const git=(...args:string[])=>execFileSync(officialGit,args,{cwd:repo,env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trimEnd();
  const write=(p:string,content:string)=>{fs.mkdirSync(path.dirname(path.join(repo,p)),{recursive:true});fs.writeFileSync(path.join(repo,p),content);};const read=(p:string)=>fs.readFileSync(path.join(repo,p),'utf8');
  git('init','-b','main');git('config','user.name','Implementation Fixture');git('config','user.email','fixture@example.invalid');git('config','core.autocrlf','false');git('config','commit.gpgsign','false');write('base.txt','base original\n');git('add','.');git('commit','-m','base');const app=await GitLayers.init(repo);
  const events:any[]=[];const record=(label:string)=>{const refs=git('for-each-ref','--format=%(refname) %(objectname)');events.push({label,head:git('symbolic-ref','--short','HEAD'),oid:git('rev-parse','HEAD'),refs,index:git('ls-files','--stage'),worktree:git('status','--porcelain=v2','--untracked-files=all'),files:fs.readdirSync(repo).filter(n=>n!=='.git').sort().map(name=>({name,...(fs.statSync(path.join(repo,name)).isFile()?{sha256:sha(fs.readFileSync(path.join(repo,name))),bytes:fs.statSync(path.join(repo,name)).size,text:fs.statSync(path.join(repo,name)).size<=65536?read(name):'[large contents omitted; SHA256 recorded]'}:{directory:true})}))});};
  const seed=async(name:string,file:string,content=name+' original\n')=>{await app.create(name);await app.on(name);write(file,content);await app.add(name,[file]);await app.commit(name,'seed '+name);};
  record('before');t.after(()=>{try{record('after');const out=process.env.GL_IMPLEMENTATION_EVIDENCE;if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,t.name.replace(/[^a-zA-Z0-9_-]/g,'_')+'.json'),JSON.stringify({test:t.name,officialGit,version:git('--version'),events},null,2)+'\n');}}finally{for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];assert.equal(fs.readFileSync(path.join(root,'.owned'),'utf8'),nonce);assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true});}});
  return {root,repo,home,app,git,write,read,seed,record};
}

test('GL01-05 recognized inactive layers preserve native default flow',async t=>{const f=await fixture(t);f.git('branch','layer/external');assert((await f.app.list()).some(l=>l.name==='external'&&l.state==='inactive'));f.write('normal.txt','normal\n');f.git('add','.');f.git('commit','-m','native normal');assert.equal((await f.app.status()).safe,true);await assert.rejects(f.app.on('external'));assert.equal(f.read('base.txt'),'base original\n');assert.equal(f.git('symbolic-ref','--short','HEAD'),'main');f.record('recognized collision preserves bytes');});

test('GL01-08 two active layers isolate native add and commit',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.seed('b','b.txt');const a=f.git('rev-parse','layer/a'),b=f.git('rev-parse','layer/b');f.write('normal.txt','native normal\n');f.git('add','.');assert.equal(f.git('diff','--cached','--name-only'),'normal.txt');f.git('commit','-m','native base');assert.equal(f.git('ls-tree','--name-only','HEAD'),'base.txt\nnormal.txt');assert.equal(f.git('rev-parse','layer/a'),a);assert.equal(f.git('rev-parse','layer/b'),b);assert.equal((await f.app.status()).safe,true);await f.app.off('a');assert.equal(fs.existsSync(path.join(f.repo,'a.txt')),false);assert.equal(f.read('b.txt'),'b original\n');f.record('native commit origins');});

test('GL03-09-10-18 explicit edit intervals reserve without staging or adopting old files',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.seed('b','b.txt');f.write('old.txt','preexisting\n');await f.app.target('a');f.write('new-a.txt','new a\n');f.write('base.txt','base changed\n');await f.app.target('b');f.write('new-b.txt','new b\n');const status=await f.app.status();assert.equal(status.editingTarget,'b');assert(status.layers.find(l=>l.name==='a')!.reservations.includes('new-a.txt'));assert(status.layers.find(l=>l.name==='b')!.reservations.includes('new-b.txt'));assert(!status.layers.some(l=>l.reservations.includes('old.txt')||l.reservations.includes('base.txt')));assert.equal(f.git('diff','--cached','--name-only'),'');await f.app.target();assert.equal((await f.app.status()).editingTarget,null);await f.app.add('a',['old.txt']);await f.app.unstage('a',['old.txt']);assert((await f.app.status()).layers.find(l=>l.name==='a')!.reservations.includes('old.txt'));f.record('explicit intervals');});

test('GL16 dirty off refuses then explicit discard never resurrects edits',async t=>{const f=await fixture(t);await f.seed('a','a.txt');f.write('a.txt','staged B\n');await f.app.add('a',['a.txt']);f.write('a.txt','disk C\n');f.record('dirty before off');await assert.rejects(f.app.off('a'),{code:'LAYER_DIRTY'});assert.equal(f.read('a.txt'),'disk C\n');await assert.rejects(f.app.off('a',true),{code:'AUTO_PARK_REMOVED'});await f.app.deactivate('a',{discard:true});assert(!fs.existsSync(path.join(f.repo,'a.txt')));await f.app.on('a');assert.equal(f.read('a.txt'),'a original\n');assert.equal((await f.app.status()).layers[0]!.state,'active');assert(!fs.existsSync(path.join(f.app.dir,'shelves')));f.record('reactivation after discard');});

test('GL11-12-14 staged B commit preserves disk C and independent base stage',async t=>{const f=await fixture(t);await f.seed('a','a.txt');f.write('base.txt','base staged\n');await f.app.baseStage(['base.txt']);const baseIndex=f.git('ls-files','--stage');f.write('a.txt','version B\n');await f.app.add('a',['a.txt']);f.write('a.txt','version C\n');const before=f.git('rev-list','--count','layer/a');await f.app.commit('a','one normal commit');assert.equal(Number(f.git('rev-list','--count','layer/a')),Number(before)+1);assert.equal(f.git('show','layer/a:a.txt'),'version B');assert.equal(f.read('a.txt'),'version C\n');assert.equal(f.git('ls-files','--stage'),baseIndex);f.record('B committed C on disk');});

test('GL14 optional native patch application keeps unselected changes',async t=>{const f=await fixture(t);const lines=Array.from({length:30},(_,i)=>'line '+i);await f.seed('a','a.txt',lines.join('\n')+'\n');const changed=[...lines];changed[1]='first changed';changed[27]='second changed';f.write('a.txt',changed.join('\n')+'\n');const h=await f.app.diffHunks('a','a.txt');assert.equal(h.hunks.length,2);await f.app.partialStage('a','a.txt',0,h.token);await f.app.commit('a','optional first hunk');const committed=f.git('show','layer/a:a.txt');assert(committed.includes('first changed'));assert(!committed.includes('second changed'));assert(f.read('a.txt').includes('second changed'));assert((await f.app.status()).layers[0]!.unstaged.length);f.record('optional patch native apply');});

test('GL15 managed compatible switch keeps another layer staged and dirty',async t=>{const f=await fixture(t);f.git('branch','develop');await f.seed('a','a.txt');f.write('a.txt','B\n');await f.app.add('a',['a.txt']);f.write('a.txt','C\n');await f.app.switch('develop');assert.equal(f.read('a.txt'),'C\n');assert.equal(f.git('show','layer/a:a.txt'),'a original');const status=await f.app.status();assert.equal(status.layers[0]!.staged.length,1);assert.equal(status.layers[0]!.unstaged.length,1);assert.equal(status.layers[0]!.state,'active');f.record('compatible switch');});

test('GL17 collision branch refuses before physical effects',async t=>{const f=await fixture(t);f.git('switch','-c','collision');f.write('a.txt','base collision\n');f.git('add','.');f.git('commit','-m','collision');f.git('switch','main');await f.seed('a','a.txt');const head=f.git('rev-parse','HEAD'),index=f.git('ls-files','--stage');await assert.rejects(f.app.switch('collision'));assert.equal(f.git('rev-parse','HEAD'),head);assert.equal(f.git('ls-files','--stage'),index);assert.equal(f.read('a.txt'),'a original\n');f.record('collision refused');});

test('GL22 deliberate Layer branch maintains other layers and returns coherently',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.seed('b','b.txt');f.write('b.txt','B staged\n');await f.app.add('b',['b.txt']);f.write('b.txt','B disk\n');await f.app.openLayerBranch('a');assert.equal(f.git('symbolic-ref','--short','HEAD'),'layer/a');assert(!fs.existsSync(path.join(f.repo,'base.txt')));assert.equal(f.read('b.txt'),'B disk\n');assert.equal((await f.app.status()).role,'layer-branch');f.write('a.txt','native layer branch\n');f.git('add','.');assert.equal(f.git('diff','--cached','--name-only'),'a.txt');f.git('commit','-m','native layer');await f.app.switch('main');assert.equal(f.read('a.txt'),'native layer branch\n');assert.equal(f.read('base.txt'),'base original\n');assert.equal(f.read('b.txt'),'B disk\n');const status=await f.app.status();assert(status.layers.find(l=>l.name==='b')!.staged.length);assert.equal(status.layers.find(l=>l.name==='a')!.state,'active');f.record('branch mode return');});

test('GL20 rename active layer retains ownership target and staged bytes',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.app.target('a');f.write('new.txt','new\n');const oid=f.git('rev-parse','layer/a');await f.app.renameLayer('a','renamed');assert.equal(f.git('rev-parse','layer/renamed'),oid);assert.equal((await f.app.status()).editingTarget,'renamed');assert((await f.app.status()).layers[0]!.reservations.includes('new.txt'));assert.equal(f.read('a.txt'),'a original\n');f.record('rename active target');});

test('GL20 removal refuses pending then explicit discard preserves other origin',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.seed('b','b.txt');f.write('a.txt','pending\n');await assert.rejects(f.app.removeLayer('a'),{code:'LAYER_DIRTY'});assert.equal(f.read('a.txt'),'pending\n');await f.app.removeLayer('a',{discard:true});assert.equal((await f.app.list()).some(l=>l.name==='a'),false);assert.equal(f.read('b.txt'),'b original\n');assert(!fs.existsSync(path.join(f.repo,'a.txt')));f.record('remove active');});

test('GL27 preview is read-only and apply revalidates a new collision',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.app.off('a');const registry=fs.readFileSync(path.join(f.app.dir,'registry.json')),exclude=fs.readFileSync(path.join(f.repo,'.git','info','exclude'));const preview=await f.app.preview('on','a');assert.deepEqual(preview.appears,['a.txt']);assert.deepEqual(fs.readFileSync(path.join(f.app.dir,'registry.json')),registry);assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git','info','exclude')),exclude);f.write('a.txt','local after preview\n');await assert.rejects(f.app.on('a'));assert.equal(f.read('a.txt'),'local after preview\n');f.record('stale preview collision refused');});

test('GL19 rename interrupted after ref update recovers without loss',async t=>{const f=await fixture(t);await f.seed('a','a.txt');process.env.GIT_LAYERS_FAILPOINT='after-layer-ref-change';await assert.rejects(f.app.renameLayer('a','new'),{code:'INJECTED_FAILURE'});delete process.env.GIT_LAYERS_FAILPOINT;const reopened=await GitLayers.open(f.repo);await reopened.recover();assert.equal(f.git('show','layer/a:a.txt'),'a original');assert.equal(f.read('a.txt'),'a original\n');assert.equal((await reopened.status()).safe,true);f.record('rename recovered');});

test('GL19 explicit branch transition failpoint recovers role and other projection',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.seed('b','b.txt');process.env.GIT_LAYERS_FAILPOINT='after-switch-head';await assert.rejects(f.app.openLayerBranch('a'),{code:'INJECTED_FAILURE'});delete process.env.GIT_LAYERS_FAILPOINT;const reopened=await GitLayers.open(f.repo);await reopened.recover();assert.equal(f.read('a.txt'),'a original\n');assert.equal(f.read('b.txt'),'b original\n');assert.equal((await reopened.status()).role,'layer-branch');f.record('branch transition recovered');});


test('GL19 leaving Layer branch interrupted after switch restores resumed projection',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.seed('b','b.txt');await f.app.openLayerBranch('a');f.write('a.txt','native committed before exit\n');f.git('add','a.txt');f.git('commit','-m','native');process.env.GIT_LAYERS_FAILPOINT='after-switch-head';await assert.rejects(f.app.switch('main'),{code:'INJECTED_FAILURE'});delete process.env.GIT_LAYERS_FAILPOINT;const reopened=await GitLayers.open(f.repo);await reopened.recover();assert.equal(f.read('a.txt'),'native committed before exit\n');assert.equal(f.read('b.txt'),'b original\n');assert.equal((await reopened.status()).safe,true);f.record('exit switch recovered');});

test('GL09 target skips control files and explicit release remains released',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.app.target('a');f.write('.gitignore','ignored.tmp\n');f.write('new.txt','new\n');await f.app.status();await f.app.release('a',['new.txt']);let state=await f.app.status();assert(!state.layers[0]!.reservations.includes('new.txt'));assert(!state.layers[0]!.reservations.includes('.gitignore'));await f.app.target();assert.equal((await f.app.status()).editingTarget,null);assert.equal(f.read('new.txt'),'new\n');f.record('release and control files');});

test('GL19-26 abandoned lock is visible in status and doctor without deletion',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.app.target('a');const lock=path.join(f.app.dir,'locks','coordinator');fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({schema:1,pid:2147483647,token:'unknown-external-owner'}));const state=await f.app.status();assert.equal(state.safe,false);assert.equal(state.error.code,'LOCKED');assert.equal((await f.app.doctor()).safe,false);assert(fs.existsSync(path.join(lock,'owner.json')));f.record('lock remains blocked');});

test('GL19-20 interrupted remove retains full commit through aggressive GC',async t=>{const f=await fixture(t);await f.seed('a','a.txt');const oid=f.git('rev-parse','layer/a');process.env.GIT_LAYERS_FAILPOINT='after-layer-ref-change';await assert.rejects(f.app.removeLayer('a'),{code:'INJECTED_FAILURE'});delete process.env.GIT_LAYERS_FAILPOINT;f.git('reflog','expire','--expire=now','--all');f.git('gc','--prune=now');assert.equal(f.git('cat-file','-t',oid),'commit');const reopened=await GitLayers.open(f.repo);await reopened.recover();assert.equal(f.git('rev-parse','layer/a'),oid);assert.equal(f.read('a.txt'),'a original\n');assert.equal((await reopened.status()).safe,true);f.record('removed commit recovered after GC');});

test('GL13 log observes native Layer branch commit without prior status',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.app.openLayerBranch('a');f.write('a.txt','native history\n');f.git('add','a.txt');f.git('commit','-m','native latest');const fresh=await GitLayers.open(f.repo);assert.equal((await fresh.log('a'))[0]!.oid,f.git('rev-parse','HEAD'));f.record('history matches real ref');});

test('GL19 oversized switch journal fails before withdrawing large projection',{timeout:900000},async t=>{const f=await fixture(t);f.git('branch','develop');await f.seed('a','large.txt','x'.repeat(49*1024*1024));const before=sha(fs.readFileSync(path.join(f.repo,'large.txt'))),head=f.git('rev-parse','HEAD');await assert.rejects(f.app.switch('develop'),{code:'METADATA_INVALID'});assert.equal(sha(fs.readFileSync(path.join(f.repo,'large.txt'))),before);assert.equal(f.git('rev-parse','HEAD'),head);await (await GitLayers.open(f.repo)).recover();assert.equal((await f.app.status()).safe,true);f.record('large projection preserved after journal failure');});

test('GL01-09 target excludes new external files before observation and preserves prior unassigned flow',async t=>{const f=await fixture(t);await f.seed('a','a.txt');f.write('old.txt','old unassigned\n');f.write('.gitignore','*.cache\n');f.git('add','--','.gitignore');f.git('commit','-m','ignore caches');f.write('ignored.cache','ignored\n');await f.app.target('a');f.write('before-observation.txt','new target\n');f.write('new/deep/file.txt','nested target\n');f.git('add','.');assert.equal(f.git('diff','--cached','--name-only'),'old.txt');f.git('commit','-m','native old baseline');assert.equal(f.git('show','HEAD:old.txt'),'old unassigned');const state=await f.app.status();assert(state.layers[0]!.reservations.includes('before-observation.txt'));assert(state.layers[0]!.reservations.includes('new/deep/file.txt'));assert(!state.layers[0]!.reservations.includes('ignored.cache'));await f.app.target();f.write('normal-after.txt','normal\n');f.git('add','.');assert.equal(f.git('diff','--cached','--name-only'),'normal-after.txt');f.record('target native protection before assignment');});

test('GAP GL01-09 higher priority ignore negation can bypass target protection in native add',async t=>{const f=await fixture(t);await f.seed('a','a.txt');f.write('.gitignore','!override.txt\n');f.git('add','--','.gitignore');f.git('commit','-m','native ignore precedence');await f.app.target('a');f.write('override.txt','native precedence\n');f.git('add','.');assert.equal(f.git('diff','--cached','--name-only'),'override.txt');f.git('commit','-m','native bypass by configured precedence');assert.equal(f.git('show','HEAD:override.txt'),'native precedence');assert(!(await f.app.status()).layers[0]!.reservations.includes('override.txt'));f.record('known native precedence bypass; PASS characterizes limit');});


// Append after the existing product tests once the frozen before-fix probe ends.
// GL-19/22 regression increment: branch role, native index aliases and deliberate exit.
async function openedRoleFixture(t: TestContext) {
  const f = await fixture(t);
  await f.seed('a', 'a.txt');
  await f.seed('b', 'b.txt');
  await f.app.openLayerBranch('a');
  return f;
}

test('GL19-ROLE interrupted commit of working Layer recovers metadata without duplicate history', async t => {
  const f = await openedRoleFixture(t);
  const beforeCount = Number(f.git('rev-list', '--count', 'layer/a'));
  f.write('a.txt', 'branch prepared B\n');
  await f.app.baseStage(['a.txt']);
  process.env.GIT_LAYERS_FAILPOINT = 'after-commit-ref';
  try { await assert.rejects(f.app.commit('a', 'branch interrupted commit'), { code: 'INJECTED_FAILURE' }); }
  finally { delete process.env.GIT_LAYERS_FAILPOINT; }
  const oid = f.git('rev-parse', 'HEAD');
  assert.equal(Number(f.git('rev-list', '--count', 'layer/a')), beforeCount + 1);
  const reopened = await GitLayers.open(f.repo);
  await reopened.recover();
  assert.equal(f.git('rev-parse', 'HEAD'), oid);
  assert.equal(Number(f.git('rev-list', '--count', 'layer/a')), beforeCount + 1);
  assert.equal((await reopened.status()).safe, true);
  assert.equal(f.read('b.txt'), 'b original\n');
  f.record('role commit recovered once with matching registry');
});

test('GL22-ROLE named add of tracked working Layer uses the main native index', async t => {
  const f = await openedRoleFixture(t);
  const other = f.git('rev-parse', 'layer/b');
  f.write('a.txt', 'tracked branch edit\n');
  await f.app.add('a', ['a.txt']);
  assert.equal(f.git('diff', '--cached', '--name-only'), 'a.txt');
  await f.app.commit('a', 'named branch add');
  assert.equal(f.git('show', 'HEAD:a.txt'), 'tracked branch edit');
  assert.equal(f.git('rev-parse', 'layer/b'), other);
  assert.equal(f.read('b.txt'), 'b original\n');
  f.record('named add aliases working branch stage');
});

test('GL22-ROLE new working Layer file commits without a ghost reservation on return', async t => {
  const f = await openedRoleFixture(t);
  f.write('new.txt', 'new branch file\n');
  await f.app.add('a', ['new.txt']);
  await f.app.commit('a', 'branch new file');
  assert.deepEqual((await f.app.status()).layers.find(layer => layer.name === 'a')!.reservations, []);
  await f.app.switch('main');
  await f.app.off('a');
  assert.equal(f.git('show', 'layer/a:new.txt'), 'new branch file');
  assert.equal(f.read('b.txt'), 'b original\n');
  assert(!fs.existsSync(path.join(f.repo, 'new.txt')));
  f.record('new working branch file returns clean and deactivates');
});

test('GL11-14-ROLE named unstage and restore preserve B index semantics on working Layer', async t => {
  const f = await openedRoleFixture(t);
  f.write('a.txt', 'B\n');
  await f.app.baseStage(['a.txt']);
  await f.app.unstage('a', ['a.txt']);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
  assert.equal(f.read('a.txt'), 'B\n');
  await f.app.baseStage(['a.txt']);
  f.write('a.txt', 'C\n');
  await f.app.restore('a', ['a.txt'], true);
  assert.equal(f.read('a.txt'), 'B\n');
  assert.equal(f.git('diff', '--cached', '--name-only'), 'a.txt');
  await f.app.commit('a', 'B restored in one commit');
  assert.equal(f.git('show', 'HEAD:a.txt'), 'B');
  assert.equal(f.read('b.txt'), 'b original\n');
  f.record('named stage aliases preserve native B and C distinctions');
});

test('GL22-ROLE explicit exit without resuming control-bearing Layer preserves other pending Layer', async t => {
  const f = await openedRoleFixture(t);
  f.write('b.txt', 'B staged\n');
  await f.app.add('b', ['b.txt']);
  f.write('b.txt', 'B later disk\n');
  f.write('.gitignore', '*.cache\n');
  await f.app.add('a', ['.gitignore']);
  await f.app.commit('a', 'working branch control file');
  const head = f.git('rev-parse', 'HEAD'), index = f.git('ls-files', '--stage');
  await assert.rejects(f.app.switch('main'), { code: 'LAYER_CONTROL_FILE' });
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(f.git('ls-files', '--stage'), index);
  assert.equal(f.read('.gitignore'), '*.cache\n');
  assert.equal(f.read('b.txt'), 'B later disk\n');
  await f.app.switch('main', { resumeLayer: false });
  const state = await f.app.status();
  assert.equal(state.branch, 'main');
  assert.equal(state.layers.find(layer => layer.name === 'a')!.state, 'inactive');
  assert.equal(state.layers.find(layer => layer.name === 'b')!.state, 'active');
  assert.equal(state.layers.find(layer => layer.name === 'b')!.staged.length, 1);
  assert.equal(state.layers.find(layer => layer.name === 'b')!.unstaged.length, 1);
  assert.equal(f.read('b.txt'), 'B later disk\n');
  assert(!fs.existsSync(path.join(f.repo, 'a.txt')));
  assert(!fs.existsSync(path.join(f.repo, '.gitignore')));
  await assert.rejects(f.app.on('a'), { code: 'LAYER_CONTROL_FILE' });
  assert.equal(f.read('b.txt'), 'B later disk\n');
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), 'main');
  f.record('deliberate exit leaves source inactive and other staged disk states intact');
});

test('GL04-22-ROLE recognizing a native control-bearing branch does not authorize projection', async t => {
  const f = await openedRoleFixture(t);
  f.write('.gitignore', '*.cache\n');
  f.git('add', '--', '.gitignore');
  f.git('commit', '-m', 'native branch control');
  f.git('branch', 'layer/controls');
  const oid = f.git('rev-parse', 'layer/controls'), head = f.git('rev-parse', 'HEAD');
  await f.app.register('controls');
  assert((await f.app.list()).some(layer => layer.name === 'controls' && layer.state === 'inactive'));
  await assert.rejects(f.app.on('controls'), { code: 'LAYER_CONTROL_FILE' });
  assert.equal(f.git('rev-parse', 'layer/controls'), oid);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(f.read('.gitignore'), '*.cache\n');
  assert.equal(f.read('b.txt'), 'b original\n');
  f.record('control-bearing identity retained without projection or ref rewrite');
});

test('GL04-20 native prefixed identity can be renamed and removed without manual registration',async t=>{const f=await fixture(t);f.git('branch','layer/external');const oid=f.git('rev-parse','layer/external');const preview=await f.app.preview('on','external');assert(preview.impediments.some(x=>x.code==='PATH_COLLISION'));await f.app.renameLayer('external','renamed');assert.equal(f.git('rev-parse','layer/renamed'),oid);assert.equal(f.read('base.txt'),'base original\n');await f.app.removeLayer('renamed');assert(!(await f.app.list()).some(l=>l.name==='renamed'));assert.equal(f.git('rev-parse','HEAD'),oid);f.record('identity lifecycle without classification step');});

// Append only after npm-test-attempt-02; not executed in the frozen run.
test('GL19-26 Core doctor accepts real working Layer index while retaining its private checkpoint', async t => {
  const f = await fixture(t);
  await f.seed('a', 'a.txt');
  await f.seed('b', 'b.txt');
  await f.app.openLayerBranch('a');
  f.write('a.txt', 'native committed in branch role\n');
  f.git('add', '--', 'a.txt');
  f.git('commit', '-m', 'native branch role latest');
  // A pending native stage is legitimate too; it is not a mismatch with a private index.
  f.write('a.txt', 'native staged after commit\n');
  f.git('add', '--', 'a.txt');
  const head = f.git('rev-parse', 'HEAD'), index = f.git('ls-files', '--stage');
  const registry = fs.readFileSync(path.join(f.app.dir, 'registry.json'));
  const { doctorRepository } = await import('../../src/core/rescue.js');
  assert.equal((await doctorRepository(f.repo)).safe, true);
  const diagnostic = await f.app.doctor();
  assert.equal(diagnostic.safe, true, JSON.stringify(diagnostic.checks));
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(f.git('ls-files', '--stage'), index);
  assert.deepEqual(fs.readFileSync(path.join(f.app.dir, 'registry.json')), registry);
  assert.equal(f.read('a.txt'), 'native staged after commit\n');
  assert.equal(f.read('b.txt'), 'b original\n');
  f.record('Core and independent rescue diagnose role-specific native index without metadata writes');
});


// Proposed regression only: do not integrate or execute while npm02 sources are frozen.
test('GL19-ROLE external private index modification refuses return without overwriting either index', async t => {
  const f = await openedRoleFixture(t);
  const registry = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8'));
  const layer = registry.layers.find((entry: any) => entry.name === 'a');
  const privateIndex = path.join(f.app.dir, 'indexes', layer.id + '.index');
  const originalPrivate = fs.readFileSync(privateIndex);
  const originalDisk = f.read('a.txt');
  // Independent official Git writer: stage into the retained private index only.
  f.write('a.txt', 'external private staging must survive\n');
  execFileSync(officialGit, ['add', '--', 'a.txt'], {
    cwd: f.repo,
    env: {...process.env, GIT_INDEX_FILE: privateIndex, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'false', GIT_PAGER: 'cat'},
    stdio: ['pipe', 'pipe', 'pipe']
  });
  f.write('a.txt', originalDisk);
  const changedPrivate = fs.readFileSync(privateIndex);
  assert.notDeepEqual(changedPrivate, originalPrivate);
  const before = {
    head: f.git('rev-parse', 'HEAD'), branch: f.git('symbolic-ref', '--short', 'HEAD'),
    refs: f.git('for-each-ref', '--format=%(refname) %(objectname)'), index: f.git('ls-files', '--stage'),
    a: f.read('a.txt'), b: f.read('b.txt'),
    registry: fs.readFileSync(path.join(f.app.dir, 'registry.json')),
    workspace: fs.readFileSync(path.join(f.app.dir, 'workspace.json'))
  };
  const { doctorRepository } = await import('../../src/core/rescue.js');
  const rawDiagnostic = await doctorRepository(f.repo);
  assert.equal(rawDiagnostic.safe, false);
  assert.ok(rawDiagnostic.checks.some(check => !check.ok && (check.detail as any).code === 'CHECKPOINT_MISMATCH'));
  let error: any;
  try { await f.app.switch('main'); } catch (caught) { error = caught; }
  t.diagnostic(JSON.stringify({errorCode:error?.code,privateBefore:sha(changedPrivate),privateAfter:sha(fs.readFileSync(privateIndex))}));
  f.record('return after external retained private-index stage');
  assert.equal(f.git('rev-parse', 'HEAD'), before.head);
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), before.branch);
  assert.equal(f.git('for-each-ref', '--format=%(refname) %(objectname)'), before.refs);
  assert.equal(f.git('ls-files', '--stage'), before.index);
  assert.equal(f.read('a.txt'), before.a);
  assert.equal(f.read('b.txt'), before.b);
  assert.deepEqual(fs.readFileSync(privateIndex), changedPrivate);
  assert.deepEqual(fs.readFileSync(path.join(f.app.dir, 'registry.json')), before.registry);
  assert.deepEqual(fs.readFileSync(path.join(f.app.dir, 'workspace.json')), before.workspace);
  assert.equal(error?.code, 'CHECKPOINT_MISMATCH');
});

// Proposed regression only: append after npm02 and the structural-validator patch.
// This file is outside the npm test glob and has not been executed.
test('GL19 recovery validates optional prior workspace roles and editing before any metadata write', async t => {
  const f = await fixture(t);
  await f.seed('a', 'a.txt');
  await f.seed('b', 'b.txt');
  f.write('older.txt', 'preexisting unassigned\n');
  await f.app.target('a');
  f.write('base.txt', 'interrupted base commit B\n');
  await f.app.baseStage(['base.txt']);
  const beforeCount = Number(f.git('rev-list', '--count', 'main'));
  process.env.GIT_LAYERS_FAILPOINT = 'after-commit-ref';
  try { await assert.rejects(f.app.baseCommit('workspace validator boundary'), {code:'INJECTED_FAILURE'}); }
  finally { delete process.env.GIT_LAYERS_FAILPOINT; }
  const transactions = path.join(f.app.dir, 'transactions');
  const pending = fs.readdirSync(transactions).map(id => path.join(transactions,id,'journal.json'))
    .filter(file => JSON.parse(fs.readFileSync(file,'utf8')).state !== 'completed');
  assert.equal(pending.length, 1);
  const journal = pending[0]!;
  const originalBytes = fs.readFileSync(journal);
  const original = JSON.parse(originalBytes.toString('utf8'));
  assert.equal(original.recovery.commit.base, true);
  assert.equal(original.recovery.beforeWorkspace.editing.layer, 'a');
  const committed = f.git('rev-parse','main');
  assert.equal(Number(f.git('rev-list','--count','main')),beforeCount+1);
  const metadataFiles = (): unknown[] => {
    const visit = (directory: string): unknown[] => fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry => {
      const full = path.join(directory,entry.name);
      assert(!entry.isSymbolicLink(), 'synthetic fixture must contain no links');
      return entry.isDirectory() ? visit(full) : [{path:path.relative(f.app.dir,full),sha256:sha(fs.readFileSync(full)),mode:fs.statSync(full).mode}];
    });
    return visit(f.app.dir);
  };
  const snapshot = () => ({
    head:f.git('rev-parse','HEAD'),branch:f.git('symbolic-ref','--short','HEAD'),
    refs:f.git('for-each-ref','--format=%(refname) %(objectname)'),index:f.git('ls-files','--stage'),
    exclude:fs.readFileSync(path.join(f.repo,'.git','info','exclude')).toString('base64'),
    base:f.read('base.txt'),a:f.read('a.txt'),b:f.read('b.txt'),old:f.read('older.txt'),metadata:metadataFiles()
  });
  const cases: {name:string,poison:(workspace:any)=>void}[] = [
    {name:'unknown branch Layer',poison:w=>{w.branchLayer='ghost';}},
    {name:'branch Layer wrong type',poison:w=>{w.branchLayer=7;}},
    {name:'branch Layer disagrees with main',poison:w=>{w.branchLayer='a';}},
    {name:'resume without matching branch Layer',poison:w=>{w.resumeLayer='a';}},
    {name:'invalid return branch',poison:w=>{w.returnBranch='main\ninvalid';}},
    {name:'null editing object',poison:w=>{w.editing=null;}},
    {name:'unknown editing Layer',poison:w=>{w.editing.layer='ghost';}},
    {name:'before invalid path',poison:w=>{w.editing.before=['../outside'];}},
    {name:'before duplicate',poison:w=>{w.editing.before=['same.txt','same.txt'];}},
    {name:'unassigned newline rule',poison:w=>{w.editing.unassigned=['safe.txt\n!/*.txt'];}},
    {name:'unassigned not in baseline',poison:w=>{w.editing.unassigned=['never-observed.txt'];}},
    {name:'unassigned duplicate',poison:w=>{w.editing.before=['old.txt'];w.editing.unassigned=['old.txt','old.txt'];}},
    {name:'invalid startedAt type',poison:w=>{w.editing.startedAt={};}},
    {name:'invalid startedAt value',poison:w=>{w.editing.startedAt='not-a-timestamp';}}
  ];
  for (const entry of cases) {
    const data=structuredClone(original);
    entry.poison(data.recovery.beforeWorkspace);
    writeJournalFixture(journal,data);
    const before=snapshot();
    const reopened=await GitLayers.open(f.repo);
    let error:any;
    try { await reopened.recover(); } catch(caught) { error=caught; }
    const after=snapshot();
    t.diagnostic(JSON.stringify({case:entry.name,errorCode:error?.code,preserved:JSON.stringify(before)===JSON.stringify(after)}));
    assert.deepEqual(after,before,entry.name+' must not write before rejecting its recovery plan');
    assert.equal(error?.code,'RECOVERY_INVALID',entry.name);
    fs.writeFileSync(journal,originalBytes);
  }
  // The unchanged valid journal still completes the already committed base exactly once.
  const reopened=await GitLayers.open(f.repo);
  await reopened.recover();
  assert.equal(f.git('rev-parse','main'),committed);
  assert.equal(Number(f.git('rev-list','--count','main')),beforeCount+1);
  assert.equal((await reopened.status()).safe,true);
  assert.equal(f.read('a.txt'),'a original\n');
  assert.equal(f.read('b.txt'),'b original\n');
  assert.equal(f.read('older.txt'),'preexisting unassigned\n');
  f.record('optional workspace recovery fields rejected before writes; valid original recovered once');
});

// Proposed regression only; not executed or integrated while npm02 is frozen.
test('GL19-ROLE recover without pending journals acknowledges native branch-role commit and preserves main stage', async t => {
  const f=await openedRoleFixture(t);
  f.write('a.txt','native branch-role committed B\n');
  f.git('add','--','a.txt');f.git('commit','-m','native branch-role commit');
  f.write('a.txt','native branch-role staged C\n');f.git('add','--','a.txt');
  const registry=JSON.parse(fs.readFileSync(path.join(f.app.dir,'registry.json'),'utf8'));
  const a=registry.layers.find((entry:any)=>entry.name==='a');
  const privateFile=path.join(f.app.dir,'indexes',a.id+'.index');
  const retained=fs.readFileSync(privateFile);
  const before={head:f.git('rev-parse','HEAD'),refs:f.git('for-each-ref','--format=%(refname) %(objectname)'),index:f.git('ls-files','--stage'),a:f.read('a.txt'),b:f.read('b.txt')};
  const reopened=await GitLayers.open(f.repo);
  const result=await reopened.recover();
  assert.deepEqual(result.recovered,[]);
  assert.equal(f.git('rev-parse','HEAD'),before.head);
  assert.equal(f.git('for-each-ref','--format=%(refname) %(objectname)'),before.refs);
  assert.equal(f.git('ls-files','--stage'),before.index);
  assert.equal(f.read('a.txt'),before.a);assert.equal(f.read('b.txt'),before.b);
  assert.deepEqual(fs.readFileSync(privateFile),retained);
  const saved=JSON.parse(fs.readFileSync(path.join(f.app.dir,'registry.json'),'utf8'));
  assert.equal(saved.layers.find((entry:any)=>entry.name==='a').oid,before.head);
  assert.equal((await reopened.doctor()).safe,true);
  f.record('recovery without a journal acknowledges role while preserving legitimate native staging');
});


test('GL19 main index lock prevents Layer mutation before effects',async t=>{const f=await fixture(t);await f.seed('a','a.txt');await f.app.off('a');const lock=path.join(f.repo,'.git','index.lock');fs.writeFileSync(lock,'external native index lock\n');const registry=fs.readFileSync(path.join(f.app.dir,'registry.json')),exclude=fs.readFileSync(path.join(f.repo,'.git','info','exclude')),head=f.git('rev-parse','HEAD'),index=f.git('ls-files','--stage');await assert.rejects(f.app.on('a'),{code:'LOCKED'});assert.equal(f.git('rev-parse','HEAD'),head);assert.equal(f.git('ls-files','--stage'),index);assert(!fs.existsSync(path.join(f.repo,'a.txt')));assert.deepEqual(fs.readFileSync(path.join(f.app.dir,'registry.json')),registry);assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git','info','exclude')),exclude);assert.equal(fs.readFileSync(lock,'utf8'),'external native index lock\n');assert(!fs.existsSync(path.join(f.app.dir,'locks','coordinator')));f.record('Git index lock preserved; mutation refused before transaction');});

test('GL19-26 doctor rejects malformed editing baseline independently of normal open',async t=>{const f=await fixture(t);await f.seed('a','a.txt');f.write('old.txt','old\n');await f.app.target('a');const file=path.join(f.app.dir,'workspace.json'),bytes=fs.readFileSync(file),workspace=JSON.parse(bytes.toString('utf8'));const {doctorRepository}=await import('../../src/core/rescue.js');for(const poison of [(w:any)=>{w.editing.startedAt='not-a-timestamp';},(w:any)=>{w.editing.unassigned=['never-observed.txt'];},(w:any)=>{w.editing.before=['same.txt','same.txt'];},(w:any)=>{w.baseReservations=['../escape'];},(w:any)=>{w.editing.assigned=[w.editing.before[0]];},(w:any)=>{w.acknowledgedMissing=['same.txt','same.txt'];}]){const bad=structuredClone(workspace);poison(bad);fs.writeFileSync(file,JSON.stringify(bad,null,2)+'\n');const snapshot=fs.readFileSync(file);await assert.rejects(GitLayers.open(f.repo),{code:'METADATA_INVALID'});assert.equal((await doctorRepository(f.repo)).safe,false);assert.deepEqual(fs.readFileSync(file),snapshot);}fs.writeFileSync(file,bytes);assert.equal((await (await GitLayers.open(f.repo)).status()).safe,true);f.record('invalid editing metadata refused and retained');});

test('GL27 remote-only removal preview diagnoses absent local reference without creating it',async t=>{const f=await fixture(t);await f.seed('a','a.txt');const oid=f.git('rev-parse','layer/a');f.git('remote','add','fixture-origin',f.repo);f.git('update-ref','refs/remotes/fixture-origin/layer/remote-only',oid);const refs=f.git('for-each-ref','--format=%(refname) %(objectname)'),registry=fs.readFileSync(path.join(f.app.dir,'registry.json'));const preview=await f.app.preview('remove','remote-only');assert(preview.impediments.some(x=>x.code==='LAYER_REMOTE_ONLY'));assert.equal(f.git('for-each-ref','--format=%(refname) %(objectname)'),refs);assert.deepEqual(fs.readFileSync(path.join(f.app.dir,'registry.json')),registry);f.record('remote-only removal is a read-only diagnosed refusal');});

test('GL19 independent doctor validates workspace role coherence without rewriting optional return hints', async t => {
  const f = await fixture(t);
  await f.app.create('inactive-target');
  const workspaceFile = path.join(f.app.dir, 'workspace.json');
  const original = JSON.parse(fs.readFileSync(workspaceFile, 'utf8'));
  const { doctorRepository } = await import('../../src/core/rescue.js');
  for (const extra of [
    { editing: { layer: 'inactive-target', before: [], unassigned: [], startedAt: new Date().toISOString() } },
    { resumeLayer: 'inactive-target' },
    { branch: 'layer/unknown-origin', branchLayer: 'unknown-origin' },
  ]) {
    fs.writeFileSync(workspaceFile, JSON.stringify({ ...original, ...extra }, null, 2) + '\n');
    const before = fs.readFileSync(workspaceFile), diagnostic = await doctorRepository(f.repo);
    assert.equal(diagnostic.safe, false);
    assert.ok(diagnostic.checks.some(entry => !entry.ok && (entry.detail as any).code === 'METADATA_INVALID'));
    assert.deepEqual(fs.readFileSync(workspaceFile), before);
  }
  // A missing return hint alone does not make otherwise coherent roles unhealthy.
  fs.writeFileSync(workspaceFile, JSON.stringify({ ...original, returnBranch: 'nonexistent-advisory-branch' }, null, 2) + '\n');
  assert.equal((await doctorRepository(f.repo)).safe, true);
  f.record('independent doctor rejects inconsistent roles without rewriting metadata');
});


test('GL19 external private index lock is unsafe and refuses mutation without removing lock',async t=>{
  const f=await fixture(t);await f.seed('a','a.txt');await f.app.off('a');
  const {doctorRepository}=await import('../../src/core/rescue.js');
  assert.equal((await f.app.status()).safe,true);assert.equal((await doctorRepository(f.repo)).safe,true);
  const registry=fs.readFileSync(path.join(f.app.dir,'registry.json'));const layer=JSON.parse(registry.toString('utf8')).layers.find((entry:any)=>entry.name==='a');
  const index=path.join(f.app.dir,'indexes',layer.id+'.index'),lock=index+'.lock',marker='owned fixture native private index lock\n';
  const privateBefore=fs.readFileSync(index),mainBefore=fs.readFileSync(path.join(f.repo,'.git','index')),workspace=fs.readFileSync(path.join(f.app.dir,'workspace.json')),exclude=fs.readFileSync(path.join(f.repo,'.git','info','exclude')),head=f.git('rev-parse','HEAD'),refs=f.git('for-each-ref','--format=%(refname) %(objectname)');
  fs.writeFileSync(lock,marker,{flag:'wx'});
  let nativeExit:number|undefined;try{execFileSync(officialGit,['read-tree','layer/a'],{cwd:f.repo,env:{...process.env,GIT_INDEX_FILE:index,GIT_TERMINAL_PROMPT:'0'},encoding:'utf8',stdio:['pipe','pipe','pipe']});}catch(error){nativeExit=(error as any).status;}
  assert.equal(nativeExit,128);assert.deepEqual(fs.readFileSync(index),privateBefore);
  const direct=await doctorRepository(f.repo),core=await f.app.doctor(),status=await f.app.status();
  t.diagnostic(JSON.stringify({nativeExit,directSafe:direct.safe,coreSafe:core.safe,statusSafe:status.safe,lockSha256:sha(fs.readFileSync(lock)),privateSha256:sha(privateBefore)}));
  assert.equal(direct.safe,false);assert(direct.checks.some(check=>!check.ok&&(check.detail as any)?.code==='LOCKED'));assert.equal(core.safe,false);assert.equal(status.safe,false);assert.equal(status.error.code,'LOCKED');
  await assert.rejects(f.app.on('a'),{code:'LOCKED'});assert.equal(f.git('rev-parse','HEAD'),head);assert.equal(f.git('for-each-ref','--format=%(refname) %(objectname)'),refs);assert.deepEqual(fs.readFileSync(index),privateBefore);assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git','index')),mainBefore);assert.deepEqual(fs.readFileSync(path.join(f.app.dir,'registry.json')),registry);assert.deepEqual(fs.readFileSync(path.join(f.app.dir,'workspace.json')),workspace);assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git','info','exclude')),exclude);assert.equal(fs.readFileSync(lock,'utf8'),marker);assert(!fs.existsSync(path.join(f.repo,'a.txt')));assert(!fs.existsSync(path.join(f.app.dir,'locks','coordinator')));f.record('private native lock preserved; diagnostics unsafe and mutation refused before transaction');
});


test('GL19 external private index lock and main lock refuse recovery before journal effects',async t=>{
  const f=await fixture(t);await f.seed('a','a.txt');f.write('a.txt','committed recovery B\n');await f.app.add('a',['a.txt']);f.write('a.txt','disk recovery C\n');
  process.env.GIT_LAYERS_FAILPOINT='after-commit-ref';await assert.rejects(f.app.commit('a','interrupted owned fixture commit'),{code:'INJECTED_FAILURE'});delete process.env.GIT_LAYERS_FAILPOINT;
  const registry=JSON.parse(fs.readFileSync(path.join(f.app.dir,'registry.json'),'utf8'));const layer=registry.layers.find((entry:any)=>entry.name==='a');const privateIndex=path.join(f.app.dir,'indexes',layer.id+'.index'),mainIndex=path.join(f.repo,'.git','index');
  const inventory=()=>{const rows:{path:string,sha256:string}[]=[];const walk=(dir:string)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile())rows.push({path:path.relative(f.app.dir,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))});else assert.fail('Unexpected linked fixture metadata');}};walk(f.app.dir);return rows.sort((a,b)=>a.path.localeCompare(b.path));};
  const beforeHead=f.git('rev-parse','HEAD'),beforeRefs=f.git('for-each-ref','--format=%(refname) %(objectname)'),commitCount=f.git('rev-list','--count','layer/a');
  for(const [role,index] of [['private',privateIndex],['main',mainIndex]]){
    const lock=index!+'.lock',marker='owned '+role+' index lock\n';fs.writeFileSync(lock,marker,{flag:'wx'});const metadata=inventory(),privateBytes=fs.readFileSync(privateIndex),mainBytes=fs.readFileSync(mainIndex),disk=f.read('a.txt'),exclude=fs.readFileSync(path.join(f.repo,'.git','info','exclude'));
    await assert.rejects(f.app.recover(),{code:'LOCKED'});assert.deepEqual(inventory(),metadata);assert.deepEqual(fs.readFileSync(privateIndex),privateBytes);assert.deepEqual(fs.readFileSync(mainIndex),mainBytes);assert.equal(f.git('rev-parse','HEAD'),beforeHead);assert.equal(f.git('for-each-ref','--format=%(refname) %(objectname)'),beforeRefs);assert.equal(f.read('a.txt'),disk);assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git','info','exclude')),exclude);assert.equal(fs.readFileSync(lock,'utf8'),marker);t.diagnostic(JSON.stringify({role,errorCode:'LOCKED',metadataPreserved:true,privateSha256:sha(privateBytes),mainSha256:sha(mainBytes),diskSha256:sha(disk),lockSha256:sha(marker)}));f.record(role+' lock refuses recovery before all journal writes');
    // The test owns this exact lock marker. Product recovery never removes it.
    assert.equal(fs.readFileSync(lock,'utf8'),marker);fs.unlinkSync(lock);
  }
  const recovered=await f.app.recover();assert.equal(recovered.recovered.length,1);assert.equal(f.git('rev-list','--count','layer/a'),commitCount);assert.equal(f.git('show','layer/a:a.txt'),'committed recovery B');assert.equal(f.read('a.txt'),'disk recovery C\n');assert.equal((await f.app.status()).safe,true);f.record('after explicitly releasing fixture locks journal completes once');
});


test('GL19 external private index lock for journal-only registration prevents rollback effects',async t=>{
  const f=await fixture(t);process.env.GIT_LAYERS_FAILPOINT='after-register-index';await assert.rejects(f.app.create('new'),{code:'INJECTED_FAILURE'});delete process.env.GIT_LAYERS_FAILPOINT;
  const registry=fs.readFileSync(path.join(f.app.dir,'registry.json'));assert.equal(JSON.parse(registry.toString('utf8')).layers.length,0);const names=fs.readdirSync(path.join(f.app.dir,'indexes')).filter(name=>name.endsWith('.index'));assert.equal(names.length,1);const index=path.join(f.app.dir,'indexes',names[0]!),lock=index+'.lock',marker='owned journal-only native index lock\n';fs.writeFileSync(lock,marker,{flag:'wx'});
  const pending=(await import('../../src/core/storage.js')).listTransactions;const journals=await pending(f.app.dir);assert.equal(journals.length,1);assert.equal(journals[0]!.recovery.beforeRegistry.layers.length,0);assert(journals[0]!.recovery.files.some((entry:any)=>entry.path===index));
  const journal=path.join(f.app.dir,'transactions',journals[0]!.id,'journal.json'),beforeJournal=fs.readFileSync(journal),beforeIndex=fs.readFileSync(index),beforeMain=fs.readFileSync(path.join(f.repo,'.git','index')),beforeWorkspace=fs.readFileSync(path.join(f.app.dir,'workspace.json')),refs=f.git('for-each-ref','--format=%(refname) %(objectname)'),head=f.git('rev-parse','HEAD');
  await assert.rejects(f.app.recover(),{code:'LOCKED'});assert.deepEqual(fs.readFileSync(journal),beforeJournal);assert.deepEqual(fs.readFileSync(index),beforeIndex);assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git','index')),beforeMain);assert.deepEqual(fs.readFileSync(path.join(f.app.dir,'registry.json')),registry);assert.deepEqual(fs.readFileSync(path.join(f.app.dir,'workspace.json')),beforeWorkspace);assert.equal(f.git('for-each-ref','--format=%(refname) %(objectname)'),refs);assert.equal(f.git('rev-parse','HEAD'),head);assert.equal(fs.readFileSync(lock,'utf8'),marker);t.diagnostic(JSON.stringify({case:'journal-only index',errorCode:'LOCKED',journalPreserved:true,indexSha256:sha(beforeIndex),lockSha256:sha(marker)}));f.record('journal-only index lock blocks rollback before effects');
  assert.equal(fs.readFileSync(lock,'utf8'),marker);fs.unlinkSync(lock);assert.equal((await f.app.recover()).recovered.length,1);assert(!fs.existsSync(index));assert.deepEqual(fs.readFileSync(path.join(f.repo,'.git','index')),beforeMain);assert.equal(f.git('for-each-ref','--format=%(refname) %(objectname)'),refs);assert.equal((await f.app.status()).safe,true);assert((await f.app.list()).some(layer=>layer.name==='new'&&layer.state==='inactive'));f.record('unpublished index rollback after deliberate fixture lock release preserves candidate history');
});
