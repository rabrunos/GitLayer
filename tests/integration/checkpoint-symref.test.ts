import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { listTransactions } from '../../src/core/storage.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

// Compound correctness budget for real Git, native prepare/abort and recovery.
// No elapsed assertion or performance SLO is implied by this timeout.
const budget = { timeout: 900000 };
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const A = 'committed A\n', B = 'requested B\n', C = 'later C on disk\n';
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function fixture(t: TestContext, activate = true) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-checkpoint-symref');
  const saved = { ...process.env }, preserve = saved.GL_STAGE2_PRESERVE_FIXTURES === '1', executable = resolveGit();
  const env = isolatedEnvironment(owned.root, executable);
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  let passed = false;
  t.after(() => {
    try {
      if (passed && !preserve) cleanupFixture(owned);
      else {
        const marker = JSON.parse(fs.readFileSync(path.join(owned.root, '.git-compat-owned.json'), 'utf8'));
        assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
        assert(!fs.lstatSync(owned.root).isSymbolicLink()); assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent);
        t.diagnostic(JSON.stringify({ retained: true, test: t.name, ...owned }));
      }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, saved);
    }
  });
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string, input?: string) => cp.execFileSync(executable, args, {
    cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, input,
    encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  }).trimEnd();
  const result = (args: string[]) => cp.spawnSync(executable, args, {
    cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8', windowsHide: true,
  });
  native(['init', '-b', 'main']); native(['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(repo, 'base.txt'), 'base A\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base']);
  const seed = path.join(owned.root, 'seed.index'), blob = native(['hash-object', '-w', '--stdin'], undefined, A);
  native(['read-tree', '--empty'], seed); native(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',layer.txt'], seed);
  const tree = native(['write-tree'], seed), oid = native(['commit-tree', tree, '-m', 'native Layer A'], seed);
  native(['update-ref', 'refs/heads/layer/a', oid]);
  const app = await GitLayers.init(repo);
  if (activate) { await app.register('a'); await app.on('a'); }
  const layer = activate ? (await app.list()).find(layer => layer.name === 'a')! : undefined;
  const index = layer ? path.join(app.dir, 'indexes', layer.id + '.index') : '';
  const checkpoint = layer ? 'refs/git-layers/state/' + layer.id : '';
  const target = path.join(repo, 'layer.txt'), tag = 'refs/tags/keep-A';
  const before = {
    head: native(['rev-parse', 'HEAD']), heads: native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']),
    main: fs.readFileSync(app.repo.index), index: index ? fs.readFileSync(index) : null,
    commits: native(['rev-list', '--count', 'HEAD', 'refs/heads/layer/a']), base: fs.readFileSync(path.join(repo, 'base.txt')),
  };
  const unchangedMainAndBranches = () => {
    assert.equal(native(['rev-parse', 'HEAD']), before.head);
    assert.equal(native(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), before.heads);
    assert(fs.readFileSync(app.repo.index).equals(before.main)); assert(fs.readFileSync(path.join(repo, 'base.txt')).equals(before.base));
    assert.equal(native(['rev-parse', 'refs/heads/layer/a']), oid);
    assert.equal(native(['show', 'refs/heads/layer/a:layer.txt']), A.trimEnd());
    assert.equal(native(['rev-list', '--count', 'HEAD', 'refs/heads/layer/a']), before.commits);
  };
  return { owned, repo, native, result, executable, app, layer, index, checkpoint, target, tag, tree, oid, blob, before, unchangedMainAndBranches, success: () => { passed = true; } };
}

