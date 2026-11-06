import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readApprovedProof, PIN } from './verify-source-transition.mjs';

// External DOC/DATA postprocessing only, for one new campaign; never run workers or edit the project.
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const lines = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const fileReceipt = (root, relative) => { const bytes = fs.readFileSync(path.join(root, relative)); return { file: relative, bytes: bytes.length, sha256: sha(bytes) }; };
const clone = value => JSON.parse(JSON.stringify(value));
const args = process.argv.slice(2); assert.equal(args.shift(), '--postprocess-authorized', 'Explicit postprocessing release required');
const options = {};
while (args.length) { const key = args.shift(); assert(['--project', '--campaign', '--out'].includes(key) && !Object.hasOwn(options, key) && args.length); options[key] = args.shift(); }
for (const key of ['--project', '--campaign', '--out']) assert(options[key], 'Missing ' + key);
const project = path.resolve(options['--project']), campaign = path.resolve(options['--campaign']), out = path.resolve(options['--out']);
assert(!fs.existsSync(out), 'Postprocessing needs a new external output');
const { validateFixtureParent } = await import(pathToFileURL(path.join(project, 'scripts/git-compat/fixture-parent.mjs')).href);
validateFixtureParent(path.dirname(out), { projectRoot: project });
assert(!fs.existsSync(path.join(campaign, 'STOPPED.json')), 'An interrupted campaign needs manual review');
assert.equal(read(path.join(campaign, 'CLOSED.json')).status, 'ALL_TIMING_CONTROLLERS_CLOSED');
const binding = read(path.join(campaign, 'SOURCE-BINDING.json')), conditions = read(path.join(campaign, 'CONDITIONS.json'));
assert.equal(binding.coreTupleFingerprint, '807ad17f66e41e3147792049797a48b56c919737734bbe2a847149a07909ee8b');
assert.equal(binding.fullFunctionalFingerprint, PIN.full); assert.equal(binding.broadFunctionalFingerprint, PIN.broad); assert.equal(binding.liveFunctionalFingerprint, PIN.broad);
const approvedTransitionProof = readApprovedProof(path.join(campaign, 'SOURCE-TRANSITION-PROOF.json'), binding.sourceTransitionProofSha256);
assert.equal(approvedTransitionProof.evidence.full.resultSha256, binding.fullResultSha256); assert.equal(approvedTransitionProof.evidence.broad.resultSha256, binding.broadResultSha256);
assert.deepEqual(binding.soleChangedRecipe, approvedTransitionProof.evidence.fixedRecipe); assert.equal(binding.allSourceArchivesVerified, true);
assert.equal(binding.runnerSha256, '7800196cefe33e3f6768864beccde7d47d03b53ce615cabd786bdc79e8a40761');
assert.equal(binding.clockRunnerSha256, '6be8636d434964e1ddca42f14604f1c6828884866f8668c94c9209b277222322');
assert.equal(conditions.status, 'HOST_UNUSED_NO_GAME_USER_REPORTED'); assert.equal(conditions.actualHostProcessState, 'NOT_OBSERVED');
assert.equal(conditions.latestUserReportObservedAtUtc, '2026-11-06T01:22:29Z');
assert.deepEqual(conditions.priorUserReports, [{ state: 'GAME_OPEN_MEASUREMENT_AUTHORIZED', observedAtUtc: '2026-11-05T23:36:11Z' }, { state: 'PLAYING_STOPPED_USER_REPORTED', observedAtUtc: '2026-11-06T00:18:13Z' }]);
assert.equal(conditions.hostLoadTelemetry, 'NOT_COLLECTED'); assert.equal(conditions.ownedHeavyCampaignOverlap, false);
assert.equal(conditions.declaredAdvisoryDiskBudgetBytesPerRunner, 4294967296); assert(conditions.diskBudgetEnforcement.includes('does not enforce'));
const generator = path.join(project, 'scripts/summarize-scale.mjs'), expectedGenerator = 'f5d0e24da5d569b4d47c8e8cd0a16d055a0533b233db47f3af0885718ad12073';
assert.equal(sha(fs.readFileSync(generator)), expectedGenerator);
fs.mkdirSync(out); const base = path.join(out, 'base-generated'), publicOut = path.join(out, 'public');
const generatorArgs = [generator, '--input', path.join(campaign, 'bench'), '--out', base];
const generated = spawnSync(process.execPath, generatorArgs, { cwd: project, shell: false, windowsHide: true, encoding: null, timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
fs.writeFileSync(path.join(out, 'generator.stdout'), generated.stdout ?? Buffer.alloc(0), { flag: 'wx' });
fs.writeFileSync(path.join(out, 'generator.stderr'), generated.stderr ?? Buffer.alloc(0), { flag: 'wx' });
json(path.join(out, 'GENERATOR-PRIVATE.json'), { executable: process.execPath, argv: generatorArgs, cwd: project, pid: generated.pid ?? null, code: generated.status, signal: generated.signal, error: generated.error ? { code: generated.error.code, message: generated.error.message } : null });
assert.ifError(generated.error); assert.equal(generated.status, 0); assert.equal(generated.signal, null);
assert.equal(sha(fs.readFileSync(generator)), expectedGenerator, 'Generator changed while running');
const data = read(path.join(base, 'BENCHMARKS.json')), before = clone(data), baseMarkdown = fs.readFileSync(path.join(base, 'BENCHMARKS.md'), 'utf8');
assert.equal(data.reportGeneratorSha256, expectedGenerator); assert.equal(data.baselineCommit, binding.baselineCommit);
assert.deepEqual(data.phases.map(p => p.label), ['baseline', 'final']); assert.deepEqual(data.primaryOverrides, []); assert.deepEqual(data.supplementaryCampaigns, []);
for (const field of ['allocationProbe', 'volumeSupplement', 'environmentReceipt']) assert.equal(data[field], null, 'No historical auxiliary input is allowed');
const a = data.phases[0], b = data.phases[1];
assert.equal(a.metadata.sourceFingerprint, binding.baselineBenchmarkFingerprint); assert.equal(b.metadata.sourceFingerprint, binding.finalBenchmarkFingerprint);
assert.equal(a.metadata.runnerSha256, binding.runnerSha256); assert.equal(b.metadata.runnerSha256, binding.runnerSha256);
assert.deepEqual(a.metadata.runnerDependencies, b.metadata.runnerDependencies); assert.deepEqual(a.metadata.platform, b.metadata.platform);
assert.equal(a.metadata.observerVersion, b.metadata.observerVersion); assert.equal(a.metadata.compilerVersion, b.metadata.compilerVersion);
assert.equal(data.compilerVersionObservedDuringCampaign, 'esbuild ' + a.metadata.compilerVersion);
assert.equal(a.metadata.platform.node, 'v24.14.1'); assert.equal(a.metadata.platform.git, 'git version 2.53.0.windows.2');
const expectedIds = new Set(conditions.cases.map(c => c.id));
for (const phase of data.phases) { assert.equal(phase.cases.length, expectedIds.size); for (const c of phase.cases) assert(expectedIds.has(c.id) && c.status !== 'NOT_RUN'); }
const legacyChanges = [
  [0, 'Complete Core API calls; no CLI startup.', 'Complete Core API calls; no CLI startup. Both baseline and corrected Core use the same frozen current observer in one new fixed-order campaign. There are no v1 inputs, primary overrides or historical auxiliary campaigns. Source/runtime and observer hashes are recorded separately.'],
  [2, 'Baseline 10/100 reactivation/off use n3;', 'Both phases request three same-fixture off/reactivation cycles for 10/100/1000 files; first activation remains n1. Large, multilayer and 10000-file cases use one cycle. Actual completed sample counts are authoritative; repetitions are not independent fresh fixtures or proof of statistical stability. No p95 or significance claim.'],
  [3, 'Fixed baseline-then-final order,', 'Fixed baseline-then-current order per case, warm filesystem after setup and no OS cache eviction. The user reported the PC unused and no playing; the latest report is the primary campaign condition, with earlier messages kept only as history. Fixed order, cache and temporal variation limit causal attribution.'],
  [10, 'Benchmark DriveInfo observed C: NTFS;', 'Both phases use the current endpoint file-data allocation observer via blocks*512 with dev/inode deduplication where valid. No old allocation probe, volume receipt or v1 endpoint is imported. This is OS-reported regular-file data allocation, not unique extents, total-volume physical cost, peak disk, device IO or a filesystem quota.'],
];
let markdown = baseMarkdown;
for (const [index, prefix, replacement] of legacyChanges) {
  assert(data.limitations[index].startsWith(prefix), 'Unexpected legacy qualification');
  const previous = data.limitations[index]; assert.equal(markdown.split(previous).length - 1, 1);
  data.limitations[index] = replacement; markdown = markdown.replace(previous, replacement);
}
const replaceParagraph = (prefix, replacement) => {
  const found = markdown.split('\n\n').filter(p => p.trimStart().startsWith(prefix)); assert.equal(found.length, 1, 'Unique legacy Markdown paragraph');
  markdown = markdown.replace(found[0], replacement);
};
replaceParagraph('Validation indexes identifica somente', 'Validation indexes identifica somente transactions/ID/activation-UUID.index; initialization indexes identifica transactions/ID/register-UUID.index. MAIN e os \u00edndices privados t\u00eam categorias separadas. Ambos os endpoints usam o mesmo invent\u00e1rio atual, com validade e unidades declaradas; nenhum probe antigo de aloca\u00e7\u00e3o foi incorporado. Hardlinks n\u00e3o s\u00e3o adotados como c\u00f3pias independentes.');
replaceParagraph('Nos cen\u00e1rios finais, cada ativa\u00e7\u00e3o/desativa\u00e7\u00e3o conclu\u00edda', 'Nas duas fontes desta nova campanha, cada ativa\u00e7\u00e3o/desativa\u00e7\u00e3o conclu\u00edda possui recibo em operationProofs: HEAD, refs de branches, MAIN sem\u00e2ntico e blobs Git ou aus\u00eancias, conferidos fora do rel\u00f3gio. Timeout posterior conserva as provas completas, mas n\u00e3o aprova o cen\u00e1rio inteiro.');
function redactTermination(process) {
  const t = process?.termination; if (!t || !Object.hasOwn(t, 'tree_error')) return;
  assert(typeof t.tree_error === 'string' || t.tree_error === null);
  const text = t.tree_error ?? '';
  t.tree_error = text ? '<REDACTED_NONEMPTY_PROCESS_DIAGNOSTIC>' : t.tree_error;
  t.tree_errorPrivateProjection = { nonempty: Boolean(text), bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)), rawTextPublished: false };
}
for (const phase of data.phases) for (const c of phase.cases) redactTermination(c.process);
function protectedPayload(value) {
  const phases = clone(value.phases);
  for (const phase of phases) for (const c of phase.cases) if (c.process?.termination && Object.hasOwn(c.process.termination, 'tree_error')) { c.process.termination.tree_error = '<DIAGNOSTIC_TEXT_EXCLUDED>'; delete c.process.termination.tree_errorPrivateProjection; }
  return { phases, comparisons: value.comparisons, primaryOverrides: value.primaryOverrides, supplementaryCampaigns: value.supplementaryCampaigns };
}
const originalPayloadHash = sha(Buffer.from(JSON.stringify(protectedPayload(before))));
assert.equal(sha(Buffer.from(JSON.stringify(protectedPayload(data)))), originalPayloadHash, 'Metrics, statuses and comparisons changed');
function clockPhase(phase) {
  const root = path.join(campaign, 'clock', phase), folder = path.join(root, 'layers1-files1000'), config = read(path.join(root, 'config.json'));
  assert.equal(config.runnerSha256, binding.clockRunnerSha256); assert.deepEqual(config.instrumentation, { apiClock: true, fs: false, spawn: false, methods: false, rssSampler: false });
  assert.equal(config.samples, 1); assert.equal(config.sourceFingerprint, phase === 'baseline' ? binding.baselineBenchmarkFingerprint : binding.finalBenchmarkFingerprint);
  const process = read(path.join(folder, 'process.json')), result = fs.existsSync(path.join(folder, 'result.json')) ? read(path.join(folder, 'result.json')) : null;
  const samples = result?.samples ?? lines(path.join(folder, 'samples.jsonl'));
  for (const sample of samples) for (const key of ['git', 'io', 'phases', 'resources']) assert.equal(sample[key], null, 'Clock-only must not invent profiler telemetry');
  let native = result?.nativeObserverCommands ?? [];
  const template = native.flatMap(r => r.args).find(arg => arg.startsWith('--template='));
  if (template) native = JSON.parse(JSON.stringify(native).replaceAll(JSON.stringify(path.dirname(template.slice('--template='.length))).slice(1, -1), '<FIXTURE>'));
  redactTermination(process);
  const status = process.timedOut ? 'TIMEOUT' : result?.status === 'PASS' && process.code === 0 && !process.signal && !process.outputTruncated ? 'PASS' : result?.status ?? 'INCOMPLETE';
  return { phase, status, sourceFingerprint: config.sourceFingerprint, runnerSha256: config.runnerSha256, instrumentation: config.instrumentation, process, samples, nativeOracleCommands: native, operationProofs: lines(path.join(folder, 'operation-proofs.jsonl')), rawPrivateEvidence: ['config.json'].map(file => fileReceipt(root, file)).concat(['result.json', 'process.json', 'samples.jsonl', 'operation-proofs.jsonl'].filter(file => fs.existsSync(path.join(folder, file))).map(file => fileReceipt(folder, file))) };
}
const clock = { schema: 1, scope: 'Separate fresh-fixture complete-API clock-only1000 pair; n1 per completed operation; never pooled or used as profiler overhead correction', phases: ['baseline', 'current'].map(clockPhase) };
const publicBinding = Object.fromEntries(['driverSha256', 'fullResultSha256', 'broadResultSha256', 'fullManifestSha256', 'fullFunctionalFingerprint', 'broadFunctionalFingerprint', 'liveFunctionalFingerprint', 'sourceTransitionProofSha256', 'soleChangedRecipe', 'unchangedExecutedFullCorpusFingerprint', 'unchangedHelperFingerprint', 'allSourceArchivesVerified', 'coreTupleFingerprint', 'coreTupleAlgorithm', 'finalCoreCount', 'finalBenchmarkFingerprint', 'finalInputs', 'baselineCommit', 'baselineBenchmarkFingerprint', 'baselineInputs', 'runnerSha256', 'clockRunnerSha256'].map(key => [key, binding[key]]));
publicBinding.sourceArchive = '<APPROVED_FULL_SOURCE_ARCHIVE>';
const selfSha = sha(fs.readFileSync(fileURLToPath(import.meta.url)));
data.sourceTransitionQualification = 'Full603 actually ran on the original full fingerprint; the later whole broad uses a new fingerprint with one reviewed matrix-only recipe port. Runtime/Core, executed full corpus/helpers and all other233 functional inputs are exact. No full run on the later complete fingerprint is claimed.';
data.campaignConditions = conditions; data.currentSourceBinding = publicBinding; data.separateClockPair = clock;
data.additionalQualifications = ['This new campaign contains no V7 metrics, old controls, v1 baseline or primary override. Historical V7 stays separately linked.', 'Declared 4 GiB disk budget is advisory runner metadata, not an enforced filesystem quota or hard physical stop.', 'Only legacy qualifications and diagnostic privacy text are transformed; all metric values, outcome/status fields and comparison rows are preserved.'];
data.documentPostprocessing = { scope: 'New-campaign-only qualification and privacy projection; no runtime/raw-data mutation', baseGeneratorSha256: expectedGenerator, postprocessorSha256: selfSha, baseGeneratedJsonSha256: sha(fs.readFileSync(path.join(base, 'BENCHMARKS.json'))), baseGeneratedMarkdownSha256: sha(Buffer.from(baseMarkdown)), protectedMetricStatusComparisonPayloadSha256: originalPayloadHash, protectedPayloadPreserved: true, excludedDiagnosticFieldOnly: 'phases[*].cases[*].process.termination.tree_error; projected as nonempty/bytes/hash', qualificationIndicesChanged: legacyChanges.map(c => c[0]), importedHistoricalCampaigns: false };
const marker = '| Cen\u00e1rio | Opera\u00e7\u00e3o |'; assert.equal(markdown.split(marker).length - 1, 1);
const intro = 'Esta campanha mede o Core corrigido, com a mesma vers\u00e3o do observador nos dois endpoints e ordem fixa baseline\u2192Core por cen\u00e1rio. PC sem uso e sem jogo, conforme informado pelo usu\u00e1rio no relato observado pelo coordenador \u00e0s 01:22:29 UTC de 06/11/2026. A ordem, o cache e a varia\u00e7\u00e3o temporal limitam a atribui\u00e7\u00e3o causal.\n\n' +
  'Primeira ativa\u00e7\u00e3o permanece n1; os ciclos n3 de 10/100/1000 repetem a mesma fixture. Casos grandes e compostos s\u00e3o n1. O hist\u00f3rico [V7 pr\u00e9-corre\u00e7\u00e3o](BENCHMARKS-V7-PRE-CORRECTION.md) e seus controles n\u00e3o entram nestas compara\u00e7\u00f5es. [Recibo da campanha](BENCHMARKS-CAMPAIGN-RECEIPT.json).\n\n';
