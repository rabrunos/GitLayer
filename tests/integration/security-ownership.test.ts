import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { Transaction } from '../../src/core/storage.js';
import { readJournal, writeJournalFixture } from '../helpers/read-journal.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const evidenceRoot = process.env.GL_SECURITY_EVIDENCE;
const keepFixtures = process.env.GL_SECURITY_KEEP_FIXTURES === '1';
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function fixtureParent() {
  const parent = path.resolve(os.tmpdir());
  for (let cursor = parent; ; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Fixture ancestors must be real directories');
    try { fs.lstatSync(path.join(cursor, '.git')); assert.fail('Fixture parent must be outside every repository'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(cursor) === cursor) break;
  }
  return fs.realpathSync(parent);
}

function inventory(directory: string, prefix = ''): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  if (!fs.existsSync(directory)) return entries;
  for (const name of fs.readdirSync(directory).sort()) {
    if (!prefix && name === '.git') continue;
    const file = path.join(directory, name), relative = prefix + name, stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), 'Independent observer never follows fixture links');
    if (stat.isDirectory()) Object.assign(entries, inventory(file, relative + '/'));
    else {
      assert(stat.isFile() && stat.nlink === 1, 'Fixture contains only independent regular files');
      const bytes = fs.readFileSync(file);
      entries[relative] = { sha256: hash(bytes), bytes: bytes.length, mode: stat.mode & 0o777 };
    }
  }
  return entries;
}

async function fixture(t: TestContext) {
  const owned = createFixture(fixtureParent(), 'gl-security-ownership');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const events: unknown[] = [];
  const git = (args: string[], index?: string) => {
    const stdout = execFileSync(officialGit, args, { cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    events.push({ kind: 'git', executable: officialGit, args, index: index ? path.basename(index) : 'main', code: 0, stdout });
    return stdout.trimEnd();
  };
  const write = (relative: string, bytes: string) => { const file = path.join(repo, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
  const read = (relative: string) => fs.readFileSync(path.join(repo, relative), 'utf8');
  git(['init', '-b', 'main']); git(['config', 'core.autocrlf', 'false']);
  write('base.txt', 'base A\n'); git(['add', '.']); git(['commit', '-m', 'base']);
  let app = await GitLayers.init(repo);
  const layerIndex = (name: string) => {
    const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
    return path.join(app.dir, 'indexes', registry.layers.find((layer: any) => layer.name === name).id + '.index');
  };
  const domain = () => {
    const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
    return {
      head: git(['rev-parse', 'HEAD']), branch: git(['symbolic-ref', '--short', 'HEAD']),
      branches: git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']),
      mainIndex: git(['ls-files', '--stage']),
      layerIndexes: Object.fromEntries(registry.layers.map((layer: any) => [layer.name, git(['ls-files', '--stage'], layerIndex(layer.name))])),
      files: inventory(repo),
    };
  };
  const record = (label: string, value: unknown) => events.push({ kind: 'observation', label, value });
  const capture = (label: string) => {
    const state = { ...domain(), allRefs: git(['for-each-ref', '--format=%(refname) %(objectname)']), metadata: inventory(app.dir), workspace: JSON.parse(fs.readFileSync(path.join(app.dir, 'workspace.json'), 'utf8')), registry: JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8')), exclude: fs.readFileSync(app.repo.exclude, 'utf8') };
    record(label, state); return state;
  };
  const seed = async (name: string, file: string) => { await app.create(name); await app.on(name); write(file, name + ' A\n'); await app.add(name, [file]); await app.commit(name, 'seed ' + name); };
  const pendingB = async () => { write('b.txt', 'b B staged\n'); await app.add('b', ['b.txt']); write('b.txt', 'b C disk\n'); };
  const reopen = async () => { app = await GitLayers.open(repo); return app; };
  capture('initialized');
  t.after(() => {
    try {
      capture('final');
      if (evidenceRoot) {
        fs.mkdirSync(evidenceRoot, { recursive: true });
        fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json'), JSON.stringify({ test: t.name, fixture: owned.root, officialGit, gitVersion: git(['--version']), node: process.version, platform: process.platform, events }, null, 2) + '\n');
      }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
      if (keepFixtures) t.diagnostic('Preserved owned fixture: ' + owned.root);
      else cleanupFixture(owned);
    }
  });
  return { get app() { return app; }, repo, write, read, git, seed, pendingB, domain, capture, record, reopen, layerIndex };
}

test('D01 managed base rename preserves base ownership, staged B and disk C across restart and Layer discard', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('b', 'b.txt');
  f.write('base.txt', 'base B staged\n'); f.git(['add', '--', 'base.txt']); f.write('base.txt', 'base C disk\n');
  await f.pendingB(); await f.app.target('b'); const before = f.capture('before managed base rename');
  assert.equal((await f.app.renameFile('base.txt', 'moved.txt')).owner, 'base');
  let status = await f.app.status();
  assert.equal(status.safe, true); assert(!status.layers.find(layer => layer.name === 'b')!.reservations.includes('moved.txt'));
  assert.equal(f.read('moved.txt'), 'base C disk\n'); assert.equal(f.git(['ls-files', '--stage']), before.mainIndex);
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('b')), before.layerIndexes.b);
  await f.reopen(); status = await f.app.status(); assert.equal(status.safe, true);
  await assert.rejects(f.app.add('b', ['moved.txt']), { code: 'OWNERSHIP' });
  // Preparing/committing the base remains deliberate and works while target b is open.
  await f.app.baseStage(['base.txt', 'moved.txt']); assert.equal(f.git(['show', ':moved.txt']), 'base C disk');
  await f.app.baseCommit('deliberate base rename during Layer editing');
  assert.equal(f.git(['show', 'HEAD:moved.txt']), 'base C disk');
  assert.equal((await f.app.status()).safe, true, 'Retiring a committed base claim is not external interference');
  assert.equal((await f.app.status()).editingTarget, 'b');
  const committed = f.capture('after deliberate base commit with target still open');
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('b')), before.layerIndexes.b);
  assert.equal(f.read('b.txt'), 'b C disk\n');
  await f.app.deactivate('b', { discard: true });
  assert.equal(f.read('moved.txt'), 'base C disk\n'); assert.equal(f.git(['ls-files', '--stage']), committed.mainIndex);
  assert.equal(f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), committed.branches);
  await f.reopen(); assert.equal((await f.app.status()).safe, true);
  f.capture('base rename retained after explicit Layer discard');
});

test('D01 managed Layer rename retains its own index and refuses another target even with staged B and disk C', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt');
  f.write('a.txt', 'a B staged\n'); await f.app.add('a', ['a.txt']); f.write('a.txt', 'a C disk\n'); await f.pendingB();
  await f.app.target('b'); const before = f.capture('before managed Layer rename');
  assert.equal((await f.app.renameFile('a.txt', 'moved.txt')).owner, 'a');
  const status = await f.app.status(); assert.equal(status.safe, true);
  assert(status.layers.find(layer => layer.name === 'a')!.reservations.includes('moved.txt'));
  assert(!status.layers.find(layer => layer.name === 'b')!.reservations.includes('moved.txt'));
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('a')), before.layerIndexes.a);
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('b')), before.layerIndexes.b);
  await assert.rejects(f.app.add('b', ['moved.txt']), { code: 'OWNERSHIP' });
  await f.reopen(); assert.equal((await f.app.status()).safe, true);
  await f.app.deactivate('b', { discard: true }); assert.equal(f.read('moved.txt'), 'a C disk\n');
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('a')), before.layerIndexes.a);
  assert.equal(f.git(['ls-files', '--stage']), before.mainIndex);
});

const externalCases = [
  { owner: 'base', route: 'rename', changed: true },
  { owner: 'a', route: 'rename', changed: true },
  { owner: null, route: 'rename', changed: false },
  { owner: 'base', route: 'copy-delete', changed: false },
  { owner: 'a', route: 'copy-delete', changed: false },
  { owner: null, route: 'copy-delete', changed: true },
] as const;

for (const entry of externalCases) test(`D01 external ${entry.owner ?? 'unowned'} ${entry.route} ${entry.changed ? 'edited' : 'identical'} refuses ambiguity and resolves without staging`, { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt');
  const from = entry.owner === 'base' ? 'base.txt' : entry.owner === 'a' ? 'a.txt' : 'unowned.txt';
  if (entry.owner === null) f.write(from, 'unowned A\n');
  const original = f.read(from);
  if (entry.owner === 'base') { f.write(from, 'base B staged\n'); f.git(['add', '--', from]); }
  if (entry.owner === 'a') { f.write(from, 'a B staged\n'); await f.app.add('a', [from]); }
  f.write(from, entry.changed ? 'unique edited C\n' : original); await f.pendingB(); await f.app.target('b');
  const before = f.capture('before external move');
  if (entry.route === 'rename') fs.renameSync(path.join(f.repo, from), path.join(f.repo, 'moved.txt'));
  else { fs.copyFileSync(path.join(f.repo, from), path.join(f.repo, 'moved.txt')); fs.unlinkSync(path.join(f.repo, from)); }
  const movedBytes = f.read('moved.txt'), afterMove = f.domain(), status = await f.app.status();
  f.record('ambiguous status', status); assert.equal(status.safe, false); assert.equal(status.error?.code, 'OWNERSHIP_AMBIGUOUS');
  assert(!status.layers.find(layer => layer.name === 'b')!.reservations.includes('moved.txt'));
  assert.deepEqual(f.domain(), afterMove, 'Observation preserves files, refs and every semantic index');
  const review = await f.app.ownershipReview();
  assert(review.missing.some(item => item.path === from && item.owner === entry.owner)); assert(review.candidates.includes('moved.txt'));
  const readOnly = f.capture('before read-only ownership review');
  assert.equal((await f.app.ownershipReview()).token, review.token);
  assert.deepEqual(f.capture('after read-only ownership review'), readOnly);
  const operations = [
    () => f.app.add('b', ['moved.txt']),
    () => f.app.commit('b', 'must not commit ambiguous ownership'),
    () => f.app.deactivate('b', { discard: true }),
    ...(entry.owner === 'a' && entry.route === 'rename' ? [
      () => f.app.baseStage(['moved.txt']), () => f.app.baseCommit('must not commit base'),
      () => f.app.removeLayer('b', { discard: true }), () => f.app.target(), () => f.app.target('a'),
    ] : []),
  ];
  for (const operation of operations) await assert.rejects(operation(), { code: 'OWNERSHIP_AMBIGUOUS' });
  assert.deepEqual(f.domain(), afterMove, 'Refused mutations preserve staged B, disk C, refs and other origins');
  await f.reopen(); assert.equal((await f.app.status()).safe, false);
  let current = await f.app.ownershipReview();
  if (entry.owner === 'base' && entry.route === 'rename') {
    const beforeInvalid = f.domain();
    await assert.rejects(f.app.resolveOwnership({ token: current.token, renames: [{ from: 'b.txt', to: 'moved.txt' }] }));
    assert.deepEqual(f.domain(), beforeInvalid, 'Invalid declaration cannot change ownership or data');
    f.write('moved.txt', 'changed after ownership review\n'); const afterEdit = f.domain();
    await assert.rejects(f.app.resolveOwnership({ token: current.token, renames: [{ from, to: 'moved.txt' }] }), { code: 'OWNERSHIP_REVIEW_STALE' });
    assert.deepEqual(f.domain(), afterEdit, 'Stale decision cannot stage or overwrite later edits'); current = await f.app.ownershipReview();
  }
  const beforeResolution = f.domain(), finalBytes = f.read('moved.txt');
  await f.app.resolveOwnership({ token: current.token, renames: [{ from, to: 'moved.txt' }] });
  assert.deepEqual(f.domain(), beforeResolution, 'Resolution declares origin without staging, commit or filesystem effects');
  const resolved = await f.app.status(); assert.equal(resolved.safe, true);
  assert(!resolved.layers.find(layer => layer.name === 'b')!.reservations.includes('moved.txt'));
  if (entry.owner === 'a') assert(resolved.layers.find(layer => layer.name === 'a')!.reservations.includes('moved.txt'));
  else assert(!resolved.layers.some(layer => layer.reservations.includes('moved.txt')));
  await f.reopen(); assert.equal((await f.app.status()).safe, true);
  await f.app.deactivate('b', { discard: true }); assert.equal(f.read('moved.txt'), finalBytes);
  assert.equal(f.git(['ls-files', '--stage']), before.mainIndex);
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('a')), before.layerIndexes.a);
  assert.equal(f.git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), before.branches);
  if (entry.owner === null) {
    f.git(['add', '--', 'moved.txt']); assert.equal(f.git(['show', ':moved.txt']), finalBytes.trimEnd());
  }
  f.record('resolved origin and original moved bytes', { owner: entry.owner, movedBytes, finalBytes });
});

