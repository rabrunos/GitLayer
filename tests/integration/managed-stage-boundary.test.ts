import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { GitLayers, LabError } from '../../src/core/index.js';
import { Transaction, listTransactions } from '../../src/core/storage.js';
import { createFixture, isolatedEnvironment, resolveGit, cleanupFixture } from '../../scripts/git-compat/lib.mjs';

const budget = { timeout: 180000 }, hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-managed-stage'), saved = { ...process.env }, executable = resolveGit(), env = isolatedEnvironment(owned.root, executable);
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  let passed = false;
  t.after(() => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, saved); if (passed) cleanupFixture(owned); else t.diagnostic(JSON.stringify({ retained: true, ...owned })); });
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string, input?: string) => cp.execFileSync(executable, args, { cwd: repo, env: { ...env, ...(index ? { GIT_INDEX_FILE: index } : {}) }, input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  native(['init', '-b', 'main']); native(['config', 'core.autocrlf', 'false']); fs.writeFileSync(path.join(repo, 'base.txt'), 'base A\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base']);
  const seed = path.join(owned.root, 'seed.index'), make = (text: string) => { const blob = native(['hash-object', '-w', '--stdin'], undefined, text); native(['read-tree', '--empty'], seed); native(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',layer.txt'], seed); const tree = native(['write-tree'], seed), oid = native(['commit-tree', tree, '-m', 'fixture Layer']); return { blob, tree, oid, text }; };
  const A = make('committed A\n'), C = make('external staged C\n'); native(['update-ref', 'refs/heads/layer/a', A.oid]);
  const app = await GitLayers.init(repo); await app.register('a'); await app.on('a'); const layer = (await app.list()).find(entry => entry.name === 'a')!, index = path.join(app.dir, 'indexes', layer.id + '.index'), checkpoint = 'refs/git-layers/state/' + layer.id, target = path.join(repo, 'layer.txt');
  const head = native(['rev-parse', 'HEAD']), main = fs.readFileSync(app.repo.index), indexA = fs.readFileSync(index); fs.writeFileSync(target, 'requested B\n');
  const unchanged = () => { assert.equal(native(['rev-parse', 'HEAD']), head); assert(fs.readFileSync(app.repo.index).equals(main)); assert.equal(fs.readFileSync(target, 'utf8'), 'requested B\n'); assert.equal(native(['show', 'HEAD:base.txt']), 'base A'); };
  return { owned, repo, native, A, C, app, layer, index, checkpoint, target, head, main, indexA, unchanged, success: () => { passed = true; } };
}
function changeIdentity(f: Awaited<ReturnType<typeof fixture>>, timestampOnly = false) {
  const before = fs.statSync(f.index, { bigint: true }), bytes = fs.readFileSync(f.index), target = timestampOnly ? f.index : path.join(f.owned.root, 'external-equal-B.index');
  if (!timestampOnly) fs.writeFileSync(target, bytes, { flag: 'wx' }); const fd = fs.openSync(target, 'r+'); try { fs.futimesSync(fd, new Date(), Number(before.mtimeNs) / 1e9 + 60); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } if (!timestampOnly) fs.renameSync(target, f.index);
  const after = fs.statSync(f.index, { bigint: true }); assert(after.mtimeNs > before.mtimeNs); if (!timestampOnly) assert.notEqual(after.ino, before.ino);
}
async function refusesRepeatedRecovery(f: Awaited<ReturnType<typeof fixture>>, nativeC: boolean, context = false) {
  const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1); const data = pending[0], plan = data.recovery.managedIndexPublication; assert(plan?.after && plan.tree); assert.equal(plan.path, f.index);
  const entry = data.recovery.files.find((file: any) => file.path === f.index); assert(entry.backup && entry.after); assert.equal(f.native(['show', ':layer.txt'], entry.backup), f.A.text.trimEnd());
  const bytes = fs.readFileSync(f.index), identity = fs.statSync(f.index, { bigint: true }), refs = f.native(['for-each-ref', '--format=%(refname) %(objectname)']), journal = path.join(f.app.dir, 'transactions', data.id, 'journal.json'), journalBytes = fs.readFileSync(journal), backup = fs.readFileSync(entry.backup); assert.equal(JSON.parse(journalBytes.toString()).schema, 2);
  assert.equal(f.native(['show', ':layer.txt'], f.index), nativeC ? f.C.text.trimEnd() : 'requested B'); assert.equal(f.native(['cat-file', 'blob', f.native(['hash-object', '--stdin'], undefined, 'requested B\n')]), 'requested B');
  if (nativeC) assert.notEqual(entry.after.hash, hash(bytes), 'C must never replace the durably recorded B AFTER');
  const reopened = await GitLayers.open(f.repo);
  for (let repeat = 0; repeat < 2; repeat++) {
    await assert.rejects(reopened.recover(), (error: any) => error.code === 'RECOVERY_CONFLICT' && (context ? error.details?.reason === 'managed-stage-context-changed' : error.details?.reason === 'managed-index-identity-changed'));
    assert(fs.readFileSync(f.index).equals(bytes)); const actual = fs.statSync(f.index, { bigint: true }); assert.equal(actual.ino, identity.ino); assert.equal(actual.mtimeNs, identity.mtimeNs); assert(fs.readFileSync(journal).equals(journalBytes)); assert(fs.readFileSync(entry.backup).equals(backup)); assert.equal(f.native(['for-each-ref', '--format=%(refname) %(objectname)']), refs);
  }
  const status = await reopened.status(); assert.equal(status.safe, false); if (!context) f.unchanged();
}

