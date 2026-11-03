import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { context,createFixture,cleanupFixture,isolatedEnvironment,project,execute,json,relative,validateResult,DEFAULT_COMMAND_TIMEOUT_MS,DEFAULT_CLI_TIMEOUT_MS } from '../../../scripts/git-compat/lib.mjs';
import { reconcileWorkerResult } from '../../../scripts/git-compat/supervisor.mjs';

const evidenceParent=process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT??path.join(project,'artifacts/git-compat/auxiliary/timeout-policy');
if(!path.isAbsolute(evidenceParent))throw Error('GIT_COMPAT_INFRA_EVIDENCE_ROOT must be absolute');
const evidence=path.join(evidenceParent,'run-'+randomUUID());fs.mkdirSync(evidence,{recursive:true});
console.log('CANDIDATE_EVIDENCE='+evidence);
const commandBudget=800,cliBudget=6000,slowOperation=2000;
const fakeCli=`import fs from 'node:fs';
const args=process.argv.slice(2),at=args.indexOf('--delay-ms'),delay=at<0?0:Number(args[at+1]);
process.stdout.write(Buffer.from([0,255,128,10]));process.stderr.write(Buffer.from([254,0,129,10]));
process.stdout.write('fake CLI ready\\n');
setTimeout(()=>{process.stdout.write('fake CLI completed\\n');},delay);
`;
function fixture(t,label,budgets={commandTimeoutMs:commandBudget,cliTimeoutMs:cliBudget}) {
  const f=createFixture(path.join(project,'.workshop/git-compat-infra'),'f');t.after(()=>cleanupFixture(f));
  const buildDir=path.join(f.root,'build');fs.mkdirSync(buildDir);fs.writeFileSync(path.join(buildDir,'cli.mjs'),fakeCli);
  const config={root:f.root,repo:path.join(f.root,'repo'),artifactDir:path.join(f.root,'evidence'),packageRoot:f.root,buildDir,gitPath:process.execPath,env:isolatedEnvironment(f.root,process.execPath),...budgets};
  return {c:context(config),config,label};
}
function retain(label,c,result,extra={}) {
  const target=path.join(evidence,label);fs.mkdirSync(target);
  if(result) {fs.writeFileSync(path.join(target,'stdout.bin'),result.stdoutBuffer);fs.writeFileSync(path.join(target,'stderr.bin'),result.stderrBuffer);}
  const portable=value=>typeof value==='string'?value.replaceAll(c.root,'<FIXTURE>').replaceAll(project,'<MINI-PROJECT>'):Array.isArray(value)?value.map(portable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,portable(item)])):value;
  json(path.join(target,'proof.json'),portable({role:'INFRASTRUCTURE_CANDIDATE_REAL_CHILD_NOT_PRODUCT',commands:c.commands,result:result&&{executable:result.executable,argv:result.argv,code:result.code,signal:result.signal,timedOut:result.timedOut,timeout_ms:result.timeout_ms,duration_ms:result.duration_ms,termination:result.termination},...extra}));
}
async function timeoutFrom(operation) {
  let failure;try{await operation();}catch(error){failure=error;}
  assert.ok(failure,'timeout must reject the operation');assert.equal(failure.result?.timedOut,true);return failure.result;
}

test('default budgets are 30 seconds for raw/run/Git and 90 seconds for the CLI, recorded without waiting',async t=>{
  const {c}=fixture(t,'defaults',{});
  assert.equal(c.commandTimeoutMs,30000);assert.equal(c.cliTimeoutMs,90000);assert.equal(DEFAULT_COMMAND_TIMEOUT_MS,30000);assert.equal(DEFAULT_CLI_TIMEOUT_MS,90000);
  const raw=await execute(process.execPath,['-e','process.stdout.write("raw fast")'],{cwd:c.repo,env:c.env});assert.equal(raw.timeout_ms,30000);
  const run=await c.run(process.execPath,['-e','process.stdout.write("run fast")']),git=await c.git(['-e','process.stdout.write("git-shaped fast")']),cli=await c.cli(['--delay-ms','0']);
  assert.deepEqual([run.timeout_ms,git.timeout_ms,cli.timeout_ms],[30000,30000,90000]);assert.deepEqual(c.commands.map(item=>item.timeout_ms),[30000,30000,90000]);
  retain('defaults',c,cli,{expected:{raw:30000,commands:[30000,30000,90000]},observed:{raw:raw.timeout_ms,commands:c.commands.map(item=>item.timeout_ms)}});
});

