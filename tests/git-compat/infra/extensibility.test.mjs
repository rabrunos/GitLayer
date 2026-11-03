import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { context,createFixture,cleanupFixture,isolatedEnvironment,resolveGit,project } from '../../../scripts/git-compat/lib.mjs';
import { loadMatrix,loadCases,parseArgs,selectCases,selectionOutcome,SelectionError,baseResult,counts,validateBundle } from '../../../scripts/git-compat/runner.mjs';
import { VALID_SCOPES } from '../../../scripts/git-compat/registry.mjs';
import { validateOutputRoot } from '../../../scripts/git-compat/output-root.mjs';
import { proveExecutionFingerprint,extendMatrixReference } from '../cases/harness.mjs';
import { evaluateExpectation,validateExpectation,expectationFingerprint } from '../helpers/expectations.mjs';

const evidenceParent=process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT?validateOutputRoot(process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT,{projectRoot:project}):null;
if(evidenceParent)fs.mkdirSync(evidenceParent,{recursive:true});
const evidenceRoot=evidenceParent?path.join(fs.realpathSync(evidenceParent),'infra-contracts-'+randomUUID()):null;
if(evidenceRoot)fs.mkdirSync(evidenceRoot);
const evidenceIndex={schema_version:1,kind:'INFRASTRUCTURE_CONTRACT_PROOFS',fixture_policy:'Only semantic proof JSON and child streams are exported; fixtures are not copied.',processes:[],proofs:[]};
function portable(value,c) {
  if(typeof value==='string') {
    const replacements=[[c?.root,'<FIXTURE>'],[project,'<PROJECT>'],[process.env.USERPROFILE,'<HOST-PROFILE>']].filter(([from])=>from);
    for(const [from,to] of replacements)value=value.replaceAll(from,to);
    return value.replace(/S-1-\d+(?:-\d+)+/g,'<HOST-SID>');
  }
  if(Array.isArray(value))return value.map(item=>portable(item,c));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,portable(item,c)]));
  return value;
}
function exportEvidence(kind,label,data,c,streams) {
  if(!evidenceRoot)return;
  const list=evidenceIndex[kind],name=kind+'-'+String(list.length+1).padStart(3,'0')+'-'+label,record=portable(data,c);
  if(streams) {
    record.streams={};
    for(const [channel,content] of Object.entries(streams)) {
      const file=name+'.'+channel+'.txt';fs.writeFileSync(path.join(evidenceRoot,file),portable(content,c));record.streams[channel]=file;
    }
  }
  const file=name+'.json';fs.writeFileSync(path.join(evidenceRoot,file),JSON.stringify(record,null,2)+'\n');
  list.push({label,file,passed:data.passed});
  fs.writeFileSync(path.join(evidenceRoot,'index.json'),JSON.stringify(evidenceIndex,null,2)+'\n');
}
function recordProof(label,expected,observed,details={},c) {
  exportEvidence('proofs',label,{kind:'INFRASTRUCTURE_SYNTHETIC_CONTROL',expected,observed,passed:isDeepStrictEqual(observed,expected),...details},c);
}
function observedError(operation) {try{operation();return null;}catch(error){return {name:error.name,message:error.message};}}
async function runnerContract(c,label,args,expected,{timeout=30000}={}) {
  const argv=[path.join(project,'scripts/git-compat/runner.mjs'),...args];let execution,failure;
  try{execution=await c.run(process.execPath,argv,{ok:[0,2],timeout});}catch(error){execution=error.result;failure=error;}
  if(!execution)throw failure;
  const jsonStream=text=>{try{return {value:JSON.parse(text)};}catch(error){return {parse_error:error.message};}};
  const stdout=jsonStream(execution.stdout),stderr=jsonStream(execution.stderr),observed={exit_code:execution.code,timed_out:execution.timedOut,outcome:stdout.value?.outcome??stderr.value?.outcome??null};
  exportEvidence('processes',label,{kind:'REAL_NODE_RUNNER_PROCESS',executable:process.execPath,args:argv,cwd:c.repo,expected,observed,passed:isDeepStrictEqual(observed,expected),pid:execution.pid,signal:execution.signal,duration_ms:execution.duration_ms,stdout_json:stdout,stderr_json:stderr},c,{stdout:execution.stdout,stderr:execution.stderr});
  if(failure)throw failure;
  return execution;
}
function fixture(t,label) {
  const owned=createFixture(path.join(project,'.workshop','git-compat-infra'),label);
  t.after(()=>cleanupFixture(owned));
  const gitPath=resolveGit(),c=context({root:owned.root,repo:path.join(owned.root,'repo'),gitPath,env:isolatedEnvironment(owned.root,gitPath),buildDir:path.join(owned.root,'unused-build'),artifactDir:path.join(owned.root,'evidence'),packageRoot:owned.root});
  return c;
}
const runInfo={id:'extensibility-control',seed:'fixed',sourceFingerprint:'synthetic-source',runnerFingerprint:'synthetic-runner'};
const referenceFile=path.join(project,'docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json');
const reference=()=>JSON.parse(fs.readFileSync(referenceFile,'utf8')).scenarios;

