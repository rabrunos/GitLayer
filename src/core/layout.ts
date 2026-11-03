import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { LabError } from './errors.js';
import { discover } from './git.js';
import { atomicJSON, failpoint, fingerprint, listTransactions, readJSON, withLock } from './storage.js';

const MARKER = 'layout-migration.json';
const codeOf = (error: unknown) => (error as NodeJS.ErrnoException)?.code;
export interface LayoutEntry { path: string; type: 'directory' | 'file'; size?: number; hash?: string; mode: number }
interface MigrationMarker {
  schema: 1; kind: 'git-layer-layout-migration'; id: string; state: 'completed';
  source: string; destination: string; createdAt: string; sourceHash: string; entries: LayoutEntry[];
}
export interface LayerLayout {
  directory: string; legacy: string; current: string; legacyExists: boolean; currentExists: boolean;
  migrated: boolean; retainedLegacy?: string;
}

/** Check every existing ancestor with lstat. Missing suffixes never authorize following links. */
export async function assertNoPathLinks(file: string): Promise<void> {
  const absolute = path.resolve(file), root = path.parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new LabError('UNSAFE_PATH', 'O caminho atravessa um link; nenhum destino foi escrito.', { path: current });
      if (current !== absolute && !stat.isDirectory()) throw new LabError('UNSAFE_PATH', 'Um ancestral não é um diretório.', { path: current });
    } catch (error) { if (codeOf(error) === 'ENOENT') return; throw error; }
  }
}

async function presentDirectory(directory: string): Promise<boolean> {
  await assertNoPathLinks(directory);
  try {
    if (!(await fs.lstat(directory)).isDirectory()) throw new LabError('LAYOUT_CONFLICT', 'O caminho de armazenamento está ocupado por um arquivo.', { path: directory });
    return true;
  } catch (error) { if (codeOf(error) === 'ENOENT') return false; throw error; }
}

function manifestHash(entries: LayoutEntry[]): string {
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

/** Metadata copy oracle: path, type, bytes and portable mode; never follows links. */
export async function inventoryLayerDirectory(directory: string): Promise<LayoutEntry[]> {
  await assertNoPathLinks(directory);
  const entries: LayoutEntry[] = [];
  async function visit(folder: string, relative: string): Promise<void> {
    for (const name of (await fs.readdir(folder)).sort()) {
      const file = path.join(folder, name), local = relative ? relative + '/' + name : name;
      // The migration's own transient lock cannot be copied as an active lock.
      if (local === 'locks/coordinator') continue;
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink()) throw new LabError('UNSAFE_PATH', 'A migração não segue links em metadados. Use export-recovery para inspecioná-los.', { path: file });
      if (stat.isDirectory()) {
        entries.push({ path: local, type: 'directory', mode: stat.mode & 0o777 });
        await visit(file, local);
      } else if (stat.isFile()) {
        const result = await fingerprint(file);
        entries.push({ path: local, type: 'file', size: stat.size, hash: result.hash, mode: result.mode });
      } else throw new LabError('UNSAFE_FILE_TYPE', 'Tipo de arquivo não suportado no armazenamento; os dados foram preservados.', { path: file });
    }
  }
  await visit(directory, '');
  return entries;
}

async function migrationMarker(current: string, legacy: string): Promise<MigrationMarker | undefined> {
  try {
    return await readJSON<MigrationMarker>(path.join(current, MARKER), value =>
      value.kind === 'git-layer-layout-migration' && value.state === 'completed' &&
      typeof value.id === 'string' && /^[a-f0-9-]{36}$/u.test(value.id) &&
      value.source === legacy && value.destination === current && /^[0-9a-f]{64}$/u.test(value.sourceHash) &&
      Array.isArray(value.entries) && manifestHash(value.entries) === value.sourceHash);
  } catch (error) {
    if (error instanceof LabError && error.code === 'METADATA_INVALID' && (error.details as { reason?: string })?.reason?.includes('ENOENT')) return undefined;
    throw new LabError('LAYOUT_CONFLICT', 'Os dois layouts existem sem um marcador de migração válido. Nenhum foi sobrescrito.', { legacy, current, reason: String(error) });
  }
}

