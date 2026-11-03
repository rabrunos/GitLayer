import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const evidenceRoot = process.env.GL_CLOSURE_EVIDENCE;
function inventory(directory: string): any[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'Fixture inventory does not follow links');
    return entry.isDirectory() ? [{ path: entry.name + '/', directory: true }, ...inventory(file).map(child => ({ ...child, path: entry.name + '/' + child.path }))] : [{ path: entry.name, mode: fs.statSync(file).mode & 0o777, sha256: hash(fs.readFileSync(file)), bytes: fs.statSync(file).size }];
  });
}
async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-review-target');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'), control = path.join(owned.root, 'control');
  fs.mkdirSync(repo); fs.mkdirSync(control);
  const commands: unknown[] = [], observations: unknown[] = [];
  const gitAt = (cwd: string, args: string[], input?: string, ok = [0]) => {
    const start = new Date().toISOString();
    try { const stdout = execFileSync(officialGit, args, { cwd, env, input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); commands.push({ executable: officialGit, args, cwd, start, code: 0, stdout }); return stdout; }
    catch (error: any) { commands.push({ executable: officialGit, args, cwd, start, code: error.status, stdout: String(error.stdout), stderr: String(error.stderr) }); if (!ok.includes(error.status)) throw error; return String(error.stdout); }
  };
  const git = (...args: string[]) => gitAt(repo, args).trimEnd();
  for (const cwd of [repo, control]) { gitAt(cwd, ['init', '-b', 'main']); gitAt(cwd, ['config', 'core.autocrlf', 'false']); }
  fs.writeFileSync(path.join(repo, 'base.txt'), 'base sentinel\n'); git('add', '--', 'base.txt'); git('commit', '-m', 'base');
  const app = await GitLayers.init(repo); await app.create('a'); await app.on('a');
  const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true }); fs.writeFileSync(path.join(repo, file), text); };
  const record = (label: string, value: unknown) => observations.push({ label, value });
  const stable = () => ({ head: git('rev-parse', 'HEAD'), refs: git('for-each-ref', '--format=%(refname) %(objectname)'), index: hash(fs.readFileSync(app.repo.index)), semanticIndex: git('ls-files', '--stage'), metadata: inventory(app.dir), exclude: hash(fs.readFileSync(app.repo.exclude)), disk: inventory(repo).filter(entry => !entry.path.startsWith('.git/')) });
  t.after(() => {
    try { if (evidenceRoot) { fs.mkdirSync(evidenceRoot, { recursive: true }); fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json'), JSON.stringify({ test: t.name, officialGit, version: git('--version'), commands, observations }, null, 2) + '\n'); } }
    finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, previous); cleanupFixture(owned); }
  });
  return { app, repo, control, root: owned.root, env, git, gitAt, write, record, stable };
}

for (const source of ['info', 'global', 'gitignore']) test('R02 target preserves ignored intention from ' + source, async t => {
  const f = await fixture(t);
  if (source === 'info') for (const cwd of [f.repo, f.control]) fs.appendFileSync(path.join(cwd, '.git', 'info', 'exclude'), '\n*.secret\n');
  if (source === 'global') { const file = path.join(f.root, 'home', 'user-ignore'); fs.writeFileSync(file, '*.secret\n'); f.gitAt(f.repo, ['config', '--global', 'core.excludesFile', file]); }
  if (source === 'gitignore') for (const cwd of [f.repo, f.control]) fs.writeFileSync(path.join(cwd, '.gitignore'), '*.secret\n');
  await f.app.target('a'); f.write('new.secret', 'private fixture bytes\n'); fs.writeFileSync(path.join(f.control, 'new.secret'), 'private fixture bytes\n');
  const nativeIgnored = f.gitAt(f.control, ['check-ignore', '--no-index', '-z', '--stdin'], 'new.secret\0', [0, 1]).split('\0').filter(Boolean);
  const status = await f.app.status(), reservations = status.layers.find(layer => layer.name === 'a')!.reservations;
  f.record('after-observation', { nativeIgnored, reservations, staged: f.git('diff', '--cached', '--name-only') });
  await f.app.target(); await f.app.deactivate('a', { discard: true });
  const preservedAfterDiscard = fs.existsSync(path.join(f.repo, 'new.secret')) && fs.readFileSync(path.join(f.repo, 'new.secret'), 'utf8') === 'private fixture bytes\n';
  f.record('after-edit-end-and-discard', { preservedAfterDiscard });
  if (!fs.existsSync(path.join(f.repo, 'new.secret'))) f.write('new.secret', 'private fixture bytes\n');
  await f.app.on('a'); await f.app.add('a', ['new.secret']); await f.app.commit('a', 'explicit ignored inclusion');
  const explicitBlob = f.git('show', 'layer/a:new.secret');
  f.record('deliberate-inclusion', { explicitBlob, baseStage: f.git('diff', '--cached', '--name-only') });
  assert.deepEqual(nativeIgnored, ['new.secret']);
  assert(!reservations.includes('new.secret'), 'A user-ignored file must not be assigned automatically');
  assert(preservedAfterDiscard, 'Ignored bytes must survive edit-end and Layer discard');
  assert.equal(explicitBlob, 'private fixture bytes');
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
});

