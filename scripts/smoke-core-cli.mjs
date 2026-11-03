import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
if (process.argv.length !== 4 || process.argv[2] !== '--out') throw new Error('Uso: node scripts/smoke-core-cli.mjs --out <raiz-evidencias>');
const outputRoot = path.resolve(process.argv[3]);
for (let current = outputRoot; ; current = path.dirname(current)) {
  try { assert(!fs.lstatSync(current).isSymbolicLink(), 'A saída não pode atravessar links.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (path.dirname(current) === current) break;
}
fs.mkdirSync(outputRoot, { recursive: true });
const runId = 'smoke-' + new Date().toISOString().replace(/[:.]/gu, '-') + '-' + randomUUID().slice(0, 8);
const output = path.join(outputRoot, runId);
fs.mkdirSync(output);
const commands = [], steps = [], snapshots = [];
const sha = value => createHash('sha256').update(value).digest('hex');
const inside = (ancestor, child) => { const relative = path.relative(ancestor, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
function sourceManifest() {
  const files = ['src/cli/index.ts', 'scripts/build-core.mjs', 'scripts/smoke-core-cli.mjs', 'package.json'];
  for (const name of fs.readdirSync(path.join(project, 'src/core')).filter(name => name.endsWith('.ts')).sort()) files.push('src/core/' + name);
  return files.sort().map(file => { const bytes = fs.readFileSync(path.join(project, file)); return { file, size: bytes.length, sha256: sha(bytes) }; });
}
const sourceBefore = sourceManifest();
let fixture, nonce, env, officialGit, repo, compiledCli;
function run(executable, args, cwd, expected = 0) {
  const started = new Date().toISOString(), tick = performance.now();
  const result = spawnSync(executable, args, { cwd, env, shell: false, encoding: 'utf8', windowsHide: true, timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
  const record = { executable, args, cwd, started, finished: new Date().toISOString(), durationMs: Math.round(performance.now() - tick), expected, exitCode: result.status, signal: result.signal, error: result.error ? String(result.error) : null, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  commands.push(record);
  fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
  assert.ifError(result.error); assert.equal(result.signal, null); assert.equal(result.status, expected, record.stderr);
  return record;
}
const git = (args, expected = 0) => run(officialGit, ['--no-pager', '-c', 'color.ui=false', ...args], repo, expected).stdout.trimEnd();
function cli(args, expected = 0) {
  const record = run(process.execPath, [compiledCli, '--cwd', repo, '--json', ...args], fixture, expected);
  return JSON.parse(record.stdout || record.stderr);
}
function write(file, bytes) { const destination = path.join(repo, file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes); }
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
function snapshot(label) {
  const files = [];
  function visit(folder, relative = '') {
    for (const name of fs.readdirSync(folder).filter(name => name !== '.git').sort()) {
      const file = path.join(folder, name), local = relative ? relative + '/' + name : name, stat = fs.lstatSync(file);
      assert(!stat.isSymbolicLink());
      if (stat.isDirectory()) visit(file, local);
      else if (stat.isFile()) { const bytes = fs.readFileSync(file); files.push({ path: local, bytes: bytes.length, sha256: sha(bytes), text: bytes.toString('utf8') }); }
    }
  }
  visit(repo);
  snapshots.push({ label, at: new Date().toISOString(), branch: git(['symbolic-ref', '--short', 'HEAD']), head: git(['rev-parse', 'HEAD']), refs: git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), index: git(['ls-files', '--stage']), status: git(['status', '--porcelain=v2', '--untracked-files=all']), files });
  fs.writeFileSync(path.join(output, 'snapshots.json'), JSON.stringify(snapshots, null, 2) + '\n');
}
function step(name, action) { action(); steps.push({ name, status: 'PASS' }); }
let result;
try {
  const temporary = fs.realpathSync(os.tmpdir());
  assert(!inside(project, temporary), 'A raiz temporária precisa estar fora do checkout.');
  for (let ancestor = temporary; ; ancestor = path.dirname(ancestor)) {
    assert(!fs.existsSync(path.join(ancestor, '.git')), 'A raiz temporária não pode estar sob outro repositório.');
    if (path.dirname(ancestor) === ancestor) break;
  }
  fixture = fs.mkdtempSync(path.join(temporary, 'gl-cli-'));
  nonce = randomUUID(); fs.writeFileSync(path.join(fixture, '.owned-by-cli-smoke'), nonce);
  repo = path.join(fixture, 'repo'); fs.mkdirSync(repo);
  const home = path.join(fixture, 'home'), hooks = path.join(fixture, 'empty-hooks'); fs.mkdirSync(home); fs.mkdirSync(hooks);
  env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)));
  Object.assign(env, { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: path.join(home, 'no-system'), GIT_CONFIG_GLOBAL: path.join(home, 'no-global'), GIT_AUTHOR_NAME: 'CLI Smoke Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'CLI Smoke Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '', GIT_EDITOR: 'git-layer-no-editor', GIT_SEQUENCE_EDITOR: 'git-layer-no-editor', GIT_PAGER: '', GIT_OPTIONAL_LOCKS: '0' });
  const locator = run(process.platform === 'win32' ? 'where.exe' : '/usr/bin/which', [process.platform === 'win32' ? 'git.exe' : 'git'], project);
  officialGit = locator.stdout.trim().split(/\r?\n/u)[0]; assert(path.isAbsolute(officialGit)); assert(fs.statSync(officialGit).isFile());
  const gitVersion = run(officialGit, ['--version'], project).stdout.trim();
  run(process.execPath, [path.join(project, 'scripts/build-core.mjs')], project);
  const buildManifest = JSON.parse(fs.readFileSync(path.join(project, 'dist-core/build-manifest.json'), 'utf8'));
  assert(buildManifest.inputs.every(file => /^src\/(?:core|cli)\//u.test(file)));
  fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify(buildManifest, null, 2) + '\n');
  // Execute a relocated bundle with no node_modules and no desktop artifacts.
  const runtime = path.join(fixture, 'runtime'); fs.mkdirSync(runtime); fs.mkdirSync(path.join(runtime, 'core')); fs.mkdirSync(path.join(runtime, 'cli'));
  const runtimeFiles = ['core/index.js', 'cli/index.js', 'package.json', 'build-manifest.json'];
  for (const file of runtimeFiles) fs.copyFileSync(path.join(project, 'dist-core', file), path.join(runtime, file), fs.constants.COPYFILE_EXCL);
  const runtimeManifest = () => runtimeFiles.map(file => { const bytes = fs.readFileSync(path.join(runtime, file)); return { file, size: bytes.length, sha256: sha(bytes) }; });
  const testedRuntimeManifest = runtimeManifest();
  fs.writeFileSync(path.join(output, 'tested-runtime-manifest.json'), JSON.stringify({ schema: 1, files: testedRuntimeManifest }, null, 2) + '\n');
  compiledCli = path.join(runtime, 'cli/index.js');
  run(process.execPath, [compiledCli, '--help'], fixture);

  git(['init', '-b', 'main']); git(['config', '--local', 'user.name', 'CLI Smoke Fixture']); git(['config', '--local', 'user.email', 'fixture@example.invalid']); git(['config', '--local', 'core.autocrlf', 'false']); git(['config', '--local', 'core.hooksPath', os.devNull]); git(['config', '--local', 'commit.gpgsign', 'false']); git(['config', '--local', 'tag.gpgsign', 'false']);
  write('base.txt', 'base original\n'); git(['add', '--', 'base.txt']); git(['commit', '-m', 'fixture base']); cli(['init']);
  snapshot('initial');
  step('CLI create and compose two layers', () => {
    for (const name of ['a', 'b']) { cli(['create', name]); cli(['on', name]); write(name + '.txt', name + ' original\n'); cli(['add', name, '--', name + '.txt']); cli(['commit', name, '-m', 'seed ' + name]); }
    assert.equal(git(['symbolic-ref', '--short', 'HEAD']), 'main'); assert.equal(read('b.txt'), 'b original\n');
  });
  step('CLI edit routes future files and ends without deactivation', () => {
    write('older.txt', 'preexisting\n'); cli(['edit', 'a']); write('new-a.txt', 'new target\n');
    const status = cli(['status']).result; assert.equal(status.editingTarget, 'a'); assert(status.layers.find(layer => layer.name === 'a').reservations.includes('new-a.txt')); assert(!status.layers.some(layer => layer.reservations.includes('older.txt')));
    cli(['edit-end']); assert.equal(cli(['status']).result.editingTarget, null); cli(['add', 'a', '--', 'new-a.txt']);
  });
  step('CLI commits prepared B while disk C and base stage stay independent', () => {
    write('base.txt', 'base staged\n'); git(['add', '--', 'base.txt']); const beforeIndex = git(['ls-files', '--stage']);
    write('a.txt', 'prepared B\n'); cli(['add', 'a', '--', 'a.txt']); write('a.txt', 'disk C\n'); cli(['commit', 'a', '-m', 'one commit B']);
    assert.equal(git(['show', 'layer/a:a.txt']), 'prepared B'); assert.equal(read('a.txt'), 'disk C\n'); assert.equal(git(['ls-files', '--stage']), beforeIndex);
    git(['restore', '--staged', '--', 'base.txt']); write('base.txt', 'base original\n');
  });
  snapshot('prepared B committed and C retained');
  step('CLI preview and discard require separate explicit choices', () => {
    assert.equal(cli(['off', 'a'], 3).error.code, 'LAYER_DIRTY'); assert.equal(read('a.txt'), 'disk C\n');
    cli(['preview', 'off', 'a']); assert.equal(cli(['off', 'a', '--discard'], 2).error.code, 'CLI_USAGE'); assert.equal(read('a.txt'), 'disk C\n');
    cli(['off', 'a', '--discard', '--yes']); assert(!fs.existsSync(path.join(repo, 'a.txt'))); cli(['on', 'a']); assert.equal(read('a.txt'), 'prepared B\n');
  });
  step('CLI rename preserves history and native protection has explicit entry', () => {
    const original = git(['rev-parse', 'layer/a']); cli(['rename', 'a', 'aa']); assert.equal(git(['rev-parse', 'layer/aa']), original);
    cli(['protect']); const before = git(['rev-parse', 'HEAD']); git(['switch', 'layer/aa'], 128); assert.equal(git(['rev-parse', 'HEAD']), before);
    cli(['open-branch', 'aa']); assert.equal(git(['symbolic-ref', '--short', 'HEAD']), 'layer/aa'); assert.equal(read('b.txt'), 'b original\n');
    write('a.txt', 'native branch edit\n'); git(['add', '--', 'a.txt']); git(['commit', '-m', 'native layer branch']); cli(['switch', 'main']); assert.equal(read('a.txt'), 'native branch edit\n'); assert.equal(read('b.txt'), 'b original\n'); cli(['unprotect']);
  });
  snapshot('returned from explicit Layer branch');
  step('CLI removal requires confirmation and preserves the other origin', () => {
    const ref = git(['rev-parse', 'layer/aa']); cli(['preview', 'remove', 'aa']); assert.equal(cli(['remove', 'aa'], 2).error.code, 'CLI_USAGE'); assert.equal(git(['rev-parse', 'layer/aa']), ref);
    cli(['remove', 'aa', '--yes']); assert.equal(read('b.txt'), 'b original\n'); assert(!fs.existsSync(path.join(repo, 'a.txt'))); assert(!cli(['list']).result.some(layer => layer.name === 'aa'));
  });
  step('CLI doctor is scriptable and raw rescue works with corrupt metadata', () => {
    assert.equal(cli(['doctor']).result.safe, true);
    const registry = path.join(repo, '.git', 'layers', 'registry.json'); fs.writeFileSync(registry, '{invalid metadata preserved');
    const diagnosis = cli(['doctor'], 3); assert.equal(diagnosis.ok, false); assert.equal(diagnosis.result.safe, false); assert(diagnosis.result.checks.some(check => !check.ok));
    const exportResult = cli(['recovery-export', path.join(fixture, 'export')]); assert.equal(exportResult.result.complete, true); assert.equal(fs.readFileSync(path.join(fixture, 'export/metadata/layers/registry.json'), 'utf8'), '{invalid metadata preserved');
  });
  snapshot('corrupt registry exported without normal open');
  const sourceAfter = sourceManifest(); assert.deepEqual(sourceAfter, sourceBefore, 'Fontes mudaram durante o smoke; preserve e execute novamente após congelar.');
  assert.deepEqual(runtimeManifest(), testedRuntimeManifest, 'Runtime relocada mudou durante o smoke; nenhuma copia posterior pode herdar esse resultado.');
  result = { schema: 1, status: 'PASS', runtimeRelocatedWithoutDependencies: true, testedRuntimeManifest: 'tested-runtime-manifest.json', startedSource: sourceBefore, finishedSource: sourceAfter, platform: { os: process.platform, release: os.release(), arch: process.arch, node: process.version, officialGit, gitVersion }, steps, commandCount: commands.length, snapshotCount: snapshots.length, fixtureRetained: false, fixture: '[fixture descartável removida após prova de propriedade]', limitations: ['Smoke CLI não é suíte completa.', 'Proteção padrão não cobre --ignore-other-worktrees.', 'Target protege imediatamente o add comum e reconcilia propriedade por comando; force e ignore de maior prioridade continuam bypass.'] };
  assert.equal(fs.readFileSync(path.join(fixture, '.owned-by-cli-smoke'), 'utf8'), nonce); assert.equal(path.dirname(fs.realpathSync(fixture)), temporary); assert(path.basename(fixture).startsWith('gl-cli-')); assert(!inside(project, fixture)); fs.rmSync(fixture, { recursive: true });
} catch (error) {
  result = { schema: 1, status: 'FAIL', source: sourceBefore, steps, commandCount: commands.length, snapshotCount: snapshots.length, fixtureRetained: !!fixture, fixture: fixture ?? null, failure: { message: String(error), stack: error?.stack } };
  process.exitCode = 1;
}
fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
const manifest = fs.readdirSync(output).sort().map(file => { const bytes = fs.readFileSync(path.join(output, file)); return { file, size: bytes.length, sha256: sha(bytes) }; });
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, evidence: output, steps: steps.length, commands: commands.length, fixtureRetained: result.fixtureRetained }));
