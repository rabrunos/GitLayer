import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit, walk } from '../../../scripts/git-compat/lib.mjs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { validateImplementationClosure, validateScenarioPreservation, normalizeImplementationPatch } from '../../../scripts/implementation-evidence-closure.mjs';
import { parseImplementationPackageArgs } from '../../../scripts/package-implementation-evidence.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const files=new Map(),put=(name,value)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');files.set(name,bytes);return {path:name,sha256:digest(bytes)};};
 const source=[{path:'src/core/synthetic.ts',size:17,sha256:digest('synthetic product')}];
 const previous=[{...source[0],size:21,sha256:digest('old synthetic product')}];
 const test=(name,manifest,sourceCoverage,command,code=0)=>{for(const file of manifest)files.set(name+'/source/'+file.path,Buffer.from(file.sha256===source[0].sha256?'synthetic product':'old synthetic product'));const manifestRef=put(name+'/SOURCE-MANIFEST.json',manifest),fingerprint=digest(JSON.stringify(manifest)),artifact=put(name+'/result.json',{code,command,before:fingerprint,after:fingerprint,sourceUnchanged:true});return {command,exitCode:code,sourceCoverage,artifact,sourceManifest:manifestRef};};
 const tests=[test('full',previous,'previous-full-suite','npm.cmd test'),test('focused',source,'current-focused','node --test synthetic'),test('typecheck',source,'current-typecheck','npm.cmd run typecheck')];
 const proof=put('synthetic-proof.json',{purpose:'Synthetic closure validator input only; no product or Git executed.'});
 const requirements={schema:1,requirements:Array.from({length:27},(_,i)=>({id:'GL-'+String(i+1).padStart(2,'0'),status:i?'IMPLEMENTED':'PARTIAL',evidence:[proof],limitations:i?[]:['Known synthetic limitation']}))};
 const args={requirements,finalEvidence:{schema:1,status:'closed',sourceManifest:source,tests},currentSources:source,readReference:name=>{assert.ok(files.has(name),'missing synthetic reference');return files.get(name);},requirementsSha256:digest(JSON.stringify(requirements)),reportSha256:digest('Synthetic report')};
 return {args,files,put,test,source};
}
test('implementation closure preserves partial status and reports previous full-suite delta without certifying current full coverage',()=>{
 const {args}=fixture(),before=structuredClone({requirements:args.requirements,final:args.finalEvidence}),result=validateImplementationClosure(args);
 assert.equal(result.currentFullSuite,false);assert.equal(result.currentFocusedAllExitZero,true);assert.equal(result.requirements[0].status,'PARTIAL');assert.equal(result.tests[0].changesAfterThisSnapshot[0].path,'src/core/synthetic.ts');assert.match(result.scope,/not an assertion/u);assert.deepEqual({requirements:args.requirements,final:args.finalEvidence},before);
});
test('implementation closure refuses missing, duplicate, pending or unhashed requirements and unclosed final state',()=>{
 for(const change of [a=>a.requirements.requirements.pop(),a=>a.requirements.requirements[1].id='GL-01',a=>a.requirements.requirements[0].status='AWAITING',a=>a.requirements.requirements[0].evidence[0].sha256=undefined,a=>a.finalEvidence.status='awaiting']){const {args}=fixture();change(args);assert.throws(()=>validateImplementationClosure(args));}
});
test('implementation closure refuses altered evidence, path traversal, stale current sources and missing terminal executions',()=>{
 for(const change of [a=>a.finalEvidence.tests[0].artifact.sha256='0'.repeat(64),a=>a.finalEvidence.tests[0].artifact.path='../outside.json',a=>a.currentSources[0].sha256='0'.repeat(64),a=>a.finalEvidence.tests.pop(),a=>a.finalEvidence.tests[1].exitCode=1,a=>a.finalEvidence.tests[1].sourceCoverage='current-full']){const {args}=fixture();change(args);assert.throws(()=>validateImplementationClosure(args));}
});
test('implementation closure requires stable result fingerprint and current-snapshot focused plus typecheck inputs',()=>{
 for(const kind of ['unstable','wrong-before','stale']){const f=fixture(),entry=f.args.finalEvidence.tests[1];if(kind==='stale'){entry.sourceManifest=f.args.finalEvidence.tests[0].sourceManifest;entry.artifact=f.args.finalEvidence.tests[0].artifact;entry.command='npm.cmd test';}else{const body=JSON.parse(f.files.get(entry.artifact.path));body[kind==='unstable'?'sourceUnchanged':'before']=kind==='unstable'?false:'0'.repeat(64);entry.artifact=f.put(entry.artifact.path,body);}assert.throws(()=>validateImplementationClosure(f.args));}
});
test('implementation closure refuses source manifest references without matching archived source bytes',()=>{const f=fixture();f.files.set('focused/source/src/core/synthetic.ts',Buffer.from('changed'));assert.throws(()=>validateImplementationClosure(f.args),/hash differs/u);});
test('implementation closure accepts honestly declared failed final checks without converting them into product PASS',()=>{
 const f=fixture();f.args.finalEvidence.tests[1]=f.test('failed',f.source,'current-focused','node --test synthetic failed',1);const result=validateImplementationClosure(f.args);assert.equal(result.currentFocusedAllExitZero,false);assert.equal(result.tests[1].exitCode,1);
});
test('implementation package argument parsing imports without launching Git, PowerShell, product, build or package',()=>{
 assert.deepEqual(parseImplementationPackageArgs(['--help']),{help:true});for(const argv of [[],['--out'],['--out','one','--out','two'],['--unknown','value']])assert.throws(()=>parseImplementationPackageArgs(argv));
 const source=fs.readFileSync(new URL('../../../scripts/package-implementation-evidence.mjs',import.meta.url),'utf8');assert.match(source,/shell:false,windowsHide:true,encoding:'utf8',timeout:600000/u);assert.match(source,/content\/REPORT\.md/u);assert.doesNotMatch(source,/fs\.copyFileSync\(path\.join\(stage,'REPORT.md'\),path\.join\(options.out,'REPORT.md'\)/u);
});
test('new package and closure scripts contain no unresolved identifiers in semantic JavaScript analysis',()=>{
 const root=path.resolve(new URL('../../../',import.meta.url).pathname.replace(/^\/([a-z]:\/)/iu,'$1')),files=['scripts/package-implementation-evidence.mjs','scripts/implementation-evidence-closure.mjs'].map(name=>path.join(root,name));
 const program=ts.createProgram(files,{allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,skipLibCheck:true,types:['node']});
 const diagnostics=ts.getPreEmitDiagnostics(program).filter(item=>item.code===2304&&files.some(file=>path.resolve(item.file?.fileName??'')===file));assert.deepEqual(diagnostics.map(item=>({message:ts.flattenDiagnosticMessageText(item.messageText,' '),line:item.file.getLineAndCharacterOfPosition(item.start).line+1})),[]);
});

test('scenario preservation compares immutable original bytes and derives extensible matrix counts from unique rows',()=>{
 const originalBytes=Buffer.from(JSON.stringify({scenario_count:2,scenarios:[{id:'A',scope:'NATIVE'},{id:'B',scope:'HARNESS'}]})),workingBytes=Buffer.from(JSON.stringify({scenario_count:3,scenarios:[{id:'A',scope:'NATIVE'},{id:'B',scope:'HARNESS'},{id:'C',scope:'NATIVE'}]}));
 const args={originalBytes,baselineOriginalBytes:Buffer.from(originalBytes),workingBytes,expectedOriginalCount:2};
 const result=validateScenarioPreservation(args);assert.equal(result.original.count,2);assert.equal(result.working.count,3);assert.deepEqual(result.working.addedIds,['C']);assert.deepEqual(result.working.byScope,{NATIVE:2,HARNESS:1});assert.match(result.scope,/no assertion/u);
 for(const change of [a=>a.originalBytes=Buffer.concat([originalBytes,Buffer.from(' ')]),a=>a.expectedOriginalCount=344,a=>a.workingBytes=Buffer.from(JSON.stringify([{id:'A'}])),a=>a.workingBytes=Buffer.from(JSON.stringify([{id:'A'},{id:'B'},{id:'B'}])),a=>a.workingBytes=Buffer.from(JSON.stringify({scenario_count:9,scenarios:[{id:'A'},{id:'B'}]}))]){const input={...args};change(input);assert.throws(()=>validateScenarioPreservation(input));}
});

test('previous-focused execution retains its own source delta and failure without becoming a current result',()=>{
 const f=fixture(),previous=[{...f.source[0],size:21,sha256:digest('old synthetic product')}];f.args.finalEvidence.tests.splice(1,0,f.test('previous-focus',previous,'previous-focused','node --test previous synthetic focused',1));
 const result=validateImplementationClosure(f.args),earlier=result.tests.find(item=>item.sourceCoverage==='previous-focused');assert.equal(earlier.exitCode,1);assert.equal(earlier.matchesFinal,false);assert.equal(earlier.changesAfterThisSnapshot.length,1);assert.equal(result.currentFocusedAllExitZero,true);assert.equal(result.currentFullSuite,false);
 const missingCurrent=fixture();missingCurrent.args.finalEvidence.tests[1].sourceCoverage='previous-focused';assert.throws(()=>validateImplementationClosure(missingCurrent.args),/Missing current-snapshot focused/u);
});

test('patch normalization rewrites metadata only and preserves identical prefixes in hunk and binary payload',()=>{
 const hunk='-old a/baseline/before/literal b/source/literal\n+new a/source/literal b/baseline/before/literal\n',binary='literal 3\nKcmZQzU|?Vb0000\n';
 const input='diff --git a/baseline/before/file b/source/file\n--- a/baseline/before/file\n+++ b/source/file\n@@ -1 +1 @@\n'+hunk+'diff --git a/baseline/before/binary b/source/binary\nindex 1..2 100644\nGIT binary patch\n'+binary;
 const output=normalizeImplementationPatch(input);assert.match(output,/^diff --git a\/file b\/file\n--- a\/file\n\+\+\+ b\/file\n/u);assert.ok(output.includes(hunk));assert.ok(output.endsWith(binary));assert.throws(()=>normalizeImplementationPatch('diff --git a/baseline/before/a b/source/other\n'));
});
test('official Git reconstructs exact text, Unicode, spaced paths, internal prefixes, added/deleted and binary files from normalized patch',()=>{
 const fixture=createFixture(os.tmpdir(),'gitlayer-package-patch'),git=resolveGit(),env=isolatedEnvironment(fixture.root,git),commands=[];
 const native=(argv,{cwd=fixture.root,input,ok=[0]}={})=>{const result=spawnSync(git,['--no-pager','-c','core.autocrlf=false','-c','core.quotePath=false',...argv],{cwd,env,input,encoding:'utf8',shell:false,windowsHide:true,timeout:30000,maxBuffer:8*1024*1024});commands.push({executable:git,argv,cwd:path.relative(fixture.root,cwd).replaceAll('\\','/')||'.',exit:result.status});assert.ok(ok.includes(result.status),result.stderr||result.error?.message);return result.stdout;};
 try{
  const before=path.join(fixture.root,'baseline/before'),source=path.join(fixture.root,'source'),applied=path.join(fixture.root,'applied');for(const folder of [before,source,applied])fs.mkdirSync(folder,{recursive:true});
  const put=(root,name,bytes)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
  const names=['literal.txt','file with space.txt','a\u00e7\u00e3o.txt','dir b/source/tail.txt','binary.dat','removed.txt'];
  for(const name of names)put(before,name,name==='binary.dat'?Buffer.from([0,1,2,255,0,17]):'before a/baseline/before/literal b/source/literal '+name+'\n');
  fs.cpSync(before,source,{recursive:true});fs.cpSync(before,applied,{recursive:true});
  for(const name of names.filter(name=>name!=='removed.txt'))put(source,name,name==='binary.dat'?Buffer.from([0,7,8,255,0,19,27]):'after a/source/literal b/baseline/before/literal '+name+'\n');
  fs.unlinkSync(path.join(source,'removed.txt'));put(source,'new directory/added.txt','added a/source/literal\n');
  const raw=native(['diff','--no-index','--binary','--no-renames','--no-ext-diff','--no-textconv','--','baseline/before','source'],{ok:[0,1]}),normalized=normalizeImplementationPatch(raw);
  native(['-c','init.templateDir=','init','--initial-branch=main'],{cwd:applied});native(['add','.'],{cwd:applied});native(['commit','-m','Synthetic patch baseline'],{cwd:applied});native(['apply','--check','--index','-'],{cwd:applied,input:normalized});native(['apply','--index','--binary','-'],{cwd:applied,input:normalized});
  const manifest=root=>walk(root).filter(file=>!path.relative(root,file).split(path.sep).includes('.git')).map(file=>({path:path.relative(root,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:digest(fs.readFileSync(file))})).sort((a,b)=>a.path.localeCompare(b.path));
  const expected=manifest(source),observed=manifest(applied);assert.deepEqual(observed,expected);assert.equal(fs.existsSync(path.join(applied,'removed.txt')),false);assert.ok(normalized.includes('+after a/source/literal b/baseline/before/literal'));
  const proof={scope:'Official Git diff/apply reconstruction in an exclusively owned nonce fixture; no project Git mutation or product execution.',fixtureNonce:fixture.nonce,gitVersion:native(['--version']).trim(),commands,rawPatchSha256:digest(raw),normalizedPatchSha256:digest(normalized),expected,observed,exactReconstruction:true};
  if(process.env.GL_IMPLEMENTATION_PACKAGE_INFRA_EVIDENCE){const out=path.resolve(process.env.GL_IMPLEMENTATION_PACKAGE_INFRA_EVIDENCE);assert.ok(fs.statSync(out).isDirectory());fs.writeFileSync(path.join(out,'patch-reconstruction.json'),JSON.stringify(proof,null,2));fs.writeFileSync(path.join(out,'patch-raw.diff'),raw);fs.writeFileSync(path.join(out,'patch-normalized.diff'),normalized);}
 }finally{cleanupFixture(fixture);}
});
