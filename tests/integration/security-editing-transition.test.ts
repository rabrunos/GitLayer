import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const evidenceRoot = process.env.GL_EDITING_TRANSITION_EVIDENCE;
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-editing-transition');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const events: unknown[] = [];
  const git = (args: string[], index?: string) => {
    const stdout = cp.execFileSync(officialGit, args, { cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    events.push({ kind: 'git', executable: officialGit, args, code: 0, index: index ? path.basename(index) : 'main', stdout });
    return stdout.trimEnd();
  };
  const write = (file: string, bytes: string) => { const destination = path.join(repo, file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes); };
  const read = (file: string) => fs.readFileSync(path.join(repo, file), 'utf8');
  const external = (script: string, args: string[]) => {
    const result = cp.spawnSync(process.execPath, ['-e', script, ...args], { cwd: repo, env, encoding: 'utf8', windowsHide: true });
    events.push({ kind: 'external-process', executable: process.execPath, script, args, code: result.status, stderr: result.stderr });
    assert.equal(result.status, 0, result.stderr);
  };
  const externalWrite = (file: string, bytes: string) => external("require('node:fs').writeFileSync(process.argv[1], process.argv[2])", [path.isAbsolute(file) ? file : path.join(repo, file), bytes]);
  git(['init', '-b', 'main']); git(['config', 'core.autocrlf', 'false']);
  git(['config', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null']);
  write('base.txt', 'tracked base sentinel\n'); git(['add', '--', 'base.txt']); git(['commit', '-m', 'base']);
  let app = await GitLayers.init(repo);
  for (const name of ['a', 'b']) { await app.create(name); await app.on(name); }
  const workspace = () => JSON.parse(fs.readFileSync(path.join(app.dir, 'workspace.json'), 'utf8'));
  const domain = () => {
    const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
    return {
      head: git(['rev-parse', 'HEAD']), symbolic: git(['symbolic-ref', 'HEAD']),
      refs: git(['for-each-ref', '--format=%(refname) %(objectname)']), mainIndex: git(['ls-files', '--stage']),
      layerIndexes: Object.fromEntries(registry.layers.map((layer: any) => [layer.name, git(['ls-files', '--stage'], path.join(app.dir, 'indexes', layer.id + '.index'))])),
    };
  };
  const record = (label: string, value: unknown) => events.push({ kind: 'observation', label, value });
  const reopen = async () => { app = await GitLayers.open(repo); return app; };
  const coherent = () => {
    const editing = workspace().editing;
    assert(editing && Array.isArray(editing.before) && Array.isArray(editing.unassigned));
    assert.equal(new Set(editing.before).size, editing.before.length);
    assert.equal(new Set(editing.unassigned).size, editing.unassigned.length);
    assert(editing.unassigned.every((file: string) => editing.before.includes(file)), 'Published unassigned is a subset of before');
    return editing;
  };
  t.after(() => {
    try {
      if (evidenceRoot) {
        fs.mkdirSync(evidenceRoot, { recursive: true });
        fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/gu, '_') + '.json'), JSON.stringify({ test: t.name, fixture: owned.root, officialGit, version: git(['--version']), node: process.version, platform: process.platform, finalDomain: domain(), workspace: workspace(), events }, null, 2) + '\n');
      }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
      if (!evidenceRoot) { if (process.env.GL_SECURITY_KEEP_FIXTURES === '1' || process.env.GL_STAGE2_PRESERVE_FIXTURES === '1') t.diagnostic(JSON.stringify({ kind: 'fixture-cleanup-skipped', test: t.name, root: owned.root, nonce: owned.nonce, cleanupSkipped: true, policy: 'GL_SECURITY_KEEP_FIXTURES=1 or GL_STAGE2_PRESERVE_FIXTURES=1; original owned fixture location; current filesystem state not reverified here' })); else cleanupFixture(owned); }
    }
  });
  return { get app() { return app; }, repo, env, write, read, git, domain, workspace, coherent, external, externalWrite, record, reopen };
}

