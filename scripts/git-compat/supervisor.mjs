import fs from 'node:fs';
import path from 'node:path';
import { fileHash, relative, validateResult, within } from './lib.mjs';

// A worker's JSON describes its proposed case outcome. It is only accepted
// after the owning process has closed normally and its identity is checked.
const identityFields = ['schema_version', 'run_id', 'scenario_id', 'variant_id', 'phase', 'scope', 'requirement_ids', 'implementation_status', 'selection_status', 'source_fingerprint', 'runner_fingerprint', 'environment_path'];
const terminalStates = new Set(['PASS', 'FAIL', 'ENV_BLOCKED']);
const serialError = error => error ? { name: error.name ?? 'Error', code: error.code ?? null, message: String(error.message ?? error) } : null;
const bytes = (buffer, text) => Buffer.isBuffer(buffer) ? buffer : Buffer.from(typeof text === 'string' ? text : '');

function checkedDirectory(packageRoot, artifactDir, resultFile) {
  if (!within(packageRoot, artifactDir) || path.resolve(resultFile) !== path.join(path.resolve(artifactDir), 'result.json')) throw Error('Supervisor artifact paths must be the owned case directory and result.json');
  let current = path.resolve(packageRoot);
  for (const part of path.relative(current, artifactDir).split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink() || !fs.statSync(current).isDirectory()) throw Error('Supervisor refuses linked/non-directory artifact path');
  }
}

/**
 * Reconcile a real execute() outcome with the immutable selected-case identity.
 * Does not write resultFile: the runner owns its final write after cleanup and
 * known-issue classification. Original proposal bytes and streams are retained.
 * Valid case FAIL accepts exit 1 and the legacy worker's exit 0; PASS and
 * ENV_BLOCKED require exit 0. Abnormal termination always overrides the case.
 */
