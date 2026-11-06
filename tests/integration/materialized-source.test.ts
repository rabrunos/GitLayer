import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { listTransactions } from '../../src/core/storage.js';
import { gitPath } from '../../src/core/platform.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

// This compound functional budget covers real Git, source validation, recovery
// and export. It is neither a performance benchmark nor an activation SLO.
const budget = { timeout: 900000 };
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const binaryA = Buffer.from([0, 65, 65, 65, 13, 10, 255, 1]);
const binaryC = Buffer.from([0, 67, 67, 67, 13, 10, 255, 1]);
const crlfA = Buffer.from('Native line A\r\nSecond A\r\n');
const crlfC = Buffer.from('Changed line C\r\nSecond C\r\n');

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function fixture(t: TestContext, eol: boolean) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-materialized-source');
  const saved = { ...process.env }, preserve = saved.GL_STAGE2_PRESERVE_FIXTURES === '1';
  const executable = resolveGit(), env = isolatedEnvironment(owned.root, executable);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  let passed = false;
  t.after(() => {
    try {
      if (passed && !preserve) cleanupFixture(owned);
      else {
        const marker = JSON.parse(fs.readFileSync(path.join(owned.root, '.git-compat-owned.json'), 'utf8'));
        assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
        assert(!fs.lstatSync(owned.root).isSymbolicLink());
        assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent);
        t.diagnostic(JSON.stringify({ retained: true, test: t.name, ...owned }));
      }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  });
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string, input?: Buffer): Buffer => cp.execFileSync(executable, args, {
    cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, input,
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const text = (args: string[], index?: string) => native(args, index).toString('utf8').trimEnd();
  native(['init', '-b', 'main']); native(['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(repo, 'base.txt'), 'Base A\n');
  const file = eol ? 'payload.txt' : 'payload.bin', A = eol ? crlfA : binaryA;
  if (eol) fs.writeFileSync(path.join(repo, '.gitattributes'), 'payload.txt text eol=crlf\n');
  native(['add', '--', 'base.txt', ...(eol ? ['.gitattributes'] : [])]); native(['commit', '-m', 'base controls']);
  const target = path.join(repo, file), seed = path.join(owned.root, 'seed.index'); fs.writeFileSync(target, A);
  native(['read-tree', '--empty'], seed); native(['add', '--', file], seed);
  const tree = text(['write-tree'], seed), oid = text(['commit-tree', tree, '-m', 'native Layer A'], seed);
  native(['update-ref', 'refs/heads/layer/a', oid]);
  assert.equal(path.relative(repo, target), file); fs.unlinkSync(target);
  const app = await GitLayers.init(repo); await app.register('a');
  const layer = (await app.list()).find(layer => layer.name === 'a')!;
  const index = path.join(app.dir, 'indexes', layer.id + '.index'), checkpoint = 'refs/git-layers/state/' + layer.id;
  const before = {
    head: text(['rev-parse', 'HEAD']), heads: text(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']),
    main: fs.readFileSync(app.repo.index), index: fs.readFileSync(index), checkpoint: text(['rev-parse', checkpoint]),
    committed: native(['show', 'refs/heads/layer/a:' + file]), indexed: native(['show', ':' + file], index),
    blob: text(['rev-parse', 'refs/heads/layer/a:' + file]), commits: text(['rev-list', '--count', 'HEAD', 'refs/heads/layer/a']),
  };
  const unchanged = () => {
    assert.equal(text(['rev-parse', 'HEAD']), before.head); assert.equal(text(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), before.heads);
    assert(fs.readFileSync(app.repo.index).equals(before.main), 'MAIN index bytes stay unchanged');
    assert(fs.readFileSync(index).equals(before.index), 'private staged A bytes stay unchanged');
    assert.equal(text(['rev-parse', checkpoint]), before.checkpoint);
    assert(native(['show', 'refs/heads/layer/a:' + file]).equals(before.committed));
    assert(native(['show', ':' + file], index).equals(before.indexed));
    assert.equal(text(['rev-list', '--count', 'HEAD', 'refs/heads/layer/a']), before.commits, 'activation/recovery create no Layer commit');
    assert.equal(text(['rev-parse', 'refs/heads/layer/a:' + file]), before.blob);
  };
  // Independent native extraction establishes actual supported EOL behavior.
  // This oracle is outside the Core and uses its own alternate index/prefix.
  const expectedIndex = path.join(owned.root, 'expected.index'), expectedDirectory = path.join(owned.root, 'native-expected');
  fs.mkdirSync(expectedDirectory); native(['read-tree', oid], expectedIndex);
  native(['checkout-index', '--all', '--prefix=' + gitPath(expectedDirectory) + '/'], expectedIndex);
  const expected = fs.readFileSync(path.join(expectedDirectory, file));
  assert(expected.equals(A), 'native checkout must produce the exact intended physical A');
  return { owned, repo, executable, native, text, app, file, target, index, checkpoint, A, expected, before, unchanged, success: () => { passed = true; } };
}

function observeCheckout(f: Fixture, replacement?: Buffer) {
  const spawn = cp.spawn, open = fs.promises.open;
  let source: string | undefined, checkoutCode: number | null | undefined, checkoutAt: string | undefined;
  let injectionCount = 0, firstSourceOpen: { at: string; injected: boolean; bytes: Buffer } | undefined, hookError: unknown;
  cp.spawn = function (...args: Parameters<typeof cp.spawn>): ReturnType<typeof cp.spawn> {
    const argv = args[1] as string[] | undefined, child = (spawn as any)(...args);
    if (argv?.includes('checkout-index')) {
      const prefix = argv.find(arg => arg.startsWith('--prefix=') && arg.includes('/materialized/'));
      if (prefix) {
        const candidate = path.join(prefix.slice('--prefix='.length), f.file);
        child.prependOnceListener('close', (code: number | null, signal: NodeJS.Signals | null) => {
          try {
            const relative = path.relative(f.app.dir, candidate).split(path.sep).join('/');
            assert(/^transactions\/[a-z0-9-]+\/materialized\//u.test(relative));
            assert.equal(path.resolve(String(args[0])).toLowerCase(), path.resolve(f.executable).toLowerCase());
            assert.equal(code, 0); assert.equal(signal, null);
            assert(fs.readFileSync(candidate).equals(f.expected), 'real successful Git wrote physical A before injection');
            source = candidate; checkoutCode = code; checkoutAt = new Date().toISOString();
            if (replacement) { fs.writeFileSync(candidate, replacement); injectionCount++; }
          } catch (error) { hookError = error; }
        });
      }
    }
    return child;
  } as typeof cp.spawn;
  fs.promises.open = async function (...args: Parameters<typeof fs.promises.open>): ReturnType<typeof fs.promises.open> {
    if (source && path.resolve(String(args[0])) === path.resolve(source) && !firstSourceOpen) {
      firstSourceOpen = { at: new Date().toISOString(), injected: injectionCount === 1, bytes: fs.readFileSync(source) };
    }
    return open(...args);
  } as typeof fs.promises.open;
  syncBuiltinESMExports();
  return {
    restore() { cp.spawn = spawn; fs.promises.open = open; syncBuiltinESMExports(); },
    proof() {
      assert.ifError(hookError); assert(source && checkoutAt && firstSourceOpen);
      assert.equal(checkoutCode, 0); assert(Date.parse(firstSourceOpen.at) >= Date.parse(checkoutAt));
      assert.equal(injectionCount, replacement ? 1 : 0);
      assert(firstSourceOpen.bytes.equals(replacement ?? f.expected));
      assert.equal(firstSourceOpen.injected, !!replacement);
      return { source, checkoutAt, firstSourceOpenAt: firstSourceOpen.at };
    },
  };
}

async function assertPreservedRecovery(f: Fixture, source: string, C: Buffer, t: TestContext) {
  const preserved = () => {
    f.unchanged(); assert.equal(fs.existsSync(f.target), false, 'refused activation does not leave altered C in workspace');
    assert(fs.existsSync(source), 'unknown private C stays available for rescue'); assert(fs.readFileSync(source).equals(C));
  };
  preserved();
  const outcomes: unknown[] = []; let firstRecoveryOutcome: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    let recoveryError: unknown;
    try { await f.app.recover(); } catch (error) { recoveryError = error; }
    const outcome = recoveryError ? 'RECOVERY_CONFLICT' : 'completed-or-already-rolled-back';
    if (recoveryError) {
      assert.equal((recoveryError as { code?: string }).code, 'RECOVERY_CONFLICT', 'V05 refusal remains explicit');
      assert((await listTransactions(f.app.dir)).length > 0, 'refused recovery retains its journal');
      assert.equal((await f.app.doctor()).safe, false, 'refusal must not claim healthy recovery');
    } else assert.equal((await listTransactions(f.app.dir)).length, 0, 'successful recovery has no pending transaction');
    if (firstRecoveryOutcome === undefined) firstRecoveryOutcome = outcome;
    else assert.equal(outcome, firstRecoveryOutcome, 'unchanged evidence cannot silently reverse a V05 refusal on repeat');
    outcomes.push({ attempt, outcome }); preserved();
  }
  const exported = await f.app.exportRecovery(path.join(f.owned.root, 'recovery-export'));
  assert.equal(exported.complete, true);
  const manifest = JSON.parse(fs.readFileSync(exported.manifest, 'utf8'));
  const entry = manifest.entries.find((entry: any) => entry.type === 'file' && path.resolve(entry.source) === path.resolve(source));
  assert(entry, 'independent export includes retained private C');
  assert(fs.readFileSync(path.join(exported.destination, entry.path)).equals(C));
  assert.equal(entry.sha256, hash(C)); preserved();
  t.diagnostic(JSON.stringify({ recovery: outcomes, retainedSourceSHA256: hash(C), exportedC: true }));
}

test('activation refuses binary C injected after genuine checkout success but before first materialized fingerprint', budget, async t => {
  const f = await fixture(t, false), hook = observeCheckout(f, binaryC);
  try { await assert.rejects(f.app.on('a'), { code: 'EXTERNAL_EDIT' }); } finally { hook.restore(); }
  const evidence = hook.proof();
  const cBlob = f.native(['hash-object', '--no-filters', '--stdin'], undefined, binaryC).toString().trim();
  assert.notEqual(cBlob, f.before.blob, 'C is a different official Git blob, not an EOL-only change');
  await assertPreservedRecovery(f, evidence.source, binaryC, t); f.success();
});

test('activation preserves legitimate native CRLF projection from base attributes', budget, async t => {
  const f = await fixture(t, true), hook = observeCheckout(f);
  try { await f.app.on('a'); } finally { hook.restore(); }
  hook.proof(); f.unchanged(); assert(fs.readFileSync(f.target).equals(crlfA));
  assert.equal(f.before.committed.toString('utf8'), 'Native line A\nSecond A\n', 'Git stores normalized A');
  const status = await f.app.status(), layer = status.layers.find(layer => layer.name === 'a')!;
  assert.equal(status.safe, true); assert.equal(layer.state, 'active'); assert.deepEqual(layer.staged, []); assert.deepEqual(layer.unstaged, []);
  assert.equal((await listTransactions(f.app.dir)).length, 0); f.success();
});

test('native CRLF normalization cannot legitimize distinct C injected before first materialized fingerprint', budget, async t => {
  const f = await fixture(t, true), hook = observeCheckout(f, crlfC);
  try { await assert.rejects(f.app.on('a'), { code: 'EXTERNAL_EDIT' }); } finally { hook.restore(); }
  const evidence = hook.proof(), cBlob = f.native(['hash-object', '--path=' + f.file, '--stdin'], undefined, crlfC).toString().trim();
  assert.notEqual(cBlob, f.before.blob, 'official clean normalization still yields a distinct C blob');
  await assertPreservedRecovery(f, evidence.source, crlfC, t); f.success();
});
test('canonical raw Git A remains accepted after native CRLF checkout and before first fingerprint', budget, async t => {
  const f = await fixture(t, true), canonicalA = f.before.committed;
  assert(canonicalA.equals(Buffer.from('Native line A\nSecond A\n')));
  assert(!canonicalA.equals(f.expected), 'control really differs physically from native CRLF output');
  const canonicalBlob = f.native(['hash-object', '--no-filters', '--stdin'], undefined, canonicalA).toString().trim();
  assert.equal(canonicalBlob, f.before.blob, 'raw canonical bytes are the exact committed A blob');
  const hook = observeCheckout(f, canonicalA);
  try { await f.app.on('a'); } finally { hook.restore(); }
  hook.proof(); f.unchanged(); assert(fs.readFileSync(f.target).equals(canonicalA), 'workspace retains exact accepted LF bytes');
  assert.equal(f.text(['hash-object', '--no-filters', '--', f.file]), f.before.blob);
  const status = await f.app.status(), layer = status.layers.find(layer => layer.name === 'a')!;
  assert.equal(status.safe, true); assert.equal(layer.state, 'active'); assert.deepEqual(layer.staged, []); assert.deepEqual(layer.unstaged, []);
  assert.equal((await listTransactions(f.app.dir)).length, 0); f.success();
});