test('source preservation includes a truly untracked fixture file and accepts the next authorized baseline',async t=>{
  const c=fixture(t,'source-baselines'),proof=await proveExecutionFingerprint(c);
  recordProof('source-baselines',{untracked_changes_fingerprint:true,authorized_baseline_changes_fingerprint:true,in_run_mutation_detected:true,restored_baseline_matches:true,untracked_names:[proof.untracked]},
    {untracked_changes_fingerprint:proof.original!==proof.untrackedEdit,authorized_baseline_changes_fingerprint:proof.untrackedEdit!==proof.executionBaseline,in_run_mutation_detected:proof.unexpected!==proof.executionBaseline,restored_baseline_matches:proof.executionEnd===proof.executionBaseline,untracked_names:proof.untrackedNames},{source_baselines:proof,assertions:c.assertions},c);
  assert.notEqual(proof.original,proof.untrackedEdit);
  assert.notEqual(proof.untrackedEdit,proof.executionBaseline);
  assert.notEqual(proof.unexpected,proof.executionBaseline);
  assert.equal(proof.executionEnd,proof.executionBaseline);
  assert.deepEqual(proof.untrackedNames,[proof.untracked]);
  assert.ok(c.assertions.every(a=>a.passed));
  assert.equal(proof.tracked.startsWith('src/'),true);
});

test('the original reference IDs remain present while a legitimate extra scenario has its own result',t=>{
  const c=fixture(t,'matrix-extension'),original=reference(),working=loadMatrix(),originalIds=original.map(s=>s.id);
  assert.deepEqual(originalIds.filter(id=>!working.some(s=>s.id===id)),[],'working matrix must preserve every original reference ID');
  const {extended,scenario}=extendMatrixReference(original),results=original.map(s=>baseResult(s,null,runInfo));
  assert.equal(extended.length,original.length+1);
  assert.deepEqual(extended.slice(0,original.length).map(s=>s.id),originalIds);
  const missingResult=observedError(()=>validateBundle(c.packageRoot,results,extended));assert.match(missingResult?.message??'',/Incomplete matrix coverage/);
  const complete=[...results,baseResult(scenario,null,runInfo)];
  assert.equal(validateBundle(c.packageRoot,complete,extended),true);
  assert.equal(counts(complete).scenario_ids,original.length+1);
  assert.equal(counts(complete).execution.NOT_RUN,extended.length);
  const removedOriginal=observedError(()=>validateBundle(c.packageRoot,complete.filter(r=>r.scenario_id!==originalIds[0]),extended));assert.match(removedOriginal?.message??'',/Incomplete matrix coverage/);
  recordProof('matrix-reference-extension',{preserved_ids:originalIds,extended_count:original.length+1,missing_result_rejected:true,removed_original_rejected:true,executed:0},
    {preserved_ids:extended.slice(0,original.length).map(s=>s.id),extended_count:counts(complete).scenario_ids,missing_result_rejected:Boolean(missingResult),removed_original_rejected:Boolean(removedOriginal),executed:complete.filter(r=>r.execution_status!=='NOT_RUN').length},{reference_ids:originalIds,working_ids:working.map(s=>s.id),added_id:scenario.id,missing_result_error:missingResult,removed_original_error:removedOriginal},c);
});

