import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { discover } from '../../src/core/git.js';
import { stageIndex } from '../../src/core/index-stage.js';
import { fingerprint, type Fingerprint } from '../../src/core/storage.js';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const budget = { timeout: 900000 }; // Compound-fixture budget, never a product latency SLO.
const configs = [{ label: 'default', trustctime: 'true', checkStat: 'default' }, { label: 'minimal', trustctime: 'false', checkStat: 'minimal' }] as const;
type Role = 'MAIN' | 'private';
const stat = (file: string) => { const s = fs.statSync(file, { bigint: true }); return { bytes: Number(s.size), mtimeNs: s.mtimeNs.toString(), ctimeNs: s.ctimeNs.toString(), dev: s.dev.toString(), ino: s.ino.toString() }; };
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function beyond(seconds: number) { while (Date.now() <= seconds * 1000 + 1500) await sleep(100); }

function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-staging-racy');
  const previous = { ...process.env }, preserve = previous.GL_STAGE2_PRESERVE_FIXTURES === '1';
  const events: unknown[] = []; let completed = false;
  t.after(() => {
    try {
      const markerFile = path.join(owned.root, '.git-compat-owned.json'), directory = fs.lstatSync(owned.root);
      assert(directory.isDirectory() && !directory.isSymbolicLink()); assert(!fs.lstatSync(markerFile).isSymbolicLink());
      const marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
      assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
      assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent); assert.equal(path.dirname(fs.realpathSync(owned.root)), owned.parent);
      if (preserve || !completed) {
        const receipt = { schema: 1, test: t.name, ...owned, retained: true, completed, policy: preserve ? 'GL_STAGE2_PRESERVE_FIXTURES=1; retain all evidence' : 'Retain failed or incomplete setup evidence', events };
        fs.writeFileSync(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify(receipt, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n', { flag: 'wx' });
        t.diagnostic(JSON.stringify({ kind: 'retained-staging-racy-fixture', test: t.name, ...owned }));
      } else cleanupFixture(owned);
    } finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); }
  });
  const relative = path.relative(path.toNamespacedPath(path.resolve('.')), path.toNamespacedPath(owned.root));
  assert(relative.startsWith('..') || path.isAbsolute(relative), 'Staging fixture must be external to the development repository');
  const env = isolatedEnvironment(owned.root, officialGit); if (preserve) env.GL_STAGE2_PRESERVE_FIXTURES = '1';
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo space'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string) => {
    const result = cp.spawnSync(officialGit, args, { cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 1024 * 1024 });
    events.push({ kind: 'official-git', args, index: index ? path.relative(owned.root, index) : 'MAIN', code: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
    assert.equal(result.status, 0, JSON.stringify({ args, status: result.status, error: result.error?.message, stderr: result.stderr })); return result.stdout.trimEnd();
  };
  const write = (file: string, bytes: string) => fs.writeFileSync(path.join(repo, file), bytes);
  const record = (value: unknown) => { events.push(value); };
  const externalTimestamp = (file: string, seconds: number) => {
    // A real owned process edits only metadata of an explicitly named fixture
    // file. This is a concurrency/failure experiment, not the native-racy setup.
    const source = `const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const [file,root,nonce,seconds]=process.argv.slice(1);const owner=JSON.parse(fs.readFileSync(path.join(root,'.git-compat-owned.json'),'utf8'));assert.equal(owner.nonce,nonce);const relative=path.relative(fs.realpathSync(root),fs.realpathSync(file));assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);fs.utimesSync(file,s.atime,Number(seconds));`;
    const result = cp.spawnSync(process.execPath, ['-e', source, file, owned.root, owned.nonce, String(seconds)], { env, cwd: owned.root, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    events.push({ kind: 'real-owned-metadata-writer', file: path.relative(owned.root, file), code: result.status, stderr: result.stderr });
    assert.equal(result.status, 0, result.stderr);
  };
  return { owned, env, repo, native, write, record, externalTimestamp, finish: () => { completed = true; } };
}
type Fixture = ReturnType<typeof fixture>;

async function nativeB(f: Fixture, role: Role, config: typeof configs[number]) {
  f.native(['init', '-b', 'main']);
  for (const [key, value] of [['core.autocrlf', 'false'], ['core.trustctime', config.trustctime], ['core.checkStat', config.checkStat], ['core.fsmonitor', 'false'], ['core.filemode', 'false']]) f.native(['config', '--local', key!, value!]);
  f.write('racy.txt', 'AAAA\n'); f.write('other.txt', 'OOOO\n'); f.write('unrelated.txt', 'UUUU\n');
  f.native(['add', '--', 'racy.txt', 'other.txt', 'unrelated.txt']); f.native(['commit', '-m', 'racy fixture committed A']); f.native(['branch', 'layer/racy']);
  const repo = await discover(f.repo), directory = path.join(repo.gitDir, 'layers', 'indexes'); fs.mkdirSync(directory, { recursive: true });
  const index = role === 'MAIN' ? repo.index : path.join(directory, 'private.index'), oracle = path.join(repo.gitDir, 'native-oracle.index');
  if (role === 'private') f.native(['read-tree', 'HEAD'], index);
  f.native(['read-tree', 'HEAD'], oracle);
  f.write('unrelated.txt', 'VVVV\n'); f.native(['add', '--', 'unrelated.txt'], index); f.native(['add', '--', 'unrelated.txt'], oracle); f.write('unrelated.txt', 'WWWW\n');
  const file = path.join(f.repo, 'racy.txt'); f.write('racy.txt', 'BBBB\n');
  const target = Math.floor(Date.now() / 1000) + 30; fs.utimesSync(file, target, target);
  f.native(['add', '--', 'racy.txt'], index); f.native(['add', '--', 'racy.txt'], oracle);
  // Both indexes are produced by official Git and are never utimed in these
  // successful regression cases. Only the owned workfile timestamp is set.
  const bStat = stat(file), indexStat = stat(index), oracleStat = stat(oracle);
  assert(BigInt(indexStat.mtimeNs) <= BigInt(bStat.mtimeNs), 'Native source must be racy before the copy');
  assert(BigInt(oracleStat.mtimeNs) <= BigInt(bStat.mtimeNs), 'Native oracle must be racy before the copy');
  const before = { main: fs.readFileSync(repo.index), index: fs.readFileSync(index), head: f.native(['rev-parse', 'HEAD']), refs: f.native(['for-each-ref', '--format=%(refname) %(objectname)']) };
  const tx = path.join(repo.gitDir, 'layers', 'transactions', randomUUID()); fs.mkdirSync(tx, { recursive: true });
  f.record({ kind: 'native-racy-preconditions', role, config, bStat, indexStat, oracleStat, sourceAndOracleIndexTimestampNeverEdited: true });
  return { repo, role, index, oracle, tx, file, target, bStat, before, bOID: f.native(['rev-parse', ':racy.txt'], index) };
}
type Prepared = Awaited<ReturnType<typeof nativeB>>;
function sameSizeC(f: Fixture, prepared: Prepared) {
  f.write('racy.txt', 'CCCC\n'); fs.utimesSync(prepared.file, prepared.target, prepared.target);
  const c = stat(prepared.file); assert.equal(c.bytes, prepared.bStat.bytes); assert.equal(c.mtimeNs, prepared.bStat.mtimeNs); return c;
}
function invariants(f: Fixture, p: Prepared) {
  assert.equal(f.native(['rev-parse', 'HEAD']), p.before.head); assert.equal(f.native(['for-each-ref', '--format=%(refname) %(objectname)']), p.before.refs);
  assert.equal(f.native(['show', 'HEAD:racy.txt']), 'AAAA'); assert.equal(fs.readFileSync(p.file, 'utf8'), 'CCCC\n');
  assert.equal(f.native(['show', ':unrelated.txt'], p.index), 'VVVV'); assert.equal(fs.readFileSync(path.join(f.repo, 'unrelated.txt'), 'utf8'), 'WWWW\n');
  if (p.role === 'private') assertBytesEqual(fs.readFileSync(p.repo.index), p.before.main, 'Private stage preserves exact MAIN bytes');
}

for (const role of ['MAIN', 'private'] as const) for (const config of configs) {
  test('racy staging ' + role + ' ' + config.label + ' selects disk C like original official Git instead of stale B', budget, async t => {
    const f = fixture(t), p = await nativeB(f, role, config); const cStat = sameSizeC(f, p); await beyond(p.target);
    let beforeCalls = 0, plannedCalls = 0, planned: Fingerprint | undefined;
    const after = await stageIndex(p.repo, p.index, p.tx, ['add', '--', 'racy.txt'], { expected: await fingerprint(p.index), beforePublish: async () => { beforeCalls++; }, planned: async value => { plannedCalls++; planned = value; } });
    assert.deepEqual(after, await fingerprint(p.index)); assert.deepEqual(planned, after); assert.equal(beforeCalls, 1); assert.equal(plannedCalls, 1);
    const expectedC = f.native(['hash-object', '--', 'racy.txt']); f.native(['add', '--', 'racy.txt'], p.oracle);
    const originalNative = f.native(['rev-parse', ':racy.txt'], p.oracle), actual = f.native(['rev-parse', ':racy.txt'], p.index);
    assert.equal(originalNative, expectedC, 'Original native-racy Git add selects C'); assert.equal(actual, originalNative, 'Atomic staging must select the same C blob'); assert.notEqual(actual, p.bOID);
    assert.equal(f.native(['show', ':racy.txt'], p.index), 'CCCC'); invariants(f, p);
    f.record({ kind: 'selected-add-oracle', role, config, bStat: p.bStat, cStat, expectedC, originalNative, actual }); f.finish();
  });

  test('racy staging ' + role + ' ' + config.label + ' publication preserves native generated scratch eligibility for later C', budget, async t => {
    const f = fixture(t), p = await nativeB(f, role, config); f.write('other.txt', 'PPPP\n');
    let generated: ReturnType<typeof stat> | undefined, generatedFile: string | undefined, planned: Fingerprint | undefined;
    const after = await stageIndex(p.repo, p.index, p.tx, ['add', '--', 'other.txt'], { expected: await fingerprint(p.index), beforePublish: async () => {
      const scratch = fs.readdirSync(p.tx).filter(name => /^stage-.*\.index$/u.test(name)); assert.equal(scratch.length, 1);
      generatedFile = path.join(p.tx, scratch[0]!); generated = stat(generatedFile);
      assert(BigInt(generated.mtimeNs) <= BigInt(p.bStat.mtimeNs), 'The actual native-generated scratch must still be racy for this interleaving');
      fs.writeFileSync(path.join(p.tx, 'native-generated-before-publish.bin'), fs.readFileSync(generatedFile), { flag: 'wx' });
      await beyond(p.target); sameSizeC(f, p); // Concurrent payload edit after native add; no index timestamp is edited.
    }, planned: async value => { planned = value; } });
    assert(generated && generatedFile); assert.deepEqual(after, await fingerprint(p.index)); assert.deepEqual(planned, after);
    const published = stat(p.index); assert(BigInt(published.mtimeNs) <= BigInt(generated.mtimeNs), 'Publication cannot move the native index timestamp forward');
    const args = ['diff', '--no-ext-diff', '--no-textconv', '--name-status', '-z', '--no-renames', '--', 'racy.txt'];
    const sourceNativeDiff = f.native(args, generatedFile), publishedDiff = f.native(args, p.index);
    assert.equal(sourceNativeDiff, 'M\0racy.txt\0', 'The exact original Git-generated scratch detects C'); assert.equal(publishedDiff, sourceNativeDiff, 'Published index must detect the same C');
    assert.equal(f.native(['show', ':racy.txt'], p.index), 'BBBB'); assert.equal(f.native(['show', ':other.txt'], p.index), 'PPPP'); invariants(f, p);
    f.record({ kind: 'equivalent-generated-scratch-oracle', role, config, generated, published, sourceNativeDiff, publishedDiff }); f.finish();
  });
}

for (const target of ['source', 'publication-lock'] as const) test('racy staging refuses a real external ' + target + ' timestamp edit without publishing a different index', budget, async t => {
  const f = fixture(t), p = await nativeB(f, 'MAIN', configs[0]); sameSizeC(f, p); const before = fs.readFileSync(p.index); let changedFile: string | undefined;
  await assert.rejects(stageIndex(p.repo, p.index, p.tx, ['add', '--', 'racy.txt'], { expected: await fingerprint(p.index), beforePublish: async () => {
    if (target === 'source') { changedFile = p.index; f.externalTimestamp(changedFile, p.target + 100); }
  }, planned: async () => { if (target === 'publication-lock') { changedFile = p.index + '.lock'; f.externalTimestamp(changedFile, p.target + 100); } } }), { code: 'EXTERNAL_EDIT' });
  assert(changedFile); assertBytesEqual(fs.readFileSync(p.index), before, 'Unpublished native index bytes stay intact'); invariants(f, p);
  if (target === 'publication-lock') { assert(fs.existsSync(p.index + '.lock'), 'Disputed temporal lock evidence is preserved'); assert.equal(stat(p.index + '.lock').mtimeNs, String(BigInt(p.target + 100) * 1_000_000_000n)); }
  else { assert.equal(stat(p.index).mtimeNs, String(BigInt(p.target + 100) * 1_000_000_000n)); assert(!fs.existsSync(p.index + '.lock'), 'Only the unchanged proven own lock can be cleaned'); }
  f.finish();
});

test('racy staging refuses an unrepresentable source timestamp before Git add and leaves original bytes plus scratch evidence', budget, async t => {
  const f = fixture(t), p = await nativeB(f, 'private', configs[0]); sameSizeC(f, p); const before = fs.readFileSync(p.index);
  // Deliberately invalid metadata in a separate refusal experiment; successful
  // native-racy regression cases above never edit an index timestamp.
  fs.utimesSync(p.index, 0, 0); let beforeCalls = 0, plannedCalls = 0;
  await assert.rejects(stageIndex(p.repo, p.index, p.tx, ['add', '--', 'racy.txt'], { expected: await fingerprint(p.index), beforePublish: async () => { beforeCalls++; }, planned: async () => { plannedCalls++; } }), { code: 'INDEX_TIMESTAMP_UNSAFE' });
  assert.equal(beforeCalls, 0); assert.equal(plannedCalls, 0); assertBytesEqual(fs.readFileSync(p.index), before); assert.equal(stat(p.index).mtimeNs, '0');
  assert(!fs.existsSync(p.index + '.lock')); const scratches = fs.readdirSync(p.tx).filter(name => /^stage-.*\.index$/u.test(name)); assert.equal(scratches.length, 1);
  assertBytesEqual(fs.readFileSync(path.join(p.tx, scratches[0]!)), before, 'Private unregistered scratch preserves its source image for inspection'); invariants(f, p); f.finish();
});
test('racy staging keeps the validated caller argv fixed across asynchronous index preparation', budget, async t => {
  const f = fixture(t), p = await nativeB(f, 'MAIN', configs[0]); sameSizeC(f, p); f.write('other.txt', 'PPPP\n');
  const args = ['add', '--', 'racy.txt']; let planned: Fingerprint | undefined;
  const pending = stageIndex(p.repo, p.index, p.tx, args, { expected: await fingerprint(p.index), beforePublish: async () => {}, planned: async value => { planned = value; } });
  args.splice(0, args.length, 'add', '--', 'other.txt');
  const after = await pending; assert.deepEqual(planned, after); assert.deepEqual(after, await fingerprint(p.index));
  assert.deepEqual(args, ['add', '--', 'other.txt']);
  const expectedC = f.native(['hash-object', '--', 'racy.txt']); f.native(['add', '--', 'racy.txt'], p.oracle);
  assert.equal(f.native(['rev-parse', ':racy.txt'], p.oracle), expectedC); assert.equal(f.native(['rev-parse', ':racy.txt'], p.index), expectedC);
  assert.equal(f.native(['show', ':other.txt'], p.index), 'OOOO', 'Mutating the caller array cannot stage an unvalidated path');
  assert.equal(fs.readFileSync(path.join(f.repo, 'other.txt'), 'utf8'), 'PPPP\n'); invariants(f, p); f.finish();
});
