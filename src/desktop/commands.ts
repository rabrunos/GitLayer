/** Shared by the command form and the PTY host. This only builds CLI text. */
export type TerminalShell = 'powershell' | 'bash';
export type TerminalCommandValues = Record<string, string | boolean | string[]>;
export interface TerminalCommandField {
  key: string; label: string;
  kind: 'layer' | 'owner' | 'branch' | 'text' | 'paths' | 'boolean' | 'integer';
  required?: boolean; flag?: string; placeholder?: string; hint?: string;
  singlePath?: boolean;
}
export interface TerminalCommandDefinition {
  id: string; label: string; group: string; description: string;
  fields: readonly TerminalCommandField[]; json?: boolean; warning?: string;
}
const layer: TerminalCommandField = { key: 'layer', label: 'Layer', kind: 'layer', required: true };
const owner: TerminalCommandField = { key: 'owner', label: 'Proprietário', kind: 'owner', required: true };
const optionalLayer: TerminalCommandField = { ...layer, required: false, hint: 'Vazio consulta o conjunto/base, conforme o comando.' };
const name: TerminalCommandField = { key: 'name', label: 'Nome', kind: 'text', required: true };
const branch: TerminalCommandField = { key: 'branch', label: 'Branch tradicional', kind: 'branch', required: true };
const paths: TerminalCommandField = { key: 'paths', label: 'Caminhos relativos · um por linha', kind: 'paths', required: true, placeholder: 'src/arquivo.ts\npasta com espaços/outro.txt', hint: 'Não digite aspas. Cada linha será um argumento separado depois de --.' };
const singlePath: TerminalCommandField = { ...paths, label: 'Arquivo relativo', singlePath: true };
const message: TerminalCommandField = { key: 'message', label: 'Mensagem do commit', kind: 'text', flag: '-m', required: true };
const scope: TerminalCommandField = { key: 'path', label: 'Pasta de captura (opcional)', kind: 'text', flag: '--path' };
const command = (id: string, label: string, group: string, description: string, fields: readonly TerminalCommandField[] = [], extra: Partial<TerminalCommandDefinition> = {}): TerminalCommandDefinition => ({ id, label, group, description, fields, json: true, ...extra });

export const terminalCommands: readonly TerminalCommandDefinition[] = [
  command('help', 'Ajuda da CLI', 'Consultar', 'Mostra todos os comandos e regras da CLI.', [], { json: false }),
  command('status', 'Estado do workspace', 'Consultar', 'Consulta o estado real da base, Layers e arquivos não rastreados.', [optionalLayer]),
  command('list', 'Listar Layers', 'Consultar', 'Lista as Layers registradas no repositório.'),
  command('log', 'Histórico local', 'Consultar', 'Consulta o histórico da Layer informada ou da base.', [optionalLayer]),
  command('show', 'Inspecionar commit', 'Consultar', 'Mostra um commit ou revisão local.', [{ key: 'revision', label: 'Revisão', kind: 'text', required: true, placeholder: 'HEAD' }]),
  command('diff', 'Comparar alterações', 'Consultar', 'Mostra diferenças no proprietário informado.', [owner, { key: 'staged', label: 'Comparar o staging com o commit', kind: 'boolean', flag: '--staged' }, { ...paths, required: false }]),
  command('init', 'Inicializar Layers', 'Layers', 'Inicializa os metadados de Git Layers no Git atual.'),
  command('create', 'Criar Layer', 'Layers', 'Cria uma Layer com histórico independente.', [name]),
  command('register', 'Registrar Layer', 'Layers', 'Valida e registra uma branch layer/<nome> existente.', [name]),
  command('on', 'Ativar Layer', 'Layers', 'Compõe os arquivos da Layer no workspace.', [layer]),
  command('off', 'Desativar Layer', 'Layers', 'Retira os arquivos da Layer; a CLI valida alterações antes de prosseguir.', [layer, { key: 'park', label: 'Guardar staging e disco (--park)', kind: 'boolean', flag: '--park' }]),
  command('add', 'Preparar arquivos da Layer', 'Alterações', 'Atribui e prepara apenas os arquivos indicados.', [layer, paths]),
  command('unstage', 'Desfazer staging da Layer', 'Alterações', 'Preserva reservas e arquivos no disco.', [layer, paths]),
  command('commit', 'Commit na Layer', 'Alterações', 'Cria um commit somente com o índice da Layer.', [layer, message]),
  command('restore', 'Restaurar disco do índice', 'Alterações', 'Restaura os arquivos a partir do staging e preserva uma cópia de recuperação.', [owner, { key: 'yes', label: 'Confirmar explicitamente sem perguntar (--yes)', kind: 'boolean', flag: '--yes' }, paths], { json: false, warning: 'Descarta alterações no disco. Sem --yes, a CLI pede “sim” no próprio terminal. O staging permanece.' }),
  command('release', 'Liberar reserva', 'Alterações', 'Libera a reserva de um arquivo nunca commitado e mantém os bytes no disco.', [layer, paths]),
  command('hunks', 'Listar hunks e token', 'Alterações', 'Lista partes do diff e o token necessário para staging parcial.', [owner, singlePath]),
  command('stage-hunk', 'Preparar um hunk', 'Alterações', 'Usa o índice do hunk e o token retornado por hunks.', [owner, { key: 'hunk', label: 'Índice do hunk (inicia em 0)', kind: 'integer', flag: '--hunk', required: true, placeholder: '0' }, { key: 'token', label: 'Token do estado do índice', kind: 'text', flag: '--token', required: true }, singlePath]),
  command('capture', 'Captura interativa', 'Captura', 'Abre a observação no terminal: q revisa e Ctrl+C cancela sem apagar.', [layer, scope], { json: false, warning: 'A sessão fica interativa no terminal. A seleção e a confirmação acontecem ali.' }),
  command('capture-start', 'Iniciar captura', 'Captura', 'Inicia uma sessão compartilhada pela CLI e pelo editor.', [layer, scope]),
  command('capture-review', 'Revisar captura', 'Captura', 'Lista os candidatos da sessão atual.'),
  command('capture-confirm', 'Confirmar arquivos da captura', 'Captura', 'Atribui e prepara apenas os candidatos explicitamente indicados.', [paths]),
  command('capture-cancel', 'Cancelar captura', 'Captura', 'Encerra a captura e mantém os arquivos físicos.'),
  command('base-add', 'Preparar arquivos na base', 'Branch tradicional', 'Prepara arquivos da base e rejeita arquivos de Layers.', [paths]),
  command('base-unstage', 'Desfazer staging da base', 'Branch tradicional', 'Desfaz staging na branch tradicional.', [paths]),
  command('base-commit', 'Commit na base', 'Branch tradicional', 'Cria um commit na branch tradicional atual.', [message]),
  command('branches', 'Listar branches', 'Branch tradicional', 'Lista branches tradicionais locais.'),
  command('branch-create', 'Criar branch', 'Branch tradicional', 'Cria uma branch tradicional local a partir do HEAD.', [name]),
  command('branch-delete', 'Excluir branch integrada', 'Branch tradicional', 'Exclui apenas uma branch integrada e diferente da atual.', [branch]),
  command('switch', 'Trocar branch', 'Branch tradicional', 'Troca a branch tradicional após validar a composição.', [branch]),
  command('doctor', 'Verificar integridade', 'Recuperação', 'Inspeciona refs, índices e composição reais.', [{ key: 'fsck', label: 'Incluir git fsck', kind: 'boolean', flag: '--fsck' }]),
  command('recover', 'Recuperar operação', 'Recuperação', 'Inspeciona e recupera journals interrompidos.'),
  command('recovery-export', 'Exportar recuperação', 'Recuperação', 'Copia os arquivos de recuperação para uma nova pasta.', [{ key: 'destination', label: 'Nova pasta de destino', kind: 'text', required: true, placeholder: 'C:\\Users\\Você\\Desktop\\recuperacao-nova' }]),
];

