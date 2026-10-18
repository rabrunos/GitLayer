import type { FileEntry, RepoSnapshot } from '../shared.js';

type WorkspaceState = Pick<RepoSnapshot, 'files' | 'status'>;
const statusLabels: Record<string, string> = { M: 'Modificado', A: 'Adicionado', D: 'Removido', R: 'Renomeado', C: 'Copiado', T: 'Tipo alterado', U: 'Conflito', '?': 'Não rastreado' };
const statusLabel = (status: string): string => statusLabels[status.slice(0, 1)] ?? status;
export const gitStatusLetter = (status: string): string => status === '?' ? 'U' : status.includes('U') ? '!' : status.slice(0, 1);

/** Include tracked deletions, which have no physical file to enumerate anymore. */
export function explorerFiles(snapshot: WorkspaceState | null): FileEntry[] {
  if (!snapshot) return [];
  const entries = new Map(snapshot.files.map(file => [file.path, { ...file }]));
  const add = (path: string, owner: string | null) => { if (!entries.has(path)) entries.set(path, { path, owner }); };
  for (const change of [...snapshot.status.base.staged, ...snapshot.status.base.unstaged]) add(change.path, 'base');
  for (const layer of snapshot.status.layers) for (const change of [...layer.staged, ...layer.unstaged]) add(change.path, layer.name ?? null);
  for (const path of snapshot.status.untracked) add(path, null);
  return [...entries.values()];
}

export function layerOwnership(owner: string | null | undefined): string | null {
  return owner && owner !== 'base' ? `Layer ${owner}` : null;
}

/** Git decoration reflects the disk/index; an unsaved editor buffer stays separate. */
export function fileDecoration(path: string, status: RepoSnapshot['status'] | undefined, bufferDirty = false): { git: string; title: string; bufferDirty: boolean } {
  const groups = status ? [status.base, ...status.layers] : [];
  const staged = groups.flatMap(group => group.staged).find(change => change.path === path)?.status ?? '';
  const unstaged = groups.flatMap(group => group.unstaged).find(change => change.path === path)?.status ?? '';
  const untracked = status?.untracked.includes(path) ?? false;
  const rawStatus = staged.includes('U') || unstaged.includes('U') ? 'U' : unstaged || staged || (untracked ? '?' : '');
  const git = gitStatusLetter(rawStatus);
  const details: string[] = [];
  if (staged) details.push(`Preparado: ${statusLabel(staged)}.`);
  if (unstaged) details.push(`No disco: ${statusLabel(unstaged)}.`);
  if (!staged && !unstaged) details.push(untracked ? 'Não rastreado pelo Git.' : 'Git: sem alterações.');
  if (staged && unstaged) details.push('Há alterações no staging e no disco. O marcador prioriza o disco; conflitos têm prioridade.');
  if (bufferDirty) details.push('Não salvo no editor. O estado Git acima reflete somente o disco e o índice.');
  return { git, title: details.join('\n'), bufferDirty };
}
