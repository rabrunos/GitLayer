import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { reconcileWorkerResult } from '../../../scripts/git-compat/supervisor.mjs';
import { cleanupFixture, createFixture, execute, fileHash, isolatedEnvironment, json, project, relative, sha256, validateResult } from '../../../scripts/git-compat/lib.mjs';
import { classifyKnown } from '../../../scripts/git-compat/runner.mjs';

const id = 'supervisor-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
const evidenceParent = process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT;
if (evidenceParent && !path.isAbsolute(evidenceParent)) throw Error('GIT_COMPAT_INFRA_EVIDENCE_ROOT must be absolute');
const packageRoot = evidenceParent ? path.join(evidenceParent, id) : path.join(project, 'artifacts/git-compat/auxiliary/review-r02', id);
const group = createFixture(path.join(project, '.workshop/git-compat-infra'), 'supervisor');
const worker = path.join(project, 'tests/git-compat/fixtures/supervisor-worker.mjs');
const environmentPath = 'environment.json';
json(path.join(packageRoot, environmentPath), { role: 'Synthetic supervisor controls, no product or Git execution', platform: process.platform, node: process.version, nodeExecutable: process.execPath, isolatedEnvironment: true });
const controls = [];
let sequence = 0;
console.log('SUPERVISOR_EVIDENCE=' + relative(project, packageRoot));
after(() => {
  json(path.join(packageRoot, 'controls.json'), { role: 'Real execute() outcomes reconciled by the reusable worker supervisor; synthetic case IDs are not catalog coverage', controls });
  cleanupFixture(group);
});

async function run(mode, { maxOutput = 8192, timeout = 5000, killOnReady = false, missingExecutable = false } = {}) {
  const fixture = createFixture(group.root, mode), artifactDir = path.join(packageRoot, String(++sequence).padStart(2, '0') + '-' + mode);
  fs.mkdirSync(artifactDir);
  // Node-only controls: this anchors the allowlisted PATH without discovering
  // or invoking Git. HOME/config/temp are still exclusive synthetic fixtures.
  const env = isolatedEnvironment(fixture.root, process.execPath);
  const baseResult = {
    schema_version: '2.0', run_id: id, scenario_id: 'HARNESS-900', variant_id: 'supervisor-' + mode,
    phase: 'HARNESS', scope: 'HARNESS_HEADLESS', requirement_ids: [], implementation_status: 'IMPLEMENTED', selection_status: 'SELECTED', execution_status: 'NOT_RUN', product_status: 'NOT_ASSESSED', known_failure: 'NONE', known_issue_id: null,
    source_fingerprint: sha256('synthetic-source'), runner_fingerprint: sha256('synthetic-runner'), environment_path: environmentPath,
    started_at: null, ended_at: null, duration_ms: null, commands: [], assertions: [], evidence: [], limits: [],
    reproduction: { command: 'node --test tests/git-compat/infra/supervisor.test.mjs', seed: 'supervisor-controls', fixture_recipe_path: 'source/tests/git-compat/fixtures/supervisor-worker.mjs' }, nonexecution_reason: 'Synthetic selected worker has not run',
  };
  const configPath = path.join(fixture.root, 'worker-config.json');
  json(configPath, { mode, result: baseResult, artifactDir, packageRoot });
  let execution = null, executionError = null, killDelivered = false;
  try {
    try {
      execution = await execute(missingExecutable ? path.join(fixture.root, 'missing-node.exe') : process.execPath, [worker, configPath], {
        cwd: fixture.root, env, timeout, maxOutput,
        onSpawn(child) {
          if (!killOnReady) return;
          let output = '';
          child.stdout.on('data', bytes => {
            output += bytes.toString();
            if (!killDelivered && output.includes('READY_FOR_OWNED_KILL')) {
              assert.equal(JSON.parse(fs.readFileSync(path.join(artifactDir, 'result.json'), 'utf8')).execution_status, 'PASS');
              killDelivered = child.kill('SIGKILL');
            }
          });
        },
      });
    } catch (error) { executionError = error; }
    const resultFile = path.join(artifactDir, 'result.json');
    const original = fs.existsSync(resultFile) ? fs.readFileSync(resultFile) : null;
    const result = reconcileWorkerResult({ baseResult, execution, executionError, resultFile, artifactDir, packageRoot });
    const assessment = JSON.parse(fs.readFileSync(path.join(artifactDir, 'worker-result.assessment.json'), 'utf8'));
    validateResult(result, packageRoot);
    // The runner will write the final result only after reconciliation. The
    // proposal remains independently readable after that write.
    if (original) assert.deepEqual(fs.readFileSync(path.join(artifactDir, 'worker-result.proposed.json')), original);
    json(resultFile, result);
    if (original) assert.deepEqual(fs.readFileSync(path.join(artifactDir, 'worker-result.proposed.json')), original);
    assert.equal(fileHash(path.join(artifactDir, 'worker.stdout')), sha256(execution?.stdoutBuffer ?? Buffer.alloc(0)));
    assert.equal(fileHash(path.join(artifactDir, 'worker.stderr')), sha256(execution?.stderrBuffer ?? Buffer.alloc(0)));
    controls.push({ mode, path: relative(packageRoot, artifactDir), code: execution?.code ?? null, signal: execution?.signal ?? null, timed_out: execution?.timedOut ?? null, output_truncated: execution?.outputTruncated ?? null, final_status: result.execution_status, category: result.failure_category ?? null, accepted: assessment.accepted, failures: assessment.failures });
    return { result, execution, executionError, assessment, artifactDir, original, killDelivered };
  } finally { cleanupFixture(fixture); }
}

