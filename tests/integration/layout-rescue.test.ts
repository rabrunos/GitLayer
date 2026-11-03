import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import { resolveGitExecutable } from '../../src/core/platform.js';
import { inventoryLayerDirectory, inspectLayerLayout, migrateLayerLayout, resolveLayerDirectory } from '../../src/core/layout.js';
import { doctorRepository, exportRepositoryRecovery } from '../../src/core/rescue.js';
import { atomicJSON, fingerprint, Transaction } from '../../src/core/storage.js';
import { discover } from '../../src/core/git.js';
import { validateRecovery } from '../../src/core/recovery.js';
import { GitLayers } from '../../src/core/index.js';

async function fixture(t: TestContext) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'git-layer-layout-rescue-'));
  const nonce = randomUUID(), marker = path.join(parent, '.owned-fixture');
  await fs.writeFile(marker, nonce, { flag: 'wx' });
  const root = path.join(parent, 'repository'), home = path.join(parent, 'home');
  await fs.mkdir(root); await fs.mkdir(home);
  const keys = ['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_LAYERS_FAILPOINT'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: path.join(home, 'none-system'), GIT_CONFIG_GLOBAL: path.join(home, 'none-global') });
  delete process.env.GIT_LAYERS_FAILPOINT;
  t.after(async () => {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    assert.equal(await fs.readFile(marker, 'utf8'), nonce);
    const resolved = await fs.realpath(parent);
    assert.equal(path.dirname(resolved).toLowerCase(), (await fs.realpath(os.tmpdir())).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('git-layer-layout-rescue-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const executable = await resolveGitExecutable();
  const git = (...args: string[]) => execFileSync(executable, ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_EDITOR: 'false', GIT_PAGER: '', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: path.join(home, 'none-system'), GIT_CONFIG_GLOBAL: path.join(home, 'none-global') }, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main'); git('config', '--local', 'user.name', 'Synthetic Layout Test'); git('config', '--local', 'user.email', 'fixture@example.invalid');
  git('config', '--local', 'core.autocrlf', 'false'); git('config', '--local', 'commit.gpgsign', 'false'); git('config', '--local', 'core.hooksPath', '/dev/null');
  await fs.writeFile(path.join(root, 'base.txt'), 'base original\n');
  git('add', '--', 'base.txt'); git('commit', '-m', 'initial fixture');
  const repo = await discover(root), legacy = path.join(repo.gitDir, 'git-layers'), current = path.join(repo.gitDir, 'layers');
  async function seedLegacy() {
    await atomicJSON(path.join(legacy, 'registry.json'), { schema: 1, layers: [] });
    await atomicJSON(path.join(legacy, 'workspace.json'), { schema: 1, branch: 'main', head: repo.head });
    await fs.mkdir(path.join(legacy, 'indexes'));
    await fs.copyFile(repo.index, path.join(legacy, 'indexes', 'evidence.index'));
    await fs.mkdir(path.join(legacy, 'shelves'));
    await fs.writeFile(path.join(legacy, 'shelves', 'historical.bin'), Buffer.from([0, 255, 4, 8]));
  }
  return { parent, root, git, repo, legacy, current, seedLegacy };
}

test('GL25: fresh layout uses layers; legacy opens in place without implicit migration', async t => {
  const f = await fixture(t);
  assert.equal(await resolveLayerDirectory(f.repo.gitDir), f.current);
  await f.seedLegacy();
  const before = await inventoryLayerDirectory(f.legacy);
  assert.equal(await resolveLayerDirectory(f.repo.gitDir), f.legacy);
  assert.deepEqual(await inventoryLayerDirectory(f.legacy), before);
  await assert.rejects(() => fs.lstat(f.current), { code: 'ENOENT' });
});

test('GL25: explicit migration preserves Git state, legacy bytes, binary shelves and completed absolute journals', async t => {
  const f = await fixture(t); await f.seedLegacy();
  const tx = await Transaction.begin(f.legacy, 'historical-backup', {});
  await tx.backup(path.join(f.legacy, 'registry.json'), 'registry');
  await tx.finish();
  const before = await inventoryLayerDirectory(f.legacy), head = f.git('rev-parse', 'HEAD'), semanticIndex = f.git('ls-files', '--stage'), base = await fs.readFile(path.join(f.root, 'base.txt'));
  await assert.rejects(() => migrateLayerLayout(f.root), { code: 'CONFIRM_REQUIRED' });
  const result = await migrateLayerLayout(f.root, { confirm: true });
  assert.equal(result.alreadyMigrated, false);
  assert.equal(await resolveLayerDirectory(f.repo.gitDir), f.current);
  assert.deepEqual((await inventoryLayerDirectory(f.legacy)).filter(entry => entry.path !== 'locks'), before);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(f.git('ls-files', '--stage'), semanticIndex);
  assert.deepEqual(await fs.readFile(path.join(f.root, 'base.txt')), base);
  assert.deepEqual(await fs.readFile(path.join(f.current, 'shelves', 'historical.bin')), Buffer.from([0, 255, 4, 8]));
  const journal = JSON.parse(await fs.readFile(path.join(f.current, 'transactions', tx.id, 'journal.json'), 'utf8'));
  assert.ok(journal.backups[0].copy.startsWith(f.legacy + path.sep));
  assert.deepEqual(await fs.readFile(journal.backups[0].copy), await fs.readFile(journal.backups[0].source));
  assert.equal((await migrateLayerLayout(f.root, { confirm: true })).alreadyMigrated, true);
  assert.equal((await inspectLayerLayout(f.repo.gitDir)).retainedLegacy, f.legacy);
  assert.equal((await doctorRepository(f.root)).safe, true);
  await fs.writeFile(path.join(f.legacy, 'unexpected-new-work'), 'old CLI changed legacy');
  await assert.rejects(() => resolveLayerDirectory(f.repo.gitDir), { code: 'LEGACY_DIVERGED' });
});

test('GL25: unknown destination and pending recovery are refused without losing bytes', async t => {
  const f = await fixture(t); await f.seedLegacy();
  await fs.mkdir(f.current); await fs.writeFile(path.join(f.current, 'unknown'), 'preserve unknown');
  await assert.rejects(() => migrateLayerLayout(f.root, { confirm: true }), { code: 'LAYOUT_CONFLICT' });
  assert.equal(await fs.readFile(path.join(f.current, 'unknown'), 'utf8'), 'preserve unknown');
  await fs.unlink(path.join(f.current, 'unknown')); await fs.rmdir(f.current);
  const tx = await Transaction.begin(f.legacy, 'interrupted', {});
  await tx.backup(path.join(f.root, 'base.txt'), 'base');
  await assert.rejects(() => migrateLayerLayout(f.root, { confirm: true }), { code: 'RECOVERY_REQUIRED' });
  assert.equal(JSON.parse(await fs.readFile(path.join(tx.dir, 'journal.json'), 'utf8')).state, 'pending');
  await assert.rejects(() => fs.lstat(f.current), { code: 'ENOENT' });
});

test('GL25: interruption after copy retains usable legacy and identifiable partial evidence; retry publishes', async t => {
  const f = await fixture(t); await f.seedLegacy();
  const original = await fingerprint(path.join(f.legacy, 'registry.json'));
  process.env.GIT_LAYERS_FAILPOINT = 'migration-after-copy';
  await assert.rejects(() => migrateLayerLayout(f.root, { confirm: true }), { code: 'INJECTED_FAILURE' });
  delete process.env.GIT_LAYERS_FAILPOINT;
  assert.equal(await resolveLayerDirectory(f.repo.gitDir), f.legacy);
  assert.deepEqual(await fingerprint(path.join(f.legacy, 'registry.json')), original);
  const partial = (await fs.readdir(f.repo.gitDir)).find(name => name.startsWith('.layers-migration-'));
  assert.ok(partial);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.repo.gitDir, partial, 'migration-incomplete.json'), 'utf8')).source, f.legacy);
  await migrateLayerLayout(f.root, { confirm: true });
  assert.equal(await resolveLayerDirectory(f.repo.gitDir), f.current);
});

