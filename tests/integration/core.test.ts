import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test, { after, type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { resolveGit } from '../../scripts/git-compat/lib.mjs';
const officialGit = resolveGit();

// Every repository is disposable, has only local identity, and uses no host Git config.
// Tests run serially because each fixture temporarily isolates the Core's process env.
// OS-local temporary storage avoids background reconciliation of task workspace files.
// Git commands and all integrity assertions remain identical.
const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'git-layers-core-tests-'));
after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
const envKeys = ['HOME', 'XDG_CONFIG_HOME', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'GIT_LAYERS_FAILPOINT'] as const;

async function fixture(t: TestContext) {
  mkdirSync(fixtureRoot, { recursive: true });
  const root = mkdtempSync(path.join(fixtureRoot, 'repo-'));
  const home = path.join(root, 'isolated-home');
  mkdirSync(home);
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  process.env.HOME = home;
  process.env.XDG_CONFIG_HOME = home;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_CONFIG_GLOBAL = path.join(home, 'no-global-config');
  for (const key of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'GIT_LAYERS_FAILPOINT']) delete process.env[key];
  t.after(() => {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    rmSync(root, { recursive: true, force: true });
  });
  const git = (...args: string[]) => execFileSync(officialGit, ['-C', root, ...args], {
    encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }, stdio: ['pipe', 'pipe', 'pipe'],
  }).trimEnd();
  const write = (file: string, content: string | Buffer) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  git('init', '-b', 'main');
  git('config', '--local', 'user.name', 'Disposable Test');
  git('config', '--local', 'user.email', 'test@example.invalid');
  git('config', '--local', 'core.autocrlf', 'false');
  git('config', '--local', 'commit.gpgsign', 'false');
  write('README.md', 'base original\n');
  write('src/app.ts', 'export const app = 1;\n');
  git('add', '--', 'README.md', 'src/app.ts');
  git('commit', '-m', 'Base root');
  const app = await GitLayers.init(root);
  const index = () => createHash('sha256').update(readFileSync(path.join(root, '.git', 'index'))).digest('hex');
  const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
  const layer = async (name: string, file: string, content = `${name} original\n`) => {
    await app.create(name);
    await app.on(name);
    write(file, content);
    await app.add(name, [file]);
    await app.commit(name, `Seed ${name}`);
  };
  return { root, home, app, git, write, read, index, layer };
}

// Stage 1B: external absence + creation needs a deliberate decision. The
// decision itself must preserve native refs/indices and physical bytes/modes.
async function decisionSnapshot(f: Awaited<ReturnType<typeof fixture>>, paths: string[]) {
  const layers=await f.app.list();
  return {refs:f.git('for-each-ref','--format=%(refname) %(objectname)'),mainIndex:f.index(),
    layerIndexes:layers.filter(layer=>layer.id).map(layer=>({id:layer.id,sha256:createHash('sha256').update(readFileSync(path.join(f.app.dir,'indexes',layer.id+'.index'))).digest('hex')})),
    files:paths.map(file=>{const full=path.join(f.root,file);return existsSync(full)?{path:file,sha256:createHash('sha256').update(readFileSync(full)).digest('hex'),mode:lstatSync(full).mode}:{path:file,absent:true};})};
}

function changed(changes: Array<{ path: string }>, file: string) { return changes.some(change => change.path === file); }

test('base flow uses the actual index, branch ref, staged tree and commit', async t => {
  const f = await fixture(t);
  const initial = f.git('rev-parse', 'HEAD');
  f.write('normal.txt', 'ordinary new file\n');
  await f.app.baseStage(['normal.txt']);
  assert.equal(f.git('show', ':normal.txt'), 'ordinary new file');
  await f.app.baseCommit('Commit on main');
  assert.notEqual(f.git('rev-parse', 'HEAD'), initial);
  assert.equal(f.git('show', 'HEAD:normal.txt'), 'ordinary new file');
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), 'main');
});

test('two active Layers project real files while HEAD and base index stay unchanged', async t => {
  const f = await fixture(t);
  const head = f.git('rev-parse', 'HEAD');
  const index = f.index();
  await f.layer('ai', 'AGENTS.md');
  await f.layer('scripts', 'scripts/debug.py');
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), 'main');
  assert.equal(f.index(), index);
  assert.equal(f.read('AGENTS.md'), 'ai original\n');
  assert.equal(f.read('scripts/debug.py'), 'scripts original\n');
  assert.equal(lstatSync(path.join(f.root, 'AGENTS.md')).isSymbolicLink(), false);
  assert.deepEqual(f.git('ls-tree', '-r', '--name-only', 'layer/ai').split('\n'), ['AGENTS.md']);
  assert.deepEqual(f.git('ls-tree', '-r', '--name-only', 'layer/scripts').split('\n'), ['scripts/debug.py']);
  assert.equal(f.git('rev-list', '--max-parents=0', 'layer/ai').split('\n').length, 1);
  assert.notEqual(f.git('rev-list', '--max-parents=0', 'layer/ai'), f.git('rev-list', '--max-parents=0', 'main'));
});

test('native git add dot protects Layer files and adds ordinary new files', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'Layer edits\n');
  f.write('ordinary.txt', 'base candidate\n');
  f.git('add', '.');
  const staged = f.git('diff', '--cached', '--name-only').split('\n');
  assert.ok(staged.includes('ordinary.txt'));
  assert.ok(!staged.includes('AGENTS.md'));
  assert.throws(() => f.git('add', '--', 'AGENTS.md'));
  await assert.rejects(() => f.app.baseStage(['AGENTS.md']));
});

