import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const trim=r=>r.stdout.trim();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const oid=async(c,ref='HEAD',cwd=c.repo)=>trim(await c.git(['rev-parse',ref],{cwd}));
const idx=async(c,cwd=c.repo)=>(await c.git(['ls-files','--stage','-z'],{cwd})).stdout;
const refs=async(c,cwd=c.repo)=>(await c.git(['for-each-ref','--format=%(refname) %(objectname)'],{cwd})).stdout;
function owned(c,...parts){const p=path.resolve(c.root,...parts),rel=path.relative(c.root,p);if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Transport fixture path escaped');return p;}
const blocked=reason=>({execution_status:'ENV_BLOCKED',nonexecution_reason:reason});
async function commit(c,file,bytes,message=file,cwd=c.repo){const p=path.join(cwd,file);if(!p.startsWith(c.root+path.sep))throw Error('Commit path escaped');fs.writeFileSync(p,bytes);await c.git(['add','--',file],{cwd});await c.git(['commit','-m',message],{cwd});return oid(c,'HEAD',cwd);}
function native(id,title,run){return {id,variant:'transport-extra',title,profile:'N0',tier:'broad',phase:'NATIVE_BASELINE',productStatus:'NOT_ASSESSED',capabilities:[],timeout:120000,async run(c){await c.init();await c.snapshot('transport-before');const result=await run(c);await c.snapshot('transport-after');return result;}};}
async function start(c){
  const execPath=trim(await c.git(['--exec-path'])),backend=path.join(execPath,process.platform==='win32'?'git-http-backend.exe':'git-http-backend');
  if(!fs.existsSync(backend)){c.ok('Official exec-path backend absent',!fs.existsSync(backend));return blocked('Official git-http-backend absent in proven Git exec-path; no substitute backend was used.');}
  c.ok('Backend is the official exec-path executable',fs.statSync(backend).isFile());c.ok('Backend provenance SHA256 recorded',true,'official helper SHA256',crypto.createHash('sha256').update(fs.readFileSync(backend)).digest('hex'));
  const repositoryRoot=owned(c,'http-root');fs.mkdirSync(repositoryRoot);const serverRepo=path.join(repositoryRoot,'repo.git');await c.git(['clone','--bare','--no-hardlinks',c.repo,serverRepo]);await c.git(['config','http.receivepack','true'],{cwd:serverRepo});await c.git(['config','http.getanyfile','false'],{cwd:serverRepo});
  const ready=owned(c,'http-ready.json'),stop=owned(c,'http-stop'),trace=owned(c,'http-transcript.jsonl'),cut=owned(c,'http-cut'),settings=owned(c,'http-settings.json');
  fs.writeFileSync(settings,JSON.stringify({repositoryRoot,backend,ready,stop,trace,cut}));
  const helper=path.resolve(import.meta.dirname,'../helpers/smart-http-server.mjs');let child,failure;
  const running=c.run(process.execPath,[helper,settings],{timeout:90000,onSpawn:p=>child=p}).catch(error=>{failure=error;return null;});
  for(let i=0;i<100&&!fs.existsSync(ready);i++){if(failure)throw failure;await delay(40);}
  if(!fs.existsSync(ready)){if(child?.exitCode===null)child.kill('SIGTERM');await running;throw failure??Error('Smart HTTP fixture server failed to become ready');}
  const data=JSON.parse(fs.readFileSync(ready,'utf8'));c.eq('Smart HTTP binds only loopback',data.address.address,'127.0.0.1');c.eq('Ready PID belongs to known child',data.pid,child.pid);
  return {serverRepo,url:`http://127.0.0.1:${data.address.port}/repo.git`,denied:`http://127.0.0.1:${data.address.port}/denied.git`,cut,trace,async stop(){fs.writeFileSync(stop,'stop\n');const result=await running;if(failure)throw failure;c.eq('HTTP fixture server closes normally',result.code,0);c.eq('Server was not killed by timeout',result.timedOut,false);fs.copyFileSync(trace,path.join(c.artifactDir,'smart-http-transcript.jsonl'));const events=fs.readFileSync(trace,'utf8').trim().split('\n').map(line=>JSON.parse(line));c.eq('No owned CGI backend remains at server shutdown',events.findLast(e=>e.event==='stopped')?.remaining_owned_backends,0);},events(){return fs.readFileSync(trace,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}};
}
const httpArgs=['-c','protocol.http.allow=always','-c','http.proxy=','-c','credential.helper='];

export const cases=[
  native('PROTO-004','Real official CGI smart HTTP clone/fetch/push and synthetic 401 use only loopback fixtures',async c=>{
    const server=await start(c);if(server.execution_status)return server;
    try{
      const client=owned(c,'smart-client');await c.git([...httpArgs,'clone',server.url,client]);c.eq('Smart clone preserves exact commit',await oid(c,'HEAD',client),await oid(c));c.eq('Smart clone exact blob',(await c.git(['show','HEAD:base.txt'],{cwd:client})).stdout,'base one\n');
      const fetched=await commit(c,'server-added.txt','HTTP fetch bytes\n','server fetch');await c.git(['push',server.serverRepo,'main']);await c.git([...httpArgs,'fetch','origin'],{cwd:client});c.eq('Smart fetch advances remote tracking ref',await oid(c,'refs/remotes/origin/main',client),fetched);
      await c.git(['merge','--ff-only','origin/main'],{cwd:client});const pushed=await commit(c,'client-added.txt','HTTP push bytes\n','client push',client);await c.git([...httpArgs,'push','origin','main'],{cwd:client});c.eq('Official receive-pack accepts local HTTP push',await oid(c,'refs/heads/main',server.serverRepo),pushed);c.eq('Server receives exact pushed blob',(await c.git(['show','main:client-added.txt'],{cwd:server.serverRepo})).stdout,'HTTP push bytes\n');
      const before=await refs(c,client),denied=await c.git([...httpArgs,'ls-remote',server.denied],{cwd:client,ok:[128]});c.eq('Synthetic unauthenticated 401 refuses without prompting',denied.code,128);c.eq('Auth refusal retains client refs',await refs(c,client),before);
      await c.git(['fsck','--full','--no-dangling'],{cwd:client});await c.git(['fsck','--full','--no-dangling'],{cwd:server.serverRepo});
      const events=server.events();c.ok('Smart upload-pack POST had actual protocol request/response bytes',events.some(e=>e.event==='request'&&e.path==='/repo.git/git-upload-pack'&&e.request_bytes>0)&&events.some(e=>e.event==='backend-closed'&&e.response_bytes>0));c.ok('Smart receive-pack was actually invoked',events.some(e=>e.event==='request'&&e.path==='/repo.git/git-receive-pack'&&e.request_bytes>0));c.ok('401 route was actually reached',events.some(e=>e.event==='synthetic-401'));
    }finally{await server.stop();}
    return {limits:['Official git-http-backend CGI with a disposable Node loopback HTTP bridge, no product proxy/interceptor/service installation. Actual clone/fetch/push and 401 refusal only: TLS, authentication success, public network, WebDAV and product Layer push policy remain unassessed.']};
  }),
  native('REMOTE-015','Connection truncation during real smart HTTP fetch preserves refs/index and supports a clean retry',async c=>{
    const server=await start(c);if(server.execution_status)return server;
    try{
      const client=owned(c,'interrupted-client');await c.git([...httpArgs,'clone',server.url,client]);const before={head:await oid(c,'HEAD',client),refs:await refs(c,client),index:await idx(c,client)};
      // Deterministic incompressible synthetic content forces actual pack bytes.
      const blocks=Array.from({length:2048},(_,i)=>crypto.createHash('sha256').update(`http-owned-fixture-${i}`).digest());const next=await commit(c,'transfer.bin',Buffer.concat(blocks),'transfer payload');await c.git(['push',server.serverRepo,'main']);fs.writeFileSync(server.cut,'truncate actual upload-pack response\n');
      const interrupted=await c.git([...httpArgs,'fetch','origin'],{cwd:client,ok:[1,128]});c.ok('Actual connection truncation reports failure',interrupted.code!==0,true,interrupted.code);const cuts=server.events().filter(e=>e.event==='connection-cut');c.ok('Socket cut occurred after actual nonzero request/body bytes',cuts.some(e=>e.request_bytes>0&&e.response_bytes_written>0),true,cuts);c.eq('Failed fetch does not move HEAD',await oid(c,'HEAD',client),before.head);c.eq('Failed fetch does not publish remote refs',await refs(c,client),before.refs);c.eq('Failed fetch keeps local semantic stage',await idx(c,client),before.index);await c.git(['fsck','--full','--no-dangling'],{cwd:client});
      const packs=path.join(client,'.git','objects','pack');c.eq('No unfinished temporary pack remains',fs.readdirSync(packs).filter(p=>/^tmp_/u.test(p)),[]);
      fs.unlinkSync(server.cut);await c.git([...httpArgs,'fetch','origin'],{cwd:client});c.eq('Clean retry receives intended remote commit',await oid(c,'origin/main',client),next);c.eq('Retried pack has exact binary blob',(await c.git(['show','origin/main:transfer.bin'],{cwd:client})).stdoutBuffer.toString('base64'),Buffer.concat(blocks).toString('base64'));await c.git(['fsck','--full','--no-dangling'],{cwd:client});c.eq('Fetch retry leaves checked-out HEAD',await oid(c,'HEAD',client),before.head);c.eq('Fetch retry leaves index',await idx(c,client),before.index);
    }finally{await server.stop();}
    return {limits:['Forced TCP/HTTP response truncation after bytes were written, explicitly not SIGINT/Ctrl+C, user cancellation or loss of push acknowledgment. Pack validity and retry are checked for an established client; abrupt power loss, proxies, remote rollback and product journal recovery remain unassessed.']};
  })
];
