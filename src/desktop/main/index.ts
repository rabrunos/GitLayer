import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, protocol, session } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, watch, type FSWatcher } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GitLayers } from '../../core/index.js';
import { createDemo } from '../../core/demo.js';
import { safePath, validatePath } from '../../core/paths.js';
import { getGitActivity, gitText } from '../../core/git.js';
import { resolveGitExecutable, workspaceInputPath } from '../../core/platform.js';
import type { APIResult, Draft, RuntimeStatus } from '../shared.js';
import { TerminalError, TerminalSession, terminalDimensions } from './terminal.js';
import { buildTerminalCommand } from '../commands.js';
import { terminalRuntime } from './terminal-runtime.js';

// Workshop debug sessions use their own profile, before Electron creates a session.
const profileIndex = process.argv.findIndex(value => value === '--lab-profile' || value.startsWith('--lab-profile='));
if (profileIndex !== -1) {
  const value = process.argv[profileIndex]!;
  const profile = value === '--lab-profile' ? process.argv[profileIndex + 1] : value.slice('--lab-profile='.length);
  if (!profile || !path.isAbsolute(profile) || profile.includes('\0')) throw new Error('--lab-profile exige um caminho absoluto.');
  mkdirSync(profile, { recursive: true });
  const sessions = path.join(profile, 'sessions');
  mkdirSync(sessions, { recursive: true });
  app.setPath('userData', profile);
  app.setPath('sessionData', sessions);
}

