import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject } from './build.mjs';
import { ensureWorkshopDemo, parseWorkshopArguments } from './workshop.mjs';
import { ensureNoDevelopmentSession, recordDevelopmentSession, clearDevelopmentSession } from './development-session.mjs';
import { DEVELOPMENT_INPUTS, developmentInputFingerprint } from './development-inputs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await ensureNoDevelopmentSession(root);
const executable = (await import('electron')).default;
const debug = process.argv.includes('--debug');
const options = parseWorkshopArguments(['start', ...process.argv.slice(2).filter(value => value !== '--debug')]);
const repo = options.repo ?? (await ensureWorkshopDemo(root)).root;
const profile = options.profile ?? path.join(root, '.workshop/profiles/debug');
if (debug) for (const port of [9229, 9222]) await new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', () => reject(new Error(`A porta local ${port} já está em uso. Conecte à sessão existente ou feche-a antes de iniciar Debug.`)));
  server.listen(port, '127.0.0.1', () => server.close(resolve));
});
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS'].includes(key.toUpperCase())));
let child, stopping = false, rebuilding = false, pending = false, timer;
const watchers = [];
let lastInputs = await developmentInputFingerprint(root);
function launch() {
  let ready = false;
  // On Windows SW_HIDE also hides Electron's first GUI window, even though
  // BrowserWindow defaults to show:true. Only console helpers use windowsHide.
  child = spawn(executable, [...(debug ? ['--inspect=127.0.0.1:9229', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9222'] : []), path.join(root, 'dist-debug'), '--repo=' + repo, '--lab-profile=' + profile], { cwd: root, env, windowsHide: false, stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
  child.on('spawn', () => console.log(`Iniciando Electron (PID ${child.pid})...`));
  child.on('message', message => {
    if (!message || message.type !== 'lab:development-ready') return;
    ready = message.visible === true;
    if (ready) console.log(`Editor aberto: ${repo}`);
    else {
      console.error('O Electron carregou a interface, mas a janela não está visível.');
      void stop(1);
    }
  });
  child.on('error', error => { console.error(error); void stop(1); });
  child.on('close', code => {
    if (!rebuilding && !stopping) {
      if (!ready) console.error(`O Electron encerrou antes de abrir a janela (código ${code ?? 'desconhecido'}).`);
      void stop(ready ? code ?? 1 : 1);
    }
  });
}
async function closeApp() {
  if (!child || child.exitCode !== null) return;
  const closed = once(child, 'close');
  child.send({ type: 'lab:development-restart' });
  let timeout;
  try {
    await Promise.race([closed, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('A interface não confirmou a preservação dos rascunhos. Feche a janela antes de recompilar.')), 15000); })]);
  } finally { clearTimeout(timeout); }
}
async function rebuild() {
  if (rebuilding || stopping) { pending = true; return; }
  rebuilding = true; pending = false;
  const started = Date.now();
  try {
    const inputs = await developmentInputFingerprint(root);
    if (inputs === lastInputs && child?.exitCode === null && child?.signalCode === null) return;
    await closeApp();
    await buildProject({ debug: true, incremental: true });
    lastInputs = inputs;
    if (!stopping) launch();
    console.log(`Atualizado em ${Date.now() - started} ms. Fontes TypeScript em dist-debug; aguardando alterações.`);
  } catch (error) { console.error(error.stack ?? error); }
  finally { rebuilding = false; if (pending && !stopping) void rebuild(); }
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true; clearTimeout(timer);
  for (const watcher of watchers) watcher.close();
  try { await closeApp(); } catch (error) { console.error(error.message); code = 1; }
  process.exitCode = code;
  await clearDevelopmentSession(root);
}
for (const target of DEVELOPMENT_INPUTS) {
  watchers.push(watch(target, { recursive: target === 'src' }, () => {
    clearTimeout(timer); timer = setTimeout(() => void rebuild(), 300);
  }));
}
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
console.log('Desenvolvimento local: salvar fontes recompila e reinicia; buffers viram rascunhos recuperáveis. Fechar a janela encerra a tarefa.');
await recordDevelopmentSession(root, { repo, profile, debug });
launch();
