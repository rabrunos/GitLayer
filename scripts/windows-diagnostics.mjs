#!/usr/bin/env node
/** Local installation report. Never opens or mutates a user repository. */
import { access, mkdir, open, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function parseDiagnosticArguments(argv) {
  if (!argv.length) return {};
  if (argv.length === 2 && argv[0] === '--output' && argv[1] && !argv[1].includes('\0')) return { output: resolve(argv[1]) };
  throw new Error('Uso: diagnostico [--output <arquivo.json>]');
}

async function runtimeModule(file) {
  // Packaged: resources/cli/{core,diagnostics.mjs}. Development: scripts/../dist/core.
  const beside = new URL(`./core/${file}`, import.meta.url);
  try { await access(beside, constants.R_OK); return import(beside.href); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return import(new URL(`../dist/core/${file}`, import.meta.url).href);
  }
}

export async function runWindowsDiagnostics(argv = process.argv.slice(2)) {
  const args = parseDiagnosticArguments(argv);
  const report = {
    schema: 1, application: 'Git Layers Lab', version: '0.1.2',
    at: new Date().toISOString(),
    target: { platform: 'win32', arch: 'x64', operatingSystems: ['Windows 10', 'Windows 11'] },
    runtime: { platform: process.platform, arch: process.arch, node: process.versions.node, electron: process.versions.electron ?? null },
    git: { found: false }, ready: false, scope: 'Pre-requisitos locais; nao acessa repositorios e nao e um teste completo da interface.',
  };
  try {
    const [{ resolveGitExecutable }, { gitText }] = await Promise.all([runtimeModule('platform.js'), runtimeModule('git.js')]);
    const executable = await resolveGitExecutable();
    const version = await gitText(tmpdir(), ['version']);
    const match = /git version (\d+)\.(\d+)/i.exec(version);
    const supportedVersion = !!match && (Number(match[1]) > 2 || (Number(match[1]) === 2 && Number(match[2]) >= 43));
    report.git = { found: true, executable, version, minimum: '2.43', supportedVersion };
    report.ready = process.platform === 'win32' && process.arch === 'x64' && supportedVersion;
    if (process.platform !== 'win32' || process.arch !== 'x64') report.message = 'Este pacote e destinado ao Windows 10/11 x64. Nenhum teste Windows foi executado nesta plataforma.';
    else if (!supportedVersion) report.message = 'Atualize o Git for Windows para a versao 2.43 ou superior e reabra o aplicativo.';
    else report.message = 'Runtime Windows x64 e Git encontrados. Abra git-layers-lab.exe; o diagnostico nao substitui a verificacao da interface.';
  } catch (error) {
    report.error = { code: error.code ?? 'DIAGNOSTIC_FAILED', message: error.message ?? String(error) };
    report.message = 'Instale o Git for Windows em https://git-scm.com/download/win e reabra o aplicativo. Se ja instalado, consulte o erro acima.';
  }
  const json = JSON.stringify(report, null, 2) + '\n';
  if (args.output) {
    await mkdir(dirname(args.output), { recursive: true });
    const temporary = `${args.output}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(json, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    try { await rename(temporary, args.output); }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  process.stdout.write(json);
  return report.ready ? 0 : report.git.found && report.git.supportedVersion ? 2 : 4;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runWindowsDiagnostics().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(JSON.stringify({ schema: 1, ready: false, error: { code: error.code ?? 'DIAGNOSTIC_ARGUMENTS', message: error.message } }) + '\n');
    process.exitCode = 2;
  });
}
