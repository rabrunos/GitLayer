import * as fs from 'node:fs/promises';
import path from 'node:path';

import { randomUUID, createHash } from 'node:crypto';
import { LabError, errorMessage } from './errors.js';
import { discover, git, treeEntries, assertSupported } from './git.js';
import { assertNoCollisions, validatePath } from './paths.js';
import { assertNoPathLinks, inspectLayerLayout } from './layout.js';
import { atomicJSON, fingerprint, listTransactions, readJSON } from './storage.js';

const codeOf = (error: unknown) => (error as NodeJS.ErrnoException)?.code;
interface Check { name: string; ok: boolean; detail: unknown }
interface ExportEntry { source: string; path: string; type: 'file' | 'directory' | 'symlink' | 'unsupported'; size?: number; sha256?: string; mode?: number; target?: string }
const within = (parent: string, child: string): boolean => {
  const relative = path.relative(path.toNamespacedPath(path.resolve(parent)), path.toNamespacedPath(path.resolve(child)));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};

async function checkLock(file: string): Promise<unknown> {
  await assertNoPathLinks(path.dirname(file));
  try {
    const stat = await fs.lstat(file);
    let owner: unknown;
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      try { owner = await readJSON(path.join(file, 'owner.json')); }
      catch (error) { owner = { invalid: true, message: errorMessage(error) }; }
    }
    throw new LabError('LOCKED', 'Lock presente e preservado. A existência de um PID antigo não autoriza apagá-lo.', { path: file, type: stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : 'file', owner });
  } catch (error) { if (codeOf(error) === 'ENOENT') return { present: false, path: file }; throw error; }
}

