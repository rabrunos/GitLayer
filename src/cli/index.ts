#!/usr/bin/env node
import { stdin, stdout, stderr } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { GitLayers } from '../core/index.js';
import { workspaceInputPath } from '../core/platform.js';

const HELP = `Git Layers Lab — git-layer

Uso: git layer [--cwd <repositório>] <comando> [--json]
     npm run cli -- [--cwd <repositório>] <comando>
Ajuda: git layer -h | git layer help | git-layer --help

  init                             Inicializa Git Layers neste repositório
  list                             Lista Layers registradas
  create <nome>                    Cria uma Layer com histórico independente
  register <nome>                  Valida e registra uma branch layer/<nome>
  on <nome>                        Ativa uma Layer registrada
  off <nome> [--park]               Desativa; --park guarda staging e disco
  status [<nome>]                  Estado real da base, Layers e não rastreados
  add <nome> -- <caminho>...        Atribui/prepara somente arquivos autorizados
  unstage <nome> -- <caminho>...    Desfaz staging; preserva reservas e disco
  diff <nome> [--staged] [-- <caminho>...]
  commit <nome> -m <mensagem>       Commit somente do índice dessa Layer
  log [<nome>]                     Histórico da Layer (ou da base)
  show <revisão>                   Detalhes de um commit local
  restore <nome> [--yes] -- <caminho>...
                                   Restaura DISCO a partir do ÍNDICE, com backup.
                                   Não limpa staging. Confirma em terminal;
                                   sem terminal exige --yes explícito.
  release <nome> -- <caminho>...    Libera reserva nunca commitada; mantém disco
  capture <nome> [--path <pasta>]   q abre revisão; Ctrl+C cancela sem apagar
  capture-start <nome> [--path <pasta>]
  capture-review                   Revisa a sessão compartilhada CLI/desktop
  capture-confirm -- <caminho>...   Confirma/prepara só os candidatos indicados
  capture-cancel                   Cancela sem excluir arquivos físicos
  switch <branch>                  Troca a branch tradicional com segurança
  doctor [--fsck]                  Verifica refs, índices e composição reais
  recover                          Inspeciona/recupera journals interrompidos
  recovery-export <pasta-nova>      Exporta cópias para revisão manual

Fluxo da branch tradicional:
  base-add -- <caminho>...          Stage na base, rejeitando arquivos de Layers
  base-unstage -- <caminho>...      Unstage na base
  base-commit -m <mensagem>         Commit na branch tradicional
  branches                         Lista branches tradicionais
  branch-create <nome>             Cria branch tradicional local
  branch-delete <nome>             Exclui somente branch integrada e não atual
  hunks <base|nome> -- <arquivo>    Lista hunks e token do estado do índice
  stage-hunk <base|nome> --hunk <n> --token <token> -- <arquivo>

Todos os caminhos devem vir depois de --. Use aspas do seu terminal para
espaços e acentos. Não existe --force para contornar verificações.
--json produz { ok, result } ou { ok, error: { code, message, details } }.
Códigos: 0 sucesso; 2 uso inválido; 3 segurança/estado; 4 Git/IO;
         5 recuperação necessária; 130 captura cancelada por Ctrl+C.
Nenhum comando de rede, push, pull ou fetch é disponibilizado.
`;

class CliUsageError extends Error {
  readonly code = 'CLI_USAGE';
  constructor(message: string) { super(message); this.name = 'CliUsageError'; }
}

interface Parsed {
  command: string;
  args: string[];
  paths: string[];
  flags: Map<string, string | true>;
  cwd: string;
  json: boolean;
}

const COMMAND_FLAGS: Record<string, string[]> = {
  init: [], list: [], create: [], register: [], on: [], off: ['park'],
  status: [], add: [], unstage: [], diff: ['staged'], commit: ['message'], log: [],
  show: [], restore: ['yes'], release: [], capture: ['path'],
  'capture-start': ['path'], 'capture-review': [], 'capture-confirm': [],
  'capture-cancel': [], switch: [], doctor: ['fsck'], recover: [],
  'recovery-export': [], 'base-add': [], 'base-unstage': [], 'base-commit': ['message'],
  branches: [], 'branch-create': [], 'branch-delete': [], hunks: [],
  'stage-hunk': ['hunk', 'token'],
};
const VALUE_FLAGS = new Set(['cwd', 'path', 'message', 'hunk', 'token']);

