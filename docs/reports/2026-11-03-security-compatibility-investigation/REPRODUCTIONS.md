# Reproduções seguras

As operações abaixo criam repositórios novos e marcados fora do checkout. Não aplique comandos destrutivos ao projeto ou a dados reais. Nenhum comando usa o origin do projeto como fixture ou muda a configuração Git global/system. As fixtures e evidências são preservadas; não há cleanup automático.

## Preparação e execução do reprodutor dos defeitos

Use uma cópia descartável do snapshot `18d26c18d0c9377141af7704bde50ee32b210465`, Node/Git oficiais e dependências do lockfile disponíveis (`npm.cmd ci --ignore-scripts`). Salve o bloco JavaScript abaixo em um arquivo novo, por exemplo `$repro`, fora do checkout. Execute a partir da raiz da cópia:

```powershell
node --import tsx $repro --source . --case all
# Seleções menores: --case rename-base | rename-layer | race | control
# Verificação sintática: node --check $repro
```

O reprodutor importa as fontes do checkout por tsx e usa a infraestrutura existente somente para resolver o executável oficial. A fonte de produção não é editada. O script recusa TEMP dentro de repositório ou ancestral com links, verifica nonces/ancestralidade e não remove as fixtures. `SUMMARY.json` e `evidence.json` registram entradas e efeitos. **Exit0 significa experimento concluído, não ausência de defeito.**

### D-01: origem incorreta depois de rename

`rename-base` cobre filesystem e API Core: target b; editar base.txt; renomear; status; off sem descarte; descarte explícito de b. No snapshot, status reserva o destino em b e o descarte o remove. O guard normal sujo recusa corretamente e backups técnicos mantêm cópias dos bytes; não se afirma perda irrecuperável.

`rename-layer` move a.txt da Layer a para nome novo durante target b. No snapshot, status reserva em b e add/commit b aceitam os bytes. Conferir `git show layer/b:renamed-a.txt`, o commit antigo de a e ambos índices. Não basta examinar a saída do Core. Controles executados separadamente: git mv da base mantém o destino no índice principal; rename Core de Layer a preserva a e add b recusa OWNERSHIP.

### D-02: baseline inválida sob criação concorrente

`race` coordena um processo externo real entre walk e ls-files da abertura do target. Envolve temporariamente o export spawn do Node, delega a chamada original sem alterar argumentos ou respostas, e restaura o export em finally. Não é hook/interceptador instalado no Git ou alteração do produto. Esperado do contrato: sucesso sempre reabrível ou recusa que preserve contexto válido. Observado: target ok:true; unassigned contém between.txt ausente de before; próxima consulta e nova open falham METADATA_INVALID. Reproduz duas vezes no conjunto principal e novamente na validação portátil; não mede incidência natural.

`control` verifica 0/1/2 Layers sem target, commits nativos só da base e target sem interferência reabrível. O modo portátil race foi executado diretamente da fonte; as demais rotas do script usam as mesmas operações já executadas nos experimentos registrados, sem afirmar uma execução adicional de all.

### Script documental

