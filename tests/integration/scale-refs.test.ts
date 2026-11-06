import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

// The remote is an owned local bare repository. No project/user remote is used.
function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-scale-refs');
  const previous = { ...process.env }, git = resolveGit();
  const env = isolatedEnvironment(owned.root, git);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  t.after(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, previous);
    const marker = JSON.parse(fs.readFileSync(path.join(owned.root, '.git-compat-owned.json'), 'utf8'));
    assert.equal(marker.nonce, owned.nonce);
    assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent);
    fs.writeFileSync(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify({ schema: 1, test: t.name, ...owned, retained: true }) + '\n', { flag: 'wx' });
    t.diagnostic(JSON.stringify({ kind: 'retained-scale-refs-fixture', ...owned }));
  });
  const root = path.join(owned.root, 'repo'); fs.mkdirSync(root);
  const native = (args: string[], index?: string, cwd = root) => cp.execFileSync(git, args, {
    cwd, env: { ...env, ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true,
  }).trimEnd();
  const write = (name: string, text: string) => fs.writeFileSync(path.join(root, name), text);
  native(['init', '-b', 'main']); write('base.txt', 'base A\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base']);
  const seedIndex = path.join(owned.root, 'seed.index');
  const tree = (text: string) => {
    write('layer.txt', text); native(['read-tree', '--empty'], seedIndex); native(['add', '--', 'layer.txt'], seedIndex);
    const result = native(['write-tree'], seedIndex); fs.unlinkSync(path.join(root, 'layer.txt')); return result;
  };
  const commit = (text: string, parent?: string) => native(['commit-tree', tree(text), ...(parent ? ['-p', parent] : []), '-m', 'synthetic layer']);
  return { owned, root, native, write, commit };
}

test('tracking updates and divergence never select a different local Layer commit or synchronize during on/off', { timeout: 900000 }, async t => {
  const f = fixture(t), a = f.commit('Layer A\n'); f.native(['update-ref', 'refs/heads/layer/a', a]);
  const remote = path.join(f.owned.root, 'remote.git'); f.native(['init', '--bare', remote]);
  f.native(['remote', 'add', 'fixture', remote]); f.native(['push', '-u', 'fixture', 'layer/a']);
  const app = await GitLayers.init(f.root); await app.register('a');
  const layer = (await app.list()).find(l => l.name === 'a')!;
  const index = path.join(app.dir, 'indexes', layer.id + '.index');
  const main = fs.readFileSync(path.join(f.root, '.git', 'index')), privateBefore = fs.readFileSync(index);
  const head = f.native(['rev-parse', 'HEAD']);
  // Update the bare ref using objects transported explicitly through native Git.
  const newer = f.commit('Remote newer\n', a); f.native(['push', 'fixture', newer + ':refs/heads/layer/a']);
  f.native(['fetch', 'fixture']);
  assert.equal(f.native(['rev-parse', 'refs/remotes/fixture/layer/a']), newer);
  assert.equal(f.native(['rev-parse', 'refs/heads/layer/a']), a);
  await app.on('a'); assert.equal(fs.readFileSync(path.join(f.root, 'layer.txt'), 'utf8'), 'Layer A\n');
  await app.deactivate('a');
  const divergent = f.commit('Remote divergent\n');
  assert.throws(() => f.native(['push', 'fixture', divergent + ':refs/heads/layer/a']));
  assert.equal(f.native(['rev-parse', 'refs/heads/layer/a'], undefined, remote), newer);
  f.native(['push', 'fixture', divergent + ':refs/heads/divergent-source']);
  // Native update-ref in the owned bare remote models a non-fast-forward tracking update.
  f.native(['update-ref', 'refs/heads/layer/a', divergent, newer], undefined, remote);
  f.native(['fetch', 'fixture']);
  const refs = f.native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes']);
  await app.on('a'); assert.equal(fs.readFileSync(path.join(f.root, 'layer.txt'), 'utf8'), 'Layer A\n');
  assert.equal(f.native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes']), refs);
  assert.equal(f.native(['rev-parse', 'HEAD']), head);
  assert.deepEqual(fs.readFileSync(path.join(f.root, '.git', 'index')), main);
  assert.equal(f.native(['show', ':layer.txt'], index), 'Layer A');
  // write-tree checkpoints may refresh stat; registration bytes are not an oracle after on.
  assert(privateBefore.length > 0);
  await app.deactivate('a');
});

test('reactivation refuses changed local refs and changed private indices, preserving external bytes and staging', { timeout: 900000 }, async t => {
  const f = fixture(t), a = f.commit('Layer A\n'); f.native(['update-ref', 'refs/heads/layer/a', a]);
  const app = await GitLayers.init(f.root); await app.register('a'); await app.on('a'); await app.deactivate('a');
  const stale = await GitLayers.open(f.root), l = (await app.list()).find(layer => layer.name === 'a')!;
  const index = path.join(app.dir, 'indexes', l.id + '.index'), bytes = fs.readFileSync(index);
  const newer = f.commit('Local newer\n', a); f.native(['update-ref', 'refs/heads/layer/a', newer, a]);
  await assert.rejects(stale.on('a'), { code: 'EXTERNAL_REF' });
  assert.equal(fs.existsSync(path.join(f.root, 'layer.txt')), false); assert.deepEqual(fs.readFileSync(index), bytes);
  assert.equal(f.native(['rev-parse', 'layer/a']), newer);
  // Restore only the owned fixture's synthetic ref explicitly to test a distinct boundary.
  f.native(['update-ref', 'refs/heads/layer/a', a, newer]);
  f.write('layer.txt', 'External B staged\n'); f.native(['add', '--', 'layer.txt'], index); fs.unlinkSync(path.join(f.root, 'layer.txt'));
  const external = fs.readFileSync(index);
  await assert.rejects(stale.on('a'), (error: any) => ['EXTERNAL_INDEX', 'INDEX_CHANGED', 'CHECKPOINT_MISMATCH'].includes(error.code));
  assert.deepEqual(fs.readFileSync(index), external); assert.equal(f.native(['show', ':layer.txt'], index), 'External B staged');
  assert.equal(fs.existsSync(path.join(f.root, 'layer.txt')), false); assert.equal(f.native(['rev-parse', 'layer/a']), a);
});

test('conventional reactivation ignores and preserves unknown cache-like data instead of using it as a content authority', { timeout: 900000 }, async t => {
  const f = fixture(t), a = f.commit('Exact Git A\n'); f.native(['update-ref', 'refs/heads/layer/a', a]);
  const app = await GitLayers.init(f.root); await app.register('a');
  // This is deliberately unknown data, not a supported cache format or an invalidation test.
  const unknown = path.join(app.dir, 'unrecognized-projection'), payload = path.join(unknown, 'layer.txt');
  fs.mkdirSync(unknown); fs.writeFileSync(payload, 'Wrong old or incomplete projection\n');
  const manifest = path.join(unknown, 'manifest.json'); fs.writeFileSync(manifest, JSON.stringify({ commit: '0'.repeat(40), complete: false }));
  const before = [fs.readFileSync(payload), fs.readFileSync(manifest)];
  for (let i = 0; i < 2; i++) {
    await app.on('a'); assert.equal(fs.readFileSync(path.join(f.root, 'layer.txt'), 'utf8'), 'Exact Git A\n');
    await app.deactivate('a');
    assert.deepEqual([fs.readFileSync(payload), fs.readFileSync(manifest)], before);
  }
  assert.equal(f.native(['show', 'layer/a:layer.txt']), 'Exact Git A');
});
