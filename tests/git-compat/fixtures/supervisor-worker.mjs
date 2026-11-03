import fs from 'node:fs';
import path from 'node:path';
import { fileHash, relative } from '../../../scripts/git-compat/lib.mjs';

// Synthetic worker process only; never imports or invokes product/Git code.
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { mode, result: selected, artifactDir, packageRoot } = config;
const evidence = path.join(artifactDir, 'case-evidence.txt');
fs.writeFileSync(evidence, 'synthetic worker evidence\n');
const failure = mode === 'fail0' || mode === 'fail1';
const result = {
  ...selected, started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_ms: 1,
  execution_status: failure ? 'FAIL' : 'PASS', nonexecution_reason: null,
  assertions: [{ id: 'synthetic-worker-assertion', expected: true, observed: !failure, passed: !failure, evidence_paths: [relative(packageRoot, evidence)], contract_source: 'Synthetic supervisor control' }],
  evidence: [{ path: relative(packageRoot, evidence), sha256: fileHash(evidence), bytes: fs.statSync(evidence).size }],
  ...(failure ? { failure_category: 'ASSERTION', error: 'deliberate synthetic case failure' } : {}),
};
if (mode === 'identity') result.variant_id = 'foreign-variant';
if (mode === 'schema') delete result.assertions;
if (mode === 'self-xfail') { result.execution_status = 'FAIL'; result.failure_category = 'ASSERTION'; result.known_failure = 'XFAIL_STRICT'; result.known_issue_id = 'unapproved-worker-waiver'; }
if (mode !== 'missing') fs.writeFileSync(path.join(artifactDir, 'result.json'), mode === 'malformed' ? '{"execution_status":' : JSON.stringify(result, null, 2) + '\n');
process.stdout.write('worker stdout retained\n'); process.stderr.write('worker stderr retained\n');
if (mode === 'exit7') process.exitCode = 7;
if (mode === 'fail1') process.exitCode = 1;
if (mode === 'hang') setInterval(() => {}, 1000);
if (mode === 'overflow') process.stdout.write(Buffer.alloc(64 * 1024, 88));
if (mode === 'kill') { process.stdout.write('READY_FOR_OWNED_KILL\n'); setInterval(() => {}, 1000); }