```javascript
﻿// Documentation-only reproducer. Usage from the project root:
// node --import tsx reproduce-edit.mjs --source . --case all
// Requires the existing lockfile dependencies. All repository writes use a new
// marked fixture outside --source; fixtures and evidence are intentionally kept.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {pathToFileURL} from 'node:url';
const arg=k=>{const i=process.argv.indexOf(k);return i<0?undefined:process.argv[i+1];};
const source=fs.realpathSync(path.resolve(arg('--source')||'.')),selected=arg('--case')||'all';
const options=['all','rename-base','rename-layer','race','control'];if(!options.includes(selected))throw Error('Choose --case '+options.join('|'));
// Refuse TEMP inside any repository, and reject links along its original path.
const tempInput=path.resolve(os.tmpdir());let ancestor=path.parse(tempInput).root;
const verifyTempAncestor=p=>{const st=fs.lstatSync(p);if(!st.isDirectory()||st.isSymbolicLink())throw Error('Unsafe TEMP ancestor '+p);try{fs.lstatSync(path.join(p,'.git'));throw Error('TEMP is inside a repository: '+p);}catch(e){if(e.code!=='ENOENT')throw e;}};
verifyTempAncestor(ancestor);for(const part of path.relative(ancestor,tempInput).split(path.sep).filter(Boolean)){ancestor=path.join(ancestor,part);verifyTempAncestor(ancestor);}
const temp=fs.realpathSync(tempInput),relative=path.relative(source,temp);if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('TEMP must be outside the source checkout');
const root=fs.mkdtempSync(path.join(temp,'git-layer-edit-repro-')),rootNonce=randomUUID(),markers=new Map([[root,rootNonce]]);fs.writeFileSync(path.join(root,'.owned'),rootNonce,{flag:'wx'});
const {resolveGit}=await import(pathToFileURL(path.join(source,'scripts/git-compat/lib.mjs')).href),gitExe=resolveGit();
const {GitLayers}=await import(pathToFileURL(path.join(source,'src/core/index.ts')).href);
const hash=x=>createHash('sha256').update(x).digest('hex'),cases=[],previous={...process.env};
function checkOwned(p){const rootStat=fs.lstatSync(root);if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw Error('Fixture root replaced');const target=path.resolve(p),r=path.relative(root,target);if(!r||r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw Error('Unowned path');for(const [marked,nonce]of markers){const q=path.relative(marked,target);if(q===''||(q!=='..'&&!q.startsWith('..'+path.sep)&&!path.isAbsolute(q))){const marker=path.join(marked,'.owned'),st=fs.lstatSync(marker);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||fs.readFileSync(marker,'utf8')!==nonce)throw Error('Ownership nonce changed');}}let current=root;for(const part of r.split(path.sep)){current=path.join(current,part);let st;try{st=fs.lstatSync(current);}catch(e){if(e.code==='ENOENT')return;throw e;}if(st.isSymbolicLink()||(!st.isDirectory()&&!st.isFile())||(st.isFile()&&st.nlink!==1))throw Error('Unsafe fixture path '+current);if(current!==target&&!st.isDirectory())throw Error('Non-directory fixture ancestor');}}
function environment(home){fs.mkdirSync(home);const env={...previous};for(const k of Object.keys(env))if(/^GIT_|^(HOME|USERPROFILE|XDG_CONFIG_HOME|SSH_ASKPASS|GCM_INTERACTIVE|NODE_OPTIONS)$/i.test(k))delete env[k];return Object.assign(env,{HOME:home,USERPROFILE:home,XDG_CONFIG_HOME:home,TEMP:home,TMP:home,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:path.join(home,'none-system'),GIT_CONFIG_GLOBAL:path.join(home,'none-global'),GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:'',SSH_ASKPASS:'',GCM_INTERACTIVE:'never',GIT_AUTHOR_NAME:'Reproduction Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Reproduction Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid',GIT_EDITOR:'false',GIT_PAGER:'cat',GIT_OPTIONAL_LOCKS:'0',LANG:'C',LC_ALL:'C'});}
async function run(name,fn){
 const dir=path.join(root,name);checkOwned(dir);fs.mkdirSync(dir);const nonce=randomUUID();fs.writeFileSync(path.join(dir,'.owned'),nonce,{flag:'wx'});markers.set(dir,nonce);const env=environment(path.join(dir,'home'));for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,env);
 const repo=path.join(dir,'repo');fs.mkdirSync(repo);const events=[];
 const git=(args,extra={})=>{const r=cp.spawnSync(gitExe,args,{cwd:repo,env:{...env,...extra},encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:8*1024*1024});const e={args,code:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr,error:r.error?.message};events.push({kind:'git',...e});return e;};
 const must=(...args)=>{const r=git(args);if(r.code!==0)throw Error(JSON.stringify(r));return r.stdout.trimEnd();};const write=(p,bytes)=>{const d=path.join(repo,p);checkOwned(d);fs.mkdirSync(path.dirname(d),{recursive:true});fs.writeFileSync(d,bytes);};const read=p=>fs.existsSync(path.join(repo,p))?fs.readFileSync(path.join(repo,p),'utf8'):null;
 const call=async(label,action)=>{try{const result=await action(),r={ok:true,result};events.push({kind:'core',label,...r});return r;}catch(e){const r={ok:false,error:{code:e.code,message:e.message,details:e.details}};events.push({kind:'core',label,...r});return r;}};
 must('init','-b','main');must('config','core.autocrlf','false');must('config','core.hooksPath',process.platform==='win32'?'NUL':'/dev/null');must('config','commit.gpgsign','false');write('base.txt','base original\n');must('add','.');must('commit','-m','base');const app=await GitLayers.init(repo);
 const seed=async(n,p)=>{await app.create(n);await app.on(n);write(p,n+' original\n');await app.add(n,[p]);await app.commit(n,'seed '+n);};
 const state=()=>{const indexes={};const id=path.join(app.dir,'indexes');if(fs.existsSync(id))for(const n of fs.readdirSync(id)){const file=path.join(id,n);indexes[n]={sha256:hash(fs.readFileSync(file)),entries:git(['ls-files','--stage'],{GIT_INDEX_FILE:file}).stdout};}return {head:must('rev-parse','HEAD'),branch:must('symbolic-ref','--short','HEAD'),refs:must('for-each-ref','--format=%(refname) %(objectname)'),mainIndex:must('ls-files','--stage'),privateIndexes:indexes,workspace:JSON.parse(fs.readFileSync(path.join(app.dir,'workspace.json'),'utf8')),registry:JSON.parse(fs.readFileSync(path.join(app.dir,'registry.json'),'utf8')),exclude:fs.readFileSync(path.join(repo,'.git','info','exclude'),'utf8'),files:Object.fromEntries(['base.txt','renamed-base.txt','a.txt','b.txt','renamed-a.txt','between.txt'].map(p=>[p,read(p)]))};};
 const result={name,fixture:path.basename(dir),events};cases.push(result);try{result.observations=await fn({app,repo,env,write,read,must,git,call,seed,state});}catch(e){result.error={code:e.code,message:e.message};throw e;}finally{fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(result,null,2)+'\n');}
}
try{
 if(selected==='all'||selected==='rename-base')for(const route of ['external','managed'])await run('rename-base-'+route,async f=>{await f.seed('b','b.txt');await f.app.target('b');f.write('base.txt','unique base editing bytes\n');const before=f.state();const move=route==='external'?(fs.renameSync(path.join(f.repo,'base.txt'),path.join(f.repo,'renamed-base.txt')),{ok:true}):await f.call('renameFile base',()=>f.app.renameFile('base.txt','renamed-base.txt'));const status=await f.call('status',()=>f.app.status()),assigned=f.state();const refusal=await f.call('off b',()=>f.app.deactivate('b'));checkOwned(f.repo);const discard=await f.call('off b explicit fixture discard',()=>f.app.deactivate('b',{discard:true}));return {route,move,before,status,assigned,refusal,discard,after:f.state()};});
 if(selected==='all'||selected==='rename-layer')await run('rename-other-layer',async f=>{await f.seed('a','a.txt');await f.seed('b','b.txt');await f.app.target('b');f.write('a.txt','unique a editing bytes\n');const before=f.state();fs.renameSync(path.join(f.repo,'a.txt'),path.join(f.repo,'renamed-a.txt'));const status=await f.call('status',()=>f.app.status());const add=await f.call('add b',()=>f.app.add('b',['renamed-a.txt']));const commit=add.ok?await f.call('commit b',()=>f.app.commit('b','reproduction only')):null;return {before,status,add,commit,bBlob:f.git(['show','layer/b:renamed-a.txt']),aBlob:f.git(['show','layer/a:a.txt']),after:f.state()};});
 if(selected==='all'||selected==='race')await run('baseline-race',async f=>{await f.seed('a','a.txt');const before=f.state(),original=cp.spawn;let armed=true,barrier=null;cp.spawn=function(executable,args,options){if(armed&&options.cwd===f.repo&&args.includes('ls-files')&&args.includes('--others')&&args.includes('--exclude-standard')){armed=false;const external=cp.spawnSync(process.execPath,['-e',"require('node:fs').writeFileSync(process.argv[1], 'external concurrent bytes\\n')",path.join(f.repo,'between.txt')],{cwd:f.repo,env:f.env,encoding:'utf8',windowsHide:true});barrier={args,externalCode:external.status,stderr:external.stderr};if(external.status!==0)throw Error('External writer failed');}return original.call(this,executable,args,options);};syncBuiltinESMExports();let target;try{target=await f.call('target a with observed external write',()=>f.app.target('a'));}finally{cp.spawn=original;syncBuiltinESMExports();}const after=f.state(),status=await f.call('next status',()=>f.app.status()),reopen=await f.call('new open',()=>GitLayers.open(f.repo));return {before,barrier,target,after,status,reopenOk:reopen.ok,reopenError:reopen.error};});
 if(selected==='all'||selected==='control')await run('default-and-valid-baseline',async f=>{const phases=[];for(const n of [0,1,2]){if(n===1)await f.seed('a','a.txt');if(n===2)await f.seed('b','b.txt');f.write('native-'+n+'.txt','ordinary '+n+'\n');const add=f.git(['add','.']),staged=f.must('diff','--cached','--name-only'),commit=f.git(['commit','-m','ordinary '+n]),status=await f.call('status '+n,()=>f.app.status());phases.push({active:n,add,staged,commit,status});}const target=await f.call('target without external write',()=>f.app.target('a')),reopen=await f.call('reopen valid baseline',()=>GitLayers.open(f.repo));return {phases,target,reopenOk:reopen.ok,after:f.state()};});
}catch(e){process.exitCode=1;console.error(e.message);}finally{for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,previous);const out=path.join(root,'SUMMARY.json');fs.writeFileSync(out,JSON.stringify({schema:1,source,platform:process.platform,node:process.version,gitExe,selected,cases},null,2)+'\n');console.log(JSON.stringify({evidence:out,caseCount:cases.length,note:'Exit 0 means experiment completed; inspect observations for confirmed defects. Fixtures preserved.'},null,2));}
```

