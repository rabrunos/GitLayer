import { spawn } from 'node:child_process';
import { lstat, readdir, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DISABLED_GIT_HOOKS, gitPath, normalizeProcessEnvironment, resolveGitExecutable } from './platform.js';
import { LabError } from './errors.js';
import { validatePath, assertNoCollisions, walk } from './paths.js';

export interface GitOptions {
  index?: string;
  input?: string | Buffer;
  ok?: number[];
  env?: Record<string, string>;
  timeout?: number;
}
export interface GitResult { stdout: Buffer; stderr: Buffer; code: number }
export interface GitActivity { at: string; command: string[]; code: number; stderr: string; durationMs: number }
const activity: GitActivity[] = [];

/** A bounded local record of actual child outcomes, excluding stdin and environment. */
export function getGitActivity(): GitActivity[] {
  return activity.map(entry => ({ ...entry, command: [...entry.command] }));
}

function recordActivity(args: string[], code: number, stderr: string, started: bigint): void {
  const redacted = [...args];
  for (let i = 0; i < redacted.length; i++) {
    if (args[0] === 'config' && /^(?:user|author|committer)\.(?:name|email)$/iu.test(redacted[i]!) && i + 1 < redacted.length) redacted[i + 1] = '[identidade omitida]';
    if (redacted[i] === '-m' || redacted[i] === '--message') {
      if (i + 1 < redacted.length) redacted[i + 1] = '[mensagem omitida]';
    } else if (redacted[i]!.startsWith('--message=')) redacted[i] = '--message=[omitida]';
  }
  const command = ['git', ...redacted.slice(0, 64).map(arg => arg.length > 180 ? `${arg.slice(0, 180)}…` : arg)];
  if (redacted.length > 64) command.push(`[+${redacted.length - 64} argumentos]`);
  activity.push({ at: new Date().toISOString(), command, code, stderr: stderr.slice(0, 1000), durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6) });
  if (activity.length > 100) activity.splice(0, activity.length - 100);
}
export interface RepoInfo {
  root: string; gitDir: string; commonDir: string; exclude: string;
  head: string; branch: string; index: string;
}
export interface GitEntry { path: string; oid: string; mode: string }

const commands = new Set([
  'init', 'rev-parse', 'symbolic-ref', 'config', 'check-ref-format', 'for-each-ref',
  'show-ref', 'show', 'log', 'status', 'diff', 'diff-files', 'diff-index', 'diff-tree',
  'ls-files', 'ls-tree', 'cat-file', 'hash-object', 'read-tree', 'write-tree',
  'update-index', 'checkout-index', 'commit-tree', 'update-ref', 'check-ignore', 'mktree', 'var', 'apply',
  'check-attr', 'add', 'restore', 'reset', 'commit', 'branch', 'switch', 'checkout',
  'tag', 'stash', 'merge', 'merge-base', 'cherry-pick', 'revert', 'worktree', 'rm', 'mv',
  'remote', 'fsck', 'rev-list', 'reflog', 'gc', 'prune', 'clean', 'version', 'count-objects',
]);
const diffCommands = new Set(['diff', 'diff-files', 'diff-index', 'diff-tree', 'log', 'show']);
const attributeCommands = new Set([
  'status', 'diff', 'diff-files', 'diff-index', 'diff-tree', 'log', 'show',
  'add', 'hash-object', 'checkout-index', 'read-tree', 'restore', 'commit',
  'checkout', 'switch', 'stash', 'merge', 'cherry-pick', 'revert',
]);
const gitEnv = new Set([
  'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_AUTHOR_DATE',
  'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'GIT_COMMITTER_DATE',
  'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM',
]);

