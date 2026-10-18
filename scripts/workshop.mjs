#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
export function defaultWorkshopRepository(root = PROJECT_ROOT) {
  return process.platform === 'win32' && path.resolve(root) === path.resolve(PROJECT_ROOT)
    ? 'C:\\Dev\\GitLayerTest'
    : path.join(root, '.workshop', 'repositories', 'demo');
}
const commands = new Set(['doctor', 'prepare', 'start', 'debug', 'smoke', 'verify', 'help']);

export function parseWorkshopArguments(argv) {
  const command = argv[0] ?? 'help';
  if (!commands.has(command)) throw new Error('Comando desconhecido. Use npm run workshop:doctor ou node scripts/workshop.mjs help.');
  const result = { command, noBuild: false, renderer: false };
  const used = new Set();
  for (let i = 1; i < argv.length; i++) {
    const option = argv[i];
    if (used.has(option)) throw new Error('Opção repetida: ' + option);
    used.add(option);
    if (option === '--no-build' && ['start', 'debug', 'smoke'].includes(command)) { result.noBuild = true; continue; }
    if (option === '--renderer' && command === 'debug') { result.renderer = true; continue; }
    if (['--repo', '--profile'].includes(option) && ['start', 'debug'].includes(command)) {
      const value = argv[++i];
      if (!value || value.startsWith('--') || /[\0\r\n]/u.test(value)) throw new Error('Informe uma pasta para ' + option);
      result[option.slice(2)] = path.resolve(value); continue;
    }
    throw new Error('Opção inválida para ' + command + ': ' + option);
  }
  return result;
}