protocol.registerSchemesAsPrivileged([{ scheme: 'gitlayers', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
const here = path.dirname(fileURLToPath(import.meta.url));
let win: BrowserWindow | null = null;
let core: GitLayers | null = null;
let terminal: TerminalSession | null = null;
let queue: Promise<unknown> = Promise.resolve();
let dirtyCount = 0;
let startupError: string | undefined;
let permitClose = false;
let watchers: FSWatcher[] = [];
let debounce: ReturnType<typeof setTimeout> | undefined;
const UI_URL = 'gitlayers://app/index.html';
const text = (v: unknown, name: string, max = 4096): string => {
  if (typeof v !== 'string' || v.length > max || v.includes('\0')) throw new Error(`${name}: texto inválido.`);
  return v;
};
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Argumentos IPC inválidos.');
  return v as Record<string, unknown>;
};
const relative = (v: unknown): string => validatePath(workspaceInputPath(text(v, 'Caminho')));
const paths = (v: unknown): string[] => {
  if (!Array.isArray(v) || v.length > 10000) throw new Error('Lista de caminhos inválida.');
  return v.map(relative);
};
const owner = (v: unknown): string => text(v, 'Proprietário', 160);
function ready(): GitLayers { if (!core) throw new Error('Abra um repositório primeiro.'); return core; }
async function closeTerminal(): Promise<void> { const previous = terminal; terminal = null; await previous?.close(); }
function terminalReady(): TerminalSession {
  if (!terminal) throw new TerminalError('TERMINAL_CLOSED', 'Abra o terminal integrado primeiro.');
  return terminal;
}
async function runtimeStatus(): Promise<RuntimeStatus> {
  const result: RuntimeStatus = {
    platform: process.platform, arch: process.arch, appVersion: app.getVersion(),
    packaged: app.isPackaged, target: 'Windows x64', repositoryOpen: core !== null,
    startupError, git: { available: false },
  };
  try {
    const executable = await resolveGitExecutable();
    const version = await gitText(app.getPath('temp'), ['version'], { timeout: 10000 });
    const parsed = /^git version (\d+)\.(\d+)(?:\.|$)/u.exec(version);
    const supported = !!parsed && (Number(parsed[1]) > 2 || (Number(parsed[1]) === 2 && Number(parsed[2]) >= 43));
    result.git = { available: supported, executable, version, ...(supported ? {} : { errorCode: 'GIT_UNSUPPORTED_VERSION', error: `Encontrado ${version}. Este laboratório exige Git 2.43 ou superior. Atualize o Git for Windows e reabra o aplicativo.` }) };
  } catch (error) {
    result.git.error = (error as Error).message ?? String(error);
    result.git.errorCode = (error as Error & { code?: string }).code ?? 'GIT_NOT_FOUND';
  }
  return result;
}
async function requireGit(): Promise<void> {
  const runtime = await runtimeStatus();
  if (!runtime.git.available) throw Object.assign(new Error(runtime.git.error ?? 'Instale o Git for Windows e reabra o aplicativo.'), { code: runtime.git.errorCode ?? 'GIT_NOT_FOUND' });
}
async function rememberRepository(root: string): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  const target = path.join(app.getPath('userData'), 'last-repo.json');
  await replaceFile(target, JSON.stringify({ schema: 1, root }));
  startupError = undefined;
}
/** Windows virus scanners can briefly lock a replaced file. Never delete the old file first. */
async function replaceFile(target: string, content: string): Promise<void> {
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, content, { flag: 'wx', mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(temp, target); break; }
      catch (error) {
        if (process.platform !== 'win32' || attempt >= 4 || !['EACCES', 'EBUSY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
        await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
      }
    }
  } finally { await fs.rm(temp, { force: true }).catch(() => undefined); }
}
function changed(): void { if (win && !win.isDestroyed()) win.webContents.send('lab:changed'); }
async function directories(root: string): Promise<string[]> {
  const result: string[] = [];
  const visit = async (full: string, prefix: string): Promise<void> => {
    for (const entry of await fs.readdir(full, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.toLowerCase() === '.git') continue;
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const safe = await safePath(root, name, false);
      if (result.length >= 10000) throw new Error('Explorador limitado a 10.000 diretórios.');
      result.push(name); await visit(safe, name);
    }
  };
  await visit(root, '');
  return result;
}
async function watchWorkspace(): Promise<void> {
  for (const watcher of watchers) watcher.close();
  watchers = [];
  if (!core) return;
  const dirs = new Set([core.repo.root, core.repo.gitDir, path.join(core.repo.gitDir, 'refs'), path.join(core.repo.gitDir, 'refs/heads')]);
  for (const f of await core.files()) dirs.add(path.dirname(path.join(core.repo.root, f.path)));
  for (const dir of [...dirs].slice(0, 512)) {
    try {
      if ((await fs.lstat(dir)).isSymbolicLink()) continue;
      watchers.push(watch(dir, (_event, filename) => {
        // Draft persistence itself must not trigger a renderer write/refresh loop.
        if (dir === core?.repo.gitDir && String(filename).replaceAll('\\', '/').split('/')[0]?.toLowerCase() === 'git-layers') return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(changed, 250);
      }));
    } catch { /* A directory can disappear between enumeration and watch. Manual refresh remains available. */ }
  }
}
async function draftDir(create = false): Promise<string> {
  const c = ready();
  const metadata = path.join(c.repo.gitDir, 'git-layers');
  const dir = path.join(metadata, 'editor-drafts');
  if (!(await fs.lstat(metadata)).isDirectory() || (await fs.lstat(metadata)).isSymbolicLink()) throw new Error('Armazenamento de rascunhos inválido.');
  if (create) {
    await fs.access(path.join(metadata, 'registry.json'));
    try { await fs.mkdir(dir); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  }
  for (const p of [metadata, dir]) {
    const entry = await fs.lstat(p);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Armazenamento de rascunhos inválido.');
  }
  return dir;
}
async function drafts(): Promise<Draft[]> {
  let dir: string;
  try { dir = await draftDir(); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
  const result: Draft[] = [];
  for (const filename of await fs.readdir(dir)) {
    if (!/^[a-f0-9]{64}\.json$/.test(filename)) continue;
    const full = path.join(dir, filename);
    if (!(await fs.lstat(full)).isFile()) throw new Error('Entrada de rascunho inválida.');
    const raw = await fs.readFile(full, 'utf8');
    if (raw.length > 16 * 1024 * 1024) throw new Error('Rascunho excessivamente grande.');
    const value = object(JSON.parse(raw));
    if (value.schema !== 1) throw new Error('Versão desconhecida de rascunho.');
    result.push({ schema: 1, path: relative(value.path), text: text(value.text, 'Rascunho', 8 * 1024 * 1024), hash: text(value.hash, 'Hash', 256), eol: text(value.eol, 'EOL', 20), savedAt: text(value.savedAt, 'Data', 64) });
  }
  return result;
}
async function request(action: string, input: unknown): Promise<unknown> {
  const a = object(input);
  if (action === 'runtime') return runtimeStatus();
  if (dirtyCount && ['open', 'initialize', 'demo', 'deactivate', 'switch', 'restore', 'delete', 'rename', 'advanced'].includes(action)) throw new Error('Salve todos os buffers não salvos ou cancele antes desta operação. Os rascunhos são preservados.');
  if (action === 'demo') {
    await requireGit();
    const picked = await dialog.showOpenDialog(win!, { title: 'Criar demonstração em pasta nova ou vazia', properties: ['openDirectory', 'createDirectory'] });
    if (picked.canceled || !picked.filePaths[0]) return null;
    const demo = await createDemo(picked.filePaths[0]);
    const next = await GitLayers.open(demo.root);
    await closeTerminal();
    core = next;
    await rememberRepository(demo.root);
    await watchWorkspace();
    return demo;
  }
  if (action === 'open' || action === 'initialize') {
    await requireGit();
    const picked = await dialog.showOpenDialog(win!, { title: action === 'open' ? 'Abrir repositório local' : 'Inicializar repositório local', properties: ['openDirectory', 'createDirectory'] });
    if (picked.canceled || !picked.filePaths[0]) return null;
    const next = action === 'initialize' ? await GitLayers.init(picked.filePaths[0]) : await GitLayers.open(picked.filePaths[0]);
    await closeTerminal();
    core = next;
    await rememberRepository(core.repo.root);
    await watchWorkspace();
    return { root: core.repo.root };
  }
  if (action === 'dirty') { dirtyCount = Number.isInteger(a.count) ? Math.max(0, Math.min(Number(a.count), 10000)) : 0; return null; }
  if (action === 'closeReady') { permitClose = true; win?.close(); return null; }
  const c = ready();
  switch (action) {
    case 'terminalOpen': {
      const size = terminalDimensions(a.cols ?? 100, a.rows ?? 28);
      if (terminal?.state().status === 'exited') await closeTerminal();
      if (!terminal) {
        let atPrompt = false;
        terminal = await TerminalSession.start({
          cwd: c.repo.root,
          cliPath: app.isPackaged ? path.join(process.resourcesPath, 'cli/cli/index.js') : path.resolve(here, '../../cli/index.js'),
          executable: await terminalRuntime(), ...size,
          onData: event => {
            if (win && !win.isDestroyed()) win.webContents.send('lab:terminal-data', event);
            if (event.status === 'prompt' && !atPrompt) changed();
            atPrompt = event.status === 'prompt';
          },
          onExit: event => { if (win && !win.isDestroyed()) win.webContents.send('lab:terminal-exit', event); changed(); },
        });
      }
      return terminal.state();
    }
    case 'terminalWrite': terminalReady().write(a.data); return null;
    case 'terminalState': return terminalReady().state();
    case 'terminalResize': terminalReady().resize(a.cols, a.rows); return null;
    case 'terminalClose': await closeTerminal(); return null;
    case 'copyCommand': {
      const command = buildTerminalCommand(text(a.id, 'Comando', 64), object(a.values ?? {}), terminal?.shell ?? (process.platform === 'win32' ? 'powershell' : 'bash'));
      clipboard.writeText(command);
      return { command };
    }
    case 'copyRelativePath': {
      const copiedPath = a.path === '' ? '.' : relative(a.path);
      clipboard.writeText(copiedPath);
      return { path: copiedPath };
    }
    case 'enableLayers': return c.init();
    case 'snapshot': {
      const [layers, files, status, branches, candidates] = await Promise.all([c.list(), c.files(), c.status(), c.branches(), c.candidates()]);
      let capture;
      try { capture = await c.captureReview(); } catch { /* No session: the explicit review action reports other errors. */ }
      return { repo: c.repo, layers, files, directories: await directories(c.repo.root), status, branches, candidates, capture, gitActivity: getGitActivity() };
    }
    case 'read': return c.readFile(relative(a.path));
    case 'write': return c.writeFile(relative(a.path), text(a.text, 'Conteúdo', 8 * 1024 * 1024), a.hash === undefined ? undefined : text(a.hash, 'Hash', 256));
    case 'mkdir': return c.mkdir(relative(a.path));
    case 'rename': return c.renameFile(relative(a.from), relative(a.to));
    case 'delete': if (a.confirmed !== true) throw new Error('Exclusão exige confirmação.'); return c.deleteFile(relative(a.path), true);
    case 'createLayer': return c.create(owner(a.name));
    case 'registerLayer': return c.register(owner(a.name));
    case 'activate': return c.on(owner(a.name));
    case 'deactivate': return c.off(owner(a.name), a.park === true);
    case 'stage': return a.owner === 'base' ? c.baseStage(paths(a.paths)) : c.add(owner(a.owner), paths(a.paths));
    case 'unstage': return a.owner === 'base' ? c.baseUnstage(paths(a.paths)) : c.unstage(owner(a.owner), paths(a.paths));
    case 'commit': return a.owner === 'base' ? c.baseCommit(text(a.message, 'Mensagem', 65536)) : c.commit(owner(a.owner), text(a.message, 'Mensagem', 65536));
    case 'diff': return c.diff(owner(a.owner), a.staged === true, a.paths === undefined ? [] : paths(a.paths));
    case 'hunks': return c.diffHunks(owner(a.owner), relative(a.path), a.staged === true);
    case 'stageHunk': {
      if (!Number.isSafeInteger(a.index) || Number(a.index) < 0) throw new Error('Hunk inválido.');
      return c.partialStage(owner(a.owner), relative(a.path), Number(a.index), text(a.token, 'Token', 512));
    }
    case 'unstageHunk': {
      if (!Number.isSafeInteger(a.index) || Number(a.index) < 0) throw new Error('Hunk inválido.');
      return c.partialUnstage(owner(a.owner), relative(a.path), Number(a.index), text(a.token, 'Token', 512));
    }
    case 'restore': if (a.confirmed !== true) throw new Error('Restauração exige confirmação.'); return c.restore(owner(a.owner), paths(a.paths), true);
    case 'log': return c.log(a.owner === undefined ? undefined : owner(a.owner));
    case 'show': return c.show(text(a.rev, 'Revisão', 256));
    case 'compare': return c.compare(text(a.from, 'Revisão inicial', 256), text(a.to, 'Revisão final', 256));
    case 'captureStart': return c.captureStart(owner(a.name), text(a.scope ?? '', 'Escopo'));
    case 'captureReview': return c.captureReview();
    case 'captureConfirm': return c.captureConfirm(paths(a.paths));
    case 'captureCancel': return c.captureCancel();
    case 'branches': return c.branches();
    case 'branchCreate': return c.branchCreate(text(a.name, 'Branch', 160));
    case 'branchDelete': return c.branchDelete(text(a.name, 'Branch', 160));
    case 'switch': return c.switch(text(a.name, 'Branch', 160));
    case 'doctor': return c.doctor(a.fsck === true);
    case 'recover': return c.recover();
    case 'identity': {
      if (a.consent !== true) throw new Error('Configuração local de identidade exige consentimento.');
      return c.configureIdentity(text(a.name, 'Nome', 200), text(a.email, 'E-mail', 320));
    }
    case 'drafts': return drafts();
    case 'draftSave': {
      const p = relative(a.path);
      const draft: Draft = { schema: 1, path: p, text: text(a.text, 'Rascunho', 8 * 1024 * 1024), hash: text(a.hash, 'Hash', 256), eol: text(a.eol, 'EOL', 20), savedAt: new Date().toISOString() };
      const target = path.join(await draftDir(true), `${createHash('sha256').update(p).digest('hex')}.json`);
      await replaceFile(target, JSON.stringify(draft));
      return null;
    }
    case 'draftRemove': {
      const target = path.join(await draftDir(true), `${createHash('sha256').update(relative(a.path)).digest('hex')}.json`);
      await fs.rm(target, { force: true }); return null;
    }
    case 'exportRecovery': {
      const picked = await dialog.showOpenDialog(win!, { title: 'Escolher diretório vazio para exportar recuperação', properties: ['openDirectory', 'createDirectory'] });
      if (picked.canceled || !picked.filePaths[0]) return null;
      return c.exportRecovery(picked.filePaths[0]);
    }
    case 'advanced': {
      const actionName = text(a.action, 'Ação', 40);
      const allowed = new Set(['amend', 'tag', 'tag-delete', 'stash', 'stash-pop', 'stash-list', 'merge', 'merge-abort', 'merge-continue', 'cherry-pick', 'cherry-pick-abort', 'cherry-pick-continue', 'revert', 'revert-abort', 'revert-continue']);
      if (!allowed.has(actionName)) throw new Error('Operação Git avançada não permitida.');
      if (!Array.isArray(a.args) || a.args.length > 4) throw new Error('Argumentos inválidos.');
      return c.advanced(actionName, a.args.map(v => text(v, 'Argumento', 65536)));
    }
    default: throw new Error('Operação IPC não permitida.');
  }
}
function validSender(event: IpcMainInvokeEvent): boolean {
  return !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === UI_URL;
}
ipcMain.handle('lab:request', (event, action: unknown, args: unknown): Promise<APIResult> => {
  if (!validSender(event)) return Promise.resolve({ ok: false, error: { code: 'IPC_SENDER', message: 'Emissor IPC recusado.' } });
  const execute = async (): Promise<APIResult> => {
    try {
      const output = await request(text(action, 'Ação', 64), args);
      const encoded = JSON.stringify(output ?? null);
      if (encoded.length > 24 * 1024 * 1024) throw new Error('Resultado excede o limite de exibição.');
      return { ok: true, data: JSON.parse(encoded) as unknown };
    } catch (error) {
      const e = error as Error & { code?: string; details?: unknown };
      return { ok: false, error: { code: e.code ?? 'DESKTOP_ERROR', message: e.message ?? String(error), details: e.details } };
    }
  };
  // These synchronous operations touch only the current PTY/clipboard. Input
  // and Ctrl+C must not wait behind filesystem scans or Git/fsck subprocesses.
  // Session creation, closing and workspace changes remain serialized.
  if (typeof action === 'string' && ['terminalWrite', 'terminalResize', 'terminalState', 'copyCommand', 'copyRelativePath'].includes(action)) return execute();
  const job = queue.then(execute);
  queue = job.catch(() => undefined);
  return job;
});

app.whenReady().then(async () => {
  if (!ownsInstance) return;
  Menu.setApplicationMenu(null);
  const rendererRoot = path.resolve(here, '../../renderer');
  protocol.handle('gitlayers', async request => {
    const url = new URL(request.url);
    if (url.host !== 'app' || !['GET', 'HEAD'].includes(request.method)) return new Response('Acesso recusado', { status: 403 });
    let decoded: string;
    try { decoded = decodeURIComponent(url.pathname); } catch { return new Response('Caminho inválido', { status: 400 }); }
    const full = path.resolve(rendererRoot, `.${decoded}`);
    const rel = path.relative(rendererRoot, full);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || decoded.includes('\0') || decoded.includes('\\')) return new Response('Acesso recusado', { status: 403 });
    return net.fetch(pathToFileURL(full).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const scheme = new URL(details.url).protocol;
    callback({ cancel: !['gitlayers:', 'file:', 'devtools:', 'blob:', 'data:'].includes(scheme) });
  });
  const argument = process.argv.find(v => v.startsWith('--repo='));
  try {
    const last = argument ? { root: argument.slice(7) } : JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'last-repo.json'), 'utf8')) as { root: string };
    if (typeof last.root === 'string') core = await GitLayers.open(last.root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') startupError = `Não foi possível reabrir a última pasta: ${(error as Error).message}. Use Abrir pasta para escolher um repositório.`;
  }
  win = new BrowserWindow({ width: 1440, height: 960, minWidth: 980, minHeight: 680, title: 'Git Layers Lab', backgroundColor: '#11151b', webPreferences: { preload: path.join(here, '../preload/index.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false } });
  app.on('second-instance', () => { if (win?.isMinimized()) win.restore(); win?.focus(); });
  win.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') dialog.showErrorBox('Git Layers Lab — interface interrompida', 'A interface do editor foi encerrada. Reabra o aplicativo. Os arquivos gravados no disco continuam no repositório; rascunhos já preservados serão recuperados ao abrir a pasta.');
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== UI_URL) event.preventDefault(); });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.on('close', event => {
    if (!permitClose && dirtyCount) {
      event.preventDefault();
      if (dialog.showMessageBoxSync(win!, { type: 'question', title: 'Buffers ainda não salvos', message: 'Há arquivos não salvos no editor.', detail: 'Os rascunhos serão preservados antes de fechar. Use Cancelar para salvar os arquivos no disco.', buttons: ['Cancelar', 'Fechar e manter rascunhos'], defaultId: 0, cancelId: 0 }) === 1) win!.webContents.send('lab:before-close');
    }
  });
  await win.loadURL(UI_URL);
  // Only the local development parent owns this process channel. This is not
  // renderer IPC and is absent from the packaged application.
  if (!app.isPackaged && process.send) process.on('message', message => {
    if (message && typeof message === 'object' && 'type' in message && message.type === 'lab:development-restart') {
      if (dirtyCount) win?.webContents.send('lab:before-close');
      else app.quit();
    }
  });
  if (!app.isPackaged && process.send) process.send({ type: 'lab:development-ready', visible: win.isVisible() });
  await watchWorkspace();
}).catch(error => {
  console.error('Falha ao iniciar o editor:', error);
  dialog.showErrorBox('Git Layers Lab — falha ao iniciar', `${(error as Error).message ?? String(error)}\n\nExtraia a pasta completa do ZIP antes de abrir git-layers-lab.exe. Consulte docs/WINDOWS.md.`);
  app.quit();
});
app.on('window-all-closed', () => { for (const watcher of watchers) watcher.close(); void closeTerminal().finally(() => app.quit()); });
app.on('before-quit', event => {
  if (terminal) { event.preventDefault(); void closeTerminal().finally(() => app.quit()); }
});
