import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { TerminalCommandValues } from '../commands.js';
import type { TerminalState } from '../shared.js';
import { CommandPanel } from './CommandPanel.js';
import '@xterm/xterm/css/xterm.css';
import './terminal.css';

interface Props { repoRoot: string; owner: string; layers: readonly string[]; branch: string; theme: string; visible: boolean; onHide(): void }

export function TerminalPanel({ repoRoot, owner, layers, branch, theme, visible, onHide }: Props): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const session = useRef<string | null>(null);
  const opening = useRef(false);
  const mounted = useRef(true);
  const [state, setState] = useState<TerminalState | null>(null);
  const [error, setError] = useState('');
  const [height, setHeight] = useState(300);
  const [showCommands, setShowCommands] = useState(true);
  const [reconnect, setReconnect] = useState(0);
  const report = useCallback((failure: unknown) => { if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure)); }, []);
  const invoke = useCallback(async <T,>(action: string, args: unknown = {}): Promise<T> => {
    const result = await window.lab.call(action, args);
    if (!result.ok) throw new Error(`${result.error?.code ?? 'TERMINAL'}: ${result.error?.message ?? 'Falha no terminal'}`);
    return result.data as T;
  }, []);
  const fitTerminal = useCallback(() => {
    const term = terminal.current;
    if (!term || !container.current || container.current.clientWidth < 10 || container.current.clientHeight < 10) return;
    fit.current?.fit();
    if (session.current) void invoke('terminalResize', { cols: term.cols, rows: term.rows }).catch(report);
  }, [invoke, report]);

  useEffect(() => {
    mounted.current = true;
    const term = new Terminal({ cursorBlink: true, fontFamily: "'Cascadia Code', Consolas, monospace", fontSize: 12, scrollback: 5000, allowProposedApi: false, disableStdin: true });
    const addon = new FitAddon();
    terminal.current = term; fit.current = addon;
    term.loadAddon(addon); term.open(container.current!);
    const input = term.onData(data => { if (session.current) void invoke('terminalWrite', { data }).catch(report); });
    const offData = window.lab.onTerminalData(event => {
      if (event.sessionId !== session.current) return;
      if (event.data) term.write(event.data);
      if (event.status !== undefined || event.inputDirty !== undefined) setState(previous => previous ? { ...previous, ...(event.status === undefined ? {} : { status: event.status }), ...(event.inputDirty === undefined ? {} : { inputDirty: event.inputDirty }) } : previous);
    });
    const offExit = window.lab.onTerminalExit(event => {
      if (event.sessionId !== session.current) return;
      term.options.disableStdin = true;
      term.write(`\r\n[Shell encerrado · código ${event.exitCode}]\r\n`);
      setState(previous => previous ? { ...previous, status: 'exited' } : previous);
    });
    const observer = new ResizeObserver(fitTerminal); observer.observe(container.current!);
    return () => {
      mounted.current = false; observer.disconnect(); input.dispose(); offData(); offExit();
      term.dispose(); terminal.current = null; fit.current = null; session.current = null;
      void window.lab.call('terminalClose');
    };
  }, [invoke, report, fitTerminal, repoRoot]);

  useEffect(() => {
    if (!visible || session.current || opening.current) return;
    opening.current = true; setError('');
    fitTerminal();
    const term = terminal.current!;
    void invoke<TerminalState>('terminalOpen', { cols: term.cols, rows: term.rows }).then(result => {
      if (!mounted.current) return;
      session.current = result.sessionId; setState(result);
      term.reset(); if (result.history) term.write(result.history);
      term.options.disableStdin = result.status === 'exited'; term.focus(); fitTerminal();
    }).catch(report).finally(() => { opening.current = false; });
  }, [visible, reconnect, repoRoot, invoke, report, fitTerminal]);
  useEffect(() => {
    const term = terminal.current; if (!term) return;
    const style = getComputedStyle(document.documentElement);
    term.options.theme = { background: style.getPropertyValue('--bg').trim(), foreground: style.getPropertyValue('--text').trim(), cursor: style.getPropertyValue('--accent').trim(), selectionBackground: theme === 'light' ? '#96b6d266' : '#6388ad66' };
  }, [theme]);
  useEffect(() => { if (visible) { fitTerminal(); terminal.current?.focus(); } }, [visible, showCommands, height, fitTerminal]);

  const copy = async (id: string, values: TerminalCommandValues) => {
    setError('');
    try { await invoke('copyCommand', { id, values }); }
    catch (failure) { report(failure); throw failure; }
  };
  const restart = async () => {
    setError('');
    try { await invoke('terminalClose'); session.current = null; setState(null); terminal.current?.reset(); setReconnect(current => current + 1); }
    catch (failure) { report(failure); }
  };
  const resize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    const startY = event.clientY; const startHeight = height;
    const move = (moveEvent: globalThis.PointerEvent) => setHeight(Math.max(160, Math.min(window.innerHeight * .72, startHeight + startY - moveEvent.clientY)));
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  };
  const status = state?.status === 'prompt' ? state.inputDirty ? 'Linha em edição' : 'Pronto para comando' : state?.status === 'busy' ? 'Executando' : state?.status === 'exited' ? 'Shell encerrado' : 'Iniciando terminal…';
  return <section className="terminal-panel" data-testid="terminal-panel" aria-label="Terminal integrado" hidden={!visible} style={{ height }}>
    <div className="terminal-resize" role="separator" aria-orientation="horizontal" aria-label="Altura do terminal" tabIndex={0} onPointerDown={resize} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setHeight(current => Math.max(160, Math.min(window.innerHeight * .72, current + (event.key === 'ArrowUp' ? 24 : -24)))); } }} />
    <header className="terminal-toolbar"><strong>›_ Terminal</strong><span className="terminal-shell">{state?.shell === 'powershell' ? 'PowerShell' : state?.shell === 'bash' ? 'Bash' : 'Shell local'}</span><span className="terminal-ready" data-testid="terminal-status">{status}</span><span className="terminal-cwd" title={repoRoot}>{repoRoot}</span><button onClick={() => setShowCommands(current => !current)} aria-expanded={showCommands}>Comandos {showCommands ? '▾' : '▸'}</button><button onClick={() => void restart()} title="Encerra o processo atual e abre outro shell neste workspace">Reiniciar shell</button><button aria-label="Ocultar terminal" onClick={onHide}>×</button></header>
    <div className={`terminal-body ${showCommands ? 'with-commands' : ''}`}>{showCommands && <CommandPanel owner={owner} layers={layers} branch={branch} shell={state?.shell ?? 'powershell'} onCopy={copy} />}<div className="terminal-shell-area"><div className="terminal-host" data-testid="terminal-output" ref={container} /><p className="terminal-trust-note">Terminal local real · comandos digitados aqui podem alterar arquivos e executar programas com as suas permissões.</p></div></div>
    {error && <div className="terminal-error" role="alert"><span>{error}</span><button onClick={() => void restart()}>Tentar novamente</button><button onClick={() => setError('')} aria-label="Fechar erro do terminal">×</button></div>}
  </section>;
}