test('working-matrix denominators follow legitimate additions without a preparation-era constant',t=>{
  const c=fixture(t,'dynamic-denominator'),matrix=loadMatrix(),{extended,scenario}=extendMatrixReference(matrix);
  const results=matrix.map(s=>baseResult(s,null,runInfo)),next=[...results,baseResult(scenario,null,runInfo)];
  assert.equal(counts(results).scenario_ids,matrix.length);
  assert.equal(counts(next).scenario_ids,matrix.length+1);
  assert.equal(validateBundle(c.packageRoot,next,extended),true);
  assert.equal(counts(next).execution.NOT_RUN,extended.length);
  recordProof('matrix-working-denominator',{before:matrix.length,after:matrix.length+1,not_run:extended.length},
    {before:counts(results).scenario_ids,after:counts(next).scenario_ids,not_run:counts(next).execution.NOT_RUN},{added_id:scenario.id,current_matrix_ids:matrix.map(s=>s.id)},c);
});

test('matrix files permit legitimate extensions and reject unregistered scopes before any execution',async t=>{
  const c=fixture(t,'matrix-scope-schema'),original=reference(),{extended,scenario}=extendMatrixReference(original),validFile=path.join(c.root,'extended-matrix.json');
  fs.writeFileSync(validFile,JSON.stringify({scenarios:extended}));const loaded=loadMatrix(validFile);
  assert.equal(loaded.length,original.length+1);assert.deepEqual(loaded.slice(0,original.length).map(item=>item.id),original.map(item=>item.id));assert.equal(loaded.at(-1).id,scenario.id);
  assert.ok(loadMatrix().every(item=>VALID_SCOPES.includes(item.scope)));
  const invalid=structuredClone(extended);invalid[0].scope='UNRECOGNIZED_SCOPE';const invalidFile=path.join(c.root,'unknown-scope-matrix.json');fs.writeFileSync(invalidFile,JSON.stringify(invalid));
  const rejected=observedError(()=>loadMatrix(invalidFile));assert.match(rejected?.message??'',/Register its explicit scope contract/);
  const out=path.join(c.root,'must-not-create-output'),execution=await runnerContract(c,'matrix-unregistered-scope',['--suite','all','--matrix',invalidFile,'--id','INDEX-001','--out',out],{exit_code:2,timed_out:false,outcome:'MATRIX_INVALID'});
  assert.equal(execution.code,2);assert.equal(fs.existsSync(out),false);assert.equal(execution.stdout,'');
  recordProof('matrix-scope-contract',{extended_count:original.length+1,original_ids_preserved:true,unknown_scope_rejected:true,report_created:false},
    {extended_count:loaded.length,original_ids_preserved:original.every(item=>loaded.some(next=>next.id===item.id)),unknown_scope_rejected:Boolean(rejected),report_created:fs.existsSync(out)},{registered_scopes:VALID_SCOPES,added_id:scenario.id,scope_error:rejected},c);
});

