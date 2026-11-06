// Directed public storage API regression; not Git or API-performance certification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';

import { fingerprint, copyRegular, readJSON, Transaction } from '../../src/core/storage.js';
import { project, createFixture, cleanupFixture } from '../../scripts/git-compat/lib.mjs';
import { externalFixtureParent } from '../../scripts/git-compat/fixture-parent.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const changedMessage = 'O arquivo mudou durante a leitura; a operação foi interrompida.';
const identity = file => {
  const stat = fs.lstatSync(file, { bigint: true });
  return { dev: String(stat.dev), ino: String(stat.ino), nlink: Number(stat.nlink), size: Number(stat.size), mode: Number(stat.mode), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs) };
};
function fixture(t) {
  const owned = createFixture(externalFixtureParent(project), 'gl-storage-buffer'), directory = owned.root, preserve = process.env.GL_STAGE2_PRESERVE_FIXTURES === '1';
  const events = []; let complete = false;
  t.after(() => {
    const markerFile = path.join(directory, '.git-compat-owned.json'), entry = fs.lstatSync(directory), marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
    assert(entry.isDirectory() && !entry.isSymbolicLink()); assert.equal(fs.lstatSync(markerFile).isSymbolicLink(), false);
    assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent); assert.equal(fs.realpathSync(path.dirname(directory)), owned.parent);
    if (preserve || !complete) {
      fs.writeFileSync(path.join(directory, 'RETENTION-RECEIPT.json'), JSON.stringify({ schema: 1, test: t.name, ...owned, complete, events, qualification: 'Real owned storage files; no Git execution or result mocks.', policy: preserve ? 'GL_STAGE2_PRESERVE_FIXTURES=1; retain passed and failed fixtures' : 'Retain failed or incomplete fixtures' }, null, 2) + '\n', { flag: 'wx' });
      t.diagnostic(JSON.stringify({ kind: 'retained-storage-buffer-fixture', test: t.name, ...owned, complete }));
    } else cleanupFixture(owned);
  });
  return { directory, events, complete: () => { complete = true; } };
}

function source(f, bytes) {
  const file = path.join(f.directory, 'source.bin'); fs.writeFileSync(file, bytes, { flag: 'wx' }); return file;
}
async function withActualReads(file, hook, operation) {
  const originalOpen = fs.promises.open; let ordinal = 0;
  fs.promises.open = async function (input, ...values) {
    const handle = await originalOpen.call(this, input, ...values);
    if (path.resolve(String(input)) === path.resolve(file)) {
      const actualRead = handle.read.bind(handle);
      handle.read = (...args) => hook({ ordinal: ++ordinal, args, actualRead });
    }
    return handle;
  };
  syncBuiltinESMExports();
  try { return await operation(); }
  finally { fs.promises.open = originalOpen; syncBuiltinESMExports(); }
}
const expectChanged = file => error => error.code === 'EXTERNAL_CHANGE' && error.message === changedMessage && assert.deepEqual(error.details, { path: file }) === undefined;

for (const bytes of [0, 1, 7, 511, 512, 4095, 8191, 262143, 262144, 262145, 524305]) test('stable independent hash and source identity for ' + bytes + ' bytes', async t => {
  const f = fixture(t), payload = Buffer.alloc(bytes); for (let index = 0; index < payload.length; index++) payload[index] = (index * 29 + 17) % 251;
  const file = source(f, payload), before = identity(file), requests = [];
  const result = await withActualReads(file, async ({ args, actualRead }) => { requests.push(args[2]); return actualRead(...args); }, () => fingerprint(file));
  assert.equal(result.exists, true); assert.equal(result.hash, digest(payload)); assert(fs.readFileSync(file).equals(payload)); assert.deepEqual(identity(file), before);
  assert(requests.every(length => length > 0 && length <= 262144), 'Nonzero reads retain the established 256KiB cap');
  if (bytes >= 262144) assert.equal(requests[0], 262144, 'Large-file cap is unchanged');
  f.events.push({ inputBytes: bytes, independentSHA256: digest(payload), requestedReadLengths: requests, sourcePreserved: true }); f.complete();
});

