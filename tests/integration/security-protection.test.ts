import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { enableBranchProtection, disableBranchProtection, inspectBranchProtection } from '../../src/core/branch-protection.js';
import { resolveGitExecutable } from '../../src/core/platform.js';
import { createFixture, cleanupFixture, isolatedEnvironment } from '../../scripts/git-compat/lib.mjs';

const evidenceRoot = process.env.GL_SECURITY_PROTECTION_EVIDENCE;
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-security-protection');
  const previous = { ...process.env }, executable = await resolveGitExecutable(), env = isolatedEnvironment(owned.root, executable);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const commands: unknown[] = [], observations: unknown[] = [];
  const native = (args: string[], ok = [0], cwd = repo) => {
    assert(path.resolve(cwd).startsWith(owned.root + path.sep));
    const r = spawnSync(executable, args, { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 30000 });
    commands.push({ executable, args, cwd, code: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr });
    assert(ok.includes(r.status!), JSON.stringify({ args, code: r.status, error: r.error?.message, stderr: r.stderr })); return r.stdout.trimEnd();
  };
  native(['init', '-b', 'main']); native(['config', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null']);
  native(['config', 'core.autocrlf', 'false']); fs.writeFileSync(path.join(repo, 'base.txt'), 'base sentinel\n'); native(['add', '.']); native(['commit', '-m', 'base']);
  native(['switch', '--orphan', 'layer/a']); fs.writeFileSync(path.join(repo, 'a.txt'), 'Layer sentinel\n'); native(['add', '.']); native(['commit', '-m', 'Layer']); native(['switch', 'main']);
  const app = await GitLayers.init(repo); await app.register('a');
  const snapshot = () => ({ head: native(['rev-parse', 'HEAD']), branch: native(['symbolic-ref', 'HEAD']), refs: native(['for-each-ref', '--format=%(refname) %(objectname)']), index: native(['ls-files', '--stage']), base: fs.readFileSync(path.join(repo, 'base.txt'), 'utf8') });
  const state = () => fs.readFileSync(path.join(app.dir, 'branch-protection', 'state.json'));
  const record = (label: string, value: unknown) => observations.push({ label, value });
  t.after(() => {
    try { if (evidenceRoot) { fs.mkdirSync(evidenceRoot, { recursive: true }); fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '-' + randomUUID() + '.json'), JSON.stringify({ test: t.name, fixture: owned.root, executable, version: native(['--version']), commands, observations }, null, 2) + '\n'); } }
    finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); if (!evidenceRoot) cleanupFixture(owned); }
  });
  return { repo, app, native, snapshot, state, record };
}
function reservationAdmin(worktree: string) { return path.resolve(worktree, fs.readFileSync(path.join(worktree, '.git'), 'utf8').trim().slice('gitdir: '.length)); }

test('P1 protect distinguishes opt-in structural health and complete nominal coverage', { timeout: 900000 }, async t => {
  const f = await fixture(t), disabled = await inspectBranchProtection(f.repo);
  assert.equal(disabled.enabled, false); assert.equal(disabled.healthy, true); assert.equal(disabled.coverage.status, 'disabled'); assert.equal(disabled.coverage.complete, false);
  const installed = await enableBranchProtection(f.repo); assert.equal(installed.coverage.status, 'complete'); assert.equal(installed.coverage.complete, true);
  f.native(['branch', 'layer/external', 'layer/a']);
  const incomplete = await inspectBranchProtection(f.repo); assert.equal(incomplete.enabled, true); assert.equal(incomplete.healthy, true); assert.equal(incomplete.coverage.status, 'incomplete'); assert.equal(incomplete.coverage.complete, false); assert.deepEqual(incomplete.coverage.unprotectedLayers, ['external']);
  const repaired = await enableBranchProtection(f.repo), before = f.snapshot(), state = f.state(); assert.equal(repaired.coverage.complete, true);
  const again = await enableBranchProtection(f.repo); assert.deepEqual(again.reservations, repaired.reservations); assert.deepEqual(f.snapshot(), before); assert.deepEqual(f.state(), state);
  f.native(['switch', 'layer/external'], [128]);
  const unprotected = await disableBranchProtection(f.repo), released = f.snapshot(); assert.equal(unprotected.coverage.status, 'disabled'); await disableBranchProtection(f.repo); assert.deepEqual(f.snapshot(), released);
  f.record('coverage and idempotence', { disabled, installed, incomplete, repaired, again, unprotected });
});

test('P1 protect repairs only an absent owned reservation and preserves current refs', { timeout: 900000 }, async t => {
  const f = await fixture(t), installed = await enableBranchProtection(f.repo), before = f.snapshot();
  f.native(['worktree', 'remove', '--force', installed.validWorktrees[0]!]);
  const broken = await inspectBranchProtection(f.repo); assert.equal(broken.coverage.complete, false); assert(broken.problems.some(p => p.reason === 'missing-worktree' && p.recovery.action === 'reapply-protect' && p.recovery.automatic === false));
  const repaired = await enableBranchProtection(f.repo); assert.equal(repaired.coverage.complete, true); assert.deepEqual(f.snapshot(), before);
  f.record('missing pristine reservation explicit reapply', { broken, repaired, before, after: f.snapshot() });
});

