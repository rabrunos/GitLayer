import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diagnosticLauncher, gitBashCliLauncher, prepareWindowsPortable, readWindowsPE, stageTerminalRuntime, verifyWindowsPortable, windowsCliLauncher, WINDOWS_REQUIRED_FILES, WINDOWS_PTY_MODULE, WINDOWS_PTY_NATIVE_FILES, PTY_RUNTIME_JS_FILES } from '../../scripts/windows-portable.mjs';

function fakePE(machine = 0x8664, magic = 0x20b) {
  const buffer = Buffer.alloc(1024);
  buffer.write('MZ'); buffer.writeUInt32LE(128, 0x3c); buffer.write('PE\0\0', 128);
  buffer.writeUInt16LE(machine, 132); buffer.writeUInt16LE(magic, 152);
  return buffer;
}

test('Windows package verifier rejects ELF, invalid and 32-bit executables', () => {
  assert.throws(() => readWindowsPE(Buffer.from('\x7fELF')), /MZ/);
  assert.throws(() => readWindowsPE(fakePE(0x14c, 0x10b)), /x64/);
  const invalid = fakePE(); invalid.writeUInt32LE(999999, 0x3c);
  assert.throws(() => readWindowsPE(invalid), /PE/);
  assert.deepEqual(readWindowsPE(fakePE()), { machine: 'AMD64', format: 'PE32+' });
});

test('portable CLI launchers quote paths, forward arguments, preserve cwd and scope Node mode', () => {
  const cmd = windowsCliLauncher();
  assert.match(cmd, /setlocal\r\n/);
  assert.match(cmd, /set "ELECTRON_RUN_AS_NODE=1"/);
  assert.match(cmd, /"%~dp0git-layers-lab\.exe" "%~dp0resources\\cli\\cli\\index\.js" %\*/);
  assert.match(cmd, /exit \/b %ERRORLEVEL%/);
  assert.doesNotMatch(cmd, /\b(?:cd|setx|node|npm)\b/i);
  const bash = gitBashCliLauncher();
  assert.match(bash, /ELECTRON_RUN_AS_NODE=1 exec "\$SCRIPT_DIR\/git-layers-lab\.exe"/);
  assert.match(bash, /"\$@"/);
  const diagnostic = diagnosticLauncher();
  assert.match(diagnostic, /setlocal\r\n/);
  assert.match(diagnostic, /"%~dp0resources\\cli\\diagnostics\.mjs" --output "%REPORT%"/);
  assert.match(diagnostic, /exit \/b %DIAGNOSTIC_EXIT%/);
});

