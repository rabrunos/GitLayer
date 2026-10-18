import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { LabError } from './errors.js';
import { comparableFileMode, OPEN_NOFOLLOW } from './platform.js';

const MAX_METADATA_BYTES = 64 * 1024 * 1024;
const unsupportedDirectorySync = new Set(['EINVAL', 'ENOTSUP', 'EOPNOTSUPP', 'EBADF', 'EISDIR']);
const codeOf = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | undefined)?.code;

/** Refuse existing symbolic links in a path; never turn a link into a copy target. */
async function noLinks(file: string): Promise<void> {
  const absolute = path.resolve(file);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new LabError('UNSAFE_PATH', 'O armazenamento não atravessa links simbólicos.', { path: current });
    } catch (error) {
      if (codeOf(error) === 'ENOENT') return;
      throw error;
    }
  }
}

async function syncDirectory(directory: string): Promise<void> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(directory, constants.O_RDONLY);
    await handle.sync();
  } catch (error) {
    // Windows does not generally permit opening a directory for FlushFileBuffers.
    // File contents are still flushed; README documents this durability boundary.
    if (!unsupportedDirectorySync.has(codeOf(error) ?? '') && !(process.platform === 'win32' && codeOf(error) === 'EPERM')) throw error;
  } finally { await handle?.close(); }
}

async function ensureDirectory(directory: string): Promise<void> {
  await noLinks(directory);
  const firstCreated = await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await noLinks(directory);
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory()) throw new LabError('UNSAFE_PATH', 'O diretório de armazenamento não é um diretório regular.', { path: directory });
  if (firstCreated) {
    // Persist newly created directory entries too: flushing a journal file alone
    // does not make a new transactions/ or backups/ ancestor durable.
    let current = path.resolve(firstCreated);
    await syncDirectory(path.dirname(current));
    await syncDirectory(current);
    // mkdir can return a Windows namespace path (\\?\C:\...), even when its
    // input was a drive path. relative() treats those spellings as different
    // roots; compare both in the same namespace before walking descendants.
    const relative = path.relative(path.toNamespacedPath(current), path.toNamespacedPath(path.resolve(directory)));
    if (path.isAbsolute(relative) || relative.split(path.sep).includes('..')) {
      throw new LabError('UNSAFE_PATH', 'O diretório criado não é ancestral do armazenamento.', { path: directory });
    }
    for (const component of relative.split(path.sep).filter(Boolean)) {
      const parent = current;
      current = path.join(current, component);
      await syncDirectory(parent);
      await syncDirectory(current);
    }
  }
}

/** Publish a JSON file by fsync + rename, then fsync its parent when supported. */
export async function atomicJSON(file: string, value: unknown): Promise<void> {
  const destination = path.resolve(file);
  let serialized: string;
  try {
    const json = JSON.stringify(value, null, 2);
    if (json === undefined) throw new Error('Valor JSON ausente.');
    serialized = `${json}\n`;
  } catch (error) {
    throw new LabError('METADATA_INVALID', 'O conteúdo dos metadados não é JSON serializável.', { path: destination, reason: String(error) });
  }
  if (Buffer.byteLength(serialized) > MAX_METADATA_BYTES) throw new LabError('METADATA_INVALID', 'Metadados excedem o limite de 64 MiB.', { path: destination });
  const parent = path.dirname(destination);
  await ensureDirectory(parent);
  await noLinks(destination);
  try {
    const stat = await fs.lstat(destination);
    if (!stat.isFile()) throw new LabError('UNSAFE_PATH', 'O destino dos metadados não é um arquivo regular.', { path: destination });
  } catch (error) { if (codeOf(error) !== 'ENOENT') throw error; }
  const temporary = path.join(parent, `.${path.basename(destination)}.${randomUUID()}.tmp`);
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | OPEN_NOFOLLOW, 0o600);
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await noLinks(destination);
    await fs.rename(temporary, destination);
    await syncDirectory(parent);
  } finally {
    await handle?.close();
    await fs.unlink(temporary).catch(error => { if (codeOf(error) !== 'ENOENT') throw error; });
  }
}

async function readRegular(file: string, maxBytes?: number): Promise<{ bytes: Buffer; mode: number }> {
  await noLinks(file);
  const before = await fs.lstat(file);
  if (!before.isFile()) throw new LabError('UNSAFE_FILE_TYPE', 'É necessário um arquivo regular; links e diretórios são recusados.', { path: file });
  const handle = await fs.open(file, constants.O_RDONLY | OPEN_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) throw new LabError('EXTERNAL_CHANGE', 'O arquivo mudou enquanto era aberto.', { path: file });
    if (maxBytes !== undefined && opened.size > maxBytes) throw new LabError('METADATA_INVALID', 'Metadados excedem o limite de 64 MiB.', { path: file });
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const current = await fs.lstat(file);
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs || after.mode !== opened.mode || current.dev !== opened.dev || current.ino !== opened.ino || current.size !== after.size || current.mtimeMs !== after.mtimeMs || current.ctimeMs !== after.ctimeMs || current.mode !== after.mode || current.isSymbolicLink()) {
      throw new LabError('EXTERNAL_CHANGE', 'O arquivo mudou durante a leitura; a operação foi interrompida.', { path: file });
    }
    return { bytes, mode: comparableFileMode(opened.mode) };
  } finally { await handle.close(); }
}