/** The only Git process boundary. It never uses a shell or inherits repository redirection. */
export async function git(cwd: string, args: string[], options: GitOptions = {}): Promise<GitResult> {
  if (!args.length || !commands.has(args[0]!) || args.some(a => typeof a !== 'string' || a.includes('\0'))) {
    throw new LabError('GIT_COMMAND_REFUSED', 'Comando Git inválido ou fora do conjunto local permitido.', { command: args[0] });
  }
  if(args[0]==='remote'&&args.length!==1)throw new LabError('GIT_COMMAND_REFUSED','Somente a listagem local de remotos é usada pelo Core.');
  if (args[0] === 'worktree' && !['list','add','remove'].includes(args[1]??'')) {
    throw new LabError('GIT_COMMAND_REFUSED', 'A aplicação somente inspeciona worktrees.');
  }
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(normalizeProcessEnvironment(process.env))) {
    if (!/^GIT_/iu.test(key) || gitEnv.has(key)) env[key] = value;
  }
  for (const [key, value] of Object.entries(normalizeProcessEnvironment(options.env ?? {}))) {
    if (/^GIT_/iu.test(key) && !gitEnv.has(key)) {
      throw new LabError('GIT_ENV_REFUSED', `Variável Git não autorizada: ${key}`);
    }
    env[key] = value;
  }
  Object.assign(env, {
    GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1',
    GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '',
    GIT_LITERAL_PATHSPECS: '1', GIT_PAGER: '',
    GIT_EDITOR: 'git-layers-editor-disabled', GIT_SEQUENCE_EDITOR: 'git-layers-editor-disabled',
    LC_ALL: 'C', LANG: 'C',
  });
  // check-ignore consumes literal filenames itself and rejects pathspec magic,
  // including magic introduced implicitly by GIT_LITERAL_PATHSPECS.
  if (args[0] === 'check-ignore' || args[0] === 'check-attr') delete env.GIT_LITERAL_PATHSPECS;
  if (options.index) env.GIT_INDEX_FILE = gitPath(path.resolve(options.index));
  const localArgs = [...args];
  if (diffCommands.has(localArgs[0]!)) localArgs.splice(1, 0, '--no-ext-diff', '--no-textconv');
  // A pure rev-parse query must see the real hooks location for diagnostics.
  const inspectHooks = args[0] === 'rev-parse' && args.some((arg, index) => arg === '--git-path' && args[index + 1] === 'hooks');
  const globalArgs = [
    '--no-pager', '-c', 'color.ui=false', '-c', 'core.quotepath=false',
    '-c', 'core.fsmonitor=false', ...(inspectHooks ? [] : ['-c', `core.hooksPath=${DISABLED_GIT_HOOKS}`]),
    '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'log.showSignature=false',
    '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-c', 'protocol.allow=never',
    '-c', 'credential.helper=', '-c', 'diff.external=',
    '-c', 'submodule.recurse=false', '-c', 'status.submoduleSummary=false',
  ];
  if (attributeCommands.has(args[0]!)) {
    // --no-textconv alone does not prevent a working-tree clean filter during
    // diff. Enumerating config is read-only and cannot invoke those filters.
    const configOutput = (await git(cwd, ['config', '--null', '--list'], { env: options.env })).stdout.toString('utf8');
    const filters = new Set<string>();
    for (const record of configOutput.split('\0')) {
      const newline = record.indexOf('\n');
      const key = newline < 0 ? record : record.slice(0, newline);
      const match = /^(filter\..*)\.(?:clean|smudge|process|required)$/iu.exec(key);
      if (match) filters.add(match[1]!);
    }
    for (const filter of filters) {
      globalArgs.push('-c', `${filter}.clean=`, '-c', `${filter}.smudge=`, '-c', `${filter}.process=`, '-c', `${filter}.required=false`);
    }
  }
  const timeout = options.timeout ?? 30_000;
  const outputLimit = 64 * 1024 * 1024;
  const executable = await resolveGitExecutable(env);
  return await new Promise<GitResult>((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn(executable, [...globalArgs, ...localArgs], { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    let size = 0, finished = false, interrupted: LabError | undefined;
    const stop = (error: LabError): void => {
      interrupted = error;
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => stop(new LabError('GIT_TIMEOUT', `O comando Git excedeu ${timeout} ms.`, { command: args[0] })), timeout);
    const collect = (list: Buffer[], chunk: Buffer): void => {
      size += chunk.length;
      if (size > outputLimit) { stop(new LabError('GIT_OUTPUT_LIMIT', 'A saída do Git excedeu o limite de 64 MiB.')); return; }
      list.push(chunk);
    };
    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.on('error', error => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      recordActivity(localArgs, -1, error.message, started);
      reject(new LabError((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'GIT_NOT_FOUND' : 'GIT_PROCESS', 'Não foi possível iniciar o Git instalado no sistema.', { message: error.message }));
    });
    child.on('close', (code, signal) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      const result = { stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), code: code ?? -1 };
      recordActivity(localArgs, result.code, result.stderr.toString('utf8'), started);
      if (interrupted) { reject(interrupted); return; }
      if (!(options.ok ?? [0]).includes(result.code)) {
        reject(new LabError('GIT_FAILED', result.stderr.toString('utf8').trim() || `Git terminou com código ${code ?? signal}.`, {
          command: args[0], code: result.code, stderr: result.stderr.toString('utf8'), stdout: result.stdout.toString('utf8'),
        }));
        return;
      }
      resolve(result);
    });
    child.stdin.on('error', () => { /* EPIPE is reported by the process result. */ });
    child.stdin.end(options.input);
  });
}

