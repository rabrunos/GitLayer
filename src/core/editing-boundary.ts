import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { git, type RepoInfo } from './git.js';
import { ignoredWithoutManagedExcludes } from './ignore.js';
import { assertNoCollisions, safePath, validatePath, walk } from './paths.js';
import { fingerprint } from './storage.js';
import { LabError } from './errors.js';

export interface EditingBoundaryOptions {
  readOwners: () => Promise<ReadonlyMap<string, string>>;
  /** User info/exclude rules only, with the managed block removed. */
  readUserExclude: () => Promise<string>;
  /** At most three bounded attempts; the default is three. */
  maxAttempts?: number;
}
export interface EditingBoundary {
  before: string[];
  unassigned: string[];
  /** Call before publishing this transition, after updating managed excludes. */
  revalidate: () => Promise<void>;
}
interface ContextObservation {
  signature: string;
  gitSignature: string;
  owners: ReadonlyMap<string, string>;
  userExclude: string;
}
interface Observation {
  before: string[];
  unassigned: string[];
  context: string;
}
const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const changed = (reason: string, retry = true): never => {
  throw new LabError('EDITING_BOUNDARY_CHANGED', 'O workspace mudou durante a escolha do destino; nenhum contexto inconsistente será publicado. Tente novamente quando as alterações externas terminarem.', { reason, retry });
};
const samePaths = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((entry, index) => entry === b[index]);

function paths(values: readonly string[]): string[] {
  const result = values.map(validatePath).sort();
  if (new Set(result).size !== result.length) changed('duplicate-path');
  assertNoCollisions(result.map(entry => ({ path: entry, owner: 'baseline de edição' })));
  return result;
}
function assertBoundary(before: readonly string[], unassigned: readonly string[]): void {
  const validatedBefore = paths(before), validatedUnassigned = paths(unassigned);
  const existing = new Set(validatedBefore);
  if (validatedUnassigned.some(entry => !existing.has(entry))) changed('unassigned-outside-before');
}

async function ignoreFile(file: string): Promise<unknown> {
  // Git may intentionally read a configured ignore file through a symlink.
  // Resolve it for this read-only observation; never write or unlink it.
  try {
    const resolved = await fs.realpath(file);
    return { path: file, resolved, fingerprint: await fingerprint(resolved) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { path: file, missing: true };
    throw error;
  }
}

async function context(repo: RepoInfo, files: string[], options: EditingBoundaryOptions): Promise<ContextObservation> {
  try {
    await fs.lstat(repo.index + '.lock');
    throw new LabError('LOCKED', 'Há um lock real do índice principal; o destino de edição não será publicado.');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const [head, symbolic, refs, index, config, configured, owners, userExclude] = await Promise.all([
    git(repo.root, ['rev-parse', '--verify', 'HEAD']),
    git(repo.root, ['symbolic-ref', '--quiet', 'HEAD'], { ok: [0, 1] }),
    git(repo.root, ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)']),
    fingerprint(repo.index),
    git(repo.root, ['config', '--null', '--list']),
    git(repo.root, ['config', '--null', '--path', '--get', 'core.excludesFile'], { ok: [0, 1] }),
    options.readOwners(),
    options.readUserExclude(),
  ]);
  if (head.stdout.toString('utf8').trim() !== repo.head || symbolic.stdout.toString('utf8').trim() !== 'refs/heads/' + repo.branch) changed('head-or-branch', false);
  const ownership = [...owners].map(([file, owner]) => {
    validatePath(file);
    if (typeof owner !== 'string' || !owner) changed('invalid-owner');
    return [file, owner];
  }).sort(([a], [b]) => a!.localeCompare(b!));
  const globalFile = configured.code === 0
    ? configured.stdout.toString('utf8').replace(/\0$/u, '')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || os.homedir(), '.config'), 'git', 'ignore');
  const rules = await Promise.all(files.filter(file => path.posix.basename(file) === '.gitignore').map(async file => ({
    path: file, fingerprint: await fingerprint(await safePath(repo.root, file, false)),
  })));
  const global = globalFile ? await ignoreFile(path.resolve(repo.root, globalFile)) : null;
  // Config values stay private: only a digest is retained and errors name the
  // changed domain, never a credential, identity or global ignore contents.
  const present=new Set(files);
  const ownedPresence=ownership.map(([file,owner])=>[file,owner,present.has(file!)]);
  const gitSignature = digest({ head: head.stdout.toString('utf8'), symbolic: symbolic.stdout.toString('utf8'), refs: refs.stdout.toString('utf8'), index, ownership, ownedPresence });
  return { owners, userExclude, gitSignature, signature: digest({
    gitSignature, config: digest(config.stdout.toString('utf8')),
    userExclude: digest(userExclude), rules, global,
  }) };
}