test('Layer stage and commit preserve base staging and the other Layer index bytes', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  await f.layer('scripts', 'scripts/debug.py');
  f.write('README.md', 'base staged\n');
  f.git('add', '--', 'README.md');
  const baseIndex = f.index();
  const main = f.git('rev-parse', 'main');
  const records = await f.app.list();
  const other = records.find(record => record.name === 'scripts')!;
  const otherIndexPath = path.join(f.app.dir, 'indexes', `${other.id}.index`);
  const otherIndex = readFileSync(otherIndexPath);
  f.write('AGENTS.md', 'changed ai\n');
  await f.app.add('ai', ['AGENTS.md']);
  await f.app.commit('ai', 'Independent AI change');
  await f.app.status();
  assert.equal(f.index(), baseIndex);
  assert.equal(f.git('rev-parse', 'main'), main);
  assert.deepEqual(readFileSync(otherIndexPath), otherIndex);
  assert.equal(f.git('show', ':README.md'), 'base staged');
});

test('a Layer commits exactly staged content and retains later disk edits', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'staged version\n');
  await f.app.add('ai', ['AGENTS.md']);
  f.write('AGENTS.md', 'later disk version\n');
  await f.app.commit('ai', 'Only staged version');
  assert.equal(f.git('show', 'layer/ai:AGENTS.md'), 'staged version');
  assert.equal(f.read('AGENTS.md'), 'later disk version\n');
  const status = await f.app.status();
  const ai = status.layers.find(record => record.name === 'ai')!;
  assert.equal(ai.staged.length, 0);
  assert.ok(changed(ai.unstaged, 'AGENTS.md'));
  assert.ok(!status.untracked.includes('README.md'));
});

test('a mixed-owner batch is rejected before any part gets staged', async t => {
  const f = await fixture(t);
  await f.layer('scripts', 'scripts/debug.py');
  f.write('new-script.py', 'print(1)\n');
  const old = f.git('rev-parse', 'layer/scripts');
  await assert.rejects(() => f.app.add('scripts', ['new-script.py', 'README.md']));
  const status = await f.app.status();
  assert.equal(status.layers.find(record => record.name === 'scripts')!.staged.length, 0);
  assert.ok(status.untracked.includes('new-script.py'));
  assert.equal(f.git('rev-parse', 'layer/scripts'), old);
});

test('new-file reservations survive unstage and reopening without leaking to base', async t => {
  const f = await fixture(t);
  await f.app.create('ai');
  await f.app.on('ai');
  f.write('novo arquivo á.txt', 'reserved bytes\n');
  await f.app.add('ai', ['novo arquivo á.txt']);
  await f.app.unstage('ai', ['novo arquivo á.txt']);
  const reopened = await GitLayers.open(f.root);
  const record = (await reopened.list()).find(item => item.name === 'ai')!;
  assert.ok(record.reservations.includes('novo arquivo á.txt'));
  await assert.rejects(() => reopened.baseStage(['novo arquivo á.txt']));
  f.git('add', '.');
  assert.ok(!f.git('diff', '--cached', '--name-only').includes('novo arquivo á.txt'));
  assert.equal(f.read('novo arquivo á.txt'), 'reserved bytes\n');
});

test('capture selects only newly appearing paths and ends after confirmation', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('preexisting.txt', 'must remain unowned\n');
  await f.app.captureStart('ai');
  f.write('preexisting.txt', 'existing path edited\n');
  f.write('captured.txt', 'capture me\n');
  f.write('README.md', 'base edited during capture\n');
  const review = await f.app.captureReview();
  assert.deepEqual(review.candidates.map(candidate => candidate.path), ['captured.txt']);
  await f.app.captureConfirm(['captured.txt']);
  f.write('after-session.txt', 'must remain unowned\n');
  const status = await f.app.status();
  assert.ok(changed(status.layers.find(item => item.name === 'ai')!.staged, 'captured.txt'));
  assert.ok(status.untracked.includes('preexisting.txt'));
  assert.ok(status.untracked.includes('after-session.txt'));
  assert.equal(f.read('preexisting.txt'), 'existing path edited\n');
});

test('capture cancellation preserves candidate bytes without assigning ownership', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  await f.app.captureStart('ai');
  f.write('cancelled.txt', 'preserved candidate\n');
  await f.app.captureCancel();
  assert.equal(f.read('cancelled.txt'), 'preserved candidate\n');
  const status = await f.app.status();
  assert.ok(status.untracked.includes('cancelled.txt'));
  assert.ok(!(await f.app.list())[0]!.reservations.includes('cancelled.txt'));
});

test('activation refuses preexisting untracked bytes even if identical', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md', 'identical\n');
  await f.app.off('ai');
  f.write('AGENTS.md', 'identical\n');
  const head = f.git('rev-parse', 'HEAD');
  await assert.rejects(() => f.app.on('ai'));
  assert.equal(f.read('AGENTS.md'), 'identical\n');
  assert.equal(f.git('rev-parse', 'HEAD'), head);
});

test('activation refuses an ignored preexisting file without overwriting it', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  await f.app.off('ai');
  f.write('.gitignore', 'AGENTS.md\n');
  await f.app.baseStage(['.gitignore']);
  await f.app.baseCommit('Base ignore');
  f.write('AGENTS.md', 'ignored precious bytes\n');
  await assert.rejects(() => f.app.on('ai'));
  assert.equal(f.read('AGENTS.md'), 'ignored precious bytes\n');
});

test('ignore negation blocks assignment and is not mistaken for effective exclusion', async t => {
  const f = await fixture(t);
  f.write('.gitignore', '!AGENTS.md\n');
  await f.app.baseStage(['.gitignore']);
  await f.app.baseCommit('Conflicting negation');
  await f.app.create('ai');
  await f.app.on('ai');
  f.write('AGENTS.md', 'do not lose\n');
  await assert.rejects(() => f.app.add('ai', ['AGENTS.md']));
  assert.equal(f.read('AGENTS.md'), 'do not lose\n');
  assert.equal(f.git('ls-tree', '-r', '--name-only', 'layer/ai'), '');
});