test('selection validates every public selector and keeps empty execution distinct from inspection',async()=>{
  const matrix=loadMatrix(),cases=await loadCases(),rejections=[];
  for(const option of ['id','family','command','profile','tier','capability','module']) {
    const error=observedError(()=>selectCases(cases,matrix,parseArgs(['--suite','all','--'+option,'__NONEXISTENT_SELECTOR__'])));
    assert.equal(error?.name,SelectionError.name,option);rejections.push({option,error});
  }
  for(const argv of [['--unknown-option'],['--id','INDEX-001','--id','INDEX-001'],['--id','INDEX-001,'],['--id',' INDEX-001'],['--jobs','0'],['--suite','unknown']])assert.throws(()=>parseArgs(argv),SelectionError,JSON.stringify(argv));
  const emptyOptions=parseArgs(['--suite','all','--id','INDEX-001','--family','REMOTE']),empty=selectCases(cases,matrix,emptyOptions);
  assert.equal(empty.length,0);assert.throws(()=>selectionOutcome(empty,emptyOptions),SelectionError);
  assert.equal(selectionOutcome(empty,{...emptyOptions,list:true}),'EMPTY_LIST');
  assert.equal(selectionOutcome(empty,{...emptyOptions,'allow-empty':true}),'EMPTY_ALLOWED');
  const specOnly=matrix.find(s=>!cases.some(c=>c.id===s.id));
  assert.ok(specOnly,'matrix still has at least one specification without executable variants');assert.equal(cases.some(c=>c.id===specOnly.id),false,'selection invariant applies to an actually SPEC_ONLY scenario');
  const specOptions=parseArgs(['--suite','all','--id',specOnly.id]);
  assert.throws(()=>selectionOutcome(selectCases(cases,matrix,specOptions),specOptions),SelectionError);
  recordProof('selection-api',{empty_selected:0,list:'EMPTY_LIST',allow_empty:'EMPTY_ALLOWED',spec_only_executable:false,unknown_selectors_rejected:7},
    {empty_selected:empty.length,list:selectionOutcome(empty,{...emptyOptions,list:true}),allow_empty:selectionOutcome(empty,{...emptyOptions,'allow-empty':true}),spec_only_executable:cases.some(c=>c.id===specOnly.id),unknown_selectors_rejected:rejections.filter(item=>item.error?.name==='SelectionError').length},{kind:'SYNTHETIC_API_CONTROL',specified:matrix.length,implemented_variants:cases.length,rejections});
});

test('real runner CLI rejects typos, specification-only IDs and empty intersections before creating a report',async t=>{
  const c=fixture(t,'selection-refusals'),observations=[],matrix=loadMatrix(),cases=await loadCases();
  const specOnly=matrix.find(s=>!cases.some(c=>c.id===s.id));assert.ok(specOnly,'an actual SPEC_ONLY ID exists');
  const vectors=[
    ['--id','INEDX-001'],['--id',specOnly.id],['--id','INDEX-001','--family','REMOTE'],
    ...['family','command','profile','tier','capability','module'].map(key=>['--'+key,'__NONEXISTENT_SELECTOR__']),
    ['--id','INEDX-001','--allow-empty'],['--id','INEDX-001','--list'],
  ];
  for(const [index,args] of vectors.entries()) {
    const out=path.join(c.root,'rejected-'+index),execution=await runnerContract(c,'refusal-'+index,['--suite','all',...args,'--out',out],{exit_code:2,timed_out:false,outcome:'SELECTION_INVALID'});
    assert.equal(execution.code,2,JSON.stringify(args));assert.equal(execution.stdout,'');
    const error=JSON.parse(execution.stderr);
    assert.equal(error.outcome,'SELECTION_INVALID');assert.equal(error.no_test_success,true);assert.equal(fs.existsSync(out),false,'invalid selection cannot create a passing report');
    observations.push({args,exit:execution.code,outcome:error.outcome,no_test_success:error.no_test_success,report_created:fs.existsSync(out)});
  }
  recordProof('selection-refusals-summary',{processes:vectors.length,all_invalid:true,no_reports:true},
    {processes:observations.length,all_invalid:observations.every(item=>item.exit===2&&item.outcome==='SELECTION_INVALID'&&item.no_test_success),no_reports:observations.every(item=>!item.report_created)},{kind:'REAL_PROCESS_CONTRACT_SUMMARY',processes:observations},c);
});