test('GL19: doctor and export preserve invalid registry, invalid journal and live/stale locks independently of normal open', async t => {
  const f = await fixture(t); await f.seedLegacy();
  await fs.writeFile(path.join(f.legacy, 'registry.json'), '{ invalid registry bytes');
  await fs.mkdir(path.join(f.legacy, 'transactions', 'broken'), { recursive: true });
  await fs.writeFile(path.join(f.legacy, 'transactions', 'broken', 'journal.json'), '{ journal bytes');
  await fs.mkdir(path.join(f.legacy, 'locks', 'coordinator'), { recursive: true });
  await atomicJSON(path.join(f.legacy, 'locks', 'coordinator', 'owner.json'), { schema: 1, pid: process.pid, host: os.hostname(), token: 'preserved-token' });
  await fs.writeFile(f.repo.index + '.lock', 'preserve native lock');
  const beforeIndex = await fingerprint(f.repo.index), beforeRegistry = await fs.readFile(path.join(f.legacy, 'registry.json'));
  const doctor = await doctorRepository(f.root);
  assert.equal(doctor.safe, false);
  assert.ok(doctor.checks.some(entry => !entry.ok && (entry.detail as any).code === 'LOCKED'));
  assert.ok(doctor.checks.some(entry => !entry.ok && (entry.detail as any).code === 'METADATA_INVALID'));
  const destination = path.join(f.parent, 'rescue-export'), result = await exportRepositoryRecovery(f.root, destination);
  assert.equal(result.complete, true);
  const manifest = JSON.parse(await fs.readFile(result.manifest, 'utf8'));
  assert.equal(manifest.complete, true);
  assert.deepEqual(await fs.readFile(path.join(destination, 'metadata', 'git-layers', 'registry.json')), beforeRegistry);
  assert.equal(await fs.readFile(path.join(destination, 'metadata', 'git-layers', 'transactions', 'broken', 'journal.json'), 'utf8'), '{ journal bytes');
  assert.ok(await fs.lstat(path.join(destination, 'metadata', 'git-layers', 'locks', 'coordinator', 'owner.json')));
  assert.equal(await fs.readFile(f.repo.index + '.lock', 'utf8'), 'preserve native lock');
  assert.deepEqual(await fingerprint(f.repo.index), beforeIndex);
  assert.deepEqual(await fs.readFile(path.join(f.legacy, 'registry.json')), beforeRegistry);
});