/** Read-only diagnostics remains available when normal metadata loading fails. */
export async function doctorRepository(root: string, fsck = false): Promise<{
  safe: boolean; checks: Check[]; transactions: unknown[]; spaceBytes: number; repository: unknown; layouts: string[];
}> {
  const repo = await discover(root), checks: Check[] = [], transactions: unknown[] = [];
  const check = async (name: string, action: () => Promise<unknown>) => {
    try { checks.push({ name, ok: true, detail: await action() }); }
    catch (error) { checks.push({ name, ok: false, detail: { code: (error as { code?: string }).code ?? 'IO_ERROR', message: errorMessage(error), details: (error as { details?: unknown }).details } }); }
  };
  const layouts = [path.join(repo.gitDir, 'layers'), path.join(repo.gitDir, 'git-layers')];
  let selectedLayout: string | undefined;
  await check('Layout de armazenamento', async () => { const layout = await inspectLayerLayout(repo.gitDir); selectedLayout = layout.directory; return layout; });
  await check('HEAD e refs Git', async () => ({ branch: repo.branch, head: repo.head, refs: (await git(repo.root, ['for-each-ref', '--format=%(refname)%00%(objectname)', 'refs/heads/', 'refs/git-layers/'])).stdout.toString('utf8') }));
  await check('Índice principal', async () => ({ paths: (await treeEntries(repo.root, ':index')).length, fingerprint: await fingerprint(repo.index) }));
  for (const lock of [repo.index + '.lock', path.join(repo.gitDir, 'HEAD.lock'), path.join(repo.gitDir, 'config.lock'), path.join(repo.commonDir, 'packed-refs.lock')]) await check('Lock Git: ' + lock, () => checkLock(lock));
  let spaceBytes = 0;
  for (const directory of layouts) {
    let present = false;
    await check('Diretório: ' + directory, async () => {
      await assertNoPathLinks(directory);
      try {
        const stat = await fs.lstat(directory);
        if (!stat.isDirectory()) throw new LabError('UNSAFE_PATH', 'O armazenamento não é diretório.', { path: directory });
        present = true; return { present: true };
      } catch (error) { if (codeOf(error) === 'ENOENT') return { present: false }; throw error; }
    });
    if (!present) continue;
    await check('Lock coordenador: ' + directory, () => checkLock(path.join(directory, 'locks', 'coordinator')));
    if (selectedLayout === directory) {
      await check('Lock da proteção de branches: ' + directory, () => checkLock(path.join(directory, 'branch-protection', 'control', 'locks', 'coordinator')));
      await check('Proteção nativa de branches: ' + directory, async () => {
        const protectionDirectory = path.join(directory, 'branch-protection');
        await assertNoPathLinks(protectionDirectory);
        try { await fs.lstat(protectionDirectory); }
        catch (error) { if (codeOf(error) === 'ENOENT') return { configured: false }; throw error; }
        const { inspectBranchProtection } = await import('./branch-protection.js');
        const protection = await inspectBranchProtection(repo.root);
        if (!protection.healthy) throw new LabError('PROTECTION_CONFLICT', 'A proteção configurada divergiu dos marcadores/worktrees nativos. Todos os dados foram preservados.', protection);
        return protection;
      });
    }
    let registry: { layers: any[] } | undefined;
    await check('Registry: ' + directory, async () => {
      registry = await readJSON<{ layers: any[] }>(path.join(directory, 'registry.json'), value => Array.isArray(value.layers) && value.layers.every((layer: any) => layer && typeof layer.id === 'string' && /^[A-Za-z0-9-]+$/u.test(layer.id) && typeof layer.name === 'string' && layer.ref === 'refs/heads/layer/' + layer.name && typeof layer.oid === 'string' && typeof layer.indexBase === 'string' && /^[0-9a-f]{40,64}$/u.test(layer.oid) && /^[0-9a-f]{40,64}$/u.test(layer.indexBase) && (layer.remote === undefined || typeof layer.remote === 'string') && ['inactive', 'active', 'parked', 'recovery-required'].includes(layer.state) && layer.name.toLowerCase() !== 'base' && /^[\p{L}\p{N}][\p{L}\p{N}_/-]*$/u.test(layer.name) && !layer.name.includes('..') && !layer.name.endsWith('/') && !layer.name.split('/').some((part: string) => !part || part === '.' || part === '.git') && (layer.shelf === undefined || (typeof layer.shelf === 'string' && /^[A-Za-z0-9-]+$/u.test(layer.shelf))) && Array.isArray(layer.reservations) && layer.reservations.every((item: unknown) => typeof item === 'string' && !!validatePath(item))));
      if (new Set(registry.layers.map(layer => layer.id)).size !== registry.layers.length || new Set(registry.layers.map(layer => layer.name)).size !== registry.layers.length) throw new LabError('METADATA_INVALID', 'IDs ou nomes duplicados.');
      return { layers: registry.layers.length };
    });
    let workspace: { branch: string; head: string; branchLayer?: string; resumeLayer?: string; returnBranch?: string; editing?: { layer: string; before: string[]; unassigned?: string[]; startedAt: string } } | undefined;
    await check('Workspace: ' + directory, async () => {
      workspace = await readJSON(path.join(directory, 'workspace.json'), value => typeof value.head === 'string' && typeof value.branch === 'string' && ['branchLayer', 'resumeLayer', 'returnBranch'].every(key => value[key] === undefined || typeof value[key] === 'string') && (value.editing === undefined || (value.editing && typeof value.editing.layer === 'string' && Array.isArray(value.editing.before) && value.editing.before.every((item: unknown) => typeof item === 'string' && !!validatePath(item)) && typeof value.editing.startedAt === 'string' && Number.isFinite(Date.parse(value.editing.startedAt)) && new Set(value.editing.before).size === value.editing.before.length && (value.editing.unassigned === undefined || (Array.isArray(value.editing.unassigned) && value.editing.unassigned.every((item: unknown) => typeof item === 'string' && !!validatePath(item)) && new Set(value.editing.unassigned).size === value.editing.unassigned.length && value.editing.unassigned.every((item: string) => value.editing.before.includes(item)))))));
      return workspace;
    });
    if (selectedLayout === directory && registry && workspace) await check('Workspace roles: ' + directory, async () => {
      const current = workspace!, layers = registry!.layers;
      if ((current.branchLayer && (current.branch !== 'layer/' + current.branchLayer || !layers.some(layer => layer.name === current.branchLayer && layer.state !== 'active'))) ||
          (current.resumeLayer && current.resumeLayer !== current.branchLayer) ||
          (current.editing && !layers.some(layer => layer.name === current.editing!.layer && layer.state === 'active' && layer.name !== current.branchLayer))) {
        throw new LabError('METADATA_INVALID', 'Workspace roles disagree with the registered Layers; metadata was preserved.');
      }
      return { branchLayer: current.branchLayer ?? null, resumeLayer: current.resumeLayer ?? null, editing: current.editing?.layer ?? null };
    });
    if (selectedLayout === directory) await check('Papel da branch e recursos suportados', async () => {
      await assertSupported(repo, false);
      if (repo.branch.startsWith('layer/') && workspace?.branchLayer !== repo.branch.slice(6)) throw new LabError('EXPLICIT_LAYER_REQUIRED', 'Layer aberta diretamente pelo Git, fora da entrada deliberada registrada.');
      if (workspace?.branchLayer && repo.branch !== 'layer/' + workspace.branchLayer) throw new LabError('EXTERNAL_HEAD', 'HEAD saiu do modo Layer como branch fora da ferramenta; o contexto foi preservado.');
      return { role: workspace?.branchLayer ? 'layer-branch' : 'traditional', branch: repo.branch, branchLayer: workspace?.branchLayer ?? null };
    });
    await check('Journals: ' + directory, async () => {
      const pending = await listTransactions(directory); transactions.push(...pending);
      if (pending.length) throw new LabError('RECOVERY_REQUIRED', 'Transações incompletas foram preservadas.', { ids: pending.map(entry => entry.id) });
      return { pending: 0 };
    });
    // A retained legacy is historical evidence, not a second live index/ref set.
    for (const layer of (!selectedLayout || selectedLayout === directory ? registry?.layers ?? [] : [])) {
      await check('Lock do índice privado: ' + layer.name + ' em ' + directory, () => checkLock(path.join(directory, 'indexes', layer.id + '.index.lock')));
      await check('Índice/ref da Layer: ' + layer.name + ' em ' + directory, async () => {
        const ref = (await git(repo.root, ['rev-parse', '--verify', layer.ref])).stdout.toString('utf8').trim();
        const isWorkingBranch = workspace?.branchLayer === layer.name && repo.branch === 'layer/' + layer.name;
        if (!isWorkingBranch && (ref !== layer.oid || (layer.indexBase !== undefined && layer.indexBase !== ref))) throw new LabError('EXTERNAL_REF', 'A referência diverge dos metadados; nenhum índice foi reinicializado.', { ref, expected: layer.oid });
        const reservations = await readJSON<{ paths: string[] }>(path.join(directory, 'reservations', layer.id + '.json'), value => Array.isArray(value.paths) && value.paths.every((item: unknown) => typeof item === 'string' && !!validatePath(item)));
        if (JSON.stringify(reservations.paths) !== JSON.stringify(layer.reservations)) throw new LabError('RESERVATIONS_INVALID', 'Reservas inconsistentes; as duas versões foram preservadas.');
        const index = path.join(directory, 'indexes', layer.id + '.index');
        const retainedPrivate = await fingerprint(index);
        if (!retainedPrivate.exists) throw new LabError('INDEX_MISSING', 'The retained private index is missing; no replacement was created.', { path: index });
        const paths = (await treeEntries(repo.root, ':index', index)).length;
        const checkpoint = (await git(repo.root, ['rev-parse', '--verify', 'refs/git-layers/state/' + layer.id])).stdout.toString('utf8').trim();
        if (checkpoint && (await git(repo.root, ['diff', '--cached', '--quiet', checkpoint, '--'], { index, ok: [0, 1] })).code !== 0) throw new LabError('CHECKPOINT_MISMATCH', 'Checkpoint diferente do índice; ambos foram preservados.');
        if (isWorkingBranch) return { ref, role: 'branch', index: 'principal', paths: (await treeEntries(repo.root, ':index')).length, privateIndex: 'retained-until-managed-exit', retainedPrivate: { path: index, paths, checkpoint, fingerprint: retainedPrivate, validated: true } };
        return { ref, paths };
      });
    }
    if (selectedLayout === directory && registry && workspace) await check('Propriedade e exclusões efetivas', async () => {
      const base = [...(repo.head ? await treeEntries(repo.root, repo.head) : []), ...await treeEntries(repo.root, ':index')];
      const indexedBase = new Set((await treeEntries(repo.root, ':index')).map(entry => entry.path));
      const ownership = base.map(entry => ({ path: entry.path, owner: workspace!.branchLayer ?? 'base' }));
      const protectedPaths: string[] = [];
      for (const layer of registry!.layers.filter(entry => entry.state === 'active' && entry.name !== workspace!.branchLayer)) {
        const index = path.join(directory, 'indexes', layer.id + '.index');
        const own = [...new Set([...(await treeEntries(repo.root, layer.oid)).map(entry => entry.path), ...(await treeEntries(repo.root, ':index', index)).map(entry => entry.path), ...layer.reservations.map(validatePath)])] as string[];
        for (const file of own) {
          if (indexedBase.has(file)) throw new LabError('BASE_CONTAMINATED', 'Um caminho da Layer foi preparado no índice principal.', { path: file, layer: layer.name });
          ownership.push({ path: file, owner: layer.name }); protectedPaths.push(file);
        }
      }
      assertNoCollisions(ownership);
      if (protectedPaths.length) {
        const ignored = new Set((await git(repo.root, ['check-ignore', '--no-index', '-z', '--stdin'], { input: protectedPaths.join('\0') + '\0', ok: [0, 1] })).stdout.toString('utf8').split('\0').filter(Boolean));
        const unsafe = protectedPaths.filter(file => !ignored.has(file));
        if (unsafe.length) throw new LabError('IGNORE_UNSAFE', 'Exclusões inefetivas nas Layers ativas.', { paths: unsafe });
      }
      return { origins: new Set(ownership.map(entry => entry.owner)).size, protectedPaths: protectedPaths.length };
    });
    await check('Inventário seguro: ' + directory, async () => {
      let files = 0;
      async function visit(folder: string): Promise<void> {
        await assertNoPathLinks(folder);
        for (const name of await fs.readdir(folder)) {
          const file = path.join(folder, name), stat = await fs.lstat(file);
          if (stat.isSymbolicLink()) throw new LabError('UNSAFE_PATH', 'Link nos metadados foi preservado, sem percorrê-lo.', { path: file, target: await fs.readlink(file) });
          if (stat.isDirectory()) await visit(file);
          else if (stat.isFile()) { files++; spaceBytes += stat.size; }
          else throw new LabError('UNSAFE_FILE_TYPE', 'Tipo especial nos metadados.', { path: file });
        }
      }
      await visit(directory); return { files };
    });
  }
  if (fsck) await check('git fsck', async () => {
    const result = await git(repo.root, ['fsck', '--full', '--no-reflogs'], { timeout: 120_000 });
    return (result.stdout.toString('utf8') + result.stderr.toString('utf8')).trim() || 'Objetos verificados.';
  });
  return { safe: checks.every(entry => entry.ok), checks, transactions, spaceBytes, repository: { root: repo.root, gitDir: repo.gitDir, commonDir: repo.commonDir, branch: repo.branch, head: repo.head }, layouts };
}