test('D01 a file observed and staged before source deletion still blocks commit until independent creation is declared', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt'); await f.app.target('b');
  f.write('new.txt', 'new B staged\n'); let status = await f.app.status(); assert.equal(status.safe, true);
  assert(status.layers.find(layer => layer.name === 'b')!.reservations.includes('new.txt'));
  await f.app.add('b', ['new.txt']); f.write('new.txt', 'new C disk\n'); fs.unlinkSync(path.join(f.repo, 'a.txt'));
  const before = f.capture('after deletion following auto-assignment and staging');
  status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, 'OWNERSHIP_AMBIGUOUS');
  await assert.rejects(f.app.commit('b', 'must refuse late ambiguity'), { code: 'OWNERSHIP_AMBIGUOUS' });
  assert.deepEqual(f.domain(), { head: before.head, branch: before.branch, branches: before.branches, mainIndex: before.mainIndex, layerIndexes: before.layerIndexes, files: before.files });
  const review = await f.app.ownershipReview(); assert(review.candidates.includes('new.txt'));
  const beforeResolution = f.domain();
  await f.app.resolveOwnership({ token: review.token, independent: ['new.txt'], deleted: ['a.txt'] });
  assert.deepEqual(f.domain(), beforeResolution, 'Declaring independent creation/deletion never stages, commits or writes files');
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('b')), before.layerIndexes.b);
  assert.equal(f.read('new.txt'), 'new C disk\n'); assert.equal((await f.app.status()).safe, true);
  await f.app.commit('b', 'deliberately independent creation'); assert.equal(f.git(['show', 'layer/b:new.txt']), 'new B staged');
  assert.equal(f.read('new.txt'), 'new C disk\n'); assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('a')), before.layerIndexes.a);
});

test('D01 normal new files and copies remain automatic while preexisting unowned files are never captured retroactively', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt');
  f.write('old.txt', 'prior unowned\n'); await f.app.target('b'); const before = f.capture('before ordinary creations');
  f.write('new.txt', 'ordinary new\n'); fs.copyFileSync(path.join(f.repo, 'a.txt'), path.join(f.repo, 'copy.txt'));
  const status = await f.app.status(); assert.equal(status.safe, true);
  const paths = status.layers.find(layer => layer.name === 'b')!.reservations;
  assert(paths.includes('new.txt') && paths.includes('copy.txt')); assert(!paths.includes('old.txt'));
  assert.equal(f.git(['ls-files', '--stage']), before.mainIndex);
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('a')), before.layerIndexes.a);
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('b')), before.layerIndexes.b);
  await f.app.release('b', ['copy.txt']);
  assert(!(await f.app.status()).layers.find(layer => layer.name === 'b')!.reservations.includes('copy.txt'), 'Explicit release remains unowned instead of being captured again');
  f.git(['add', '.']); assert.equal(f.git(['diff', '--cached', '--name-only']), 'copy.txt\nold.txt');
  await f.app.target(); assert.equal((await f.app.status()).editingTarget, null);
  f.write('after.txt', 'normal after target\n'); f.git(['add', '.']); assert.equal(f.git(['diff', '--cached', '--name-only']), 'after.txt\ncopy.txt\nold.txt');
});

test('D01 an already staged target candidate cannot change origin until explicit unstage, which preserves later disk bytes', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt');
  f.write('a.txt', 'a B staged\n'); await f.app.add('a', ['a.txt']); f.write('a.txt', 'a C disk\n');
  await f.app.target('b'); fs.copyFileSync(path.join(f.repo, 'a.txt'), path.join(f.repo, 'copied.txt'));
  assert.equal((await f.app.status()).safe, true); await f.app.add('b', ['copied.txt']);
  f.write('copied.txt', 'later D disk\n'); fs.unlinkSync(path.join(f.repo, 'a.txt'));
  const ambiguous = await f.app.status(); assert.equal(ambiguous.safe, false); assert.equal(ambiguous.error?.code, 'OWNERSHIP_AMBIGUOUS');
  const before = f.capture('staged candidate before forbidden ownership change'), review = await f.app.ownershipReview();
  await assert.rejects(f.app.resolveOwnership({ token: review.token, renames: [{ from: 'a.txt', to: 'copied.txt' }] }), { code: 'OWNERSHIP_REVIEW_STAGED' });
  assert.deepEqual(f.domain(), { head: before.head, branch: before.branch, branches: before.branches, mainIndex: before.mainIndex, layerIndexes: before.layerIndexes, files: before.files });
  await f.app.unstage('b', ['copied.txt']);
  assert.equal(f.read('copied.txt'), 'later D disk\n');
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('a')), before.layerIndexes.a);
  assert(!f.git(['ls-files', '--stage'], f.layerIndex('b')).includes('\tcopied.txt'));
  const fresh = await f.app.ownershipReview(); assert.notEqual(fresh.token, review.token);
  const beforeResolution = f.domain();
  await f.app.resolveOwnership({ token: fresh.token, renames: [{ from: 'a.txt', to: 'copied.txt' }] });
  assert.deepEqual(f.domain(), beforeResolution);
  const resolved = await f.app.status(); assert.equal(resolved.safe, true);
  assert(resolved.layers.find(layer => layer.name === 'a')!.reservations.includes('copied.txt'));
  assert(!resolved.layers.find(layer => layer.name === 'b')!.reservations.includes('copied.txt'));
  await assert.rejects(f.app.add('b', ['copied.txt']), { code: 'OWNERSHIP' });
  assert.equal(f.read('copied.txt'), 'later D disk\n');
});

test('D01 without an editing target detects Layer renames, retains native staging and revokes acknowledgements after an observed reappearance', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt');
  f.write('base.txt', 'base B staged\n'); f.git(['add', '--', 'base.txt']);
  f.write('a.txt', 'a B staged\n'); await f.app.add('a', ['a.txt']); f.write('a.txt', 'a C disk\n'); await f.pendingB();
  const before = f.capture('without target before external Layer rename');
  fs.renameSync(path.join(f.repo, 'a.txt'), path.join(f.repo, 'moved.txt'));
  let status = await f.app.status(); assert.equal(status.editingTarget, null); assert.equal(status.safe, false); assert.equal(status.error?.code, 'OWNERSHIP_AMBIGUOUS');
  await assert.rejects(f.app.baseStage(['moved.txt']), { code: 'OWNERSHIP_AMBIGUOUS' });
  await assert.rejects(f.app.commit('b', 'must not commit another origin'), { code: 'OWNERSHIP_AMBIGUOUS' });
  await assert.rejects(f.app.deactivate('b', { discard: true }), { code: 'OWNERSHIP_AMBIGUOUS' });
  // Git is still Git: it can stage the new untracked name before ownership is resolved.
  f.git(['add', '--', 'moved.txt']); const nativeStaged = f.domain();
  status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, 'OWNERSHIP_AMBIGUOUS');
  await assert.rejects(f.app.baseCommit('must not commit native contamination'), { code: 'OWNERSHIP_AMBIGUOUS' });
  assert.deepEqual(f.domain(), nativeStaged);
  let review = await f.app.ownershipReview(); assert.equal(review.editingTarget, null);
  assert(review.missing.some(item => item.path === 'a.txt' && item.owner === 'a'));
  await assert.rejects(f.app.resolveOwnership({ token: review.token, renames: [{ from: 'a.txt', to: 'moved.txt' }] }));
  assert.deepEqual(f.domain(), nativeStaged, 'Resolving a declaration cannot silently remove native preparation');
  await f.app.baseUnstage(['moved.txt']); assert.equal(f.read('moved.txt'), 'a C disk\n');
  assert.equal(f.git(['ls-files', '--stage']), before.mainIndex);
  // Removing native staging cannot decide the origin of an already ambiguous rename.
  const postUnstageReview = await f.app.ownershipReview(); assert.equal(postUnstageReview.ambiguous, true);
  assert(postUnstageReview.candidates.includes('moved.txt')); assert(postUnstageReview.missing.some(item => item.path === 'a.txt' && item.owner === 'a'));
  assert.equal((await f.app.files()).find(file => file.path === 'moved.txt')!.owner, null);
  const postUnstageStatus = await f.app.status(); assert.equal(postUnstageStatus.safe, false); assert.equal(postUnstageStatus.error?.code, 'OWNERSHIP_AMBIGUOUS');
  await f.reopen(); const reopenedUnstageStatus = await f.app.status(); assert.equal(reopenedUnstageStatus.safe, false); assert.equal(reopenedUnstageStatus.error?.code, 'OWNERSHIP_AMBIGUOUS');
  assert.equal((await f.app.files()).find(file => file.path === 'moved.txt')!.owner, null);
  const reopenedUnstageReview = await f.app.ownershipReview(); assert.equal(reopenedUnstageReview.ambiguous, true); assert(reopenedUnstageReview.candidates.includes('moved.txt'));
  const unresolved = f.domain(), unresolvedRefs = new Map(f.git(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
  const unresolvedJournals = new Set(fs.readdirSync(path.join(f.app.dir, 'transactions')));
  const preserveUnresolved = () => {
    assert.deepEqual(f.domain(), unresolved, 'Every refused operation preserves HEAD, branches, semantic indices and all worktree bytes and modes');
    const afterRefs = new Map(f.git(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
    const retained: unknown[] = [];
    for (const [ref, oid] of unresolvedRefs) assert.equal(afterRefs.get(ref), oid, 'Every previous ref remains at its exact OID');
    for (const [ref, oid] of afterRefs) if (!unresolvedRefs.has(ref)) {
      const match = /^refs\/git-layers\/transactions\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/u.exec(ref); assert(match, 'Only verified conservative journal retention may add refs');
      const [, transaction, layer] = match; assert(!unresolvedJournals.has(transaction!));
      const journal = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'transactions', transaction!, 'journal.json'), 'utf8'));
      assert.equal(journal.id, transaction); assert.equal(journal.state, 'completed'); assert.equal(journal.error?.code, 'OWNERSHIP_AMBIGUOUS');
      assert(journal.recovery.beforeRegistry.layers.some((entry: any) => entry.id === layer)); assert(journal.steps.some((step: any) => step.step === 'failed') && journal.steps.some((step: any) => step.step === 'completed'));
      assert.equal(oid, unresolvedRefs.get('refs/git-layers/state/' + layer)); assert.equal(f.git(['cat-file', '-t', oid]), 'tree'); assert.equal(f.git(['for-each-ref', '--format=%(symref)', ref]), '');
      retained.push({ ref, oid, transaction, layer });
    }
    f.record('verified unresolved unstage refusal and checkpoint retention', { before: [...unresolvedRefs], after: [...afterRefs], retained });
  };
  for (const operation of [() => f.app.baseStage(['moved.txt']), () => f.app.baseCommit('must refuse unresolved native rename after unstage'), () => f.app.commit('b', 'must not claim unresolved rename after unstage'), () => f.app.deactivate('b', { discard: true })]) {
    await assert.rejects(operation(), { code: 'OWNERSHIP_AMBIGUOUS' }); preserveUnresolved();
  }
  assert.equal(f.git(['show', ':base.txt']), 'base B staged'); assert.equal(f.git(['show', ':a.txt'], f.layerIndex('a')), 'a B staged'); assert.equal(f.git(['show', ':b.txt'], f.layerIndex('b')), 'b B staged');
  assert.equal((await f.app.files()).find(file => file.path === 'moved.txt')!.owner, null); assert.equal(f.read('moved.txt'), 'a C disk\n');
  f.record('ambiguous native NEW remains unresolved after unstage and restart', { postUnstageReview, postUnstageStatus, reopenedUnstageStatus, reopenedUnstageReview, unresolved, after: f.domain() });
  review = await f.app.ownershipReview(); const beforeResolution = f.domain();
  await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'a.txt', to: 'moved.txt' }] });
  assert.deepEqual(f.domain(), beforeResolution); assert.equal((await f.app.status()).safe, true);
  await assert.rejects(f.app.baseStage(['moved.txt']), { code: 'OWNERSHIP' });
  // A real observation of presence must revoke the previous absence acknowledgement.
  // Unobserved writes between queries are deliberately not claimed as detectable.
  f.write('a.txt', 'observed reappearance\n'); assert.equal((await f.app.status()).safe, true);
  fs.renameSync(path.join(f.repo, 'a.txt'), path.join(f.repo, 'again.txt'));
  status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, 'OWNERSHIP_AMBIGUOUS');
  review = await f.app.ownershipReview();
  assert(review.missing.some(item => item.path === 'a.txt' && item.owner === 'a'));
  await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'a.txt', to: 'again.txt' }] });
  await f.app.add('a', ['a.txt', 'moved.txt', 'again.txt']); await f.app.commit('a', 'deliberate Layer renames without target');
  assert.equal(f.git(['show', 'layer/a:moved.txt']), 'a C disk'); assert.equal(f.git(['show', 'layer/a:again.txt']), 'observed reappearance');
  assert.equal(f.git(['ls-files', '--stage']), before.mainIndex);
  assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('b')), before.layerIndexes.b); assert.equal(f.read('b.txt'), 'b C disk\n');
  f.write('normal.txt', 'normal base creation\n'); status = await f.app.status(); assert.equal(status.safe, true); assert.equal(status.editingTarget, null);
  assert(!status.layers.some(layer => layer.reservations.includes('normal.txt')));
  await f.app.baseStage(['normal.txt']); assert.equal(f.git(['show', ':normal.txt']), 'normal base creation');
});

