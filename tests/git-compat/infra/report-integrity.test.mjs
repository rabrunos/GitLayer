import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assessRunIntegrity } from '../../../scripts/git-compat/report-integrity.mjs';
import { project, createFixture, cleanupFixture, isolatedEnvironment, execute, json, fileHash, relative } from '../../../scripts/git-compat/lib.mjs';
import { baseResult, counts } from '../../../scripts/git-compat/runner.mjs';
import { fileManifest, manifestFingerprint } from '../../../scripts/git-compat/audit.mjs';
import { externalFixtureParent } from '../../../scripts/git-compat/fixture-parent.mjs';

const evidenceParent = process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT ?? path.join(project, 'artifacts/git-compat/auxiliary/report-integrity');
if (!path.isAbsolute(evidenceParent)) throw Error('GIT_COMPAT_INFRA_EVIDENCE_ROOT must be absolute');
const evidence = path.join(evidenceParent, 'report-integrity-' + crypto.randomUUID());
fs.mkdirSync(evidence, { recursive: true });
console.log('REPORT_INTEGRITY_EVIDENCE=' + evidence);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

function syntheticRun(t, mode) {
  const fixture = createFixture(externalFixtureParent(project), 'report');
  t.after(() => cleanupFixture(fixture));
  const renderer = path.join(fixture.root, 'renderer');
  fs.cpSync(path.join(project, 'scripts/git-compat'), path.join(renderer, 'scripts/git-compat'), { recursive: true, errorOnExist: true, force: false });
  const root = path.join(fixture.root, 'archive'), id = 'run-synthetic-' + crypto.randomUUID(), runDir = path.join(root, 'runs', id), source = path.join(runDir, 'source');
  const matrixFile = path.join(project, 'tests/git-compat/scenarios.json'), document = read(matrixFile), matrix = document.scenarios ?? document;
  const original = path.join(project, 'docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json');
  const put = (name, data) => { const file = path.join(source, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
  put('src/synthetic.ts', '// SYNTHETIC REPORT FIXTURE ONLY; never executed as product.\n');
  put('tests/git-compat/scenarios.json', JSON.stringify(document));
  put('docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json', fs.readFileSync(original));
  put('docs/git-compat/README.md', '# Synthetic report fixture\nNo product or Git operation was executed.\n');
  const product = fileManifest(source, ['src']), sourceFingerprint = manifestFingerprint(product);
  const failed = { id: 'synthetic-semantic-oracle', expected: 'A', observed: 'B', passed: false, evidence_paths: [], contract_source: 'Synthetic infrastructure control' };
  const known = { version: 1, issues: [] };
  if (['xfail', 'xpass', 'infrastructure-xfail', 'xfail-wrong-source'].includes(mode)) known.issues.push({ id: 'SYNTHETIC-STRICT-ISSUE', scenario_id: matrix[0].id, variant_id: 'synthetic-report', source_fingerprint: mode === 'xfail-wrong-source' ? 'a'.repeat(64) : sourceFingerprint, signature: hash(JSON.stringify([{ id: failed.id, expected: failed.expected, observed: failed.observed }])) });
  put('tests/git-compat/known-issues.json', JSON.stringify(known));
  const runner = fileManifest(source, ['tests', 'docs']), runnerFingerprint = manifestFingerprint(runner);
  const baseline = { schema_version: '3.0', captured_at: new Date().toISOString(), product, runner, repository: {}, policy: 'Synthetic integrity fixture; no product or Git process' };
  json(path.join(runDir, 'baseline-before.json'), baseline); json(path.join(runDir, 'baseline-after.json'), baseline);
  json(path.join(runDir, 'source-manifest.json'), fileManifest(source, ['src', 'tests', 'docs']));
  json(path.join(runDir, 'matrix.json'), { scenarios: matrix }); json(path.join(runDir, 'known-issues.json'), known);
  json(path.join(runDir, 'environment.json'), { role: 'SYNTHETIC_INFRASTRUCTURE_NOT_PRODUCT', capabilities: { synthetic: false } });
  const info = { id, seed: 'synthetic-report', sourceFingerprint, runnerFingerprint };
  const results = matrix.map(s => baseResult(s, null, info));
  let selected = [];
  if (mode !== 'empty') {
    const result = baseResult(matrix[0], { variant: 'synthetic-report', phase: 'HARNESS', module: 'fixture' }, info);
    const environment = path.join(runDir, 'environment.json'), marker = path.join(runDir, 'evidence/assertion.txt');
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, 'synthetic evidence\n');
    Object.assign(result, { selection_status: 'SELECTED', execution_status: 'PASS', product_status: 'NOT_ASSESSED', environment_path: relative(root, environment), started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_ms: 1, nonexecution_reason: null, assertions: [{ id: 'synthetic-semantic-oracle', expected: 'A', observed: 'A', passed: true, evidence_paths: [], contract_source: 'Synthetic infrastructure control' }], evidence: [{ path: relative(root, marker), sha256: fileHash(marker), bytes: fs.statSync(marker).size }] });
    if (['fail', 'xfail', 'infrastructure-xfail', 'xfail-wrong-source'].includes(mode)) Object.assign(result, { execution_status: 'FAIL', failure_category: mode === 'infrastructure-xfail' ? 'INFRASTRUCTURE' : 'ASSERTION', assertions: [failed], error: 'Synthetic observed failure' });
    if (['xfail', 'infrastructure-xfail', 'xfail-wrong-source'].includes(mode)) Object.assign(result, { known_failure: 'XFAIL_STRICT', known_issue_id: known.issues[0].id });
    if (mode === 'xpass') Object.assign(result, { known_failure: 'XPASS_NEEDS_REVIEW', known_issue_id: known.issues[0].id });
    if (mode === 'blocked') Object.assign(result, { execution_status: 'ENV_BLOCKED', assertions: [], duration_ms: null, started_at: null, ended_at: null, nonexecution_reason: 'Synthetic runner-level capability probe absent before worker creation' });
    if (mode === 'pending') Object.assign(result, { execution_status: 'NOT_RUN', assertions: [], duration_ms: null, started_at: null, ended_at: null, nonexecution_reason: 'Synthetic unfinished selected worker' });
    results[0] = result; selected = [result];
  }
  const summary = { schema_version: '3.0', id, outcome: mode === 'empty' ? 'EMPTY_ALLOWED' : 'SELECTED', started_at: baseline.captured_at, ended_at: baseline.captured_at, duration_ms: 1, sourceFingerprint, runnerFingerprint, runnerFingerprintEnd: runnerFingerprint, source_unchanged: true, runner_unchanged: true, productDelta: { added: [], removed: [], changed: [] }, runnerDelta: { added: [], removed: [], changed: [] }, options: { jobs: 1, suite: 'harness', seed: info.seed }, counts: counts(results), selected: selected.length, worker_processes: ['blocked', 'empty'].includes(mode) ? 0 : 1, matrix_input: 'tests/git-compat/scenarios.json', exit_code: mode === 'fail' ? 1 : mode === 'xpass' ? 3 : mode === 'pending' ? 2 : 0 };
  const save = () => { summary.counts = counts(results); json(path.join(runDir, 'summary.json'), summary); json(path.join(runDir, 'results.json'), results); };
  save(); json(path.join(runDir, 'selection.json'), { outcome: summary.outcome, selected: selected.map(r => r.scenario_id + '/' + r.variant_id), options: summary.options });
  return { fixture, renderer, root, runDir, summary, results, known, save, env: isolatedEnvironment(fixture.root, process.execPath) };
}

const scenarios = [
  { name: 'valid-selected-pass', mode: 'pass', code: 0, eligible: true },
  { name: 'valid-failed-execution-remains-unapproved', mode: 'fail', code: 0, eligible: false },
  { name: 'env-blocked-only-is-administrative-success', mode: 'blocked', code: 0, eligible: false },
  { name: 'explicit-empty-is-administrative-success', mode: 'empty', code: 0, eligible: false },
  { name: 'forged-zero-exit-over-fail', mode: 'fail', mutate: f => { f.summary.exit_code = 0; }, code: 2, rejected: /EXECUTION_EXIT/u },
  { name: 'unfinished-selected-worker', mode: 'pending', mutate: f => { f.summary.exit_code = 0; }, code: 2, rejected: /SELECTED_NOT_TERMINAL/u },
  { name: 'unselected-pass-cannot-inflate-results', mode: 'pass', mutate: f => { const extra = structuredClone(f.results[0]); extra.scenario_id = f.results[1].scenario_id; extra.selection_status = 'NOT_SELECTED'; f.results[1] = extra; }, code: 2, rejected: /UNSELECTED_EXECUTED/u },
  { name: 'interrupted-run-cannot-claim-zero', mode: 'pass', mutate: f => { f.summary.outcome = 'AGENT_INTERRUPTED_DIAGNOSTIC'; f.summary.fatal = 'Synthetic controlled interruption'; }, code: 2, rejected: /EXECUTION_EXIT/u },
  { name: 'xpass-cannot-claim-zero', mode: 'xpass', mutate: f => { f.summary.exit_code = 0; }, code: 2, rejected: /EXECUTION_EXIT/u },
  { name: 'unregistered-xfail-is-rejected', mode: 'fail', mutate: f => { Object.assign(f.results[0], { known_failure: 'XFAIL_STRICT', known_issue_id: 'UNREGISTERED' }); f.summary.exit_code = 0; }, code: 2, rejected: /KNOWN_ISSUE_CLASSIFICATION/u },
  { name: 'infrastructure-cannot-use-semantic-xfail', mode: 'infrastructure-xfail', code: 2, rejected: /KNOWN_ISSUE_CLASSIFICATION/u },
  { name: 'xfail-wrong-source', mode: 'xfail-wrong-source', code: 2, rejected: /KNOWN_ISSUE_CLASSIFICATION/u },
  { name: 'xfail-wrong-signature', mode: 'xfail', mutate: f => { f.results[0].assertions[0].observed = 'C'; }, code: 2, rejected: /KNOWN_ISSUE_CLASSIFICATION/u },
  { name: 'run-registry-must-match-frozen-registry', mode: 'pass', mutate: f => { json(path.join(f.runDir, 'known-issues.json'), { version: 1, issues: [{ id: 'UNARCHIVED' }] }); }, code: 2, rejected: /Known-issue registry disagrees/u },
  { name: 'strict-registered-xfail-has-no-passed-test', mode: 'xfail', code: 0, eligible: false },
  { name: 'valid-run-allow-incomplete-is-forensic', mode: 'pass', flags: ['--allow-incomplete'], code: 2, eligible: false, forensic: true },
  { name: 'contradictory-run-allow-incomplete-is-forensic', mode: 'fail', mutate: f => { f.summary.exit_code = 0; }, flags: ['--allow-incomplete'], code: 2, eligible: false, forensic: true },
];

for (const scenario of scenarios) test('report integrity: ' + scenario.name, { timeout: 90000 }, async t => {
  const fixture = syntheticRun(t, scenario.mode); scenario.mutate?.(fixture); fixture.save();
  const assessment = assessRunIntegrity({ summary: fixture.summary, results: fixture.results, knownIssues: fixture.known });
  const output = path.join(fixture.fixture.root, 'new-report'), argv = [path.join(fixture.renderer, 'scripts/git-compat/report.mjs'), '--run-dir', fixture.runDir, '--out', output, ...(scenario.flags ?? [])];
  const result = await execute(process.execPath, argv, { cwd: fixture.renderer, env: fixture.env, timeout: 60000 });
  const evidenceDir = path.join(evidence, scenario.name); fs.mkdirSync(evidenceDir);
  fs.writeFileSync(path.join(evidenceDir, 'stdout.bin'), result.stdoutBuffer); fs.writeFileSync(path.join(evidenceDir, 'stderr.bin'), result.stderrBuffer);
  const validation = fs.existsSync(path.join(output, 'PACKAGE-VALIDATION.json')) ? read(path.join(output, 'PACKAGE-VALIDATION.json')) : null;
  json(path.join(evidenceDir, 'proof.json'), { role: 'SYNTHETIC_REPORT_CONTROL_NO_PRODUCT_OR_GIT_EXECUTION', scenario: scenario.name, expected: { code: scenario.code, destination_created: !scenario.rejected, eligible: scenario.eligible ?? null }, observed: { code: result.code, timed_out: result.timedOut, signal: result.signal, output_truncated: result.outputTruncated, duration_ms: result.duration_ms, destination_created: fs.existsSync(output), validation }, execution: { selected: fixture.summary.selected, pass: fixture.summary.counts.execution.PASS ?? 0, fail: fixture.summary.counts.execution.FAIL ?? 0, env_blocked: fixture.summary.counts.execution.ENV_BLOCKED ?? 0, worker_processes: fixture.summary.worker_processes, declared_exit: fixture.summary.exit_code }, assessment });
  if (validation) { fs.copyFileSync(path.join(output, 'PACKAGE-VALIDATION.json'), path.join(evidenceDir, 'PACKAGE-VALIDATION.json')); fs.copyFileSync(path.join(output, 'RELATORIO-TECNICO.md'), path.join(evidenceDir, 'RELATORIO-TECNICO.md')); fs.copyFileSync(path.join(output, validation.zip), path.join(evidenceDir, 'report.zip')); }
  assert.equal(result.timedOut, false); assert.equal(result.outputTruncated, false); assert.equal(result.signal, null);
  assert.equal(result.code, scenario.code, result.stderr);
  if (scenario.rejected) { assert.match(result.stderr, scenario.rejected); assert.equal(fs.existsSync(output), false, 'contradiction must be rejected before destination creation'); }
  else {
    assert.equal(validation.execution_eligible_pass, scenario.eligible); assert.equal(validation.execution_exit_code, fixture.summary.exit_code);
    assert.equal(validation.forensic_only, scenario.forensic ?? false);
    assert.equal(validation.all_hashes_verified, true); assert.equal(validation.relative_entry_links_verified, true);
    assert.equal(fileHash(path.join(output, validation.zip)), validation.sha256);
    assert.equal(validation.results_validated, !scenario.forensic || assessment.violations.length === 0);
  }
});
