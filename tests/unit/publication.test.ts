import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { createFixture, cleanupFixture } from '../../scripts/git-compat/lib.mjs';
import { publishNewFile } from '../../src/core/publication.js';
import { fingerprint } from '../../src/core/storage.js';
import { safePath } from '../../src/core/paths.js';

function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-scale-publication');
  const source = path.join(owned.root, 'private.tmp'), target = path.join(owned.root, 'target.txt');
  fs.writeFileSync(source, 'validated independent bytes\n', { flag: 'wx' });
  const handle = fs.openSync(source, 'r+'); try { fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
  let verified = false;
  t.after(() => { if (verified && process.env.GL_STAGE2_PRESERVE_FIXTURES !== '1') cleanupFixture(owned); else t.diagnostic(JSON.stringify({ kind: 'retained-publication-fixture', ...owned })); });
  return { owned, source, target, verified: () => { verified = true; } };
}
async function atFailpoint(name: string, action: () => Promise<unknown>) {
  const previous = process.env.GIT_LAYERS_FAILPOINT; process.env.GIT_LAYERS_FAILPOINT = name;
  try { await assert.rejects(action(), { code: 'INJECTED_FAILURE' }); }
  finally { if (previous === undefined) delete process.env.GIT_LAYERS_FAILPOINT; else process.env.GIT_LAYERS_FAILPOINT = previous; }
}

test('no-replace publication retires only the private alias and leaves one independent regular file', async t => {
  const f = fixture(t), expected = await fingerprint(f.source), inode = fs.statSync(f.source).ino;
  await publishNewFile(f.source, f.target, expected);
  assert.equal(fs.existsSync(f.source), false); assert.deepEqual(await fingerprint(f.target), expected);
  assert.equal(fs.lstatSync(f.target).nlink, 1); assert.equal(fs.lstatSync(f.target).ino, inode);
  assert.equal(await safePath(f.owned.root, 'target.txt'), f.target); f.verified();
});

test('no-replace publication preserves a competing destination and its independent temporary', async t => {
  const f = fixture(t), expected = await fingerprint(f.source); fs.writeFileSync(f.target, 'external C\n', { flag: 'wx' });
  await assert.rejects(publishNewFile(f.source, f.target, expected), { code: 'EXTERNAL_EDIT' });
  assert.equal(fs.readFileSync(f.target, 'utf8'), 'external C\n'); assert.deepEqual(await fingerprint(f.source), expected);
  assert.equal(fs.lstatSync(f.source).nlink, 1); assert.equal(fs.lstatSync(f.target).nlink, 1); f.verified();
});

for (const point of ['before-new-file-publication', 'after-new-file-link', 'after-new-file-unlink']) test('interruption at ' + point + ' preserves the observed physical publication state', async t => {
  const f = fixture(t), expected = await fingerprint(f.source);
  await atFailpoint(point, () => publishNewFile(f.source, f.target, expected));
  if (point === 'before-new-file-publication') {
    assert.equal(fs.existsSync(f.target), false); assert.deepEqual(await fingerprint(f.source), expected); assert.equal(fs.lstatSync(f.source).nlink, 1);
  } else if (point === 'after-new-file-link') {
    assert.deepEqual(await fingerprint(f.target), expected); assert.deepEqual(await fingerprint(f.source), expected);
    assert.equal(fs.lstatSync(f.source).nlink, 2); assert.equal(fs.lstatSync(f.target).nlink, 2);
    await assert.rejects(safePath(f.owned.root, 'target.txt'), { code: 'UNSAFE_PATH' });
    await assert.rejects(publishNewFile(f.source, f.target, expected), { code: 'UNSAFE_PATH' });
  } else { assert.equal(fs.existsSync(f.source), false); assert.deepEqual(await fingerprint(f.target), expected); assert.equal(fs.lstatSync(f.target).nlink, 1); }
  f.verified();
});

