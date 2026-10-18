import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeProcessEnvironment, resolveGitExecutable } from '../../core/platform.js';
import type { TerminalData, TerminalExit, TerminalState } from '../shared.js';

const HISTORY_LIMIT = 1024 * 1024;
const INPUT_LIMIT = 64 * 1024;
interface Disposable { dispose(): void }
interface Pty {
  readonly pid?: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(callback: (data: string) => void): Disposable;
  onExit(callback: (event: { exitCode: number; signal?: number }) => void): Disposable;
}
export interface PtyProvider {
  spawn(file: string, args: string[], options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string>; useConpty?: boolean }): Pty;
}
interface TerminalOptions {
  cwd: string;
  cliPath: string;
  executable: string;
  cols: number;
  rows: number;
  onData: (event: TerminalData) => void;
  onExit: (event: TerminalExit) => void;
  provider?: PtyProvider;
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
}
export class TerminalError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'TerminalError'; }
}

export function terminalDimensions(cols: unknown, rows: unknown): { cols: number; rows: number } {
  if (!Number.isSafeInteger(cols) || !Number.isSafeInteger(rows) || Number(cols) < 2 || Number(cols) > 500 || Number(rows) < 2 || Number(rows) > 200) {
    throw new TerminalError('TERMINAL_SIZE', 'Tamanho do terminal inválido (2–500 colunas e 2–200 linhas).');
  }
  return { cols: Number(cols), rows: Number(rows) };
}

/** Strip only this session's private prompt marker, including markers split across PTY chunks. */
export class PromptMarkers {
  private pending = '';
  constructor(private readonly marker: string, private readonly prompt: () => void) {}
  consume(chunk: string): string {
    const input = this.pending + chunk;
    this.pending = '';
    let output = '';
    let offset = 0;
    for (;;) {
      const found = input.indexOf(this.marker, offset);
      if (found === -1) break;
      output += input.slice(offset, found);
      this.prompt();
      offset = found + this.marker.length;
    }
    const tail = input.slice(offset);
    let partial = Math.min(tail.length, this.marker.length - 1);
    while (partial > 0 && !tail.endsWith(this.marker.slice(0, partial))) partial--;
    if (partial) this.pending = tail.slice(-partial);
    return output + tail.slice(0, partial ? -partial : undefined);
  }
  flush(): string { const pending = this.pending; this.pending = ''; return pending; }
}

const psQuote = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const bashQuote = (value: string): string => `'${value.replaceAll("'", `'"'"'`)}'`;
const batchQuote = (value: string): string => `"${value.replaceAll('%', '%%')}"`;

/** Resolve the physical unpacked module so node-pty's Windows agent/worker scripts can spawn. */
export function loadPtyProvider(): PtyProvider {
  const require = createRequire(import.meta.url);
  const resolved = require.resolve('node-pty');
  const physical = resolved.replace(/([\\/])app\.asar([\\/])/u, '$1app.asar.unpacked$2');
  return require(physical) as PtyProvider;
}

export class TerminalSession {
  private pty!: Pty;
  private subscriptions: Disposable[] = [];
  private readonly parser: PromptMarkers;
  private history = '';
  private status: TerminalState['status'] = 'starting';
  private inputDirty = false;
  private disposed = false;
  private exited = false;
  private cols: number;
  private rows: number;
  private constructor(private readonly options: TerminalOptions, readonly directory: string, readonly shell: 'powershell' | 'bash', readonly sessionId: string, marker: string) {
    this.cols = options.cols; this.rows = options.rows;
    this.parser = new PromptMarkers(marker, () => {
      // Readline can redraw a prompt while the user is editing. A redraw must
      // never make the button catalog overwrite an unfinished input line.
      if (this.status !== 'prompt') this.inputDirty = false;
      this.status = 'prompt';
    });
  }