test('GL19: export requires a new external destination, refuses linked ancestors and records source junction without following it', async t => {
  const f = await fixture(t); await f.seedLegacy();
  await assert.rejects(() => exportRepositoryRecovery(f.root, path.join(f.root, 'export')), { code: 'EXPORT_PATH' });
  const existing = path.join(f.parent, 'existing'); await fs.mkdir(existing);
  await assert.rejects(() => exportRepositoryRecovery(f.root, existing), { code: 'EXPORT_NOT_EMPTY' });
  const external = path.join(f.parent, 'external'), junction = path.join(f.parent, 'junction');
  await fs.mkdir(external); await fs.writeFile(path.join(external, 'private'), 'must not copy target');
  await fs.symlink(external, junction, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => exportRepositoryRecovery(f.root, path.join(junction, 'new-export')), { code: 'UNSAFE_PATH' });
  const sourceLink = path.join(f.legacy, 'external-junction');
  await fs.symlink(external, sourceLink, process.platform === 'win32' ? 'junction' : 'dir');
  const doctor = await doctorRepository(f.root);
  assert.equal(doctor.safe, false);
  const result = await exportRepositoryRecovery(f.root, path.join(f.parent, 'link-evidence'));
  assert.equal(result.links, 1);
  const manifest = JSON.parse(await fs.readFile(result.manifest, 'utf8'));
  assert.equal(manifest.entries.find((entry: any) => entry.type === 'symlink').source, sourceLink);
  await assert.rejects(() => fs.lstat(path.join(result.destination, 'metadata', 'git-layers', 'external-junction')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(external, 'private'), 'utf8'), 'must not copy target');
});