test('managed add checkpoints only the verified post-add image without rewriting its live or scratch racy boundary', budget, async t => {
  const f = await fixture(t), spawn = cp.spawn; let verified = false, scratchMtime = 0n, scratch = '';
  cp.spawn = function (...args: any[]) { const argv = args[1] ?? [], options = args[2]; if (argv.includes('write-tree') && options?.cwd === f.repo) { const image = options.env?.GIT_INDEX_FILE; assert(image && path.resolve(image) !== f.index, 'Managed add must never write-tree the live private index'); const transactions = fs.readdirSync(path.join(f.app.dir, 'transactions')).map(id => path.join(f.app.dir, 'transactions', id)); scratch = transactions.flatMap(directory => fs.readdirSync(directory).filter(file => /^stage-.+\.index$/u.test(file)).map(file => path.join(directory, file))).at(-1)!; assert(scratch); assert.notEqual(path.resolve(image), scratch); scratchMtime = fs.statSync(scratch, { bigint: true }).mtimeNs; assert(fs.statSync(image, { bigint: true }).mtimeNs <= scratchMtime); verified = true; } return (spawn as any)(...args); } as typeof cp.spawn; syncBuiltinESMExports();
  try { assert.deepEqual(await f.app.add('a', ['layer.txt']), { paths: ['layer.txt'] }); } finally { cp.spawn = spawn; syncBuiltinESMExports(); }
  assert(verified); assert.equal(fs.statSync(scratch, { bigint: true }).mtimeNs, scratchMtime); assert(fs.statSync(f.index, { bigint: true }).mtimeNs <= scratchMtime); assert.equal(f.native(['show', ':layer.txt'], f.index), 'requested B'); assert.equal(f.native(['show', f.native(['rev-parse', f.checkpoint]) + ':layer.txt']), 'requested B'); assert.equal(f.native(['rev-parse', 'refs/heads/layer/a']), f.A.oid); assert.equal((await f.app.status()).safe, true); assert.deepEqual(await listTransactions(f.app.dir), []); f.unchanged(); f.success();
});

for (const boundary of ['after-stage-C', 'during-save-C', 'after-checkpoint-C', 'after-stage-equal-B', 'after-stage-mtime-B', 'after-stage-marker-failure'] as const) test('managed add preserves external staging at ' + boundary, budget, async t => {
  const f = await fixture(t), prototype = GitLayers.prototype as any, method = boundary.startsWith('during-save') ? 'save' : boundary.startsWith('after-checkpoint') ? 'checkpointTree' : 'stageIndexInternal', original = prototype[method], record = Transaction.prototype.record; let injected = false;
  const inject = () => { if (injected) return; if (boundary.endsWith('-C')) f.native(['read-tree', f.C.tree], f.index); else changeIdentity(f, boundary.includes('mtime')); injected = true; };
  prototype[method] = async function (...args: any[]) { if (this.dir !== f.app.dir || this.tx?.data.kind !== 'stage') return original.apply(this, args); if (method === 'save') inject(); const result = await original.apply(this, args); if (method !== 'save') inject(); return result; };
  Transaction.prototype.record = async function (step: string, details?: unknown) { if (boundary.endsWith('marker-failure') && injected && step === 'managed-index-conflict') throw Object.assign(new Error('fixture marker EIO'), { code: 'EIO' }); return record.call(this, step, details); };
  try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: boundary.endsWith('marker-failure') ? 'EIO' : 'EXTERNAL_INDEX' }); } finally { prototype[method] = original; Transaction.prototype.record = record; }
  assert(injected); assert.equal(f.native(['rev-parse', 'refs/heads/layer/a']), f.A.oid); assert.notEqual(f.native(['rev-parse', f.checkpoint]), f.C.tree); const pending = await listTransactions(f.app.dir); if (boundary.endsWith('marker-failure')) assert.equal(pending[0].recovery.managedIndexConflict, undefined);
  await refusesRepeatedRecovery(f, boundary.endsWith('-C')); f.success();
});

