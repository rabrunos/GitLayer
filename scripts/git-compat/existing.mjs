import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { project,execute,createFixture,isolatedEnvironment,resolveGit,cleanupFixture,json,fingerprint } from './lib.mjs';
import { validateOutputRoot } from './output-root.mjs';
import { validateFixtureParent } from './fixture-parent.mjs';

export function parseExistingArgs(args) {
  const options={};
  const invalid=message=>{throw Object.assign(Error(message),{code:'EXISTING_SELECTION_INVALID'});};
  for(let index=0;index<args.length;index++) {
    const key=args[index];
    if(!['--suite','--out','--fixture-parent','--suite-timeout-ms','--test-timeout-ms'].includes(key)||options[key]!==undefined||!args[index+1]||args[index+1].startsWith('--'))invalid('Usage: existing.mjs [--suite all|typecheck|unit|integration|windows] [--out EVIDENCE_ROOT] [--fixture-parent EXISTING_NONREPOSITORY_DIRECTORY] [--suite-timeout-ms INTEGER] [--test-timeout-ms INTEGER]');
    options[key]=args[++index];
  }
  const budget=(key,fallback)=>{
    const raw=options[key]??String(fallback);
    if(!/^[1-9]\d*$/u.test(raw))invalid(key+' must be an integer 1..2147483647');
    const value=Number(raw);if(!Number.isSafeInteger(value)||value>2147483647)invalid(key+' must be an integer 1..2147483647');
    return value;
  };
  const suiteTimeoutMs=budget('--suite-timeout-ms',2400000),testTimeoutMs=budget('--test-timeout-ms',300000);
  const suite=options['--suite']??'all';
  if(!['all','typecheck','unit','integration','windows'].includes(suite))invalid('Unknown existing suite: '+suite);
  const outputRoot=validateOutputRoot(options['--out']??path.join(project,'artifacts/git-compat/existing'),{projectRoot:project});
  const fixtureParent=validateFixtureParent(options['--fixture-parent']??os.tmpdir(),{projectRoot:project});
  return {suite,outputRoot,fixtureParent,suiteTimeoutMs,testTimeoutMs};
}
export const existingSummaryLines=stdout=>stdout.split(/\r?\n/).filter(line=>/^(?:ℹ|#) (?:tests|suites|pass|fail|cancelled|skipped|duration_ms)(?: |$)/u.test(line));
export function persistExistingStreams(out,name,result) {
  if(!Buffer.isBuffer(result.stdoutBuffer)||!Buffer.isBuffer(result.stderrBuffer))throw Error('Existing evidence requires original process stream buffers');
  fs.writeFileSync(path.join(out,name+'.stdout'),result.stdoutBuffer,{flag:'wx'});
  fs.writeFileSync(path.join(out,name+'.stderr'),result.stderrBuffer,{flag:'wx'});
}


export function existingProcessRecord({name,executable,args,startedAt,endedAt,result,timeoutMs,testTimeoutMs=null}) {
  return {name,executable,args:[...args],started_at:startedAt,ended_at:endedAt,
    pid:result.pid??null,exit:result.code,signal:result.signal,timed_out:result.timedOut,
    termination:structuredClone(result.termination??null),timeout_ms:timeoutMs,test_timeout_ms:testTimeoutMs,
    output_truncated:result.outputTruncated,duration_ms:result.duration_ms,
    stdout:name+'.stdout',stderr:name+'.stderr',summary:existingSummaryLines(result.stdout)};
}
export const existingProcessSucceeded=result=>result.exit===0&&!result.timed_out&&!result.output_truncated&&!result.signal;

export async function runExisting(args=process.argv.slice(2)) {
  // All validations precede mkdir, official-Git discovery, environment setup and tests.
  const {suite,outputRoot,fixtureParent,suiteTimeoutMs,testTimeoutMs}=parseExistingArgs(args);
  const id='existing-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(4).toString('hex'),out=path.join(outputRoot,id);
  fs.mkdirSync(outputRoot,{recursive:true});fs.mkdirSync(out);
  // Empty-directory CLI tests stay outside the development repository, even
  // when a product Git call strips the inherited Git ceiling environment.
  const fixture=createFixture(fixtureParent,'gl'),env=isolatedEnvironment(fixture.root,resolveGit());
  let suites=[
    ['typecheck',['node_modules/typescript/bin/tsc','--noEmit']],
    ['unit-domain',['--import','tsx','--test','--test-concurrency=2','--test-timeout='+testTimeoutMs,'tests/unit/paths.test.ts','tests/unit/platform.test.ts']],
    ['integration-domain',['--import','tsx','--test','--test-concurrency=2','--test-timeout='+testTimeoutMs,'tests/integration/core.test.ts','tests/integration/cli.test.ts','tests/integration/storage.test.ts','tests/integration/recovery.test.ts','tests/integration/windows-compat.test.ts']],
  ];
  if(suite==='windows')suites=[['windows-retest',['--import','tsx','--test','--test-concurrency=1','--test-timeout='+testTimeoutMs,'tests/integration/windows-compat.test.ts']]];
  else if(suite!=='all')suites=suites.filter(([name])=>name.startsWith(suite==='unit'?'unit-':suite==='integration'?'integration-':'typecheck'));
  const results=[],before=fingerprint([path.join(project,'src')]);
  try {
    for(const [name,argv]of suites) {
      const start=new Date().toISOString();console.log('START '+name);
      const result=await execute(process.execPath,argv,{cwd:project,env,timeout:suiteTimeoutMs,maxOutput:16*1024*1024});
      persistExistingStreams(out,name,result);
      results.push(existingProcessRecord({name,executable:process.execPath,args:argv,startedAt:start,endedAt:new Date().toISOString(),result,timeoutMs:suiteTimeoutMs,testTimeoutMs:argv.includes('--test')?testTimeoutMs:null}));
      json(path.join(out,'results.json'),{id,sourceFingerprint:before,results});console.log('END '+name+' exit='+result.code+' '+result.duration_ms+'ms');
    }
  }finally{cleanupFixture(fixture);}
  const sourceUnchanged=before===fingerprint([path.join(project,'src')]);
  json(path.join(out,'results.json'),{id,sourceFingerprint:before,sourceUnchanged,results});
  const exitCode=sourceUnchanged&&results.every(existingProcessSucceeded)?0:1;
  process.exitCode=exitCode;return {id,out,sourceUnchanged,results,exitCode};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runExisting().catch(error=>{console.error(JSON.stringify({outcome:error.code??'INFRASTRUCTURE_ERROR',error:error.message,no_test_success:true}));process.exitCode=2;});
