import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { doctorRepository } from '../../src/core/rescue.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const evidenceRoot = process.env.GL_SECURITY_BASE_ORIGIN_EVIDENCE;
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
function fixtureParent() {
  const parent = path.resolve(os.tmpdir());
  for (let cursor = parent; ; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor); assert(stat.isDirectory() && !stat.isSymbolicLink());
    assert(!fs.existsSync(path.join(cursor, '.git')), 'Fixtures must be outside repositories');
    if (path.dirname(cursor) === cursor) break;
  }
  return fs.realpathSync(parent);
}
async function fixture(t: TestContext) {
  const owned = createFixture(fixtureParent(), 'gl-base-origin');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const events: unknown[] = [];
  const git = (args: string[], index?: string) => {
    const stdout = execFileSync(officialGit, args, { cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    events.push({ kind: 'git', executable: officialGit, args, index: index ? path.basename(index) : 'main', code: 0, stdout }); return stdout.trimEnd();
  };
  const write = (file: string, bytes: string) => fs.writeFileSync(path.join(repo, file), bytes);
  const read = (file: string) => fs.readFileSync(path.join(repo, file), 'utf8');
  git(['init', '-b', 'main']); git(['config', 'core.autocrlf', 'false']);
  git(['config', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null']);
  write('base.txt', 'base A committed\n'); git(['add', '--', 'base.txt']); git(['commit', '-m', 'base']);
  const originalHead = git(['rev-parse', 'HEAD']); let app = await GitLayers.init(repo);
  const workspace = () => JSON.parse(fs.readFileSync(path.join(app.dir, 'workspace.json'), 'utf8'));
  const layerIndex = (name: string) => { const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8')); return path.join(app.dir, 'indexes', registry.layers.find((l: any) => l.name === name).id + '.index'); };
  const domain = () => {
    const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
    return { head: git(['rev-parse', 'HEAD']), branch: git(['symbolic-ref', 'HEAD']), branches: git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']),
      stateRefs: git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/git-layers/state/']), mainIndex: git(['ls-files', '--stage']), mainRaw: hash(fs.readFileSync(app.repo.index)),
      layerIndexes: Object.fromEntries(registry.layers.map((l: any) => [l.name, { semantic: git(['ls-files', '--stage'], layerIndex(l.name)), raw: hash(fs.readFileSync(layerIndex(l.name))) }])),
      files: Object.fromEntries(fs.readdirSync(repo).filter(n => n !== '.git').sort().map(n => { const stat = fs.lstatSync(path.join(repo, n)); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1); const b = fs.readFileSync(path.join(repo, n)); return [n, { sha256: hash(b), bytes: b.length, mode: stat.mode & 0o777 }]; })) };
  };
  const record = (label: string, value: unknown) => events.push({ kind: 'observation', label, value });
  const capture = (label: string) => { const value = { ...domain(), allRefs: git(['for-each-ref', '--format=%(refname) %(objectname)']), workspace: workspace(), registry: JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8')), exclude: fs.readFileSync(app.repo.exclude, 'utf8') }; record(label, value); return value; };
  const reopen = async () => { app = await GitLayers.open(repo); return app; };
  const owner = async (file: string) => (await app.files()).find(entry => entry.path === file)?.owner;
  const resetMixed = (revision = originalHead) => {
    const marker = JSON.parse(fs.readFileSync(path.join(owned.root, '.git-compat-owned.json'), 'utf8'));
    assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
    assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent);
    assert.equal(path.dirname(fs.realpathSync(repo)), fs.realpathSync(owned.root));
    git(['reset', '--mixed', revision]);
  };
  const prepare = async () => {
    for (const name of ['a', 'b']) { await app.create(name); await app.on(name); write(name + '.txt', name + ' A committed\n'); await app.add(name, [name + '.txt']); await app.commit(name, 'seed ' + name); write(name + '.txt', name + ' B staged\n'); await app.add(name, [name + '.txt']); write(name + '.txt', name + ' C disk\n'); }
    write('base.txt', 'base B staged\n'); git(['add', '--', 'base.txt']); write('base.txt', 'base C disk\n');
    await app.target('b'); assert.equal((await app.renameFile('base.txt', 'moved.txt')).owner, 'base');
    await app.baseStage(['base.txt', 'moved.txt']); await app.baseCommit('base rename');
    assert(workspace().editing.acceptedBase.includes('moved.txt'));
    write('moved.txt', 'base D disk only\n');
    assert.equal((await app.status()).safe, true); await reopen(); assert.equal((await app.status()).safe, true);
    assert(!fs.readFileSync(app.repo.exclude, 'utf8').split(/\r?\n/).includes('!/moved.txt'), 'Exercise the normal refreshed exclusion, not an incidental stale exemption');
    capture('accepted base before native reset');
  };
  t.after(() => {
    try { capture('final'); if (evidenceRoot) { fs.mkdirSync(evidenceRoot, { recursive: true }); fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/gu, '_') + '.json'), JSON.stringify({ test: t.name, fixture: owned.root, officialGit, gitVersion: git(['--version']), node: process.version, platform: process.platform, events }, null, 2) + '\n'); } }
    finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); if (!evidenceRoot && process.env.GL_SECURITY_KEEP_FIXTURES !== '1') cleanupFixture(owned); }
  });
  return { get app() { return app; }, repo, write, read, git, originalHead, workspace, layerIndex, domain, capture, record, reopen, owner, resetMixed, prepare };
}