/** Test-only scheduling barriers delegate native operations and always restore APIs. */
async function atIgnore<T>(repo: string, action: (invocation: number) => void, fn: () => Promise<T>) {
  const original = cp.spawn; let invocations = 0, sawContext = false;
  cp.spawn = function (executable: any, args: any, options: any) {
    if (options?.cwd === repo && Array.isArray(args)) {
      if (args.includes('for-each-ref') && args.includes('--format=%(refname)%00%(objectname)%00%(symref)')) sawContext = true;
      if (sawContext && args.includes('ls-files') && args.includes('--others')) action(++invocations);
    }
    return (original as any).call(this, executable, args, options);
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  try { const value = await fn(); return { value, invocations, sawContext }; }
  finally { cp.spawn = original; syncBuiltinESMExports(); }
}

async function atExclude<T>(exclude: string, action: (temporary: string) => void, fn: () => Promise<T>) {
  const original = fs.promises.rename;
  fs.promises.rename = async function (from, to) {
    if (path.resolve(String(to)) === path.resolve(exclude)) action(String(from));
    return original.call(this, from, to);
  };
  syncBuiltinESMExports();
  try { return await fn(); }
  finally { fs.promises.rename = original; syncBuiltinESMExports(); }
}

test('D02 Core target retries a real creation between walk and native ignore and reopens coherent metadata', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'existing unassigned\n');
  const before = f.domain(); let fired = false;
  const result = await atIgnore(f.repo, invocation => {
    if (invocation === 1) { fired = true; f.externalWrite('between.txt', 'external between scans\n'); }
  }, () => f.app.target('a'));
  assert(fired, 'The external writer must actually execute at the native ignore boundary');
  assert(result.invocations >= 2, 'The changed path scan requires a fresh capture');
  assert.equal(result.value.target, 'a'); const editing = f.coherent();
  assert(editing.before.includes('between.txt') && editing.unassigned.includes('between.txt'));
  assert.deepEqual(f.domain(), before); assert.equal(f.read('between.txt'), 'external between scans\n');
  await f.reopen(); const status = await f.app.status(); assert.equal(status.safe, true);
  assert(!status.layers.some(layer => layer.reservations.includes('between.txt')));
  f.record('target creation boundary', { fired, invocations: result.invocations, editing, status });
});

test('D02 Core target retries an external rename of a preexisting unowned file without assigning it', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'unowned rename bytes\n');
  const before = f.domain(); let fired = false;
  await atIgnore(f.repo, invocation => {
    if (invocation === 1) { fired = true; f.external("require('node:fs').renameSync(process.argv[1], process.argv[2])", [path.join(f.repo, 'old.txt'), path.join(f.repo, 'renamed.txt')]); }
  }, () => f.app.target('a'));
  assert(fired); const editing = f.coherent();
  assert(!editing.before.includes('old.txt')); assert(editing.before.includes('renamed.txt'));
  assert(editing.unassigned.includes('renamed.txt')); assert.equal(f.read('renamed.txt'), 'unowned rename bytes\n');
  assert.deepEqual(f.domain(), before); await f.reopen(); const status = await f.app.status(); assert.equal(status.safe, true);
  assert(!status.layers.some(layer => layer.reservations.includes('renamed.txt')));
  f.record('renamed before boundary publication', { fired, editing, status });
});

test('D02 Core target change reconciles the old target before capturing a coherent new boundary', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'existing unassigned\n'); await f.app.target('a');
  f.write('during-a.txt', 'created under target a\n'); const before = f.domain(); let fired = false;
  const result = await atIgnore(f.repo, invocation => {
    // Ignore refreshes for a may precede capture. The context marker anchors b.
    if (invocation === 1) { fired = true; f.externalWrite('between-targets.txt', 'created during b capture\n'); }
  }, () => f.app.target('b'));
  assert(result.sawContext, 'The helper capture context must precede the injection');
  assert(fired, 'The writer must execute during capture after reconciliation of a');
  assert.equal(result.value.target, 'b'); const editing = f.coherent(); assert(editing.before.includes('between-targets.txt'));
  assert(editing.unassigned.includes('between-targets.txt')); assert.deepEqual(f.domain(), before);
  f.write('during-b.txt', 'created under target b\n'); await f.reopen(); const status = await f.app.status(); assert.equal(status.safe, true);
  const a = status.layers.find(layer => layer.name === 'a')!, b = status.layers.find(layer => layer.name === 'b')!;
  assert(a.reservations.includes('during-a.txt')); assert(!b.reservations.includes('during-a.txt'));
  assert(b.reservations.includes('during-b.txt')); assert(!a.reservations.includes('during-b.txt'));
  assert(!status.layers.some(layer => layer.reservations.includes('between-targets.txt')));
  f.record('target change boundary', { fired, sawContext: result.sawContext, invocations: result.invocations, editing, status });
});

