import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import test, { type TestContext } from 'node:test';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { GitLayers } from '../../src/core/index.js';
import { atomicJSON, copyRegular, fingerprint, sameFingerprint, Transaction } from '../../src/core/storage.js';
import { comparableFileMode, gitPath } from '../../src/core/platform.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-performance-streaming');
  const previous = { ...process.env }, preserve = previous.GL_STAGE2_PRESERVE_FIXTURES === '1';
  t.after(() => {
    try {
      if (preserve) {
        const stat = fs.lstatSync(owned.root), markerFile = path.join(owned.root, '.git-compat-owned.json');
        assert(stat.isDirectory() && !stat.isSymbolicLink()); assert(!fs.lstatSync(markerFile).isSymbolicLink());
        const marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
        assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
        assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent); assert.equal(path.dirname(fs.realpathSync(owned.root)), owned.parent);
        const receipt = { schema: 1, test: t.name, ...owned, retained: true, policy: 'GL_STAGE2_PRESERVE_FIXTURES=1; retain regardless of test outcome' };
        t.diagnostic(JSON.stringify({ kind: 'retained-performance-fixture', ...receipt }));
        fs.writeFileSync(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
      } else cleanupFixture(owned);
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  });
  const env = isolatedEnvironment(owned.root, officialGit);
  if (preserve) env.GL_STAGE2_PRESERVE_FIXTURES = '1';
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const root = path.join(owned.root, 'repo'); fs.mkdirSync(root);
  const native = (args: string[], index?: string) => cp.execFileSync(officialGit, args, {
    cwd: root, env: { ...process.env, ...(index ? { GIT_INDEX_FILE: index } : {}) },
    encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  }).trimEnd();
  const write = (file: string, bytes: string | Buffer) => {
    const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, bytes);
  };
  const seed = () => { native(['init', '-b', 'main']); write('base.txt', 'base A\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base']); };
  return { owned, root, env, native, write, seed };
}

test('streamed fingerprints and exclusive copies preserve exact binary bytes, physical modes and independent backups', async t => {
  const f = fixture(t), source = path.join(f.root, 'source.bin'), copy = path.join(f.root, 'copy.bin');
  const bytes = Buffer.alloc(3 * 1024 * 1024 + 19);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 17) % 256;
  fs.writeFileSync(source, bytes); fs.chmodSync(source, 0o755);
  const expected = { exists: true, hash: digest(bytes), mode: comparableFileMode(fs.statSync(source).mode) };
  assert.deepEqual(await fingerprint(source), expected);
  assert.deepEqual(await copyRegular(source, copy), expected);
  assertBytesEqual(fs.readFileSync(copy), bytes, 'independent copy'); assert.equal(fs.lstatSync(copy).nlink, 1);
  await assert.rejects(copyRegular(source, copy), { code: 'EEXIST' });
  assertBytesEqual(fs.readFileSync(copy), bytes, 'independent copy');
  const tx = await Transaction.begin(path.join(f.owned.root, 'metadata'), 'independent-backup', {});
  const backup = await tx.backup(source, 'binary'); assert(backup);
  assert.deepEqual(await fingerprint(backup), expected); assert.equal(fs.lstatSync(backup).nlink, 1);
  fs.writeFileSync(source, Buffer.from([7, 8, 9]));
  assertBytesEqual(fs.readFileSync(backup), bytes, 'durable backup'); assertBytesEqual(fs.readFileSync(copy), bytes, 'independent copy');
  assert.deepEqual(await fingerprint(path.join(f.root, 'absent')), { exists: false, hash: '', mode: 0 });
  assert.equal(await tx.backup(path.join(f.root, 'absent'), 'absent'), null);
  await tx.finish();
});