test('D01 base ownership claims never override the original user ignore rules during editing', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('b', 'b.txt');
  fs.appendFileSync(f.app.repo.exclude, '\n*.cache\n'); f.write('base.txt', 'base ignored-destination C\n');
  await f.app.target('b'); await f.app.renameFile('base.txt', 'ignored.cache');
  const status = await f.app.status(); assert.equal(status.safe, true);
  assert(!status.layers.find(layer => layer.name === 'b')!.reservations.includes('ignored.cache'));
  const before = f.capture('before refused ignored base staging');
  await assert.rejects(f.app.baseStage(['base.txt', 'ignored.cache']));
  assert.deepEqual(f.domain(), { head: before.head, branch: before.branch, branches: before.branches, mainIndex: before.mainIndex, layerIndexes: before.layerIndexes, files: before.files });
  assert.equal(f.git(['check-ignore', '--no-index', '--', 'ignored.cache']), 'ignored.cache');
  assert.equal(f.read('ignored.cache'), 'base ignored-destination C\n');
  await f.app.target(); assert.equal(f.git(['check-ignore', '--no-index', '--', 'ignored.cache']), 'ignored.cache');
  assert.equal(f.read('ignored.cache'), 'base ignored-destination C\n'); assert.equal(f.git(['ls-files', '--stage']), before.mainIndex);
});

test('D01 stable no-target status and empty recovery preserve the completed journal inventory', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a', 'a.txt');
  f.write('base.txt', 'base B staged\n'); f.git(['add', '--', 'base.txt']);
  f.write('a.txt', 'a B staged\n'); await f.app.add('a', ['a.txt']); f.write('a.txt', 'a C disk\n');
  const before = f.capture('stable no-target before repeated status and recovery');
  const journalDirectory = path.join(f.app.dir, 'transactions');
  const entries = fs.readdirSync(journalDirectory).sort();
  const raw = { main: hash(fs.readFileSync(f.app.repo.index)), a: hash(fs.readFileSync(f.layerIndex('a'))) };
  for (let index = 0; index < 3; index++) {
    await f.reopen(); const status = await f.app.status();
    assert.equal(status.safe, true); assert.equal(status.editingTarget, null);
    assert.deepEqual((await f.app.recover()).recovered, []);
  }
  const after = f.capture('stable no-target after repeated status and recovery');
  assert.deepEqual(fs.readdirSync(journalDirectory).sort(), entries, 'A stable query cannot publish completed no-op journals');
  assert.equal(after.head, before.head); assert.equal(after.branch, before.branch); assert.equal(after.allRefs, before.allRefs);
  assert.equal(after.mainIndex, before.mainIndex); assert.deepEqual(after.layerIndexes, before.layerIndexes); assert.deepEqual(after.files, before.files);
  assert.deepEqual(after.registry, before.registry); assert.deepEqual(after.workspace, before.workspace); assert.equal(after.exclude, before.exclude); assert.deepEqual(after.metadata, before.metadata);
  assert.equal(hash(fs.readFileSync(f.app.repo.index)), raw.main); assert.equal(hash(fs.readFileSync(f.layerIndex('a'))), raw.a);
});

test('D01 no-target observed reappearance survives an external rename before acknowledgement publication', { timeout: 900000 }, async t => {
  const f = await fixture(t); await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt');
  f.write('base.txt', 'base B staged\n'); f.git(['add', '--', 'base.txt']);
  f.write('a.txt', 'a B staged\n'); await f.app.add('a', ['a.txt']); f.write('a.txt', 'a C disk\n'); await f.pendingB();
  fs.renameSync(path.join(f.repo, 'a.txt'), path.join(f.repo, 'first.txt'));
  const firstReview = await f.app.ownershipReview();
  await f.app.resolveOwnership({ token: firstReview.token, renames: [{ from: 'a.txt', to: 'first.txt' }] });
  assert.equal((await f.app.status()).safe, true); await f.reopen();
  const workspace = () => JSON.parse(fs.readFileSync(path.join(f.app.dir, 'workspace.json'), 'utf8'));
  assert(workspace().acknowledgedMissing.includes('a.txt'));
  f.write('a.txt', 'observed reappearance C2\n');
  const before = f.capture('acknowledged absence reappears before the controlled writer');
  const beforeDomain = f.domain(), beforeJournals = new Set(fs.readdirSync(path.join(f.app.dir, 'transactions')));
  const raw = { main: hash(fs.readFileSync(f.app.repo.index)), a: hash(fs.readFileSync(f.layerIndex('a'))), b: hash(fs.readFileSync(f.layerIndex('b'))) };
  const originalBegin = Transaction.begin; let writerFired = false; let writer: { pid: number; renamed: boolean } | undefined;
  Transaction.begin = async (directory, kind, metadata) => {
    if (!writerFired && directory === f.app.dir && kind === 'editing-sync') {
      writerFired = true;
      writer = JSON.parse(execFileSync(process.execPath, ['-e', "const fs=require('node:fs');fs.renameSync(process.argv[1],process.argv[2]);process.stdout.write(JSON.stringify({pid:process.pid,renamed:!fs.existsSync(process.argv[1])&&fs.existsSync(process.argv[2])}));", path.join(f.repo, 'a.txt'), path.join(f.repo, 'again.txt')], { cwd: f.repo, env: process.env, windowsHide: true, encoding: 'utf8', timeout: 60000 }));
      assert(writer?.renamed); assert.notEqual(writer.pid, process.pid);
      f.record('real external writer after query observation and before transaction publication', writer);
    }
    return originalBegin.call(Transaction, directory, kind, metadata);
  };
  t.after(() => { Transaction.begin = originalBegin; });
  let status;
  try { status = await f.app.status(); } finally { Transaction.begin = originalBegin; }
  assert.equal(writerFired, true, 'The real writer must execute, never a silently unarmed barrier');
  assert.equal(status.safe, false); assert.equal(status.error?.code, 'OWNERSHIP_AMBIGUOUS');
  assert(!workspace().acknowledgedMissing.includes('a.txt'), 'An observed reappearance must remain revoked even after the file is gone');
  assert.equal(f.read('first.txt'), 'a C disk\n'); assert.equal(f.read('again.txt'), 'observed reappearance C2\n'); assert(!fs.existsSync(path.join(f.repo, 'a.txt')));
  const expectedDomain = structuredClone(beforeDomain); expectedDomain.files['again.txt'] = expectedDomain.files['a.txt']; delete expectedDomain.files['a.txt'];
  assert.deepEqual(f.domain(), expectedDomain); assert.equal(f.git(['for-each-ref', '--format=%(refname) %(objectname)']), before.allRefs);
  assert.equal(hash(fs.readFileSync(f.app.repo.index)), raw.main); assert.equal(hash(fs.readFileSync(f.layerIndex('a'))), raw.a); assert.equal(hash(fs.readFileSync(f.layerIndex('b'))), raw.b);
  const newJournals = fs.readdirSync(path.join(f.app.dir, 'transactions')).filter(id => !beforeJournals.has(id)); assert.equal(newJournals.length, 1, 'Exactly the real acknowledgement change needs a journal');
  const journal = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'transactions', newJournals[0]!, 'journal.json'), 'utf8'));
  assert.equal(journal.kind, 'editing-sync'); assert.equal(journal.state, 'completed'); assert.equal(journal.error, undefined); assert(journal.recovery.beforeWorkspace.acknowledgedMissing.includes('a.txt'));
  const afterPublicationJournals = fs.readdirSync(path.join(f.app.dir, 'transactions')).sort();
  await f.reopen(); status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, 'OWNERSHIP_AMBIGUOUS'); assert(!workspace().acknowledgedMissing.includes('a.txt')); assert.deepEqual((await f.app.recover()).recovered, []);
  assert.deepEqual(fs.readdirSync(path.join(f.app.dir, 'transactions')).sort(), afterPublicationJournals, 'Repeated diagnosis is read-only after the real revocation');
  assert.equal((await f.app.files()).find(file => file.path === 'again.txt')!.owner, null);
  for (const operation of [() => f.app.baseStage(['again.txt']), () => f.app.baseCommit('must refuse unresolved observed rename'), () => f.app.commit('b', 'foreign origin must refuse'), () => f.app.deactivate('b', { discard: true })]) {
    const priorRefs = new Map(f.git(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
    await assert.rejects(operation(), { code: 'OWNERSHIP_AMBIGUOUS' }); assert.deepEqual(f.domain(), expectedDomain); assert(!workspace().acknowledgedMissing.includes('a.txt'));
    const currentRefs = new Map(f.git(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
    for (const [ref, oid] of priorRefs) assert.equal(currentRefs.get(ref), oid);
    for (const [ref, oid] of currentRefs) if (!priorRefs.has(ref)) {
      const match = /^refs\/git-layers\/transactions\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/u.exec(ref); assert(match);
      const retained = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'transactions', match[1]!, 'journal.json'), 'utf8'));
      assert.equal(retained.state, 'completed'); assert.equal(retained.error?.code, 'OWNERSHIP_AMBIGUOUS'); assert(retained.recovery.beforeRegistry.layers.some((entry: any) => entry.id === match[2])); assert.equal(oid, priorRefs.get('refs/git-layers/state/' + match[2])); assert.equal(f.git(['cat-file', '-t', oid]), 'tree');
    }
  }
  const review = await f.app.ownershipReview(); assert(review.missing.some(entry => entry.path === 'a.txt' && entry.owner === 'a')); assert(review.candidates.includes('again.txt'));
  await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'a.txt', to: 'again.txt' }] }); assert.deepEqual(f.domain(), expectedDomain); assert.equal((await f.app.files()).find(file => file.path === 'again.txt')!.owner, 'a'); assert.equal((await f.app.status()).safe, true);
  f.record('observed revocation remains durable through restart and explicit rename recovery', { writer, journal: newJournals[0], workspace: workspace(), domain: f.domain() });
});

