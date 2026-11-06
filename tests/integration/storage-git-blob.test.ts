import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { fingerprintGitBlob } from '../../src/core/storage.js';
import { comparableFileMode } from '../../src/core/platform.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const budget = { timeout: 900000 };
function fixture(t: TestContext, algorithm: 'sha1' | 'sha256' = 'sha1') {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-storage-git-blob'), previous = { ...process.env }, executable = resolveGit(), env = isolatedEnvironment(owned.root, executable);
  const preserve = previous.GL_STAGE2_PRESERVE_FIXTURES === '1'; let complete = false;
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  t.after(() => {
    try {
      if (preserve || !complete) {
        const marker = JSON.parse(fs.readFileSync(path.join(owned.root, '.git-compat-owned.json'), 'utf8'));
        assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent); assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent); assert(!fs.lstatSync(owned.root).isSymbolicLink());
        fs.writeFileSync(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify({ schema: 1, test: t.name, complete, ...owned, policy: preserve ? 'GL_STAGE2_PRESERVE_FIXTURES=1' : 'Retain failed or incomplete fixture' }, null, 2) + '\n', { flag: 'wx' });
        t.diagnostic(JSON.stringify({ kind: 'retained-storage-git-blob-fixture', test: t.name, complete, ...owned }));
      } else cleanupFixture(owned);
    } finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); }
  });
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[]) => cp.execFileSync(executable, args, { cwd: repo, env, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  native(['init', '-b', 'main', '--object-format=' + algorithm]);
  return { owned, repo, native, complete: () => { complete = true; } };
}
const identity = (file: string) => { const value = fs.statSync(file, { bigint: true }); return { dev: value.dev, ino: value.ino, size: value.size, mode: value.mode, mtimeNs: value.mtimeNs, ctimeNs: value.ctimeNs }; };
const payloads = [
  ['empty', () => Buffer.alloc(0)],
  ['binary', () => Buffer.from([0, 255, 65, 13, 10, 0, 26, 128])],
  ['LF', () => Buffer.from('alpha\nbeta\n')],
  ['CRLF', () => Buffer.from('alpha\r\nbeta\r\n')],
  ['multiple bounded reads', () => { const bytes = Buffer.alloc(512 * 1024 + 19); for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 29 + 17) % 251; return bytes; }],
] as const;
for (const algorithm of ['sha1', 'sha256'] as const) for (const [label, make] of payloads) test('Git blob fingerprint matches official ' + algorithm + ' for ' + label, budget, async t => {
  const f = fixture(t, algorithm), file = path.join(f.repo, 'payload.bin'), bytes = make(); fs.writeFileSync(file, bytes, { flag: 'wx' });
  const before = identity(file), refs = f.native(['for-each-ref', '--format=%(refname) %(objectname)']), oid = f.native(['hash-object', '--no-filters', '--', file]);
  const observed = await fingerprintGitBlob(file, algorithm);
  assert.deepEqual(observed, { exists: true, hash: createHash('sha256').update(bytes).digest('hex'), mode: comparableFileMode(Number(before.mode)), blobOid: oid });
  assert.equal(oid.length, algorithm === 'sha1' ? 40 : 64); assert.deepEqual(identity(file), before); assert(fs.readFileSync(file).equals(bytes));
  assert.equal(f.native(['for-each-ref', '--format=%(refname) %(objectname)']), refs); assert.equal(fs.existsSync(path.join(f.repo, '.git', 'index')), false);
  assert.equal(f.native(['cat-file', '--batch-all-objects', '--batch-check']), '', 'Fingerprint and native no-write oracle must not create Git objects'); f.complete();
});

test('Git blob fingerprint preserves the absent-file contract for both native algorithms', budget, async t => {
  const f = fixture(t), file = path.join(f.repo, 'absent');
  for (const algorithm of ['sha1', 'sha256'] as const) assert.deepEqual(await fingerprintGitBlob(file, algorithm), { exists: false, hash: '', mode: 0, blobOid: '' });
  assert.equal(fs.existsSync(file), false); f.complete();
});

test('Git blob fingerprint rejects an invalid algorithm before attempting to open the source', budget, async t => {
  const f = fixture(t), file = path.join(f.repo, 'absent'), original = fs.promises.open; let opened = false;
  fs.promises.open = async function (input: any, ...args: any[]) { if (path.resolve(String(input)) === file) opened = true; return (original as any).call(this, input, ...args); }; syncBuiltinESMExports();
  try { await assert.rejects(fingerprintGitBlob(file, 'sha512' as any), { code: 'INVALID_ARGUMENT' }); }
  finally { fs.promises.open = original; syncBuiltinESMExports(); }
  assert.equal(opened, false); assert.equal(fs.existsSync(file), false); f.complete();
});

for (const change of ['growth', 'truncation'] as const) test('Git blob fingerprint refuses source ' + change + ' during actual FD reads', budget, async t => {
  const f = fixture(t), file = path.join(f.repo, 'payload.bin'); fs.writeFileSync(file, Buffer.alloc(19, 0x41), { flag: 'wx' });
  const original = fs.promises.open; let changed = false;
  fs.promises.open = async function (input: any, ...args: any[]) {
    const handle = await (original as any).call(this, input, ...args);
    if (path.resolve(String(input)) === file) { const actualRead = handle.read.bind(handle); handle.read = async (...readArgs: any[]) => { const result = await actualRead(...readArgs); if (!changed) { changed = true; if (change === 'growth') fs.appendFileSync(file, Buffer.from([0x43])); else fs.truncateSync(file, 0); } return result; }; }
    return handle;
  }; syncBuiltinESMExports();
  try { await assert.rejects(fingerprintGitBlob(file, 'sha1'), (error: any) => error.code === 'EXTERNAL_CHANGE' && error.details?.path === file); }
  finally { fs.promises.open = original; syncBuiltinESMExports(); }
  assert(changed); assert.equal(fs.statSync(file).size, change === 'growth' ? 20 : 0); f.complete();
});

test('Git blob fingerprint refuses a foreign replacement between lstat and opening the actual source', budget, async t => {
  const f = fixture(t), file = path.join(f.repo, 'payload.bin'), replacement = path.join(f.repo, 'replacement.bin'), foreign = Buffer.from('foreign C');
  fs.writeFileSync(file, 'A', { flag: 'wx' }); fs.writeFileSync(replacement, foreign, { flag: 'wx' }); const expected = identity(replacement), original = fs.promises.open; let replaced = false;
  fs.promises.open = async function (input: any, ...args: any[]) { if (!replaced && path.resolve(String(input)) === file) { fs.renameSync(replacement, file); replaced = true; } return (original as any).call(this, input, ...args); }; syncBuiltinESMExports();
  try { await assert.rejects(fingerprintGitBlob(file, 'sha256'), (error: any) => error.code === 'EXTERNAL_CHANGE' && error.message === 'O arquivo mudou enquanto era aberto.' && error.details?.path === file); }
  finally { fs.promises.open = original; syncBuiltinESMExports(); }
  assert(replaced); assert(fs.readFileSync(file).equals(foreign)); assert.equal(identity(file).ino, expected.ino); assert.equal(fs.existsSync(replacement), false); f.complete();
});