import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isolatedEnvironment,execute} from './audited-lib.mjs';

const self=fileURLToPath(import.meta.url),helper=path.join(path.dirname(self),'audited-lib.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const argv=process.argv.slice(2),options={};
for(let i=0;i<argv.length;i++){
  const key=argv[i];if(key==='--execute'){assert(!options.execute);options.execute=true;continue;}
  assert(['--mode','--project','--expected-sha','--manifest','--out','--git','--npm-cli'].includes(key)&&options[key]===undefined,'Unknown/duplicate argument');
  assert(argv[i+1]&&!argv[i+1].startsWith('--'),'Missing argument value');options[key]=argv[++i];
}
assert(options.execute,'Preparation only: use explicit --execute to deliberately start validation after review and exact commit preparation.');
for(const key of ['--mode','--project','--expected-sha','--manifest','--out','--git','--npm-cli'])assert(options[key],key+' required');
assert(['local','github'].includes(options['--mode']),'Mode must be local or github');
const project=path.resolve(options['--project']),out=path.resolve(options['--out']),manifestPath=path.resolve(options['--manifest']);
const expectedSHA=options['--expected-sha'];assert(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(expectedSHA),'Exact full commit SHA required');
const gitPath=options['--git'],npmCLI=options['--npm-cli'];assert(path.isAbsolute(gitPath)&&path.isAbsolute(npmCLI),'Absolute executable/CLI paths required');
const within=(parent,child)=>{const r=path.relative(parent,child);return r!==''&&r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const regular=file=>{const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink(),'Regular file required');return stat;};
regular(gitPath);regular(npmCLI);regular(self);regular(helper);regular(manifestPath);
const inputs=['src','scripts','tests','package-lock.json','package.json','tsconfig.debug.json','tsconfig.json'];
const expected=JSON.parse(fs.readFileSync(manifestPath,'utf8').replace(/^\uFEFF/u,''));
assert.deepEqual(expected.inputs,inputs,'Functional input domain must match the approved validation domain');
assert(Array.isArray(expected.files),'Expected manifest files must be an array');
const expectedCount=expected.files.length;assert(Number.isSafeInteger(expectedCount)&&expectedCount>0&&expectedCount<=100000,'Expected functional count must be positive and bounded');
const relativeFile=file=>typeof file==='string'&&file&&!path.isAbsolute(file)&&!path.win32.isAbsolute(file)&&!file.includes('\\')&&!file.split('/').includes('..');
for(const item of expected.files)assert(relativeFile(item.path)&&/^[a-f0-9]{64}$/u.test(item.sha256)&&Number.isSafeInteger(item.bytes)&&item.bytes>=0,'Invalid expected manifest');
assert.equal(new Set(expected.files.map(f=>f.path)).size,expectedCount,'Duplicate expected input');
const fingerprint=files=>sha(JSON.stringify(files.map(f=>[f.path,f.sha256])));
assert.equal(fingerprint(expected.files),expected.fingerprint,'Invalid manifest fingerprint');
const parent=fs.realpathSync(path.dirname(out));assert.equal(path.dirname(out),parent,'Output parent must already be its canonical ordinary path');
assert.equal(parent,fs.realpathSync(os.tmpdir()),'New evidence root must be directly under the real temporary parent');
assert(!within(project,out)&&project!==out&&!fs.existsSync(out),'Evidence root must be new and outside source');
for(let current=parent;;current=path.dirname(current)){
  const stat=fs.lstatSync(current);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Linked/non-directory evidence ancestor refused');
  assert(!fs.existsSync(path.join(current,'.git')),'Evidence must not be under an existing Git repository');if(path.dirname(current)===current)break;
}
fs.mkdirSync(out,{recursive:false});const nonce=randomUUID(),marker=path.join(out,'.owned-fresh-validation.json');
const ownership={schema:1,nonce,parent,purpose:'Retained fresh committed Core/CLI validation',mode:options['--mode']};
fs.writeFileSync(marker,JSON.stringify(ownership,null,2)+'\n',{flag:'wx'});const rootIdentity=fs.lstatSync(out),markerHash=sha(fs.readFileSync(marker));
function owned(){const s=fs.lstatSync(out);assert(s.isDirectory()&&!s.isSymbolicLink()&&s.dev===rootIdentity.dev&&s.ino===rootIdentity.ino,'Evidence identity changed');assert.equal(fs.realpathSync(path.dirname(out)),parent);assert.equal(sha(fs.readFileSync(marker)),markerHash,'Ownership marker changed');}
function json(name,value){owned();assert(relativeFile(name));const file=path.join(out,name);assert(within(out,file));fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
const startedAt=new Date().toISOString(),programHash=sha(fs.readFileSync(self)),helperHash=sha(fs.readFileSync(helper)),manifestHash=sha(fs.readFileSync(manifestPath));
for(const[file,name]of[[self,'DRIVER.mjs'],[helper,'audited-lib.mjs'],[manifestPath,'EXPECTED-MANIFEST.json']])fs.copyFileSync(file,path.join(out,name),fs.constants.COPYFILE_EXCL);
const environmentRoot=path.join(out,'environment');fs.mkdirSync(environmentRoot);const env=isolatedEnvironment(environmentRoot,gitPath,process.env);
const npmUser=path.join(out,'npm-user.npmrc'),npmGlobal=path.join(out,'npm-global.npmrc');fs.writeFileSync(npmUser,'',{flag:'wx'});fs.writeFileSync(npmGlobal,'',{flag:'wx'});
Object.assign(env,{GIT_OPTIONAL_LOCKS:'0',GIT_CEILING_DIRECTORIES:out,npm_config_cache:path.join(out,'npm-cache'),npm_config_userconfig:npmUser,npm_config_globalconfig:npmGlobal,npm_config_audit:'false',npm_config_fund:'false',npm_config_update_notifier:'false',npm_config_ignore_scripts:'true',ELECTRON_SKIP_BINARY_DOWNLOAD:'1',PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1'});
const clone=path.join(out,'clone'),commands=[];let sourceBefore,sourceAfter,cloneBefore,cloneAfter,commitManifest,compiledBefore,compiledAfter,smokeSummary,caught;
json('STARTED.json',{schema:1,startedAt,mode:options['--mode'],expectedSHA,programSHA256:programHash,helperSHA256:helperHash,expectedManifestSHA256:manifestHash,functionalFingerprint:expected.fingerprint,functionalCount:expectedCount,node:process.version,platform:process.platform,arch:process.arch,qualification:'Explicit execution after review; fresh-copy validation only, not full-suite validation or hosted CI.'});
function normalize(value){let text=String(value);for(const[raw,label]of[[npmCLI,'<NPM_CLI>'],[manifestPath,'<EXPECTED_MANIFEST>'],[project,'<SOURCE>'],[out,'<EVIDENCE>'],[path.dirname(self),'<DRIVER>'],[path.dirname(process.execPath),'<NODE_INSTALLATION>'],[path.dirname(gitPath),'<OFFICIAL_GIT_INSTALLATION>']].sort((a,b)=>b[0].length-a[0].length))text=text.replaceAll(raw,label).replaceAll(raw.replaceAll('\\','/'),label);return text.replace(/(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s"'<>]*/gu,'<ABSOLUTE-PATH>').replace(/\/(?:Users|home|tmp|var\/tmp)\/[^\s"'<>]*/gu,'<ABSOLUTE-PATH>');}
async function run(label,executable,args,cwd,settings={}){
  owned();const n=String(commands.length+1).padStart(3,'0'),t0=new Date().toISOString();
  const result=await execute(executable,args,{cwd,env,stdin:settings.stdin,timeout:settings.timeout??120000,maxOutput:settings.maxOutput??16*1024*1024});
  const stdoutFile=n+'-'+label+'.stdout.log',stderrFile=n+'-'+label+'.stderr.log';owned();
  fs.writeFileSync(path.join(out,stdoutFile),result.stdoutBuffer,{flag:'wx'});fs.writeFileSync(path.join(out,stderrFile),result.stderrBuffer,{flag:'wx'});
  const record={label,executable,args,cwd,startedAt:t0,endedAt:new Date().toISOString(),exitCode:result.code,signal:result.signal,timedOut:result.timedOut,outputTruncated:result.outputTruncated,durationMs:result.duration_ms,expectedCodes:settings.codes??[0],error:result.error??null,termination:result.termination,stdout:{file:stdoutFile,bytes:result.stdoutBuffer.length,sha256:sha(result.stdoutBuffer)},stderr:{file:stderrFile,bytes:result.stderrBuffer.length,sha256:sha(result.stderrBuffer)}};
  commands.push(record);json(n+'-'+label+'.json',record);
  assert(!result.error&&!result.signal&&!result.timedOut&&!result.outputTruncated&&(settings.codes??[0]).includes(result.code),'Command failed: '+label);
  return result;
}
const gitArgs=args=>['--no-pager','-c','core.autocrlf=false','-c','core.fsmonitor=false','-c','color.ui=false','-c','credential.helper=','-c','gc.auto=0','-c','maintenance.auto=false',...args];
const git=(label,args,cwd=project,settings={})=>run(label,gitPath,gitArgs(args),cwd,settings);
function workingManifest(root){
  const found=[];function visit(file,relative){const s=fs.lstatSync(file);assert(!s.isSymbolicLink(),'Functional symlink refused');if(s.isDirectory())for(const name of fs.readdirSync(file).sort())visit(path.join(file,name),relative+'/'+name);else{assert(s.isFile());const bytes=fs.readFileSync(file);found.push({path:relative,sha256:sha(bytes),bytes:bytes.length});}}
  for(const input of inputs)visit(path.join(root,input),input);assert.equal(found.length,expectedCount,'Added/missing functional files');const map=new Map(found.map(f=>[f.path,f]));const ordered=expected.files.map(f=>map.get(f.path));assert(ordered.every(Boolean),'Functional path domain mismatch');assert.deepEqual(ordered,expected.files,'Functional bytes differ from committed expected manifest');return {fingerprint:fingerprint(ordered),count:ordered.length,files:ordered};
}
function compiledManifest(){return ['core/index.js','cli/index.js','package.json','build-manifest.json'].map(file=>{const p=path.join(clone,'dist-core',file);regular(p);const bytes=fs.readFileSync(p);return {path:file,bytes:bytes.length,sha256:sha(bytes)};});}
function assertObjectsIndependent(){const objects=path.join(clone,'.git/objects');assert(!fs.existsSync(path.join(objects,'info/alternates')),'Object alternates refused');let files=0;const visit=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const p=path.join(directory,entry.name),s=fs.lstatSync(p);assert(!s.isSymbolicLink(),'Linked clone object refused');if(s.isDirectory())visit(p);else{assert(s.isFile()&&s.nlink===1,'Hardlinked clone object refused');files++;}}};visit(objects);return {alternates:false,regularSingleLinkObjectFiles:files};}
let objectIndependence;
try{
  await git('git-version',['--version']);await run('npm-version',process.execPath,[npmCLI,'--version'],project);
  assert.equal((await git('source-head',['rev-parse','--verify','HEAD'])).stdout.trim(),expectedSHA,'Source HEAD differs from target commit');
  assert.equal((await git('source-branch',['symbolic-ref','--short','HEAD'])).stdout.trim(),'main','Source must remain main');
  sourceBefore=workingManifest(project);json('SOURCE-BEFORE.json',sourceBefore);
  const list=(await git('commit-functional-tree',['ls-tree','-r','-z','--full-tree',expectedSHA])).stdoutBuffer;
  const entries=list.toString('utf8').split('\0').filter(Boolean).map(line=>{const match=/^(\d{6}) (blob|tree|commit) ([a-f0-9]+)\t(.+)$/u.exec(line);assert(match,'Malformed official tree entry');return {mode:match[1],kind:match[2],oid:match[3],path:match[4]};}).filter(e=>inputs.some(input=>e.path===input||e.path.startsWith(input+'/')));
  assert.equal(entries.length,expectedCount,'Committed functional domain mismatch');for(const e of entries)assert(e.kind==='blob'&&['100644','100755'].includes(e.mode)&&relativeFile(e.path),'Nonregular committed functional source refused');
  const batch=await git('commit-functional-blobs',['cat-file','--batch'],project,{stdin:entries.map(e=>e.oid).join('\n')+'\n',maxOutput:32*1024*1024});let offset=0;const committed=new Map();
  for(const e of entries){const end=batch.stdoutBuffer.indexOf(10,offset);assert(end>=offset);const header=batch.stdoutBuffer.subarray(offset,end).toString('ascii').split(' ');assert.equal(header[0],e.oid);assert.equal(header[1],'blob');assert(/^\d+$/u.test(header[2]));const size=Number(header[2]);offset=end+1;const bytes=batch.stdoutBuffer.subarray(offset,offset+size);assert.equal(bytes.length,size);offset+=size;assert.equal(batch.stdoutBuffer[offset++],10);committed.set(e.path,{path:e.path,sha256:sha(bytes),bytes:size});}
  assert.equal(offset,batch.stdoutBuffer.length);const commitFiles=expected.files.map(e=>committed.get(e.path));assert.deepEqual(commitFiles,expected.files,'Target commit bytes differ from approved manifest');commitManifest={fingerprint:fingerprint(commitFiles),count:expectedCount,files:commitFiles};json('COMMIT-MANIFEST.json',commitManifest);
  if(options['--mode']==='local')await git('source-uploadpack-hook',['config','--local','--get','uploadpack.packObjectsHook'],project,{codes:[1]});
  const origin=options['--mode']==='local'?project:'https://github.com/rabrunos/GitLayer.git';
  await git('fresh-clone',['-c',options['--mode']==='local'?'protocol.file.allow=always':'protocol.https.allow=always','clone','--no-local','--no-hardlinks','--no-checkout','--',origin,clone],out,{timeout:600000});
  await git('clone-local-autocrlf',['config','--local','core.autocrlf','false'],clone);
  assert.equal((await git('clone-origin-main',['rev-parse','--verify','refs/remotes/origin/main'],clone)).stdout.trim(),expectedSHA,'Clone did not receive the expected main commit');
  await git('clone-checkout',['checkout','--detach',expectedSHA],clone);
  assert.equal((await git('clone-head',['rev-parse','--verify','HEAD'],clone)).stdout.trim(),expectedSHA);objectIndependence=assertObjectsIndependent();cloneBefore=workingManifest(clone);json('CLONE-BEFORE.json',cloneBefore);
  await run('lockfile-install',process.execPath,[npmCLI,'ci','--ignore-scripts','--include=dev','--no-audit','--no-fund'],clone,{timeout:1200000});
  cloneAfter=workingManifest(clone);
  await run('typecheck',process.execPath,[path.join(clone,'node_modules/typescript/bin/tsc'),'--noEmit'],clone);
  await run('core-cli-build',process.execPath,[path.join(clone,'scripts/build-core.mjs')],clone);
  const build=JSON.parse(fs.readFileSync(path.join(clone,'dist-core/build-manifest.json'),'utf8'));assert(build.inputs.length&&build.inputs.every(file=>/^src\/(?:core|cli)\//u.test(file)),'Desktop/non-Core build input refused');compiledBefore=compiledManifest();
  await run('compiled-help',process.execPath,[path.join(clone,'dist-core/cli/index.js'),'--help'],clone);
  await run('relocated-smoke',process.execPath,[path.join(clone,'scripts/smoke-core-cli.mjs'),'--out',path.join(out,'smoke')],clone,{timeout:1800000});
  const smokeDirs=fs.readdirSync(path.join(out,'smoke'),{withFileTypes:true}).filter(e=>e.isDirectory());assert.equal(smokeDirs.length,1,'Expected exactly one smoke campaign');const smoke=JSON.parse(fs.readFileSync(path.join(out,'smoke',smokeDirs[0].name,'result.json'),'utf8'));
  assert.equal(smoke.status,'PASS');assert.equal(smoke.runtimeRelocatedWithoutDependencies,true);assert.equal(smoke.commandCount,82);assert.equal(smoke.snapshotCount,4);assert.equal(smoke.steps.length,7);assert(smoke.steps.every(step=>step.status==='PASS'));smokeSummary={status:smoke.status,commands:smoke.commandCount,snapshots:smoke.snapshotCount,steps:smoke.steps,runtimeRelocatedWithoutDependencies:smoke.runtimeRelocatedWithoutDependencies};
  compiledAfter=compiledManifest();assert.deepEqual(compiledAfter,compiledBefore,'Compiled runtime changed during smoke');cloneAfter=workingManifest(clone);sourceAfter=workingManifest(project);assert.equal((await git('source-final-head',['rev-parse','--verify','HEAD'])).stdout.trim(),expectedSHA);assert.equal((await git('clone-final-head',['rev-parse','--verify','HEAD'],clone)).stdout.trim(),expectedSHA);
  assert.equal(sha(fs.readFileSync(self)),programHash,'Driver changed during execution');assert.equal(sha(fs.readFileSync(helper)),helperHash,'Audited helper changed during execution');assert.equal(sha(fs.readFileSync(manifestPath)),manifestHash,'Expected source manifest changed');json('SOURCE-AFTER.json',sourceAfter);json('CLONE-AFTER.json',cloneAfter);
}catch(error){caught={name:error?.name??'Error',code:error?.code??null,message:String(error?.message??error),stack:error?.stack??null};process.exitCode=1;}
const endedAt=new Date().toISOString(),status=caught?'FAIL':'PASS';
const raw={schema:1,kind:'fresh-committed-core-cli-validation',status,startedAt,endedAt,mode:options['--mode'],expectedSHA,programSHA256:programHash,helperSHA256:helperHash,expectedManifestSHA256:manifestHash,sourceBefore,sourceAfter,cloneBefore,cloneAfter,commitManifest,compiledBefore,compiledAfter,objectIndependence,smoke:smokeSummary,commands,error:caught,retainedEvidence:true,qualification:'Independent fresh clone, lockfile install with scripts disabled, typecheck/build/help/compiled relocated smoke only. No full-suite or hosted-CI claim. No cleanup; every partial installation, clone and raw log is retained.'};json('RAW-RESULT.json',raw);
const publicCommands=commands.map(c=>({label:c.label,executable:normalize(c.executable),argv:c.args.map(normalize),cwd:normalize(c.cwd),startedAt:c.startedAt,endedAt:c.endedAt,exitCode:c.exitCode,signal:c.signal,timedOut:c.timedOut,outputTruncated:c.outputTruncated,durationMs:c.durationMs,expectedCodes:c.expectedCodes,stdout:c.stdout,stderr:c.stderr}));
const summarize=m=>m?{fingerprint:m.fingerprint,count:m.count??m.files.length}:null;
const summary={schema:1,kind:raw.kind,status,startedAt,endedAt,mode:raw.mode,expectedSHA,programSHA256:programHash,helperSHA256:helperHash,expectedManifestSHA256:manifestHash,rawResultSHA256:sha(fs.readFileSync(path.join(out,'RAW-RESULT.json'))),functional:{expected:summarize(expected),commit:summarize(commitManifest),sourceBefore:summarize(sourceBefore),sourceAfter:summarize(sourceAfter),cloneBefore:summarize(cloneBefore),cloneAfter:summarize(cloneAfter)},objectIndependence,compiledBefore,compiledAfter,smoke:smokeSummary,commands:publicCommands,error:caught?{name:caught.name,code:caught.code,qualification:'See retained private raw result for details; no host paths or process data projected.'}:null,install:{command:'npm ci --ignore-scripts --include=dev --no-audit --no-fund',lifecycleScripts:false,desktopBinaryInstallation:false,qualification:'Exact dev packages are installed from the lockfile; Electron/desktop lifecycle/binary installation and runtime execution are not certified.'},qualification:raw.qualification};
const publicBytes=JSON.stringify(summary,null,2)+'\n';assert(!/(?:[A-Za-z]:[\\/]+Users[\\/]|AppData[\\/]|S-1-5-21-|"(?:pid|processId|parentProcessId|commandLine)"\s*:|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/iu.test(publicBytes),'Public summary privacy refusal; raw result retained');json('PUBLIC-RESULT.json',summary);json('PUBLIC-SOURCE-MANIFEST.json',{schema:1,inputs,fingerprint:expected.fingerprint,files:expected.files});
console.log(JSON.stringify({status,mode:raw.mode,expectedSHA,functionalFingerprint:expected.fingerprint,functionalFiles:expectedCount,smoke:smokeSummary?{commands:smokeSummary.commands,snapshots:smokeSummary.snapshots}:null,publicResultSHA256:sha(fs.readFileSync(path.join(out,'PUBLIC-RESULT.json'))),retainedEvidence:'<EVIDENCE>'}));