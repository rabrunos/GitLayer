import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { git, type GitResult, type RepoInfo } from './git.js';
import { LabError } from './errors.js';
import { observeIndexIdentity as identity, sameIndexIdentity as sameIdentity, preserveIndexTimestamp, type IndexIdentity as Identity, type IndexTimestamp } from './index-timestamp.js';
import { assertNoPathLinks } from './layout.js';
import { validatePath } from './paths.js';
import { atomicJSON, copyRegular, fingerprint, readJSON, sameFingerprint, type Fingerprint } from './storage.js';

const codeOf = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | undefined)?.code;
const within = (parent: string, file: string): boolean => {
  const relative = path.relative(path.toNamespacedPath(path.resolve(parent)), path.toNamespacedPath(path.resolve(file)));
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
};
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
interface SourceImage { fingerprint: Fingerprint; identity: Identity | null }
const changed = (sourceIndex: string, reason: string): never => { throw new LabError('EXTERNAL_EDIT', 'O indice mudou durante a consulta. O escritor externo e seus dados foram preservados.', { sourceIndex, reason }); };

async function noLock(file: string): Promise<void> {
  await assertNoPathLinks(path.dirname(file));
  try { await fs.lstat(file); }
  catch (error) { if (codeOf(error) === 'ENOENT') return; throw error; }
  throw new LabError('LOCKED', 'Lock nativo existente foi preservado; a consulta nao remove locks.', { path: file });
}
async function observeSource(source: string): Promise<SourceImage> {
  await noLock(source + '.lock');
  const before = await identity(source), observed = await fingerprint(source), after = await identity(source);
  if (!sameIdentity(before, after) || observed.exists !== (after !== null)) changed(source, 'index-changed-during-observation');
  await noLock(source + '.lock'); return { fingerprint: observed, identity: after };
}
async function revalidateSource(source: string, expected: SourceImage): Promise<void> {
  const current = await observeSource(source);
  if (!sameFingerprint(expected.fingerprint, current.fingerprint) || !sameIdentity(expected.identity, current.identity)) changed(source, 'index-changed-after-snapshot');
}
function validateArguments(args: string[]): void {
  const separator = args.indexOf('--'), flags = new Set(['--name-status', '-z', '--no-renames']);
  if (args[0] !== 'diff' || separator < 1 || args.some(arg => typeof arg !== 'string' || arg.includes('\0')) || args.slice(1, separator).some(arg => !flags.has(arg))) {
    throw new LabError('INVALID_ARGUMENT', 'Consulta requer diff worktree com flags de leitura conhecidas e separador --.');
  }
  for (const file of args.slice(separator + 1)) validatePath(file);
}

/**
 * A read-only Core query must not let Git's automatic stat refresh rewrite the
 * real index. Disabling refresh can expose stat-only paths as false changes;
 * replacing diff with different plumbing can also change native semantics.
 * Instead, give the unchanged official diff argv/defaults a fresh independent
 * index copy. Only that disposable copy may receive Git's normal refresh.
 *
 * Criteria: no source/live-index/ref/Layer JSON writes; no live-index cache; bounded
 * copy memory; an absent source remains absent (never a fabricated empty file);
 * scratch mtime remains positive and no later than the exact source mtime, so
 * native racy-stat entries cannot become falsely clean after the byte copy;
 * source hashes, modes, identities and locks checked before/after the query.
 * This is optimistic observation, not serialization of unrelated Git writers
 * or an ACL against actors writing inside the private temporary directory.
 */
export async function queryIndexDiff(repo: RepoInfo, index: string, args: string[]): Promise<GitResult> {
  args = [...args]; // Validate and execute one immutable argv observation across awaits.
  validateArguments(args);
  return executeIndexQuery(repo, index, args, 'diff');
}

/**
 * Recovery validation only, never a preview or a normal status/diff query.
 * Native write-tree may create or freshen Git objects, as ordinary Git does.
 * The live source/index, refs and Layer JSON are never publication targets.
 * Callers cannot supply argv: this entry point always runs exactly write-tree.
 */
export async function queryIndexTree(repo: RepoInfo, index: string): Promise<GitResult> {
  return executeIndexQuery(repo, index, ['write-tree'], 'write-tree-validation');
}

