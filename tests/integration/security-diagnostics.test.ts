import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import { build } from 'esbuild';
import { GitLayers } from '../../src/core/index.js';
import { getGitActivity } from '../../src/core/git.js';
import { resolveGitExecutable } from '../../src/core/platform.js';
import { createFixture, cleanupFixture, isolatedEnvironment } from '../../scripts/git-compat/lib.mjs';

const evidenceRoot = process.env.GL_SECURITY_DIAGNOSTICS_EVIDENCE;
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
async function fixture(t: TestContext, options: { collision?: boolean; layers?: string[] } = {}) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-security-diagnostics');
  const previous = { ...process.env }, executable = await resolveGitExecutable(), env = isolatedEnvironment(owned.root, executable);
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const commands: unknown[] = [], observations: unknown[] = [];
  const native = (args: string[], ok = [0], extra: Record<string, string> = {}) => {
    const r = spawnSync(executable, args, { cwd: repo, env: { ...env, ...extra }, encoding: 'utf8', shell: false, windowsHide: true, timeout: 30000 });
    commands.push({ executable, args, code: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr });
    assert(ok.includes(r.status!), JSON.stringify({ args, code: r.status, stderr: r.stderr, error: r.error?.message })); return r.stdout.trimEnd();
  };
  const write = (file: string, bytes: string) => { const destination = path.join(repo, file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes); };
  const read = (file: string) => fs.existsSync(path.join(repo, file)) ? fs.readFileSync(path.join(repo, file), 'utf8') : null;
  native(['init', '-b', 'main']); native(['config', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null']); native(['config', 'core.autocrlf', 'false']);
  write('base.txt', 'base original\n'); native(['add', '.']); native(['commit', '-m', 'base']);
  if (options.collision) { native(['switch', '-c', 'develop']); write('a.txt', 'a original\n'); native(['add', '.']); native(['commit', '-m', 'destination collision']); native(['switch', 'main']); native(['branch', 'compatible']); }
  const app = await GitLayers.init(repo);
  for (const name of options.layers ?? ['a']) { await app.create(name); await app.on(name); write(name + '.txt', name + ' original\n'); await app.add(name, [name + '.txt']); await app.commit(name, 'seed ' + name); }
  const snapshot = () => {
    const indexes: Record<string, unknown> = {};
    for (const file of fs.readdirSync(path.join(app.dir, 'indexes'))) { const full = path.join(app.dir, 'indexes', file); indexes[file] = { sha256: digest(fs.readFileSync(full)), entries: native(['ls-files', '--stage'], [0], { GIT_INDEX_FILE: full }) }; }
    const files: Record<string, unknown> = {};
    const scan = (folder: string, prefix = '') => { for (const entry of fs.readdirSync(folder, { withFileTypes: true })) { if (entry.name === '.git') continue; assert(!entry.isSymbolicLink()); const file = path.join(folder, entry.name), relative = prefix + entry.name; if (entry.isDirectory()) scan(file, relative + '/'); else files[relative] = { sha256: digest(fs.readFileSync(file)), bytes: fs.statSync(file).size, text: fs.readFileSync(file, 'utf8') }; } }; scan(repo);
    return { head: native(['rev-parse', 'HEAD']), branch: native(['symbolic-ref', '--short', 'HEAD']), branchRefs: native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), index: native(['ls-files', '--stage']), privateIndexes: indexes, files };
  };
  const record = (label: string, value: unknown) => observations.push({ label, value });
  t.after(() => {
    try { if (evidenceRoot) { fs.mkdirSync(evidenceRoot, { recursive: true }); fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '-' + randomUUID() + '.json'), JSON.stringify({ test: t.name, fixture: owned.root, executable, version: native(['--version']), commands, observations }, null, 2) + '\n'); } }
    finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); if (!evidenceRoot) { if (process.env.GL_SECURITY_KEEP_FIXTURES === '1' || process.env.GL_STAGE2_PRESERVE_FIXTURES === '1') t.diagnostic(JSON.stringify({ kind: 'fixture-cleanup-skipped', test: t.name, root: owned.root, nonce: owned.nonce, cleanupSkipped: true, policy: 'GL_SECURITY_KEEP_FIXTURES=1 or GL_STAGE2_PRESERVE_FIXTURES=1; original owned fixture location; current filesystem state not reverified here' })); else cleanupFixture(owned); } }
  });
  const bundleCLI = async () => { const outfile = path.join(owned.root, 'cli.mjs'), root = path.resolve(import.meta.dirname, '../..'); const result = await build({ absWorkingDir: root, entryPoints: ['src/cli/index.ts'], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', metafile: true, logLevel: 'silent' }); record('CLI isolated bundle inputs', Object.keys(result.metafile!.inputs).sort().map(file => ({ file, sha256: digest(fs.readFileSync(path.resolve(root, file))) }))); return outfile; };
  const cli = (bundle: string, args: string[], ok = [0]) => { const argv = [bundle, '--cwd', repo, '--json', ...args], r = spawnSync(process.execPath, argv, { cwd: repo, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 90000 }); commands.push({ executable: process.execPath, args: argv, code: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr }); assert(ok.includes(r.status!), JSON.stringify({ args, code: r.status, stdout: r.stdout, stderr: r.stderr })); if (r.status === 0) { assert.equal(r.stderr.trim(), ''); return JSON.parse(r.stdout); } assert.equal(r.stdout.trim(), ''); return JSON.parse(r.stderr); };
  const verifyOwned = () => {
    const marker = JSON.parse(fs.readFileSync(path.join(owned.root, '.git-compat-owned.json'), 'utf8'));
    assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
    assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent);
    assert.equal(path.dirname(fs.realpathSync(repo)), fs.realpathSync(owned.root));
    assert(!fs.lstatSync(owned.root).isSymbolicLink());
  };
  const privateIndex = (name: string) => {
    const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
    const layer = registry.layers.find((entry: { name: string }) => entry.name === name); assert(layer);
    return path.join(app.dir, 'indexes', layer.id + '.index');
  };
  return { app, repo, native, write, read, snapshot, record, bundleCLI, cli, verifyOwned, privateIndex };
}

for (const route of ['staged', 'committed']) test('P1 native newcomer ' + route + ' in base requires explicit acceptance without reassigning or staging', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.app.target('a'); f.write('new.txt', 'native base newcomer\n'); f.native(['add', '-f', '--', 'new.txt']); if (route === 'committed') f.native(['commit', '-m', 'native newcomer']);
  const before = f.snapshot(), status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, 'EDITING_BASE_INTERFERENCE'); assert(!status.layers[0]!.reservations.includes('new.txt')); assert.equal((await f.app.files()).find(file => file.path === 'new.txt')!.owner, 'base');
  const review = await f.app.ownershipReview(); assert(review.externalBase.includes('new.txt')); const accepted = await f.app.resolveOwnership({ token: review.token, acceptBase: ['new.txt'] });
  assert.deepEqual(f.snapshot(), before); assert.equal(accepted.staging, 'unchanged'); assert.equal((await f.app.status()).safe, true); assert.equal((await f.app.files()).find(file => file.path === 'new.txt')!.owner, 'base');
  f.record('external base accepted deliberately', { route, before, status, review, accepted, after: f.snapshot() });
});

