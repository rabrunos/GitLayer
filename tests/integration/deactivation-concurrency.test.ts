import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const budget = { timeout: 900000 }; // Compound-fixture allowance, not product latency.
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const A = Buffer.from('A committed\n'), LATER = Buffer.from('C written after the observation\n');

function fixtureParent(): string {
  const parent = fs.realpathSync(os.tmpdir());
  for (let cursor = parent; ; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor); assert(stat.isDirectory() && !stat.isSymbolicLink());
    try { fs.lstatSync(path.join(cursor, '.git')); assert.fail('Owned fixture parent must be external to repositories'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(cursor) === cursor) return parent;
  }
}

async function fixture(t: TestContext, names = ['target.txt'], otherOrigin = false) {
  // Keep our own path components short: transaction ref names already contain two UUIDs.
  const owned = createFixture(fixtureParent(), 'do'), previous = { ...process.env };
  let verified = false;
  const events: unknown[] = [];
  t.after(() => {
    try {
      const markerFile = path.join(owned.root, '.git-compat-owned.json'), stat = fs.lstatSync(owned.root);
      assert(stat.isDirectory() && !stat.isSymbolicLink()); assert(!fs.lstatSync(markerFile).isSymbolicLink());
      const marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
      assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
      assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent);
      const retained = previous.GL_STAGE2_PRESERVE_FIXTURES === '1' || !verified;
      const receipt = { schema: 1, test: t.name, ...owned, retained, verified, policy: 'Preserve failures and explicit final-campaign retention; cleanup only verified passing fixtures', events };
      fs.writeFileSync(path.join(owned.root, 'DEACTIVATION-RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
      if (retained) t.diagnostic(JSON.stringify({ kind: 'retained-deactivation-fixture', root: owned.root, nonce: owned.nonce, verified }));
      else cleanupFixture(owned);
    } finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); }
  });
  const env = isolatedEnvironment(owned.root, officialGit);
  if (previous.GL_STAGE2_PRESERVE_FIXTURES === '1') env.GL_STAGE2_PRESERVE_FIXTURES = '1';
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(owned.root, 'r'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string): Buffer => {
    const result = cp.spawnSync(officialGit, args, { cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    const stdout = result.stdout ?? Buffer.alloc(0), stderr = result.stderr ?? Buffer.alloc(0);
    const record = { kind: 'official-git', args, index: index ? path.basename(index) : 'MAIN', code: result.status, signal: result.signal, error: result.error?.message, stdoutBytes: stdout.length, stdoutSHA256: digest(stdout), stderr: stderr.toString().slice(0, 4000) };
    events.push(record); assert.equal(result.status, 0, JSON.stringify(record)); return stdout;
  };
  const write = (name: string, bytes: string | Buffer) => fs.writeFileSync(path.join(repo, name), bytes);
  native(['init', '-b', 'main']); native(['config', 'core.autocrlf', 'false']);
  write('base.txt', 'base A committed\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base fixture']);
  const app = await GitLayers.init(repo);
  const registry = () => JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
  const index = (name: string) => path.join(app.dir, 'indexes', registry().layers.find((layer: any) => layer.name === name).id + '.index');
  await app.create('a'); await app.on('a'); for (const name of names) write(name, A);
  await app.add('a', names); await app.commit('a', 'target A');
  if (otherOrigin) {
    await app.create('b'); await app.on('b'); write('other.txt', 'other A committed\n');
    await app.add('b', ['other.txt']); await app.commit('b', 'other A');
    write('base.txt', 'base B staged\n'); native(['add', '--', 'base.txt']); write('base.txt', 'base C disk\n');
    write('other.txt', 'other B staged\n'); await app.add('b', ['other.txt']); write('other.txt', 'other C disk\n');
  }
  const domain = () => {
    const indices = new Map<string, { bytes: Buffer; semantic: Buffer }>();
    indices.set('MAIN', { bytes: fs.readFileSync(app.repo.index), semantic: native(['ls-files', '--stage', '-z']) });
    for (const layer of registry().layers) indices.set(layer.name, { bytes: fs.readFileSync(index(layer.name)), semantic: native(['ls-files', '--stage', '-z'], index(layer.name)) });
    const refs = new Map(native(['for-each-ref', '--format=%(refname) %(objectname)']).toString().trim().split(/\r?\n/).filter(Boolean).map(line => { const split = line.indexOf(' '); return [line.slice(0, split), line.slice(split + 1)] as const; }));
    const metadata = new Map(['registry.json', 'workspace.json', ...registry().layers.map((layer: any) => 'reservations/' + layer.id + '.json')].map(name => [name, fs.readFileSync(path.join(app.dir, name))] as const));
    metadata.set('info/exclude', fs.readFileSync(app.repo.exclude));
    return { head: native(['rev-parse', 'HEAD']).toString(), branch: native(['symbolic-ref', 'HEAD']).toString(), refs, indices, metadata };
  };
  const unchangedGit = (before: ReturnType<typeof domain>) => {
    const after = domain(); assert.equal(after.head, before.head); assert.equal(after.branch, before.branch);
    for (const [ref, oid] of before.refs) assert.equal(after.refs.get(ref), oid, 'Existing ref is preserved: ' + ref);
    const oldStateOids = new Set([...before.refs].filter(([ref]) => ref.startsWith('refs/git-layers/state/')).map(([, oid]) => oid));
    for (const [ref, oid] of after.refs) if (!before.refs.has(ref)) {
      // A conservative rollback may retain the existing checkpoint under its own
      // transaction ref. That is evidence, not an extra commit or history change.
      assert.match(ref, /^refs\/git-layers\/transactions\/[a-f0-9-]+\/[a-f0-9-]+$/u); assert(oldStateOids.has(oid));
    }
    assert.equal(after.metadata.size, before.metadata.size);
    for (const [name, bytes] of before.metadata) assertBytesEqual(after.metadata.get(name)!, bytes, name + ' ownership metadata');
    assert.equal(after.indices.size, before.indices.size);
    for (const [name, image] of before.indices) {
      const current = after.indices.get(name)!; assert(current);
      assertBytesEqual(current.bytes, image.bytes, name + ' exact index bytes');
      assertBytesEqual(current.semantic, image.semantic, name + ' index entries');
    }
    events.push({ kind: 'preserved-git-domain', head: after.head, refs: [...after.refs], indices: [...after.indices].map(([name, image]) => ({ name, bytes: image.bytes.length, sha256: digest(image.bytes), semanticSha256: digest(image.semantic) })) });
  };
  const active = () => assert.equal(registry().layers.find((layer: any) => layer.name === 'a').state, 'active');
  const record = (label: string, value: unknown) => events.push({ kind: 'observation', label, value });
  return { app, repo, owned, names, native, write, index, registry, domain, unchangedGit, active, record, verified: () => { verified = true; } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type LayerQuery = { name: string };
type Changes = { staged: unknown[]; unstaged: unknown[] };

/** A real external write at a deterministic boundary; official Git is not mocked. */
async function afterChanges(f: Fixture, action: (changes: Changes) => void, operation: () => Promise<unknown>): Promise<void> {
  const internal = f.app as unknown as { changes(layer: LayerQuery): Promise<Changes> }, original = internal.changes;
  let injected = false;
  internal.changes = async function (layer) {
    const changes = await original.call(this, layer);
    if (layer.name === 'a' && !injected) { action(changes); injected = true; f.record('after-real-changes', { staged: changes.staged.length, unstaged: changes.unstaged.length }); }
    return changes;
  };
  try { await assert.rejects(operation(), { code: 'EXTERNAL_EDIT' }); }
  finally { internal.changes = original; }
  assert(injected, 'The real changes() boundary must execute');
}

function observeRemovals(f: Fixture) {
  const internal = f.app as unknown as { remove(file: string, expected?: unknown): Promise<void> }, original = internal.remove, calls: string[] = [];
  internal.remove = async function (file, expected) { calls.push(path.relative(f.repo, file).split(path.sep).join('/')); return original.call(this, file, expected); };
  return { calls, restore: () => { internal.remove = original; } };
}

test('deactivation refuses later C after clean changes and preserves other origins staged B versus disk C', budget, async t => {
  const f = await fixture(t, ['target.txt'], true), before = f.domain();
  await afterChanges(f, changes => {
    assert.equal(changes.staged.length, 0); assert.equal(changes.unstaged.length, 0);
    f.write('target.txt', LATER);
  }, () => f.app.deactivate('a'));
  f.active(); f.unchangedGit(before); assertBytesEqual(fs.readFileSync(path.join(f.repo, 'target.txt')), LATER);
  assertBytesEqual(f.native(['show', 'layer/a:target.txt']), A); assertBytesEqual(f.native(['show', ':target.txt'], f.index('a')), A);
  assertBytesEqual(f.native(['show', 'HEAD:base.txt']), Buffer.from('base A committed\n'));
  assertBytesEqual(f.native(['show', ':base.txt']), Buffer.from('base B staged\n'));
  assertBytesEqual(fs.readFileSync(path.join(f.repo, 'base.txt')), Buffer.from('base C disk\n'));
  assertBytesEqual(f.native(['show', 'layer/b:other.txt']), Buffer.from('other A committed\n'));
  assertBytesEqual(f.native(['show', ':other.txt'], f.index('b')), Buffer.from('other B staged\n'));
  assertBytesEqual(fs.readFileSync(path.join(f.repo, 'other.txt')), Buffer.from('other C disk\n'));
  f.verified();
});

test('deactivation validates the whole two-file plan before its first removal', budget, async t => {
  const f = await fixture(t, ['first.txt', 'second.txt']), before = f.domain(), removals = observeRemovals(f);
  try {
    await afterChanges(f, changes => { assert.equal(changes.staged.length, 0); assert.equal(changes.unstaged.length, 0); f.write('second.txt', LATER); }, () => f.app.deactivate('a'));
  } finally { removals.restore(); }
  assert.deepEqual(removals.calls, [], 'A later edit in the second file must prevent removal of the first');
  f.active(); f.unchangedGit(before);
  assertBytesEqual(fs.readFileSync(path.join(f.repo, 'first.txt')), A); assertBytesEqual(fs.readFileSync(path.join(f.repo, 'second.txt')), LATER);
  f.verified();
});

test('explicit deactivation discard does not adopt edits newer than its captured plan', budget, async t => {
  const f = await fixture(t); f.write('target.txt', 'B explicitly staged\n'); await f.app.add('a', ['target.txt']);
  f.write('target.txt', 'C present when discard was chosen\n'); const before = f.domain();
  await afterChanges(f, changes => { assert(changes.staged.length > 0); assert(changes.unstaged.length > 0); f.write('target.txt', LATER); }, () => f.app.deactivate('a', { discard: true }));
  f.active(); f.unchangedGit(before);
  assertBytesEqual(fs.readFileSync(path.join(f.repo, 'target.txt')), LATER);
  assertBytesEqual(f.native(['show', 'layer/a:target.txt']), A);
  assertBytesEqual(f.native(['show', ':target.txt'], f.index('a')), Buffer.from('B explicitly staged\n'));
  f.verified();
});

test('deactivation rolls back an earlier removal while preserving a later edit during the removal loop', budget, async t => {
  const f = await fixture(t, ['first.txt', 'second.txt']), before = f.domain();
  const internal = f.app as unknown as { remove(file: string, expected?: unknown): Promise<void> }, original = internal.remove;
  let injected = false;
  internal.remove = async function (file, expected) {
    await original.call(this, file, expected);
    if (path.relative(f.repo, file) === 'first.txt' && !injected) {
      assert.equal(fs.existsSync(file), false, 'The first physical removal really completed');
      f.write('second.txt', LATER); injected = true; f.record('after-first-real-removal', { path: 'second.txt', hash: digest(LATER) });
    }
  };
  try { await assert.rejects(f.app.deactivate('a'), { code: 'EXTERNAL_EDIT' }); }
  finally { internal.remove = original; }
  assert(injected); f.active(); f.unchangedGit(before);
  assertBytesEqual(fs.readFileSync(path.join(f.repo, 'first.txt')), A, 'Earlier removal rolled back');
  assertBytesEqual(fs.readFileSync(path.join(f.repo, 'second.txt')), LATER, 'Later C survives rollback');
  f.verified();
});