for (const operation of ['fingerprint', 'copy']) test(operation + ' accepts genuine partial OS reads without losing bytes', async t => {
  const f = fixture(t), payload = Buffer.from('seventeen bytes!!'), file = source(f, payload), destination = path.join(f.directory, 'destination.bin'), requests = [];
  const result = await withActualReads(file, async ({ args, actualRead }) => { const short = [...args]; short[2] = Math.min(3, short[2]); const value = await actualRead(...short); requests.push({ requested: short[2], actual: value.bytesRead }); return value; }, () => operation === 'fingerprint' ? fingerprint(file) : copyRegular(file, destination));
  assert.equal(result.hash, digest(payload)); assert(fs.readFileSync(file).equals(payload)); if (operation === 'copy') assert(fs.readFileSync(destination).equals(payload));
  assert(requests.some(read => read.actual > 0)); assert.equal(requests.at(-1).actual, 0); f.events.push({ operation, realPartialReads: requests, hash: result.hash }); f.complete();
});

for (const initial of ['', 'tiny B\n']) for (const operation of ['fingerprint', 'copy']) test(operation + ' rejects real growth from ' + (initial ? 'tiny' : 'empty') + ' before consuming extra bytes', async t => {
  const f = fixture(t), payload = Buffer.from(initial), file = source(f, payload), destination = path.join(f.directory, 'destination.bin'), extra = Buffer.alloc(1024 * 1024, 0x43); let injected = false;
  await assert.rejects(withActualReads(file, async ({ ordinal, args, actualRead }) => { if (ordinal === 1) { fs.appendFileSync(file, extra); injected = true; } return actualRead(...args); }, () => operation === 'fingerprint' ? fingerprint(file) : copyRegular(file, destination)), expectChanged(file));
  assert(injected); assert(fs.readFileSync(file).equals(Buffer.concat([payload, extra])));
  if (operation === 'copy') assert(fs.readFileSync(destination).equals(payload), 'The private copy must not consume bytes beyond the original observed size');
  f.events.push({ initialBytes: payload.length, growthBytes: extra.length, sourceGrowthRetained: true, earlyError: 'EXTERNAL_CHANGE', copiedBytes: operation === 'copy' ? fs.statSync(destination).size : null }); f.complete();
});

for (const afterFirstRead of [false, true]) test('real truncation ' + (afterFirstRead ? 'after' : 'before') + ' the first read retains the existing change diagnosis', async t => {
  const f = fixture(t), payload = Buffer.from('known B bytes\n'), file = source(f, payload); let injected = false;
  await assert.rejects(withActualReads(file, async ({ ordinal, args, actualRead }) => {
    if (ordinal === 1 && !afterFirstRead) { fs.truncateSync(file, 0); injected = true; }
    const result = await actualRead(...args);
    if (ordinal === 1 && afterFirstRead) { fs.truncateSync(file, 0); injected = true; }
    return result;
  }, () => fingerprint(file)), expectChanged(file));
  assert(injected); assert.equal(fs.statSync(file).size, 0); f.events.push({ sourceTruncationRetained: true, error: 'EXTERNAL_CHANGE' }); f.complete();
});

test('replacement between real pre-open lstat and open is diagnosed without consuming or replacing foreign C', async t => {
  const f = fixture(t), payload = Buffer.from('original B\n'), replacementBytes = Buffer.from('external C\n'), file = source(f, payload), replacement = path.join(f.directory, 'foreign.bin'), originalOpen = fs.promises.open; let replaced;
  fs.writeFileSync(replacement, replacementBytes, { flag: 'wx' });
  fs.promises.open = async function(input, ...values) { if (path.resolve(String(input)) === file && !replaced) { fs.renameSync(replacement, file); replaced = identity(file); } return originalOpen.call(this, input, ...values); }; syncBuiltinESMExports();
  try { await assert.rejects(fingerprint(file), error => error.code === 'EXTERNAL_CHANGE' && error.message === 'O arquivo mudou enquanto era aberto.' && assert.deepEqual(error.details, { path: file }) === undefined); }
  finally { fs.promises.open = originalOpen; syncBuiltinESMExports(); }
  assert(replaced); assert(fs.readFileSync(file).equals(replacementBytes)); assert.deepEqual(identity(file), replaced); f.events.push({ replacementPreserved: true, replacementSHA256: digest(replacementBytes), race: 'after-real-lstat-before-real-open', error: 'EXTERNAL_CHANGE' }); f.complete();
});