/**
 * Export raw evidence without opening registry/workspace or taking/removing locks.
 * Links are recorded as link targets, not recreated as live links in the export.
 * A failed export retains its partial directory and incomplete manifest.
 */
export async function exportRepositoryRecovery(root: string, destination: string): Promise<{
  destination: string; files: number; links: number; manifest: string; complete: true;
}> {
  if (!path.isAbsolute(destination)) throw new LabError('EXPORT_PATH', 'Escolha um destino absoluto novo.');
  const repo = await discover(root), requested = path.resolve(destination), requestedParent = path.dirname(requested);
  await assertNoPathLinks(requested);
  await assertNoPathLinks(requestedParent);
  // Resolve the existing parent before reserving the new leaf. Namespace and
  // other filesystem aliases must not make a protected subtree appear external.
  const parent = await fs.realpath(requestedParent), target = path.join(parent, path.basename(requested));
  if (!(await fs.lstat(parent)).isDirectory()) throw new LabError('EXPORT_PATH', 'O pai do destino precisa existir e ser um diretório.');
  for (const protectedRoot of [repo.root, repo.gitDir, repo.commonDir]) {
    const canonicalRoot = await fs.realpath(protectedRoot);
    if (within(canonicalRoot, target) || within(target, canonicalRoot)) throw new LabError('EXPORT_PATH', 'A exportação deve ficar fora do workspace e dos diretórios Git, sem ser ancestral deles.', { destination: target });
  }
  try { await fs.mkdir(target, { mode: 0o700 }); }
  catch (error) { if (codeOf(error) === 'EEXIST') throw new LabError('EXPORT_NOT_EMPTY', 'O destino deve ser novo; inclusive diretórios vazios existentes são preservados.', { destination: target }); throw error; }
  const id = randomUUID(), entries: ExportEntry[] = [], manifest = path.join(target, 'recovery-export.json');
  const data = { schema: 1, kind: 'git-layer-recovery-export', id, complete: false, createdAt: new Date().toISOString(), platform: process.platform, repository: { branch: repo.branch, head: repo.head }, entries, limitations: ['Não é clone completo dos objetos Git.', 'Links são registros no manifesto, sem seguir o destino.', 'Exportação concorrente não é snapshot atômico; arquivos alterados durante a cópia suspendem a operação.'] };
  await atomicJSON(manifest, data);
  async function copy(source: string, relative: string): Promise<void> {
    await assertNoPathLinks(path.dirname(source));
    const stat = await fs.lstat(source), output = path.join(target, ...relative.split('/'));
    await assertNoPathLinks(output);
    if (stat.isSymbolicLink()) {
      entries.push({ source, path: relative, type: 'symlink', target: await fs.readlink(source) }); return;
    }
    if (stat.isDirectory()) {
      await fs.mkdir(output, { mode: stat.mode & 0o777 });
      entries.push({ source, path: relative, type: 'directory', mode: stat.mode & 0o777 });
      for (const name of (await fs.readdir(source)).sort()) await copy(path.join(source, name), relative + '/' + name);
      return;
    }
    if (!stat.isFile()) { entries.push({ source, path: relative, type: 'unsupported', mode: stat.mode }); return; }
    const before = await fingerprint(source);
    await fs.copyFile(source, output, fs.constants.COPYFILE_EXCL); await fs.chmod(output, before.mode);
    const after = await fingerprint(source), saved = await fingerprint(output);
    if (before.hash !== after.hash || before.mode !== after.mode || before.hash !== saved.hash || before.mode !== saved.mode) throw new LabError('EXTERNAL_CHANGE', 'O arquivo mudou durante a exportação. A cópia parcial foi preservada.', { source, output });
    entries.push({ source, path: relative, type: 'file', size: (await fs.lstat(output)).size, sha256: saved.hash, mode: saved.mode });
  }
  try {
    await fs.mkdir(path.join(target, 'metadata'));
    for (const name of ['layers', 'git-layers']) {
      const source = path.join(repo.gitDir, name);
      try { await fs.lstat(source); } catch (error) { if (codeOf(error) === 'ENOENT') continue; throw error; }
      await copy(source, 'metadata/' + name);
    }
    await fs.mkdir(path.join(target, 'git-state'));
    for (const [source, name] of [[repo.index, 'index'], [repo.index + '.lock', 'index.lock'], [path.join(repo.gitDir, 'HEAD'), 'HEAD'], [path.join(repo.gitDir, 'HEAD.lock'), 'HEAD.lock'], [repo.exclude, 'info-exclude']] as const) {
      try { await fs.lstat(source); } catch (error) { if (codeOf(error) === 'ENOENT') continue; throw error; }
      await copy(source, 'git-state/' + name);
    }
    const refs = (await git(repo.root, ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(objecttype)', 'refs/heads/', 'refs/git-layers/'])).stdout;
    await fs.writeFile(path.join(target, 'git-state', 'refs.txt'), refs, { flag: 'wx', mode: 0o600 });
    await atomicJSON(manifest, { ...data, complete: true, completedAt: new Date().toISOString(), refsSHA256: createHash('sha256').update(refs).digest('hex') });
    return { destination: target, files: entries.filter(entry => entry.type === 'file').length, links: entries.filter(entry => entry.type === 'symlink').length, manifest, complete: true };
  } catch (error) {
    await atomicJSON(manifest, { ...data, error: { code: (error as { code?: string }).code ?? 'IO_ERROR', message: errorMessage(error) } }).catch(() => {});
    throw error;
  }
}