for (const mutation of ['global-ignore', 'main-index'] as const) test(`D02 Core refuses ${mutation} changed after capture before publication and preserves the previous target`, { timeout: 900000 }, async t => {
  const f = await fixture(t), globalFile = path.join(f.env.HOME!, 'transition-ignore');
  fs.writeFileSync(globalFile, '# old global rules\n'); f.git(['config', 'core.excludesFile', globalFile]);
  f.write('old.txt', 'unassigned before targets\n'); await f.app.target('a');
  const before = f.domain(), oldWorkspace = f.workspace(), oldExclude = fs.readFileSync(f.app.repo.exclude, 'utf8');
  let fired = false, externalIndex: string | undefined;
  await assert.rejects(atExclude(f.app.repo.exclude, () => {
    if (fired) return;
    fired = true;
    if (mutation === 'global-ignore') f.externalWrite(globalFile, '*.new-rule\n');
    else {
      f.external("const cp=require('node:child_process');cp.execFileSync(process.argv[1], ['add','--','old.txt'], {cwd:process.argv[2],env:process.env,windowsHide:true})", [officialGit, f.repo]);
      externalIndex = f.git(['ls-files', '--stage']);
    }
  }, () => f.app.target('b')), { code: 'EDITING_BOUNDARY_CHANGED' });
  assert(fired, 'The mutation must occur after capture during exclude publication');
  assert.deepEqual(f.workspace(), oldWorkspace, 'A refused transition preserves the previous persisted editing context');
  assert.equal(fs.readFileSync(f.app.repo.exclude, 'utf8'), oldExclude);
  const after = f.domain();
  assert.equal(after.head, before.head); assert.equal(after.symbolic, before.symbolic);
  const beforeRefs = new Map(before.refs.split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
  const afterRefs = new Map(after.refs.split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
  for (const [ref, oid] of beforeRefs) assert.equal(afterRefs.get(ref), oid, 'Every preexisting ref and checkpoint is preserved');
  const checkpointOids = new Set([...beforeRefs].filter(([ref]) => ref.startsWith('refs/git-layers/state/')).map(([, oid]) => oid));
  for (const [ref, oid] of afterRefs) if (!beforeRefs.has(ref)) {
    // Conservative rollback retains technical refs to the existing checkpoints.
    assert(/^refs\/git-layers\/transactions\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/u.test(ref));
    assert(checkpointOids.has(oid), 'New recovery retention refs cannot introduce another history');
  }
  assert.deepEqual(after.layerIndexes, before.layerIndexes);
  if (mutation === 'global-ignore') { assert.equal(fs.readFileSync(globalFile, 'utf8'), '*.new-rule\n'); assert.equal(after.mainIndex, before.mainIndex); }
  else { assert.equal(after.mainIndex, externalIndex); assert.equal(f.git(['show', ':old.txt']), 'unassigned before targets'); }
  assert.equal(f.read('old.txt'), 'unassigned before targets\n'); await f.reopen(); const status = await f.app.status();
  assert.equal(status.safe, true); assert.equal(status.editingTarget, 'a'); f.coherent();
  f.record('aborted publication preserves external mutation', { fired, mutation, before, after, oldWorkspace, status });
});

test('D02 Core edit-end uses the final reconciliation as its boundary and preserves later ordinary creations', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.app.target('a'); f.write('before-end.txt', 'created before final reconciliation\n');
  const before = f.domain(); let fired = false;
  await atExclude(f.app.repo.exclude, temporary => {
    if (!fired && !fs.readFileSync(temporary, 'utf8').includes('\n/**\n')) {
      fired = true; f.externalWrite('after-end.txt', 'created after final reconciliation\n');
    }
  }, () => f.app.target());
  assert(fired, 'The late writer must execute after target removal and before exclude publication');
  assert.equal(f.workspace().editing, undefined); assert.deepEqual(f.domain(), before);
  await f.reopen(); const status = await f.app.status(); assert.equal(status.safe, true); assert.equal(status.editingTarget, null);
  assert(status.layers.find(layer => layer.name === 'a')!.reservations.includes('before-end.txt'));
  assert(!status.layers.some(layer => layer.reservations.includes('after-end.txt')));
  assert(status.untracked.includes('after-end.txt')); assert.equal(f.read('after-end.txt'), 'created after final reconciliation\n');
  f.git(['add', '-A']); assert.equal(f.git(['diff', '--cached', '--name-only']), 'after-end.txt');
  f.record('edit-end linearization', { fired, status, mainStage: f.git(['ls-files', '--stage']), scope: 'The last successful reconciliation is the boundary; creations after it can follow base even before the response.' });
});

test('P1 Core status refuses a real user info-exclude edit during exemption evaluation and preserves the external policy', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'preexisting unowned bytes\n'); await f.app.target('a');
  const before = f.domain(), beforeWorkspace = f.workspace(), beforeRaw = fs.readFileSync(f.app.repo.exclude, 'utf8');
  const appended = '\n# external user B\n/old.txt\n'; let fired = false, externalRaw = '';
  const original = cp.spawn;
  cp.spawn = function (executable: any, args: any, options: any) {
    // This status has no fresh candidates: its first ignore query evaluates
    // existing exemptions. It does not enter captureEditingBoundary.
    if (!fired && options?.cwd === f.repo && Array.isArray(args) && args.includes('ls-files') && args.includes('--others') && args.includes('--ignored')) {
      fired = true;
      f.external("require('node:fs').appendFileSync(process.argv[1], process.argv[2])", [f.app.repo.exclude, appended]);
      externalRaw = fs.readFileSync(f.app.repo.exclude, 'utf8');
    }
    return (original as any).call(this, executable, args, options);
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  let refused: Awaited<ReturnType<GitLayers['status']>>;
  try { refused = await f.app.status(); }
  finally { cp.spawn = original; syncBuiltinESMExports(); }
  assert(fired, 'A real external writer must append user rules after clean was read and during native exemption evaluation');
  assert.equal(externalRaw, beforeRaw + appended); assert.equal(refused.safe, false); assert.equal(refused.error?.code, 'EXTERNAL_EDIT');
  assert.equal(fs.readFileSync(f.app.repo.exclude, 'utf8'), externalRaw, 'Refusal must preserve every external byte, including the managed block still present');
  assert.deepEqual(f.workspace(), beforeWorkspace); assert.equal(f.read('old.txt'), 'preexisting unowned bytes\n'); assert.equal(f.read('base.txt'), 'tracked base sentinel\n');
  const after = f.domain(); assert.equal(after.head, before.head); assert.equal(after.symbolic, before.symbolic);
  assert.equal(after.mainIndex, before.mainIndex); assert.deepEqual(after.layerIndexes, before.layerIndexes);
  const beforeRefs = new Map(before.refs.split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
  const afterRefs = new Map(after.refs.split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
  for (const [ref, oid] of beforeRefs) assert.equal(afterRefs.get(ref), oid);
  const checkpointOids = new Set([...beforeRefs].filter(([ref]) => ref.startsWith('refs/git-layers/state/')).map(([, oid]) => oid));
  for (const [ref, oid] of afterRefs) if (!beforeRefs.has(ref)) {
    assert(/^refs\/git-layers\/transactions\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/u.test(ref)); assert(checkpointOids.has(oid));
  }
  const reconciled = await f.app.status(); assert.equal(reconciled.safe, true); assert.equal(reconciled.editingTarget, 'a');
  assert(fs.readFileSync(f.app.repo.exclude, 'utf8').includes(appended)); assert.equal(f.git(['check-ignore', '--no-index', '--', 'old.txt']), 'old.txt');
  assert(!reconciled.layers.some(layer => layer.reservations.includes('old.txt')));
  await f.reopen(); const reopened = await f.app.status(); assert.equal(reopened.safe, true); assert.equal(reopened.editingTarget, 'a');
  const editing = f.coherent(); assert.deepEqual(editing.before, beforeWorkspace.editing.before); assert.deepEqual(editing.unassigned, beforeWorkspace.editing.unassigned);
  const final = f.domain(); assert.equal(final.head, before.head); assert.equal(final.symbolic, before.symbolic); assert.equal(final.mainIndex, before.mainIndex); assert.deepEqual(final.layerIndexes, before.layerIndexes);
  assert.equal(f.read('old.txt'), 'preexisting unowned bytes\n'); assert.equal(f.read('base.txt'), 'tracked base sentinel\n');
  f.record('user info-exclude CAS refusal and subsequent reconciliation', { fired, before, beforeWorkspace, beforeRaw, externalRaw, refused, after, reconciled, reopened, editing, final });
});


async function ownedFrontierFixture(t: TestContext) {
  const f = await fixture(t);
  f.write('known.txt', 'a A committed\n'); await f.app.add('a', ['known.txt']); await f.app.commit('a', 'seed known a');
  f.write('known.txt', 'a B staged\n'); await f.app.add('a', ['known.txt']); f.write('known.txt', 'a C disk\n');
  f.write('preexistingunowned.txt', 'preexisting independent bytes\n');
  const registry = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8'));
  const aIndex = path.join(f.app.dir, 'indexes', registry.layers.find((l: any) => l.name === 'a').id + '.index');
  const bytes = () => ({ main: hash(fs.readFileSync(f.app.repo.index)), a: hash(fs.readFileSync(aIndex)) });
  return { ...f, get app() { return f.app; }, aIndex, bytes };
}
const ownershipOrBoundary = (error: any) => ['OWNERSHIP_AMBIGUOUS', 'EDITING_BOUNDARY_CHANGED'].includes(error.code);
const frontierJournals = (f: Awaited<ReturnType<typeof fixture>>) => new Set(fs.readdirSync(path.join(f.app.dir, 'transactions')));
/** Refusal can retain the previous checkpoint under a new technical journal ref. */
function frontierDomainPreserved(f: Awaited<ReturnType<typeof fixture>>, before: ReturnType<typeof f.domain>, previousJournals: Set<string>) {
  const after = f.domain();
  const parse = (refs: string) => new Map(refs.split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
  const oldRefs = parse(before.refs), newRefs = parse(after.refs), retained: unknown[] = [];
  for (const [ref, oid] of oldRefs) assert.equal(newRefs.get(ref), oid, 'Every previous ref is present with exactly its previous OID');
  for (const [ref, oid] of newRefs) if (!oldRefs.has(ref)) {
    const match = /^refs\/git-layers\/transactions\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/u.exec(ref);
    assert(match, 'No unknown ref may appear during refusal');
    const [, transaction, layer] = match;
    assert(!previousJournals.has(transaction!), 'Retention belongs to a new journal from these operations');
    const journal = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'transactions', transaction!, 'journal.json'), 'utf8'));
    assert.equal(journal.id, transaction); assert.equal(journal.state, 'completed');
    assert(journal.recovery.beforeRegistry.layers.some((entry: any) => entry.id === layer));
    assert(journal.steps.some((step: any) => step.step === 'failed') && journal.steps.some((step: any) => step.step === 'completed'));
    assert(['OWNERSHIP_AMBIGUOUS', 'EDITING_BOUNDARY_CHANGED', 'OWNERSHIP_SELECTION', 'OWNERSHIP'].includes(journal.error?.code));
    assert.equal(oid, oldRefs.get('refs/git-layers/state/' + layer), 'The retained OID is the previous checkpoint of this exact Layer');
    assert.equal(f.git(['cat-file', '-t', oid]), 'tree');
    assert.equal(f.git(['for-each-ref', '--format=%(symref)', ref]), '', 'Retention is a direct ref');
    retained.push({ ref, oid, transaction, layer, error: journal.error.code });
  }
  assert.deepEqual({ ...after, refs: before.refs }, before, 'HEAD and every semantic index remain identical');
  f.record('verified conservative checkpoint retention', { before: before.refs, after: after.refs, retained });
}


