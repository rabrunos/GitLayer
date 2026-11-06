import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test, { type TestContext } from 'node:test';
import { GitLayers, LabError } from '../../src/core/index.js';
import { listTransactions, Transaction } from '../../src/core/storage.js';
import { createFixture, isolatedEnvironment, resolveGit, cleanupFixture } from '../../scripts/git-compat/lib.mjs';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
// These compound recovery fixtures include setup, several Core calls and
// independent Git oracles. V7 preserved two 180-second timeouts; a recovery was
// observed completed after its cutoff. Use the full harness budget, without
// changing any oracle or interpreting validation time as a performance SLO.
const budget = { timeout: 900000 };
async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-activation-frontier'), saved = { ...process.env }, executable = resolveGit(), env = isolatedEnvironment(owned.root, executable);
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  let passed = false;
  t.after(() => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, saved); if (passed) cleanupFixture(owned); else t.diagnostic(JSON.stringify({ retained: true, ...owned })); });
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string) => cp.execFileSync(executable, args, { cwd: repo, env: { ...env, ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  native(['init', '-b', 'main']); fs.writeFileSync(path.join(repo, 'base.txt'), 'base A\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base']);
  const seed = path.join(owned.root, 'seed.index'), target = path.join(repo, 'layer.txt');
  const make = (text: string, parent?: string) => { fs.writeFileSync(target, text); native(['read-tree', '--empty'], seed); native(['add', '--', 'layer.txt'], seed); const tree = native(['write-tree'], seed), oid = native(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'synthetic layer']); fs.unlinkSync(target); return { text, tree, oid }; };
  const A = make('Layer committed A\n'), B = make('External staged B\n', A.oid), C = make('External staged C\n', B.oid);
  native(['update-ref', 'refs/heads/layer/a', A.oid]); const app = await GitLayers.init(repo); await app.register('a');
  const layer = (await app.list()).find(l => l.name === 'a')!, index = path.join(app.dir, 'indexes', layer.id + '.index'), checkpoint = 'refs/git-layers/state/' + layer.id;
  const before = { head: native(['rev-parse', 'HEAD']), main: fs.readFileSync(app.repo.index), index: fs.readFileSync(index), refs: native(['for-each-ref', '--format=%(refname) %(objectname)']) };
  const unchangedMain = () => { assert.equal(native(['rev-parse', 'HEAD']), before.head); assert(fs.readFileSync(app.repo.index).equals(before.main)); assert.equal(native(['show', 'HEAD:base.txt']), 'base A'); };
  return { owned, repo, native, A, B, C, app, layer, index, target, checkpoint, before, unchangedMain, success: () => { passed = true; } };
}

