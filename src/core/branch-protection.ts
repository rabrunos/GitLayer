import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { discover, git, gitText, type RepoInfo } from './git.js';
import { LabError } from './errors.js';
import { assertNoPathLinks, resolveLayerDirectory } from './layout.js';
import { atomicJSON, readJSON, withLock } from './storage.js';

/** Explicit repository-local opt-in. No hooks, aliases or global configuration. */
const KIND = 'git-layer-branch-protection';
const OWNER = 'git-layer-branch-reservation';
const uuid = /^[a-f0-9-]{36}$/u;
const codeOf = (error: unknown) => (error as NodeJS.ErrnoException)?.code;
interface Reservation {
  id: string; nonce: string; name: string; ref: string;
  state: 'reserving' | 'reserved' | 'releasing' | 'released';
}
interface ProtectionState {
  schema: 1; kind: typeof KIND; root: string; gitDir: string;
  enabled: boolean; entries: Reservation[];
}
interface Context { repo: RepoInfo; directory: string; file: string; state?: ProtectionState; ownsControl?: boolean }
interface NativeWorktree { path: string; branch?: string; head?: string; locked: boolean }
export type ProtectionProblemReason = 'content' | 'index' | 'lock' | 'reference' | 'metadata' | 'missing-worktree' | 'pending';
export interface ProtectionProblem {
  code: string; reason: ProtectionProblemReason; message: string; name?: string;
  recovery: { action: 'reapply-protect' | 'inspect-and-export'; automatic: false; guidance: string[] };
}
export interface BranchProtectionInspection {
  enabled: boolean; healthy: boolean; directory: string;
  validWorktrees: string[]; externalWorktrees: string[]; unprotectedLayers: string[];
  reservations: Array<Reservation & { worktree: string }>;
  problems: ProtectionProblem[];
  coverage: {
    scope: 'ordinary-local-layer-branch-selection';
    status: 'disabled' | 'complete' | 'incomplete' | 'inconsistent'; complete: boolean;
    localLayers: string[]; protectedLayers: string[]; unprotectedLayers: string[]; workingLayer: string | null;
  };
  referenceBaseline: 'registered-layer-oid' | 'unavailable';
  guidance: string[]; limits: string[];
}
const samePath = (a: string, b: string) => process.platform === 'win32'
  ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
  : path.resolve(a) === path.resolve(b);