// These barriers delegate the real operations. Core results are corroborated by
// official Git, raw indices, refs, exact B/C bytes and persisted workspace JSON.
test('D01 target retry cannot absorb a real owned Layer rename into the preexisting frontier', { timeout: 900000 }, async t => {
  const f = await ownedFrontierFixture(t), before = f.domain(), prior = f.workspace(), raw = f.bytes(), previousJournals = frontierJournals(f); let fired = false;
  await assert.rejects(atIgnore(f.repo, invocation => {
    if (invocation === 1) { fired = true; f.external("require('node:fs').renameSync(process.argv[1],process.argv[2])", [path.join(f.repo, 'known.txt'), path.join(f.repo, 'moved.txt')]); }
  }, () => f.app.target('b')), ownershipOrBoundary);
  assert(fired, 'Real writer must execute within capture'); assert.deepEqual(f.workspace(), prior); frontierDomainPreserved(f, before, previousJournals); assert.deepEqual(f.bytes(), raw);
  assert.equal(f.read('moved.txt'), 'a C disk\n'); assert.equal(fs.existsSync(path.join(f.repo, 'known.txt')), false);
  await f.reopen(); assert.equal((await f.app.status()).safe, false);
  for (const op of [() => f.app.add('b', ['moved.txt']), () => f.app.commit('b', 'must refuse'), () => f.app.deactivate('b', { discard: true })]) await assert.rejects(op(), { code: 'OWNERSHIP_AMBIGUOUS' });
  frontierDomainPreserved(f, before, previousJournals); assert.deepEqual(f.bytes(), raw); assert.equal(f.git(['show', ':known.txt'], f.aIndex), 'a B staged');
  const review = await f.app.ownershipReview(); assert(review.candidates.includes('moved.txt')); await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'known.txt', to: 'moved.txt' }] });
  frontierDomainPreserved(f, before, previousJournals); assert.deepEqual(f.bytes(), raw); assert.equal((await f.app.files()).find(p => p.path === 'moved.txt')!.owner, 'a');
  await f.app.deactivate('b', { discard: true }); assert.equal(f.read('moved.txt'), 'a C disk\n'); assert.equal(f.git(['show', ':known.txt'], f.aIndex), 'a B staged');
  await f.app.add('a', ['known.txt', 'moved.txt']); await f.app.commit('a', 'resolved rename in a');
  assert.equal(f.git(['show', 'layer/a:moved.txt']), 'a C disk'); assert.equal(f.git(['ls-tree', 'layer/a', '--', 'known.txt']), '');
  assert.equal(f.git(['rev-parse', 'HEAD']), before.head); assert.equal(f.git(['ls-files', '--stage']), before.mainIndex); assert.equal(f.read('moved.txt'), 'a C disk\n');
  f.record('owned retry refusal and explicit original-origin recovery', { fired, review, before, after: f.domain(), workspace: f.workspace() });
});

