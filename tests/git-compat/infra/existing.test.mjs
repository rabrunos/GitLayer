import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { context,createFixture,cleanupFixture,isolatedEnvironment,project,fileHash,sha256 } from '../../../scripts/git-compat/lib.mjs';
import { fileManifest } from '../../../scripts/git-compat/audit.mjs';
import { validateOutputRoot,protectedOutputDirectories } from '../../../scripts/git-compat/output-root.mjs';
import { validateFixtureParent, externalFixtureParent } from '../../../scripts/git-compat/fixture-parent.mjs';
import { existingSummaryLines,parseExistingArgs,persistExistingStreams } from '../../../scripts/git-compat/existing.mjs';

const evidenceParent=process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT?validateOutputRoot(process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT,{projectRoot:project}):null;
if(evidenceParent)fs.mkdirSync(evidenceParent,{recursive:true});
const evidenceRoot=evidenceParent?path.join(fs.realpathSync(evidenceParent),'existing-contracts-'+randomUUID()):null;
if(evidenceRoot)fs.mkdirSync(evidenceRoot);
function record(label,data,execution) {
  if(!evidenceRoot)return;
  if(execution)for(const channel of ['stdout','stderr'])fs.writeFileSync(path.join(evidenceRoot,label+'.'+channel),execution[channel+'Buffer']);
  fs.writeFileSync(path.join(evidenceRoot,label+'.json'),JSON.stringify(data,null,2)+'\n');
}
function owned(t,label) {
  const f=createFixture(externalFixtureParent(project),label);t.after(()=>cleanupFixture(f));
  return context({root:f.root,repo:path.join(f.root,'repo'),artifactDir:path.join(f.root,'evidence'),packageRoot:f.root,gitPath:process.execPath,env:isolatedEnvironment(f.root,process.execPath)});
}

test('output-root validation blocks every protected tree before creating directories',t=>{
  const c=owned(t,'output-policy'),projectRoot=path.join(c.root,'synthetic-checkout'),nonce='must-not-exist-'+randomUUID(),refused=[];fs.mkdirSync(projectRoot);
  for(const directory of protectedOutputDirectories) {
    const output=path.join(projectRoot,directory,nonce);assert.throws(()=>validateOutputRoot(output,{projectRoot}),{code:'OUTPUT_ROOT_INVALID'});assert.equal(fs.existsSync(output),false);
    assert.throws(()=>validateOutputRoot(path.join(project,directory,nonce),{projectRoot:project}),{code:'OUTPUT_ROOT_INVALID'});
    refused.push({directory,output_created:fs.existsSync(output)});
  }
  const allowed=path.join(projectRoot,'artifacts','new-evidence');assert.equal(validateOutputRoot(allowed,{projectRoot}),allowed);assert.equal(fs.existsSync(allowed),false);
  assert.equal(validateOutputRoot(path.join(projectRoot,'src-sibling',nonce),{projectRoot}),path.join(projectRoot,'src-sibling',nonce));
  record('output-policy',{expected:{protected:protectedOutputDirectories,created:false},observed:{protected:refused.map(item=>item.directory),created:refused.some(item=>item.output_created)||fs.existsSync(allowed)},kind:'SYNTHETIC_READ_ONLY_PATH_CONTROL'});
});

test('output-root validation rejects linked and non-directory ancestors',t=>{
  const c=owned(t,'output-links'),projectRoot=path.join(c.root,'synthetic-checkout'),target=path.join(c.root,'target'),link=path.join(c.root,'link');fs.mkdirSync(projectRoot);fs.mkdirSync(target);
  fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
  try{assert.throws(()=>validateOutputRoot(path.join(link,'new-output'),{projectRoot}),{code:'OUTPUT_ROOT_INVALID'});assert.deepEqual(fs.readdirSync(target),[]);}finally{fs.unlinkSync(link);}
  const file=path.join(c.root,'regular-file');fs.writeFileSync(file,'keep');assert.throws(()=>validateOutputRoot(path.join(file,'new-output'),{projectRoot}),{code:'OUTPUT_ROOT_INVALID'});assert.equal(fs.readFileSync(file,'utf8'),'keep');
});