/** Share every copy/timestamp/source/lock/receipt/cleanup check between fixed operations. */
async function executeIndexQuery(repo: RepoInfo, index: string, args: string[], operation: 'diff' | 'write-tree-validation'): Promise<GitResult> {
  if (!path.isAbsolute(index)) throw new LabError('INVALID_ARGUMENT', 'O indice da consulta deve ser absoluto.');
  const source = path.resolve(index);
  if (source !== path.resolve(repo.index) && !within(repo.gitDir, source)) throw new LabError('UNSAFE_PATH', 'O indice nao pertence ao repositorio consultado.', { sourceIndex: source });
  const before = await observeSource(source);
  const requestedParent = path.resolve(os.tmpdir()); await assertNoPathLinks(requestedParent);
  const parent = await fs.realpath(requestedParent), parentStat = await fs.lstat(parent, { bigint: true });
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new LabError('UNSAFE_PATH', 'O temporario precisa ser um diretorio regular externo.');
  const protectedRoots: string[] = [];
  for (const candidate of new Set([repo.root, repo.gitDir, repo.commonDir])) {
    await assertNoPathLinks(candidate); protectedRoots.push(await fs.realpath(candidate));
  }
  if (protectedRoots.some(root => within(root, parent))) throw new LabError('UNSAFE_PATH', 'TEMP dentro do workspace ou do armazenamento Git foi recusado antes de criar a copia.', { sourceIndex: source });
  const nonce = randomUUID(), directory = await fs.mkdtemp(path.join(parent, 'git-layer-index-query-' + nonce + '-'));
  const acquired = await fs.lstat(directory, { bigint: true }), receipt = path.join(directory, 'owner.json'), scratch = path.join(directory, 'index');
  let ownerFingerprint: Fingerprint | undefined, ownerIdentity: Identity | null = null, scratchIdentity: Identity | null = null;
  let copied: Fingerprint | undefined, scratchAfter: Fingerprint | undefined, scratchTimestamp: IndexTimestamp | undefined, phase = 'created';
  const removed: string[] = [];
  const owner: any = { schema: 1, kind: 'git-layer-index-query', operation, nonce, parent, directory, sourceIndex: source, sourceBefore: before.fingerprint, scratch: 'index', createdAt: new Date().toISOString(), phase };
  const assertDirectory = async () => {
    await assertNoPathLinks(parent); await assertNoPathLinks(directory);
    const current = await fs.lstat(directory, { bigint: true }), actualParent = await fs.realpath(path.dirname(directory));
    if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== acquired.dev || current.ino !== acquired.ino || actualParent !== parent || protectedRoots.some(root => within(root, directory))) {
      throw new LabError('UNSAFE_PATH', 'O diretorio temporario mudou; seus arquivos foram preservados.', { directory });
    }
    const currentParent = await fs.lstat(parent, { bigint: true });
    if (currentParent.dev !== parentStat.dev || currentParent.ino !== parentStat.ino) throw new LabError('UNSAFE_PATH', 'O pai temporario mudou; dados preservados.', { directory });
  };
  const assertOwner = async () => {
    await assertDirectory();
    const data = await readJSON<any>(receipt, value => value.kind === 'git-layer-index-query' && value.nonce === nonce && value.parent === parent && value.directory === directory && value.sourceIndex === source);
    if (ownerFingerprint && (!sameFingerprint(ownerFingerprint, await fingerprint(receipt)) || !sameIdentity(ownerIdentity, await identity(receipt)))) throw new LabError('EXTERNAL_EDIT', 'O recibo temporario mudou e foi preservado.', { receipt });
    return data;
  };
  const writeReceipt = async (next: string, extra: Record<string, unknown> = {}) => {
    if (ownerFingerprint) await assertOwner(); else {
      await assertDirectory();
      try { await fs.lstat(receipt); throw new LabError('EXTERNAL_EDIT', 'O nome do recibo temporario esta ocupado; entrada preservada.', { receipt }); }
      catch (error) { if (codeOf(error) !== 'ENOENT') throw error; }
    }
    phase = next; Object.assign(owner, extra, { phase, updatedAt: new Date().toISOString() });
    await atomicJSON(receipt, owner); ownerFingerprint = await fingerprint(receipt); ownerIdentity = await identity(receipt);
  };
  // This observation never follows a changed directory/link or repairs it.
  // A failed unlink/rmdir may already have taken effect before rejecting, so
  // confirmed removals are not a substitute for these post-failure facts.
  const observeRetention = async () => {
    type Presence = { state: string; kind?: string; identityMatches?: boolean | null; errorCode?: string | null };
    const notObserved: Presence = { state: 'not-observed' };
    const result: { retention: 'complete' | 'partial' | 'unavailable' | 'identity-changed'; retained: boolean | null; directory: Presence; index: Presence; owner: Presence } = {
      retention: 'unavailable', retained: null, directory: notObserved, index: notObserved, owner: notObserved
    };
    try {
      await assertNoPathLinks(parent);
      const currentParent = await fs.lstat(parent, { bigint: true });
      if (!currentParent.isDirectory() || currentParent.isSymbolicLink() || currentParent.dev !== parentStat.dev || currentParent.ino !== parentStat.ino) {
        return { ...result, retention: 'identity-changed' as const, retained: false, directory: { state: 'not-observed', errorCode: 'PARENT_IDENTITY_CHANGED' } };
      }
      let current: Awaited<ReturnType<typeof fs.lstat>>;
      try { current = await fs.lstat(directory, { bigint: true }); }
      catch (error) {
        if (codeOf(error) === 'ENOENT') return { ...result, retained: false, directory: { state: 'absent' }, index: { state: 'absent' }, owner: { state: 'absent' } };
        throw error;
      }
      if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== acquired.dev || current.ino !== acquired.ino) {
        return { ...result, retention: 'identity-changed' as const, retained: false, directory: { state: 'identity-changed', kind: current.isSymbolicLink() ? 'symlink' : current.isDirectory() ? 'directory' : 'other' } };
      }
      result.retained = true; result.directory = { state: 'present', kind: 'directory', identityMatches: true };
      const presence = async (file: string, expected: Identity | null): Promise<Presence> => {
        try {
          const stat = await fs.lstat(file, { bigint: true });
          if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n) return { state: 'identity-changed', kind: stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : 'other', identityMatches: false };
          const observed = await identity(file);
          return observed === null ? { state: 'absent' } : { state: 'present', kind: 'file', identityMatches: expected ? sameIdentity(expected, observed) : null };
        } catch (error) { return codeOf(error) === 'ENOENT' ? { state: 'absent' } : { state: 'unavailable', errorCode: codeOf(error) ?? null }; }
      };
      result.index = await presence(scratch, scratchIdentity); result.owner = await presence(receipt, ownerIdentity);
      const after = await fs.lstat(directory, { bigint: true }), afterParent = await fs.lstat(parent, { bigint: true });
      if (!after.isDirectory() || after.isSymbolicLink() || after.dev !== acquired.dev || after.ino !== acquired.ino || afterParent.dev !== parentStat.dev || afterParent.ino !== parentStat.ino) {
        return { ...result, retention: 'identity-changed' as const, retained: false, directory: { state: 'identity-changed' }, index: notObserved, owner: notObserved };
      }
      if ([result.index, result.owner].some(file => file.state === 'identity-changed' || file.identityMatches === false)) result.retention = 'identity-changed';
      else {
        const copyPresent = before.fingerprint.exists ? copied !== undefined && result.index.state === 'present' && result.index.identityMatches === true : result.index.state === 'absent' || result.index.state === 'present' && result.index.identityMatches === true;
        result.retention = copyPresent && result.owner.state === 'present' && result.owner.identityMatches === true ? 'complete' : 'partial';
      }
      return result;
    } catch (error) {
      if (error instanceof LabError && error.code === 'UNSAFE_PATH') return { ...result, retention: 'identity-changed' as const, retained: false, directory: { state: 'not-observed', errorCode: error.code } };
      return { ...result, retention: 'unavailable' as const, retained: null, directory: { state: 'unavailable', errorCode: codeOf(error) ?? null } };
    }
  };
  try {
    await assertDirectory(); await fs.chmod(directory, 0o700); await writeReceipt('created');
    await noLock(scratch + '.lock');
    if (before.fingerprint.exists) {
      copied = await copyRegular(source, scratch, before.fingerprint.mode);
      if (!sameFingerprint(copied, before.fingerprint) || !sameFingerprint(await fingerprint(scratch), before.fingerprint)) changed(source, 'index-copy-mismatch');
      const preparedIdentity = await identity(scratch), sourceIdentity = before.identity;
      if (!preparedIdentity || !sourceIdentity) return changed(source, 'private-index-missing-before-timestamp');
      scratchIdentity = preparedIdentity;
      const stamped = await preserveIndexTimestamp(scratch, source, sourceIdentity.mtimeNs, preparedIdentity);
      scratchIdentity = stamped.identity; scratchTimestamp = stamped.timestamp;
      if (!sameFingerprint(await fingerprint(scratch), before.fingerprint) || !sameIdentity(scratchIdentity, await identity(scratch))) changed(source, 'private-index-changed-after-timestamp');
    } else if ((await fingerprint(scratch)).exists) changed(source, 'unexpected-scratch-index');
    await revalidateSource(source, before); await assertOwner();
    await writeReceipt('prepared', { copy: copied ?? null, timestamp: scratchTimestamp ?? null });
    const expectedScratch = copied ?? { exists: false, hash: '', mode: 0 };
    if (!sameIdentity(scratchIdentity, await identity(scratch)) || !sameFingerprint(await fingerprint(scratch), expectedScratch) || !sameIdentity(scratchIdentity, await identity(scratch))) changed(source, 'private-index-changed-before-query');
    if (copied && (!scratchIdentity || !before.identity || scratchIdentity.mtimeNs < 1_000_000_000n || scratchIdentity.mtimeNs > before.identity.mtimeNs)) throw new LabError('INDEX_TIMESTAMP_UNSAFE', 'O timestamp do indice transitório mudou antes da consulta; evidencias preservadas.', { sourceIndex: source });
    await noLock(scratch + '.lock');
    const result = await git(repo.root, args, { index: scratch }); // awaits Git close before any cleanup
    phase = 'query-completed';
    await noLock(scratch + '.lock'); await revalidateSource(source, before); await assertOwner();
    scratchIdentity = await identity(scratch); scratchAfter = await fingerprint(scratch);
    if (!sameIdentity(scratchIdentity, await identity(scratch))) changed(source, 'private-index-changed-after-query');
    if (copied && !scratchAfter.exists) changed(source, 'private-index-disappeared-after-query');
    await writeReceipt('validated', { scratchAfter, sourceAfter: before.fingerprint, git: { argv: [...args], exitCode: result.code, stdoutSHA256: digest(result.stdout), stderrSHA256: digest(result.stderr) } });
    // Delete only the exact proven files. Unknown artifacts/native locks are
    // preserved; recursive deletion and broad temporary cleanup are forbidden.
    await assertOwner(); await noLock(scratch + '.lock');
    const names = await fs.readdir(directory);
    if (names.some(name => !['index', 'owner.json'].includes(name))) throw new LabError('UNSAFE_PATH', 'Artefato temporario desconhecido foi preservado.', { directory });
    if (!sameFingerprint(await fingerprint(scratch), scratchAfter) || !sameIdentity(scratchIdentity, await identity(scratch))) changed(source, 'private-index-changed-before-cleanup');
    phase = 'cleanup';
    if (scratchAfter.exists) { await fs.unlink(scratch); removed.push('index'); }
    await assertOwner(); await fs.unlink(receipt); removed.push('owner.json');
    await assertDirectory(); await fs.rmdir(directory);
    return result;
  } catch (error) {
    const failedPhase = phase;
    const cause = { name: error instanceof Error ? error.name : 'Error', code: codeOf(error) ?? 'INDEX_QUERY_FAILED', message: error instanceof Error ? error.message : String(error) };
    let receiptFailure: unknown = null;
    // Cleanup is not an atomic multi-file deletion. A late cleanup failure
    // reports exact removals and recreates only our nonce-owned receipt.
    if (removed.includes('owner.json')) { ownerFingerprint = undefined; ownerIdentity = null; }
    try { await writeReceipt('failed', { failedPhase, error: cause, removedBeforeFailure: removed, copy: copied ?? null, scratchAfter: scratchAfter ?? null, timestamp: scratchTimestamp ?? null }); }
    catch (failure) { receiptFailure = { code: codeOf(failure) ?? null, message: failure instanceof Error ? failure.message : String(failure) }; }
    const filePresence = await observeRetention();
    const originalDetails = error instanceof LabError && error.details && typeof error.details === 'object' ? error.details : {};
    throw new LabError(cause.code, cause.message, { ...originalDetails, indexQuery: {
      directory, receipt, sourceIndex: source, nonce, operation, phase: failedPhase,
      retention: filePresence.retention, retained: filePresence.retained, filePresence,
      copyCompleted: copied !== undefined, removalsConfirmed: [...removed], removedBeforeFailure: [...removed],
      removalConfirmationScope: 'Only successful unlink returns are listed; a syscall may take effect before throwing. filePresence reports the later read-only observation.',
      receiptFailure
    } });
  }
}
