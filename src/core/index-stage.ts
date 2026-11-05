import * as fs from 'node:fs/promises';
import { constants, type BigIntStats } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { git, type RepoInfo } from './git.js';
import { LabError } from './errors.js';
import { assertNoPathLinks } from './layout.js';
import { validatePath } from './paths.js';
import { comparableFileMode, OPEN_NOFOLLOW } from './platform.js';
import { fingerprint, sameFingerprint, type Fingerprint } from './storage.js';
import { observeIndexIdentity, preserveIndexTimestamp, sameIndexIdentity, type IndexIdentity } from './index-timestamp.js';

export interface StageIndexOptions {
  expected: Fingerprint;
  /** Recheck Core ownership without guard/load or another index writer. */
  beforePublish: () => Promise<void>;
  /** Durably record this AFTER fingerprint before the native lock is renamed. */
  planned: (after: Fingerprint) => Promise<void>;
}
const codeOf = (error: unknown) => (error as NodeJS.ErrnoException | undefined)?.code;
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const signature = (value: unknown) => digest(JSON.stringify(value));
const changed = (reason: string): never => { throw new LabError('EXTERNAL_EDIT', 'O índice, contexto Git ou controles mudaram durante a preparação; dados externos preservados.', { reason }); };
const within = (parent: string, file: string) => {
  const relative = path.relative(path.resolve(parent), path.resolve(file));
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};
function validFingerprint(value: Fingerprint): boolean {
  return value && typeof value.exists === 'boolean' && Number.isInteger(value.mode) &&
    (value.exists ? /^[a-f0-9]{64}$/u.test(value.hash) && value.mode >= 0 && value.mode <= 0o777 : value.hash === '' && value.mode === 0);
}
async function noLock(file: string): Promise<void> {
  try { await fs.lstat(file); }
  catch (error) { if (codeOf(error) === 'ENOENT') return; throw error; }
  throw new LabError('LOCKED', 'Lock nativo existente foi preservado.', { path: file });
}
interface IndexObservation { bytes: Buffer; identity: IndexIdentity }
function indexIdentity(stat: BigIntStats): IndexIdentity {
  return { dev: stat.dev.toString(), ino: stat.ino.toString(), nlink: Number(stat.nlink), size: Number(stat.size), mode: Number(stat.mode),
    mtimeMs: Number(stat.mtimeNs) / 1e6, ctimeMs: Number(stat.ctimeNs) / 1e6, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs };
}
async function readComparedBytes(file: string, expected: Fingerprint): Promise<IndexObservation | undefined> {
  await assertNoPathLinks(file);
  if (!expected.exists) {
    if ((await fingerprint(file)).exists) changed('index-created');
    return undefined;
  }
  const before = await observeIndexIdentity(file);
  if (!before) changed('index-disappeared');
  const handle = await fs.open(file, constants.O_RDONLY | OPEN_NOFOLLOW);
  try {
    const opened = await handle.stat({ bigint: true }), openedIdentity = indexIdentity(opened);
    if (!opened.isFile() || opened.nlink !== 1n || !sameIndexIdentity(before, openedIdentity)) changed('index-open-identity');
    const bytes = await handle.readFile(), after = await handle.stat({ bigint: true }), identity = indexIdentity(after), current = await observeIndexIdentity(file);
    if (!after.isFile() || after.nlink !== 1n || !sameIndexIdentity(openedIdentity, identity) || !sameIndexIdentity(identity, current)) changed('index-read-identity');
    if (!sameFingerprint({ exists: true, hash: digest(bytes), mode: comparableFileMode(Number(after.mode)) }, expected)) changed('index-bytes');
    return { bytes, identity };
  } finally { await handle.close(); }
}
async function readCompared(file: string, expected: Fingerprint): Promise<IndexObservation | undefined> {
  try { return await readComparedBytes(file, expected); }
  catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EXTERNAL_CHANGE'].includes(codeOf(error) ?? '')) changed('index-read');
    throw error;
  }
}
async function verifyObserved(file: string, expected: Fingerprint, identity: IndexIdentity | null): Promise<void> {
  if (!sameIndexIdentity(identity, await observeIndexIdentity(file))) changed('index-temporal-identity');
  if (!sameFingerprint(await fingerprint(file), expected)) changed('index-bytes');
  if (!sameIndexIdentity(identity, await observeIndexIdentity(file))) changed('index-temporal-identity');
}
async function globalIgnore(file: string): Promise<unknown> {
  // Configured user ignore files may legitimately be reached through symlinks.
  // Resolve only for read-only observation, never write through that path.
  try { const resolved = await fs.realpath(file); return { path: file, resolved, fingerprint: await fingerprint(resolved) }; }
  catch (error) { if (codeOf(error) === 'ENOENT') return { path: file, missing: true }; throw error; }
}
function controlFiles(root: string, files: string[]): string[] {
  const directories = new Set<string>(['']);
  for (const file of files) {
    let directory = path.posix.dirname(file);
    while (directory !== '.') { directories.add(directory); directory = path.posix.dirname(directory); }
  }
  return [...directories].sort().flatMap(directory => ['.gitignore', '.gitattributes'].map(name => path.join(root, directory, name)));
}
async function readContext(repo: RepoInfo, controls: string[], files: string[], mainLockOwned: boolean): Promise<string> {
  if (!mainLockOwned) await noLock(repo.index + '.lock');
  const [head, symbolic, refs, config, configured, main, info, infoAttributes, attributes, rules] = await Promise.all([
    git(repo.root, ['rev-parse', '--verify', 'HEAD'], { ok: [0, 128] }),
    git(repo.root, ['symbolic-ref', '--quiet', 'HEAD'], { ok: [0, 1, 128] }),
    git(repo.root, ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)', 'refs/heads/']),
    git(repo.root, ['config', '--null', '--list']),
    git(repo.root, ['config', '--null', '--path', '--get', 'core.excludesFile'], { ok: [0, 1] }),
    fingerprint(repo.index), fingerprint(repo.exclude), fingerprint(path.join(repo.commonDir, 'info', 'attributes')),
    git(repo.root, ['check-attr', '--all', '-z', '--stdin'], { input: files.join('\0') + '\0' }),
    Promise.all(controls.map(async file => ({ file, fingerprint: await fingerprint(file) }))),
  ]);
  const actualHead = head.code === 0 ? head.stdout.toString('utf8').trim() : '';
  if (actualHead !== repo.head || symbolic.code !== 0 || symbolic.stdout.toString('utf8').trim() !== 'refs/heads/' + repo.branch) changed('head-or-branch');
  const globalFile = configured.code === 0 ? configured.stdout.toString('utf8').replace(/\0$/u, '') :
    path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || os.homedir(), '.config'), 'git', 'ignore');
  return signature({ head: actualHead, symbolic: symbolic.stdout.toString('utf8'), refs: refs.stdout.toString('utf8'),
    config: digest(config.stdout), main, info, infoAttributes, attributes: digest(attributes.stdout), rules, global: globalFile ? await globalIgnore(path.resolve(repo.root, globalFile)) : null });
}
async function context(repo: RepoInfo, controls: string[], files: string[], mainLockOwned: boolean): Promise<string> {
  try { return await readContext(repo, controls, files, mainLockOwned); }
  catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EXTERNAL_CHANGE'].includes(codeOf(error) ?? '')) changed('context-read');
    throw error;
  }
}
async function syncDirectory(directory: string): Promise<void> {
  let handle: fs.FileHandle | undefined;
  try { handle = await fs.open(directory, constants.O_RDONLY); await handle.sync(); }
  catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EOPNOTSUPP', 'EBADF', 'EISDIR'].includes(codeOf(error) ?? '') && !(process.platform === 'win32' && codeOf(error) === 'EPERM')) throw error;
  } finally { await handle?.close(); }
}