test('D01 target retry preserves a renamed base origin and refuses a new foreign Layer claim', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('base.txt', 'base B staged\n'); f.git(['add', '--', 'base.txt']); f.write('base.txt', 'base C disk\n'); f.write('preexisting.txt', 'independent\n');
  const before = f.domain(), prior = f.workspace(), raw = hash(fs.readFileSync(f.app.repo.index)), previousJournals = frontierJournals(f); let fired = false;
  await assert.rejects(atIgnore(f.repo, invocation => { if (invocation === 1) { fired = true; f.external("require('node:fs').renameSync(process.argv[1],process.argv[2])", [path.join(f.repo, 'base.txt'), path.join(f.repo, 'moved-base.txt')]); } }, () => f.app.target('b')), ownershipOrBoundary);
  assert(fired); assert.deepEqual(f.workspace(), prior); frontierDomainPreserved(f, before, previousJournals); assert.equal(hash(fs.readFileSync(f.app.repo.index)), raw);
  await assert.rejects(f.app.add('b', ['moved-base.txt']), { code: 'OWNERSHIP_AMBIGUOUS' }); assert.equal(f.read('moved-base.txt'), 'base C disk\n'); assert.equal(f.git(['show', ':base.txt']), 'base B staged');
  const review = await f.app.ownershipReview(); assert(review.missing.some(m => m.path === 'base.txt' && m.owner === 'base'));
  await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'base.txt', to: 'moved-base.txt' }] });
  assert.equal((await f.app.files()).find(p => p.path === 'moved-base.txt')!.owner, 'base'); frontierDomainPreserved(f, before, previousJournals); assert.equal(hash(fs.readFileSync(f.app.repo.index)), raw);
  await f.app.deactivate('b', { discard: true }); assert.equal(f.read('moved-base.txt'), 'base C disk\n'); assert.equal(f.git(['show', ':base.txt']), 'base B staged');
  f.record('base retry refusal and original base ownership', { fired, review, before, after: f.domain(), workspace: f.workspace() });
});