for (const boundary of ['index-before-materialize', 'index-after-materialize', 'ref-after-materialize', 'index-after-publish', 'ref-after-publish', 'index-before-checkpoint', 'ref-after-checkpoint', 'checkpoint-before-checkpoint', 'index-lock-after-materialize'] as const) test('activation refuses ' + boundary + ' without adopting foreign index refs or version', budget, async t => {
  const f = await fixture(t), prototype = GitLayers.prototype as any;
  const method = boundary.includes('materialize') ? 'materialize' : boundary.includes('publish') ? 'publish' : 'checkpointTree', original = prototype[method];
  let injected = false, foreignIndex: Buffer | undefined;
  const inject = () => {
    if (injected) return; injected = true;
    if (boundary.startsWith('index-lock')) fs.writeFileSync(f.index + '.lock', 'foreign native lock\n', { flag: 'wx' });
    else if (boundary.startsWith('index-')) { f.native(['read-tree', f.B.tree], f.index); foreignIndex = fs.readFileSync(f.index); }
    else if (boundary.startsWith('checkpoint-')) f.native(['update-ref', f.checkpoint, f.B.tree, f.A.tree]);
    else f.native(['update-ref', 'refs/heads/layer/a', f.B.oid, f.A.oid]);
  };
  prototype[method] = async function (...args: any[]) {
    if (this.dir !== f.app.dir) return original.apply(this, args);
    if (boundary.includes('before-')) inject();
    const value = await original.apply(this, args);
    if (!boundary.includes('before-')) inject();
    return value;
  };
  try { await assert.rejects(f.app.on('a'), (error: any) => ['EXTERNAL_INDEX', 'EXTERNAL_REF', 'CHECKPOINT_MISMATCH', 'LOCKED'].includes(error.code)); }
  finally { prototype[method] = original; }
  assert(injected); f.unchangedMain(); assert.equal(fs.existsSync(f.target), false, 'No unknown version may remain successfully projected');
  if (foreignIndex) { assert(fs.readFileSync(f.index).equals(foreignIndex)); assert.equal(f.native(['show', ':layer.txt'], f.index), f.B.text.trimEnd()); }
  else assert(fs.readFileSync(f.index).equals(f.before.index));
  assert.equal(f.native(['rev-parse', 'refs/heads/layer/a']), boundary.startsWith('ref-') ? f.B.oid : f.A.oid);
  assert.equal(f.native(['rev-parse', f.checkpoint]), boundary.startsWith('checkpoint-') ? f.B.tree : f.A.tree);
  if (boundary.startsWith('index-lock')) { assert.equal(fs.readFileSync(f.index + '.lock', 'utf8'), 'foreign native lock\n'); fs.unlinkSync(f.index + '.lock'); }
  t.diagnostic(JSON.stringify({ boundary, unknownIndexPreserved: !!foreignIndex, branch: f.native(['rev-parse', 'refs/heads/layer/a']), checkpoint: f.native(['rev-parse', f.checkpoint]), mainSHA256: hash(fs.readFileSync(f.app.repo.index)) }));
  f.success();
});

test('normal activation validates Git objects in an independent timestamp-bounded index and retains the native checkpoint', budget, async t => {
  const f = await fixture(t), original = (GitLayers.prototype as any).materialize; let copied = '';
  (GitLayers.prototype as any).materialize = async function (layer: any) {
    copied = this.activationSource.index; const source = fs.statSync(f.index, { bigint: true }), scratch = fs.statSync(copied, { bigint: true });
    assert.notEqual(copied, f.index); assert.equal(path.dirname(copied), this.tx.dir); assert(scratch.mtimeNs >= 1000000000n && scratch.mtimeNs <= source.mtimeNs);
    assert.equal(f.native(['show', ':layer.txt'], copied), f.A.text.trimEnd()); return original.call(this, layer);
  };
  try { await f.app.on('a'); } finally { (GitLayers.prototype as any).materialize = original; }
  f.unchangedMain(); assert(fs.readFileSync(f.index).equals(f.before.index)); assert.equal(fs.readFileSync(f.target, 'utf8'), f.A.text);
  assert.equal(f.native(['rev-parse', f.checkpoint]), f.A.tree); assert.equal(f.native(['rev-parse', 'refs/heads/layer/a']), f.A.oid);
  assert(fs.existsSync(copied)); assert.equal((await listTransactions(f.app.dir)).length, 0); f.success();
});

async function legacyShelf(f: Awaited<ReturnType<typeof fixture>>) {
  const shelf = 'legacy-stage', directory = path.join(f.app.dir, 'shelves', f.layer.id, shelf); fs.mkdirSync(directory, { recursive: true });
  const index = path.join(directory, 'index'); f.native(['read-tree', f.B.tree], index);
  const file = path.join(directory, 'shelf.json'); fs.writeFileSync(file, JSON.stringify({ schema: 1, oid: f.A.oid, index: 'index', reservations: [], files: [{ path: 'layer.txt', bytes: Buffer.from('Later unstaged C\n').toString('base64'), mode: 0o644 }] }, null, 2) + '\n');
  const registryFile = path.join(f.app.dir, 'registry.json'), registry = JSON.parse(fs.readFileSync(registryFile, 'utf8')); registry.layers[0].state = 'parked'; registry.layers[0].shelf = shelf; fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2) + '\n');
  return { index, file, before: { index: fs.readFileSync(index), file: fs.readFileSync(file) } };
}