markdown = markdown.replace(marker, intro + marker);
markdown += '\n## Calibra\u00e7\u00e3o separada sem profiler\n\nChamadas completas em fixtures novas, n1 por opera\u00e7\u00e3o conclu\u00edda. Or\u00e1culos Git ficam fora do rel\u00f3gio. N\u00e3o h\u00e1 contadores Core de Git/FS/fases/RSS nesta campanha, e seus tempos n\u00e3o corrigem nem integram as medianas instrumentadas.\n\n| API | Baseline ms | Core22 ms |\n| --- | ---: | ---: |\n';
for (const operation of ['first-on-register-layer0', 'off', 'on-reactivation-no-cache']) {
  const values = clock.phases.map(p => { const rows = p.samples.filter(s => s.operation === operation); assert(rows.length <= 1); return rows.length ? rows[0].durationMs.toFixed(4) : '\u2014'; });
  markdown += '| ' + [operation, ...values].join(' | ') + ' |\n';
}
markdown += '\nFonte Core22 por tuplas caminho/hash: ' + binding.coreTupleFingerprint + '. Fingerprint pr\u00f3prio do benchmark: ' + binding.finalBenchmarkFingerprint + '. S\u00e3o dom\u00ednios distintos; cada manifesto permanece no JSON.\n\nO gerador base e o p\u00f3s-processador externo, os comandos normalizados, as condi\u00e7\u00f5es e os hashes brutos privados s\u00e3o identificados no recibo. Qualifica\u00e7\u00f5es legadas e texto de diagn\u00f3stico de processos foram ajustados sem alterar amostras, contadores, resultados ou compara\u00e7\u00f5es. O or\u00e7amento de 4 GiB \u00e9 metadado consultivo; o runner n\u00e3o aplica quota f\u00edsica.\n';
markdown += '\nA full de 603 testes pertence ao fingerprint ' + PIN.full + '; a nova broad completa pertence ao fingerprint ' + PIN.broad + '. A [prova de transi\u00e7\u00e3o restrita](SOURCE-TRANSITION-PROOF.json) verifica uma \u00fanica receita de matriz fora do corpus da full, com 233 outras entradas e Core/corpus/helpers exatos. N\u00e3o se atribui a full ao novo fingerprint completo.\n';
assert.equal(sha(Buffer.from(JSON.stringify(protectedPayload(data)))), originalPayloadHash);
const privacy = (value, key = '') => {
  assert(!/^(?:pid|ppid|processId|parentProcessId)$/iu.test(key), 'Actual process identifier field');
  if (typeof value === 'string') { assert(!/(?:(?<![A-Za-z])[A-Za-z]:[\\/]+[A-Za-z0-9_]|\/(?:Users|home|tmp|var\/tmp)\/|AppData|rabrunos|gl-perf-(?:baseline|current)-|S-1-\d+(?:-\d+)+|ghp_[A-Za-z0-9]{20}|github_pat_[A-Za-z0-9_]{20}|AKIA[A-Z0-9]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:PID|PPID)\s*[:=]?\s*\d+\b)/iu.test(value), 'Private path/process diagnostic/credential string remains'); return; }
  if (Array.isArray(value)) value.forEach(v => privacy(v)); else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) privacy(v, k);
};
privacy(data); privacy(markdown); assert(!/\bundefined\b/u.test(markdown));
const receipt = { schema: 1, status: 'POSTPROCESSED_NOT_PUBLISHED', baseGenerator: { file: 'scripts/summarize-scale.mjs', sha256: expectedGenerator }, postprocessor: { file: path.basename(fileURLToPath(import.meta.url)), sha256: selfSha }, command: { executable: '<NODE.EXE>', cwd: '<PROJECT>', argv: ['<PROJECT>/scripts/summarize-scale.mjs', '--input', '<CAMPAIGN>/bench', '--out', '<BASE-STAGING>'], exitCode: generated.status, signal: generated.signal }, protectedMetricStatusComparisonPayloadSha256: originalPayloadHash, protectedPayloadPreserved: true, statusesUnchanged: true, qualificationIndicesChanged: legacyChanges.map(c => c[0]), diagnosticPrivacyProjection: 'tree_error raw text excluded; nonempty, byte length and SHA-256 preserved; original process files unchanged', conditions, sourceBinding: publicBinding, separateClockPair: clock, rawPrivateFiles: ['CONDITIONS.json', 'SOURCE-BINDING.json', 'CLOSED.json', 'V7-PRESERVATION.json', 'SOURCE-TRANSITION-PROOF.json'].map(file => fileReceipt(campaign, file)), privacyAudit: 'PASS', noRuntimeOrRawFileChanges: true, noHistoricalCampaignsImported: true };
receipt.sourceTransitionProof = { file: 'SOURCE-TRANSITION-PROOF.json', sha256: binding.sourceTransitionProofSha256, fullFunctionalFingerprint: PIN.full, broadFunctionalFingerprint: PIN.broad, fullRunOnNewFingerprintClaimed: false };
privacy(approvedTransitionProof); privacy(receipt); fs.mkdirSync(publicOut);
fs.copyFileSync(path.join(campaign, 'SOURCE-TRANSITION-PROOF.json'), path.join(publicOut, 'SOURCE-TRANSITION-PROOF.json'), fs.constants.COPYFILE_EXCL);
assert.equal(sha(fs.readFileSync(path.join(publicOut, 'SOURCE-TRANSITION-PROOF.json'))), binding.sourceTransitionProofSha256);
json(path.join(publicOut, 'BENCHMARKS.json'), data); fs.writeFileSync(path.join(publicOut, 'BENCHMARKS.md'), markdown, { flag: 'wx' });
receipt.publicFiles = ['BENCHMARKS.json', 'BENCHMARKS.md', 'SOURCE-TRANSITION-PROOF.json'].map(file => fileReceipt(publicOut, file));
json(path.join(publicOut, 'BENCHMARKS-CAMPAIGN-RECEIPT.json'), receipt);
process.stdout.write(JSON.stringify({ publicOutput: publicOut, postprocessorSha256: selfSha, protectedPayloadPreserved: true, files: receipt.publicFiles }) + '\n');
