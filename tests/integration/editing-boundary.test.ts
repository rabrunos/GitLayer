import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test, { type TestContext } from 'node:test';
import { captureEditingBoundary } from '../../src/core/editing-boundary.js';
import { discover } from '../../src/core/git.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const evidenceRoot = process.env.GL_EDITING_BOUNDARY_EVIDENCE;
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const BEGIN = '# >>> Git Layers Lab managed paths >>>';
const END = '# <<< Git Layers Lab managed paths <<<';

async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-editing-boundary');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo');
  fs.mkdirSync(repo);
  const commands: unknown[] = [], observations: unknown[] = [];
  const git = (...args: string[]): string => {
    try {
      const stdout = cp.execFileSync(officialGit, args, { cwd: repo, env, encoding: 'utf8', windowsHide: true });
      commands.push({ executable: officialGit, args, code: 0, stdout });
      return stdout.trimEnd();
    } catch (error: any) {
      commands.push({ executable: officialGit, args, code: error.status, stdout: String(error.stdout), stderr: String(error.stderr) });
      throw error;
    }
  };
  const write = (file: string, bytes: string) => {
    const destination = path.join(repo, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes);
  };
  git('init', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  git('config', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null');
  write('base.txt', 'tracked base sentinel\n'); git('add', '--', 'base.txt'); git('commit', '-m', 'base');
  const info = await discover(repo), exclude = info.exclude;
  const userExclude = () => {
    const text = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
    return Promise.resolve(text.includes(BEGIN) ? text.slice(0, text.indexOf(BEGIN)) + text.slice(text.indexOf(END) + END.length).replace(/^\r?\n/u, '') : text);
  };
  const owners = async () => new Map(
    [...new Set([...git('ls-tree', '-r', '-z', '--name-only', 'HEAD').split('\0'), ...git('ls-files', '-z').split('\0')].filter(Boolean))]
      .map(file => [file, 'base'] as const),
  );
  const stable = () => ({
    head: git('rev-parse', 'HEAD'), symbolic: git('symbolic-ref', 'HEAD'),
    refs: git('for-each-ref', '--format=%(refname) %(objectname)'),
    index: hash(fs.readFileSync(info.index)), semanticIndex: git('ls-files', '--stage'),
    exclude: fs.existsSync(exclude) ? hash(fs.readFileSync(exclude)) : null,
  });
  const record = (label: string, value: unknown) => observations.push({ label, value });
  const externalWrite = (file: string, bytes: string) => {
    const destination = path.isAbsolute(file) ? file : path.join(repo, file);
    const script = "require('node:fs').writeFileSync(process.argv[1], process.argv[2])";
    const result = cp.spawnSync(process.execPath, ['-e', script, destination, bytes], { cwd: repo, env, encoding: 'utf8', windowsHide: true });
    commands.push({ executable: process.execPath, args: ['-e', script, destination, bytes], code: result.status, stderr: result.stderr });
    assert.equal(result.status, 0, result.stderr);
  };
  t.after(() => {
    try {
      if (evidenceRoot) {
        fs.mkdirSync(evidenceRoot, { recursive: true });
        fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/gu, '_') + '.json'),
          JSON.stringify({ test: t.name, fixture: owned.root, officialGit, version: git('--version'), commands, observations }, null, 2) + '\n');
      }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
      if (!evidenceRoot) cleanupFixture(owned);
    }
  });
  return { repo, info, env, write, git, exclude, userExclude, owners, stable, record, externalWrite,
    capture: (maxAttempts?: number) => captureEditingBoundary(info, { readOwners: owners, readUserExclude: userExclude, maxAttempts }) };
}

/** Test-only scheduling barrier; delegates all native calls and restores spawn. */
async function atNativeIgnore<T>(repo: string, action: (invocation: number) => void, fn: () => Promise<T>): Promise<{ value: T; invocations: number }> {
  const original = cp.spawn;
  let invocations = 0;
  cp.spawn = function (executable: any, args: any, options: any) {
    if (options?.cwd === repo && Array.isArray(args) && args.includes('ls-files') && args.includes('--others')) action(++invocations);
    return (original as any).call(this, executable, args, options);
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  try { return { value: await fn(), invocations }; }
  finally { cp.spawn = original; syncBuiltinESMExports(); }
}

test('D02 boundary matches native ignore precedence and preserves repository state', { timeout: 900000 }, async t => {
  const f = await fixture(t);
  f.write('.gitignore', '*.tmp\n!allow.tmp\n'); f.git('add', '--', '.gitignore'); f.git('commit', '-m', 'ignore');
  fs.appendFileSync(f.exclude, '\n*.secret\n');
  const globalFile = path.join(f.env.HOME!, 'boundary-ignore');
  fs.writeFileSync(globalFile, '*.global\n'); f.git('config', 'core.excludesFile', globalFile);
  for (const file of ['old.txt', 'private.secret', 'build.tmp', 'allow.tmp', 'global.global']) f.write(file, file + '\n');
  Object.assign(f.info, await discover(f.repo));
  const expected = f.git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean).sort();
  const before = f.stable(), boundary = await f.capture(); await boundary.revalidate();
  f.record('native and boundary', { expected, before: boundary.before, unassigned: boundary.unassigned, stable: f.stable() });
  assert.deepEqual(boundary.unassigned, expected);
  assert(boundary.before.includes('private.secret'));
  assert.deepEqual(f.stable(), before);
});