// Regressions for monotonic acknowledgement revocation and recovery.
// The preceding source is preserved byte for byte; fault injection is fixture-local.
type AckFixture = Awaited<ReturnType<typeof fixture>>;
type AckRaw = { sha256: string; bytes: number; mode: number; base64: string };
function ackRaw(file: string): AckRaw {
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
  const bytes = fs.readFileSync(file); return { sha256: hash(bytes), bytes: bytes.length, mode: stat.mode & 0o777, base64: bytes.toString('base64') };
}
function ackWorkspace(f: AckFixture): any { return JSON.parse(fs.readFileSync(path.join(f.app.dir, 'workspace.json'), 'utf8')); }
function ackJournals(f: AckFixture): Map<string, any> {
  const directory = path.join(f.app.dir, 'transactions');
  return new Map(fs.readdirSync(directory).sort().map(id => [id, readJournal(path.join(directory, id, 'journal.json'))]));
}
function ackRefs(f: AckFixture): Map<string, string> { return new Map(f.git(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string])); }
function ackBackupInventory(f: AckFixture): Record<string, unknown> {
  return Object.fromEntries(Object.entries(inventory(path.join(f.app.dir, 'transactions'))).filter(([name]) => /^[^/]+\/backups\//u.test(name)));
}
function ackSnapshot(f: AckFixture, label: string) {
  const state = { domain: f.domain(), refs: [...ackRefs(f)], raw: { main: ackRaw(f.app.repo.index), a: ackRaw(f.layerIndex('a')), b: ackRaw(f.layerIndex('b')) }, workspace: ackRaw(path.join(f.app.dir, 'workspace.json')), registry: ackRaw(path.join(f.app.dir, 'registry.json')), exclude: ackRaw(f.app.repo.exclude), backups: ackBackupInventory(f), journals: [...ackJournals(f).keys()] };
  f.record(label, state); return state;
}
type AckSnapshot = ReturnType<typeof ackSnapshot>;
function ackOnlyRename(before: AckSnapshot, from = 'a.txt', to = 'again.txt'): AckSnapshot['domain'] {
  const expected = structuredClone(before.domain); assert(expected.files[from]); assert(!expected.files[to]); expected.files[to] = expected.files[from]; delete expected.files[from]; return expected;
}
function ackPreserveBackups(f: AckFixture, before: AckSnapshot) {
  const after = ackBackupInventory(f); for (const [file, value] of Object.entries(before.backups)) assert.deepEqual(after[file], value, 'An original backup never changes during observation or recovery');
}
function ackPreserveRefs(f: AckFixture, before: AckSnapshot) {
  const previous = new Map(before.refs), current = ackRefs(f);
  for (const [ref, oid] of previous) assert.equal(current.get(ref), oid, 'Every previously observed ref keeps its OID');
  const retained: unknown[] = [];
  for (const [ref, oid] of current) if (!previous.has(ref)) {
    const match = /^refs\/git-layers\/transactions\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/u.exec(ref); assert(match, 'Only journal-backed conservative checkpoint refs may be new');
    const [, transaction, layer] = match; assert(!before.journals.includes(transaction!));
    const journal = ackJournals(f).get(transaction!); assert(journal); assert.equal(journal.id, transaction); assert.equal(journal.state, 'completed');
    assert(journal.recovery.beforeRegistry.layers.some((entry: any) => entry.id === layer));
    assert.equal(oid, previous.get('refs/git-layers/state/' + layer)); assert.equal(f.git(['cat-file', '-t', oid]), 'tree'); assert.equal(f.git(['for-each-ref', '--format=%(symref)', ref]), '');
    retained.push({ ref, oid, transaction, layer });
  }
  f.record('Verified prior refs and optional conservative checkpoint retention', { before: before.refs, after: [...current], retained });
}
function ackPreserve(f: AckFixture, before: AckSnapshot, expected = before.domain) {
  assert.deepEqual(f.domain(), expected, 'HEAD, branch histories, semantic indices, worktree bytes and modes retain their observed values');
  assert.deepEqual(ackRaw(f.app.repo.index), before.raw.main, 'MAIN B remains byte exact');
  assert.deepEqual(ackRaw(f.layerIndex('a')), before.raw.a, 'Private A index B remains byte exact');
  assert.deepEqual(ackRaw(f.layerIndex('b')), before.raw.b, 'Private B index B remains byte exact');
  ackPreserveRefs(f, before); ackPreserveBackups(f, before);
}
function ackRealRename(f: AckFixture, from = 'a.txt', to = 'again.txt') {
  const root = path.dirname(f.repo), marker = path.join(root, '.git-compat-owned.json');
  const ownership = JSON.parse(fs.readFileSync(marker, 'utf8')); assert.match(ownership.nonce, /^[a-f0-9-]{36}$/u); assert.equal(fs.realpathSync(path.dirname(root)), ownership.parent);
  for (let current = root; ; current = path.dirname(current)) { const stat = fs.lstatSync(current); assert(stat.isDirectory() && !stat.isSymbolicLink()); if (path.dirname(current) === current) break; }
  assert.equal(fs.realpathSync(f.repo), path.join(fs.realpathSync(root), 'repo'));
  const script = "const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const root=fs.realpathSync(process.argv[1]);const from=path.resolve(root,process.argv[2]),to=path.resolve(root,process.argv[3]);for(const p of [from,to]){const r=path.relative(root,p);if(!r||r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw Error('outside fixture');}const s=fs.lstatSync(from);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||fs.existsSync(to))throw Error('unsafe fixture writer');const before=fs.readFileSync(from);fs.renameSync(from,to);const after=fs.readFileSync(to);process.stdout.write(JSON.stringify({pid:process.pid,renamed:!fs.existsSync(from)&&fs.existsSync(to),sha256:crypto.createHash('sha256').update(after).digest('hex'),bytesEqual:before.equals(after),modeBefore:s.mode&511,modeAfter:fs.lstatSync(to).mode&511}));";
  const writer = JSON.parse(execFileSync(process.execPath, ['-e', script, f.repo, from, to], { cwd: f.repo, env: process.env, windowsHide: true, encoding: 'utf8', timeout: 60000 }));
  assert(writer.renamed && writer.bytesEqual); assert.notEqual(writer.pid, process.pid); assert.equal(writer.modeBefore, writer.modeAfter); f.record('Real independent fixture writer', writer); return writer;
}
async function ackScenario(t: TestContext, label: string, run: (f: AckFixture, scoped: TestContext) => Promise<void>) {
  // Multiple subscenarios remain one top-level test and restore process.env separately.
  const cleanups: Array<() => unknown> = [];
  const scoped = { name: t.name + ' [' + label + ']', after: (fn: () => unknown) => { cleanups.push(fn); }, diagnostic: (message: string) => t.diagnostic(message) } as unknown as TestContext;
  try { await run(await fixture(scoped), scoped); } finally { for (const cleanup of cleanups.reverse()) await cleanup(); }
}
async function ackPrepare(f: AckFixture, reappeared = true, nativeNew = false) {
  await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt');
  f.write('base.txt', 'base B staged\n'); f.git(['add', '--', 'base.txt']); f.write('base.txt', 'base C disk\n');
  f.write('a.txt', 'a B staged\n'); await f.app.add('a', ['a.txt']); f.write('a.txt', 'a C disk\n'); await f.pendingB();
  fs.renameSync(path.join(f.repo, 'a.txt'), path.join(f.repo, 'first.txt'));
  const review = await f.app.ownershipReview(); await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'a.txt', to: 'first.txt' }] });
  assert.equal((await f.app.status()).safe, true); await f.reopen(); assert(ackWorkspace(f).acknowledgedMissing.includes('a.txt'));
  if (nativeNew) { f.write('native-new.txt', 'native B staged\n'); f.git(['add', '--', 'native-new.txt']); f.write('native-new.txt', 'native C disk\n'); }
  if (reappeared) f.write('a.txt', 'observed reappearance C2\n');
  assert.equal(f.git(['show', ':base.txt']), 'base B staged'); assert.equal(f.git(['show', ':a.txt'], f.layerIndex('a')), 'a B staged'); assert.equal(f.git(['show', ':b.txt'], f.layerIndex('b')), 'b B staged');
}
function ackNewJournal(f: AckFixture, before: AckSnapshot, kind: string): any {
  const added = [...ackJournals(f)].filter(([id, data]) => !before.journals.includes(id) && data.kind === kind); assert.equal(added.length, 1, 'The selected operation owns exactly one new journal'); return added[0]![1];
}
function ackOriginalWorkspaceBackup(f: AckFixture, journal: any, before: AckSnapshot) {
  const entry = journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')); assert(entry?.backup && entry.before.exists);
  assert.equal(entry.before.hash, before.workspace.sha256); const raw = ackRaw(entry.backup); assert.equal(raw.sha256, before.workspace.sha256); assert.equal(raw.base64, before.workspace.base64);
  assert.deepEqual(JSON.parse(Buffer.from(raw.base64, 'base64').toString('utf8')).acknowledgedMissing, journal.recovery.beforeWorkspace.acknowledgedMissing);
  assert(journal.recovery.beforeWorkspace.acknowledgedMissing.includes('a.txt')); f.record('Original immutable workspace backup', { journal: journal.id, sha256: raw.sha256, bytes: raw.bytes, mode: raw.mode }); return raw;
}
async function ackAmbiguous(f: AckFixture, before: AckSnapshot, expected = ackOnlyRename(before)) {
  await f.reopen(); const status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, 'OWNERSHIP_AMBIGUOUS');
  assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt'), 'Observed presence never regains an old absence acknowledgement');
  const review = await f.app.ownershipReview(); assert(review.missing.some(entry => entry.path === 'a.txt' && entry.owner === 'a')); assert(review.candidates.includes('again.txt')); assert.equal(review.ambiguous, true);
  assert.equal((await f.app.files()).find(file => file.path === 'again.txt')!.owner, null); assert(!status.layers.find(layer => layer.name === 'b')!.reservations.includes('again.txt'));
  ackPreserve(f, before, expected); f.record('Ambiguity remains after reopen', { status, review, workspace: ackWorkspace(f) });
}
function ackOwnTransaction(f: AckFixture, tx: Transaction, kind: string) { return path.dirname(path.dirname(tx.dir)) === f.app.dir && tx.data.kind === kind; }
function ackSyntheticEio(label: string): NodeJS.ErrnoException { return Object.assign(new Error('Synthetic fixture-only persistence failure: ' + label), { code: 'EIO' }); }

test('D01 acknowledgement revocation survives a synthetic finish EIO rollback', { timeout: 900000 }, async t => {
  await ackScenario(t, 'finish-EIO', async (f, scoped) => {
    await ackPrepare(f); const before = ackSnapshot(f, 'before synthetic finish EIO');
    const original = Transaction.prototype.finish; let fired = false;
    Transaction.prototype.finish = async function () {
      if (!fired && ackOwnTransaction(f, this, 'editing-sync')) {
        fired = true; assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt'));
        const durable = readJournal(path.join(this.dir, 'journal.json'));
        assert.deepEqual(durable.recovery.acknowledgements, { revoked: ['a.txt'], pending: [] });
        ackRealRename(f); throw ackSyntheticEio('finish after workspace publication');
      }
      return original.call(this);
    };
    scoped.after(() => { Transaction.prototype.finish = original; });
    let status: Awaited<ReturnType<GitLayers['status']>>;
    try { status = await f.app.status(); } finally { Transaction.prototype.finish = original; }
    assert(fired, 'Synthetic finish barrier must fire'); assert.equal(status.safe, false); assert.equal(status.error?.code, 'EIO');
    const journal = ackNewJournal(f, before, 'editing-sync'); assert.equal(journal.state, 'completed'); assert.equal(journal.error.code, 'EIO');
    assert.deepEqual(journal.recovery.acknowledgements, { revoked: ['a.txt'], pending: [] });
    const backup = ackOriginalWorkspaceBackup(f, journal, before); await ackAmbiguous(f, before);
    assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
    assert.deepEqual((await f.app.recover()).recovered, []); ackPreserve(f, before, ackOnlyRename(before));
  });
});

test('D01 acknowledgement interruption stays ambiguous through recovery and idempotent retry', { timeout: 900000 }, async t => {
  await ackScenario(t, 'pending-injection', async (f, scoped) => {
    await ackPrepare(f); const before = ackSnapshot(f, 'before injected finish interruption');
    const { LabError } = await import('../../src/core/errors.js'); const original = Transaction.prototype.finish; let fired = false;
    Transaction.prototype.finish = async function () {
      if (!fired && ackOwnTransaction(f, this, 'editing-sync')) { fired = true; ackRealRename(f); throw new LabError('INJECTED_FAILURE', 'Fixture-only interruption after observed revocation'); }
      return original.call(this);
    };
    scoped.after(() => { Transaction.prototype.finish = original; });
    let status: Awaited<ReturnType<GitLayers['status']>>;
    try { status = await f.app.status(); } finally { Transaction.prototype.finish = original; }
    assert(fired); assert.equal(status.safe, false); assert.equal(status.error?.code, 'RECOVERY_REQUIRED');
    const journal = ackNewJournal(f, before, 'editing-sync'); assert.notEqual(journal.state, 'completed'); assert.equal(journal.error.code, 'INJECTED_FAILURE');
    assert.deepEqual(journal.recovery.acknowledgements, { revoked: ['a.txt'], pending: [] }); const backup = ackOriginalWorkspaceBackup(f, journal, before);
    ackPreserve(f, before, ackOnlyRename(before)); await f.reopen(); assert.deepEqual((await f.app.recover()).recovered, [journal.id]);
    const after = ackSnapshot(f, 'after first explicit recovery'); assert.deepEqual((await f.app.recover()).recovered, []);
    assert.deepEqual(ackSnapshot(f, 'after idempotent recovery'), after); await ackAmbiguous(f, before);
    assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
    for (const operation of [() => f.app.baseStage(['again.txt']), () => f.app.baseCommit('foreign origin must refuse'), () => f.app.commit('b', 'foreign origin must refuse'), () => f.app.deactivate('b', { discard: true })]) {
      await assert.rejects(operation(), { code: 'OWNERSHIP_AMBIGUOUS' }); ackPreserve(f, before, ackOnlyRename(before)); assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt'));
    }
  });
});