/**
 * Stage with official Git against a complete, exclusive scratch index. A failed
 * add can change that scratch and Git objects, but never the real index.
 *
 * Publication uses Git's index.lock file protocol and optimistic fingerprints.
 * Native Git writers respecting that lock cannot interleave publication. This
 * is not an ACL: actors ignoring the protocol and writes after the final check
 * remain outside the guarantee. Payload files are not frozen or hashed here;
 * add preserves Git's ordinary file-read semantics. Only relevant control files,
 * Git context and indexes are observed. Effective check-attr values also cover
 * system/global/info attribute providers. Scratch artifacts stay in the journal's
 * directory and are never registered as recovery.files publication targets.
 */
export async function stageIndex(repo: RepoInfo, index: string, directory: string, args: string[], options: StageIndexOptions): Promise<Fingerprint> {
  args = [...args]; // The validated argv remains fixed across every await.
  if (!validFingerprint(options.expected)) throw new LabError('INVALID_ARGUMENT', 'Fingerprint anterior do índice inválido.');
  const expected = { ...options.expected }, separator = args.indexOf('--');
  if (args[0] !== 'add' || separator < 1 || separator === args.length - 1 ||
      args.slice(1, separator).some(arg => !['-A', '--all', '-f', '--force'].includes(arg))) {
    throw new LabError('INVALID_ARGUMENT', 'Preparação requer git add e caminhos explícitos após --.');
  }
  const files = args.slice(separator + 1).map(validatePath), target = path.resolve(index), txDirectory = path.resolve(directory);
  if (!path.isAbsolute(index) || !path.isAbsolute(directory) || !within(repo.gitDir, target) || !within(repo.gitDir, txDirectory) || path.basename(path.dirname(txDirectory)) !== 'transactions') {
    throw new LabError('UNSAFE_PATH', 'Índice e scratch devem pertencer ao armazenamento da transação.');
  }
  await assertNoPathLinks(target); await assertNoPathLinks(txDirectory);
  if (!(await fs.lstat(txDirectory)).isDirectory()) throw new LabError('UNSAFE_PATH', 'Diretório de transação inválido.');
  await noLock(target + '.lock');
  const controls = controlFiles(repo.root, files), initial = await context(repo, controls, files, false);
  const original = await readCompared(target, expected);
  const scratch = path.join(txDirectory, 'stage-' + randomUUID() + '.index');
  // Absent/unborn indexes stay absent. An empty file is not an empty Git index.
  if (original !== undefined) {
    let copiedIdentity: IndexIdentity | undefined;
    const handle = await fs.open(scratch, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | OPEN_NOFOLLOW, expected.mode);
    try {
      await handle.writeFile(original.bytes); await handle.chmod(expected.mode);
      const created = await observeIndexIdentity(scratch);
      if (!created) changed('scratch-missing');
      const stamped = await preserveIndexTimestamp(scratch, target, original.identity.mtimeNs, created!);
      copiedIdentity = stamped.identity;
      await handle.sync();
      if (!sameIndexIdentity(stamped.identity, await observeIndexIdentity(scratch))) changed('scratch-temporal-identity');
    }
    finally { await handle.close(); }
    if (!copiedIdentity) changed('scratch-temporal-identity');
    await verifyObserved(scratch, expected, copiedIdentity!);
  }
  // An index copy must retain native racy-stat eligibility. Recheck the same
  // source observation before Git consumes it; timestamps are not content proof.
  await verifyObserved(target, expected, original?.identity ?? null);
  // The caller has validated attrs/ownership. The Git adapter preserves cwd,
  // literal paths and conversion rules while selecting this alternate index.
  await git(repo.root, [...args], { index: scratch });
  const generated = await fingerprint(scratch);
  if (!generated.exists) changed('scratch-missing');
  const prepared = (await readCompared(scratch, generated))!, bytes = prepared.bytes;
  const mode = expected.exists ? expected.mode : generated.mode;
  const after: Fingerprint = { exists: true, hash: digest(bytes), mode };
  const lock = target + '.lock';
  let handle: fs.FileHandle | undefined, owned: Awaited<ReturnType<typeof fs.lstat>> | undefined;
  let known: Fingerprint | undefined, knownRawMode: number | undefined, knownIdentity: IndexIdentity | undefined, published = false, failed = false;
  const verifyLock = async (): Promise<void> => {
    const identity = owned, expectedLock = known, rawMode = knownRawMode;
    if (!identity || !expectedLock || !knownIdentity) return changed('lock-ownership');
    try {
      const before = await fs.lstat(lock);
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.dev !== identity.dev || before.ino !== identity.ino || before.mode !== rawMode) changed('lock-identity');
      if (!sameIndexIdentity(knownIdentity, await observeIndexIdentity(lock))) changed('lock-temporal-identity');
      if (!sameFingerprint(await fingerprint(lock), expectedLock)) changed('lock-bytes');
      const current = await fs.lstat(lock);
      if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || current.dev !== identity.dev || current.ino !== identity.ino || current.mode !== rawMode) changed('lock-identity');
      if (!sameIndexIdentity(knownIdentity, await observeIndexIdentity(lock))) changed('lock-temporal-identity');
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EXTERNAL_CHANGE'].includes(codeOf(error) ?? '')) changed('lock-read');
      throw error;
    }
  };
  const revalidate = async (): Promise<void> => {
    try {
      await verifyObserved(target, expected, original?.identity ?? null);
      if (await context(repo, controls, files, target === path.resolve(repo.index)) !== initial) changed('git-or-controls');
      await verifyObserved(target, expected, original?.identity ?? null);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EXTERNAL_CHANGE'].includes(codeOf(error) ?? '')) changed('publication-read');
      throw error;
    }
  };
  try {
    await assertNoPathLinks(lock);
    try { handle = await fs.open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | OPEN_NOFOLLOW, 0o600); }
    catch (error) { if (codeOf(error) === 'EEXIST') throw new LabError('LOCKED', 'Lock nativo existente foi preservado.', { path: lock }); throw error; }
    owned = await handle.stat(); knownRawMode = owned.mode; knownIdentity = indexIdentity(await handle.stat({ bigint: true }));
    if (!owned.isFile() || owned.nlink !== 1) changed('lock-identity');
    known = { exists: true, hash: digest(Buffer.alloc(0)), mode: comparableFileMode(owned.mode) };
    await revalidate(); await options.beforePublish();
    await handle.writeFile(bytes);
    known = { exists: true, hash: after.hash, mode: comparableFileMode(owned.mode) };
    await handle.chmod(mode); knownRawMode = (await handle.stat()).mode; known = { ...after };
    knownIdentity = indexIdentity(await handle.stat({ bigint: true }));
    await verifyObserved(scratch, generated, prepared.identity);
    const stamped = await preserveIndexTimestamp(lock, scratch, prepared.identity.mtimeNs, knownIdentity);
    knownIdentity = stamped.identity;
    await handle.sync(); await handle.close(); handle = undefined;
    await verifyLock();
    await options.planned({ ...after });
    await revalidate(); await verifyLock();
    await verifyObserved(scratch, generated, prepared.identity);
    await fs.rename(lock, target); published = true;
    await syncDirectory(path.dirname(target));
    const publishedIdentity = await observeIndexIdentity(target);
    // Rename can update ctime on some filesystems; the stamped mtime and the
    // physical entry/bytes must still be the ones validated before publication.
    if (!publishedIdentity || !knownIdentity || publishedIdentity.dev !== knownIdentity.dev || publishedIdentity.ino !== knownIdentity.ino ||
        publishedIdentity.nlink !== 1 || publishedIdentity.size !== knownIdentity.size || publishedIdentity.mode !== knownIdentity.mode ||
        publishedIdentity.mtimeNs !== knownIdentity.mtimeNs || publishedIdentity.mtimeNs > prepared.identity.mtimeNs) changed('published-index-temporal-identity');
    const actual = await fingerprint(target);
    if (!sameFingerprint(actual, after)) changed('published-index');
    if (!sameIndexIdentity(publishedIdentity, await observeIndexIdentity(target))) changed('published-index-temporal-identity');
    return actual;
  } catch (error) { failed = true; throw error; }
  finally {
    try { await handle?.close(); } catch (error) { if (!failed) throw error; }
    if (owned && !published) {
      try { await verifyLock(); await fs.unlink(lock); }
      catch (error) { if (!failed && codeOf(error) !== 'ENOENT') throw error; }
    }
  }
}