## Riscos nativos: receita compacta e observadores

Os casos detalhados e seus comandos reais estão em EVIDENCE.json. Para uma fixture nova com main/base.txt, crie develop com layer.txt rastreado e volte à main; inicialize Git Layer, crie/ative scripts, grave/prepare/commite layer.txt A nela, prepare B no índice da Layer e deixe C no disco. Compare uma fixture Git controle com layer.txt untracked comum e outra com ele ignored. Tire snapshots antes e depois de cada comando em fixtures independentes:

| Comando | Efeito observado |
| --- | --- |
| git switch develop / git checkout develop | Projeção ignored C substituída; controle ignored igual; untracked comum recusa. |
| git switch --no-overwrite-ignore develop / git checkout --no-overwrite-ignore develop | Recusa com C, HEAD e índices preservados. |
| git clean -fdx / git clean -fX | Remove projeções; -fX remove somente ignorados. C nunca preparado não tem recuperação garantida. |
| git reset --hard | No mesmo HEAD sem colisão preservou projeção não rastreada. |
| git reset --hard develop | Na colisão substituiu C; main continua selecionada e avança ao commit indicado. |
| git add -f -- new.txt | Antes da primeira observação coloca newcomer no índice principal. |
| .gitignore preexistente !new.txt; git add -A; git commit | Mesmo sem força, newcomer pode ir à base antes da reconciliação. |
| protect; git -C <reserva> status; git -C <reserva> commit -a -m ... | Reserva sem checkout mostra deleções; commit nativo cria árvore vazia na Layer, pai/projeção preservados. |