test('GL16 deactivation refuses pending changes and explicit discard restores committed state', async t => {
  const f = await fixture(t);
  await f.layer('scripts', 'scripts/a.py', 'original A\n');
  f.write('scripts/deleted.py', 'delete later\n');
  await f.app.add('scripts', ['scripts/deleted.py']);
  await f.app.commit('scripts', 'Second tracked file');
  f.write('scripts/a.py', 'staged A\n');
  await f.app.add('scripts', ['scripts/a.py']);
  f.write('scripts/a.py', 'unstaged A\n');
  unlinkSync(path.join(f.root, 'scripts/deleted.py'));
  f.write('scripts/new.py', 'new staged\n');
  await assert.rejects(()=>f.app.add('scripts',['scripts/new.py']),{code:'OWNERSHIP_AMBIGUOUS'});
  const review=await f.app.ownershipReview(),beforeDecision=await decisionSnapshot(f,['scripts/a.py','scripts/deleted.py','scripts/new.py']);
  await f.app.resolveOwnership({token:review.token,deleted:['scripts/deleted.py']});
  assert.deepEqual(await decisionSnapshot(f,['scripts/a.py','scripts/deleted.py','scripts/new.py']),beforeDecision);
  assert.equal((await f.app.files()).find(file=>file.path==='scripts/new.py')!.owner,null);
  await f.app.add('scripts', ['scripts/new.py']);
  await f.app.unstage('scripts', ['scripts/new.py']);
  await assert.rejects(() => f.app.off('scripts'));
  await assert.rejects(() => f.app.off('scripts', true), { code: 'AUTO_PARK_REMOVED' });
  assert.equal(f.read('scripts/a.py'), 'unstaged A\n');
  await f.app.deactivate('scripts', { discard: true });
  assert.equal(existsSync(path.join(f.root, 'scripts/a.py')), false);
  assert.equal((await f.app.list()).find(item => item.name === 'scripts')!.state, 'inactive');
  await f.app.on('scripts');
  assert.equal(f.read('scripts/a.py'), 'original A\n');
  assert.equal(existsSync(path.join(f.root, 'scripts/new.py')), false);
  assert.equal(f.read('scripts/deleted.py'), 'delete later\n');
  const record = (await f.app.status()).layers.find(item => item.name === 'scripts')!;
  assert.equal(record.staged.length, 0); assert.equal(record.unstaged.length, 0); assert.equal(record.reservations.length, 0);
  assert.equal(existsSync(path.join(f.app.dir, 'shelves')), false);

});

test('deactivation removes only Layer files in a shared directory', async t => {
  const f = await fixture(t);
  f.write('shared/base.txt', 'base owner\n');
  await f.app.baseStage(['shared/base.txt']);
  await f.app.baseCommit('Base shared directory');
  await f.layer('ai', 'shared/ai.txt');
  await f.app.off('ai');
  assert.equal(f.read('shared/base.txt'), 'base owner\n');
  assert.equal(existsSync(path.join(f.root, 'shared/ai.txt')), false);
});

test('deactivation prunes empty Layer directories and activation recreates them', async t => {
  const f = await fixture(t);
  await f.layer('scripts', 'scripts/nested/run.ps1', 'Write-Output original\n');
  const head = f.git('rev-parse', 'HEAD');
  const index = f.index();
  await f.app.off('scripts');
  assert.equal(existsSync(path.join(f.root, 'scripts')), false, 'Empty Layer ancestors must leave the physical workspace');
  assert.equal(f.index(), index);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  await f.app.on('scripts');
  assert.equal(f.read('scripts/nested/run.ps1'), 'Write-Output original\n');
  f.write('scripts/nested/run.ps1', 'Write-Output parked\n');
  await f.app.deactivate('scripts', { discard: true });
  assert.equal(existsSync(path.join(f.root, 'scripts')), false, 'Explicit discard must prune empty ancestors too');
  await f.app.on('scripts');
  assert.equal(f.read('scripts/nested/run.ps1'), 'Write-Output original\n');
});

test('deactivation prunes no Base directories, active Layer ancestors or local contents', async t => {
  const f = await fixture(t);
  f.write('base-head/base.txt', 'tracked in HEAD\n');
  f.write('.gitignore', 'ignored/local.txt\n');
  await f.app.baseStage(['base-head/base.txt', '.gitignore']);
  await f.app.baseCommit('Protected Base directories');
  await f.layer('other', 'other-shared/other.txt');
  await f.app.create('scripts'); await f.app.on('scripts');
  const paths = ['base-head/layer.txt', 'base-index/layer.txt', 'other-shared/layer.txt', 'local/layer.txt', 'ignored/layer.txt', 'local-empty/layer.txt', 'scripts/only.txt'];
  for (const p of paths) f.write(p, 'Layer content\n');
  await f.app.add('scripts', paths); await f.app.commit('scripts', 'Layer directories');
  f.write('base-index/base.txt', 'only in Base index\n');
  await f.app.baseStage(['base-index/base.txt']);
  unlinkSync(path.join(f.root, 'base-head/base.txt'));
  await f.app.baseStage(['base-head/base.txt']);
  unlinkSync(path.join(f.root, 'base-index/base.txt'));
  unlinkSync(path.join(f.root, 'other-shared/other.txt'));
  f.write('local/local.txt', 'untracked local bytes\n');
  f.write('ignored/local.txt', 'ignored local bytes\n');
  mkdirSync(path.join(f.root, 'local-empty/personal-empty'));
  mkdirSync(path.join(f.root, 'unrelated-empty'));
  const index = f.index();
  await assert.rejects(()=>f.app.off('scripts'),{code:'OWNERSHIP_AMBIGUOUS'});
  const review=await f.app.ownershipReview(),observedPaths=[...paths,'base-head/base.txt','base-index/base.txt','other-shared/other.txt','local/local.txt','ignored/local.txt'];
  const beforeDecision=await decisionSnapshot(f,observedPaths);
  await f.app.resolveOwnership({token:review.token,deleted:['other-shared/other.txt']});
  assert.deepEqual(await decisionSnapshot(f,observedPaths),beforeDecision);
  for(const file of ['local/local.txt','ignored/local.txt'])assert.equal((await f.app.files()).find(entry=>entry.path===file)!.owner,null);
  await f.app.off('scripts');
  for (const folder of ['base-head', 'base-index', 'other-shared', 'local', 'ignored', 'local-empty/personal-empty', 'unrelated-empty']) assert.equal(lstatSync(path.join(f.root, folder)).isDirectory(), true, `Preserve ${folder}`);
  assert.equal(f.read('local/local.txt'), 'untracked local bytes\n');
  assert.equal(f.read('ignored/local.txt'), 'ignored local bytes\n');
  assert.equal(existsSync(path.join(f.root, 'scripts')), false);
  assert.equal(f.index(), index);
  await f.app.deactivate('other', { discard: true });
  assert.equal(existsSync(path.join(f.root, 'other-shared')), false, 'The last active owner releases a shared empty directory');
});