test('the real existing CLI rejects invalid suites and protected output before setup or test execution',async t=>{
  const c=owned(t,'existing-refusals'),sourceBefore=fileManifest(project,['src']),copy=path.join(c.root,'synthetic-checkout'),scripts=path.join(copy,'scripts/git-compat');fs.mkdirSync(scripts,{recursive:true});
  // Exact infrastructure bytes in an owned synthetic checkout: a regression
  // can never write into the real product, run its domain tests or probe Git.
  for(const name of ['existing.mjs','lib.mjs','output-root.mjs','fixture-parent.mjs'])fs.copyFileSync(path.join(project,'scripts/git-compat',name),path.join(scripts,name));
  const copied=path.join(scripts,'existing.mjs'),temporaryBefore=fs.readdirSync(c.env.TEMP),vectors=[
    {args:['--suite','invalid','--out',path.join(c.root,'invalid-suite-output')],out:path.join(c.root,'invalid-suite-output'),code:'EXISTING_SELECTION_INVALID'},
    ...protectedOutputDirectories.map(directory=>({args:['--suite','unit','--out',path.join(copy,directory,'must-not-exist')],out:path.join(copy,directory,'must-not-exist'),code:'OUTPUT_ROOT_INVALID'})),
  ];
  for(const [index,vector] of vectors.entries()) {
    const execution=await c.run(process.execPath,[copied,...vector.args],{ok:[2],env:{PATH:path.dirname(process.execPath)},timeout:10000}),error=JSON.parse(execution.stderr);
    record('existing-refusal-'+index,{kind:'REAL_NODE_EXISTING_CLI_ON_EXACT_INFRASTRUCTURE_COPY',executable:process.execPath,args:[copied,...vector.args].map(value=>value.replaceAll(c.root,'<FIXTURE>')),expected:{exit:2,timed_out:false,outcome:vector.code,stdout:'',output_created:false},observed:{exit:execution.code,timed_out:execution.timedOut,outcome:error.outcome,stdout:execution.stdout,output_created:fs.existsSync(vector.out)}},execution);
    assert.equal(execution.code,2);assert.equal(execution.timedOut,false);assert.equal(error.outcome,vector.code);assert.equal(error.no_test_success,true);assert.equal(execution.stdout,'');assert.equal(fs.existsSync(vector.out),false);
  }
  assert.deepEqual(fs.readdirSync(c.env.TEMP),temporaryBefore,'no environment/Git fixture was created before refusal');
  assert.deepEqual(fileManifest(project,['src']),sourceBefore,'the real product remains byte-identical');
});

