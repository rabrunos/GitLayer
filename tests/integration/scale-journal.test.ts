import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import { Transaction, readJSON, readTransaction, listTransactions, fingerprint, decodeIncrementalJournal, type TrackedRecoveryFile } from '../../src/core/storage.js';
import { createFixture, cleanupFixture } from '../../scripts/git-compat/lib.mjs';

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function fixture(t: TestContext) {
  const owned = createFixture(fsSync.realpathSync(os.tmpdir()), 'gl-scale-journal');
  let passed = false;
  t.after(() => {
    if (passed) cleanupFixture(owned);
    else t.diagnostic(JSON.stringify({ retained: true, reason: 'assertions-did-not-complete', ...owned }));
  });
  const metadata = path.join(owned.root, 'metadata'), tx = await Transaction.begin(metadata, 'scale-journal-fixture', {});
  const files: TrackedRecoveryFile[] = []; tx.data.recovery = { files, identity: 'before' }; await tx.record('prepared');
  const journal = path.join(tx.dir, 'journal.json'), log = path.join(tx.dir, 'events.log');
  return { owned, metadata, tx, files, journal, log, success: () => { passed = true; } };
}

test('journal v2 records exact paired BEFORE and AFTER with one durable event per existing barrier', async t => {
  const f = await fixture(t), file = path.join(f.owned.root, 'file.txt');
  const tracked = await f.tx.backupTracked(file, 'file', await fingerprint(file), f.files);
  const before = await readJSON<any>(f.journal); assert.deepEqual(before.recovery.files, f.files); assert.equal(before.steps.at(-1).step, 'backup-ready');
  await fs.writeFile(file, 'actual physical bytes\n'); tracked.after = await fingerprint(file); await f.tx.recordFileWrite(tracked);
  const manifest = JSON.parse(await fs.readFile(f.journal, 'utf8')); assert.equal(manifest.schema, 2);
  const raw = await fs.readFile(f.log, 'utf8'), lines = raw.trimEnd().split('\n'); assert.equal(lines.length, 3);
  let previous = sha(manifest.base);
  for (const [index, line] of lines.entries()) {
    const { checksum, ...event } = JSON.parse(line);
    assert.equal(event.id, f.tx.id); assert.equal(event.sequence, index + 1); assert.equal(event.previous, previous); assert.equal(checksum, sha(event)); previous = checksum;
  }
  const decoded = await readTransaction(f.metadata, f.tx.id); assert.deepEqual(decoded, f.tx.data);
  assert.equal(decoded.backups.length, 1); assert.equal(decoded.recovery.files.length, 1); assert.equal(decoded.steps.at(-1).step, 'write-completed');
  assert.equal((await listTransactions(f.metadata)).length, 1);
  const original = await fs.readFile(f.log); await f.tx.finish(); assert.equal(JSON.parse(await fs.readFile(f.journal, 'utf8')).schema, 1);
  assert.equal((await listTransactions(f.metadata)).length, 0); assert((await fs.readFile(f.log)).subarray(0, original.length).equals(original));
  assert.deepEqual(await readTransaction(f.metadata, f.tx.id), f.tx.data); f.success();
});

for (const damage of ['partial', 'complete-suffix', 'empty', 'checksum', 'reorder', 'duplicate', 'transaction', 'missing'] as const) test('journal v2 conservatively refuses ' + damage + ' without rewriting evidence', async t => {
  const f = await fixture(t); await f.tx.record('second');
  const lines = (await fs.readFile(f.log, 'utf8')).trimEnd().split('\n');
  let damaged: string;
  if (damage === 'partial') damaged = lines.join('\n') + '\n{"schema":1';
  else if (damage === 'complete-suffix') damaged = lines[0] + '\n';
  else if (damage === 'empty') damaged = '';
  else if (damage === 'checksum') { const event = JSON.parse(lines[1]!); event.payload.data.kind = 'tampered'; lines[1] = JSON.stringify(event); damaged = lines.join('\n') + '\n'; }
  else if (damage === 'reorder') damaged = [lines[1], lines[0]].join('\n') + '\n';
  else if (damage === 'duplicate') damaged = [lines[0], lines[0], lines[1]].join('\n') + '\n';
  else if (damage === 'transaction') { const event = JSON.parse(lines[1]!); event.id = 'different-transaction'; const { checksum, ...signed } = event; event.checksum = sha(signed); lines[1] = JSON.stringify(event); damaged = lines.join('\n') + '\n'; }
  else damaged = '';
  if (damage === 'missing') await fs.unlink(f.log); else await fs.writeFile(f.log, damaged);
  const journal = await fs.readFile(f.journal), bytes = damage === 'missing' ? null : await fs.readFile(f.log);
  if (damage === 'missing') await assert.rejects(readTransaction(f.metadata, f.tx.id), { code: 'METADATA_INVALID' });
  else await assert.rejects(readTransaction(f.metadata, f.tx.id), { code: 'METADATA_INVALID' });
  assert((await fs.readFile(f.journal)).equals(journal)); if (bytes) assert((await fs.readFile(f.log)).equals(bytes));
  await assert.rejects(f.tx.record('cannot-hide-damage'), { code: 'METADATA_INVALID' });
  assert((await fs.readFile(f.journal)).equals(journal)); f.success();
});

