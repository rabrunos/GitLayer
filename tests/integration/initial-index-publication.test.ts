import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { syncBuiltinESMExports } from 'node:module';
import { GitLayers } from '../../src/core/index.js';
import { Transaction, listTransactions } from '../../src/core/storage.js';
import { createFixture, isolatedEnvironment, resolveGit, cleanupFixture } from '../../scripts/git-compat/lib.mjs';

const budget = { timeout: 180000 };
async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-initial-index'), saved = { ...process.env }, executable = resolveGit(), env = isolatedEnvironment(owned.root, executable);
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  let passed = false;
  t.after(() => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, saved); if (passed) cleanupFixture(owned); else t.diagnostic(JSON.stringify({ retained: true, ...owned })); });
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string) => cp.execFileSync(executable, args, { cwd: repo, env: { ...env, ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  native(['init', '-b', 'main']); fs.writeFileSync(path.join(repo, 'base.txt'), 'base A\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base']);
  const seed = path.join(owned.root, 'seed.index'), target = path.join(repo, 'layer.txt');
  const make = (text: string) => { fs.writeFileSync(target, text); native(['read-tree', '--empty'], seed); native(['add', '--', 'layer.txt'], seed); const tree = native(['write-tree'], seed), oid = native(['commit-tree', tree, '-m', 'native unregistered Layer']); fs.unlinkSync(target); return { text, tree, oid }; };
  const A = make('committed Layer A\n'), B = make('external Layer B\n'); native(['update-ref', 'refs/heads/layer/fresh', A.oid]);
  const app = await GitLayers.init(repo), main = fs.readFileSync(app.repo.index), head = native(['rev-parse', 'HEAD']);
  const unchanged = () => { assert(fs.readFileSync(app.repo.index).equals(main)); assert.equal(native(['rev-parse', 'HEAD']), head); assert.equal(native(['show', 'HEAD:base.txt']), 'base A'); assert.equal(fs.existsSync(target), false); assert.equal(native(['rev-parse', 'refs/heads/layer/fresh']), A.oid); };
  return { owned, repo, native, A, B, app, target, unchanged, success: () => { passed = true; } };
}
function replace(f: Awaited<ReturnType<typeof fixture>>, index: string, timestampOnly = false) {
  const bytes = fs.readFileSync(index), before = fs.statSync(index, { bigint: true });
  const file = timestampOnly ? index : path.join(f.owned.root, 'foreign-' + path.basename(index));
  if (!timestampOnly) fs.writeFileSync(file, bytes, { flag: 'wx' });
  const fd = fs.openSync(file, 'r+'); try { fs.futimesSync(fd, new Date(), Number(before.mtimeNs) / 1e9 + 60); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (!timestampOnly) fs.renameSync(file, index);
  const identity = fs.statSync(index, { bigint: true }); if (!timestampOnly) assert.notEqual(identity.ino, before.ino); assert(identity.mtimeNs > before.mtimeNs);
  return { bytes, identity };
}
async function preserved(f: Awaited<ReturnType<typeof fixture>>, index: string, foreign: ReturnType<typeof replace>, reason = 'created-index-identity-changed', registered = 0) {
  f.unchanged(); assert(fs.readFileSync(index).equals(foreign.bytes)); const current = fs.statSync(index, { bigint: true }); assert.equal(current.ino, foreign.identity.ino); assert.equal(current.mtimeNs, foreign.identity.mtimeNs);
  const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1); assert.equal(pending[0].recovery.createdIndexPublication.path, index);
  const plan = pending[0].recovery.files.find((file: any) => file.path === index); assert.equal(plan.before.exists, false); assert.equal(plan.after.exists, true); assert.equal(plan.backup, null);
  const journal = path.join(f.app.dir, 'transactions', pending[0].id, 'journal.json'), bytes = fs.readFileSync(journal), refs = f.native(['for-each-ref', '--format=%(refname) %(objectname)']); assert.equal(JSON.parse(bytes.toString()).schema, 2);
  const semantics = f.native(['ls-files', '--stage'], index), registry = fs.readFileSync(path.join(f.app.dir, 'registry.json')), reopened = await GitLayers.open(f.repo);
  for (let repeat = 0; repeat < 2; repeat++) {
    await assert.rejects(reopened.recover(), (error: any) => error.code === 'RECOVERY_CONFLICT' && error.details?.reason === reason);
    assert(fs.readFileSync(index).equals(foreign.bytes)); const actual = fs.statSync(index, { bigint: true }); assert.equal(actual.ino, foreign.identity.ino); assert.equal(actual.mtimeNs, foreign.identity.mtimeNs); assert(fs.readFileSync(journal).equals(bytes));
    assert.equal(f.native(['ls-files', '--stage'], index), semantics); assert.equal(f.native(['for-each-ref', '--format=%(refname) %(objectname)']), refs); assert(fs.readFileSync(path.join(f.app.dir, 'registry.json')).equals(registry)); f.unchanged();
  }
  assert.equal(JSON.parse(registry.toString()).layers.length, registered);
}

for (const boundary of ['inside-validation', 'after-token', 'marker-record-failure'] as const) test('fresh activation preserves an unknown equal-byte index ' + boundary, budget, async t => {
  const f = await fixture(t), prototype = GitLayers.prototype as any, validate = prototype.validateLayerIndex, spawn = cp.spawn, record = Transaction.prototype.record;
  let validating = false, injected = false, index = '', foreign: ReturnType<typeof replace> | undefined;
  const inject = () => { if (!injected) { foreign = replace(f, index); injected = true; } };
  prototype.validateLayerIndex = async function (layer: any) { if (this.dir !== f.app.dir) return validate.call(this, layer); index = this.index(layer); validating = true; try { const token = await validate.call(this, layer); if (boundary !== 'inside-validation') inject(); return token; } finally { validating = false; } };
  cp.spawn = function (...args: any[]) { const argv = args[1] ?? []; if (validating && boundary === 'inside-validation' && argv.includes('diff') && argv.includes('--cached') && argv.includes('--quiet')) inject(); return (spawn as any)(...args); } as typeof cp.spawn;
  Transaction.prototype.record = async function (step: string, details?: unknown) { if (boundary === 'marker-record-failure' && injected && step === 'activation-index-conflict') throw Object.assign(new Error('fixture marker record failure'), { code: 'EIO' }); return record.call(this, step, details); };
  syncBuiltinESMExports();
  try { await assert.rejects(f.app.on('fresh'), (error: any) => boundary === 'marker-record-failure' ? error.code === 'EIO' : error.code === 'EXTERNAL_INDEX' && error.details?.reason === 'activation-source-changed'); }
  finally { prototype.validateLayerIndex = validate; cp.spawn = spawn; Transaction.prototype.record = record; syncBuiltinESMExports(); }
  assert(injected && foreign); const pending = await listTransactions(f.app.dir);
  if (boundary === 'marker-record-failure') assert.equal(pending[0].recovery.activationIndexConflict, undefined, 'Durable creation proof must protect without the later marker');
  await preserved(f, index, foreign); f.success();
});

test('a failed final creation observation leaves a protected checkpoint before an optional marker failure', budget, async t => {
  const f = await fixture(t), finish = Transaction.prototype.finish, record = Transaction.prototype.record; let index = '', foreign: ReturnType<typeof replace> | undefined;
  Transaction.prototype.finish = async function () { await finish.call(this); if (this.data.kind === 'register' && this.data.recovery.createdIndexPublication && !foreign) { index = this.data.recovery.createdIndexPublication.path; foreign = replace(f, index); } };
  Transaction.prototype.record = async function (step: string, details?: unknown) { if (foreign && step === 'activation-index-conflict') throw Object.assign(new Error('fixture final marker record failure'), { code: 'EIO' }); return record.call(this, step, details); };
  try { await assert.rejects(f.app.register('fresh'), { code: 'EIO' }); }
  finally { Transaction.prototype.finish = finish; Transaction.prototype.record = record; }
  assert(foreign); const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1); assert.equal(pending[0].state, 'recovery-required'); assert.equal(pending[0].recovery.activationIndexConflict, undefined);
  await preserved(f, index, foreign, 'created-index-identity-changed', 1); f.success();
});

