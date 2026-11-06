import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { LabError } from './errors.js';
import { comparableFileMode, OPEN_NOFOLLOW } from './platform.js';

const MAX_METADATA_BYTES = 64 * 1024 * 1024;
const MAX_JOURNAL_LOG_BYTES = 256 * 1024 * 1024;
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

/** Read through one proven regular-file handle and revalidate identity/content metadata. */
async function consumeRegular(file: string, consume: (chunk: Buffer) => Promise<void> | void, maxBytes?: number, blobAlgorithm?: 'sha1' | 'sha256'): Promise<{ mode: number; hash: string; blobOid?: string }> {
  await noLinks(file);
  const before = await fs.lstat(file);
  if (!before.isFile()) throw new LabError('UNSAFE_FILE_TYPE', 'É necessário um arquivo regular; links e diretórios são recusados.', { path: file });
  const handle = await fs.open(file, constants.O_RDONLY | OPEN_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) throw new LabError('EXTERNAL_CHANGE', 'O arquivo mudou enquanto era aberto.', { path: file });
    if (maxBytes !== undefined && opened.size > maxBytes) throw new LabError('METADATA_INVALID', `Metadados excedem o limite de ${maxBytes} bytes.`, { path: file, maxBytes });
    if (blobAlgorithm && (!Number.isSafeInteger(opened.size) || opened.size < 0)) throw new LabError('UNSAFE_FILE_TYPE', 'O tamanho do arquivo não permite validar o OID Git com exatidão.', { path: file });
    const digest = createHash('sha256'), blobDigest = blobAlgorithm ? createHash(blobAlgorithm).update(`blob ${opened.size}\0`) : undefined;
    const buffer = Buffer.allocUnsafe(Math.max(1, Math.min(256 * 1024, opened.size)));
    let total = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      if (maxBytes !== undefined && total > maxBytes) throw new LabError('METADATA_INVALID', `Metadados excedem o limite de ${maxBytes} bytes.`, { path: file, maxBytes });
      if (total > opened.size) throw new LabError('EXTERNAL_CHANGE', 'O arquivo mudou durante a leitura; a operação foi interrompida.', { path: file });
      const chunk = buffer.subarray(0, bytesRead);
      digest.update(chunk);
      blobDigest?.update(chunk);
      await consume(chunk);
    }
    const after = await handle.stat(), current = await fs.lstat(file);
    if (total !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs || after.mode !== opened.mode || current.dev !== opened.dev || current.ino !== opened.ino || current.size !== after.size || current.mtimeMs !== after.mtimeMs || current.ctimeMs !== after.ctimeMs || current.mode !== after.mode || current.isSymbolicLink()) {
      throw new LabError('EXTERNAL_CHANGE', 'O arquivo mudou durante a leitura; a operação foi interrompida.', { path: file });
    }
    return { mode: comparableFileMode(opened.mode), hash: digest.digest('hex'), ...(blobDigest ? { blobOid: blobDigest.digest('hex') } : {}) };
  } finally { await handle.close(); }
}

async function readRegular(file: string, maxBytes?: number): Promise<{ bytes: Buffer; mode: number }> {
  const chunks: Buffer[] = [];
  const result = await consumeRegular(file, chunk => { chunks.push(Buffer.from(chunk)); }, maxBytes);
  return { bytes: Buffer.concat(chunks), mode: result.mode };
}

/** Copy independent bytes into a new exclusive file, with bounded memory and a durable result. */
export async function copyRegular(source: string, destination: string, mode?: number): Promise<Fingerprint> {
  const target = path.resolve(destination);
  await ensureDirectory(path.dirname(target));
  await noLinks(target);
  const handle = await fs.open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | OPEN_NOFOLLOW, 0o600);
  try {
    const result = await consumeRegular(path.resolve(source), async chunk => { await handle.writeFile(chunk); });
    await handle.chmod(mode ?? result.mode);
    await handle.sync();
    const actualMode = comparableFileMode((await handle.stat()).mode);
    return { exists: true, hash: result.hash, mode: actualMode };
  } finally { await handle.close(); }
}

