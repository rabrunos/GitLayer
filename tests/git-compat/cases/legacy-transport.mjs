import fs from 'node:fs';
import path from 'node:path';

const trim=r=>r.stdout.trim();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const blocked=reason=>({execution_status:'ENV_BLOCKED',nonexecution_reason:reason});
function owned(c,...parts){const p=path.resolve(c.root,...parts),rel=path.relative(c.root,p);if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Legacy transport path escaped fixture');return p;}
const head=async c=>trim(await c.git(['rev-parse','HEAD']));
const stage=async c=>(await c.git(['ls-files','--stage','-z'])).stdout;
function native(id,title,run){return {id,variant:'legacy-transport',title,profile:'N0',tier:'broad',phase:'NATIVE_BASELINE',productStatus:'NOT_ASSESSED',capabilities:[],timeout:60000,async run(c){await c.init();await c.snapshot('legacy-transport-before');const result=await run(c);await c.snapshot('legacy-transport-after');return result;}};}
async function receiver(c,mode){
  const ready=owned(c,mode+'-ready.json'),stop=owned(c,mode+'-stop'),trace=owned(c,mode+'-trace.jsonl'),message=owned(c,mode+'-message.eml'),settings=owned(c,mode+'-settings.json');fs.writeFileSync(settings,JSON.stringify({mode,ready,stop,trace,message}));
  const helper=path.resolve(import.meta.dirname,'../helpers/mail-loopback-server.mjs');let child,failure;const running=c.run(process.execPath,[helper,settings],{timeout:40000,onSpawn:p=>child=p}).catch(error=>{failure=error;return null;});
  for(let i=0;i<100&&!fs.existsSync(ready);i++){if(failure)throw failure;await pause(40);}if(!fs.existsSync(ready)){if(child?.exitCode===null)child.kill('SIGTERM');await running;throw failure??Error('Loopback mail receiver failed to become ready');}
  const data=JSON.parse(fs.readFileSync(ready,'utf8'));c.eq(mode+' binds only loopback',data.address.address,'127.0.0.1');c.eq(mode+' readiness PID is owned child',data.pid,child.pid);
  return {port:data.address.port,message,events:()=>fs.readFileSync(trace,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)),async stop(){fs.writeFileSync(stop,'stop\n');const result=await running;if(failure)throw failure;c.eq(mode+' receiver closes normally',result.code,0);c.eq(mode+' receiver avoids timeout',result.timedOut,false);fs.copyFileSync(trace,path.join(c.artifactDir,mode+'-transcript.jsonl'));if(fs.existsSync(message))fs.copyFileSync(message,path.join(c.artifactDir,mode+'-synthetic-message.eml'));}};
}
async function patch(c){c.write('legacy-mail.txt','legacy synthetic payload\n');await c.git(['add','--','legacy-mail.txt']);await c.git(['commit','-m','Legacy synthetic mailbox fixture']);return (await c.git(['format-patch','-1','--stdout'])).stdout;}
function received(c,server,mode){c.ok(mode+' actually received a message',fs.existsSync(server.message));const bytes=fs.readFileSync(server.message,'utf8');c.ok(mode+' message contains exact patch subject',bytes.includes('Subject: [PATCH] Legacy synthetic mailbox fixture'));c.ok(mode+' message contains exact added payload',bytes.includes('+legacy synthetic payload'));c.eq(mode+' receiver saved exactly one message',server.events().filter(e=>e.event==='message').length,1);}

