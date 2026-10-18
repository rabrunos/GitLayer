import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { atomicJSON, failpoint, fingerprint, listTransactions, readJSON, sameFingerprint, Transaction, withLock } from '../../src/core/storage.js';

async function temporary(t: TestContext): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-layers-storage-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('storage creates nested metadata through native and namespace Windows paths', async t => {
  const dir = await temporary(t);
  const native = path.join(dir, 'metadados ação', 'novos', 'registry.json');
  await atomicJSON(native, { schema: 1, preserved: 'bytes reais' });
  assert.equal((await readJSON<any>(native)).preserved, 'bytes reais');
  const namespaced = path.toNamespacedPath(path.join(dir, 'outros', 'níveis', 'workspace.json'));
  await atomicJSON(namespaced, { schema: 1, created: true });
  assert.equal((await readJSON<any>(namespaced)).created, true);
  assert.deepEqual((await fs.readdir(path.dirname(native))).sort(), ['registry.json']);
});

test('storage publishes valid JSON and refuses invalid/future schemas without changing bytes', async t => {
  const dir = await temporary(t);
  const file = path.join(dir, 'metadata.json');
  await atomicJSON(file, { schema: 1, text: 'espaços e acentuação' });
  assert.equal((await readJSON<any>(file)).text, 'espaços e acentuação');
  await assert.rejects(() => readJSON(file, value => value.text === 'outro'), { code: 'METADATA_INVALID' });
  await atomicJSON(file, { schema: 2, preserve: true });
  const before = await fs.readFile(file);
  await assert.rejects(() => readJSON(file), { code: 'METADATA_INVALID' });
  assert.deepEqual(await fs.readFile(file), before);
  await fs.writeFile(file, '{broken JSON');
  await assert.rejects(() => readJSON(file), { code: 'METADATA_INVALID' });
  assert.equal(await fs.readFile(file, 'utf8'), '{broken JSON');
});

test('transaction backups retain binary bytes, executable mode and explicit missing markers', async t => {
  const dir = await temporary(t);
  const source = path.join(dir, 'working.bin');
  const contents = Buffer.from([0, 255, 65, 13, 10]);
  await fs.writeFile(source, contents);
  await fs.chmod(source, 0o755);
  const tx = await Transaction.begin(path.join(dir, 'metadata'), 'backup-test', {});
  const backup = await tx.backup(source, 'working');
  assert.ok(backup && path.isAbsolute(backup));
  assert.deepEqual(await fs.readFile(backup), contents);
  assert.equal(sameFingerprint(await fingerprint(source), await fingerprint(backup)), true);
  assert.equal(await tx.backup(path.join(dir, 'absent'), 'absent'), null);
  const journal = await readJSON<any>(path.join(tx.dir, 'journal.json'));
  assert.equal(journal.backups[1].fingerprint.exists, false);
  assert.equal(journal.backups[1].copy, null);
});

test('journals retain mutable recovery plans and distinguish pending, failed and completed', async t => {
  const dir = await temporary(t);
  const tx = await Transaction.begin(dir, 'state-test', { before: 'original' });
  tx.data.recovery = { files: [], beforeRegistry: { schema: 1, layers: [] } };
  await tx.record('prepared', { count: 0 });
  assert.deepEqual((await listTransactions(dir))[0].recovery.files, []);
  await tx.fail(new Error('failure for verification'));
  const pending = await listTransactions(dir);
  assert.equal(pending[0].state, 'recovery-required');
  assert.equal(pending[0].error.message, 'failure for verification');
  await tx.finish();
  assert.deepEqual(await listTransactions(dir), []);
  assert.equal((await readJSON<any>(path.join(tx.dir, 'journal.json'))).state, 'completed');
});