/** Unknown schemas, invalid JSON and validator failures never initialize defaults. */
export async function readJSON<T>(file: string, validate?: (value: any) => boolean): Promise<T> {
  let value: unknown;
  try {
    const { bytes } = await readRegular(path.resolve(file), MAX_METADATA_BYTES);
    value = JSON.parse(bytes.toString('utf8')) as unknown;
    if (path.basename(file) === 'journal.json' && (value as any)?.schema === 2) value = (value as any).format === 'git-layer-journal-checkpoint-v2' ? decodeJournalCheckpoint(value, file) : await replayJournal(path.resolve(file), value);
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
    const result = await consumeRegular(path.resolve(file), () => {});
    return { hash: result.hash, mode: result.mode, exists: true };
  } catch (error) {
    if (codeOf(error) === 'ENOENT') return { hash: '', mode: 0, exists: false };
    throw error;
  }
}

/** Read-only Git blob identity and physical hash from the exact same guarded bytes.
 * The requested OID remains authoritative in Git; this creates no object or ref.
 */
export async function fingerprintGitBlob(file: string, algorithm: 'sha1' | 'sha256'): Promise<Fingerprint & { blobOid: string }> {
  if (algorithm !== 'sha1' && algorithm !== 'sha256') throw new LabError('INVALID_ARGUMENT', 'Algoritmo de objeto Git não suportado.');
  try {
    const result = await consumeRegular(path.resolve(file), () => {}, undefined, algorithm);
    return { exists: true, hash: result.hash, mode: result.mode, blobOid: result.blobOid! };
  } catch (error) {
    if (codeOf(error) === 'ENOENT') return { exists: false, hash: '', mode: 0, blobOid: '' };
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
export interface TrackedRecoveryFile { path: string; backup: string | null; before: Fingerprint; after?: Fingerprint }
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
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  typeof value.id === 'string' && /^[A-Za-z0-9_-]+$/.test(value.id) &&
  typeof value.kind === 'string' && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string' &&
  ['pending', 'completed', 'recovery-required'].includes(value.state) &&
  Array.isArray(value.steps) && value.steps.every((step: any) => step && typeof step.step === 'string' && typeof step.at === 'string') &&
  Array.isArray(value.backups) && value.backups.every((backup: any) => backup && typeof backup.source === 'string' && path.isAbsolute(backup.source) && (backup.copy === null || (typeof backup.copy === 'string' && path.isAbsolute(backup.copy))) && typeof backup.label === 'string' && backup.fingerprint && typeof backup.fingerprint.exists === 'boolean' && typeof backup.fingerprint.hash === 'string' && typeof backup.fingerprint.mode === 'number');

/** A failed new transaction keeps an old-reader rejection barrier without depending on its archived log. */
export function decodeJournalCheckpoint(value: any, file = 'journal.json'): JournalData {
  if (!value || value.schema !== 2 || value.format !== 'git-layer-journal-checkpoint-v2' || value.state === 'completed') throw new LabError('METADATA_INVALID', 'Checkpoint de journal desconhecido ou inválido.', { path: file });
  const { format, checksum, ...data } = value; data.schema = 1;
  if (!isJournal(data) || typeof checksum !== 'string' || !/^[a-f0-9]{64}$/u.test(checksum) || checksum !== journalHash(data)) throw new LabError('METADATA_INVALID', 'Checkpoint de journal inválido; dados preservados.', { path: file });
  return data as JournalData;
}
export function encodeJournalCheckpoint(data: JournalData): unknown {
  return { ...data, schema: 2, format: 'git-layer-journal-checkpoint-v2', checksum: journalHash(data) };
}

type JournalPayload =
  | { kind: 'snapshot'; data: JournalData }
  | { kind: 'tracked'; files: number; backups: number; steps: number; file: TrackedRecoveryFile; backup: JournalBackup; step: JournalStep; updatedAt: string }
  | { kind: 'after'; index: number; path: string; steps: number; after: Fingerprint; step: JournalStep; updatedAt: string };
const journalHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const journalInvalid = (file: string, reason: string): never => { throw new LabError('METADATA_INVALID', 'Journal incremental inválido; registros e backups foram preservados.', { path: file, reason }); };
type JournalIdentity = { dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number };
const sameJournalIdentity = (a: JournalIdentity, b: JournalIdentity): boolean => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const prettySize = (value: unknown, indent = 0): number => {
  const encoded = JSON.stringify(value, null, 2);
  return Buffer.byteLength(encoded) + encoded.split('\n').length * indent;
};
const appendedSize = (value: unknown, depth: number, previousLength: number): number => prettySize(value, (depth + 1) * 2) + 2 + (previousLength === 0 ? depth * 2 : 0);
const tipBytes = (id: string, sequence: number, size: number, hash: string): Buffer => {
  const value = { schema: 1, id, sequence, size, hash };
  return Buffer.from(JSON.stringify({ ...value, checksum: journalHash(value) }).padEnd(512, ' '));
};
/** Fixed-size watermark. A torn overwrite fails its checksum instead of accepting an older prefix. */
async function writeJournalTip(file: string, bytes: Buffer, expected?: JournalIdentity): Promise<JournalIdentity> {
  await noLinks(file);
  if (expected) {
    let current;
    try { current = await fs.lstat(file); } catch (error) { if (codeOf(error) === 'ENOENT') journalInvalid(file, 'tip-missing'); throw error; }
    if (!current.isFile() || current.nlink !== 1 || !sameJournalIdentity(current, expected)) journalInvalid(file, 'tip-changed');
  }
  const handle = await fs.open(file, constants.O_RDWR | (expected ? 0 : constants.O_CREAT | constants.O_EXCL) | OPEN_NOFOLLOW, 0o600);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || expected && !sameJournalIdentity(opened, expected)) journalInvalid(file, 'tip-open-changed');
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.write(bytes, offset, bytes.length - offset, offset);
      if (!result.bytesWritten) throw new Error('Escrita do watermark não avançou.');
      offset += result.bytesWritten;
    }
    await handle.sync();
    const actual = Buffer.alloc(bytes.length); const read = await handle.read(actual, 0, actual.length, 0);
    const after = await handle.stat(), current = await fs.lstat(file);
    if (read.bytesRead !== bytes.length || !actual.equals(bytes) || !current.isFile() || current.nlink !== 1 || after.nlink !== 1 || !sameJournalIdentity(after, current) || after.dev !== opened.dev || after.ino !== opened.ino || after.size !== bytes.length) journalInvalid(file, 'tip-publication-changed');
    return after;
  } finally { await handle.close(); }
}

