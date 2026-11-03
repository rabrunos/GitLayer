import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { FileEntry } from '../shared.js';
import { explorerRows, explorerTree, parentPath, type ExplorerRow } from './explorer-tree.js';
import { Codicon, FileIcon } from './FileIcon.js';

interface Props {
  root: string;
  files: FileEntry[];
  directories: string[];
  active: string;
  busy: boolean;
  readOnly: boolean;
  decoration: (path: string) => { git: string; title: string };
  renderDecoration: (path: string, owner: string | null) => ReactNode;
  renderLayers: (label: string) => ReactNode;
  onOpen: (path: string) => Promise<void>;
  onCreate: (path: string, directory: boolean) => Promise<boolean>;
  onRename: (path: string, to: string) => Promise<boolean>;
  onDelete: (path: string) => Promise<void>;
  onRefresh: () => void;
  onError: (message: string) => void;
}
type Edit = { path?: string; parent: string; directory: boolean; value: string };
type Context = { path: string; directory: boolean; x: number; y: number; options?: boolean };
function savedExpanded(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch { return new Set(); }
}

export function FileExplorer(props: Props): React.JSX.Element {
  const key = `gitlayers-explorer:${props.root}`;
  const [expanded, setExpanded] = useState(() => savedExpanded(key));
  const [rootExpanded, setRootExpanded] = useState(true);
  const [compact, setCompact] = useState(() => localStorage.getItem('gitlayers-compact-folders') !== 'false');
  const [selected, setSelected] = useState('');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [editError, setEditError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [context, setContext] = useState<Context | null>(null);
  const tree = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const typeAhead = useRef({ text: '', at: 0 });
  const roots = useMemo(() => explorerTree(props.files, props.directories), [props.files, props.directories]);
  const rows = useMemo(() => rootExpanded ? explorerRows(roots, expanded, compact) : [], [roots, expanded, compact, rootExpanded]);
  const rootName = props.root.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? props.root;
  const select = useCallback((path: string, focus = false) => {
    setSelected(path);
    if (focus) requestAnimationFrame(() => {
      const row = [...tree.current?.querySelectorAll<HTMLElement>('[role=treeitem]') ?? []].find(element => element.dataset.path === path);
      row?.focus(); row?.scrollIntoView({ block: 'nearest' });
    });
  }, []);
  const reveal = useCallback((path: string) => {
    setRootExpanded(true);
    setExpanded(previous => {
      const next = new Set(previous);
      for (let p = parentPath(path); p; p = parentPath(p)) next.add(p);
      return next;
    });
    select(path);
  }, [select]);
  useEffect(() => { localStorage.setItem(key, JSON.stringify([...expanded])); }, [expanded, key]);
  useEffect(() => {
    if (!props.active) return;
    reveal(props.active);
    requestAnimationFrame(() => [...tree.current?.querySelectorAll<HTMLElement>('[role=treeitem]') ?? []].find(element => element.dataset.path === props.active)?.scrollIntoView({ block: 'nearest' }));
  }, [props.active, reveal]);
  useEffect(() => {
    if (edit) {
      input.current?.focus();
      const end = edit.path && !edit.directory && edit.value.lastIndexOf('.') > 0 ? edit.value.lastIndexOf('.') : edit.value.length;
      input.current?.setSelectionRange(0, end);
    }
  }, [edit?.path, edit?.parent, edit?.directory]);
  useEffect(() => {
    if (!context) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const close = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setContext(null); };
    const closeOnResize = () => setContext(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', closeOnResize);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('resize', closeOnResize); };
  }, [context]);
  // Keep one tab stop even when refresh removes the selected path or a parent is collapsed.
  const focusPath = rows.some(row => row.node.path === selected) ? selected : '';
  const toggle = (path: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  const collapse = () => { setExpanded(new Set()); select(''); };
  const startCreate = (directory: boolean, target = selected) => {
    if (props.busy || props.readOnly) return;
    const row = rows.find(row => row.node.path === target);
    const parent = row?.node.directory ? row.node.path : parentPath(target);
    setRootExpanded(true);
    setExpanded(previous => new Set([...previous, parent]));
    setContext(null); setEditError(''); setEdit({ parent, directory, value: '' });
  };
  const startRename = (path: string) => {
    if (props.busy || props.readOnly) return;
    setContext(null); setEditError(''); setEdit({ path, parent: parentPath(path), directory: false, value: path.split('/').at(-1)! });
  };
  const cancelEdit = () => { setEdit(null); setEditError(''); select(selected, true); };
  const submitEdit = async () => {
    if (!edit || submitting) return;
    const name = edit.value;
    if (!name.trim()) { setEditError('Informe um nome.'); return; }
    const path = edit.parent ? `${edit.parent}/${name}` : name;
    if (path === edit.path) { cancelEdit(); return; }
    if ([...props.files.map(file => file.path), ...props.directories].some(existing => existing.toLowerCase() === path.toLowerCase())) { setEditError('Já existe um arquivo ou pasta com esse nome.'); return; }
    setSubmitting(true); setEditError('');
    try {
      const ok = edit.path ? await props.onRename(edit.path, path) : await props.onCreate(path, edit.directory);
      if (ok) { setEdit(null); reveal(path); select(path, edit.directory); }
      else setEditError('Não foi possível concluir. Confira a mensagem do aplicativo.');
    } catch (error) { setEditError(String(error)); }
    finally { setSubmitting(false); }
  };
  const showContext = (event: React.MouseEvent, path: string, directory: boolean) => {
    event.preventDefault(); event.stopPropagation();
    select(path); setContext({ path, directory, x: Math.min(event.clientX, window.innerWidth - 250), y: Math.min(event.clientY, window.innerHeight - 255) });
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, row?: ExplorerRow) => {
    const path = row?.node.path ?? '';
    const sequence = ['', ...rows.map(item => item.node.path)];
    const index = sequence.indexOf(path);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); select(sequence[Math.max(0, Math.min(sequence.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]!, true); }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); select(sequence[event.key === 'Home' ? 0 : sequence.length - 1]!, true); }
    else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (!row) { if (!rootExpanded) setRootExpanded(true); else if (rows[0]) select(rows[0].node.path, true); }
      else if (row.node.directory) { if (!expanded.has(path)) toggle(path); else if (rows[index]?.parent === path) select(rows[index]!.node.path, true); }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (!row) setRootExpanded(false);
      else if (row.node.directory && expanded.has(path)) toggle(path);
      else select(row.parent, true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (!row) setRootExpanded(!rootExpanded); else if (row.node.directory) toggle(path); else if (event.key === 'Enter') void props.onOpen(path);
    } else if (event.key === 'F2' && row && !row.node.directory) { event.preventDefault(); startRename(path); }
    else if (event.key === 'Delete' && row && !row.node.directory && !props.readOnly && !props.busy) { event.preventDefault(); void props.onDelete(path); }
    else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect();
      setContext({ path, directory: !row || row.node.directory, x: bounds.left + 25, y: Math.min(bounds.bottom, window.innerHeight - 255) });
    } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const now = Date.now(); const previous = now - typeAhead.current.at < 800 ? typeAhead.current.text : '';
      const text = previous === event.key.toLowerCase() ? previous : previous + event.key.toLowerCase();
      typeAhead.current = { text, at: now };
      const match = [...rows.slice(index), ...rows.slice(0, index)].find(item => item.node.name.toLowerCase().startsWith(text));
      if (match) { event.preventDefault(); select(match.node.path, true); }
    }
  };
  const inlineInput = (depth: number) => edit && <div className="explorer-edit" style={{ '--tree-depth': depth } as CSSProperties}>
    <form className="explorer-input-row" onSubmit={event => { event.preventDefault(); void submitEdit(); }}>
      <span className="explorer-twistie" /><FileIcon path={edit.value} directory={edit.directory} />
      <input ref={input} aria-label={edit.path ? 'Renomear arquivo' : edit.directory ? 'Nome da nova pasta' : 'Nome do novo arquivo'} aria-invalid={!!editError} aria-describedby={editError ? 'explorer-input-error' : undefined} disabled={submitting} value={edit.value} onChange={event => { setEdit({ ...edit, value: event.target.value }); setEditError(''); }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); cancelEdit(); } }} onBlur={event => { if (!submitting && !edit.value && !event.currentTarget.form?.contains(event.relatedTarget as Node)) cancelEdit(); }} />
    </form>
    {editError && <div className="explorer-input-error" id="explorer-input-error" role="alert">{editError}</div>}
  </div>;
  const copyPath = () => {
    if (context) void window.lab.call('copyRelativePath', { path: context.path }).then(result => {
      if (!result.ok) props.onError(result.error?.message ?? 'Não foi possível copiar o caminho.');
    }).catch(error => props.onError(String(error)));
    setContext(null);
  };
  const action = (label: string, icon: string, click: () => void, shortcut?: string, disabled = false) => <button role="menuitem" disabled={disabled} onClick={click}><Codicon name={icon} /><span>{label}</span>{shortcut && <span className="menu-shortcut">{shortcut}</span>}</button>;

  return <section className="file-explorer" aria-label="Explorador de arquivos">
    <div className="explorer-title"><h2>Explorador</h2><button className="explorer-action" aria-label="Opções do explorador" title="Opções do explorador" onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); setContext({ path: '', directory: true, options: true, x: bounds.left, y: bounds.bottom }); }}><Codicon name="ellipsis" /></button></div>
    <div className="file-tree" ref={tree} role="tree" aria-label="Arquivos do workspace" onContextMenu={event => showContext(event, '', true)}>
      <div className="explorer-root-row">
        <button role="treeitem" className="explorer-root" data-path="" aria-level={1} aria-expanded={rootExpanded} aria-selected={selected === ''} tabIndex={focusPath === '' ? 0 : -1} title={props.root} onFocus={() => setSelected('')} onClick={() => { setSelected(''); setRootExpanded(!rootExpanded); }} onKeyDown={event => keyboard(event)} onContextMenu={event => showContext(event, '', true)}><Codicon name={rootExpanded ? 'chevron-down' : 'chevron-right'} /><span>{rootName}</span></button>
        <div className="explorer-actions" role="group" aria-label="Ações do explorador">
          <button className="explorer-action" title="Novo arquivo" aria-label="Novo arquivo" disabled={props.busy || props.readOnly} onClick={() => startCreate(false)}><Codicon name="new-file" /></button>
          <button className="explorer-action" title="Nova pasta" aria-label="Nova pasta" disabled={props.busy || props.readOnly} onClick={() => startCreate(true)}><Codicon name="new-folder" /></button>
          <button className="explorer-action" title="Atualizar explorador" aria-label="Atualizar explorador" disabled={props.busy} onClick={props.onRefresh}><Codicon name="refresh" /></button>
          <button className="explorer-action" title="Recolher pastas" aria-label="Recolher pastas" onClick={collapse}><Codicon name="collapse-all" /></button>
        </div>
      </div>
      {edit && !edit.path && !edit.parent && inlineInput(1)}
      {rows.map(row => {
        const { node, chain, depth } = row;
        if (edit?.path === node.path) return <div key={node.path}>{inlineInput(depth)}</div>;
        const decoration = props.decoration(node.path);
        const open = expanded.has(node.path);
        return <div className="explorer-node" key={node.path}>
          <button role="treeitem" aria-level={depth + 1} aria-expanded={node.directory ? open : undefined} aria-selected={selected === node.path} aria-label={chain.map(item => item.name).join('/')} data-path={node.path} data-git-status={decoration.git} tabIndex={focusPath === node.path ? 0 : -1} style={{ '--tree-depth': depth } as CSSProperties} className={`file-row ${node.directory ? 'directory-row' : ''} ${selected === node.path ? 'selected' : ''} ${decoration.git === 'D' ? 'file-deleted' : ''}`} title={`${node.path}${node.directory ? '' : `\n${node.owner === 'base' ? 'Branch tradicional' : node.owner ? `Layer ${node.owner}` : 'Sem proprietário'}\n${decoration.title}`}`} onFocus={() => setSelected(node.path)} onClick={() => { select(node.path); if (node.directory) toggle(node.path); else void props.onOpen(node.path); }} onKeyDown={event => keyboard(event, row)} onContextMenu={event => showContext(event, node.path, node.directory)}>
            <span className="explorer-guides" aria-hidden="true">{Array.from({ length: depth - 1 }, (_, index) => <i key={index} />)}</span>
            <span className="explorer-twistie">{node.directory && <Codicon name={open ? 'chevron-down' : 'chevron-right'} />}</span>
            <FileIcon path={node.path} directory={node.directory} expanded={open} />
            <span className="filename">{chain.map((item, index) => <span key={item.path}>{index > 0 && <span className="compact-separator"> / </span>}{item.name}</span>)}</span>
            {node.directory ? node.layers.length > 0 && props.renderLayers(node.layers.map(name => `layer/${name}`).join(', ')) : props.renderDecoration(node.path, node.owner)}
          </button>
          {edit && !edit.path && edit.parent === node.path && inlineInput(depth + 1)}
        </div>;
      })}
      {rootExpanded && !rows.length && !edit && <p className="empty-small">Esta pasta está vazia.</p>}
    </div>
    {context && <div ref={menu} className="explorer-context" role="menu" aria-label="Menu do explorador" style={{ left: Math.max(4, Math.min(context.x, window.innerWidth - 250)), top: Math.max(4, Math.min(context.y, window.innerHeight - 255)) }} onKeyDown={event => {
      const buttons = [...menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []];
      if (event.key === 'Escape') { event.preventDefault(); setContext(null); select(context.path, true); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus(); }
      else if (event.key === 'Tab') setContext(null);
    }}>
      {context.options ? <>
        <button role="menuitemcheckbox" aria-checked={compact} onClick={() => { setCompact(!compact); localStorage.setItem('gitlayers-compact-folders', String(!compact)); setContext(null); }}><Codicon name={compact ? 'check' : 'blank'} /><span>Pastas compactas</span></button>
        {action('Recolher pastas', 'collapse-all', () => { collapse(); setContext(null); })}
        {action('Atualizar explorador', 'refresh', () => { props.onRefresh(); setContext(null); })}
      </> : <>
        {context.directory ? <>{action('Novo arquivo', 'new-file', () => startCreate(false, context.path), undefined, props.readOnly || props.busy)}{action('Nova pasta', 'new-folder', () => startCreate(true, context.path), undefined, props.readOnly || props.busy)}</> : action('Abrir arquivo', 'go-to-file', () => { void props.onOpen(context.path); setContext(null); }, 'Enter')}
        <div role="separator" />
        {action('Copiar caminho relativo', 'copy', copyPath)}
        {!context.directory && <>{action('Renomear', 'edit', () => startRename(context.path), 'F2', props.readOnly || props.busy)}{action('Excluir', 'trash', () => { void props.onDelete(context.path); setContext(null); }, 'Del', props.readOnly || props.busy)}</>}
        {context.directory && action('Recolher pastas', 'collapse-all', () => { collapse(); setContext(null); })}
        {action('Atualizar explorador', 'refresh', () => { props.onRefresh(); setContext(null); })}
      </>}
    </div>}
  </section>;
}