for (const boundary of ['layer-ref', 'working-ref', 'checkpoint-C', 'checkpoint-B'] as const) test('managed add preserves an external ' + boundary + (boundary.startsWith('checkpoint') ? ' at real native transaction input' : '') + ' without generic recheckpoint adoption', budget, async t => {
  const f = await fixture(t), prototype = GitLayers.prototype as any, stage = prototype.stageIndexInternal, spawn = cp.spawn; let injected = false;
  prototype.stageIndexInternal = async function (...args: any[]) { const result = await stage.apply(this, args); if (this.dir === f.app.dir && !injected && boundary.endsWith('ref')) { f.native(['update-ref', boundary === 'layer-ref' ? 'refs/heads/layer/a' : 'refs/heads/main', f.C.oid]); injected = true; } return result; };
  cp.spawn = function (...args: any[]) {
    const argv = args[1] ?? [], child = (spawn as any)(...args);
    if (boundary.startsWith('checkpoint-') && argv.includes('update-ref') && argv.includes('--no-deref') && argv.includes('--stdin')) {
      const write = child.stdin.write.bind(child.stdin);
      child.stdin.write = function (chunk: any, ...rest: any[]) {
        const input = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        for (const line of input.split('\n')) {
          const [operation, ref, newOid, oldOid] = line.split(' ');
          if (!injected && operation === 'update' && ref === f.checkpoint) {
            assert.equal(oldOid, f.A.tree); assert(newOid);
            f.native(['update-ref', f.checkpoint, boundary === 'checkpoint-C' ? f.C.tree : newOid, f.A.tree]); injected = true;
          }
        }
        return write(chunk, ...rest);
      };
    }
    return child;
  } as typeof cp.spawn; syncBuiltinESMExports();
  try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: boundary.startsWith('checkpoint') ? 'GIT_FAILED' : 'EXTERNAL_REF' }); } finally { prototype.stageIndexInternal = stage; cp.spawn = spawn; syncBuiltinESMExports(); }
  assert(injected); if (boundary.startsWith('checkpoint')) { const pending = await listTransactions(f.app.dir); assert.equal(pending[0].recovery.managedIndexPublication.checkpointPublished, false); assert.equal(f.native(['rev-parse', f.checkpoint]), boundary === 'checkpoint-C' ? f.C.tree : pending[0].recovery.managedIndexPublication.tree); }
  else assert.equal(f.native(['rev-parse', boundary === 'layer-ref' ? 'refs/heads/layer/a' : 'refs/heads/main']), f.C.oid);
  assert(fs.readFileSync(f.app.repo.index).equals(f.main)); assert.equal(fs.readFileSync(f.target, 'utf8'), 'requested B\n'); await refusesRepeatedRecovery(f, false, true); f.success();
});

for (const point of ['after-stage-index', 'after-stage-checkpoint'] as const) test('known B interrupted at ' + point + ' restores only the original fixed checkpoint and remains idempotent', budget, async t => {
  const f = await fixture(t); process.env.GIT_LAYERS_FAILPOINT = point; try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: 'INJECTED_FAILURE' }); } finally { delete process.env.GIT_LAYERS_FAILPOINT; }
  const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1); assert.equal(pending[0].recovery.managedIndexPublication.checkpointPublished, point === 'after-stage-checkpoint'); assert.equal(f.native(['show', ':layer.txt'], f.index), 'requested B');
  const reopened = await GitLayers.open(f.repo); assert.equal((await reopened.recover()).recovered.length, 1); assert.equal(f.native(['show', ':layer.txt'], f.index), f.A.text.trimEnd()); assert.equal(f.native(['rev-parse', f.checkpoint]), f.A.tree); const index = fs.readFileSync(f.index), identity = fs.statSync(f.index, { bigint: true }), refs = f.native(['for-each-ref', '--format=%(refname) %(objectname)']); assert.deepEqual((await reopened.recover()).recovered, []); assert(fs.readFileSync(f.index).equals(index)); const actual = fs.statSync(f.index, { bigint: true }); assert.equal(actual.ino, identity.ino); assert.equal(actual.mtimeNs, identity.mtimeNs); assert.equal(f.native(['for-each-ref', '--format=%(refname) %(objectname)']), refs); f.unchanged(); f.success();
});

