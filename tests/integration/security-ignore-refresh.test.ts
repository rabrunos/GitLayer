import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const evidenceRoot = process.env.GL_SECURITY_EVIDENCE;
const keepFixtures = process.env.GL_SECURITY_KEEP_FIXTURES === '1';
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function fixtureParent() {
  const parent = fs.realpathSync(os.tmpdir());
  for (let cursor = parent; ; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Fixture ancestors must be regular directories');
    try { fs.lstatSync(path.join(cursor, '.git')); assert.fail('Fixture parent must be outside every repository'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(cursor) === cursor) break;
  }
  return parent;
}

async function fixture(t: TestContext) {
  const owned = createFixture(fixtureParent(), 'gl-ignore-refresh');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'), control = path.join(owned.root, 'control');
  fs.mkdirSync(repo); fs.mkdirSync(control);
  const events: any[] = [], checks: Array<{ label: string; actual: unknown; expected: unknown }> = [];
  const git = (cwd: string, args: string[], index?: string) => {
    const result = spawnSync(officialGit, args, { cwd, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, timeout: 60000 });
    const value = { repository: cwd === repo ? 'layer' : 'control', args, code: result.status, signal: result.signal, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.message };
    events.push({ kind: 'git', ...value }); return value;
  };
  const must = (cwd: string, args: string[], index?: string) => { const value = git(cwd, args, index); assert.equal(value.code, 0, JSON.stringify(value)); return value.stdout.trimEnd(); };
  const write = (cwd: string, file: string, bytes: string) => fs.writeFileSync(path.join(cwd, file), bytes);
  for (const cwd of [repo, control]) {
    must(cwd, ['init', '-b', 'main']); must(cwd, ['config', 'core.hooksPath', 'NUL']); must(cwd, ['config', 'core.autocrlf', 'false']);
    write(cwd, 'base.txt', 'base A\n'); must(cwd, ['add', '--', 'base.txt']); must(cwd, ['commit', '-m', 'base']);
    write(cwd, 'old.txt', 'preexisting unowned bytes\n');
  }
  let app = await GitLayers.init(repo);
  const registry = () => JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
  const workspace = () => JSON.parse(fs.readFileSync(path.join(app.dir, 'workspace.json'), 'utf8'));
  const disk = (cwd: string) => Object.fromEntries(['base.txt', 'old.txt', 'new.txt'].map(file => [file, fs.existsSync(path.join(cwd, file)) ? { bytes: fs.readFileSync(path.join(cwd, file), 'utf8'), sha256: sha(fs.readFileSync(path.join(cwd, file))) } : null]));
  const state = () => ({
    layer: { head: must(repo, ['rev-parse', 'HEAD']), branch: must(repo, ['symbolic-ref', '--short', 'HEAD']), refs: must(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), index: must(repo, ['ls-files', '--stage']), privateIndexes: Object.fromEntries(registry().layers.map((layer: any) => [layer.name, must(repo, ['ls-files', '--stage'], path.join(app.dir, 'indexes', layer.id + '.index'))])), files: disk(repo) },
    control: { head: must(control, ['rev-parse', 'HEAD']), refs: must(control, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), index: must(control, ['ls-files', '--stage']), files: disk(control) },
  });
  const record = (label: string) => { const value = { label, ...state(), registry: registry(), workspace: workspace(), exclude: fs.readFileSync(path.join(repo, '.git', 'info', 'exclude'), 'utf8') }; events.push({ kind: 'snapshot', ...value }); return value; };
  // Independent official-Git semantics plus exact raw index/metadata fingerprints.
  // Ref scope is refs/heads, as in state(); technical retention refs are not compared blindly.
  const rawFile = (file: string) => {
    try { const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1); const bytes = fs.readFileSync(file); return { sha256: sha(bytes), bytes: bytes.length, mode: stat.mode & 0o777 }; }
    catch (error: any) { if (error.code === 'ENOENT') return null; throw error; }
  };
  const independent = () => ({
    domain: state(),
    rawIndexes: { main: rawFile(path.join(repo, '.git', 'index')), control: rawFile(path.join(control, '.git', 'index')), layers: Object.fromEntries(registry().layers.map((layer: any) => [layer.name, rawFile(path.join(app.dir, 'indexes', layer.id + '.index'))])) },
    fileModes: Object.fromEntries([['layer', repo], ['control', control]].map(([role, cwd]) => [role, Object.fromEntries(['base.txt', 'old.txt', 'new.txt'].map(file => [file, rawFile(path.join(cwd!, file))?.mode ?? null]))])),
    metadata: { registry: registry(), workspace: workspace(), exclude: fs.readFileSync(path.join(repo, '.git', 'info', 'exclude'), 'utf8'), raw: { registry: rawFile(path.join(app.dir, 'registry.json')), workspace: rawFile(path.join(app.dir, 'workspace.json')), exclude: rawFile(path.join(repo, '.git', 'info', 'exclude')) } },
  });
  const recordIndependent = (label: string) => { const value = independent(); events.push({ kind: 'snapshot', label, independent: value, refScope: 'refs/heads only; technical checkpoint retentions excluded' }); return value; };
  const check = (label: string, actual: unknown, expected: unknown) => { checks.push({ label, actual, expected }); };
  const observe = async (label: string, newReserved: boolean) => {
    const before = state();
    const current = await app.status(); events.push({ kind: 'core', label: label + ' current status', result: current });
    check(label + ' current status safe', current.safe, true);
    app = await GitLayers.open(repo);
    const reopened = await app.status(); events.push({ kind: 'core', label: label + ' reopened status', result: reopened });
    check(label + ' reopened status safe', reopened.safe, true);
    check(label + ' old remains unowned', reopened.layers.some(layer => layer.reservations.includes('old.txt')), false);
    check(label + ' new ownership', reopened.layers.some(layer => layer.reservations.includes('new.txt')), newReserved);
    check(label + ' status and reopen preserve refs, both indexes and bytes', state(), before);
    return record(label);
  };
  const ignored = (label: string, file: string, expected: boolean) => {
    for (const cwd of [repo, control]) {
      const actual = git(cwd, ['check-ignore', '--no-index', '--', file]);
      git(cwd, ['check-ignore', '-v', '--no-index', '--', file]);
      check(label + ' effective ignore ' + (cwd === repo ? 'layer' : 'control') + ' ' + file, actual.code, expected ? 0 : 1);
    }
  };
  const removeFixtureStaging = () => {
    for (const cwd of [repo, control]) {
      const staged = must(cwd, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
      assert(staged.every(file => ['old.txt', 'new.txt'].includes(file)), 'Only fixture sentinel paths can have been staged');
      if (staged.length) must(cwd, ['restore', '--staged', '--source=HEAD', '--', ...staged]);
    }
  };
  const adds = (label: string, explicitFile: string, ignoredNow: boolean) => {
    const before = state();
    for (const cwd of [repo, control]) check(label + ' explicit add ' + (cwd === repo ? 'layer' : 'control'), git(cwd, ['add', '--', explicitFile]).code, ignoredNow ? 1 : 0);
    for (const cwd of [repo, control]) check(label + ' broad add ' + (cwd === repo ? 'layer' : 'control'), git(cwd, ['add', '.']).code, 0);
    const after = record(label);
    for (const role of ['layer', 'control'] as const) {
      const { index: priorIndex, ...prior } = before[role], { index: actualIndex, ...actual } = after[role];
      check(label + ' native add preserves refs, private staging and bytes ' + role, actual, prior);
      if (ignoredNow) check(label + ' ignored paths do not enter index ' + role, actualIndex, priorIndex);
      else check(label + ' only old is deliberately staged ' + role, must(role === 'layer' ? repo : control, ['diff', '--cached', '--name-only']), 'old.txt');
    }
    removeFixtureStaging();
  };
  t.after(() => {
    try {
      record('final');
      if (evidenceRoot) { fs.mkdirSync(evidenceRoot, { recursive: true }); fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json'), JSON.stringify({ test: t.name, officialGit, version: must(repo, ['--version']), fixture: owned.root, checks, events }, null, 2) + '\n'); }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous);
      if (keepFixtures) t.diagnostic('Preserved owned fixture: ' + owned.root); else cleanupFixture(owned);
    }
  });
  await app.create('a'); await app.on('a'); await app.target('a');
  return { get app() { return app; }, repo, control, owned, write, record, check, observe, ignored, adds, checks, state, independent, recordIndependent };
}

for (const source of ['global', 'info'] as const) test(`P1 ${source} ignore changes refresh old-file exceptions and absent released reservations`, { timeout: 900000 }, async t => {
  const f = await fixture(t);
  const globalFile = path.join(f.owned.root, 'current-user-ignore');
  const setRules = (rules: string[]) => {
    const text = rules.map(file => file + '\n').join('');
    if (source === 'global') {
      fs.writeFileSync(globalFile, text);
      for (const cwd of [f.repo, f.control]) {
        const value = spawnSync(officialGit, ['config', 'core.excludesFile', globalFile], { cwd, env: process.env, encoding: 'utf8', windowsHide: true, timeout: 60000 });
        assert.equal(value.status, 0, value.stderr);
      }
    } else for (const cwd of [f.repo, f.control]) {
      const file = path.join(cwd, '.git', 'info', 'exclude');
      // Change only our synthetic user rules, keeping the managed block untouched.
      const rest = fs.readFileSync(file, 'utf8').split('\n').filter(line => !['old.txt', 'new.txt'].includes(line)).join('\n');
      fs.writeFileSync(file, text + rest);
    }
  };
  const initial = f.record('initial eligible old unassigned file');
  f.check('old initial whitelist', initial.workspace.editing.unassigned.includes('old.txt'), true);
  f.ignored('initial old eligibility', 'old.txt', false);
  for (const cwd of [f.repo, f.control]) f.write(cwd, 'new.txt', 'new reservation working bytes\n');
  await f.observe('new ordinary file is reserved before ignore changes', true);
  setRules(['old.txt', 'new.txt']);
  await f.observe('user now ignores old and new', true);
  f.ignored('current user rule for old', 'old.txt', true);
  f.adds('ordinary adds respect newly ignored old', 'old.txt', true);
  for (const cwd of [f.repo, f.control]) fs.unlinkSync(path.join(cwd, 'new.txt'));
  const beforeRelease = f.state();
  const beforeAmbiguousRelease = f.recordIndependent('absent new reservation with ignored preexisting unowned candidate');
  await assert.rejects(() => f.app.release('a', ['new.txt']), { code: 'OWNERSHIP_AMBIGUOUS' });
  const afterRefusal = f.recordIndependent('release refuses unresolved external absence without changing either domain');
  assert.deepEqual(afterRefusal, beforeAmbiguousRelease);
  const review = await f.app.ownershipReview();
  assert.equal(review.ambiguous, true);
  assert.deepEqual(review.missing, [{ path: 'new.txt', owner: 'a' }]);
  assert(review.candidates.includes('old.txt'));
  assert.deepEqual(f.independent(), afterRefusal, 'Read-only ownership review preserves raw indexes metadata and physical bytes');
  const beforeDeleted = f.recordIndependent('explicit deletion decision before releasing absent reservation');
  await f.app.resolveOwnership({ token: review.token, deleted: ['new.txt'] });
  const afterDeleted = f.recordIndependent('only new deletion is acknowledged; ignored old remains unassigned');
  assert.deepEqual(afterDeleted.domain, beforeDeleted.domain);
  assert.deepEqual(afterDeleted.rawIndexes, beforeDeleted.rawIndexes);
  assert.deepEqual(afterDeleted.fileModes, beforeDeleted.fileModes);
  assert.deepEqual(afterDeleted.metadata.registry, beforeDeleted.metadata.registry);
  assert.deepEqual(afterDeleted.metadata.raw.registry, beforeDeleted.metadata.raw.registry);
  assert.equal(afterDeleted.metadata.exclude, beforeDeleted.metadata.exclude);
  assert.deepEqual(afterDeleted.metadata.raw.exclude, beforeDeleted.metadata.raw.exclude);
  const expectedWorkspace = structuredClone(beforeDeleted.metadata.workspace);
  expectedWorkspace.acknowledgedMissing = [...new Set([...(expectedWorkspace.acknowledgedMissing ?? []), 'new.txt'])];
  assert.deepEqual(afterDeleted.metadata.workspace, expectedWorkspace);
  assert(afterDeleted.metadata.workspace.editing.unassigned.includes('old.txt'));
  assert(afterDeleted.metadata.registry.layers.every((layer: any) => !layer.reservations.includes('old.txt')));
  assert(afterDeleted.metadata.registry.layers.find((layer: any) => layer.name === 'a').reservations.includes('new.txt'));
  await f.app.release('a', ['new.txt']);
  f.check('release while absent does not change stage refs or bytes', f.state(), beforeRelease);
  const afterRelease = f.recordIndependent('original release succeeds after explicit deletion without adopting old');
  assert.deepEqual(afterRelease.domain, beforeDeleted.domain);
  assert.deepEqual(afterRelease.rawIndexes, beforeDeleted.rawIndexes);
  assert.deepEqual(afterRelease.fileModes, beforeDeleted.fileModes);
  assert(afterRelease.metadata.workspace.editing.unassigned.includes('old.txt'));
  assert(afterRelease.metadata.registry.layers.every((layer: any) => !layer.reservations.includes('old.txt') && !layer.reservations.includes('new.txt')));
  await f.observe('release while ignored and absent', false);
  for (const cwd of [f.repo, f.control]) f.write(cwd, 'new.txt', 'recreated currently ignored bytes\n');
  await f.observe('recreated ignored file remains unowned', false);
  f.ignored('released recreation follows current user rule', 'new.txt', true);
  f.adds('ordinary adds respect ignored recreation', 'new.txt', true);
  setRules(['new.txt']);
  await f.observe('unignore old restores its original eligible flow', false);
  f.ignored('old eligibility restored', 'old.txt', false);
  f.ignored('released file remains ignored', 'new.txt', true);
  f.adds('unignored preexisting file can be deliberately staged', 'old.txt', false);
  const failures = f.checks.filter(check => { try { assert.deepEqual(check.actual, check.expected); return false; } catch { return true; } });
  assert.deepEqual(failures, [], 'Current user ignore rules must govern unowned exceptions after every Core observation');
});