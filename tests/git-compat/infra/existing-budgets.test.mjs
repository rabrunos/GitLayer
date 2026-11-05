import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {parseExistingArgs,existingProcessRecord,existingProcessSucceeded,persistExistingStreams} from '../../../scripts/git-compat/existing.mjs';
import {createFixture,cleanupFixture,execute,isolatedEnvironment,project} from '../../../scripts/git-compat/lib.mjs';
import {validateOutputRoot} from '../../../scripts/git-compat/output-root.mjs';
import {validateFixtureParent,externalFixtureParent} from '../../../scripts/git-compat/fixture-parent.mjs';

const records=[];
const evidenceParent=process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT;
let evidenceRoot;
if(evidenceParent){if(!path.isAbsolute(evidenceParent))throw Error('GIT_COMPAT_INFRA_EVIDENCE_ROOT must be absolute');const parent=validateOutputRoot(evidenceParent,{projectRoot:project});fs.mkdirSync(parent,{recursive:true});evidenceRoot=path.join(parent,'existing-budgets-'+crypto.randomUUID());fs.mkdirSync(evidenceRoot);}
function evidence(name,expected,observed){const record={name,expected,observed};records.push(record);if(evidenceRoot)fs.writeFileSync(path.join(evidenceRoot,name+'.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});assert.deepEqual(observed,expected);}
function own(t){const f=createFixture(externalFixtureParent(project),'budget');t.after(()=>cleanupFixture(f));return f;}
const nativeParent=()=>validateFixtureParent(process.env.GIT_COMPAT_EXTERNAL_FIXTURE_PARENT??os.tmpdir(),{projectRoot:project});

test('existing budgets have explicit defaults and exact inclusive integer bounds',t=>{
  const f=own(t),output=path.join(f.root,'not-created'),base=['--fixture-parent',nativeParent(),'--out',output];
  const defaults=parseExistingArgs(base),small=parseExistingArgs([...base,'--suite-timeout-ms','1','--test-timeout-ms','1']),large=parseExistingArgs([...base,'--suite-timeout-ms','2147483647','--test-timeout-ms','2147483647']);
  evidence('budget-defaults-and-bounds',{defaults:[2400000,300000],small:[1,1],large:[2147483647,2147483647],output_created:false},{defaults:[defaults.suiteTimeoutMs,defaults.testTimeoutMs],small:[small.suiteTimeoutMs,small.testTimeoutMs],large:[large.suiteTimeoutMs,large.testTimeoutMs],output_created:fs.existsSync(output)});
});

test('existing rejects malformed budgets, missing/repeated options before mkdir',t=>{
  const f=own(t),invalid=['0','-1','1.5','1e3','NaN','Infinity','2147483648','9007199254740991','+1',' 1','1 ','01','0x10'],observed=[];
  let sequence=0;
  for(const key of ['--suite-timeout-ms','--test-timeout-ms']){
    for(const value of invalid){const output=path.join(f.root,'uncreated-'+sequence++);let code;try{parseExistingArgs(['--out',output,key,value]);}catch(error){code=error.code;}observed.push({code,created:fs.existsSync(output)});}
    for(const suffix of [[key],[key,'1',key,'2']]){const output=path.join(f.root,'uncreated-'+sequence++);let code;try{parseExistingArgs(['--out',output,...suffix]);}catch(error){code=error.code;}observed.push({code,created:fs.existsSync(output)});}
  }
  evidence('budget-invalid-before-mkdir',{refused:30,all_selection_error:true,any_directory_created:false},{refused:observed.length,all_selection_error:observed.every(r=>r.code==='EXISTING_SELECTION_INVALID'),any_directory_created:observed.some(r=>r.created)});
});

test('existing record helper persists actual PID, termination, budgets, exit and signal',t=>{
  const f=own(t),result={pid:4242,code:null,signal:'SIGKILL',timedOut:true,outputTruncated:false,duration_ms:51,stdout:'',termination:{reason:'timeout',method:'synthetic owned-process trace',descendant_tree_confirmed:false,forced_stream_close:true}},row=existingProcessRecord({name:'synthetic-timeout',executable:process.execPath,args:['synthetic-only'],startedAt:'2026-01-01T00:00:00Z',endedAt:'2026-01-01T00:00:01Z',result,timeoutMs:50,testTimeoutMs:25}),file=path.join(f.root,'persisted.json');
  fs.writeFileSync(file,JSON.stringify(row));const read=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.deepEqual(read.termination,result.termination);assert.notEqual(row.termination,result.termination);
  evidence('metadata-roundtrip',{pid:4242,exit:null,signal:'SIGKILL',timed_out:true,timeout_ms:50,test_timeout_ms:25,descendant_confirmed:false,successful:false},{pid:read.pid,exit:read.exit,signal:read.signal,timed_out:read.timed_out,timeout_ms:read.timeout_ms,test_timeout_ms:read.test_timeout_ms,descendant_confirmed:read.termination.descendant_tree_confirmed,successful:existingProcessSucceeded(read)});
  for(const bad of [{exit:1},{timed_out:true},{output_truncated:true},{signal:'SIGTERM'}])assert.equal(existingProcessSucceeded({exit:0,timed_out:false,output_truncated:false,signal:null,...bad}),false);
  assert.equal(existingProcessSucceeded({exit:0,timed_out:false,output_truncated:false,signal:null}),true);
});

test('existing captures a short real owned-child timeout and retains raw streams',async t=>{
  const f=own(t);assert.ok(f.root.length<248,'test requires a short subprocess cwd');
  const env=isolatedEnvironment(f.root,process.execPath),argv=['-e','setTimeout(()=>{},10000)'],result=await execute(process.execPath,argv,{cwd:f.root,env,timeout:50,maxOutput:8192}),row=existingProcessRecord({name:'owned-timeout',executable:process.execPath,args:argv,startedAt:'2026-01-01T00:00:00Z',endedAt:'2026-01-01T00:00:01Z',result,timeoutMs:50,testTimeoutMs:null}),streams=evidenceRoot??f.root;
  persistExistingStreams(streams,'owned-timeout',result);assert.deepEqual(fs.readFileSync(path.join(streams,'owned-timeout.stdout')),result.stdoutBuffer);assert.deepEqual(fs.readFileSync(path.join(streams,'owned-timeout.stderr')),result.stderrBuffer);assert.deepEqual(row.termination,result.termination);assert.equal(row.exit,result.code);assert.equal(row.signal,result.signal);
  evidence('real-owned-child-timeout',{timed_out:true,successful:false,positive_pid:true,termination_recorded:true,timeout_ms:50,raw_streams_exact:true},{timed_out:row.timed_out,successful:existingProcessSucceeded(row),positive_pid:Number.isInteger(row.pid)&&row.pid>0,termination_recorded:row.termination!==null,timeout_ms:row.timeout_ms,raw_streams_exact:true});
  if(evidenceRoot)fs.writeFileSync(path.join(evidenceRoot,'owned-timeout-record.json'),JSON.stringify(row,null,2)+'\n',{flag:'wx'});
});

test.after(()=>{if(evidenceRoot){fs.writeFileSync(path.join(evidenceRoot,'summary.json'),JSON.stringify({role:'Synthetic infrastructure budget/metadata controls; no product or Git execution',controls:records},null,2)+'\n',{flag:'wx'});console.log('EXISTING_BUDGET_EVIDENCE='+path.relative(project,evidenceRoot).replaceAll('\\','/'));}});