test('the fake composite CLI exceeds the command budget and succeeds within its configured CLI budget with binary evidence',async t=>{
  const {c}=fixture(t,'cli-longer');const result=await c.cli(['--delay-ms',String(slowOperation)]);
  assert.equal(result.code,0);assert.equal(result.timedOut,false);assert.equal(result.timeout_ms,cliBudget);assert.ok(result.duration_ms>commandBudget);assert.match(result.stdout,/fake CLI completed/u);
  assert.deepEqual([...result.stdoutBuffer.subarray(0,4)],[0,255,128,10]);assert.deepEqual([...result.stderrBuffer],[254,0,129,10]);
  assert.deepEqual(fs.readFileSync(path.join(c.packageRoot,c.commands[0].stdout_binary_path)),result.stdoutBuffer);assert.deepEqual(fs.readFileSync(path.join(c.packageRoot,c.commands[0].stderr_binary_path)),result.stderrBuffer);
  retain('cli-longer-than-command',c,result,{expected:{timeout_ms:cliBudget,timedOut:false,code:0,longer_than_command:true},observed:{timeout_ms:result.timeout_ms,timedOut:result.timedOut,code:result.code,longer_than_command:result.duration_ms>commandBudget}});
});

test('run and Git-shaped invocations of the same real Node process retain the shorter command budget',async t=>{
  const {c}=fixture(t,'command-limits'),argv=[path.join(c.buildDir,'cli.mjs'),'--cwd',c.repo,'--json','--delay-ms',String(slowOperation)];
  const run=await timeoutFrom(()=>c.run(process.execPath,argv)),git=await timeoutFrom(()=>c.git(argv));
  assert.equal(run.timeout_ms,commandBudget);assert.equal(git.timeout_ms,commandBudget);assert.deepEqual(c.commands.map(item=>item.timeout_ms),[commandBudget,commandBudget]);
  retain('run-short-command-budget',c,run,{expected:{timedOut:true,timeout_ms:commandBudget},observed:{timedOut:run.timedOut,timeout_ms:run.timeout_ms}});
  retain('git-short-command-budget',c,git,{expected:{timedOut:true,timeout_ms:commandBudget},observed:{timedOut:git.timedOut,timeout_ms:git.timeout_ms}});
});

test('an explicit shorter CLI override still rejects timeout even when its termination signal/code is allowed',async t=>{
  const {c}=fixture(t,'explicit-short'),override=300;
  const result=await timeoutFrom(()=>c.cli(['--delay-ms',String(slowOperation)],{timeout:override,ok:[0,null,1],okSignals:['SIGKILL','SIGTERM']}));
  assert.equal(result.timeout_ms,override);assert.equal(c.commands[0].timeout_ms,override);assert.equal(c.commands[0].timed_out,true);
  retain('explicit-short-cli-override',c,result,{expected:{timedOut:true,timeout_ms:override,rejected:true},observed:{timedOut:result.timedOut,timeout_ms:result.timeout_ms,rejected:true}});
});

test('an explicit larger CLI override takes precedence over the configured CLI budget',async t=>{
  const {c}=fixture(t,'explicit-long',{commandTimeoutMs:commandBudget,cliTimeoutMs:commandBudget});
  const result=await c.cli(['--delay-ms',String(slowOperation)],{timeout:cliBudget});assert.equal(result.code,0);assert.equal(result.timedOut,false);assert.equal(result.timeout_ms,cliBudget);assert.ok(result.duration_ms>c.cliTimeoutMs);
  retain('explicit-long-cli-override',c,result,{expected:{timeout_ms:cliBudget,timedOut:false},observed:{timeout_ms:result.timeout_ms,timedOut:result.timedOut},configured_cli_timeout_ms:c.cliTimeoutMs});
});

