// Controlled SMTP/IMAP fixture receiver: no forwarding, TLS, real mailbox or auth.
import fs from 'node:fs';
import net from 'node:net';

const settings=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const {mode,ready,stop,trace,message}=settings,sockets=new Set();let messages=0,closing=false;
const record=event=>fs.appendFileSync(trace,JSON.stringify(event)+'\n');
const save=bytes=>{fs.writeFileSync(message,bytes);messages++;record({event:'message',bytes:bytes.length,messages});};
const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('error',error=>record({event:'socket-error',code:error.code}));socket.on('close',()=>sockets.delete(socket));
  record({event:'connected',remote_address:socket.remoteAddress});
  let buffer=Buffer.alloc(0),smtpData=false,smtpLines=[],literal=null;
  const reply=text=>socket.write(text+'\r\n');
  reply(mode==='smtp'?'220 synthetic-loopback ESMTP ready':'* OK [CAPABILITY IMAP4rev1 LITERAL+] Synthetic IMAP fixture ready');
  socket.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);if(buffer.length>2*1024*1024){socket.destroy();return;}
    while(buffer.length){
      if(literal){if(buffer.length<literal.bytes)return;save(buffer.subarray(0,literal.bytes));buffer=buffer.subarray(literal.bytes);reply(`${literal.tag} OK [APPENDUID 1 ${messages}] APPEND completed`);literal=null;continue;}
      const end=buffer.indexOf('\r\n');if(end<0)return;const line=buffer.subarray(0,end).toString('utf8');buffer=buffer.subarray(end+2);if(!line&&!smtpData)continue;
      if(mode==='smtp'){
        if(smtpData){if(line==='.'){save(Buffer.from(smtpLines.join('\r\n')+'\r\n'));smtpLines=[];smtpData=false;reply('250 2.0.0 accepted synthetic message');}else smtpLines.push(line.startsWith('..')?line.slice(1):line);continue;}
        const command=line.split(' ')[0].toUpperCase();record({event:'command',command});
        if(command==='EHLO'||command==='HELO')reply('250 synthetic-loopback');
        else if(command==='MAIL'||command==='RCPT'||command==='RSET'||command==='NOOP')reply('250 2.0.0 OK');
        else if(command==='DATA'){smtpData=true;reply('354 end with dot');}
        else if(command==='QUIT'){reply('221 synthetic goodbye');socket.end();}
        else reply('500 unsupported fixture command');
      }else{
        const parsed=line.match(/^(\S+)\s+(\S+)(?:\s+(.*))?$/u);if(!parsed){reply('* BAD malformed fixture command');continue;}
        const [,tag,verb,args='']=parsed,command=verb.toUpperCase();record({event:'command',command}); // Arguments deliberately omitted, including LOGIN credentials.
        if(command==='CAPABILITY'){reply('* CAPABILITY IMAP4rev1 LITERAL+');reply(`${tag} OK capability`);}
        else if(command==='LOGIN')reply(`${tag} OK login accepted for synthetic fixture`);
        else if(command==='SELECT'||command==='EXAMINE'){reply(`* ${messages} EXISTS`);reply('* 0 RECENT');reply('* OK [UIDVALIDITY 1] stable fixture UID validity');reply(`${tag} OK [READ-WRITE] selected`);}
        else if(command==='LIST'){reply('* LIST (\\HasNoChildren) "/" "INBOX/Drafts"');reply(`${tag} OK list`);}
        else if(command==='APPEND'){const size=args.match(/\{(\d+)(\+)?\}$/u);if(!size){reply(`${tag} BAD literal required`);continue;}literal={tag,bytes:Number(size[1])};if(!size[2])reply('+ ready for synthetic literal');}
        else if(command==='LOGOUT'){reply('* BYE synthetic logout');reply(`${tag} OK logout`);socket.end();}
        else if(command==='NOOP'||command==='CHECK'||command==='CLOSE')reply(`${tag} OK ${command}`);
        else reply(`${tag} BAD unsupported fixture command`);
      }
    }
  });
});
server.listen(0,'127.0.0.1',()=>{const address=server.address();fs.writeFileSync(ready,JSON.stringify({pid:process.pid,address}));record({event:'listening',mode,address});});
const timer=setInterval(()=>{if(!closing&&fs.existsSync(stop)){closing=true;clearInterval(timer);for(const socket of sockets)socket.destroy();server.close(()=>{record({event:'stopped',messages,remaining_sockets:sockets.size});process.exit(0);});}},40);