test('legacy shelf activation atomically restores staged B while disk C and committed A remain distinct', budget, async t => {
  const f = await fixture(t), shelf = await legacyShelf(f); await f.app.on('a');
  f.unchangedMain(); assert.equal(f.native(['show', 'layer/a:layer.txt']), f.A.text.trimEnd()); assert.equal(f.native(['show', ':layer.txt'], f.index), f.B.text.trimEnd()); assert.equal(fs.readFileSync(f.target, 'utf8'), 'Later unstaged C\n');
  assert.equal(f.native(['rev-parse', f.checkpoint]), f.B.tree); assert(fs.readFileSync(shelf.index).equals(shelf.before.index)); assert(fs.readFileSync(shelf.file).equals(shelf.before.file));
  const status = await f.app.status(); assert.equal(status.safe, true); assert(status.layers[0]!.staged.length > 0); assert(status.layers[0]!.unstaged.length > 0);
  await assert.rejects(f.app.deactivate('a'), { code: 'LAYER_DIRTY' }); assert.equal(fs.readFileSync(f.target, 'utf8'), 'Later unstaged C\n'); f.success();
});

test('legacy shelf publication refuses a later foreign private index before its atomic rename', budget, async t => {
  const f = await fixture(t), shelf = await legacyShelf(f), prototype = GitLayers.prototype as any, track = prototype.track; let injected = false, foreign: Buffer | undefined;
  prototype.track = async function (file: string) {
    const result = await track.call(this, file);
    if (!injected && this.dir === f.app.dir && path.resolve(file) === f.index && this.tx.data.kind === 'activate') { injected = true; f.native(['read-tree', f.C.tree], f.index); foreign = fs.readFileSync(f.index); }
    return result;
  };
  try { await assert.rejects(f.app.on('a'), (error: any) => ['EXTERNAL_EDIT', 'EXTERNAL_INDEX'].includes(error.code)); } finally { prototype.track = track; }
  assert(injected && foreign); assert(fs.readFileSync(f.index).equals(foreign)); assert.equal(f.native(['show', ':layer.txt'], f.index), f.C.text.trimEnd()); assert.equal(fs.existsSync(f.target), false);
  f.unchangedMain(); assert.equal(f.native(['rev-parse', f.checkpoint]), f.A.tree); assert.equal(f.native(['rev-parse', 'refs/heads/layer/a']), f.A.oid);
  assert(fs.readFileSync(shelf.index).equals(shelf.before.index)); assert(fs.readFileSync(shelf.file).equals(shelf.before.file)); assert((await listTransactions(f.app.dir)).length > 0); f.success();
});

