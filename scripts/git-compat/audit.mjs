import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { project, relative, fileHash, sha256, json } from './lib.mjs';

function auditFiles(p) {
  const stat = fs.lstatSync(p);
  if (stat.isSymbolicLink()) throw Error('Linked audit input refused: ' + p);
  if (stat.isFile()) return [p];
  if (!stat.isDirectory()) throw Error('Nonregular audit input refused: ' + p);
  return fs.readdirSync(p).flatMap(name => auditFiles(path.join(p, name)));
}

export function fileManifest(root, inputs) {
  const files = [...new Set(inputs.flatMap(input => {
    const p = path.resolve(root, input);
    if (!fs.existsSync(p)) throw Error('Missing audit input: ' + input);
    return auditFiles(p);
  }))].sort();
  return files.map(p => ({ path: relative(root, p), sha256: fileHash(p), bytes: fs.statSync(p).size }));
}
export const manifestFingerprint = manifest => sha256(JSON.stringify(manifest.map(f => [f.path, f.sha256])));
export function compareManifests(before, after) {
  const a = new Map(before.map(f => [f.path, f.sha256])), b = new Map(after.map(f => [f.path, f.sha256]));
  return { added: [...b.keys()].filter(p => !a.has(p)), removed: [...a.keys()].filter(p => !b.has(p)), changed: [...a.keys()].filter(p => b.has(p) && a.get(p) !== b.get(p)) };
}
export const unchanged = delta => !delta.added.length && !delta.removed.length && !delta.changed.length;
export function captureBaseline({ root = project, runnerInputs, gitPath }) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('GIT_')));
  Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_CEILING_DIRECTORIES: path.dirname(root),
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0' });
  const observe = args => {
    const argv = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args];
    const r = spawnSync(gitPath, argv, { cwd: root, encoding: 'utf8', windowsHide: true, env });
    return { argv, exit: r.status, stdout: r.stdout?.trim() ?? '', stderr: (r.stderr ?? '').replaceAll(process.env.USERPROFILE ?? '<unused>', '<HOST-PROFILE>') };
  };
  return { schema_version: '3.0', captured_at: new Date().toISOString(),
    product: fileManifest(root, ['src']), runner: fileManifest(root, runnerInputs),
    repository: { head: observe(['rev-parse', '--verify', 'HEAD']), branch: observe(['branch', '--show-current']), status: observe(['status', '--short']) },
    policy: 'Fresh baseline of this execution; dirty, untracked and authorized changes before the run are valid inputs. Never compares with a historical preparation snapshot.' };
}
export function sourceInputs(root = project) {
  const inputs = ['src', 'scripts', 'tests', 'docs', 'AGENTS.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'README.md'];
  // Desktop configuration is provenance when present, never a prerequisite of
  // the headless build. lstat also retains dangling links for fail-closed audit.
  for (const input of ['tsconfig.debug.json', 'vite.config.ts']) {
    try { fs.lstatSync(path.join(root, input)); inputs.push(input); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return inputs;
}
export function snapshotSources(runDir, { root = project, extraInputs = [] } = {}) {
  const inputs = sourceInputs(root);
  const manifest = fileManifest(root, [...inputs, ...extraInputs]);
  for (const f of manifest) {
    const target = path.join(runDir, 'source', f.path);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, f.path), target);
  }
  json(path.join(runDir, 'source-manifest.json'), manifest);
  return manifest;
}
