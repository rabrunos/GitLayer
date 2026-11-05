import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GitLayers, LabError } from '../../src/core/index.js';
import { doctorRepository, exportRepositoryRecovery } from '../../src/core/rescue.js';
import { fingerprint, readJSON, sameFingerprint, Transaction } from '../../src/core/storage.js';
import { resolveGitExecutable } from '../../src/core/platform.js';
import { isolatedEnvironment } from '../../scripts/git-compat/lib.mjs';

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const project = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
// Compound fixtures use the suite's harness budget. This is not product latency.
const budget = { timeout: 900000 };
const within = (parent: string, child: string) => {
  const relative = path.relative(path.toNamespacedPath(path.resolve(parent)), path.toNamespacedPath(path.resolve(child)));
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
};

async function fixture(t: TestContext) {
  const temporary = await fs.realpath(os.tmpdir());
  assert(!within(project, temporary), 'Fixture parent must be external to the project.');
  const root = await fs.mkdtemp(path.join(temporary, 'gl-stage2-journal-fixture-'));
  const nonce = randomUUID(), marker = path.join(root, '.owned-fixture');
  await fs.writeFile(marker, nonce, { flag: 'wx' });
  const previous = { ...process.env }, preserve = previous.GL_STAGE2_PRESERVE_FIXTURES === '1';
  const events: unknown[] = []; let passed = false;
  const owned = async () => {
    const stat = await fs.lstat(root), mark = await fs.lstat(marker);
    assert(stat.isDirectory() && !stat.isSymbolicLink()); assert(mark.isFile() && !mark.isSymbolicLink());
    assert.equal(await fs.readFile(marker, 'utf8'), nonce);
    const canonical = await fs.realpath(root);
    assert(!within(project, canonical) && !within(canonical, project), 'Owned fixture must remain external to the project.');
    assert.equal(path.dirname(canonical).toLowerCase(), temporary.toLowerCase());
    assert(path.basename(canonical).startsWith('gl-stage2-journal-fixture-')); return canonical;
  };
  t.after(async () => {
    try {
      const canonical = await owned(), retain = preserve || !passed;
      const receipt = { schema: 1, test: t.name, root: canonical, parent: temporary, nonce, retained: retain, outcome: passed ? 'assertions-completed' : 'not-completed', policy: preserve ? 'final-campaign-retention' : !passed ? 'retain-on-failure' : 'owned-disposable-cleanup', events };
      if (retain) {
        await fs.writeFile(path.join(root, 'RETENTION-RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
        t.diagnostic(JSON.stringify({ kind: 'retained-performance-journal-fixture', ...receipt }));
      }
      if (previous.GL_STAGE2_RECOVERY_EVIDENCE) {
        await fs.mkdir(previous.GL_STAGE2_RECOVERY_EVIDENCE, { recursive: true });
        const name = t.name.replace(/[^A-Za-z0-9_-]/g, '_') + '-' + nonce + '.json';
        await fs.writeFile(path.join(previous.GL_STAGE2_RECOVERY_EVIDENCE, name), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
      }
      if (!retain) await fs.rm(canonical, { recursive: true, force: false });
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  });
  const executable = await resolveGitExecutable(), env = isolatedEnvironment(root, executable);
  if (preserve) env.GL_STAGE2_PRESERVE_FIXTURES = '1';
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(root, 'repository'); await fs.mkdir(repo);
  const git = (...argv: string[]) => execFileSync(executable, ['-C', repo, ...argv], { env, windowsHide: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  const write = (relative: string, bytes: string) => fs.writeFile(path.join(repo, relative), bytes);
  git('init', '-b', 'main'); git('config', '--local', 'core.autocrlf', 'false');
  await write('base.txt', 'base A\n'); git('add', '--', 'base.txt'); git('commit', '-m', 'journal fixture base');
  const app = await GitLayers.init(repo);
  await app.create('a'); await app.on('a');
  await write('a.txt', 'layer first A\n'); await write('b.txt', 'layer second A\n');
  await app.add('a', ['a.txt', 'b.txt']); await app.commit('a', 'journal fixture layer');
  // Independent traditional staging B and later disk C remain legitimate.
  await write('base.txt', 'base B staged\n'); git('add', '--', 'base.txt'); await write('base.txt', 'base C disk\n');
  const registry = await readJSON<any>(path.join(app.dir, 'registry.json'));
  const layer = registry.layers.find((entry: any) => entry.name === 'a'); assert(layer);
  const index = path.join(app.dir, 'indexes', layer.id + '.index');
  const layerGit = (...argv: string[]) => execFileSync(executable, ['-C', repo, ...argv], { env: { ...env, GIT_INDEX_FILE: index }, windowsHide: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  const native = async () => ({ head: git('rev-parse', 'HEAD'), branch: git('symbolic-ref', '--short', 'HEAD'), refs: git('for-each-ref', '--format=%(refname)%00%(objectname)'), main: git('ls-files', '--stage', '-z'), mainBytes: digest(await fs.readFile(app.repo.index)), layer: layerGit('ls-files', '--stage', '-z'), layerBytes: digest(await fs.readFile(index)) });
  const entries = async (folder: string): Promise<unknown[]> => {
    const result: unknown[] = [];
    for (const name of (await fs.readdir(folder)).sort()) {
      const file = path.join(folder, name), stat = await fs.lstat(file); assert(!stat.isSymbolicLink());
      if (stat.isDirectory()) result.push({ path: name, children: await entries(file) });
      else { assert(stat.isFile()); result.push({ path: name, bytes: stat.size, mode: stat.mode, sha256: digest(await fs.readFile(file)) }); }
    }
    return result;
  };
  const snapshot = async () => ({ native: await native(), files: await entries(repo) });
  const backups = async (directory: string) => {
    try { return await entries(path.join(directory, 'backups')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  };
  const assertBase = async () => { assert.equal(git('show', ':base.txt'), 'base B staged'); assert.equal(await fs.readFile(path.join(repo, 'base.txt'), 'utf8'), 'base C disk\n'); };
  const record = (label: string, value: unknown) => events.push({ label, value });
  record('fixture isolation and official Git observer', { nonce, executable, git: git('--version'), environmentKeys: Object.keys(env).sort() });
  return { root, repo, app, env, nonce, marker, owned, git, write, native, snapshot, backups, assertBase, record, success: () => { passed = true; } };
}

async function durablePair(journal: any, file: string) {
  const entry = journal.recovery.files.find((item: any) => item.path === file); assert(entry);
  const backup = journal.backups.find((item: any) => item.source === file && item.copy === entry.backup); assert(backup);
  assert(sameFingerprint(entry.before, backup.fingerprint));
  if (entry.backup) assert(sameFingerprint(await fingerprint(entry.backup), entry.before));
  return entry;
}
function ownTransaction(f: Awaited<ReturnType<typeof fixture>>, tx: Transaction, kind: string) {
  return path.dirname(tx.dir) === path.join(f.app.dir, 'transactions') && tx.data.kind === kind;
}
async function exportedBackup(f: Awaited<ReturnType<typeof fixture>>, directory: string, backup: string) {
  const exported = await exportRepositoryRecovery(f.repo, path.join(f.root, directory)); assert.equal(exported.complete, true);
  const manifest = await readJSON<any>(exported.manifest);
  const entry = manifest.entries.find((item: any) => item.source === backup); assert(entry && entry.type === 'file');
  assert.equal(entry.sha256, digest(await fs.readFile(backup)));
  assert.equal(digest(await fs.readFile(path.join(exported.destination, ...entry.path.split('/')))), entry.sha256);
  return { complete: exported.complete, backupSHA256: entry.sha256, files: exported.files };
}

test('GL19 journal coalescing owned process death after prepared backup and before backup-ready preserves source orphan evidence and coordinator lock', budget, async t => {
  const f = await fixture(t), native = await f.native();
  const source = path.join(f.repo, 'b.txt'), expected = await fingerprint(source);
  const coreURL = pathToFileURL(path.join(project, 'src/core/index.ts')).href;
  const storageURL = pathToFileURL(path.join(project, 'src/core/storage.ts')).href;
  const childSource = `
import assert from 'node:assert/strict'; import * as fs from 'node:fs/promises'; import path from 'node:path';
import { GitLayers } from ${JSON.stringify(coreURL)}; import { Transaction, readJSON, fingerprint, sameFingerprint } from ${JSON.stringify(storageURL)};
const root=process.env.GL_OWNED_ROOT, repo=process.env.GL_OWNED_REPO, nonce=process.env.GL_OWNED_NONCE, source=path.join(repo,'b.txt');
assert.equal(await fs.readFile(path.join(root,'.owned-fixture'),'utf8'),nonce); assert.equal(path.dirname(await fs.realpath(repo)),await fs.realpath(root));
const app=await GitLayers.open(repo), original=Transaction.prototype.prepareBackup; assert.equal(typeof original,'function');
Transaction.prototype.prepareBackup=async function(file,label){
 const entry=await original.call(this,file,label);
 if(path.resolve(file)===source&&this.data.kind==='deactivate'&&path.dirname(this.dir)===path.join(app.dir,'transactions')){
  const durable=await readJSON(path.join(this.dir,'journal.json'));
  assert(!durable.backups.some(item=>item.source===source)); assert(!durable.recovery.files.some(item=>item.path===source));
  const prior=durable.recovery.files.find(item=>item.path===path.join(repo,'a.txt')); assert(prior&&prior.before.exists&&prior.after?.exists===false);
  assert(entry.copy); assert(sameFingerprint(await fingerprint(source),entry.fingerprint)); assert(sameFingerprint(await fingerprint(entry.copy),entry.fingerprint));
  const receipt={schema:1,id:this.id,pid:process.pid,nonce,source,copy:entry.copy,fingerprint:entry.fingerprint,durableJournal:durable,barrier:'copy-file-and-directory-synced-before-backup-ready'};
  await fs.writeFile(path.join(root,'CHILD-BARRIER.json'),JSON.stringify(receipt,null,2)+'\\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({id:this.id,pid:process.pid,copy:entry.copy,nonce})+'\\n');
  await new Promise(()=>{setInterval(()=>{},1000);});
 }
 return entry;
}; await app.off('a'); throw Error('Required backup barrier was not reached');`;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', childSource], { cwd: project, env: { ...f.env, GL_OWNED_ROOT: f.root, GL_OWNED_REPO: f.repo, GL_OWNED_NONCE: f.nonce }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  let ended = false;
  t.after(async () => { if (!ended && child.exitCode === null && child.signalCode === null) { await f.owned(); child.kill(); await exited; } });
  const ready = await new Promise<{ id: string; pid: number; copy: string; nonce: string }>((resolve, reject) => {
    let stdout = '', stderr = '';
    const timer = setTimeout(() => reject(new Error('Own child barrier timeout: ' + stderr)), 120000);
    child.stderr.on('data', bytes => { stderr += String(bytes); if (stderr.length > 65536) reject(new Error('Own child stderr exceeded evidence budget')); });
    child.stdout.on('data', bytes => {
      stdout += String(bytes); if (stdout.length > 65536) reject(new Error('Own child stdout exceeded evidence budget'));
      if (stdout.includes('\n')) { clearTimeout(timer); try { resolve(JSON.parse(stdout.split('\n')[0]!)); } catch (error) { reject(error); } }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Own child exited before barrier: ' + stderr)); });
  });
  assert.equal(ready.pid, child.pid); assert.equal(ready.nonce, f.nonce);
  const txDirectory = path.join(f.app.dir, 'transactions', ready.id);
  assert.equal(path.dirname(ready.copy), path.join(txDirectory, 'backups'));
  const ownerFile = path.join(f.app.dir, 'locks/coordinator/owner.json'), owner = await fs.readFile(ownerFile);
  assert.equal(JSON.parse(owner.toString()).pid, child.pid);
  assert(sameFingerprint(await fingerprint(ready.copy), expected)); assert(sameFingerprint(await fingerprint(source), expected));
  assert.equal((await fingerprint(path.join(f.repo, 'a.txt'))).exists, false);
  assert.deepEqual(await f.native(), native); await f.assertBase(); const barrier = await f.snapshot();
  assert(child.kill()); const termination = await exited; ended = true;
  const journal = await readJSON<any>(path.join(txDirectory, 'journal.json'));
  assert(!journal.backups.some((entry: any) => entry.source === source)); assert(!journal.recovery.files.some((entry: any) => entry.path === source));
  const reopened = await GitLayers.open(f.repo); await assert.rejects(reopened.recover(), { code: 'LOCKED' });
  assert.deepEqual(await f.snapshot(), barrier); assertBytesEqual(await fs.readFile(ownerFile), owner, 'performance-journal-recovery.test.ts byte preservation');
  const doctor = await doctorRepository(f.repo); assert.equal(doctor.safe, false);
  assert(doctor.checks.some(check => !check.ok && (check.detail as any).code === 'LOCKED'));
  const exported = await exportedBackup(f, 'orphan-process-export', ready.copy); assert.deepEqual(await f.snapshot(), barrier);
  f.record('owned abrupt process termination before plan publication', { id: ready.id, nonce: ready.nonce, termination, source: expected, copy: ready.copy, orphanAuthorized: false, lockPreserved: true, automaticRecoveryCompleted: false, powerLoss: false, exported });
  f.success();
});

test('GL19 journal coalescing unavailable backup-ready and failure journal leave target unchanged and recover earlier removals once', budget, async t => {
  const f = await fixture(t), native = await f.native(), source = path.join(f.repo, 'b.txt'), expected = await fingerprint(source);
  const record = Transaction.prototype.record, fail = Transaction.prototype.fail;
  let selected = '', orphan = '', fired = false, failFired = false;
  Transaction.prototype.record = async function (step, details) {
    if (!fired && ownTransaction(f, this, 'deactivate') && step === 'backup-ready' && (details as any)?.path === source) {
      fired = true; selected = this.id; orphan = this.data.backups.find((entry: any) => entry.source === source)?.copy; assert(orphan);
      assert(sameFingerprint(await fingerprint(source), expected)); assert(sameFingerprint(await fingerprint(orphan), expected));
      const durable = await readJSON<any>(path.join(this.dir, 'journal.json'));
      assert(!durable.recovery.files.some((entry: any) => entry.path === source)); assert(!durable.backups.some((entry: any) => entry.source === source));
      assert.equal((await fingerprint(path.join(f.repo, 'a.txt'))).exists, false);
      throw new LabError('INJECTED_FAILURE', 'Fixture-only unavailable backup-ready publication before target mutation.');
    }
    return record.call(this, step, details);
  };
  Transaction.prototype.fail = async function (error) {
    if (this.id === selected) { failFired = true; throw Object.assign(new Error('Fixture-only unavailable failure journal'), { code: 'EIO' }); }
    return fail.call(this, error);
  };
  try { await assert.rejects(f.app.off('a'), { code: 'EIO' }); }
  finally { Transaction.prototype.record = record; Transaction.prototype.fail = fail; }
  assert(fired && failFired && orphan); assert.deepEqual(await f.native(), native); await f.assertBase();
  assert(sameFingerprint(await fingerprint(source), expected)); assert(sameFingerprint(await fingerprint(orphan), expected));
  const journalFile = path.join(f.app.dir, 'transactions', selected, 'journal.json'), journal = await readJSON<any>(journalFile);
  assert.equal(journal.state, 'pending'); assert(!journal.recovery.files.some((entry: any) => entry.path === source));
  const allBackups = await f.backups(path.dirname(journalFile)), reopened = await GitLayers.open(f.repo);
  assert.deepEqual((await reopened.recover()).recovered, [selected]);
  assert.equal(await fs.readFile(path.join(f.repo, 'a.txt'), 'utf8'), 'layer first A\n'); assert(sameFingerprint(await fingerprint(source), expected));
  assert.deepEqual(await f.native(), native); await f.assertBase(); assert.deepEqual(await f.backups(path.dirname(journalFile)), allBackups);
  assert.equal((await readJSON<any>(journalFile)).state, 'completed');
  const recovered = await f.snapshot(); assert.deepEqual((await reopened.recover()).recovered, []); assert.deepEqual(await f.snapshot(), recovered);
  const exported = await exportedBackup(f, 'failed-ready-export', orphan); assert.deepEqual(await f.snapshot(), recovered);
  f.record('synthetic unavailable ready and fail records', { selected, actualHostIoFailure: false, originalSourceUnchanged: true, earlierRemovalRecoveredOnce: true, orphanAuthorized: false, exported }); f.success();
});

test('GL19 journal coalescing durable backup-ready before removal recovers present target and prior removals once', budget, async t => {
  const f = await fixture(t), native = await f.native(), source = path.join(f.repo, 'b.txt'), expected = await fingerprint(source);
  const original = Transaction.prototype.record; let selected = '', fired = false;
  Transaction.prototype.record = async function (step, details) {
    await original.call(this, step, details);
    if (!fired && ownTransaction(f, this, 'deactivate') && step === 'backup-ready' && (details as any)?.path === source) {
      fired = true; selected = this.id;
      const durable = await readJSON<any>(path.join(this.dir, 'journal.json')); await durablePair(durable, source);
      assert.equal(durable.steps.at(-1).step, 'backup-ready'); assert.equal((await fingerprint(path.join(f.repo, 'a.txt'))).exists, false);
      assert(sameFingerprint(await fingerprint(source), expected));
      throw new LabError('INJECTED_FAILURE', 'Fixture-only interruption after complete durable backup-ready and before unlink.');
    }
  };
  try { await assert.rejects(f.app.off('a'), { code: 'INJECTED_FAILURE' }); }
  finally { Transaction.prototype.record = original; }
  assert(fired); const directory = path.join(f.app.dir, 'transactions', selected), journalFile = path.join(directory, 'journal.json');
  const journal = await readJSON<any>(journalFile); assert.equal(journal.state, 'recovery-required'); const current = await durablePair(journal, source); assert.equal(current.after, undefined);
  assert(sameFingerprint(await fingerprint(source), expected)); const backups = await f.backups(directory);
  const reopened = await GitLayers.open(f.repo); assert.deepEqual((await reopened.recover()).recovered, [selected]);
  assert.equal(await fs.readFile(path.join(f.repo, 'a.txt'), 'utf8'), 'layer first A\n'); assert(sameFingerprint(await fingerprint(source), expected));
  assert.deepEqual(await f.native(), native); await f.assertBase(); assert.deepEqual(await f.backups(directory), backups);
  const recovered = await f.snapshot(); assert.deepEqual((await reopened.recover()).recovered, []); assert.deepEqual(await f.snapshot(), recovered);
  f.record('durable paired record interruption before physical deletion', { selected, beforePresent: true, currentTargetUnchanged: true, earlierRemovalRecoveredOnce: true, backupsRetained: true }); f.success();
});

test('GL19 journal coalescing durable backup-ready before first materialization still refuses V05 and preserves every byte', budget, async t => {
  const f = await fixture(t); await f.app.off('a'); const native = await f.native(), source = path.join(f.repo, 'a.txt');
  assert.equal((await fingerprint(source)).exists, false);
  const original = Transaction.prototype.record; let selected = '', fired = false;
  Transaction.prototype.record = async function (step, details) {
    await original.call(this, step, details);
    if (!fired && ownTransaction(f, this, 'activate') && step === 'backup-ready' && (details as any)?.path === source) {
      fired = true; selected = this.id; const durable = await readJSON<any>(path.join(this.dir, 'journal.json'));
      const entry = await durablePair(durable, source); assert.equal(entry.before.exists, false); assert.equal(entry.backup, null); assert.equal(entry.after, undefined);
      assert.equal((await fingerprint(source)).exists, false);
      throw new LabError('INJECTED_FAILURE', 'Fixture-only interruption after absent backup-ready, before first materialization.');
    }
  };
  try { await assert.rejects(f.app.on('a'), { code: 'INJECTED_FAILURE' }); }
  finally { Transaction.prototype.record = original; }
  assert(fired); assert.deepEqual(await f.native(), native); await f.assertBase();
  const directory = path.join(f.app.dir, 'transactions', selected), journalFile = path.join(directory, 'journal.json');
  const journal = await readJSON<any>(journalFile); assert.equal(journal.state, 'recovery-required'); await durablePair(journal, source);
  const stopped = await f.snapshot(), reopened = await GitLayers.open(f.repo);
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(reopened.recover(), (error: unknown) => { assert(error instanceof LabError); assert.equal(error.code, 'RECOVERY_CONFLICT'); assert.equal((error.details as any).reason, 'workspace-materialization-disappeared'); return true; });
    assert.deepEqual(await f.snapshot(), stopped); assert.equal((await readJSON<any>(journalFile)).state, 'recovery-required');
  }
  const doctor = await doctorRepository(f.repo), plan = doctor.checks.find(check => check.name === 'Plano de recupera\u00e7\u00e3o: ' + selected);
  assert.equal(doctor.safe, false); assert(plan && !plan.ok); assert.equal((plan.detail as any).details.reason, 'workspace-materialization-disappeared');
  const exported = await exportRepositoryRecovery(f.repo, path.join(f.root, 'v05-ready-export')); assert.equal(exported.complete, true); assert.deepEqual(await f.snapshot(), stopped);
  f.record('V05 conservative refusal before any materialization is preserved', { selected, beforePresent: false, afterRecorded: false, physicalTargetAbsent: true, recoverAttempts: 2, automaticRecoveryCompleted: false, realProcessTermination: false, exported: exported.complete }); f.success();
});

test('GL19 journal coalescing equivalent path spellings share canonical BEFORE and AFTER and recover once', budget, async t => {
  const f = await fixture(t), native = await f.native(), source = path.join(f.repo, 'b.txt');
  const alternate = process.platform === 'win32' ? source.replaceAll('\\', '/') : f.repo + '/./b.txt';
  assert.notEqual(alternate, source); assert.equal(path.resolve(alternate), source);
  const before = await fingerprint(source), internal = f.app as any; let selected = '', ready: any;
  await assert.rejects(internal.mutate('journal-normalized-fixture', async () => {
    await internal.track(alternate); await internal.track(source);
    selected = internal.tx.id;
    const prepared = await readJSON<any>(path.join(internal.tx.dir, 'journal.json'));
    assert.equal(prepared.recovery.files.filter((entry: any) => entry.path === source).length, 1);
    assert.equal(prepared.recovery.files.length, 1); assert.equal(prepared.backups.length, 1);
    assert.equal(prepared.backups[0].source, source); assert.equal(prepared.steps.filter((step: any) => step.step === 'backup-ready').length, 1);
    await durablePair(prepared, source);
    await fs.writeFile(source, 'fixture-only changed physical bytes after canonical BEFORE\n');
    await internal.after(alternate);
    ready = await readJSON<any>(path.join(internal.tx.dir, 'journal.json'));
    assert.equal(ready.recovery.files.length, 1); assert.equal(ready.recovery.files[0].path, source);
    assert(sameFingerprint(ready.recovery.files[0].before, before)); assert(sameFingerprint(ready.recovery.files[0].after, await fingerprint(source)));
    assert.equal(ready.steps.at(-1).step, 'write-completed'); assert.equal(ready.steps.at(-1).details.path, source);
    throw new LabError('INJECTED_FAILURE', 'Fixture-only interruption with canonical BEFORE/AFTER after equivalent spellings.');
  }, true, { reconcile: false }), { code: 'INJECTED_FAILURE' });
  assert(selected && ready); const directory = path.join(f.app.dir, 'transactions', selected), backups = await f.backups(directory);
  assert.deepEqual(await f.native(), native); await f.assertBase();
  const reopened = await GitLayers.open(f.repo); assert.deepEqual((await reopened.recover()).recovered, [selected]);
  assert(sameFingerprint(await fingerprint(source), before)); assert.deepEqual(await f.native(), native); await f.assertBase();
  assert.deepEqual(await f.backups(directory), backups);
  const recovered = await f.snapshot(); assert.deepEqual((await reopened.recover()).recovered, []); assert.deepEqual(await f.snapshot(), recovered);
  f.record('equivalent path spellings retain one canonical recovery authority', { selected, alternate, canonical: source, backupReadyRecords: 1, sourceRestored: true, automaticAssignmentChanged: false }); f.success();
});
