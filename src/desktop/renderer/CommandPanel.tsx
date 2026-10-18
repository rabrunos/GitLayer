import { useEffect, useMemo, useState } from 'react';
import { buildTerminalCommand, terminalCommands, type TerminalCommandValues, type TerminalShell } from '../commands.js';

interface Props {
  owner: string; layers: readonly string[]; branch: string; shell: TerminalShell;
  onCopy(id: string, values: TerminalCommandValues): Promise<void>;
}

export function CommandPanel({ owner, layers, branch, shell, onCopy }: Props): React.JSX.Element {
  const [selected, setSelected] = useState('status');
  const [values, setValues] = useState<TerminalCommandValues>({});
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [selected, values]);
  const definition = terminalCommands.find(command => command.id === selected)!;
  useEffect(() => {
    const defaults: TerminalCommandValues = {};
    for (const field of definition.fields) {
      if (field.kind === 'boolean') defaults[field.key] = false;
      else if (field.kind === 'layer') defaults[field.key] = field.required ? (owner === 'base' ? layers[0] ?? '' : owner) : '';
      else if (field.kind === 'owner') defaults[field.key] = owner;
      else if (field.kind === 'branch') defaults[field.key] = branch;
      else defaults[field.key] = '';
    }
    if (definition.json) defaults.json = false;
    setValues(defaults);
    // Changing the owner supplies fresh defaults only when a different command is selected.
    // A refresh must not erase a message or paths that the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition]);
  const preview = useMemo(() => {
    try { return { command: buildTerminalCommand(selected, values, shell), error: '' }; }
    catch (error) { return { command: '', error: error instanceof Error ? error.message : String(error) }; }
  }, [selected, values, shell]);
  const groups = [...new Set(terminalCommands.map(command => command.group))];
  const set = (key: string, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!preview.command || submitting) return;
    setSubmitting(true);
    try { await onCopy(selected, values); setCopied(true); } finally { setSubmitting(false); }
  };
  return <aside className="terminal-commands" aria-label="Comandos Git Layers">
    <div className="terminal-command-heading"><strong>Comandos Git Layers</strong><small>{terminalCommands.length} comandos da CLI</small></div>
    <label className="terminal-field">Comando<select data-testid="terminal-command-select" value={selected} onChange={event => setSelected(event.target.value)}>{groups.map(group => <optgroup key={group} label={group}>{terminalCommands.filter(command => command.group === group).map(command => <option value={command.id} key={command.id}>{command.id} · {command.label}</option>)}</optgroup>)}</select></label>
    <p className="terminal-description">{definition.description}</p>
    <form onSubmit={event => { event.preventDefault(); void submit().catch(() => undefined); }}>
      {definition.fields.map(field => field.kind === 'boolean' ? <label className="terminal-checkbox" key={field.key}><input type="checkbox" checked={values[field.key] === true} onChange={event => set(field.key, event.target.checked)} />{field.label}</label> : <label className="terminal-field" key={field.key}>{field.label}{field.required && <span aria-label="obrigatório"> *</span>}
        {field.kind === 'layer' || field.kind === 'owner' ? <select value={String(values[field.key] ?? '')} onChange={event => set(field.key, event.target.value)} aria-required={field.required}>{!field.required && <option value="">Conjunto / base padrão</option>}{field.required && field.kind === 'layer' && !layers.length && <option value="">Nenhuma Layer registrada</option>}{field.kind === 'owner' && <option value="base">base · branch tradicional</option>}{layers.map(layer => <option value={layer} key={layer}>{layer}</option>)}</select> : field.kind === 'paths' && !field.singlePath ? <textarea rows={3} value={String(values[field.key] ?? '')} onChange={event => set(field.key, event.target.value)} placeholder={field.placeholder} aria-required={field.required} spellCheck={false} /> : <input value={String(values[field.key] ?? '')} onChange={event => set(field.key, event.target.value)} placeholder={field.placeholder} aria-required={field.required} inputMode={field.kind === 'integer' ? 'numeric' : undefined} spellCheck={false} />}
        {field.hint && <small>{field.hint}</small>}
      </label>)}
      {definition.json && <label className="terminal-checkbox"><input type="checkbox" checked={values.json === true} onChange={event => set('json', event.target.checked)} />Saída JSON (--json)</label>}
      {definition.warning && <p className="terminal-command-warning">{definition.warning}</p>}
      <div className="terminal-command-preview"><span>Comando para copiar · {shell === 'powershell' ? 'PowerShell' : 'Bash'}</span><code data-testid="terminal-command-preview">{preview.command || preview.error}</code></div>
      <div className="terminal-command-actions"><button type="submit" className="primary" data-testid="terminal-command-copy" disabled={!preview.command || submitting}>{copied ? 'Copiado' : 'Copiar comando'}</button><span role="status">{copied ? 'Cole no terminal e pressione Enter para executar.' : ''}</span></div>
      <p className="terminal-command-note">Consulte e copie a CLI. A execução e as confirmações acontecem manualmente no terminal real.</p>
    </form>
  </aside>;
}