test('P1 explicit base acceptance survives unstage and reopen while preserving user ignore intent', { timeout: 900000 }, async t => {
  const f = await fixture(t), names = ['new.txt', 'info-new.txt', 'global-new.txt'];
  const infoFile = path.join(f.repo, '.git', 'info', 'exclude'), globalFile = path.join(path.dirname(f.repo), 'user-global-ignore');
  fs.writeFileSync(infoFile, 'info-new.txt\n' + fs.readFileSync(infoFile, 'utf8')); fs.writeFileSync(globalFile, 'global-new.txt\n');
  f.native(['config', '--local', 'core.excludesFile', globalFile]); await f.app.target('a');
  for (const name of names) f.write(name, 'deliberately accepted base: ' + name + '\n');
  f.native(['add', '-f', '--', ...names]); const status = await f.app.status(); assert.equal(status.error?.code, 'EDITING_BASE_INTERFERENCE');
  const before = f.snapshot(), review = await f.app.ownershipReview(); assert(names.every(name => review.externalBase.includes(name)));
  const accepted = await f.app.resolveOwnership({ token: review.token, acceptBase: names }); assert.deepEqual(f.snapshot(), before);
  await f.app.baseUnstage(names); assert.equal(f.native(['diff', '--cached', '--name-only']), '');
  const unprepared = f.snapshot(), observed = await f.app.status(); assert.equal(observed.safe, true); assert.deepEqual(f.snapshot(), unprepared);
  const reopened = await GitLayers.open(f.repo), afterReopen = await reopened.status(); assert.equal(afterReopen.safe, true);
  const ownership = await reopened.files(); for (const name of names) { assert.equal(ownership.find(file => file.path === name)!.owner, 'base'); assert(!afterReopen.layers[0]!.reservations.includes(name)); assert.equal(f.read(name), 'deliberately accepted base: ' + name + '\n'); }
  const ignored = f.native(['check-ignore', '--no-index', '--', 'info-new.txt', 'global-new.txt']).split('\n').filter(Boolean); assert.deepEqual(ignored.sort(), ['global-new.txt', 'info-new.txt']);
  await reopened.baseStage(['new.txt']); assert.equal(f.native(['diff', '--cached', '--name-only']), 'new.txt');
  f.native(['add', '-f', '--', 'info-new.txt', 'global-new.txt']); assert.deepEqual(f.native(['diff', '--cached', '--name-only']).split('\n').sort(), names.slice().sort());
  assert.equal((await reopened.status()).safe, true); assert.deepEqual(f.snapshot().privateIndexes, before.privateIndexes); assert.equal(f.native(['rev-parse', 'HEAD']), before.head);
  f.record('deliberate base origin retained after unstage', { before, review, accepted, observed, afterReopen, ignored, after: f.snapshot() });
});

test('P1 base unstage remains available to resolve unreconciled native staging and preserves disk bytes', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.verifyOwned();
  f.write('a.txt', 'a own B staged\n'); await f.app.add('a', ['a.txt']); f.write('a.txt', 'a own C disk\n');
  await f.app.target('a'); f.write('new.txt', 'native base B staged\n'); f.native(['add', '-f', '--', 'new.txt']);
  const nativeBaseBlob = f.native(['rev-parse', ':new.txt']); f.write('new.txt', 'unstage rescue sentinel\n');
  const status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, 'EDITING_BASE_INTERFERENCE');
  assert.equal((await f.app.files()).find(file => file.path === 'new.txt')!.owner, 'base');
  assert.equal(f.native(['show', ':new.txt']), 'native base B staged');
  assert.equal(f.native(['show', ':a.txt'], [0], { GIT_INDEX_FILE: f.privateIndex('a') }), 'a own B staged');
  const before = f.snapshot(), unstaged = await f.app.baseUnstage(['new.txt']); assert.equal(f.native(['diff', '--cached', '--name-only']), ''); assert.equal(f.read('new.txt'), 'unstage rescue sentinel\n'); assert.equal(f.native(['rev-parse', 'HEAD']), before.head); assert.deepEqual(f.snapshot().privateIndexes, before.privateIndexes);
  assert.equal((await f.app.files()).find(file => file.path === 'new.txt')!.owner, 'base');
  const unprepared = f.snapshot(), observed = await f.app.status(); assert.equal(observed.safe, true);
  assert.equal((await f.app.files()).find(file => file.path === 'new.txt')!.owner, 'base'); assert.deepEqual(f.snapshot(), unprepared);
  const reopened = await GitLayers.open(f.repo), afterReopen = await reopened.status(); assert.equal(afterReopen.safe, true);
  assert.equal((await reopened.files()).find(file => file.path === 'new.txt')!.owner, 'base');
  assert(!afterReopen.layers.find(layer => layer.name === 'a')!.reservations.includes('new.txt'));
  const beforeWrongAdd = f.snapshot(); await assert.rejects(() => reopened.add('a', ['new.txt']), { code: 'OWNERSHIP' }); assert.deepEqual(f.snapshot(), beforeWrongAdd);
  await reopened.commit('a', 'only the Layer own staged B');
  assert.equal(f.native(['ls-tree', '-r', '--name-only', 'layer/a']), 'a.txt'); assert.equal(f.native(['show', 'layer/a:a.txt']), 'a own B staged');
  assert.equal(f.native(['rev-parse', 'HEAD']), before.head); assert.equal(f.read('new.txt'), 'unstage rescue sentinel\n');
  f.verifyOwned(); await reopened.deactivate('a', { discard: true }); assert.equal(f.read('new.txt'), 'unstage rescue sentinel\n');
  const afterDiscard = await GitLayers.open(f.repo); assert.equal((await afterDiscard.status()).safe, true);
  assert.equal((await afterDiscard.files()).find(file => file.path === 'new.txt')!.owner, 'base');
  assert.equal(f.native(['cat-file', 'blob', nativeBaseBlob]), 'native base B staged');
  await afterDiscard.baseStage(['new.txt']); await afterDiscard.baseCommit('deliberate base C commit after unstage');
  assert.equal(f.native(['show', 'HEAD:new.txt']), 'unstage rescue sentinel'); assert.equal(f.native(['ls-tree', '-r', '--name-only', 'layer/a']), 'a.txt');
  f.record('base unstage is an explicit rescue', { status, before, unstaged, observed, afterReopen, afterUnstage: unprepared, after: f.snapshot() });
});