  static async start(options: TerminalOptions): Promise<TerminalSession> {
    terminalDimensions(options.cols, options.rows);
    const platform = options.platform ?? process.platform;
    const env: Record<string, string> = Object.fromEntries(Object.entries(normalizeProcessEnvironment(options.environment ?? process.env, platform)).filter((entry): entry is [string, string] => entry[1] !== undefined));
    // Electron's Node mode belongs only to the local CLI helper, never the interactive shell.
    for (const key of Object.keys(env)) if (key.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete env[key];
    const directory = await fs.mkdtemp(path.join(tmpdir(), 'git-layers-terminal-'));
    const shell = platform === 'win32' ? 'powershell' : 'bash';
    const sessionId = randomBytes(16).toString('hex');
    const marker = `\x1b]1337;GitLayersPrompt=${sessionId}\x07`;
    const terminal = new TerminalSession(options, directory, shell, sessionId, marker);
    try {
      await fs.access(options.cliPath);
      const git = await resolveGitExecutable(options.environment ?? process.env);
      const separator = platform === 'win32' ? ';' : ':';
      env.PATH = [directory, path.dirname(git), env.PATH ?? ''].filter(Boolean).join(separator);
      env.TERM = 'xterm-256color'; env.COLORTERM = 'truecolor';
      let executable: string;
      let args: string[];
      if (shell === 'powershell') {
        const startup = path.join(directory, 'initialize.ps1');
        const launcher = path.join(directory, 'cli.mjs');
        await fs.writeFile(launcher, `const argv=JSON.parse(process.env.GIT_LAYERS_TERMINAL_ARGV??'[]');\ndelete process.env.GIT_LAYERS_TERMINAL_ARGV;\ndelete process.env.ELECTRON_RUN_AS_NODE;\nconst {runCli}=await import(${JSON.stringify(pathToFileURL(options.cliPath).href)});\nprocess.exitCode=await runCli(argv);\n`, { mode: 0o600 });
        const startupText = `# Session-local helpers. No profile, registry or global PATH changes.\nfunction global:git-layer {\n  $previousNode = $env:ELECTRON_RUN_AS_NODE\n  $previousArgs = $env:GIT_LAYERS_TERMINAL_ARGV\n  $code = 1\n  try {\n    $arguments = @($args | ForEach-Object { [string]$_ })\n    $env:GIT_LAYERS_TERMINAL_ARGV = ConvertTo-Json -Compress -InputObject $arguments\n    $env:ELECTRON_RUN_AS_NODE = '1'\n    $process = Start-Process -FilePath ${psQuote(options.executable)} -ArgumentList ${psQuote(`"${launcher}"`)} -WorkingDirectory (Get-Location).ProviderPath -NoNewWindow -Wait -PassThru -ErrorAction Stop\n    $code = $process.ExitCode\n  } finally {\n    $env:ELECTRON_RUN_AS_NODE = $previousNode\n    $env:GIT_LAYERS_TERMINAL_ARGV = $previousArgs\n    $global:LASTEXITCODE = $code\n  }\n}\nfunction global:git {\n  if ($args.Count -gt 0 -and $args[0] -eq 'layer') {\n    $layerArguments = @()\n    if ($args.Count -gt 1) { $layerArguments = @($args[1..($args.Count - 1)]) }\n    & 'git-layer' @layerArguments\n  } else { & ${psQuote(git)} @args }\n}\nfunction global:prompt {\n  [Console]::Write(([string][char]27) + ']1337;GitLayersPrompt=${sessionId}' + ([string][char]7))\n  return ('PS ' + $executionContext.SessionState.Path.CurrentLocation + '> ')\n}\nWrite-Host 'Git Layers Lab: terminal PowerShell real. git-layer e git layer disponíveis nesta sessão.'\n`;
        // Windows PowerShell 5.1 needs UTF-8 BOM for accents in paths and helper text.
        await fs.writeFile(startup, `\uFEFF${startupText}`, { mode: 0o600 });
        const cmd = `@echo off\r\nsetlocal\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n${batchQuote(options.executable)} ${batchQuote(options.cliPath)} %*\r\nexit /b %ERRORLEVEL%\r\n`;
        await fs.writeFile(path.join(directory, 'git-layer.cmd'), cmd, { mode: 0o600 });
        const systemRoot = env.SYSTEMROOT ?? 'C:\\Windows';
        executable = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        // An inline command does not relax the machine's script execution policy.
        args = ['-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', Buffer.from(startupText, 'utf16le').toString('base64')];
      } else {
        const startup = path.join(directory, 'initialize.bash');
        const helper = path.join(directory, 'git-layer');
        await fs.writeFile(helper, `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${bashQuote(options.executable)} ${bashQuote(options.cliPath)} "$@"\n`, { mode: 0o700 });
        await fs.writeFile(startup, `# Local terminal session only.\nPS1='\\u@\\h:\\w\\$ '\n__git_layers_prompt() { printf '%s' ${bashQuote(marker)}; }\nPROMPT_COMMAND=__git_layers_prompt\nprintf '%s\\n' 'Git Layers Lab: terminal Bash real. git-layer e git layer disponíveis nesta sessão.'\n`, { mode: 0o600 });
        executable = '/bin/bash';
        args = ['--noprofile', '--rcfile', startup, '-i'];
      }
      const provider = options.provider ?? loadPtyProvider();
      terminal.pty = provider.spawn(executable, args, { name: 'xterm-256color', cols: options.cols, rows: options.rows, cwd: options.cwd, env, ...(platform === 'win32' ? { useConpty: true } : {}) });
      terminal.subscriptions.push(terminal.pty.onData(chunk => terminal.receive(chunk)));
      terminal.subscriptions.push(terminal.pty.onExit(event => terminal.finish(event)));
      return terminal;
    } catch (error) {
      await terminal.close();
      throw new TerminalError('TERMINAL_UNAVAILABLE', `Não foi possível iniciar o terminal ${shell === 'powershell' ? 'PowerShell/ConPTY' : 'Bash/PTY'} real: ${(error as Error).message}. Extraia a pasta completa do aplicativo. O terminal não usa uma simulação nem um processo sem PTY.`);
    }
  }

  state(): TerminalState {
    return { sessionId: this.sessionId, shell: this.shell, cwd: this.options.cwd, cols: this.cols, rows: this.rows, history: this.history, status: this.status, inputDirty: this.inputDirty };
  }
  private emit(data: string): void {
    if (this.disposed) return;
    if (data) this.history = (this.history + data).slice(-HISTORY_LIMIT);
    this.options.onData({ sessionId: this.sessionId, data, status: this.status, inputDirty: this.inputDirty });
  }
  private receive(chunk: string): void {
    if (!this.disposed) this.emit(this.parser.consume(chunk));
  }
  private finish(event: { exitCode: number; signal?: number }): void {
    if (this.disposed || this.exited) return;
    this.exited = true; this.status = 'exited'; this.inputDirty = false;
    this.emit(this.parser.flush());
    this.options.onExit({ sessionId: this.sessionId, ...event });
    void fs.rm(this.directory, { recursive: true, force: true }).catch(() => undefined);
  }
  private alive(): void {
    if (this.disposed || this.exited) throw new TerminalError('TERMINAL_CLOSED', 'O terminal foi encerrado. Abra um novo terminal.');
  }
  write(data: unknown): void {
    this.alive();
    if (typeof data !== 'string' || data.length > INPUT_LIMIT) throw new TerminalError('TERMINAL_INPUT', 'Entrada do terminal inválida ou maior que 64 KiB.');
    if (!data) return;
    // xterm answers ConPTY's cursor/device queries through onData too. These
    // protocol replies do not put editable text on the PowerShell prompt.
    const terminalReply = /^(?:\x1b\[(?:\??[\d;]*c|0n|\??\d+;\d+R|[IO]))+$/u.test(data);
    if (terminalReply) { this.pty.write(data); return; }
    if (/[\r\n\x03]/u.test(data)) { this.status = 'busy'; this.inputDirty = false; }
    else this.inputDirty = true;
    this.emit('');
    this.pty.write(data);
  }
  resize(cols: unknown, rows: unknown): void {
    this.alive();
    const size = terminalDimensions(cols, rows);
    this.pty.resize(size.cols, size.rows); this.cols = size.cols; this.rows = size.rows;
  }
  command(command: string, execute = true): void {
    this.alive();
    if (this.status !== 'prompt' || this.inputDirty) throw new TerminalError('TERMINAL_BUSY', 'Espere um prompt vazio. Há um comando em execução ou texto na linha; termine a edição ou pressione Ctrl+C no terminal antes de usar os botões.');
    if (!command || command.length > INPUT_LIMIT || /[\r\n\0]/u.test(command)) throw new TerminalError('TERMINAL_COMMAND', 'Comando inválido para a linha do terminal.');
    this.write(`${command}${execute ? '\r' : ''}`);
  }
  async close(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    for (const subscription of this.subscriptions) subscription.dispose();
    this.subscriptions = [];
    // kill also releases node-pty's output Worker. Natural shell exit alone
    // does not dispose that Worker in node-pty 1.1.0 on Windows.
    try { this.pty?.kill(); } catch { /* The shell may have exited before cleanup. */ }
    await fs.rm(this.directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }
}