test('deactivation directory pruning is recoverable after an interruption', async t => {
  const f = await fixture(t);
  await f.layer('scripts', 'scripts/nested/run.ps1', 'recoverable bytes\n');
  f.write('deleted-only/gone.txt', 'delete this file later\n');
  await f.app.add('scripts', ['deleted-only/gone.txt']); await f.app.commit('scripts', 'Deleted-only directory');
  unlinkSync(path.join(f.root, 'deleted-only/gone.txt'));
  process.env.GIT_LAYERS_FAILPOINT = 'after-deactivate-directories';
  await assert.rejects(() => f.app.deactivate('scripts', { discard: true }), { code: 'INJECTED_FAILURE' });
  delete process.env.GIT_LAYERS_FAILPOINT;
  assert.equal(existsSync(path.join(f.root, 'scripts')), false);
  assert.equal(existsSync(path.join(f.root, 'deleted-only')), false);
  const reopened = await GitLayers.open(f.root);
  await reopened.recover();
  assert.equal(f.read('scripts/nested/run.ps1'), 'recoverable bytes\n');
  assert.equal(lstatSync(path.join(f.root, 'deleted-only')).isDirectory(), true, 'Restore even a directory whose Layer file was already deleted');
  assert.equal(existsSync(path.join(f.root, 'deleted-only/gone.txt')), false);
  assert.equal((await reopened.list()).find(layer => layer.name === 'scripts')!.state, 'active');
  assert.equal((await reopened.doctor()).safe, true);
});

test('managed switch preserves dirty Layer state and rejects colliding branch', async t => {
  const f = await fixture(t);
  f.git('branch', 'dev');
  f.git('switch', '-c', 'collision-demo');
  f.write('scripts/debug.py', 'base collision\n');
  f.git('add', '--', 'scripts/debug.py');
  f.git('commit', '-m', 'Occupy Layer path');
  f.git('switch', 'main');
  await f.layer('scripts', 'scripts/debug.py');
  f.write('scripts/debug.py', 'dirty preserved\n');
  await f.app.switch('dev');
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), 'dev');
  assert.equal(f.read('scripts/debug.py'), 'dirty preserved\n');
  const index = f.index();
  await assert.rejects(() => f.app.switch('collision-demo'));
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), 'dev');
  assert.equal(f.read('scripts/debug.py'), 'dirty preserved\n');
  assert.equal(f.index(), index);
});

test('external Layer ref movement refuses commit without overwriting new ref or disk', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'user staged\n');
  await f.app.add('ai', ['AGENTS.md']);
  const old = f.git('rev-parse', 'layer/ai');
  const tree = f.git('rev-parse', 'layer/ai^{tree}');
  const external = f.git('commit-tree', tree, '-p', old, '-m', 'External ref change');
  f.git('update-ref', 'refs/heads/layer/ai', external, old);
  await assert.rejects(() => f.app.commit('ai', 'Must not overwrite'));
  assert.equal(f.git('rev-parse', 'layer/ai'), external);
  assert.equal(f.read('AGENTS.md'), 'user staged\n');
});

test('checkpoints retain staged blobs after reflog expiration and immediate garbage collection', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'unique staged content retained through aggressive GC\n');
  await f.app.add('ai', ['AGENTS.md']);
  f.write('AGENTS.md', 'later unstaged content\n');
  const record = (await f.app.list()).find(item => item.name === 'ai')!;
  assert.ok(f.git('rev-parse', `refs/git-layers/state/${record.id}`));
  f.git('reflog', 'expire', '--expire=now', '--all');
  f.git('gc', '--prune=now');
  await f.app.commit('ai', 'Staged survived GC');
  assert.equal(f.git('show', 'layer/ai:AGENTS.md'), 'unique staged content retained through aggressive GC');
  assert.equal(f.read('AGENTS.md'), 'later unstaged content\n');
  f.git('fsck', '--no-reflogs');
});

test('restore requires explicit confirmation and restores disk from index without unstage', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'staged recovery source\n');
  await f.app.add('ai', ['AGENTS.md']);
  f.write('AGENTS.md', 'discarded disk bytes\n');
  await assert.rejects(() => f.app.restore('ai', ['AGENTS.md']));
  assert.equal(f.read('AGENTS.md'), 'discarded disk bytes\n');
  await f.app.restore('ai', ['AGENTS.md'], true);
  assert.equal(f.read('AGENTS.md'), 'staged recovery source\n');
  assert.ok(changed((await f.app.status()).layers[0]!.staged, 'AGENTS.md'));
});