test('an interruption after checkpoint CAS but before its durable receipt refuses ambiguous recovery', budget, async t => {
  const f = await fixture(t), prototype = GitLayers.prototype as any, checkpoint = prototype.checkpointTree; let injected = false;
  prototype.checkpointTree = async function (...args: any[]) { const result = await checkpoint.apply(this, args); if (this.dir === f.app.dir && this.tx?.data.kind === 'stage') { injected = true; throw new LabError('INJECTED_FAILURE', 'fixture interruption before checkpoint receipt'); } return result; };
  try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: 'INJECTED_FAILURE' }); } finally { prototype.checkpointTree = checkpoint; }
  assert(injected); const pending = await listTransactions(f.app.dir); assert.equal(pending[0].recovery.managedIndexPublication.checkpointPublished, false); await refusesRepeatedRecovery(f, false, true); f.success();
});

test('ordinary failure after metadata publication rolls back known B without a live index checkpoint recapture', budget, async t => {
  const f = await fixture(t), prototype = GitLayers.prototype as any, save = prototype.save;
  prototype.save = async function (...args: any[]) { const result = await save.apply(this, args); if (this.dir === f.app.dir && this.tx?.data.kind === 'stage') throw Object.assign(new Error('fixture metadata failure'), { code: 'EIO' }); return result; };
  try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: 'EIO' }); } finally { prototype.save = save; }
  assert.deepEqual(await listTransactions(f.app.dir), []); assert.equal(f.native(['rev-parse', f.checkpoint]), f.A.tree); assert.equal(f.native(['show', ':layer.txt'], f.index), f.A.text.trimEnd()); assert.equal((await f.app.status()).safe, true); f.unchanged(); f.success();
});

for (const change of ['native-C', 'native-lock'] as const) test('managed stage recovery revalidates ' + change + ' during backup copying', budget, async t => {
  const f = await fixture(t); process.env.GIT_LAYERS_FAILPOINT = 'after-stage-checkpoint'; try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: 'INJECTED_FAILURE' }); } finally { delete process.env.GIT_LAYERS_FAILPOINT; }
  const pending = await listTransactions(f.app.dir), entry = pending[0].recovery.files.find((file: any) => file.path === f.index), open = fs.promises.open; let restoring = false, injected = false;
  (fs.promises as any).open = async function (file: any, ...args: any[]) { const handle = await (open as any)(file, ...args), candidate = path.resolve(String(file)); if (candidate.startsWith(f.index + '.recovery-')) restoring = true;
    if (restoring && !injected && candidate === entry.backup) { const read = handle.read.bind(handle); handle.read = async function (...values: any[]) { const result = await read(...values); if (result.bytesRead && !injected) { if (change === 'native-C') f.native(['read-tree', f.C.tree], f.index); else fs.writeFileSync(f.index + '.lock', 'late fixture native lock\n', { flag: 'wx' }); injected = true; } return result; }; } return handle; }; syncBuiltinESMExports();
  const reopened = await GitLayers.open(f.repo); try { await assert.rejects(reopened.recover(), { code: change === 'native-lock' ? 'LOCKED' : 'RECOVERY_CONFLICT' }); } finally { fs.promises.open = open; syncBuiltinESMExports(); }
  assert(injected); if (change === 'native-C') await refusesRepeatedRecovery(f, true);
  else { const bytes = fs.readFileSync(f.index), journal = path.join(f.app.dir, 'transactions', pending[0].id, 'journal.json'), before = fs.readFileSync(journal); for (let repeat = 0; repeat < 2; repeat++) { await assert.rejects(reopened.recover(), { code: 'LOCKED' }); assert(fs.readFileSync(f.index).equals(bytes)); assert(fs.readFileSync(journal).equals(before)); assert.equal(fs.readFileSync(f.index + '.lock', 'utf8'), 'late fixture native lock\n'); } f.unchanged(); }
  f.success();
});
