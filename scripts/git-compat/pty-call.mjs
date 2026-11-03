import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const request=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(!path.isAbsolute(request.executable)||!path.isAbsolute(request.cwd))throw Error('PTY paths must be absolute');
let terminal,output='',step=0,cursor=0,finished=false;
const started=Date.now();
function finish(code,signal,error){
  if(finished)return;finished=true;clearTimeout(timer);
  const result={backend:'node-pty 1.1.0 / real ConPTY',executable:request.executable,argv:request.argv,cwd:request.cwd,pid:terminal?.pid,code,signal,steps_completed:step,steps_expected:request.steps.length,duration_ms:Date.now()-started,output,error};
  process.stdout.write(JSON.stringify(result)+'\n',()=>process.exit(error?1:0));
}
const timer=setTimeout(()=>{try{terminal?.kill();}catch{}finish(null,'TIMEOUT','PTY prompt/child timeout');},request.timeout??20000);
try{
  const pty=require('node-pty');
  terminal=pty.spawn(request.executable,request.argv,{name:'xterm',cols:120,rows:40,cwd:request.cwd,env:{...process.env,TERM:'dumb',NO_COLOR:'1'},useConpty:true});
  terminal.onData(data=>{
    output+=data;
    if(output.length>2*1024*1024){try{terminal.kill();}catch{}finish(null,'OUTPUT_LIMIT','PTY output limit');return;}
    while(step<request.steps.length){const item=request.steps[step];const at=output.indexOf(item.pattern,cursor);if(at<0)break;cursor=at+item.pattern.length;step++;terminal.write(item.send);}
  });
  terminal.onExit(({exitCode,signal})=>finish(exitCode,signal??null,step===request.steps.length?null:'Child exited before expected prompts'));
}catch(error){finish(null,null,String(error.stack??error));}