test('GL19: recovery validates both discovered layouts without permitting arbitrary metadata roots', async t => {
  const f = await fixture(t); await f.seedLegacy();
  const data = { schema: 1, id: 'recovery-test', kind: 'restore', recovery: { beforeRegistry: { schema: 1, layers: [] }, beforeWorkspace: { schema: 1, branch: 'main', head: f.repo.head }, files: [] }, backups: [] };
  await validateRecovery(f.repo, f.legacy, data);
  await validateRecovery(f.repo, f.current, data);
  await assert.rejects(() => validateRecovery(f.repo, path.join(f.repo.gitDir, 'arbitrary'), data), { code: 'RECOVERY_INVALID' });
});

test('GL25: interruption after destination reservation refuses reopening and preserves all three copies for export', async t => {
  const f = await fixture(t); await f.seedLegacy();
  const original = await fingerprint(path.join(f.legacy, 'registry.json'));
  process.env.GIT_LAYERS_FAILPOINT = 'migration-after-reserve';
  await assert.rejects(() => migrateLayerLayout(f.root, { confirm: true }), { code: 'INJECTED_FAILURE' });
  delete process.env.GIT_LAYERS_FAILPOINT;
  await assert.rejects(() => resolveLayerDirectory(f.repo.gitDir), { code: 'LAYOUT_CONFLICT' });
  assert.deepEqual(await fingerprint(path.join(f.legacy, 'registry.json')), original);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.current, 'layout-migration-incomplete.json'), 'utf8')).state, 'incomplete');
  const result = await exportRepositoryRecovery(f.root, path.join(f.parent, 'interrupted-layout-export'));
  assert.equal(result.complete, true);
  assert.deepEqual(await fs.readFile(path.join(result.destination, 'metadata', 'git-layers', 'registry.json')), await fs.readFile(path.join(f.legacy, 'registry.json')));
  assert.equal((await doctorRepository(f.root)).safe, false);
});

test('GL25: storage is discovered with Git when .git is a file; packed refs and worktree bytes remain unchanged', async t => {
  const f = await fixture(t), actualGit = path.join(f.parent, 'actual-git');
  f.git('init', '--separate-git-dir', actualGit);
  f.git('branch', 'layer/native-candidate'); f.git('pack-refs', '--all');
  const repo = await discover(f.root), legacy = path.join(repo.gitDir, 'git-layers');
  assert.equal((await fs.lstat(path.join(f.root, '.git'))).isFile(), true);
  assert.equal(repo.gitDir, actualGit);
  await atomicJSON(path.join(legacy, 'registry.json'), { schema: 1, layers: [] });
  await atomicJSON(path.join(legacy, 'workspace.json'), { schema: 1, branch: 'main', head: repo.head });
  const refs = f.git('for-each-ref', '--format=%(refname) %(objectname)'), index = f.git('ls-files', '--stage');
  const result = await migrateLayerLayout(f.root, { confirm: true });
  assert.equal(result.destination, path.join(actualGit, 'layers'));
  assert.equal(f.git('for-each-ref', '--format=%(refname) %(objectname)'), refs);
  assert.equal(f.git('ls-files', '--stage'), index);
  assert.equal(await fs.readFile(path.join(f.root, 'base.txt'), 'utf8'), 'base original\n');
});