test('D02 creation between walk and native ignore is retried as one coherent boundary', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'existing candidate\n');
  const before = f.stable();
  const result = await atNativeIgnore(f.repo, invocation => {
    if (invocation === 1) f.externalWrite('between.txt', 'external boundary bytes\n');
  }, () => f.capture());
  await result.value.revalidate();
  f.record('interleaving', { invocations: result.invocations, before: result.value.before, unassigned: result.value.unassigned });
  assert(result.invocations >= 2);
  assert(result.value.before.includes('between.txt'));
  assert(result.value.unassigned.includes('between.txt'));
  assert.deepEqual(f.stable(), before);
  assert.equal(fs.readFileSync(path.join(f.repo, 'between.txt'), 'utf8'), 'external boundary bytes\n');
});

test('D02 continuous external creation is refused after bounded retries without publication', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'existing candidate\n');
  const before = f.stable(); let writes = 0;
  await assert.rejects(atNativeIgnore(f.repo, invocation => {
    writes++; f.externalWrite('between-' + invocation + '.txt', 'external churn ' + invocation + '\n');
  }, () => f.capture()), { code: 'EDITING_BOUNDARY_CHANGED' });
  f.record('bounded refusal', { writes, preserved: f.stable() });
  assert.equal(writes, 3);
  assert.deepEqual(f.stable(), before);
  for (let n = 1; n <= writes; n++) assert.equal(fs.readFileSync(path.join(f.repo, 'between-' + n + '.txt'), 'utf8'), 'external churn ' + n + '\n');
});

test('D02 ignore change during enumeration retries using current user rules', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'pre-existing unassigned\n');
  const initialExclude = fs.readFileSync(f.exclude, 'utf8');
  const result = await atNativeIgnore(f.repo, invocation => {
    if (invocation === 1) f.externalWrite(f.exclude, initialExclude + '\n/old.txt\n');
  }, () => f.capture());
  await result.value.revalidate();
  f.record('rules changed during query', { invocations: result.invocations, before: result.value.before, unassigned: result.value.unassigned });
  assert(result.invocations >= 2);
  assert(result.value.before.includes('old.txt'));
  assert(!result.value.unassigned.includes('old.txt'));
  assert.equal(f.git('ls-files', '--others', '--exclude-standard', '-z'), '');
});

test('D02 final validation permits ordinary newcomers after the selected boundary', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'previous bytes\n');
  const boundary = await f.capture(), before = f.stable();
  f.externalWrite('after.txt', 'new target work\n'); f.externalWrite('old.txt', 'edited previous bytes\n');
  await boundary.revalidate();
  f.record('after validated boundary', { before: boundary.before, unassigned: boundary.unassigned, index: f.git('ls-files', '--stage') });
  assert(!boundary.before.includes('after.txt'));
  assert.deepEqual(boundary.unassigned, ['old.txt']);
  assert.deepEqual(f.stable(), before);
});

test('D02 managed exclude replacement does not change the user-rule boundary', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'old base candidate\n'); f.write('other.txt', 'also old\n');
  fs.appendFileSync(f.exclude, '\n*.secret\n' + BEGIN + '\n/**\n!*/\n!/old.txt\n' + END + '\n');
  f.write('ignored.secret', 'ignored by user\n');
  const boundary = await f.capture();
  assert.deepEqual(boundary.unassigned, ['old.txt', 'other.txt']);
  const user = await f.userExclude();
  f.externalWrite(f.exclude, user + BEGIN + '\n/**\n!*/\n!/old.txt\n!/other.txt\n' + END + '\n');
  await boundary.revalidate();
  f.record('managed-only replacement', { before: boundary.before, unassigned: boundary.unassigned });
});

test('D02 pre-publication validation rejects changed ignore, index, refs or HEAD', { timeout: 900000 }, async t => {
  for (const domain of ['dot-ignore', 'info-ignore', 'global-ignore', 'index', 'ref', 'head'] as const) {
    await t.test(domain, { timeout: 60000 }, async nested => {
      const f = await fixture(nested); f.write('old.txt', 'previous candidate\n');
      if (domain === 'head') f.git('branch', 'develop');
      const globalFile = path.join(f.env.HOME!, 'validation-ignore');
      if (domain === 'global-ignore') { fs.writeFileSync(globalFile, ''); f.git('config', 'core.excludesFile', globalFile); }
      const boundary = await f.capture();
      if (domain === 'dot-ignore') f.externalWrite('.gitignore', 'old.txt\n');
      if (domain === 'info-ignore') f.externalWrite(f.exclude, (await f.userExclude()) + '\nold.txt\n');
      if (domain === 'global-ignore') f.externalWrite(globalFile, 'old.txt\n');
      if (domain === 'index') f.git('add', '--', 'old.txt');
      if (domain === 'ref') f.git('branch', 'external');
      if (domain === 'head') f.git('symbolic-ref', 'HEAD', 'refs/heads/develop');
      const afterExternal = f.stable();
      await assert.rejects(boundary.revalidate(), { code: 'EDITING_BOUNDARY_CHANGED' });
      f.record('external state retained on refusal', { domain, afterExternal, actual: f.stable() });
      assert.deepEqual(f.stable(), afterExternal);
    });
  }
});

test('D02 Git changes during capture refuse instead of accepting a later retry', { timeout: 900000 }, async t => {
  const f = await fixture(t); f.write('old.txt', 'native staged during capture\n');
  let writes = 0;
  await assert.rejects(atNativeIgnore(f.repo, () => {
    writes++; f.git('add', '--', 'old.txt');
  }, () => f.capture()), { code: 'EDITING_BOUNDARY_CHANGED' });
  f.record('Git context changed', { writes, stage: f.git('diff', '--cached', '--name-only'), index: f.git('ls-files', '--stage') });
  assert.equal(writes, 1);
  assert.equal(f.git('diff', '--cached', '--name-only'), 'old.txt');
  assert.equal(fs.readFileSync(path.join(f.repo, 'old.txt'), 'utf8'), 'native staged during capture\n');
});