test('literal pathspec and ignore metacharacters do not stage neighboring files', async t => {
  const f = await fixture(t);
  await f.app.create('ai');
  await f.app.on('ai');
  const own = ['espaço á.txt', 'literal[1].txt', '!important.txt', '#hash.txt', '-option.txt'];
  for (const file of [...own, 'literal1.txt', 'unrelated.txt']) f.write(file, `${file}\n`);
  await f.app.add('ai', own);
  await f.app.commit('ai', 'Literal file names');
  const files = f.git('-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', 'layer/ai').split('\n');
  assert.deepEqual(files.sort(), [...own].sort());
  f.git('add', '.');
  const base = f.git('diff', '--cached', '--name-only');
  assert.ok(base.includes('literal1.txt'));
  assert.ok(base.includes('unrelated.txt'));
  assert.ok(!base.includes('literal[1].txt'));
});

test('binary, UTF-8, LF, CRLF and executable mode survive clean off/on', async t => {
  const f = await fixture(t);
  await f.app.create('data');
  await f.app.on('data');
  const samples: Record<string, Buffer> = {
    'data/lf.txt': Buffer.from('ação\nsegunda linha\n'),
    'data/crlf.txt': Buffer.from('ação\r\nsegunda linha\r\n'),
    'data/blob.bin': Buffer.from([0, 255, 128, 10, 13, 1, 0]),
    'data/run.sh': Buffer.from('#!/bin/sh\nprintf example\n'),
  };
  for (const [file, bytes] of Object.entries(samples)) f.write(file, bytes);
  chmodSync(path.join(f.root, 'data/run.sh'), 0o755);
  await f.app.add('data', Object.keys(samples));
  await f.app.commit('data', 'Mixed content');
  await f.app.off('data');
  for (const file of Object.keys(samples)) assert.equal(existsSync(path.join(f.root, file)), false, `Layer file remained after off: ${file}`);
  await f.app.on('data');
  for (const [file, bytes] of Object.entries(samples)) assert.deepEqual(readFileSync(path.join(f.root, file)), bytes, file);
  if (process.platform !== 'win32') assert.ok((lstatSync(path.join(f.root, 'data/run.sh')).mode & 0o111) !== 0);
});

test('symlink file and paths through symlink directories are never adopted', async t => {
  const f = await fixture(t);
  await f.app.create('ai');
  await f.app.on('ai');
  f.write('outside.txt', 'outside target\n');
  try {
    symlinkSync('outside.txt', path.join(f.root, 'link.txt'));
    symlinkSync('src', path.join(f.root, 'linked-dir'), 'dir');
  } catch (error) {
    if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('Windows account cannot create symlinks; junction coverage runs separately.'); return; }
    throw error;
  }
  await assert.rejects(() => f.app.add('ai', ['link.txt']));
  await assert.rejects(() => f.app.add('ai', ['linked-dir/app.ts']));
  assert.equal(f.read('outside.txt'), 'outside target\n');
  assert.equal(f.git('ls-tree', '-r', '--name-only', 'layer/ai'), '');
});

test('base and Layer partial staging select one hunk and reject a stale token', async t => {
  const f = await fixture(t);
  const original = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
  f.write('many.txt', original);
  await f.app.baseStage(['many.txt']);
  await f.app.baseCommit('Many base lines');
  await f.layer('ai', 'layer-many.txt', original);
  for (const [owner, file] of [['base', 'many.txt'], ['ai', 'layer-many.txt']] as const) {
    f.write(file, original.replace('line 2\n', 'first changed\n').replace('line 28\n', 'second changed\n'));
    const diff = await f.app.diffHunks(owner, file);
    assert.equal(diff.hunks.length, 2);
    await f.app.partialStage(owner, file, 0, diff.token);
    const staged = owner === 'base' ? f.git('show', ':many.txt') : await f.app.diff('ai', true, [file]);
    assert.ok(staged.includes('first changed'));
    assert.ok(!staged.includes(owner === 'base' ? 'second changed' : '+second changed'));
    await assert.rejects(() => f.app.partialStage(owner, file, 1, diff.token));
    const stagedAfter = owner === 'base' ? f.git('show', ':many.txt') : await f.app.diff('ai', true, [file]);
    assert.equal(stagedAfter, staged);
  }
});

test('future metadata schema is refused without replacing the original file', async t => {
  const f = await fixture(t);
  const file = path.join(f.app.dir, 'registry.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  parsed.schema = 999;
  const bytes = JSON.stringify(parsed);
  writeFileSync(file, bytes);
  await assert.rejects(() => GitLayers.open(f.root));
  assert.equal(readFileSync(file, 'utf8'), bytes);
});

test('malformed metadata fails safely instead of reinitializing the registry', async t => {
  const f = await fixture(t);
  const file = path.join(f.app.dir, 'registry.json');
  writeFileSync(file, '{ definitely invalid JSON');
  await assert.rejects(() => GitLayers.open(f.root));
  assert.equal(readFileSync(file, 'utf8'), '{ definitely invalid JSON');
});

test('a crash after Layer ref advancement is recovered without a duplicate commit', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'commit survived crash\n');
  await f.app.add('ai', ['AGENTS.md']);
  const countBefore = Number(f.git('rev-list', '--count', 'layer/ai'));
  process.env.GIT_LAYERS_FAILPOINT = 'after-commit-ref';
  await assert.rejects(() => f.app.commit('ai', 'Recognize advanced ref'));
  delete process.env.GIT_LAYERS_FAILPOINT;
  assert.equal(Number(f.git('rev-list', '--count', 'layer/ai')), countBefore + 1);
  const committed = f.git('rev-parse', 'layer/ai');
  const reopened = await GitLayers.open(f.root);
  await reopened.recover();
  assert.equal(f.git('rev-parse', 'layer/ai'), committed);
  assert.equal(Number(f.git('rev-list', '--count', 'layer/ai')), countBefore + 1);
  assert.equal(f.git('show', 'layer/ai:AGENTS.md'), 'commit survived crash');
});

