import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const trim=r=>r.stdout.trim();
const source=name=>`https://github.com/git/git/blob/v2.53.0/Documentation/${name}.adoc`;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blocked=reason=>({execution_status:'ENV_BLOCKED',nonexecution_reason:reason});
function owned(c,...parts){const p=path.resolve(c.root,...parts),r=path.relative(c.root,p);if(!r||r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw Error('Coverage case escaped owned fixture');return p;}
function write(c,p,bytes){p=owned(c,path.relative(c.root,p));fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);return p;}
const oid=async(c,ref='HEAD',cwd=c.repo)=>trim(await c.git(['rev-parse',ref],{cwd}));
const idx=async(c,cwd=c.repo,env={})=>(await c.git(['ls-files','--stage','-z'],{cwd,env})).stdout;
const refs=async(c,cwd=c.repo)=>(await c.git(['for-each-ref','--format=%(refname) %(objectname)'],{cwd})).stdout;
function spec(id,title,run,options={}){return {id,variant:options.variant??'coverage-gaps',title,profile:options.profile??'N0',tier:'broad',phase:options.phase??'NATIVE_BASELINE',productStatus:options.productStatus??'NOT_ASSESSED',capabilities:[],timeout:120000,async run(c){await c.init();await c.snapshot('coverage-before');const result=await run(c);await c.snapshot('coverage-after');return result;}};}

async function semanticState(c,cwd){
  const graphIds=trim(await c.git(['rev-list','--parents','HEAD'],{cwd})).split('\n').map(s=>s.split(' ')),byOid=new Map();
  for(const [id] of graphIds){const text=(await c.git(['cat-file','commit',id],{cwd})).stdout;byOid.set(id,text.slice(text.indexOf('\n\n')+2).trim());}
  const graph=graphIds.map(([id,...parents])=>({subject:byOid.get(id),parents:parents.map(p=>byOid.get(p))})).sort((a,b)=>a.subject.localeCompare(b.subject));
  const entries=async(args,re)=>{const raw=(await c.git(args,{cwd})).stdout,output=[];for(const record of raw.split('\0').filter(Boolean)){const m=record.match(re);if(!m)throw Error('Unexpected semantic index/tree record');output.push({mode:m[1],path:m[3],content_base64:(await c.git(['cat-file','blob',m[2]],{cwd})).stdoutBuffer.toString('base64')});}return output.sort((a,b)=>a.path.localeCompare(b.path));};
  const tree=await entries(['ls-tree','-rz','HEAD'],/^(\d+) blob ([0-9a-f]+)\t([\s\S]+)$/u);
  const index=await entries(['ls-files','--stage','-z'],/^(\d+) ([0-9a-f]+) 0\t([\s\S]+)$/u);
  const branchNames=(await c.git(['for-each-ref','--format=%(refname)','refs/heads/'],{cwd})).stdout.trim().split('\n').sort();
  const disk=['base.txt','main.txt','topic.txt'].map(p=>({path:p,content_base64:fs.readFileSync(path.join(cwd,p)).toString('base64')}));
  return {graph,tree,index,branchNames,disk,head:trim(await c.git(['symbolic-ref','HEAD'],{cwd}))};
}
async function sequence(c,cwd,hash,backend){
  const probe=await c.git(['init',`--object-format=${hash}`,`--ref-format=${backend}`,'-b','main',cwd],{ok:[0,128,129]});
  if(probe.code!==0){if(/unknown hash|unknown ref storage|unknown option|unsupported.*(?:format|hash)|unknown ref format/iu.test(probe.stderr))return blocked(`Native Git init rejected requested object/ref format ${hash}/${backend}: ${probe.stderr.trim()}`);throw Error(`Unexpected format fixture initialization failure: ${probe.stderr}`);}
  for(const [key,value] of [['core.autocrlf','false'],['commit.gpgsign','false'],['tag.gpgsign','false']])await c.git(['config',key,value],{cwd});
  const commit=async(file,bytes,msg)=>{write(c,path.join(cwd,file),bytes);await c.git(['add','--',file],{cwd});await c.git(['commit','-m',msg],{cwd});};
  await commit('base.txt','base one\n','root');await c.git(['switch','-c','topic'],{cwd});await commit('topic.txt','topic one\n','topic');await c.git(['switch','main'],{cwd});await commit('main.txt','main one\n','main');await c.git(['merge','--no-ff','-m','merge','topic'],{cwd});
  write(c,path.join(cwd,'base.txt'),'stage B\n');await c.git(['add','--','base.txt'],{cwd});write(c,path.join(cwd,'base.txt'),'worktree C\n');await c.git(['update-index','--chmod=+x','main.txt'],{cwd});
  c.eq(`Selected ${hash}/${backend} object format`,trim(await c.git(['rev-parse','--show-object-format'],{cwd})),hash,source('git-init'));
  c.eq(`Selected ${hash}/${backend} ref format`,trim(await c.git(['rev-parse','--show-ref-format'],{cwd})),backend,source('git-init'));
  await c.git(['fsck','--full','--no-dangling'],{cwd});return semanticState(c,cwd);
}

