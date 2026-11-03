import { createHash } from 'node:crypto';

const terminal = new Set(['PASS', 'FAIL', 'ENV_BLOCKED', 'NOT_APPLICABLE']);
const emptyOutcomes = new Set(['EMPTY_ALLOWED', 'NO_FAILURES_TO_RETRY']);
const outcomes = new Set(['SELECTED', ...emptyOutcomes, 'INFRASTRUCTURE_ERROR', 'AGENT_INTERRUPTED_DIAGNOSTIC']);
const signature = result => createHash('sha256').update(JSON.stringify(result.assertions.filter(a => a.passed === false).map(a => ({ id: a.id, expected: a.expected, observed: a.observed })))).digest('hex');

/** Administrative success, completed tests and artifact integrity are distinct. */
export function assessRunIntegrity({ summary, results, knownIssues }) {
  if (!summary || !Array.isArray(results) || !knownIssues || !Array.isArray(knownIssues.issues)) throw Error('Run integrity requires summary, result array and the archived known-issue registry');
  const violations = [];
  const reject = (code, detail) => violations.push({ code, detail });
  const selected = results.filter(r => r.selection_status === 'SELECTED');
  const incomplete = selected.filter(r => r.implementation_status !== 'IMPLEMENTED' || !terminal.has(r.execution_status));
  const unselectedExecuted = results.filter(r => r.selection_status !== 'SELECTED' && r.execution_status !== 'NOT_RUN');
  if (!outcomes.has(summary.outcome)) reject('RUN_OUTCOME', 'Unknown execution outcome: ' + summary.outcome);
  if (!Number.isInteger(summary.selected) || summary.selected < 0 || summary.selected !== selected.length) reject('SELECTED_COUNT', 'Selected count disagrees with results');
  if (typeof summary.source_unchanged !== 'boolean' || typeof summary.runner_unchanged !== 'boolean') reject('PRESERVATION_FLAGS', 'Execution preservation flags must be booleans');
  if (summary.outcome === 'SELECTED' && !selected.length) reject('EMPTY_SELECTED', 'SELECTED requires at least one selected executable variant');
  if (emptyOutcomes.has(summary.outcome) && selected.length) reject('NONEMPTY_ADMINISTRATIVE_OUTCOME', 'An empty administrative outcome cannot contain selected variants');
  if (incomplete.length) reject('SELECTED_NOT_TERMINAL', incomplete.map(r => r.scenario_id + '/' + r.variant_id + ':' + r.execution_status).join(', '));
  if (unselectedExecuted.length) reject('UNSELECTED_EXECUTED', unselectedExecuted.map(r => r.scenario_id + '/' + r.variant_id + ':' + r.selection_status + '/' + r.execution_status).join(', '));
  if (['INFRASTRUCTURE_ERROR', 'AGENT_INTERRUPTED_DIAGNOSTIC'].includes(summary.outcome) && !summary.fatal) reject('MISSING_FATAL', 'An interrupted/error outcome must retain its reason');
  if (summary.fatal && !['INFRASTRUCTURE_ERROR', 'AGENT_INTERRUPTED_DIAGNOSTIC'].includes(summary.outcome)) reject('FATAL_OUTCOME', 'A fatal execution cannot claim a completed or empty outcome');

  for (const result of results) {
    const issue = knownIssues.issues.find(i => i.scenario_id === result.scenario_id && i.variant_id === result.variant_id && i.source_fingerprint === result.source_fingerprint);
    let expected = 'NONE', issueId = null;
    if (issue && result.execution_status === 'PASS') { expected = 'XPASS_NEEDS_REVIEW'; issueId = issue.id; }
    else if (issue && result.execution_status === 'FAIL' && result.failure_category === 'ASSERTION' && signature(result) === issue.signature) { expected = 'XFAIL_STRICT'; issueId = issue.id; }
    if (result.known_failure !== expected || result.known_issue_id !== issueId) reject('KNOWN_ISSUE_CLASSIFICATION', result.scenario_id + '/' + result.variant_id + ': classification must match the archived source-specific semantic signature');
  }

  // Match the runner's precedence. Incomplete/protocol state is an additional
  // integrity failure: a published PASS cannot compensate for an unfinished case.
  const infrastructure = Boolean(summary.fatal || summary.validation_error || summary.source_unchanged !== true || summary.runner_unchanged !== true || violations.length);
  const unexpectedFailure = results.some(r => r.execution_status === 'FAIL' && r.known_failure !== 'XFAIL_STRICT');
  const unexpectedPass = results.some(r => r.known_failure === 'XPASS_NEEDS_REVIEW');
  const expectedExit = infrastructure ? 2 : unexpectedFailure ? 1 : unexpectedPass ? 3 : 0;
  if (summary.exit_code !== expectedExit) reject('EXECUTION_EXIT', 'Expected execution exit ' + expectedExit + ', summary declares ' + summary.exit_code);
  const passed = selected.filter(r => r.execution_status === 'PASS').length;
  return {
    expected_exit_code: expectedExit,
    declared_exit_code: summary.exit_code,
    selected: selected.length,
    selected_pass: passed,
    all_selected_terminal: incomplete.length === 0,
    violations,
    execution_eligible_pass: violations.length === 0 && expectedExit === 0 && summary.outcome === 'SELECTED' && passed > 0,
    policy: 'Archived execution outcome, terminal results and source-specific known-issue signatures must agree. An empty or ENV_BLOCKED-only administrative success is not test approval.',
  };
}