/** Decode only complete, ordered, transaction-bound records. A damaged tail is never silently ignored. */
async function replayJournal(file: string, manifest: any): Promise<JournalData> {
  const tip = path.join(path.dirname(file), 'events.tip'), watermark = (await readRegular(tip, 512)).bytes;
  const log = path.join(path.dirname(file), 'events.log'), { bytes } = await readRegular(log, MAX_JOURNAL_LOG_BYTES);
  const data = decodeIncrementalJournal(manifest, bytes, watermark, file);
  if (!(await readRegular(tip, 512)).bytes.equals(watermark)) journalInvalid(file, 'tip-changed-during-read');
  // A concurrent checkpoint/replacement must not let a mixed observation escape.
  const current = JSON.parse((await readRegular(file, MAX_METADATA_BYTES)).bytes.toString('utf8'));
  if (journalHash(current) !== journalHash(manifest)) journalInvalid(file, 'manifest-changed');
  return data;
}

/** Pure codec shared with diagnostics/test readers; never authorizes recovery by itself. */
export function decodeIncrementalJournal(manifest: any, bytes: Buffer, watermark: Buffer, file = 'journal.json'): JournalData {
  if (!manifest || manifest.schema !== 2 || manifest.format !== 'git-layer-journal-v2' || manifest.log !== 'events.log' || manifest.tip !== 'events.tip' || typeof manifest.id !== 'string' || !isJournal(manifest.base) || manifest.base.schema !== 1 || manifest.base.id !== manifest.id || manifest.root !== journalHash(manifest.base)) journalInvalid(file, 'manifest');
  let tip: any;
  try { tip = JSON.parse(watermark.toString('utf8')); } catch { journalInvalid(file, 'tip-json'); }
  if (!tip || typeof tip !== 'object' || Array.isArray(tip)) journalInvalid(file, 'tip-json');
  const { checksum: tipChecksum, ...signedTip } = tip;
  if (watermark.length !== 512 || tip.schema !== 1 || tip.id !== manifest.id || !Number.isSafeInteger(tip.sequence) || tip.sequence < 0 || tip.size !== bytes.length || tipChecksum !== journalHash(signedTip)) journalInvalid(file, 'tip-or-truncated-log');
  if (bytes.length > MAX_JOURNAL_LOG_BYTES) journalInvalid(file, 'log-size');
  let data = structuredClone(manifest.base) as JournalData, previous = manifest.root as string, sequence = 0;
  if (bytes.length && bytes[bytes.length - 1] !== 10) journalInvalid(file, 'partial-tail');
  const lines = bytes.toString('utf8').split('\n'); lines.pop();
  for (const line of lines) {
    if (!line) journalInvalid(file, 'empty-record');
    if (Buffer.byteLength(line) > MAX_METADATA_BYTES) journalInvalid(file, 'record-size');
    let event: any;
    try { event = JSON.parse(line); } catch { journalInvalid(file, 'record-json'); }
    if (!event || typeof event !== 'object' || Array.isArray(event)) journalInvalid(file, 'record-json');
    const { checksum, ...signed } = event;
    if (event.schema !== 1 || event.id !== manifest.id || event.sequence !== ++sequence || event.previous !== previous || checksum !== journalHash(signed)) journalInvalid(file, 'sequence-or-checksum');
    const payload = event.payload as JournalPayload;
    if (payload?.kind === 'snapshot') {
      if (!isJournal(payload.data) || payload.data.schema !== 1 || payload.data.id !== manifest.id) journalInvalid(file, 'snapshot');
      data = payload.data;
    } else if (payload?.kind === 'tracked') {
      const files = (data as any).recovery?.files;
      if (!Array.isArray(files) || files.length !== payload.files || data.backups.length !== payload.backups || data.steps.length !== payload.steps || !payload.file || !payload.backup || payload.file.path !== payload.backup.source || payload.file.backup !== payload.backup.copy || !sameFingerprint(payload.file.before, payload.backup.fingerprint) || payload.step?.step !== 'backup-ready' || (payload.step.details as any)?.path !== payload.file.path || typeof payload.updatedAt !== 'string') journalInvalid(file, 'tracked-delta');
      files.push(payload.file); data.backups.push(payload.backup); data.steps.push(payload.step); data.updatedAt = payload.updatedAt;
    } else if (payload?.kind === 'after') {
      const entry = (data as any).recovery?.files?.[payload.index];
      if (!Number.isSafeInteger(payload.index) || payload.index < 0 || !entry || entry.path !== payload.path || data.steps.length !== payload.steps || payload.step?.step !== 'write-completed' || (payload.step.details as any)?.path !== payload.path || !payload.after || typeof payload.after.exists !== 'boolean' || typeof payload.after.hash !== 'string' || typeof payload.after.mode !== 'number' || typeof payload.updatedAt !== 'string') journalInvalid(file, 'after-delta');
      entry.after = payload.after; data.steps.push(payload.step); data.updatedAt = payload.updatedAt;
    } else journalInvalid(file, 'unknown-record');
    previous = checksum;
  }
  if (sequence !== tip.sequence || previous !== tip.hash) journalInvalid(file, 'tip-sequence-or-hash');
  if (Buffer.byteLength(JSON.stringify(data, null, 2) + '\n') > MAX_METADATA_BYTES) journalInvalid(file, 'materialized-size');
  return data;
}