function parse(argv: readonly string[]): Parsed {
  const args: string[] = [];
  const paths: string[] = [];
  const flags = new Map<string, string | true>();
  let afterSeparator = false;
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i]!;
    if (afterSeparator) { paths.push(workspaceInputPath(value)); continue; }
    if (value === '--') { afterSeparator = true; continue; }
    if (!value.startsWith('-')) { args.push(value); continue; }
    const flag = value === '-m' ? 'message' : value === '-h' ? 'help' : value.slice(2);
    if (!value.startsWith('--') && value !== '-m' && value !== '-h') {
      throw new CliUsageError(`Opção desconhecida: ${value}. Caminhos devem vir depois de --.`);
    }
    if (flags.has(flag)) throw new CliUsageError(`Opção repetida: ${value}.`);
    if (VALUE_FLAGS.has(flag)) {
      const next = argv[++i];
      if (next === undefined || next === '--') throw new CliUsageError(`Falta valor para ${value}.`);
      flags.set(flag, next);
    } else { flags.set(flag, true); }
  }
  const command = flags.has('help') || args.length === 0 ? 'help' : args.shift()!;
  if (command !== 'help' && !(command in COMMAND_FLAGS)) {
    throw new CliUsageError(`Comando desconhecido: ${command}. Consulte git layer -h.`);
  }
  const allowed = new Set(['cwd', 'json', 'help', ...(COMMAND_FLAGS[command] ?? [])]);
  for (const flag of flags.keys()) {
    if (!allowed.has(flag)) throw new CliUsageError(`Opção --${flag} não é válida para ${command}.`);
  }
  const cwdFlag = flags.get('cwd');
  return { command, args, paths, flags, cwd: resolve(typeof cwdFlag === 'string' ? cwdFlag : process.cwd()), json: flags.has('json') };
}

function argument(p: Parsed, index: number, label: string): string {
  const value = p.args[index];
  if (!value) throw new CliUsageError(`Falta ${label}. Consulte git layer -h.`);
  return value;
}
function arity(p: Parsed, minimum: number, maximum = minimum): void {
  if (p.args.length < minimum || p.args.length > maximum) {
    throw new CliUsageError(`Argumentos incorretos para ${p.command}; esperado(s) ${minimum === maximum ? minimum : `${minimum} a ${maximum}`}. Consulte --help.`);
  }
}
function paths(p: Parsed, count?: number): string[] {
  if (!p.paths.length || (count !== undefined && p.paths.length !== count)) {
    throw new CliUsageError(count === 1 ? 'Informe exatamente um arquivo depois de --.' : 'Informe um ou mais caminhos depois de --.');
  }
  if (p.paths.some((path) => !path.length)) throw new CliUsageError('Caminhos vazios não são permitidos.');
  return p.paths;
}
function flagValue(p: Parsed, name: string): string {
  const value = p.flags.get(name);
  if (typeof value !== 'string' || !value.trim()) throw new CliUsageError(`Informe --${name} <valor>.`);
  return value;
}

interface ErrorShape { code?: string; message?: string; details?: unknown; exitCode?: number }
function describeError(error: unknown): { code: string; message: string; details?: unknown; exitCode: number } {
  const shape = typeof error === 'object' && error !== null ? error as ErrorShape : {};
  const code = typeof shape.code === 'string' ? shape.code : 'UNEXPECTED';
  const message = typeof shape.message === 'string' ? shape.message : String(error);
  let exitCode = 3;
  if (code === 'CLI_USAGE') exitCode = 2;
  else if (/RECOVERY|JOURNAL|TRANSACTION_PENDING/.test(code)) exitCode = 5;
  else if (/GIT_(FAILED|ERROR|MISSING|NOT_FOUND|PROCESS|TIMEOUT|OUTPUT_LIMIT)|ENOENT|EACCES|IO_ERROR|UNEXPECTED/.test(code)) exitCode = 4;
  return { code, message, ...(shape.details === undefined ? {} : { details: shape.details }), exitCode };
}