test('journal v2 partial ENOSPC append poisons the writer and preserves the damaged tail for inspection', async t => {
  const f = await fixture(t), probe = await fs.open(path.join(f.owned.root, 'probe'), 'wx');
  const prototype = Object.getPrototypeOf(probe), original = prototype.write; await probe.close();
  let injected = false;
  prototype.write = async function (buffer: Buffer, offset: number, length: number, position: number | null) {
    if (!injected) { injected = true; await original.call(this, buffer, offset, Math.min(17, length), position); throw Object.assign(new Error('fixture-only simulated full disk'), { code: 'ENOSPC' }); }
    return original.call(this, buffer, offset, length, position);
  };
  try { await assert.rejects(f.tx.record('not-durable'), { code: 'ENOSPC' }); } finally { prototype.write = original; }
  assert(injected); const log = await fs.readFile(f.log), journal = await fs.readFile(f.journal);
  await assert.rejects(f.tx.fail(new Error('cannot checkpoint partial append')), { code: 'METADATA_INVALID' });
  await assert.rejects(readTransaction(f.metadata, f.tx.id), { code: 'METADATA_INVALID' });
  assert((await fs.readFile(f.log)).equals(log)); assert((await fs.readFile(f.journal)).equals(journal)); f.success();
});

test('journal v2 generic snapshots retain arbitrary recovery changes and failure checkpoints retain all events', async t => {
  const f = await fixture(t), file = path.join(f.owned.root, 'file');
  await fs.writeFile(file, 'A'); const tracked = await f.tx.backupTracked(file, 'file', await fingerprint(file), f.files);
  f.tx.data.recovery.identity = 'changed'; f.tx.data.recovery.acknowledgements = { revoked: ['known'], pending: [] };
  await f.tx.record('acknowledgement-revoked'); assert.deepEqual(await readJSON(f.journal), f.tx.data);
  await fs.writeFile(file, 'C'); tracked.after = await fingerprint(file); await f.tx.recordFileWrite(tracked);
  await f.tx.fail(Object.assign(new Error('fixture interruption'), { code: 'INJECTED_FAILURE' }));
  const checkpoint=JSON.parse(await fs.readFile(f.journal,'utf8'));assert.equal(checkpoint.schema,2);assert.equal(checkpoint.format,'git-layer-journal-checkpoint-v2'); assert.deepEqual(await readJSON(f.journal), f.tx.data);
  assert.equal((await fs.readFile(f.log, 'utf8')).trimEnd().split('\n').length, 4); assert.equal(await fs.readFile(tracked.backup!, 'utf8'), 'A'); assert.equal(await fs.readFile(file, 'utf8'), 'C'); f.success();
});