test('public copyRegular creates independent files and later edits to either side stay independent', async t => {
  const f = fixture(t), payload = Buffer.from('independent B\n'), file = source(f, payload), destination = path.join(f.directory, 'destination.bin'), before = await fingerprint(file), copied = await copyRegular(file, destination);
  assert.equal(copied.hash, digest(payload)); assert.equal(copied.mode, before.mode); assert(fs.readFileSync(file).equals(payload)); assert(fs.readFileSync(destination).equals(payload));
  const a = identity(file), b = identity(destination); assert.equal(a.nlink, 1); assert.equal(b.nlink, 1); assert(a.dev !== b.dev || a.ino !== b.ino);
  fs.writeFileSync(file, 'source C\n'); assert(fs.readFileSync(destination).equals(payload)); fs.writeFileSync(destination, 'destination D\n'); assert.equal(fs.readFileSync(file, 'utf8'), 'source C\n');
  f.events.push({ independentBytesAndInodes: true, copiedHash: copied.hash, copiedMode: copied.mode }); f.complete();
});

for (const growDuringRead of [false, true]) test('the real 512-byte metadata cap keeps priority for ' + (growDuringRead ? 'growth crossing both checks' : 'an oversized snapshot'), async t => {
  const f = fixture(t), tx = await Transaction.begin(f.directory, 'prepared-buffer-cap', {}), journal = path.join(tx.dir, 'journal.json'), tip = path.join(tx.dir, 'events.tip');
  assert.equal(fs.statSync(tip).size, 512); if (!growDuringRead) fs.appendFileSync(tip, 'X');
  const operation = () => readJSON(journal);
  const invoke = growDuringRead ? () => withActualReads(tip, async ({ ordinal, args, actualRead }) => { if (ordinal === 1) fs.appendFileSync(tip, 'X'); return actualRead(...args); }, operation) : operation;
  await assert.rejects(invoke(), error => error.code === 'METADATA_INVALID' && error.details?.maxBytes === 512 && error.details?.path === tip);
  assert.equal(fs.statSync(tip).size, 513); f.events.push({ actualCap: 512, observedSize: 513, error: 'METADATA_INVALID', noFallbackOrRepair: true }); f.complete();
});

test('synthetic ENOSPC after a real owned prefix preserves source and precise partial copy evidence', async t => {
  const f = fixture(t), payload = Buffer.from('source B must survive\n'), file = source(f, payload), destination = path.join(f.directory, 'destination.bin'), originalOpen = fs.promises.open; let injected = false;
  fs.promises.open = async function (input, ...values) { const handle = await originalOpen.call(this, input, ...values); if (path.resolve(String(input)) === destination) { const write = handle.writeFile.bind(handle); handle.writeFile = async bytes => { await write(bytes.subarray(0, 3)); injected = true; throw Object.assign(new Error('synthetic owned-copy ENOSPC'), { code: 'ENOSPC' }); }; } return handle; }; syncBuiltinESMExports();
  try { await assert.rejects(copyRegular(file, destination), { code: 'ENOSPC' }); }
  finally { fs.promises.open = originalOpen; syncBuiltinESMExports(); }
  assert(injected); assert(fs.readFileSync(file).equals(payload)); assert(fs.readFileSync(destination).equals(payload.subarray(0, 3))); f.events.push({ simulatedError: 'ENOSPC', realDiskFilled: false, retainedPrefixBytes: 3, sourcePreserved: true }); f.complete();
});