export async function runProcess(executable, args, { root = PROJECT_ROOT, env = process.env, capture = false, windowsHide = true } = {}) {
  return await new Promise(resolve => {
    const started = Date.now();
    const output = [], errors = [];
    let failure;
    const child = spawn(executable, args, { cwd: root, env, shell: false, windowsHide, stdio: ['inherit', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { output.push(chunk); if (!capture) process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { errors.push(chunk); if (!capture) process.stderr.write(chunk); });
    child.on('error', error => { failure = error.message; });
    const interrupt = () => {
      if (child.exitCode !== null || !child.pid) return;
      if (process.platform === 'win32') {
        spawn(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false });
      } else child.kill('SIGTERM');
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    child.once('close', (exitCode, signal) => {
      process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
      resolve({ exitCode, signal, error: failure, durationMs: Date.now() - started, stdout: Buffer.concat(output).toString('utf8'), stderr: Buffer.concat(errors).toString('utf8') });
    });
  });
}

async function jsonReport(root, name, value) {
  const reports = path.join(root, '.workshop', 'reports');
  await mkdir(reports, { recursive: true });
  await writeFile(path.join(reports, name + '.json'), JSON.stringify(value, null, 2) + '\n');
  return path.join(reports, name + '.json');
}

async function compiledModules(root, preferred = 'dist-debug') {
  for (const dir of [preferred, preferred === 'dist' ? 'dist-debug' : 'dist']) {
    try {
      await access(path.join(root, dir, 'core', 'index.js'));
      return { dir, core: await import(pathToFileURL(path.join(root, dir, 'core', 'index.js')).href), git: await import(pathToFileURL(path.join(root, dir, 'core', 'git.js')).href), platform: await import(pathToFileURL(path.join(root, dir, 'core', 'platform.js')).href) };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('Core compilado ausente. Execute npm ci e npm run build:debug.');
}

export async function inspectWorkshop(root = PROJECT_ROOT) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const [major, minor] = process.versions.node.split('.').map(Number);
  const report = { schema: 1, command: 'doctor', at: new Date().toISOString(), version: pkg.version, platform: process.platform, osRelease: os.release(), arch: process.arch, node: process.versions.node, nodeExecutable: process.execPath, target: 'Windows 10/11 x64', guiValidated: false, checks: [], ready: false };
  report.checks.push({ name: 'node', ok: major > 22 || major === 22 && minor >= 12, detail: 'Node >=22.12 para desenvolvimento' });
  for (const dep of ['typescript', 'electron', 'playwright', 'node-pty', '@xterm/xterm', '@xterm/addon-fit']) {
    try {
      const metadata = JSON.parse(await readFile(path.join(root, 'node_modules', dep, 'package.json'), 'utf8'));
      report.checks.push({ name: dep, ok: true, version: metadata.version });
    } catch (error) { report.checks.push({ name: dep, ok: false, detail: 'Execute npm ci.', error: error.code }); }
  }
  try {
    const { platform, git } = await compiledModules(root);
    const executable = await platform.resolveGitExecutable();
    const version = await git.gitText(os.tmpdir(), ['version']);
    const match = /git version (\d+)\.(\d+)/u.exec(version);
    const ok = !!match && (+match[1] > 2 || +match[1] === 2 && +match[2] >= 43);
    report.checks.push({ name: 'git', ok, executable, version, detail: 'Git >=2.43' });
  } catch (error) { report.checks.push({ name: 'git', ok: false, detail: error.message }); }
  try {
    const electron = (await import('electron')).default;
    await access(electron);
    report.checks.push({ name: 'electron-binary', ok: true, executable: electron, detail: 'Arquivo presente; não é teste de abertura da janela.' });
  } catch (error) { report.checks.push({ name: 'electron-binary', ok: false, detail: error.message }); }
  if (process.platform === 'win32') {
    const build = Number(os.release().split('.')[2]);
    report.checks.push({ name: 'windows-terminal', ok: build >= 18362 && process.arch === 'x64', detail: 'Terminal ConPTY: Windows 10 1903+ ou Windows 11 x64', build });
    const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const shell = await runProcess(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], { root, capture: true });
    report.checks.push({ name: 'powershell', ok: shell.exitCode === 0, executable: powershell, version: shell.stdout.trim(), error: shell.error ?? (shell.exitCode ? shell.stderr : undefined) });
    const source = `const pty=require('node-pty');let output='';const timer=setTimeout(()=>{try{terminal.kill()}catch{};console.error('ConPTY probe timed out');setTimeout(()=>process.exit(1),1000)},10000);const terminal=pty.spawn(${JSON.stringify(powershell)},['-NoLogo','-NoProfile','-Command',"Write-Output 'GitLayersConPTYProbe'"],{name:'xterm-256color',cols:100,rows:25,cwd:require('node:os').tmpdir(),env:process.env,useConpty:true});terminal.onData(data=>output+=data);terminal.onExit(event=>{clearTimeout(timer);const ok=event.exitCode===0&&output.includes('GitLayersConPTYProbe');console.log(JSON.stringify({ok,exitCode:event.exitCode,module:require.resolve('node-pty')}));process.exit(ok?0:1)});`;
    const probe = await runProcess(process.execPath, ['-e', source], { root, capture: true });
    report.checks.push({ name: 'native-conpty', ok: probe.exitCode === 0, detail: probe.stdout.trim(), error: probe.error ?? (probe.exitCode ? probe.stderr : undefined) });
  } else report.note = 'Diagnóstico executado no host atual. Não comprova execução nativa Windows.';
  report.ready = report.checks.every(check => check.ok);
  return report;
}

/** Idempotent: existing demo repositories and all their edits are preserved. */
export async function ensureWorkshopDemo(root = PROJECT_ROOT) {
  const demo = defaultWorkshopRepository(root);
  await mkdir(path.dirname(demo), { recursive: true });
  let entries = [];
  try { entries = await readdir(demo); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { core, dir } = await compiledModules(root);
  if (entries.length) {
    const marker = await lstat(path.join(demo, '.git')).catch(() => null);
    if (!marker?.isDirectory() || marker.isSymbolicLink()) throw new Error('A pasta de demonstração já contém arquivos e não é o repositório esperado. Ela foi preservada: ' + demo);
    const existing = await core.GitLayers.open(demo);
    const canonical = await realpath(demo);
    const compare = value => process.platform === 'win32' ? value.toLowerCase() : value;
    if (compare(existing.repo.root) !== compare(canonical)) throw new Error('Raiz da demonstração inesperada; nenhuma reinicialização foi feita.');
    return { root: demo, reused: true };
  }
  const { createDemo } = await import(pathToFileURL(path.join(root, dir, 'core', 'demo.js')).href);
  await createDemo(demo);
  return { root: demo, reused: false };
}

async function buildDebug(root) {
  const outcome = await runProcess(process.execPath, [path.join(root, 'scripts', 'build-debug.mjs')], { root });
  if (outcome.exitCode !== 0) throw new Error('Build de debug falhou: ' + (outcome.error ?? outcome.signal ?? outcome.exitCode));
}

export async function smokeWorkshop(root = PROJECT_ROOT, { noBuild = false } = {}) {
  if (!noBuild) await buildDebug(root);
  const modules = await compiledModules(root);
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'git-layers-workshop-smoke-'));
  const repo = path.join(temporary, 'repository com espaço ação');
  const { createDemo } = await import(pathToFileURL(path.join(root, modules.dir, 'core', 'demo.js')).href);
  const stages = [];
  try {
    await createDemo(repo);
    const core = await modules.core.GitLayers.open(repo);
    const file = 'notas/experiência.txt';
    await core.writeFile(file, 'conteúdo real\r\n');
    for (const args of [
      ['status', '--json'],
      ['create', 'workshop-check', '--json'],
      ['on', 'workshop-check', '--json'],
      ['add', 'workshop-check', '--json', '--', file],
      ['commit', 'workshop-check', '-m', 'Smoke do workshop', '--json'],
      ['off', 'workshop-check', '--json'],
      ['on', 'workshop-check', '--json'],
      ['doctor', '--fsck', '--json'],
    ]) {
      const outcome = await runProcess(process.execPath, [path.join(root, modules.dir, 'cli', 'index.js'), '--cwd', repo, ...args], { root, capture: true });
      let data;
      try { data = JSON.parse(outcome.stdout); } catch { /* Non-JSON failure below retains process output. */ }
      stages.push({ command: args, exitCode: outcome.exitCode, signal: outcome.signal, durationMs: outcome.durationMs });
      if (outcome.exitCode !== 0 || data?.ok !== true) throw new Error('CLI falhou: ' + JSON.stringify({ args, ...outcome }));
      if (args[0] === 'doctor' && data.result?.safe !== true) throw new Error('doctor recusou a composição.');
    }
    const actual = await readFile(path.join(repo, file), 'utf8');
    if (actual !== 'conteúdo real\r\n') throw new Error('Bytes CRLF não foram preservados.');
    const head = await modules.git.gitText(repo, ['symbolic-ref', 'HEAD']);
    if (head !== 'refs/heads/main') throw new Error('HEAD da base mudou.');
    const blob = await modules.git.gitText(repo, ['show', 'layer/workshop-check:' + file]);
    if (blob !== 'conteúdo real') throw new Error('Blob real da Layer não corresponde ao conteúdo.');
    const result = { schema: 1, status: 'passed', platform: process.platform, arch: process.arch, at: new Date().toISOString(), git: await modules.git.gitText(repo, ['version']), stages, head, physicalCrLfPreserved: true, realLayerBlobChecked: true, gui: 'Não executada por este smoke.' };
    await jsonReport(root, 'smoke', result);
    return result;
  } catch (error) {
    await jsonReport(root, 'smoke', { schema: 1, status: 'failed', platform: process.platform, at: new Date().toISOString(), stages, error: { message: error.message, stack: error.stack } });
    throw error;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function launchWorkshop(root, options) {
  if (!options.noBuild) await buildDebug(root);
  const repo = options.repo ?? (await ensureWorkshopDemo(root)).root;
  const profile = options.profile ?? path.join(root, '.workshop', 'profiles', 'debug');
  await mkdir(profile, { recursive: true });
  const executable = (await import('electron')).default;
  const args = [];
  if (options.command === 'debug') args.push('--inspect=127.0.0.1:9229');
  if (options.renderer) args.push('--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9222');
  args.push(path.join(root, 'dist-debug'), '--repo=' + repo, '--lab-profile=' + profile);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE'));
  env.ELECTRON_ENABLE_LOGGING = '1';
  const outcome = await runProcess(executable, args, { root, env, windowsHide: false });
  const { stdout, stderr, ...summary } = outcome;
  const reports = path.join(root, '.workshop', 'reports');
  await mkdir(reports, { recursive: true });
  await writeFile(path.join(reports, 'desktop.stdout.log'), stdout);
  await writeFile(path.join(reports, 'desktop.stderr.log'), stderr);
  await jsonReport(root, 'desktop', { ...summary, status: outcome.exitCode === 0 ? 'closed' : 'failed', at: new Date().toISOString(), platform: process.platform, command: options.command, repo, profile, args, sandboxDisabled: false });
  return outcome.exitCode ?? 1;
}

export async function runWorkshop(argv = process.argv.slice(2), root = PROJECT_ROOT) {
  const options = parseWorkshopArguments(argv);
  switch (options.command) {
    case 'doctor': {
      const report = await inspectWorkshop(root);
      await jsonReport(root, 'doctor', report); console.log(JSON.stringify(report, null, 2));
      return report.ready ? 0 : 1;
    }
    case 'prepare': {
      await buildDebug(root);
      const demo = await ensureWorkshopDemo(root);
      await jsonReport(root, 'prepare', { status: 'passed', at: new Date().toISOString(), ...demo, platform: process.platform });
      console.log('Debug pronto. Demonstração ' + (demo.reused ? 'preservada: ' : 'criada: ') + demo.root);
      return 0;
    }
    case 'start': case 'debug': return launchWorkshop(root, options);
    case 'smoke': console.log(JSON.stringify(await smokeWorkshop(root, options), null, 2)); return 0;
    case 'verify': {
      for (const args of [['node_modules/typescript/bin/tsc', '--noEmit'], ['--import', 'tsx', '--test', '--test-concurrency=2', '--test-timeout=180000', 'tests/unit/*.test.ts', 'tests/unit/*.test.mjs', 'tests/integration/*.test.ts', 'tests/integration/*.test.mjs']]) {
        const result = await runProcess(process.execPath, args, { root });
        if (result.exitCode !== 0) return result.exitCode ?? 1;
      }
      await smokeWorkshop(root);
      const maps = await runProcess(process.execPath, ['scripts/verify-debug-build.mjs'], { root });
      return maps.exitCode ?? 1;
    }
    default:
      console.log('Workshop local — doctor | prepare | start | debug | smoke | verify\nstart/debug: [--repo <pasta>] [--profile <pasta>] [--no-build]\ndebug: [--renderer] abre inspeção do renderer apenas em 127.0.0.1:9222.\nsmoke: [--no-build]. UI completa: npm run workshop:ui.\nVS Code: abra Git-Layers-Lab.code-workspace, escolha Desktop e pressione F5.');
      return 0;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = await runWorkshop(); }
  catch (error) { console.error(error.stack ?? error); process.exitCode = 1; }
}

