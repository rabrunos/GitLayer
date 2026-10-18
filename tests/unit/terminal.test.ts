import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PromptMarkers, TerminalError, TerminalSession, terminalDimensions, type PtyProvider } from '../../src/desktop/main/terminal.js';
import type { TerminalData, TerminalExit } from '../../src/desktop/shared.js';

test('terminal dimensions reject oversized or malformed IPC values', () => {
  assert.deepEqual(terminalDimensions(100, 28), { cols: 100, rows: 28 });
  for (const values of [[1, 28], [501, 28], [80, 201], ['80', 24], [80.1, 24], [NaN, 24]]) {
    assert.throws(() => terminalDimensions(values[0], values[1]), TerminalError);
  }
});

test('private prompt markers survive arbitrary PTY chunk boundaries without swallowing other ANSI output', () => {
  const marker = '\x1b]1337;GitLayersPrompt=secret\x07';
  for (let split = 0; split <= marker.length; split++) {
    let prompts = 0;
    const parser = new PromptMarkers(marker, () => prompts++);
    const output = parser.consume(`a\x1b[31m${marker.slice(0, split)}`) + parser.consume(`${marker.slice(split)}b`) + parser.flush();
    assert.equal(output, 'a\x1b[31mb'); assert.equal(prompts, 1);
  }
  const parser = new PromptMarkers(marker, () => undefined);
  assert.equal(parser.consume('\x1b]1337;Different=value\x07'), '\x1b]1337;Different=value\x07');
  assert.equal(parser.consume(marker.slice(0, 6)), '');
  assert.equal(parser.flush(), marker.slice(0, 6));
});

class FakePty {
  writes: string[] = []; sizes: [number, number][] = []; killed = false;
  data?: (data: string) => void;
  exit?: (event: { exitCode: number; signal?: number }) => void;
  write(data: string): void { this.writes.push(data); }
  resize(cols: number, rows: number): void { this.sizes.push([cols, rows]); }
  kill(): void { this.killed = true; }
  onData(callback: (data: string) => void) { this.data = callback; return { dispose: () => { this.data = undefined; } }; }
  onExit(callback: (event: { exitCode: number; signal?: number }) => void) { this.exit = callback; return { dispose: () => { this.exit = undefined; } }; }
}

