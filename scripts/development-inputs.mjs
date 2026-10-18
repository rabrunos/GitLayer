import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const DEVELOPMENT_INPUTS = ['src', 'vite.config.ts', 'tsconfig.json', 'tsconfig.debug.json'];

// Windows can notify the same write again while a build is running. Compare
// bytes and file names, not event counts or mtimes, before restarting the GUI.
export async function developmentInputFingerprint(root) {
  const hash = createHash('sha256');
  async function visit(relative) {
    const full = path.join(root, relative);
    let stat;
    try { stat = await lstat(full); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (stat.isDirectory()) {
      for (const name of (await readdir(full)).sort()) await visit(path.join(relative, name));
    } else if (stat.isFile()) {
      const bytes = await readFile(full);
      hash.update(JSON.stringify([relative, bytes.length]) + '\n');
      hash.update(bytes);
    }
  }
  for (const relative of DEVELOPMENT_INPUTS) await visit(relative);
  return hash.digest('hex');
}