test('D01 final target publication rechecks the old logical context without assigning interval files', { timeout: 900000 }, async t => {
  const f = await ownedFrontierFixture(t); await f.app.target('a'); const before = f.domain(), prior = f.workspace(), raw = f.bytes(), previousJournals = frontierJournals(f); let fired = false;
  await assert.rejects(atExclude(f.app.repo.exclude, () => {
    if (!fired && (f.app as any).workspace.editing?.layer === 'b') { fired = true; f.external("require('node:fs').renameSync(process.argv[1],process.argv[2])", [path.join(f.repo, 'known.txt'), path.join(f.repo, 'moved-at-publication.txt')]); }
  }, () => f.app.target('b')), ownershipOrBoundary);
  assert(fired, 'Writer must act after installing the in-memory new context'); assert.deepEqual(f.workspace(), prior); frontierDomainPreserved(f, before, previousJournals); assert.deepEqual(f.bytes(), raw); assert.equal(f.read('moved-at-publication.txt'), 'a C disk\n');
  await f.reopen(); await assert.rejects(f.app.add('b', ['moved-at-publication.txt']), { code: 'OWNERSHIP_AMBIGUOUS' }); await assert.rejects(f.app.deactivate('b', { discard: true }), { code: 'OWNERSHIP_AMBIGUOUS' });
  frontierDomainPreserved(f, before, previousJournals); assert.deepEqual(f.bytes(), raw); assert.equal(f.read('preexistingunowned.txt'), 'preexisting independent bytes\n');
  f.record('final publication refuses a real rename', { fired, before, after: f.domain(), workspace: f.workspace() });
});

