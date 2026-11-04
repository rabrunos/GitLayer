import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const project = path.resolve('.');
const cli = path.join(project, 'src/cli/index.ts');
const demo = path.join(project, 'scripts/demo.ts');

async function processResult(executable: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, timeout = 150_000) {
  try {
    const result = await execFileAsync(executable, args, { cwd, env, shell: false, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    if (typeof failure.code !== 'number') throw error;
    return { code: failure.code, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

async function fixture(t: TestContext) {
  const fixtureRoot = tmpdir();
  mkdirSync(fixtureRoot, { recursive: true });
  const root = mkdtempSync(path.join(fixtureRoot, 'cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' };
  for (const key of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_LAYERS_FAILPOINT']) delete env[key];
  const run = (...args: string[]) => processResult(process.execPath, ['--import', 'tsx', cli, '--cwd', root, ...args], project, env);
  const checked = async (...args: string[]) => {
    const result = await run(...args);
    assert.equal(result.code, 0, result.stderr);
    return result;
  };
  const git = async (...args: string[]) => {
    const result = await processResult('git', ['-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${"/dev/null"}`, ...args], root, env);
    assert.equal(result.code, 0, result.stderr);
    return result.stdout.trimEnd();
  };
  const write = (file: string, bytes: string) => {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  };
  await checked('init', '--json');
  await git('config', '--local', 'user.name', 'CLI Disposable');
  await git('config', '--local', 'user.email', 'cli@example.invalid');
  await git('config', '--local', 'core.autocrlf', 'false');
  write('README.md', 'base\n');
  await checked('base-add', '--', 'README.md');
  await checked('base-commit', '-m', 'Base');
  return { root, env, run, checked, git, write };
}

test('CLI help and JSON usage errors have stable exit codes', async () => {
  const env = { ...process.env };
  const help = await processResult(process.execPath, ['--import', 'tsx', cli, '--help'], project, env);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /restore/);
  assert.match(help.stdout, /Ctrl\+C/);
  const bad = await processResult(process.execPath, ['--import', 'tsx', cli, 'push', '--json'], project, env);
  assert.equal(bad.code, 2);
  assert.equal(JSON.parse(bad.stderr).error.code, 'CLI_USAGE');
  const wrongFlag = await processResult(process.execPath, ['--import', 'tsx', cli, 'status', '--force', '--json'], project, env);
  assert.equal(wrongFlag.code, 2);
  assert.equal(JSON.parse(wrongFlag.stderr).ok, false);
});

test('CLI commits a real Layer with literal accented paths and leaves HEAD/base index intact', async t => {
  const f = await fixture(t);
  const head = await f.git('rev-parse', 'HEAD');
  const index = createHash('sha256').update(readFileSync(path.join(f.root, '.git/index'))).digest('hex');
  await f.checked('create', 'scripts');
  await f.checked('on', 'scripts');
  f.write('docs/ação [um].md', 'staged\n');
  f.write('-nova.txt', 'leading dash\n');
  await f.checked('add', 'scripts', '--', 'docs/ação [um].md', '-nova.txt');
  f.write('docs/ação [um].md', 'later disk edit\n');
  await f.checked('commit', 'scripts', '-m', 'CLI Layer commit');
  assert.equal(await f.git('rev-parse', 'HEAD'), head);
  assert.equal(createHash('sha256').update(readFileSync(path.join(f.root, '.git/index'))).digest('hex'), index);
  assert.equal(await f.git('show', 'layer/scripts:docs/ação [um].md'), 'staged');
  assert.equal(await f.git('show', 'layer/scripts:-nova.txt'), 'leading dash');
  assert.equal(readFileSync(path.join(f.root, 'docs/ação [um].md'), 'utf8'), 'later disk edit\n');
  const status = JSON.parse((await f.checked('status', 'scripts', '--json')).stdout);
  assert.equal(status.ok, true);
  assert.equal(status.result.branch, 'main');
  assert.ok(status.result.layers[0].unstaged.some((change: { path: string }) => change.path === 'docs/ação [um].md'));
  const noSeparator = await f.run('add', 'scripts', 'README.md', '--json');
  assert.equal(noSeparator.code, 2);
});

test('CLI restore requires explicit noninteractive confirmation and preserves index plus recovery copy', async t => {
  const f = await fixture(t);
  await f.checked('create', 'ai');
  await f.checked('on', 'ai');
  f.write('AGENTS.md', 'index version\n');
  await f.checked('add', 'ai', '--', 'AGENTS.md');
  f.write('AGENTS.md', 'local bytes to preserve\n');
  const declined = await f.run('restore', 'ai', '--json', '--', 'AGENTS.md');
  assert.equal(declined.code, 2);
  assert.equal(readFileSync(path.join(f.root, 'AGENTS.md'), 'utf8'), 'local bytes to preserve\n');
  const restored = JSON.parse((await f.checked('restore', 'ai', '--yes', '--json', '--', 'AGENTS.md')).stdout);
  assert.equal(readFileSync(path.join(f.root, 'AGENTS.md'), 'utf8'), 'index version\n');
  assert.equal(existsSync(restored.result.backup), true);
  const status = JSON.parse((await f.checked('status', 'ai', '--json')).stdout);
  assert.ok(status.result.layers[0].staged.some((change: { path: string }) => change.path === 'AGENTS.md'));
  assert.equal(status.result.layers[0].unstaged.length, 0);
});

test('CLI shared capture selects new paths only and cancellation preserves bytes', async t => {
  const f = await fixture(t);
  await f.checked('create', 'scripts');
  await f.checked('on', 'scripts');
  f.write('scripts/preexistente.py', 'before capture\n');
  await f.checked('capture-start', 'scripts', '--path', 'scripts');
  f.write('scripts/preexistente.py', 'edited existing\n');
  f.write('scripts/novo arquivo á.py', 'new candidate\n');
  const review = JSON.parse((await f.checked('capture-review', '--json')).stdout).result;
  assert.deepEqual(review.candidates.map((entry: { path: string }) => entry.path), ['scripts/novo arquivo á.py']);
  await f.checked('capture-confirm', '--', 'scripts/novo arquivo á.py');
  await f.checked('unstage', 'scripts', '--', 'scripts/novo arquivo á.py');
  const release = await f.checked('release', 'scripts', '--json', '--', 'scripts/novo arquivo á.py');
  assert.equal(JSON.parse(release.stdout).ok, true);
  assert.equal(readFileSync(path.join(f.root, 'scripts/novo arquivo á.py'), 'utf8'), 'new candidate\n');
  await f.checked('capture-start', 'scripts', '--path', 'scripts');
  f.write('scripts/cancelado.py', 'keep physical\n');
  await f.checked('capture-cancel');
  assert.equal(readFileSync(path.join(f.root, 'scripts/cancelado.py'), 'utf8'), 'keep physical\n');
  const status = JSON.parse((await f.checked('status', '--json')).stdout).result;
  assert.ok(status.untracked.includes('scripts/cancelado.py'));
});

test('demo script creates genuine branches/Layers and refuses a nonempty destination', async t => {
  const fixtureRoot = tmpdir();
  mkdirSync(fixtureRoot, { recursive: true });
  const container = mkdtempSync(path.join(fixtureRoot, 'demo-cli-'));
  t.after(() => rmSync(container, { recursive: true, force: true }));
  const target = path.join(container, 'new-demo');
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: "/dev/null" };
  // Demo creation composes multiple Core/Git operations; single-command budgets stay unchanged.
  const result = await processResult(process.execPath, ['--import', 'tsx', demo, target], project, env, 600_000);
  assert.equal(result.code, 0, result.stderr);
  const created = JSON.parse(result.stdout);
  assert.equal(created.head, 'main');
  assert.equal(created.layers.length, 2);
  assert.ok(created.layers.every((layer: { state: string }) => layer.state === 'active'));
  const head = await processResult('git', ['symbolic-ref', '--short', 'HEAD'], target, env);
  assert.equal(head.stdout.trim(), 'main');
  const refs = await processResult('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'], target, env);
  assert.deepEqual(refs.stdout.trim().split('\n').sort(), ['collision-demo', 'dev', 'layer/ai', 'layer/scripts', 'main']);
  const tree = await processResult('git', ['ls-tree', '-r', '--name-only', 'layer/scripts'], target, env);
  assert.deepEqual(tree.stdout.trim().split('\n'), ['scripts/debug.py', 'tools/analyze.py']);
  const rerun = await processResult(process.execPath, ['--import', 'tsx', demo, target], project, env);
  assert.equal(rerun.code, 1);
  assert.match(rerun.stderr, /não está vazia/);
  assert.equal(readFileSync(path.join(target, 'scripts/debug.py'), 'utf8').includes('debug local'), true);
});