for (const code of ['EACCES', 'EPERM', 'ENOSPC', 'EXDEV', 'EIO', 'ENOTSUP']) test('publication failure ' + code + ' never falls back to overwriting rename or destroys source bytes', async t => {
  const f = fixture(t), expected = await fingerprint(f.source), original = fsp.link;
  let calls = 0;
  fsp.link = async () => { calls++; throw Object.assign(new Error('synthetic ' + code), { code }); };
  try { await assert.rejects(publishNewFile(f.source, f.target, expected), { code }); }
  finally { fsp.link = original; }
  assert.equal(calls, 1); assert.equal(fs.existsSync(f.target), false); assert.deepEqual(await fingerprint(f.source), expected); assert.equal(fs.lstatSync(f.source).nlink, 1); f.verified();
});

test('publication refuses a changed private temporary before creating the destination', async t => {
  const f = fixture(t), expected = await fingerprint(f.source); fs.writeFileSync(f.source, 'changed after validation\n');
  await assert.rejects(publishNewFile(f.source, f.target, expected), { code: 'EXTERNAL_EDIT' });
  assert.equal(fs.existsSync(f.target), false); assert.equal(fs.readFileSync(f.source, 'utf8'), 'changed after validation\n'); f.verified();
});

test('publication refuses an external hardlink temporary without treating it as an independent copy', async t => {
  const f = fixture(t), expected = await fingerprint(f.source), alias = path.join(f.owned.root, 'external.txt'); await fsp.link(f.source, alias);
  await assert.rejects(publishNewFile(f.source, f.target, expected), { code: 'UNSAFE_PATH' });
  assert.equal(fs.existsSync(f.target), false); assert.deepEqual(await fingerprint(alias), expected); f.verified();
});
test('Windows exclusive native source lock refuses publication and preserves source bytes', { skip: process.platform !== 'win32', timeout: 30000 }, async t => {
  const f = fixture(t), expected = await fingerprint(f.source), nonce = randomUUID();
  const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const command = '$stream=[System.IO.File]::Open($env:GL_PUBLICATION_LOCK_FILE,[System.IO.FileMode]::Open,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None); [Console]::WriteLine($env:GL_PUBLICATION_LOCK_NONCE); [Console]::Out.Flush(); try { Start-Sleep -Seconds 25 } finally { $stream.Dispose() }';
  const child = cp.spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { env: { ...process.env, GL_PUBLICATION_LOCK_FILE: f.source, GL_PUBLICATION_LOCK_NONCE: nonce }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise(resolve => child.once('exit', resolve)); let ended = false;
  t.after(async () => { if (!ended && child.exitCode === null && child.signalCode === null) { child.kill(); await exited; } });
  await new Promise<void>((resolve, reject) => {
    let stdout = '', stderr = ''; const timer = setTimeout(() => reject(new Error('Owned lock helper timeout: ' + stderr)), 15000);
    child.stderr.on('data', data => { stderr += String(data); });
    child.stdout.on('data', data => { stdout += String(data); if (stdout.includes('\n')) { clearTimeout(timer); try { assert.equal(stdout.trim(), nonce); resolve(); } catch (error) { reject(error); } } });
    child.once('error', error => { clearTimeout(timer); reject(error); }); child.once('exit', () => { clearTimeout(timer); reject(new Error('Owned lock helper exited before handshake: ' + stderr)); });
  });
  await assert.rejects(publishNewFile(f.source, f.target, expected), (error: any) => ['EBUSY', 'EPERM', 'EACCES'].includes(error.code));
  assert.equal(fs.existsSync(f.target), false); assert(child.kill()); await exited; ended = true;
  assert.deepEqual(await fingerprint(f.source), expected); assert.equal(fs.statSync(f.source).nlink, 1); f.verified();
});

test('directory rename alone moves an unknown file added after an exclusive-content inventory', async t => {
  const f = fixture(t), source = path.join(f.owned.root, 'layer-directory'), destination = path.join(f.owned.root, 'moved-directory');
  fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'owned.txt'), 'Layer A\n'); const inventory = fs.readdirSync(source); assert.deepEqual(inventory, ['owned.txt']);
  fs.writeFileSync(path.join(source, 'external.txt'), 'external C\n', { flag: 'wx' });
  await fsp.rename(source, destination);
  assert.equal(fs.existsSync(source), false); assert.equal(fs.readFileSync(path.join(destination, 'external.txt'), 'utf8'), 'external C\n');
  // This is a counterexample to a proposed optimization, never product support.
  assert.deepEqual(fs.readdirSync(destination).sort(), ['external.txt', 'owned.txt']); f.verified();
});