test('D01 accepted base rename survives mixed reset without Layer staging commit or discard transfer', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.prepare(); f.resetMixed(); const before = f.capture('after native reset');
  assert.equal(await f.owner('moved.txt'), 'base'); assert.equal((await f.app.status()).safe, true);
  await f.reopen(); assert.equal(await f.owner('moved.txt'), 'base');
  await assert.rejects(f.app.add('b', ['moved.txt']), { code: 'OWNERSHIP' }); assert.deepEqual(f.domain(), beforeDomain(before));
  await f.app.commit('b', 'only b staged payload'); assert.equal(f.git(['ls-tree', '-r', '--name-only', 'layer/b']), 'b.txt');
  assert.equal(f.git(['show', 'layer/b:b.txt']), 'b B staged'); assert.equal(f.read('moved.txt'), 'base D disk only\n');
  await f.app.deactivate('b', { discard: true }); assert.equal(f.read('moved.txt'), 'base D disk only\n');
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('a')), before.layerIndexes.a.semantic); assert.equal(f.read('a.txt'), 'a C disk\n');
  await f.app.baseStage(['base.txt', 'moved.txt']); await f.app.baseCommit('recover deliberate base rename');
  assert.equal(f.git(['show', 'HEAD:moved.txt']), 'base D disk only'); assert.equal(f.git(['ls-tree', '-r', '--name-only', 'layer/b']), 'b.txt');
});
function beforeDomain(value: ReturnType<Awaited<ReturnType<typeof fixture>>['capture']>) { const { allRefs, workspace, registry, exclude, ...domain } = value; return domain; }

