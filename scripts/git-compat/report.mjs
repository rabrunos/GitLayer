import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { project, json, walk, fileHash, relative, safeEvidence, within, sha256 } from './lib.mjs';
import { validateBundle, counts } from './runner.mjs';
import { compareManifests, unchanged, manifestFingerprint, fileManifest } from './audit.mjs';
import { validateOutputRoot } from './output-root.mjs';
import { assessRunIntegrity } from './report-integrity.mjs';
import { resolveReportPhase, phaseReportText } from './report-phase.mjs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/u, ''));
const safe = s => String(s ?? '').replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>');
const table = (head, rows) => '| ' + head.join(' | ') + ' |\n| ' + head.map(() => '---').join(' | ') + ' |\n' + rows.map(row => '| ' + row.map(safe).join(' | ') + ' |').join('\n');
const copy = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
export function reportOptions(args) {
  const o = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--') && !o.id) { o.id = args[i]; continue; }
    const k = args[i].slice(2);
    if (['include-history', 'allow-incomplete', 'help'].includes(k)) { o[k] = true; continue; }
    if (!['root', 'run-dir', 'out', 'context', 'title', 'zip-name'].includes(k) || !args[i + 1] || args[i+1].startsWith('--')) throw Error('Invalid report option: ' + args[i]);
    if (o[k] !== undefined) throw Error('Repeated report option: ' + k); o[k] = args[++i];
  }
  if(o.id&&o['run-dir'])throw Error('Choose a run ID or --run-dir, not conflicting inputs');
  return o;
}
export function validateLinks(root, files) {
  const broken = [];
  for (const file of files) for (const m of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    const link = m[1].split('#')[0]; if (!link || /^[a-z]+:/i.test(link)) continue;
    const p = path.resolve(path.dirname(file), decodeURI(link));
    if (!within(root, p) || !fs.existsSync(p)) broken.push({ file: relative(root, file), link });
  }
  if (broken.length) throw Error('Broken entry links: ' + JSON.stringify(broken.slice(0, 12)));
  return true;
}
function copyRun(runDir, target, includeSource = false) {
  fs.cpSync(runDir, target, { recursive: true, filter: p => !(includeSource ? ['reports'] : ['source', 'reports']).includes(path.relative(runDir, p).split(path.sep)[0]) });
}
function checkFrozenInput(runDir, summary) {
  if (summary.schema_version !== '3.0') throw Error('This legacy run has no self-contained execution baseline. Its original report/ZIP remains historical evidence; do not substitute a live or private preparation snapshot.');
  const before = read(path.join(runDir, 'baseline-before.json')), after = read(path.join(runDir, 'baseline-after.json'));
  const source = read(path.join(runDir, 'source-manifest.json'));
  // A run in a delivery ZIP shares the top-level source snapshot. Native run
  // directories keep their own source child. Both are checked against the same
  // immutable manifest rather than against live project files.
  const sourceRoot = fs.existsSync(path.join(runDir, 'source')) ? path.join(runDir, 'source') : path.resolve(runDir, '../../source');
  for (const f of source) { const p = safeEvidence(sourceRoot, f.path); if (fileHash(p) !== f.sha256 || fs.statSync(p).size !== f.bytes) throw Error('Frozen source mismatch: ' + f.path); }
  for (const f of [...before.product, ...before.runner]) {
    const archived = source.find(x => x.path === f.path);
    if (!archived || archived.sha256 !== f.sha256) throw Error('Execution baseline and archived source disagree: ' + f.path);
  }
  if (manifestFingerprint(before.product) !== summary.sourceFingerprint || manifestFingerprint(before.runner) !== summary.runnerFingerprint) throw Error('Baseline fingerprints disagree with summary');
  if (unchanged(compareManifests(before.product, after.product)) !== summary.source_unchanged || unchanged(compareManifests(before.runner, after.runner)) !== summary.runner_unchanged) throw Error('Preservation booleans disagree with manifests');
  return { before, after, source, sourceRoot };
}
function attachContext(stage, filename, snapshot) {
  if (!filename) return {};
  const context = snapshot === undefined ? read(filename) : snapshot; json(path.join(stage, 'audit/review-context.json'), context);
  for (const f of context.attachments ?? []) {
    const from = path.resolve(project, f.source);
    if (!within(project, from) || /(?:^|[/\\])(?:\.git|node_modules|profiles)(?:[/\\]|$)/i.test(path.relative(project, from))) throw Error('Context attachment outside approved project evidence: ' + f.source);
    const destination = f.path;
    if (typeof destination !== 'string' || destination.includes('\\') || destination.split('/').some(p => !p || p === '.' || p === '..') || path.isAbsolute(destination) || destination.includes(':')) throw Error('Unsafe attachment path');
    const to = path.join(stage, 'audit/context', destination); if (fs.existsSync(to)) throw Error('Duplicate context attachment');
    if (!fs.statSync(from).isFile() || fs.lstatSync(from).isSymbolicLink()) throw Error('Context attachment must be a regular file'); copy(from, to);
  }
  return context;
}
export async function generateReport(options) {
  const base = path.resolve(options.root ?? (options['run-dir'] ? path.dirname(path.dirname(path.resolve(options['run-dir']))) : path.join(project, 'artifacts/git-compat')));
  const runDir = options['run-dir'] ? path.resolve(options['run-dir']) : path.join(base, 'runs', options.id ?? read(path.join(base, 'latest-run.json')).id);
  const summary = read(path.join(runDir, 'summary.json')), results = read(path.join(runDir, 'results.json')), matrix = read(path.join(runDir, 'matrix.json')).scenarios;
  if (path.basename(runDir) !== summary.id || !/^run-[\w-]+$/.test(summary.id)) throw Error('Run directory/identity disagree');
  const frozen = checkFrozenInput(runDir, summary);
  for (const r of results) if (r.run_id !== summary.id || r.source_fingerprint !== summary.sourceFingerprint || r.runner_fingerprint !== summary.runnerFingerprint) throw Error('Result provenance disagrees with the selected run: ' + r.scenario_id + '/' + r.variant_id);
  const matrixInput = summary.matrix_input ?? 'tests/git-compat/scenarios.json';
  const matrixDocument = read(safeEvidence(frozen.sourceRoot, matrixInput));
  if (JSON.stringify(matrixDocument.scenarios ?? matrixDocument) !== JSON.stringify(matrix)) throw Error('Run matrix disagrees with the archived execution input');
  const evidenceBase = path.dirname(path.dirname(runDir));
  const knownIssues = read(safeEvidence(frozen.sourceRoot, 'tests/git-compat/known-issues.json'));
  const executionIntegrity = assessRunIntegrity({ summary, results, knownIssues });
  const integrityErrors = executionIntegrity.violations.map(v => v.code + ': ' + v.detail);
  try {
    if (JSON.stringify(read(path.join(runDir, 'known-issues.json'))) !== JSON.stringify(knownIssues)) integrityErrors.push('Known-issue registry disagrees with the archived execution input');
  } catch (error) { integrityErrors.push('Known-issue registry cannot be checked: ' + error.message); }
  try { validateBundle(evidenceBase, results, matrix, summary.counts); } catch (error) { integrityErrors.push(error.message); }
  const integrityError = integrityErrors.length ? integrityErrors.join('; ') : null;
  // Explicit context or the archived selected recipe chooses prose only. Phase
  // cannot alter counts, integrity, product status or execution approval.
  const phaseContext = options.context ? read(options.context) : {};
  const reportPhase = resolveReportPhase(phaseContext, results), phaseText = phaseReportText(reportPhase);
  if (integrityError && !options['allow-incomplete']) throw Error('Run integrity rejected: ' + integrityError);
  const exportId = 'report-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  const output = validateOutputRoot(options.out ?? path.join(base, 'reports', summary.id, exportId), { projectRoot: project });
  const zipName = options['zip-name'] ?? 'Git-Layers-Validacao.zip'; if (!/^[\w.-]+\.zip$/.test(zipName)) throw Error('Unsafe ZIP filename');
  if (output===runDir||within(runDir,output)) throw Error('Report output must not modify its immutable input run');
  if (fs.existsSync(output)) throw Error('Report destination must be new; previous evidence is never overwritten: ' + output);
  fs.mkdirSync(output, { recursive: true });
  // Short staging roots accommodate legacy Windows ZIP APIs without changing Git configuration.
  const token = crypto.randomBytes(6).toString('hex'), stage = path.join(project, '.workshop', 'p-' + token), reopened = path.join(project, '.workshop', 'v-' + token);
  fs.mkdirSync(path.dirname(stage), { recursive: true }); fs.mkdirSync(stage);
  copyRun(runDir, path.join(stage, 'runs', summary.id));
  fs.cpSync(frozen.sourceRoot, path.join(stage, 'source'), { recursive: true });
  const reporterBefore = fileManifest(project, ['scripts/git-compat']);
  for (const f of reporterBefore) copy(path.join(project, f.path), path.join(stage, 'reporter', f.path));
  json(path.join(stage, 'REPORTER.json'), { created_at: new Date().toISOString(), execution_runner_fingerprint: summary.runnerFingerprint, renderer_fingerprint: sha256(JSON.stringify(reporterBefore)), files: reporterBefore, policy: 'Execution snapshot and artifact renderer are separately identified. Current authorized source changes do not invalidate an archived, unchanged execution.' });
  json(path.join(stage, 'EXECUTION-INTEGRITY.json'), { ...executionIntegrity, errors: integrityErrors, forensic_only: Boolean(options['allow-incomplete']), policy: executionIntegrity.policy + ' --allow-incomplete always produces a forensic export with report exit 2 and no test approval.' });
  const context = attachContext(stage, options.context, phaseContext), title = options.title ?? 'Relatório técnico de validação — Git Layers';
  if (reportPhase.implementation || reportPhase.source === 'explicit-context') json(path.join(stage, 'REPORT-PHASE.json'), reportPhase);
  const history = [];
  if (options['include-history'] && fs.existsSync(path.join(base, 'runs'))) for (const dir of fs.readdirSync(path.join(base, 'runs'))) {
    if (dir === summary.id) continue;
    const from = path.join(base, 'runs', dir), p = path.join(from, 'summary.json');
    if (fs.existsSync(p)) { const s = read(p); history.push(s); copyRun(from, path.join(stage, 'runs', dir), true); }
  }
  const original = read(path.join(frozen.sourceRoot, 'docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json')).scenarios;
  const missingOriginal = original.filter(s => !matrix.some(x => x.id === s.id)); if (missingOriginal.length) throw Error('Original scenario IDs disappeared');
  const findings = results.flatMap(r => (r.findings ?? []).map(f => ({ ...f, scenario_id: r.scenario_id, variant_id: r.variant_id, evidence: r.evidence.map(e => e.path), reproduction: r.reproduction })));
  const distinctFindings = [...new Set(findings.map(f => f.id).filter(Boolean))];
  json(path.join(stage, 'ACHADOS.json'), { records: findings.length, distinct_identifiers: distinctFindings.length, findings, note: 'Repeated finding IDs are manifestations, not independent product defects. Characterization PASS is separate from product support.' });
  json(path.join(stage, 'MATRIZ-COMPLETA.json'), matrix.map(s => ({ ...s, results: results.filter(r => r.scenario_id === s.id) })));
  const artifactLink = r => r.evidence.find(e => e.path.endsWith('.json') && fs.existsSync(path.join(stage, e.path)))?.path;
  const matrixText = '# Matriz completa da rodada\n\nDenominador dinâmico: ' + matrix.length + '; IDs originais preservados: ' + original.length + '. Uma variante não cobre automaticamente todas as opções/perfis do roteiro.\n\n' + table(['ID / variante', 'Fase / implementação', 'Seleção / execução', 'Produto / conhecido', 'Motivo / limites', 'Reprodução'], results.map(r => [r.scenario_id + '/' + r.variant_id, r.phase + '/' + r.implementation_status, r.selection_status + '/' + r.execution_status, r.product_status + '/' + r.known_failure, (artifactLink(r) ? '[evidências](' + artifactLink(r) + ') ' : '') + (r.nonexecution_reason ?? '') + ' ' + r.limits.join('; '), r.reproduction.command])) + '\n';
  fs.writeFileSync(path.join(stage, 'MATRIZ-COMPLETA.md'), matrixText);
  const findingText = findings.map(f => '## ' + (f.id ?? 'SEM-ID') + ' — ' + f.scenario_id + '/' + f.variant_id + '\n\n' + table(['Campo', 'Conteúdo'], ['classification', 'condition', 'command', 'expected', 'observed', 'confidence', 'source'].map(k => [k, typeof f[k] === 'string' ? f[k] : JSON.stringify(f[k])])) + '\n\nReprodução: `' + f.reproduction.command + '`. ' + phaseText.findingNext + '\n').join('\n');
  fs.writeFileSync(path.join(stage, 'ACHADOS.md'), '# Achados de produto separados da infraestrutura\n\n' + findings.length + ' registros / ' + distinctFindings.length + ' identificadores distintos. Não são ' + findings.length + ' defeitos independentes. ' + phaseText.findingsIntro + '\n\n' + findingText);
  const familyRows = [...new Set(matrix.map(s => s.family))].map(f => { const ids = matrix.filter(s => s.family === f).map(s => s.id), rs = results.filter(r => ids.includes(r.scenario_id)); return [f, ids.length, new Set(rs.filter(r => r.implementation_status === 'IMPLEMENTED').map(r => r.scenario_id)).size, rs.filter(r => r.execution_status === 'PASS').length, rs.filter(r => r.execution_status === 'FAIL').length, rs.filter(r => r.execution_status === 'ENV_BLOCKED').length]; });
  const phases = [...new Set(results.map(r => r.phase))].map(p => [p, results.filter(r => r.phase === p && r.execution_status === 'PASS').length]);
  const assertionCount = results.reduce((n, r) => n + r.assertions.length, 0);
  const eligiblePass = executionIntegrity.execution_eligible_pass && !integrityError && !options['allow-incomplete'];
  const changed = compareManifests(frozen.before.product, frozen.after.product);
  const rows = results.filter(r => Number.isFinite(r.duration_ms)).sort((a, b) => b.duration_ms - a.duration_ms);
  const contextSections = (context.sections ?? []).map(s => '## ' + s.title + '\n\n' + s.markdown + '\n').join('\n');
  const report = '# ' + title + '\n\nGerado em ' + new Date().toISOString() + ' (UTC; datas do usuário America/Sao_Paulo). Rodada **' + summary.id + '**.\n\n' +
    '## Parecer e escopo\n\n' + (eligiblePass ? 'Rodada concluída sem falha inesperada, com snapshot de execução estável.' : 'Esta seleção não constitui aprovação automática: outcome=' + summary.outcome + ', exit=' + summary.exit_code + ', modo=' + (options['allow-incomplete'] ? 'forense (--allow-incomplete; gerador exit 2)' : 'normal') + ', erro de integridade=' + (integrityError ?? 'nenhum') + '.') + ' PASS aprova a caracterização executada; não certifica o produto inteiro. ENV_BLOCKED, SPEC_ONLY, recusa e PRODUCT_GAP continuam independentes. [Confronto do encerramento e resultados](EXECUTION-INTEGRITY.json).\n\n' + phaseText.scope +
    table(['Métrica', 'Valor'], [['IDs originais preservados', original.length + '/' + original.length], ['IDs especificados nesta matriz', matrix.length], ['IDs com variante implementada', summary.counts.implemented_ids], ['IDs executados', summary.counts.executed_ids], ['Variantes totais', results.length], ['PASS / FAIL / ENV_BLOCKED', (summary.counts.execution.PASS ?? 0) + ' / ' + (summary.counts.execution.FAIL ?? 0) + ' / ' + (summary.counts.execution.ENV_BLOCKED ?? 0)], ['Seleção / outcome', summary.selected + ' / ' + summary.outcome], ['Registros de achados / IDs distintos', findings.length + ' / ' + distinctFindings.length], ['Asserções registradas', assertionCount]]) + '\n\n' +
    '## Snapshot e preservação durante a execução\n\nFonte: `' + summary.sourceFingerprint + '`. Infraestrutura: `' + summary.runnerFingerprint + '`. Produto preservado durante a execução: **' + summary.source_unchanged + '**; infraestrutura estável: **' + summary.runner_unchanged + '**. Adicionados/removidos/alterados em src: ' + JSON.stringify(changed) + '. Fontes sujas e untracked são entradas válidas; a comparação começa novamente a cada rodada. Não existe requisito de igualdade com a preparação de 18/10/2026.\n\n[Baseline inicial](runs/' + summary.id + '/baseline-before.json), [baseline final](runs/' + summary.id + '/baseline-after.json), [fontes arquivadas](source/), [manifesto de fontes](runs/' + summary.id + '/source-manifest.json). O relatório é gerado do arquivo da rodada; não depende do conteúdo atual de src nem de pasta privada de brief. [Gerador identificado separadamente](REPORTER.json).\n\n' +
    '## Ambiente e build headless\n\n[Ambiente e capacidades](runs/' + summary.id + '/environment.json). Git oficial absoluto, argv separado, fixtures próprias, HOME/config/identidade isolados e transportes locais/loopback. ' + phaseText.environment + ' Nenhum editor Electron foi aberto. ' + (fs.existsSync(path.join(runDir, 'build.json')) ? '[Build único Core/CLI/storage](runs/' + summary.id + '/build.json), com recusa de entrada src/desktop.' : 'Nenhum build de produto nesta seleção vazia deliberada.') + '\n\n' +
    contextSections + '\n## Resultados por família e fase\n\n' + table(['Família', 'IDs', 'IDs implementados', 'PASS', 'FAIL', 'ENV_BLOCKED'], familyRows) + '\n\n' + table(['Fase', 'Variantes PASS'], phases) + '\n\n[Todos os IDs e limites](MATRIZ-COMPLETA.md), [JSON](MATRIZ-COMPLETA.json), [resultados originais](runs/' + summary.id + '/results.json), [achados completos](ACHADOS.md).\n\n' +
    '## Correções, regressões e supervisor\n\nCada proposta de worker é confrontada com o encerramento real, identidade e schema. Código inesperado, sinal, timeout, truncamento e erro de spawn são falha de infraestrutura, sem XFAIL. Proposta e streams permanecem nas evidências. Seletores desconhecidos/vazios acidentais falham antes de build. --list vazio, --allow-empty e retry sem falhas possuem outcomes próprios; nenhum se torna PASS de teste. A matriz de trabalho pode crescer sem fixar o denominador histórico.\n\n' +
    '## Histórico sem fusão de aprovações\n\n' + table(['Rodada', 'Seletores completos', 'ms', 'PASS / FAIL', 'Fonte / infraestrutura estáveis'], [summary, ...history].map(s => [s.id, JSON.stringify(s.options), s.duration_ms, (s.counts.execution.PASS ?? 0) + ' / ' + (s.counts.execution.FAIL ?? 0), s.source_unchanged + ' / ' + s.runner_unchanged])) + '\n\nA tabela preserva cada rodada; os totais principais vêm exclusivamente da rodada selecionada. Evidências antigas de preparação continuam históricas, sem invalidar novas mudanças autorizadas.\n\n' +
    '## Desempenho observado\n\n' + summary.duration_ms + ' ms; ' + summary.options.jobs + ' workers concorrentes; ' + summary.worker_processes + ' workers realmente iniciados; ' + summary.counts.processes + ' comandos diretos registrados. Git interno do produto não foi instrumentado; isso não é contagem total de processos.\n\n' + table(['Variante', 'ms'], rows.slice(0, 12).map(r => [r.scenario_id + '/' + r.variant_id, r.duration_ms])) + '\n\n' +
    '## Defeitos, pendências e limites\n\n[Defeitos de produto e manifestações](ACHADOS.md) são separados das correções da infraestrutura. ' + phaseText.defects + ' Estudo documental não é certificação de opções. Os testes da suíte preexistente só são os expressamente anexados nesta entrega; não há inferência de npm test integral aprovado.\n\n' +
    '## Reprodução e evolução\n\n`node scripts/git-compat/runner.mjs --suite all --jobs ' + summary.options.jobs + ' --seed ' + summary.options.seed + '`; seletores e módulos em [selection.json](runs/' + summary.id + '/selection.json). `node scripts/git-compat/report.mjs --run-dir <rodada-arquivada> --out <pasta-nova>` não precisa do brief original. Dependências do lockfile e Git/Node são necessários para repetir produto; ZIP inclui fontes do snapshot, não node_modules/binários Electron.\n\nMudança legítima do produto começa uma nova baseline. Uma correção de defeito requer migrar a expectativa documentada para o contrato desejado, preservando a versão e evidências anteriores; nunca ampliar um catch-all para absorver comportamento inesperado. [Guia](source/docs/git-compat/README.md).\n\n' +
    '## Integridade, portabilidade e entrega\n\nNomes do ZIP usam /, com diretórios reais em leitores comuns. O arquivo é reaberto numa pasta exclusiva e confrontado com [MANIFEST.json](MANIFEST.json), resultados e links de entrada. PACKAGE-VALIDATION.json ao lado do ZIP registra o resultado observado e o hash externo, evitando autorreferência. O ZIP contém fontes, comandos/streams, esperado/observado, asserções, baselines e reprodução. Conteúdo sintético de fixtures não é dado pessoal; credenciais reais, caches e node_modules são excluídos.\n';
  fs.writeFileSync(path.join(stage, 'RELATORIO-TECNICO.md'), report);
  json(path.join(stage, 'latest-run.json'), { id: summary.id, role: 'Selected execution, not a merged history' });
  const manifest = walk(stage).map(p => ({ path: relative(stage, p), sha256: fileHash(p), bytes: fs.statSync(p).size }));
  json(path.join(stage, 'MANIFEST.json'), { created_at: new Date().toISOString(), run_id: summary.id, scenario_ids: matrix.length, original_ids_preserved: original.length, files: manifest });
  const entryNames = ['RELATORIO-TECNICO.md', 'MATRIZ-COMPLETA.md', 'ACHADOS.md']; validateLinks(stage, entryNames.map(n => path.join(stage, n)));
  const zip = path.join(output, zipName), ps = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const command = '$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & ([scriptblock]::Create([IO.File]::ReadAllText($env:GIT_COMPAT_PACKAGE_SCRIPT))) -Source $env:GIT_COMPAT_ZIP_SOURCE -Destination $env:GIT_COMPAT_ZIP_DESTINATION -CheckDirectory $env:GIT_COMPAT_ZIP_CHECK';
  const p = spawnSync(ps, ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 600000, env: { ...process.env, GIT_COMPAT_PACKAGE_SCRIPT: path.join(project, 'scripts/git-compat/package.ps1'), GIT_COMPAT_ZIP_SOURCE: stage, GIT_COMPAT_ZIP_DESTINATION: zip, GIT_COMPAT_ZIP_CHECK: reopened } });
  if (p.status !== 0) { json(path.join(output, 'PACKAGE-FAILURE.json'), { exit: p.status, error: p.error?.message, stdout: p.stdout, stderr: p.stderr }); throw Error('ZIP failed: ' + (p.stderr || p.error?.message)); }
  for (const f of manifest) { const file = safeEvidence(reopened, f.path); if (fileHash(file) !== f.sha256 || fs.statSync(file).size !== f.bytes) throw Error('Reopened ZIP hash/size mismatch: ' + f.path); }
  validateLinks(reopened, entryNames.map(n => path.join(reopened, n)));
  if (!integrityError) validateBundle(reopened, results, matrix, summary.counts);
  if (!unchanged(compareManifests(reporterBefore, fileManifest(project, ['scripts/git-compat'])))) throw Error('Artifact renderer changed during export; retry export, not product tests');
  for (const n of [...entryNames, 'MATRIZ-COMPLETA.json', 'ACHADOS.json', 'MANIFEST.json']) copy(path.join(stage, n), path.join(output, n));
  const validation = { created_at: new Date().toISOString(), run_id: summary.id, zip: zipName, sha256: fileHash(zip), bytes: fs.statSync(zip).size, manifest_files: manifest.length, all_hashes_verified: true, relative_entry_links_verified: true, results_validated: !integrityError, matrix_scenario_ids: matrix.length, original_ids_preserved: original.length, execution_eligible_pass: eligiblePass, execution_exit_code: summary.exit_code, expected_execution_exit_code: executionIntegrity.expected_exit_code, forensic_only: Boolean(options['allow-incomplete']), source_unchanged_during_execution: summary.source_unchanged, current_product_not_required_to_equal_historical_source: true };
  json(path.join(output, 'PACKAGE-VALIDATION.json'), validation); fs.writeFileSync(zip + '.sha256', validation.sha256 + '  ' + zipName + '\n');
  json(path.join(base, 'latest-report.json'), { run_id: summary.id, output, validation: path.join(output, 'PACKAGE-VALIDATION.json') });
  console.log(JSON.stringify(validation, null, 2)); if (integrityError || options['allow-incomplete']) process.exitCode = 2; return validation;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = reportOptions(process.argv.slice(2));
  if (options.help) console.log('report.mjs [run-id] --root ROOT --run-dir ARCHIVED_RUN --out NEW_DIRECTORY --context JSON --title TEXT --zip-name NAME.zip --include-history --allow-incomplete');
  else generateReport(options).catch(e => { console.error(e.stack); process.exitCode = 2; });
}