test('concurrent Core writers are serialized or one fails without corrupting refs', async t => {
  const f = await fixture(t);
  const other = await GitLayers.open(f.root);
  const results = await Promise.allSettled([f.app.create('one'), other.create('two')]);
  assert.ok(results.some(result => result.status === 'fulfilled'));
  const reopened = await GitLayers.open(f.root);
  const records = await reopened.list();
  for (const record of records) assert.equal(f.git('rev-parse', record.ref), record.oid);
  f.git('fsck', '--no-reflogs');
});

test('GL04 existing layer-prefixed branches are recognized without activation', async t => {
  const f = await fixture(t);
  const tree = f.git('mktree');
  const rootCommit = f.git('commit-tree', tree, '-m', 'Independent existing candidate');
  f.git('update-ref', 'refs/heads/layer/candidate', rootCommit);
  const reopened = await GitLayers.open(f.root);
  assert.ok((await reopened.list()).some(item => item.name === 'candidate' && item.state === 'inactive' && !item.id));
  await reopened.register('candidate');
  const candidate = (await reopened.list()).find(item => item.name === 'candidate')!;
  assert.equal(candidate.oid, rootCommit);
  assert.equal(candidate.state, 'inactive');
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), 'main');
});

test('an independent branch containing a base-owned file cannot be activated as a Layer', async t => {
  const f = await fixture(t);
  const rootCommit = f.git('commit-tree', f.git('rev-parse', 'main^{tree}'), '-m', 'Same bytes, another owner');
  f.git('update-ref', 'refs/heads/layer/conflict', rootCommit);
  const original = f.read('README.md');
  const baseIndex = f.index();
  await assert.rejects(async () => {
    await f.app.register('conflict');
    await f.app.on('conflict');
  });
  assert.equal(f.read('README.md'), original);
  assert.equal(f.index(), baseIndex);
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), 'main');
});

test('base ownership includes staged additions that have never been committed', async t => {
  const f = await fixture(t);
  f.write('base-new.txt', 'belongs to main index\n');
  f.git('add', '--', 'base-new.txt');
  await f.app.create('ai');
  await f.app.on('ai');
  const baseIndex = f.index();
  await assert.rejects(() => f.app.add('ai', ['base-new.txt']));
  assert.equal(f.index(), baseIndex);
  assert.equal(f.git('show', ':base-new.txt'), 'belongs to main index');
});

test('Layer control files are refused before changing their ownership', async t => {
  const f = await fixture(t);
  await f.app.create('ai');
  await f.app.on('ai');
  f.write('nested/.gitignore', '*.tmp\n');
  await assert.rejects(() => f.app.add('ai', ['nested/.gitignore']));
  assert.equal(f.read('nested/.gitignore'), '*.tmp\n');
  assert.equal(f.git('ls-tree', '-r', '--name-only', 'layer/ai'), '');
});

test('the local exclude block preserves preexisting rules outside it', async t => {
  const f = await fixture(t);
  const exclude = path.join(f.root, '.git', 'info', 'exclude');
  const original = '# User rule preserved verbatim\nuser-cache/\n\\#literal\n';
  writeFileSync(exclude, original);
  await f.layer('ai', 'AGENTS.md');
  assert.ok(readFileSync(exclude, 'utf8').includes(original));
  await f.app.off('ai');
  assert.ok(readFileSync(exclude, 'utf8').includes(original));
});

test('an existing coordinator lock is refused and never removed automatically', async t => {
  const f = await fixture(t);
  const lock = path.join(f.app.dir, 'locks', 'coordinator');
  mkdirSync(lock, { recursive: true });
  const evidence = path.join(lock, 'external-owner.txt');
  writeFileSync(evidence, 'Do not remove an existing lock');
  await assert.rejects(() => f.app.create('blocked'));
  assert.equal(readFileSync(evidence, 'utf8'), 'Do not remove an existing lock');
  assert.equal(f.git('show-ref', '--verify', '--quiet', 'refs/heads/main'), '');
});

test('empty Layer commit messages fail without advancing the ref', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'staged work\n');
  await f.app.add('ai', ['AGENTS.md']);
  const previous = f.git('rev-parse', 'layer/ai');
  await assert.rejects(() => f.app.commit('ai', '   '));
  assert.equal(f.git('rev-parse', 'layer/ai'), previous);
  assert.equal(f.read('AGENTS.md'), 'staged work\n');
});

test('required commit signing is explicitly refused for Layer plumbing', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'staged work\n');
  await f.app.add('ai', ['AGENTS.md']);
  f.git('config', '--local', 'commit.gpgsign', 'true');
  const previous = f.git('rev-parse', 'layer/ai');
  await assert.rejects(() => f.app.commit('ai', 'Cannot silently ignore required signing'));
  assert.equal(f.git('rev-parse', 'layer/ai'), previous);
});

for (const point of ['after-stage-index', 'after-stage-checkpoint']) {
  test(`stage failpoint ${point} leaves recoverable evidence and preserves later disk bytes`, async t => {
    const f = await fixture(t);
    await f.layer('ai', 'AGENTS.md');
    const previous = f.git('rev-parse', 'layer/ai');
    f.write('AGENTS.md', 'prepared before interruption\n');
    process.env.GIT_LAYERS_FAILPOINT = point;
    await assert.rejects(() => f.app.add('ai', ['AGENTS.md']));
    delete process.env.GIT_LAYERS_FAILPOINT;
    f.write('AGENTS.md', 'external edit after interruption\n');
    const reopened = await GitLayers.open(f.root);
    const report = await reopened.doctor();
    assert.equal(report.safe, false);
    assert.ok(report.transactions.length > 0);
    await reopened.recover();
    assert.equal(f.read('AGENTS.md'), 'external edit after interruption\n');
    assert.equal(f.git('rev-parse', 'layer/ai'), previous);
  });
}