test('D01 acknowledgement revocation in direct base staging survives refusal and reopen', { timeout: 900000 }, async t => {
  await ackScenario(t, 'direct-stage', async (f, scoped) => {
    await ackPrepare(f); const before = ackSnapshot(f, 'before direct base stage acknowledgement observation');
    const internal = f.app as unknown as { completeAcknowledgementObservation: (present: Set<string>) => Promise<void>; workspace: { acknowledgedMissing: string[] } };
    const original = internal.completeAcknowledgementObservation; let fired = false;
    internal.completeAcknowledgementObservation = async function (present) {
      await original.call(this, present);
      if (!fired) { fired = true; assert(present.has('a.txt')); assert(!internal.workspace.acknowledgedMissing.includes('a.txt')); ackRealRename(f); }
    };
    scoped.after(() => { internal.completeAcknowledgementObservation = original; });
    try { await assert.rejects(f.app.baseStage(['base.txt']), { code: 'OWNERSHIP_AMBIGUOUS' }); } finally { internal.completeAcknowledgementObservation = original; }
    assert(fired); const journal = ackNewJournal(f, before, 'stage-base'); assert.equal(journal.state, 'completed'); assert.equal(journal.error.code, 'OWNERSHIP_AMBIGUOUS');
    assert.deepEqual(journal.recovery.acknowledgements, { revoked: ['a.txt'], pending: [] }); ackOriginalWorkspaceBackup(f, journal, before);
    await ackAmbiguous(f, before);
    await assert.rejects(f.app.baseStage(['again.txt']), { code: 'OWNERSHIP_AMBIGUOUS' }); await assert.rejects(f.app.baseCommit('must not launder Layer data after refusal'), { code: 'OWNERSHIP_AMBIGUOUS' });
    ackPreserve(f, before, ackOnlyRename(before)); assert.equal(f.git(['show', 'HEAD:base.txt']), 'base A'); assert.equal(f.read('base.txt'), 'base C disk\n');
  });
});

test('D01 acknowledgement revocation in base unstaging survives refusal and reopen', { timeout: 900000 }, async t => {
  await ackScenario(t, 'direct-unstage', async (f, scoped) => {
    await ackPrepare(f, true, true); const before = ackSnapshot(f, 'before direct base unstage acknowledgement observation');
    const internal = f.app as unknown as { completeAcknowledgementObservation: (present: Set<string>) => Promise<void>; workspace: { acknowledgedMissing: string[] } };
    const original = internal.completeAcknowledgementObservation; let fired = false;
    internal.completeAcknowledgementObservation = async function (present) {
      await original.call(this, present);
      if (!fired) { fired = true; assert(present.has('a.txt')); assert(!internal.workspace.acknowledgedMissing.includes('a.txt')); ackRealRename(f); }
    };
    scoped.after(() => { internal.completeAcknowledgementObservation = original; });
    try { await assert.rejects(f.app.baseUnstage(['native-new.txt']), { code: 'OWNERSHIP_AMBIGUOUS' }); } finally { internal.completeAcknowledgementObservation = original; }
    assert(fired); const journal = ackNewJournal(f, before, 'unstage-base'); assert.equal(journal.state, 'completed'); assert.equal(journal.error.code, 'OWNERSHIP_AMBIGUOUS');
    assert.deepEqual(journal.recovery.acknowledgements, { revoked: ['a.txt'], pending: [] }); ackOriginalWorkspaceBackup(f, journal, before); await ackAmbiguous(f, before);
    assert.equal(f.git(['show', ':native-new.txt']), 'native B staged'); assert.equal(f.read('native-new.txt'), 'native C disk\n');
    assert(!ackWorkspace(f).baseReservations?.includes('native-new.txt')); ackPreserve(f, before, ackOnlyRename(before));
  });
});

test('D01 acknowledgement pending observation survives synthetic completion persistence failure', { timeout: 900000 }, async t => {
  await ackScenario(t, 'pending-durable', async (f, scoped) => {
    await ackPrepare(f); const before = ackSnapshot(f, 'before synthetic completion persistence outage');
    const originalRecord = Transaction.prototype.record, originalFail = Transaction.prototype.fail; let fired = false, failFired = false, selected = '';
    Transaction.prototype.record = async function (step, details) {
      if (!fired && ackOwnTransaction(f, this, 'stage-base') && step === 'acknowledgement-observation-completed') {
        fired = true; selected = this.id; const durable = readJournal(path.join(this.dir, 'journal.json'));
        assert.deepEqual(durable.recovery.acknowledgements, { revoked: [], pending: ['a.txt'] }); assert(durable.steps.some((entry: any) => entry.step === 'acknowledgement-observation-pending'));
        assert(!durable.steps.some((entry: any) => entry.step === 'acknowledgement-observation-completed')); assert.deepEqual(this.data.recovery.acknowledgements, { revoked: ['a.txt'], pending: [] });
        ackRealRename(f); throw ackSyntheticEio('completed observation record unavailable');
      }
      return originalRecord.call(this, step, details);
    };
    Transaction.prototype.fail = async function (error) { if (this.id === selected) { failFired = true; throw ackSyntheticEio('failure record also unavailable'); } return originalFail.call(this, error); };
    scoped.after(() => { Transaction.prototype.record = originalRecord; Transaction.prototype.fail = originalFail; });
    try { await assert.rejects(f.app.baseStage(['base.txt']), { code: 'EIO' }); } finally { Transaction.prototype.record = originalRecord; Transaction.prototype.fail = originalFail; }
    assert(fired && failFired); const journal = ackNewJournal(f, before, 'stage-base'); assert.notEqual(journal.state, 'completed'); assert.deepEqual(journal.recovery.acknowledgements, { revoked: [], pending: ['a.txt'] });
    const backup = ackOriginalWorkspaceBackup(f, journal, before); ackPreserve(f, before, ackOnlyRename(before));
    await f.reopen(); const blocked = await f.app.status(); assert.equal(blocked.safe, false); assert.equal(blocked.error?.code, 'RECOVERY_REQUIRED');
    assert.deepEqual((await f.app.recover()).recovered, [journal.id]); const after = ackSnapshot(f, 'pending authority removed by conservative recovery'); assert.deepEqual((await f.app.recover()).recovered, []); assert.deepEqual(ackSnapshot(f, 'pending recovery retry no-op'), after);
    await ackAmbiguous(f, before); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
    f.record('Synthetic outage qualification', { actualHostEio: false, unavailableRecords: ['acknowledgement-observation-completed', 'failed'], pendingWasDurable: true });
  });
});

test('D01 acknowledgement malformed recovery plans refuse before any write', { timeout: 900000 }, async t => {
  await ackScenario(t, 'malformed-plans', async (f, scoped) => {
    await ackPrepare(f); const before = ackSnapshot(f, 'before validator fixture interruption');
    const { LabError } = await import('../../src/core/errors.js'); const original = Transaction.prototype.finish; let fired = false;
    Transaction.prototype.finish = async function () { if (!fired && ackOwnTransaction(f, this, 'editing-sync')) { fired = true; ackRealRename(f); throw new LabError('INJECTED_FAILURE', 'Fixture-only pending plan for validator checks'); } return original.call(this); };
    scoped.after(() => { Transaction.prototype.finish = original; });
    try { assert.equal((await f.app.status()).safe, false); } finally { Transaction.prototype.finish = original; }
    assert(fired); const journal = ackNewJournal(f, before, 'editing-sync'), file = path.join(f.app.dir, 'transactions', journal.id, 'journal.json'), originalBytes = fs.readFileSync(file);
    const backup = ackOriginalWorkspaceBackup(f, journal, before);
    const poisons: Array<[string, (data: any) => void]> = [
      ['missing required array', data => { delete data.recovery.acknowledgements.pending; }],
      ['array replaced by string', data => { data.recovery.acknowledgements.pending = 'a.txt'; }],
      ['duplicate revoked path', data => { data.recovery.acknowledgements.revoked = ['a.txt', 'a.txt']; }],
      ['overlap pending and revoked', data => { data.recovery.acknowledgements.pending = ['a.txt']; }],
      ['authority not present in before', data => { data.recovery.acknowledgements.revoked = ['base.txt']; }],
      ['path traversal', data => { data.recovery.acknowledgements.revoked = ['../escape']; }],
      ['missing original workspace plan', data => { data.recovery.files = data.recovery.files.filter((item: any) => item.path !== path.join(f.app.dir, 'workspace.json')); }],
    ];
    for (const [label, poison] of poisons) {
      const data = JSON.parse(originalBytes.toString('utf8')); poison(data); writeJournalFixture(file, data);
      const independent = ackSnapshot(f, 'before invalid recovery: ' + label), metadata = inventory(f.app.dir);
      await assert.rejects(f.app.recover(), { code: 'RECOVERY_INVALID' });
      assert.deepEqual(ackSnapshot(f, 'after invalid recovery: ' + label), independent); assert.deepEqual(inventory(f.app.dir), metadata, 'Validation failure precedes every metadata or backup write');
      assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
      // Restore only the deliberately poisoned fixture input after all refusal oracles pass.
      fs.writeFileSync(file, originalBytes); assert.equal(hash(fs.readFileSync(file)), hash(originalBytes));
    }
    assert.deepEqual((await f.app.recover()).recovered, [journal.id]); assert.deepEqual((await f.app.recover()).recovered, []); await ackAmbiguous(f, before);
  });
});