test('invalid default and explicit budgets reject before process creation',async t=>{
  const {c,config}=fixture(t,'invalid-budgets'),invalid=[0,-1,NaN,Infinity,'100',null,2147483648];let spawned=0;
  for(const value of invalid) {
    assert.throws(()=>context({...config,commandTimeoutMs:value}),RangeError);assert.throws(()=>context({...config,cliTimeoutMs:value}),RangeError);
    await assert.rejects(()=>execute(process.execPath,['-e','process.exit(99)'],{cwd:c.repo,env:c.env,timeout:value,onSpawn(){spawned++;}}),RangeError);
    await assert.rejects(()=>c.cli(['--delay-ms','0'],{timeout:value,onSpawn(){spawned++;}}),RangeError);
  }
  assert.equal(spawned,0);assert.equal(c.commands.length,0);retain('invalid-budgets',c,null,{expected:{spawned:0,commands:0,rejected_values:invalid.length},observed:{spawned,commands:c.commands.length,rejected_values:invalid.length}});
});

test('a shorter owning-process deadline remains a supervised infrastructure FAIL with its effective budget',async t=>{
  const {c}=fixture(t,'supervisor-bound'),ownerBudget=300,result=await execute(process.execPath,[path.join(c.buildDir,'cli.mjs'),'--delay-ms',String(slowOperation)],{cwd:c.repo,env:c.env,timeout:ownerBudget});
  assert.equal(result.timedOut,true);assert.ok(result.timeout_ms<c.cliTimeoutMs);
  const environment=path.join(c.artifactDir,'environment.json');json(environment,{synthetic:true});
  const base={schema_version:'2.0',run_id:'candidate-budget',scenario_id:'HARNESS-001',variant_id:'owning-budget-negative',phase:'HARNESS',scope:'HARNESS_HEADLESS',requirement_ids:[],implementation_status:'IMPLEMENTED',selection_status:'SELECTED',execution_status:'NOT_RUN',product_status:'NOT_ASSESSED',known_failure:'NONE',known_issue_id:null,source_fingerprint:'synthetic-candidate',runner_fingerprint:'synthetic-candidate',environment_path:relative(c.packageRoot,environment),started_at:null,ended_at:null,duration_ms:null,commands:[],assertions:[],evidence:[],reproduction:{command:'node --test proposed/tests/git-compat/infra/execution-budget.test.mjs',seed:'fixed',fixture_recipe_path:null},nonexecution_reason:'pending real child',limits:[]};
  const reconciled=reconcileWorkerResult({baseResult:base,execution:result,resultFile:path.join(c.artifactDir,'result.json'),artifactDir:c.artifactDir,packageRoot:c.packageRoot});
  assert.equal(reconciled.execution_status,'FAIL');assert.equal(reconciled.product_status,'TEST_GAP');assert.equal(reconciled.failure_category,'INFRASTRUCTURE');assert.equal(reconciled.known_failure,'NONE');assert.equal(validateResult(reconciled,c.packageRoot),true);
  const metadata=JSON.parse(fs.readFileSync(path.join(c.artifactDir,'worker-process.json'),'utf8'));assert.equal(metadata.timeout_ms,ownerBudget);assert.equal(metadata.timed_out,true);
  retain('owning-process-deadline',c,result,{expected:{status:'FAIL',product:'TEST_GAP',known:'NONE',timeout_ms:ownerBudget},observed:{status:reconciled.execution_status,product:reconciled.product_status,known:reconciled.known_failure,timeout_ms:metadata.timeout_ms},supervisor:metadata,assessment:JSON.parse(fs.readFileSync(path.join(c.artifactDir,'worker-result.assessment.json'),'utf8'))});
});

test('a spawn failure retains the configured budget in error metadata without claiming execution success',async t=>{
  const {c}=fixture(t,'spawn-error');let error;
  try{await execute(path.join(c.root,'missing-executable.exe'),[],{cwd:c.repo,env:c.env,timeout:1234});}catch(failure){error=failure;}
  assert.ok(error);assert.equal(error.code,'ENOENT');assert.equal(error.timeout_ms,1234);
  retain('spawn-error-budget',c,null,{expected:{code:'ENOENT',timeout_ms:1234},observed:{code:error.code,timeout_ms:error.timeout_ms}});
});
