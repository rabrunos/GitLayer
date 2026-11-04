import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const evidenceRoot = process.env.GL_SECURITY_ATOMIC_STAGE_EVIDENCE ?? process.env.GL_SECURITY_EVIDENCE;
const keepFixtures = process.env.GL_SECURITY_KEEP_FIXTURES === '1' || !!evidenceRoot;
const beforeBundle = process.env.GL_SECURITY_STAGE_CORE_BUNDLE;
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
if (beforeBundle) {
  const stat = fs.lstatSync(beforeBundle), relative = path.relative(path.resolve(import.meta.dirname, '../..'), fs.realpathSync(beforeBundle));
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'Before bundle must be an exclusive regular file');
  assert(relative.startsWith('..') || path.isAbsolute(relative), 'Before evidence must use an immutable external bundle');
}
// Only the test oracle can select a preserved before bundle; production has no override.
const { GitLayers } = beforeBundle ? await import(pathToFileURL(path.resolve(beforeBundle)).href) as typeof import('../../src/core/index.js') : await import('../../src/core/index.js');

function fixtureParent() {
  const parent = fs.realpathSync(os.tmpdir());
  for (let cursor = parent; ; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor); assert(stat.isDirectory() && !stat.isSymbolicLink());
    try { fs.lstatSync(path.join(cursor, '.git')); assert.fail('Fixture parent must be outside all repositories'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(cursor) === cursor) break;
  }
  return parent;
}

