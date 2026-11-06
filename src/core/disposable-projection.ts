import { constants, type Stats } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { LabError } from './errors.js';
import { OPEN_NOFOLLOW } from './platform.js';
import { fingerprint, sameFingerprint, type Fingerprint } from './storage.js';

interface CurrentTransaction { readonly id: string; readonly dir: string; data: any }
interface DisposableFile { path: string; fingerprint: Fingerprint }
interface Identity { dev: number; ino: number }
export interface CleanupReceipt { schema: 1; transaction: string; status: 'removed' | 'retained'; plannedFiles: number; removedFiles: number; removedDirectories: number; reason?: string }
const sameIdentity = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino;

/** Capture authority only for this operation's newly extracted disposable files. */
export async function prepareProjectionCleanup(tx: CurrentTransaction, root: string, files: DisposableFile[]): Promise<() => Promise<CleanupReceipt>> {
  const transaction = path.resolve(tx.dir), directory = path.resolve(root);
  if (!/^[a-f0-9-]{36}$/.test(tx.id) || path.basename(transaction) !== tx.id || directory !== path.join(transaction, 'materialized')) throw new LabError('UNSAFE_PATH', 'A limpeza exige a extração privada desta transação.');
  const transactionIdentity = await fs.lstat(transaction);
  if (!transactionIdentity.isDirectory() || transactionIdentity.isSymbolicLink()) throw new LabError('UNSAFE_PATH', 'A transação privada mudou de identidade.');
  const expected = new Map<string, { fingerprint: Fingerprint; identity: Stats }>(), directories = new Map<string, Stats>();
  const children = new Map<string, Set<string>>([[directory, new Set()]]);
  for (const file of files) {
    const absolute = path.resolve(file.path), relative = path.relative(directory, absolute);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || expected.has(absolute) || !file.fingerprint.exists) throw new LabError('UNSAFE_PATH', 'Arquivo fora da extração descartável desta transação.');
    const stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new LabError('UNSAFE_PATH', 'A extração descartável exige arquivos regulares independentes.');
    expected.set(absolute, { fingerprint: { ...file.fingerprint }, identity: stat });
    let child = absolute;
    while (child !== directory) { const parent = path.dirname(child); if (!children.has(parent)) children.set(parent, new Set()); children.get(parent)!.add(path.basename(child)); child = parent; }
  }
  for (const [folder, names] of children) {
    const stat = await fs.lstat(folder);
    if (!stat.isDirectory() || stat.isSymbolicLink() || JSON.stringify((await fs.readdir(folder)).sort()) !== JSON.stringify([...names].sort())) throw new LabError('UNSAFE_PATH', 'A extração contém caminhos desconhecidos; nenhum temporário foi descartado.');
    directories.set(folder, stat);
  }
  const journal = path.join(transaction, 'journal.json');
  let journalIdentity: Stats | undefined;
  const sameJournal = (a: Stats, b: Stats) => sameIdentity(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs && a.mode === b.mode && a.nlink === 1 && b.nlink === 1;
  const checkTransaction = async () => {
    const stat = await fs.lstat(transaction);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !sameIdentity(stat, transactionIdentity) || tx.data.id !== tx.id || tx.data.state !== 'completed') throw new Error('transaction-not-completed-or-identity-changed');
    if (journalIdentity) {
      const current = await fs.lstat(journal);
      if (!current.isFile() || current.isSymbolicLink() || !sameJournal(current, journalIdentity)) throw new Error('durable-journal-changed');
    }
  };
  const checkDirectories = async () => {
    await checkTransaction();
    for (const [folder, stat] of directories) {
      const current = await fs.lstat(folder);
      if (!current.isDirectory() || current.isSymbolicLink() || !sameIdentity(stat, current)) throw new Error('directory-identity-changed');
    }
  };
  const checkFile = async (file: string, plan: { fingerprint: Fingerprint; identity: Stats }) => {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !sameIdentity(stat, plan.identity) || !sameFingerprint(await fingerprint(file), plan.fingerprint)) throw new Error('file-changed-or-linked');
  };
  const referenced = (value: unknown): boolean => {
    if (typeof value === 'string' && path.isAbsolute(value)) { const relative = path.relative(directory, path.resolve(value)); return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep)); }
    return value !== null && typeof value === 'object' && Object.values(value).some(referenced);
  };
  return async () => {
    const receipt: CleanupReceipt = { schema: 1, transaction: tx.id, status: 'retained', plannedFiles: expected.size, removedFiles: 0, removedDirectories: 0 };
    try {
      await checkTransaction();
      const serialized = JSON.stringify(tx.data, null, 2) + '\n', beforeJournal = await fs.lstat(journal);
      const durable = await fingerprint(journal), afterJournal = await fs.lstat(journal);
      if (!beforeJournal.isFile() || beforeJournal.isSymbolicLink() || !sameJournal(beforeJournal, afterJournal) || durable.hash !== createHash('sha256').update(serialized).digest('hex') || afterJournal.size !== Buffer.byteLength(serialized)) throw new Error('durable-journal-changed');
      journalIdentity = afterJournal;
      await checkDirectories();
      if (referenced(tx.data)) throw new Error('journal-dependency');
      // Inventory and validate the entire plan before deleting even the first file.
      for (const [folder, names] of children) if (JSON.stringify((await fs.readdir(folder)).sort()) !== JSON.stringify([...names].sort())) throw new Error('unknown-or-missing-entry');
      for (const [file, plan] of expected) await checkFile(file, plan);
      for (const [file, plan] of expected) {
        await checkTransaction();
        for (let folder = path.dirname(file); ; folder = path.dirname(folder)) {
          const current = await fs.lstat(folder), planned = directories.get(folder)!;
          if (!current.isDirectory() || current.isSymbolicLink() || !sameIdentity(current, planned)) throw new Error('directory-identity-changed');
          if (folder === directory) break;
        }
        await checkFile(file, plan); await fs.unlink(file); receipt.removedFiles++;
      }
      for (const [folder, stat] of [...directories].sort(([a], [b]) => b.length - a.length)) {
        await checkTransaction(); const current = await fs.lstat(folder);
        if (!current.isDirectory() || current.isSymbolicLink() || !sameIdentity(stat, current)) throw new Error('directory-identity-changed');
        await fs.rmdir(folder); receipt.removedDirectories++;
      }
      receipt.status = 'removed';
    } catch (error) { receipt.reason = (error as NodeJS.ErrnoException).code ?? (error instanceof Error ? error.message : String(error)); }
    // Cleanup must never turn a durably completed operation into rollback.
    // A receipt is best effort and may only be written in the same proven folder.
    try {
      await checkTransaction();
      const handle = await fs.open(path.join(transaction, 'materialized-cleanup.json'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | OPEN_NOFOLLOW, 0o600);
      try { await handle.writeFile(JSON.stringify(receipt, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
    } catch { /* Retain the completed journal; no cleanup error grants recovery authority. */ }
    return receipt;
  };
}