/** Fresh repositories use layers; legacy is opened in place until an explicit migration. */
export async function inspectLayerLayout(gitDir: string): Promise<LayerLayout> {
  const base = path.resolve(gitDir), legacy = path.join(base, 'git-layers'), current = path.join(base, 'layers');
  const legacyExists = await presentDirectory(legacy), currentExists = await presentDirectory(current);
  if (legacyExists && currentExists) {
    const marker = await migrationMarker(current, legacy);
    if (!marker) throw new LabError('LAYOUT_CONFLICT', 'layers e git-layers existem; o destino desconhecido foi preservado.', { legacy, current });
    try {
      await fs.lstat(path.join(legacy, 'locks', 'coordinator'));
      throw new LabError('LOCKED', 'Há uma operação ou lock no legado retido. Ele foi preservado e o layout novo não será aberto em paralelo.', { path: path.join(legacy, 'locks', 'coordinator') });
    } catch (error) { if (codeOf(error) !== 'ENOENT') throw error; }
    const actual = await inventoryLayerDirectory(legacy);
    if (manifestHash(actual) !== marker.sourceHash) throw new LabError('LEGACY_DIVERGED', 'O legado mudou depois da migração. As duas cópias foram preservadas; inspecione antes de continuar.', { legacy, current });
    return { directory: current, legacy, current, legacyExists, currentExists, migrated: true, retainedLegacy: legacy };
  }
  return { directory: legacyExists ? legacy : current, legacy, current, legacyExists, currentExists, migrated: false };
}
export const inspectLayout = inspectLayerLayout;
export async function resolveLayerDirectory(gitDir: string): Promise<string> { return (await inspectLayerLayout(gitDir)).directory; }

/**
 * Explicit copy-and-publish migration. The legacy is retained byte-for-byte.
 * Pending recovery must be resolved first, so historical absolute journal paths
 * remain usable in the retained legacy rather than being silently rewritten.
 */
