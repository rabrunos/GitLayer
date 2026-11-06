import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { publishNewFile } from '../../src/core/publication.js';
import { fingerprint, listTransactions, sameFingerprint } from '../../src/core/storage.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit(), budget = { timeout: 180000 };
async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-scale-copy-failures');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit); let passed = false;
  t.after(() => {
    for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous);
    if (passed && previous.GL_STAGE2_PRESERVE_FIXTURES !== '1') cleanupFixture(owned);
    else t.diagnostic(JSON.stringify({ kind: 'retained-scale-copy-failure', ...owned }));
  });
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string) => cp.execFileSync(officialGit, args, { cwd: repo, env: { ...env, ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  native(['init', '-b', 'main']); fs.writeFileSync(path.join(repo, 'base.txt'), 'Base A\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base']);
  const target = path.join(repo, 'layer.txt'), expected = Buffer.from('Layer A committed bytes\n'.repeat(64)), seed = path.join(owned.root, 'seed.index');
  fs.writeFileSync(target, expected); native(['read-tree', '--empty'], seed); native(['add', '--', 'layer.txt'], seed);
  const tree = native(['write-tree'], seed), oid = native(['commit-tree', tree, '-m', 'layer']); native(['update-ref', 'refs/heads/layer/a', oid]); fs.unlinkSync(target);
  const app = await GitLayers.init(repo); await app.register('a');
  const layer = (await app.list()).find(entry => entry.name === 'a')!, index = path.join(app.dir, 'indexes', layer.id + '.index');
  const before = { head: native(['rev-parse', 'HEAD']), branches: native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']), states: native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/git-layers/state']), main: fs.readFileSync(app.repo.index), index: fs.readFileSync(index) };
  const unchanged = () => {
    assert.equal(native(['rev-parse', 'HEAD']), before.head); assert.equal(native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']), before.branches); assert.equal(native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/git-layers/state']), before.states);
    assert.deepEqual(fs.readFileSync(app.repo.index), before.main); assert.deepEqual(fs.readFileSync(index), before.index); assert.equal(native(['show', 'layer/a:layer.txt']), expected.toString().trimEnd());
  };
  return { owned, repo, target, expected, app, unchanged, native, success: () => { passed = true; } };
}

test('activation partial publication copy writes only an owned 17-byte prefix then simulated ENOSPC and preserves recovery evidence', budget, async t => {
  const f = await fixture(t), probe = await fsp.open(path.join(f.owned.root, 'descriptor-probe'), 'wx');
  const prototype = Object.getPrototypeOf(probe), writeFile = prototype.writeFile; await probe.close();
  let injected = false, partial = '';
  prototype.writeFile = async function (bytes: Buffer, ...args: any[]) {
    if (!injected && Buffer.isBuffer(bytes)) {
      const names = (await fsp.readdir(f.repo)).filter(name => name.startsWith('layer.txt.git-layer-'));
      if (names.length === 1) {
        const candidate = path.join(f.repo, names[0]!), target = await fsp.lstat(candidate), actual = await this.stat();
        if (target.isFile() && !target.isSymbolicLink() && target.dev === actual.dev && target.ino === actual.ino) {
          injected = true; partial = candidate; await writeFile.call(this, bytes.subarray(0, 17)); await this.sync();
          throw Object.assign(new Error('Fixture-only simulated full disk after real prefix write'), { code: 'ENOSPC' });
        }
      }
    }
    return writeFile.call(this, bytes, ...args);
  };
  try { await assert.rejects(f.app.on('a'), { code: 'ENOSPC' }); } finally { prototype.writeFile = writeFile; }
  assert(injected && partial); assert.equal(fs.existsSync(f.target), false); assert.deepEqual(fs.readFileSync(partial), f.expected.subarray(0, 17)); f.unchanged();
  const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1);
  const data = pending[0], journal = path.join(f.app.dir, 'transactions', data.id, 'journal.json'), journalBytes = fs.readFileSync(journal);
  const source = path.join(f.app.dir, 'transactions', data.id, 'materialized', 'layer.txt'); assert.deepEqual(fs.readFileSync(source), f.expected);
  const entry = data.recovery.files.find((item: any) => item.path === f.target); assert(entry && entry.before.exists === false && entry.after === undefined && entry.backup === null);
  assert(!data.backups.some((item: any) => item.copy === partial));
  for (const backup of data.backups) if (backup.copy) assert(sameFingerprint(await fingerprint(backup.copy), backup.fingerprint));
  const reopened = await GitLayers.open(f.repo);
  for (let i = 0; i < 2; i++) {
    await assert.rejects(reopened.recover(), { code: 'RECOVERY_CONFLICT' }); assert.deepEqual(fs.readFileSync(journal), journalBytes); assert.deepEqual(fs.readFileSync(partial), f.expected.subarray(0, 17)); assert.equal(fs.existsSync(f.target), false); f.unchanged();
  }
  assert.equal((await reopened.doctor()).safe, false);
  const exported = await reopened.exportRecovery(path.join(f.owned.root, 'export')); assert.equal(exported.complete, true);
  const manifest = JSON.parse(fs.readFileSync(exported.manifest, 'utf8')), retained = manifest.entries.find((item: any) => item.source === source);
  assert(retained); assert.deepEqual(fs.readFileSync(path.join(exported.destination, retained.path)), f.expected);
  assert(!manifest.entries.some((item: any) => item.source === partial), 'Adjacent workspace temporary is not automatically included in metadata export');
  t.diagnostic(JSON.stringify({ kind: 'publication-partial-copy', writtenPrefixBytes: 17, code: 'ENOSPC', actualDiskFull: false, publicTargetAbsent: true, repeatedRecoveryRefused: true })); f.success();
});