export const cases=[
  spec('HOOK-011','SSH signed tag verifies and mandatory unavailable tag signer refuses without unsigned tag fallback',async c=>{
    const keygen=path.resolve(path.dirname(c.gitPath),'../usr/bin/ssh-keygen.exe');if(!fs.existsSync(keygen)){c.ok('Known official ssh-keygen path absent',!fs.existsSync(keygen));return blocked('Official Git-distribution ssh-keygen is unavailable at its explicit path; no personal signer/keyring is used.');}
    const key=owned(c,'tag-key'),allowed=owned(c,'tag-allowed-signers');await c.run(keygen,['-q','-t','ed25519','-N','','-C','synthetic-tag@example.invalid','-f',key]);write(c,allowed,`validation@example.invalid ${fs.readFileSync(key+'.pub','utf8').trim()}\n`);
    const config=['-c','gpg.format=ssh','-c',`gpg.ssh.program=${keygen}`,'-c',`user.signingkey=${key}`],before={head:await oid(c),index:await idx(c)};
    await c.git([...config,'tag','-s','-m','synthetic signed tag','signed-fixture']);const tag=await oid(c,'refs/tags/signed-fixture');
    c.eq('Signed ref is annotated tag object',trim(await c.git(['cat-file','-t',tag])),'tag',source('git-tag'));c.ok('Tag object has actual SSH signature',(await c.git(['cat-file','tag',tag])).stdout.includes('BEGIN SSH SIGNATURE'));
    await c.git(['-c','gpg.format=ssh','-c',`gpg.ssh.program=${keygen}`,'-c',`gpg.ssh.allowedSignersFile=${allowed}`,'verify-tag','signed-fixture']);
    c.eq('Verified signed tag peels to original commit',await oid(c,'signed-fixture^{}'),before.head);
    const frozen=await refs(c),failed=await c.git(['-c','gpg.format=ssh','-c',`gpg.ssh.program=${keygen}`,'-c',`user.signingkey=${owned(c,'absent-tag-key')}`,'-c','tag.gpgsign=true','tag','-m','required signer unavailable','blocked-fixture'],{ok:[1,128]});
    c.ok('Missing mandatory tag signer returns failure',failed.code!==0,true,failed.code);c.eq('Failure does not publish unsigned tag or modify refs',await refs(c),frozen);c.eq('Signing does not move HEAD',await oid(c),before.head);c.eq('Tag signing leaves semantic index intact',await idx(c),before.index);
    return {limits:['SSH annotated tag signing/verification and mandatory failure only. GPG/X.509, trust policy, key expiration/revocation and product tag management are not certified. Keys remain solely in disposable fixture outside the repository, never evidence exports.']};
  }),
  spec('WORKTREE-002','Current public CLI refuses Layer activation in multiple/linked worktrees and retains owned repository state',async c=>{
    await c.layer();const linked=owned(c,'linked-worktree');await c.git(['worktree','add','-b','linked-fixture',linked,'main']);
    const registry=c.read('.git/layers/registry.json'),layer=JSON.parse(registry).layers.find(l=>l.name==='tools'),layerIndex=path.join(c.repo,'.git','layers','indexes',layer.id+'.index');
    const before={head:await oid(c),refs:await refs(c),index:await idx(c),layerIndex:await idx(c,c.repo,{GIT_INDEX_FILE:layerIndex}),base:c.read('base.txt'),layer:c.read('layer.txt'),registry,exclude:sha(fs.readFileSync(path.join(c.repo,'.git','info','exclude'))),linkedHead:await oid(c,'HEAD',linked),linkedIndex:await idx(c,linked),linkedBase:fs.readFileSync(path.join(linked,'base.txt'),'utf8')};
    const main=await c.cli(['on','tools'],{ok:[3]}),other=await c.run(process.execPath,[path.join(c.buildDir,'cli.mjs'),'--cwd',linked,'--json','on','tools'],{cwd:linked,ok:[3]});
    c.eq('Main checkout rejects mutation while another worktree exists',JSON.parse(main.stderr).error.code,'MULTIPLE_WORKTREES','src/core/git.ts assertSupported');c.eq('Linked checkout refuses before metadata/layer mutation',JSON.parse(other.stderr).error.code,'LINKED_WORKTREE','src/core/git.ts assertSupported');
    c.eq('HEAD unchanged after both refusals',await oid(c),before.head);c.eq('All refs including Layer and linked branch retained',await refs(c),before.refs);c.eq('Base stage retained',await idx(c),before.index);c.eq('Layer stage retained',await idx(c,c.repo,{GIT_INDEX_FILE:layerIndex}),before.layerIndex);c.eq('Layer registry unchanged',c.read('.git/layers/registry.json'),before.registry);c.eq('Exclude rules unchanged',sha(fs.readFileSync(path.join(c.repo,'.git','info','exclude'))),before.exclude);c.eq('Main base bytes retained',c.read('base.txt'),before.base);c.eq('Main projected Layer bytes retained',c.read('layer.txt'),before.layer);
    c.eq('Linked HEAD retained',await oid(c,'HEAD',linked),before.linkedHead);c.eq('Linked base stage retained',await idx(c,linked),before.linkedIndex);c.eq('Linked base bytes retained',fs.readFileSync(path.join(linked,'base.txt'),'utf8'),before.linkedBase);c.eq('Layer was not silently projected in linked worktree',fs.existsSync(path.join(linked,'layer.txt')),false);
    return {productStatus:'DOCUMENTED_RESTRICTION',limits:['Characterizes current MULTIPLE_WORKTREES/LINKED_WORKTREE refusal, not simultaneous Layer activation/staging support or the desired independent projection contract. Mutate can create an empty owned lock directory before refusing; this case does not claim zero filesystem effects. No existing worktree was opened or removed.']};
  },{profile:'L1',phase:'CURRENT_PRODUCT',productStatus:'DOCUMENTED_RESTRICTION'}),
  spec('OBJECT-011','diff-pairs consumes native full-OID NUL raw records and emits actual content/mode patches',async c=>{
    const available=(await c.git(['--list-cmds=builtins'])).stdout.split(/\s+/u).includes('diff-pairs');if(!available){c.eq('Native builtin inventory establishes absent diff-pairs',available,false);return blocked('Effective official Git builtin inventory does not include diff-pairs; no patch operation was certified.');}
    const a=trim(await c.git(['hash-object','-w','--stdin'],{stdin:'a\nb\n'})),b=trim(await c.git(['hash-object','-w','--stdin'],{stdin:'a\nB\n'})),before={head:await oid(c),index:await idx(c),refs:await refs(c)};
    const input=`:100644 100644 ${a} ${b} M\0file with spaces.txt\0:100644 100755 ${a} ${a} M\0mode-only.txt\0`;
    const patch=(await c.git(['diff-pairs','-z','--no-color','--no-ext-diff','--full-index'],{stdin:input})).stdout;
    c.ok('Content pair produces known patch bytes',patch.includes('-b\n+B\n'),true,patch,source('git-diff-pairs'));c.ok('Spaced raw pathname reaches patch output',patch.includes('file with spaces.txt'));c.ok('Mode-only blob pair emits both native modes',patch.includes('old mode 100644\nnew mode 100755'),true,patch);
    c.eq('diff-pairs leaves HEAD',await oid(c),before.head);c.eq('diff-pairs leaves stage',await idx(c),before.index);c.eq('diff-pairs leaves refs',await refs(c),before.refs);
    return {limits:['Functional native content/mode pairs using complete object IDs. Rename/copy batches, forced flush delimiters, malformed input, tree-object rejection and product invocation are not covered by this variant. Builtin inventory alone never produces PASS.']};
  }),
  ...['sha1','sha256'].flatMap(hash=>['files','reftable'].map(backend=>spec('MODEL-010',`Native semantic sequence matches SHA-1/files under ${hash}/${backend}`,async c=>{
    const baseline=await sequence(c,owned(c,'model-baseline'),'sha1','files');if(baseline.execution_status)return baseline;
    const target=await sequence(c,owned(c,'model-target'),hash,backend);if(target.execution_status)return target;
    c.eq('Normalized graph, ordered parents, trees, blobs, index modes, refs and disk bytes match',target,baseline,'Native Git object/ref-format semantics; v2 MODEL-010');
    c.eq('Expected four-commit parent topology',target.graph,[{subject:'main',parents:['root']},{subject:'merge',parents:['main','topic']},{subject:'root',parents:[]},{subject:'topic',parents:['root']}]);
    c.eq('Three-state stage B is retained',Buffer.from(target.index.find(e=>e.path==='base.txt').content_base64,'base64').toString(),'stage B\n');c.eq('Three-state disk C is retained',Buffer.from(target.disk.find(e=>e.path==='base.txt').content_base64,'base64').toString(),'worktree C\n');c.eq('Explicit executable index mode retained',target.index.find(e=>e.path==='main.txt').mode,'100755');
    return {limits:['One installed official Git version and ordinary native repositories only. SHA-1/files is the control; raw OIDs are deliberately not compared across hashes. Index executable bit is semantic metadata, not a Windows filesystem executable-permission claim. Actual Layers, linked worktrees, bare/partial/shallow/object-alternate repositories and multiple Git versions remain separate coverage.']};
  },{variant:`coverage-gaps-${hash}-${backend}`})))
];
