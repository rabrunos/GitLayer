import { constants } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LabError } from './errors.js';
import { OPEN_NOFOLLOW } from './platform.js';
import { failpoint, fingerprint, sameFingerprint, type Fingerprint } from './storage.js';

const unsupportedDirectorySync = new Set(['EINVAL', 'ENOTSUP', 'EOPNOTSUPP', 'EBADF', 'EISDIR']);
async function syncDirectory(directory: string): Promise<void> {
  let handle;
  try { handle = await fs.open(directory, constants.O_RDONLY); await handle.sync(); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    if (!unsupportedDirectorySync.has(code) && !(process.platform === 'win32' && code === 'EPERM')) throw error;
  } finally { await handle?.close(); }
}

/**
 * Atomically claim an absent pathname with an already independent, durable
 * temporary file. link() is used solely as the no-replace publication primitive;
 * it is never an independent copy, cache or backup. The private name is retired
 * before successful return. Interruption between link/unlink deliberately leaves
 * both names and the pending journal: current recovery refuses nlink > 1.
 * Never fall back to replacement rename, including on EXDEV/unsupported links.
 */
export async function publishNewFile(temporary: string, destination: string, expected: Fingerprint): Promise<void> {
  const before = await fs.lstat(temporary);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw new LabError('UNSAFE_PATH', 'A publicação exige temporário regular independente.', { path: temporary });
  const handle = await fs.open(temporary, constants.O_RDONLY | OPEN_NOFOLLOW);
  const identity = (stat: Awaited<ReturnType<typeof fs.lstat>>) => stat.isFile() && !stat.isSymbolicLink() && stat.dev === before.dev && stat.ino === before.ino;
  try {
    const opened = await handle.stat();
    if (!identity(opened) || opened.nlink !== 1 || !sameFingerprint(await fingerprint(temporary), expected)) throw new LabError('EXTERNAL_EDIT', 'O temporário mudou antes da publicação.', { path: temporary });
    failpoint('before-new-file-publication');
    try { await fs.link(temporary, destination); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new LabError('EXTERNAL_EDIT', 'O destino apareceu durante a publicação; os bytes existentes foram preservados.', { path: destination, reason: 'publication-destination-exists' });
      throw error;
    }
    failpoint('after-new-file-link');
    const [source, target, current] = await Promise.all([fs.lstat(temporary), fs.lstat(destination), handle.stat()]);
    if (!identity(source) || !identity(target) || !identity(current) || source.nlink !== 2 || target.nlink !== 2 || current.nlink !== 2) throw new LabError('EXTERNAL_EDIT', 'A identidade da publicação mudou; nomes e journal preservados.', { path: destination });
    await fs.unlink(temporary);
    failpoint('after-new-file-unlink');
    // Payload was flushed by the independent temporary writer before this call.
    // Windows FlushFileBuffers rejects this read-only identity handle; retain
    // the same documented directory-durability boundary as the former rename.
    if (process.platform !== 'win32') await handle.sync();
    await syncDirectory(path.dirname(destination));
    if (path.dirname(temporary) !== path.dirname(destination)) await syncDirectory(path.dirname(temporary));
    const published = await fs.lstat(destination);
    if (!identity(published) || published.nlink !== 1) throw new LabError('EXTERNAL_EDIT', 'O destino mudou após a publicação; journal preservado.', { path: destination });
  } finally { await handle.close(); }
}