test('coordinator rejects concurrent processes and releases only its own completed lock', async t => {
  const dir = await temporary(t);
  const storageURL = pathToFileURL(path.resolve(fileURLToPath(new URL('../../src/core/storage.ts', import.meta.url)))).href;
  const childSource = `import { withLock } from ${JSON.stringify(storageURL)}; try { await withLock(${JSON.stringify(dir)}, async () => {}); process.exitCode=9; } catch (error) { if(error.code !== 'LOCKED') throw error; console.log(error.code); }`;
  await withLock(dir, async () => {
    await assert.rejects(() => withLock(dir, async () => 1), { code: 'LOCKED' });
    const child = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', childSource], { cwd: process.cwd() });
    assert.equal(child.stdout.trim(), 'LOCKED');
    const owner = await readJSON<any>(path.join(dir, 'locks', 'coordinator', 'owner.json'));
    assert.equal(owner.pid, process.pid);
  });
  await assert.rejects(() => fs.lstat(path.join(dir, 'locks', 'coordinator')), { code: 'ENOENT' });
  assert.equal(await withLock(dir, async () => 42), 42);
});

test('existing coordinator lock and changed ownership are preserved', async t => {
  const dir = await temporary(t);
  const lock = path.join(dir, 'locks', 'coordinator');
  await fs.mkdir(lock, { recursive: true });
  await fs.writeFile(path.join(lock, 'inspect-me'), 'stale owner evidence');
  await assert.rejects(() => withLock(dir, async () => 1), { code: 'LOCKED' });
  assert.equal(await fs.readFile(path.join(lock, 'inspect-me'), 'utf8'), 'stale owner evidence');
  await fs.rm(lock, { recursive: true });
  await assert.rejects(() => withLock(dir, async () => {
    await atomicJSON(path.join(lock, 'owner.json'), { schema: 1, token: 'external-owner' });
  }), { code: 'LOCK_CHANGED' });
  assert.equal((await readJSON<any>(path.join(lock, 'owner.json'))).token, 'external-owner');
});

test('lock cleanup preserves the original failure and still releases an unchanged own lock', async t => {
  const dir = await temporary(t);
  const expected = new Error('original operation failure');
  await assert.rejects(() => withLock(dir, async () => { throw expected; }), error => error === expected);
  assert.equal(await withLock(dir, async () => 'released'), 'released');
});

test('storage refuses symlink sources, destinations and parent directories', async t => {
  const dir = await temporary(t);
  const real = path.join(dir, 'real');
  await fs.mkdir(real);
  const source = path.join(real, 'file');
  await fs.writeFile(source, 'original');
  const leaf = path.join(dir, 'leaf');
  const parent = path.join(dir, 'parent');
  try { await fs.symlink(source, leaf); await fs.symlink(real, parent, 'dir'); }
  catch (error) {
    if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('Windows account cannot create symlinks.'); return; }
    throw error;
  }
  const tx = await Transaction.begin(path.join(dir, 'metadata'), 'link-test', {});
  await assert.rejects(() => fingerprint(leaf), { code: 'UNSAFE_PATH' });
  await assert.rejects(() => tx.backup(leaf, 'leaf'), { code: 'UNSAFE_PATH' });
  await assert.rejects(() => atomicJSON(leaf, { schema: 1 }), { code: 'UNSAFE_PATH' });
  await assert.rejects(() => atomicJSON(path.join(parent, 'new.json'), { schema: 1 }), { code: 'UNSAFE_PATH' });
  assert.equal(await fs.readFile(source, 'utf8'), 'original');
});

test('invalid journals remain visible as errors and failpoints match explicit step names', async t => {
  const dir = await temporary(t);
  const tx = await Transaction.begin(dir, 'invalid-journal', {});
  await atomicJSON(path.join(tx.dir, 'journal.json'), { schema: 8, id: tx.id });
  await assert.rejects(() => listTransactions(dir), { code: 'METADATA_INVALID' });
  const previous = process.env.GIT_LAYERS_FAILPOINT;
  try {
    process.env.GIT_LAYERS_FAILPOINT = 'before-stage,after-commit';
    assert.throws(() => failpoint('after-commit'), { code: 'INJECTED_FAILURE' });
    failpoint('other-step');
  } finally {
    if (previous === undefined) delete process.env.GIT_LAYERS_FAILPOINT;
    else process.env.GIT_LAYERS_FAILPOINT = previous;
  }
});
