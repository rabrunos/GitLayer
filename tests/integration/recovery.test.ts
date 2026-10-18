import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { validateRecovery } from '../../src/core/recovery.js';
import { fingerprint, Transaction } from '../../src/core/storage.js';

async function plan(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'git-layers-recovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const gitDir = path.join(root, '.git');
  await fs.mkdir(path.join(gitDir, 'info'), { recursive: true });
  const repo = { root, gitDir, index: path.join(gitDir, 'index'), exclude: path.join(gitDir, 'info', 'exclude') };
  const dir = path.join(gitDir, 'git-layers');
  const source = path.join(root, 'notes.txt');
  await fs.writeFile(source, 'original\n');
  const before = await fingerprint(source);
  const tx = await Transaction.begin(dir, 'recovery-test', {});
  const backup = await tx.backup(source, 'original');
  await fs.writeFile(source, 'applied write\n');
  const after = await fingerprint(source);
  tx.data.recovery = {
    beforeRegistry: { schema: 1, layers: [] },
    beforeWorkspace: { schema: 1, branch: 'main', head: '' },
    files: [{ path: source, before, after, backup }],
  };
  await tx.record('prepared');
  return { root, repo, dir, source, tx, backup: backup! };
}

test('recovery validator accepts an exact journal and its intact durable backup', async t => {
  const f = await plan(t);
  await validateRecovery(f.repo, f.dir, f.tx.data);
  assert.equal(await fs.readFile(f.source, 'utf8'), 'applied write\n');
  assert.equal(await fs.readFile(f.backup, 'utf8'), 'original\n');
});

test('changed or missing recovery backup causes refusal before any write', async t => {
  const f = await plan(t);
  await fs.writeFile(f.backup, 'tampered backup');
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_CONFLICT' });
  assert.equal(await fs.readFile(f.source, 'utf8'), 'applied write\n');
  await fs.unlink(f.backup);
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_CONFLICT' });
  assert.equal(await fs.readFile(f.source, 'utf8'), 'applied write\n');
});

test('recovery refuses paths outside workspace and backups outside its own transaction', async t => {
  const f = await plan(t);
  const entry = f.tx.data.recovery.files[0];
  const originalPath = entry.path;
  entry.path = path.join(path.dirname(f.root), 'unrelated-private-file');
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_INVALID' });
  entry.path = originalPath;
  entry.backup = f.source;
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_INVALID' });
  assert.equal(await fs.readFile(f.source, 'utf8'), 'applied write\n');
});

test('recovery rejects malformed plans, duplicate paths and unsafe prior registry identifiers', async t => {
  const f = await plan(t);
  const saved = structuredClone(f.tx.data);
  f.tx.data.recovery.files[0].before.hash = 'invalid';
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_INVALID' });
  f.tx.data = structuredClone(saved);
  f.tx.data.recovery.files.push(structuredClone(f.tx.data.recovery.files[0]));
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_INVALID' });
  f.tx.data = structuredClone(saved);
  f.tx.data.recovery.beforeRegistry.layers = [{ id: '../../escape' }];
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_INVALID' });
  f.tx.data = structuredClone(saved);
  f.tx.data.id = '../../escape';
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_INVALID' });
});

test('recovery cannot overwrite journals, arbitrary Git internals or symlink targets', async t => {
  const f = await plan(t);
  const entry = f.tx.data.recovery.files[0];
  const original = entry.path;
  entry.path = path.join(f.tx.dir, 'journal.json');
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'PROTECTED_PATH' });
  entry.path = path.join(f.repo.gitDir, 'HEAD');
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'PROTECTED_PATH' });
  entry.path = original;
  await fs.unlink(original);
  try { await fs.symlink(f.backup, original); }
  catch (error) {
    if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('Windows account cannot create symlinks.'); return; }
    throw error;
  }
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'UNSAFE_PATH' });
  assert.equal(await fs.readFile(f.backup, 'utf8'), 'original\n');
});

test('recovery commit references must match the recorded traditional branch and prior OID', async t => {
  const f = await plan(t);
  f.tx.data.recovery.commit = { base: true, ref: 'refs/heads/other', old: '', new: '1234abcdef' };
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_INVALID' });
  f.tx.data.recovery.commit.ref = 'refs/heads/main';
  await validateRecovery(f.repo, f.dir, f.tx.data);
  f.tx.data.recovery.commit.old = 'ffff';
  await assert.rejects(() => validateRecovery(f.repo, f.dir, f.tx.data), { code: 'RECOVERY_INVALID' });
});
