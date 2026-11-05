import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execute, project } from './git-compat/lib.mjs';
import { validateOutputRoot } from './git-compat/output-root.mjs';

// Sequential controller: no tests or benchmarks are launched concurrently.
// Workers and their Git processes are supervised by the existing owned-child
// supervisor. A deadline is persisted so resuming cannot restart the budget.
const usage = 'node scripts/benchmark-performance-recovery-pairs.mjs --baseline-source ROOT --current-source ROOT --out NEW_OR_RESUMABLE_ROOT [--budget-ms 5400000] [--ids COMMA_SEPARATED_CASES] [--10k-samples 1|3]';
const options={};
for(let index=2;index<process.argv.length;index++){const key=process.argv[index];if(!['--baseline-source','--current-source','--out','--budget-ms','--ids','--10k-samples'].includes(key)||options[key]!==undefined||!process.argv[index+1])throw Error(usage);options[key]=process.argv[++index];}
assert(options['--baseline-source']&&options['--current-source']&&options['--out'],usage);
const budget=Number(options['--budget-ms']??5400000);assert(Number.isSafeInteger(budget)&&budget>0&&budget<=2147483647);
const tenK=Number(options['--10k-samples']??3);assert([1,3].includes(tenK));
const canonical=['layers0-files10','layers1-files10','layers1-file1MiB','layers1-file32MiB','layers1-file100MiB','layers2-files100','layers5-files100','layers10-files100','layers1-files1000','layers1-files10000'];
const ids=options['--ids']?options['--ids'].split(','):canonical;assert(ids.length&&new Set(ids).size===ids.length&&ids.every(id=>canonical.includes(id)),'Invalid --ids');
const out=validateOutputRoot(options['--out'],{projectRoot:project}),baseline=fs.realpathSync(options['--baseline-source']),current=fs.realpathSync(options['--current-source']);
const runner=path.join(project,'scripts/benchmark-performance-recovery.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const self=fileURLToPath(import.meta.url),controllerSha256=sha(fs.readFileSync(self)),runnerSha256=sha(fs.readFileSync(runner));
fs.mkdirSync(out,{recursive:true});const control=path.join(out,'controller.json');let state;
if(fs.existsSync(control)){state=JSON.parse(fs.readFileSync(control,'utf8'));assert.equal(state.controllerSha256,controllerSha256);assert.equal(state.runnerSha256,runnerSha256);assert.equal(state.baseline,baseline);assert.equal(state.current,current);}
else{state={schema:1,startedAt:new Date().toISOString(),deadline:new Date(Date.now()+budget).toISOString(),budgetMs:budget,baseline,current,controllerSha256,runnerSha256,policy:'Sequential baseline then current for each case; no OS cache eviction; 10k sample reduction uses a separate n1 root.'};fs.writeFileSync(control,JSON.stringify(state,null,2)+'\n',{flag:'wx'});}
const eventFile=path.join(out,'controller-events.jsonl');
const event=value=>fs.appendFileSync(eventFile,JSON.stringify({at:new Date().toISOString(),...value})+'\n');
event({kind:'INVOCATION',ids,tenKSamples:tenK});
let failed=false;
for(const id of ids){
  for(const phase of ['baseline','current']){
    const remaining=new Date(state.deadline).getTime()-Date.now();
    if(remaining<=1000){event({kind:'BUDGET_STOP',id,phase,remainingMs:remaining});console.log('BUDGET_STOP '+id+'/'+phase);process.exitCode=2;failed=true;break;}
    const sampleCount=id==='layers1-files10000'?tenK:3,caseOut=id==='layers1-files10000'&&tenK===1?out+'-10k-n1':out;
    const args=[runner,'--phase',phase,'--source',phase==='baseline'?baseline:current,'--out',caseOut,'--profile','all','--id',id,'--samples',String(sampleCount),'--budget-ms',String(Math.max(1000,Math.floor(remaining)-500))];
    console.log('PAIR_START '+id+'/'+phase+' remaining='+Math.round(remaining/1000)+'s');event({kind:'PROCESS_START',id,phase,args,samples:sampleCount,remainingMs:remaining});
    const result=await execute(process.execPath,args,{cwd:project,env:process.env,timeout:Math.floor(remaining),maxOutput:16*1024*1024});
    const streamRoot=path.join(out,'controller-processes');fs.mkdirSync(streamRoot,{recursive:true});const stem=id+'-'+phase+'-'+Date.now();fs.writeFileSync(path.join(streamRoot,stem+'.stdout'),result.stdoutBuffer,{flag:'wx'});fs.writeFileSync(path.join(streamRoot,stem+'.stderr'),result.stderrBuffer,{flag:'wx'});
    const record={kind:'PROCESS_END',id,phase,code:result.code,signal:result.signal,timedOut:result.timedOut,durationMs:result.duration_ms,outputTruncated:result.outputTruncated,termination:result.termination,timeoutMs:Math.floor(remaining),stdout:'controller-processes/'+stem+'.stdout',stdoutSha256:sha(result.stdoutBuffer),stderr:'controller-processes/'+stem+'.stderr',stderrSha256:sha(result.stderrBuffer)};event(record);
    process.stdout.write(result.stdout);process.stderr.write(result.stderr);console.log('PAIR_END '+id+'/'+phase+' exit='+result.code);
    if(result.code!==0||result.signal||result.timedOut||result.outputTruncated){failed=true;process.exitCode=1;break;}
  }
  if(failed)break;
}
event({kind:'INVOCATION_END',failed,exitCode:process.exitCode??0,deadline:state.deadline});