for (const nativeFirst of [false, true]) test('P1 higher priority ignore ' + (nativeFirst ? 'native add before observation diagnoses base interference' : 'diagnoses exposure before native add'), { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('.gitignore', '!new.txt\n'); f.native(['add', '--', '.gitignore']); f.native(['commit', '-m', 'preexisting native negation']); await f.app.target('a'); f.write('new.txt', 'ignore precedence sentinel\n');
  if (nativeFirst) f.native(['add', '-A']); const before = f.snapshot(), status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, nativeFirst ? 'EDITING_BASE_INTERFERENCE' : 'EDITING_IGNORE_UNSAFE'); assert(!status.layers[0]!.reservations.includes('new.txt')); assert.deepEqual(f.snapshot(), before);
  assert.equal((await f.app.files()).find(file => file.path === 'new.txt')!.owner, nativeFirst ? 'base' : null);
  f.record('native priority and observation order', { nativeFirst, before, status, after: f.snapshot() });
});

test('P1 known Layer force staging is diagnosed as base contamination without changing either origin', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('a.txt', 'known Layer force sentinel\n'); f.native(['add', '-f', '--', 'a.txt']); const before = f.snapshot(), status = await f.app.status();
  assert.equal(status.safe, false); assert.equal(status.error?.code, 'BASE_CONTAMINATED'); assert.deepEqual(f.snapshot(), before); assert.equal(f.native(['show', 'layer/a:a.txt']), 'a original'); assert.equal(f.native(['show', ':a.txt']), 'known Layer force sentinel');
  f.record('known ownership contamination', { before, status, after: f.snapshot() });
});

test('P1 ignore changes after reservation do not move the reserved path to another origin', { timeout: 900000 }, async t => {
  const f = await fixture(t, { layers: ['a', 'b'] }); f.write('.gitignore', '# base control\n'); f.native(['add', '--', '.gitignore']); f.native(['commit', '-m', 'base ignore control']); await f.app.target('b'); f.write('reserved.txt', 'reserved owner sentinel\n'); const initial = await f.app.status(); assert(initial.layers.find(l => l.name === 'b')!.reservations.includes('reserved.txt'));
  f.write('.gitignore', 'reserved.txt\n'); const before = f.snapshot(), status = await f.app.status(); assert.equal(status.safe, true); assert(status.layers.find(l => l.name === 'b')!.reservations.includes('reserved.txt')); assert.equal((await f.app.files()).find(file => file.path === 'reserved.txt')!.owner, 'b'); await assert.rejects(() => f.app.add('a', ['reserved.txt']), { code: 'OWNERSHIP' }); assert.deepEqual(f.snapshot(), before);
  f.record('ignore changed without ownership transfer', { initial, status, before, after: f.snapshot() });
});

test('P1 managed switch preserves Layer stage and disk while native ignored collision needs conservative option', { timeout: 900000 }, async t => {
  const f = await fixture(t, { collision: true }); const identical = f.snapshot(); await assert.rejects(() => f.app.switch('develop'), { code: 'PATH_COLLISION' }); assert.deepEqual(f.snapshot(), identical);
  f.write('a.txt', 'prepared B\n'); await f.app.add('a', ['a.txt']); f.write('a.txt', 'unstaged C\n'); const privateBefore = f.snapshot().privateIndexes; await f.app.switch('compatible');
  const switchCommand = getGitActivity().findLast(event => event.command.includes('switch') && event.command.includes('compatible')); assert(switchCommand?.command.includes('--no-overwrite-ignore'));
  assert.equal(f.read('a.txt'), 'unstaged C\n'); assert.deepEqual(f.snapshot().privateIndexes, privateBefore); const status = await f.app.status(); assert.equal(status.layers[0]!.staged.length, 1); assert.equal(status.layers[0]!.unstaged.length, 1); assert.equal(status.layers[0]!.state, 'active');
  const beforeNative = f.snapshot(); f.native(['switch', '--no-overwrite-ignore', 'develop'], [1]); assert.deepEqual(f.snapshot(), beforeNative);
  f.native(['switch', 'develop']); assert.equal(f.read('a.txt'), 'a original\n'); assert.deepEqual(f.snapshot().privateIndexes, privateBefore); assert.equal((await f.app.status()).safe, false);
  f.record('managed and native routes distinguished', { identical, switchCommand, status, beforeNative, afterDestructiveNativeSwitch: f.snapshot() });
});