test('GL19/GL25: public Core/CLI use new layout; CLI rescues invalid metadata and migrates a separate legacy fixture', async t => {
  const f = await fixture(t), app = await GitLayers.init(f.root);
  assert.equal(app.dir, f.current);
  const cli = (...args: string[]) => {
    const response = spawnSync(process.execPath, ['--import', 'tsx', path.resolve('src/cli/index.ts'), '--cwd', f.root, '--json', ...args], { cwd: path.resolve('.'), encoding: 'utf8', env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    const result = JSON.parse(response.stdout);
    assert.equal(response.status, args[0] === 'doctor' && result.result?.safe === false ? 3 : 0, response.stderr);
    return result;
  };
  await fs.writeFile(path.join(f.current, 'registry.json'), '{ exact invalid bytes');
  assert.equal(cli('doctor').result.safe, false);
  const result = cli('recovery-export', path.join(f.parent, 'cli-export'));
  assert.equal(result.result.complete, true);
  assert.equal(await fs.readFile(path.join(f.parent, 'cli-export', 'metadata', 'layers', 'registry.json'), 'utf8'), '{ exact invalid bytes');
  // Rename only this test's own newly initialized metadata to exercise explicit
  // legacy input without touching any real project or previous user data.
  await fs.writeFile(path.join(f.current, 'registry.json'), JSON.stringify({ schema: 1, layers: [] }));
  await fs.rename(f.current, f.legacy);
  const migrated = cli('migrate', '--yes').result;
  assert.equal(migrated.destination, f.current);
  assert.equal(migrated.retainedLegacy, f.legacy);
  assert.equal(cli('doctor').result.safe, true);
  assert.equal((await GitLayers.open(f.root)).dir, f.current);
});

test('GL25: migrated Core can advance Layer refs while retained legacy stays historical evidence', async t => {
  const f = await fixture(t); await f.seedLegacy();
  const before = await GitLayers.open(f.root);
  await before.create('scripts'); await before.on('scripts');
  await fs.writeFile(path.join(f.root, 'script.txt'), 'first\n');
  await before.add('scripts', ['script.txt']); await before.commit('scripts', 'first synthetic script');
  const head = f.git('rev-parse', 'HEAD'), layer = f.git('rev-parse', 'refs/heads/layer/scripts');
  await migrateLayerLayout(f.root, { confirm: true });
  const app = await GitLayers.open(f.root);
  assert.equal(app.dir, f.current);
  await fs.writeFile(path.join(f.root, 'script.txt'), 'second\n');
  await app.add('scripts', ['script.txt']); await app.commit('scripts', 'second synthetic script');
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.notEqual(f.git('rev-parse', 'refs/heads/layer/scripts'), layer);
  assert.equal(f.git('show', 'refs/heads/layer/scripts:script.txt'), 'second');
  assert.equal(await fs.readFile(path.join(f.root, 'script.txt'), 'utf8'), 'second\n');
  assert.equal((await doctorRepository(f.root)).safe, true);
  assert.equal(await resolveLayerDirectory(f.repo.gitDir), f.current);
  f.git('add', '-f', '--', 'script.txt');
  const contaminated = await doctorRepository(f.root);
  assert.equal(contaminated.safe, false);
  assert.ok(contaminated.checks.some(entry => !entry.ok && (entry.detail as any).code === 'BASE_CONTAMINATED'));
});

test('GL19: diagnostic distinguishes deliberate branch mode main index from retained private Layer index', async t => {
  const f = await fixture(t), app = await GitLayers.init(f.root);
  await app.create('native-mode');
  f.git('switch', 'layer/native-mode');
  const branchHead = f.git('rev-parse', 'HEAD'), workspace = path.join(f.current, 'workspace.json');
  await atomicJSON(workspace, { schema: 1, branch: 'layer/native-mode', head: branchHead, branchLayer: 'native-mode', returnBranch: 'main' });
  const registry = JSON.parse(await fs.readFile(path.join(f.current, 'registry.json'), 'utf8'));
  const privateIndex = path.join(f.current, 'indexes', registry.layers[0].id + '.index'), before = await fingerprint(privateIndex);
  await fs.writeFile(path.join(f.root, 'native.txt'), 'native commit in branch context\n');
  f.git('add', '--', 'native.txt'); f.git('commit', '-m', 'native current branch fixture');
  const doctor = await doctorRepository(f.root);
  assert.equal(doctor.safe, true);
  assert.ok(doctor.checks.some(entry => entry.ok && (entry.detail as any)?.role === 'branch' && (entry.detail as any)?.index === 'principal'));
  assert.deepEqual(await fingerprint(privateIndex), before);
  f.git('switch', 'main');
  const externalExit = await doctorRepository(f.root);
  assert.equal(externalExit.safe, false);
  assert.ok(externalExit.checks.some(entry => !entry.ok && (entry.detail as any).code === 'EXTERNAL_HEAD'));
});

test('GL19: real Windows exclusive file lock aborts export with incomplete manifest and unchanged source', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t); await f.seedLegacy();
  const source = path.join(f.legacy, 'registry.json'), original = await fs.readFile(source);
  const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const locker = spawn(executable, ['-NoProfile', '-NonInteractive', '-Command', '$stream = [System.IO.File]::Open($env:GL_TEST_LOCK_SOURCE, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None); [Console]::WriteLine("locked"); [Console]::Out.Flush(); [Console]::ReadLine() | Out-Null; $stream.Dispose()'], { windowsHide: true, env: { ...process.env, GL_TEST_LOCK_SOURCE: source }, stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = new Promise<void>(resolve => locker.once('exit', () => resolve()));
  t.after(async () => { locker.stdin.end('\n'); await exited; });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { locker.kill(); reject(new Error('Own lock helper did not become ready.')); }, 10_000);
    locker.stdout.on('data', bytes => { if (String(bytes).includes('locked')) { clearTimeout(timer); resolve(); } });
    locker.once('error', error => { clearTimeout(timer); reject(error); });
    locker.once('exit', code => { clearTimeout(timer); reject(new Error('Own lock helper exited before readiness: ' + code)); });
  });
  const destination = path.join(f.parent, 'io-failed-export');
  await assert.rejects(() => exportRepositoryRecovery(f.root, destination));
  const manifest = JSON.parse(await fs.readFile(path.join(destination, 'recovery-export.json'), 'utf8'));
  assert.equal(manifest.complete, false);
  assert.ok(manifest.error);
  locker.stdin.end('\n'); await exited;
  assert.deepEqual(await fs.readFile(source), original);
});

