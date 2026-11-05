import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { assertSupported, discover, gitText } from '../../src/core/git.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();

function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-performance-discovery');
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
  const root = path.join(owned.root, 'repo espaços ação'); fs.mkdirSync(root);
  const native = (args: string[], cwd = root) => cp.execFileSync(officialGit, ['--no-pager', ...args], {
    cwd, env: process.env, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  }).trimEnd();
  const seed = (extra: string[] = []) => {
    native(['init', '-b', 'main', ...extra]);
    fs.writeFileSync(path.join(root, 'base.txt'), 'native base A\n');
    native(['add', '--', 'base.txt']); native(['commit', '-m', 'native base']);
  };
  return { owned, root, env, native, seed };
}

test('grouped discovery agrees with official Git in spaces, Unicode and nested cwd without changing Git state', async t => {
  const f = fixture(t); f.seed();
  const nested = path.join(f.root, 'pasta aninhada'); fs.mkdirSync(nested);
  const before = { head: f.native(['rev-parse', 'HEAD']), refs: f.native(['for-each-ref']), index: fs.readFileSync(path.join(f.root, '.git', 'index')) };
  const expected = {
    root: fs.realpathSync(f.native(['rev-parse', '--show-toplevel'], nested)),
    gitDir: path.resolve(f.native(['rev-parse', '--absolute-git-dir'], nested)),
    commonDir: path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-common-dir'], nested)),
    exclude: path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-path', 'info/exclude'], nested)),
    index: path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-path', 'index'], nested)),
    branch: f.native(['symbolic-ref', '--quiet', '--short', 'HEAD'], nested), head: before.head,
  };
  assert.deepEqual(await discover(nested), expected);
  assert.deepEqual(await discover(f.root), expected);
  await assertSupported(expected);
  assert.equal(f.native(['rev-parse', 'HEAD']), before.head);
  assert.equal(f.native(['for-each-ref']), before.refs);
  assertBytesEqual(fs.readFileSync(expected.index), before.index, 'performance-discovery.test.ts byte preservation');
  assert.equal(fs.readFileSync(path.join(f.root, 'base.txt'), 'utf8'), 'native base A\n');
});

test('grouped discovery follows a real gitfile and separate Git directory through official Git', async t => {
  const f = fixture(t), internal = path.join(f.owned.root, 'metadata espaços ação');
  f.seed(['--separate-git-dir=' + internal]);
  assert.equal(fs.lstatSync(path.join(f.root, '.git')).isFile(), true);
  const discovered = await discover(f.root);
  assert.equal(discovered.gitDir, path.resolve(f.native(['rev-parse', '--absolute-git-dir'])));
  assert.equal(discovered.commonDir, path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-common-dir'])));
  assert.equal(discovered.exclude, path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-path', 'info/exclude'])));
  assert.equal(discovered.index, path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-path', 'index'])));
  assert.equal(discovered.gitDir, internal);
  await assertSupported(discovered);
});

test('grouped discovery preserves unborn and bare refusals and refreshes native HEAD on every call', async t => {
  const f = fixture(t); f.native(['init', '-b', 'main']);
  const unborn = await discover(f.root); assert.equal(unborn.head, '');
  await assert.rejects(assertSupported(unborn), { code: 'UNBORN_HEAD' });
  fs.writeFileSync(path.join(f.root, 'base.txt'), 'first commit\n'); f.native(['add', '--', 'base.txt']); f.native(['commit', '-m', 'first']);
  const first = await discover(f.root); assert.equal(first.head, f.native(['rev-parse', 'HEAD']));
  f.native(['switch', '-c', 'second']); f.native(['commit', '--allow-empty', '-m', 'second']);
  const second = await discover(f.root);
  assert.equal(second.branch, 'second'); assert.equal(second.head, f.native(['rev-parse', 'HEAD'])); assert.notEqual(second.head, first.head);
  const bare = path.join(f.owned.root, 'bare espaços.git'); fs.mkdirSync(bare); f.native(['init', '--bare'], bare);
  await assert.rejects(discover(bare), { code: 'BARE_REPOSITORY' });
});

test('grouped support discovery retains every operation and incomplete-repository sentinel with fresh checks', async t => {
  const f = fixture(t); f.seed(); const repo = await discover(f.root);
  const operations = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG'];
  const incomplete = ['shallow', 'objects/info/alternates', 'info/grafts'];
  for (const name of [...operations, ...incomplete]) {
    await assertSupported(repo);
    const file = path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-path', name]));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const directory = ['rebase-merge', 'rebase-apply', 'sequencer'].includes(name);
    if (directory) fs.mkdirSync(file); else fs.writeFileSync(file, '');
    try {
      await assert.rejects(assertSupported(repo), { code: operations.includes(name) ? 'GIT_OPERATION_IN_PROGRESS' : 'INCOMPLETE_REPOSITORY' }, name);
      assert.equal(fs.existsSync(file), true, 'Refusal preserves ' + name);
    } finally { if (directory) fs.rmdirSync(file); else fs.unlinkSync(file); }
  }
  await assertSupported(repo);
});

test('grouped pure queries expose real hooks in any argument position and never mask active hooks', async t => {
  const f = fixture(t); f.seed();
  // Remove only the synthetic fixture's disabled-hooks setting. No host or
  // repository global configuration is touched.
  const syntheticConfig = f.env.GIT_CONFIG_GLOBAL;
  fs.writeFileSync(syntheticConfig, fs.readFileSync(syntheticConfig, 'utf8').replace(/^ hooksPath = \/dev\/null\r?\n/mu, ''));
  const hooks = path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-path', 'hooks']));
  const attributes = path.resolve(f.native(['rev-parse', '--path-format=absolute', '--git-path', 'info/attributes']));
  const grouped = (await gitText(f.root, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks', '--git-path', 'info/attributes'])).split(/\r?\n/u).map(value => path.resolve(value));
  assert.deepEqual(grouped, [hooks, attributes]);
  const hook = path.join(hooks, 'pre-commit'); fs.mkdirSync(hooks, { recursive: true });
  fs.writeFileSync(hook, '#!/bin/sh\nexit 37\n'); fs.chmodSync(hook, 0o755);
  await assert.rejects(assertSupported(await discover(f.root)), { code: 'HOOKS_UNSUPPORTED' });
  assert.equal(fs.readFileSync(hook, 'utf8'), '#!/bin/sh\nexit 37\n');
  assert.equal(f.native(['rev-parse', 'HEAD:base.txt']), f.native(['hash-object', '--', 'base.txt']));
});
