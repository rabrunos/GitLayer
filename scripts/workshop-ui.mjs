import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Run one real subprocess, preserving failures and both output streams. */
export async function runUiStage(command, args, { cwd, env, stdout, stderr }) {
  return await new Promise(resolve => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let error;
    child.stdout.on('data', chunk => { stdout.push(chunk); process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { stderr.push(chunk); process.stderr.write(chunk); });
    child.once('error', failure => { error = failure.message; });
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal, error, durationMs: Date.now() - started }));
  });
}

/** Local source UI test: no packaging, dev server or sandbox bypass required. */
export async function runWorkshopUi({ argv = [], root = fileURLToPath(new URL('../', import.meta.url)), env = process.env, electronExecutable } = {}) {
  if (argv.some(value => value !== '--no-build') || argv.filter(value => value === '--no-build').length > 1) {
    throw new Error('Uso: node scripts/workshop-ui.mjs [--no-build]');
  }
  root = path.resolve(root);
  const reports = path.join(root, '.workshop', 'reports');
  await mkdir(reports, { recursive: true });
  const files = { report: path.join(reports, 'ui.json'), stdout: path.join(reports, 'ui.stdout.log'), stderr: path.join(reports, 'ui.stderr.log'), evidence: path.join(reports, 'ui-evidence.json') };
  const stdout = [], stderr = [];
  const report = { status: 'running', startedAt: new Date().toISOString(), platform: process.platform, arch: process.arch, phase: 'prepare', sandboxDisabled: false, stages: [], output: { stdout: path.relative(root, files.stdout), stderr: path.relative(root, files.stderr), evidence: path.relative(root, files.evidence) } };
  await rm(files.evidence, { force: true });
  await rm(path.join(reports, 'ui-desktop.png'), { force: true });
  await writeFile(files.report, JSON.stringify(report, null, 2) + '\n');
  let exitCode = 1;
  try {
    // A developer terminal may itself run in Electron's Node mode. The child UI must not.
    const childEnv = Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE'));
    if (!argv.includes('--no-build')) {
      report.phase = 'build-debug';
      const result = await runUiStage(process.execPath, [path.join(root, 'scripts', 'build-debug.mjs')], { cwd: root, env: childEnv, stdout, stderr });
      report.stages.push({ name: 'build-debug', ...result });
      if (result.exitCode !== 0) { exitCode = result.exitCode || 1; throw new Error(`Build de debug falhou: ${result.error || result.signal || `código ${result.exitCode}`}`); }
    }
    report.phase = 'resolve-electron';
    const executable = electronExecutable || (await import('electron')).default;
    if (typeof executable !== 'string' || !executable) throw new Error('Electron local não encontrado. Execute npm ci na pasta do workshop.');
    report.phase = 'desktop-e2e';
    const result = await runUiStage(process.execPath, ['--test', path.join(root, 'tests', 'e2e', 'desktop.test.mjs')], {
      cwd: root,
      env: { ...childEnv, LAB_E2E_APP: path.join(root, 'dist-debug'), LAB_E2E_DIST: path.join(root, 'dist-debug'), LAB_E2E_EXECUTABLE: executable, LAB_E2E_REPORT_FILE: files.evidence },
      stdout, stderr,
    });
    report.stages.push({ name: 'desktop-e2e', ...result });
    if (result.exitCode !== 0) { exitCode = result.exitCode || 1; throw new Error(`Teste da interface falhou: ${result.error || result.signal || `código ${result.exitCode}`}. Consulte ui-evidence.json e os logs.`); }
    report.status = 'passed'; report.phase = 'complete'; exitCode = 0;
  } catch (error) {
    report.status = 'failed'; report.error = { name: error.name, message: error.message, stack: error.stack };
    stderr.push(Buffer.from(`${error.stack || error}\n`));
    process.stderr.write(`${error.message}\n`);
  } finally {
    report.exitCode = exitCode;
    report.finishedAt = new Date().toISOString();
    await writeFile(files.stdout, Buffer.concat(stdout));
    await writeFile(files.stderr, Buffer.concat(stderr));
    await writeFile(files.report, JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(`Relatório da interface: ${files.report}\n`);
  }
  return { exitCode, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = (await runWorkshopUi({ argv: process.argv.slice(2) })).exitCode; }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