function ackForwardWorkspace(f: AckFixture, journal: any) {
  const workspace = structuredClone(journal.recovery.beforeWorkspace), intent = journal.recovery.acknowledgements;
  const removed = new Set<string>([...intent.revoked, ...intent.pending]);
  if (workspace.acknowledgedMissing) workspace.acknowledgedMissing = workspace.acknowledgedMissing.filter((item: string) => !removed.has(item));
  if (journal.recovery.commit.base) { workspace.schema = 1; workspace.head = journal.recovery.commit.new; workspace.branch = journal.recovery.beforeWorkspace.branch; }
  if (workspace.baseReservations?.length) {
    const committed = new Set(f.git(['ls-tree', '-r', '--name-only', '-z', 'HEAD']).split('\0').filter(Boolean));
    if (workspace.editing) workspace.editing.acceptedBase = [...new Set([...workspace.editing.acceptedBase ?? [], ...workspace.baseReservations.filter((item: string) => committed.has(item))])];
    workspace.baseReservations = workspace.baseReservations.filter((item: string) => !committed.has(item));
  }
  return Buffer.from(JSON.stringify(workspace, null, 2) + '\n', 'utf8');
}
async function ackForwardScenario(t: TestContext, base: boolean, revoked: boolean) {
  await ackScenario(t, (base ? 'base' : 'layer') + (revoked ? '-revoked' : '-empty'), async (f, scoped) => {
    await ackPrepare(f, revoked);
    const workspaceFile = path.join(f.app.dir, 'workspace.json');
    if (!revoked) {
      const original = ackRaw(workspaceFile), parsed = ackWorkspace(f);
      // A valid formatting-only fixture input makes deterministic save bytes distinct.
      fs.writeFileSync(workspaceFile, JSON.stringify(parsed)); await f.reopen();
      assert.deepEqual(ackWorkspace(f), parsed); assert.notEqual(ackRaw(workspaceFile).sha256, original.sha256);
      f.record('Controlled valid workspace formatting, fields unchanged', { before: original, after: ackRaw(workspaceFile), fieldsEqual: true });
    }
    const before = ackSnapshot(f, 'before forward ' + (base ? 'base' : 'layer') + ' commit'), { LabError } = await import('../../src/core/errors.js');
    const originalRecord = Transaction.prototype.record; let fired = false; let advanced: AckSnapshot | undefined;
    Transaction.prototype.record = async function (step, details) {
      await originalRecord.call(this, step, details);
      if (!fired && ackOwnTransaction(f, this, base ? 'commit-base' : 'commit-layer') && step === 'commit-ref-updated') {
        fired = true; assert.deepEqual(this.data.recovery.acknowledgements, { revoked: revoked ? ['a.txt'] : [], pending: [] });
        if (revoked) ackRealRename(f);
        advanced = ackSnapshot(f, 'ref already advanced before injected interruption');
        throw new LabError('INJECTED_FAILURE', 'Fixture-only interruption after published commit ref');
      }
    };
    scoped.after(() => { Transaction.prototype.record = originalRecord; });
    try {
      if (base) await assert.rejects(f.app.baseCommit('deliberate staged base B'), { code: 'INJECTED_FAILURE' });
      else await assert.rejects(f.app.commit('b', 'deliberate staged Layer B'), { code: 'INJECTED_FAILURE' });
    } finally { Transaction.prototype.record = originalRecord; }
    assert(fired && advanced, 'Ref-updated barrier and independent snapshot must execute');
    const journal = ackNewJournal(f, before, base ? 'commit-base' : 'commit-layer'); assert.notEqual(journal.state, 'completed'); assert.equal(journal.error.code, 'INJECTED_FAILURE');
    assert.deepEqual(journal.recovery.acknowledgements, { revoked: revoked ? ['a.txt'] : [], pending: [] });
    const commit = journal.recovery.commit; assert.equal(f.git(['rev-parse', commit.ref]), commit.new); assert.notEqual(commit.new, commit.old);
    const previousRefs = new Map(before.refs), advancedRefs = new Map(advanced.refs);
    for (const [ref, oid] of previousRefs) assert.equal(advancedRefs.get(ref), ref === commit.ref ? commit.new : oid, 'Only the intended previous ref may advance');
    for (const [ref, oid] of advancedRefs) if (!previousRefs.has(ref)) {
      const match = /^refs\/git-layers\/transactions\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/u.exec(ref); assert(match); assert.equal(match[1], journal.id);
      assert(journal.recovery.beforeRegistry.layers.some((entry: any) => entry.id === match[2])); assert.equal(oid, previousRefs.get('refs/git-layers/state/' + match[2])); assert.equal(f.git(['cat-file', '-t', oid]), 'tree'); assert.equal(f.git(['for-each-ref', '--format=%(symref)', ref]), '');
    }
    if (base) { assert.equal(advanced.domain.head, commit.new); assert.equal(f.git(['show', 'HEAD:base.txt']), 'base B staged'); }
    else { assert.equal(advanced.domain.head, before.domain.head); assert.equal(f.git(['show', 'layer/b:b.txt']), 'b B staged'); }
    assert.equal(f.git(['ls-tree', '-r', '--name-only', commit.new]).split('\n').includes('again.txt'), false, 'The published commit contains no interval-renamed foreign file');
    assert.deepEqual(advanced.domain.files, revoked ? ackOnlyRename(before).files : before.domain.files);
    assert.deepEqual(advanced.domain.layerIndexes, before.domain.layerIndexes); assert.equal(advanced.domain.mainIndex, before.domain.mainIndex);
    assert.deepEqual(advanced.raw.a, before.raw.a); assert.deepEqual(advanced.raw.b, before.raw.b); if (!base) assert.deepEqual(advanced.raw.main, before.raw.main);
    const backup = ackOriginalWorkspaceBackup(f, journal, before), expectedWorkspace = ackForwardWorkspace(f, journal);
    const internal = f.app as unknown as { save: () => Promise<void> }, originalSave = internal.save; let saveFired = false;
    internal.save = async function () {
      await originalSave.call(this);
      if (!saveFired) {
        saveFired = true; assert.notEqual(ackJournals(f).get(journal.id).state, 'completed');
        assert(fs.readFileSync(workspaceFile).equals(expectedWorkspace), 'Forward save is the independently reconstructed deterministic image');
        f.record('Synthetic interruption after forward save and before journal completion', { image: ackRaw(workspaceFile), originalBackup: backup, actualHostEio: false });
        throw ackSyntheticEio('forward workspace saved but journal not completed');
      }
    };
    scoped.after(() => { internal.save = originalSave; });
    try { await assert.rejects(f.app.recover(), { code: 'EIO' }); } finally { internal.save = originalSave; }
    assert(saveFired); assert.notEqual(ackJournals(f).get(journal.id).state, 'completed'); assert(fs.readFileSync(workspaceFile).equals(expectedWorkspace));
    ackPreserve(f, advanced); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === workspaceFile).backup), backup);
    const deterministic = fs.readFileSync(workspaceFile); if (!revoked) assert.notEqual(hash(deterministic), backup.sha256, 'Valid formatting-only input makes the saved image differ even without revocation');
    // A byte-distinct, even semantically identical, external image is not an approved CAS image.
    fs.writeFileSync(workspaceFile, Buffer.concat([deterministic, Buffer.from(' ')]));
    const tampered = ackSnapshot(f, 'before unapproved workspace image retry'), tamperedMetadata = inventory(f.app.dir);
    await assert.rejects(f.app.recover(), { code: 'RECOVERY_CONFLICT' });
    assert.deepEqual(ackSnapshot(f, 'after unapproved workspace image refusal'), tampered); assert.deepEqual(inventory(f.app.dir), tamperedMetadata);
    // Restore only this deliberately altered fixture image, after all refusal oracles pass.
    fs.writeFileSync(workspaceFile, deterministic); assert(fs.readFileSync(workspaceFile).equals(expectedWorkspace));
    await f.reopen(); assert.deepEqual((await f.app.recover()).recovered, [journal.id]);
    const recovered = ackSnapshot(f, 'after deterministic forward retry'); assert.deepEqual((await f.app.recover()).recovered, []); assert.deepEqual(ackSnapshot(f, 'after second forward retry is no-op'), recovered);
    ackPreserve(f, advanced); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === workspaceFile).backup), backup);
    if (revoked) await ackAmbiguous(f, advanced, advanced.domain);
    else {
      assert(ackWorkspace(f).acknowledgedMissing.includes('a.txt'), 'An unobserved, still absent origin retains its legitimate acknowledgement');
      const status = await f.app.status(); assert.equal(status.safe, true); assert.equal(status.editingTarget, null); assert.equal((await f.app.ownershipReview()).ambiguous, false);
      ackPreserve(f, advanced);
      f.write('ordinary.txt', 'ordinary deliberate base creation\n'); assert.equal((await f.app.status()).safe, true); assert.equal((await f.app.files()).find(file => file.path === 'ordinary.txt')!.owner, null);
      await f.app.baseStage(['ordinary.txt']); assert.equal(f.git(['show', ':ordinary.txt']), 'ordinary deliberate base creation'); await f.app.baseCommit('ordinary creation remains usable after recovery');
      assert.equal(f.git(['show', 'HEAD:ordinary.txt']), 'ordinary deliberate base creation'); assert(ackWorkspace(f).acknowledgedMissing.includes('a.txt'));
      assert.equal(f.read('first.txt'), 'a C disk\n'); assert.equal(f.read('b.txt'), 'b C disk\n'); assert.equal(f.read('base.txt'), 'base C disk\n');
      assert.deepEqual(ackRaw(f.layerIndex('a')), advanced.raw.a); assert.deepEqual(ackRaw(f.layerIndex('b')), advanced.raw.b); ackPreserveBackups(f, before);
    }
    f.record('Forward recovery subscenario qualification', { base, revoked, countedAsAdditionalTest: false, commit, originalWorkspaceBackupSha256: backup.sha256, deterministicWorkspaceSha256: hash(expectedWorkspace) });
  });
}

test('D01 acknowledgement forward base recovery retries deterministic images with and without revocations', { timeout: 900000 }, async t => {
  await ackForwardScenario(t, true, true); await ackForwardScenario(t, true, false);
});

test('D01 acknowledgement forward layer recovery retries deterministic images with and without revocations', { timeout: 900000 }, async t => {
  await ackForwardScenario(t, false, true); await ackForwardScenario(t, false, false);
});

// Managed publication must retire absence authority before a later disk query.
async function matPrepare(f: AckFixture, inactive: boolean) {
  await ackPrepare(f, false);
  if (inactive) await f.app.deactivate('a', { discard: true }); // Fixture-only deliberate discard; B and MAIN are independent.
  await f.app.target('b');
  assert(ackWorkspace(f).acknowledgedMissing.includes('a.txt')); assert(!fs.existsSync(path.join(f.repo, 'a.txt')));
  assert.equal(f.git(['show', ':base.txt']), 'base B staged'); assert.equal(f.git(['show', ':b.txt'], f.layerIndex('b')), 'b B staged'); assert.equal(f.read('b.txt'), 'b C disk\n');
}
async function matRefuseTransfer(f: AckFixture, published: AckSnapshot) {
  ackRealRename(f); const expected = ackOnlyRename(published);
  await ackAmbiguous(f, published, expected);
  for (const operation of [() => f.app.add('b', ['again.txt']), () => f.app.baseStage(['again.txt']), () => f.app.commit('b', 'foreign materialization must refuse'), () => f.app.deactivate('b', { discard: true })]) {
    await assert.rejects(operation(), { code: 'OWNERSHIP_AMBIGUOUS' }); ackPreserve(f, published, expected); assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt'));
  }
  return expected;
}
async function matDoctorExport(f: AckFixture, label: string) {
  const { doctorRepository, exportRepositoryRecovery } = await import('../../src/core/rescue.js');
  const before = ackSnapshot(f, 'before independent materialization diagnosis/export ' + label), metadata = inventory(f.app.dir);
  const diagnosis = await doctorRepository(f.repo); assert.equal(diagnosis.safe, false, 'Unresolved recovery is diagnosed, never called resolved');
  const destination = path.join(path.dirname(f.repo), 'materialization-recovery-export-' + label);
  const exported = await exportRepositoryRecovery(f.repo, destination); assert.equal(exported.complete, true);
  const manifest = JSON.parse(fs.readFileSync(exported.manifest, 'utf8')); assert.equal(manifest.complete, true);
  for (const journal of ackJournals(f).values()) for (const item of journal.recovery?.files ?? []) if (item.backup) {
    const entry = manifest.entries.find((entry: any) => entry.source === item.backup && entry.type === 'file'); assert(entry, 'Every original transaction backup has an independent exported copy');
    assert.equal(entry.sha256, ackRaw(item.backup).sha256); assert.equal(ackRaw(path.join(exported.destination, ...entry.path.split('/'))).sha256, entry.sha256);
  }
  assert.deepEqual(ackSnapshot(f, 'after independent materialization diagnosis/export ' + label), before); assert.deepEqual(inventory(f.app.dir), metadata);
  f.record('Unresolved materialization recovery has independent diagnosis and export', { label, diagnosis, exported, manifestSha256: hash(fs.readFileSync(exported.manifest)), resolved: false });
}
function matApprovedAbsenceAfterRollback(f: AckFixture, journal: any, before: AckSnapshot) {
  assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt'), 'Rollback cannot restore authority that a managed publication revoked or made uncertain');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8')).layers.find((layer: any) => layer.name === 'a').state, 'inactive');
  assert(!fs.existsSync(path.join(f.repo, 'a.txt'))); ackPreserve(f, before); ackOriginalWorkspaceBackup(f, journal, before);
}

test('D01 materialization activation retires absence authority before a later external rename', { timeout: 900000 }, async t => {
  await ackScenario(t, 'materialization-activation', async f => {
    await matPrepare(f, true); const before = ackSnapshot(f, 'before acknowledged activation');
    await f.app.on('a');
    assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt'), 'Activation retires authority without any intervening status');
    assert.equal(f.read('a.txt'), 'a A\n');
    const journal = ackNewJournal(f, before, 'activate'); assert.equal(journal.state, 'completed'); ackOriginalWorkspaceBackup(f, journal, before);
    const steps = journal.steps.filter((step: any) => /^acknowledgement-materialization-(pending|completed)$/u.test(step.step));
    assert.deepEqual(steps.map((step: any) => [step.step, step.details.path]), [['acknowledgement-materialization-pending', 'a.txt'], ['acknowledgement-materialization-completed', 'a.txt']]);
    const published = ackSnapshot(f, 'after activation before any status or external rename'); const expected = await matRefuseTransfer(f, published);
    const review = await f.app.ownershipReview(); await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'a.txt', to: 'again.txt' }] });
    assert.deepEqual(f.domain(), expected, 'Explicit origin resolution does not stage, commit or rewrite bytes');
    await f.app.add('a', ['a.txt', 'again.txt']); await f.app.commit('a', 'deliberate materialized origin rename');
    assert.equal(f.git(['show', 'layer/a:again.txt']), 'a A'); assert.equal(f.git(['ls-tree', '-r', '--name-only', 'layer/a']), 'again.txt');
    assert.equal(f.git(['rev-parse', 'HEAD']), published.domain.head); assert.equal(f.git(['symbolic-ref', '--short', 'HEAD']), published.domain.branch);
    assert.deepEqual(ackRaw(f.app.repo.index), published.raw.main); assert.deepEqual(ackRaw(f.layerIndex('b')), published.raw.b); assert.equal(f.git(['ls-files', '--stage']), published.domain.mainIndex); assert.equal(f.git(['ls-files', '--stage'], f.layerIndex('b')), published.domain.layerIndexes.b);
    assert.equal(f.git(['rev-parse', 'layer/b']), new Map(published.refs).get('refs/heads/layer/b')); assert.equal(f.read('again.txt'), 'a A\n'); assert.equal(f.read('b.txt'), 'b C disk\n'); assert.equal(f.read('base.txt'), 'base C disk\n');
    ackPreserveBackups(f, before); await f.reopen(); assert.equal((await f.app.status()).safe, true);
  });
});