async function observe(repo: RepoInfo, readContext: (files: string[]) => Promise<ContextObservation>): Promise<Observation> {
  const before = paths(await walk(repo.root));
  const initial = await readContext(before);
  const candidates = before.filter(file => !initial.owners.has(file));
  const ignored = await ignoredWithoutManagedExcludes(repo, candidates, initial.userExclude);
  const unassigned = candidates.filter(file => !ignored.has(file));
  const after = paths(await walk(repo.root));
  const final = await readContext(after);
  if (!samePaths(before, after)) changed('paths');
  if (initial.signature !== final.signature) changed('git-ownership-or-ignore');
  assertBoundary(before, unassigned);
  return { before, unassigned, context: final.signature };
}

function retryable(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | LabError | undefined)?.code;
  if (code === 'EDITING_BOUNDARY_CHANGED') return ((error as LabError).details as { retry?: boolean } | undefined)?.retry !== false;
  return ['EXTERNAL_CHANGE', 'ENOENT', 'ENOTDIR'].includes(code ?? '');
}

/**
 * Capture the old-file boundary without publishing, reserving or staging.
 * Two path scans surround native ignore evaluation, with Git/ownership/ignore
 * observations on both sides. A changing filesystem is retried a bounded
 * number of times; an incoherent observation is never returned.
 *
 * This is an optimistic boundary, not an OS lock or a history of external
 * writes. Ordinary files created after a validated boundary are allowed by
 * revalidate(): they are newcomers for the selected target. Changes to Git,
 * ownership or ignore before publication instead require a fresh transition.
 */
export async function captureEditingBoundary(repo: RepoInfo, options: EditingBoundaryOptions): Promise<EditingBoundary> {
  const attempts = options.maxAttempts ?? 3;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new LabError('INVALID_ARGUMENT', 'A captura do destino permite de uma a três tentativas.');
  }
  let gitAnchor: string | undefined;
  const readContext = async (files: string[]): Promise<ContextObservation> => {
    const current = await context(repo, files, options);
    if (gitAnchor === undefined) gitAnchor = current.gitSignature;
    else if (gitAnchor !== current.gitSignature) changed('git-context', false);
    return current;
  };
  let observation: Observation | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { observation = await observe(repo, readContext); break; }
    catch (error) {
      if (!retryable(error)) throw error;
      if (attempt === attempts - 1) changed('unstable-observation');
    }
  }
  const captured = observation!;
  const before = [...captured.before], unassigned = [...captured.unassigned];
  return { before, unassigned, revalidate: async () => {
    assertBoundary(before, unassigned);
    if (!samePaths(before, captured.before) || !samePaths(unassigned, captured.unassigned)) changed('captured-boundary-modified');
    try {
      const currentPaths = paths(await walk(repo.root));
      const current = await readContext(currentPaths);
      const finalPaths = paths(await walk(repo.root));
      const final = await readContext(finalPaths);
      if (current.signature !== captured.context || final.signature !== captured.context) changed('git-ownership-or-ignore-before-publication');
    } catch (error) {
      if (retryable(error)) changed('unstable-pre-publication');
      throw error;
    }
  } };
}
