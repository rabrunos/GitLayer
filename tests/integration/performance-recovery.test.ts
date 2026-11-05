import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import test, { type TestContext } from 'node:test';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GitLayers } from '../../src/core/index.js';
import { LabError } from '../../src/core/errors.js';
import { doctorRepository, exportRepositoryRecovery } from '../../src/core/rescue.js';
import { atomicJSON, fingerprint, readJSON, Transaction } from '../../src/core/storage.js';
import { resolveGitExecutable } from '../../src/core/platform.js';
import { execute, isolatedEnvironment } from '../../scripts/git-compat/lib.mjs';

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const project = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

async function fixture(t: TestContext) {
  const temporary = await fs.realpath(os.tmpdir()), parent = await fs.mkdtemp(path.join(temporary, 'gl-stage2-recovery-fixture-'));
  const nonce = randomUUID(), marker = path.join(parent, '.owned-fixture');
  await fs.writeFile(marker, nonce, { flag: 'wx' });
  const previous = { ...process.env }, preserve = previous.GL_STAGE2_PRESERVE_FIXTURES === '1', events: unknown[] = [];
  let receiptExecutable: string | null = null, receiptGit: ((...args: string[]) => string) | undefined;
  const validateOwned = async () => {
    const stat = await fs.lstat(parent), markerStat = await fs.lstat(marker);
    assert(stat.isDirectory() && !stat.isSymbolicLink()); assert(markerStat.isFile() && !markerStat.isSymbolicLink());
    assert.equal(await fs.readFile(marker, 'utf8'), nonce);
    const canonical = await fs.realpath(parent);
    assert.equal(path.dirname(canonical).toLowerCase(), temporary.toLowerCase()); assert(path.basename(canonical).startsWith('gl-stage2-recovery-fixture-'));
    return canonical;
  };
  // Register before repository/Core setup: a setup failure must still retain
  // the owned fixture and emit its locator during the final campaign.
  t.after(async () => {
    try {
      const canonical = await validateOwned();
      const retained = { schema: 1, test: t.name, root: canonical, nonce, parent: temporary, retained: preserve, policy: preserve ? 'GL_STAGE2_PRESERVE_FIXTURES=1; retain regardless of test outcome' : 'Default disposable-fixture cleanup after ownership validation' };
      if (preserve) {
        t.diagnostic(JSON.stringify({ kind: 'retained-performance-fixture', ...retained }));
        await fs.writeFile(path.join(parent, 'RETENTION-RECEIPT.json'), JSON.stringify(retained, null, 2) + '\n', { flag: 'wx' });
      }
      const out = previous.GL_STAGE2_RECOVERY_EVIDENCE;
      if (out) {
        await fs.mkdir(out, { recursive: true });
        await fs.writeFile(path.join(out, t.name.replace(/[^A-Za-z0-9_-]/g, '_') + '.json'), JSON.stringify({ test: t.name, executable: receiptExecutable, git: receiptGit?.('--version') ?? null, platform: process.platform, fixture: retained, events }, null, 2) + '\n');
      }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
      if (!preserve) await fs.rm(await validateOwned(), { recursive: true, force: false });
    }
  });
  const repo = path.join(parent, 'repository'), home = path.join(parent, 'home');
  await fs.mkdir(repo); await fs.mkdir(home);
  const executable = await resolveGitExecutable(), env = isolatedEnvironment(parent, executable); receiptExecutable = executable;
  if (previous.GL_STAGE2_RECOVERY_EVIDENCE) env.GL_STAGE2_RECOVERY_EVIDENCE = previous.GL_STAGE2_RECOVERY_EVIDENCE;
  if (preserve) env.GL_STAGE2_PRESERVE_FIXTURES = '1';
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const git = (...args: string[]) => execFileSync(executable, ['-C', repo, ...args], { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  receiptGit = git;
  const write = (relative: string, bytes: string) => fs.writeFile(path.join(repo, relative), bytes);
  git('init', '-b', 'main'); git('config', '--local', 'user.name', 'Recovery Fixture'); git('config', '--local', 'user.email', 'fixture@example.invalid'); git('config', '--local', 'core.autocrlf', 'false'); git('config', '--local', 'commit.gpgsign', 'false'); git('config', '--local', 'core.hooksPath', '/dev/null'); git('config', '--local', 'credential.helper', '');
  await write('base.txt', 'base A\n'); git('add', '--', 'base.txt'); git('commit', '-m', 'fixture base');
  const app = await GitLayers.init(repo);
  const files = async (folder: string): Promise<unknown[]> => {
    const result: unknown[] = [];
    for (const entry of (await fs.readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(folder, entry.name), stat = await fs.lstat(full);
      if (stat.isDirectory() && !stat.isSymbolicLink()) result.push({ name: entry.name, children: await files(full) });
      else { assert(stat.isFile() && !stat.isSymbolicLink()); result.push({ name: entry.name, sha256: digest(await fs.readFile(full)), bytes: stat.size, mode: stat.mode }); }
    }
    return result;
  };
  const snapshot = async () => ({ head: git('rev-parse', 'HEAD'), branch: git('symbolic-ref', '--short', 'HEAD'), refs: git('for-each-ref', '--format=%(refname)%00%(objectname)'), index: git('ls-files', '--stage', '-z'), files: await files(repo) });
  const record = (label: string, data: unknown) => events.push({ label, data });
  const plan = async (source = path.join(repo, 'base.txt')) => {
    const tx = await Transaction.begin(app.dir, 'recovery-diagnostic-fixture', {}), before = await fingerprint(source), backup = await tx.backup(source, 'before');
    tx.data.recovery = { beforeRegistry: await readJSON(path.join(app.dir, 'registry.json')), beforeWorkspace: await readJSON(path.join(app.dir, 'workspace.json')), files: [{ path: source, before, backup }] };
    await tx.record('prepared'); return tx;
  };
  const seed = async (name: string) => { await app.create(name); await app.on(name); await write(name + '.txt', name + ' A\n'); await app.add(name, [name + '.txt']); await app.commit(name, 'fixture ' + name); };
  return { parent, repo, app, env, git, executable, write, snapshot, record, plan, seed };
}

function planCheck(report: Awaited<ReturnType<typeof doctorRepository>>, id: string) {
  const entry = report.checks.find(check => check.name === 'Plano de recuperação: ' + id); assert(entry); return entry as { name: string; ok: boolean; detail: any };
}

test('GL19 doctor diagnoses each pending plan with invalid registry and preserves independent export', async t => {
  const f = await fixture(t), tx = await f.plan();
  await fs.writeFile(path.join(f.app.dir, 'registry.json'), '{invalid registry');
  const before = await f.snapshot();
  for (let attempt = 0; attempt < 2; attempt++) {
    const report = await doctorRepository(f.repo), checked = planCheck(report, tx.id);
    assert.equal(report.safe, false); assert.equal(checked.ok, true); assert.equal(checked.detail.planValid, true); assert.equal(checked.detail.recoveryAttempted, false);
    assert(report.checks.some(check => check.name.startsWith('Registry: ') && !check.ok));
    assert.deepEqual(await f.snapshot(), before); f.record('read-only plan diagnosis ' + attempt, checked);
  }
  const exported = await exportRepositoryRecovery(f.repo, path.join(f.parent, 'independent-export'));
  assert.equal(exported.complete, true); assert.deepEqual(await f.snapshot(), before); f.record('independent export with invalid registry', exported);
});

for (const damage of ['changed', 'missing'] as const) test('GL19 doctor identifies ' + damage + ' backup without restoring bytes', async t => {
  const f = await fixture(t), tx = await f.plan(), backup = tx.data.recovery.files[0].backup;
  if (damage === 'changed') await fs.writeFile(backup, 'tampered backup\n'); else await fs.unlink(backup);
  const before = await f.snapshot(), report = await doctorRepository(f.repo), checked = planCheck(report, tx.id);
  assert.equal(checked.ok, false); assert.equal(checked.detail.code, 'RECOVERY_CONFLICT'); assert.equal(checked.detail.details.backup, backup);
  assert.deepEqual(await f.snapshot(), before); assert.equal((await readJSON<any>(path.join(tx.dir, 'journal.json'))).state, 'pending'); f.record('backup refusal', checked);
});

test('GL19 doctor exposes V05 with and without recorded publication and keeps every journal', async t => {
  const f = await fixture(t);
  for (const afterRecorded of [false, true]) {
    const tx = await f.plan(path.join(f.repo, 'absent-' + afterRecorded + '.txt'));
    if (afterRecorded) { tx.data.recovery.files[0].after = { exists: true, hash: 'a'.repeat(64), mode: 0o666 }; await tx.record('controlled-after-image'); }
    const before = await f.snapshot();
    for (let attempt = 0; attempt < 2; attempt++) {
      const report = await doctorRepository(f.repo), checked = planCheck(report, tx.id);
      assert.equal(checked.ok, false); assert.equal(checked.detail.code, 'RECOVERY_CONFLICT'); assert.equal(checked.detail.details.reason, 'workspace-materialization-disappeared');
      assert.equal(checked.detail.details.paths[0].afterRecorded, afterRecorded); assert.deepEqual(await f.snapshot(), before); f.record('V05 preserved', checked);
    }
  }
});

test('GL19 malformed journal does not hide an independently valid pending plan', async t => {
  const f = await fixture(t), valid = await f.plan(), invalid = await f.plan();
  await fs.writeFile(path.join(invalid.dir, 'journal.json'), '{invalid journal');
  const before = await f.snapshot(), report = await doctorRepository(f.repo);
  assert.equal(report.safe, false); assert.equal(planCheck(report, valid.id).ok, true);
  assert(report.checks.some(check => check.name === 'Journal: ' + path.join(invalid.dir, 'journal.json').replace(/[\\/]journal\.json$/, '') && !check.ok && (check.detail as any).code === 'METADATA_INVALID'));
  assert(report.transactions.some((entry: any) => entry.id === valid.id)); assert.deepEqual(await f.snapshot(), before); f.record('malformed and valid independent diagnoses', report.checks.filter(check => check.name.startsWith('Journal') || check.name.startsWith('Plano')));
});

test('GL19 doctor identifies later bytes without masking another valid pending plan', async t => {
  const f = await fixture(t); await f.write('stable.txt', 'stable before bytes\n');
  const valid = await f.plan(path.join(f.repo, 'stable.txt')), changed = await f.plan();
  await f.write('base.txt', 'external edit after interruption\n'); const before = await f.snapshot();
  for (let attempt = 0; attempt < 2; attempt++) {
    const report = await doctorRepository(f.repo), checked = planCheck(report, changed.id);
    assert.equal(checked.ok, false); assert.equal(checked.detail.code, 'RECOVERY_CONFLICT'); assert.equal(checked.detail.details.reason, 'workspace-changed-after-transaction'); assert.equal(checked.detail.details.path, path.join(f.repo, 'base.txt'));
    assert.equal(planCheck(report, valid.id).ok, true); assert.deepEqual(await f.snapshot(), before); f.record('later edit diagnosis ' + attempt, checked);
  }
});

// This is the harness budget for a compound Git/recovery fixture on a variable
// host, aligned with the full suite. It is not measured product latency or an SLO.
test('GL19 interruption after durable commit preparation and before ref publication recovers old ref with staged B and disk C', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a');
  await f.write('a.txt', 'a B staged before ref publication\n'); await f.app.add('a', ['a.txt']); await f.write('a.txt', 'a C disk after staging\n');
  await f.write('base.txt', 'base B staged independently\n'); await f.app.baseStage(['base.txt']); await f.write('base.txt', 'base C disk independently\n');
  const registry = await readJSON<any>(path.join(f.app.dir, 'registry.json'));
  const layer = registry.layers.find((entry: any) => entry.name === 'a'), index = path.join(f.app.dir, 'indexes', layer.id + '.index');
  const indexed = (...args: string[]) => execFileSync(f.executable, ['-C', f.repo, ...args], { env: { ...f.env, GIT_INDEX_FILE: index }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  const before = { head: f.git('rev-parse', 'HEAD'), branchRefs: f.git('for-each-ref', '--format=%(refname)%00%(objectname)', 'refs/heads/'), layerRef: f.git('rev-parse', 'layer/a'), commits: f.git('rev-list', '--count', 'layer/a'), layerIndex: indexed('ls-files', '--stage', '-z'), mainIndex: f.git('ls-files', '--stage', '-z'), mainBytes: await fs.readFile(path.join(f.repo, '.git', 'index')) };
  const internal = f.app as any, original = internal.editingCandidates;
  let interrupted = false, prepared: any;
  internal.editingCandidates = async function (...args: any[]) {
    const tx = this.tx, commit = tx?.data?.recovery?.commit;
    if (!interrupted && tx?.data.kind === 'commit-layer' && commit?.layerId === layer.id) {
      const durable = await readJSON<any>(path.join(tx.dir, 'journal.json'));
      assert.deepEqual(durable.recovery.commit, commit); assert.equal(durable.steps.at(-1).step, 'commit-prepared'); assert.equal(durable.steps.at(-1).details.oid, commit.new);
      assert.equal(durable.state, 'pending'); assert.equal(commit.old, before.layerRef); assert.notEqual(commit.new, commit.old);
      assert.equal(f.git('rev-parse', commit.ref), before.layerRef); assert.equal(f.git('cat-file', '-t', commit.new), 'commit'); assert.equal(f.git('show', commit.new + ':a.txt'), 'a B staged before ref publication');
      interrupted = true; prepared = { id: tx.id, commit: structuredClone(commit), durableStep: durable.steps.at(-1) };
      throw new LabError('INJECTED_FAILURE', 'Fixture-only interruption after durable commit-prepared and before update-ref.');
    }
    return original.apply(this, args);
  };
  try { await assert.rejects(f.app.commit('a', 'deliberate prepared commit before ref publication'), { code: 'INJECTED_FAILURE' }); }
  finally { internal.editingCandidates = original; }
  assert(interrupted && prepared, 'The instance-only barrier must observe a durable prepared commit before ref publication.');
  const journal = await readJSON<any>(path.join(f.app.dir, 'transactions', prepared.id, 'journal.json'));
  assert.equal(journal.state, 'recovery-required'); assert.equal(journal.error.code, 'INJECTED_FAILURE'); assert.deepEqual(journal.recovery.commit, prepared.commit);
  const assertPreserved = async () => {
    assert.equal(f.git('rev-parse', 'HEAD'), before.head); assert.equal(f.git('for-each-ref', '--format=%(refname)%00%(objectname)', 'refs/heads/'), before.branchRefs);
    assert.equal(f.git('rev-parse', 'layer/a'), before.layerRef); assert.equal(f.git('rev-list', '--count', 'layer/a'), before.commits);
    assert.equal(indexed('ls-files', '--stage', '-z'), before.layerIndex); assert.equal(indexed('show', ':a.txt'), 'a B staged before ref publication'); assert.equal(f.git('ls-files', '--stage', '-z'), before.mainIndex); assertBytesEqual(await fs.readFile(path.join(f.repo, '.git', 'index')), before.mainBytes, 'performance-recovery.test.ts byte preservation');
    assert.equal(await fs.readFile(path.join(f.repo, 'a.txt'), 'utf8'), 'a C disk after staging\n'); assert.equal(await fs.readFile(path.join(f.repo, 'base.txt'), 'utf8'), 'base C disk independently\n');
  };
  await assertPreserved(); const reopened = await GitLayers.open(f.repo);
  assert.deepEqual((await reopened.recover()).recovered, [prepared.id]); await assertPreserved();
  const recovered = await f.snapshot(); assert.deepEqual((await reopened.recover()).recovered, []); assert.deepEqual(await f.snapshot(), recovered); await assertPreserved();
  assert.equal((await readJSON<any>(path.join(f.app.dir, 'transactions', prepared.id, 'journal.json'))).state, 'completed');
  assert.equal(f.git('cat-file', '-t', prepared.commit.new), 'commit'); assert.equal(f.git('show', prepared.commit.new + ':a.txt'), 'a B staged before ref publication');
  f.record('deterministic interruption before ref publication preserves old branch and independent B-C states', { ...prepared, refBefore: before.layerRef, refAfter: f.git('rev-parse', 'layer/a'), commitsBefore: before.commits, commitsAfter: f.git('rev-list', '--count', 'layer/a'), realProcessTermination: false, actualHostIoFailure: false });
});

// 600 seconds cover setup plus all four sequential synthetic fault subtests
// together, not 600 seconds per fault. A timeout remains a failed execution.
test('GL19 synthetic I/O fault codes after durable commit publication recover once with B staged and C on disk', { timeout: 600000 }, async t => {
  const f = await fixture(t); await f.seed('a'); await f.seed('b');
  await f.write('b.txt', 'b B staged\n'); await f.app.add('b', ['b.txt']); await f.write('b.txt', 'b C disk\n');
  await f.write('base.txt', 'base B staged\n'); await f.app.baseStage(['base.txt']); await f.write('base.txt', 'base C disk\n');
  const registry = await readJSON<any>(path.join(f.app.dir, 'registry.json')), bIndex = path.join(f.app.dir, 'indexes', registry.layers.find((layer: any) => layer.name === 'b').id + '.index');
  const retainedIndex = await fs.readFile(bIndex), nativeIndex = f.git('ls-files', '--stage', '-z'), head = f.git('rev-parse', 'HEAD');
  for (const code of ['EIO', 'EPERM', 'EACCES', 'ENOSPC']) {
    await t.test(code, async () => {
      await f.write('a.txt', 'a B ' + code + '\n'); await f.app.add('a', ['a.txt']); await f.write('a.txt', 'a C ' + code + '\n');
      const old = f.git('rev-parse', 'layer/a'), count = Number(f.git('rev-list', '--count', 'layer/a')), original = Transaction.prototype.record;
      let fired = false, selected = '';
      Transaction.prototype.record = async function (step, details) {
        await original.call(this, step, details);
        if (!fired && this.dir.startsWith(f.app.dir + path.sep) && this.data.kind === 'commit-layer' && step === 'commit-ref-updated') {
          fired = true; selected = this.id; throw Object.assign(new Error('Synthetic fixture-only ' + code + ' after durable journal/ref; no host failure'), { code });
        }
      };
      try { await assert.rejects(f.app.commit('a', 'synthetic ' + code), { code }); } finally { Transaction.prototype.record = original; }
      assert(fired); const advanced = f.git('rev-parse', 'layer/a'); assert.notEqual(advanced, old); assert.equal(f.git('show', 'layer/a:a.txt'), 'a B ' + code);
      const reopened = await GitLayers.open(f.repo); assert.deepEqual((await reopened.recover()).recovered, [selected]);
      const recovered = await f.snapshot(); assert.deepEqual((await reopened.recover()).recovered, []); assert.deepEqual(await f.snapshot(), recovered);
      assert.equal(Number(f.git('rev-list', '--count', 'layer/a')), count + 1); assert.equal(f.git('rev-parse', 'layer/a'), advanced); assert.equal(f.git('rev-parse', 'HEAD'), head); assert.equal(f.git('ls-files', '--stage', '-z'), nativeIndex);
      assertBytesEqual(await fs.readFile(bIndex), retainedIndex, 'performance-recovery.test.ts byte preservation'); assert.equal(await fs.readFile(path.join(f.repo, 'a.txt'), 'utf8'), 'a C ' + code + '\n'); assert.equal(await fs.readFile(path.join(f.repo, 'b.txt'), 'utf8'), 'b C disk\n'); assert.equal(await fs.readFile(path.join(f.repo, 'base.txt'), 'utf8'), 'base C disk\n');
      f.record('synthetic code with deterministic forward recovery', { code, actualHostIoFailure: false, ref: advanced, journal: selected, countBefore: count, countAfter: count + 1 });
    });
  }
});

// Each fault is injected in the real FileHandle.writeFile path of one owned
// child only. These are simulated syscall errors after a real prefix write;
// they are neither actual host EIO/ENOSPC nor process death or power loss.
test('GL19 simulated write-path failures preserve the original backup and journal before an independent retry', { timeout: 900000 }, async t => {
  const f = await fixture(t), nonce = await fs.readFile(path.join(f.parent, '.owned-fixture'), 'utf8');
  const source = path.join(f.repo, 'write-fault.bin');
  await fs.writeFile(source, Buffer.alloc(2 * 1024 * 1024 + 23, 0x6d), { flag: 'wx' });
  const before = { head: f.git('rev-parse', 'HEAD'), refs: f.git('for-each-ref'), index: await fs.readFile(path.join(f.repo, '.git', 'index')), registry: await fs.readFile(path.join(f.app.dir, 'registry.json')), workspace: await fs.readFile(path.join(f.app.dir, 'workspace.json')), source: await fingerprint(source) };
  const childSource = `
    import assert from 'node:assert/strict';
    import * as fs from 'node:fs/promises';
    import path from 'node:path';
    import { createHash } from 'node:crypto';
    import { Transaction, fingerprint, readJSON } from ${JSON.stringify(pathToFileURL(path.join(project, 'src/core/storage.ts')).href)};
    import { assertBytesEqual } from ${JSON.stringify(pathToFileURL(path.join(project, 'tests/helpers/assert-bytes.ts')).href)};
    import { doctorRepository, exportRepositoryRecovery } from ${JSON.stringify(pathToFileURL(path.join(project, 'src/core/rescue.ts')).href)};
    const { GL_WRITE_FAULT_PARENT: root, GL_WRITE_FAULT_NONCE: nonce, GL_WRITE_FAULT_CODE: code, GL_WRITE_FAULT_DIRECTORY: directory, GL_WRITE_FAULT_SOURCE: source } = process.env;
    assert(['EIO','EPERM','EACCES','ENOSPC'].includes(code));
    const inside = target => { const rel = path.relative(root, target); return rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
    const owned = async () => { assert.equal(await fs.realpath(root), root); assert.equal(await fs.readFile(path.join(root, '.owned-fixture'), 'utf8'), nonce); assert(inside(directory) && inside(source)); };
    await owned();
    const original = await fingerprint(source), sourceBytes = await fs.readFile(source);
    const tx = await Transaction.begin(directory, 'simulated-backup-write-path', { code, simulated: true });
    const backup = await tx.backup(source, 'original'); assert(backup);
    tx.data.recovery = { beforeRegistry: await readJSON(path.join(directory, 'registry.json')), beforeWorkspace: await readJSON(path.join(directory, 'workspace.json')), files: [{ path: source, before: original, backup }] };
    await tx.record('prepared');
    const journal = path.join(tx.dir, 'journal.json'), journalBefore = await fs.readFile(journal), backupBefore = await fs.readFile(backup);
    const metadata = [path.join(directory, 'registry.json'), path.join(directory, 'workspace.json')];
    const metadataBefore = await Promise.all(metadata.map(file => fs.readFile(file)));
    const probe = await fs.open(path.join(root, 'descriptor-probe-' + code), 'wx');
    const prototype = Object.getPrototypeOf(probe), writeFile = prototype.writeFile; await probe.close();
    const backupDirectory = path.join(tx.dir, 'backups'), label = 'simulated-' + code;
    let fired = false, partial, descriptor;
    prototype.writeFile = async function (chunk, ...args) {
      if (!fired && Buffer.isBuffer(chunk)) {
        const candidates = (await fs.readdir(backupDirectory)).filter(name => name.endsWith('-' + label));
        if (candidates.length === 1) {
          const candidate = path.join(backupDirectory, candidates[0]);
          assert(inside(candidate) && path.dirname(candidate) === backupDirectory);
          const actual = await this.stat(), expected = await fs.lstat(candidate);
          if (actual.dev === expected.dev && actual.ino === expected.ino && expected.isFile() && !expected.isSymbolicLink()) {
            await owned(); assert(Number.isInteger(this.fd) && this.fd >= 0);
            fired = true; partial = candidate; descriptor = this.fd;
            await writeFile.call(this, chunk.subarray(0, 17)); await this.sync();
            throw Object.assign(new Error('Fixture-only simulated write-path ' + code), { code });
          }
        }
      }
      return writeFile.call(this, chunk, ...args);
    };
    try { await assert.rejects(tx.backup(source, label), { code }); }
    finally { prototype.writeFile = writeFile; }
    assert(fired && partial); assert.equal(prototype.writeFile, writeFile);
    assert.deepEqual(await fingerprint(source), original); assertBytesEqual(await fs.readFile(source), sourceBytes, 'source bytes');
    assertBytesEqual(await fs.readFile(backup), backupBefore, 'prior backup bytes'); assertBytesEqual(await fs.readFile(journal), journalBefore, 'journal bytes');
    const partialBytes = await fs.readFile(partial); assert.equal(partialBytes.length, 17); assertBytesEqual(partialBytes, sourceBytes.subarray(0, 17), 'partial backup prefix');
    const durable = await readJSON(journal); assert.equal(durable.state, 'pending'); assert.equal(durable.backups.length, 1);
    assert(!durable.backups.some(entry => entry.copy === partial)); assert(!durable.recovery.files.some(entry => entry.backup === partial));
    for (let i = 0; i < metadata.length; i++) assertBytesEqual(await fs.readFile(metadata[i]), metadataBefore[i], 'metadata bytes');
    const diagnosis = await doctorRepository(path.dirname(source));
    const plan = diagnosis.checks.find(entry => entry.name === 'Plano de recuperação: ' + tx.id);
    assert.equal(diagnosis.safe, false); assert(plan?.ok); assert.equal(plan.detail.recoveryAttempted, false);
    assertBytesEqual(await fs.readFile(journal), journalBefore, 'journal bytes');
    const exported = await exportRepositoryRecovery(path.dirname(source), path.join(root, 'write-fault-export-' + code));
    assert.equal(exported.complete, true);
    const exportedManifest = JSON.parse(await fs.readFile(exported.manifest, 'utf8'));
    const retained = exportedManifest.entries.find(entry => entry.type === 'file' && path.resolve(entry.source) === partial);
    assert(retained); assertBytesEqual(await fs.readFile(path.join(exported.destination, retained.path)), partialBytes, 'exported partial bytes');
    const retry = await tx.backup(source, 'retry-' + code); assert(retry && retry !== partial && retry !== backup);
    assertBytesEqual(await fs.readFile(retry), sourceBytes, 'retry backup bytes'); assertBytesEqual(await fs.readFile(backup), backupBefore, 'prior backup bytes'); assertBytesEqual(await fs.readFile(partial), partialBytes, 'retained partial bytes');
    assert.equal((await fs.lstat(retry)).nlink, 1); assert.equal((await fs.lstat(backup)).nlink, 1);
    const retried = await readJSON(journal); assert.equal(retried.state, 'pending'); assert.equal(retried.backups.length, 2);
    assert(!retried.backups.some(entry => entry.copy === partial));
    await tx.finish(); assert.equal((await readJSON(journal)).state, 'completed');
    for (let i = 0; i < metadata.length; i++) assertBytesEqual(await fs.readFile(metadata[i]), metadataBefore[i], 'metadata bytes');
    process.stdout.write(JSON.stringify({ code, simulatedWritePath: true, actualHostIoFailure: false, powerLoss: false, descriptor, journal: tx.id, originalSHA256: original.hash, partialBytes: partialBytes.length, partialSHA256: createHash('sha256').update(partialBytes).digest('hex'), partialRegisteredAsBackup: false, automaticRecoveryCompleted: false, explicitRetrySucceeded: true, diagnosisAttemptedRecovery: plan.detail.recoveryAttempted, independentExportComplete: exported.complete }));
  `;
  for (const code of ['EIO', 'EPERM', 'EACCES', 'ENOSPC']) await t.test(code, async () => {
    const child = await execute(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', childSource], { cwd: project, env: { ...f.env, GL_WRITE_FAULT_PARENT: f.parent, GL_WRITE_FAULT_NONCE: nonce, GL_WRITE_FAULT_CODE: code, GL_WRITE_FAULT_DIRECTORY: f.app.dir, GL_WRITE_FAULT_SOURCE: source }, timeout: 180000, maxOutput: 1024 * 1024 });
    f.record('owned write-fault child execution receipt', { code, pid: child.pid, exitCode: child.code, timedOut: child.timedOut, outputTruncated: child.outputTruncated, stdout: child.stdout, stderr: child.stderr, durationMs: child.duration_ms, termination: child.termination });
    assert.equal(child.timedOut, false); assert.equal(child.outputTruncated, false); assert.equal(child.code, 0, child.stderr);
    const observed = JSON.parse(child.stdout); assert.equal(observed.code, code); assert.equal(observed.partialBytes, 17); assert.equal(observed.explicitRetrySucceeded, true); assert.equal(observed.automaticRecoveryCompleted, false);
    assert.equal(f.git('rev-parse', 'HEAD'), before.head); assert.equal(f.git('for-each-ref'), before.refs);
    assertBytesEqual(await fs.readFile(path.join(f.repo, '.git', 'index')), before.index, 'performance-recovery.test.ts byte preservation'); assertBytesEqual(await fs.readFile(path.join(f.app.dir, 'registry.json')), before.registry, 'performance-recovery.test.ts byte preservation'); assertBytesEqual(await fs.readFile(path.join(f.app.dir, 'workspace.json')), before.workspace, 'performance-recovery.test.ts byte preservation'); assert.deepEqual(await fingerprint(source), before.source);
    f.record('simulated write-path failure before backup journal publication and independent retry', observed);
  });
});

test('GL19 abrupt termination of an owned process preserves lock journal backup and independent diagnostics', { timeout: 900000 }, async t => {
  const f = await fixture(t), storageURL = pathToFileURL(path.join(project, 'src/core/storage.ts')).href;
  const childSource = `import { withLock, Transaction, readJSON, fingerprint } from ${JSON.stringify(storageURL)}; import path from 'node:path'; const directory=process.env.GL_OWNED_DIRECTORY, source=process.env.GL_OWNED_SOURCE; await withLock(directory,async()=>{ const tx=await Transaction.begin(directory,'owned-abrupt-termination',{}); const before=await fingerprint(source),backup=await tx.backup(source,'before'); tx.data.recovery={beforeRegistry:await readJSON(path.join(directory,'registry.json')),beforeWorkspace:await readJSON(path.join(directory,'workspace.json')),files:[{path:source,before,backup}]}; await tx.record('prepared'); process.stdout.write(JSON.stringify({id:tx.id,pid:process.pid,backup})+'\\n'); await new Promise(()=>{setInterval(()=>{},1000);}); });`;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', childSource], { cwd: project, env: { ...f.env, GL_OWNED_DIRECTORY: f.app.dir, GL_OWNED_SOURCE: path.join(f.repo, 'base.txt') }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  let terminated = false;
  t.after(async () => { if (!terminated && child.exitCode === null && child.signalCode === null) { child.kill(); await exited; } });
  const ready = await new Promise<{ id: string; pid: number; backup: string }>((resolve, reject) => {
    let stdout = '', stderr = ''; const timer = setTimeout(() => reject(new Error('Own child readiness timeout: ' + stderr)), 30000);
    child.stderr.on('data', bytes => { stderr += String(bytes); }); child.stdout.on('data', bytes => { stdout += String(bytes); if (stdout.includes('\n')) { clearTimeout(timer); try { resolve(JSON.parse(stdout.split('\n')[0]!)); } catch (error) { reject(error); } } }); child.once('error', reject); child.once('exit', () => { clearTimeout(timer); reject(new Error('Own child exited before durable barrier: ' + stderr)); });
  });
  assert.equal(ready.pid, child.pid); assert(ready.backup.startsWith(f.app.dir + path.sep));
  const ownerFile = path.join(f.app.dir, 'locks', 'coordinator', 'owner.json'), ownerBytes = await fs.readFile(ownerFile); assert.equal(JSON.parse(ownerBytes.toString()).pid, child.pid);
  assert.equal(await fs.readFile(ready.backup, 'utf8'), 'base A\n'); const before = await f.snapshot();
  assert(child.kill()); const termination = await exited; terminated = true;
  const reopened = await GitLayers.open(f.repo); await assert.rejects(reopened.recover(), { code: 'LOCKED' }); assert.deepEqual(await f.snapshot(), before); assertBytesEqual(await fs.readFile(ownerFile), ownerBytes, 'performance-recovery.test.ts byte preservation');
  const report = await doctorRepository(f.repo); assert.equal(report.safe, false); assert.equal(planCheck(report, ready.id).ok, true); assert(report.checks.some(check => !check.ok && (check.detail as any).code === 'LOCKED'));
  const exported = await exportRepositoryRecovery(f.repo, path.join(f.parent, 'abrupt-export')); assert.equal(exported.complete, true); assert.deepEqual(await f.snapshot(), before);
  f.record('real owned-process termination, distinct from power loss', { pid: ready.pid, termination, journal: ready.id, ownerSHA256: digest(ownerBytes), backupSHA256: digest(await fs.readFile(ready.backup)), automaticRecoveryCompleted: false, report: report.checks.filter(check => !check.ok), exported });
});