test('D01 an external rename onto a preexisting unowned path stays ambiguous until an explicit origin decision', { timeout: 900000 }, async t => {
  const f = await ownedFrontierFixture(t); await f.app.target('b'); const before = f.domain(), raw = f.bytes(), previousJournals = frontierJournals(f);
  f.external("require('node:fs').renameSync(process.argv[1],process.argv[2])", [path.join(f.repo, 'known.txt'), path.join(f.repo, 'preexistingunowned.txt')]);
  assert.equal(f.read('preexistingunowned.txt'), 'a C disk\n'); assert.equal((await f.app.status()).safe, false);
  await assert.rejects(f.app.add('b', ['preexistingunowned.txt']), { code: 'OWNERSHIP_AMBIGUOUS' }); await assert.rejects(f.app.commit('b', 'must refuse'), { code: 'OWNERSHIP_AMBIGUOUS' }); await assert.rejects(f.app.deactivate('b', { discard: true }), { code: 'OWNERSHIP_AMBIGUOUS' });
  frontierDomainPreserved(f, before, previousJournals); assert.deepEqual(f.bytes(), raw);
  const review = await f.app.ownershipReview(); assert(review.candidates.includes('preexistingunowned.txt'));
  await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'known.txt', to: 'preexistingunowned.txt' }] });
  assert.equal((await f.app.files()).find(p => p.path === 'preexistingunowned.txt')!.owner, 'a'); assert.deepEqual(f.bytes(), raw);
  await f.app.deactivate('b', { discard: true }); assert.equal(f.read('preexistingunowned.txt'), 'a C disk\n'); assert.equal(f.git(['show', ':known.txt'], f.aIndex), 'a B staged');
  f.record('external replacement is native; no later foreign claim is allowed', { review, before, after: f.domain(), workspace: f.workspace(), previousUnownedBytesDestroyedExternally: true });
});