test('D01 materialization restore write and rename destinations preserve original ownership', { timeout: 900000 }, async t => {
  for (const route of ['restore-index-B', 'write-new-C', 'rename-destination'] as const) await ackScenario(t, route, async f => {
    await matPrepare(f, false); const before = ackSnapshot(f, 'before acknowledged materialization ' + route);
    let expectedBytes: string;
    if (route === 'restore-index-B') { await f.app.restore('a', ['a.txt'], true); expectedBytes = 'a B staged\n'; }
    else if (route === 'write-new-C') { await f.app.writeFile('a.txt', 'managed a C2\n'); expectedBytes = 'managed a C2\n'; }
    else { assert.equal((await f.app.renameFile('first.txt', 'a.txt')).owner, 'a'); expectedBytes = 'a C disk\n'; }
    assert.equal(f.read('a.txt'), expectedBytes); assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt'));
    assert.equal(f.git(['show', ':a.txt'], f.layerIndex('a')), 'a B staged'); assert.deepEqual(ackRaw(f.app.repo.index), before.raw.main); assert.deepEqual(ackRaw(f.layerIndex('a')), before.raw.a); assert.deepEqual(ackRaw(f.layerIndex('b')), before.raw.b);
    const journal = ackNewJournal(f, before, route === 'restore-index-B' ? 'restore' : route === 'write-new-C' ? 'editor-save' : 'file-rename'); ackOriginalWorkspaceBackup(f, journal, before);
    assert(journal.steps.some((step: any) => step.step === 'acknowledgement-materialization-pending' && step.details.path === 'a.txt')); assert(journal.steps.some((step: any) => step.step === 'acknowledgement-materialization-completed' && step.details.path === 'a.txt'));
    const published = ackSnapshot(f, 'published managed ' + route + ' before any status'); await matRefuseTransfer(f, published);
    assert.equal(f.read('again.txt'), expectedBytes); assert.equal(f.read('b.txt'), 'b C disk\n'); assert.equal(f.read('base.txt'), 'base C disk\n');
    const review = await f.app.ownershipReview(), unresolved = f.domain(); await f.app.resolveOwnership({ token: review.token, renames: [{ from: 'a.txt', to: 'again.txt' }] }); assert.deepEqual(f.domain(), unresolved);
    assert.equal((await f.app.files()).find(file => file.path === 'again.txt')!.owner, 'a'); assert.equal((await f.app.status()).safe, true); ackPreserveBackups(f, before);
  });
});

test('D01 materialization interruption preserves revoked authority across recovery', { timeout: 1800000 }, async t => {
  for (const phase of ['pending-durable', 'completed-EIO', 'finish-EIO', 'unproved-physical-gap', 'unproved-physical-gap-renamed', 'first-activation-no-ack'] as const) await ackScenario(t, phase, async (f, scoped) => {
    const firstActivation = phase === 'first-activation-no-ack';
    if (firstActivation) {
      await f.seed('a', 'a.txt'); await f.seed('b', 'b.txt'); await f.app.deactivate('a');
      f.write('base.txt', 'base B staged\n'); f.git(['add', '--', 'base.txt']); f.write('base.txt', 'base C disk\n'); await f.pendingB(); await f.app.target('b');
      assert(!(ackWorkspace(f).acknowledgedMissing ?? []).includes('a.txt')); assert(!fs.existsSync(path.join(f.repo, 'a.txt')));
    } else await matPrepare(f, true);
    const before = ackSnapshot(f, 'before materialization interruption ' + phase), { LabError } = await import('../../src/core/errors.js');
    const physicalGap = phase.startsWith('unproved-physical-gap'), renamedGap = phase === 'unproved-physical-gap-renamed';
    const originalRecord = Transaction.prototype.record, originalFinish = Transaction.prototype.finish, originalFail = Transaction.prototype.fail;
    let fired = false, failFired = false, selected = '';
    Transaction.prototype.record = async function (step, details) {
      const materializationPath = (details as { path?: string } | undefined)?.path;
      if (!fired && ackOwnTransaction(f, this, 'activate') && physicalGap && step === 'write-completed' && materializationPath === path.join(f.repo, 'a.txt')) {
        fired = true; selected = this.id; assert(fs.existsSync(path.join(f.repo, 'a.txt')));
        const durable = readJournal(path.join(this.dir, 'journal.json')), entry = durable.recovery.files.find((item: any) => item.path === path.join(f.repo, 'a.txt'));
        assert.equal(entry.before.exists, false); assert.equal(entry.after, undefined); assert(durable.recovery.acknowledgements.pending.includes('a.txt'));
        throw ackSyntheticEio('fixture-only missing physical publication fingerprint');
      }
      await originalRecord.call(this, step, details);
      if (!fired && ackOwnTransaction(f, this, 'activate') && materializationPath === 'a.txt' && (phase === 'pending-durable' && step === 'acknowledgement-materialization-pending' || phase === 'completed-EIO' && step === 'acknowledgement-materialization-completed')) {
        fired = true; selected = this.id;
        const durable = readJournal(path.join(this.dir, 'journal.json'));
        assert(durable.steps.some((entry: any) => entry.step === step && entry.details.path === 'a.txt'));
        if (phase === 'pending-durable') { assert(!fs.existsSync(path.join(f.repo, 'a.txt'))); assert(durable.recovery.acknowledgements.pending.includes('a.txt')); throw new LabError('INJECTED_FAILURE', 'Fixture-only interruption after durable pending and before publication'); }
        assert.equal(f.read('a.txt'), 'a A\n'); assert(durable.recovery.acknowledgements.revoked.includes('a.txt')); throw ackSyntheticEio('materialization completed durably');
      }
    };
    Transaction.prototype.finish = async function () {
      if (!fired && (phase === 'finish-EIO' || firstActivation) && ackOwnTransaction(f, this, 'activate')) { fired = true; selected = this.id; assert.equal(f.read('a.txt'), 'a A\n'); assert(!(ackWorkspace(f).acknowledgedMissing ?? []).includes('a.txt')); if (firstActivation) throw new LabError('INJECTED_FAILURE', 'Fixture-only first activation interruption without prior absence authority'); throw ackSyntheticEio('activation finish after workspace publication'); }
      return originalFinish.call(this);
    };
    Transaction.prototype.fail = async function (error) { if (physicalGap && this.id === selected) { failFired = true; throw ackSyntheticEio('failure record unavailable in physical gap fixture'); } return originalFail.call(this, error); };
    const restoreHooks = () => { Transaction.prototype.record = originalRecord; Transaction.prototype.finish = originalFinish; Transaction.prototype.fail = originalFail; };
    scoped.after(restoreHooks);
    try { await assert.rejects(f.app.on('a'), { code: phase === 'pending-durable' || firstActivation ? 'INJECTED_FAILURE' : 'EIO' }); } finally { restoreHooks(); }
    assert(fired, 'Every requested materialization failure barrier must execute');
    const journal = ackNewJournal(f, before, 'activate'), workspaceEntry = journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')), entry = journal.recovery.files.find((item: any) => item.path === path.join(f.repo, 'a.txt'));
    const backup = firstActivation ? ackRaw(workspaceEntry.backup) : ackOriginalWorkspaceBackup(f, journal, before);
    if (firstActivation) { assert.equal(backup.sha256, before.workspace.sha256); assert.equal(backup.base64, before.workspace.base64); assert(!(journal.recovery.beforeWorkspace.acknowledgedMissing ?? []).includes('a.txt')); assert.equal(journal.recovery.acknowledgements, undefined); assert.equal(entry.after.exists, true); assert.equal(f.read('a.txt'), 'a A\n'); ackRealRename(f); }
    if (phase === 'pending-durable' || physicalGap || firstActivation) {
      assert.notEqual(journal.state, 'completed'); assert.equal(entry.before.exists, false); if (!firstActivation) { assert.equal(entry.after, undefined); assert(journal.recovery.acknowledgements.pending.includes('a.txt')); }
      if (physicalGap) { assert(failFired); assert.equal(f.read('a.txt'), 'a A\n'); }
      if (renamedGap) ackRealRename(f);
      const absent = phase === 'pending-durable' || renamedGap || firstActivation; assert.equal(fs.existsSync(path.join(f.repo, 'a.txt')), !absent);
      if (renamedGap || firstActivation) assert.equal(f.read('again.txt'), 'a A\n');
      const held = ackSnapshot(f, 'pending or unproved publication remains unresolved ' + phase), metadata = inventory(f.app.dir);
      for (let attempt = 0; attempt < 2; attempt++) {
        await assert.rejects(f.app.recover(), (error: any) => {
          assert.equal(error.code, 'RECOVERY_CONFLICT');
          if (absent) { assert.equal(error.details?.reason, 'workspace-materialization-disappeared'); const proof = error.details.paths.find((item: any) => item.path === 'a.txt'); assert(proof); assert.equal(proof.recordedAfterPresent, firstActivation); assert.equal(proof.afterRecorded, firstActivation); assert.equal(proof.present, false); }
          return true;
        });
        assert.deepEqual(ackSnapshot(f, 'pending materialization preflight refusal ' + phase + ' ' + attempt), held); assert.deepEqual(inventory(f.app.dir), metadata); const afterImage = ackJournals(f).get(journal.id).recovery.files.find((item: any) => item.path === path.join(f.repo, 'a.txt')).after; if (firstActivation) assert.equal(afterImage.exists, true); else assert.equal(afterImage, undefined);
      }
      const blocked = await f.app.status(); assert.equal(blocked.safe, false); assert.equal(blocked.error?.code, 'RECOVERY_REQUIRED');
      for (const operation of [() => f.app.add('b', ['again.txt']), () => f.app.baseStage(['again.txt']), () => f.app.commit('b', 'uncertain publication cannot transfer origin'), () => f.app.deactivate('b', { discard: true })]) await assert.rejects(operation(), { code: 'RECOVERY_REQUIRED' });
      assert.deepEqual(ackSnapshot(f, 'pending materialization blocks all later managed transfer ' + phase), held); assert.deepEqual(inventory(f.app.dir), metadata); assert(!JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8')).layers.find((layer: any) => layer.name === 'b').reservations.includes('again.txt'));
      await matDoctorExport(f, phase); ackPreserve(f, held); ackPreserveBackups(f, before); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
      f.record('V04 conservative pending expectation is based on indistinguishable durable facts', { phase, journal: journal.id, beforeAbsent: true, afterRecorded: firstActivation, currentAbsent: absent, resolved: false, actualHostEio: false, reasonForRevisedPendingOracle: 'A pending-before-publication journal cannot distinguish publication not started from publication followed by external removal before an after fingerprint persisted; uncertainty cannot restore old authority.', notTestFailureWorkaround: true }); return;
    }
    await f.reopen();
    const firstRecovery = await f.app.recover(); assert.deepEqual(firstRecovery.recovered, []);
    const recovered = ackSnapshot(f, 'after materialization rollback/recovery ' + phase); assert.deepEqual((await f.app.recover()).recovered, []); assert.deepEqual(ackSnapshot(f, 'idempotent materialization recovery ' + phase), recovered);
    matApprovedAbsenceAfterRollback(f, journal, before); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
    const inactiveReview = await f.app.ownershipReview(); f.record('Recovered inactive origin review without claiming active Layer ownership', { phase, review: inactiveReview });
    // Retrying activation is deliberate; only then is Layer A again an active owner.
    await f.app.on('a'); assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt')); const published = ackSnapshot(f, 'retried materialization before external rename ' + phase);
    await matRefuseTransfer(f, published); ackPreserveBackups(f, before);
  });
  for (const target of ['capture.json', 'captures-id'] as const) await ackScenario(t, 'metadata-before-absent-' + target, async (f, scoped) => {
    await matPrepare(f, true); const before = ackSnapshot(f, 'before real capture metadata interruption ' + target), { LabError } = await import('../../src/core/errors.js');
    assert(!fs.existsSync(path.join(f.app.dir, 'capture.json'))); const original = Transaction.prototype.record; let fired = false, selectedPath = '';
    Transaction.prototype.record = async function (step, details) {
      await original.call(this, step, details);
      const file = (details as { path?: string } | undefined)?.path;
      const relative = file ? path.relative(f.app.dir, file).split(path.sep).join('/') : '';
      if (!fired && ackOwnTransaction(f, this, 'capture-start') && step === 'backup-ready' && (target === 'capture.json' ? relative === 'capture.json' : /^captures\/[a-f0-9-]{36}\.json$/u.test(relative))) {
        fired = true; selectedPath = file!; assert(!fs.existsSync(selectedPath)); const entry = this.data.recovery.files.find((item: any) => item.path === selectedPath); assert.equal(entry.before.exists, false); assert.equal(entry.backup, null); assert.equal(entry.after, undefined);
        throw new LabError('INJECTED_FAILURE', 'Fixture-only capture metadata interruption after real absent backup and before creation');
      }
    };
    scoped.after(() => { Transaction.prototype.record = original; });
    try { await assert.rejects(f.app.captureStart('b'), { code: 'INJECTED_FAILURE' }); } finally { Transaction.prototype.record = original; }
    assert(fired && selectedPath); const journal = ackNewJournal(f, before, 'capture-start'); assert.notEqual(journal.state, 'completed'); assert(!fs.existsSync(selectedPath));
    const entry = journal.recovery.files.find((item: any) => item.path === selectedPath); assert.equal(entry.before.exists, false); assert.equal(entry.backup, null); assert.equal(entry.after, undefined);
    const workspaceBackup = ackOriginalWorkspaceBackup(f, journal, before);
    await f.reopen(); assert.deepEqual((await f.app.recover()).recovered, [journal.id]); const recovered = ackSnapshot(f, 'approved absent metadata recovery ' + target); assert.deepEqual((await f.app.recover()).recovered, []); assert.deepEqual(ackSnapshot(f, 'approved absent metadata retry ' + target), recovered);
    assert(!fs.existsSync(selectedPath)); assert(!fs.existsSync(path.join(f.app.dir, 'capture.json'))); ackPreserve(f, before); ackPreserveBackups(f, before); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), workspaceBackup);
    assert(ackWorkspace(f).acknowledgedMissing.includes('a.txt'), 'Metadata absence never revokes a legitimate, unobserved workspace acknowledgement');
    f.record('Validated metadata remains excluded by the exact recovery classifier', { target, path: path.relative(f.app.dir, selectedPath).split(path.sep).join('/'), beforeAbsent: true, currentAbsent: true, backupNull: true, recovered: true, journal: journal.id });
  });
});