test('P1 public CLI ownership resolution rejects malformed and stale choices and preserves rename origin', { timeout: 900000 }, async t => {
  const f = await fixture(t), bundle = await f.bundleCLI(); await f.app.target('a'); f.write('base.txt', 'CLI base rename sentinel\n'); fs.renameSync(path.join(f.repo, 'base.txt'), path.join(f.repo, 'moved-base.txt'));
  const review = f.cli(bundle, ['ownership-review']).result, before = f.snapshot();
  const malformed = f.cli(bundle, ['ownership-resolve', 'rename', '--token', review.token, '--', 'base.txt'], [2]); assert.equal(malformed.ok, false); assert.equal(malformed.error.code, 'CLI_USAGE'); assert.deepEqual(f.snapshot(), before);
  f.write('moved-base.txt', 'CLI changed after review\n'); const changed = f.snapshot(), stale = f.cli(bundle, ['ownership-resolve', 'rename', '--token', review.token, '--', 'base.txt', 'moved-base.txt'], [3]); assert.equal(stale.ok, false); assert.equal(stale.error.code, 'OWNERSHIP_REVIEW_STALE'); assert.deepEqual(f.snapshot(), changed);
  const current = f.cli(bundle, ['ownership-review']).result, resolved = f.cli(bundle, ['ownership-resolve', 'rename', '--token', current.token, '--', 'base.txt', 'moved-base.txt']); assert.equal(resolved.ok, true); assert.deepEqual(f.snapshot(), changed); assert.equal((await (await GitLayers.open(f.repo)).files()).find(file => file.path === 'moved-base.txt')!.owner, 'base');
  const renamed = f.cli(bundle, ['rename-file', '--', 'a.txt', 'renamed-a.txt']); assert.equal(renamed.ok, true); assert.equal(f.read('a.txt'), null); assert.equal(f.read('renamed-a.txt'), 'a original\n'); assert.equal((await (await GitLayers.open(f.repo)).files()).find(file => file.path === 'renamed-a.txt')!.owner, 'a'); assert.equal(f.native(['diff', '--cached', '--name-only']), '');
  f.record('CLI reviewed resolution and managed rename', { review, malformed, stale, resolved, renamed, after: f.snapshot() });
});


