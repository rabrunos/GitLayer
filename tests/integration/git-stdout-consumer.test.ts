import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { git } from '../../src/core/git.js';
import { LabError } from '../../src/core/errors.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const budget = { timeout: 900000 };
function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-git-stdout-consumer'), previous = { ...process.env }, executable = resolveGit(), env = isolatedEnvironment(owned.root, executable);
  const preserve = previous.GL_STAGE2_PRESERVE_FIXTURES === '1'; let complete = false;
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  t.after(() => {
    try {
      if (preserve || !complete) {
        const marker = JSON.parse(fs.readFileSync(path.join(owned.root, '.git-compat-owned.json'), 'utf8'));
        assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent); assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent); assert(!fs.lstatSync(owned.root).isSymbolicLink());
        fs.writeFileSync(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify({ schema: 1, test: t.name, complete, ...owned, policy: preserve ? 'GL_STAGE2_PRESERVE_FIXTURES=1' : 'Retain failed or incomplete fixture' }, null, 2) + '\n', { flag: 'wx' });
        t.diagnostic(JSON.stringify({ kind: 'retained-git-stdout-consumer-fixture', test: t.name, complete, ...owned }));
      } else cleanupFixture(owned);
    } finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); }
  });
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[]) => cp.execFileSync(executable, args, { cwd: repo, env, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  native(['init', '-b', 'main']); native(['config', '--local', 'core.autocrlf', 'false']);
  return { owned, repo, native, complete: () => { complete = true; } };
}

test('Git stdout consumer preserves exact binary output without retaining stdout', budget, async t => {
  const f = fixture(t), source = path.join(f.repo, 'source.bin'), bytes = Buffer.from([0, 10, 13, 255, 128, 65, 0]); fs.writeFileSync(source, bytes, { flag: 'wx' });
  const oid = f.native(['hash-object', '-w', '--no-filters', '--', source]), chunks: Buffer[] = [];
  const result = await git(f.repo, ['cat-file', 'blob', oid], { consumeStdout: chunk => { chunks.push(Buffer.from(chunk)); } });
  assert.equal(result.code, 0); assert.equal(result.stdout.length, 0); assert.equal(result.stderr.length, 0); assert(Buffer.concat(chunks).equals(bytes)); assert(fs.readFileSync(source).equals(bytes)); f.complete();
});

test('Git stdout consumer accepts 100 MiB while default output remains limited and failures close the native child', budget, async t => {
  const f = fixture(t), source = path.join(f.repo, 'large.bin'), size = 100 * 1024 * 1024, chunk = Buffer.alloc(1024 * 1024, 0x5d), expected = createHash('sha256');
  const handle = fs.openSync(source, 'wx'); try { for (let offset = 0; offset < size; offset += chunk.length) { fs.writeSync(handle, chunk); expected.update(chunk); } fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
  const expectedHash = expected.digest('hex'), oid = f.native(['hash-object', '-w', '--no-filters', '--', source]), observed = createHash('sha256'); let bytes = 0, count = 0;
  const result = await git(f.repo, ['cat-file', 'blob', oid], { timeout: 180000, consumeStdout: data => { bytes += data.length; count++; observed.update(data); } });
  assert.equal(result.code, 0); assert.equal(result.stdout.length, 0); assert.equal(result.stderr.length, 0); assert.equal(bytes, size); assert(count > 1); assert.equal(observed.digest('hex'), expectedHash);
  await assert.rejects(git(f.repo, ['cat-file', 'blob', oid], { timeout: 180000 }), { code: 'GIT_OUTPUT_LIMIT' });
  const originalSpawn = cp.spawn, sentinel = new LabError('EXTERNAL_EDIT', 'Owned consumer refusal', { reason: 'owned-consumer-refusal' }); let closed = false, invoked = false;
  cp.spawn = function (...args: any[]) { const child = (originalSpawn as any)(...args); if ((args[1] ?? []).includes('cat-file')) child.once('close', () => { closed = true; }); return child; } as typeof cp.spawn; syncBuiltinESMExports();
  try { await assert.rejects(git(f.repo, ['cat-file', 'blob', oid], { timeout: 180000, consumeStdout: () => { invoked = true; throw sentinel; } }), (error: any) => error === sentinel); assert(closed, 'Callback failure must await the owned native child close'); }
  finally { cp.spawn = originalSpawn; syncBuiltinESMExports(); }
  assert(invoked); await assert.rejects(git(f.repo, ['cat-file', 'blob', oid], { timeout: 1, consumeStdout: () => {} }), { code: 'GIT_TIMEOUT' });
  assert.equal(fs.statSync(source).size, size); assert.equal(f.native(['hash-object', '--no-filters', '--', source]), oid);
  t.diagnostic(JSON.stringify({ kind: 'bounded-consumer-output', bytes, chunks: count, stdoutRetainedBytes: result.stdout.length, hash: expectedHash, qualification: 'Exact byte/digest and non-retention assertions; no universal RSS claim' })); f.complete();
});

test('Git stdout consumer retains native nonzero status and stderr diagnostics', budget, async t => {
  const f = fixture(t); let invoked = false;
  await assert.rejects(git(f.repo, ['cat-file', 'blob', '0'.repeat(40)], { consumeStdout: () => { invoked = true; } }), (error: any) => error.code === 'GIT_FAILED' && error.details?.code !== 0 && typeof error.details?.stderr === 'string' && error.details.stderr.length > 0);
  assert.equal(invoked, false); f.complete();
});

test('Git filtered stdout disables an external smudge filter without executing its owned sentinel', budget, async t => {
  const f = fixture(t), source = path.join(f.repo, 'source.dat'), bytes = Buffer.from('native A\n'), marker = path.join(f.owned.root, 'filter-executed'), script = path.join(f.owned.root, 'owned-filter.cjs');
  fs.writeFileSync(source, bytes, { flag: 'wx' }); fs.writeFileSync(script, 'const fs=require("node:fs");fs.writeFileSync(' + JSON.stringify(marker) + ',"executed",{flag:"wx"});process.stdout.write(fs.readFileSync(0));\n', { flag: 'wx' });
  const oid = f.native(['hash-object', '-w', '--no-filters', '--', source]); fs.writeFileSync(path.join(f.repo, '.gitattributes'), 'source.dat -text filter=owned\n', { flag: 'wx' });
  const quote = (value: string) => '"' + value.replaceAll('\\', '/').replaceAll('"', '\\"') + '"';
  f.native(['config', '--local', 'filter.owned.smudge', quote(process.execPath) + ' ' + quote(script)]); f.native(['config', '--local', 'filter.owned.required', 'true']);
  const received: Buffer[] = []; const result = await git(f.repo, ['cat-file', '--filters', '--path=source.dat', oid], { consumeStdout: chunk => { received.push(Buffer.from(chunk)); } });
  assert.equal(result.code, 0); assert.equal(result.stdout.length, 0); assert(Buffer.concat(received).equals(bytes)); assert.equal(fs.existsSync(marker), false); assert(fs.readFileSync(source).equals(bytes)); f.complete();
});