export class Transaction {
  readonly id: string;
  readonly dir: string;
  // Operations attach their own typed recovery plan before recording a step.
  // Persistent reads are validated separately at the recovery boundary.
  data: any;
  private sequence = 0;
  private previous = '';
  private logIdentity?: JournalIdentity;
  private tipIdentity?: JournalIdentity;
  private journalFingerprint?: Fingerprint;
  private delta?: { step: string; payload: Omit<Extract<JournalPayload, { kind: 'tracked' }>, 'step' | 'updatedAt'> | Omit<Extract<JournalPayload, { kind: 'after' }>, 'step' | 'updatedAt'> };
  private poisoned = false;
  private checkpointed = false;
  private readonly fileIndexes = new Map<TrackedRecoveryFile, number>();
  private readonly filePaths = new Set<string>();
  private readonly recordedAfter = new Map<TrackedRecoveryFile, Fingerprint | undefined>();
  private logicalBytes = 0;
  private recordedContext = new Map<string, unknown>();
  private recordedSteps = 0;
  private recordedBackups = 0;

  /** Immutable BEFORE images are references captured by the caller; other context assignments force a snapshot. */
  private context(): Map<string, unknown> {
    const result = new Map<string, unknown>();
    for (const key of Object.keys(this.data)) if (!['updatedAt', 'steps', 'backups', 'recovery'].includes(key)) result.set('data:' + key, this.data[key]);
    result.set('recovery', this.data.recovery);
    for (const key of Object.keys(this.data.recovery ?? {})) result.set('recovery:' + key, this.data.recovery[key]);
    return result;
  }

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
    transaction.logicalBytes = prettySize(transaction.data) + 1;
    transaction.recordedContext = transaction.context();
    const log = await fs.open(path.join(folder, 'events.log'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | OPEN_NOFOLLOW, 0o600);
    try { await log.sync(); transaction.logIdentity = await log.stat(); } finally { await log.close(); }
    transaction.previous = journalHash(transaction.data);
    transaction.tipIdentity = await writeJournalTip(path.join(folder, 'events.tip'), tipBytes(id, 0, 0, transaction.previous));
    await atomicJSON(path.join(folder, 'journal.json'), { schema: 2, format: 'git-layer-journal-v2', id, state: 'pending', log: 'events.log', tip: 'events.tip', root: transaction.previous, base: transaction.data });
    transaction.journalFingerprint = await fingerprint(path.join(folder, 'journal.json'));
    await syncDirectory(parent);
    return transaction;
  }