test('GL25: native branch reservations must be disabled and fully released before migration', async t => {
  const f = await fixture(t); await f.seedLegacy();
  const stateFile = path.join(f.legacy, 'branch-protection', 'state.json');
  const entry = { id: randomUUID(), nonce: randomUUID(), name: 'protected', ref: 'refs/heads/layer/protected', state: 'reserved' };
  const state = { schema: 1, kind: 'git-layer-branch-protection', root: f.repo.root, gitDir: f.repo.gitDir, enabled: true, entries: [entry] };
  await atomicJSON(stateFile, state);
  const bytes = await fs.readFile(stateFile);
  await assert.rejects(() => migrateLayerLayout(f.root, { confirm: true }), { code: 'PROTECTION_MIGRATION_REQUIRED' });
  assert.deepEqual(await fs.readFile(stateFile), bytes);
  await atomicJSON(stateFile, { ...state, enabled: false });
  await assert.rejects(() => migrateLayerLayout(f.root, { confirm: true }), { code: 'PROTECTION_MIGRATION_REQUIRED' });
  await atomicJSON(stateFile, { ...state, enabled: false, entries: [] });
  await migrateLayerLayout(f.root, { confirm: true });
  assert.equal(await resolveLayerDirectory(f.repo.gitDir), f.current);
  assert.deepEqual(await fs.readFile(path.join(f.current, 'branch-protection', 'state.json')), await fs.readFile(stateFile));
});