function safeText(value: unknown, label: string): string {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/u.test(value) || value.length > 32768) throw new Error(`${label}: use texto sem quebras de linha ou caracteres de controle.`);
  return value;
}

/** The same strict argument construction is used in the trusted main process. */
export function buildTerminalArguments(id: string, values: Record<string, unknown>): string[] {
  const definition = terminalCommands.find(item => item.id === id);
  if (!definition) throw new Error('Comando da CLI não disponível.');
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Argumentos inválidos.');
  const allowed = new Set([...definition.fields.map(field => field.key), ...(definition.json ? ['json'] : [])]);
  for (const key of Object.keys(values)) if (!allowed.has(key)) throw new Error(`Campo não permitido: ${key}.`);
  const args: string[] = [id];
  let selectedPaths: string[] = [];
  for (const field of definition.fields) {
    const raw = values[field.key];
    if (field.kind === 'boolean') {
      if (raw !== undefined && typeof raw !== 'boolean') throw new Error(`${field.label}: valor booleano esperado.`);
      if (raw === true) args.push(field.flag!);
      continue;
    }
    if (field.kind === 'paths') {
      if (raw === undefined || raw === '') selectedPaths = [];
      else if (Array.isArray(raw)) selectedPaths = raw.map(value => safeText(value, field.label));
      else if (typeof raw === 'string') selectedPaths = raw.split(/\r?\n/u).filter(value => value.length > 0).map(value => safeText(value, field.label));
      else throw new Error(`${field.label}: lista de caminhos esperada.`);
      if (selectedPaths.some(value => !value.length)) throw new Error('Caminhos vazios não são permitidos.');
      if (field.required && selectedPaths.length === 0) throw new Error(`Preencha ${field.label.toLocaleLowerCase('pt-BR')}.`);
      if (field.singlePath && selectedPaths.length !== 1) throw new Error('Informe exatamente um arquivo.');
      continue;
    }
    if (raw === undefined || raw === '') { if (field.required) throw new Error(`Preencha ${field.label.toLocaleLowerCase('pt-BR')}.`); continue; }
    const text = safeText(raw, field.label);
    if (!text.trim()) throw new Error(`${field.label}: informe um valor.`);
    if (!field.flag && text.startsWith('-')) throw new Error(`${field.label}: o argumento não pode começar com -.`);
    if (field.flag && text === '--') throw new Error(`${field.label}: valor -- não é aceito pela CLI.`);
    if (field.kind === 'integer' && (!/^\d+$/u.test(text) || !Number.isSafeInteger(Number(text)))) throw new Error(`${field.label}: use um inteiro não negativo.`);
    if (field.flag) args.push(field.flag);
    args.push(text);
  }
  if (values.json !== undefined && typeof values.json !== 'boolean') throw new Error('Saída JSON: valor booleano esperado.');
  if (definition.json && values.json === true) args.push('--json');
  if (selectedPaths.length) args.push('--', ...selectedPaths);
  return args;
}

export function quoteTerminalArgument(value: string, shell: TerminalShell): string {
  safeText(value, 'Argumento');
  if (shell === 'powershell') return `'${value.replaceAll("'", "''")}'`;
  if (shell === 'bash') return `'${value.replaceAll("'", `'"'"'`)}'`;
  throw new Error('Shell não suportado.');
}

export function buildTerminalCommand(id: string, values: Record<string, unknown>, shell: TerminalShell): string {
  return `git-layer ${buildTerminalArguments(id, values).map(value => quoteTerminalArgument(value, shell)).join(' ')}`;
}