test('real runner CLI labels list, deliberately empty execution and retry without failures without a test PASS',async t=>{
  const c=fixture(t,'selection-empty-outcomes'),empty=['--suite','all','--id','INDEX-001','--family','REMOTE'],observations=[];
  const listOut=path.join(c.root,'list-only'),listed=await runnerContract(c,'list-empty',[...empty,'--list','--out',listOut],{exit_code:0,timed_out:false,outcome:'EMPTY_LIST'}),inventory=JSON.parse(listed.stdout);
  assert.equal(inventory.outcome,'EMPTY_LIST');assert.deepEqual(inventory.selected,[]);assert.equal(inventory.specified,loadMatrix().length);assert.equal(fs.existsSync(listOut),false);
  const retry=path.join(c.root,'synthetic-prior-results-no-failures.json');
  fs.writeFileSync(retry,JSON.stringify([{scenario_id:'INDEX-001',variant_id:'synthetic-selection-input',execution_status:'PASS'}]));
  for(const [label,args,expected] of [
    ['allow-empty',[...empty,'--allow-empty'],'EMPTY_ALLOWED'],
    ['retry-no-failures',['--suite','all','--retry-failed',retry],'NO_FAILURES_TO_RETRY'],
  ]) {
    const out=path.join(c.root,label),execution=await runnerContract(c,label,[...args,'--out',out],{exit_code:0,timed_out:false,outcome:expected},{timeout:60000}),summary=JSON.parse(execution.stdout);
    assert.equal(execution.code,0);assert.equal(summary.outcome,expected);assert.equal(summary.exit_code,0);assert.equal(summary.selected,0);assert.equal(summary.worker_processes,0);assert.equal(summary.counts.execution.PASS??0,0);
    assert.equal(summary.counts.scenario_ids,loadMatrix().length);assert.equal(summary.source_unchanged,true);assert.equal(summary.runner_unchanged,true);
    const runDir=path.join(out,'runs',summary.id),results=JSON.parse(fs.readFileSync(path.join(runDir,'results.json'),'utf8'));
    assert.equal(fs.existsSync(path.join(runDir,'build.json')),false,'zero selection must not build product');
    assert.ok(results.length>=loadMatrix().length);assert.ok(results.every(r=>r.execution_status==='NOT_RUN'),'no prior synthetic PASS can leak into execution results');
    assert.ok(results.every(r=>r.product_status!=='VERIFIED_SUPPORTED'),'empty execution cannot certify support');
    const selection=JSON.parse(fs.readFileSync(path.join(runDir,'selection.json'),'utf8'));
    assert.equal(selection.outcome,expected);assert.deepEqual(selection.selected,[]);
    observations.push({outcome:summary.outcome,expected,exit:execution.code,selected:summary.selected,workers:summary.worker_processes,build_present:fs.existsSync(path.join(runDir,'build.json')),pass:summary.counts.execution.PASS??0,all_not_run:results.every(r=>r.execution_status==='NOT_RUN'),any_product_supported:results.some(r=>r.product_status==='VERIFIED_SUPPORTED'),source_unchanged:summary.source_unchanged,runner_unchanged:summary.runner_unchanged});
  }
  recordProof('selection-empty-summary',{list:'EMPTY_LIST',list_report_created:false,execution_outcomes:['EMPTY_ALLOWED','NO_FAILURES_TO_RETRY'],all_empty_without_pass:true},
    {list:inventory.outcome,list_report_created:fs.existsSync(listOut),execution_outcomes:observations.map(item=>item.outcome),all_empty_without_pass:observations.every(item=>item.outcome===item.expected&&item.exit===0&&item.selected===0&&item.workers===0&&!item.build_present&&item.pass===0&&item.all_not_run&&!item.any_product_supported&&item.source_unchanged&&item.runner_unchanged)},{kind:'REAL_PROCESS_CONTRACT_SUMMARY',processes:observations},c);
});