async function fixture() {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'git-layers-terminal-test-'));
  const cli = path.join(directory, 'cli.mjs');
  await fs.writeFile(cli, 'export async function runCli() { return 0; }');
  const pty = new FakePty();
  const data: TerminalData[] = [];
  const exits: TerminalExit[] = [];
  let invocation: Parameters<PtyProvider['spawn']> | undefined;
  const provider: PtyProvider = { spawn: (...args) => { invocation = args; return pty; } };
  const session = await TerminalSession.start({ cwd: directory, cliPath: cli, executable: process.execPath, cols: 80, rows: 24, provider, onData: event => data.push(event), onExit: event => exits.push(event), platform: 'linux', environment: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
  const prompt = () => pty.data?.(`\x1b]1337;GitLayersPrompt=${session.sessionId}\x07$ `);
  return { directory, cli, pty, data, exits, session, prompt, invocation: invocation!, close: async () => { await session.close(); await fs.rm(directory, { recursive: true, force: true }); } };
}

test('terminal commands use the live PTY and reject a running process or unfinished input', async () => {
  const f = await fixture();
  try {
    assert.equal(f.session.state().status, 'starting');
    assert.throws(() => f.session.command('git-layer status'), /prompt vazio/);
    f.prompt();
    assert.equal(f.session.state().status, 'prompt');
    f.session.write('unfinished');
    f.prompt(); // A shell redraw cannot erase the unfinished-input guard.
    assert.equal(f.session.state().inputDirty, true);
    assert.throws(() => f.session.command('git-layer status'), /prompt vazio/);
    f.session.write('\x03'); f.prompt();
    f.session.command("git-layer 'status'");
    assert.equal(f.pty.writes.at(-1), "git-layer 'status'\r");
    assert.equal(f.session.state().status, 'busy');
    assert.throws(() => f.session.command('git-layer list'), /prompt vazio/);
    f.prompt();
    f.session.command("git-layer 'list'", false);
    assert.equal(f.pty.writes.at(-1), "git-layer 'list'");
    assert.equal(f.session.state().inputDirty, true);
    f.session.resize(120, 40);
    assert.deepEqual(f.pty.sizes, [[120, 40]]);
    assert.throws(() => f.session.write('x'.repeat(65537)), /64 KiB/);
  } finally { await f.close(); }
});

test('ConPTY cursor and device replies do not make an empty prompt look edited', async () => {
  const f = await fixture();
  try {
    f.prompt();
    for (const reply of ['\x1b[1;1R', '\x1b[?1;2c', '\x1b[0n', '\x1b[I', '\x1b[O']) {
      f.session.write(reply);
      assert.equal(f.pty.writes.at(-1), reply);
      assert.equal(f.session.state().inputDirty, false);
      assert.equal(f.session.state().status, 'prompt');
    }
    f.session.command('git-layer status');
    assert.equal(f.pty.writes.at(-1), 'git-layer status\r');
  } finally { await f.close(); }
});

test('terminal launch keeps normal shell environment, uses a temporary helper and cleans it on close', async () => {
  const f = await fixture();
  const runtime = f.session.directory;
  try {
    const [file, args, options] = f.invocation;
    assert.equal(file, '/bin/bash'); assert.equal(args.at(-1), '-i');
    assert.equal(options.cwd, f.directory); assert.equal(options.env.ELECTRON_RUN_AS_NODE, undefined);
    assert.equal(options.env.TERM, 'xterm-256color');
    assert.ok(options.env.PATH.startsWith(`${runtime}:`));
    const helper = await fs.readFile(path.join(runtime, 'git-layer'), 'utf8');
    assert.ok(helper.includes('ELECTRON_RUN_AS_NODE=1 exec'));
    assert.ok(helper.includes('"$@"'));
    f.prompt();
    f.pty.data?.('x'.repeat(1024 * 1024 + 20));
    assert.equal(f.session.state().history.length, 1024 * 1024);
    assert.ok(f.data.every(event => event.sessionId === f.session.sessionId));
  } finally { await f.close(); }
  assert.equal(f.pty.killed, true);
  await assert.rejects(fs.access(runtime), { code: 'ENOENT' });
  assert.throws(() => f.session.write('x'), /encerrado/);
});

test('PTY exit is surfaced without inventing terminal output and refuses later writes', async () => {
  const f = await fixture();
  try {
    f.prompt(); f.pty.data?.('real output\r\n');
    f.pty.exit?.({ exitCode: 7, signal: 1 });
    assert.deepEqual(f.exits, [{ sessionId: f.session.sessionId, exitCode: 7, signal: 1 }]);
    assert.equal(f.session.state().status, 'exited');
    assert.ok(f.session.state().history.endsWith('real output\r\n'));
    assert.throws(() => f.session.write('x'), /encerrado/);
  } finally { await f.close(); }
});

test('PTY startup failure is explicit and never falls back to simulated or piped output', async () => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'git-layers-terminal-failure-'));
  let runtime = '';
  try {
    const cli = path.join(directory, 'cli.mjs'); await fs.writeFile(cli, '');
    await assert.rejects(TerminalSession.start({
      cwd: directory, cliPath: cli, executable: process.execPath, cols: 80, rows: 24, platform: 'linux',
      onData: () => assert.fail('no output before a real PTY exists'), onExit: () => assert.fail('no exit from a missing PTY'),
      provider: { spawn: (_file, args) => { runtime = path.dirname(args[2]!); throw new Error('native PTY unavailable'); } },
    }), /Bash\/PTY real.*native PTY unavailable/);
    assert.ok(runtime); await assert.rejects(fs.access(runtime), { code: 'ENOENT' });
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('generated Windows launch uses ConPTY and waits in the same console without piping CLI streams', async () => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "git-layers-windows-startup's-ação-"));
  let session: TerminalSession | undefined;
  try {
    const cli = path.join(directory, 'cli.mjs'); await fs.writeFile(cli, '');
    const executable = path.join(directory, "runtime's % app.exe");
    const pty = new FakePty();
    let invocation: Parameters<PtyProvider['spawn']> | undefined;
    session = await TerminalSession.start({
      cwd: directory, cliPath: cli, executable, cols: 80, rows: 24, platform: 'win32',
      onData: () => undefined, onExit: () => undefined,
      provider: { spawn: (...args) => { invocation = args; return pty; } },
    });
    const [file, args, options] = invocation!;
    assert.match(file, /\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/u);
    assert.equal(options.useConpty, true);
    assert.ok(args.includes('-NoProfile') && args.includes('-NoExit'));
    assert.ok(!args.includes('-ExecutionPolicy'));
    const script = Buffer.from(args[args.indexOf('-EncodedCommand') + 1]!, 'base64').toString('utf16le');
    assert.ok(script.includes('Start-Process -FilePath'));
    assert.ok(script.includes('-WorkingDirectory (Get-Location).ProviderPath -NoNewWindow -Wait -PassThru -ErrorAction Stop'));
    assert.ok(script.includes("runtime''s % app.exe"));
    assert.ok(script.includes('ConvertTo-Json -Compress -InputObject $arguments'));
    assert.ok(!script.includes('Out-Default') && !script.includes('RedirectStandard'));
    const launcher = await fs.readFile(path.join(session.directory, 'cli.mjs'), 'utf8');
    assert.ok(launcher.includes('process.exitCode=await runCli(argv)'));
    const batch = await fs.readFile(path.join(session.directory, 'git-layer.cmd'), 'utf8');
    assert.ok(batch.includes('runtime\'s %% app.exe'));
  } finally {
    await session?.close(); await fs.rm(directory, { recursive: true, force: true });
  }
});
