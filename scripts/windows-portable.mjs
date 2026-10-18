/** Windows portable payload. This module only uses Node built-ins and never changes PATH. */
import { cp, chmod, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const WINDOWS_EXECUTABLE = 'git-layers-lab.exe';
export const WINDOWS_PTY_NATIVE_FILES = [
  'prebuilds/win32-x64/conpty.node', 'prebuilds/win32-x64/pty.node',
  'prebuilds/win32-x64/conpty_console_list.node', 'prebuilds/win32-x64/winpty.dll',
  'prebuilds/win32-x64/winpty-agent.exe', 'prebuilds/win32-x64/conpty/conpty.dll',
  'prebuilds/win32-x64/conpty/OpenConsole.exe',
];
export const PTY_RUNTIME_JS_FILES = [
  'lib/index.js', 'lib/terminal.js', 'lib/eventEmitter2.js', 'lib/utils.js',
  'lib/windowsTerminal.js', 'lib/windowsPtyAgent.js', 'lib/windowsConoutConnection.js',
  'lib/conpty_console_list_agent.js', 'lib/shared/conout.js',
  'lib/worker/conoutSocketWorker.js',
];
export const WINDOWS_PTY_MODULE = 'resources/app.asar.unpacked/node_modules/node-pty';
export const WINDOWS_REQUIRED_FILES = [
  WINDOWS_EXECUTABLE, 'chrome_100_percent.pak', 'chrome_200_percent.pak',
  'd3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'ffmpeg.dll', 'icudtl.dat',
  'resources.pak', 'v8_context_snapshot.bin', 'snapshot_blob.bin',
  'vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll', 'LICENSE', 'LICENSES.chromium.html',
  'locales/en-US.pak', 'locales/pt-BR.pak', 'resources/app.asar', 'resources/cli/package.json',
  'resources/cli/cli/index.js', 'resources/cli/core/index.js', 'resources/cli/diagnostics.mjs',
  'git-layer.cmd', 'git-layer', 'Diagnostico.cmd',
  ...['package.json', 'LICENSE', 'deps/winpty/LICENSE', ...PTY_RUNTIME_JS_FILES, ...WINDOWS_PTY_NATIVE_FILES]
    .map(relative => `${WINDOWS_PTY_MODULE}/${relative}`),
];

/** Stage only executable runtime code and the requested architecture's binaries.
 * node-addon-api provides C++ headers; no shipped JS imports it at runtime.
 * The original package metadata and licenses are retained without modification.
 */
export async function stageTerminalRuntime(staging, { projectRoot, platform, arch }) {
  const source = join(projectRoot, 'node_modules', 'node-pty');
  const destination = join(staging, 'node_modules', 'node-pty');
  const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  if (pkg.name !== 'node-pty' || pkg.version !== '1.1.0') throw new Error('O terminal exige node-pty 1.1.0 com prebuilds N-API verificados.');
  await mkdir(destination, { recursive: true });
  for (const relative of ['package.json', 'LICENSE', 'README.md', 'deps/winpty/LICENSE']) {
    await mkdir(dirname(join(destination, relative)), { recursive: true });
    await cp(join(source, relative), join(destination, relative));
  }
  await cp(join(source, 'lib'), join(destination, 'lib'), {
    recursive: true,
    filter: path => !path.endsWith('.map') && !path.endsWith('.test.js'),
  });
  const binaries = platform === 'win32'
    ? WINDOWS_PTY_NATIVE_FILES
    : platform === 'darwin'
      ? [`prebuilds/darwin-${arch}/pty.node`, `prebuilds/darwin-${arch}/spawn-helper`]
      : ['build/Release/pty.node', 'build/Release/spawn-helper'];
  if (platform === 'win32' && arch !== 'x64') throw new Error('O terminal portátil Windows suporta somente x64.');
  for (const relative of binaries) {
    await mkdir(dirname(join(destination, relative)), { recursive: true });
    await cp(join(source, relative), join(destination, relative));
    if (platform === 'win32') readWindowsPE(await readFile(join(destination, relative)));
  }
  return { name: pkg.name, version: pkg.version, platform, arch, binaries };
}

export function windowsCliLauncher() {
  // setlocal keeps Electron's Node mode scoped to this single CLI invocation.
  // Do not cd: the caller's current directory is the target Git repository.
  return '@echo off\r\nsetlocal\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n"%~dp0git-layers-lab.exe" "%~dp0resources\\cli\\cli\\index.js" %*\r\nexit /b %ERRORLEVEL%\r\n';
}

export function gitBashCliLauncher() {
  return '#!/bin/sh\nset -eu\nSCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nELECTRON_RUN_AS_NODE=1 exec "$SCRIPT_DIR/git-layers-lab.exe" "$SCRIPT_DIR/resources/cli/cli/index.js" "$@"\n';
}

export function diagnosticLauncher() {
  return '@echo off\r\nsetlocal\r\nset "ELECTRON_RUN_AS_NODE=1"\r\nset "REPORT=%TEMP%\\Git-Layers-Lab-diagnostico.json"\r\n"%~dp0git-layers-lab.exe" "%~dp0resources\\cli\\diagnostics.mjs" --output "%REPORT%"\r\nset "DIAGNOSTIC_EXIT=%ERRORLEVEL%"\r\necho.\r\necho Relatorio: "%REPORT%"\r\nif /I not "%~1"=="--quiet" pause\r\nexit /b %DIAGNOSTIC_EXIT%\r\n';
}

export function readWindowsPE(buffer) {
  if (buffer.length < 0x40 || buffer.toString('ascii', 0, 2) !== 'MZ') throw new Error('Executável Windows sem cabeçalho MZ.');
  const offset = buffer.readUInt32LE(0x3c);
  if (offset + 26 > buffer.length || buffer.toString('ascii', offset, offset + 4) !== 'PE\0\0') throw new Error('Executável Windows sem cabeçalho PE válido.');
  const machine = buffer.readUInt16LE(offset + 4);
  const optionalMagic = buffer.readUInt16LE(offset + 24);
  if (machine !== 0x8664 || optionalMagic !== 0x20b) throw new Error(`Executável não é Windows x64/PE32+: machine=0x${machine.toString(16)}.`);
  return { machine: 'AMD64', format: 'PE32+' };
}

export async function prepareWindowsPortable(output, { projectRoot, version, electronVersion }) {
  const cli = join(output, 'resources', 'cli');
  await mkdir(cli, { recursive: true });
  for (const entry of ['cli', 'core']) await cp(join(projectRoot, 'dist', entry), join(cli, entry), { recursive: true });
  await writeFile(join(cli, 'package.json'), JSON.stringify({ name: 'git-layers-lab-portable-cli', version, private: true, type: 'module' }, null, 2) + '\n');
  await writeFile(join(output, 'git-layer.cmd'), windowsCliLauncher(), 'utf8');
  await writeFile(join(output, 'git-layer'), gitBashCliLauncher(), 'utf8');
  await writeFile(join(output, 'Diagnostico.cmd'), diagnosticLauncher(), 'utf8');
  await cp(join(projectRoot, 'scripts', 'windows-diagnostics.mjs'), join(cli, 'diagnostics.mjs'));
  await chmod(join(output, 'git-layer'), 0o755);
  const portableReadme = `GIT LAYERS LAB ${version} — WINDOWS 10/11 x64\r\n\r\nExtraia esta pasta inteira antes de usar. Abra git-layers-lab.exe com duplo clique.\r\nMantenha todos os arquivos, pastas resources e locales juntos.\r\n\r\nRequisito: Git for Windows 2.43 ou superior (PATH ou instalacao padrao).\r\nDownload oficial: https://git-scm.com/download/win\r\nDepois de instalar o Git, feche e reabra o aplicativo.\r\nO editor ja inclui Electron ${electronVersion}. Para a CLI interativa do terminal, instale Node.js 22.12+ (sem alterar politica PowerShell).\r\nO Git nao esta incluido; as operacoes proprias de Layers usam Git local.\r\n\r\nTerminal integrado: abre PowerShell real na pasta do workspace.\r\nO catalogo permite copiar comandos; cole no terminal e pressione Enter manualmente.\r\n\r\nCLI (PowerShell, a partir do seu repositorio):\r\n  & "C:\\caminho\\Git Layers Lab\\git-layer.cmd" --help\r\n  & "C:\\caminho\\Git Layers Lab\\git-layer.cmd" status --json\r\nVoce tambem pode adicionar esta pasta ao PATH apenas no terminal atual:\r\n  $env:Path = "C:\\caminho\\Git Layers Lab;" + $env:Path\r\n  git layer -h\r\nO lancador usa Electron e atende comandos nao interativos sem Node instalado. Para capture interativo externo, use node resources/cli/cli/index.js capture. O terminal integrado seleciona o Node instalado automaticamente. Nenhum PATH global e alterado.\r\n\r\nAbra o aplicativo e use 'Criar demonstracao' para criar um repositorio descartavel.\r\nAplicativo experimental: consulte o README e o relatorio de testes fornecidos.\r\nEste pacote nao foi assinado digitalmente.\r\n`;
  await writeFile(join(output, 'LEIA-ME-WINDOWS.txt'), portableReadme, 'utf8');
  // Preserve dependency license notices in addition to Electron's runtime licenses.
  await cp(join(projectRoot, 'dist', 'licenses'), join(output, 'resources', 'licenses'), { recursive: true });
  // Keep relative Markdown links intact for users downloading only the portable ZIP.
  await mkdir(join(output, 'Documentacao'), { recursive: true });
  for (const entry of ['README.md', 'docs']) {
    try { await cp(join(projectRoot, entry), join(output, 'Documentacao', entry), { recursive: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export async function verifyWindowsPortable(output) {
  const root = resolve(output);
  for (const relative of WINDOWS_REQUIRED_FILES) {
    const info = await stat(join(root, relative));
    if (!info.isFile() || info.size === 0) throw new Error(`Arquivo obrigatorio ausente ou vazio: ${relative}`);
  }
  const exe = await readFile(join(root, WINDOWS_EXECUTABLE));
  const pe = readWindowsPE(exe);
  const ptyRoot = join(root, WINDOWS_PTY_MODULE);
  const ptyPackage = JSON.parse(await readFile(join(ptyRoot, 'package.json'), 'utf8'));
  if (ptyPackage.name !== 'node-pty' || ptyPackage.version !== '1.1.0') throw new Error('Payload node-pty inesperado.');
  const prebuilds = await readdir(join(ptyRoot, 'prebuilds'));
  if (prebuilds.length !== 1 || prebuilds[0] !== 'win32-x64') throw new Error('Payload contém prebuild nativo de outra plataforma.');
  const nativeFiles = [];
  for (const relative of WINDOWS_PTY_NATIVE_FILES) {
    const bytes = await readFile(join(ptyRoot, relative));
    const binaryPE = readWindowsPE(bytes);
    nativeFiles.push({ path: `${WINDOWS_PTY_MODULE}/${relative}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ...binaryPE });
  }
  const manifest = {
    platform: 'win32', arch: 'x64', ...pe,
    executable: WINDOWS_EXECUTABLE,
    executableSha256: createHash('sha256').update(exe).digest('hex'),
    checkedRequiredFiles: WINDOWS_REQUIRED_FILES,
    terminal: { package: ptyPackage.name, version: ptyPackage.version, nativeApi: 'Node-API', unpacked: true, files: nativeFiles },
    validation: 'Static payload/PE validation; this is not a native Windows execution test.',
  };
  await writeFile(join(root, 'WINDOWS-PACKAGE.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