test('journal v2 per-file byte growth is linear and the pure codec does not mutate its manifest', { timeout: 120000 }, async t => {
  const f = await fixture(t); let at100 = 0;
  for (let i = 0; i < 200; i++) {
    const file = path.join(f.owned.root, 'absent-' + String(i).padStart(3, '0'));
    const tracked = await f.tx.backupTracked(file, 'file-' + i, { exists: false, hash: '', mode: 0 }, f.files);
    tracked.after = { exists: true, hash: 'a'.repeat(64), mode: 0o666 }; await f.tx.recordFileWrite(tracked);
    if (i === 99) at100 = (await fs.stat(f.log)).size;
  }
  const at200 = (await fs.stat(f.log)).size; assert(at200 < at100 * 2.1, 'Doubling paths must not quadruple journal bytes');
  const manifest = JSON.parse(await fs.readFile(f.journal, 'utf8')), raw = JSON.stringify(manifest), log = await fs.readFile(f.log);
  const decoded = decodeIncrementalJournal(manifest, log, await fs.readFile(path.join(f.tx.dir, 'events.tip'))); assert.deepEqual(decoded, f.tx.data); assert.equal(JSON.stringify(manifest), raw);
  assert.equal((f.tx as any).logicalBytes, Buffer.byteLength(JSON.stringify(f.tx.data, null, 2) + '\n'), 'Incremental size preserves the exact legacy pretty-JSON budget');
  assert.equal(decoded.recovery.files.length, 200); t.diagnostic(JSON.stringify({ paths100: at100, paths200: at200, byteRatio: at200 / at100, actualPowerLoss: false })); f.success();
});

test('legacy schema1 journals remain readable and are never rewritten by inspection', async t => {
  const f = await fixture(t); await f.tx.finish(); const original = await fs.readFile(f.journal);
  await fs.unlink(f.log); assert.deepEqual(await readTransaction(f.metadata, f.tx.id), f.tx.data); assert.deepEqual(await listTransactions(f.metadata), []);
  assert((await fs.readFile(f.journal)).equals(original)); f.success();
});

test('journal checkpoints keep rollback writes protected after fail and checkpoint writes after finish durable', async t => {
  const f = await fixture(t), file = path.join(f.owned.root, 'file');
  await fs.writeFile(file, 'A'); const tracked = await f.tx.backupTracked(file, 'file', await fingerprint(file), f.files);
  await f.tx.fail(new Error('controlled failure')); const log = await fs.readFile(f.log), tip = await fs.readFile(path.join(f.tx.dir, 'events.tip'));
  await fs.writeFile(file, 'rollback image'); tracked.after = await fingerprint(file); await f.tx.recordFileWrite(tracked);
  assert.equal(JSON.parse(await fs.readFile(f.journal,'utf8')).schema,2,'Old readers must refuse a failed new transaction with mandatory recovery guards');
  assert.deepEqual(await readJSON(f.journal), f.tx.data);
  await f.tx.finish(); await fs.writeFile(file, 'postfinish index checkpoint'); tracked.after = await fingerprint(file); await f.tx.recordFileWrite(tracked);
  assert.deepEqual(await readJSON(f.journal), f.tx.data); assert.equal((await readJSON<any>(f.journal)).steps.at(-1).step, 'write-completed');
  assert((await fs.readFile(f.log)).equals(log)); assert((await fs.readFile(path.join(f.tx.dir, 'events.tip'))).equals(tip)); f.success();
});

test('first tracked path captures a recovery plan attached before any generic step', async t => {
  const f = await fixture(t), tx = await Transaction.begin(f.metadata, 'initial-revocation-fixture', {}), files: TrackedRecoveryFile[] = [];
  tx.data.recovery = { files, acknowledgements: { revoked: ['known'], pending: [] } };
  await tx.backupTracked(path.join(f.owned.root, 'absent'), 'absent', { exists: false, hash: '', mode: 0 }, files);
  assert.deepEqual(await readTransaction(f.metadata, tx.id), tx.data); assert.equal((await readJSON<any>(path.join(tx.dir, 'journal.json'))).recovery.acknowledgements.revoked[0], 'known'); f.success();
});

for (const damage of ['torn', 'missing', 'foreign'] as const) test('journal v2 refuses a ' + damage + ' durable watermark and preserves log', async t => {
  const f = await fixture(t), file = path.join(f.tx.dir, 'events.tip'), log = await fs.readFile(f.log), manifest = await fs.readFile(f.journal);
  if (damage === 'missing') await fs.unlink(file);
  else if (damage === 'torn') { const bytes = await fs.readFile(file); bytes[34] ^= 1; await fs.writeFile(file, bytes); }
  else { const value = JSON.parse(await fs.readFile(file, 'utf8')); value.id = 'other-transaction'; const { checksum, ...signed } = value; value.checksum = sha(signed); await fs.writeFile(file, JSON.stringify(value).padEnd(512, ' ')); }
  await assert.rejects(readTransaction(f.metadata, f.tx.id), { code: 'METADATA_INVALID' });
  assert((await fs.readFile(f.log)).equals(log)); assert((await fs.readFile(f.journal)).equals(manifest)); f.success();
});