export function reconcileWorkerResult({ baseResult, execution = null, executionError = null, resultFile, artifactDir, packageRoot }) {
  checkedDirectory(packageRoot, artifactDir, resultFile);
  const recordedAt = new Date().toISOString(), failures = [], files = [];
  const addFailure = (code, detail) => failures.push({ code, detail });
  const persist = (name, data) => {
    const file = path.join(artifactDir, name);
    fs.writeFileSync(file, data, { flag: 'wx' });
    files.push(file);
    return file;
  };
  persist('worker.stdout', bytes(execution?.stdoutBuffer, execution?.stdout));
  persist('worker.stderr', bytes(execution?.stderrBuffer, execution?.stderr));
  const processRecord = {
    schema_version: 1, recorded_at: recordedAt,
    executable: execution?.executable ?? null, argv: execution?.argv ?? null, cwd: execution?.cwd ?? null,
    pid: execution?.pid ?? null, code: execution?.code ?? null, status: execution?.status ?? null,
    signal: execution?.signal ?? null, timed_out: execution?.timedOut === true || execution?.timed_out === true,
    timeout_ms: execution?.timeout_ms ?? executionError?.timeout_ms ?? null,
    output_truncated: execution?.outputTruncated === true,
    duration_ms: execution?.duration_ms ?? null, termination: execution?.termination ?? null,
    error: serialError(executionError),
  };
  persist('worker-process.json', JSON.stringify(processRecord, null, 2) + '\n');

  let proposal = null, proposalValid = false, proposedPath = null;
  if (!fs.existsSync(resultFile)) addFailure('RESULT_MISSING', 'Worker did not publish result.json');
  else {
    const stat = fs.lstatSync(resultFile);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Supervisor refuses a linked/non-file worker result');
    proposedPath = persist('worker-result.proposed.json', fs.readFileSync(resultFile));
    try { proposal = JSON.parse(fs.readFileSync(proposedPath, 'utf8')); }
    catch (error) { addFailure('RESULT_INVALID_JSON', String(error.message)); }
    if (proposal !== null) {
      try {
        if (typeof proposal !== 'object' || Array.isArray(proposal)) throw Error('Result must be an object');
        const mismatches = identityFields.filter(key => JSON.stringify(proposal[key]) !== JSON.stringify(baseResult[key]));
        if (mismatches.length) addFailure('RESULT_IDENTITY_MISMATCH', mismatches.join(', '));
        else {
          validateResult(proposal, packageRoot);
          if (!terminalStates.has(proposal.execution_status)) throw Error('Worker must publish PASS, FAIL or ENV_BLOCKED');
          if (proposal.known_failure !== 'NONE' || proposal.known_issue_id !== null) throw Error('Worker cannot classify its own known failure');
          proposalValid = true;
        }
      } catch (error) { addFailure('RESULT_INVALID_SCHEMA', String(error.message)); }
    }
  }
  if (proposal === null && fs.existsSync(resultFile) && !failures.some(f => f.code === 'RESULT_INVALID_JSON')) addFailure('RESULT_INVALID_SCHEMA', 'Result must be an object, not null');

  const expectedCodes = proposalValid && proposal.execution_status === 'FAIL' ? [0, 1] : [0];
  if (executionError) addFailure('WORKER_PROCESS_ERROR', String(executionError.message ?? executionError));
  if (!execution || typeof execution !== 'object') addFailure('WORKER_PROCESS_MISSING', 'No completed execute() outcome was available');
  else {
    if (!expectedCodes.includes(execution.code)) addFailure('WORKER_EXIT', `Expected exit ${expectedCodes.join(' or ')}, observed ${String(execution.code)}`);
    if (execution.status !== undefined && execution.status !== execution.code) addFailure('WORKER_STATUS_MISMATCH', 'execute code/status disagree');
    if (execution.signal) addFailure('WORKER_SIGNAL', `Process ended with signal ${execution.signal}`);
    if (execution.timedOut === true || execution.timed_out === true) addFailure('WORKER_TIMEOUT', 'Supervisor deadline expired');
    if (execution.outputTruncated === true) addFailure('WORKER_OUTPUT_TRUNCATED', 'Supervisor output limit was exceeded');
    if (typeof execution.timedOut !== 'boolean' || typeof execution.outputTruncated !== 'boolean' || !Number.isFinite(execution.duration_ms) || execution.duration_ms < 0) addFailure('WORKER_PROCESS_INVALID', 'Malformed execute() process outcome');
  }

  const accepted = failures.length === 0;
  const assessment = {
    schema_version: 1, recorded_at: recordedAt, accepted,
    expected_identity: Object.fromEntries(identityFields.map(key => [key, baseResult[key]])),
    proposed_path: proposedPath ? relative(packageRoot, proposedPath) : null,
    proposed_execution_status: proposal?.execution_status ?? null,
    proposal_valid: proposalValid, expected_exit_codes: expectedCodes,
    policy: 'Process closure, immutable identity and schema prevail over proposed JSON. PASS/ENV_BLOCKED require exit 0. Case FAIL accepts explicit exit 1 or legacy exit 0. Timeout, signal, truncation and process/protocol errors cannot be XFAIL.',
    failures,
  };
  persist('worker-result.assessment.json', JSON.stringify(assessment, null, 2) + '\n');
  const result = structuredClone(proposalValid ? proposal : baseResult);
  result.known_failure = 'NONE'; result.known_issue_id = null;
  if (!accepted) {
    const duration = Number.isFinite(execution?.duration_ms) && execution.duration_ms >= 0 ? execution.duration_ms : 0;
    result.execution_status = 'FAIL'; result.failure_category = 'INFRASTRUCTURE'; result.product_status = 'TEST_GAP';
    result.nonexecution_reason = null;
    result.started_at = new Date(Date.parse(recordedAt) - duration).toISOString(); result.ended_at = recordedAt; result.duration_ms = duration;
    result.error = 'Worker supervision failed: ' + failures.map(f => `${f.code}: ${f.detail}`).join('; ');
    result.findings = [];
    result.assertions = Array.isArray(result.assertions) ? result.assertions : [];
    result.assertions.push({ id: 'supervisor-final-worker-outcome', expected: 'valid matching result and normal process completion', observed: failures, passed: false, evidence_paths: files.map(file => relative(packageRoot, file)), contract_source: 'R-02: worker process outcome overrides a proposed result' });
    result.limits = [...(Array.isArray(result.limits) ? result.limits : []), 'Worker proposal retained for diagnosis; rejected process/protocol outcome is not product validation.'];
  }
  const existingEvidence = Array.isArray(result.evidence) ? result.evidence : [];
  const finalEvidence = new Map(existingEvidence.map(item => [item.path, item]));
  for (const file of files) finalEvidence.set(relative(packageRoot, file), { path: relative(packageRoot, file), sha256: fileHash(file), bytes: fs.statSync(file).size });
  result.evidence = [...finalEvidence.values()];
  result.worker_supervision = { accepted, assessment_path: relative(packageRoot, path.join(artifactDir, 'worker-result.assessment.json')), process_path: relative(packageRoot, path.join(artifactDir, 'worker-process.json')), proposed_path: assessment.proposed_path };
  return result;
}