test('retry validates status and identity before filtering and selects only an available failed variant',async t=>{
  const c=fixture(t,'retry-schema'),matrix=loadMatrix(),cases=await loadCases(),variant=cases.find(item=>item.id==='INDEX-001');assert.ok(variant);
  const base={scenario_id:variant.id,variant_id:variant.variant,execution_status:'PASS'},vectors=[
    {label:'unknown-status',input:[{...base,execution_status:'FAIl'}]},
    {label:'null-record',input:[null]},
    {label:'missing-id',input:[{variant_id:base.variant_id,execution_status:'PASS'}]},
    {label:'missing-variant',input:[{scenario_id:base.scenario_id,execution_status:'PASS'}]},
    {label:'duplicate-record',input:[base,{...base}]},
    {label:'wrong-root-type',input:{}},
    {label:'invalid-json',raw:'{'},
    {label:'unavailable-failure',input:[{...base,variant_id:'unavailable-failed-variant',execution_status:'FAIL'}]},
  ],rejections=[];
  for(const vector of vectors) {
    const file=path.join(c.root,vector.label+'.json');fs.writeFileSync(file,vector.raw??JSON.stringify(vector.input));const options={suite:'all','retry-failed':file};
    assert.throws(()=>selectCases(cases,matrix,options),SelectionError);assert.throws(()=>selectionOutcome([],options),SelectionError);
    const out=path.join(c.root,'rejected-'+vector.label),execution=await runnerContract(c,'retry-'+vector.label,['--suite','all','--retry-failed',file,'--allow-empty','--out',out],{exit_code:2,timed_out:false,outcome:'SELECTION_INVALID'});
    const error=JSON.parse(execution.stderr);assert.equal(execution.code,2);assert.equal(error.outcome,'SELECTION_INVALID');assert.equal(error.no_test_success,true);assert.equal(fs.existsSync(out),false);
    rejections.push({label:vector.label,exit:execution.code,outcome:error.outcome,report_created:fs.existsSync(out)});
  }
  const validFile=path.join(c.root,'valid-retry.json');fs.writeFileSync(validFile,JSON.stringify([{...base,execution_status:'FAIL'},{...base,variant_id:'historical-passing-variant',execution_status:'PASS'}]));
  const validOptions={suite:'all','retry-failed':validFile},selected=selectCases(cases,matrix,validOptions);
  assert.deepEqual(selected.map(item=>item.id+'/'+item.variant),[base.scenario_id+'/'+base.variant_id]);assert.equal(selectionOutcome(selected,validOptions),'SELECTED');
  const noFailuresFile=path.join(c.root,'valid-nonfailure-states.json');fs.writeFileSync(noFailuresFile,JSON.stringify(['PASS','NOT_RUN','ENV_BLOCKED','NOT_APPLICABLE'].map(status=>({...base,variant_id:'historical-'+status,execution_status:status}))));
  const noFailureOptions={suite:'all','retry-failed':noFailuresFile};assert.equal(selectionOutcome(selectCases(cases,matrix,noFailureOptions),noFailureOptions),'NO_FAILURES_TO_RETRY');
  recordProof('retry-schema',{invalid_rejected:vectors.length,no_invalid_report:true,selected:[base.scenario_id+'/'+base.variant_id],no_failure_outcome:'NO_FAILURES_TO_RETRY'},
    {invalid_rejected:rejections.filter(item=>item.exit===2&&item.outcome==='SELECTION_INVALID').length,no_invalid_report:rejections.every(item=>!item.report_created),selected:selected.map(item=>item.id+'/'+item.variant),no_failure_outcome:selectionOutcome(selectCases(cases,matrix,noFailureOptions),noFailureOptions)},{kind:'REAL_PROCESS_AND_API_RETRY_SCHEMA_CONTROL',rejections},c);
});