async function confirmRestore(layer: string, selected: string[], json: boolean): Promise<boolean> {
  if (!stdin.isTTY || !stdout.isTTY || json) {
    throw new CliUsageError('restore descarta alterações no disco após backup. Em modo não interativo use --yes explicitamente; o staging será preservado.');
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const abort = new AbortController();
  const onInterrupt = () => abort.abort();
  rl.once('SIGINT', onInterrupt);
  process.once('SIGINT', onInterrupt);
  try {
    stdout.write(`Restaurar o disco a partir do índice de ${layer}, preservando backup e staging:\n${selected.map((path) => `  ${path}`).join('\n')}\n`);
    return (await rl.question('Confirmar? Digite sim: ', { signal: abort.signal })).trim().toLocaleLowerCase('pt-BR') === 'sim';
  } catch (error) {
    if (abort.signal.aborted) return false;
    throw error;
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    rl.close();
  }
}

type CaptureCandidate = { path: string; ignored: boolean };
function candidatesFrom(review: unknown): CaptureCandidate[] {
  const data = review as { candidates?: unknown[]; files?: unknown[] } | null;
  const entries = Array.isArray(review) ? review : data?.candidates ?? data?.files ?? [];
  return entries.flatMap((entry: unknown) => {
    if (typeof entry === 'string') return [{ path: entry, ignored: false }];
    if (typeof entry === 'object' && entry !== null && 'path' in entry && typeof entry.path === 'string') {
      return [{ path: entry.path, ignored: 'ignored' in entry && entry.ignored === true }];
    }
    return [];
  });
}

async function observeCapture(): Promise<'review' | 'cancel'> {
  stdout.write('Captura ativa. Crie os arquivos no editor ou em outro terminal. Pressione q para revisar; Ctrl+C cancela sem apagar arquivos.\n');
  return new Promise((resolveChoice) => {
    const wasRaw = stdin.isRaw;
    const finish = (choice: 'review' | 'cancel') => {
      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdout.write('\n');
      resolveChoice(choice);
    };
    const onData = (chunk: Buffer) => {
      const value = chunk.toString('utf8');
      if (value.includes('\u0003')) finish('cancel');
      else if (/[qQ]/.test(value)) finish('review');
    };
    const onEnd = () => finish('cancel');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
    stdin.once('end', onEnd);
  });
}

async function captureInteractive(core: GitLayers, layer: string, scope: string): Promise<{ result: unknown; exitCode: number }> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new CliUsageError('capture precisa de terminal interativo. Use capture-start, capture-review e capture-confirm -- <caminhos> para uma sessão não interativa.');
  }
  await core.captureStart(layer, scope);
  if (await observeCapture() === 'cancel') {
    await core.captureCancel();
    return { result: { cancelled: true, filesPreserved: true }, exitCode: 130 };
  }
  const review = await core.captureReview();
  const candidates = candidatesFrom(review);
  if (!candidates.length) {
    await core.captureCancel();
    return { result: { cancelled: true, reason: 'Nenhum arquivo novo elegível.', filesPreserved: true }, exitCode: 0 };
  }
  stdout.write('Candidatos encontrados (nenhum foi atribuído ainda):\n');
  candidates.forEach((file, index) => stdout.write(` ${index + 1}. ${file.path}${file.ignored ? ' [IGNORADO — aprovação explícita necessária]' : ''}\n`));
  const rl = createInterface({ input: stdin, output: stdout });
  const abort = new AbortController();
  const onInterrupt = () => abort.abort();
  rl.once('SIGINT', onInterrupt);
  process.once('SIGINT', onInterrupt);
  let interrupted = false;
  try {
    const answer = (await rl.question('Números separados por vírgula; "todos" seleciona só não ignorados; vazio cancela: ', { signal: abort.signal })).trim();
    let selected: CaptureCandidate[];
    if (!answer) selected = [];
    else if (answer.toLocaleLowerCase('pt-BR') === 'todos') selected = candidates.filter((file) => !file.ignored);
    else {
      const numbers = answer.split(/[\s,]+/).map((part) => Number(part));
      if (numbers.some((number) => !Number.isSafeInteger(number) || number < 1 || number > candidates.length)) {
        throw new CliUsageError('Seleção inválida. Sessão preservada; use capture-review ou capture-cancel.');
      }
      selected = [...new Set(numbers)].map((number) => candidates[number - 1]!);
    }
    if (!selected.length) {
      await core.captureCancel();
      return { result: { cancelled: true, filesPreserved: true }, exitCode: 0 };
    }
    stdout.write(`Preparar na Layer ${layer}:\n${selected.map((file) => `  ${file.path}${file.ignored ? ' [ignorado, incluído explicitamente]' : ''}`).join('\n')}\n`);
    const confirmation = await rl.question('Confirmar atribuição e staging? Digite sim: ', { signal: abort.signal });
    if (confirmation.trim().toLocaleLowerCase('pt-BR') !== 'sim') {
      await core.captureCancel();
      return { result: { cancelled: true, filesPreserved: true }, exitCode: 0 };
    }
    return { result: await core.captureConfirm(selected.map((file) => file.path)), exitCode: 0 };
  } catch (error) {
    if (abort.signal.aborted) {
      interrupted = true;
      await core.captureCancel();
      return { result: { cancelled: true, filesPreserved: true }, exitCode: 130 };
    }
    throw error;
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    rl.close();
    if (interrupted) stdout.write('\nCaptura cancelada; arquivos físicos preservados.\n');
  }
}

