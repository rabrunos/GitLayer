const IMPLEMENTATION = 'implementation-2026-11-02';
const CLOSURE = 'closure-2026-11-02';
const historical = new Set(['legacy-validation-v2', 'validation-v2-2026-10-18', 'infrastructure-review-2026-10-19']);
const recognized = value => value === IMPLEMENTATION || value === CLOSURE || historical.has(value);
const selectedClosure = results => results.some(result => result.selection_status === 'SELECTED' && result.limits?.some(limit => /^Executable expectation closure-2026-11-02-r(?:1|2):/.test(limit)));
const selectedImplementation = results => results.some(result => result.selection_status === 'SELECTED' && /(?:^|\/)tests\/git-compat\/cases\/implementation\.mjs$/u.test(result.reproduction?.fixture_recipe_path ?? ''));

/** Phase is provenance, never a test result or authorization to execute work. */
export function resolveReportPhase(context = {}, results = []) {
  const operation = context.operation && typeof context.operation === 'object' && !Array.isArray(context.operation) ? context.operation : {};
  const declared = [context.phase, context.fase, operation.phase, operation.fase].filter(value => value !== undefined);
  if (typeof context.operation === 'string' && recognized(context.operation)) declared.push(context.operation);
  if (declared.some(value => typeof value !== 'string' || !recognized(value))) throw Error('Unknown explicit report phase; use closure-2026-11-02, implementation-2026-11-02 or a historical v2 phase');
  const modes = new Set(declared.map(value => [IMPLEMENTATION, CLOSURE].includes(value) ? IMPLEMENTATION : 'legacy-validation-v2'));
  if (modes.size > 1) throw Error('Conflicting explicit report phases');
  const fromRuntime = selectedClosure(results), fromResults = selectedImplementation(results);
  const closure = declared.includes(CLOSURE) || fromRuntime;
  if (modes.has('legacy-validation-v2') && (fromResults || fromRuntime)) throw Error('Historical report phase conflicts with selected current implementation/runtime contracts');
  const implementation = modes.has(IMPLEMENTATION) || fromResults || fromRuntime;
  const userAuthorization = operation.user_authorization ?? context.user_authorization ?? null;
  const technicalChoices = operation.technical_choices ?? context.technical_choices ?? [];
  if (userAuthorization !== null && (typeof userAuthorization !== 'string' || !userAuthorization.trim())) throw Error('Report user_authorization must be a nonempty context declaration');
  if (!Array.isArray(technicalChoices) || technicalChoices.some(value => typeof value !== 'string' || !value.trim())) throw Error('Report technical_choices must be an array of nonempty strings');
  return { id: closure ? CLOSURE : implementation ? IMPLEMENTATION : 'legacy-validation-v2', implementation, source: declared.length ? 'explicit-context' : fromRuntime ? 'selected-versioned-runtime-contract' : fromResults ? 'selected-frozen-implementation-recipe' : 'legacy-default', declaredPhases: declared, selectedImplementationModule: fromResults, selectedCurrentRuntimeContracts: fromRuntime, userAuthorization, technicalChoices, policy: 'Phase describes the selected task context. It does not change execution classifications, approve all requirements or turn technical choices into user requirements.' };
}
const plain = text => String(text).replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>');
export function phaseReportText(phase) {
  if (!phase.implementation) return {
    scope: '',
    findingsIntro: 'Nenhuma correção de produto nesta rodada.',
    findingNext: 'Próximo trabalho: confirmar o contrato e corrigir o produto apenas em tarefa autorizada; manter invariantes e revisar a expectativa versionada.',
    environment: 'O Core descarta variáveis GIT_* herdadas e pode ler config de sistema: limite do produto documentado, sem interceptação.',
    defects: 'Não foram corrigidos Core/CLI/desktop. MODEL-008 continua campanha não exaustiva; mortes reais, exceções e interleavings têm alcances diferentes. Versões/comandos ausentes permanecem ENV_BLOCKED; GUI/bridges/migração/terceiros mantêm o escopo registrado.',
  };
  const authorization = phase.userAuthorization ? 'Declaração de autorização do usuário fornecida no contexto: ' + plain(phase.userAuthorization) + '.' : 'A seleção identifica a fase de implementação; a autorização funcional deve ser consultada no contexto e nas fontes anexadas. A fase, sozinha, não comprova o atendimento dos requisitos.';
  const choices = phase.technicalChoices.length ? '\n\nEscolhas técnicas do Codex declaradas no contexto (não são novos requisitos aprovados):\n\n' + phase.technicalChoices.map(choice => '- ' + plain(choice)).join('\n') : '\n\nAs escolhas técnicas da implementação são distintas dos comportamentos aprovados pelo usuário; este anexo não as converte em requisitos.';
  return {
    scope: '## Fase da entrega e autoria das decisões\n\n' + (phase.id === CLOSURE ? 'Fechamento e sincronização do produto de 02/11/2026' : 'Implementação do produto de 02/11/2026') + ', identificada por ' + phase.source + '. Core/CLI podem ter sido alterados na tarefa antes da baseline desta execução. Fontes estáveis durante o teste não significam ausência de correções anteriores. [Metadados da fase](REPORT-PHASE.json).\n\n' + authorization + choices + '\n\n',
    findingsIntro: 'As classificações pertencem ao snapshot executado. Este anexo não infere ausência de correções de produto na tarefa; correções e contraprovas devem ser identificadas no contexto e nos relatórios de implementação.',
    findingNext: 'Próximo trabalho: relacionar este achado ao requisito e à implementação do snapshot; registrar correção ou limite e sua contraprova, com nova baseline quando as fontes mudarem.',
    environment: 'A política efetiva do adaptador e suas contraprovas pertencem ao contexto de implementação. Frases históricas em metadados de ambiente não substituem a validação da versão executada.',
    defects: 'Esta fase permite implementar Core/CLI; o anexo descreve a seleção executada e não enumera sozinho todas as correções da missão. Laboratório e plugins permanecem fora do escopo. MODEL-008 continua não exaustivo: variantes selecionadas de falha, exceção ou morte real não certificam todas as fronteiras, syscalls ou plataformas. Capacidades realmente ausentes permanecem ENV_BLOCKED; migração e demais comportamentos recebem somente o suporte demonstrado por seus resultados.',
  };
}