/** Unknown schemas, invalid JSON and validator failures never initialize defaults. */
export async function readJSON<T>(file: string, validate?: (value: any) => boolean): Promise<T> {
  let value: unknown;
  try {
    const { bytes } = await readRegular(path.resolve(file), MAX_METADATA_BYTES);
    value = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof LabError) throw error;
    throw new LabError('METADATA_INVALID', 'Não foi possível ler os metadados. Nenhum estado foi reinicializado.', { path: path.resolve(file), reason: String(error) });
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, 'schema') || (value as { schema?: unknown }).schema !== 1) {
    throw new LabError('METADATA_INVALID', 'Esquema de metadados inválido ou não suportado. É necessário schema: 1.', { path: path.resolve(file) });
  }
  try {
    if (validate && !validate(value)) throw new Error('A validação do conteúdo falhou.');
  } catch (error) {
    throw new LabError('METADATA_INVALID', 'Conteúdo de metadados inválido. Nenhum estado foi reinicializado.', { path: path.resolve(file), reason: String(error) });
  }
  return value as T;
}

/** mkdir is the cross-process acquisition; an existing lock is never removed. */
export async function withLock<T>(directory: string, fn: () => Promise<T>): Promise<T> {
  const locks = path.resolve(directory, 'locks');
  await ensureDirectory(locks);
  const lock = path.join(locks, 'coordinator');
  try { await fs.mkdir(lock, { mode: 0o700 }); }
  catch (error) {
    if (codeOf(error) === 'EEXIST') throw new LabError('LOCKED', 'Outra operação ou um lock anterior está presente. Inspecione-o; ele não será apagado automaticamente.', { path: lock });
    throw error;
  }
  const token = randomUUID();
  const acquired = await fs.lstat(lock);
  const ownerFile = path.join(lock, 'owner.json');
  let ownerPublished = false;
  let failed = false;
  try {
    await atomicJSON(ownerFile, { schema: 1, token, pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() });
    ownerPublished = true;
    await syncDirectory(locks);
    return await fn();
  } catch (error) { failed = true; throw error; }
  finally {
    try {
      const current = await fs.lstat(lock);
      if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== acquired.dev || current.ino !== acquired.ino) throw new LabError('LOCK_CHANGED', 'O lock mudou externamente e foi preservado.', { path: lock });
      if (ownerPublished) {
        const owner = await readJSON<{ schema: 1; token: string }>(ownerFile, value => typeof value.token === 'string');
        if (owner.token !== token) throw new LabError('LOCK_CHANGED', 'O lock agora pertence a outra operação e foi preservado.', { path: lock });
        await fs.unlink(ownerFile);
      }
      await fs.rmdir(lock);
      await syncDirectory(locks);
    } catch (releaseError) {
      // Preserve the original operation failure and leave disputed locks untouched.
      if (!failed) throw releaseError;
    }
  }
}

export interface Fingerprint { hash: string; mode: number; exists: boolean }

export async function fingerprint(file: string): Promise<Fingerprint> {
  try {
    const result = await readRegular(path.resolve(file));
    return { hash: createHash('sha256').update(result.bytes).digest('hex'), mode: result.mode, exists: true };
  } catch (error) {
    if (codeOf(error) === 'ENOENT') return { hash: '', mode: 0, exists: false };
    throw error;
  }
}

export function sameFingerprint(a: Fingerprint, b: Fingerprint): boolean {
  return a.exists === b.exists && (!a.exists || (a.hash === b.hash && a.mode === b.mode));
}

export function failpoint(name: string): void {
  const selected = process.env.GIT_LAYERS_FAILPOINT;
  if (selected?.split(',').map(value => value.trim()).includes(name)) throw new LabError('INJECTED_FAILURE', `Falha de teste injetada em ${name}.`, { failpoint: name });
}

interface JournalStep { step: string; at: string; details?: unknown }
interface JournalBackup { source: string; copy: string | null; label: string; fingerprint: Fingerprint; at: string }
interface JournalData {
  schema: 1;
  id: string;
  kind: string;
  state: 'pending' | 'completed' | 'recovery-required';
  createdAt: string;
  updatedAt: string;
  metadata: unknown;
  steps: JournalStep[];
  backups: JournalBackup[];
  error?: { name: string; message: string; code?: string };
  [key: string]: unknown;
}

const isJournal = (value: any): boolean =>
  typeof value.id === 'string' && /^[A-Za-z0-9_-]+$/.test(value.id) &&
  typeof value.kind === 'string' && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string' &&
  ['pending', 'completed', 'recovery-required'].includes(value.state) &&
  Array.isArray(value.steps) && value.steps.every((step: any) => step && typeof step.step === 'string' && typeof step.at === 'string') &&
  Array.isArray(value.backups) && value.backups.every((backup: any) => backup && typeof backup.source === 'string' && path.isAbsolute(backup.source) && (backup.copy === null || (typeof backup.copy === 'string' && path.isAbsolute(backup.copy))) && typeof backup.label === 'string' && backup.fingerprint && typeof backup.fingerprint.exists === 'boolean' && typeof backup.fingerprint.hash === 'string' && typeof backup.fingerprint.mode === 'number');

