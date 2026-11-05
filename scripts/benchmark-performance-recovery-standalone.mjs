import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execute, project } from './git-compat/lib.mjs';
import { validateOutputRoot } from './git-compat/output-root.mjs';

// Only the already authorized current10k follow-up. The failed/timed-out
// baseline is preserved, and the existing global deadline cannot be extended.
const options={};
for(let i=2;i<process.argv.length;i++){const key=process.argv[i];assert(['--source','--out'].includes(key)&&options[key]===undefined&&process.argv[i+1],'Usage: node scripts/benchmark-performance-recovery-standalone.mjs --source CURRENT_SOURCE --out EXISTING_V4_ROOT');options[key]=process.argv[++i];}
assert(options['--source']&&options['--out']);
const out=validateOutputRoot(options['--out'],{projectRoot:project}),source=fs.realpathSync(options['--source']);
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const control=read(path.join(out,'controller.json')),config=read(path.join(out,'current/config.json'));
assert.equal(control.current,source);assert.equal(control.samples,1);
const events=fs.readFileSync(path.join(out,'controller-events.jsonl'),'utf8').trim().split('\n').map(JSON.parse),end=events.filter(event=>event.kind==='PROCESS_END').at(-1),invocationEnd=events.filter(event=>event.kind==='INVOCATION_END').at(-1);
assert(invocationEnd?.failed===true&&end?.id==='layers1-files10000'&&end.phase==='baseline'&&(end.code!==0||end.timedOut||end.signal||end.outputTruncated),'A completed failed/timed-out baseline10k controller invocation is required');
assert(!fs.existsSync(path.join(out,'current/layers1-files10000')),'Current10k already has an attempt; preserve it instead of replacing');
const quietProofFile=path.join(out,'standalone-quiet-proof.json'),quiet=read(quietProofFile);
assert(quiet.safeToStart===true&&quiet.controllerInvocationEnded===true&&Array.isArray(quiet.matchingOwnedNodes)&&quiet.matchingOwnedNodes.length===0&&quiet.descendantClosureSufficient===true,'Explicit owned-process closure evidence is required; timeout flags alone do not prove a quiet tree');
assert(Date.now()-Date.parse(quiet.observedAt)>=0&&Date.now()-Date.parse(quiet.observedAt)<=120000,'Quiet evidence must be recent');
assert.equal(quiet.baseline10kProcessEndAt,end.at);
const runner=path.join(project,'scripts/benchmark-performance-recovery-v4.mjs');
assert.equal(hash(fs.readFileSync(runner)),control.runnerSha256);assert.equal(config.runnerSha256,control.runnerSha256);
const phase='current',id='layers1-files10000',startedAt=new Date().toISOString(),remaining=new Date(control.deadline).getTime()-Date.now(),budget=Math.floor(Math.min(1200000,control.tenKBudgetMs,remaining));
assert(budget>1500,'Persisted global benchmark deadline exhausted');
const stem='standalone-'+id+'-'+phase,receiptFile=path.join(out,stem+'.json');
assert(!fs.existsSync(receiptFile),'Standalone execution already has a receipt; preserve it');
const args=[runner,'--phase',phase,'--source',source,'--out',out,'--profile','all','--id',id,'--samples','1','--budget-ms',String(budget-500)];
const provenance={schema:1,supervisorSha256:hash(fs.readFileSync(new URL(import.meta.url))),quietProofSha256:hash(fs.readFileSync(quietProofFile)),id,phase,startedAt,budgetMs:budget,globalDeadline:control.deadline,runnerSha256:control.runnerSha256,sourceFingerprint:config.sourceFingerprint,source,args,reason:'Current-only follow-up after incomplete baseline; never comparable until both endpoints finish successfully'};
fs.writeFileSync(path.join(out,stem+'-started.json'),JSON.stringify(provenance,null,2)+'\n',{flag:'wx'});
const result=await execute(process.execPath,args,{cwd:project,env:process.env,timeout:budget,maxOutput:16*1024*1024});
fs.writeFileSync(path.join(out,stem+'.stdout'),result.stdoutBuffer,{flag:'wx'});fs.writeFileSync(path.join(out,stem+'.stderr'),result.stderrBuffer,{flag:'wx'});
const record={...provenance,finishedAt:new Date().toISOString(),process:{code:result.code,signal:result.signal,timedOut:result.timedOut,durationMs:result.duration_ms,outputTruncated:result.outputTruncated,termination:result.termination},stdoutSha256:hash(result.stdoutBuffer),stderrSha256:hash(result.stderrBuffer)};
fs.writeFileSync(receiptFile,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
process.stdout.write(result.stdout);process.stderr.write(result.stderr);
console.log(JSON.stringify({phase,id,code:result.code,timedOut:result.timedOut,receipt:path.relative(project,receiptFile)}));
process.exitCode=result.code===0&&!result.signal&&!result.timedOut&&!result.outputTruncated?0:1;