test('D01 an owned rename staged natively before the first capture anchor cannot contaminate a managed base commit', { timeout: 900000 }, async t => {
  const f = await ownedFrontierFixture(t), before = f.domain(), prior = f.workspace(), original = (f.app as any).syncEditingInternal, previousJournals = frontierJournals(f); let fired = false, externalMain = '';
  (f.app as any).syncEditingInternal = async function (...args: any[]) {
    const value = await original.apply(this, args);
    if (!fired) { fired = true; f.external("require('node:fs').renameSync(process.argv[1],process.argv[2])", [path.join(f.repo, 'known.txt'), path.join(f.repo, 'staged-before-anchor.txt')]); f.git(['add', '-f', '--', 'staged-before-anchor.txt']); externalMain = hash(fs.readFileSync(f.app.repo.index)); }
    return value;
  };
  try { await assert.rejects(f.app.target('b'), { code: 'OWNERSHIP_AMBIGUOUS' }); }
  finally { (f.app as any).syncEditingInternal = original; }
  assert(fired); assert.deepEqual(f.workspace(), prior); assert.equal(hash(fs.readFileSync(f.app.repo.index)), externalMain); assert.equal(f.read('staged-before-anchor.txt'), 'a C disk\n'); assert.equal(f.git(['show', ':known.txt'], f.aIndex), 'a B staged');
  const beforeCommit = f.domain(), beforeCommitJournals = frontierJournals(f); await assert.rejects(f.app.baseCommit('must refuse mixed source'), { code: 'OWNERSHIP_AMBIGUOUS' }); frontierDomainPreserved(f, beforeCommit, beforeCommitJournals); assert.equal(hash(fs.readFileSync(f.app.repo.index)), externalMain);
  const review = await f.app.ownershipReview(); assert(review.candidates.includes('staged-before-anchor.txt')); await assert.rejects(f.app.resolveOwnership({ token: review.token, independent: ['staged-before-anchor.txt'] }), { code: 'OWNERSHIP_SELECTION' }); assert.equal(hash(fs.readFileSync(f.app.repo.index)), externalMain); await assert.rejects(f.app.resolveOwnership({ token: review.token, renames: [{ from: 'known.txt', to: 'staged-before-anchor.txt' }] }), { code: 'OWNERSHIP' });
  await f.app.baseUnstage(['staged-before-anchor.txt']);
  // A native staging destination is not proof of the origin of this known Layer rename.
  const postUnstageReview = await f.app.ownershipReview(); assert.equal(postUnstageReview.ambiguous, true);
  assert(postUnstageReview.candidates.includes('staged-before-anchor.txt')); assert(postUnstageReview.missing.some(p => p.path === 'known.txt' && p.owner === 'a'));
  assert.equal((await f.app.files()).find(p => p.path === 'staged-before-anchor.txt')!.owner, null);
  const postUnstageStatus = await f.app.status(); assert.equal(postUnstageStatus.safe, false); assert.equal(postUnstageStatus.error?.code, 'OWNERSHIP_AMBIGUOUS');
  await f.reopen(); const reopenedUnstageStatus = await f.app.status(); assert.equal(reopenedUnstageStatus.safe, false); assert.equal(reopenedUnstageStatus.error?.code, 'OWNERSHIP_AMBIGUOUS');
  assert.equal((await f.app.files()).find(p => p.path === 'staged-before-anchor.txt')!.owner, null);
  const reopenedUnstageReview = await f.app.ownershipReview(); assert.equal(reopenedUnstageReview.ambiguous, true); assert(reopenedUnstageReview.candidates.includes('staged-before-anchor.txt'));
  const unresolved = f.domain(), unresolvedRaw = f.bytes(), unresolvedJournals = frontierJournals(f);
  const observeDisk = () => Object.fromEntries(['base.txt', 'known.txt', 'staged-before-anchor.txt', 'preexistingunowned.txt'].map(file => {
    const full = path.join(f.repo, file); if (!fs.existsSync(full)) return [file, null]; const stat = fs.lstatSync(full); assert(stat.isFile() && !stat.isSymbolicLink()); const bytes = fs.readFileSync(full);
    return [file, { sha256: hash(bytes), bytes: bytes.length, mode: stat.mode & 0o777 }];
  }));
  const unresolvedDisk = observeDisk();
  for (const operation of [() => f.app.baseStage(['staged-before-anchor.txt']), () => f.app.baseCommit('must refuse unresolved pre-anchor rename after unstage'), () => f.app.commit('b', 'must not claim unresolved pre-anchor rename after unstage'), () => f.app.deactivate('b', { discard: true })]) {
    await assert.rejects(operation(), { code: 'OWNERSHIP_AMBIGUOUS' }); frontierDomainPreserved(f, unresolved, unresolvedJournals); assert.deepEqual(f.bytes(), unresolvedRaw); assert.deepEqual(observeDisk(), unresolvedDisk);
  }
  assert.equal(f.git(['show', ':known.txt'], f.aIndex), 'a B staged'); assert.equal(f.read('staged-before-anchor.txt'), 'a C disk\n'); assert.equal(f.read('preexistingunowned.txt'), 'preexisting independent bytes\n'); assert.equal(fs.existsSync(path.join(f.repo, 'known.txt')), false);
  assert.equal((await f.app.files()).find(p => p.path === 'staged-before-anchor.txt')!.owner, null);
  f.record('ambiguous pre-anchor native NEW remains unresolved after unstage and restart', { postUnstageReview, postUnstageStatus, reopenedUnstageStatus, reopenedUnstageReview, unresolved, after: f.domain(), raw: unresolvedRaw, disk: unresolvedDisk });
  const next = await f.app.ownershipReview(); await f.app.resolveOwnership({ token: next.token, renames: [{ from: 'known.txt', to: 'staged-before-anchor.txt' }] });
  assert.deepEqual(f.bytes(), unresolvedRaw); assert.deepEqual(observeDisk(), unresolvedDisk);
  assert.equal(f.git(['ls-files', '--stage']), before.mainIndex); assert.equal((await f.app.files()).find(p => p.path === 'staged-before-anchor.txt')!.owner, 'a'); assert.equal(f.read('staged-before-anchor.txt'), 'a C disk\n');
  f.record('pre-anchor MAIN writer preserved and explicit unstage resolution', { fired, review, before, after: f.domain(), workspace: f.workspace() });
});