export const cases=[
  native('LEGACY-001','Official send-email transmits a synthetic patch to an owned loopback SMTP receiver or proves missing runtime modules',async c=>{
    const probe=await c.git(['send-email','--dump-aliases'],{ok:[0,1,2,128,129,255]});
    if(probe.code!==0){if(/not a git command|can't locate .*\.pm|perl.*(?:not found|no such file)|unable to locate.*perl/iu.test(probe.stderr)){c.ok('Installed send-email runtime dependency probe failed',probe.code!==0);return blocked('Effective official send-email runtime is unavailable: '+probe.stderr.trim());}throw Error('Unexpected send-email capability probe failure: '+probe.stderr);}
    const text=await patch(c),file=owned(c,'synthetic.patch');fs.writeFileSync(file,text);const before={head:await head(c),stage:await stage(c)},server=await receiver(c,'smtp');
    try{await c.git(['-c','sendemail.smtpEncryption=','send-email','--smtp-server=127.0.0.1',`--smtp-server-port=${server.port}`,'--no-smtp-auth','--from=Synthetic Sender <sender@example.invalid>','--to=receiver@example.invalid','--confirm=never','--no-validate','--suppress-cc=all',file.replaceAll('\\','/')],{env:{TMPDIR:c.env.TMPDIR.replaceAll('\\','/'),TMP:c.env.TMP.replaceAll('\\','/'),TEMP:c.env.TEMP.replaceAll('\\','/')}});received(c,server,'smtp');c.ok('SMTP DATA command actually occurred',server.events().some(e=>e.command==='DATA'));c.eq('Mail send leaves HEAD',await head(c),before.head);c.eq('Mail send leaves stage',await stage(c),before.stage);}finally{await server.stop();}
    return {limits:['Actual plain SMTP loopback delivery to a nonforwarding fixture receiver; synthetic .invalid identities only. SMTP authentication/TLS, external recipients, sendemail-validate policy and product Layer branch patch selection remain unassessed.']};
  }),
  native('LEGACY-002','Official imap-send appends a synthetic patch to an owned loopback mailbox',async c=>{
    const execPath=trim(await c.git(['--exec-path'])),binary=path.join(execPath,process.platform==='win32'?'git-imap-send.exe':'git-imap-send');if(!fs.existsSync(binary)){c.ok('Official IMAP helper path absent',!fs.existsSync(binary));return blocked('Official git-imap-send helper absent in effective Git exec-path.');}
    const text=await patch(c),before={head:await head(c),stage:await stage(c)},server=await receiver(c,'imap');
    try{await c.git(['-c','imap.host=imap://127.0.0.1','-c',`imap.port=${server.port}`,'-c','imap.user=synthetic-user','-c','imap.pass=invalid-fixture-password','-c','imap.folder=INBOX/Drafts','-c','imap.preformattedHTML=false','imap-send','--no-curl'],{stdin:text});received(c,server,'imap');c.ok('IMAP APPEND with actual literal occurred',server.events().some(e=>e.command==='APPEND'));c.eq('IMAP append leaves HEAD',await head(c),before.head);c.eq('IMAP append leaves stage',await stage(c),before.stage);}finally{await server.stop();}
    return {limits:['Native IMAP client path (--no-curl) and a minimal synthetic LOGIN/APPEND mailbox over loopback only. No real account/password, external mail, TLS, SASL or complete IMAP-server conformance; helper transcripts deliberately omit LOGIN arguments. Product patch selection remains unassessed.']};
  }),
  native('TOOLS-003','Gitweb/instaweb inventory proves official CGI and HTTP daemon availability without starting a browser/service',async c=>{
    const execPath=trim(await c.git(['--exec-path'])),prefix=path.resolve(execPath,'../../..'),script=path.join(execPath,'git-instaweb');
    const configured=(await c.git(['config','--get','instaweb.gitwebdir'],{ok:[0,1]})).stdout.trim(),defaultRoot=path.resolve(execPath,'../../share/gitweb'),root=configured||defaultRoot,cgi=path.join(root,'gitweb.cgi');
    const locations=[cgi,path.join(prefix,'share','gitweb','gitweb.cgi')],presence=locations.map(file=>({file,exists:fs.existsSync(file)}));
    const where=path.join(c.env.SystemRoot??'C:\\Windows','System32/where.exe'),servers=[];if(process.platform==='win32'&&fs.existsSync(where))for(const name of ['lighttpd','httpd','apache2','plackup','ruby','python']){const found=await c.run(where,[name],{ok:[0,1]});servers.push({name,found:found.code===0,paths:found.stdout.trim().split(/\r?\n/u).filter(Boolean)});}
    const inventory={official_exec_path:execPath,instaweb_script_present:fs.existsSync(script),configured_fixture_root:configured||null,gitweb_candidates:presence,isolated_path_daemons:servers,gui_started:false,service_started:false};fs.writeFileSync(path.join(c.artifactDir,'gitweb-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
    c.ok('Inventory uses the effective official Git installation',path.isAbsolute(execPath));
    if(!presence.some(p=>p.exists)){c.eq('Required CGI absent from proven official default/configured paths',presence.some(p=>p.exists),false);return blocked('Gitweb CGI is absent from the effective official installation default and fixture-configured paths; isolated PATH daemon probes are recorded. No browser or server was started. This does not assert absence everywhere on the host.');}
    // An inventory cannot be a functional PASS. A future environment with CGI
    // available still needs the nonvisual HTTP harness, so expose that gap.
    return {productStatus:'TEST_GAP',limits:['Official CGI is present, but no nonvisual Gitweb renderer/HTTP harness is implemented; this variant proves inventory only and does not certify browsing. No GUI or service was started.']};
  })
];