const desired={exit:0,error:null,destination:'complete-copy',source_preserved:true,refs_preserved:true};
const known={exit:3,error:'ERR_FS_CP_EEXIST',destination:'empty-directory',source_preserved:true,refs_preserved:true};
const expectation={schema_version:1,id:'recovery-export',revision:1,reason:'Desired successful export and the exact observed Node 24 gap remain separate.',desired,known_gaps:[{issue_id:'EXPORT-NODE24-EEXIST',environment:{node:'24.14.1'},observation:known}]};
const provenance={sourceFingerprint:'a'.repeat(64),environment:{node:'24.14.1',platform:'win32'}};

test('a known gap requires the complete exact observation and the relevant runtime',()=>{
  const result=evaluateExpectation(expectation,known,provenance);
  assert.equal(result.classification,'KNOWN_GAP');assert.equal(result.product_status,'PRODUCT_GAP');
  const divergent=[{...known,source_preserved:false},{...known,refs_preserved:false},{...known,error:'OTHER_ERROR'},{...known,exit:4},{...known,unexpected:'extra effect'}].map(observation=>evaluateExpectation(expectation,observation,provenance));
  for(const changed of divergent)assert.equal(changed.classification,'UNEXPECTED_CHANGE');
  const otherRuntime=evaluateExpectation(expectation,known,{...provenance,environment:{node:'25.0.0',platform:'win32'}});assert.equal(otherRuntime.classification,'UNEXPECTED_CHANGE');
  recordProof('expectation-strict-gap',{exact:'KNOWN_GAP',product:'PRODUCT_GAP',divergent:Array(5).fill('UNEXPECTED_CHANGE'),other_runtime:'UNEXPECTED_CHANGE'},
    {exact:result.classification,product:result.product_status,divergent:divergent.map(item=>item.classification),other_runtime:otherRuntime.classification},{expectation,result,divergent,other_runtime:otherRuntime});
});

test('unrelated legitimate source changes do not freeze a strict known observation',()=>{
  const first=evaluateExpectation(expectation,known,provenance),next=evaluateExpectation(expectation,known,{...provenance,sourceFingerprint:'b'.repeat(64)});
  assert.equal(next.classification,'KNOWN_GAP');assert.notEqual(first.source_fingerprint,next.source_fingerprint);
  assert.equal(first.expectation_sha256,next.expectation_sha256);
  recordProof('expectation-new-source',{classification:'KNOWN_GAP',source_changed:true,expectation_unchanged:true},
    {classification:next.classification,source_changed:first.source_fingerprint!==next.source_fingerprint,expectation_unchanged:first.expectation_sha256===next.expectation_sha256},{first,next});
});

test('recorded observations and environment do not change retrospectively with caller objects',()=>{
  const observed=structuredClone(known),environment=structuredClone(provenance.environment),result=evaluateExpectation(expectation,observed,{...provenance,environment});
  observed.source_preserved=false;environment.node='unexpected later mutation';
  assert.equal(result.observed.source_preserved,true);assert.equal(result.environment.node,'24.14.1');assert.equal(result.classification,'KNOWN_GAP');
  recordProof('expectation-immutable-observation',{preserved:true,node:'24.14.1',classification:'KNOWN_GAP'},
    {preserved:result.observed.source_preserved,node:result.environment.node,classification:result.classification},{recorded:result,caller_mutations:{observed,environment}});
});

test('a real desired outcome is recognized after a product fix and remains visible for review',()=>{
  const fixed=evaluateExpectation(expectation,desired,{...provenance,sourceFingerprint:'c'.repeat(64)});
  assert.equal(fixed.classification,'ADVANCE_NEEDS_REVIEW');assert.equal(fixed.product_status,'VERIFIED_SUPPORTED');assert.equal(fixed.known_failure,'XPASS_NEEDS_REVIEW');
  const unaffectedRuntime=evaluateExpectation(expectation,desired,{...provenance,environment:{node:'22.12.0',platform:'win32'}});
  assert.equal(unaffectedRuntime.classification,'DESIRED_MATCH');assert.equal(unaffectedRuntime.known_failure,'NONE');
  recordProof('expectation-desired-advance',{classification:'ADVANCE_NEEDS_REVIEW',known_failure:'XPASS_NEEDS_REVIEW',product:'VERIFIED_SUPPORTED',other_runtime:'DESIRED_MATCH'},
    {classification:fixed.classification,known_failure:fixed.known_failure,product:fixed.product_status,other_runtime:unaffectedRuntime.classification},{desired_observation:desired,fixed,unaffected_runtime:unaffectedRuntime});
});