test('D01 absent accepted base rename requires explicit resolution after mixed reset', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.prepare(); f.resetMixed();
  // Simulate contradictory metadata left by an older coordinator. Independent
  // rescue must see the same explicit base provenance as the normal Core.
  const registryPath = path.join(f.app.dir, 'registry.json'), originalRegistry = fs.readFileSync(registryPath);
  const originalWorkspace = fs.readFileSync(path.join(f.app.dir, 'workspace.json')), untouched = f.domain();
  const contradicted = JSON.parse(originalRegistry.toString('utf8'));
  contradicted.layers.find((layer: any) => layer.name === 'b').reservations.push('moved.txt');
  fs.writeFileSync(registryPath, JSON.stringify(contradicted, null, 2) + '\n');
  try {
    await f.reopen(); await assert.rejects(f.app.files(), { code: 'PATH_COLLISION' });
    const rescue = await doctorRepository(f.repo), ownership = rescue.checks.find(check => check.name === 'Propriedade e exclusões efetivas');
    assert(ownership); assert.equal(ownership.ok, false); assert.equal((ownership.detail as any).code, 'PATH_COLLISION'); assert.equal(rescue.safe, false);
    assert(fs.readFileSync(path.join(f.app.dir, 'workspace.json')).equals(originalWorkspace));
    assert.deepEqual(f.domain(), untouched); f.record('independent rescue refuses contradictory accepted base ownership', rescue);
  } finally { fs.writeFileSync(registryPath, originalRegistry); await f.reopen(); }
  assert.deepEqual(f.domain(), untouched);
  fs.renameSync(path.join(f.repo, 'moved.txt'), path.join(f.repo, 'external.txt'));
  const before = f.capture('external rename before any reconciliation'); const status = await f.app.status(); assert.equal(status.safe, false);
  const review = await f.app.ownershipReview(); assert(review.ambiguous); assert(review.missing.some(p => p.path === 'moved.txt' && p.owner === 'base')); assert(review.candidates.includes('external.txt'));
  for (const action of [() => f.app.add('b', ['external.txt']), () => f.app.commit('b', 'must refuse'), () => f.app.deactivate('b', { discard: true })]) { await assert.rejects(action(), { code: 'OWNERSHIP_AMBIGUOUS' }); assert.deepEqual(f.domain(), beforeDomain(before)); }
  const fresh = await f.app.ownershipReview(); await f.app.resolveOwnership({ token: fresh.token, renames: [{ from: 'moved.txt', to: 'external.txt' }] });
  assert.deepEqual(f.domain(), beforeDomain(before)); assert.equal(await f.owner('external.txt'), 'base');
  await f.reopen(); assert.equal((await f.app.status()).safe, true); await f.app.baseStage(['base.txt', 'external.txt']); await f.app.baseCommit('explicit external base rename');
  assert.equal(f.git(['show', 'HEAD:external.txt']), 'base D disk only'); assert.equal(f.git(['ls-tree', '-r', '--name-only', 'layer/b']), 'b.txt');
});

test('D01 accepted base ownership survives target change edit end and restart after mixed reset', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.prepare(); f.git(['update-ref', 'refs/heads/main', f.originalHead]); const before = f.capture('HEAD changed while MAIN still represents accepted base');
  await f.app.target('a'); assert.equal(await f.owner('moved.txt'), 'base'); assert(f.workspace().baseReservations.includes('moved.txt'));
  await f.app.target(); f.resetMixed(); await f.reopen(); assert.equal(await f.owner('moved.txt'), 'base'); assert.equal((await f.app.status()).safe, true);
  await f.app.target('b'); f.write('ordinary.txt', 'genuinely new under b\n'); assert.equal((await f.app.status()).safe, true);
  assert.equal(await f.owner('ordinary.txt'), 'b'); assert.equal(await f.owner('moved.txt'), 'base');
  assert.deepEqual(f.domain().layerIndexes, before.layerIndexes); assert.equal(f.git(['show', ':base.txt']), 'base A committed'); assert.equal(f.read('moved.txt'), 'base D disk only\n');
});

