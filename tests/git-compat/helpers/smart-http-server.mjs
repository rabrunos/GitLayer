// Fixture-only CGI bridge, never loaded by Core/CLI or installed as a service.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';

const settings=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const {repositoryRoot,backend,ready,stop,trace,cut}=settings;
const owned=new Set(),sockets=new Set();let shuttingDown=false;
const record=data=>fs.appendFileSync(trace,JSON.stringify({...data,time:new Date().toISOString()})+'\n');
function endOwned(){for(const child of owned)if(child.exitCode===null)child.kill('SIGTERM');}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/denied.git/info/refs'){record({event:'synthetic-401',method:req.method,path:url.pathname});res.writeHead(401,{'WWW-Authenticate':'Basic realm="synthetic-fixture"'}).end('Synthetic authentication required\n');return;}
  if(!/^\/repo\.git\/(?:info\/refs|git-upload-pack|git-receive-pack)$/u.test(url.pathname)){res.writeHead(404).end();return;}
  let requestBytes=0;const chunks=[];
  req.on('data',chunk=>{requestBytes+=chunk.length;if(requestBytes>4*1024*1024){req.destroy();return;}chunks.push(chunk);});
  req.on('end',()=>{
    const requestId=crypto.randomUUID(),body=Buffer.concat(chunks);
    record({event:'request',requestId,method:req.method,path:url.pathname,query:url.searchParams.toString(),request_bytes:body.length});
    const env={...process.env,GIT_PROJECT_ROOT:repositoryRoot.replaceAll('\\','/'),GIT_HTTP_EXPORT_ALL:'1',REQUEST_METHOD:req.method,PATH_INFO:url.pathname,QUERY_STRING:url.search.slice(1),CONTENT_TYPE:req.headers['content-type']??'',CONTENT_LENGTH:String(body.length),SERVER_PROTOCOL:'HTTP/1.1',SERVER_NAME:'127.0.0.1',REMOTE_ADDR:'127.0.0.1',SERVER_PORT:String(server.address().port)};
    if(req.headers['git-protocol'])env.HTTP_GIT_PROTOCOL=req.headers['git-protocol'];
    const child=spawn(backend,[],{cwd:repositoryRoot,env,windowsHide:true,stdio:['pipe','pipe','pipe']});owned.add(child);
    let buffered=Buffer.alloc(0),headersDone=false,responseBytes=0,cutTriggered=false,stderr='';
    const timer=setTimeout(()=>{record({event:'backend-timeout',requestId});child.kill('SIGTERM');res.destroy();},20000);
    child.stderr.on('data',b=>stderr+=b.toString('utf8'));
    const emit=chunk=>{
      if(cutTriggered||res.destroyed||chunk.length===0)return;
      // Deliberately truncate an actual upload-pack response after body bytes
      // reach the socket. This is a transport failure, not process SIGINT.
      if(fs.existsSync(cut)&&url.pathname==='/repo.git/git-upload-pack'&&req.method==='POST'){
        cutTriggered=true;const piece=chunk.subarray(0,Math.min(128,chunk.length));responseBytes+=piece.length;
        res.write(piece,()=>{record({event:'connection-cut',requestId,request_bytes:requestBytes,response_bytes_written:responseBytes,owned_backend_pid:child.pid});res.destroy();if(child.exitCode===null)child.kill('SIGTERM');});
      }else{responseBytes+=chunk.length;res.write(chunk);}
    };
    child.stdout.on('data',chunk=>{
      if(headersDone){emit(chunk);return;}
      buffered=Buffer.concat([buffered,chunk]);let separator=buffered.indexOf('\r\n\r\n'),length=4;if(separator<0){separator=buffered.indexOf('\n\n');length=2;}if(separator<0)return;
      const headerText=buffered.subarray(0,separator).toString('utf8'),headers={};let status=200;
      for(const line of headerText.split(/\r?\n/u)){const split=line.indexOf(':');if(split<1)continue;const key=line.slice(0,split),value=line.slice(split+1).trim();if(key.toLowerCase()==='status')status=Number.parseInt(value,10);else headers[key]=value;}
      res.writeHead(status,headers);headersDone=true;emit(buffered.subarray(separator+length));buffered=Buffer.alloc(0);
    });
    child.on('error',error=>{record({event:'backend-spawn-error',requestId,code:error.code});res.destroy();});
    child.on('close',(code,signal)=>{clearTimeout(timer);owned.delete(child);record({event:'backend-closed',requestId,code,signal,response_bytes:responseBytes,cut:cutTriggered,stderr});if(!cutTriggered&&!res.destroyed){if(!headersDone)res.writeHead(502);res.end();}});
    child.stdin.on('error',()=>{});child.stdin.end(body);
  });
});
server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
server.keepAliveTimeout=50;
server.listen(0,'127.0.0.1',()=>{fs.writeFileSync(ready,JSON.stringify({pid:process.pid,address:server.address()}));record({event:'listening',address:server.address()});});
const timer=setInterval(()=>{if(!shuttingDown&&fs.existsSync(stop)){shuttingDown=true;clearInterval(timer);endOwned();for(const socket of sockets)socket.destroy();server.close(()=>{record({event:'stopped',remaining_owned_backends:owned.size});process.exit(0);});}},40);