test('activation checkpoint CAS refuses an external advance at real native transaction input', budget, async t => {
  const f = await fixture(t), spawn = cp.spawn; let injected = false;
  // Inject a real native writer after the helper planned its CAS, before the
  // real transaction input reaches prepare. No Git output/result is simulated.
  cp.spawn = function (...args: Parameters<typeof cp.spawn>): ReturnType<typeof cp.spawn> {
    const argv = args[1] as string[] | undefined, child = (spawn as any)(...args);
    if (argv?.includes('update-ref') && argv.includes('--no-deref') && argv.includes('--stdin')) {
      const write = child.stdin.write.bind(child.stdin);
      child.stdin.write = function (chunk: any, ...rest: any[]) {
        const input = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        for (const line of input.split('\n')) {
          const [operation, ref, , oldOid] = line.split(' ');
          if (!injected && operation === 'update' && ref === f.checkpoint) {
            assert.equal(oldOid, f.A.tree); f.native(['update-ref', f.checkpoint, f.B.tree, f.A.tree]); injected = true;
          }
        }
        return write(chunk, ...rest);
      };
    }
    return child;
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  try { await assert.rejects(f.app.on('a')); } finally { cp.spawn = spawn; syncBuiltinESMExports(); }
  assert(injected); assert.equal(f.native(['rev-parse', f.checkpoint]), f.B.tree); assert.equal(f.native(['rev-parse', 'refs/heads/layer/a']), f.A.oid);
  assert(fs.readFileSync(f.index).equals(f.before.index)); assert.equal(fs.existsSync(f.target), false); f.unchangedMain();
  assert((await listTransactions(f.app.dir)).length > 0, 'A disputed checkpoint cannot be declared recovered'); f.success();
});

for (const change of ['replacement', 'timestamp'] as const) test('legacy shelf adoption refuses equal-byte ' + change + ' after atomic publication and preserves repeated recovery', budget, async t => {
    const f = await fixture(t), shelf = await legacyShelf(f), prototype = GitLayers.prototype as any, track = prototype.track;
    let injected = false, foreign: Buffer | undefined, foreignIdentity: fs.BigIntStats | undefined;
    prototype.track = async function (file: string) {
      const result = await track.call(this, file);
      if (!injected && this.dir === f.app.dir && path.resolve(file) === f.index && this.tx.data.kind === 'activate') {
        const source = this.activationSource, adopt = source.adoptPublishedIndex;
        source.adoptPublishedIndex = async function (expected: any) {
          const before = fs.statSync(f.index, { bigint: true }); foreign = fs.readFileSync(f.index);
          if (change === 'replacement') {
            const temporary = path.join(f.owned.root, 'foreign-equal-index'); fs.writeFileSync(temporary, foreign, { flag: 'wx' });
            const fd = fs.openSync(temporary, 'r+'); try { fs.futimesSync(fd, new Date(), Number(before.mtimeNs) / 1e9); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
            fs.renameSync(temporary, f.index);
          } else {
            const fd = fs.openSync(f.index, 'r+'); try { fs.futimesSync(fd, new Date(), Number(before.mtimeNs) / 1e9 + 60); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
          }
          foreignIdentity = fs.statSync(f.index, { bigint: true }); injected = true;
          if (change === 'replacement') assert.notEqual(foreignIdentity.ino, before.ino); else assert(foreignIdentity.mtimeNs > before.mtimeNs);
          return adopt.call(source, expected);
        };
      }
      return result;
    };
    try { await assert.rejects(f.app.on('a'), { code: 'EXTERNAL_INDEX' }); } finally { prototype.track = track; }
    assert(injected && foreign && foreignIdentity); assert(fs.readFileSync(f.index).equals(foreign));
    const after = fs.statSync(f.index, { bigint: true }); assert.equal(after.ino, foreignIdentity.ino); assert.equal(after.mtimeNs, foreignIdentity.mtimeNs);
    assert.equal(f.native(['show', ':layer.txt'], f.index), f.B.text.trimEnd()); assert.equal(fs.existsSync(f.target), false); f.unchangedMain();
    assert.equal(f.native(['rev-parse', f.checkpoint]), f.A.tree); assert.equal(f.native(['rev-parse', 'refs/heads/layer/a']), f.A.oid);
    assert(fs.readFileSync(shelf.index).equals(shelf.before.index)); assert(fs.readFileSync(shelf.file).equals(shelf.before.file));
    const pending=await listTransactions(f.app.dir);assert.equal(pending.length,1,'Unknown image identity keeps recovery pending even when its bytes match planned B');
    const journal=path.join(f.app.dir,'transactions',pending[0].id,'journal.json'),journalBytes=fs.readFileSync(journal);
    assert.deepEqual(pending[0].recovery.activationIndexConflict,{path:f.index,reason:'identity-changed'});
    const reopened=await GitLayers.open(f.repo);
    for(let repeat=0;repeat<2;repeat++){
      await assert.rejects(reopened.recover(),(error:any)=>error.code==='RECOVERY_CONFLICT'&&error.details?.reason==='activation-index-identity-changed');
      assert(fs.readFileSync(f.index).equals(foreign));const retained=fs.statSync(f.index,{bigint:true});assert.equal(retained.ino,foreignIdentity.ino);assert.equal(retained.mtimeNs,foreignIdentity.mtimeNs);assert(fs.readFileSync(journal).equals(journalBytes));
    }
    f.success();
});

test('durable shelf publication identity refuses a foreign equal-byte index even when the later conflict record is unavailable', budget, async t => {
  const f=await fixture(t);await legacyShelf(f);const prototype=GitLayers.prototype as any,track=prototype.track,record=Transaction.prototype.record;let injected=false,foreign:Buffer|undefined,identity:fs.BigIntStats|undefined;
  prototype.track=async function(file:string){const result=await track.call(this,file);if(!injected&&this.dir===f.app.dir&&path.resolve(file)===f.index&&this.tx.data.kind==='activate'){
    const source=this.activationSource,adopt=source.adoptPublishedIndex;source.adoptPublishedIndex=async function(expected:any){const replacement=path.join(f.owned.root,'foreign-equal-index');foreign=fs.readFileSync(f.index);fs.writeFileSync(replacement,foreign,{flag:'wx'});fs.renameSync(replacement,f.index);identity=fs.statSync(f.index,{bigint:true});injected=true;return adopt.call(source,expected);};
  }return result;};
  Transaction.prototype.record=async function(step,details){if(step==='activation-index-conflict'&&path.dirname(this.dir)===path.join(f.app.dir,'transactions'))throw Object.assign(new Error('fixture-only unavailable conflict journal'),{code:'EIO'});return record.call(this,step,details);};
  try{await assert.rejects(f.app.on('a'),{code:'EIO'});}finally{prototype.track=track;Transaction.prototype.record=record;}
  assert(injected&&foreign&&identity);const pending=await listTransactions(f.app.dir);assert.equal(pending.length,1);assert.equal(pending[0].recovery.activationIndexConflict,undefined);assert(pending[0].recovery.activationIndexPublication,'The identity witness was durable BEFORE native publication');
  const journal=path.join(f.app.dir,'transactions',pending[0].id,'journal.json'),before=fs.readFileSync(journal);assert.equal(JSON.parse(before.toString()).schema,2);
  const reopened=await GitLayers.open(f.repo);for(let repeat=0;repeat<2;repeat++){await assert.rejects(reopened.recover(),(error:any)=>error.code==='RECOVERY_CONFLICT'&&error.details?.reason==='activation-index-identity-changed');assert(fs.readFileSync(f.index).equals(foreign));const current=fs.statSync(f.index,{bigint:true});assert.equal(current.ino,identity.ino);assert.equal(current.mtimeNs,identity.mtimeNs);assert(fs.readFileSync(journal).equals(before));}
  assert.equal(f.native(['show',':layer.txt'],f.index),f.B.text.trimEnd());assert.equal(fs.existsSync(f.target),false);assert.equal(f.native(['rev-parse',f.checkpoint]),f.A.tree);f.unchangedMain();f.success();
});

test('durable shelf publication identity permits known B rollback once and completed recovery remains idempotent',budget,async t=>{
  const f=await fixture(t),shelf=await legacyShelf(f),prototype=GitLayers.prototype as any,track=prototype.track;let stopped=false;
  prototype.track=async function(file:string){const result=await track.call(this,file);if(!stopped&&this.dir===f.app.dir&&path.resolve(file)===f.index&&this.tx.data.kind==='activate'){this.activationSource.adoptPublishedIndex=async()=>{stopped=true;throw new LabError('INJECTED_FAILURE','Fixture interruption with the exact owned published index still present.');};}return result;};
  try{await assert.rejects(f.app.on('a'),{code:'INJECTED_FAILURE'});}finally{prototype.track=track;}
  assert(stopped);assert.equal(f.native(['show',':layer.txt'],f.index),f.B.text.trimEnd());const pending=await listTransactions(f.app.dir);assert.equal(pending.length,1);assert(pending[0].recovery.activationIndexPublication);assert.equal(pending[0].recovery.activationIndexConflict,undefined);
  const reopened=await GitLayers.open(f.repo);assert.deepEqual((await reopened.recover()).recovered,[pending[0].id]);assert.equal(f.native(['show',':layer.txt'],f.index),f.A.text.trimEnd());assert.equal(fs.existsSync(f.target),false);f.unchangedMain();
  const journal=path.join(f.app.dir,'transactions',pending[0].id,'journal.json'),completed=fs.readFileSync(journal),index=fs.readFileSync(f.index),identity=fs.statSync(f.index,{bigint:true});assert.equal(JSON.parse(completed.toString()).schema,1);
  assert.deepEqual((await reopened.recover()).recovered,[]);assert(fs.readFileSync(journal).equals(completed));assert(fs.readFileSync(f.index).equals(index));const after=fs.statSync(f.index,{bigint:true});assert.equal(after.ino,identity.ino);assert.equal(after.mtimeNs,identity.mtimeNs);
  assert(fs.readFileSync(shelf.index).equals(shelf.before.index));assert(fs.readFileSync(shelf.file).equals(shelf.before.file));f.success();
});

for(const remoteOnly of [false,true])test(remoteOnly?'fresh activation registers a unique remote-only candidate with durable initial reservations':'fresh activation registers an unregistered native local Layer with durable initial reservations',budget,async t=>{
  const f=await fixture(t),name=remoteOnly?'remoteFresh':'localFresh',relative=remoteOnly?'remote-fresh.txt':'local-fresh.txt',text='Fresh native Layer content\n',file=path.join(f.repo,relative),seed=path.join(f.owned.root,'fresh-seed.index');
  fs.writeFileSync(file,text,{flag:'wx'});f.native(['read-tree','--empty'],seed);f.native(['add','--',relative],seed);const tree=f.native(['write-tree'],seed),oid=f.native(['commit-tree',tree,'-m','fresh native candidate']);fs.unlinkSync(file);
  let remote:string|undefined,remoteBefore:string|undefined;
  if(remoteOnly){remote=path.join(f.owned.root,'fresh-remote.git');f.native(['init','--bare',remote]);f.native(['remote','add','fixture-fresh',remote]);f.native(['push','fixture-fresh',oid+':refs/heads/layer/'+name]);f.native(['fetch','fixture-fresh']);remoteBefore=f.native(['rev-parse','refs/remotes/fixture-fresh/layer/'+name]);assert.equal(remoteBefore,oid);assert.throws(()=>f.native(['show-ref','--verify','--quiet','refs/heads/layer/'+name]));}
  else f.native(['update-ref','refs/heads/layer/'+name,oid]);
  assert(!(await f.app.list()).some(layer=>layer.name===name&&!!layer.id),'The native candidate has not been registered through Core');
  const activated=await f.app.on(name);assert.equal(activated.state,'active');assert.equal(activated.oid,oid);assert.equal(fs.readFileSync(file,'utf8'),text);assert.equal(f.native(['show','layer/'+name+':'+relative]),text.trimEnd());
  const index=path.join(f.app.dir,'indexes',activated.id+'.index'),reservations=path.join(f.app.dir,'reservations',activated.id+'.json');assert.deepEqual(JSON.parse(fs.readFileSync(reservations,'utf8')),{schema:1,paths:[]});assert.equal(f.native(['show',':'+relative],index),text.trimEnd());assert.equal(f.native(['rev-parse','refs/git-layers/state/'+activated.id]),tree);assert.equal(f.native(['rev-parse','refs/heads/layer/'+name]),oid);f.unchangedMain();assert.deepEqual(await listTransactions(f.app.dir),[]);
  if(remoteOnly){assert.equal(f.native(['rev-parse','refs/remotes/fixture-fresh/layer/'+name]),remoteBefore);assert.equal(f.native(['config','--get','branch.layer/'+name+'.remote']),'fixture-fresh');const bare=cp.execFileSync(resolveGit(),['--git-dir',remote!,'rev-parse','refs/heads/layer/'+name],{env:process.env,encoding:'utf8',windowsHide:true}).trim();assert.equal(bare,oid);}
  await f.app.deactivate(name);assert.equal(fs.existsSync(file),false);assert.equal(f.native(['rev-parse','refs/heads/layer/'+name]),oid);f.unchangedMain();assert.deepEqual(await listTransactions(f.app.dir),[]);f.success();
});

for(const change of ['replacement','timestamp','native-lock'] as const)test('recovery revalidates '+change+' during index backup copy and preserves repeated refusal',budget,async t=>{
  const f=await fixture(t);await legacyShelf(f);const prototype=GitLayers.prototype as any,track=prototype.track;let stopped=false;
  prototype.track=async function(file:string){const result=await track.call(this,file);if(!stopped&&this.dir===f.app.dir&&path.resolve(file)===f.index&&this.tx.data.kind==='activate'){this.activationSource.adoptPublishedIndex=async()=>{stopped=true;throw new LabError('INJECTED_FAILURE','Fixture interruption with known B before the recovery race.');};}return result;};
  try{await assert.rejects(f.app.on('a'),{code:'INJECTED_FAILURE'});}finally{prototype.track=track;}
  const pending=await listTransactions(f.app.dir);assert.equal(pending.length,1);const plan=pending[0].recovery.files.find((entry:any)=>entry.path===f.index);assert(plan?.backup&&pending[0].recovery.activationIndexPublication);
  const journal=path.join(f.app.dir,'transactions',pending[0].id,'journal.json'),journalBytes=fs.readFileSync(journal),backup=fs.readFileSync(plan.backup),refs=f.native(['for-each-ref','--format=%(refname) %(objectname)']);
  const open=fs.promises.open;let restoring=false,injected=false,foreign:Buffer|undefined,identity:fs.BigIntStats|undefined;
  (fs.promises as any).open=async function(file:any,...args:any[]){const handle=await(open as any)(file,...args),resolved=path.resolve(String(file));if(resolved.startsWith(f.index+'.recovery-'))restoring=true;
    if(restoring&&!injected&&resolved===plan.backup){const read=handle.read.bind(handle);handle.read=async function(...values:any[]){const result=await read(...values);if(result.bytesRead&&!injected){
      const original=fs.statSync(f.index,{bigint:true});foreign=fs.readFileSync(f.index);
      if(change==='native-lock')fs.writeFileSync(f.index+'.lock','late native writer lock\n',{flag:'wx'});
      else if(change==='replacement'){const replacement=path.join(f.owned.root,'foreign-B-during-recovery.index');fs.writeFileSync(replacement,foreign,{flag:'wx'});const fd=fs.openSync(replacement,'r+');try{fs.futimesSync(fd,new Date(),Number(original.mtimeNs)/1e9+60);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(replacement,f.index);}
      else{const fd=fs.openSync(f.index,'r+');try{fs.futimesSync(fd,new Date(),Number(original.mtimeNs)/1e9+60);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
      identity=fs.statSync(f.index,{bigint:true});injected=true;if(change==='replacement')assert.notEqual(identity.ino,original.ino);if(change==='timestamp')assert(identity.mtimeNs>original.mtimeNs);
    }return result;};}return handle;};syncBuiltinESMExports();
  const rejected=(error:any)=>change==='native-lock'?error.code==='LOCKED':error.code==='RECOVERY_CONFLICT'&&error.details?.reason==='activation-index-identity-changed';
  const reopened=await GitLayers.open(f.repo);try{await assert.rejects(reopened.recover(),rejected);}finally{fs.promises.open=open;syncBuiltinESMExports();}
  assert(injected&&foreign&&identity);
  for(let repeat=0;repeat<2;repeat++){
    assert(fs.readFileSync(f.index).equals(foreign));const current=fs.statSync(f.index,{bigint:true});assert.equal(current.ino,identity.ino);assert.equal(current.mtimeNs,identity.mtimeNs);assert(fs.readFileSync(journal).equals(journalBytes));assert(fs.readFileSync(plan.backup).equals(backup));
    assert.equal(f.native(['show',':layer.txt'],f.index),f.B.text.trimEnd());assert.equal(f.native(['show',':layer.txt'],plan.backup),f.A.text.trimEnd());assert.equal(f.native(['for-each-ref','--format=%(refname) %(objectname)']),refs);f.unchangedMain();
    if(change==='native-lock')assert.equal(fs.readFileSync(f.index+'.lock','utf8'),'late native writer lock\n');await assert.rejects(reopened.recover(),rejected);
  }
  assert.equal(fs.existsSync(f.target),false);assert.equal((await listTransactions(f.app.dir)).length,1);f.success();
});

for(const automatic of [false,true])test((automatic?'automatic rollback':'explicit recovery')+' preserves a late MAIN index lock during metadata restoration',budget,async t=>{
  const f=await fixture(t),internal=f.app as any,workspace=path.join(f.app.dir,'workspace.json'),beforeWorkspace=fs.readFileSync(workspace),value={...internal.workspace,baseReservations:[]},afterWorkspace=Buffer.from(JSON.stringify(value,null,2)+'\n');
  const open=fs.promises.open;let restoring=false,injected=false,backupPath:string|undefined;
  const install=()=>{(fs.promises as any).open=async function(file:any,...args:any[]){const handle=await(open as any)(file,...args),resolved=path.resolve(String(file));if(resolved.startsWith(workspace+'.recovery-'))restoring=true;
    if(restoring&&!injected&&resolved.includes(path.sep+'backups'+path.sep)){const read=handle.read.bind(handle);handle.read=async function(...values:any[]){const result=await read(...values);if(result.bytesRead&&!injected){backupPath=resolved;fs.writeFileSync(f.app.repo.index+'.lock','late MAIN native writer lock\n',{flag:'wx'});injected=true;}return result;};}return handle;};syncBuiltinESMExports();};
  const restore=()=>{fs.promises.open=open;syncBuiltinESMExports();};
  if(automatic)install();
  try{await assert.rejects(internal.mutate('metadata-recovery-lock-fixture',async()=>{await internal.writeJSON(workspace,value);throw automatic?Object.assign(new Error('fixture ordinary failure requiring rollback'),{code:'EIO'}):new LabError('INJECTED_FAILURE','Fixture pending metadata restoration.');},true,{reconcile:false}),{code:automatic?'EIO':'INJECTED_FAILURE'});}finally{if(automatic)restore();}
  if(!automatic){install();try{await assert.rejects((await GitLayers.open(f.repo)).recover(),{code:'LOCKED'});}finally{restore();}}
  assert(injected&&backupPath);assert(fs.readFileSync(backupPath).equals(beforeWorkspace));const pending=await listTransactions(f.app.dir);assert.equal(pending.length,1);const journal=path.join(f.app.dir,'transactions',pending[0].id,'journal.json'),bytes=fs.readFileSync(journal);
  for(let repeat=0;repeat<2;repeat++){
    assert(fs.readFileSync(workspace).equals(afterWorkspace),'Known AFTER metadata must not be published over while a relevant index lock is present');assert(fs.readFileSync(journal).equals(bytes));assert(fs.readFileSync(backupPath).equals(beforeWorkspace));assert.equal(fs.readFileSync(f.app.repo.index+'.lock','utf8'),'late MAIN native writer lock\n');assert(fs.readFileSync(f.index).equals(f.before.index));assert.equal(f.native(['for-each-ref','--format=%(refname) %(objectname)']),f.before.refs);f.unchangedMain();await assert.rejects((await GitLayers.open(f.repo)).recover(),{code:'LOCKED'});
  }
  f.success();
});