export async function gitText(cwd: string, args: string[], options?: GitOptions): Promise<string> {
  return (await git(cwd, args, options)).stdout.toString('utf8').trim();
}

/** Discover every internal path through Git; an unborn HEAD has head === ''. */
export async function discover(cwd: string): Promise<RepoInfo> {
  if (await gitText(cwd, ['rev-parse', '--is-bare-repository']) === 'true') {
    throw new LabError('BARE_REPOSITORY', 'Repositórios bare não possuem workspace e não são suportados.');
  }
  const root = await realpath(await gitText(cwd, ['rev-parse', '--show-toplevel']));
  // Resolve these paths together, after canonicalizing the workspace just as
  // before. Nothing is cached: another operation discovers the current Git
  // topology again, including gitfiles and separate Git directories.
  const [locations, branch, headResult] = await Promise.all([
    gitText(root, ['rev-parse', '--path-format=absolute', '--absolute-git-dir', '--git-common-dir', '--git-path', 'info/exclude', '--git-path', 'index']),
    gitText(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { ok: [0, 1] }),
    git(root, ['rev-parse', '--verify', 'HEAD^{commit}'], { ok: [0, 128] }),
  ]);
  const [gitDir, commonDir, exclude, index] = resolvedPaths(root, locations, 4);
  return { root, gitDir: gitDir!, commonDir: commonDir!, exclude: exclude!, index: index!,
    branch, head: headResult.code === 0 ? headResult.stdout.toString('utf8').trim() : '' };
}

/** rev-parse emits one line per requested path; reject incomplete output. */
function resolvedPaths(root: string, output: string, count: number): string[] {
  const paths = output.split(/\r?\n/u);
  if (paths.length !== count || paths.some(value => !value)) {
    throw new LabError('INVALID_GIT_OUTPUT', 'O Git retornou caminhos internos incompletos ou ambíguos.');
  }
  return paths.map(value => path.resolve(root, value));
}

/** Raw config excludes our command-scope safety overrides so requirements remain visible. */
async function originalConfig(root: string): Promise<Map<string, string[]>> {
  const bytes = (await git(root, ['config', '--null', '--show-scope', '--list'])).stdout;
  const fields = bytes.toString('utf8').split('\0');
  const result = new Map<string, string[]>();
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i] === 'command') continue;
    const record = fields[i + 1]!;
    const newline = record.indexOf('\n');
    const key = (newline === -1 ? record : record.slice(0, newline)).toLowerCase();
    const value = newline === -1 ? 'true' : record.slice(newline + 1);
    const values = result.get(key) ?? [];
    values.push(value); result.set(key, values);
  }
  return result;
}

function truthy(value: string): boolean { return /^(?:true|yes|on|1)$/iu.test(value) || value === ''; }

