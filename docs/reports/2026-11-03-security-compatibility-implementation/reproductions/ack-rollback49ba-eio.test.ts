import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import {pathToFileURL} from 'node:url';

// Sanitized historical reproduction; runtime evidence is recorded separately.
// The historical test body is preserved byte-exact below.
// Run only on a verified independent historical source copy, never a Git checkout.
const sourceValue=process.env.GL_REPRO_SOURCE,parentValue=process.env.GL_REPRO_PARENT,gitValue=process.env.GL_REPRO_GIT;
assert(sourceValue&&path.isAbsolute(sourceValue),'GL_REPRO_SOURCE must be an absolute independent historical source directory');
assert(parentValue&&path.isAbsolute(parentValue),'GL_REPRO_PARENT must be a new empty absolute fixture parent');
assert(gitValue&&path.isAbsolute(gitValue),'GL_REPRO_GIT must be the absolute official Git executable');
const reproSource=fs.realpathSync(sourceValue),reproParent=fs.realpathSync(parentValue),officialGit=fs.realpathSync(gitValue);
const contained=(a:string,b:string)=>{const r=path.relative(a,b);return r!==''&&r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
assert(reproSource!==reproParent&&!contained(reproSource,reproParent)&&!contained(reproParent,reproSource),'Source and fixture parent must be separate independent directories');
function realAncestors(directory:string){for(let cursor=directory;;cursor=path.dirname(cursor)){const stat=fs.lstatSync(cursor);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Ancestors must be real directories');assert(!fs.existsSync(path.join(cursor,'.git')),'Historical source and fixture parent must be outside every Git repository');if(path.dirname(cursor)===cursor)break;}}
realAncestors(reproSource);realAncestors(reproParent);assert.equal(fs.readdirSync(reproParent).length,0,'Use a new empty parent for each proof; all fixture data are retained');assert(fs.statSync(officialGit).isFile(),'Official Git must be a regular executable');
const sourceManifest=JSON.parse(fs.readFileSync(new URL('./SOURCE-MANIFEST49BA.json',import.meta.url),'utf8'));
assert.equal(sourceManifest.count,183);assert.equal(sourceManifest.fingerprint,'49ba56cd980e339bd00770d8b4a294914b7b30236923da79008b966961567d09');
const sourceHash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');assert.equal(sourceHash(JSON.stringify(sourceManifest.inputs)),sourceManifest.fingerprint);
function verifyHistoricalSource(){const actual:string[]=[];const scan=(d:string)=>{for(const e of fs.readdirSync(path.join(reproSource,d),{withFileTypes:true})){assert(!e.isSymbolicLink(),'Source links are refused');const relative=d+'/'+e.name;if(e.isDirectory())scan(relative);else{const st=fs.lstatSync(path.join(reproSource,relative));assert(st.isFile()&&st.nlink===1,'Historical source must contain independent regular files');actual.push(relative);}}};for(const d of ['src','scripts','tests'])scan(d);actual.push('package.json','package-lock.json','tsconfig.json');actual.sort();assert.deepEqual(actual,sourceManifest.inputs.map((e:any)=>e.file));for(const e of sourceManifest.inputs){assert(typeof e.file==='string'&&!path.isAbsolute(e.file)&&!e.file.includes('\\')&&!e.file.split('/').includes('..'),'Unsafe manifest path');assert.equal(sourceHash(fs.readFileSync(path.join(reproSource,e.file))),e.sha256,'Historical source differs: '+e.file);}}
verifyHistoricalSource();
const {GitLayers}=await import(pathToFileURL(path.join(reproSource,'src/core/index.ts')).href);
const {Transaction}=await import(pathToFileURL(path.join(reproSource,'src/core/storage.ts')).href);
const {createFixture,isolatedEnvironment}=await import(pathToFileURL(path.join(reproSource,'scripts/git-compat/lib.mjs')).href);
const evidenceRoot=path.join(reproParent,'observations');

const keepFixtures = true;
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function fixtureParent() {
  const parent = reproParent;
  for (let cursor = parent; ; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Fixture ancestors must be real directories');
    try { fs.lstatSync(path.join(cursor, '.git')); assert.fail('Fixture parent must be outside every repository'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(cursor) === cursor) break;
  }
  return fs.realpathSync(parent);
}

function inventory(directory: string, prefix = ''): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  if (!fs.existsSync(directory)) return entries;
  for (const name of fs.readdirSync(directory).sort()) {
    if (!prefix && name === '.git') continue;
    const file = path.join(directory, name), relative = prefix + name, stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), 'Independent observer never follows fixture links');
    if (stat.isDirectory()) Object.assign(entries, inventory(file, relative + '/'));
    else {
      assert(stat.isFile() && stat.nlink === 1, 'Fixture contains only independent regular files');
      const bytes = fs.readFileSync(file);
      entries[relative] = { sha256: hash(bytes), bytes: bytes.length, mode: stat.mode & 0o777 };
    }
  }
  return entries;
}

async function fixture(t: TestContext) {
  const owned = createFixture(fixtureParent(), 'gl-security-ownership');
  const ownedMarker=JSON.parse(fs.readFileSync(path.join(owned.root,'.git-compat-owned.json'),'utf8'));
  assert.equal(ownedMarker.nonce,owned.nonce);assert.equal(ownedMarker.parent,fs.realpathSync(reproParent));
  assert(contained(reproParent,fs.realpathSync(owned.root)));realAncestors(owned.root);
  t.after(()=>verifyHistoricalSource());
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const events: unknown[] = [];
  const git = (args: string[], index?: string) => {
    const stdout = execFileSync(officialGit, args, { cwd: repo, env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    events.push({ kind: 'git', executable: officialGit, args, index: index ? path.basename(index) : 'main', code: 0, stdout });
    return stdout.trimEnd();
  };
  const write = (relative: string, bytes: string) => { const file = path.join(repo, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
  const read = (relative: string) => fs.readFileSync(path.join(repo, relative), 'utf8');
  git(['init', '-b', 'main']); git(['config', 'core.autocrlf', 'false']);
  write('base.txt', 'base A\n'); git(['add', '.']); git(['commit', '-m', 'base']);
  let app = await GitLayers.init(repo);
  const layerIndex = (name: string) => {
    const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
    return path.join(app.dir, 'indexes', registry.layers.find((layer: any) => layer.name === name).id + '.index');
  };
  const domain = () => {
    const registry = JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8'));
    return {
      head: git(['rev-parse', 'HEAD']), branch: git(['symbolic-ref', '--short', 'HEAD']),
      branches: git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']),
      mainIndex: git(['ls-files', '--stage']),
      layerIndexes: Object.fromEntries(registry.layers.map((layer: any) => [layer.name, git(['ls-files', '--stage'], layerIndex(layer.name))])),
      files: inventory(repo),
    };
  };
  const record = (label: string, value: unknown) => events.push({ kind: 'observation', label, value });
  const capture = (label: string) => {
    const state = { ...domain(), allRefs: git(['for-each-ref', '--format=%(refname) %(objectname)']), metadata: inventory(app.dir), workspace: JSON.parse(fs.readFileSync(path.join(app.dir, 'workspace.json'), 'utf8')), registry: JSON.parse(fs.readFileSync(path.join(app.dir, 'registry.json'), 'utf8')), exclude: fs.readFileSync(app.repo.exclude, 'utf8') };
    record(label, state); return state;
  };
  const seed = async (name: string, file: string) => { await app.create(name); await app.on(name); write(file, name + ' A\n'); await app.add(name, [file]); await app.commit(name, 'seed ' + name); };
  const pendingB = async () => { write('b.txt', 'b B staged\n'); await app.add('b', ['b.txt']); write('b.txt', 'b C disk\n'); };
  const reopen = async () => { app = await GitLayers.open(repo); return app; };
  capture('initialized');
  t.after(() => {
    try {
      capture('final');
      if (evidenceRoot) {
        fs.mkdirSync(evidenceRoot, { recursive: true });
        fs.writeFileSync(path.join(evidenceRoot, t.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json'), JSON.stringify({ test: t.name, fixture: owned.root, officialGit, gitVersion: git(['--version']), node: process.version, platform: process.platform, events }, null, 2) + '\n');
      }
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previous);
      if (keepFixtures) t.diagnostic('Preserved owned fixture: ' + owned.root);
      else assert.fail('Historical reproduction fixtures must be preserved');
    }
  });
  return { get app() { return app; }, repo, write, read, git, seed, pendingB, domain, capture, record, reopen, layerIndex };
}



test('Candidate49ba acknowledgement rollback one shot EIO', { timeout: 900000 }, async t => {
 const f=await fixture(t);await f.seed('a','a.txt');await f.seed('b','b.txt');
 f.write('base.txt','base B staged\n');f.git(['add','--','base.txt']);
 f.write('a.txt','a B staged\n');await f.app.add('a',['a.txt']);f.write('a.txt','a C disk\n');await f.pendingB();
 fs.renameSync(path.join(f.repo,'a.txt'),path.join(f.repo,'first.txt'));
 const review=await f.app.ownershipReview();await f.app.resolveOwnership({token:review.token,renames:[{from:'a.txt',to:'first.txt'}]});
 assert.equal((await f.app.status()).safe,true);await f.reopen();
 const workspace=()=>JSON.parse(fs.readFileSync(path.join(f.app.dir,'workspace.json'),'utf8'));
 assert(workspace().acknowledgedMissing.includes('a.txt'));f.write('a.txt','observed reappearance C2\n');
 assert(f.git(['ls-tree','-r','layer/a','--','a.txt']).includes('a.txt'));
 const rawIndices=()=>Object.fromEntries([['main',f.app.repo.index],['a',f.layerIndex('a')],['b',f.layerIndex('b')]].map(([n,p])=>{const b=fs.readFileSync(p!);return[n,{sha256:hash(b),bytes:b.length,base64:b.toString('base64'),mode:fs.statSync(p!).mode&0o777}]}));
 const before=f.capture('before proof'),beforeDomain=f.domain(),beforeRaw=rawIndices(),beforeJournals=new Set(fs.readdirSync(path.join(f.app.dir,'transactions')));
 f.record('raw indices before proof',beforeRaw);
 const originalBegin=Transaction.begin,originalFinish=Transaction.prototype.finish;let writerFired=false,faultFired=false;let writer:any;const finishCalls:any[]=[];
 Transaction.begin=async(dir,kind,metadata)=>{if(!writerFired&&dir===f.app.dir&&kind==='editing-sync'){writerFired=true;writer=JSON.parse(execFileSync(process.execPath,['-e',"const fs=require('node:fs');fs.renameSync(process.argv[1],process.argv[2]);process.stdout.write(JSON.stringify({pid:process.pid,renamed:!fs.existsSync(process.argv[1])&&fs.existsSync(process.argv[2])}));",path.join(f.repo,'a.txt'),path.join(f.repo,'again.txt')],{cwd:f.repo,env:process.env,windowsHide:true,encoding:'utf8',timeout:60000}));assert(writer.renamed);assert.notEqual(writer.pid,process.pid);f.record('real external rename before transaction',writer);}return originalBegin.call(Transaction,dir,kind,metadata);};
 Transaction.prototype.finish=async function(){finishCalls.push({id:this.id,kind:this.data.kind,state:this.data.state,acknowledged:workspace().acknowledgedMissing?.includes('a.txt')??false});if(!faultFired&&writerFired&&this.data.kind==='editing-sync'){faultFired=true;assert(!workspace().acknowledgedMissing.includes('a.txt'));f.capture('revocation saved before original finish');const e:any=new Error('TEST ONLY one-shot EIO before original Transaction.finish');e.code='EIO';throw e;}return originalFinish.call(this);};
 t.after(()=>{Transaction.begin=originalBegin;Transaction.prototype.finish=originalFinish;});
 let firstStatus:any;try{firstStatus=await f.app.status();}finally{Transaction.begin=originalBegin;Transaction.prototype.finish=originalFinish;}
 assert(writerFired&&faultFired,'Both hooks must actually execute');f.record('injected EIO status',{firstStatus,finishCalls,writer,injection:'TEST ONLY; exactly BEFORE original first finish AFTER save; second original finish allowed'});
 const afterFailure=f.capture('after EIO and rollback'),afterRaw=rawIndices();const expectedDomain=structuredClone(beforeDomain);expectedDomain.files['again.txt']=expectedDomain.files['a.txt'];delete expectedDomain.files['a.txt'];assert.deepEqual(f.domain(),expectedDomain);
 assert.equal(f.read('first.txt'),'a C disk\n');assert.equal(f.read('again.txt'),'observed reappearance C2\n');assert(!fs.existsSync(path.join(f.repo,'a.txt')));
 const newJournals=fs.readdirSync(path.join(f.app.dir,'transactions')).filter(id=>!beforeJournals.has(id)).map(id=>({id,...JSON.parse(fs.readFileSync(path.join(f.app.dir,'transactions',id,'journal.json'),'utf8'))}));
 f.record('rollback journal/raw indices',{newJournals,afterRaw,rawEqual:{main:afterRaw.main.sha256===beforeRaw.main.sha256,a:afterRaw.a.sha256===beforeRaw.a.sha256,b:afterRaw.b.sha256===beforeRaw.b.sha256},workspace:workspace()});
 await f.reopen();const reopenedStatus=await f.app.status(),beforeStage=f.capture('reopened before stage'),beforeStageDomain=f.domain();
 let stage:any,stageError:any,commit:any,commitError:any;try{stage=await f.app.baseStage(['again.txt']);}catch(e:any){stageError={code:e.code,message:e.message};}f.capture('after controlled base stage');
 let classification:string;
 if(stage){assert.equal(f.git(['show',':again.txt']),'observed reappearance C2');try{commit=await f.app.baseCommit('fixture only: observed Layer-origin candidate after failed revocation');}catch(e:any){commitError={code:e.code,message:e.message};}
  if(commit){assert.equal(f.git(['show','HEAD:again.txt']),'observed reappearance C2');assert.equal(f.git(['rev-parse','layer/a']),before.branches.split('\n').find(x=>x.startsWith('refs/heads/layer/a '))!.split(' ')[1]);assert.equal(f.git(['ls-files','--stage'],f.layerIndex('a')),before.layerIndexes.a);assert.equal(f.git(['ls-files','--stage'],f.layerIndex('b')),before.layerIndexes.b);classification='CONFIRMED_LAYER_ORIGIN_BYTES_ENTERED_MAIN_AFTER_ACK_ROLLBACK';}
  else classification='STAGING_ACCEPTED_COMMIT_REFUSED_REVIEW_REQUIRED';
 }else{assert.deepEqual(f.domain(),beforeStageDomain);classification=newJournals.some(j=>j.state!=='completed')?'SAFE_REFUSAL_PENDING_JOURNAL':'SAFE_REFUSAL_CANDIDATE_NOT_STAGED';}
 const final=f.capture('final proof outcome');f.record('proof outcome',{classification,injectedEIOIsTestOnly:true,writer,firstStatus:{safe:firstStatus.safe,error:firstStatus.error},ackRestoredAfterFailure:afterFailure.workspace.acknowledgedMissing?.includes('a.txt')??false,reopenedStatus:{safe:reopenedStatus.safe,error:reopenedStatus.error},stage,stageError,commit,commitError,workspace:workspace(),rawIndices:rawIndices(),newJournals:newJournals.map(j=>({id:j.id,state:j.state,kind:j.kind,error:j.error})),countsAddedToFull:0,fixture:f.repo,finalRefs:final.allRefs});t.diagnostic('PROOF_CLASSIFICATION '+classification);
});
