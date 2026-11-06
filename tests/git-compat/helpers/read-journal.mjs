import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Read semantic journal data through the same frozen storage bundle as the worker.
 * Raw bytes, hashes, backups and independent Git observations remain separate oracles.
 * Invalid/missing data is never converted to an empty journal or a default value.
 */
export async function readJournal(c, id) {
  c.ok('Observed transaction id is a fixture UUID', typeof id === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(id));
  c.ok('Journal reader uses an absolute frozen build directory', typeof c.buildDir === 'string' && path.isAbsolute(c.buildDir));
  const directory = path.join(c.repo, '.git', 'layers');
  const { readTransaction } = await import(pathToFileURL(path.join(c.buildDir, 'storage.mjs')).href);
  return { file: path.join(directory, 'transactions', id, 'journal.json'), value: await readTransaction(directory, id) };
}