function createTag(f: Fixture) {
  f.native(['update-ref', f.tag, f.tree, '']);
  assert.equal(f.native(['rev-parse', f.tag]), f.tree);
  assert.equal(f.native(['cat-file', '-t', f.tag]), 'tree');
}
function aliasToTag(f: Fixture, checkpoint = f.checkpoint) {
  f.native(['symbolic-ref', checkpoint, f.tag]);
  assert.equal(f.native(['symbolic-ref', '--quiet', checkpoint]), f.tag);
  assert.equal(f.native(['rev-parse', checkpoint]), f.tree, 'alias leaves the observed object OID unchanged');
  return fs.readFileSync(path.join(f.repo, '.git', checkpoint));
}
function assertAliasAndTag(f: Fixture, alias: Buffer, checkpoint = f.checkpoint) {
  f.unchangedMainAndBranches(); assert.equal(f.native(['rev-parse', f.tag]), f.tree, 'external tag A must not become B');
  assert.equal(f.native(['symbolic-ref', '--quiet', checkpoint]), f.tag);
  assert(fs.readFileSync(path.join(f.repo, '.git', checkpoint)).equals(alias), 'symbolic checkpoint entry is preserved');
}
async function repeatedAliasRecovery(f: Fixture, alias: Buffer, indexB: Buffer) {
  const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1);
  const data = pending[0], plan = data.recovery.managedIndexPublication; assert(plan?.after && plan.tree);
  assert.equal(plan.checkpoint, f.tree); assert.equal(plan.checkpointPublished, false);
  const entry = data.recovery.files.find((entry: any) => entry.path === f.index); assert(entry?.backup && entry.after);
  assert.equal(f.native(['show', ':layer.txt'], entry.backup), A.trimEnd());
  const backup = fs.readFileSync(entry.backup), journal = path.join(f.app.dir, 'transactions', data.id, 'journal.json'), journalBytes = fs.readFileSync(journal);
  const beforeIdentity = fs.statSync(f.index, { bigint: true }), reopened = await GitLayers.open(f.repo);
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(reopened.recover(), { code: 'RECOVERY_CONFLICT' });
    assertAliasAndTag(f, alias); assert(fs.readFileSync(f.index).equals(indexB));
    const afterIdentity = fs.statSync(f.index, { bigint: true }); assert.equal(afterIdentity.ino, beforeIdentity.ino); assert.equal(afterIdentity.mtimeNs, beforeIdentity.mtimeNs);
    assert.equal(f.native(['show', ':layer.txt'], f.index), B.trimEnd()); assert.equal(fs.readFileSync(f.target, 'utf8'), C);
    assert(fs.readFileSync(journal).equals(journalBytes)); assert(fs.readFileSync(entry.backup).equals(backup));
    assert.equal((await listTransactions(f.app.dir)).length, 1);
  }
  assert.equal((await reopened.status()).safe, false, 'an unresolved symbolic checkpoint must not appear healthy');
}

test('preexisting checkpoint symref with unchanged OID is refused by guard before staging effects', budget, async t => {
  const f = await fixture(t); createTag(f); const alias = aliasToTag(f);
  fs.writeFileSync(f.target, B);
  const transactions = fs.readdirSync(path.join(f.app.dir, 'transactions')).sort();
  await assert.rejects(f.app.add('a', ['layer.txt']), { code: 'EXTERNAL_REF' });
  assertAliasAndTag(f, alias); assert(fs.readFileSync(f.index).equals(f.before.index!));
  assert.equal(f.native(['show', ':layer.txt'], f.index), A.trimEnd()); assert.equal(fs.readFileSync(f.target, 'utf8'), B);
  assert.deepEqual(fs.readdirSync(path.join(f.app.dir, 'transactions')).sort(), transactions, 'guard failure does not start a transaction');
  f.success();
});

test('symbolic alias before checkpoint publisher preserves tag A, staged B and later disk C', budget, async t => {
  const f = await fixture(t); createTag(f); fs.writeFileSync(f.target, B);
  const prototype = GitLayers.prototype as any, original = prototype.checkpointTree; let alias: Buffer | undefined, indexB: Buffer | undefined;
  prototype.checkpointTree = async function (...args: any[]) {
    if (this.dir === f.app.dir && this.tx?.data.kind === 'stage' && !alias) {
      assert.equal(f.native(['show', ':layer.txt'], f.index), B.trimEnd()); indexB = fs.readFileSync(f.index);
      fs.writeFileSync(f.target, C); alias = aliasToTag(f);
    }
    return original.apply(this, args);
  };
  try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: 'EXTERNAL_REF' }); } finally { prototype.checkpointTree = original; }
  assert(alias && indexB); assertAliasAndTag(f, alias); assert(fs.readFileSync(f.index).equals(indexB));
  await repeatedAliasRecovery(f, alias, indexB); f.success();
});