test('D01 accepted base ownership survives target deactivation and removal after mixed reset', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.prepare(); f.resetMixed(); const before = f.capture('before deactivation');
  await f.app.deactivate('b', { discard: true }); await f.reopen(); assert.equal(await f.owner('moved.txt'), 'base'); assert.equal(f.workspace().editing, undefined); assert.equal(f.read('moved.txt'), 'base D disk only\n');
  await f.app.on('b'); await f.app.target('b'); f.write('native.txt', 'native base accepted\n'); f.git(['add', '-f', '--', 'native.txt']);
  const review = await f.app.ownershipReview(); assert(review.externalBase.includes('native.txt')); await f.app.resolveOwnership({ token: review.token, acceptBase: ['native.txt'] });
  await f.app.baseCommit('native base explicit acceptance'); await f.app.status(); await f.reopen(); await f.app.status(); f.resetMixed();
  const beforeRemove = f.capture('before target removal'); await f.app.removeLayer('b', { discard: true }); await f.reopen();
  assert.equal(await f.owner('native.txt'), 'base'); assert.equal(await f.owner('moved.txt'), 'base'); assert.equal(f.workspace().editing, undefined);
  assert.equal(f.read('native.txt'), 'native base accepted\n'); assert.equal(f.read('moved.txt'), 'base D disk only\n'); assert.equal(f.read('a.txt'), 'a C disk\n');
  assert.equal(f.domain().mainIndex, beforeRemove.mainIndex); assert.deepEqual(f.domain().layerIndexes.a, before.layerIndexes.a); assert.equal(f.git(['for-each-ref', '--format=%(refname)', 'refs/heads/layer/b']), '');
});

test('D01 explicit release rename and deletion retire accepted base markers safely', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.prepare(); f.resetMixed(); await f.app.status(); const before = f.capture('before explicit release');
  await f.app.release('base', ['moved.txt']); assert(!f.workspace().baseReservations?.includes('moved.txt')); assert(!f.workspace().editing.acceptedBase?.includes('moved.txt'));
  assert.equal((await f.app.status()).safe, true); assert.equal(await f.owner('moved.txt'), null); assert.deepEqual(f.domain(), beforeDomain(before));
  f.write('p.txt', 'new native base path\n'); f.git(['add', '-f', '--', 'p.txt']); const review = await f.app.ownershipReview(); await f.app.resolveOwnership({ token: review.token, acceptBase: ['p.txt'] });
  await f.app.baseUnstage(['p.txt']); assert.equal(await f.owner('p.txt'), 'base'); await f.app.renameFile('p.txt', 'q.txt');
  assert(!f.workspace().editing.acceptedBase?.includes('p.txt')); assert(!f.workspace().baseReservations?.includes('p.txt')); assert.equal(await f.owner('q.txt'), 'base');
  f.write('p.txt', 'independent new p under b\n'); assert.equal((await f.app.status()).safe, true); assert.equal(await f.owner('p.txt'), 'b');
  await f.app.deleteFile('q.txt', true); assert(!f.workspace().baseReservations?.includes('q.txt')); assert(!f.workspace().editing.acceptedBase?.includes('q.txt'));
  f.write('q.txt', 'independent new q under b\n'); await f.reopen(); assert.equal((await f.app.status()).safe, true); assert.equal(await f.owner('q.txt'), 'b'); assert.equal(f.read('moved.txt'), 'base D disk only\n');
});

test('D01 clean tracked accepted base creates no phantom reservation on compatible switch', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.prepare(); await f.app.baseStage(['moved.txt']); await f.app.baseCommit('base disk D deliberately committed');
  const main = f.git(['rev-parse', 'HEAD']); await f.app.target(); assert(!f.workspace().baseReservations?.includes('moved.txt'));
  f.git(['branch', 'develop', f.originalHead]); const before = f.capture('before compatible managed switch'); await f.app.switch('develop');
  assert(!fs.existsSync(path.join(f.repo, 'moved.txt'))); assert(!f.workspace().baseReservations?.includes('moved.txt')); assert.deepEqual(f.domain().layerIndexes, before.layerIndexes);
  assert.equal(f.read('a.txt'), 'a C disk\n'); assert.equal(f.read('b.txt'), 'b C disk\n'); assert.equal(f.git(['show', main + ':moved.txt']), 'base D disk only');
  await f.app.target('b'); f.write('moved.txt', 'new creation on develop under b\n'); assert.equal((await f.app.status()).safe, true); assert.equal(await f.owner('moved.txt'), 'b');
});