test('initial index publication does not replace an equal-byte destination created at the final link call', budget, async t => {
  const f = await fixture(t), link = fs.promises.link; let index = '', injected = false, foreign: ReturnType<typeof replace> | undefined;
  fs.promises.link = async function (source: any, destination: any) { const target = path.resolve(String(destination)); if (!injected && path.dirname(target) === path.join(f.app.dir, 'indexes')) { index = target; const bytes = fs.readFileSync(source); fs.writeFileSync(index, bytes, { flag: 'wx' }); foreign = replace(f, index); injected = true; } return link.call(this, source, destination); }; syncBuiltinESMExports();
  try { await assert.rejects(f.app.register('fresh'), (error: any) => error.code === 'EXTERNAL_EDIT' && error.details?.reason === 'publication-destination-exists'); }
  finally { fs.promises.link = link; syncBuiltinESMExports(); }
  assert(injected && foreign); await preserved(f, index, foreign); f.success();
});

for (const operation of ['create', 'register', 'activate', 'activate-timestamp'] as const) test(operation + ' refuses an index identity changed immediately after initial publication', budget, async t => {
  const f = await fixture(t), unlink = fs.promises.unlink; let index = '', injected = false, foreign: ReturnType<typeof replace> | undefined;
  fs.promises.unlink = async function (file: any) { const result = await unlink.call(this, file), candidate = path.resolve(String(file)); if (!injected && path.dirname(candidate) === path.join(f.app.dir, 'indexes') && candidate.endsWith('.index.lock')) { index = candidate.slice(0, -5); foreign = replace(f, index, operation === 'activate-timestamp'); injected = true; } return result; }; syncBuiltinESMExports();
  try { await assert.rejects(operation === 'create' ? f.app.create('created') : operation === 'register' ? f.app.register('fresh') : f.app.on('fresh'), { code: 'EXTERNAL_EDIT' }); }
  finally { fs.promises.unlink = unlink; syncBuiltinESMExports(); }
  assert(injected && foreign); await preserved(f, index, foreign); f.success();
});

