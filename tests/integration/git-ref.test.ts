import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { git, assertDirectManagedRefs, type GitOptions } from '../../src/core/git.js';
import { updateDirectRef, deleteDirectRef, updateDirectRefs, type DirectRefOperation } from '../../src/core/git-ref.js';
import { LabError } from '../../src/core/errors.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const budget = { timeout: 900000 };
function fixture(t: TestContext, algorithm: 'sha1' | 'sha256' = 'sha1') {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-direct-ref'), previous = { ...process.env }, executable = resolveGit(), env = isolatedEnvironment(owned.root, executable), preserve = previous.GL_STAGE2_PRESERVE_FIXTURES === '1';
  let complete = false, retainNativeLock = false;
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  t.after(() => {
    try {
      if (preserve || !complete || retainNativeLock) {
        const marker = JSON.parse(fs.readFileSync(path.join(owned.root, '.git-compat-owned.json'), 'utf8'));
        assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent); assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent); assert(!fs.lstatSync(owned.root).isSymbolicLink());
        fs.writeFileSync(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify({ schema: 1, test: t.name, complete, retainNativeLock, ...owned, policy: preserve ? 'GL_STAGE2_PRESERVE_FIXTURES=1' : retainNativeLock ? 'Retain native lock after timeout without manual deletion' : 'Retain failed or incomplete fixture' }, null, 2) + '\n', { flag: 'wx' });
        t.diagnostic(JSON.stringify({ retained: true, test: t.name, complete, retainNativeLock, ...owned }));
      } else cleanupFixture(owned);
    } finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); }
  });
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const call = (args: string[], input?: string, allowed = [0]) => {
    const result = cp.spawnSync(executable, args, { cwd: repo, env, input, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    assert(allowed.includes(result.status!), result.stderr || result.error?.message); return result;
  };
  const native = (args: string[], input?: string) => call(args, input).stdout.trimEnd();
  native(['init', '-b', 'main', '--object-format=' + algorithm]);
  const make = (bytes: string) => { const blob = native(['hash-object', '-w', '--stdin'], bytes), tree = native(['mktree'], '100644 blob ' + blob + '\tdata.bin\n'), commit = native(['commit-tree', tree, '-m', bytes.trim()]); return { blob, tree, commit }; };
  const A = make('A\n'), B = make('B\n'); native(['update-ref', 'refs/heads/main', A.commit]); native(['update-ref', 'refs/heads/layer/source', A.commit]); native(['update-ref', 'refs/tags/source-A', A.commit]);
  const ref = 'refs/git-layers/state/owned', refFile = path.join(repo, '.git', ...ref.split('/')), lock = refFile + '.lock';
  native(['update-ref', ref, A.tree]);
  const baseline = { head: native(['rev-parse', 'HEAD']), layer: native(['rev-parse', 'refs/heads/layer/source']), tag: native(['rev-parse', 'refs/tags/source-A']) };
  const unchanged = () => { assert.deepEqual({ head: native(['rev-parse', 'HEAD']), layer: native(['rev-parse', 'refs/heads/layer/source']), tag: native(['rev-parse', 'refs/tags/source-A']) }, baseline); assert.equal(fs.existsSync(path.join(repo, '.git', 'index')), false); };
  return { owned, repo, call, native, A, B, ref, refFile, lock, unchanged, complete: () => { complete = true; }, retainLock: () => { retainNativeLock = true; } };
}
const input = (ref: string, next: string, old: string) => 'start\nupdate ' + ref + ' ' + next + ' ' + old + '\nprepare\n';
const directError = (error: any) => error.code === 'EXTERNAL_REF' && error.details?.reason === 'direct-ref-required';

test('direct-ref helper updates a direct checkpoint with native old-OID CAS', budget, async t => {
  const f = fixture(t); await updateDirectRef(f.repo, f.ref, f.B.tree, f.A.tree); assert.equal(f.native(['rev-parse', f.ref]), f.B.tree); assert.equal(fs.existsSync(f.lock), false); f.unchanged(); f.complete();
});

test('direct-ref helper preserves the checkpoint on a stale native CAS', budget, async t => {
  const f = fixture(t), before = fs.readFileSync(f.refFile); await assert.rejects(updateDirectRef(f.repo, f.ref, f.B.tree, f.B.tree), { code: 'GIT_FAILED' }); assert(fs.readFileSync(f.refFile).equals(before)); assert.equal(fs.existsSync(f.lock), false); f.unchanged(); f.complete();
});

test('direct-ref typed transaction preserves native update create verify and delete semantics', budget, async t => {
  const f = fixture(t), create = 'refs/git-layers/state/created', verify = 'refs/git-layers/state/verify', remove = 'refs/git-layers/state/remove';
  f.native(['update-ref', verify, f.A.tree]); f.native(['update-ref', remove, f.A.tree]);
  await updateDirectRefs(f.repo, [{ kind: 'update', ref: f.ref, newOid: f.B.tree, oldOid: f.A.tree }, { kind: 'create', ref: create, newOid: f.B.tree }, { kind: 'verify', ref: verify, oldOid: f.A.tree }, { kind: 'delete', ref: remove, oldOid: f.A.tree }]);
  assert.equal(f.native(['rev-parse', f.ref]), f.B.tree); assert.equal(f.native(['rev-parse', create]), f.B.tree); assert.equal(f.native(['rev-parse', verify]), f.A.tree); assert.equal(f.call(['show-ref', '--quiet', '--verify', remove], undefined, [1]).status, 1); f.unchanged(); f.complete();
});

test('direct-ref operation objects are cloned before the first await and reflog messages are exact', budget, async t => {
  const f = fixture(t), branch = 'refs/heads/direct', message = 'Git Layer rollback rename owned-transaction'; f.native(['update-ref', branch, f.A.commit]);
  const operations: DirectRefOperation[] = [{ kind: 'update', ref: branch, newOid: f.B.commit, oldOid: f.A.commit }], pending = updateDirectRefs(f.repo, operations, message);
  (operations[0] as any).ref = 'refs/tags/source-A'; (operations[0] as any).newOid = f.A.commit; operations.push({ kind: 'delete', ref: 'refs/tags/source-A' });
  await pending; assert.equal(f.native(['rev-parse', branch]), f.B.commit); assert.equal(f.native(['reflog', 'show', '-1', '--format=%gs', branch]), message); f.unchanged(); f.complete();
});

for (const operation of ['update', 'delete'] as const) test('direct-ref ' + operation + ' refuses a same-OID alias and preserves its referent', budget, async t => {
  const f = fixture(t); f.native(['symbolic-ref', f.ref, 'refs/tags/source-A']); const before = fs.readFileSync(f.refFile);
  await assert.rejects(operation === 'update' ? updateDirectRef(f.repo, f.ref, f.B.commit, f.A.commit) : deleteDirectRef(f.repo, f.ref, f.A.commit), directError);
  assert(fs.readFileSync(f.refFile).equals(before)); assert.equal(f.native(['symbolic-ref', '--quiet', '--no-recurse', f.ref]), 'refs/tags/source-A'); assert.equal(fs.existsSync(f.lock), false); f.unchanged(); f.complete();
});

test('direct-ref absent creation refuses a dangling alias without replacing it', budget, async t => {
  const f = fixture(t); f.native(['symbolic-ref', f.ref, 'refs/tags/absent']); const before = fs.readFileSync(f.refFile);
  await assert.rejects(updateDirectRef(f.repo, f.ref, f.B.tree, ''), (error: any) => error.code === 'GIT_FAILED' || directError(error));
  assert(fs.readFileSync(f.refFile).equals(before)); assert.equal(f.native(['symbolic-ref', '--quiet', '--no-recurse', f.ref]), 'refs/tags/absent'); assert.equal(f.call(['show-ref', '--quiet', '--verify', 'refs/tags/absent'], undefined, [1]).status, 1); assert.equal(fs.existsSync(f.lock), false); f.unchanged(); f.complete();
});

test('native prepare holds the actual checkpoint lock while the asynchronous direct-ref guard runs', budget, async t => {
  const f = fixture(t); let checked = false;
  await git(f.repo, ['update-ref', '--no-deref', '--stdin'], { input: input(f.ref, f.B.tree, f.A.tree), afterPrepare: async () => {
    assert.equal(fs.existsSync(f.lock), true); const lock = fs.readFileSync(f.lock), before = fs.readFileSync(f.refFile);
    assert.equal(f.call(['symbolic-ref', '--quiet', '--no-recurse', f.ref], undefined, [1]).status, 1);
    const competitor = f.call(['update-ref', '--no-deref', f.ref, f.B.tree, f.A.tree], undefined, [128]); assert(competitor.stderr.includes('lock')); assert(fs.readFileSync(f.lock).equals(lock)); assert(fs.readFileSync(f.refFile).equals(before)); checked = true;
  } });
  assert(checked); assert.equal(f.native(['rev-parse', f.ref]), f.B.tree); assert.equal(fs.existsSync(f.lock), false); f.unchanged(); f.complete();
});

test('a prepared callback failure aborts natively and preserves its exact error after child close', budget, async t => {
  const f = fixture(t), before = fs.readFileSync(f.refFile), sentinel = new LabError('RECOVERY_CONFLICT', 'Owned prepare veto'), spawn = cp.spawn; let closed = false, invoked = false;
  cp.spawn = function (...args: any[]) { const child = (spawn as any)(...args); if ((args[1] ?? []).includes('update-ref')) child.once('close', () => { closed = true; }); return child; } as typeof cp.spawn; syncBuiltinESMExports();
  try { await assert.rejects(git(f.repo, ['update-ref', '--no-deref', '--stdin'], { input: input(f.ref, f.B.tree, f.A.tree), afterPrepare: async () => { assert(fs.existsSync(f.lock)); invoked = true; throw sentinel; } }), (error: any) => error === sentinel); assert(closed); }
  finally { cp.spawn = spawn; syncBuiltinESMExports(); }
  assert(invoked); assert(fs.readFileSync(f.refFile).equals(before)); assert.equal(fs.existsSync(f.lock), false); f.unchanged(); f.complete();
});

test('a prepare timeout never authorizes a callback to commit after the native child closes', budget, async t => {
  const f = fixture(t), before = fs.readFileSync(f.refFile); let release!: () => void, entered = false, callbackReturned = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = git(f.repo, ['update-ref', '--no-deref', '--stdin'], { input: input(f.ref, f.B.tree, f.A.tree), timeout: 5000, afterPrepare: async () => { entered = true; assert(fs.existsSync(f.lock)); await gate; callbackReturned = true; } });
  await assert.rejects(pending, { code: 'GIT_TIMEOUT' }); assert(entered, 'The tested timeout must occur inside the prepared guard'); assert(fs.readFileSync(f.refFile).equals(before));
  const lockBefore = fs.existsSync(f.lock) ? fs.readFileSync(f.lock) : null; if (lockBefore) f.retainLock();
  release(); await new Promise<void>(resolve => setImmediate(resolve)); await new Promise<void>(resolve => setImmediate(resolve));
  assert(callbackReturned); assert(fs.readFileSync(f.refFile).equals(before)); assert.equal(fs.existsSync(f.lock), lockBefore !== null); if (lockBefore) assert(fs.readFileSync(f.lock).equals(lockBefore)); f.unchanged();
  t.diagnostic(JSON.stringify({ nativeLockRetained: lockBefore !== null, nativeLockSHA256: lockBefore ? createHash('sha256').update(lockBefore).digest('hex') : null, manualLockDeletion: false })); f.complete();
});

test('prepared args input and callback are captured before the first await', budget, async t => {
  const f = fixture(t), args = ['update-ref', '--no-deref', '--stdin']; let original = false;
  const options: GitOptions = { input: input(f.ref, f.B.tree, f.A.tree), afterPrepare: async () => { original = true; } }, pending = git(f.repo, args, options);
  args.splice(0, args.length, 'update-ref', 'refs/tags/source-A', f.B.commit); options.input = 'start\ndelete refs/tags/source-A\nprepare\n'; options.afterPrepare = async () => { throw Error('Late caller mutation'); };
  await pending; assert(original); assert.equal(f.native(['rev-parse', f.ref]), f.B.tree); f.unchanged(); f.complete();
});

test('prepared Git mode refuses early commit and incompatible output consumers before native effects', budget, async t => {
  const f = fixture(t), before = fs.readFileSync(f.refFile), callback = async () => {};
  await assert.rejects(git(f.repo, ['update-ref', '--no-deref', '--stdin'], { input: input(f.ref, f.B.tree, f.A.tree).replace('prepare\n', 'commit\nprepare\n'), afterPrepare: callback }), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(git(f.repo, ['update-ref', '--no-deref', '--stdin'], { input: input(f.ref, f.B.tree, f.A.tree), afterPrepare: callback, consumeStdout: () => {} }), { code: 'INVALID_ARGUMENT' });
  assert(fs.readFileSync(f.refFile).equals(before)); assert.equal(fs.existsSync(f.lock), false); f.unchanged(); f.complete();
});

test('a foreign preexisting ref lock is refused and preserved without manual deletion', budget, async t => {
  const f = fixture(t), bytes = Buffer.from('foreign lock\n'), before = fs.readFileSync(f.refFile); fs.writeFileSync(f.lock, bytes, { flag: 'wx' }); f.retainLock();
  await assert.rejects(updateDirectRef(f.repo, f.ref, f.B.tree, f.A.tree), { code: 'GIT_FAILED' }); assert(fs.readFileSync(f.lock).equals(bytes)); assert(fs.readFileSync(f.refFile).equals(before)); f.unchanged(); f.complete();
});

test('managed ref guard rejects controlled aliases but limits an optional working ref to its exact name', budget, async t => {
  const f = fixture(t); f.native(['symbolic-ref', 'refs/heads/main-extra', 'refs/tags/source-A']); await assertDirectManagedRefs(f.repo, 'refs/heads/main');
  f.native(['symbolic-ref', f.ref, 'refs/tags/source-A']); const before = fs.readFileSync(f.refFile); await assert.rejects(assertDirectManagedRefs(f.repo, 'refs/heads/main'), directError); assert(fs.readFileSync(f.refFile).equals(before)); f.unchanged(); f.complete();
});

test('managed ref guard preserves replace-ref refusal precedence over a controlled alias', budget, async t => {
  const f = fixture(t); f.native(['symbolic-ref', f.ref, 'refs/tags/source-A']); f.native(['update-ref', 'refs/replace/' + f.A.commit, f.B.commit]);
  const refs = f.native(['for-each-ref', '--format=%(refname) %(objectname) %(symref)']); await assert.rejects(assertDirectManagedRefs(f.repo), { code: 'REPLACE_OBJECTS' }); assert.equal(f.native(['for-each-ref', '--format=%(refname) %(objectname) %(symref)']), refs); assert.equal(fs.existsSync(f.lock), false); f.complete();
});
test('direct-ref absent CAS and zero-only verify use the native SHA256 object format', budget, async t => {
  const f = fixture(t, 'sha256'), created = 'refs/git-layers/state/new-sha256', absent = 'refs/git-layers/state/absent-sha256';
  assert.equal(f.B.tree.length, 64); await updateDirectRef(f.repo, created, f.B.tree, ''); assert.equal(f.native(['rev-parse', created]), f.B.tree);
  await updateDirectRefs(f.repo, [{ kind: 'verify', ref: absent, oldOid: '' }]); assert.equal(f.call(['show-ref', '--quiet', '--verify', absent], undefined, [1]).status, 1);
  assert.equal(fs.existsSync(path.join(f.repo, '.git', ...created.split('/')) + '.lock'), false); assert.equal(fs.existsSync(path.join(f.repo, '.git', ...absent.split('/')) + '.lock'), false); f.unchanged(); f.complete();
});