for (const point of ['after-activate-files', 'after-deactivate-files']) {
  test(`projection failpoint ${point} never overwrites an edit made after interruption`, async t => {
    const f = await fixture(t);
    await f.layer('ai', 'AGENTS.md');
    if (point === 'after-activate-files') await f.app.off('ai');
    const baseHead = f.git('rev-parse', 'HEAD');
    const layerHead = f.git('rev-parse', 'layer/ai');
    process.env.GIT_LAYERS_FAILPOINT = point;
    await assert.rejects(() => point === 'after-activate-files' ? f.app.on('ai') : f.app.off('ai'));
    delete process.env.GIT_LAYERS_FAILPOINT;
    f.write('AGENTS.md', 'new work after interrupted projection\n');
    const reopened = await GitLayers.open(f.root);
    try { await reopened.recover(); }
    catch (error) { assert.match(String(error), /recover|recuper|mud|alter|conflict|posterior|rollback/i); }
    assert.equal(f.read('AGENTS.md'), 'new work after interrupted projection\n');
    assert.equal(f.git('rev-parse', 'HEAD'), baseHead);
    assert.equal(f.git('rev-parse', 'layer/ai'), layerHead);
    const report = await reopened.doctor();
    assert.equal(report.safe, false);
    assert.ok(report.transactions.length > 0);
  });
}

test('switch failpoint preserves the dirty Layer and permits conservative recovery', async t => {
  const f = await fixture(t);
  f.git('branch', 'dev');
  await f.layer('ai', 'AGENTS.md');
  f.write('AGENTS.md', 'staged before switch\n');
  await f.app.add('ai', ['AGENTS.md']);
  f.write('AGENTS.md', 'unstaged before switch\n');
  process.env.GIT_LAYERS_FAILPOINT = 'after-switch-head';
  await assert.rejects(() => f.app.switch('dev'));
  delete process.env.GIT_LAYERS_FAILPOINT;
  const reopened = await GitLayers.open(f.root);
  await reopened.recover();
  assert.equal(f.read('AGENTS.md'), 'unstaged before switch\n');
  const status = await reopened.status();
  const ai = status.layers.find(item => item.name === 'ai')!;
  assert.ok(changed(ai.staged, 'AGENTS.md'));
  assert.ok(changed(ai.unstaged, 'AGENTS.md'));
  const actualBranch = f.git('symbolic-ref', '--short', 'HEAD');
  assert.equal(actualBranch, 'dev');
  assert.equal(status.branch, actualBranch);
  assert.equal((await reopened.doctor()).safe, true);
});

test('activation refuses an untracked file occupying a required ancestor directory', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'nested/ai.txt');
  await f.app.off('ai');
  rmSync(path.join(f.root, 'nested'), { recursive: true, force: true });
  f.write('nested', 'untracked ancestor obstacle\n');
  await assert.rejects(() => f.app.on('ai'));
  assert.equal(f.read('nested'), 'untracked ancestor obstacle\n');
});

test('activation refuses a preexisting directory tree where its own file would go', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'tools');
  await f.app.off('ai');
  f.write('tools/precious.txt', 'do not recursively remove me\n');
  await assert.rejects(() => f.app.on('ai'));
  assert.equal(f.read('tools/precious.txt'), 'do not recursively remove me\n');
});

test('activation refuses preexisting case aliases without creating a second spelling', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AI.md');
  await f.app.off('ai');
  f.write('ai.md', 'case alias untracked bytes\n');
  await assert.rejects(() => f.app.on('ai'));
  assert.equal(f.read('ai.md'), 'case alias untracked bytes\n');
  if (process.platform === 'linux') assert.equal(existsSync(path.join(f.root, 'AI.md')), false);
});

test('activation refuses an empty directory alias in a required ancestor path', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'Config/settings.txt');
  await f.app.off('ai');
  rmSync(path.join(f.root, 'Config'), { recursive: true, force: true });
  mkdirSync(path.join(f.root, 'config'));
  await assert.rejects(() => f.app.on('ai'));
  assert.equal(lstatSync(path.join(f.root, 'config')).isDirectory(), true);
  if (process.platform === 'linux') assert.equal(existsSync(path.join(f.root, 'Config')), false);
});

test('partial unstage removes one staged hunk, preserves disk and refuses obsolete tokens', async t => {
  const f = await fixture(t);
  const original = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
  const edited = original.replace('line 2\n', 'first changed\n').replace('line 28\n', 'second changed\n');
  f.write('many.txt', original);
  await f.app.baseStage(['many.txt']);
  await f.app.baseCommit('Base multiline file');
  await f.layer('ai', 'layer-many.txt', original);
  for (const [owner, file] of [['base', 'many.txt'], ['ai', 'layer-many.txt']] as const) {
    f.write(file, edited);
    if (owner === 'base') await f.app.baseStage([file]);
    else await f.app.add(owner, [file]);
    const diff = await f.app.diffHunks(owner, file, true);
    assert.equal(diff.hunks.length, 2);
    await f.app.partialUnstage(owner, file, 0, diff.token);
    const staged = await f.app.diff(owner, true, [file]);
    assert.ok(!staged.includes('+first changed'));
    assert.ok(staged.includes('+second changed'));
    assert.equal(f.read(file), edited);
    await assert.rejects(() => f.app.partialUnstage(owner, file, 1, diff.token));
    assert.equal(await f.app.diff(owner, true, [file]), staged);
    assert.equal(f.read(file), edited);
  }
});