export class Transaction {
  readonly id: string;
  readonly dir: string;
  // Operations attach their own typed recovery plan before recording a step.
  // Persistent reads are validated separately at the recovery boundary.
  data: any;

  private constructor(directory: string, data: JournalData) { this.id = data.id; this.dir = directory; this.data = data; }

  static async begin(directory: string, kind: string, metadata: unknown): Promise<Transaction> {
    if (!kind || kind.length > 160 || /[\u0000-\u001f]/.test(kind)) throw new LabError('INVALID_ARGUMENT', 'Tipo de transação inválido.');
    const id = randomUUID();
    const parent = path.resolve(directory, 'transactions');
    await ensureDirectory(parent);
    const folder = path.join(parent, id);
    await fs.mkdir(folder, { mode: 0o700 });
    const now = new Date().toISOString();
    const transaction = new Transaction(folder, { schema: 1, id, kind, state: 'pending', createdAt: now, updatedAt: now, metadata, steps: [], backups: [] });
    await atomicJSON(path.join(folder, 'journal.json'), transaction.data);
    await syncDirectory(parent);
    return transaction;
  }

  private async persist(): Promise<void> {
    this.data.updatedAt = new Date().toISOString();
    await atomicJSON(path.join(this.dir, 'journal.json'), this.data);
  }

  async record(step: string, details?: unknown): Promise<void> {
    if (!step || step.length > 200 || /[\u0000-\u001f]/.test(step)) throw new LabError('INVALID_ARGUMENT', 'Etapa de transação inválida.');
    this.data.steps.push({ step, at: new Date().toISOString(), ...(details === undefined ? {} : { details }) });
    await this.persist();
  }

  /** Return a durable absolute copy; absence is recorded explicitly as null. */
  async backup(file: string, label: string): Promise<string | null> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/.test(label)) throw new LabError('INVALID_ARGUMENT', 'Rótulo de backup inválido.');
    const source = path.resolve(file);
    let contents: { bytes: Buffer; mode: number };
    try { contents = await readRegular(source); }
    catch (error) {
      if (codeOf(error) !== 'ENOENT') throw error;
      this.data.backups.push({ source, copy: null, label, fingerprint: { exists: false, hash: '', mode: 0 }, at: new Date().toISOString() });
      await this.persist();
      return null;
    }
    const expected: Fingerprint = { hash: createHash('sha256').update(contents.bytes).digest('hex'), mode: contents.mode, exists: true };
    const backupDirectory = path.join(this.dir, 'backups');
    await ensureDirectory(backupDirectory);
    const copy = path.join(backupDirectory, `${randomUUID()}-${label}`);
    const handle = await fs.open(copy, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | OPEN_NOFOLLOW, 0o600);
    try {
      await handle.writeFile(contents.bytes);
      await handle.chmod(contents.mode);
      await handle.sync();
    } finally { await handle.close(); }
    await syncDirectory(backupDirectory);
    if (!sameFingerprint(expected, await fingerprint(source))) throw new LabError('EXTERNAL_CHANGE', 'O arquivo mudou durante o backup. A cópia foi preservada e a operação foi interrompida.', { path: source, backup: copy });
    this.data.backups.push({ source, copy, label, fingerprint: expected, at: new Date().toISOString() });
    await this.persist();
    return copy;
  }

  async finish(): Promise<void> { this.data.state = 'completed'; await this.record('completed'); }

  async fail(error: unknown): Promise<void> {
    this.data.state = 'recovery-required';
    this.data.error = {
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
      ...(typeof (error as { code?: unknown } | null)?.code === 'string' ? { code: (error as { code: string }).code } : {})
    };
    await this.record('failed');
  }
}

/** Return unfinished journals only; invalid entries cause a safe error. */
export async function listTransactions(directory: string): Promise<any[]> {
  const transactions = path.resolve(directory, 'transactions');
  await noLinks(transactions);
  let entries: import('node:fs').Dirent[];
  try { entries = await fs.readdir(transactions, { withFileTypes: true }); }
  catch (error) { if (codeOf(error) === 'ENOENT') return []; throw error; }
  const pending: JournalData[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink() || !entry.isDirectory() || !/^[A-Za-z0-9_-]+$/.test(entry.name)) throw new LabError('METADATA_INVALID', 'Entrada inesperada no diretório de transações. Ela foi preservada para inspeção.', { path: path.join(transactions, entry.name) });
    const journal = await readJSON<JournalData>(path.join(transactions, entry.name, 'journal.json'), isJournal);
    if (journal.id !== entry.name) throw new LabError('METADATA_INVALID', 'Identificador da transação não corresponde ao seu diretório.', { path: path.join(transactions, entry.name) });
    if (journal.state !== 'completed') pending.push(journal);
  }
  return pending;
}
