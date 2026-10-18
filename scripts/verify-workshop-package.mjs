#!/usr/bin/env node
/** Inspect the deliverable bytes; this deliberately does not claim a Windows run. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractFile, getRawHeader, listPackage, statFile } from '@electron/asar';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';
import { verifyWindowsPortable, WINDOWS_PTY_MODULE } from './windows-portable.mjs';

async function filesIn(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) files.push(relative(root, full).replaceAll('\\', '/'));
      else throw new Error(`Link ou tipo de arquivo inesperado: ${full}`);
    }
  }
  await visit(root);
  return files.sort();
}

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export async function verifyWorkshopPackage(projectRoot) {
  const root = resolve(projectRoot);
  const output = join(root, 'artifacts', 'Git Layers Lab-win32-x64');
  const windows = await verifyWindowsPortable(output);
  const executableBytes = await readFile(join(output, windows.executable));
  const executableResources = NtExecutableResource.from(NtExecutable.from(executableBytes));
  const versions = Resource.VersionInfo.fromEntries(executableResources.entries);
  assert.equal(versions.length, 1, 'Windows version resource is missing');
  const languages = versions[0].getAllLanguagesForStringValues();
  assert.equal(languages.length, 1, 'Unexpected Windows metadata languages');
  const versionMetadata = versions[0].getStringValues(languages[0]);
  const asar = join(output, 'resources', 'app.asar');
  const integrityResources = executableResources.entries.filter(entry => entry.type === 'INTEGRITY' && entry.id === 'ELECTRONASAR');
  assert.equal(integrityResources.length, 1, 'Embedded ASAR integrity resource is missing');
  const integrity = JSON.parse(Buffer.from(integrityResources[0].bin).toString('utf8'));
  assert.equal(integrity.length, 1);
  assert.equal(integrity[0].file.replaceAll('\\', '/'), 'resources/app.asar');
  assert.equal(integrity[0].alg, 'SHA256');
  assert.equal(integrity[0].value, sha256(getRawHeader(asar).headerString), 'Executable ASAR integrity does not match payload header');
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(versionMetadata.FileVersion, pkg.version);
  assert.equal(versionMetadata.ProductVersion, pkg.version);
  assert.equal(versionMetadata.ProductName, 'Git Layers Lab');
  assert.equal(versionMetadata.OriginalFilename, 'git-layers-lab.exe');
  const embeddedPackage = JSON.parse(extractFile(asar, 'package.json').toString('utf8'));
  assert.equal(embeddedPackage.version, pkg.version, 'ASAR version differs from source');
  assert.equal(embeddedPackage.main, pkg.main);
  assert.equal(embeddedPackage.dependencies['node-pty'], pkg.dependencies['node-pty']);

  const distFiles = await filesIn(join(root, 'dist'));
  assert.ok(distFiles.length > 0, 'Production build is empty');
  assert.ok(distFiles.every(file => !file.endsWith('.map')), 'Production unexpectedly includes debug source maps');
  for (const file of distFiles) {
    // @electron/asar traverses API paths with the host path.sep. Portable report
    // names use '/', but extraction on Windows needs native separators.
    assert.deepEqual(extractFile(asar, join('dist', file)), await readFile(join(root, 'dist', file)), `ASAR build differs: ${file}`);
  }
  let cliComparedFiles = 0;
  for (const folder of ['cli', 'core']) {
    for (const file of await filesIn(join(root, 'dist', folder))) {
      assert.deepEqual(await readFile(join(output, 'resources', 'cli', folder, file)), await readFile(join(root, 'dist', folder, file)), `Portable CLI differs: ${folder}/${file}`);
      cliComparedFiles++;
    }
  }
  const ptyRoot = join(output, WINDOWS_PTY_MODULE);
  const ptyFiles = await filesIn(ptyRoot);
  assert.ok(ptyFiles.every(file => !file.endsWith('.pdb') && !file.endsWith('.map') && !file.endsWith('.test.js')), 'Native runtime includes debug/test payload');
  const nativeByteComparisons = [];
  for (const file of ptyFiles) {
    const packedPath = join('node_modules', 'node-pty', file);
    assert.equal(statFile(asar, packedPath).unpacked, true, `Native runtime file is trapped in ASAR: ${file}`);
    const bytes = await readFile(join(ptyRoot, file));
    assert.deepEqual(bytes, await readFile(join(root, 'node_modules', 'node-pty', file)), `Native runtime differs from installed upstream: ${file}`);
    nativeByteComparisons.push({ file, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const debugFiles = await filesIn(join(root, 'dist-debug'));
  const debugMaps = debugFiles.filter(file => file.endsWith('.map'));
  assert.ok(debugMaps.length > 0, 'Debug build/source maps are missing');
  let embeddedSources = 0;
  for (const file of debugMaps) {
    const map = JSON.parse(await readFile(join(root, 'dist-debug', file), 'utf8'));
    assert.ok(Array.isArray(map.sourcesContent) && map.sourcesContent.length === map.sources.length, `Debug map lacks embedded sources: ${file}`);
    embeddedSources += map.sourcesContent.length;
  }
  const workers = distFiles.filter(file => file.startsWith('renderer/') && /\/(?:editor|json|css|html|ts)\.worker-[^/]+\.js$/i.test(file));
  assert.equal(workers.length, 5, 'Monaco local worker payload is incomplete');
  const asarEntries = listPackage(asar);
  assert.ok(!asarEntries.some(file => /node_modules[\\/](?!node-pty(?:[\\/]|$))/.test(file)), 'Unexpected unbundled dependency in ASAR');
  const asarBytes = await readFile(asar);
  return {
    version: pkg.version, platform: 'win32', arch: 'x64',
    validation: 'Static file/PE/ASAR inspection and byte comparison. Native Windows execution was not performed.',
    asar: { bytes: asarBytes.length, sha256: sha256(asarBytes), entries: asarEntries.length, main: embeddedPackage.main, executableIntegrity: integrity[0] },
    production: { filesComparedWithSourceDist: distFiles.length, portableCliFilesCompared: cliComparedFiles, monacoWorkers: workers },
    debug: { files: debugFiles.length, maps: debugMaps.length, embeddedSources },
    terminal: { ...windows.terminal, upstreamFilesCompared: nativeByteComparisons },
    windowsExecutable: { bytes: (await stat(join(output, windows.executable))).size, sha256: windows.executableSha256, machine: windows.machine, format: windows.format, versionMetadata },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const report = await verifyWorkshopPackage(root);
  const evidence = join(root, 'docs', 'evidence', 'WORKSHOP-PACKAGE.json');
  await mkdir(dirname(evidence), { recursive: true });
  await writeFile(evidence, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, evidence, version: report.version, productionFiles: report.production.filesComparedWithSourceDist, debugMaps: report.debug.maps, nativeFiles: report.terminal.files.length }));
}