test('native text eol attributes normalize the blob and restore exact CRLF bytes', async t => {
  const f = await fixture(t);
  f.write('.gitattributes', '*.txt text eol=crlf\n');
  await f.app.baseStage(['.gitattributes']);
  await f.app.baseCommit('Native supported text transform');
  const bytes = Buffer.from('ação\r\nsegunda linha\r\n');
  await f.app.create('data');
  await f.app.on('data');
  f.write('content.txt', bytes);
  await f.app.add('data', ['content.txt']);
  await f.app.commit('data', 'CRLF source, normalized object');
  const object = execFileSync('git', ['-C', f.root, 'show', 'layer/data:content.txt'], { env: process.env });
  assert.deepEqual(object, Buffer.from('ação\nsegunda linha\n'));
  await f.app.off('data');
  assert.equal(existsSync(path.join(f.root, 'content.txt')), false, JSON.stringify({layers:await f.app.list(),status:await f.app.status()}));
  await f.app.on('data');
  assert.deepEqual(readFileSync(path.join(f.root, 'content.txt')), bytes);
});

test('release explicitly removes only a never-committed unstaged reservation', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('reservation.txt', 'keep physical bytes\n');
  await f.app.add('ai', ['reservation.txt']);
  await assert.rejects(() => f.app.release('ai', ['reservation.txt']));
  await f.app.unstage('ai', ['reservation.txt']);
  await f.app.release('ai', ['reservation.txt']);
  assert.equal(f.read('reservation.txt'), 'keep physical bytes\n');
  assert.ok((await f.app.status()).untracked.includes('reservation.txt'));
  await assert.rejects(() => f.app.release('ai', ['AGENTS.md']));
});

test('forced native addition demonstrates the protection limit and is diagnosed', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  const main = f.git('rev-parse', 'main');
  f.git('add', '-f', '--', 'AGENTS.md');
  assert.equal(f.git('show', ':AGENTS.md'), 'ai original');
  assert.equal((await f.app.status()).safe, false);
  assert.equal((await f.app.doctor()).safe, false);
  await assert.rejects(() => f.app.baseCommit('Must not commit contaminated index'));
  assert.equal(f.git('rev-parse', 'main'), main);
});

test('a later ignore negation marks the active composition unsafe before the next mutation', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  f.write('.gitignore', '\n!AGENTS.md\n');
  f.write('AGENTS.md', 'edit kept while ignore protection is unsafe\n');
  const layerRef = f.git('rev-parse', 'layer/ai');
  const index = f.index();
  assert.equal((await f.app.status()).safe, false);
  assert.equal((await f.app.doctor()).safe, false);
  await assert.rejects(() => f.app.add('ai', ['AGENTS.md']));
  assert.equal(f.git('rev-parse', 'layer/ai'), layerRef);
  assert.equal(f.index(), index);
  assert.equal(f.read('AGENTS.md'), 'edit kept while ignore protection is unsafe\n');
  unlinkSync(path.join(f.root, '.gitignore'));
  assert.equal((await f.app.status()).safe, true);
});

test('Layer root creation and stage checkpoints need no personal identity but user commits do', async t => {
  const f = await fixture(t);
  f.git('config', '--local', '--unset', 'user.name');
  f.git('config', '--local', '--unset', 'user.email');
  f.git('config', '--local', 'user.useConfigOnly', 'true');
  const main = f.git('rev-parse', 'main');
  const index = f.index();
  await f.app.create('no-identity');
  await f.app.on('no-identity');
  f.write('staged-without-identity.txt', 'stage does not need an author\n');
  await f.app.add('no-identity', ['staged-without-identity.txt']);
  const record = (await f.app.list()).find(item => item.name === 'no-identity')!;
  assert.ok(f.git('rev-parse', `refs/git-layers/state/${record.id}`));
  assert.ok(changed((await f.app.status()).layers[0]!.staged, 'staged-without-identity.txt'));
  await assert.rejects(() => f.app.commit('no-identity', 'A user commit needs explicit identity'));
  assert.equal(f.git('rev-parse', record.ref), record.oid);
  assert.equal(f.git('rev-parse', 'main'), main);
  assert.equal(f.index(), index);
  assert.equal(f.read('staged-without-identity.txt'), 'stage does not need an author\n');
});

test('future reservation metadata schema aborts mutation and preserves its exact bytes', async t => {
  const f = await fixture(t);
  await f.layer('ai', 'AGENTS.md');
  const record = (await f.app.list()).find(item => item.name === 'ai')!;
  const file = path.join(f.app.dir, 'reservations', `${record.id}.json`);
  const original = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  original.schema = 999;
  const bytes = JSON.stringify(original);
  writeFileSync(file, bytes);
  f.write('AGENTS.md', 'new work after corrupt reservation metadata\n');
  await assert.rejects(() => f.app.add('ai', ['AGENTS.md']));
  assert.equal(readFileSync(file, 'utf8'), bytes);
  assert.equal(f.git('rev-parse', record.ref), record.oid);
  assert.equal(f.read('AGENTS.md'), 'new work after corrupt reservation metadata\n');
});

test('reserved Layer name base cannot redirect a Layer commit to the traditional branch', async t => {
  const f = await fixture(t);
  const before = f.git('rev-parse', 'HEAD');
  const index = f.index();
  await assert.rejects(() => f.app.create('base'));
  await assert.rejects(() => f.app.create('BASE'));
  assert.deepEqual(await f.app.list(), []);
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.equal(f.index(), index);
  assert.equal(f.git('for-each-ref', '--format=%(refname)', 'refs/heads/layer/'), '');
  f.write('ordinary.txt', 'explicit base staging\n');
  await f.app.baseStage(['ordinary.txt']);
  const stagedIndex = f.index();
  await assert.rejects(() => f.app.commit('base', 'Must not silently commit the base'));
  await assert.rejects(() => f.app.unstage('base', ['ordinary.txt']));
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.equal(f.index(), stagedIndex);
});