test('existing refuses repository TEMP parents and accepts a read-only explicit owned external override',async t=>{
  const c=owned(t,'existing-fixture-parent'),nativeParent=validateFixtureParent(process.env.GIT_COMPAT_EXTERNAL_FIXTURE_PARENT??os.tmpdir(),{projectRoot:project}),external=createFixture(nativeParent,'gl-infra-external');t.after(()=>cleanupFixture(external));
  const copy=path.join(c.root,'synthetic-checkout'),scripts=path.join(copy,'scripts/git-compat');fs.mkdirSync(scripts,{recursive:true});
  for(const name of ['existing.mjs','lib.mjs','output-root.mjs','fixture-parent.mjs'])fs.copyFileSync(path.join(project,'scripts/git-compat',name),path.join(scripts,name));
  const copied=path.join(scripts,'existing.mjs'),repo=path.join(c.root,'synthetic-other-repo'),gitfileRepo=path.join(c.root,'synthetic-worktree');
  fs.mkdirSync(path.join(repo,'.git'),{recursive:true});fs.mkdirSync(gitfileRepo);fs.writeFileSync(path.join(gitfileRepo,'.git'),'gitdir: never-follow-this-synthetic-path\n');
  const repositoryTemp=path.join(repo,'nested','temp'),gitfileTemp=path.join(gitfileRepo,'temp');fs.mkdirSync(repositoryTemp,{recursive:true});fs.mkdirSync(gitfileTemp);
  assert.throws(()=>validateFixtureParent(project,{projectRoot:project}),{code:'EXISTING_FIXTURE_PARENT_INVALID'});
  const missing=path.join(c.root,'missing-parent'),link=path.join(c.root,'linked-external');fs.symlinkSync(external.root,link,process.platform==='win32'?'junction':'dir');
  try {
    const vectors=[
      {label:'repository-temp',parent:repositoryTemp,defaultTemp:true},
      {label:'gitfile-ancestor',parent:gitfileTemp},
      {label:'missing-parent',parent:missing},
      {label:'linked-parent',parent:link},
    ];
    for(const vector of vectors) {
      const out=path.join(c.root,'refused-'+vector.label),args=[copied,'--suite','unit','--out',out,...(vector.defaultTemp?[]:['--fixture-parent',vector.parent])];
      const execution=await c.run(process.execPath,args,{ok:[2],env:{PATH:path.dirname(process.execPath),TEMP:vector.defaultTemp?vector.parent:external.root,TMP:vector.defaultTemp?vector.parent:external.root,TMPDIR:vector.defaultTemp?vector.parent:external.root},timeout:10000}),error=JSON.parse(execution.stderr);
      record('fixture-parent-'+vector.label,{kind:'REAL_NODE_EXISTING_CLI_REFUSAL',args:args.map(value=>value.replaceAll(c.root,'<FIXTURE>')),expected:{exit:2,outcome:'EXISTING_FIXTURE_PARENT_INVALID',stdout:'',output_created:false},observed:{exit:execution.code,outcome:error.outcome,stdout:execution.stdout,output_created:fs.existsSync(out)}},execution);
      assert.equal(execution.code,2);assert.equal(error.outcome,'EXISTING_FIXTURE_PARENT_INVALID');assert.equal(error.no_test_success,true);assert.equal(execution.stdout,'');assert.equal(fs.existsSync(out),false);
    }
  }finally{fs.unlinkSync(link);}
  assert.equal(fs.existsSync(missing),false);assert.deepEqual(fs.readdirSync(repositoryTemp),[]);assert.deepEqual(fs.readdirSync(gitfileTemp),[]);
  const externalBefore=fs.readdirSync(external.root),out=path.join(c.root,'parse-only-output'),args=['--suite','unit','--out',out,'--fixture-parent',external.root];
  const parsed=parseExistingArgs(args);assert.equal(parsed.fixtureParent,fs.realpathSync(external.root));assert.equal(parsed.suite,'unit');
  const parseOnly='const {parseExistingArgs}=await import(process.argv[1]);const args=JSON.parse(process.argv[2]);const parsed=parseExistingArgs(args);process.stdout.write(JSON.stringify({suite:parsed.suite,override_accepted:parsed.fixtureParent===args.at(-1)}));';
  const execution=await c.run(process.execPath,['--input-type=module','-e',parseOnly,pathToFileURL(copied).href,JSON.stringify(args)],{env:{TEMP:repositoryTemp,TMP:repositoryTemp,TMPDIR:repositoryTemp},timeout:10000}),observed=JSON.parse(execution.stdout);
  assert.deepEqual(observed,{suite:'unit',override_accepted:true});assert.equal(fs.existsSync(out),false);assert.deepEqual(fs.readdirSync(external.root),externalBefore);
  record('fixture-parent-external-override',{kind:'REAL_NODE_PARSE_ONLY_NO_DOMAIN_TESTS',expected:{exit:0,suite:'unit',override_accepted:true,output_created:false,external_unchanged:true},observed:{exit:execution.code,...observed,output_created:fs.existsSync(out),external_unchanged:JSON.stringify(fs.readdirSync(external.root))===JSON.stringify(externalBefore)}},execution);
});

test('existing evidence preserves real binary child streams and Unicode or TAP summaries',async t=>{
  const c=owned(t,'existing-binary'),execution=await c.run(process.execPath,['-e','process.stdout.write(Buffer.from([0,255,128,10]));process.stdout.write("ℹ tests 2\\n# pass 2\\nℹ tests_typo 9\\n");process.stderr.write(Buffer.from([254,0,129,10]));']);
  const out=path.join(c.root,'retained-streams');fs.mkdirSync(out);persistExistingStreams(out,'synthetic-child',execution);
  assert.deepEqual(fs.readFileSync(path.join(out,'synthetic-child.stdout')),execution.stdoutBuffer);assert.deepEqual(fs.readFileSync(path.join(out,'synthetic-child.stderr')),execution.stderrBuffer);
  assert.notDeepEqual(Buffer.from(execution.stdout,'utf8'),execution.stdoutBuffer);assert.deepEqual(existingSummaryLines(execution.stdout),['ℹ tests 2','# pass 2']);
  const before=fileHash(path.join(out,'synthetic-child.stdout'));let overwriteError;
  try{persistExistingStreams(out,'synthetic-child',execution);}catch(error){overwriteError=error;}
  assert.equal(overwriteError?.code,'EEXIST');assert.equal(fileHash(path.join(out,'synthetic-child.stdout')),before);
  record('existing-binary-streams',{kind:'REAL_NODE_BINARY_STREAM_PERSISTENCE',expected:{stdout_sha256:sha256(execution.stdoutBuffer),stderr_hex:execution.stderrBuffer.toString('hex'),summaries:['ℹ tests 2','# pass 2'],overwrite_refused:true},observed:{stdout_sha256:before,stderr_hex:fs.readFileSync(path.join(out,'synthetic-child.stderr')).toString('hex'),summaries:existingSummaryLines(execution.stdout),overwrite_refused:overwriteError?.code==='EEXIST'&&fileHash(path.join(out,'synthetic-child.stdout'))===before}},execution);
});
