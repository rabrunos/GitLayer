import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit, execute, project, within } from './git-compat/lib.mjs';
import { validateFixtureParent } from './git-compat/fixture-parent.mjs';
import { validateOutputRoot } from './git-compat/output-root.mjs';

// The product is measured from immutable copied sources. Only its bundle receives
// an observer at the real spawn boundary; no production source or safety check changes.
const self = fileURLToPath(import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const writeNew = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const append = (file, value) => fs.appendFileSync(file, JSON.stringify(value) + '\n');
const portable = (text, job) => String(text).replaceAll(job.fixture.root, '<FIXTURE>').replaceAll(job.phaseDir, '<PHASE>').replaceAll(project, '<PROJECT>');
const usage = 'node scripts/benchmark-performance-recovery-v4.mjs --phase baseline|current --source SOURCE_ROOT --out ARTIFACT_ROOT [--profile pilot|scale|large|all] [--samples 3] [--budget-ms 1800000] [--fixture-parent EXTERNAL_EXISTING_DIRECTORY] [--revision SHA] [--id SCENARIO_ID]';
function manifest(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry => {
    const local = relative ? relative + '/' + entry.name : entry.name, file = path.join(root, local), stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), 'Links are refused in benchmark source');
    return stat.isDirectory() ? manifest(root, local) : [{ path: local, bytes: stat.size, sha256: hash(fs.readFileSync(file)) }];
  });
}
function parse(args) {
  const options = {};
  for (let n=0;n<args.length;n++) { const key=args[n]; if (!['--phase','--source','--out','--profile','--samples','--budget-ms','--fixture-parent','--revision','--id'].includes(key)||options[key]!==undefined||!args[n+1]) throw Error(usage); options[key]=args[++n]; }
  assert(['baseline','current'].includes(options['--phase']), usage); assert(options['--source']&&options['--out'],usage);
  const profile=options['--profile']??'pilot'; assert(['pilot','scale','large','all'].includes(profile));assert(!options['--id']||scenarios.some(c=>c.id===options['--id']),'Unknown --id');
  const number=(key,fallback)=>{const v=options[key]??String(fallback);assert(/^[1-9]\d*$/u.test(v));assert(Number.isSafeInteger(Number(v)));return Number(v);};
  return { phase:options['--phase'], source:path.resolve(options['--source']), out:validateOutputRoot(options['--out'],{projectRoot:project}), profile, samples:number('--samples',3), budgetMs:number('--budget-ms',1800000), fixtureParent:validateFixtureParent(options['--fixture-parent']??os.tmpdir(),{projectRoot:project}), revision:options['--revision']??null, caseId:options['--id']??null };
}
const scenarios = [
  { id:'layers0-files10', layers:0, files:10, size:256, group:'pilot' },
  { id:'layers1-files10', layers:1, files:10, size:256, group:'pilot' },
  { id:'layers2-files100', layers:2, files:100, size:256, group:'scale' },
  { id:'layers5-files100', layers:5, files:100, size:256, group:'scale' },
  { id:'layers10-files100', layers:10, files:100, size:256, group:'scale' },
  { id:'layers1-files1000', layers:1, files:1000, size:256, group:'scale' },
  { id:'layers1-files10000', layers:1, files:10000, size:256, group:'scale' },
  { id:'layers1-file1MiB', layers:1, files:1, size:1024*1024, group:'large' },
  { id:'layers1-file32MiB', layers:1, files:1, size:32*1024*1024, group:'large' },
  { id:'layers1-file100MiB', layers:1, files:1, size:100*1024*1024, group:'large' },
];
function summary(samples) {
  const groups = new Map(); for (const s of samples) { const a=groups.get(s.operation)??[];a.push(s);groups.set(s.operation,a); }
  const median=values=>{const a=[...values].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
  return [...groups].map(([operation,rows])=>{const times=rows.map(s=>s.durationMs),m=median(times);return {operation,samples:rows.length,medianMs:m,minMs:Math.min(...times),maxMs:Math.max(...times),medianAbsoluteDeviationMs:median(times.map(t=>Math.abs(t-m))),p95Ms:rows.length>=20?[...times].sort((a,b)=>a-b)[Math.ceil(rows.length*.95)-1]:null,gitProcesses:rows.map(s=>s.git.count),gitDurationMs:rows.map(s=>s.git.totalDurationMs),rssPeakBytes:Math.max(...rows.map(s=>s.resources.rssPeakBytes)),outcomes:rows.map(s=>s.outcome)};});
}
function generateFile(file, size, seed) {
  fs.mkdirSync(path.dirname(file),{recursive:true});const fd=fs.openSync(file,'wx'),buffer=Buffer.allocUnsafe(Math.min(1024*1024,size));let state=seed>>>0;
  try { for(let offset=0;offset<size;offset+=buffer.length) { const len=Math.min(buffer.length,size-offset);for(let n=0;n<len;n++){state^=state<<13;state^=state>>>17;state^=state<<5;buffer[n]=state&255;}fs.writeSync(fd,buffer,0,len); } } finally {fs.closeSync(fd);}
}
async function worker(jobFile) {
  const job=read(jobFile);assert.equal(job.schema,1);assert.equal(read(path.join(job.fixture.root,'.git-compat-owned.json')).nonce,job.fixture.nonce);assert(within(job.fixture.root,job.repo));
  const {GitLayers,Transaction}=await import(pathToFileURL(job.bundle).href), scenario=job.scenario, samples=[],nativeRecords=[];
  const output=job.caseDir; const startedAt=new Date().toISOString();let app;
  const result={schema:1,status:'RUNNING',phase:job.phase,scenario,scale:{baseFiles:scenario.layers?10:scenario.files,layerFiles:scenario.layers?scenario.files:0,bytesPerLayerFile:scenario.size,targetLayerFiles:scenario.layers?Math.ceil(scenario.files/scenario.layers):0},startedAt,samples:[],limitations:['Warm filesystem after setup; no OS cache eviction. First process execution is not called cold cache.','Git subprocesses counted at actual Core spawn boundary without a ring limit; observer Git is recorded separately.','Logical materialized bytes are measured from fixture sizes; physical IO bytes and page-cache traffic are not claimed.','Method phase timings are inclusive and nested; they must not be added together.','Memory is worker RSS sampled every 10ms plus start/end; sub-10ms peaks and child Git RSS are not measured.','Samples below20 do not report p95.','Failures are preserved; safety refusals have their own operation labels.']};
  writeNew(path.join(output,'started.json'),result);
  const native=(args,index)=>{assert.equal(read(path.join(job.fixture.root,'.git-compat-owned.json')).nonce,job.fixture.nonce);const start=performance.now();const run=spawnSync(job.git,['--no-pager','-c','core.autocrlf=false','-c','core.fsmonitor=false',...args],{cwd:job.repo,env:{...process.env,...(index?{GIT_INDEX_FILE:index}:{})},shell:false,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});nativeRecords.push({args,index:index?path.basename(index):null,durationMs:performance.now()-start,code:run.status,signal:run.signal});assert.ifError(run.error);assert.equal(run.status,0,run.stderr);return run.stdout;};
  let activeMetric=null;
  const methods=['materialize','diskSnapshot','track','after','writeCopy','writeBytes','remove','deactivateInternal','guard','refresh','load','owners','changes','checkpoint','updateExcludes','verifyExcludes','syncEditingInternal','editingCandidates','captureEditingFrontier','stageIndexInternal','publish','save','rollback'];
  for(const name of methods){const original=GitLayers.prototype[name];if(typeof original!=='function')continue;GitLayers.prototype[name]=async function(...args){const metric=activeMetric,start=performance.now();try{return await original.apply(this,args);}finally{if(metric){const row=metric.phases[name]??{calls:0,durationMs:0};row.calls++;row.durationMs+=performance.now()-start;metric.phases[name]=row;}}};}
  for(const name of ['record','backup','finish','fail']){const original=Transaction.prototype[name];Transaction.prototype[name]=async function(...args){const metric=activeMetric,start=performance.now();try{return await original.apply(this,args);}finally{if(metric){const key='transaction.'+name,row=metric.phases[key]??{calls:0,durationMs:0};row.calls++;row.durationMs+=performance.now()-start;metric.phases[key]=row;}}};}
  globalThis.__GL_BENCH_SPAWN=(entry)=>{if(activeMetric){activeMetric.gitEntries.push(entry);} };
  async function measure(operation, sample, action, logicalBytes=0, expectedCode=null) {
    const metric={operation,sample,startedAt:new Date().toISOString(),gitEntries:[],phases:{}};activeMetric=metric;
    const rssBefore=process.memoryUsage().rss;let rssPeak=rssBefore;const timer=setInterval(()=>{rssPeak=Math.max(rssPeak,process.memoryUsage().rss);},10);
    const at=performance.now();let value,error;try{value=await action();}catch(e){error=e;}finally{metric.durationMs=performance.now()-at;clearInterval(timer);rssPeak=Math.max(rssPeak,process.memoryUsage().rss);activeMetric=null;}
    const byCommand={};for(const entry of metric.gitEntries){const key=entry.command;const row=byCommand[key]??{count:0,durationMs:0,stdoutBytes:0,stderrBytes:0};row.count++;row.durationMs+=entry.durationMs??0;row.stdoutBytes+=entry.stdoutBytes??0;row.stderrBytes+=entry.stderrBytes??0;byCommand[key]=row;}
    metric.git={count:metric.gitEntries.length,exact:true,totalDurationMs:metric.gitEntries.reduce((a,b)=>a+(b.durationMs??0),0),byCommand};metric.resources={rssBeforeBytes:rssBefore,rssAfterBytes:process.memoryUsage().rss,rssPeakBytes:rssPeak,workerMaxRssBytes:process.resourceUsage().maxRSS*1024,logicalMaterializedBytes:logicalBytes,logicalWithdrawnBytes:operation==='off'?Math.ceil(scenario.files/scenario.layers)*scenario.size:0,physicalIOBytes:null};metric.outcome=error?'REFUSED':'SUCCESS';if(error)metric.error={code:error.code??null,message:portable(error.message,job)};
    samples.push(metric);append(path.join(output,'samples.jsonl'),metric);console.log(JSON.stringify({case:scenario.id,phase:job.phase,operation,sample,ms:Math.round(metric.durationMs),git:metric.git.count,outcome:metric.outcome}));
    if(expectedCode)assert.equal(error?.code,expectedCode);else if(error)throw error;return value;
  }
  const paths=[],filesByLayer=Array.from({length:scenario.layers},()=>[]);fs.mkdirSync(job.repo);
  try {
    native(['init','-b','main','--template='+job.template]);native(['config','core.hooksPath',os.devNull]);
    const baseCount=scenario.layers?10:scenario.files;
    for(let n=0;n<baseCount;n++)generateFile(path.join(job.repo,'base','file-'+n+'.bin'),256,n+1);
    native(['add','--','base']);native(['commit','-m','synthetic base']);native(['branch','bench-other']);
    for(let n=0;n<scenario.files&&scenario.layers;n++){const layer=n%scenario.layers,file='layer-'+layer+'/file-'+n+'.bin';paths.push(file);filesByLayer[layer].push(file);generateFile(path.join(job.repo,file),scenario.size,n+79);}
    for(let layer=0;layer<scenario.layers;layer++){
      const index=path.join(job.fixture.root,'seed-'+layer+'.index');native(['read-tree','--empty'],index);for(let n=0;n<filesByLayer[layer].length;n+=200)native(['add','--',...filesByLayer[layer].slice(n,n+200)],index);
      const tree=native(['write-tree'],index).trim(),oid=native(['commit-tree',tree,'-m','synthetic layer '+layer],index).trim();native(['update-ref','refs/heads/layer/bench'+layer,oid]);
    }
    for(const file of paths)fs.unlinkSync(path.join(job.repo,file));
    const expectedHashes=new Map();for(let layer=0;layer<scenario.layers;layer++){for(const record of native(['ls-tree','-r','-z','refs/heads/layer/bench'+layer]).split('\0')){if(!record)continue;const tab=record.indexOf('\t');expectedHashes.set(record.slice(tab+1),record.slice(0,tab).split(' ')[2]);}}
    // Observer work above is excluded from timing; no per-file Core instrumentation.
    app=await measure('init',1,()=>GitLayers.init(job.repo));
    for(let layer=0;layer<scenario.layers;layer++)await measure('first-on-register-layer'+layer,1,()=>app.on('bench'+layer),filesByLayer[layer].length*scenario.size);
    const baseHead=native(['rev-parse','HEAD']).trim(),baseIndex=native(['ls-files','--stage','-z']);
    for(let sample=1;sample<=job.samples;sample++) {
      app=await measure('open',sample,()=>GitLayers.open(job.repo));
      const status=await measure('status',sample,()=>app.status());assert.equal(status.safe,true,JSON.stringify(status.error));assert.equal(status.layers.filter(l=>l.state==='active').length,scenario.layers);
      await measure('list',sample,()=>app.list());await measure('excludes',sample,()=>app.verifyExcludes());await measure('recover-empty',sample,()=>app.recover());
      if(!scenario.layers)continue;
      await measure('on-repeat',sample,()=>app.on('bench0'));
      const previewState=[fs.readFileSync(path.join(app.dir,'registry.json')),fs.readFileSync(path.join(app.dir,'workspace.json')),fs.readFileSync(app.repo.exclude)];
      await measure('preview-off',sample,()=>app.preview('off','bench0'));assert.deepEqual([fs.readFileSync(path.join(app.dir,'registry.json')),fs.readFileSync(path.join(app.dir,'workspace.json')),fs.readFileSync(app.repo.exclude)],previewState);
      await measure('off',sample,()=>app.off('bench0'));for(const file of filesByLayer[0])assert(!fs.existsSync(path.join(job.repo,file)));
      await measure('on',sample,()=>app.on('bench0'),filesByLayer[0].length*scenario.size);
    }
    if(scenario.id==='layers1-files10') {
      for(let sample=1;sample<=job.samples;sample++) {
        await measure('edit',sample,()=>app.target('bench0'));await measure('edit-end',sample,()=>app.target());
        const file='stage-measured.txt',disk=path.join(job.repo,file);fs.writeFileSync(disk,'prepared B '+sample+'\n');await measure('add',sample,()=>app.add('bench0',[file]));fs.writeFileSync(disk,'disk C '+sample+'\n');
        await measure('commit',sample,()=>app.commit('bench0','measured '+sample));assert.equal(native(['show','layer/bench0:'+file]).trim(),'prepared B '+sample);assert.equal(fs.readFileSync(disk,'utf8'),'disk C '+sample+'\n');
        await measure('on-repeat-disk-C',sample,()=>app.on('bench0'));assert.equal(fs.readFileSync(disk,'utf8'),'disk C '+sample+'\n');await measure('off-dirty-refusal',sample,()=>app.off('bench0'),0,'LAYER_DIRTY');assert.equal(fs.readFileSync(disk,'utf8'),'disk C '+sample+'\n');
        fs.writeFileSync(disk,'prepared B '+sample+'\n');
        await measure('switch-other',sample,()=>app.switch('bench-other'));await measure('switch-main',sample,()=>app.switch('main'));
      }
      process.env.GIT_LAYERS_FAILPOINT='after-deactivate-files';try{await measure('off-interrupted',1,()=>app.off('bench0'),0,'INJECTED_FAILURE');}finally{delete process.env.GIT_LAYERS_FAILPOINT;}
      app=await GitLayers.open(job.repo);await measure('recover-interrupted-off',1,()=>app.recover());const recoveryRefs=native(['for-each-ref','--format=%(refname) %(objectname)','refs/heads/']);assert.equal(fs.readFileSync(path.join(job.repo,'stage-measured.txt'),'utf8'),'prepared B '+job.samples+'\n');await measure('recover-idempotent',1,()=>app.recover());assert.equal(native(['for-each-ref','--format=%(refname) %(objectname)','refs/heads/']),recoveryRefs);assert.equal(fs.readFileSync(path.join(job.repo,'stage-measured.txt'),'utf8'),'prepared B '+job.samples+'\n');
    }
    // Independent native observer checks final refs, semantic MAIN and all original blobs.
    assert.equal(native(['rev-parse','HEAD']).trim(),baseHead);assert.equal(native(['ls-files','--stage','-z']),baseIndex);assert.equal(native(['symbolic-ref','--short','HEAD']).trim(),'main');
    for(let n=0;n<paths.length;n+=200){const selected=paths.slice(n,n+200),oids=native(['hash-object','--',...selected]).trim().split('\n');assert.equal(oids.length,selected.length);for(let i=0;i<selected.length;i++)assert.equal(oids[i].trim(),expectedHashes.get(selected[i]),'Materialized file changed: '+selected[i]);}
    assert.equal((await app.status()).safe,true);
    result.status='PASS';result.semanticStatePreserved=true;
  } catch(error) {result.status='FAIL';result.error={code:error.code??null,message:portable(error.message,job),stack:portable(error.stack,job)};process.exitCode=1;}
  finally {
    activeMetric=null;globalThis.__GL_BENCH_SPAWN=undefined;result.finishedAt=new Date().toISOString();result.samples=samples;result.summary=summary(samples);result.nativeObserverCommands=nativeRecords;result.fixtureRetained=result.status!=='PASS';
    const disk=directory=>fs.readdirSync(directory,{withFileTypes:true}).reduce((sum,e)=>{const file=path.join(directory,e.name),stat=fs.lstatSync(file);assert(!stat.isSymbolicLink());return sum+(stat.isDirectory()?disk(file):stat.size);},0);
    result.finalFixtureLogicalBytes=disk(job.fixture.root);writeNew(path.join(output,'result.json'),result);
  }
}
const spawnObserver = `
function spawn(...args) {
 const start=performance.now(), argv=args[1]??[], entry={command:argv.find((arg,i)=>i>0 && !arg.startsWith('-') && !arg.includes('='))??'unknown',pid:null,startedAt:new Date().toISOString(),stdoutBytes:0,stderrBytes:0};
 const known=new Set(['init','rev-parse','symbolic-ref','config','check-ref-format','for-each-ref','show-ref','show','log','status','diff','diff-files','diff-index','diff-tree','ls-files','ls-tree','cat-file','hash-object','read-tree','write-tree','update-index','checkout-index','commit-tree','update-ref','check-ignore','mktree','var','apply','check-attr','add','restore','reset','commit','branch','switch','checkout','tag','stash','merge','merge-base','cherry-pick','revert','worktree','rm','mv','remote','fsck','rev-list','reflog','gc','prune','clean','version','count-objects']);
 entry.command=argv.find(arg=>known.has(arg))??'unknown';
 if(globalThis.__GL_BENCH_SPAWN)globalThis.__GL_BENCH_SPAWN(entry);
 let child;try{child=nativeSpawn(...args);entry.pid=child.pid??null;}catch(error){entry.error=error.code??String(error);entry.code=null;entry.signal=null;entry.durationMs=performance.now()-start;throw error;}
 child.stdout?.on('data',chunk=>entry.stdoutBytes+=chunk.length);child.stderr?.on('data',chunk=>entry.stderrBytes+=chunk.length);
 child.once('error',error=>{entry.error=error.code??String(error);entry.durationMs=performance.now()-start;});
 child.once('close',(code,signal)=>{entry.code=code;entry.signal=signal;entry.durationMs=performance.now()-start;});return child;
}
`;
async function main() {
  const options=parse(process.argv.slice(2));const runnerHash=hash(fs.readFileSync(self));const dependencies=['git-compat/lib.mjs','git-compat/fixture-parent.mjs','git-compat/output-root.mjs'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(path.dirname(self),file)))}));const git=resolveGit();const source=path.join(options.source,'src/core'),inputs=manifest(source),fingerprint=hash(JSON.stringify(inputs));
  assert(fs.statSync(source).isDirectory());fs.mkdirSync(options.out,{recursive:true});const phaseDir=path.join(options.out,options.phase);let config;
  if(fs.existsSync(phaseDir)){config=read(path.join(phaseDir,'config.json'));assert.equal(config.runnerSha256,runnerHash,'Resume requires the same runner');assert.deepEqual(config.runnerDependencies,dependencies,'Resume requires identical observer dependencies');assert.equal(config.sourceFingerprint,fingerprint,'Resume requires unchanged source');assert.equal(config.samples,options.samples,'Resume requires same sample count');}
  else {fs.mkdirSync(phaseDir);config={schema:1,phase:options.phase,revision:options.revision,runnerSha256:runnerHash,runnerDependencies:dependencies,sourceFingerprint:fingerprint,inputs,samples:options.samples,createdAt:new Date().toISOString(),platform:{node:process.version,os:process.platform,arch:process.arch,release:os.release(),availableParallelism:os.availableParallelism(),memoryBytes:os.totalmem(),cpuModel:os.cpus()[0]?.model??null,git:spawnSync(git,['--version'],{encoding:'utf8',windowsHide:true}).stdout.trim(),gitExecutableSha256:hash(fs.readFileSync(git))},budget:{diskBytes:4*1024**3,perInvocationMs:options.budgetMs},methodology:{processes:'one fresh worker per scenario; setup before samples',cache:'warm after setup; no eviction; not cold OS cache',materializedBytes:'logical file bytes only',p95:'only20 or more samples',gitCount:'unbounded observer at real Core spawn; no getGitActivity counting'}};writeNew(path.join(phaseDir,'config.json'),config);
    const frozen=path.join(phaseDir,'source/src/core');fs.mkdirSync(frozen,{recursive:true});for(const item of inputs){const target=path.join(frozen,item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,item.path),target,fs.constants.COPYFILE_EXCL);}assert.deepEqual(manifest(frozen),inputs);
    const {build}=await import('esbuild');await build({absWorkingDir:path.join(phaseDir,'source'),entryPoints:[path.join(frozen,'index.ts')],outfile:path.join(phaseDir,'core.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',logLevel:'silent',plugins:[{name:'benchmark-spawn-observer',setup(builder){builder.onLoad({filter:/[\\/]core[\\/]index\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8')+'\nexport { Transaction };\n',loader:'ts'}));builder.onLoad({filter:/[\\/]core[\\/]git\.ts$/},args=>{const text=fs.readFileSync(args.path,'utf8');assert(text.includes("import { spawn } from 'node:child_process';"));return {contents:text.replace("import { spawn } from 'node:child_process';","import { spawn as nativeSpawn } from 'node:child_process';\n"+spawnObserver),loader:'ts'};});}}]});
    writeNew(path.join(phaseDir,'bundle.json'),{sha256:hash(fs.readFileSync(path.join(phaseDir,'core.mjs'))),sourceFingerprint:fingerprint,observerOnly:true});
  }
  assert.equal(hash(fs.readFileSync(path.join(phaseDir,'core.mjs'))),read(path.join(phaseDir,'bundle.json')).sha256);
  assert(!options.caseId||scenarios.some(c=>c.id===options.caseId),'Unknown --id');const selected=scenarios.filter(c=>(options.profile==='all'||c.group===options.profile)&&(!options.caseId||c.id===options.caseId)),start=performance.now();assert(selected.length,'Empty benchmark selection');let failed=false;
  append(path.join(phaseDir,'events.jsonl'),{kind:'INVOCATION',startedAt:new Date().toISOString(),selected:selected.map(c=>c.id),budgetMs:options.budgetMs,samples:options.samples,runnerSha256:runnerHash});
  for(const scenario of selected){const caseRoot=path.join(phaseDir,scenario.id);if(fs.existsSync(path.join(caseRoot,'result.json'))&&read(path.join(caseRoot,'result.json')).status==='PASS'){console.log('RESUME_SKIP '+scenario.id);continue;}if(performance.now()-start>=options.budgetMs){append(path.join(phaseDir,'events.jsonl'),{kind:'BUDGET_NOT_RUN',scenario:scenario.id,at:new Date().toISOString()});continue;}
    const caseDir=fs.existsSync(caseRoot)?path.join(phaseDir,scenario.id+'-retry-'+Date.now()):caseRoot;fs.mkdirSync(caseDir);const fixture=createFixture(options.fixtureParent,'gl-perf-'+options.phase),env=isolatedEnvironment(fixture.root,git),template=path.join(fixture.root,'empty-template');fs.mkdirSync(template);
    const job={schema:1,phase:options.phase,phaseDir,caseDir,scenario,fixture,git,template,repo:path.join(fixture.root,'repo'),bundle:path.join(phaseDir,'core.mjs'),samples:options.samples};const jobFile=path.join(fixture.root,'job.json');writeNew(jobFile,job);
    const timeout=Math.max(1000,options.budgetMs-(performance.now()-start));console.log('START '+options.phase+' '+scenario.id);
    const execution=await execute(process.execPath,[self,'--worker',jobFile],{cwd:project,env,timeout,maxOutput:16*1024*1024});fs.writeFileSync(path.join(caseDir,'stdout.txt'),execution.stdoutBuffer,{flag:'wx'});fs.writeFileSync(path.join(caseDir,'stderr.txt'),execution.stderrBuffer,{flag:'wx'});
    const processRecord={code:execution.code,signal:execution.signal,timedOut:execution.timedOut,durationMs:execution.duration_ms,termination:execution.termination,outputTruncated:execution.outputTruncated};writeNew(path.join(caseDir,'process.json'),processRecord);
    const result=fs.existsSync(path.join(caseDir,'result.json'))?read(path.join(caseDir,'result.json')):null;
    if(execution.code===0&&!execution.signal&&!execution.timedOut&&!execution.outputTruncated&&result?.status==='PASS'){cleanupFixture(fixture);}else{failed=true;writeNew(path.join(caseDir,'preserved-fixture.json'),{fixture,reason:'failure or interruption; retained for inspection'});}
    append(path.join(phaseDir,'events.jsonl'),{kind:'CASE_COMPLETED',scenario:scenario.id,result:result?.status??'NO_RESULT',process:processRecord,at:new Date().toISOString()});console.log('END '+scenario.id+' '+(result?.status??'NO_RESULT')+' '+Math.round(execution.duration_ms)+'ms');
  }
  assert.deepEqual(manifest(source),inputs,'Source changed during the benchmark invocation');process.exitCode=failed?1:0;
}
if(process.argv[2]==='--worker'&&process.argv.length===4)await worker(process.argv[3]);else if(process.argv[2]==='--help')console.log(usage);else await main();