Observadores independentes: symbolic-ref/rev-parse HEAD; for-each-ref; ls-files --stage (principal e GIT_INDEX_FILE por subprocesso); diff --cached; ls-tree/show/cat-file; hashes/bytes/modos/ausências; registry/workspace/reservations; journals e diagnóstico. Para C perdido nos pares clean-X/reset, hash-object sem -w identificou o OID, cat-file confirmou sua ausência e a procura de payload exato nos metadados não encontrou cópia. Não fazer GC ou apagar índices para fabricar o resultado.

Para a reserva, obtenha seu caminho de worktree list --porcelain e estado do protect da própria fixture. Nunca deduza que qualquer worktree de um usuário é descartável. update-ref -d, worktree remove --force e branch rename foram usados só nessas raízes novas; o produto depois recusou ou recompôs explicitamente conforme a matriz.

## R-02/R-03: regressões existentes inalteradas

```powershell
node --import tsx --test --test-concurrency=1 --test-timeout=180000 tests/integration/review-target-preview.test.ts
```

Execução desta rodada: seis PASS, zero FAIL/SKIP, exit0. Não substitui suíte completa. Preview→criação externa→on/off também foi contraprova: colisão posterior impede on; novo arquivo posterior mantém off normal recusado; bytes preservados. Uma alteração interna de ref entre resolução de OID e switch não foi reproduzida e permanece hipótese explicitamente não testada.
