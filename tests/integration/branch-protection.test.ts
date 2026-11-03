import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import { enableBranchProtection, disableBranchProtection, inspectBranchProtection, releaseLayerProtection, reserveLayerProtection } from '../../src/core/branch-protection.js';
import { discover } from '../../src/core/git.js';
import { GitLayers } from '../../src/core/index.js';
import { migrateLayerLayout, inventoryLayerDirectory } from '../../src/core/layout.js';
import { resolveGitExecutable } from '../../src/core/platform.js';

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gitlayer-protection-'));
  const nonce = randomUUID(); await fs.writeFile(path.join(root, '.owner'), nonce);
  const repo = path.join(root, 'repo'), home = path.join(root, 'home'), template = path.join(root, 'template');
  await fs.mkdir(repo); await fs.mkdir(home); await fs.mkdir(template);
  const config = path.join(home, 'empty-config'); await fs.writeFile(config, '');
  const overrides = { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_SYSTEM: config, GIT_CONFIG_NOSYSTEM: '1' };
  const old = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  const executable = await resolveGitExecutable();
  const env = { ...process.env, ...overrides, GIT_AUTHOR_NAME:'Protection Fixture', GIT_AUTHOR_EMAIL:'fixture@example.invalid', GIT_COMMITTER_NAME:'Protection Fixture', GIT_COMMITTER_EMAIL:'fixture@example.invalid', GIT_TERMINAL_PROMPT:'0', GIT_ASKPASS:'', SSH_ASKPASS:'', GIT_EDITOR:'false', GIT_SEQUENCE_EDITOR:'false', GIT_PAGER:'' };
  for (const key of Object.keys(env)) if (/^GIT_/i.test(key) && !Object.keys(overrides).includes(key) && !['GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL','GIT_TERMINAL_PROMPT','GIT_ASKPASS','GIT_EDITOR','GIT_SEQUENCE_EDITOR','GIT_PAGER'].includes(key)) delete (env as any)[key];
  const native = (args: string[], ok = [0], cwd = repo) => {
    assert(path.resolve(cwd).startsWith(root + path.sep));
    const r = spawnSync(executable, ['--no-pager', '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=' + template, '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false', '-c', 'credential.helper=', ...args], { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 20000 });
    assert(ok.includes(r.status!), JSON.stringify({ args, code:r.status, stderr:r.stderr, error:r.error?.message })); return r;
  };
  t.after(async () => {
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    // Cleanup only a newly created root with exact nonce and expected ancestry.
    assert.equal(await fs.readFile(path.join(root, '.owner'),'utf8'), nonce);
    assert(path.dirname(root) === os.tmpdir() && path.basename(root).startsWith('gitlayer-protection-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  native(['-c','init.templateDir=' + template,'init','--initial-branch=main']);
  await fs.writeFile(path.join(repo, 'base.txt'), 'base\n'); native(['add','.']); native(['commit','-m','base']);
  for (const name of ['scripts','ia']) {
    native(['switch','--orphan','layer/' + name]);
    await fs.writeFile(path.join(repo, name + '.txt'), name + '\n'); native(['add','.']); native(['commit','-m',name]);
  }
  native(['switch','main']);
  const snapshot = async () => ({ head:native(['rev-parse','HEAD']).stdout, branch:native(['symbolic-ref','HEAD']).stdout, index:native(['ls-files','--stage']).stdout, refs:native(['for-each-ref','--format=%(refname) %(objectname)']).stdout, files:await Promise.all((await fs.readdir(repo)).filter(n=>n!=='.git').sort().map(async n=>[n,await fs.readFile(path.join(repo,n),'utf8')])) });
  return { root, repo, native, snapshot };
}

test('opt-in native reservations veto ordinary switch before effects and expose explicit native bypass', { timeout: 60000 }, async t => {
  const f=await fixture(t);
  assert.equal((await inspectBranchProtection(f.repo)).enabled,false);
  const protection=await enableBranchProtection(f.repo);
  assert.equal(protection.enabled,true); assert.equal(protection.healthy,true); assert.equal(protection.validWorktrees.length,2); assert.deepEqual(protection.externalWorktrees,[]);
  assert.deepEqual(protection.unprotectedLayers,[]);
  const before=await f.snapshot();
  const veto=f.native(['switch','layer/scripts'],[128]); assert.match(veto.stderr,/already|used|checked out/u);
  assert.deepEqual(await f.snapshot(),before);
  f.native(['switch','--ignore-other-worktrees','layer/scripts']);
  assert.equal(f.native(['symbolic-ref','--short','HEAD']).stdout.trim(),'layer/scripts');
});

test('explicit release and re-reservation keep the other Layer reserved, with safe reversible unprotect', { timeout: 60000 }, async t => {
  const f=await fixture(t); await enableBranchProtection(f.repo);
  const released=await releaseLayerProtection(f.repo,'scripts'); assert.equal(released.validWorktrees.length,1);
  f.native(['switch','layer/scripts']);
  const inLayer=await reserveLayerProtection(f.repo,'scripts'); assert.equal(inLayer.validWorktrees.length,1); assert.deepEqual(inLayer.unprotectedLayers,[]);
  f.native(['switch','layer/ia'],[128]);
  f.native(['switch','main']); await reserveLayerProtection(f.repo,'scripts');
  assert.equal((await inspectBranchProtection(f.repo)).validWorktrees.length,2);
  const before=await f.snapshot();
  const disabled=await disableBranchProtection(f.repo); assert.equal(disabled.enabled,false); assert.equal(disabled.healthy,true); assert.deepEqual(disabled.validWorktrees,[]);
  assert.deepEqual(await f.snapshot(),before);
  f.native(['switch','layer/scripts']);
});

test('unknown worktree files and unknown protection directory are preserved instead of forced away', { timeout: 60000 }, async t => {
  const f=await fixture(t); const enabled=await enableBranchProtection(f.repo);
  const foreign=path.join(enabled.validWorktrees[0]!,'personal.txt'); await fs.writeFile(foreign,'external work\n');
  const before=await f.snapshot(); const status=await inspectBranchProtection(f.repo); assert.equal(status.healthy,false); assert(status.problems.length>0);
  await assert.rejects(()=>disableBranchProtection(f.repo), { code:'PROTECTION_CONFLICT' });
  assert.equal(await fs.readFile(foreign,'utf8'),'external work\n'); assert.deepEqual(await f.snapshot(),before);
});

test('an unknown protection destination is never initialized or overwritten', { timeout: 60000 }, async t => {
  const second=await fixture(t); const repoInfo=await discover(second.repo); const occupied=path.join(repoInfo.gitDir,'layers','branch-protection');
  await fs.mkdir(occupied,{recursive:true}); await fs.writeFile(path.join(occupied,'unknown.txt'),'do not replace');
  await assert.rejects(()=>enableBranchProtection(second.repo), { code:'PROTECTION_CONFLICT' });
  assert.equal(await fs.readFile(path.join(occupied,'unknown.txt'),'utf8'),'do not replace');
});

test('private index or external worktree cannot be mistaken for a pristine owned reservation', { timeout: 60000 }, async t => {
  const f=await fixture(t); const protectedState=await enableBranchProtection(f.repo); const own=protectedState.validWorktrees[0]!;
  f.native(['read-tree','HEAD'],[0],own);
  assert.equal((await inspectBranchProtection(f.repo)).healthy,false);
  await assert.rejects(()=>disableBranchProtection(f.repo), { code:'PROTECTION_CONFLICT' });
  const text=await fs.readFile(path.join(own,'.git'),'utf8'); const admin=text.slice('gitdir: '.length).trim();
  assert((await fs.stat(path.join(admin,'index'))).isFile());
  const external=path.join(f.root,'external-worktree'); f.native(['worktree','add','--detach',external,'main']);
  const inspected=await inspectBranchProtection(f.repo); assert(inspected.externalWorktrees.some(w=>path.resolve(w)===path.resolve(external)));
});

test('Core lifecycle with protection opens a Layer deliberately, preserves others and guards renamed/new Layers', { timeout: 120000 }, async t => {
  const f=await fixture(t); f.native(['config','--local','user.name','Protection Fixture']); f.native(['config','--local','user.email','fixture@example.invalid']);
  const app=await GitLayers.init(f.repo); await enableBranchProtection(f.repo);
  await app.on('scripts'); await app.on('ia');
  const original=(await app.list()).find(l=>l.name==='scripts')!.oid;
  await assert.rejects(()=>app.switch('layer/scripts'), {code:'INVALID_BRANCH'});
  await app.openLayerBranch('scripts');
  const opened=await app.status(); assert.equal(opened.safe,true); assert.equal(opened.role,'layer-branch');
  assert.equal(opened.branch,'layer/scripts'); assert.equal(opened.layers.find(l=>l.name==='ia')!.state,'active');
  assert.equal(opened.branchProtection.validWorktrees.length,1);
  assert.equal(await fs.readFile(path.join(f.repo,'scripts.txt'),'utf8'),'scripts\n');
  assert.equal(await fs.readFile(path.join(f.repo,'ia.txt'),'utf8'),'ia\n');
  await app.switch('main');
  const returned=await app.status(); assert.equal(returned.safe,true); assert.equal(returned.branchProtection.validWorktrees.length,2);
  f.native(['switch','layer/scripts'],[128]);
  await app.renameLayer('scripts','tools');
  assert.equal(f.native(['rev-parse','refs/heads/layer/tools']).stdout.trim(),original);
  f.native(['switch','layer/tools'],[128]);
  await app.removeLayer('tools');
  f.native(['show-ref','--verify','--quiet','refs/heads/layer/tools'],[1]);
  assert.equal(await fs.readFile(path.join(f.repo,'ia.txt'),'utf8'),'ia\n');
  await app.create('new');
  f.native(['switch','layer/new'],[128]);
  const final=await app.status(); assert.equal(final.safe,true); assert.equal(final.branchProtection.healthy,true);
  assert.deepEqual(final.branchProtection.unprotectedLayers,[]);
});

test('disabled released protection migrates without altering legacy and can reserve again in layers', { timeout: 90000 }, async t => {
  const f=await fixture(t); const info=await discover(f.repo), legacy=path.join(info.gitDir,'git-layers');
  await fs.mkdir(legacy);
  await fs.writeFile(path.join(legacy,'registry.json'),JSON.stringify({schema:1,layers:[]}));
  await fs.writeFile(path.join(legacy,'workspace.json'),JSON.stringify({schema:1,branch:'main',head:f.native(['rev-parse','HEAD']).stdout.trim()}));
  await enableBranchProtection(f.repo);
  await assert.rejects(()=>migrateLayerLayout(f.repo,{confirm:true}),{code:'PROTECTION_MIGRATION_REQUIRED'});
  await disableBranchProtection(f.repo);
  const before=await inventoryLayerDirectory(legacy);
  await migrateLayerLayout(f.repo,{confirm:true});
  assert.deepEqual(await inventoryLayerDirectory(legacy),before);
  const migrated=await inspectBranchProtection(f.repo); assert.equal(migrated.healthy,true); assert.equal(migrated.enabled,false);
  const enabled=await enableBranchProtection(f.repo); assert.equal(enabled.healthy,true); assert.equal(enabled.validWorktrees.length,2);
  assert(enabled.validWorktrees.every(w=>w.startsWith(path.join(info.gitDir,'layers')+path.sep)));
  f.native(['switch','layer/scripts'],[128]);
  assert.deepEqual(await inventoryLayerDirectory(legacy),before);
  await disableBranchProtection(f.repo); assert.deepEqual(await inventoryLayerDirectory(legacy),before);
});
test('protection may be enabled before Core initialization without resetting native reservations', { timeout: 60000 }, async t => {
  const f=await fixture(t); const before=await enableBranchProtection(f.repo);
  assert.equal(before.validWorktrees.length,2);
  const app=await GitLayers.init(f.repo);
  const status=await app.status(); assert.equal(status.safe,true); assert.equal(status.branchProtection.healthy,true);
  assert.deepEqual(status.branchProtection.validWorktrees,before.validWorktrees);
  await app.on('scripts');
  assert.equal(await fs.readFile(path.join(f.repo,'scripts.txt'),'utf8'),'scripts\n');
  f.native(['switch','layer/scripts'],[128]);
});
test('a reserved Layer ref deleted externally is diagnosed before Core registration', { timeout: 60000 }, async t => {
  const f=await fixture(t); await enableBranchProtection(f.repo);
  const before=await f.snapshot();
  f.native(['update-ref','-d','refs/heads/layer/scripts']);
  const protection=await inspectBranchProtection(f.repo);
  assert.equal(protection.healthy,false);
  assert(protection.problems.some(problem=>problem.name==='scripts' && problem.code==='PROTECTION_CONFLICT'));
  assert(!protection.validWorktrees.some(w=>protection.reservations.find(entry=>entry.name==='scripts')!.worktree===w));
  const after=await f.snapshot();
  assert.equal(after.head,before.head); assert.equal(after.index,before.index); assert.deepEqual(after.files,before.files);
});