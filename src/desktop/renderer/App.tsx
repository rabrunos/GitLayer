import { useCallback, useEffect, useRef, useState } from 'react';
import type { Change, Draft, LayerEntry, ReadResult, RepoSnapshot, RuntimeStatus } from '../shared.js';
import { Editor, languageFor } from './Editor.js';
import { TerminalPanel } from './TerminalPanel.js';
import { explorerFiles, fileDecoration, gitStatusLetter, layerOwnership } from './file-decorations.js';

type Tab = ReadResult & { path: string; text: string; savedText: string; external?: ReadResult | null; keepDraft?: boolean };
type Modal = { title: string; detail: string; initial?: string; choices: string[]; resolve: (value: string | null) => void };
type Diff = { owner: string; path: string; staged: boolean; patch: string; token: string; hunks: { index: number; patch: string; header: string }[] };
type Capture = { id: string; layer: string; scope: string; candidates: { path: string; ignored: boolean }[] };
type Doctor = { safe: boolean; checks: { name: string; ok: boolean; detail: unknown }[]; transactions?: unknown[]; spaceBytes?: number };
const pretty = (value: unknown): string => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const ownerLabel = (owner: string | null, branch = ''): string => owner === 'base' ? `Branch ${branch}` : owner ? `Layer ${owner}` : 'Sem proprietário';
const labels: Record<string, string> = { M: 'Modificado', A: 'Novo', D: 'Removido', R: 'Renomeado', U: 'Conflito', '?': 'Novo' };
const changes = (value: unknown): Change[] => Array.isArray(value) ? value.map(v => typeof v === 'string' ? { path: v, status: 'M' } : v as Change) : [];
const branchItems = (value: unknown): { name: string; current?: boolean }[] => {
  const list = Array.isArray(value) ? value : (value as { branches?: unknown[] })?.branches ?? [];
  return list.map(v => typeof v === 'string' ? { name: v } : v as { name: string; current?: boolean });
};

