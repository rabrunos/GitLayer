import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { build } from 'esbuild';
import { project, resolveGit, isolatedEnvironment, createFixture, cleanupFixture, execute, json, relative, walk, fileHash, sha256, within } from './lib.mjs';
import { loadMatrix, matrixPath, loadCases, runnerInputs } from './registry.mjs';
import { parseArgs, selectCases, selectionOutcome } from './selection.mjs';
import { captureBaseline, snapshotSources, compareManifests, unchanged, manifestFingerprint } from './audit.mjs';
import { baseResult, counts, classifyKnown, validateBundle } from './runner.mjs';
import { reconcileWorkerResult } from './supervisor.mjs';
import { validateOutputRoot } from './output-root.mjs';

const inScope = s => ['OFFICIAL_GIT_HEADLESS', 'HARNESS_HEADLESS', 'OFFICIAL_CONTRIB_IF_PROVEN'].includes(s.scope);
export async function runMain(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) { console.log('Headless validation: --suite smoke|affected|daily|broad|optional|stress|all|harness --id IDs --family FAMILIES --command COMMANDS --profile PROFILES --tier TIERS --capability CAPS --module MODULES --matrix PATH --jobs 1..4 --seed SEED --retry-failed RESULTS --list --allow-empty --keep-fixtures --out ROOT'); return; }
  const selectedMatrixPath = path.resolve(options.matrix ?? matrixPath);
  if (!within(project, selectedMatrixPath)) throw Error('--matrix must be a versionable input inside this checkout');
  const matrix = loadMatrix(selectedMatrixPath), cases = await loadCases(undefined, { matrix });
  const selected = selectCases(cases, matrix, options).filter(c => inScope(matrix.find(s => s.id === c.id)));
  const outcome = selectionOutcome(selected, options);
  if (options.list) { console.log(JSON.stringify({ outcome, options, specified: matrix.length, implemented_cases: cases.length, selected: selected.map(({ run, ...c }) => c), omitted: cases.filter(c => !selected.includes(c)).map(c => c.id + '/' + c.variant), spec_only: matrix.filter(s => !cases.some(c => c.id === s.id)).map(s => ({ id: s.id, scope: s.scope, title: s.title })) }, null, 2)); return; }
  const started = Date.now(), id = 'run-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
  const packageRoot = validateOutputRoot(options.out ?? path.join(project, 'artifacts/git-compat'), { projectRoot: project });
  const runDir = path.join(packageRoot, 'runs', id); fs.mkdirSync(runDir, { recursive: true });
  const workParent = path.join(project, '.workshop/git-compat', id); fs.mkdirSync(workParent, { recursive: true });
  const gitPath = resolveGit(), inputs = runnerInputs(selectedMatrixPath), before = captureBaseline({ runnerInputs: inputs, gitPath });
  json(path.join(runDir, 'baseline-before.json'), before);
  const archived = snapshotSources(runDir,{extraInputs:[relative(project,selectedMatrixPath)]});
  const archivedByPath = new Map(archived.map(f => [f.path, f]));
  for (const f of [...before.product, ...before.runner]) {
    if (archivedByPath.get(f.path)?.sha256 !== f.sha256) throw Error('Input changed while archiving: ' + f.path);
  }
  // The selected matrix can be outside the normal source tree, so archive its exact bytes too.
  json(path.join(runDir, 'matrix.json'), { scenarios: matrix });
  const sourceFingerprint = manifestFingerprint(before.product), runnerFingerprint = manifestFingerprint(before.runner);
  const run = { id, seed: options.seed, sourceFingerprint, runnerFingerprint };
  const registry = JSON.parse(fs.readFileSync(path.join(project, 'tests/git-compat/known-issues.json'), 'utf8'));
  json(path.join(runDir, 'known-issues.json'), registry);
  const selectedKeys = new Set(selected.map(c => c.id + '/' + c.variant));
  const results = matrix.flatMap(s => {
    const variants = cases.filter(c => c.id === s.id);
    return (variants.length ? variants : [null]).map(c => {
      const r = baseResult(s, c, run);
      if (!inScope(s)) { r.selection_status = 'OUT_OF_SCOPE_CURRENT_PHASE'; r.nonexecution_reason = s.scope + ': ' + s.scope_reason; r.product_status = s.scope === 'FUTURE_LAYOUT_SPECIFICATION' ? 'PENDING_PRODUCT_SPEC' : 'NOT_ASSESSED'; }
      else if (c && selectedKeys.has(c.id + '/' + c.variant)) { r.selection_status = 'SELECTED'; r.product_status = c.productStatus ?? 'NOT_ASSESSED'; r.environment_path = 'runs/' + id + '/environment.json'; }
      return r;
    });
  });
  const queue = results.filter(r => r.selection_status === 'SELECTED');
  json(path.join(runDir, 'selection.json'), { outcome, options, selected: queue.map(r => r.scenario_id + '/' + r.variant_id), omitted: results.filter(r => r.selection_status !== 'SELECTED').map(r => ({ id: r.scenario_id, variant: r.variant_id, reason: r.nonexecution_reason })) });
  let workerProcesses = 0, fatal;
  try {
    const inventoryFixture = createFixture(workParent, 'inventory'), env = isolatedEnvironment(inventoryFixture.root, gitPath);
    let capabilities, environment;
    try {
      const gitVersion = await execute(gitPath, ['version', '--build-options'], { cwd: inventoryFixture.root, env });
      const inventory = await execute(gitPath, ['help', '-a', '--no-aliases', '--no-external-commands'], { cwd: inventoryFixture.root, env });
      if (gitVersion.code !== 0 || inventory.code !== 0) throw Error('Official Git inventory failed');
      capabilities = { git: true, node: true, 'local-transport': true, win32: process.platform === 'win32', sha1: true };
      for (const [name, arg] of [['sha256', '--object-format=sha256'], ['reftable', '--ref-format=reftable']]) { const r = await execute(gitPath, ['init', arg, path.join(inventoryFixture.root, name)], { cwd: inventoryFixture.root, env }); capabilities[name] = r.code === 0; }
      try { fs.writeFileSync(path.join(inventoryFixture.root, 'target'), 'synthetic'); fs.symlinkSync(path.join(inventoryFixture.root, 'target'), path.join(inventoryFixture.root, 'link')); capabilities.symlink = true; } catch { capabilities.symlink = false; }
      environment = { gitPath, gitVersion: gitVersion.stdout, node: process.version, nodeExecutable: process.execPath, platform: process.platform, release: os.release(), arch: process.arch, availableParallelism: os.availableParallelism(), capabilities, inventory: inventory.stdout, configPolicy: 'Native Git is isolated per child. Current Core preserves GIT_CONFIG_NOSYSTEM/GIT_CONFIG_SYSTEM/GIT_CONFIG_GLOBAL isolation controls; archived product sources determine the actual policy. No host/global Git configuration is modified.', guiLaunched: false };
      json(path.join(runDir, 'environment.json'), environment);
    } finally { cleanupFixture(inventoryFixture); }
    if (queue.length) {
      const buildDir = path.join(workParent, 'build');
      const frozenRoot = path.join(runDir, 'source');
      const built = await build({ entryPoints: { core: path.join(frozenRoot, 'src/core/index.ts'), cli: path.join(frozenRoot, 'src/cli/index.ts'), storage: path.join(frozenRoot, 'src/core/storage.ts') }, outdir: buildDir, bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: 'external', metafile: true, outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
      if (Object.keys(built.metafile.inputs).some(p => p.replaceAll('\\', '/').includes('src/desktop/'))) throw Error('Desktop entered headless build');
      json(path.join(runDir, 'build.json'), { sourceFingerprint, runnerFingerprint, source_basis: 'archived_source_snapshot', outputs: walk(buildDir).map(p => ({ path: relative(buildDir, p), sha256: fileHash(p) })), inputs: Object.keys(built.metafile.inputs), builtOnce: true });
      let cursor = 0;
      const workerOutcomes = await Promise.allSettled(Array.from({ length: options.jobs }, async () => {
        while (cursor < queue.length) {
          const result = queue[cursor++], c = cases.find(c => c.id === result.scenario_id && c.variant === result.variant_id);
          const unprobed = (c.capabilities ?? []).filter(cap => !(cap in capabilities));
          if (unprobed.length) throw Error('Capability has no probe: ' + unprobed.join(', '));
          const absent = (c.capabilities ?? []).filter(cap => !capabilities[cap]);
          if (absent.length) { result.execution_status = 'ENV_BLOCKED'; result.product_status = 'NOT_ASSESSED'; result.nonexecution_reason = 'Probed capabilities absent: ' + absent.join(', '); continue; }
          const key = result.scenario_id + '--' + result.variant_id.replace(/[^\w-]/g, '_') + '-' + sha256(result.scenario_id + '/' + result.variant_id).slice(0, 10), artifactDir = path.join(runDir, 'cases', key);
          fs.mkdirSync(artifactDir, { recursive: true });
          const fixture = createFixture(workParent, 'f-' + sha256(key).slice(0, 8)), fixtureEnv = isolatedEnvironment(fixture.root, gitPath);
          const config = { ...run, result, module: c.module, matrix, caseKey: result.scenario_id + '/' + result.variant_id, fixture, repo: path.join(fixture.root, 'repo'), root: fixture.root, gitPath, buildDir, artifactDir, packageRoot, env: fixtureEnv, commandTimeoutMs:c.commandTimeoutMs, cliTimeoutMs:c.cliTimeoutMs, keepFixtures: Boolean(options['keep-fixtures']) };
          const configPath = path.join(fixture.root, 'worker-config.json'); json(configPath, config);
          let execution, executionError;
          try { workerProcesses++; execution = await execute(process.execPath, [path.join(project, 'scripts/git-compat/worker.mjs'), configPath], { cwd: project, env: fixtureEnv, timeout: (c.timeout ?? 60000) + 15000 }); } catch (e) { executionError = e; }
          const resultFile = path.join(artifactDir, 'result.json');
          Object.assign(result, reconcileWorkerResult({ baseResult: result, execution, executionError, resultFile, artifactDir, packageRoot }));
          const issue = registry.issues.find(i => i.scenario_id === result.scenario_id && i.variant_id === result.variant_id && i.source_fingerprint === sourceFingerprint);
          Object.assign(result, classifyKnown(result, issue));
          try { if (!options['keep-fixtures']) { cleanupFixture(fixture); result.cleanup = 'OWNED_FIXTURE_REMOVED'; } else result.cleanup = 'RETAINED_OWNED_FIXTURE'; }
          catch (e) { result.cleanup = e.message; result.execution_status = 'FAIL'; result.product_status = 'TEST_GAP'; result.failure_category = 'INFRASTRUCTURE'; result.known_failure = 'NONE'; result.known_issue_id = null; }
          json(resultFile, result);
          fs.appendFileSync(path.join(runDir, 'progress.jsonl'), JSON.stringify({ id: result.scenario_id, variant: result.variant_id, status: result.execution_status, product: result.product_status, duration_ms: result.duration_ms }) + '\n');
          console.log(result.execution_status + ' ' + result.scenario_id + '/' + result.variant_id + ' ' + Math.round(result.duration_ms ?? 0) + 'ms ' + result.product_status);
        }
      }));
      const rejected = workerOutcomes.filter(r => r.status === 'rejected');
      if (rejected.length) throw new AggregateError(rejected.map(r => r.reason), 'Worker supervisors failed; every started supervisor has settled');
    }
  } catch (e) { fatal = String(e.stack ?? e); }
  const after = captureBaseline({ runnerInputs: inputs, gitPath }), productDelta = compareManifests(before.product, after.product), runnerDelta = compareManifests(before.runner, after.runner);
  json(path.join(runDir, 'baseline-after.json'), after);
  const sourceUnchanged = unchanged(productDelta), runnerUnchanged = unchanged(runnerDelta);
  const summary = { schema_version: '3.0', id, outcome: fatal ? 'INFRASTRUCTURE_ERROR' : outcome, started_at: new Date(started).toISOString(), ended_at: new Date().toISOString(), duration_ms: Date.now() - started, sourceFingerprint, runnerFingerprint, runnerFingerprintEnd: manifestFingerprint(after.runner), runner_unchanged: runnerUnchanged, source_unchanged: sourceUnchanged, productDelta, runnerDelta, options, counts: counts(results), selected: queue.length, worker_processes: workerProcesses, matrix_input: relative(project, selectedMatrixPath), baseline: 'baseline-before.json', source_snapshot: 'source-manifest.json', fatal };
  json(path.join(runDir, 'results.json'), results); fs.writeFileSync(path.join(runDir, 'results.jsonl'), results.map(r => JSON.stringify(r)).join('\n') + '\n');
  try { validateBundle(packageRoot, results, matrix, summary.counts); } catch (e) { summary.validation_error = String(e.stack ?? e); }
  summary.exit_code = fatal || summary.validation_error || !sourceUnchanged || !runnerUnchanged ? 2 : results.some(r => r.execution_status === 'FAIL' && r.known_failure !== 'XFAIL_STRICT') ? 1 : results.some(r => r.known_failure === 'XPASS_NEEDS_REVIEW') ? 3 : 0;
  json(path.join(runDir, 'summary.json'), summary);
  json(path.join(packageRoot, 'latest-run.json'), { id, summary: 'runs/' + id + '/summary.json', results: 'runs/' + id + '/results.json', outcome: summary.outcome, exit_code: summary.exit_code });
  console.log(JSON.stringify(summary, null, 2)); process.exitCode = summary.exit_code;
}