test('P1 protect diagnoses locks content and index without removing unknown state', { timeout: 900000 }, async t => {
  const f = await fixture(t), installed = await enableBranchProtection(f.repo), worktree = installed.validWorktrees[0]!, admin = reservationAdmin(worktree), before = f.snapshot();
  const foreign = path.join(worktree, 'foreign.txt'); fs.writeFileSync(foreign, 'unique external work\n');
  const content = await inspectBranchProtection(f.repo); assert(content.problems.some(p => p.reason === 'content')); const stored = f.state();
  await assert.rejects(() => enableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); await assert.rejects(() => disableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); assert.deepEqual(f.state(), stored); assert.equal(fs.readFileSync(foreign, 'utf8'), 'unique external work\n');
  // Deliberate fixture-only relocation preserves the unknown bytes outside the reservation.
  fs.renameSync(foreign, path.join(path.dirname(f.repo), 'retained-foreign.txt'));
  f.native(['worktree', 'lock', worktree]); const locked = await inspectBranchProtection(f.repo); assert(locked.problems.some(p => p.reason === 'lock')); await assert.rejects(() => disableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); f.native(['worktree', 'unlock', worktree]);
  const lock = path.join(admin, 'index.lock'); fs.writeFileSync(lock, 'external lock sentinel\n'); const indexLock = await inspectBranchProtection(f.repo); assert(indexLock.problems.some(p => p.reason === 'lock')); await assert.rejects(() => enableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); assert.equal(fs.readFileSync(lock, 'utf8'), 'external lock sentinel\n'); fs.renameSync(lock, path.join(path.dirname(f.repo), 'retained-index.lock'));
  f.native(['-C', worktree, 'read-tree', 'HEAD']); const index = fs.readFileSync(path.join(admin, 'index')), indexed = await inspectBranchProtection(f.repo); assert(indexed.problems.some(p => p.reason === 'index')); await assert.rejects(() => disableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); assert.equal(digest(fs.readFileSync(path.join(admin, 'index'))), digest(index)); assert.deepEqual(f.snapshot(), before);
  f.record('external state preserved', { content, locked, indexLock, indexed, mainState: before });
});

test('P1 protect detects stable external ref changes against registered Core OID', { timeout: 900000 }, async t => {
  const f = await fixture(t); await enableBranchProtection(f.repo); const old = f.native(['rev-parse', 'layer/a']), before = f.snapshot();
  f.native(['update-ref', 'refs/heads/layer/a', f.native(['rev-parse', 'main']), old]);
  const changed = await inspectBranchProtection(f.repo), state = f.state(); assert.equal(changed.healthy, false); assert(changed.problems.some(p => p.reason === 'reference')); assert.equal(changed.referenceBaseline, 'registered-layer-oid');
  await assert.rejects(() => enableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); await assert.rejects(() => disableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); assert.deepEqual(f.state(), state); assert.equal(f.native(['cat-file', '-t', old]), 'commit');
  const after = f.snapshot(); assert.equal(after.head, before.head); assert.equal(after.index, before.index); assert.equal(after.base, before.base);
  f.record('external ref requires explicit inspection', { changed, before, after });
});

test('P1 unexpected commit in reservation preserves parent index and projection with recovery guidance', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.app.on('a'); const installed = await enableBranchProtection(f.repo), worktree = installed.validWorktrees[0]!, admin = reservationAdmin(worktree), old = f.native(['rev-parse', 'layer/a']);
  assert.equal(f.native(['-C', worktree, 'status', '--porcelain']), 'D  a.txt'); assert.equal(fs.existsSync(path.join(admin, 'index')), false);
  f.native(['-C', worktree, 'commit', '-a', '-m', 'unexpected fixture commit']); const newRef = f.native(['rev-parse', 'layer/a']), index = fs.readFileSync(path.join(admin, 'index')), state = f.state(), diagnosed = await inspectBranchProtection(f.repo);
  assert.notEqual(newRef, old); assert.equal(f.native(['ls-tree', '-r', 'layer/a']), ''); assert.equal(f.native(['show', 'layer/a^:a.txt']), 'Layer sentinel'); assert.equal(fs.readFileSync(path.join(f.repo, 'a.txt'), 'utf8'), 'Layer sentinel\n');
  assert(diagnosed.problems.some(p => p.reason === 'index' && p.recovery.automatic === false && p.recovery.guidance.some(s => s.includes('commit pai'))));
  await assert.rejects(() => enableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); await assert.rejects(() => disableBranchProtection(f.repo), { code: 'PROTECTION_CONFLICT' }); assert.equal(f.native(['rev-parse', 'layer/a']), newRef); assert.deepEqual(f.state(), state); assert.deepEqual(fs.readFileSync(path.join(admin, 'index')), index);
  f.record('unexpected commit retained', { old, newRef, diagnosed, tree: f.native(['ls-tree', '-r', 'layer/a']), projection: fs.readFileSync(path.join(f.repo, 'a.txt'), 'utf8') });
});

test('P1 protected managed commits and deliberate native branch commits remain healthy', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.app.on('a'); await enableBranchProtection(f.repo);
  fs.writeFileSync(path.join(f.repo, 'a.txt'), 'managed protected commit\n'); await f.app.add('a', ['a.txt']); await f.app.commit('a', 'managed protected'); assert.equal((await inspectBranchProtection(f.repo)).healthy, true);
  await f.app.openLayerBranch('a'); fs.writeFileSync(path.join(f.repo, 'a.txt'), 'native deliberate commit\n'); f.native(['add', 'a.txt']); f.native(['commit', '-m', 'native deliberate']); const opened = await inspectBranchProtection(f.repo); assert.equal(opened.healthy, true); assert.equal(opened.coverage.workingLayer, 'a');
  await f.app.switch('main'); const returned = await inspectBranchProtection(f.repo); assert.equal(returned.coverage.complete, true); assert.equal(returned.healthy, true); assert.equal(fs.readFileSync(path.join(f.repo, 'a.txt'), 'utf8'), 'native deliberate commit\n');
  f.record('managed and native deliberate commits', { opened, returned, status: await f.app.status() });
});