export function App(): React.JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [environmentBusy, setEnvironmentBusy] = useState(false);
  const [showEnvironment, setShowEnvironment] = useState(false);
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const snapshotRef = useRef<RepoSnapshot | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const tabsRef = useRef<Tab[]>([]);
  const [active, setActive] = useState('');
  const [owner, setOwner] = useState('base');
  const [panel, setPanel] = useState<'changes' | 'history' | 'branches' | 'integrity'>('changes');
  const [diff, setDiff] = useState<Diff | null>(null);
  const [documentView, setDocumentView] = useState<{ title: string; content: string } | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [captureSelected, setCaptureSelected] = useState<string[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [history, setHistory] = useState<unknown>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('gitlayers-theme') ?? 'dark');
  const [activity, setActivity] = useState<{ time: string; action: string; result: string }[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [advancedAction, setAdvancedAction] = useState('stash-list');
  const [advancedArg, setAdvancedArg] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const draftsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshing = useRef(false);
  const closingModal = useRef<HTMLButtonElement>(null);

  const ask = useCallback((title: string, detail: string, choices: string[], initial?: string): Promise<string | null> => new Promise(resolve => {
    setModalInput(initial ?? ''); setModal({ title, detail, choices, initial, resolve });
  }), []);
  const dismissModal = (choice: string | null) => { if (modal) { modal.resolve(choice === null ? null : modal.initial === undefined ? choice : modalInput); setModal(null); } };
  const call = useCallback(async <T,>(action: string, args: unknown = {}, silent = false): Promise<T> => {
    const result = await window.lab.call(action, args);
    if (!silent) setActivity(current => [{ time: new Date().toLocaleTimeString('pt-BR'), action, result: result.ok ? 'Concluído pelo Core' : `${result.error?.code}: ${result.error?.message}` }, ...current].slice(0, 150));
    if (!result.ok) throw new Error(`${result.error?.code ?? 'ERRO'}: ${result.error?.message ?? 'Falha desconhecida'}`);
    return result.data as T;
  }, []);
  const inspectEnvironment = useCallback(async (): Promise<RuntimeStatus> => {
    setEnvironmentBusy(true);
    try {
      const result = await call<RuntimeStatus>('runtime', {}, true);
      setRuntime(result);
      if (result.startupError) setError(result.startupError);
      return result;
    } finally { setEnvironmentBusy(false); }
  }, [call]);
  const setAllTabs = useCallback((value: Tab[] | ((previous: Tab[]) => Tab[])) => {
    const result = typeof value === 'function' ? value(tabsRef.current) : value;
    tabsRef.current = result; setTabs(result);
    void window.lab.call('dirty', { count: result.filter(t => t.text !== t.savedText).length });
  }, []);
  const persistDrafts = useCallback(async () => {
    for (const tab of tabsRef.current) if (tab.text !== tab.savedText) await call('draftSave', { path: tab.path, text: tab.text, hash: tab.hash, eol: tab.eol }, true);
  }, [call]);
  const refresh = useCallback(async (checkExternal = true) => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const result = await call<RepoSnapshot>('snapshot', {}, true);
      snapshotRef.current = result; setSnapshot(result);
      setCapture(result.capture ? result.capture as Capture : null);
      if (checkExternal) {
        for (const tab of tabsRef.current) {
          try {
            const disk = await call<ReadResult>('read', { path: tab.path }, true);
            if (disk.hash !== tab.hash && disk.hash !== tab.external?.hash) setAllTabs(previous => previous.map(t => t.path === tab.path && t.hash !== disk.hash ? { ...t, external: disk } : t));
          } catch { if (tab.external !== null) setAllTabs(previous => previous.map(t => t.path === tab.path ? { ...t, external: null } : t)); }
        }
      }
    } finally { refreshing.current = false; }
  }, [call, setAllTabs]);
  const loadDrafts = useCallback(async () => {
    const recovered = await call<Draft[]>('drafts', {}, true);
    if (!recovered.length) return;
    const restored: Tab[] = [];
    for (const draft of recovered) {
      let disk: ReadResult;
      try { disk = await call<ReadResult>('read', { path: draft.path }, true); } catch { disk = { text: '', hash: '', binary: false, size: 0, eol: draft.eol }; }
      if (draft.text === disk.text) { await call('draftRemove', { path: draft.path }, true); continue; }
      restored.push({ ...disk, text: draft.text, path: draft.path, hash: draft.hash, savedText: disk.text, external: disk.hash !== draft.hash ? disk : undefined });
    }
    if (restored.length) { setAllTabs(restored); setActive(restored[0]!.path); setNotice(`${restored.length} rascunho(s) recuperado(s). Revise antes de salvar.`); }
  }, [call, setAllTabs]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('gitlayers-theme', theme);
  }, [theme]);
  useEffect(() => {
    void inspectEnvironment().then(async environment => {
      if (environment.repositoryOpen && environment.git.available) { await refresh(false); await loadDrafts(); }
    }).catch(e => setError(`Falha ao iniciar: ${String(e)}`));
    const off = window.lab.onChanged(() => { void refresh(true).catch(e => setError(String(e))); });
    const interval = setInterval(() => { if (snapshotRef.current && document.hasFocus()) void refresh(true).catch(e => setError(String(e))); }, 5000);
    const offClose = window.lab.onBeforeClose(() => { void persistDrafts().then(() => call('closeReady', {}, true)).catch(e => setError(`Não foi possível fechar preservando rascunhos: ${String(e)}`)); });
    return () => { off(); offClose(); clearInterval(interval); };
  }, [refresh, loadDrafts, persistDrafts, call, inspectEnvironment]);
  useEffect(() => { if (modal && modal.initial === undefined) closingModal.current?.focus(); }, [modal]);

  const run = async (action: string, args: unknown = {}, success = '') => {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await call(action, args);
      if (['open', 'initialize', 'demo'].includes(action)) {
        if (data === null) return null;
        await inspectEnvironment();
      }
      await refresh(true); if (success) setNotice(success); return data;
    }
    catch (e) { setError(String(e)); return undefined; }
    finally { setBusy(false); }
  };
  const saveTab = useCallback(async (p: string): Promise<boolean> => {
    const tab = tabsRef.current.find(t => t.path === p);
    if (!tab || tab.binary || tab.readOnly) return false;
    if (tab.external !== undefined) { setError('O arquivo mudou no disco. Compare e recarregue ou mantenha o rascunho antes de salvar.'); return false; }
    try {
      await call('write', { path: p, text: tab.text, hash: tab.hash });
      const disk = await call<ReadResult>('read', { path: p }, true);
      setAllTabs(previous => previous.map(t => t.path === p ? { ...disk, path: p, savedText: disk.text, text: disk.text } : t));
      await call('draftRemove', { path: p }, true); await refresh(false);
      return true;
    } catch (e) { setError(String(e)); return false; }
  }, [call, refresh, setAllTabs]);
  const safeBuffers = async (_affected?: string[]): Promise<boolean> => {
    await persistDrafts();
    const unsaved = tabsRef.current.filter(t => t.text !== t.savedText);
    if (!unsaved.length) return true;
    const answer = await ask('Há alterações não salvas', `Salve ${unsaved.length} arquivo(s) no disco para continuar. O rascunho de recuperação já foi preservado.`, ['Salvar e continuar']);
    if (!answer) return false;
    for (const tab of unsaved) if (!(await saveTab(tab.path))) return false;
    return true;
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (active) void saveTab(active); }
      if ((e.ctrlKey || e.metaKey) && e.key === '`' && snapshotRef.current) { e.preventDefault(); setShowTerminal(current => !current); }
      if (e.key === 'Escape' && modal) { e.preventDefault(); modal.resolve(null); setModal(null); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [active, saveTab, modal]);
  const editTab = (p: string, value: string) => {
    setAllTabs(previous => previous.map(t => t.path === p ? { ...t, text: value } : t));
    if (draftsTimer.current) clearTimeout(draftsTimer.current);
    draftsTimer.current = setTimeout(() => { void persistDrafts().catch(e => setError(`Falha ao preservar rascunho: ${String(e)}`)); }, 180);
  };
  const openFile = async (p: string) => {
    setDiff(null); setDocumentView(null); setActive(p);
    if (tabsRef.current.some(t => t.path === p)) return;
    try { const file = await call<ReadResult>('read', { path: p }, true); setAllTabs(previous => [...previous, { ...file, path: p, savedText: file.text }]); }
    catch (e) { setError(String(e)); }
  };
  const closeTab = async (p: string) => {
    if (!(await safeBuffers([p]))) return;
    setAllTabs(previous => previous.filter(t => t.path !== p));
    await call('draftRemove', { path: p }, true);
    if (active === p) setActive(tabsRef.current.at(-1)?.path ?? '');
  };
  const openRepo = async (initialize = false) => {
    if (!(await safeBuffers())) return;
    setShowTerminal(false);
    const result = await run(initialize ? 'initialize' : 'open');
    if (result) { setAllTabs([]); setActive(''); setOwner('base'); setDiff(null); setDocumentView(null); await loadDrafts(); }
  };
  const openDemo = async () => {
    if (!(await safeBuffers())) return;
    setShowTerminal(false);
    const result = await run('demo', {}, 'Demonstração local criada: main, dev, collision-demo, Layer ai e Layer scripts. Nenhum script foi executado.');
    if (result) { setAllTabs([]); setActive(''); setOwner('base'); setDiff(null); setDocumentView(null); }
  };
  const createPath = async (directory: boolean) => {
    const p = await ask(directory ? 'Nova pasta' : 'Novo arquivo', 'Caminho relativo ao repositório. Arquivos novos seguem o fluxo da branch tradicional até atribuição explícita.', ['Criar'], '');
    if (!p) return;
    if (snapshot?.files.some(f => f.path === p)) { setError('Esse caminho já existe.'); return; }
    if (directory) await run('mkdir', { path: p });
    else { const result = await run('write', { path: p, text: '' }); if (result !== undefined) await openFile(p); }
  };
  const mutateFile = async (action: 'rename' | 'delete', p: string) => {
    if (!(await safeBuffers([p]))) return;
    if (action === 'rename') {
      const to = await ask('Renomear arquivo', 'O proprietário permanece o mesmo. O Core recusa mudança entre origens.', ['Renomear'], p);
      if (!to || to === p) return;
      if (await run('rename', { from: p, to }) !== undefined) { setAllTabs(previous => previous.filter(t => t.path !== p)); await openFile(to); }
    } else if (await ask('Excluir arquivo?', `${p}\nSerá criada uma cópia de recuperação antes da remoção. Prepare a exclusão no grupo do proprietário.`, ['Excluir com cópia'])) {
      if (await run('delete', { path: p, confirmed: true }) !== undefined) { setAllTabs(previous => previous.filter(t => t.path !== p)); if (active === p) setActive(''); }
    }
  };
  const loadDiff = async (group: string, p: string, staged = false) => {
    try {
      const patch = await call<string>('diff', { owner: group, staged, paths: [p] });
      let hunks: Diff['hunks'] = []; let token = '';
      try { const result = await call<{ token: string; hunks: Diff['hunks'] }>('hunks', { owner: group, path: p, staged }, true); hunks = result.hunks; token = result.token; } catch { /* Whole-file staging remains explicit when partial staging is unsupported. */ }
      setDiff({ owner: group, path: p, staged, patch: pretty(patch), token, hunks }); setDocumentView(null);
    } catch (e) { setError(String(e)); }
  };
  const stage = async (group: string, p: string, unstage = false) => { await run(unstage ? 'unstage' : 'stage', { owner: group, paths: [p] }); if (diff?.path === p) await loadDiff(group, p, unstage ? false : diff.staged); };
  const restore = async (group: string, p: string) => {
    if (!(await safeBuffers([p]))) return;
    if (await ask('Restaurar a partir do índice?', `Descartar alterações no disco de ${p}? O staging permanece. Uma cópia de recuperação será preservada.`, ['Restaurar com cópia'])) await run('restore', { owner: group, paths: [p], confirmed: true });
  };
  const createLayer = async () => { const name = await ask('Criar Layer independente', 'Uma branch layer/<nome> será criada com commit raiz de árvore vazia, sem pai na branch tradicional.', ['Criar Layer'], ''); if (name) await run('createLayer', { name }); };
  const deactivate = async (layer: LayerEntry) => {
    if (!(await safeBuffers(snapshot?.files.filter(f => f.owner === layer.name).map(f => f.path)))) return;
    if (await ask(`Desativar Layer ${layer.name}?`, 'Arquivos próprios sairão do diretório. Se houver alterações, o índice, os bytes locais e as reservas serão guardados separadamente. A branch e o histórico continuam existindo.', ['Guardar e desativar'])) await run('deactivate', { name: layer.name, park: true });
  };
  const startCapture = async () => { if (owner === 'base') return; const scope = await ask('Capturar novos arquivos', 'A sessão registra os caminhos que já existem. Crie arquivos no editor ou fora dele e clique em Revisar. Nenhum destino permanente será definido.', ['Iniciar'], ''); if (scope !== null) { const result = await run('captureStart', { name: owner, scope }); if (result !== undefined) { setCapture({ id: '', layer: owner, scope, candidates: [] }); setNotice('Captura iniciada. Crie os arquivos e clique em Revisar captura.'); } } };
  const reviewCapture = async () => { const result = await run('captureReview'); if (result) { const data = result as Capture; setCapture(data); setCaptureSelected(data.candidates.filter(c => !c.ignored).map(c => c.path)); } };
  const showHistory = async () => { setPanel('history'); const result = await run('log', { owner }); if (result !== undefined) setHistory(result); };
  const checkIntegrity = async (fsck = false) => { setPanel('integrity'); const result = await run('doctor', { fsck }); if (result) setDoctor(result as Doctor); };
  const switchBranch = async (name: string) => { if (!(await safeBuffers())) return; await run('switch', { name }); };
  const configureIdentity = async () => {
    const name = await ask('Identidade local — nome', 'Será gravada somente na configuração deste repositório. A identidade é necessária para commits.', ['Continuar'], ''); if (!name) return;
    const email = await ask('Identidade local — e-mail', `Nome: ${name}. Confirme para gravar user.name e user.email somente neste repositório.`, ['Autorizar configuração local'], ''); if (email) await run('identity', { name, email, consent: true }, 'Identidade local configurada.');
  };
  const currentTab = tabs.find(t => t.path === active);
  const base = snapshot?.status?.base ?? { staged: [], unstaged: [] };
  const layerGroup = snapshot?.status?.layers?.find(l => l.name === owner) ?? { staged: [], unstaged: [] };
  const group = owner === 'base' ? base : layerGroup;
  const selectedLayer = snapshot?.layers.find(l => l.name === owner);
  const changeCount = changes(base.staged).length + changes(base.unstaged).length + (snapshot?.status?.layers ?? []).reduce((n, l) => n + changes(l.staged).length + changes(l.unstaged).length, 0);
  const visibleFiles = explorerFiles(snapshot);
  const decorationFor = (p: string) => fileDecoration(p, snapshot?.status, tabs.some(tab => tab.path === p && tab.text !== tab.savedText));
  const renderLayerIcon = (label: string) => <span className="file-layer-icon" role="img" aria-label={label} title={label}><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 10 5-10 5L2 8Z" /><path d="m2 12 10 5 10-5M2 16l10 5 10-5" /></svg></span>;
  const renderDecoration = (p: string, fileOwner: string | null) => {
    const decoration = decorationFor(p); const ownership = layerOwnership(fileOwner);
    return <span className="file-decorations">{decoration.bufferDirty && <span className="buffer-dirty" role="img" aria-label="Não salvo no editor" title="Não salvo no editor · ainda não altera o estado Git">●</span>}{decoration.git && <span className={`git-decoration git-${decoration.git === '!' ? 'conflict' : decoration.git}`} title={decoration.title} aria-label={`Git ${decoration.git}: ${decoration.title}`}>{decoration.git}</span>}{ownership && renderLayerIcon(ownership)}</span>;
  };
  const directories = new Map<string, Set<string | null>>();
  for (const directory of snapshot?.directories ?? []) directories.set(directory, new Set());
  for (const file of visibleFiles) {
    const pieces = file.path.split('/');
    for (let i = 1; i < pieces.length; i++) { const dir = pieces.slice(0, i).join('/'); const owners = directories.get(dir) ?? new Set(); owners.add(file.owner); directories.set(dir, owners); }
  }
  const tree = [...[...directories].map(([path, owners]) => ({ path, directory: true, owner: owners.size === 0 ? null : owners.size === 1 ? [...owners][0] ?? null : 'Misto' })), ...visibleFiles.map(file => ({ ...file, directory: false }))].sort((a, b) => a.path.localeCompare(b.path));
  const directoryLayers = (p: string) => [...directories.get(p) ?? []].filter((name): name is string => name !== null && name !== 'base').map(name => `Layer ${name}`).join(', ');
  const renderChanges = (heading: string, list: Change[], staged: boolean, groupOwner = owner) => <section className="change-section"><h3>{heading}<span>{list.length}</span></h3>{!list.length && <p className="empty-small">Nenhum arquivo</p>}{list.map((item, i) => <div className="change-row" key={`${item.path}-${i}`}>
    <button className="change-name" onClick={() => void loadDiff(groupOwner, item.path, staged)} title={`Ver diff de ${item.path}`}><span className={`status-letter git-decoration git-${gitStatusLetter(item.status) === '!' ? 'conflict' : gitStatusLetter(item.status)}`}>{gitStatusLetter(item.status || 'M')}</span><span>{item.path}<small>{labels[item.status] ?? item.status}{!staged && changes(group.staged).some(c => c.path === item.path) ? ' após stage' : ''}</small></span></button>
    <button className="small" onClick={() => void stage(groupOwner, item.path, staged)} title={staged ? 'Desfazer staging' : 'Preparar arquivo'} aria-label={`${staged ? 'Unstage' : 'Stage'} ${item.path}`}>{staged ? '−' : '+'}</button>
    {!staged && <button className="small" onClick={() => void restore(groupOwner, item.path)} title="Restaurar disco a partir do índice" aria-label={`Restaurar ${item.path}`}>↶</button>}
  </div>)}</section>;

  const canOpenRepository = runtime?.git.available === true && !busy && !environmentBusy;
  const environmentPanel = <section className={`runtime-card ${runtime?.git.available ? 'git-ready' : 'git-missing'}`} data-testid="runtime-status" aria-label="Ambiente e Git instalado">
    <div className="runtime-heading"><strong>{environmentBusy || !runtime ? 'Verificando o Git local…' : runtime.git.available ? '✓ Git local encontrado' : 'Git precisa de atenção'}</strong><button disabled={environmentBusy} onClick={() => void inspectEnvironment().catch(e => setError(String(e)))}>↻ Verificar Git</button></div>
    {runtime && <><dl><div><dt>Distribuição preparada</dt><dd>{runtime.target} · v{runtime.appVersion}</dd></div><div><dt>Execução atual</dt><dd>{({ win32: 'Windows', linux: 'Linux', darwin: 'macOS' } as Record<string, string>)[runtime.platform] ?? runtime.platform} {runtime.arch}{runtime.packaged ? ' · aplicativo portátil' : ' · código-fonte'}</dd></div>{runtime.git.version && <><div><dt>Versão do Git</dt><dd>{runtime.git.version}</dd></div><div><dt>Executável do Git</dt><dd className="runtime-path">{runtime.git.executable}</dd></div></>}</dl>{!runtime.git.available && <div className="runtime-help" role="alert"><p>Instale o <strong>Git for Windows</strong> pelo site oficial <code>git-scm.com</code>. Na instalação, mantenha a opção que permite usar o Git em outros programas (PATH).</p><p>Depois, feche e abra novamente o Git Layers Lab. Se o Git já estava instalado, clique em <strong>Verificar Git</strong>. O editor portátil já inclui seu próprio runtime; Node.js e npm não são necessários.</p>{runtime.git.error && <details><summary>Detalhes do diagnóstico</summary><p>{runtime.git.error}</p></details>}</div>}</>}
  </section>;

  return <div className="app" data-testid={snapshot ? 'workspace' : 'welcome'}>
    <header className="topbar">
      <div className="brand"><span className="brand-symbol">◫</span><strong>Git Layers<span> LAB</span></strong><span className="experimental">v0.1 · experimental</span></div>
      <div className="top-actions"><button data-testid="open" disabled={!canOpenRepository} onClick={() => void openRepo()}>Abrir pasta</button><button data-testid="initialize" disabled={!canOpenRepository} onClick={() => snapshot ? void run('enableLayers', {}, 'Metadados locais de Git Layers inicializados.') : void openRepo(true)}>{snapshot ? 'Inicializar Layers' : 'Inicializar Git'}</button><button disabled={!canOpenRepository} onClick={() => void openDemo()}>Demonstração</button><button data-testid="terminal-toggle" disabled={!snapshot} onClick={() => setShowTerminal(current => !current)} aria-expanded={showTerminal}>›_ Terminal</button><button onClick={() => setShowEnvironment(!showEnvironment)} aria-expanded={showEnvironment}>Ambiente</button><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Alternar tema">{theme === 'dark' ? '☀ Claro' : '◐ Escuro'}</button></div>
    </header>
    {snapshot && showEnvironment && <div className="environment-strip">{environmentPanel}</div>}
    {snapshot ? <>
      <div className="repo-bar"><span className="repo-path" title={snapshot.repo.root}>{snapshot.repo.root}</span><span className="branch-chip">⑂ {snapshot.repo.branch || 'Sem primeiro commit'}</span><span>{snapshot.layers.filter(l => l.state === 'active').length} Layer(s) ativa(s)</span><button className={`safety ${doctor ? doctor.safe ? 'safe' : 'unsafe' : ''}`} onClick={() => void checkIntegrity()}>{snapshot.status.safe === false ? '⚠ Estado inseguro / inicialização pendente' : doctor ? doctor.safe ? '✓ Verificação aprovada' : '⚠ Requer atenção' : '◇ Integridade não verificada'}</button><button disabled={busy} onClick={() => void run('snapshot')}>↻ Atualizar</button></div>
      {snapshot.status.error?.code === 'NOT_INITIALIZED' && <div className="external-warning"><strong>Este repositório está aberto para inspeção.</strong> Inicialize os metadados locais para editar, preparar e usar Layers. <button onClick={() => void run('enableLayers')}>Inicializar Layers neste repositório</button></div>}
      <main className="workspace">
        <aside className="explorer"><div className="section-heading"><h2>Explorador</h2><div><button className="small" title="Novo arquivo" aria-label="Novo arquivo" onClick={() => void createPath(false)}>＋</button><button className="small" title="Nova pasta" aria-label="Nova pasta" onClick={() => void createPath(true)}>▤</button></div></div>
          <div className="file-tree">{!tree.length && <p className="empty-small">Crie um arquivo para começar.</p>}{tree.map(file => file.directory ? <div className="directory" key={file.path} style={{ paddingLeft: `${12 + file.path.split('/').length * 9}px` }}><span>▾ {file.path.split('/').pop()}</span>{directoryLayers(file.path) && renderLayerIcon(directoryLayers(file.path))}</div> : <button key={file.path} className={`file-row ${active === file.path && !diff ? 'selected' : ''} ${decorationFor(file.path).git.includes('D') ? 'file-deleted' : ''}`} data-git-status={decorationFor(file.path).git} style={{ paddingLeft: `${12 + file.path.split('/').length * 9}px` }} onClick={() => void openFile(file.path)} title={`${file.path}\n${ownerLabel(file.owner, snapshot.repo.branch)}\n${decorationFor(file.path).title}`}><span className="file-icon">◇</span><span className="filename">{file.path.split('/').pop()}</span>{renderDecoration(file.path, file.owner)}</button>)}</div>
          <div className="section-heading layers-heading"><h2>Layers</h2><button className="small" onClick={() => void createLayer()} title="Criar Layer" aria-label="Criar Layer">＋</button></div>
          <div className="layers-list"><button className={`layer-item ${owner === 'base' ? 'selected' : ''}`} onClick={() => { setOwner('base'); setPanel('changes'); }}><span>⑂</span><div><strong>{snapshot.repo.branch || 'Branch tradicional'}</strong><small>Branch tradicional · HEAD real</small></div></button>{snapshot.layers.map(layer => <div className={`layer-card ${owner === layer.name ? 'selected' : ''}`} key={layer.id}><button className="layer-item" onClick={() => { setOwner(layer.name); setPanel('changes'); }}><span>◫</span><div><strong>{layer.name}</strong><small>{({ active: 'Ativa', inactive: 'Inativa', parked: 'Guardada localmente', 'recovery-required': 'Recuperação necessária' } as Record<string, string>)[layer.state] ?? layer.state}</small></div></button><button className="small layer-toggle" title={layer.state === 'active' ? 'Desativar e guardar' : 'Ativar Layer'} aria-label={`${layer.state === 'active' ? 'Desativar' : 'Ativar'} Layer ${layer.name}`} disabled={busy || layer.state === 'recovery-required'} onClick={() => layer.state === 'active' ? void deactivate(layer) : void run('activate', { name: layer.name })}>{layer.state === 'active' ? '◉' : '○'}</button></div>)}</div>
          {snapshot.candidates?.length > 0 && <div className="candidates"><h3>Branches candidatas</h3>{snapshot.candidates.map(name => <button key={name} onClick={async () => { if (await ask('Registrar Layer existente?', `${name} será validada antes do registro. O prefixo sozinho não autoriza ativação.`, ['Validar e registrar'])) await run('registerLayer', { name }); }}>{name} · Registrar</button>)}</div>}
          <p className="sidebar-note">Selecionar uma Layer inspeciona seu histórico. Arquivos mantêm seus proprietários.</p>
        </aside>
        <section className="center">
          <div className="tabs" role="tablist" aria-label="Arquivos abertos">{tabs.map(tab => <div key={tab.path} className={`tab ${active === tab.path && !diff && !documentView ? 'active' : ''}`}><button role="tab" title={`${tab.path}\n${decorationFor(tab.path).title}`} aria-selected={active === tab.path && !diff && !documentView} onClick={() => { setActive(tab.path); setDiff(null); setDocumentView(null); }}>{tab.path.split('/').pop()}{renderDecoration(tab.path, visibleFiles.find(file => file.path === tab.path)?.owner ?? null)}</button><button aria-label={`Fechar ${tab.path}`} onClick={() => void closeTab(tab.path)}>×</button></div>)}{diff && <div className="tab active"><button>Diff · {diff.path}</button><button aria-label="Fechar diff" onClick={() => setDiff(null)}>×</button></div>}{documentView && <div className="tab active"><button>{documentView.title}</button><button aria-label="Fechar visualização" onClick={() => setDocumentView(null)}>×</button></div>}</div>
          {documentView ? <Editor path={`view:${documentView.title}`} text={documentView.content} language="diff" theme={theme} readOnly /> : diff ? <>
            <div className="editor-toolbar"><span>{ownerLabel(diff.owner, snapshot.repo.branch)} · {diff.staged ? 'Commit → índice' : 'Índice → disco'}</span><button onClick={() => void stage(diff.owner, diff.path, diff.staged)}>{diff.staged ? 'Desfazer staging do arquivo' : 'Preparar arquivo inteiro'}</button></div>
            <div className="diff-content"><Editor path={`diff:${diff.owner}:${diff.path}:${diff.staged}`} text={diff.patch || 'Nenhuma diferença.'} theme={theme} language="diff" readOnly />{<div className="hunks"><h3>{diff.staged ? 'Desfazer staging parcial' : 'Staging parcial'}</h3>{diff.hunks.length ? diff.hunks.map(hunk => <article key={hunk.index}><div><code>{hunk.header}</code><button disabled={busy} onClick={async () => { await run(diff.staged ? 'unstageHunk' : 'stageHunk', { owner: diff.owner, path: diff.path, index: hunk.index, token: diff.token }); await loadDiff(diff.owner, diff.path, diff.staged); }}>{diff.staged ? 'Despreparar' : 'Preparar'} hunk {hunk.index + 1}</button></div><pre>{hunk.patch}</pre></article>) : <p>Sem hunks suportados. Binários, adições, exclusões ou mudanças de modo podem exigir o arquivo inteiro.</p>}</div>}</div>
          </> : currentTab ? <>
            <div className="editor-toolbar"><span title={currentTab.path}>{currentTab.path}</span><div><button disabled={busy || currentTab.binary || currentTab.readOnly || currentTab.text === currentTab.savedText} onClick={() => void saveTab(currentTab.path)}>Salvar <kbd>Ctrl S</kbd></button><button onClick={() => void mutateFile('rename', currentTab.path)}>Renomear</button><button onClick={() => void mutateFile('delete', currentTab.path)}>Excluir</button></div></div>
            {currentTab.external !== undefined && <div className="external-warning"><strong>Arquivo alterado fora do editor{currentTab.external === null ? ' ou removido' : ''}.</strong><div><button onClick={() => setDocumentView({ title: `Comparação externa · ${currentTab.path}`, content: `--- Rascunho do editor\n${currentTab.text}\n\n+++ Versão atual no disco\n${currentTab.external?.text ?? '(arquivo ausente)'}` })}>Comparar</button><button onClick={async () => { await persistDrafts(); const ext = currentTab.external; if (ext) setAllTabs(previous => previous.map(t => t.path === currentTab.path ? { ...ext, path: t.path, text: ext.text, savedText: ext.text } : t)); else { setAllTabs(previous => previous.filter(t => t.path !== currentTab.path)); setActive(''); } }}>Recarregar e preservar rascunho</button><button onClick={async () => { await persistDrafts(); setAllTabs(previous => previous.map(t => t.path === currentTab.path ? { ...t, keepDraft: true } : t)); setNotice('Rascunho mantido. Compare ou recarregue antes de salvar sobre a versão externa.'); }}>Manter rascunho</button></div></div>}
            {currentTab.binary ? <div className="empty-state"><span>◈</span><h2>Arquivo binário</h2><p>{currentTab.size.toLocaleString('pt-BR')} bytes · Não editável como texto.</p><p>Use o painel de versão para preparar o arquivo inteiro.</p></div> : <><Editor path={currentTab.path} text={currentTab.text} eol={currentTab.eol} theme={theme} readOnly={currentTab.readOnly || snapshot.status.error?.code === 'NOT_INITIALIZED'} onChange={value => editTab(currentTab.path, value)} />{currentTab.readOnly && <p className="inline-warning">Arquivo grande ou encoding não suportado: somente leitura.</p>}</>}
          </> : <div className="empty-state"><span className="empty-logo">◫</span><h1>Um diretório. Históricos independentes.</h1><p>Abra um arquivo no explorador para editar.<br />Inspecione cada proprietário no painel de versão.</p><div className="empty-shortcuts"><span><kbd>Ctrl S</kbd> Salvar arquivo</span><span><kbd>Ctrl F</kbd> Buscar no editor</span><span><kbd>Ctrl H</kbd> Substituir</span></div></div>}
          <div className="editor-status"><span>{currentTab && !diff ? `${languageFor(currentTab.path)} · UTF-8 · ${currentTab.eol === '\r\n' || currentTab.eol === 'CRLF' ? 'CRLF' : 'LF'}${currentTab.text !== currentTab.savedText ? ' · Não salvo no editor' : ''}` : 'Git local real · sem conexão remota'}</span><span>{busy ? 'Operação em andamento…' : `${changeCount} mudança(s) no disco/índice`}</span></div>
        </section>
        <aside className="version-panel"><nav className="panel-nav" aria-label="Painel Git"><button className={panel === 'changes' ? 'active' : ''} onClick={() => setPanel('changes')}>Mudanças</button><button className={panel === 'history' ? 'active' : ''} onClick={() => void showHistory()}>Histórico</button><button className={panel === 'branches' ? 'active' : ''} onClick={() => setPanel('branches')}>Branches</button><button className={panel === 'integrity' ? 'active' : ''} onClick={() => void checkIntegrity()}>Integridade</button></nav>
          {panel === 'changes' && <div className="panel-scroll"><div className="version-title"><h2>{owner === 'base' ? 'Branch tradicional' : `Layer ${owner}`}</h2><small>{owner === 'base' ? snapshot.repo.branch : selectedLayer?.state}</small></div><div className="group-tabs"><button className={owner === 'base' ? 'selected' : ''} onClick={() => setOwner('base')}>Base</button>{snapshot.layers.map(layer => <button key={layer.id} className={owner === layer.name ? 'selected' : ''} onClick={() => setOwner(layer.name)}>{layer.name}</button>)}</div>
            {owner !== 'base' && selectedLayer?.state !== 'active' && <p className="inline-warning">Ative esta Layer para alterar staging e arquivos.</p>}
            <form className="commit-form" onSubmit={async e => { e.preventDefault(); if (!commitMessage.trim()) return; if (await run('commit', { owner, message: commitMessage }, 'Commit criado no histórico indicado.') !== undefined) setCommitMessage(''); }}><textarea value={commitMessage} onChange={e => setCommitMessage(e.target.value)} placeholder={`Mensagem para ${owner === 'base' ? snapshot.repo.branch : `Layer ${owner}`}`} aria-label="Mensagem de commit" rows={3} /><button className="primary" disabled={busy || !commitMessage.trim() || (owner !== 'base' && selectedLayer?.state !== 'active')}>{owner === 'base' ? `Commit na ${snapshot.repo.branch || 'branch'}` : `Commit na Layer ${owner}`}</button></form>
            {renderChanges('Preparados', changes(group.staged), true)}{renderChanges('No disco', changes(group.unstaged), false)}
            <section className="change-section"><h3>Não rastreados <span>{snapshot.status?.untracked?.length ?? 0}</span></h3><p className="subtle">Arquivos sem proprietário. Stage normal vai para a base.</p>{(snapshot.status?.untracked ?? []).map(p => <div className="change-row" key={p}><button className="change-name" onClick={() => void openFile(p)}><span className="status-letter git-decoration git-U" title="Não rastreado pelo Git">U</span><span>{p}</span></button><button className="small" aria-label={`Stage na base ${p}`} title="Preparar na branch tradicional" onClick={() => void stage('base', p)}>+</button>{owner !== 'base' && selectedLayer?.state === 'active' && <button className="small" aria-label={`Atribuir ${p} à Layer ${owner}`} title={`Atribuir e preparar explicitamente na Layer ${owner}`} onClick={async () => { if (await ask(`Atribuir à Layer ${owner}?`, `${p} receberá uma reserva de propriedade e será preparado somente nesta Layer. Criar ou selecionar uma Layer não atribui arquivos automaticamente.`, ['Atribuir e preparar'])) await stage(owner, p); }}>◫</button>}</div>)}</section>
            {owner !== 'base' && selectedLayer?.state === 'active' && <div className="layer-tools"><button onClick={() => void startCapture()}>Capturar novos arquivos</button><button onClick={() => void reviewCapture()}>Revisar captura</button>{capture && <button onClick={() => void run('captureCancel').then(() => { setCapture(null); setNotice('Captura cancelada. Arquivos físicos preservados.'); })}>Cancelar captura</button>}</div>}
            <button className="link-button" onClick={() => void configureIdentity()}>Configurar identidade local</button>
          </div>}
          {panel === 'history' && <div className="panel-scroll"><h2>Histórico · {owner === 'base' ? snapshot.repo.branch : owner}</h2><button onClick={async () => { const from = await ask('Comparar revisões', 'Informe a revisão inicial (OID, branch ou tag local).', ['Continuar'], 'HEAD~1'); if (!from) return; const to = await ask('Comparar revisões', `Comparar ${from} com:`, ['Comparar'], 'HEAD'); if (!to) return; const result = await run('compare', { from, to }); if (result !== undefined) setDocumentView({ title: `${from} → ${to}`, content: pretty(result) }); }}>Comparar revisões</button><div className="history-items">{Array.isArray(history) ? history.map((entry, i) => { const e = entry as Record<string, unknown>; const oid = String(e.oid ?? e.hash ?? e.commit ?? ''); return <button className="history-item" key={oid || i} onClick={async () => { const result = await run('show', { rev: oid }); if (result !== undefined) setDocumentView({ title: `Commit ${oid.slice(0, 8)}`, content: pretty(result) }); }}><strong>{String(e.subject ?? e.message ?? '(sem mensagem)')}</strong><small>{oid.slice(0, 10)} · {String(e.author ?? '')}</small></button>; }) : <pre>{pretty(history)}</pre>}</div></div>}
          {panel === 'branches' && <div className="panel-scroll"><h2>Branches tradicionais</h2><p className="subtle">Trocas validam a composição antes de alterar o workspace.</p><button onClick={async () => { const name = await ask('Criar branch tradicional', 'A branch será criada a partir do HEAD atual.', ['Criar'], ''); if (name) await run('branchCreate', { name }); }}>＋ Criar branch</button>{branchItems(snapshot.branches).filter(b => !b.name?.startsWith('layer/')).map(branch => <div className="branch-row" key={branch.name}><strong>{branch.name === snapshot.repo.branch ? '● ' : '⑂ '}{branch.name}</strong>{branch.name !== snapshot.repo.branch && <div><button disabled={busy} onClick={() => void switchBranch(branch.name)}>Trocar</button><button onClick={async () => { if (await ask('Excluir branch?', `${branch.name}. Somente histórico integrado pode ser excluído. A branch atual nunca será removida.`, ['Excluir com segurança'])) await run('branchDelete', { name: branch.name }); }}>Excluir</button></div>}</div>)}<button className="link-button" onClick={() => setShowAdvanced(!showAdvanced)}>Operações Git complementares</button>{showAdvanced && <form className="advanced" onSubmit={async e => { e.preventDefault(); if (!(await safeBuffers())) return; const result = await run('advanced', { action: advancedAction, args: advancedArg ? [advancedArg] : [] }); if (result !== undefined) setDocumentView({ title: advancedAction, content: pretty(result) }); }}><p className="inline-warning">Somente a listagem de stash está implementada. Amend, tags, stash de escrita, merge, cherry-pick e revert permanecem indisponíveis na v0.1.</p><select value={advancedAction} onChange={e => setAdvancedAction(e.target.value)} aria-label="Operação avançada">{['tag', 'tag-delete', 'amend', 'stash', 'stash-list', 'stash-pop', 'merge', 'merge-continue', 'merge-abort', 'cherry-pick', 'cherry-pick-continue', 'cherry-pick-abort', 'revert', 'revert-continue', 'revert-abort'].map(action => <option key={action} disabled={action !== 'stash-list'}>{action}{action !== 'stash-list' ? ' · não implementado' : ''}</option>)}</select><input value={advancedArg} onChange={e => setAdvancedArg(e.target.value)} aria-label="Argumento da operação avançada" placeholder="Nome, revisão ou mensagem" /><button disabled={busy}>Executar operação local</button></form>}</div>}
          {panel === 'integrity' && <div className="panel-scroll"><h2>Verificar integridade</h2><p className="subtle">Evidências do Git e dos metadados locais.</p><div className="button-row"><button disabled={busy} onClick={() => void checkIntegrity()}>Verificar</button><button disabled={busy} onClick={() => void checkIntegrity(true)}>Incluir git fsck</button></div>{doctor && <><div className={`diagnostic-summary ${doctor.safe ? 'safe' : 'unsafe'}`}>{doctor.safe ? '✓ Verificações aprovadas' : '⚠ Composição requer atenção'}</div>{doctor.checks?.map((check, i) => <article className="check" key={i}><strong>{check.ok ? '✓' : '⚠'} {check.name}</strong><pre>{pretty(check.detail)}</pre></article>)}{doctor.spaceBytes !== undefined && <p>{doctor.spaceBytes.toLocaleString('pt-BR')} bytes em recuperação local</p>}<pre className="diagnostic-json">{pretty(doctor)}</pre></>}<button onClick={() => void run('recover').then(() => checkIntegrity())}>Recuperar operação interrompida</button><button onClick={() => void run('exportRecovery')}>Exportar cópias de recuperação</button></div>}
        </aside>
      </main>
      <TerminalPanel key={snapshot.repo.root} repoRoot={snapshot.repo.root} owner={owner} layers={snapshot.layers.map(layer => layer.name)} branch={snapshot.repo.branch} theme={theme} visible={showTerminal} onHide={() => setShowTerminal(false)} />
      {capture && <div className="capture-bar"><span>◉ Captura · Layer <strong>{capture.layer}</strong>{capture.scope ? ` · ${capture.scope}` : ''}</span><button onClick={() => void reviewCapture()}>Finalizar observação e revisar</button><button onClick={() => void run('captureCancel').then(() => setCapture(null))}>Cancelar</button>{capture.candidates.length > 0 && <div className="capture-review"><h3>Revisar candidatos novos</h3><p>Ignorados exigem seleção explícita. Confirmar atribui e prepara; não faz commit.</p>{capture.candidates.map(candidate => <label key={candidate.path}><input type="checkbox" checked={captureSelected.includes(candidate.path)} onChange={e => setCaptureSelected(previous => e.target.checked ? [...previous, candidate.path] : previous.filter(p => p !== candidate.path))} />{candidate.path}{candidate.ignored && <strong> · Ignorado/gerado</strong>}</label>)}<button className="primary" disabled={busy || !captureSelected.length} onClick={async () => { if (await run('captureConfirm', { paths: captureSelected }, 'Arquivos selecionados atribuídos e preparados.') !== undefined) setCapture(null); }}>Confirmar {captureSelected.length} arquivo(s)</button></div>}</div>}
    </> : <main className="welcome"><div className="welcome-mark">◫</div><p className="eyebrow">LABORATÓRIO DE VERSIONAMENTO LOCAL</p><h1>Arquivos juntos.<br />Históricos independentes.</h1><p>Um editor simples e Git real, com branches tradicionais<br />e Layers complementares no mesmo diretório.</p><div className="welcome-buttons"><button className="primary" disabled={!canOpenRepository} onClick={() => void openRepo()}>Abrir pasta</button><button disabled={!canOpenRepository} onClick={() => void openRepo(true)}>Inicializar pasta com Git</button><button disabled={!canOpenRepository} onClick={() => void openDemo()}>Criar demonstração</button></div>{environmentPanel}<p className="welcome-note">Use repositórios de teste. A v0.1 adota políticas conservadoras e preserva cópias para recuperação. Nenhuma conta ou rede é necessária para operar.</p></main>}
    {(error || notice) && <div role={error ? 'alert' : 'status'} className={`message ${error ? 'error' : 'notice'}`}><span>{error || notice}</span><button aria-label="Fechar mensagem" onClick={() => { setError(''); setNotice(''); }}>×</button></div>}
    <footer className="statusbar"><span>◫ Git Layers Lab <span className="status-separator">|</span> {snapshot ? 'Workspace local' : 'Nenhum repositório aberto'}</span><button className="runtime-status-button" title={runtime?.git.executable ?? 'Verificar instalação do Git'} onClick={() => setShowEnvironment(!showEnvironment)}>{runtime?.git.available ? runtime.git.version : environmentBusy ? 'Verificando Git…' : 'Git indisponível'}</button><button disabled={!snapshot} onClick={() => setShowTerminal(current => !current)}>›_ Terminal {showTerminal ? '▾' : '▴'}</button><button onClick={() => setShowActivity(!showActivity)}>{busy ? '◌ Executando' : '✓ Pronto'} · Atividade {showActivity ? '▾' : '▴'}</button></footer>
    {showActivity && <section className="activity"><div className="section-heading"><h2>Atividade · Git real e Core</h2><button onClick={() => setShowActivity(false)}>Fechar</button></div>{!activity.length && !snapshot?.gitActivity?.length && <p>Nenhuma operação nesta sessão.</p>}{[...(snapshot?.gitActivity ?? [])].reverse().map((item, i) => <div className="activity-row git-command" key={`git-${i}`}><time>{new Date(item.at).toLocaleTimeString('pt-BR')}</time><code>{item.command.join(' ')}</code><span>saída {item.code} · {item.durationMs} ms{item.stderr ? ` · ${item.stderr.slice(0, 800)}` : ''}</span></div>)}{activity.map((item, i) => <div className="activity-row" key={i}><time>{item.time}</time><code>{item.action}</code><span>{item.result}</span></div>)}</section>}
    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) dismissModal(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">{modal.title}</h2><p>{modal.detail}</p><form onSubmit={e => { e.preventDefault(); dismissModal(modal.choices[0]!); }}>{modal.initial !== undefined && <input autoFocus value={modalInput} onChange={e => setModalInput(e.target.value)} aria-label={modal.title} />}<div className="modal-actions"><button type="button" ref={closingModal} onClick={() => dismissModal(null)}>Cancelar</button>{modal.choices.map(choice => <button className="primary" key={choice} type="submit">{choice}</button>)}</div></form></section></div>}
  </div>;
}