test('P1 broad base unstage refuses an unindexed newcomer without reserving its origin', { timeout: 900000 }, async t => {
  const f = await fixture(t, { layers: [] }); f.verifyOwned(); await f.app.create('a'); await f.app.on('a'); await f.app.target('a');
  f.write('indexed.txt', 'native indexed B\n'); f.native(['add', '-f', '--', 'indexed.txt']); f.write('indexed.txt', 'native indexed C\n');
  const initial = await f.app.status(); assert.equal(initial.error?.code, 'EDITING_BASE_INTERFERENCE');
  f.write('ordinary.txt', 'ordinary never entered MAIN\n');
  const before = f.snapshot(), mainBefore = fs.readFileSync(path.join(f.repo, '.git', 'index'));
  const metadataFiles = [path.join(f.app.dir, 'workspace.json'), path.join(f.app.dir, 'registry.json'), path.join(f.repo, '.git', 'info', 'exclude')];
  const metadataBefore = metadataFiles.map(file => fs.readFileSync(file)), modesBefore = Object.keys(before.files).map(file => [file, fs.statSync(path.join(f.repo, file)).mode & 0o777]); let refusal: unknown;
  await assert.rejects(async () => { try { await f.app.baseUnstage(['.']); } catch (error) { refusal = { code: (error as { code?: string }).code }; throw error; } });
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git', 'index')), mainBefore); assert.deepEqual(metadataFiles.map(file => fs.readFileSync(file)), metadataBefore);
  const refused = f.snapshot(), { privateIndexes: oldPrivate, ...oldDomain } = before, { privateIndexes: refusedPrivate, ...refusedDomain } = refused;
  assert.deepEqual(refusedDomain, oldDomain);
  const semanticIndexes = (indexes: Record<string, unknown>) => Object.fromEntries(Object.entries(indexes).map(([name, value]) => [name, (value as { entries: string }).entries]));
  assert.deepEqual(semanticIndexes(refusedPrivate), semanticIndexes(oldPrivate));
  assert.deepEqual(Object.keys(refused.files).map(file => [file, fs.statSync(path.join(f.repo, file)).mode & 0o777]), modesBefore);
  assert.equal((await f.app.files()).find(file => file.path === 'ordinary.txt')!.owner, null);
  assert.equal((await f.app.files()).find(file => file.path === 'indexed.txt')!.owner, 'base');
  await f.app.baseUnstage(['indexed.txt']); assert.equal(f.native(['diff', '--cached', '--name-only']), '');
  const immediate = await f.app.files(); assert.equal(immediate.find(file => file.path === 'indexed.txt')!.owner, 'base');
  assert.equal(immediate.find(file => file.path === 'ordinary.txt')!.owner, null);
  const reconciled = await f.app.status(); assert.equal(reconciled.safe, true);
  const owners = await f.app.files(); assert.equal(owners.find(file => file.path === 'indexed.txt')!.owner, 'base'); assert.equal(owners.find(file => file.path === 'ordinary.txt')!.owner, 'a');
  const reopened = await GitLayers.open(f.repo); assert.equal((await reopened.status()).safe, true);
  assert.equal((await reopened.files()).find(file => file.path === 'indexed.txt')!.owner, 'base');
  assert.equal((await reopened.files()).find(file => file.path === 'ordinary.txt')!.owner, 'a');
  assert.equal(f.read('indexed.txt'), 'native indexed C\n'); assert.equal(f.read('ordinary.txt'), 'ordinary never entered MAIN\n');
  await reopened.add('a', ['ordinary.txt']); await reopened.commit('a', 'only the ordinary never-indexed newcomer');
  assert.equal(f.native(['ls-tree', '-r', '--name-only', 'layer/a']), 'ordinary.txt'); assert.equal(f.native(['show', 'layer/a:ordinary.txt']), 'ordinary never entered MAIN');
  f.record('wide refused unstage cannot claim an ordinary newcomer', { initial, before, refusal, refused, reconciled, after: f.snapshot() });
  await reopened.target(); f.verifyOwned(); f.write('ordinary.txt', 'ordinary Layer A later C disk\n');
  f.write('late-main.txt', 'legitimate MAIN B staged\n'); f.native(['add', '--', 'late-main.txt']); f.write('late-main.txt', 'legitimate MAIN C disk\n');
  const lateBefore = f.snapshot(), lateMain = fs.readFileSync(path.join(f.repo, '.git', 'index')), lateMetadata = metadataFiles.map(file => fs.readFileSync(file));
  const lateRefs = new Map(f.native(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
  const lateJournals = new Set(fs.readdirSync(path.join(f.app.dir, 'transactions'))), expectedLateFiles = { ...lateBefore.files };
  expectedLateFiles['moved-during-unstage.txt'] = expectedLateFiles['ordinary.txt']; delete expectedLateFiles['ordinary.txt'];
  const expectedLateModes = Object.fromEntries(Object.keys(lateBefore.files).map(file => [file === 'ordinary.txt' ? 'moved-during-unstage.txt' : file, fs.statSync(path.join(f.repo, file)).mode & 0o777]));
  const originalUpdateExcludes = (reopened as any).updateExcludes; let lateFired = false, lateExternal: unknown;
  (reopened as any).updateExcludes = async function (...args: any[]) {
    const value = await originalUpdateExcludes.apply(this, args);
    if (!lateFired && this.workspace.baseReservations?.includes('late-main.txt')) {
      lateFired = true; assert.equal(f.native(['ls-files', '--stage', '--', 'late-main.txt']), '', 'The real MAIN unstage must already have happened');
      assert.notEqual(digest(fs.readFileSync(path.join(f.repo, '.git', 'index'))), digest(lateMain));
      const script = "require('node:fs').renameSync(process.argv[1],process.argv[2])";
      const result = spawnSync(process.execPath, ['-e', script, path.join(f.repo, 'ordinary.txt'), path.join(f.repo, 'moved-during-unstage.txt')], { cwd: f.repo, env: process.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 30000 });
      lateExternal = { code: result.status, signal: result.signal, stderr: result.stderr, script }; assert.equal(result.status, 0, result.stderr || result.error?.message); assert.equal(result.signal, null);
    }
    return value;
  };
  try { await assert.rejects(reopened.baseUnstage(['late-main.txt']), { code: 'OWNERSHIP_AMBIGUOUS' }); }
  finally { (reopened as any).updateExcludes = originalUpdateExcludes; }
  assert(lateFired, 'The external rename must execute after exclude publication and provisional base reservation, before the final ownership check');
  const preserveLateDomain = () => {
    const after = f.snapshot(), { privateIndexes: beforePrivate, files: _beforeFiles, ...beforeDomain } = lateBefore, { privateIndexes: afterPrivate, files: afterFiles, ...afterDomain } = after;
    assert.deepEqual(afterDomain, beforeDomain); assert.deepEqual(afterFiles, expectedLateFiles); assert.deepEqual(semanticIndexes(afterPrivate), semanticIndexes(beforePrivate));
    assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git', 'index')), lateMain, 'Rollback restores the exact pre-operation MAIN index containing B');
    assert.deepEqual(metadataFiles.map(file => fs.readFileSync(file)), lateMetadata, 'Workspace, registry and excludes retain their exact previous bytes');
    assert.deepEqual(Object.fromEntries(Object.keys(after.files).map(file => [file, fs.statSync(path.join(f.repo, file)).mode & 0o777])), expectedLateModes);
    const afterRefs = new Map(f.native(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string])), retained: unknown[] = [];
    for (const [ref, oid] of lateRefs) assert.equal(afterRefs.get(ref), oid);
    for (const [ref, oid] of afterRefs) if (!lateRefs.has(ref)) {
      const match = /^refs\/git-layers\/transactions\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/u.exec(ref); assert(match); const [, transaction, layer] = match; assert(!lateJournals.has(transaction!));
      const journal = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'transactions', transaction!, 'journal.json'), 'utf8'));
      assert.equal(journal.id, transaction); assert.equal(journal.state, 'completed'); assert.equal(journal.error?.code, 'OWNERSHIP_AMBIGUOUS');
      assert(journal.recovery.beforeRegistry.layers.some((entry: any) => entry.id === layer)); assert(journal.steps.some((step: any) => step.step === 'failed') && journal.steps.some((step: any) => step.step === 'completed'));
      assert.equal(oid, lateRefs.get('refs/git-layers/state/' + layer)); assert.equal(f.native(['cat-file', '-t', oid]), 'tree'); assert.equal(f.native(['for-each-ref', '--format=%(symref)', ref]), ''); retained.push({ ref, oid, transaction, layer });
    }
    f.record('late unstage refusal preserves the external rename and both origins', { before: lateBefore, after, retained });
    return after;
  };
  preserveLateDomain(); assert.equal(f.read('late-main.txt'), 'legitimate MAIN C disk\n'); assert.equal(f.native(['show', ':late-main.txt']), 'legitimate MAIN B staged');
  assert.equal(f.read('ordinary.txt'), null); assert.equal(f.read('moved-during-unstage.txt'), 'ordinary Layer A later C disk\n');
  assert.equal(f.native(['show', 'layer/a:ordinary.txt']), 'ordinary never entered MAIN'); assert.equal(f.native(['show', ':ordinary.txt'], [0], { GIT_INDEX_FILE: f.privateIndex('a') }), 'ordinary never entered MAIN');
  const lateStatus = await reopened.status(); assert.equal(lateStatus.safe, false); assert.equal(lateStatus.error?.code, 'OWNERSHIP_AMBIGUOUS');
  const lateReopened = await GitLayers.open(f.repo), lateReopenedStatus = await lateReopened.status(); assert.equal(lateReopenedStatus.safe, false); assert.equal(lateReopenedStatus.error?.code, 'OWNERSHIP_AMBIGUOUS');
  const lateReview = await lateReopened.ownershipReview(); assert.equal(lateReview.ambiguous, true); assert(lateReview.missing.some(file => file.path === 'ordinary.txt' && file.owner === 'a')); assert(lateReview.candidates.includes('moved-during-unstage.txt'));
  assert.equal((await lateReopened.files()).find(file => file.path === 'moved-during-unstage.txt')!.owner, null);
  for (const operation of [() => lateReopened.baseStage(['moved-during-unstage.txt']), () => lateReopened.baseCommit('must refuse late unresolved Layer rename'), () => lateReopened.add('a', ['moved-during-unstage.txt']), () => lateReopened.commit('a', 'must require an explicit late rename decision')]) {
    await assert.rejects(operation(), { code: 'OWNERSHIP_AMBIGUOUS' }); preserveLateDomain();
  }
  const lateResolutionReview = await lateReopened.ownershipReview(); await lateReopened.resolveOwnership({ token: lateResolutionReview.token, renames: [{ from: 'ordinary.txt', to: 'moved-during-unstage.txt' }] });
  assert.equal((await lateReopened.status()).safe, true); assert.equal((await lateReopened.files()).find(file => file.path === 'moved-during-unstage.txt')!.owner, 'a');
  const lateResolved = f.snapshot(); assert.equal(lateResolved.head, lateBefore.head); assert.equal(lateResolved.branchRefs, lateBefore.branchRefs); assert.equal(lateResolved.index, lateBefore.index); assert.deepEqual(semanticIndexes(lateResolved.privateIndexes), semanticIndexes(lateBefore.privateIndexes)); assert.deepEqual(lateResolved.files, expectedLateFiles);
  assert.equal(f.read('late-main.txt'), 'legitimate MAIN C disk\n'); assert.equal(f.native(['show', ':late-main.txt']), 'legitimate MAIN B staged');
  await lateReopened.target('a'); f.verifyOwned();
  const missingMainBefore = f.snapshot(), missingMainRaw = fs.readFileSync(path.join(f.repo, '.git', 'index')), missingMainMetadata = metadataFiles.map(file => fs.readFileSync(file));
  const missingMainRefs = new Map(f.native(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
  const missingMainJournals = new Set(fs.readdirSync(path.join(f.app.dir, 'transactions'))), missingMainBlob = f.native(['rev-parse', ':late-main.txt']);
  const expectedMissingFiles = { ...missingMainBefore.files }; expectedMissingFiles['renamed-late-main.txt'] = expectedMissingFiles['late-main.txt']; delete expectedMissingFiles['late-main.txt'];
  const expectedMissingModes = Object.fromEntries(Object.keys(missingMainBefore.files).map(file => [file === 'late-main.txt' ? 'renamed-late-main.txt' : file, fs.statSync(path.join(f.repo, file)).mode & 0o777]));
  fs.renameSync(path.join(f.repo, 'late-main.txt'), path.join(f.repo, 'renamed-late-main.txt'));
  const missingMainStatus = await lateReopened.status(); assert.equal(missingMainStatus.safe, false); assert.equal(missingMainStatus.error?.code, 'OWNERSHIP_AMBIGUOUS');
  const missingMainReview = await lateReopened.ownershipReview(); assert.equal(missingMainReview.ambiguous, true); assert.equal(missingMainReview.editingTarget, 'a');
  assert.deepEqual(missingMainReview.missing, [{ path: 'late-main.txt', owner: 'base' }]); assert(missingMainReview.candidates.includes('renamed-late-main.txt')); assert.equal((await lateReopened.files()).find(file => file.path === 'renamed-late-main.txt')!.owner, null);
  const activityAnchor = getGitActivity().at(-1); assert(activityAnchor); const activityAnchorKey = JSON.stringify(activityAnchor);
  await assert.rejects(lateReopened.baseUnstage(['late-main.txt']), { code: 'OWNERSHIP_AMBIGUOUS' });
  const missingMainActivity = getGitActivity(), activityAnchorIndex = missingMainActivity.findIndex(event => JSON.stringify(event) === activityAnchorKey);
  assert(activityAnchorIndex >= 0, 'The bounded native command trace must still contain the anchor before this one refusal');
  assert(!missingMainActivity.slice(activityAnchorIndex + 1).some(event => event.command.includes('late-main.txt') && (event.command.includes('restore') && event.command.includes('--staged') || event.command.includes('rm') && event.command.includes('--cached'))), 'An absent MAIN NEW anchor must be refused before launching native unstaging');
  const verifyMissingMainRefs = (beforeRefs: Map<string, string>, previousJournals: Set<string>, errorCode: string) => {
    const afterRefs = new Map(f.native(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
    for (const [ref, oid] of beforeRefs) assert.equal(afterRefs.get(ref), oid);
    for (const [ref, oid] of afterRefs) if (!beforeRefs.has(ref)) {
      const match = /^refs\/git-layers\/transactions\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/u.exec(ref); assert(match); const [, transaction, layer] = match; assert(!previousJournals.has(transaction!));
      const journal = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'transactions', transaction!, 'journal.json'), 'utf8'));
      assert.equal(journal.id, transaction); assert.equal(journal.state, 'completed'); assert.equal(journal.error?.code, errorCode); assert(journal.recovery.beforeRegistry.layers.some((entry: any) => entry.id === layer));
      assert(journal.steps.some((step: any) => step.step === 'failed') && journal.steps.some((step: any) => step.step === 'completed'));
      assert.equal(oid, beforeRefs.get('refs/git-layers/state/' + layer)); assert.equal(f.native(['cat-file', '-t', oid]), 'tree'); assert.equal(f.native(['for-each-ref', '--format=%(symref)', ref]), '');
    }
    return [...afterRefs];
  };
  const missingMainAfter = f.snapshot(); assert.equal(missingMainAfter.head, missingMainBefore.head); assert.equal(missingMainAfter.branchRefs, missingMainBefore.branchRefs); assert.equal(missingMainAfter.index, missingMainBefore.index); assert.deepEqual(semanticIndexes(missingMainAfter.privateIndexes), semanticIndexes(missingMainBefore.privateIndexes)); assert.deepEqual(missingMainAfter.files, expectedMissingFiles);
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git', 'index')), missingMainRaw); assert.deepEqual(metadataFiles.map(file => fs.readFileSync(file)), missingMainMetadata); assert.deepEqual(Object.fromEntries(Object.keys(missingMainAfter.files).map(file => [file, fs.statSync(path.join(f.repo, file)).mode & 0o777])), expectedMissingModes);
  const missingMainRetainedRefs = verifyMissingMainRefs(missingMainRefs, missingMainJournals, 'OWNERSHIP_AMBIGUOUS');
  const missingMainReopened = await GitLayers.open(f.repo), missingMainReopenedStatus = await missingMainReopened.status(); assert.equal(missingMainReopenedStatus.safe, false); assert.equal(missingMainReopenedStatus.error?.code, 'OWNERSHIP_AMBIGUOUS'); assert.equal((await missingMainReopened.files()).find(file => file.path === 'renamed-late-main.txt')!.owner, null);
  const missingMainResolutionReview = await missingMainReopened.ownershipReview(); await missingMainReopened.resolveOwnership({ token: missingMainResolutionReview.token, renames: [{ from: 'late-main.txt', to: 'renamed-late-main.txt' }] });
  assert.equal(f.native(['show', ':late-main.txt']), 'legitimate MAIN B staged'); assert.equal(f.read('renamed-late-main.txt'), 'legitimate MAIN C disk\n'); assert.equal((await missingMainReopened.files()).find(file => file.path === 'renamed-late-main.txt')!.owner, 'base');
  const beforeAllowedUnstageRefs = f.native(['for-each-ref', '--format=%(refname) %(objectname)']); await missingMainReopened.baseUnstage(['late-main.txt']);
  const afterAllowedUnstage = f.snapshot(), allowedWorkspace = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'workspace.json'), 'utf8'));
  assert.equal(f.native(['ls-files', '--stage', '--', 'late-main.txt']), ''); assert.equal(afterAllowedUnstage.index, missingMainBefore.index.split('\n').filter(line => !line.endsWith('\tlate-main.txt')).join('\n'));
  assert(!allowedWorkspace.baseReservations?.includes('late-main.txt')); assert(!allowedWorkspace.editing?.acceptedBase?.includes('late-main.txt')); assert(allowedWorkspace.baseReservations?.includes('renamed-late-main.txt'));
  assert.equal((await missingMainReopened.files()).find(file => file.path === 'renamed-late-main.txt')!.owner, 'base'); assert.equal((await missingMainReopened.status()).safe, true);
  const safeMissingMainReopened = await GitLayers.open(f.repo); assert.equal((await safeMissingMainReopened.status()).safe, true); assert.equal((await safeMissingMainReopened.files()).find(file => file.path === 'renamed-late-main.txt')!.owner, 'base');
  assert.equal(afterAllowedUnstage.head, missingMainBefore.head); assert.equal(afterAllowedUnstage.branchRefs, missingMainBefore.branchRefs); assert.deepEqual(semanticIndexes(afterAllowedUnstage.privateIndexes), semanticIndexes(missingMainBefore.privateIndexes)); assert.deepEqual(afterAllowedUnstage.files, expectedMissingFiles); assert.equal(f.native(['for-each-ref', '--format=%(refname) %(objectname)']), beforeAllowedUnstageRefs);
  assert.equal(f.read('late-main.txt'), null); assert.equal(f.read('renamed-late-main.txt'), 'legitimate MAIN C disk\n'); assert.equal(f.native(['cat-file', 'blob', missingMainBlob]), 'legitimate MAIN B staged');
  const beforeWrongLayerAdd = f.snapshot(), beforeWrongLayerRefs = new Map(f.native(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string])), beforeWrongLayerJournals = new Set(fs.readdirSync(path.join(f.app.dir, 'transactions')));
  await assert.rejects(safeMissingMainReopened.add('a', ['renamed-late-main.txt']), { code: 'OWNERSHIP' });
  const afterWrongLayerAdd = f.snapshot(); assert.equal(afterWrongLayerAdd.head, beforeWrongLayerAdd.head); assert.equal(afterWrongLayerAdd.branchRefs, beforeWrongLayerAdd.branchRefs); assert.equal(afterWrongLayerAdd.index, beforeWrongLayerAdd.index); assert.deepEqual(semanticIndexes(afterWrongLayerAdd.privateIndexes), semanticIndexes(beforeWrongLayerAdd.privateIndexes)); assert.deepEqual(afterWrongLayerAdd.files, beforeWrongLayerAdd.files);
  const wrongLayerRetainedRefs = verifyMissingMainRefs(beforeWrongLayerRefs, beforeWrongLayerJournals, 'OWNERSHIP'); assert.equal((await safeMissingMainReopened.status()).safe, true); assert.equal((await safeMissingMainReopened.files()).find(file => file.path === 'renamed-late-main.txt')!.owner, 'base');
  f.record('late ownership publication refuses and permits only explicit original-origin recovery', { lateFired, lateExternal, lateStatus, lateReopenedStatus, lateReview, lateResolutionReview, lateResolved, missingMainBefore, missingMainStatus, missingMainReview, missingMainAfter, missingMainRetainedRefs, missingMainReopenedStatus, missingMainResolutionReview, afterAllowedUnstage, allowedWorkspace, afterWrongLayerAdd, wrongLayerRetainedRefs });
});

