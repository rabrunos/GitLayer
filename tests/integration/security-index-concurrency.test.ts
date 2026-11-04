import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const evidenceRoot = process.env.GL_INDEX_CONCURRENCY_EVIDENCE;
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

test('D01 base commit refuses an external Layer rename and native main-index staging before write-tree without losing either origin', { timeout: 900000 }, async t => {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-index-concurrency');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const events: unknown[] = [];
  const git = (args: string[], index?: string) => {
    const stdout = cp.execFileSync(officialGit, args, { cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    events.push({ kind: 'git', executable: officialGit, args, index: index ? path.basename(index) : 'main', code: 0, stdout });
    return stdout.trimEnd();
  };
  const write = (file: string, bytes: string) => fs.writeFileSync(path.join(repo, file), bytes);
  const read = (file: string) => fs.readFileSync(path.join(repo, file), 'utf8');
  let observations: unknown = null;
  t.after(() => {
    try {
      if (evidenceRoot) {
        fs.mkdirSync(evidenceRoot, { recursive: true });
        fs.writeFileSync(path.join(evidenceRoot, 'base-commit-native-index-writer.json'), JSON.stringify({ test: t.name, fixture: owned.root, officialGit, version: git(['--version']), node: process.version, platform: process.platform, observations, events }, null, 2) + '\n');
      }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
      if (!evidenceRoot) cleanupFixture(owned);
    }
  });
  git(['init', '-b', 'main']); git(['config', 'core.autocrlf', 'false']);
  git(['config', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null']);
  write('base.txt', 'base A committed\n'); git(['add', '--', 'base.txt']); git(['commit', '-m', 'base']);
  const app = await GitLayers.init(repo); await app.create('a'); await app.on('a');
  write('a.txt', 'Layer A committed\n'); await app.add('a', ['a.txt']); await app.commit('a', 'Layer A');
  write('a.txt', 'Layer B staged\n'); await app.add('a', ['a.txt']); write('a.txt', 'Layer C external disk\n');
  write('base.txt', 'base B staged\n'); git(['add', '--', 'base.txt']);
  const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
  const layer = registry.layers.find((entry: any) => entry.name === 'a');
  const privateIndex = path.join(app.dir, 'indexes', layer.id + '.index');
  const snapshot = () => ({
    head: git(['rev-parse', 'HEAD']), branch: git(['symbolic-ref', 'HEAD']),
    branchRefs: git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']),
    allRefs: git(['for-each-ref', '--format=%(refname) %(objectname)']),
    mainIndex: git(['ls-files', '--stage']), privateIndex: git(['ls-files', '--stage'], privateIndex),
    privateSHA256: hash(fs.readFileSync(privateIndex)),
    a: fs.existsSync(path.join(repo, 'a.txt')) ? read('a.txt') : null,
    moved: fs.existsSync(path.join(repo, 'moved.txt')) ? read('moved.txt') : null,
    base: read('base.txt'),
  });
  const before = snapshot(); let fired = false, externalState: ReturnType<typeof snapshot> | undefined;
  const original = cp.spawn;
  cp.spawn = function (executable: any, args: any, options: any) {
    if (!fired && options?.cwd === repo && Array.isArray(args) && args.includes('write-tree') && !options.env?.GIT_INDEX_FILE) {
      fired = true;
      const script = "const fs=require('node:fs'),cp=require('node:child_process');fs.renameSync(process.argv[2],process.argv[3]);cp.execFileSync(process.argv[1],['add','--','moved.txt'],{cwd:process.argv[4],env:process.env,windowsHide:true})";
      const writer = cp.spawnSync(process.execPath, ['-e', script, officialGit, path.join(repo, 'a.txt'), path.join(repo, 'moved.txt'), repo], { cwd: repo, env, encoding: 'utf8', windowsHide: true });
      events.push({ kind: 'external-writer-before-main-write-tree', executable: process.execPath, gitExecutable: officialGit, script, code: writer.status, stderr: writer.stderr });
      assert.equal(writer.status, 0, writer.stderr);
      externalState = snapshot();
    }
    return (original as any).call(this, executable, args, options);
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  try { await assert.rejects(app.baseCommit('must refuse concurrent Layer rename'), { code: 'OWNERSHIP_AMBIGUOUS' }); }
  finally { cp.spawn = original; syncBuiltinESMExports(); }
  assert(fired && externalState, 'A real external writer must run after initial validation and before the main write-tree');
  const after = snapshot();
  assert.equal(after.head, before.head); assert.equal(after.branch, before.branch); assert.equal(after.branchRefs, before.branchRefs);
  assert.equal(after.privateIndex, before.privateIndex); assert.equal(after.privateSHA256, before.privateSHA256);
  assert.equal(after.mainIndex, externalState.mainIndex, 'Refusal must preserve the external staging, not restore the old main index');
  assert.equal(after.a, null); assert.equal(after.moved, 'Layer C external disk\n'); assert.equal(after.base, 'base B staged\n');
  assert.equal(git(['show', ':base.txt']), 'base B staged'); assert.equal(git(['show', ':moved.txt']), 'Layer C external disk');
  assert.equal(git(['show', ':a.txt'], privateIndex), 'Layer B staged'); assert.equal(git(['show', 'layer/a:a.txt']), 'Layer A committed');
  assert.equal(git(['show', 'HEAD:base.txt']), 'base A committed');
  const status = await app.status(); assert.equal(status.safe, false);
  assert(['RECOVERY_REQUIRED', 'OWNERSHIP_AMBIGUOUS'].includes(status.error!.code));
  const diagnosis = await app.doctor(); assert.equal(diagnosis.safe, false);
  if (diagnosis.transactions.length) assert(diagnosis.checks.some(check => !check.ok && check.detail?.code === 'RECOVERY_REQUIRED'));
  const exported = await app.exportRecovery(path.join(owned.root, 'export')); assert.equal(exported.complete, true);
  const manifest = JSON.parse(fs.readFileSync(exported.manifest, 'utf8')); assert.equal(manifest.complete, true);
  const savedMainIndex = path.join(exported.destination, 'git-state', 'index');
  assert.equal(git(['show', ':moved.txt'], savedMainIndex), 'Layer C external disk');
  assert.equal(git(['show', ':base.txt'], savedMainIndex), 'base B staged');
  const savedPrivate = manifest.entries.find((entry: any) => entry.type === 'file' && path.resolve(entry.source) === path.resolve(privateIndex));
  assert(savedPrivate); assert.equal(hash(fs.readFileSync(path.join(exported.destination, savedPrivate.path))), before.privateSHA256);
  if (diagnosis.transactions.length) assert(manifest.entries.some((entry: any) => entry.path.endsWith('/journal.json')));
  const final = snapshot(); assert.equal(final.head, before.head); assert.equal(final.branchRefs, before.branchRefs);
  assert.equal(final.mainIndex, externalState.mainIndex); assert.equal(final.privateSHA256, before.privateSHA256); assert.equal(final.moved, 'Layer C external disk\n');
  observations = { fired, before, externalState, after, status, diagnosis, exported, final };
});