async function dispatch(p: Parsed): Promise<{ result: unknown; exitCode: number }> {
  if (p.command === 'help') return { result: HELP, exitCode: 0 };
  const pathCommands = new Set(['add', 'unstage', 'diff', 'restore', 'release', 'capture-confirm', 'base-add', 'base-unstage', 'hunks', 'stage-hunk']);
  if (p.paths.length && !pathCommands.has(p.command)) throw new CliUsageError(`O comando ${p.command} não aceita caminhos depois de --.`);
  if (p.command === 'init') {
    arity(p, 0);
    await GitLayers.init(p.cwd);
    const initialized = await GitLayers.open(p.cwd);
    return { result: await initialized.status(), exitCode: 0 };
  }
  const core = await GitLayers.open(p.cwd);
  let result: unknown;
  switch (p.command) {
    case 'list': arity(p, 0); result = await core.list(); break;
    case 'create': arity(p, 1); result = await core.create(argument(p, 0, 'nome da Layer')); break;
    case 'register': arity(p, 1); result = await core.register(argument(p, 0, 'nome da Layer')); break;
    case 'on': arity(p, 1); result = await core.on(argument(p, 0, 'nome da Layer')); break;
    case 'off': arity(p, 1); result = await core.off(argument(p, 0, 'nome da Layer'), p.flags.has('park')); break;
    case 'status': arity(p, 0, 1); result = await core.status(p.args[0]); break;
    case 'add': arity(p, 1); result = await core.add(argument(p, 0, 'nome da Layer'), paths(p)); break;
    case 'unstage': arity(p, 1); result = await core.unstage(argument(p, 0, 'nome da Layer'), paths(p)); break;
    case 'diff': arity(p, 1); result = await core.diff(argument(p, 0, 'nome da Layer'), p.flags.has('staged'), p.paths); break;
    case 'commit': arity(p, 1); result = await core.commit(argument(p, 0, 'nome da Layer'), flagValue(p, 'message')); break;
    case 'log': arity(p, 0, 1); result = await core.log(p.args[0]); break;
    case 'show': arity(p, 1); result = await core.show(argument(p, 0, 'revisão')); break;
    case 'restore': {
      arity(p, 1);
      const layer = argument(p, 0, 'nome da Layer');
      const selected = paths(p);
      if (!p.flags.has('yes') && !await confirmRestore(layer, selected, p.json)) return { result: { cancelled: true }, exitCode: 0 };
      result = await core.restore(layer, selected, true);
      break;
    }
    case 'release': arity(p, 1); result = await core.release(argument(p, 0, 'nome da Layer'), paths(p)); break;
    case 'capture':
      arity(p, 1);
      if (p.json) throw new CliUsageError('capture interativo não usa --json. Use capture-start/review/confirm/cancel para saída estruturada.');
      return captureInteractive(core, argument(p, 0, 'nome da Layer'), typeof p.flags.get('path') === 'string' ? workspaceInputPath(p.flags.get('path') as string) : '');
    case 'capture-start': arity(p, 1); result = await core.captureStart(argument(p, 0, 'nome da Layer'), typeof p.flags.get('path') === 'string' ? workspaceInputPath(p.flags.get('path') as string) : ''); break;
    case 'capture-review': arity(p, 0); result = await core.captureReview(); break;
    case 'capture-confirm': arity(p, 0); result = await core.captureConfirm(paths(p)); break;
    case 'capture-cancel': arity(p, 0); result = await core.captureCancel(); break;
    case 'switch': arity(p, 1); result = await core.switch(argument(p, 0, 'branch tradicional')); break;
    case 'doctor': arity(p, 0); result = await core.doctor(p.flags.has('fsck')); break;
    case 'recover': arity(p, 0); result = await core.recover(); break;
    case 'recovery-export': arity(p, 1); result = await core.exportRecovery(resolve(argument(p, 0, 'pasta nova de destino'))); break;
    case 'base-add': arity(p, 0); result = await core.baseStage(paths(p)); break;
    case 'base-unstage': arity(p, 0); result = await core.baseUnstage(paths(p)); break;
    case 'base-commit': arity(p, 0); result = await core.baseCommit(flagValue(p, 'message')); break;
    case 'branches': arity(p, 0); result = await core.branches(); break;
    case 'branch-create': arity(p, 1); result = await core.branchCreate(argument(p, 0, 'nome da branch')); break;
    case 'branch-delete': arity(p, 1); result = await core.branchDelete(argument(p, 0, 'nome da branch')); break;
    case 'hunks': arity(p, 1); result = await core.diffHunks(argument(p, 0, 'proprietário'), paths(p, 1)[0]!); break;
    case 'stage-hunk': {
      arity(p, 1);
      const indexText = flagValue(p, 'hunk');
      const index = Number(indexText);
      if (!/^\d+$/.test(indexText) || !Number.isSafeInteger(index)) throw new CliUsageError('--hunk deve ser um inteiro não negativo (índice iniciado em 0).');
      result = await core.partialStage(argument(p, 0, 'proprietário'), paths(p, 1)[0]!, index, flagValue(p, 'token'));
      break;
    }
    default: throw new CliUsageError(`Comando não disponível: ${p.command}.`);
  }
  return { result: result ?? { completed: true }, exitCode: 0 };
}

/** CLI calls the same GitLayers coordinator as the desktop; no Git substitute. */
export async function runCli(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  let json = argv.slice(0, argv.indexOf('--') === -1 ? undefined : argv.indexOf('--')).includes('--json');
  try {
    const parsed = parse(argv);
    json = parsed.json;
    const { result, exitCode } = await dispatch(parsed);
    if (json) stdout.write(`${JSON.stringify({ ok: exitCode === 0, result })}\n`);
    else if (typeof result === 'string') stdout.write(result.endsWith('\n') ? result : `${result}\n`);
    else stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return exitCode;
  } catch (error) {
    const { code, message, details, exitCode } = describeError(error);
    if (json) stderr.write(`${JSON.stringify({ ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } })}\n`);
    else {
      stderr.write(`Erro [${code}]: ${message}\n`);
      if (details !== undefined) stderr.write(`${typeof details === 'string' ? details : JSON.stringify(details, null, 2)}\n`);
    }
    return exitCode;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runCli();
}