test('journal v2 fails closed when log is flushed but watermark permission fails', async t => {
  const f = await fixture(t), file = path.join(f.tx.dir, 'events.tip'), tip = await fs.readFile(file), journal = await fs.readFile(f.journal);
  const probe = await fs.open(path.join(f.owned.root, 'prototype-probe'), 'wx'), prototype = Object.getPrototypeOf(probe), original = prototype.write; await probe.close();
  let injected = false;
  prototype.write = async function (buffer: Buffer, offset: number, length: number, position: number | null) {
    if (buffer.length === 512) { injected = true; throw Object.assign(new Error('fixture-only permission failure before watermark write'), { code: 'EACCES' }); }
    return original.call(this, buffer, offset, length, position);
  };
  try { await assert.rejects(f.tx.record('unanchored-flushed-event'), { code: 'EACCES' }); } finally { prototype.write = original; }
  assert(injected); assert.equal((await fs.readFile(f.log, 'utf8')).trimEnd().split('\n').length, 2);
  await assert.rejects(readTransaction(f.metadata, f.tx.id), { code: 'METADATA_INVALID' }); await assert.rejects(f.tx.fail(new Error('must preserve evidence')), { code: 'METADATA_INVALID' });
  assert((await fs.readFile(file)).equals(tip)); assert((await fs.readFile(f.journal)).equals(journal)); f.success();
});

test('journal v2 preserves all Core non-file recovery barriers before further typed deltas', async t => {
  const f = await fixture(t), file = path.join(f.owned.root, 'file'), tracked = await f.tx.backupTracked(file, 'file', await fingerprint(file), f.files);
  for (const [field, value, step] of [
    ['directories', [{ path: path.join(f.owned.root, 'directory'), mode: 0o700 }], 'directory-removal-planned'],
    ['acknowledgements', { revoked: ['known'], pending: [] }, 'acknowledgement-materialization-completed'],
    ['switch', { from: 'main', to: 'develop', snapshots: [] }, 'switch-prepared'],
    ['commit', { ref: 'refs/heads/layer/a', old: 'a'.repeat(40), new: 'b'.repeat(40) }, 'commit-prepared']
  ] as const) {
    f.tx.data.recovery[field] = value; await f.tx.record(step); assert.deepEqual(await readJSON(f.journal), f.tx.data);
    tracked.after = { exists: true, hash: 'c'.repeat(64), mode: 0o666 }; await f.tx.recordFileWrite(tracked); assert.deepEqual(await readJSON(f.journal), f.tx.data);
    assert.equal((f.tx as any).logicalBytes, Buffer.byteLength(JSON.stringify(f.tx.data, null, 2) + '\n'));
  }
  f.success();
});

for (const component of ['journal.json', 'events.log', 'events.tip'] as const) test('journal completion cannot hide external changes to ' + component, async t => {
  const f = await fixture(t), file = path.join(f.tx.dir, component);
  await fs.appendFile(file, 'external'); const bytes = await fs.readFile(file), journal = await fs.readFile(f.journal);
  await assert.rejects(f.tx.finish(), { code: 'METADATA_INVALID' });
  assert((await fs.readFile(file)).equals(bytes)); assert((await fs.readFile(f.journal)).equals(journal)); f.success();
});

for(const damage of ['payload','checksum'] as const)test('failed inline v2 checkpoint refuses '+damage+' corruption and old readers cannot accept its schema',async t=>{
  const f=await fixture(t);await f.tx.fail(new Error('controlled failed checkpoint'));const value=JSON.parse(await fs.readFile(f.journal,'utf8'));
  assert.equal(value.schema,2);assert.equal(value.format,'git-layer-journal-checkpoint-v2');assert.deepEqual(await readJSON(f.journal),f.tx.data);
  if(damage==='payload')value.recovery.identity='tampered';else value.checksum='f'.repeat(64);
  await fs.writeFile(f.journal,JSON.stringify(value,null,2)+'\n');const bytes=await fs.readFile(f.journal);
  await assert.rejects(readTransaction(f.metadata,f.tx.id),{code:'METADATA_INVALID'});assert((await fs.readFile(f.journal)).equals(bytes));f.success();
});