test('100 MiB fingerprint, independent copy and durable backup complete below a 64 MiB payload-memory budget in an owned child', { timeout: 180000 }, async t => {
  const f = fixture(t), source = path.join(f.root, 'large.bin'), size = 100 * 1024 * 1024;
  const chunk = Buffer.alloc(1024 * 1024, 0x5d), hash = createHash('sha256');
  const handle = fs.openSync(source, 'wx');
  try { for (let offset = 0; offset < size; offset += chunk.length) { fs.writeSync(handle, chunk); hash.update(chunk); } fs.fsyncSync(handle); }
  finally { fs.closeSync(handle); }
  const expectedHash = hash.digest('hex');
  const { build } = await import('esbuild'), bundle = path.join(f.owned.root, 'storage.mjs');
  await build({ entryPoints: [path.resolve('src/core/storage.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' });
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import path from 'node:path';
    const { fingerprint, copyRegular, Transaction } = await import(process.argv[1]);
    const root = process.argv[2], expected = process.argv[3], source = path.join(root, 'repo', 'large.bin');
    global.gc();
    const baseline = process.memoryUsage(), peak = { ...baseline };
    function sample() { const current = process.memoryUsage(); for (const key of Object.keys(peak)) peak[key] = Math.max(peak[key], current[key]); }
    const timer = setInterval(sample, 2);
    const observed = await fingerprint(source); sample(); assert.equal(observed.hash, expected);
    const copied = await copyRegular(source, path.join(root, 'copy.bin')); sample(); assert.equal(copied.hash, expected);
    const tx = await Transaction.begin(path.join(root, 'metadata'), 'large-backup', {});
    const backup = await tx.backup(source, 'large'); sample(); assert(backup);
    assert.equal((await fingerprint(backup)).hash, expected); sample(); await tx.finish();
    assert.equal(fs.lstatSync(backup).nlink, 1); assert.equal(fs.lstatSync(path.join(root, 'copy.bin')).nlink, 1);
    clearInterval(timer); sample();
    const payloadPeakDelta = peak.arrayBuffers - baseline.arrayBuffers;
    assert(payloadPeakDelta < 64 * 1024 * 1024, '100 MiB processing must not allocate the payload as a whole: ' + payloadPeakDelta);
    process.stdout.write(JSON.stringify({ bytes: 100 * 1024 * 1024, hash: expected, baseline, peak, payloadPeakDelta }));
  `;
  const child = cp.spawnSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', script, pathToFileURL(bundle).href, f.owned.root, expectedHash], {
    cwd: path.resolve('.'), env: process.env, encoding: 'utf8', windowsHide: true, timeout: 150000, maxBuffer: 1024 * 1024,
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const observed = JSON.parse(child.stdout); assert.equal(observed.bytes, size); assert.equal(observed.hash, expectedHash);
  t.diagnostic(JSON.stringify({ kind: 'bounded-memory-child', ...observed }));
});

// Compound workflows use the full suite's 900-second harness budget. This
// prevents premature fixture cancellation under host load; it is not an SLO.
test('repeated activation preserves committed A, staged B, disk C, main index and independent native history', { timeout: 900000 }, async t => {
  const f = fixture(t); f.seed(); const app = await GitLayers.init(f.root);
  await app.create('a'); await app.on('a'); f.write('layer/data.bin', 'Layer A\n');
  await app.add('a', ['layer/data.bin']); await app.commit('a', 'Layer A');
  const l = (await app.list()).find(layer => layer.name === 'a')!, index = path.join(app.dir, 'indexes', l.id + '.index');
  const head = f.native(['rev-parse', 'HEAD']), ref = f.native(['rev-parse', 'layer/a']);
  f.write('layer/data.bin', 'Layer B staged\n'); await app.add('a', ['layer/data.bin']); f.write('layer/data.bin', 'Layer C disk\n');
  f.write('base.txt', 'base B staged\n'); f.native(['add', '--', 'base.txt']); f.write('base.txt', 'base C disk\n');
  const mainIndex = fs.readFileSync(path.join(f.root, '.git', 'index')), layerIndex = fs.readFileSync(index);
  const stale = await GitLayers.open(f.root); await app.on('a'); await stale.on('a');
  assert.equal(f.native(['rev-parse', 'HEAD']), head); assert.equal(f.native(['rev-parse', 'layer/a']), ref);
  assertBytesEqual(fs.readFileSync(path.join(f.root, '.git', 'index')), mainIndex, 'main index'); assertBytesEqual(fs.readFileSync(index), layerIndex, 'Layer index');
  assert.equal(f.native(['show', 'layer/a:layer/data.bin']), 'Layer A');
  assert.equal(f.native(['show', ':layer/data.bin'], index), 'Layer B staged');
  assert.equal(fs.readFileSync(path.join(f.root, 'layer/data.bin'), 'utf8'), 'Layer C disk\n');
  assert.equal(f.native(['show', ':base.txt']), 'base B staged'); assert.equal(fs.readFileSync(path.join(f.root, 'base.txt'), 'utf8'), 'base C disk\n');
  await app.commit('a', 'only staged Layer B');
  assert.equal(f.native(['show', 'layer/a:layer/data.bin']), 'Layer B staged');
  assert.equal(fs.readFileSync(path.join(f.root, 'layer/data.bin'), 'utf8'), 'Layer C disk\n');
  assert.equal(f.native(['rev-parse', 'HEAD']), head); assertBytesEqual(fs.readFileSync(path.join(f.root, '.git', 'index')), mainIndex, 'main index');
});

test('persistent Core detects fresh native main-index contamination and external Layer refs after grouped discovery', { timeout: 900000 }, async t => {
  const f = fixture(t); f.seed(); const app = await GitLayers.init(f.root);
  await app.create('a'); await app.on('a'); f.write('a.txt', 'Layer A\n'); await app.add('a', ['a.txt']); await app.commit('a', 'Layer A');
  const stale = await GitLayers.open(f.root), layer = (await app.list()).find(l => l.name === 'a')!, index = path.join(app.dir, 'indexes', layer.id + '.index');
  const retained = fs.readFileSync(index), head = f.native(['rev-parse', 'HEAD']);
  f.native(['add', '-f', '--', 'a.txt']); const nativeIndex = fs.readFileSync(path.join(f.root, '.git', 'index'));
  await assert.rejects(stale.on('a'), { code: 'BASE_CONTAMINATED' });
  assertBytesEqual(fs.readFileSync(path.join(f.root, '.git', 'index')), nativeIndex, 'contaminated native index'); assertBytesEqual(fs.readFileSync(index), retained, 'retained Layer index');
  f.native(['restore', '--staged', '--', 'a.txt']);
  const old = f.native(['rev-parse', 'layer/a']), tree = f.native(['rev-parse', 'layer/a^{tree}']);
  const external = f.native(['commit-tree', tree, '-p', old, '-m', 'external native advance']); f.native(['update-ref', 'refs/heads/layer/a', external, old]);
  await assert.rejects(stale.on('a'), { code: 'EXTERNAL_REF' });
  assert.equal(f.native(['rev-parse', 'layer/a']), external); assert.equal(f.native(['rev-parse', 'HEAD']), head);
  assertBytesEqual(fs.readFileSync(index), retained, 'retained Layer index'); assert.equal(fs.readFileSync(path.join(f.root, 'a.txt'), 'utf8'), 'Layer A\n');
});

test('activation refuses a prepared private source changed after its materialization snapshot without publishing altered bytes', { timeout: 900000 }, async t => {
  const f = fixture(t); f.seed();
  const seedIndex = path.join(f.owned.root, 'seed.index'); f.write('a.txt', 'Layer A original\n');
  f.native(['read-tree', '--empty'], seedIndex); f.native(['add', '--', 'a.txt'], seedIndex);
  const tree = f.native(['write-tree'], seedIndex), oid = f.native(['commit-tree', tree, '-m', 'native seed']);
  f.native(['update-ref', 'refs/heads/layer/a', oid]); fs.unlinkSync(path.join(f.root, 'a.txt'));
  const app = await GitLayers.init(f.root); await app.register('a');
  const layer = (await app.list()).find(l => l.name === 'a')!, index = path.join(app.dir, 'indexes', layer.id + '.index');
  const before = { refs: f.native(['for-each-ref']), head: f.native(['rev-parse', 'HEAD']), main: fs.readFileSync(path.join(f.root, '.git', 'index')), private: fs.readFileSync(index) };
  const internal = app as any, original = internal.materialize.bind(app);
  let changedSource: string | undefined;
  internal.materialize = async (selected: any) => {
    const snapshot = await original(selected);
    assert.equal(snapshot.length, 1); assert.equal(snapshot[0].path, 'a.txt');
    changedSource = snapshot[0].source;
    assert.equal(fs.readFileSync(changedSource!, 'utf8'), 'Layer A original\n');
    fs.writeFileSync(changedSource!, 'changed after private snapshot\n');
    return snapshot;
  };
  await assert.rejects(app.on('a'), { code: 'EXTERNAL_EDIT' });
  assert(changedSource); assert.equal(fs.readFileSync(changedSource, 'utf8'), 'changed after private snapshot\n');
  assert.equal(fs.existsSync(path.join(f.root, 'a.txt')), false);
  assert.equal(f.native(['rev-parse', 'HEAD']), before.head); assert.equal(f.native(['for-each-ref']), before.refs);
  assertBytesEqual(fs.readFileSync(path.join(f.root, '.git', 'index')), before.main, 'main index'); assertBytesEqual(fs.readFileSync(index), before.private, 'private index');
  assert.equal(f.native(['show', 'layer/a:a.txt']), 'Layer A original');
  // V05 may conservatively retain this interruption before publication. The
  // test does not weaken or automatically bypass the pending recovery barrier.
  const diagnosis = await app.doctor(); assert.equal(diagnosis.safe, false); assert(diagnosis.transactions.length > 0);
  const exported = await app.exportRecovery(path.join(f.owned.root, 'export'));
  assert.equal(exported.complete, true);
  const manifest = JSON.parse(fs.readFileSync(exported.manifest, 'utf8'));
  const saved = manifest.entries.find((entry: any) => entry.type === 'file' && path.resolve(entry.source) === path.resolve(changedSource!));
  assert(saved); assert.equal(fs.readFileSync(path.join(exported.destination, saved.path), 'utf8'), 'changed after private snapshot\n');
});

test('Layer status and default diff with 1200 indexed paths use bounded argv and preserve staged B versus disk C', { timeout: 180000 }, async t => {
  const f = fixture(t); f.seed();
  // Seed native objects/index first, so this scale test measures the query
  // path and does not turn per-file journal preparation into a fixture cost.
  const app = await GitLayers.init(f.root), index = path.join(f.owned.root, 'seed.index');
  const names = Array.from({ length: 1200 }, (_, i) => 'layer/' + String(i).padStart(4, '0') + '-long-path-for-command-line-scalability.txt');
  for (const file of names) f.write(file, 'A\n');
  f.native(['read-tree', '--empty'], index); f.native(['add', '-f', '--', 'layer'], index);
  const tree = f.native(['write-tree'], index), commit = f.native(['commit-tree', tree, '-m', 'seed large Layer']);
  f.native(['update-ref', 'refs/heads/layer/many', commit]);
  await app.register('many');
  // Seed a coherent active projection with official Git and the actual metadata
  // schema. This setup does not assert or certify Core activation: the earlier
  // 1200-file end-to-end directed run has its own 129.6 s historical receipt,
  // and physical activation at scale remains in the product benchmark.
  // Excluding that bulk journal workload isolates this status/argv regression.
  const l = (await app.list()).find(layer => layer.name === 'many')!, layerIndex = path.join(app.dir, 'indexes', l.id + '.index');
  for (const file of names) fs.unlinkSync(path.join(f.root, file)); fs.rmdirSync(path.join(f.root, 'layer'));
  f.native(['checkout-index', '--all', '--prefix=' + gitPath(f.root) + '/'], layerIndex);
  const registryFile = path.join(app.dir, 'registry.json'), registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
  const registered = registry.layers.find((layer: any) => layer.id === l.id);
  assert.equal(registered.state, 'inactive'); registered.state = 'active';
  await atomicJSON(registryFile, registry);
  const begin = '# >>> Git Layers Lab managed paths >>>', end = '# <<< Git Layers Lab managed paths <<<';
  const oldExclude = fs.readFileSync(app.repo.exclude, 'utf8'), start = oldExclude.indexOf(begin), finish = oldExclude.indexOf(end);
  assert.equal(oldExclude.split(begin).length, oldExclude.split(end).length);
  assert(oldExclude.split(begin).length <= 2);
  const clean = start < 0 ? oldExclude : oldExclude.slice(0, start) + oldExclude.slice(finish + end.length).replace(/^\r?\n/u, '');
  const block = begin + '\n' + names.map(file => '/' + file).join('\n') + '\n' + end;
  fs.writeFileSync(app.repo.exclude, clean + (clean && !clean.endsWith('\n') ? '\n' : '') + block + '\n');
  f.write(names[0]!, 'B staged\n'); f.native(['add', '-f', '--', names[0]!], layerIndex);
  // Updating the alternate index externally also needs its real checkpoint,
  // matching the invariant before the status operation begins.
  const checkpoint = f.native(['write-tree'], layerIndex); f.native(['update-ref', 'refs/git-layers/state/' + l.id, checkpoint]);
  f.write(names[0]!, 'C disk\n'); f.write(names.at(-1)!, 'C last\n');
  const workspaceFile = path.join(app.dir, 'workspace.json'), reservationsFile = path.join(app.dir, 'reservations', l.id + '.json');
  const diskBefore = ['base.txt', ...names].map(file => ({ file, bytes: fs.readFileSync(path.join(f.root, file)) }));
  const before = { head: f.native(['rev-parse', 'HEAD']), refs: f.native(['for-each-ref']), main: fs.readFileSync(app.repo.index), private: fs.readFileSync(layerIndex), registry: fs.readFileSync(registryFile), workspace: fs.readFileSync(workspaceFile), reservations: fs.readFileSync(reservationsFile), exclude: fs.readFileSync(app.repo.exclude) };
  const calls: string[][] = [], original = cp.spawn;
  cp.spawn = function (executable: any, args: any, options: any) {
    if (options?.cwd === f.root && Array.isArray(args) && args.includes('diff')) calls.push([...args]);
    return (original as any).call(this, executable, args, options);
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  let status: Awaited<ReturnType<GitLayers['status']>>, patch = '';
  try { status = await app.status(); patch = await app.diff('many'); } finally { cp.spawn = original; syncBuiltinESMExports(); }
  assert.equal(status!.safe, true, JSON.stringify(status!.error));
  const observed = status!.layers.find(layer => layer.name === 'many')!;
  assert.equal(observed.state, 'active'); assert.equal(status!.base.staged.length, 0); assert.equal(status!.base.unstaged.length, 0); assert.deepEqual(status!.untracked, []);
  assert.deepEqual(observed.staged.map(change => change.path), [names[0]]);
  assert.deepEqual(observed.unstaged.map(change => change.path), [names[0], names.at(-1)]);
  const patchPaths = [...patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gmu)].map(match => { assert.equal(match[1], match[2]); return match[1]; });
  assert.deepEqual(patchPaths, [names[0], names.at(-1)], 'Default Layer diff must include exactly the two changed paths');
  assert.match(patch, /\n-B staged\r?\n\+C disk\r?\n/u); assert.match(patch, /\n-A\r?\n\+C last\r?\n/u);
  assert(calls.some(args => args.includes('--name-status')) && calls.some(args => !args.includes('--name-status') && !args.includes('--cached') && !args.includes('--quiet')), 'Both status and default patch diff must reach official Git');
  assert(calls.every(args => args.join(' ').length < 8000), 'Layer status and default diff must not append all 1200 paths to argv');
  assert.equal(f.native(['show', ':layer/0000-long-path-for-command-line-scalability.txt'], layerIndex), 'B staged');
  assert.equal(fs.readFileSync(path.join(f.root, names[0]!), 'utf8'), 'C disk\n');
  assert.equal(f.native(['show', 'layer/many:layer/0000-long-path-for-command-line-scalability.txt']), 'A');
  assert.equal(f.native(['rev-parse', 'HEAD']), before.head); assert.equal(f.native(['for-each-ref']), before.refs);
  assertBytesEqual(fs.readFileSync(app.repo.index), before.main, 'main index'); assertBytesEqual(fs.readFileSync(layerIndex), before.private, 'private index');
  assertBytesEqual(fs.readFileSync(registryFile), before.registry, 'registry metadata'); assertBytesEqual(fs.readFileSync(app.repo.exclude), before.exclude, 'managed excludes');
  assertBytesEqual(fs.readFileSync(workspaceFile), before.workspace, 'workspace metadata'); assertBytesEqual(fs.readFileSync(reservationsFile), before.reservations, 'Layer reservations metadata');
  for (const entry of diskBefore) assertBytesEqual(fs.readFileSync(path.join(f.root, entry.file)), entry.bytes, 'workspace bytes ' + entry.file);
});
