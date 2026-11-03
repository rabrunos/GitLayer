import type { FileEntry } from '../shared.js';

export interface ExplorerNode {
  path: string;
  name: string;
  directory: boolean;
  owner: string | null;
  layers: string[];
  children: ExplorerNode[];
}
export interface ExplorerRow {
  node: ExplorerNode;
  chain: ExplorerNode[];
  depth: number;
  parent: string;
}
const names = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const parentPath = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')));

/** Build siblings before sorting: sorting full paths interleaves folders and files. */
export function explorerTree(files: FileEntry[], directories: string[] = []): ExplorerNode[] {
  const nodes = new Map<string, ExplorerNode>();
  const roots: ExplorerNode[] = [];
  const directory = (path: string): ExplorerNode => {
    const existing = nodes.get(path);
    if (existing) return existing;
    const node: ExplorerNode = { path, name: path.split('/').at(-1)!, directory: true, owner: null, layers: [], children: [] };
    nodes.set(path, node);
    const parent = parentPath(path);
    (parent ? directory(parent).children : roots).push(node);
    return node;
  };
  for (const path of directories) directory(path);
  for (const file of files) {
    // A deleted tracked file can be replaced on disk by a directory of the same name.
    if (nodes.has(file.path)) continue;
    const node: ExplorerNode = { ...file, name: file.path.split('/').at(-1)!, directory: false, layers: file.owner && file.owner !== 'base' ? [file.owner] : [], children: [] };
    nodes.set(file.path, node);
    const parent = parentPath(file.path);
    (parent ? directory(parent).children : roots).push(node);
  }
  const sort = (siblings: ExplorerNode[]): void => {
    siblings.sort((a, b) => Number(b.directory) - Number(a.directory) || names.compare(a.name, b.name) || a.name.localeCompare(b.name));
    for (const node of siblings) if (node.directory) {
      sort(node.children);
      node.layers = [...new Set(node.children.flatMap(child => child.layers))];
    }
  };
  sort(roots);
  return roots;
}

/** Compact only single-child directory chains, never a folder containing files. */
export function explorerRows(roots: ExplorerNode[], expanded: ReadonlySet<string>, compact: boolean, depth = 1, parent = ''): ExplorerRow[] {
  const rows: ExplorerRow[] = [];
  for (const first of roots) {
    const chain = [first];
    let node = first;
    while (compact && node.directory && node.children.length === 1 && node.children[0]!.directory) {
      node = node.children[0]!; chain.push(node);
    }
    rows.push({ node, chain, depth, parent });
    if (node.directory && expanded.has(node.path)) rows.push(...explorerRows(node.children, expanded, compact, depth + 1, node.path));
  }
  return rows;
}