function infrastructureFailure(outcome, code) {
  const { result, assessment } = outcome;
  assert.equal(result.execution_status, 'FAIL'); assert.equal(result.failure_category, 'INFRASTRUCTURE');
  assert.equal(result.product_status, 'TEST_GAP'); assert.equal(result.known_failure, 'NONE'); assert.equal(result.known_issue_id, null);
  assert.equal(assessment.accepted, false); assert.ok(assessment.failures.some(f => f.code === code));
  // Even an exact semantic-assertion signature cannot suppress a supervisor
  // failure: classification is INFRASTRUCTURE and the waiver remains unused.
  const signature = sha256(JSON.stringify(result.assertions.filter(a => a.passed === false).map(a => ({ id: a.id, expected: a.expected, observed: a.observed }))));
  const classified = classifyKnown(result, { id: 'strict-control-waiver', signature });
  assert.equal(classified.known_failure, 'NONE'); assert.equal(classified.execution_status, 'FAIL');
}

test('accepts a structurally valid matching PASS only after normal exit 0', async () => {
  const o = await run('pass'); assert.equal(o.execution.code, 0); assert.equal(o.result.execution_status, 'PASS'); assert.equal(o.assessment.accepted, true); assert.ok(o.original.includes(Buffer.from('"execution_status": "PASS"')));
});
test('valid PASS JSON cannot override a later exit 7', async () => {
  const o = await run('exit7'); assert.equal(o.execution.code, 7); infrastructureFailure(o, 'WORKER_EXIT'); assert.equal(JSON.parse(o.original).execution_status, 'PASS'); assert.equal(o.result.findings.length, 0);
});
test('valid PASS JSON with a live handle becomes timeout failure', { timeout: 12000 }, async () => {
  const o = await run('hang', { timeout: 800 }); assert.equal(o.execution.timedOut, true); infrastructureFailure(o, 'WORKER_TIMEOUT'); assert.equal(JSON.parse(o.original).execution_status, 'PASS');
});
test('valid PASS JSON cannot override a real output-limit termination', { timeout: 12000 }, async () => {
  const o = await run('overflow', { maxOutput: 1024 }); assert.equal(o.execution.outputTruncated, true); infrastructureFailure(o, 'WORKER_OUTPUT_TRUNCATED'); assert.equal(JSON.parse(o.original).execution_status, 'PASS');
});
test('abrupt termination after a deterministic PASS handshake is infrastructure failure', { timeout: 12000 }, async () => {
  const o = await run('kill', { killOnReady: true }); assert.equal(o.killDelivered, true); assert.ok(o.execution.code !== 0 || o.execution.signal); infrastructureFailure(o, o.execution.signal ? 'WORKER_SIGNAL' : 'WORKER_EXIT'); assert.equal(JSON.parse(o.original).execution_status, 'PASS');
});
test('malformed worker JSON remains available as bytes and fails closed', async () => {
  const o = await run('malformed'); assert.equal(o.execution.code, 0); infrastructureFailure(o, 'RESULT_INVALID_JSON'); assert.equal(o.original.toString(), '{"execution_status":');
});
test('missing worker JSON is visible despite process exit 0', async () => {
  const o = await run('missing'); assert.equal(o.execution.code, 0); assert.equal(o.original, null); infrastructureFailure(o, 'RESULT_MISSING');
});
test('a structurally valid proposal with a foreign identity cannot replace selection', async () => {
  const o = await run('identity'); infrastructureFailure(o, 'RESULT_IDENTITY_MISMATCH'); assert.equal(o.result.variant_id, 'supervisor-identity'); assert.equal(JSON.parse(o.original).variant_id, 'foreign-variant');
});
test('schema validation failure is supervised instead of crashing the run', async () => {
  const o = await run('schema'); infrastructureFailure(o, 'RESULT_INVALID_SCHEMA'); assert.equal(o.result.variant_id, 'supervisor-schema');
});
for (const mode of ['fail0', 'fail1']) test('preserves the worker case FAIL with ' + mode + ' without promoting it to PASS', async () => {
  const o = await run(mode); assert.equal(o.execution.code, mode === 'fail1' ? 1 : 0); assert.equal(o.result.execution_status, 'FAIL'); assert.equal(o.result.failure_category, 'ASSERTION'); assert.equal(o.assessment.accepted, true); assert.equal(o.result.error, 'deliberate synthetic case failure'); assert.equal(o.result.assertions[0].passed, false);
});
test('a worker cannot grant itself XFAIL', async () => {
  const o = await run('self-xfail'); infrastructureFailure(o, 'RESULT_INVALID_SCHEMA');
});
test('real spawn errors are retained as infrastructure evidence', async () => {
  const o = await run('missing', { missingExecutable: true }); assert.equal(o.executionError.code, 'ENOENT'); infrastructureFailure(o, 'WORKER_PROCESS_ERROR');
});
