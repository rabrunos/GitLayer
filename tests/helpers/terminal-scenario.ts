import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { GitLayers } from '../../src/core/index.js';
import { resolveGitExecutable, normalizeProcessEnvironment, DISABLED_GIT_HOOKS } from '../../src/core/platform.js';
import { buildTerminalCommand } from '../../src/desktop/commands.js';
import { TerminalSession } from '../../src/desktop/main/terminal.js';

async function until(session: TerminalSession, predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    if (session.state().status === 'exited') throw new Error(`Terminal exited waiting for ${label}: ${session.state().history.slice(-4000)}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Timeout waiting for ${label}: ${session.state().history.slice(-4000)}`);
}

const directory = await fs.mkdtemp(path.join(tmpdir(), 'git-layers-pty-integration-'));
let session: TerminalSession | undefined;
try {
  console.log('PTY: preparing disposable Git repository');
  const root = path.join(directory, 'repo com espaços e ação');
  await fs.mkdir(root);
  const env = normalizeProcessEnvironment(process.env);
  for (const key of Object.keys(env)) if (/^GIT_/i.test(key)) delete env[key];
  Object.assign(env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
  const executable = await resolveGitExecutable(env);
  const git = (args: string[]) => execFileSync(executable, ['-c', `core.hooksPath=${DISABLED_GIT_HOOKS}`, ...args], { cwd: root, env, windowsHide: true, stdio: 'pipe' });
  git(['init', '-b', 'main']); git(['config', '--local', 'core.autocrlf', 'false']);
  git(['config', '--local', 'user.name', 'PTY Test']); git(['config', '--local', 'user.email', 'pty@example.invalid']);
  await fs.writeFile(path.join(root, 'README.md'), 'PTY fixture\n');
  git(['add', '--', 'README.md']); git(['commit', '-m', 'Base real']);
  const core = await GitLayers.open(root); await core.init(); await core.create('ai'); await core.on('ai');
  await fs.mkdir(path.join(root, 'capture'));
  const loader = pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href;
  session = await TerminalSession.start({
    cwd: root, cliPath: path.resolve('src/cli/index.ts'), executable: process.execPath, cols: 150, rows: 30,
    environment: { ...process.env, NODE_OPTIONS: `--import=${loader}` }, onData: () => undefined, onExit: () => undefined,
  });
  const terminal = session;
  await until(terminal, () => terminal.state().status === 'prompt', 'initial shell prompt');
  console.log('PTY: PowerShell/ConPTY prompt opened');
  terminal.write('git layer status --json\r');
  await until(terminal, () => terminal.state().status === 'prompt' && terminal.state().history.includes('"ok":true'), 'typed status');
  terminal.command(buildTerminalCommand('capture', { layer: 'ai', path: 'capture' }, terminal.shell));
  await until(terminal, () => terminal.state().history.includes('Captura ativa.'), 'interactive capture');
  assert.equal(terminal.state().status, 'busy');
  assert.throws(() => terminal.command(buildTerminalCommand('list', {}, terminal.shell)), /prompt vazio/);
  await fs.writeFile(path.join(root, 'capture/arquivo ação.txt'), 'capturado por um terminal real\n');
  terminal.write('q');
  await until(terminal, () => terminal.state().history.includes('Números separados por vírgula'), 'candidate selection');
  terminal.write('todos\r');
  await until(terminal, () => terminal.state().history.includes('Confirmar atribuição e staging?'), 'confirmation');
  terminal.write('sim\r');
  await until(terminal, () => terminal.state().status === 'prompt', 'completion');
  const status = await core.status();
  assert.ok(status.layers.find(layer => layer.name === 'ai')?.staged.some(file => file.path === 'capture/arquivo ação.txt'));
  assert.equal(await fs.readFile(path.join(root, 'capture/arquivo ação.txt'), 'utf8'), 'capturado por um terminal real\n');
  console.log('PTY: typed status and interactive capture verified against real staging');
} catch (error) { console.error(error); console.error(session?.state()); throw error; }
finally {
  await session?.close();
  await fs.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