test('registration refuses a transaction-local index changed to another official Git tree before validation', budget, async t => {
  const f = await fixture(t), lstat = fs.promises.lstat; let scratch = '', injected = false;
  (fs.promises as any).lstat = async function (file: any, ...args: any[]) { const candidate = path.resolve(String(file)); if (!injected && path.dirname(path.dirname(candidate)) === path.join(f.app.dir, 'transactions') && /^register-.+\.index$/u.test(path.basename(candidate))) { scratch = candidate; f.native(['read-tree', f.B.tree], scratch); injected = true; } return (lstat as any).call(this, file, ...args); }; syncBuiltinESMExports();
  try { await assert.rejects(f.app.register('fresh'), (error: any) => error.code === 'CHECKPOINT_MISMATCH' && error.details?.boundary === 'registration-image-tree'); }
  finally { fs.promises.lstat = lstat; syncBuiltinESMExports(); }
  assert(injected && scratch); f.unchanged(); assert.equal(fs.readdirSync(path.join(f.app.dir, 'indexes')).filter(file => file.endsWith('.index')).length, 0); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8')).layers, []); assert.equal(f.native(['show', ':layer.txt'], scratch), f.B.text.trimEnd()); f.success();
});

test('initial checkpoint zero-OID CAS preserves a ref inserted at real native transaction input', budget, async t => {
  const f = await fixture(t), spawn = cp.spawn; let checkpoint = '', injected = false, observedOld = '';
  cp.spawn = function (...args: any[]) {
    const argv = args[1] ?? [], child = (spawn as any)(...args);
    if (argv.includes('update-ref') && argv.includes('--no-deref') && argv.includes('--stdin')) {
      const write = child.stdin.write.bind(child.stdin);
      child.stdin.write = function (chunk: any, ...rest: any[]) {
        const input = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        for (const line of input.split('\n')) {
          const [operation, ref, , oldOid] = line.split(' ');
          if (!injected && operation === 'update' && ref?.startsWith('refs/git-layers/state/')) {
            checkpoint = ref; observedOld = oldOid!;
            assert.equal(observedOld, '0'.repeat(f.A.tree.length));
            f.native(['update-ref', ref, f.B.tree, '0'.repeat(f.B.tree.length)]); injected = true;
          }
        }
        return write(chunk, ...rest);
      };
    }
    return child;
  } as typeof cp.spawn; syncBuiltinESMExports();
  try { await assert.rejects(f.app.register('fresh'), { code: 'GIT_FAILED' }); }
  finally { cp.spawn = spawn; syncBuiltinESMExports(); }
  assert(injected); assert.equal(observedOld, '0'.repeat(f.A.tree.length)); assert.equal(f.native(['rev-parse', checkpoint]), f.B.tree); f.unchanged(); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8')).layers, []); f.success();
});

test('known initial index publication can be rolled back once after the historical registration failpoint', budget, async t => {
  const f = await fixture(t); process.env.GIT_LAYERS_FAILPOINT = 'after-register-index'; try { await assert.rejects(f.app.register('fresh'), { code: 'INJECTED_FAILURE' }); } finally { delete process.env.GIT_LAYERS_FAILPOINT; }
  const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1); const creation = pending[0].recovery.createdIndexPublication; assert(creation); assert.equal(f.native(['show', ':layer.txt'], creation.path), f.A.text.trimEnd());
  const reopened = await GitLayers.open(f.repo); assert.equal((await reopened.recover()).recovered.length, 1); assert.equal(fs.existsSync(creation.path), false); assert.deepEqual((await reopened.recover()).recovered, []); f.unchanged(); f.success();
});
