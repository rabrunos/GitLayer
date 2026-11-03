import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { context, execute, createFixture, cleanupFixture, safeEvidence, validateResult, json, fileHash, sha256, fingerprint, project, isolatedEnvironment, applyOutcome } from '../../../scripts/git-compat/lib.mjs';
import { classifyKnown, loadMatrix, selectCases, baseResult, counts, validateBundle } from '../../../scripts/git-compat/runner.mjs';

const make=(id,title,run,extra={})=>({id,variant:'negative-controls',title,profile:'N0',tier:'smoke',phase:'HARNESS',productStatus:'NOT_ASSESSED',capabilities:[],run,...extra});
function rejects(fn){try{fn();return false;}catch{return true;}}
const runInfo={id:'synthetic',seed:'123',sourceFingerprint:'synthetic-source',runnerFingerprint:'synthetic-runner'};
function synthetic(c){
  const r=baseResult(loadMatrix()[0],{variant:'synthetic',phase:'HARNESS',productStatus:'NOT_ASSESSED'},runInfo);
  const p=path.join(c.artifactDir,'synthetic.txt');fs.writeFileSync(p,'synthetic\n');
  Object.assign(r,{selection_status:'SELECTED',execution_status:'PASS',nonexecution_reason:null,started_at:new Date().toISOString(),ended_at:new Date().toISOString(),duration_ms:0,assertions:[{id:'synthetic',expected:1,observed:1,passed:true,evidence_paths:[]}],evidence:[{path:path.relative(c.packageRoot,p).replaceAll('\\','/'),sha256:fileHash(p),bytes:fs.statSync(p).size}]});
  const environment=path.join(c.artifactDir,'synthetic-environment.json');json(environment,{synthetic:true});r.environment_path=path.relative(c.packageRoot,environment).replaceAll('\\','/');
  return r;
}
export function sequence(seed,length=24){
  let state=parseInt(sha256(String(seed)).slice(0,8),16)>>>0;
  return Array.from({length},()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)%5;});
}
export function shrink(items,fails){let result=[...items];for(let i=0;i<result.length;){const candidate=result.filter((_,j)=>i!==j);if(fails(candidate))result=candidate;else i++;}return result;}
export function extendMatrixReference(matrix) {
  const originalIds=matrix.map(s=>s.id),used=new Set(originalIds);let suffix=999;
  while(used.has(`ENV-${suffix}`))suffix++;
  const scenario={...matrix[0],id:`ENV-${suffix}`,title:'Synthetic legitimate matrix extension'};
  return {originalIds,scenario,extended:[...matrix,scenario]};
}
export async function proveExecutionFingerprint(c) {
  await c.init();
  const tracked='src/tracked-module.ts',untracked='src/experimental-module.ts',sourceRoot=path.join(c.repo,'src');
  c.write(tracked,'export const revision = 1;\n');await c.git(['add','--',tracked]);await c.git(['commit','-m','Synthetic tracked source']);
  c.write(untracked,'export const experimental = "first";\n');
  const untrackedNames=(await c.git(['ls-files','--others','--exclude-standard','-z'])).stdout.split('\0').filter(Boolean);
  c.eq('synthetic source really is untracked',untrackedNames,[untracked]);
  const original=fingerprint([sourceRoot]);
  c.write(untracked,'export const experimental = "authorized before next run";\n');
  const untrackedEdit=fingerprint([sourceRoot]);c.ok('untracked source changes the fingerprint',untrackedEdit!==original);
  c.write(tracked,'export const revision = 2;\n');
  const executionBaseline=fingerprint([sourceRoot]);c.ok('authorized product edit creates a new baseline',executionBaseline!==untrackedEdit);
  c.eq('new execution accepts current source instead of a historical baseline',fingerprint([sourceRoot]),executionBaseline);
  const acceptedBytes=c.read(untracked);c.write(untracked,'unexpected mutation during execution\n');
  const unexpected=fingerprint([sourceRoot]);c.ok('a mutation during this execution is detected',unexpected!==executionBaseline);
  c.write(untracked,acceptedBytes);c.eq('fixture source restored to this execution baseline',fingerprint([sourceRoot]),executionBaseline);
  const proof={kind:'SYNTHETIC_SOURCE_PRESERVATION_CONTROL',tracked,untracked,untrackedNames,original,untrackedEdit,executionBaseline,unexpected,executionEnd:fingerprint([sourceRoot]),policy:'Each authorized execution captures its current source, including untracked files. Historical preparation evidence is never a permanent product freeze.'};
  json(path.join(c.artifactDir,'source-proof.json'),proof);return proof;
}
export const cases=[
  make('HARNESS-001','False assertion, invalid setup, streams, nonzero exit and hung child are detected',async c=>{
    const inner=context({...c,artifactDir:path.join(c.artifactDir,'controlled-failure')});
    c.ok('false semantic assertion rejected',rejects(()=>inner.eq('sentinel bytes','B','A')));
    c.eq('failed assertion retained',inner.assertions[0].passed,false);
    const nonzero=await c.run(process.execPath,['-e',"process.stdout.write('out');process.stderr.write('err');process.exit(7)"],{ok:[7]});
    c.eq('nonzero actual code',nonzero.code,7);c.eq('stdout captured',nonzero.stdout,'out');c.eq('stderr captured',nonzero.stderr,'err');
    let timeout=false;try{await c.run(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:250});}catch(e){timeout=e.result?.timedOut;}
    c.eq('hung child timed out',timeout,true);
    let badSetup=false;try{await c.run(process.execPath,['-e',"require('fs').readFileSync('missing-synthetic')"]);}catch(e){badSetup=e.result?.code!==0;}
    c.eq('invalid setup fails',badSetup,true);
  }),
  ...['HARNESS-002','HARNESS-017'].map(id=>make(id,'Strict issue signatures and visible XPASS',async c=>{
    const r=synthetic(c);Object.assign(r,{execution_status:'FAIL',failure_category:'ASSERTION',assertions:[{id:'bytes',expected:'A',observed:'B',passed:false,evidence_paths:[]}]});
    const issue={id:'SYNTHETIC-ISSUE',signature:sha256(JSON.stringify([{id:'bytes',expected:'A',observed:'B'}]))};
    c.eq('matching signature only',classifyKnown(r,issue).known_failure,'XFAIL_STRICT');
    c.eq('different failure not absorbed',classifyKnown({...r,assertions:[{...r.assertions[0],observed:'C'}]},issue).known_failure,'NONE');
    c.eq('setup error not absorbed',classifyKnown({...r,failure_category:'INFRASTRUCTURE'},issue).known_failure,'NONE');
    c.eq('unexpected pass visible',classifyKnown({...r,execution_status:'PASS'},issue).known_failure,'XPASS_NEEDS_REVIEW');
  })),
  make('HARNESS-003','Absent feature differs from absent capability',async c=>{
    const r=synthetic(c);r.execution_status='ENV_BLOCKED';r.nonexecution_reason='Synthetic optional tool probe absent';r.product_status='NOT_ASSESSED';
    c.eq('blocked structure valid',validateResult(r,c.packageRoot),true);
    const gap={...synthetic(c),product_status:'PRODUCT_GAP'};c.eq('feature gap can accompany native PASS',validateResult(gap,c.packageRoot),true);
    c.ok('unsupported enum rejected',rejects(()=>validateResult({...r,execution_status:'SKIP'},c.packageRoot)));
  }),
  make('HARNESS-004','Parallel children have distinct HOME and Git config',async c=>{
    const a=createFixture(c.root,'isolation-a'),b=createFixture(c.root,'isolation-b');
    try{
      const envs=[isolatedEnvironment(a.root,c.gitPath),isolatedEnvironment(b.root,c.gitPath)];
      const results=await Promise.all(envs.map(env=>execute(process.execPath,['-e','process.stdout.write(JSON.stringify({home:process.env.HOME,config:process.env.GIT_CONFIG_GLOBAL,secret:process.env.SYNTHETIC_HOST_SECRET??null}))'],{cwd:c.repo,env})));
      const parsed=results.map(r=>JSON.parse(r.stdout));json(path.join(c.artifactDir,'parallel-env.json'),parsed.map(p=>({...p,home:path.basename(p.home),config:path.basename(p.config)})));
      c.ok('HOME distinct',parsed[0].home!==parsed[1].home);c.eq('host secret absent',parsed.map(p=>p.secret),[null,null]);
    }finally{cleanupFixture(a);cleanupFixture(b);}
  }),
  make('HARNESS-005','Native Git observes public CLI artifacts',async c=>{
    await c.init();await c.layer();const oid=(await c.git(['rev-parse','layer/tools'])).stdout.trim();
    c.eq('CLI created commit object',(await c.git(['cat-file','-t',oid])).stdout.trim(),'commit');
    c.eq('Layer blob independently read',(await c.git(['show','layer/tools:layer.txt'])).stdout,'layer one\n');
    c.eq('main has no Layer blob',(await c.git(['ls-tree','--name-only','main'])).stdout,'base.txt\n');
  }),
  make('HARNESS-006','Equivalent ignore baseline explains add dot',async c=>{
    await c.init();c.write('layer.txt','synthetic\n');c.write('.git/info/exclude','/layer.txt\n');c.write('normal.txt','normal\n');
    await c.git(['add','.']);const staged=(await c.git(['diff','--cached','--name-only'])).stdout;
    c.ok('normal staged',staged.includes('normal.txt'));c.ok('ignored absent',!staged.includes('layer.txt'));
    c.eq('ignore provenance',(await c.git(['check-ignore','-v','layer.txt'])).stdout.includes('.git/info/exclude'),true);
  }),
  make('HARNESS-007','Seed reproducibility and minimal counterexample reduction',async c=>{
    const seed=c.seed??'20261018';const generated=sequence(seed);
    c.eq('same seed deterministic',sequence(seed),generated);c.ok('different seed differs',JSON.stringify(sequence(seed+'x'))!==JSON.stringify(generated));
    const counterexample=[0,2,4,1,3];const fails=s=>s.includes(2)&&s.includes(4);const reduced=shrink(counterexample,fails);
    c.eq('reduced semantic failure',reduced,[2,4]);json(path.join(c.artifactDir,'seed-and-shrink.json'),{seed,generated,counterexample,reduced,predicate:'contains 2 and 4',kind:'HARNESS_SYNTHETIC_NOT_PRODUCT'});
    return {limits:['Synthetic reducer validates infrastructure; it does not itself prove a product state machine.']};
  }),
  make('HARNESS-008','Semantic index snapshot tolerates stat refresh',async c=>{
    await c.init();const before=(await c.git(['ls-files','--stage','-z'])).stdout;await c.git(['update-index','--refresh']);const after=(await c.git(['ls-files','--stage','-z'])).stdout;
    c.eq('OID mode stage path unchanged',after,before);
  }),
  make('HARNESS-013','Cleanup requires marker, nonce and ancestry',async c=>{
    const fixture=createFixture(c.root,'owned');const sentinel=path.join(c.root,'sentinel');fs.writeFileSync(sentinel,'keep');
    c.ok('wrong nonce refused',rejects(()=>cleanupFixture({...fixture,nonce:'wrong'})));
    c.ok('wrong parent refused',rejects(()=>cleanupFixture({...fixture,parent:path.join(c.root,'elsewhere')})));
    c.eq('sentinel untouched',fs.readFileSync(sentinel,'utf8'),'keep');cleanupFixture(fixture);c.eq('owned cleanup complete',fs.existsSync(fixture.root),false);
  }),
  make('HARNESS-014','New catalogue entry cannot disappear in old results',async c=>{
    const matrix=loadMatrix(),results=matrix.map(s=>baseResult(s,null,runInfo));c.eq('complete initial set',validateBundle(c.packageRoot,results,matrix),true);
    const {extended,scenario,originalIds}=extendMatrixReference(matrix);c.ok('new ID requires result',rejects(()=>validateBundle(c.packageRoot,results,extended)));
    const extendedResults=[...results,baseResult(scenario,null,runInfo)];
    c.eq('legitimate extension with its result is accepted',validateBundle(c.packageRoot,extendedResults,extended),true);
    c.eq('extension preserves every original ID',extended.slice(0,matrix.length).map(s=>s.id),originalIds);
    c.eq('extension count follows current matrix',counts(extendedResults).scenario_ids,matrix.length+1);
    c.ok('removing an original ID remains an error',rejects(()=>validateBundle(c.packageRoot,extendedResults.filter(r=>r.scenario_id!==originalIds[0]),extended)));
    json(path.join(c.artifactDir,'matrix-extension-proof.json'),{originalIds,addedId:scenario.id,before:matrix.length,after:extended.length,executed:0});
  }),
  make('HARNESS-015','Execution-local source fingerprints include untracked files and permit a new authorized baseline',async c=>{
    await proveExecutionFingerprint(c);
    return {limits:['Synthetic source files in an owned fixture exercise the preservation control without modifying the real product. Real per-run source preservation is separately enforced by runner fingerprints and report provenance.']};
  }),
  make('HARNESS-016','GUI launch route blocked before process creation',async c=>{
    let blocked=false;try{await c.run(path.join(c.root,'electron.exe'),[]);}catch(e){blocked=e.message.includes('GUI route refused');}
    c.eq('synthetic GUI executable never launched',blocked,true);
    for(const argv of [['gui'],['-c','color.ui=false','citool'],['help','--web','add'],['instaweb']]){let rejected=false;try{await c.git(argv);}catch(e){rejected=e.message.includes('GUI route refused');}c.eq('Git GUI route never spawned '+argv.join(' '),rejected,true);}
    await c.init();await c.cli(['init']);await c.cli(['status']);
    c.ok('ledger contains only Node and official Git',c.commands.every(cmd=>[process.execPath,c.gitPath].includes(cmd.executable)));
    return {limits:['Build input graph excludes desktop. Ledger records direct children; no OS-wide tracing of internal Git grandchildren under sandbox.']};
  }),
  make('HARNESS-018','Missing evidence, malformed result and inconsistent counts fail',async c=>{
    const r=synthetic(c);c.eq('valid result accepted',validateResult(r,c.packageRoot),true);
    c.ok('missing evidence refused',rejects(()=>validateResult({...r,evidence:[{...r.evidence[0],path:'missing-synthetic'}]},c.packageRoot)));
    c.ok('hash mismatch refused',rejects(()=>validateResult({...r,evidence:[{...r.evidence[0],sha256:'0'.repeat(64)}]},c.packageRoot)));
    const malformed={...r};delete malformed.commands;c.ok('malformed schema refused',rejects(()=>validateResult(malformed,c.packageRoot)));
    c.ok('assertion evidence absent refused',rejects(()=>validateResult({...r,assertions:[{...r.assertions[0],evidence_paths:['missing-assertion-evidence']}]},c.packageRoot)));
    c.ok('environment artifact absent refused',rejects(()=>validateResult({...r,environment_path:'missing-environment'},c.packageRoot)));
    c.ok('case cannot force PASS',rejects(()=>applyOutcome({...r},{execution_status:'PASS'})));
    c.ok('unknown outcome not ignored',rejects(()=>applyOutcome({...r},{executionStatus:'PASS'})));
    c.ok('traversal refused',rejects(()=>safeEvidence(c.packageRoot,'../outside')));
    const matrix=loadMatrix(),results=matrix.map(s=>baseResult(s,null,runInfo));c.ok('count mismatch refused',rejects(()=>validateBundle(c.packageRoot,results,matrix,{variants:0})));
    c.eq('computed denominator follows the current matrix',counts(results).scenario_ids,matrix.length);
  }),
  make('HARNESS-019','Different snapshot provenance remains separate',async c=>{
    const a={sourceFingerprint:'a',runnerFingerprint:'r',id:'run-a'},b={sourceFingerprint:'b',runnerFingerprint:'r',id:'run-b'};
    function aggregate(runs){if(new Set(runs.map(r=>r.sourceFingerprint+'/'+r.runnerFingerprint)).size!==1)throw Error('Distinct snapshots cannot produce single full PASS');return runs;}
    c.ok('mixed source refused',rejects(()=>aggregate([a,b])));c.eq('identical provenance allowed',aggregate([a,{...a,id:'run-c'}]).length,2);
    json(path.join(c.artifactDir,'provenance-control.json'),{a,b,policy:'No cross-run full-pass union; final report keeps run IDs'});
  }),
  make('HARNESS-022','Observer preserves explicit configuration instead of Core policy',async c=>{
    await c.init();await c.git(['config','--local','core.quotepath','true']);
    c.eq('native observer uses official executable',path.isAbsolute(c.gitPath),true);
    c.eq('explicit local option preserved',(await c.git(['config','--get','core.quotepath'])).stdout.trim(),'true');
    c.eq('Git version identified',(await c.git(['version'])).stdout.startsWith('git version '),true);
    c.ok('observer argv has no policy overrides',c.commands.filter(x=>x.executable===c.gitPath).every(x=>!x.argv.includes('core.quotepath=false')));
  }),
  make('HARNESS-023','Specification and scope never become vacuous PASS',async c=>{
    const r=synthetic(c);c.ok('no assertions rejects PASS',rejects(()=>validateResult({...r,assertions:[]},c.packageRoot)));
    c.ok('SPEC_ONLY cannot PASS',rejects(()=>validateResult({...r,implementation_status:'SPEC_ONLY'},c.packageRoot)));
    c.ok('out of scope cannot PASS',rejects(()=>validateResult({...r,selection_status:'OUT_OF_SCOPE_CURRENT_PHASE'},c.packageRoot)));
    const matrix=loadMatrix(),results=matrix.map(s=>baseResult(s,null,runInfo));const n=counts(results);
    c.eq('unselected variant not prematurely supported',baseResult(matrix[0],{variant:'unselected',productStatus:'VERIFIED_SUPPORTED'},runInfo).product_status,'NOT_ASSESSED');
    c.eq('specified scenarios execute zero',n.execution.NOT_RUN,matrix.length);c.eq('no implemented specs',n.implemented_ids,0);
  }),
];