for (const action of ['off', 'remove'] as const) test('R03 preview ' + action + ' includes target newcomers without synchronizing metadata', async t => {
  const f = await fixture(t); await f.app.target('a'); f.write('new.txt', 'new target bytes\n');
  const before = f.stable(), preview = await f.app.preview(action, 'a'), after = f.stable();
  f.record('preview', { preview, before, after });
  const cliArgs = ['--import', import.meta.resolve('tsx'), path.resolve(import.meta.dirname, '../../src/cli/index.ts'), '--cwd', f.repo, 'preview', action, 'a', '--json'];
  const cli = JSON.parse(execFileSync(process.execPath, cliArgs, { cwd: f.repo, env: f.env, encoding: 'utf8', windowsHide: true }));
  f.record('CLI preview', { executable: process.execPath, args: cliArgs, output: cli });
  assert.deepEqual(f.stable(), before, 'CLI preview must preserve repository state too');
  assert.deepEqual(cli.result.disappears, preview.disappears);
  assert.equal(preview.logicalComplete, true);
  assert.deepEqual(preview.unreconciled, ['new.txt']);
  let refusal: any; try { if (action === 'off') await f.app.deactivate('a'); else await f.app.removeLayer('a'); } catch (error) { refusal = error; }
  const retainedOnRefusal = fs.readFileSync(path.join(f.repo, 'new.txt'), 'utf8');
  f.record('normal-action', { errorCode: refusal?.code, retainedOnRefusal });
  f.write('later.txt', 'created after preview\n');
  if (action === 'off') await f.app.deactivate('a', { discard: true }); else await f.app.removeLayer('a', { discard: true });
  const existsAfterDiscard = ['new.txt', 'later.txt'].map(file => fs.existsSync(path.join(f.repo, file)));
  f.record('revalidated-discard', { existsAfterDiscard, base: fs.readFileSync(path.join(f.repo, 'base.txt'), 'utf8') });
  assert.deepEqual(after, before, 'Preview must preserve metadata, refs, indexes, exclude and worktree bytes');
  assert(preview.disappears.includes('new.txt'), 'Preview must enumerate the unreconciled target file it can discard');
  assert(preview.impediments.some(item => item.code === 'LAYER_DIRTY'));
  assert.equal(refusal?.code, 'LAYER_DIRTY'); assert.equal(retainedOnRefusal, 'new target bytes\n');
  assert.deepEqual(existsAfterDiscard, [false, false]);
});
test('R02 native ignore evaluation preserves negations, hierarchy and last-rule priority', async t => {
  const f = await fixture(t);
  const { ignoredWithoutManagedExcludes } = await import('../../src/core/ignore.js');
  const globalFile = path.join(f.root, 'home', 'precedence-ignore');
  for (const cwd of [f.repo, f.control]) f.gitAt(cwd, ['config', 'core.excludesFile', globalFile]);
  const cases = [
    { label: 'gitignore negates info', global: '', info: '*.secret\n', dot: '!allow.secret\n', file: 'allow.secret', ignored: false },
    { label: 'gitignore negates global', global: '*.secret\n', info: '', dot: '!allow.secret\n', file: 'allow.secret', ignored: false },
    { label: 'info negates global', global: '*.secret\n', info: '!allow.secret\n', dot: '', file: 'allow.secret', ignored: false },
    { label: 'info positive overrides global negative', global: '!allow.secret\n', info: '*.secret\n', dot: '', file: 'allow.secret', ignored: true },
    { label: 'last info rule wins', global: '', info: '*.secret\n!allow.secret\nallow.secret\n', dot: '', file: 'allow.secret', ignored: true },
    { label: 'ignored parent stays excluded', global: 'hidden/\n', info: '!hidden/allow.secret\n', dot: '', file: 'hidden/allow.secret', ignored: true },
    { label: 'deeper gitignore negates info', global: '', info: '*.secret\n', dot: '', nested: '!allow.secret\n', file: 'nested/allow.secret', ignored: false },
  ];
  for (const entry of cases) {
    fs.writeFileSync(globalFile, entry.global);
    for (const cwd of [f.repo, f.control]) {
      fs.writeFileSync(path.join(cwd, '.git', 'info', 'exclude'), entry.info);
      fs.writeFileSync(path.join(cwd, '.gitignore'), entry.dot);
      const nested = path.join(cwd, 'nested', '.gitignore');
      if (fs.existsSync(nested)) fs.unlinkSync(nested);
      if (entry.nested) { fs.mkdirSync(path.dirname(nested), { recursive: true }); fs.writeFileSync(nested, entry.nested); }
      fs.mkdirSync(path.dirname(path.join(cwd, entry.file)), { recursive: true }); fs.writeFileSync(path.join(cwd, entry.file), 'native priority fixture\n');
    }
    const expected = f.gitAt(f.control, ['check-ignore', '--no-index', '-z', '--stdin'], entry.file + '\0', [0, 1]).split('\0').filter(Boolean);
    const before = f.stable();
    const observed = [...await ignoredWithoutManagedExcludes(f.app.repo, [entry.file], entry.info)];
    f.record(entry.label, { expected, observed });
    assert.equal(expected.includes(entry.file), entry.ignored, 'Independent Git control: ' + entry.label);
    assert.deepEqual(observed, expected, entry.label);
    assert.deepEqual(f.stable(), before, 'Native evaluator must not write repository state');
  }
});