async function exists(file: string): Promise<boolean> {
  try { await fs.lstat(file); return true; }
  catch (error) { if (codeOf(error) === 'ENOENT') return false; throw error; }
}
function conflict(message: string, details?: Record<string, unknown>): never {
  throw new LabError('PROTECTION_CONFLICT', message, details);
}
function reservationConflict(reason: ProtectionProblemReason, message: string, details?: Record<string, unknown>): never {
  return conflict(message, { ...details, reason });
}
function problem(error: unknown, name?: string): ProtectionProblem {
  const detail = error instanceof LabError ? error.details as { reason?: ProtectionProblemReason } | undefined : undefined;
  const reason = detail?.reason ?? 'metadata';
  return { code: (error as LabError).code ?? 'PROTECTION_CONFLICT', reason,
    message: error instanceof Error ? error.message : String(error), ...(name ? { name } : {}),
    recovery: { action: reason === 'missing-worktree' ? 'reapply-protect' : 'inspect-and-export', automatic: false,
      guidance: reason === 'missing-worktree'
        ? ['Reaplique protect para recompor somente a reserva ausente e comprovadamente própria.']
        : ['Preserve refs, índices, arquivos e locks; use doctor e recovery-export antes de decidir o reparo.',
           'Se houve commit inesperado na reserva, confira log/reflog e o commit pai; não apague o índice nem restaure refs automaticamente.'] } };
}
function validState(value: any, repo: RepoInfo): boolean {
  return value.kind === KIND && value.root === repo.root && value.gitDir === repo.gitDir &&
    typeof value.enabled === 'boolean' && Array.isArray(value.entries) &&
    value.entries.every((e: any) => e && uuid.test(e.id) && uuid.test(e.nonce) &&
      typeof e.name === 'string' && e.name.length > 0 && e.ref === 'refs/heads/layer/' + e.name &&
      ['reserving', 'reserved', 'releasing', 'released'].includes(e.state)) &&
    new Set(value.entries.map((e: any) => e.id)).size === value.entries.length &&
    new Set(value.entries.map((e: any) => e.name)).size === value.entries.length;
}
async function context(root: string): Promise<Context> {
  const repo = await discover(root);
  if (!samePath(repo.gitDir, repo.commonDir)) conflict('A proteção deve ser administrada pelo worktree principal.');
  const directory = path.join(await resolveLayerDirectory(repo.gitDir), 'branch-protection');
  await assertNoPathLinks(directory);
  const file = path.join(directory, 'state.json');
  let state: ProtectionState | undefined;
  if (await exists(directory)) {
    if (!(await fs.lstat(directory)).isDirectory()) conflict('O destino da proteção não é um diretório.', { directory });
    if (!(await exists(file))) conflict('Diretório de proteção sem estado reconhecido; conteúdo preservado.', { directory });
    state = await readJSON<ProtectionState>(file, value => validState(value, repo));
    for (const entry of state.entries) await validateName(repo.root, entry.name);
  }
  return { repo, directory, file, state };
}
async function validateName(root: string, name: string): Promise<void> {
  if (!name || name.startsWith('-') || /[\u0000-\u0020\u007f]/u.test(name)) conflict('Nome de Layer inválido.');
  const result = await git(root, ['check-ref-format', 'refs/heads/layer/' + name], { ok: [0, 1] });
  if (result.code) conflict('Nome de Layer inválido.', { name });
}
const holder = (c: Context, entry: Reservation) => path.join(c.directory, 'holds', entry.id);
const worktreePath = (c: Context, entry: Reservation) => path.join(holder(c, entry), 'worktree');
async function worktrees(root: string): Promise<NativeWorktree[]> {
  const text = (await git(root, ['worktree', 'list', '--porcelain', '-z'])).stdout.toString('utf8');
  const result: NativeWorktree[] = [];
  for (const block of text.split('\0\0').filter(Boolean)) {
    const fields = block.split('\0');
    const location = fields.find(field => field.startsWith('worktree '));
    if (!location) conflict('Saída de worktree sem caminho.');
    result.push({ path: path.resolve(location.slice(9)), branch: fields.find(field => field.startsWith('branch '))?.slice(7), head: fields.find(field => field.startsWith('HEAD '))?.slice(5), locked: fields.some(field => field === 'locked' || field.startsWith('locked ')) });
  }
  return result;
}
async function layerNames(root: string): Promise<string[]> {
  return (await gitText(root, ['for-each-ref', '--format=%(refname)', 'refs/heads/layer/']))
    .split('\n').filter(ref => ref.startsWith('refs/heads/layer/')).map(ref => ref.slice(17));
}
async function owner(c: Context, entry: Reservation): Promise<void> {
  const folder = holder(c, entry);
  await assertNoPathLinks(folder);
  // A validated layout migration retains legacy byte-for-byte. Released owners
  // may therefore still name the old (absent) worktree in the copied marker.
  const legacyWorktree = path.join(c.repo.gitDir, 'git-layers', 'branch-protection', 'holds', entry.id, 'worktree');
  const migratedReleased = entry.state === 'released' && samePath(c.directory, path.join(c.repo.gitDir, 'layers', 'branch-protection')) &&
    await exists(path.join(c.repo.gitDir, 'git-layers')) && await exists(path.join(c.repo.gitDir, 'layers', 'layout-migration.json'));
  const value = await readJSON<any>(path.join(folder, 'owner.json'), v =>
    v.kind === OWNER && v.id === entry.id && v.nonce === entry.nonce && v.ref === entry.ref &&
    v.root === c.repo.root && v.gitDir === c.repo.gitDir &&
    (v.worktree === worktreePath(c, entry) || (migratedReleased && v.worktree === legacyWorktree)));
  if (!value) conflict('Marcador de reserva inválido.', { name: entry.name });
  const names = await fs.readdir(folder);
  if (names.some(name => name !== 'owner.json' && name !== 'worktree')) conflict('Conteúdo desconhecido na reserva foi preservado.', { name: entry.name });
}
async function regularText(file: string): Promise<string> {
  await assertNoPathLinks(file);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 1024 * 1024) conflict('Arquivo de reserva inseguro ou inesperado.', { file });
  return fs.readFile(file, 'utf8');
}
/** Verify ownership, reciprocity, ref and absence of work before any forced removal. */
async function verifyReservation(c: Context, entry: Reservation, native: NativeWorktree[]): Promise<string> {
  await owner(c, entry);
  const worktree = worktreePath(c, entry);
  await assertNoPathLinks(worktree);
  if (!(await exists(worktree))) reservationConflict('missing-worktree', 'A worktree da reserva está ausente; dados e registro foram preservados.', { worktree });
  if ((await fs.readdir(worktree)).join('\0') !== '.git') reservationConflict('content', 'A reserva contém arquivos externos; nenhum será removido.', { worktree });
  const gitFile = path.join(worktree, '.git');
  const contents = await regularText(gitFile);
  const match = /^gitdir: ([^\r\n]+)\r?\n?$/u.exec(contents);
  if (!match) conflict('Gitfile da reserva inválido.', { worktree });
  const admin = path.resolve(worktree, match[1]!);
  await assertNoPathLinks(admin);
  if (!samePath(path.dirname(admin), path.join(c.repo.commonDir, 'worktrees'))) conflict('Gitfile aponta para armazenamento externo.', { worktree });
  if (!samePath(path.resolve(admin, (await regularText(path.join(admin, 'commondir'))).trim()), c.repo.commonDir) ||
      !samePath(path.resolve(admin, (await regularText(path.join(admin, 'gitdir'))).trim()), gitFile)) {
    conflict('A reciprocidade da worktree não pôde ser comprovada.', { worktree });
  }
  if ((await regularText(path.join(admin, 'HEAD'))).trim() !== 'ref: ' + entry.ref) reservationConflict('reference', 'A referência da reserva mudou; dados preservados.', { name: entry.name });
  const nativeEntry = native.find(item => samePath(item.path, worktree));
  if (nativeEntry?.locked) reservationConflict('lock', 'A worktree da reserva está bloqueada; nenhum lock foi removido.', { worktree });
  if (!nativeEntry || nativeEntry.branch !== entry.ref) reservationConflict('reference', 'A reserva não corresponde à worktree Git; dados preservados.', { worktree });
  const reference = await git(c.repo.root, ['rev-parse', '--verify', entry.ref + '^{commit}'], { ok: [0, 128] });
  if (!nativeEntry.head || /^0+$/u.test(nativeEntry.head) || reference.code !== 0 || reference.stdout.toString('utf8').trim() !== nativeEntry.head) {
    reservationConflict('reference', 'A referência da Layer foi removida, está inválida ou mudou durante a inspeção; a reserva foi preservada.', { name: entry.name, worktree });
  }
  // --no-checkout creates no index. Any index/private ref/user file is evidence
  // of external work and is never discarded to make the reservation fit.
  // Prefer evidence of staging/locks over incidental files such as
  // COMMIT_EDITMSG, which a native commit may leave beside its new index.
  const adminNames = await fs.readdir(admin);
  if (adminNames.some(name => name === 'locked' || name.endsWith('.lock'))) reservationConflict('lock', 'Lock externo na reserva; nenhum lock foi removido.', { admin });
  if (adminNames.includes('index')) reservationConflict('index', 'Índice externo na reserva sem checkout; pode haver trabalho ou commit inesperado. Índice preservado.', { admin });
  const allowedFiles = new Set(['commondir', 'gitdir', 'HEAD', 'logs/HEAD']);
  const allowedDirs = new Set(['logs', 'refs']);
  async function check(folder: string, relative = ''): Promise<void> {
    for (const name of await fs.readdir(folder)) {
      const file = path.join(folder, name), rel = relative ? relative + '/' + name : name;
      const stat = await fs.lstat(file);
      if (name === 'locked' || name.endsWith('.lock')) reservationConflict('lock', 'Lock externo na reserva; nenhum lock foi removido.', { file });
      if (rel === 'index') reservationConflict('index', 'Índice externo na reserva sem checkout; pode haver trabalho ou commit inesperado. Índice preservado.', { file });
      if (stat.isSymbolicLink()) conflict('Link em metadados da reserva.', { file });
      if (stat.isDirectory()) {
        if (!allowedDirs.has(rel)) conflict('Diretório desconhecido na reserva; preservado.', { file });
        await check(file, rel);
      } else if (!stat.isFile() || stat.nlink !== 1 || !allowedFiles.has(rel)) conflict('Índice ou metadado externo na reserva; preservado.', { file });
    }
  }
  await check(admin);
  return worktree;
}
/** The persisted Core OID is an independent baseline, not a new ref snapshot schema. */
async function registeredReferenceBaseline(c: Context): Promise<{ oids: Map<string, string>; workingLayer?: string; available: boolean }> {
  const directory = path.dirname(c.directory), registryFile = path.join(directory, 'registry.json');
  if (!(await exists(registryFile))) return { oids: new Map(), available: false };
  const registry = await readJSON<{ schema: 1; layers: Array<{ name: string; ref: string; oid: string }> }>(registryFile,
    value => Array.isArray(value.layers) && value.layers.every((l: any) => typeof l.name === 'string' &&
      l.ref === 'refs/heads/layer/' + l.name && /^[0-9a-f]{40,64}$/u.test(l.oid)));
  const workspace = await readJSON<{ schema: 1; branchLayer?: string }>(path.join(directory, 'workspace.json'),
    value => value.branchLayer === undefined || typeof value.branchLayer === 'string');
  return { oids: new Map(registry.layers.map(l => [l.ref, l.oid])), workingLayer: workspace.branchLayer, available: true };
}
async function inspect(c: Context): Promise<BranchProtectionInspection> {
  const native = await worktrees(c.repo.root), validWorktrees: string[] = [], problems: ProtectionProblem[] = [];
  let baseline: Awaited<ReturnType<typeof registeredReferenceBaseline>> = { oids: new Map(), available: false };
  // Protection can be installed before Core init. Without persisted Core state,
  // report that there is no historical OID baseline rather than inventing one.
  if (c.state) try { baseline = await registeredReferenceBaseline(c); } catch (error) { problems.push(problem(error)); }
  if (!c.ownsControl && await exists(path.join(c.directory, 'control', 'locks', 'coordinator'))) {
    problems.push(problem(new LabError('PROTECTION_CONFLICT', 'Lock real do controle de proteção presente; preservado.', { reason: 'lock' })));
  }
  for (const entry of c.state?.entries ?? []) {
    try {
      await owner(c, entry);
      if (entry.state === 'released') {
        if (await exists(worktreePath(c, entry)) || native.some(w => samePath(w.path, worktreePath(c, entry)))) conflict('Reserva liberada ainda possui worktree.', { name: entry.name });
      } else {
        const worktree = await verifyReservation(c, entry, native);
        const expected = baseline.oids.get(entry.ref), actual = native.find(w => samePath(w.path, worktree))?.head;
        // In deliberate branch mode native commits legitimately advance this ref.
        // A managed exit publishes its updated registry after reserving it again.
        if (expected && baseline.workingLayer !== entry.name && actual !== expected) {
          reservationConflict('reference', 'A ref da Layer divergiu do OID registrado; preserve o commit e inspecione o histórico antes de reparar.', { name: entry.name, expected, actual });
        }
        validWorktrees.push(worktree);
        if (entry.state !== 'reserved') problems.push(problem(new LabError('PROTECTION_PENDING', 'Transição de proteção incompleta; repita protect/unprotect.', { reason: 'pending' }), entry.name));
      }
    } catch (error) { problems.push(problem(error, entry.name)); }
  }
  const protectedNames = new Set((c.state?.entries ?? []).filter(e => validWorktrees.includes(worktreePath(c, e))).map(e => e.name));
  const localLayers = await layerNames(c.repo.root), workingLayer = localLayers.find(name => c.repo.branch === 'layer/' + name) ?? null;
  const unprotectedLayers = localLayers.filter(name => name !== workingLayer && !protectedNames.has(name));
  const enabled = c.state?.enabled ?? false, healthy = problems.length === 0, complete = enabled && healthy && unprotectedLayers.length === 0;
  return { enabled, healthy, directory: c.directory, validWorktrees,
    externalWorktrees: native.filter(item => !samePath(item.path, c.repo.root) && !validWorktrees.some(own => samePath(own, item.path))).map(item => item.path),
    unprotectedLayers, reservations: (c.state?.entries ?? []).map(entry => ({ ...entry, worktree: worktreePath(c, entry) })), problems,
    coverage: { scope: 'ordinary-local-layer-branch-selection', status: !enabled ? 'disabled' : !healthy ? 'inconsistent' : complete ? 'complete' : 'incomplete',
      complete, localLayers, protectedLayers: [...protectedNames], unprotectedLayers, workingLayer },
    referenceBaseline: baseline.available ? 'registered-layer-oid' : 'unavailable',
    guidance: [
      ...(!enabled ? ['Proteção opcional desligada; execute protect somente se desejar reservar branches Layer locais.'] : []),
      ...(unprotectedLayers.length && enabled ? ['Há Layers locais sem reserva válida; confira os problemas e reaplique protect explicitamente.'] : []),
      'As reservas são worktrees sem checkout: status pode mostrar deleções; não prepare nem faça commit dentro delas.',
      'Commit inesperado exige inspeção do histórico e exportação; índices, conteúdo e refs desconhecidos não são apagados por protect/unprotect.',
    ],
    limits: ['Proteção local e explícita de seleção nominal; --ignore-other-worktrees contorna a recusa nativa.', 'Branches criadas fora do produto exigem reaplicar protect.', 'Remover/prunar a reserva por fora pode retirar a proteção; o produto diagnostica antes de mutações.', 'Sem registro Core persistido não há baseline histórica de OID; a inspeção valida somente o estado atual da reserva.'] };
}
export async function inspectBranchProtection(root: string): Promise<BranchProtectionInspection> { return inspect(await context(root)); }
async function persist(c: Context): Promise<void> { await atomicJSON(c.file, c.state!); }
async function reserve(c: Context, name: string): Promise<void> {
  if (!c.state?.enabled || c.repo.branch === 'layer/' + name) return;
  await validateName(c.repo.root, name);
  if ((await git(c.repo.root, ['show-ref', '--verify', '--quiet', 'refs/heads/layer/' + name], { ok: [0, 1] })).code) conflict('A Layer não existe.', { name });
  let entry = c.state.entries.find(item => item.name === name);
  if (!entry) {
    entry = { id: randomUUID(), nonce: randomUUID(), name, ref: 'refs/heads/layer/' + name, state: 'reserving' };
    c.state.entries.push(entry); await persist(c);
  }
  const folder = holder(c, entry), worktree = worktreePath(c, entry);
  if (!(await exists(folder))) {
    await assertNoPathLinks(folder); await fs.mkdir(folder, { recursive: true, mode: 0o700 });
    await atomicJSON(path.join(folder, 'owner.json'), { schema: 1, kind: OWNER, id: entry.id, nonce: entry.nonce, ref: entry.ref, root: c.repo.root, gitDir: c.repo.gitDir, worktree });
  }
  await owner(c, entry);
  if (entry.state === 'released') {
    const markerFile = path.join(folder, 'owner.json');
    const marker = await readJSON<any>(markerFile);
    if (marker.worktree !== worktree) await atomicJSON(markerFile, { ...marker, worktree });
  }
  const native = await worktrees(c.repo.root);
  if (await exists(worktree)) {
    await verifyReservation(c, entry, native); entry.state = 'reserved'; await persist(c); return;
  }
  if (native.some(item => samePath(item.path, worktree))) conflict('Registro Git sem diretório de reserva; não foi apagado.', { worktree });
  if (native.some(item => item.branch === entry!.ref)) conflict('A Layer já está em uso por worktree externa.', { name });
  entry.state = 'reserving'; await persist(c);
  await git(c.repo.root, ['worktree', 'add', '--no-checkout', worktree, 'layer/' + entry.name]);
  await verifyReservation(c, entry, await worktrees(c.repo.root));
  entry.state = 'reserved'; await persist(c);
}
async function release(c: Context, entry: Reservation): Promise<void> {
  await owner(c, entry);
  const worktree = worktreePath(c, entry), native = await worktrees(c.repo.root);
  if (!(await exists(worktree))) {
    if (native.some(item => samePath(item.path, worktree))) conflict('Reserva ausente ainda está registrada no Git.', { worktree });
    entry.state = 'released'; await persist(c); return;
  }
  await verifyReservation(c, entry, native);
  entry.state = 'releasing'; await persist(c);
  await verifyReservation(c, entry, await worktrees(c.repo.root));
  // Force is necessary for --no-checkout (the index is intentionally absent).
  // Only the verified empty owned worktree and its pristine admin are removed.
  await git(c.repo.root, ['worktree', 'remove', '--force', worktree]);
  if (await exists(worktree) || (await worktrees(c.repo.root)).some(item => samePath(item.path, worktree))) conflict('A liberação não foi concluída.', { worktree });
  entry.state = 'released'; await persist(c);
}
async function mutate<T>(c: Context, fn: (current: Context) => Promise<T>): Promise<T> {
  return withLock(path.join(c.directory, 'control'), async () => { const current = await context(c.repo.root); current.ownsControl = true; return fn(current); });
}
export async function enableBranchProtection(root: string): Promise<BranchProtectionInspection> {
  let c = await context(root);
  if (!c.state) {
    // An occupied unknown destination is refused by context; initialization is
    // exclusive and never replaces a directory belonging to another operation.
    await assertNoPathLinks(c.directory);
    await fs.mkdir(path.dirname(c.directory), { recursive: true, mode: 0o700 });
    await fs.mkdir(c.directory, { mode: 0o700 });
    c.state = { schema: 1, kind: KIND, root: c.repo.root, gitDir: c.repo.gitDir, enabled: false, entries: [] }; await persist(c);
  }
  return mutate(c, async current => {
    // Validate every existing owner before creating another reservation or
    // changing enabled. Missing pristine owned worktrees alone can be rebuilt.
    const native = await worktrees(current.repo.root);
    for (const entry of current.state!.entries) {
      await owner(current, entry);
      if (await exists(worktreePath(current, entry))) await verifyReservation(current, entry, native);
      else if (native.some(w => samePath(w.path, worktreePath(current, entry)))) conflict('Reserva ausente ainda está registrada no Git; inspecione sem prune automático.', { name: entry.name });
    }
    const prior = await inspect(current);
    const blockers = prior.problems.filter(p => !['missing-worktree', 'pending'].includes(p.reason));
    if (blockers.length) conflict('Reaplicação recusada: há estado externo que exige inspeção; dados preservados.', { problems: blockers });
    current.state!.enabled = true; await persist(current);
    for (const name of await layerNames(current.repo.root)) await reserve(current, name);
    return inspect(current);
  });
}
export async function disableBranchProtection(root: string): Promise<BranchProtectionInspection> {
  const c = await context(root);
  if (!c.state) return inspect(c);
  return mutate(c, async current => {
    // Validate all before removing any; a disputed reservation preserves every
    // remaining reservation rather than running a broad worktree prune.
    const native = await worktrees(current.repo.root);
    const prior = await inspect(current);
    const blockers = prior.problems.filter(p => !['missing-worktree', 'pending'].includes(p.reason));
    if (blockers.length) conflict('Liberação recusada: há estado externo que exige inspeção; dados preservados.', { problems: blockers });
    for (const entry of current.state!.entries) {
      await owner(current, entry);
      if (await exists(worktreePath(current, entry))) await verifyReservation(current, entry, native);
    }
    for (const entry of current.state!.entries) await release(current, entry);
    current.state!.enabled = false; await persist(current); return inspect(current);
  });
}
export async function reserveLayerProtection(root: string, name: string): Promise<BranchProtectionInspection> {
  const c = await context(root);
  if (!c.state?.enabled) return inspect(c);
  return mutate(c, async current => { await reserve(current, name); return inspect(current); });
}
export async function releaseLayerProtection(root: string, name: string): Promise<BranchProtectionInspection> {
  const c = await context(root);
  if (!c.state) return inspect(c);
  return mutate(c, async current => {
    const entry = current.state!.entries.find(item => item.name === name);
    if (entry) await release(current, entry); return inspect(current);
  });
}