  private async persist(): Promise<void> {
    if (this.poisoned) journalInvalid(this.dir, 'previous-write-failed');
    this.data.updatedAt = new Date().toISOString();
    // Rollback/checkpoint callers can keep using this transaction after fail or
    // finish. Once a schema1 snapshot supersedes the log, all later writes must
    // update that authoritative snapshot instead of appending invisible events.
    if (this.checkpointed || this.data.state !== 'pending') {
      this.delta = undefined;
      const journal = path.join(this.dir, 'journal.json');
      if (!this.journalFingerprint || !sameFingerprint(await fingerprint(journal), this.journalFingerprint)) journalInvalid(journal, 'checkpoint-manifest-changed');
      if (!this.checkpointed) for (const [name, expected] of [['events.log', this.logIdentity], ['events.tip', this.tipIdentity]] as const) {
        const file = path.join(this.dir, name); await noLinks(file);
        let actual;
        try { actual = await fs.lstat(file); } catch (error) { if (codeOf(error) === 'ENOENT') journalInvalid(file, 'checkpoint-component-missing'); throw error; }
        if (!expected || !actual.isFile() || actual.nlink !== 1 || !sameJournalIdentity(actual, expected)) journalInvalid(file, 'checkpoint-component-changed');
      }
      await atomicJSON(journal, this.data.state === 'completed' ? this.data : encodeJournalCheckpoint(this.data));
      this.journalFingerprint = await fingerprint(journal);
      this.checkpointed = true;
      return;
    }
    const context = this.context(); let planned = this.delta; this.delta = undefined;
    if (planned && (context.size !== this.recordedContext.size || [...context].some(([key, value]) => this.recordedContext.get(key) !== value) || planned.payload.steps !== this.recordedSteps || this.data.steps.length !== this.recordedSteps + 1 || this.data.backups.length !== this.recordedBackups + (planned.payload.kind === 'tracked' ? 1 : 0))) planned = undefined;
    const payload: JournalPayload = planned ? { ...planned.payload, step: this.data.steps.at(-1), updatedAt: this.data.updatedAt } as JournalPayload : { kind: 'snapshot', data: this.data };
    let logicalBytes: number;
    if (payload.kind === 'tracked') logicalBytes = this.logicalBytes + appendedSize(payload.file, 2, payload.files) + appendedSize(payload.backup, 1, payload.backups) + appendedSize(payload.step, 1, payload.steps);
    else if (payload.kind === 'after') {
      const current = this.data.recovery.files[payload.index], previous = { ...current }, oldAfter = this.recordedAfter.get(current);
      if (oldAfter === undefined) delete previous.after; else previous.after = oldAfter;
      logicalBytes = this.logicalBytes + prettySize(current, 6) - prettySize(previous, 6) + appendedSize(payload.step, 1, payload.steps);
    } else logicalBytes = prettySize(this.data) + 1;
    if (logicalBytes > MAX_METADATA_BYTES) journalInvalid(this.dir, 'materialized-size');
    const signed = { schema: 1, id: this.id, sequence: this.sequence + 1, previous: this.previous, payload }, checksum = journalHash(signed);
    const bytes = Buffer.from(JSON.stringify({ ...signed, checksum }) + '\n');
    if (bytes.length > MAX_METADATA_BYTES || (this.logIdentity?.size ?? 0) + bytes.length > MAX_JOURNAL_LOG_BYTES) journalInvalid(this.dir, 'record-or-log-size');
    if (!this.journalFingerprint || !sameFingerprint(await fingerprint(path.join(this.dir, 'journal.json')), this.journalFingerprint)) journalInvalid(this.dir, 'manifest-changed-before-append');
    const file = path.join(this.dir, 'events.log');
    await noLinks(file);
    let before;
    try { before = await fs.lstat(file); } catch (error) { if (codeOf(error) === 'ENOENT') journalInvalid(file, 'log-missing'); throw error; }
    const expected = this.logIdentity;
    if (!expected || !before.isFile() || before.nlink !== 1 || before.dev !== expected.dev || before.ino !== expected.ino || before.size !== expected.size || before.mtimeMs !== expected.mtimeMs || before.ctimeMs !== expected.ctimeMs) journalInvalid(file, 'log-changed');
    const handle = await fs.open(file, constants.O_RDWR | constants.O_APPEND | OPEN_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size || opened.mtimeMs !== before.mtimeMs || opened.ctimeMs !== before.ctimeMs) journalInvalid(file, 'log-open-changed');
      // Once a write is attempted, a partial append cannot be repaired or hidden by fail().
      this.poisoned = true;
      let offset = 0;
      while (offset < bytes.length) {
        const written = await handle.write(bytes, offset, bytes.length - offset, null);
        if (!written.bytesWritten) throw new Error('Append do journal não avançou.');
        offset += written.bytesWritten;
      }
      await handle.sync();
      const after = await handle.stat(), current = await fs.lstat(file);
      if (after.size !== before.size + bytes.length || after.nlink !== 1 || current.nlink !== 1 || after.dev !== current.dev || after.ino !== current.ino || after.size !== current.size || after.mtimeMs !== current.mtimeMs || after.ctimeMs !== current.ctimeMs || !current.isFile() || current.isSymbolicLink()) journalInvalid(file, 'log-publication-changed');
      this.tipIdentity = await writeJournalTip(path.join(this.dir, 'events.tip'), tipBytes(this.id, this.sequence + 1, after.size, checksum), this.tipIdentity);
      this.logIdentity = after; this.sequence++; this.previous = checksum; this.poisoned = false; this.logicalBytes = logicalBytes;
      this.recordedContext = context; this.recordedSteps = this.data.steps.length; this.recordedBackups = this.data.backups.length;
      if (payload.kind === 'after') this.recordedAfter.set(this.data.recovery.files[payload.index], { ...payload.after });
      else if (payload.kind === 'snapshot') for (const entry of this.data.recovery?.files ?? []) this.recordedAfter.set(entry, entry.after && { ...entry.after });
    } finally { await handle.close(); }
  }

  async record(step: string, details?: unknown): Promise<void> {
    if (!step || step.length > 200 || /[\u0000-\u001f]/.test(step)) throw new LabError('INVALID_ARGUMENT', 'Etapa de transação inválida.');
    this.data.steps.push({ step, at: new Date().toISOString(), ...(details === undefined ? {} : { details }) });
    if (this.delta?.step !== step) this.delta = undefined;
    await this.persist();
  }

  /** Typed AFTER delta; keeps the existing record() interception/durability boundary. */
  async recordFileWrite(file: TrackedRecoveryFile | undefined): Promise<void> {
    const index = file && this.fileIndexes.get(file);
    if (file?.after && index !== undefined && this.data.recovery?.files?.[index] === file) {
      this.delta = { step: 'write-completed', payload: { kind: 'after', index, path: file.path, after: file.after, steps: this.data.steps.length } };
    }
    await this.record('write-completed', file ? { path: file.path } : undefined);
  }

  /** Prepare independent durable bytes only; callers must publish their journal before returning. */
  private async prepareBackup(file: string, label: string): Promise<JournalBackup> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/.test(label)) throw new LabError('INVALID_ARGUMENT', 'Rótulo de backup inválido.');
    const source = path.resolve(file);
    // Establish absence before creating a copy; errors other than ENOENT remain visible.
    let present = true;
    try { await noLinks(source); await fs.lstat(source); }
    catch (error) { if (codeOf(error) !== 'ENOENT') throw error; present = false; }
    if (!present) {
      return { source, copy: null, label, fingerprint: { exists: false, hash: '', mode: 0 }, at: new Date().toISOString() };
    }
    const backupDirectory = path.join(this.dir, 'backups');
    await ensureDirectory(backupDirectory);
    const copy = path.join(backupDirectory, `${randomUUID()}-${label}`);
    const expected = await copyRegular(source, copy);
    await syncDirectory(backupDirectory);
    if (!sameFingerprint(expected, await fingerprint(source))) throw new LabError('EXTERNAL_CHANGE', 'O arquivo mudou durante o backup. A cópia foi preservada e a operação foi interrompida.', { path: source, backup: copy });
    return { source, copy, label, fingerprint: expected, at: new Date().toISOString() };
  }

  /** Return a durable absolute copy and durable journal entry; absence is explicit. */
  async backup(file: string, label: string): Promise<string | null> {
    const entry = await this.prepareBackup(file, label);
    this.data.backups.push(entry);
    await this.persist();
    return entry.copy;
  }

  /** Publish backup plus recovery authority together, before the tracked caller can mutate. */
  async backupTracked(file: string, label: string, before: Fingerprint, files: TrackedRecoveryFile[]): Promise<TrackedRecoveryFile> {
    if (!Array.isArray(files) || this.data.recovery?.files !== files) throw new LabError('RECOVERY_INVALID', 'O plano de arquivos deve compartilhar a lista da transação.');
    const source = path.resolve(file);
    if (this.fileIndexes.size === files.length ? this.filePaths.has(source) : files.some(entry => entry.path === source)) throw new LabError('RECOVERY_INVALID', 'O arquivo já possui um plano de recuperação nesta transação.');
    const original = { ...before }, entry = await this.prepareBackup(file, label);
    if (entry.source !== source || original.exists !== (entry.copy !== null) || !sameFingerprint(entry.fingerprint, original) || entry.copy !== null && !sameFingerprint(await fingerprint(entry.copy), original)) {
      throw new LabError('EXTERNAL_EDIT', `Arquivo mudou antes do backup: ${file}`);
    }
    const tracked = { path: entry.source, before: original, backup: entry.copy };
    const fileIndex = files.length, backupIndex = this.data.backups.length, stepIndex = this.data.steps.length;
    this.data.backups.push(entry);
    files.push(tracked);
    this.fileIndexes.set(tracked, fileIndex);
    this.filePaths.add(source);
    this.delta = { step: 'backup-ready', payload: { kind: 'tracked', files: fileIndex, backups: backupIndex, steps: stepIndex, file: tracked, backup: entry } };
    // record() atomically persists both arrays and awaits the same durability
    // boundary that track() previously published after backup()'s own persist.
    await this.record('backup-ready', { path: entry.source });
    return tracked;
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

/** Read one strict journal for independent diagnostics without loading other entries. */
export async function readTransaction(directory: string, id: string): Promise<any> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new LabError('METADATA_INVALID', 'Identificador de transação inválido; a entrada foi preservada.', { id });
  const folder = path.resolve(directory, 'transactions', id);
  const journal = await readJSON<JournalData>(path.join(folder, 'journal.json'), isJournal);
  if (journal.id !== id) throw new LabError('METADATA_INVALID', 'Identificador da transação não corresponde ao seu diretório.', { path: folder });
  return journal;
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
    const journal = await readTransaction(directory, entry.name);
    if (journal.state !== 'completed') pending.push(journal);
  }
  return pending;
}
