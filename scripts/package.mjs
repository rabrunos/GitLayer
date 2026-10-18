import { packager } from '@electron/packager';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { prepareWindowsPortable, stageTerminalRuntime, verifyWindowsPortable } from './windows-portable.mjs';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const staging = await mkdtemp(join(os.tmpdir(), 'git-layers-package-'));
await mkdir('artifacts', { recursive: true });
const buildOutput = await mkdtemp(join(resolve('artifacts'), '.package-output-'));
const platformArg = process.argv.find(arg => arg.startsWith('--platform='));
const archArg = process.argv.find(arg => arg.startsWith('--arch='));
const zipArg = process.argv.find(arg => arg.startsWith('--electron-zip-dir='));
const platform = platformArg?.slice(11) ?? process.platform;
const arch = archArg?.slice(7) ?? process.arch;
if (platform === 'win32' && arch !== 'x64') throw new Error('Esta entrega Windows suporta somente x64.');
try {
  await cp('dist', join(staging, 'dist'), { recursive: true });
  await stageTerminalRuntime(staging, { projectRoot: process.cwd(), platform, arch });
  await writeFile(join(staging, 'package.json'), JSON.stringify({ name: pkg.name, productName: 'Git Layers Lab', version: pkg.version, private: true, license: pkg.license, type: 'module', main: pkg.main, dependencies: { 'node-pty': pkg.dependencies['node-pty'] } }, null, 2));
  await mkdir('artifacts', { recursive: true });
  // Unpack the whole module: its native loader, Worker and forked helper must all
  // have physical paths, with the native DLLs adjacent to their .node modules.
  // Only this whitelisted production module is staged; npm pruning is unnecessary
  // and would expect node-addon-api, which is a compilation-only dependency.
  const outputs = await packager({ dir: staging, out: buildOutput, name: 'Git Layers Lab', executableName: 'git-layers-lab', platform, arch, electronVersion: pkg.devDependencies.electron, download: { cacheRoot: resolve('.workshop/electron-cache') }, appVersion: pkg.version, buildVersion: pkg.version, ...(platform === 'win32' ? { win32metadata: { CompanyName: 'Git Layers Lab', FileDescription: 'Git Layers Lab — editor e Git Layers local', ProductName: 'Git Layers Lab', InternalName: 'git-layers-lab', OriginalFilename: 'git-layers-lab.exe' } } : {}), ...(zipArg ? { electronZipDir: resolve(zipArg.slice('--electron-zip-dir='.length)) } : {}), asar: { unpackDir: 'node_modules/node-pty' }, prune: false });
  if (platform === 'win32') for (const output of outputs) {
    await prepareWindowsPortable(output, { projectRoot: process.cwd(), version: pkg.version, electronVersion: pkg.devDependencies.electron });
    await verifyWindowsPortable(output);
  }
  for (const output of outputs) for (const entry of await readdir(output)) {
    // Never ship a partial temporary executable left by a binary processing tool.
    if (/^\.git-layers-lab\.[A-Za-z0-9]+$/.test(entry)) await rm(join(output, entry), { force: true });
  }
  const published = [];
  for (const output of outputs) {
    const destination = resolve('artifacts', basename(output));
    const previous = resolve('artifacts', `.previous-${randomUUID()}`);
    let preservedPrevious = false;
    try { await rename(destination, previous); preservedPrevious = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await rename(output, destination); }
    catch (error) { if (preservedPrevious) await rename(previous, destination); throw error; }
    if (preservedPrevious) await rm(previous, { recursive: true, force: true });
    published.push(destination);
  }
  console.log(`Pacote real criado: ${published.join(', ')}`);
} finally {
  await rm(staging, { recursive: true, force: true });
  await rm(buildOutput, { recursive: true, force: true });
}
