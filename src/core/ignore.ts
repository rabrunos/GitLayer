import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { git, type RepoInfo } from './git.js';
import { LabError } from './errors.js';

const within = (parent: string, child: string) => {
  const relative = path.relative(path.toNamespacedPath(path.resolve(parent)), path.toNamespacedPath(path.resolve(child)));
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
};

/** Evaluate the user's rules with Git, excluding only our temporary managed block.
 * ls-files reproduces standard precedence using global/info files and per-directory
 * .gitignore. An exclusive scratch input outside the repository is removed in
 * finally; repository metadata, indexes, refs and worktree remain read-only.
 */
export async function ignoredWithoutManagedExcludes(repo: RepoInfo, candidates: string[], userInfoExclude: string): Promise<Set<string>> {
  if (!candidates.length) return new Set();
  const tempParent = await fs.realpath(os.tmpdir());
  for (const root of [repo.root, repo.gitDir, repo.commonDir]) {
    if (within(await fs.realpath(root), tempParent)) throw new LabError('UNSAFE_TEMP', 'A avaliação de exclusões exige temporário externo ao repositório.');
  }
  const scratch = await fs.mkdtemp(path.join(tempParent, 'git-layer-ignore-' + randomUUID() + '-'));
  const localFile = path.join(scratch, 'user-info-exclude');
  const bytes = Buffer.from(userInfoExclude, 'utf8');
  let owned: { dev: number; ino: number } | undefined;
  try {
    const handle = await fs.open(localFile, 'wx', 0o600);
    try { await handle.writeFile(bytes); owned = await handle.stat(); } finally { await handle.close(); }
    const configured = await git(repo.root, ['config', '--null', '--path', '--get', 'core.excludesFile'], { ok: [0, 1] });
    const globalFile = configured.code === 0 ? configured.stdout.toString('utf8').replace(/\0$/u, '') : path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || os.homedir(), '.config'), 'git', 'ignore');
    const args = ['ls-files', '--others', '--ignored', '-z', '--exclude-per-directory=.gitignore'];
    if (globalFile) {
      const absolute = path.resolve(repo.root, globalFile);
      try { if (!(await fs.stat(absolute)).isFile()) throw new LabError('EXCLUDE_INVALID', 'O arquivo global de exclusões não é regular.'); args.push('--exclude-from=' + absolute); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    args.push('--exclude-from=' + localFile);
    const ignored = new Set((await git(repo.root, args)).stdout.toString('utf8').split('\0').filter(Boolean));
    return new Set(candidates.filter(candidate => ignored.has(candidate)));
  } finally {
    // Remove only the exact scratch file we created; preserve unknown additions.
    if (owned) try { const current = await fs.lstat(localFile); if (current.isFile() && !current.isSymbolicLink() && current.dev === owned.dev && current.ino === owned.ino && (await fs.readFile(localFile)).equals(bytes)) await fs.unlink(localFile); } catch { /* Preserve changed or unreadable scratch evidence. */ }
    await fs.rmdir(scratch).catch(() => {});
  }
}