import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { LabError } from './errors.js';

/** Git documents this value; Git for Windows also understands /dev/null. */
export const DISABLED_GIT_HOOKS = '/dev/null';

/** Avoid ambiguous Path/PATH duplicates when handing an environment to Windows. */
export function normalizeProcessEnvironment(
  source: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(source).sort()) {
    const name = platform === 'win32' ? key.toUpperCase() : key;
    if (source[key] !== undefined && !Object.hasOwn(result, name)) result[name] = source[key];
  }
  return result;
}

/**
 * Discover executables without a shell, registry queries or scripts from a repo.
 * Relative/empty PATH entries are ignored: opening a repository must not make
 * a git.exe in that repository become the application's Git executable.
 */
export function gitExecutableCandidates(
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  const env = normalizeProcessEnvironment(environment, platform);
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const separator = platform === 'win32' ? ';' : ':';
  const executable = platform === 'win32' ? 'git.exe' : 'git';
  const candidates: string[] = [];
  const add = (directory: string | undefined): void => {
    if (!directory) return;
    const unquoted = directory.startsWith('"') && directory.endsWith('"') ? directory.slice(1, -1) : directory;
    if (!paths.isAbsolute(unquoted)) return;
    // A Windows root-relative path (\\tools) still depends on the current drive.
    if (platform === 'win32' && !/^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+(?:[\\/]|$))/u.test(unquoted)) return;
    candidates.push(paths.join(unquoted, executable));
  };
  for (const directory of (env.PATH ?? (platform === 'win32' ? '' : '/usr/bin:/bin')).split(separator)) add(directory);
  if (platform === 'win32') {
    // Git for Windows' installer defaults, including per-user installations.
    const drive = /^[A-Za-z]:$/.test(env.SYSTEMDRIVE ?? '') ? env.SYSTEMDRIVE! : 'C:';
    const programFiles = [env.PROGRAMW6432, env.PROGRAMFILES, env['PROGRAMFILES(X86)'], `${drive}\\Program Files`, `${drive}\\Program Files (x86)`];
    for (const directory of programFiles) if (directory) add(paths.join(directory, 'Git', 'cmd'));
    if (env.LOCALAPPDATA) {
      add(paths.join(env.LOCALAPPDATA, 'Programs', 'Git', 'cmd'));
      add(paths.join(env.LOCALAPPDATA, 'Git', 'cmd'));
    }
  }
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    const key = platform === 'win32' ? candidate.toLowerCase() : candidate;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

let resolvedGit: { key: string; executable: string } | undefined;

/** A packaged desktop app can find Git even when Explorer has an older PATH. */
export async function resolveGitExecutable(environment: NodeJS.ProcessEnv = process.env): Promise<string> {
  const candidates = gitExecutableCandidates(process.platform, environment);
  const key = `${process.platform}\0${candidates.join('\0')}`;
  if (resolvedGit?.key === key) return resolvedGit.executable;
  for (const executable of candidates) {
    try {
      if (!(await stat(executable)).isFile()) continue;
      await access(executable, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
      resolvedGit = { key, executable };
      return executable;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    }
  }
  throw new LabError('GIT_NOT_FOUND', process.platform === 'win32'
    ? 'Git não encontrado. Instale o Git for Windows e reabra o aplicativo. O Git é um pré-requisito; ele não acompanha este pacote.'
    : 'Git não encontrado. Instale o Git no sistema e reabra o aplicativo.', { searched: candidates });
}

/** Absolute OS paths used in Git options/config need Git's slash spelling. */
export function gitPath(file: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? file.replace(/\\/g, '/') : file;
}

/** Windows exposes only the read-only attribute, not POSIX executable bits. */
export function comparableFileMode(mode: number, platform: NodeJS.Platform = process.platform): number {
  return platform === 'win32' ? ((mode & 0o200) !== 0 ? 0o666 : 0o444) : mode & 0o777;
}

/** O_NOFOLLOW is unavailable in Node on Windows; lstat/identity checks remain. */
export const OPEN_NOFOLLOW = constants.O_NOFOLLOW ?? 0;

/** Accept native separators at a user input boundary, then let validatePath reject unsafe paths. */
export function workspaceInputPath(input: string, platform: NodeJS.Platform = process.platform): string {
  if (typeof input !== 'string') throw new LabError('INVALID_PATH', 'O caminho deve ser texto.');
  const portable = gitPath(input, platform);
  const withoutCurrentDirectory = portable.replace(/^(?:\.\/)+/u, '');
  return withoutCurrentDirectory || (portable ? '.' : '');
}
