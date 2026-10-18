#!/usr/bin/env node
/** Build a full Windows runtime on Windows or cross-package it from another host. */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const [script, args] of [
  ['scripts/build.mjs', []],
  ['scripts/package.mjs', ['--platform=win32', '--arch=x64', ...process.argv.slice(2)]],
]) {
  const result = spawnSync(process.execPath, [resolve(root, script), ...args], { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Windows x64 pronto em artifacts/Git Layers Lab-win32-x64. Abra git-layers-lab.exe.');