test('D01 materialization recovery refuses legacy authority beside known bytes', { timeout: 900000 }, async t => {
  for (const physical of ['present', 'recorded-after-present', 'late-disappearance'] as const) await ackScenario(t, physical, async (f, scoped) => {
    await matPrepare(f, true); const before = ackSnapshot(f, 'before legacy materialization fixture ' + physical), { LabError } = await import('../../src/core/errors.js');
    const originalFinish = Transaction.prototype.finish; let fired = false;
    Transaction.prototype.finish = async function () { if (!fired && ackOwnTransaction(f, this, 'activate')) { fired = true; assert.equal(f.read('a.txt'), 'a A\n'); throw new LabError('INJECTED_FAILURE', 'Fixture-only activation journal for legacy authority validation'); } return originalFinish.call(this); };
    scoped.after(() => { Transaction.prototype.finish = originalFinish; });
    try { await assert.rejects(f.app.on('a'), { code: 'INJECTED_FAILURE' }); } finally { Transaction.prototype.finish = originalFinish; }
    assert(fired); const journal = ackNewJournal(f, before, 'activate'), file = path.join(f.app.dir, 'transactions', journal.id, 'journal.json'), originalBytes = fs.readFileSync(file), backup = ackOriginalWorkspaceBackup(f, journal, before);
    assert(journal.recovery.acknowledgements.revoked.includes('a.txt')); assert.equal(journal.recovery.files.find((item: any) => item.path === path.join(f.repo, 'a.txt')).after.exists, true);
    if (physical === 'recorded-after-present') ackRealRename(f);
    const legacy = readJournal(file); delete legacy.recovery.acknowledgements;
    fs.writeFileSync(file, JSON.stringify(legacy, null, 2) + '\n');
    const legacyBefore = ackSnapshot(f, 'before legacy recovery refusal ' + physical), legacyMetadata = inventory(f.app.dir);
    await assert.rejects(f.app.recover(), (error: any) => { assert.equal(error.code, 'RECOVERY_CONFLICT'); assert.equal(error.details?.reason, physical === 'recorded-after-present' ? 'workspace-materialization-disappeared' : 'acknowledged-materialization-without-revocation'); const proof = error.details.paths.find((item: any) => item.path === 'a.txt'); assert(proof); assert.equal(proof.recordedAfterPresent, true); assert.equal(proof.present, physical !== 'recorded-after-present'); return true; });
    assert.deepEqual(ackSnapshot(f, 'after legacy recovery refusal ' + physical), legacyBefore); assert.deepEqual(inventory(f.app.dir), legacyMetadata); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
    await matDoctorExport(f, 'legacy-' + physical);
    // A journal-only mismatch cannot rewrite its immutable original workspace backup.
    const inconsistent = structuredClone(legacy); inconsistent.recovery.beforeWorkspace.acknowledgedMissing = [];
    fs.writeFileSync(file, JSON.stringify(inconsistent, null, 2) + '\n'); const mismatch = ackSnapshot(f, 'before legacy backup mismatch refusal ' + physical), mismatchMetadata = inventory(f.app.dir);
    await assert.rejects(f.app.recover(), { code: 'RECOVERY_INVALID' }); assert.deepEqual(ackSnapshot(f, 'after legacy backup mismatch refusal ' + physical), mismatch); assert.deepEqual(inventory(f.app.dir), mismatchMetadata); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
    // Restore only the deliberately altered journal, after the full refusal oracles passed.
    fs.writeFileSync(file, originalBytes); assert.equal(hash(fs.readFileSync(file)), hash(originalBytes));
    const independent = ackSnapshot(f, 'before resuming original materialization recovery ' + physical); await f.reopen();
    const pendingBlocksTransfer = async (state: AckSnapshot, label: string) => {
      const metadata = inventory(f.app.dir), status = await f.app.status(); assert.equal(status.safe, false); assert.equal(status.error?.code, 'RECOVERY_REQUIRED');
      for (const operation of [() => f.app.add('b', ['again.txt']), () => f.app.baseStage(['again.txt']), () => f.app.commit('b', 'pending recovery cannot transfer origin'), () => f.app.deactivate('b', { discard: true })]) await assert.rejects(operation(), { code: 'RECOVERY_REQUIRED' });
      assert.deepEqual(ackSnapshot(f, label), state); assert.deepEqual(inventory(f.app.dir), metadata); assert.notEqual(ackJournals(f).get(journal.id).state, 'completed');
      assert(!JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8')).layers.find((layer: any) => layer.name === 'b').reservations.includes('again.txt'));
    };
    if (physical === 'recorded-after-present') {
      const metadata = inventory(f.app.dir);
      for (let attempt = 0; attempt < 2; attempt++) {
        await assert.rejects(f.app.recover(), (error: any) => { assert.equal(error.code, 'RECOVERY_CONFLICT'); assert.equal(error.details?.reason, 'workspace-materialization-disappeared'); return true; });
        assert.deepEqual(ackSnapshot(f, 'restored protocol refuses disappeared materialization ' + attempt), independent); assert.deepEqual(inventory(f.app.dir), metadata);
      }
      await pendingBlocksTransfer(independent, 'pending disappeared materialization blocks all managed transfer'); await matDoctorExport(f, 'restored-protocol-disappeared');
      assert.equal(f.read('again.txt'), 'a A\n'); ackPreserve(f, independent); ackPreserveBackups(f, before); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
      f.record('V02 rollback expectation rejected by directed evidence; V03 remains unresolved conservatively', { physical, journal: journal.id, resolved: false, preflightNoWrites: true }); return;
    }
    if (physical === 'late-disappearance') {
      const internal = f.app as unknown as { rollbackRefs: (data: any) => Promise<void> }, originalRollbackRefs = internal.rollbackRefs; let writerFired = false;
      internal.rollbackRefs = async function (data) {
        await originalRollbackRefs.call(this, data);
        if (!writerFired && data.id === journal.id) { writerFired = true; assert.equal(f.read('a.txt'), 'a A\n'); ackRealRename(f); }
      };
      scoped.after(() => { internal.rollbackRefs = originalRollbackRefs; });
      try { await assert.rejects(f.app.recover(), (error: any) => { assert.equal(error.code, 'RECOVERY_CONFLICT'); assert.equal(error.details?.reason, 'workspace-materialization-disappeared'); return true; }); }
      finally { internal.rollbackRefs = originalRollbackRefs; }
      assert(writerFired, 'The real writer runs after rollback preflight and before the physical loop check');
      const partial = ackSnapshot(f, 'late disappearance after some rollback metadata may already be restored'), metadata = inventory(f.app.dir), expected = ackOnlyRename(independent);
      assert.equal(partial.domain.head, expected.head); assert.equal(partial.domain.branch, expected.branch); assert.equal(partial.domain.branches, expected.branches); assert.equal(partial.domain.mainIndex, expected.mainIndex); assert.deepEqual(partial.domain.layerIndexes, expected.layerIndexes); assert.deepEqual(partial.domain.files, expected.files);
      assert.deepEqual(partial.raw, independent.raw); ackPreserveRefs(f, independent); ackPreserveBackups(f, before); assert.equal(hash(fs.readFileSync(file)), hash(originalBytes)); assert.notEqual(ackJournals(f).get(journal.id).state, 'completed');
      const currentWorkspace = ackWorkspace(f), reducedBefore = structuredClone(journal.recovery.beforeWorkspace), removed = new Set([...journal.recovery.acknowledgements.revoked, ...journal.recovery.acknowledgements.pending]);
      reducedBefore.acknowledgedMissing = (reducedBefore.acknowledgedMissing ?? []).filter((item: string) => !removed.has(item));
      f.record('Late refusal does not promise total metadata rollback atomicity', { physical, registryAlreadyOriginalBefore: partial.registry.sha256 === before.registry.sha256, workspaceAlreadyOriginalBefore: partial.workspace.sha256 === before.workspace.sha256, workspaceEqualsBeforeWithoutRevokedAuthority: JSON.stringify(currentWorkspace) === JSON.stringify(reducedBefore), totalNoEffectsClaim: false, journalPending: true });
      await assert.rejects(f.app.recover(), (error: any) => { assert.equal(error.code, 'RECOVERY_CONFLICT'); assert.equal(error.details?.reason, 'workspace-materialization-disappeared'); return true; }); assert.deepEqual(ackSnapshot(f, 'repeat late-refusal preflight writes nothing'), partial); assert.deepEqual(inventory(f.app.dir), metadata);
      await pendingBlocksTransfer(partial, 'late-refusal pending journal blocks all managed transfer'); await matDoctorExport(f, 'late-disappearance'); assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup); return;
    }
    assert.deepEqual((await f.app.recover()).recovered, [journal.id]); assert.deepEqual((await f.app.recover()).recovered, []);
    assert(!ackWorkspace(f).acknowledgedMissing.includes('a.txt')); assert.equal(f.git(['rev-parse', 'HEAD']), independent.domain.head); assert.equal(f.git(['symbolic-ref', '--short', 'HEAD']), independent.domain.branch); assert.equal(f.git(['ls-files', '--stage']), independent.domain.mainIndex); assert.deepEqual(ackRaw(f.app.repo.index), independent.raw.main); assert.deepEqual(ackRaw(f.layerIndex('a')), independent.raw.a); assert.deepEqual(ackRaw(f.layerIndex('b')), independent.raw.b); ackPreserveRefs(f, independent); ackPreserveBackups(f, before);
    assert.equal(f.read('b.txt'), 'b C disk\n'); assert.equal(f.read('base.txt'), 'base C disk\n'); assert(!fs.existsSync(path.join(f.repo, 'a.txt')));
    const registry = JSON.parse(fs.readFileSync(path.join(f.app.dir, 'registry.json'), 'utf8')); assert.equal(registry.layers.find((layer: any) => layer.name === 'a').state, 'inactive');
    const review = await f.app.ownershipReview();
    assert(!review.missing.some(item => item.path === 'a.txt' && item.owner === 'a'), 'An inactive Layer is not falsely asserted to be an active projection owner');
    assert.deepEqual(ackRaw(journal.recovery.files.find((item: any) => item.path === path.join(f.app.dir, 'workspace.json')).backup), backup);
    f.record('Legacy journal restored only after conservative refusal and independent export', { physical, originalJournalSha256: hash(originalBytes), originalBackupSha256: backup.sha256, inactiveOriginReview: review });
  });
});
