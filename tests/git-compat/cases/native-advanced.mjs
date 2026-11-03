import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Native characterization only. Per-case limits remain visible; N0 never
// certifies the Core/CLI or profiles with actual Layers.
const source = name => `https://github.com/git/git/blob/v2.53.0/Documentation/${name}.adoc`;
const trim = r => r.stdout.trim();
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function inside(c, ...parts) {
  const p = path.resolve(c.root, ...parts), rel = path.relative(c.root, p);
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw Error('Advanced native fixture path escaped');
  return p;
}
function write(c, p, bytes) { const dest = inside(c, path.relative(c.root, p)); fs.mkdirSync(path.dirname(dest), {recursive:true}); fs.writeFileSync(dest, bytes); return dest; }
const shell = value => "'" + String(value).replaceAll('\\','/').replaceAll("'", "'\\''") + "'";
const nodeCommand = (script, ...args) => [process.execPath,script,...args].map(shell).join(' ');
const index = async(c, cwd=c.repo) => (await c.git(['ls-files','--stage','-z'],{cwd})).stdout;
const refs = async(c,cwd=c.repo) => (await c.git(['for-each-ref','--format=%(refname) %(objectname)'],{cwd})).stdout;
const oid = async(c, rev='HEAD',cwd=c.repo) => trim(await c.git(['rev-parse',rev],{cwd}));
const blocked = (reason, limits=[]) => ({execution_status:'ENV_BLOCKED',nonexecution_reason:reason,limits});
async function commit(c,file,bytes,message=file,cwd=c.repo) {
  write(c,path.join(cwd,file),bytes); await c.git(['add','--',file],{cwd}); await c.git(['commit','-m',message],{cwd}); return oid(c,'HEAD',cwd);
}
async function conflict(c) {
  await c.git(['switch','-c','other']); await commit(c,'base.txt','theirs\n');
  await c.git(['switch','main']); await commit(c,'base.txt','ours\n');
  await c.git(['merge','--no-edit','other'],{ok:[1]});
  c.ok('Setup has real unresolved stages', / [123]\tbase\.txt\0/u.test(await index(c)),true,await index(c));
}
function native(id,title,run,{variant='native-advanced',limits=[],timeout=60000}={}) {
  return {id,variant,title,profile:'N0',tier:'broad',phase:'NATIVE_BASELINE',productStatus:'NOT_ASSESSED',capabilities:[],timeout,
    async run(c){await c.init();await c.snapshot('advanced-native-before');const outcome=await run(c);await c.snapshot('advanced-native-after');return {...outcome,limits:[...limits,...(outcome?.limits??[])]};}};
}