test('existing exclude rename syscall simulated EIO preserves original bytes and independent backup without false activation success', budget, async t => {
  const f = await fixture(t), exclude = f.app.repo.exclude, original = fsp.rename, before = fs.readFileSync(exclude);
  let injected = false;
  fsp.rename = async (from, to) => {
    if (!injected && path.resolve(String(to)) === exclude && String(from).startsWith(exclude + '.git-layer-')) { injected = true; throw Object.assign(new Error('Fixture-only simulated rename I/O error'), { code: 'EIO' }); }
    return original(from, to);
  };
  syncBuiltinESMExports();
  try { await assert.rejects(f.app.on('a'), { code: 'EIO' }); } finally { fsp.rename = original; syncBuiltinESMExports(); }
  assert(injected); assert.deepEqual(fs.readFileSync(exclude), before); assert.equal(fs.existsSync(f.target), false); f.unchanged();
  const folders = fs.readdirSync(path.join(f.app.dir, 'transactions')).map(id => path.join(f.app.dir, 'transactions', id));
  const journals = folders.map(folder => ({ folder, data: JSON.parse(fs.readFileSync(path.join(folder, 'journal.json'), 'utf8')) }));
  const failed = journals.find(item => item.data.kind === 'activate' && item.data.error?.code === 'EIO'); assert(failed);
  const backup = failed.data.backups.find((item: any) => item.source === exclude); assert(backup?.copy); assert.deepEqual(fs.readFileSync(backup.copy), before);
  assert.equal(failed.data.state, 'completed', 'A proved no-effect rollback can complete without claiming activation success');
  const reopened = await GitLayers.open(f.repo); assert.equal((await reopened.list()).find(layer => layer.name === 'a')!.state, 'inactive'); assert.equal((await reopened.doctor()).safe, true);
  assert.deepEqual((await reopened.recover()).recovered, []); f.unchanged();
  t.diagnostic(JSON.stringify({ kind: 'existing-metadata-rename-error', code: 'EIO', simulated: true, existingBytesPreserved: true, activationReturnedSuccess: false, rollbackCompleted: true })); f.success();
});

async function assertNewFixtureParent(parent: string): Promise<void> {
  const absolute = path.resolve(parent), real = await fsp.realpath(absolute);
  assert.equal(path.resolve(real), absolute); const stat = await fsp.lstat(absolute); assert(stat.isDirectory() && !stat.isSymbolicLink());
  for (let current = absolute; ; current = path.dirname(current)) {
    const currentStat = await fsp.lstat(current); assert(currentStat.isDirectory() && !currentStat.isSymbolicLink());
    try { await fsp.lstat(path.join(current, '.git')); throw new Error('Fixture parent is inside an existing Git repository'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (path.dirname(current) === current) break;
  }
}

test('real distinct Windows C and D volumes refuse both rename and no-replace publication without copying or destroying source', { ...budget, skip: process.platform !== 'win32' }, async t => {
  const parentC = fs.realpathSync(os.tmpdir()), parentD = 'D:\\';
  await assertNewFixtureParent(parentC);
  try { await assertNewFixtureParent(parentD); }
  catch (error) { if (['ENOENT', 'ENODEV', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) { t.skip('D volume unavailable to this execution: ' + (error as NodeJS.ErrnoException).code); return; } throw error; }
  const ownedC = createFixture(parentC, 'gl-scale2b-volume-c'); let ownedD: ReturnType<typeof createFixture> | undefined, passed = false;
  t.after(() => {
    if (passed && process.env.GL_STAGE2_PRESERVE_FIXTURES !== '1') { if (ownedD) cleanupFixture(ownedD); cleanupFixture(ownedC); }
    else t.diagnostic(JSON.stringify({ kind: 'retained-cross-volume-fixtures', fixtures: [ownedC, ...(ownedD ? [ownedD] : [])] }));
  });
  // Node mkdirSync(existingDriveRoot, {recursive:true}) can return EPERM on
  // Windows. The root was already checked above: reserve a fresh child directly
  // and use the same ownership-marker protocol as createFixture/cleanupFixture.
  const rootD = fs.mkdtempSync(path.join(parentD, 'gl-scale2b-volume-d-')), nonce = randomUUID();
  ownedD = { root: rootD, nonce, parent: fs.realpathSync(parentD) };
  fs.writeFileSync(path.join(rootD, '.git-compat-owned.json'), JSON.stringify({ nonce, parent: ownedD.parent }) + '\n', { flag: 'wx' });
  const statC = fs.lstatSync(ownedC.root), statD = fs.lstatSync(ownedD.root); assert.notEqual(statC.dev, statD.dev, 'Drive letters must resolve to physically distinct volume identities for this probe');
  const source = path.join(ownedC.root, 'source.bin'), destination = path.join(ownedD.root, 'destination.bin'); fs.writeFileSync(source, Buffer.alloc(4097, 0x6d), { flag: 'wx' });
  const handle = fs.openSync(source, 'r+'); try { fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
  const expected = await fingerprint(source);
  await assert.rejects(fsp.rename(source, destination), { code: 'EXDEV' }); assert.deepEqual(await fingerprint(source), expected); assert.equal(fs.existsSync(destination), false);
  await assert.rejects(publishNewFile(source, destination, expected), { code: 'EXDEV' }); assert.deepEqual(await fingerprint(source), expected); assert.equal(fs.existsSync(destination), false); assert.equal(fs.lstatSync(source).nlink, 1);
  t.diagnostic(JSON.stringify({ kind: 'real-cross-volume-refusal', distinctVolumeIdentities: true, renameCode: 'EXDEV', publicationCode: 'EXDEV', simulated: false, sourcePreserved: true, destinationAbsent: true })); passed = true;
});