test('GL19: semantic registry/workspace damage and missing retention checkpoint are unsafe without resetting any bytes', async t => {
  const f = await fixture(t), app = await GitLayers.init(f.root);
  await app.create('validation');
  const registryFile = path.join(f.current, 'registry.json'), workspaceFile = path.join(f.current, 'workspace.json');
  const registry = JSON.parse(await fs.readFile(registryFile, 'utf8')), workspace = JSON.parse(await fs.readFile(workspaceFile, 'utf8'));
  for (const field of ['indexBase', 'state']) {
    const damaged = structuredClone(registry); delete damaged.layers[0][field];
    await fs.writeFile(registryFile, JSON.stringify(damaged));
    const before = await fs.readFile(registryFile), diagnostic = await doctorRepository(f.root);
    assert.equal(diagnostic.safe, false);
    assert.ok(diagnostic.checks.some(entry => !entry.ok && entry.name.startsWith('Registry:') && (entry.detail as any).code === 'METADATA_INVALID'));
    assert.deepEqual(await fs.readFile(registryFile), before);
  }
  await atomicJSON(registryFile, registry);
  await atomicJSON(workspaceFile, { ...workspace, editing: { layer: 'validation', before: ['../escape'] } });
  const beforeWorkspace = await fs.readFile(workspaceFile), invalidWorkspace = await doctorRepository(f.root);
  assert.equal(invalidWorkspace.safe, false);
  assert.ok(invalidWorkspace.checks.some(entry => !entry.ok && entry.name.startsWith('Workspace:') && (entry.detail as any).code === 'METADATA_INVALID'));
  assert.deepEqual(await fs.readFile(workspaceFile), beforeWorkspace);
  await atomicJSON(workspaceFile, workspace);
  f.git('update-ref', '-d', 'refs/git-layers/state/' + registry.layers[0].id);
  assert.equal((await doctorRepository(f.root)).safe, false);
});

test('GL19: namespace export cannot bypass workspace or Git-directory ancestry', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t); await f.seedLegacy();
  const internal = path.join(f.root, 'unexpected-export');
  await assert.rejects(() => exportRepositoryRecovery(f.root, path.toNamespacedPath(internal)), { code: 'EXPORT_PATH' });
  await assert.rejects(() => fs.lstat(internal), { code: 'ENOENT' });
  // Refuse before any copy; exporting inside metadata could recursively copy
  // its own newly created output, so the no-destination assertion is essential.
  const internalGit = path.join(f.legacy, 'unexpected-export');
  await assert.rejects(() => exportRepositoryRecovery(f.root, path.toNamespacedPath(internalGit)), { code: 'EXPORT_PATH' });
  await assert.rejects(() => fs.lstat(internalGit), { code: 'ENOENT' });
});

test('GL19: doctor independently diagnoses missing protection holders after native Git returns to one worktree', async t => {
  const f = await fixture(t), app = await GitLayers.init(f.root);
  await app.create('protected-diagnostic');
  const { enableBranchProtection } = await import('../../src/core/branch-protection.js');
  const protection = await enableBranchProtection(f.root);
  assert.equal(protection.validWorktrees.length, 1);
  const state = path.join(f.current, 'branch-protection', 'state.json'), stateBytes = await fs.readFile(state);
  f.git('worktree', 'remove', '--force', protection.validWorktrees[0]);
  assert.equal(f.git('worktree', 'list', '--porcelain').split('\n').filter(line => line.startsWith('worktree ')).length, 1);
  const diagnostic = await doctorRepository(f.root);
  assert.equal(diagnostic.safe, false);
  assert.ok(diagnostic.checks.some(entry => !entry.ok && (entry.detail as any).code === 'PROTECTION_CONFLICT'));
  assert.deepEqual(await fs.readFile(state), stateBytes);
});

test('GL25: migration refuses semantically invalid registry before publishing a new layout', async t => {
  const f = await fixture(t); await f.seedLegacy();
  const app = await GitLayers.open(f.root); await app.create('migration-validation');
  const file = path.join(f.legacy, 'registry.json'), value = JSON.parse(await fs.readFile(file, 'utf8'));
  delete value.layers[0].indexBase;
  await fs.writeFile(file, JSON.stringify(value));
  const original = await fs.readFile(file), head = f.git('rev-parse', 'HEAD');
  await assert.rejects(() => migrateLayerLayout(f.root, { confirm: true }), { code: 'METADATA_INVALID' });
  assert.deepEqual(await fs.readFile(file), original);
  await assert.rejects(() => fs.lstat(f.current), { code: 'ENOENT' });
  assert.equal(f.git('rev-parse', 'HEAD'), head);
});