export const cases = [
  native('ENV-002','Official external subcommand dispatch and alias precedence use fixture scripts only',async c=>{
    const bin=inside(c,'synthetic-bin');fs.mkdirSync(bin);
    const launcher=write(c,path.join(bin,'git-layer'),'#!/bin/sh\nprintf "fixture-launcher:%s\\n" "$1"\n');fs.chmodSync(launcher,0o755);
    const env={...c.env,PATH:bin+path.delimiter+c.env.PATH};
    const before={head:await oid(c),index:await index(c),refs:await refs(c)};
    await c.git(['config','alias.layer','!f() { printf "fixture-alias:%s\\n" "$1"; }; f']);
    c.eq('Existing known external command takes precedence over homonymous alias', (await c.git(['layer','argument with spaces'],{env})).stdout,'fixture-launcher:argument with spaces\n','https://github.com/git/git/blob/v2.53.0/git.c');
    const disabled=inside(c,'disabled-synthetic-launcher');fs.renameSync(launcher,disabled);
    try {c.eq('Known alias is used when external command is absent',(await c.git(['layer','argument with spaces'],{env})).stdout,'fixture-alias:argument with spaces\n',source('git'));}
    finally {fs.renameSync(disabled,launcher);}
    await c.git(['config','--unset','alias.layer']);
    c.eq('Known synthetic external subcommand receives exact argument',(await c.git(['layer','argument with spaces'],{env})).stdout,'fixture-launcher:argument with spaces\n',source('git'));
    c.eq('Dispatch did not change HEAD',await oid(c),before.head);c.eq('Dispatch did not change index',await index(c),before.index);c.eq('Dispatch did not change refs',await refs(c),before.refs);
    return {limits:['Synthetic git-layer proves official dispatcher resolution, not compatibility with another application or execution of the GitLayer product CLI. Builtin switch/checkout are not intercepted.']};
  }),
  native('ENV-009','Native safe.directory rejection uses upstream owner-assumption test facility in isolated configuration',async c=>{
    const env={...c.env,GIT_TEST_ASSUME_DIFFERENT_OWNER:'1'};
    const probe=await c.git(['status','--porcelain=v1'],{env,ok:[0,128]});
    if(probe.code===0){c.eq('Owner-assumption capability not effective',probe.code,0);return blocked('GIT_TEST_ASSUME_DIFFERENT_OWNER did not trigger native trust validation; actual foreign ownership cannot be changed safely here.');}
    c.eq('Native ownership rejection code',probe.code,128,'https://github.com/git/git/blob/v2.53.0/t/t0033-safe-directory.sh');
    c.ok('Native trust rejection identified',probe.stderr.includes('dubious ownership'),true,probe.stderr);
    await c.git(['config','--local','safe.directory',c.repo]);
    c.eq('Untrusted repository cannot whitelist itself',(await c.git(['status','--porcelain=v1'],{env,ok:[128]})).code,128);
    const globalBefore=fs.readFileSync(c.env.GIT_CONFIG_GLOBAL);
    try {await c.git(['config','--file',c.env.GIT_CONFIG_GLOBAL,'--add','safe.directory',c.repo]);c.eq('Protected synthetic config can approve exact path',(await c.git(['status','--porcelain=v1'],{env})).stdout,'');}
    finally {fs.writeFileSync(c.env.GIT_CONFIG_GLOBAL,globalBefore);}
    c.eq('Fixture global config restored byte-for-byte',sha(fs.readFileSync(c.env.GIT_CONFIG_GLOBAL)),sha(globalBefore));
    return {limits:['Uses the official upstream test environment facility inside the real Git binary; does not prove real Windows ownership/ACL transitions. No user/global configuration was changed.']};
  }),
  native('ENV-012','Unknown repository extension is rejected without resetting tracked state',async c=>{
    const config=path.join(c.repo,'.git','config'),original=fs.readFileSync(config),before={head:await oid(c),index:await index(c),bytes:c.read('base.txt')};
    try {await c.git(['config','core.repositoryformatversion','1']);await c.git(['config','extensions.compatfixtureunknown','true']);const r=await c.git(['status','--porcelain=v1'],{ok:[128]});c.eq('Unknown extension rejects normal Git use',r.code,128,source('gitrepository-layout'));c.ok('Error identifies repository extension',r.stderr.includes('compatfixtureunknown'),true,r.stderr);c.eq('Tracked disk bytes preserved',c.read('base.txt'),before.bytes);}
    finally {fs.writeFileSync(config,original);}
    c.eq('Restored repository retains HEAD',await oid(c),before.head);c.eq('Unknown extension did not reset index',await index(c),before.index);
    return {limits:['This variant exercises unknown-extension refusal in SHA-1/files; hash/backend cross-product belongs to other capability variants. It does not add extensions.layers or migrate product storage.']};
  }),
  native('ENV-014','Native configuration writes remain confined while exterior fixture sentinels stay byte-identical',async c=>{
    const exterior=inside(c,'exterior-sentinel');fs.mkdirSync(exterior);const sentinel=write(c,path.join(exterior,'.gitconfig'),'[compat]\n sentinel = exterior\n');const credential=write(c,path.join(exterior,'.git-credentials'),'synthetic exterior sentinel; never load\n');
    const before=[sha(fs.readFileSync(sentinel)),sha(fs.readFileSync(credential))];
    await c.git(['config','--global','compat.fixture','isolated-only']);
    c.eq('Global write is the explicitly selected fixture file',trim(await c.git(['config','--file',c.env.GIT_CONFIG_GLOBAL,'compat.fixture'])),'isolated-only');
    const origin=(await c.git(['config','--global','--show-origin','-z','--get','compat.fixture'])).stdout;
    c.ok('Config origin points at synthetic HOME',origin.replaceAll('\\','/').includes(c.env.GIT_CONFIG_GLOBAL.replaceAll('\\','/')),true,origin);
    c.eq('Exterior sentinel config unchanged',sha(fs.readFileSync(sentinel)),before[0]);c.eq('Exterior sentinel credentials unchanged',sha(fs.readFileSync(credential)),before[1]);
    c.ok('Credential default was not created',!fs.existsSync(path.join(c.env.HOME,'.git-credentials')));
    return {limits:['Exterior means outside the target repository but inside this owned fixture group. Personal configuration contents were neither read nor collected. Product-internal removal of GIT_* remains a separate documented limit.']};
  }),
  native('INIT-012','Native repository can be reopened while moved to an owned path with spaces',async c=>{
    const original=inside(c,path.relative(c.root,c.repo)),moved=inside(c,'moved repository with spaces'),before={head:await oid(c),refs:await refs(c),index:await index(c),bytes:c.read('base.txt')};
    fs.renameSync(original,moved);
    try {c.eq('Moved Git discovers the new worktree',path.resolve(trim(await c.git(['rev-parse','--show-toplevel'],{cwd:moved}))),moved);c.eq('Moved HEAD retained',await oid(c,'HEAD',moved),before.head);c.eq('Moved refs retained',await refs(c,moved),before.refs);c.eq('Moved index semantic entries retained',await index(c,moved),before.index);c.eq('Moved tracked file retained',fs.readFileSync(path.join(moved,'base.txt'),'utf8'),before.bytes);}
    finally {fs.renameSync(moved,original);}
    return {limits:['Native N0 relocation only. No actual Layer metadata or recovery paths were created, so private absolute-path portability is not certified. Fixture is moved back solely for the runner snapshot/cleanup contract.']};
  }),
  native('INDEX-009','git add -e stages the edited patch and refuses an invalid patch without full-file fallback',async c=>{
    await commit(c,'patch.txt','one\nkeep\n');c.write('patch.txt','ONE\nkeep\nextra\n');
    const valid=write(c,inside(c,'valid-editor.cjs'),`const fs=require('node:fs');const p=process.argv[2];fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/^\\+extra\\n/m,''));\n`);
    await c.git(['add','-e','--','patch.txt'],{env:{GIT_EDITOR:nodeCommand(valid)}});
    c.eq('Only retained patch hunk staged',(await c.git(['show',':patch.txt'])).stdout,'ONE\nkeep\n',source('git-add'));
    c.eq('Disk retains later extra line',c.read('patch.txt'),'ONE\nkeep\nextra\n');const before=await index(c);
    const invalid=write(c,inside(c,'invalid-editor.cjs'),`require('node:fs').writeFileSync(process.argv[2],'diff --git a/patch.txt b/patch.txt\\n--- a/patch.txt\\n+++ b/patch.txt\\n@@ -99,1 +99,1 @@\\n-missing\\n+broken\\n');\n`);
    const r=await c.git(['add','-e','--','patch.txt'],{env:{GIT_EDITOR:nodeCommand(invalid)},ok:[1,128]});
    c.ok('Invalid patch is refused',r.code!==0,true,r.code);c.eq('Refusal retains previous stage',await index(c),before);c.eq('No fallback full-file stage',(await c.git(['show',':patch.txt'])).stdout,'ONE\nkeep\n');c.eq('Invalid edit keeps disk bytes',c.read('patch.txt'),'ONE\nkeep\nextra\n');
    return {limits:['Synthetic GIT_EDITOR is a known Node script, not the laboratory/editor GUI. This proves add -e; it does not stand in for PTY-driven add -p.']};
  }),
  native('INDEX-018','git add --resolved is exercised only when the effective parser advertises the option',async c=>{
    const h=await c.git(['add','-h'],{ok:[129]});
    if(!h.stdout.includes('--resolved')&&!h.stderr.includes('--resolved')){c.ok('Probe output for absent option retained',h.code===129);return blocked('Effective Git add -h does not advertise --resolved; the resolved-staging operation was not executed.');}
    await conflict(c);c.write('unrelated.txt','not staged\n');c.write('base.txt','resolved\n');await c.git(['add','--resolved']);
    c.eq('Resolved path becomes stage zero',(await c.git(['show',':base.txt'])).stdout,'resolved\n');c.eq('No unresolved stages remain',(await c.git(['ls-files','--unmerged'])).stdout,'');c.eq('Unrelated new file remains unstaged',(await c.git(['ls-files','--error-unmatch','unrelated.txt'],{ok:[1]})).code,1);
  }),
  native('COMMIT-011','SSH signing uses ephemeral fixture keys and refuses an unavailable mandatory signer',async c=>{
    const keygen=path.resolve(path.dirname(c.gitPath),'../usr/bin/ssh-keygen.exe');
    if(!fs.existsSync(keygen)){c.ok('Known Git-distribution keygen path absent',!fs.existsSync(keygen));return blocked('No ssh-keygen at the known Git-distribution path; no unknown PATH signer or personal key is used.');}
    const key=inside(c,'synthetic-signing-key');await c.run(keygen,['-q','-t','ed25519','-N','','-C','synthetic@example.invalid','-f',key]);
    const pub=fs.readFileSync(key+'.pub','utf8').trim(),allowed=write(c,inside(c,'allowed-signers'),`validation@example.invalid ${pub}\n`);
    c.write('signed.txt','signed fixture\n');await c.git(['add','--','signed.txt']);
    const settings=['-c','gpg.format=ssh','-c',`gpg.ssh.program=${keygen}`,'-c',`user.signingkey=${key}`];
    await c.git([...settings,'commit','-S','-m','Synthetic signed commit']);const signed=await oid(c);
    c.ok('Commit object contains SSH signature',(await c.git(['cat-file','commit',signed])).stdout.includes('BEGIN SSH SIGNATURE'));
    await c.git(['-c','gpg.format=ssh','-c',`gpg.ssh.program=${keygen}`,'-c',`gpg.ssh.allowedSignersFile=${allowed}`,'verify-commit',signed]);
    c.write('blocked-signature.txt','must remain staged\n');await c.git(['add','--','blocked-signature.txt']);const before=await index(c);
    const r=await c.git(['-c','gpg.format=ssh','-c',`gpg.ssh.program=${keygen}`,'-c',`user.signingkey=${inside(c,'missing-key')}`,'-c','commit.gpgsign=true','commit','-m','must fail'],{ok:[1,128]});
    c.ok('Required signature failure is nonzero',r.code!==0,true,r.code);c.eq('Signing failure does not create unsigned commit',await oid(c),signed);c.eq('Signing failure retains staged content',await index(c),before);
    return {limits:['SSH signature path only, not GPG/X.509 or personal keyring policy. Private/public keys are fixture-only and removed with cleanup; evidence exports no private key file.']};
  }),
  native('BRANCH-015','Collective delete-merged option is capability-gated',async c=>{
    const h=await c.git(['branch','-h'],{ok:[129]});
    if(!`${h.stdout}\n${h.stderr}`.includes('--delete-merged')){c.eq('Branch capability help probe recorded',h.code,129);return blocked('Effective Git branch does not advertise --delete-merged; no deletion operation was certified.');}
    await c.git(['branch','merged-fixture']);await c.git(['switch','-c','unmerged-fixture']);await commit(c,'unmerged.txt','keep\n');await c.git(['switch','main']);const before=await oid(c);
    await c.git(['branch','--delete-merged']);c.eq('Merged branch removed',(await c.git(['show-ref','--verify','--quiet','refs/heads/merged-fixture'],{ok:[1]})).code,1);c.eq('Current branch protected',await oid(c),before);c.eq('Unmerged branch retained',(await c.git(['show-ref','--verify','--quiet','refs/heads/unmerged-fixture'])).code,0);
  }),
  native('REWRITE-014','Replay prints a native update plan before explicit application and supports atomic ref updates',async c=>{
    const base=await oid(c);await c.git(['switch','-c','topic']);const old=await commit(c,'topic.txt','topic\n');await c.git(['switch','main']);const target=await commit(c,'target.txt','target\n');const beforeIndex=await index(c),beforeBytes=c.read('base.txt');
    const plan=await c.git(['replay','--ref-action=print','--onto','main',`${base}..topic`],{ok:[0,129]});
    if(plan.code===129){c.eq('Replay print mode not accepted',plan.code,129);return blocked('Effective Git replay rejected --ref-action=print; no fallback syntax or invented replay implementation was used.');}
    const rows=plan.stdout.trim().split(/\r?\n/u).filter(Boolean);c.eq('Exactly one explicit ref update',rows.length,1);const parsed=rows[0].split(' ');c.eq('Plan action and branch',parsed.slice(0,2),['update','refs/heads/topic']);c.eq('Plan validates old branch OID',parsed[3],old);c.eq('Plan-only leaves ref unchanged',await oid(c,'topic'),old);
    await c.git(['update-ref','--stdin'],{stdin:plan.stdout});const rewritten=await oid(c,'topic');c.eq('Applied ref is planned object',rewritten,parsed[2]);c.eq('Replayed parent is new base',await oid(c,'topic^'),target);c.eq('Replayed topic bytes',(await c.git(['show','topic:topic.txt'])).stdout,'topic\n');c.eq('New base bytes in replayed tree',(await c.git(['show','topic:target.txt'])).stdout,'target\n');
    await c.git(['branch','topic-automatic',old]);await c.git(['replay','--onto','main',`${base}..topic-automatic`]);c.eq('Native default update reaches replayed object',await oid(c,'topic-automatic'),rewritten);
    c.eq('Replay leaves checked-out HEAD on main',await oid(c),target);c.eq('Replay keeps working index',await index(c),beforeIndex);c.eq('Replay keeps disk bytes',c.read('base.txt'),beforeBytes);
    return {limits:['Non-conflicted single-commit replay; experimental syntax verified against the installed manual. No merge/conflict or Layer compatibility inferred.']};
  }),
  native('REWRITE-015','History drop is run only when the actual official builtin exists',async c=>{
    const builtins=(await c.git(['--list-cmds=builtins'])).stdout.split(/\r?\n/u);
    if(!builtins.includes('history')){c.ok('Builtin absence independently observed',!builtins.includes('history'));return blocked('Official history builtin absent from effective Git --list-cmds=builtins; no external git-history was launched.');}
    const root=await oid(c);await commit(c,'dropped.txt','drop\n');const dropped=await oid(c);await commit(c,'kept.txt','keep\n');
    await c.git(['history','drop',dropped]);c.eq('History drop leaves two commits',trim(await c.git(['rev-list','--count','HEAD'])),'2');c.eq('Root retained as parent',await oid(c,'HEAD^'),root);c.eq('Dropped content absent',(await c.git(['ls-tree','-r','--name-only','HEAD'])).stdout.includes('dropped.txt'),false);c.eq('Descendant content retained',(await c.git(['show','HEAD:kept.txt'])).stdout,'keep\n');
    return {limits:['Experimental upstream command; tested drop only if installed. Other history subcommands are not certified by this variant.']};
  }),
  native('STASH-009','Native stash export/import through a local ref retains staged and unstaged states',async c=>{
    const help=await c.git(['stash','-h'],{ok:[129]});if(!`${help.stdout}\n${help.stderr}`.includes('export')){c.eq('Stash export probe recorded',help.code,129);return blocked('Effective stash usage has no export/import command.');}
    c.write('base.txt','stage B\n');await c.git(['add','--','base.txt']);c.write('base.txt','worktree C\n');await c.git(['stash','push','-m','Synthetic export']);const stash=await oid(c,'refs/stash');await c.git(['stash','export','--to-ref','refs/compat/export']);const exported=await oid(c,'refs/compat/export');
    const clone=inside(c,'stash receiver');await c.git(['clone','--no-hardlinks',c.repo,clone]);await c.git(['fetch',c.repo,'refs/compat/export:refs/compat/export'],{cwd:clone});await c.git(['stash','import',exported],{cwd:clone});c.eq('Imported original stash object',await oid(c,'refs/stash',clone),stash);await c.git(['stash','apply','--index'],{cwd:clone});
    c.eq('Imported index B',(await c.git(['show',':base.txt'],{cwd:clone})).stdout,'stage B\n');c.eq('Imported disk C',fs.readFileSync(path.join(clone,'base.txt'),'utf8'),'worktree C\n');c.eq('Source disk remains restored',c.read('base.txt'),'base one\n');c.ok('No private Layer storage invented in clone',!fs.existsSync(path.join(clone,'.git','git-layers')) && !fs.existsSync(path.join(clone,'.git','layers')));
    return {limits:['Local transport of stash export ref only. No metadata transport or product stash implementation is claimed.']};
  }),
  native('REMOTE-014','Official URL parser availability and parsing do not open a remote connection',async c=>{
    const builtins=(await c.git(['--list-cmds=builtins'])).stdout.split(/\r?\n/u);
    if(!builtins.includes('url-parse')){c.ok('URL parser builtin absent',!builtins.includes('url-parse'));return blocked('Official url-parse builtin absent in this Git; URL transport behavior is not inferred from help or a third-party parser.');}
    c.eq('HTTPS synthetic host parsed',(await c.git(['url-parse','--component','host','https://fixture.invalid/path'])).stdout,'fixture.invalid\n');c.eq('SCP-like path parsed',(await c.git(['url-parse','--component','path','fixture.invalid:repo'])).stdout,'/repo\n');
    const marker=write(c,inside(c,'url-sentinel'),'preserved\n');await c.git(['url-parse','--component','path','https://fixture.invalid/$(false)']);c.eq('Parser did not execute URL text',fs.readFileSync(marker,'utf8'),'preserved\n');
    return {limits:['Parser only; no SSH/HTTPS connection or authentication tested. File transport policy is exercised by separate local remote cases.']};
  }),
  native('PATH-012','Known clean/smudge filters transform blobs and required failure preserves the index',async c=>{
    const filter=write(c,inside(c,'filter.cjs'),`let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{require('node:fs').appendFileSync(process.argv[3],process.argv[2]+'\\n');process.stdout.write(process.argv[2]==='clean'?s.replace(/^work:/,'object:'):s.replace(/^object:/,'work:'));});\n`),trace=inside(c,'filter-trace');
    await c.git(['config','filter.fixture.clean',nodeCommand(filter,'clean',trace)]);await c.git(['config','filter.fixture.smudge',nodeCommand(filter,'smudge',trace)]);await c.git(['config','filter.fixture.required','true']);
    c.write('.gitattributes','filtered.txt filter=fixture\nblocked.txt filter=broken\n');c.write('filtered.txt','work:payload\n');await c.git(['add','--','.gitattributes','filtered.txt']);c.eq('Clean produces canonical blob',(await c.git(['show',':filtered.txt'])).stdout,'object:payload\n');fs.unlinkSync(path.join(c.repo,'filtered.txt'));await c.git(['checkout','--','filtered.txt']);c.eq('Smudge recreates worktree representation',c.read('filtered.txt'),'work:payload\n');c.ok('Known filter calls recorded',fs.readFileSync(trace,'utf8').includes('clean\n')&&fs.readFileSync(trace,'utf8').includes('smudge\n'));
    const failure=write(c,inside(c,'failing-filter.cjs'),'process.exit(17);\n');await c.git(['config','filter.broken.clean',nodeCommand(failure)]);await c.git(['config','filter.broken.required','true']);c.write('blocked.txt','must remain\n');const before=await index(c);const r=await c.git(['add','--','blocked.txt'],{ok:[128]});c.eq('Required failing filter rejects stage',r.code,128);c.eq('Failure preserves previous index',await index(c),before);c.eq('Failure preserves disk',c.read('blocked.txt'),'must remain\n');
    return {limits:['Single-file clean/smudge and required failure; a separate process-filter variant is needed for the long-running pkt-line protocol. Native filter execution does not certify Core support, which currently rejects external filters.']};
  }),
  native('PATH-013','Working-tree UTF-16LE and ident are compared with canonical index blobs',async c=>{
    c.write('.gitattributes','encoded.txt text working-tree-encoding=UTF-16LE eol=lf\nident.txt ident text eol=lf\n');c.write('encoded.txt',Buffer.from('café\n','utf16le'));c.write('ident.txt','$Id$\n');
    const r=await c.git(['add','--','.gitattributes','encoded.txt','ident.txt'],{ok:[0,128]});if(r.code!==0){c.eq('Encoding conversion probe failed',r.code,128);return blocked('Git UTF-16LE working-tree conversion failed in fixture: '+r.stderr.trim(),['Conversion operation was attempted; no supported encoding claim.']);}
    c.eq('Canonical encoding in blob is UTF-8',(await c.git(['show',':encoded.txt'])).stdout,'café\n');c.eq('Canonical ident marker',(await c.git(['show',':ident.txt'])).stdout,'$Id$\n');const blob=trim(await c.git(['rev-parse',':ident.txt']));await c.git(['commit','-m','Synthetic attributes']);
    fs.unlinkSync(path.join(c.repo,'encoded.txt'));fs.unlinkSync(path.join(c.repo,'ident.txt'));await c.git(['checkout','--','encoded.txt','ident.txt']);c.eq('Checkout returns exact UTF-16LE bytes',[...fs.readFileSync(path.join(c.repo,'encoded.txt'))],[...Buffer.from('café\n','utf16le')]);c.eq('Ident expanded with blob OID',c.read('ident.txt'),`$Id: ${blob} $\n`);await c.git(['add','--','ident.txt']);c.eq('Restaging cleans expanded ident',(await c.git(['show',':ident.txt'])).stdout,'$Id$\n');
    return {limits:['UTF-16LE without BOM and LF only; other encodings, BOM/EOL combinations and filter interactions are separate dimensions.']};
  }),
  native('PATH-012','A known long-running process filter performs the official v2 pkt-line handshake and clean/smudge conversion',async c=>{
    const trace=inside(c,'process-filter-trace');
    const helper=write(c,inside(c,'process-filter.cjs'),`const fs=require('node:fs');
function exact(n){const b=Buffer.alloc(n);let offset=0;while(offset<n){const got=fs.readSync(0,b,offset,n-offset,null);if(!got)throw Object.assign(new Error('EOF'),{eof:true});offset+=got;}return b;}
function pkt(){const n=parseInt(exact(4).toString('ascii'),16);if(!Number.isFinite(n)||n<0||n===1||n===2||n===3)throw Error('bad packet length');return n===0?null:exact(n-4);}
function section(){const result=[];for(;;){const p=pkt();if(p===null)return result;result.push(p);}}
function send(items){for(const item of items){const b=Buffer.from(item);fs.writeSync(1,Buffer.from((b.length+4).toString(16).padStart(4,'0')));fs.writeSync(1,b);}fs.writeSync(1,Buffer.from('0000'));}
const greeting=section().map(b=>b.toString());if(!greeting.includes('git-filter-client\\n')||!greeting.includes('version=2\\n'))throw Error('unexpected greeting');send(['git-filter-server\\n','version=2\\n']);
section();send(['capability=clean\\n','capability=smudge\\n']);
try{for(;;){const headers=section().map(b=>b.toString());const content=Buffer.concat(section()).toString();const command=headers.find(h=>h.startsWith('command=')).trim().slice(8);fs.appendFileSync(process.argv[2],command+'\\n');if(!['clean','smudge'].includes(command))throw Error('unknown filter command');const output=command==='clean'?content.replace(/^work:/,'object:'):content.replace(/^object:/,'work:');send(['status=success\\n']);send([output]);send([]);}}catch(e){if(!e.eof)throw e;}
`);
    await c.git(['config','filter.processfixture.process',nodeCommand(helper,trace)]);await c.git(['config','filter.processfixture.required','true']);c.write('.gitattributes','processed.txt filter=processfixture\n');c.write('processed.txt','work:process payload\n');await c.git(['add','--','.gitattributes','processed.txt']);
    c.eq('Process clean creates canonical blob',(await c.git(['show',':processed.txt'])).stdout,'object:process payload\n');fs.unlinkSync(path.join(c.repo,'processed.txt'));await c.git(['checkout','--','processed.txt']);c.eq('Process smudge materializes worktree form',c.read('processed.txt'),'work:process payload\n');const commands=fs.readFileSync(trace,'utf8').trim().split('\n');c.ok('Both process filter commands traversed real protocol',commands.includes('clean')&&commands.includes('smudge'),['clean','smudge'],commands);
    return {limits:['Synchronous v2 protocol, success response only; delayed checkout, malformed packets and crash/restart are not certified. The script is a known fixture helper and does not implement a product feature.']};
  },{variant:'native-advanced-process-filter'}),
  native('PATH-013','Controlled textconv diff driver changes presentation without changing canonical blobs',async c=>{
    const trace=inside(c,'textconv-trace'),converter=write(c,inside(c,'textconv.cjs'),`const fs=require('node:fs');fs.appendFileSync(process.argv[2],'called\\n');process.stdout.write('bytes:'+Array.from(fs.readFileSync(process.argv[3])).join(',')+'\\n');\n`);
    c.write('.gitattributes','binary.dat diff=fixture\n');await c.git(['config','diff.fixture.textconv',nodeCommand(converter,trace)]);await c.git(['config','diff.fixture.cachetextconv','false']);await commit(c,'binary.dat',Buffer.from([0,1,2]));await c.git(['add','--','.gitattributes']);await c.git(['commit','-m','Textconv attributes']);const before=await index(c);c.write('binary.dat',Buffer.from([0,1,3]));const diff=await c.git(['diff','--textconv','--','binary.dat']);
    c.ok('Textconv displays removed canonical version',diff.stdout.includes('-bytes:0,1,2'),true,diff.stdout);c.ok('Textconv displays new version',diff.stdout.includes('+bytes:0,1,3'),true,diff.stdout);c.ok('Known converter actually invoked',fs.readFileSync(trace,'utf8').trim().split('\n').length>=2);c.eq('Diff driver did not stage',await index(c),before);c.eq('Canonical committed blob remains binary',[...(await c.git(['cat-file','blob','HEAD:binary.dat'])).stdoutBuffer],[0,1,2]);
    return {limits:['Presentation via known Node helper only; no external application or product support for arbitrary diff drivers is certified.']};
  },{variant:'native-advanced-textconv'}),
  native('REF-006','Native files to reftable roundtrip preserves logical refs and reflog history',async c=>{
    const repo=inside(c,'reftable roundtrip');const probe=await c.git(['init','--ref-format=reftable','-b','main',repo],{ok:[0,129]});if(probe.code!==0){c.eq('Reftable init probe rejected',probe.code,129);return blocked('Native Git init rejected --ref-format=reftable.');}
    const first=await commit(c,'one.txt','one\n','first',repo);await c.git(['branch','fixture-branch',first],{cwd:repo});const second=await commit(c,'two.txt','two\n','second',repo);await c.git(['update-ref','-m','fixture update','refs/heads/fixture-branch',second,first],{cwd:repo});const beforeRefs=await refs(c,repo),beforeLog=(await c.git(['reflog','show','--format=%H %gs','refs/heads/fixture-branch'],{cwd:repo})).stdout;
    await c.git(['pack-refs','--all'],{cwd:repo});c.eq('Compaction retains refs',await refs(c,repo),beforeRefs);await c.git(['refs','migrate','--ref-format=files'],{cwd:repo});c.eq('Files backend selected',trim(await c.git(['rev-parse','--show-ref-format'],{cwd:repo})),'files');c.eq('Files migration retains refs',await refs(c,repo),beforeRefs);c.eq('Files migration retains reflog',(await c.git(['reflog','show','--format=%H %gs','refs/heads/fixture-branch'],{cwd:repo})).stdout,beforeLog);
    await c.git(['refs','migrate','--ref-format=reftable'],{cwd:repo});c.eq('Return backend selected',trim(await c.git(['rev-parse','--show-ref-format'],{cwd:repo})),'reftable');c.eq('Roundtrip retains logical refs',await refs(c,repo),beforeRefs);c.eq('Roundtrip retains reflog',(await c.git(['reflog','show','--format=%H %gs','refs/heads/fixture-branch'],{cwd:repo})).stdout,beforeLog);await c.git(['refs','verify','--strict'],{cwd:repo});
    return {limits:['No concurrent writers or linked worktrees during native backend migration. This is not a migration of git-layers storage and does not certify Core acceptance of reftable.']};
  }),
  native('PROTO-012','Credential-store store/get/erase use an explicit synthetic fixture file',async c=>{
    const file=inside(c,'synthetic-credentials'),credential='protocol=https\nhost=credential-fixture.invalid\nusername=synthetic-user\npassword=not-a-real-secret-invalid\n\n';
    await c.git(['credential-store','--file',file,'store'],{stdin:credential});c.ok('Explicit fixture credential file created',fs.existsSync(file));const got=await c.git(['credential-store','--file',file,'get'],{stdin:'protocol=https\nhost=credential-fixture.invalid\n\n'});const values=Object.fromEntries(got.stdout.trim().split('\n').map(l=>l.split('=')));
    c.eq('Synthetic username returned',values.username,'synthetic-user');c.eq('Synthetic invalid password returned',values.password,'not-a-real-secret-invalid');await c.git(['credential-store','--file',file,'erase'],{stdin:'protocol=https\nhost=credential-fixture.invalid\nusername=synthetic-user\n\n'});c.eq('Erased credential no longer returned',(await c.git(['credential-store','--file',file,'get'],{stdin:'protocol=https\nhost=credential-fixture.invalid\n\n'})).stdout,'');c.ok('No default HOME credential file',!fs.existsSync(path.join(c.env.HOME,'.git-credentials')));
    return {limits:['All credential strings are deliberately fake .invalid values. No credential manager, user keychain, network or default credential file is consulted.']};
  }),
  native('TOOLS-008','fmt-merge-msg consumes a fixture FETCH_HEAD without creating a commit',async c=>{
    await c.git(['switch','-c','topic']);const topic=await commit(c,'topic.txt','topic\n','Synthetic topic summary');await c.git(['switch','main']);const before={head:await oid(c),refs:await refs(c),index:await index(c)};const fetchHead=write(c,path.join(c.repo,'.git','FETCH_HEAD'),`${topic}\t\tbranch 'topic' of local-fixture\n`);const message=await c.git(['fmt-merge-msg','--log=2','-F',fetchHead]);
    c.ok('Merge title identifies fixture branch',message.stdout.includes("Merge branch 'topic'"),true,message.stdout);c.ok('Shortlog contains controlled subject',message.stdout.includes('Synthetic topic summary'),true,message.stdout);c.eq('Message generation leaves HEAD',await oid(c),before.head);c.eq('Message generation leaves refs',await refs(c),before.refs);c.eq('Message generation leaves index',await index(c),before.index);
  }),
  native('TOOLS-009','Official sh-setup and sh-i18n are sourced as libraries by a controlled wrapper',async c=>{
    const executable=path.resolve(path.dirname(c.gitPath),'../usr/bin/sh.exe'),execPath=trim(await c.git(['--exec-path']));
    if(!fs.existsSync(executable)||!fs.existsSync(path.join(execPath,'git-sh-setup'))||!fs.existsSync(path.join(execPath,'git-sh-i18n'))){c.ok('Known official shell/library prerequisite missing',true);return blocked('Known Git-distribution sh.exe or official shell library files absent; no arbitrary shell/PATH application launched.');}
    const script=write(c,inside(c,'library-wrapper.sh'),'#!/bin/sh\nset -e\nSUBDIRECTORY_OK=Yes\nUSAGE="synthetic wrapper"\n. "$(git --exec-path)/git-sh-setup"\n. "$(git --exec-path)/git-sh-i18n"\nrequire_work_tree\nprintf "library:%s\\n" "$(gettext "synthetic message")"\n');const before=await index(c);c.eq('Library function and gettext return controlled output',(await c.run(executable,[script])).stdout,'library:synthetic message\n');c.eq('Sourcing helpers leaves index intact',await index(c),before);
    return {limits:['Library load and require_work_tree/gettext only; helpers are not treated as standalone porcelain or every shell/platform certified.']};
  }),
];
