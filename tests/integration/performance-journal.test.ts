import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test, { type TestContext } from 'node:test';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { Transaction, fingerprint, readJSON, sameFingerprint, type TrackedRecoveryFile } from '../../src/core/storage.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

async function fixture(t: TestContext) {
  const owned = createFixture(fsSync.realpathSync(os.tmpdir()), 'gl-performance-journal');
  const previous = { ...process.env }, preserve = previous.GL_STAGE2_PRESERVE_FIXTURES === '1';
  t.after(async () => {
    try {
      if (preserve) {
        const stat = await fs.lstat(owned.root), markerFile = path.join(owned.root, '.git-compat-owned.json');
        assert(stat.isDirectory() && !stat.isSymbolicLink()); assert(!(await fs.lstat(markerFile)).isSymbolicLink());
        const marker = JSON.parse(await fs.readFile(markerFile, 'utf8'));
        assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
        assert.equal(await fs.realpath(path.dirname(owned.root)), owned.parent); assert.equal(path.dirname(await fs.realpath(owned.root)), owned.parent);
        const receipt = { schema: 1, test: t.name, ...owned, retained: true, policy: 'GL_STAGE2_PRESERVE_FIXTURES=1; retain regardless of test outcome' };
        t.diagnostic(JSON.stringify({ kind: 'retained-performance-fixture', ...receipt }));
        await fs.writeFile(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
      } else cleanupFixture(owned);
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  });
  const env = isolatedEnvironment(owned.root, resolveGit());
  if (preserve) env.GL_STAGE2_PRESERVE_FIXTURES = '1';
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const source = path.join(owned.root, 'source.bin'), bytes = Buffer.alloc(1024 * 1024 + 29, 0x39);
  await fs.writeFile(source, bytes, { flag: 'wx' });
  const tx = await Transaction.begin(path.join(owned.root, 'metadata'), 'tracked-backup-storage-boundary', {}), files: TrackedRecoveryFile[] = [];
  // These tests certify the storage publication boundary. Core recovery plans
  // with real Git state are exercised separately by performance-journal-recovery.
  tx.data.recovery = { files };
  await tx.record('fixture-prepared');
  const journal = path.join(tx.dir, 'journal.json'), internal = tx as any, persist = internal.persist;
  let persists = 0;
  internal.persist = async function () { persists++; return persist.call(this); };
  return { owned, source, bytes, tx, files, journal, internal, persists: () => persists };
}

test('tracked journal keeps default backup durable for present and absent sources', async t => {
  const f = await fixture(t), before = await fingerprint(f.source);
  const backup = await f.tx.backup(f.source, 'default-present'); assert(backup);
  assert.deepEqual(await fingerprint(backup), before); assertBytesEqual(await fs.readFile(backup), f.bytes, 'performance-journal.test.ts byte preservation'); assert.equal((await fs.lstat(backup)).nlink, 1);
  const first = await readJSON<any>(f.journal);
  assert.equal(f.persists(), 1); assert.equal(first.backups.length, 1); assert.equal(first.backups[0].source, f.source); assert.equal(first.backups[0].copy, backup); assert.deepEqual(first.backups[0].fingerprint, before);
  const absent = path.join(f.owned.root, 'absent.bin');
  assert.equal(await f.tx.backup(absent, 'default-absent'), null);
  const second = await readJSON<any>(f.journal);
  assert.equal(f.persists(), 2); assert.equal(second.backups.length, 2); assert.equal(second.backups[1].source, absent); assert.equal(second.backups[1].copy, null); assert.deepEqual(second.backups[1].fingerprint, { exists: false, hash: '', mode: 0 });
  assert.deepEqual(second.recovery.files, []); assert.deepEqual(second.steps.map((step: any) => step.step), ['fixture-prepared']);
  await fs.writeFile(f.source, 'later independent bytes\n'); assertBytesEqual(await fs.readFile(backup), f.bytes, 'performance-journal.test.ts byte preservation');
});

test('tracked backup publishes both shared arrays durably with one journal persistence per file', async t => {
  const f = await fixture(t), before = await fingerprint(f.source);
  const present = await f.tx.backupTracked(f.source, 'tracked-present', before, f.files);
  assert.strictEqual(f.tx.data.recovery.files, f.files); assert.strictEqual(present, f.files[0]); assert(present.backup);
  assert.notStrictEqual(present.before, before); assert.deepEqual(present.before, before); assert.deepEqual(await fingerprint(present.backup), before);
  assert.equal(f.persists(), 1);
  const first = await readJSON<any>(f.journal);
  assert.deepEqual(first.recovery.files, f.files); assert.equal(first.backups.length, 1); assert.equal(first.backups[0].copy, present.backup); assert.deepEqual(first.backups[0].fingerprint, present.before); assert.equal(first.steps.at(-1).step, 'backup-ready'); assert.equal(first.steps.at(-1).details.path, f.source);
  const absent = path.join(f.owned.root, 'absent.bin'), absence = await fingerprint(absent);
  const missing = await f.tx.backupTracked(absent, 'tracked-absent', absence, f.files);
  assert.strictEqual(missing, f.files[1]); assert.equal(missing.backup, null); assert.equal(f.persists(), 2);
  const second = await readJSON<any>(f.journal);
  assert.deepEqual(second.recovery.files, f.files); assert.equal(second.backups.length, 2); assert.deepEqual(second.backups[1].fingerprint, absence); assert.equal(second.backups[1].copy, null); assert.equal(second.steps.filter((step: any) => step.step === 'backup-ready').length, 2);
  assertBytesEqual(await fs.readFile(f.source), f.bytes, 'performance-journal.test.ts byte preservation'); assert.equal((await fs.lstat(present.backup)).nlink, 1);
});

test('tracked backup rejects a source changed since its before observation and retains unregistered evidence', async t => {
  const f = await fixture(t), before = await fingerprint(f.source), baselineJournal = await fs.readFile(f.journal);
  await fs.writeFile(f.source, 'external later source bytes\n');
  await assert.rejects(f.tx.backupTracked(f.source, 'changed-source', before, f.files), { code: 'EXTERNAL_EDIT' });
  assert.equal(f.persists(), 0); assertBytesEqual(await fs.readFile(f.journal), baselineJournal, 'performance-journal.test.ts byte preservation'); assert.deepEqual(f.tx.data.backups, []); assert.deepEqual(f.files, []);
  assert.equal(await fs.readFile(f.source, 'utf8'), 'external later source bytes\n');
  const folder = path.join(f.tx.dir, 'backups'), orphaned = await fs.readdir(folder); assert.equal(orphaned.length, 1);
  assert.equal(await fs.readFile(path.join(folder, orphaned[0]!), 'utf8'), 'external later source bytes\n');
});

for (const damage of ['changed', 'missing'] as const) test('tracked backup refuses a ' + damage + ' prepared copy without publishing recovery authority', async t => {
  const f = await fixture(t), before = await fingerprint(f.source), originalBackup = await f.tx.backup(f.source, 'original'); assert(originalBackup);
  const baselineJournal = await fs.readFile(f.journal), persistsBefore = f.persists(), prepare = f.internal.prepareBackup;
  let prepared: string | undefined;
  f.internal.prepareBackup = async function (file: string, label: string) {
    const entry = await prepare.call(this, file, label); assert(entry.copy); prepared = entry.copy;
    if (damage === 'changed') await fs.writeFile(entry.copy, 'external backup tamper\n'); else await fs.unlink(entry.copy);
    return entry;
  };
  try { await assert.rejects(f.tx.backupTracked(f.source, 'prepared-' + damage, before, f.files), { code: 'EXTERNAL_EDIT' }); }
  finally { f.internal.prepareBackup = prepare; }
  assert(prepared); assert.equal(f.persists(), persistsBefore); assertBytesEqual(await fs.readFile(f.journal), baselineJournal, 'performance-journal.test.ts byte preservation');
  assert.deepEqual(f.files, []); assert.equal(f.tx.data.backups.length, 1); assert.equal(f.tx.data.backups[0].copy, originalBackup);
  assert.deepEqual(await fingerprint(f.source), before); assertBytesEqual(await fs.readFile(originalBackup), f.bytes, 'performance-journal.test.ts byte preservation');
  if (damage === 'changed') assert.equal(await fs.readFile(prepared, 'utf8'), 'external backup tamper\n'); else await assert.rejects(fs.lstat(prepared), { code: 'ENOENT' });
  const retry = await f.tx.backupTracked(f.source, 'independent-retry', before, f.files);
  assert(retry.backup && retry.backup !== prepared && retry.backup !== originalBackup); assert.equal(f.persists(), persistsBefore + 1);
  assertBytesEqual(await fs.readFile(retry.backup), f.bytes, 'performance-journal.test.ts byte preservation'); assertBytesEqual(await fs.readFile(originalBackup), f.bytes, 'performance-journal.test.ts byte preservation');
  const durable = await readJSON<any>(f.journal); assert.deepEqual(durable.recovery.files, f.files); assert.equal(durable.backups.length, 2); assert(!durable.backups.some((entry: any) => entry.copy === prepared));
});

test('tracked backup refuses a detached array or duplicate path before preparing another copy', async t => {
  const f = await fixture(t), before = await fingerprint(f.source), baselineJournal = await fs.readFile(f.journal);
  await assert.rejects(f.tx.backupTracked(f.source, 'detached', before, []), { code: 'RECOVERY_INVALID' });
  assert.equal(f.persists(), 0); assertBytesEqual(await fs.readFile(f.journal), baselineJournal, 'performance-journal.test.ts byte preservation'); await assert.rejects(fs.lstat(path.join(f.tx.dir, 'backups')), { code: 'ENOENT' });
  const relative = path.relative(process.cwd(), f.source), tracked = await f.tx.backupTracked(relative, 'canonical', before, f.files);
  assert.equal(tracked.path, f.source); assert.equal((await readJSON<any>(f.journal)).steps.at(-1).details.path, f.source);
  const preparedJournal = await fs.readFile(f.journal), backupNames = await fs.readdir(path.join(f.tx.dir, 'backups'));
  await assert.rejects(f.tx.backupTracked(f.source, 'duplicate', before, f.files), { code: 'RECOVERY_INVALID' });
  assert.equal(f.persists(), 1); assertBytesEqual(await fs.readFile(f.journal), preparedJournal, 'performance-journal.test.ts byte preservation'); assert.deepEqual(await fs.readdir(path.join(f.tx.dir, 'backups')), backupNames); assert.equal(f.files.length, 1);
});

test('tracked backup validates present and absent observations before attaching a plan', async t => {
  const f = await fixture(t), before = await fingerprint(f.source), baselineJournal = await fs.readFile(f.journal);
  await fs.unlink(f.source);
  await assert.rejects(f.tx.backupTracked(f.source, 'disappeared-source', before, f.files), { code: 'EXTERNAL_EDIT' });
  assert.equal(f.persists(), 0); assertBytesEqual(await fs.readFile(f.journal), baselineJournal, 'performance-journal.test.ts byte preservation'); assert.deepEqual(f.tx.data.backups, []); assert.deepEqual(f.files, []);
  const absent = await fingerprint(f.source); await fs.writeFile(f.source, f.bytes);
  await assert.rejects(f.tx.backupTracked(f.source, 'appeared-source', absent, f.files), { code: 'EXTERNAL_EDIT' });
  assert.equal(f.persists(), 0); assertBytesEqual(await fs.readFile(f.journal), baselineJournal, 'performance-journal.test.ts byte preservation'); assert.deepEqual(f.tx.data.backups, []); assert.deepEqual(f.files, []);
  assert(sameFingerprint(await fingerprint(f.source), before)); assertBytesEqual(await fs.readFile(f.source), f.bytes, 'performance-journal.test.ts byte preservation');
});