async function fixture(t: TestContext, options: { unborn?: boolean; layers?: string[] } = {}) {
  const owned = createFixture(fixtureParent(), 'gl-atomic-stage'), previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const events: any[] = [];
  const native = (cwd: string, args: string[], index?: string) => {
    const result = cp.spawnSync(officialGit, args, { cwd, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, windowsHide: true, encoding: 'utf8', timeout: 30000 });
    const record = { kind: 'git', repository: cwd === repo ? 'product' : 'control', args, index: index ? path.basename(index) : 'main', code: result.status, signal: result.signal, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.message };
    events.push(record); return record;
  };
  const must = (args: string[], index?: string, cwd = repo) => { const result = native(cwd, args, index); assert.equal(result.code, 0, JSON.stringify(result)); return result.stdout.trimEnd(); };
  const write = (file: string, bytes: string, cwd = repo) => fs.writeFileSync(path.join(cwd, file), bytes);
  const read = (file: string) => fs.existsSync(path.join(repo, file)) ? fs.readFileSync(path.join(repo, file), 'utf8') : null;
  const initialize = (cwd: string, unborn = false) => {
    must(['init', '-b', 'main'], undefined, cwd); must(['config', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null'], undefined, cwd); must(['config', 'core.autocrlf', 'false'], undefined, cwd);
    write('base.txt', 'base A committed\n', cwd); write('keep.txt', 'keep A committed\n', cwd);
    if (!unborn) { must(['add', '--', 'base.txt', 'keep.txt'], undefined, cwd); must(['commit', '-m', 'base'], undefined, cwd); }
  };
  initialize(repo, options.unborn);
  let app = await GitLayers.init(repo);
  const registry = () => JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
  const layerIndex = (name: string) => path.join(app.dir, 'indexes', registry().layers.find((layer: any) => layer.name === name).id + '.index');
  const mainIndex = app.repo.index;
  const physical = (file: string) => fs.existsSync(file) ? { exists: true, sha256: sha(fs.readFileSync(file)), mode: fs.statSync(file).mode & 0o777 } : { exists: false, sha256: '', mode: 0 };
  const domain = () => {
    const head = native(repo, ['rev-parse', '--verify', 'HEAD']); assert([0, 128].includes(head.code!));
    const files = Object.fromEntries(['base.txt', 'keep.txt', 'a.txt', 'b.txt', 'chosen.txt', 'external.txt', 'ignored.cache', 'blocked.cache'].map(file => [file, read(file)]));
    return { head: head.code === 0 ? head.stdout.trimEnd() : '', branch: must(['symbolic-ref', 'HEAD']), branchRefs: must(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), stateRefs: must(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/git-layers/state/']), main: { ...physical(mainIndex), entries: must(['ls-files', '--stage']) }, privateIndexes: Object.fromEntries(registry().layers.map((layer: any) => [layer.name, { ...physical(layerIndex(layer.name)), entries: must(['ls-files', '--stage'], layerIndex(layer.name)) }])), files };
  };
  const journals = () => fs.readdirSync(path.join(app.dir, 'transactions')).map(id => ({ id, ...JSON.parse(fs.readFileSync(path.join(app.dir, 'transactions', id, 'journal.json'), 'utf8')) }));
  const record = (label: string, value: unknown) => events.push({ kind: 'observation', label, value });
  const snapshot = (label: string) => { const value = domain(); record(label, value); return value; };
  const external = (script: string, args: string[] = []) => {
    const result = cp.spawnSync(process.execPath, ['-e', script, ...args], { cwd: repo, env, windowsHide: true, encoding: 'utf8', timeout: 30000 });
    record('real external writer', { script, args, code: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr });
    assert.equal(result.status, 0, result.stderr); return result;
  };
  t.after(() => {
    try {
      snapshot('final');
      if (evidenceRoot) { fs.mkdirSync(evidenceRoot, { recursive: true }); fs.writeFileSync(path.join(evidenceRoot, 'atomic_stage_' + t.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json'), JSON.stringify({ test: t.name, fixture: owned.root, officialGit, gitVersion: must(['--version']), node: process.version, platform: process.platform, beforeBundle: beforeBundle ? { file: beforeBundle, sha256: sha(fs.readFileSync(beforeBundle)) } : null, journals: journals(), events }, null, 2) + '\n'); }
    } finally {
      delete process.env.GIT_LAYERS_FAILPOINT;
      for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous);
      if (keepFixtures) t.diagnostic('Preserved owned fixture: ' + owned.root); else cleanupFixture(owned);
    }
  });
  for (const name of options.layers ?? (options.unborn ? [] : ['a'])) {
    await app.create(name); await app.on(name); write(name + '.txt', name + ' A committed\n'); await app.add(name, [name + '.txt']); await app.commit(name, 'seed ' + name);
  }
  const pendingLayer = async (name: string) => { write(name + '.txt', name + ' B staged\n'); await app.add(name, [name + '.txt']); write(name + '.txt', name + ' C disk\n'); };
  const pendingBase = () => { write('base.txt', 'base B staged\n'); must(['add', '--', 'base.txt']); write('base.txt', 'base C disk\n'); };
  return { get app() { return app; }, repo, owned, env, mainIndex, native, must, initialize, write, read, domain, snapshot, record, journals, external, layerIndex, pendingLayer, pendingBase, reopen: async () => { app = await GitLayers.open(repo); return app; } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function afterScratch(f: Fixture, action: () => void, operation: () => Promise<unknown>) {
  const original = cp.spawn, normalize = (file: string) => path.resolve(file).toLowerCase();
  const live = new Set([f.mainIndex, ...JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8')).layers.map((layer: any) => f.layerIndex(layer.name))].map(normalize));
  let fired = false, writerError: unknown, operationError: any, result: unknown;
  cp.spawn = function (executable: any, args: any, options: any) {
    const child = (original as any).call(this, executable, args, options);
    const index = options?.env?.GIT_INDEX_FILE;
    if (!fired && options?.cwd === f.repo && Array.isArray(args) && args.includes('add') && typeof index === 'string' && !live.has(normalize(index))) {
      // Registered before git.ts attaches its close listener: native add really
      // completes on scratch, then another real process acts before publication.
      child.once('close', (code: number | null) => { if (code !== 0 || fired) return; fired = true; try { action(); } catch (error) { writerError = error; } });
    }
    return child;
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  try { result = await operation(); } catch (error) { operationError = error; }
  finally { cp.spawn = original; syncBuiltinESMExports(); }
  if (writerError) throw writerError;
  assert.equal(fired, true, 'A real external action must occur after native scratch add and before publication');
  return { result, error: operationError };
}

// Budgets cover composed Git/journal workflows; individual Git child timeouts stay unchanged.
test('D03 failed base batch keeps staged B and disk C while ordinary Git exposes its real partial index effect', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.pendingLayer('a'); f.pendingBase();
  fs.appendFileSync(f.app.repo.exclude, '\n*.cache\n'); await f.app.target('a'); await f.app.renameFile('base.txt', 'ignored.cache');
  const before = f.snapshot('before refused base batch');
  const control = path.join(f.owned.root, 'control'); fs.mkdirSync(control); f.initialize(control);
  f.write('base.txt', 'base B staged\n', control); f.must(['add', '--', 'base.txt'], undefined, control); f.write('base.txt', 'base C disk\n', control);
  fs.appendFileSync(path.join(control, '.git', 'info', 'exclude'), '\n*.cache\n'); fs.renameSync(path.join(control, 'base.txt'), path.join(control, 'ignored.cache'));
  const controlBefore = f.must(['ls-files', '--stage'], undefined, control), nativeFailure = f.native(control, ['add', '-A', '--', 'base.txt', 'ignored.cache']), controlAfter = f.must(['ls-files', '--stage'], undefined, control);
  f.record('ordinary Git partial failure control', { code: nativeFailure.code, stderr: nativeFailure.stderr, before: controlBefore, after: controlAfter });
  assert.equal(nativeFailure.code, 1); assert.notEqual(controlAfter, controlBefore); assert(!controlAfter.includes('\tbase.txt'));
  await assert.rejects(f.app.baseStage(['base.txt', 'ignored.cache']), { code: 'GIT_FAILED' });
  assert.deepEqual(f.domain(), before, 'Native partial scratch failure cannot change either live index, refs or disk bytes');
  assert.equal(f.read('ignored.cache'), 'base C disk\n'); assert.equal(f.must(['show', ':base.txt']), 'base B staged'); assert.equal(f.must(['show', ':a.txt'], f.layerIndex('a')), 'a B staged');
  assert.equal((await f.app.files()).find(file => file.path === 'ignored.cache')!.owner, 'base');
  assert.equal((await (await f.reopen()).status()).safe, true); assert.equal((await f.app.doctor()).safe, true);
});

test('D03 successful base and Layer staging preserve unrelated B-C states and native index separation', { timeout: 900000 }, async t => {
  const f = await fixture(t, { layers: ['a', 'b'] }); await f.pendingLayer('a'); await f.pendingLayer('b');
  f.write('keep.txt', 'keep B staged\n'); f.must(['add', '--', 'keep.txt']); f.write('keep.txt', 'keep C disk\n');
  f.write('base.txt', 'base B selected\n'); const before = f.snapshot('before successful base stage');
  await f.app.baseStage(['base.txt']); f.write('base.txt', 'base C later disk\n');
  assert.equal(f.must(['show', ':base.txt']), 'base B selected'); assert.equal(f.must(['show', ':keep.txt']), 'keep B staged');
  assert.deepEqual(f.domain().privateIndexes, before.privateIndexes);
  f.write('chosen.txt', 'chosen B selected\n'); const mainBeforeLayer = f.domain().main;
  await f.app.add('a', ['chosen.txt']); f.write('chosen.txt', 'chosen C later disk\n');
  const after = f.snapshot('after successful base and Layer publication');
  assert.deepEqual(after.main, mainBeforeLayer); assert.deepEqual(after.privateIndexes.b, before.privateIndexes.b);
  assert.equal(f.must(['show', ':a.txt'], f.layerIndex('a')), 'a B staged'); assert.equal(f.must(['show', ':chosen.txt'], f.layerIndex('a')), 'chosen B selected');
  assert.equal(f.read('base.txt'), 'base C later disk\n'); assert.equal(f.read('keep.txt'), 'keep C disk\n'); assert.equal(f.read('a.txt'), 'a C disk\n'); assert.equal(f.read('b.txt'), 'b C disk\n'); assert.equal(f.read('chosen.txt'), 'chosen C later disk\n');
  assert.equal(after.head, before.head); assert.equal(after.branchRefs, before.branchRefs); assert.equal((await (await f.reopen()).status()).safe, true);
});

test('D03 unborn failure leaves MAIN absent and successful first commit retains staged B versus disk C', { timeout: 900000 }, async t => {
  const f = await fixture(t, { unborn: true }); f.write('base.txt', 'unborn B staged\n'); f.write('blocked.cache', 'ignored unborn bytes\n'); fs.appendFileSync(f.app.repo.exclude, '\n*.cache\n');
  const before = f.snapshot('unborn without index'); assert.equal(before.main.exists, false);
  await assert.rejects(f.app.baseStage(['base.txt', 'blocked.cache']), { code: 'GIT_FAILED' });
  assert.deepEqual(f.domain(), before); assert.equal(fs.existsSync(f.mainIndex), false);
  await f.app.baseStage(['base.txt']); f.write('base.txt', 'unborn C disk\n'); assert.equal(f.must(['show', ':base.txt']), 'unborn B staged');
  await f.app.baseCommit('first real commit');
  assert.equal(f.must(['show', 'HEAD:base.txt']), 'unborn B staged'); assert.equal(f.read('base.txt'), 'unborn C disk\n'); assert.equal(f.read('blocked.cache'), 'ignored unborn bytes\n');
  assert.equal(f.must(['rev-list', '--parents', '-n', '1', 'HEAD']).split(' ').length, 1); assert.equal((await (await f.reopen()).status()).safe, true);
});

test('D03 concurrent real MAIN writer after scratch preparation is preserved with its recovery journal', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.pendingLayer('a'); f.pendingBase(); f.write('base.txt', 'base D candidate\n');
  const before = f.snapshot('before concurrent MAIN writer'); let externalState: ReturnType<Fixture['domain']> | undefined;
  const operation = await afterScratch(f, () => {
    f.external("const fs=require('node:fs'),cp=require('node:child_process');fs.writeFileSync('external.txt','external E staged\\n');cp.execFileSync(process.argv[1],['add','--','external.txt'],{cwd:process.cwd(),env:process.env,windowsHide:true});fs.writeFileSync('external.txt','external F disk\\n')", [officialGit]);
    externalState = f.snapshot('real writer state before Core publication');
  }, () => f.app.baseStage(['base.txt']));
  assert.equal(operation.error?.code, 'EXTERNAL_EDIT'); assert(externalState); assert.deepEqual(f.domain(), externalState, 'Core must preserve the external MAIN bytes, not restore the pre-operation stage');
  assert.equal(f.domain().head, before.head); assert.equal(f.domain().branchRefs, before.branchRefs); assert.deepEqual(f.domain().privateIndexes, before.privateIndexes);
  assert.equal(f.must(['show', ':base.txt']), 'base B staged'); assert.equal(f.must(['show', ':external.txt']), 'external E staged'); assert.equal(f.read('external.txt'), 'external F disk\n');
  const pending = f.journals().filter(journal => journal.state !== 'completed'); assert.equal(pending.length, 1); assert(pending[0].recovery.files.some((file: any) => file.path === f.mainIndex && file.backup));
  const preserved = f.snapshot('before conservative recovery refusal'); await assert.rejects(f.app.recover(), { code: 'RECOVERY_CONFLICT' }); assert.deepEqual(f.domain(), preserved); assert.equal(f.journals().filter(journal => journal.state !== 'completed').length, 1);
});

test('D03 a real late MAIN lock is retained without publishing the prepared index', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.pendingLayer('a'); f.pendingBase(); f.write('base.txt', 'base D unpublished\n');
  const before = f.snapshot('before late MAIN lock'), lock = f.mainIndex + '.lock', sentinel = 'real external late lock sentinel\n';
  const operation = await afterScratch(f, () => f.external("const fs=require('node:fs');const fd=fs.openSync(process.argv[1],'wx');fs.writeFileSync(fd,process.argv[2]);fs.closeSync(fd)", [lock, sentinel]), () => f.app.baseStage(['base.txt']));
  assert.equal(operation.error?.code, 'LOCKED'); assert.equal(fs.readFileSync(lock, 'utf8'), sentinel); assert.deepEqual(f.domain(), before);
  const journal = f.journals().find(journal => journal.kind === 'stage-base' && journal.error?.code === 'LOCKED'); assert(journal, 'The refused publication retains its journal, whether rollback completed or conservatively remains pending'); f.record('late lock and refusal journal retained', { lockBytes: fs.readFileSync(lock, 'utf8'), journal: { id: journal.id, state: journal.state, error: journal.error } });
});

test('D03 publication-before-after interruption records planned state and recovery never overwrites a later native index', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.pendingLayer('a'); f.pendingBase(); const before = f.snapshot('before publication interruption');
  const interrupted = async () => { process.env.GIT_LAYERS_FAILPOINT = 'after-stage-index-publication'; try { await assert.rejects(f.app.add('a', ['a.txt']), { code: 'INJECTED_FAILURE' }); } finally { delete process.env.GIT_LAYERS_FAILPOINT; } };
  await interrupted();
  const published = f.snapshot('published Layer index before after record'), first = f.journals().filter(journal => journal.state !== 'completed'); assert.equal(first.length, 1);
  const planned = first[0].recovery.files.find((file: any) => file.path === f.layerIndex('a'));
  assert(planned?.after); assert.equal(planned.after.hash, published.privateIndexes.a.sha256); assert(first[0].steps.some((step: any) => step.step === 'index-publication-prepared'));
  assert.equal(f.must(['show', ':a.txt'], f.layerIndex('a')), 'a C disk'); assert.deepEqual(published.main, before.main); assert.equal(published.branchRefs, before.branchRefs);
  f.write('a.txt', 'a D external disk after interruption\n'); await (await f.reopen()).recover();
  assert.deepEqual(f.domain().main, before.main); assert.deepEqual(f.domain().privateIndexes, before.privateIndexes); assert.equal(f.read('a.txt'), 'a D external disk after interruption\n');
  await interrupted();
  f.write('a.txt', 'a E external native stage\n'); f.must(['add', '-f', '--', 'a.txt'], f.layerIndex('a')); f.write('a.txt', 'a F later external disk\n');
  const external = f.snapshot('native private index supersedes planned publication');
  await assert.rejects((await f.reopen()).recover(), { code: 'RECOVERY_CONFLICT' }); assert.deepEqual(f.domain(), external); assert.equal(f.read('a.txt'), 'a F later external disk\n');
  assert.equal(f.journals().filter(journal => journal.state !== 'completed').length, 1);
});