test('alias at real native prepare input is refused without replacing alias or redirecting external tag', budget, async t => {
  const f = await fixture(t); createTag(f); fs.writeFileSync(f.target, B);
  const spawn = cp.spawn; let alias: Buffer | undefined, indexB: Buffer | undefined, hookError: unknown;
  const observations: { input: string; stdout: string; matched: boolean }[] = [];
  cp.spawn = function (...args: Parameters<typeof cp.spawn>): ReturnType<typeof cp.spawn> {
    const argv = args[1] as string[] | undefined, options = args[2] as { cwd?: string } | undefined;
    const child = (spawn as any)(...args);
    if (options?.cwd === f.repo && argv?.includes('update-ref') && argv.includes('--no-deref') && argv.includes('--stdin')) {
      const observed = { input: '', stdout: '', matched: false }; observations.push(observed);
      child.stdout.prependListener('data', (chunk: Buffer) => { observed.stdout += chunk.toString('utf8'); });
      const write = child.stdin.write.bind(child.stdin);
      child.stdin.write = function (chunk: any, ...rest: any[]) {
        observed.input += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        if (!alias && observed.input.includes('update ' + f.checkpoint + ' ') && /(?:^|\n)prepare(?:\n|$)/u.test(observed.input)) {
          try {
            assert.equal(path.resolve(String(args[0])).toLowerCase(), path.resolve(f.executable).toLowerCase());
            assert.equal(fs.existsSync(path.join(f.repo, '.git', f.checkpoint + '.lock')), false, 'inject native writer before forwarding prepare, not through a held lock');
            assert.equal(f.native(['show', ':layer.txt'], f.index), B.trimEnd()); indexB = fs.readFileSync(f.index);
            fs.writeFileSync(f.target, C); alias = aliasToTag(f); observed.matched = true;
          } catch (error) { hookError = error; }
        }
        return write(chunk, ...rest); // Real input/output and native lock semantics are never mocked.
      };
    }
    return child;
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: 'EXTERNAL_REF' }); }
  finally { cp.spawn = spawn; syncBuiltinESMExports(); }
  assert.ifError(hookError); assert(alias && indexB); const matched = observations.filter(row => row.matched); assert.equal(matched.length, 1);
  assert(/(?:^|\n)prepare: ok(?:\n|$)/u.test(matched[0]!.stdout), 'real Git acknowledged its prepared transaction');
  assert(/(?:^|\n)abort: ok(?:\n|$)/u.test(matched[0]!.stdout), 'real Git aborted rather than committing a direct B over the alias');
  assert.equal(fs.existsSync(path.join(f.repo, '.git', f.checkpoint + '.lock')), false, 'own aborted checkpoint lock is released');
  assertAliasAndTag(f, alias); await repeatedAliasRecovery(f, alias, indexB);
  t.diagnostic(JSON.stringify({ realPrepareAcknowledged: true, realAbortAcknowledged: true, aliasPreserved: true, tagA: f.tree })); f.success();
});

test('an external checkpoint alias appearing before recovery blocks restoration without changing refs or B/C', budget, async t => {
  const f = await fixture(t); createTag(f); fs.writeFileSync(f.target, B);
  const previous = process.env.GIT_LAYERS_FAILPOINT; process.env.GIT_LAYERS_FAILPOINT = 'after-stage-index';
  try { await assert.rejects(f.app.add('a', ['layer.txt']), { code: 'INJECTED_FAILURE' }); }
  finally { if (previous === undefined) delete process.env.GIT_LAYERS_FAILPOINT; else process.env.GIT_LAYERS_FAILPOINT = previous; }
  assert.equal(f.native(['show', ':layer.txt'], f.index), B.trimEnd()); const indexB = fs.readFileSync(f.index);
  fs.writeFileSync(f.target, C); const alias = aliasToTag(f);
  await repeatedAliasRecovery(f, alias, indexB); f.success();
});

test('expected-zero initial checkpoint preserves a newly injected dangling symbolic alias', budget, async t => {
  const f = await fixture(t, false), prototype = GitLayers.prototype as any, original = prototype.checkpointTree;
  const missing = 'refs/tags/not-created-by-layer'; let checkpoint: string | undefined, alias: Buffer | undefined;
  prototype.checkpointTree = async function (...args: any[]) {
    if (this.dir === f.app.dir && this.tx?.data.kind === 'register' && !checkpoint) {
      const [layer, tree, old] = args; assert.equal(tree, f.tree); assert.equal(old, ''); checkpoint = 'refs/git-layers/state/' + layer.id;
      assert.equal(f.result(['show-ref', '--verify', '--quiet', missing]).status, 1);
      f.native(['symbolic-ref', checkpoint, missing]); assert.equal(f.native(['symbolic-ref', '--quiet', checkpoint]), missing);
      alias = fs.readFileSync(path.join(f.repo, '.git', checkpoint));
    }
    return original.apply(this, args);
  };
  try {
    await assert.rejects(f.app.register('a'), (error: any) => error.code === 'EXTERNAL_REF' || error.code === 'GIT_FAILED' && error.details?.code === 128);
  } finally { prototype.checkpointTree = original; }
  assert(checkpoint && alias); f.unchangedMainAndBranches();
  assert.equal(f.native(['symbolic-ref', '--quiet', checkpoint]), missing); assert(fs.readFileSync(path.join(f.repo, '.git', checkpoint)).equals(alias));
  assert.equal(f.result(['show-ref', '--verify', '--quiet', missing]).status, 1, 'the alias target must not be created');
  assert.equal(fs.existsSync(f.target), false); f.success();
});