/** Strict support envelope for managed Layers. No config is rewritten to make a repo fit. */
export async function assertSupported(repoOrPath: RepoInfo | string, requireCommit = true): Promise<void> {
  const repo = typeof repoOrPath === 'string' ? await discover(repoOrPath) : repoOrPath;
  if (await gitText(repo.root, ['rev-parse', '--is-bare-repository']) !== 'false') {
    throw new LabError('BARE_REPOSITORY', 'Layers exigem repositório com diretório de trabalho normal.');
  }
  if (!repo.branch) throw new LabError('DETACHED_HEAD', 'HEAD deve apontar simbolicamente para uma branch tradicional.');
  if (requireCommit && !repo.head) throw new LabError('UNBORN_HEAD', 'Crie o primeiro commit da branch tradicional antes de habilitar Layers.');
  if (path.resolve(repo.gitDir) !== path.resolve(repo.commonDir)) throw new LabError('LINKED_WORKTREE', 'Linked worktrees não são suportadas na v0.1.');
  const worktrees = (await git(repo.root, ['worktree', 'list', '--porcelain', '-z'])).stdout;
  const worktreeCount = worktrees.toString('utf8').split('\0').filter(item => item.startsWith('worktree ')).length;
  if(worktreeCount!==1){const protection=await (await import('./branch-protection.js')).inspectBranchProtection(repo.root);if(!protection.healthy||protection.externalWorktrees.length||worktreeCount!==1+protection.validWorktrees.length)throw new LabError('MULTIPLE_WORKTREES','Somente o worktree principal e reservas próprias validadas são suportados.',{count:worktreeCount,protection});}
  const config = await originalConfig(repo.root);
  for (const [key, values] of config) {
    const value = values.at(-1)!;
    if ((key === 'core.sparsecheckout' || key === 'index.sparse') && truthy(value)) {
      throw new LabError('SPARSE_CHECKOUT', 'Sparse checkout/index não são suportados.');
    }
    if (key === 'extensions.partialclone' || (/^remote\..*\.promisor$/u.test(key) && truthy(value)) || /^remote\..*\.partialclonefilter$/u.test(key)) {
      throw new LabError('PARTIAL_CLONE', 'Partial clone e downloads preguiçosos não são suportados.');
    }
    // Merely installing Git LFS often adds inactive global filter definitions.
    // Effective attributes are validated below and again for planned new paths.
    if (key === 'diff.external' && value) throw new LabError('EXTERNAL_DIFF', `Diff externo não suportado: ${key}`);
    if (((key === 'commit.gpgsign' || key === 'tag.gpgsign') && truthy(value)) || /^gpg(?:\..*)?\.program$/u.test(key)) {
      throw new LabError('SIGNING_UNSUPPORTED', `Assinatura de commits/tags não suportada: ${key}`);
    }
    if (key === 'core.hookspath' && value && value !== os.devNull && value !== DISABLED_GIT_HOOKS && !(process.platform === 'win32' && /^nul$/iu.test(value))) throw new LabError('HOOKS_UNSUPPORTED', 'core.hooksPath está configurado; hooks não são suportados neste laboratório.');
    if ((key === 'core.fsmonitor' && value && !/^(false|no|off|0)$/iu.test(value)) || key === 'core.alternaterefscommand') {
      throw new LabError('EXTERNAL_PROCESS', `Recurso que pode executar processo externo não suportado: ${key}`);
    }
    if (key === 'core.splitindex' && truthy(value)) throw new LabError('SPLIT_INDEX', 'Split index não foi habilitado para Layers na v0.1.');
  }
  const operations = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG'];
  const incomplete = ['shallow', 'objects/info/alternates', 'info/grafts'];
  const internalNames = [...operations, ...incomplete, 'hooks', 'info/attributes'];
  // One fresh query replaces thirteen child processes. Keep every filesystem
  // check, and inspect the real hooks path even in this grouped pure query.
  const locations = resolvedPaths(repo.root, await gitText(repo.root, ['rev-parse', '--path-format=absolute', ...internalNames.flatMap(name => ['--git-path', name])]), internalNames.length);
  const internal = new Map(internalNames.map((name, index) => [name, locations[index]!]));
  const exists = async (name: string): Promise<boolean> => {
    const absolute = internal.get(name)!;
    try { await lstat(absolute); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  };
  for (const name of operations) {
    if (await exists(name)) throw new LabError('GIT_OPERATION_IN_PROGRESS', `Operação Git externa em andamento: ${name}`);
  }
  for (const name of incomplete) {
    if (await exists(name)) throw new LabError('INCOMPLETE_REPOSITORY', `Repositório incompleto/alternativo não suportado: ${name}`);
  }
  const replaceRefs = await gitText(repo.root, ['for-each-ref', '--format=%(refname)', 'refs/replace/']);
  if (replaceRefs) throw new LabError('REPLACE_OBJECTS', 'Referências de substituição de objetos não são suportadas.');
  const hooksDir = internal.get('hooks')!;
  const hooksConfig = config.get('core.hookspath')?.at(-1);
  const hooksDisabled = hooksConfig === DISABLED_GIT_HOOKS || hooksConfig === os.devNull ||
    (process.platform === 'win32' && /^nul$/iu.test(hooksConfig ?? ''));
  try {
    for (const name of hooksDisabled || path.resolve(hooksDir) === path.resolve(os.devNull) ? [] : await readdir(hooksDir)) {
      if (name.endsWith('.sample')) continue;
      const stat = await lstat(path.join(hooksDir, name));
      if (stat.isSymbolicLink() || (stat.isFile() && ((stat.mode & 0o111) !== 0 || process.platform === 'win32'))) {
        throw new LabError('HOOKS_UNSUPPORTED', `Hook encontrado: ${name}. Use um repositório demonstrativo sem hooks.`);
      }
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const entries = await treeEntries(repo.root, ':index');
  if (repo.head) entries.push(...await treeEntries(repo.root, repo.head));
  assertNoCollisions(entries.map(entry => ({ path: entry.path, owner: 'base' })));
  // Check attributes for tracked and existing files without asking Git to transform data.
  const names = new Set(entries.map(entry => entry.path));
  for (const name of await walk(repo.root)) names.add(name);
  await assertAttributes(repo.root, [...names]);
  // --missing=print plus disabled lazy fetching refuses absent reachable blobs/trees locally.
  const objects = await gitText(repo.root, ['rev-list', '--objects', '--all', '--missing=print']);
  if (objects.split('\n').some(line => line.startsWith('?'))) throw new LabError('MISSING_OBJECTS', 'Há objetos Git ausentes; Layers foram suspensas.');
  // An attribute control in the private info directory applies to every projection.
  const infoAttributes = internal.get('info/attributes')!;
  try {
    const text = await readFile(infoAttributes, 'utf8');
    if (/\b(?:filter|working-tree-encoding|ident)(?:=|\s|$)/mu.test(text)) {
      throw new LabError('UNSUPPORTED_ATTRIBUTE', 'info/attributes contém transformação não suportada.');
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

/** Validate planned missing paths too: attributes may select a filter before it exists. */
export async function assertAttributes(root: string, paths: string[]): Promise<void> {
  const names = [...new Set(paths.map(validatePath))];
  if (!names.length) return;
  const config = await originalConfig(root);
  for (const cached of [false, true]) {
    const attr = (await git(root, ['check-attr', ...(cached ? ['--cached'] : []), '-z', '--stdin', 'filter', 'working-tree-encoding', 'ident', 'diff'], {
      input: names.join('\0') + '\0',
    })).stdout.toString('utf8').split('\0');
    for (let i = 0; i + 2 < attr.length; i += 3) {
      const attribute = attr[i + 1]!, value = attr[i + 2]!;
      if (value === 'unspecified' || value === 'unset') continue;
      if (attribute === 'diff') {
        if (value === 'set') continue;
        if (!(config.get(`diff.${value.toLowerCase()}.command`)?.some(Boolean)) && !(config.get(`diff.${value.toLowerCase()}.textconv`)?.some(Boolean))) continue;
      }
      throw new LabError(attribute === 'filter' ? 'EXTERNAL_FILTER' : 'UNSUPPORTED_ATTRIBUTE', `Atributo ${attribute} não suportado em ${attr[i]}.`, { path: attr[i], attribute, value, cached });
    }
  }
}

/** Parse NUL-delimited Git plumbing output; never parse filenames using spaces/newlines. */
export async function treeEntries(repo: string, ref: string, index?: string): Promise<GitEntry[]> {
  const fromIndex = index !== undefined || ref === ':index' || ref === 'INDEX';
  if (!fromIndex && !ref) return [];
  const output = await git(repo, fromIndex ? ['ls-files', '--stage', '-z'] : ['ls-tree', '-r', '-z', '--full-tree', ref], { index });
  const result: GitEntry[] = [];
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(output.stdout); }
  catch { throw new LabError('UNSUPPORTED_PATH_ENCODING', 'O repositório contém nomes de arquivo que não são UTF-8 válidos.'); }
  for (const record of text.split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    if (tab === -1) throw new LabError('INVALID_GIT_OUTPUT', 'Registro Git sem delimitador de caminho.');
    const metadata = record.slice(0, tab).split(' ');
    const pathname = validatePath(record.slice(tab + 1));
    const mode = metadata[0]!;
    const oid = fromIndex ? metadata[1]! : metadata[2]!;
    if (fromIndex && metadata[2] !== '0') throw new LabError('UNMERGED_INDEX', `Conflito não resolvido no índice: ${pathname}`);
    if (mode !== '100644' && mode !== '100755') throw new LabError(mode === '160000' ? 'SUBMODULE_UNSUPPORTED' : 'UNSAFE_TREE_ENTRY', `Modo Git não suportado (${mode}): ${pathname}`);
    if (!/^[a-f0-9]+$/u.test(oid)) throw new LabError('INVALID_GIT_OUTPUT', 'OID Git inválido.');
    result.push({ path: pathname, mode, oid });
  }
  return result;
}
