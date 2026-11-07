import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const gitExe = process.env.GIT_LAYER_GIT || (process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git');

// Every write and removal belongs to a newly created fixture; no user repository is opened.
export function fixture() {
  const container = mkdtempSync(join(tmpdir(), 'GitLayer-minimal-test-'));
  const token = randomUUID();
  writeFileSync(join(container, '.fixture-owner'), token);
  const root = join(container, 'repo');
  const home = join(container, 'home');
  mkdirSync(root);
  mkdirSync(home);
  mkdirSync(join(home, 'hooks'));
  writeFileSync(join(home, 'gitconfig'), '');
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^GIT_/i.test(key) || /^(HOME|USERPROFILE|XDG_CONFIG_HOME|PATH)$/i.test(key)) delete env[key];
  }
  Object.assign(env, {
    PATH: join(projectRoot, 'bin') + delimiter + (process.env.PATH || process.env.Path || ''),
    HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(home, 'gitconfig'),
    GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', GIT_EDITOR: 'false',
    GIT_LAYER_GIT: gitExe,
  });
  function git(args, options = {}) {
    const result = spawnSync(gitExe, args, {
      cwd: options.cwd || root, env, input: options.input,
      encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    const output = { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
    if (options.ok === false) return output;
    assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${output.stdout}\n${output.stderr}`);
    return output.stdout;
  }
  function write(path, text) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  const result = {
    root, env, git,
    layer: (args, options) => git(['layer', ...args], options),
    write,
    read: path => readFileSync(join(root, path), 'utf8'),
    files: ref => git(['ls-tree', '-r', '--name-only', '-z', ref]).split('\0').filter(Boolean).sort(),
    head: () => git(['rev-parse', 'HEAD']).trim(),
    mainIndex: () => readFileSync(join(root, '.git', 'index')),
    cleanup() {
      assert.equal(dirname(container), resolve(tmpdir()));
      assert.equal(readFileSync(join(container, '.fixture-owner'), 'utf8'), token);
      rmSync(container, { recursive: true, force: true });
    },
  };
  git(['init', '-b', 'main']);
  for (const [key, value] of Object.entries({
    'user.name': 'GitLayer Lab', 'user.email': 'lab@example.invalid',
    'core.autocrlf': 'false', 'core.filemode': 'false',
    'core.hooksPath': join(home, 'hooks'), 'credential.helper': '', 'commit.gpgsign': 'false',
  })) git(['config', '--local', key, value]);
  write('app/base.txt', 'application baseline\n');
  git(['add', '.']);
  git(['commit', '-m', 'Application baseline']);
  return result;
}