export async function migrateLayerLayout(root: string, options: { confirm?: boolean } = {}): Promise<{
  source: string; destination: string; retainedLegacy: string; alreadyMigrated: boolean; files: number; sourceHash: string;
}> {
  if (options.confirm !== true) throw new LabError('CONFIRM_REQUIRED', 'A migração explícita exige --confirm. O legado será conservado integralmente.');
  const repo = await discover(root), layout = await inspectLayerLayout(repo.gitDir);
  if (layout.migrated) {
    const marker = (await migrationMarker(layout.current, layout.legacy))!;
    return { source: layout.legacy, destination: layout.current, retainedLegacy: layout.legacy, alreadyMigrated: true, files: marker.entries.filter(entry => entry.type === 'file').length, sourceHash: marker.sourceHash };
  }
  if (!layout.legacyExists) throw new LabError('LAYOUT_NOT_LEGACY', 'Nenhum armazenamento git-layers existe para migrar.', { directory: layout.directory });
  if (layout.currentExists) throw new LabError('LAYOUT_CONFLICT', 'O destino layers já existe e foi preservado.', { path: layout.current });
  return withLock(layout.legacy, async () => {
    // Normal opening validates names, IDs, states, paths and workspace schema.
    // This intentionally does not call status/list or synchronize editing.
    const { GitLayers } = await import('./index.js');
    await GitLayers.open(repo.root);
    await readJSON(path.join(layout.legacy, 'registry.json'), value => Array.isArray(value.layers));
    await readJSON(path.join(layout.legacy, 'workspace.json'), value => typeof value.branch === 'string' && typeof value.head === 'string');
    const protection = path.join(layout.legacy, 'branch-protection');
    if (await presentDirectory(protection)) {
      const state = await readJSON<{ enabled: boolean; entries: Array<{ state: string }> }>(path.join(protection, 'state.json'), value =>
        value.kind === 'git-layer-branch-protection' && value.root === repo.root && value.gitDir === repo.gitDir &&
        typeof value.enabled === 'boolean' && Array.isArray(value.entries) && value.entries.every((entry: any) =>
          entry && typeof entry.id === 'string' && /^[a-f0-9-]{36}$/u.test(entry.id) &&
          typeof entry.nonce === 'string' && /^[a-f0-9-]{36}$/u.test(entry.nonce) &&
          typeof entry.name === 'string' && entry.ref === 'refs/heads/layer/' + entry.name &&
          ['reserving', 'reserved', 'releasing', 'released'].includes(entry.state)));
      if (state.enabled || state.entries.some(entry => entry.state !== 'released')) throw new LabError('PROTECTION_MIGRATION_REQUIRED', 'Execute unprotect e resolva todas as reservas antes de migrar. Worktrees ativas não podem ser copiadas para outro caminho.', { protection });
      const lock = path.join(protection, 'control', 'locks', 'coordinator');
      await assertNoPathLinks(lock);
      try { await fs.lstat(lock); throw new LabError('LOCKED', 'O controle de proteção está bloqueado e foi preservado.', { path: lock }); }
      catch (error) { if (codeOf(error) !== 'ENOENT') throw error; }
      // A disabled flag alone cannot prove that native worktree registrations
      // and released owner markers agree with the filesystem.
      const { inspectBranchProtection } = await import('./branch-protection.js');
      const inspection = await inspectBranchProtection(repo.root);
      if (!inspection.healthy || inspection.validWorktrees.length) throw new LabError('PROTECTION_MIGRATION_REQUIRED', 'As reservas liberadas ainda estão incoerentes. Preserve-as e resolva o diagnóstico antes de migrar.', { problems: inspection.problems });
    }
    const pending = await listTransactions(layout.legacy);
    if (pending.length) throw new LabError('RECOVERY_REQUIRED', 'Recupere ou exporte as transações pendentes no layout legado antes de migrar.', { pending: pending.map(entry => entry.id) });
    const entries = await inventoryLayerDirectory(layout.legacy), sourceHash = manifestHash(entries);
    if (entries.some(entry => [MARKER, 'migration-incomplete.json', 'layout-migration-incomplete.json'].includes(entry.path))) throw new LabError('LAYOUT_CONFLICT', 'O legado contém nomes reservados pela migração. Exporte para inspecionar sem sobrescrever os dados.');
    const temporary = path.join(repo.gitDir, '.layers-migration-' + randomUUID());
    await assertNoPathLinks(temporary);
    await fs.mkdir(temporary, { mode: 0o700 });
    // Failure leaves an owned, identifiable partial copy; never touches legacy.
    await atomicJSON(path.join(temporary, 'migration-incomplete.json'), { schema: 1, kind: 'git-layer-layout-migration', source: layout.legacy, destination: layout.current, sourceHash, createdAt: new Date().toISOString() });
    for (const entry of entries) {
      const source = path.join(layout.legacy, ...entry.path.split('/')), target = path.join(temporary, ...entry.path.split('/'));
      await assertNoPathLinks(source); await assertNoPathLinks(target);
      if (entry.type === 'directory') await fs.mkdir(target, { mode: entry.mode });
      else {
        await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
        await fs.chmod(target, entry.mode);
        const copied = await fingerprint(target);
        if (copied.hash !== entry.hash || copied.mode !== entry.mode) throw new LabError('MIGRATION_COPY_MISMATCH', 'A cópia difere do legado. A cópia parcial e os originais foram preservados.', { source, target });
      }
    }
    if (manifestHash(await inventoryLayerDirectory(layout.legacy)) !== sourceHash) throw new LabError('EXTERNAL_CHANGE', 'O legado mudou durante a migração. A publicação foi cancelada.', { temporary });
    failpoint('migration-after-copy');
    const marker: MigrationMarker = { schema: 1, kind: 'git-layer-layout-migration', id: randomUUID(), state: 'completed', source: layout.legacy, destination: layout.current, createdAt: new Date().toISOString(), sourceHash, entries };
    await assertNoPathLinks(layout.current);
    // mkdir is an exclusive destination reservation. rename alone can replace an
    // unknown empty directory on POSIX if one appears after an existence check.
    try { await fs.mkdir(layout.current, { mode: 0o700 }); }
    catch (error) {
      if (codeOf(error) === 'EEXIST') throw new LabError('LAYOUT_CONFLICT', 'O destino surgiu durante a migração e foi preservado.', { temporary, destination: layout.current });
      throw error;
    }
    await atomicJSON(path.join(layout.current, 'layout-migration-incomplete.json'), { ...marker, state: 'incomplete', staging: temporary });
    failpoint('migration-after-reserve');
    for (const entry of entries) {
      const source = path.join(temporary, ...entry.path.split('/')), target = path.join(layout.current, ...entry.path.split('/'));
      await assertNoPathLinks(source); await assertNoPathLinks(target);
      if (entry.type === 'directory') await fs.mkdir(target, { mode: 0o700 });
      else {
        await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
        // Windows FlushFileBuffers requires a writable handle. The copy is ours:
        // grant its temporary write bit, flush, then restore the original mode.
        await fs.chmod(target, 0o600);
        const handle = await fs.open(target, 'r+');
        try { await handle.sync(); } finally { await handle.close(); }
        await fs.chmod(target, entry.mode);
        const actual = await fingerprint(target);
        if (actual.hash !== entry.hash || actual.mode !== entry.mode) throw new LabError('MIGRATION_COPY_MISMATCH', 'A publicação difere da cópia verificada. As cópias foram preservadas.', { source, target });
      }
    }
    for (const entry of entries.filter(item => item.type === 'directory').reverse()) await fs.chmod(path.join(layout.current, ...entry.path.split('/')), entry.mode);
    const published = (await inventoryLayerDirectory(layout.current)).filter(entry => entry.path !== 'layout-migration-incomplete.json');
    if (manifestHash(published) !== sourceHash || manifestHash(await inventoryLayerDirectory(layout.legacy)) !== sourceHash) throw new LabError('EXTERNAL_CHANGE', 'O armazenamento mudou antes da publicação final. O layout incompleto foi preservado.');
    failpoint('migration-before-complete');
    // Complete marker is new and exclusive; it cannot replace unknown content.
    const markerFile = await fs.open(path.join(layout.current, MARKER), 'wx', 0o600);
    try { await markerFile.writeFile(JSON.stringify(marker, null, 2) + '\n'); await markerFile.sync(); } finally { await markerFile.close(); }
    await fs.unlink(path.join(layout.current, 'layout-migration-incomplete.json'));
    // Remove only the exact staging entries created here. Unknown additions
    // prevent rmdir and remain as evidence; there is no recursive cleanup.
    for (const entry of entries.filter(item => item.type === 'file')) {
      const staged = path.join(temporary, ...entry.path.split('/'));
      const actual = await fingerprint(staged).catch(() => undefined);
      if (actual && actual.hash === entry.hash && actual.mode === entry.mode) await fs.unlink(staged).catch(() => {});
    }
    await fs.unlink(path.join(temporary, 'migration-incomplete.json')).catch(() => {});
    for (const entry of entries.filter(item => item.type === 'directory').reverse()) await fs.rmdir(path.join(temporary, ...entry.path.split('/'))).catch(() => {});
    await fs.rmdir(temporary).catch(() => {});
    return { source: layout.legacy, destination: layout.current, retainedLegacy: layout.legacy, alreadyMigrated: false, files: entries.filter(entry => entry.type === 'file').length, sourceHash };
  });
}
