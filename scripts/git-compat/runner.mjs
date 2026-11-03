import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256,validateResult} from './lib.mjs';
export {loadMatrix,loadCases,matrixPath,currentRunnerFingerprint,discoverCaseModules} from './registry.mjs';
export {parseArgs,selectCases,selectionOutcome,SelectionError} from './selection.mjs';
export function baseResult(s, c, run) {
  const reason=s.id==='MODEL-008'?'TEST_GAP: exhaustive before/after interruption campaign at every critical publication is not implemented. RECOVERY-005/006/007 observe three real death boundaries and RECOVERY-003/013 two live interleavings; these do not enumerate or certify every storage/Git write, syscall, platform or operation. The 2026-11-02 implementation adds selected handled-exception variants; those do not certify exhaustive interruption coverage or replace the older real-death evidence.':`SPEC_ONLY: ${s.title}. Missing executable setup/actions/oracle for this complete recipe: ${s.actions}`;
  return { schema_version:'2.0',run_id:run.id,scenario_id:s.id,variant_id:c?.variant ?? 'specification',phase:c?.phase ?? 'SPECIFICATION',scope:s.scope,requirement_ids:s.requirement_ids,implementation_status:c?'IMPLEMENTED':'SPEC_ONLY',selection_status:'NOT_SELECTED',execution_status:'NOT_RUN',product_status:c?'NOT_ASSESSED':'TEST_GAP',known_failure:'NONE',known_issue_id:null,source_fingerprint:run.sourceFingerprint,runner_fingerprint:run.runnerFingerprint,environment_path:null,started_at:null,ended_at:null,duration_ms:null,commands:[],assertions:[],evidence:[],reproduction:{command:`node scripts/git-compat/runner.mjs --suite all --id ${s.id} --seed ${run.seed}`,seed:run.seed,fixture_recipe_path:c?`source/tests/git-compat/cases/${c.module ?? 'see-registry'}.mjs`:null},nonexecution_reason:c?'Implemented variant omitted by selection':reason,limits:c?.expectation?[`Executable expectation ${c.expectation.revision}: ${c.module}:${c.id}/${c.variant}; ${c.expectation.file}. Historical variant key retained; current contract is recorded with executed evidence.`]:[] };
}
export function counts(results) {
  const count = key => Object.fromEntries([...new Set(results.map(r=>r[key]))].sort().map(k=>[k,results.filter(r=>r[key]===k).length]));
  return { scenario_ids:new Set(results.map(r=>r.scenario_id)).size,variants:results.length,execution:count('execution_status'),product:count('product_status'),selection:count('selection_status'),implementation:count('implementation_status'),known:count('known_failure'),executed_ids:new Set(results.filter(r=>['PASS','FAIL'].includes(r.execution_status)).map(r=>r.scenario_id)).size,implemented_ids:new Set(results.filter(r=>r.implementation_status==='IMPLEMENTED').map(r=>r.scenario_id)).size,processes:results.reduce((n,r)=>n+r.commands.length,0) };
}
export function classifyKnown(result, issue) {
  if (!issue) return result;
  if (result.execution_status === 'PASS') return {...result,known_failure:'XPASS_NEEDS_REVIEW',known_issue_id:issue.id};
  // Exact signature over semantic failed assertion, never a broad exception/message match.
  const signature = sha256(JSON.stringify(result.assertions.filter(a=>a.passed===false).map(a=>({id:a.id,expected:a.expected,observed:a.observed}))));
  if(result.execution_status==='FAIL' && result.failure_category==='ASSERTION' && signature===issue.signature) return {...result,known_failure:'XFAIL_STRICT',known_issue_id:issue.id};
  return result;
}
export function validateBundle(root, results, matrix, expectedCounts) {
  if (new Set(matrix.map(s=>s.id)).size !== matrix.length) throw Error('Duplicate matrix IDs');
  const ids = new Set(matrix.map(s=>s.id)); const keys = new Set();
  for(const r of results) { if(!ids.has(r.scenario_id) || keys.has(r.scenario_id+'/'+r.variant_id)) throw Error('Unknown or duplicate result'); keys.add(r.scenario_id+'/'+r.variant_id);validateResult(r,root); }
  if(new Set(results.map(r=>r.scenario_id)).size !== ids.size) throw Error('Incomplete matrix coverage');
  if(expectedCounts && JSON.stringify(counts(results))!==JSON.stringify(expectedCounts)) throw Error('Inconsistent summary counts');
  return true;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 import('./run.mjs').then(({runMain})=>runMain()).catch(e=>{console.error(JSON.stringify({outcome:e.code??'INFRASTRUCTURE_ERROR',error:e.message,no_test_success:true}));process.exitCode=2;});
}