test('P1 working Layer unstage routes retain MAIN origins across another target and guarded exit', { timeout: 900000 }, async t => {
  const f = await fixture(t, { layers: ['a', 'b'] }); f.verifyOwned();
  f.write('b.txt', 'b own B staged\n'); await f.app.add('b', ['b.txt']); f.write('b.txt', 'b own C disk\n');
  const stale = await GitLayers.open(f.repo); assert.equal(stale.repo.branch, 'main');
  await f.app.openLayerBranch('a'); await f.app.target('b');
  const names = ['working-alias.txt', 'working-base.txt'];
  for (const name of names) f.write(name, name + ' B native staged\n');
  f.native(['add', '-f', '--', ...names]); const nativeBlobs = Object.fromEntries(names.map(name => [name, f.native(['rev-parse', ':' + name])]));
  for (const name of names) f.write(name, name + ' C disk\n');
  const initial = await f.app.status(); assert.equal(initial.safe, false); assert.equal(initial.error?.code, 'EDITING_BASE_INTERFERENCE');
  for (const name of names) assert.equal((await f.app.files()).find(file => file.path === name)!.owner, 'base');
  const retainedPrivate = fs.readFileSync(f.privateIndex('a')), targetPrivate = fs.readFileSync(f.privateIndex('b'));
  const before = f.snapshot(); await stale.unstage('a', ['working-alias.txt']); await f.app.baseUnstage(['working-base.txt']);
  assert.equal(f.native(['diff', '--cached', '--name-only']), ''); assert.deepEqual(fs.readFileSync(f.privateIndex('a')), retainedPrivate);
  assert.deepEqual(fs.readFileSync(f.privateIndex('b')), targetPrivate);
  for (const name of names) { assert.equal((await f.app.files()).find(file => file.path === name)!.owner, 'base'); assert.equal(f.read(name), name + ' C disk\n'); }
  const observed = await f.app.status(); assert.equal(observed.safe, true); assert.equal(observed.role, 'layer-branch'); assert.equal(observed.branchLayer, 'a');
  assert(names.every(name => !observed.layers.find(layer => layer.name === 'b')!.reservations.includes(name)));
  const reopened = await GitLayers.open(f.repo); assert.equal((await reopened.status()).safe, true);
  for (const name of names) assert.equal((await reopened.files()).find(file => file.path === name)!.owner, 'base');
  const beforeWrongAdd = f.snapshot(); await assert.rejects(() => reopened.add('b', names), { code: 'OWNERSHIP' }); assert.deepEqual(f.snapshot(), beforeWrongAdd);
  await reopened.target(); const beforeExit = f.snapshot(), beforeMain = fs.readFileSync(path.join(f.repo, '.git', 'index'));
  await assert.rejects(() => reopened.switch('main'), { code: 'BASE_DIRTY' }); assert.deepEqual(f.snapshot(), beforeExit); assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git', 'index')), beforeMain);
  assert.equal(f.native(['symbolic-ref', '--short', 'HEAD']), 'layer/a'); assert.equal(f.native(['ls-tree', '-r', '--name-only', 'layer/b']), 'b.txt');
  await reopened.add('a', names); await reopened.commit('a', 'working Layer owns both native MAIN origins');
  for (const name of names) { assert.equal(f.native(['show', 'layer/a:' + name]), name + ' C disk'); assert.equal(f.native(['cat-file', 'blob', nativeBlobs[name]!]), name + ' B native staged'); }
  await reopened.switch('main'); const returned = await reopened.status(); assert.equal(returned.safe, true); assert.equal(returned.role, 'traditional');
  assert.equal(f.native(['symbolic-ref', '--short', 'HEAD']), 'main'); assert.equal(returned.layers.find(layer => layer.name === 'b')!.state, 'active');
  for (const name of names) { assert.equal((await reopened.files()).find(file => file.path === name)!.owner, 'a'); assert.equal(f.read(name), name + ' C disk\n'); }
  assert.equal(stale.repo.branch, 'layer/a');
  f.write('base.txt', 'base explicit B prepared on main\n'); f.native(['add', '--', 'base.txt']);
  const stagedBaseBlob = f.native(['rev-parse', ':base.txt']); f.write('base.txt', 'base explicit C disk on main\n');
  const beforeStaleCommit = f.snapshot(), mainBeforeStaleCommit = fs.readFileSync(path.join(f.repo, '.git', 'index'));
  await assert.rejects(() => stale.commit('a', 'must not commit the current base index'), { code: 'NOTHING_STAGED' });
  const afterStaleCommit = f.snapshot(), { privateIndexes: beforeStalePrivate, ...beforeStaleDomain } = beforeStaleCommit, { privateIndexes: afterStalePrivate, ...afterStaleDomain } = afterStaleCommit;
  assert.deepEqual(afterStaleDomain, beforeStaleDomain); assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git', 'index')), mainBeforeStaleCommit);
  const privateStages = (indexes: Record<string, unknown>) => Object.fromEntries(Object.entries(indexes).map(([name, value]) => [name, (value as { entries: string }).entries]));
  assert.deepEqual(privateStages(afterStalePrivate), privateStages(beforeStalePrivate));
  assert.equal(f.native(['show', ':base.txt']), 'base explicit B prepared on main'); assert.equal(f.read('base.txt'), 'base explicit C disk on main\n');
  f.record('stale Layer commit refuses the current main stage after role refresh', { before: beforeStaleCommit, after: afterStaleCommit, mainRawBeforeSHA256: digest(mainBeforeStaleCommit), mainRawAfterSHA256: digest(fs.readFileSync(path.join(f.repo, '.git', 'index'))) });
  const ownLayerCommit = f.native(['rev-parse', 'layer/a']); await reopened.baseStage(['base.txt']); await reopened.baseCommit('deliberately commit base C on main');
  assert.equal(f.native(['show', 'HEAD:base.txt']), 'base explicit C disk on main'); assert.equal(f.native(['rev-parse', 'layer/a']), ownLayerCommit);
  assert.equal(f.native(['cat-file', 'blob', stagedBaseBlob]), 'base explicit B prepared on main');
  assert.equal(f.native(['show', ':b.txt'], [0], { GIT_INDEX_FILE: f.privateIndex('b') }), 'b own B staged'); assert.equal(f.read('b.txt'), 'b own C disk\n');
  await reopened.commit('b', 'only b own staged B'); assert.equal(f.native(['ls-tree', '-r', '--name-only', 'layer/b']), 'b.txt'); assert.equal(f.native(['show', 'layer/b:b.txt']), 'b own B staged');
  f.verifyOwned(); await reopened.deactivate('b', { discard: true }); for (const name of names) assert.equal(f.read(name), name + ' C disk\n');
  f.record('both working Layer unstage routes retain current branch origin', { initial, before, observed, beforeExit, returned, after: f.snapshot() });
});