test('portable payload includes standalone CLI, license notices and validates every runtime file', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'windows-package-espaço '));
  const project = join(temporary, 'source');
  const output = join(temporary, 'Git Layers Lab');
  try {
    for (const folder of ['cli', 'core', 'licenses']) {
      await mkdir(join(project, 'dist', folder), { recursive: true });
      await writeFile(join(project, 'dist', folder, folder === 'licenses' ? 'dependencies.json' : 'index.js'), folder === 'licenses' ? '[]' : 'export const valid = true;');
    }
    await mkdir(output);
    await mkdir(join(project, 'scripts'));
    await writeFile(join(project, 'scripts', 'windows-diagnostics.mjs'), 'console.log("diagnostic fixture");');
    await prepareWindowsPortable(output, { projectRoot: project, version: '0.1.1', electronVersion: '44.9.0' });
    assert.equal(JSON.parse(await readFile(join(output, 'resources/cli/package.json'), 'utf8')).type, 'module');
    assert.match(await readFile(join(output, 'LEIA-ME-WINDOWS.txt'), 'utf8'), /Git for Windows 2\.43/);
    await assert.rejects(verifyWindowsPortable(output), /ENOENT/);
    for (const relative of WINDOWS_REQUIRED_FILES) {
      await mkdir(join(output, relative, '..'), { recursive: true });
      if (relative === 'git-layers-lab.exe' || relative.match(/\.(?:node|dll|exe)$/i)) await writeFile(join(output, relative), fakePE());
      else if (relative === `${WINDOWS_PTY_MODULE}/package.json`) await writeFile(join(output, relative), JSON.stringify({ name: 'node-pty', version: '1.1.0', main: './lib/index.js' }));
      else if (!relative.startsWith('git-layer') && !relative.startsWith('resources/cli/')) await writeFile(join(output, relative), 'runtime fixture');
    }
    const manifest = await verifyWindowsPortable(output);
    assert.equal(manifest.machine, 'AMD64');
    assert.equal(manifest.checkedRequiredFiles.length, WINDOWS_REQUIRED_FILES.length);
    assert.equal(manifest.terminal.files.length, WINDOWS_PTY_NATIVE_FILES.length);
    assert.equal(manifest.terminal.unpacked, true);
    assert.ok(manifest.terminal.files.every(file => file.machine === 'AMD64' && file.sha256.length === 64));
    await mkdir(join(output, WINDOWS_PTY_MODULE, 'prebuilds/linux-x64'));
    await assert.rejects(verifyWindowsPortable(output), /outra plataforma/);
    await rm(join(output, WINDOWS_PTY_MODULE, 'prebuilds/linux-x64'), { recursive: true });
    const native = join(output, WINDOWS_PTY_MODULE, WINDOWS_PTY_NATIVE_FILES[0]);
    await writeFile(native, Buffer.from('\x7fELF'));
    await assert.rejects(verifyWindowsPortable(output), /MZ/);
    await writeFile(native, fakePE());
    await rm(join(output, 'ffmpeg.dll'));
    await assert.rejects(verifyWindowsPortable(output), /ENOENT/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('node-pty staging retains workers and only Windows x64 runtime binaries with original notices', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'windows-terminal-payload '));
  const project = join(temporary, 'source');
  const source = join(project, 'node_modules/node-pty');
  const staging = join(temporary, 'stage');
  try {
    const metadata = { name: 'node-pty', version: '1.1.0', main: './lib/index.js', dependencies: { 'node-addon-api': '^7.1.0' } };
    const fixtures = ['package.json', 'LICENSE', 'README.md', 'deps/winpty/LICENSE', ...PTY_RUNTIME_JS_FILES, ...WINDOWS_PTY_NATIVE_FILES, 'lib/unixTerminal.js', 'lib/terminal.test.js', 'lib/index.js.map', 'prebuilds/linux-x64/pty.node', 'prebuilds/win32-x64/conpty.pdb', 'src/pty.cc'];
    for (const relative of fixtures) {
      await mkdir(join(source, relative, '..'), { recursive: true });
      await writeFile(join(source, relative), relative === 'package.json' ? JSON.stringify(metadata) : WINDOWS_PTY_NATIVE_FILES.includes(relative) ? fakePE() : 'fixture');
    }
    const result = await stageTerminalRuntime(staging, { projectRoot: project, platform: 'win32', arch: 'x64' });
    const destination = join(staging, 'node_modules/node-pty');
    assert.deepEqual(result.binaries, WINDOWS_PTY_NATIVE_FILES);
    assert.deepEqual(JSON.parse(await readFile(join(destination, 'package.json'), 'utf8')), metadata);
    assert.deepEqual(await readdir(join(destination, 'prebuilds')), ['win32-x64']);
    for (const relative of [...PTY_RUNTIME_JS_FILES, ...WINDOWS_PTY_NATIVE_FILES, 'deps/winpty/LICENSE']) await access(join(destination, relative));
    for (const relative of ['lib/terminal.test.js', 'lib/index.js.map', 'prebuilds/win32-x64/conpty.pdb', 'src/pty.cc']) await assert.rejects(access(join(destination, relative)), /ENOENT/);
    await writeFile(join(source, 'prebuilds/win32-x64/conpty.node'), fakePE(0x14c, 0x10b));
    await assert.rejects(stageTerminalRuntime(join(temporary, 'bad-stage'), { projectRoot: project, platform: 'win32', arch: 'x64' }), /x64/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