test('an explicit successor expectation can retire a gap without rewriting historical evidence',()=>{
  const frozen=structuredClone(expectation),successor={...expectation,revision:2,reason:'Authorized product fix verified; retire the former runtime-specific gap.',known_gaps:[],supersedes:{revision:1,sha256:expectationFingerprint(expectation)}};
  assert.equal(validateExpectation(successor,{previous:expectation}),true);
  const desiredResult=evaluateExpectation(successor,desired,{...provenance,sourceFingerprint:'d'.repeat(64)}),oldGapResult=evaluateExpectation(successor,known,provenance);
  assert.equal(desiredResult.classification,'DESIRED_MATCH');assert.equal(oldGapResult.classification,'UNEXPECTED_CHANGE');
  assert.deepEqual(expectation,frozen);
  assert.throws(()=>validateExpectation({...successor,supersedes:{revision:1,sha256:'e'.repeat(64)}},{previous:expectation}),/predecessor/);
  recordProof('expectation-explicit-successor',{desired:'DESIRED_MATCH',retired_gap:'UNEXPECTED_CHANGE',history_unchanged:true},
    {desired:desiredResult.classification,retired_gap:oldGapResult.classification,history_unchanged:isDeepStrictEqual(expectation,frozen)},{previous:expectation,successor,desired_result:desiredResult,old_gap_result:oldGapResult});
});

test('malformed or incomplete observations cannot receive an approval',()=>{
  assert.throws(()=>evaluateExpectation(expectation,{...known,error:undefined},provenance),/finite JSON/);
  assert.throws(()=>evaluateExpectation(expectation,{...known,[Symbol('unreported effect')]:true},provenance),/finite JSON/);
  assert.throws(()=>evaluateExpectation(expectation,Object.defineProperty({...known},'hidden-effect',{get:()=>true,enumerable:true}),provenance),/finite JSON/);
  assert.throws(()=>evaluateExpectation(expectation,{...known,effects:Array(1)},provenance),/finite JSON/);
  assert.throws(()=>evaluateExpectation(expectation,known,{...provenance,sourceFingerprint:'not-a-fingerprint'}),/source provenance/);
  assert.throws(()=>validateExpectation({...expectation,revision:2}),/previous revision/);
  assert.equal(evaluateExpectation(expectation,{exit:3,error:'ERR_FS_CP_EEXIST'},provenance).execution_status,'FAIL');
  const errors=[
    observedError(()=>evaluateExpectation(expectation,{...known,error:undefined},provenance)),
    observedError(()=>evaluateExpectation(expectation,{...known,[Symbol('unreported effect')]:true},provenance)),
    observedError(()=>evaluateExpectation(expectation,Object.defineProperty({...known},'hidden-effect',{get:()=>true,enumerable:true}),provenance)),
    observedError(()=>evaluateExpectation(expectation,{...known,effects:Array(1)},provenance)),
    observedError(()=>evaluateExpectation(expectation,known,{...provenance,sourceFingerprint:'not-a-fingerprint'})),
    observedError(()=>validateExpectation({...expectation,revision:2})),
  ],partial=evaluateExpectation(expectation,{exit:3,error:'ERR_FS_CP_EEXIST'},provenance);
  recordProof('expectation-malformed-controls',{rejected:6,incomplete_observation_status:'FAIL'},
    {rejected:errors.filter(Boolean).length,incomplete_observation_status:partial.execution_status},{errors,partial_result:partial});
});
