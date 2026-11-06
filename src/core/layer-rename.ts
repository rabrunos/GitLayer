import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { git, gitText, type RepoInfo } from './git.js';
import { updateDirectRefs } from './git-ref.js';
import { LabError } from './errors.js';
import { fingerprint, sameFingerprint, failpoint, type Fingerprint, type Transaction } from './storage.js';
import { OPEN_NOFOLLOW } from './platform.js';
import { collisionKey } from './paths.js';
import { releaseLayerProtection } from './branch-protection.js';

interface Snapshot { before:Fingerprint; backup:string|null }
interface RecordedSnapshot { fingerprint:Fingerprint; backup:string|null }
export interface LayerRenamePlan {
 kind:'rename'; protocol:'native-copy-cas-v1'; id:string; from:string; to:string; oid:string;
 config:Snapshot; sourceLog:Snapshot; targetLog:Snapshot;
 copied?:{config:RecordedSnapshot; targetLog:RecordedSnapshot}; finalConfig?:Fingerprint;
 phase:'planned'|'copied'|'retired'|'configured';
}
interface RenameRepo {root:string;gitDir:string;commonDir?:string}
interface Identity { id:string; ref:string; oid:string }
const absent:Fingerprint={exists:false,hash:'',mode:0};
function conflict(message:string):never{throw new LabError('RECOVERY_CONFLICT',message);}
function invalid(message:string):never{throw new LabError('RECOVERY_INVALID',message);}
const paths=(repo:RenameRepo,op:Pick<LayerRenamePlan,'from'|'to'>)=>({config:path.join(repo.commonDir??repo.gitDir,'config'),sourceLog:path.join(repo.commonDir??repo.gitDir,'logs',...op.from.split('/')),targetLog:path.join(repo.commonDir??repo.gitDir,'logs',...op.to.split('/'))});
const readRef=async(repo:RenameRepo,ref:string)=>(await git(repo.root,['rev-parse','--verify',ref],{ok:[0,128]})).stdout.toString().trim();
async function contents(file:string,expected:Fingerprint):Promise<Buffer>{if(!sameFingerprint(await fingerprint(file),expected))conflict('Arquivo mudou: '+file);const bytes=expected.exists?await fs.readFile(file):Buffer.alloc(0);if(!sameFingerprint(await fingerprint(file),expected))conflict('Arquivo mudou durante leitura: '+file);if(bytes.length>64*1024*1024)throw new LabError('RENAME_UNSUPPORTED','Config/reflog excede o limite de 64 MiB.');return bytes;}
function validFingerprint(value:any):value is Fingerprint{return value&&typeof value.exists==='boolean'&&Number.isInteger(value.mode)&&(value.exists?/^[a-f0-9]{64}$/.test(value.hash)&&value.mode>=0&&value.mode<=0o777:value.hash===''&&value.mode===0);}
async function noLocks(repo:RenameRepo,op:Pick<LayerRenamePlan,'from'|'to'>){const p=paths(repo,op);for(const file of [p.config+'.lock',p.sourceLog+'.lock',p.targetLog+'.lock',path.join(repo.commonDir??repo.gitDir,...op.from.split('/'))+'.lock',path.join(repo.commonDir??repo.gitDir,...op.to.split('/'))+'.lock',path.join(repo.commonDir??repo.gitDir,'packed-refs.lock')])if((await fingerprint(file)).exists)throw new LabError('LOCKED','Lock Git existente preservado: '+file);}
async function noCheckout(repo:RenameRepo,op:Pick<LayerRenamePlan,'from'|'to'>){const fields=(await git(repo.root,['worktree','list','--porcelain','-z'])).stdout.toString().split('\0');if(fields.some(field=>field==='branch '+op.from||field==='branch '+op.to))throw new LabError('RENAME_IN_USE','A branch está selecionada em um worktree; saia dela antes de renomear.');}
async function records(repo:RenameRepo,file:string){return (await git(repo.root,['config','--file',file,'--no-includes','--null','--list'])).stdout.toString().split('\0').filter(Boolean);}
function key(record:string){return record.split('\n',1)[0]!;}
async function copiedConfigIsSafe(repo:RenameRepo,op:LayerRenamePlan,file:string){
 const before=await records(repo,op.config.backup!),after=await records(repo,file),oldPrefix='branch.'+op.from.slice(11)+'.',newPrefix='branch.'+op.to.slice(11)+'.';
 const expected=before.filter(record=>key(record).startsWith(oldPrefix)).map(record=>newPrefix+record.slice(oldPrefix.length));
 if(JSON.stringify(after.filter(record=>!key(record).startsWith(newPrefix)))!==JSON.stringify(before)||JSON.stringify(after.filter(record=>key(record).startsWith(newPrefix)))!==JSON.stringify(expected))conflict('Configuração divergiu da cópia de branch esperada; nenhum dado será sobrescrito.');
}
function copiedLogIsSafe(bytes:Buffer,source:Buffer,op:LayerRenamePlan){if(!bytes.length&&!source.length)return true;if(!bytes.subarray(0,source.length).equals(source))return false;const suffix=bytes.subarray(source.length).toString();return new RegExp('^'+op.oid+' '+op.oid+' [^\\n]+\\tBranch: copied '+op.from+' to '+op.to+'\\n$','u').test(suffix);}
function rollbackLogIsSafe(bytes:Buffer,op:LayerRenamePlan,txId:string){return !bytes.length||new RegExp('^0{'+op.oid.length+'} '+op.oid+' [^\\n]+\\tGit Layer rollback rename '+txId+'\\n$','u').test(bytes.toString());}
/** Standard Git lock-file protocol plus before/after fingerprints; only our exact lock identity is removed. */
async function replaceCompared(file:string,expected:Fingerprint,bytes:Buffer|null,mode:number){
 await fingerprint(file);await fs.mkdir(path.dirname(file),{recursive:true});await fingerprint(file);const lock=file+'.lock';let handle:fs.FileHandle|undefined;let owned:Awaited<ReturnType<typeof fs.lstat>>|undefined;
 try{
  try{handle=await fs.open(lock,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|OPEN_NOFOLLOW,mode);}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new LabError('LOCKED','Lock existente preservado: '+lock);throw error;}
  owned=await handle.stat();if(!sameFingerprint(await fingerprint(file),expected))conflict('Arquivo mudou antes da publicação: '+file);
  if(bytes!==null){await handle.writeFile(bytes);await handle.chmod(mode);await handle.sync();}await handle.close();handle=undefined;
  const lockNow=await fs.lstat(lock);if(lockNow.dev!==owned.dev||lockNow.ino!==owned.ino||lockNow.isSymbolicLink())conflict('Lock próprio foi substituído.');
  if(!sameFingerprint(await fingerprint(file),expected))conflict('Arquivo mudou durante a publicação: '+file);
  if(bytes===null){if(expected.exists)await fs.unlink(file);}else await fs.rename(lock,file);
 }finally{
  await handle?.close();if(owned)try{const current=await fs.lstat(lock);if(current.dev!==owned.dev||current.ino!==owned.ino||current.isSymbolicLink())conflict('Lock próprio mudou; preservado para inspeção.');await fs.unlink(lock);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
}
async function snapshot(tx:Transaction,file:string,label:string):Promise<Snapshot>{const before=await fingerprint(file),backup=await tx.backup(file,label);if(!sameFingerprint(await fingerprint(file),before))conflict('Arquivo mudou antes do plano de rename.');return {before,backup};}
async function recorded(tx:Transaction,file:string,label:string):Promise<RecordedSnapshot>{const state=await snapshot(tx,file,label);return {fingerprint:state.before,backup:state.backup};}
async function sectionProbe(repo:RenameRepo,tx:Transaction,bytes:Buffer,section:string){const file=path.join(tx.dir,'rename-section-probe.config');await fs.writeFile(file,bytes,{flag:'wx'});const r=await git(repo.root,['config','--file',file,'--rename-section',section,'branch.git-layer-probe-'+randomUUID()],{ok:[0,128]});if(r.code!==0&&!/no such section/iu.test(r.stderr.toString()))throw new LabError('RENAME_UNSUPPORTED','Não foi possível validar a seção de destino.');return r.code===0;}

/** No source ref/config/log is changed by planning. Destination metadata is an occupied destination too. */
export async function prepareLayerRename(repo:RepoInfo,tx:Transaction,layer:Identity,target:string):Promise<LayerRenamePlan>{
 if(repo.gitDir!==repo.commonDir||(await gitText(repo.root,['rev-parse','--show-ref-format']))!=='files')throw new LabError('RENAME_UNSUPPORTED','Rename requer backend files e worktree principal.');
 for(const ref of [layer.ref,target])if(!ref.startsWith('refs/heads/layer/')||(await git(repo.root,['check-ref-format',ref],{ok:[0,1]})).code!==0)throw new LabError('INVALID_NAME','Ref de Layer inválida.');
 if(collisionKey(layer.ref)===collisionKey(target)||layer.ref.startsWith(target+'/')||target.startsWith(layer.ref+'/'))throw new LabError('RENAME_UNSUPPORTED','Rename entre aliases ou nomes ancestrais requer outro nome intermediário.');
 const op:LayerRenamePlan={kind:'rename',protocol:'native-copy-cas-v1',id:layer.id,from:layer.ref,to:target,oid:layer.oid,phase:'planned',config:{before:absent,backup:null},sourceLog:{before:absent,backup:null},targetLog:{before:absent,backup:null}};const p=paths(repo,op);
 await noLocks(repo,op);if(await readRef(repo,op.from)!==op.oid)throw new LabError('EXTERNAL_REF','A origem mudou antes do rename.');if(await readRef(repo,target))throw new LabError('LAYER_EXISTS','Branch de destino já existe.');
 for(const ref of [op.from,op.to])if((await git(repo.root,['symbolic-ref','--quiet',ref],{ok:[0,1,128]})).code===0)throw new LabError('RENAME_UNSUPPORTED','Refs simbólicas não são renomeadas por este protocolo.');
 const oldPrefix='branch.'+op.from.slice(11)+'.',newPrefix='branch.'+op.to.slice(11)+'.',audit=(await git(repo.root,['config','--null','--show-scope','--show-origin','--list'])).stdout.toString().split('\0');
 for(let i=0;i+2<audit.length;i+=3){const name=key(audit[i+2]!);if(name.startsWith(newPrefix))throw new LabError('LAYER_EXISTS','Configuração do destino já existe.');if(name.startsWith(oldPrefix)&&(audit[i]!=='local'||path.resolve(repo.root,audit[i+1]!.replace(/^file:/u,''))!==path.resolve(p.config)))throw new LabError('RENAME_UNSUPPORTED','Configuração da branch fora do config local principal é preservada; rename recusado.');}
 if((await fingerprint(p.targetLog)).exists)throw new LabError('LAYER_EXISTS','Reflog de destino já existe, mesmo sem branch.');
 const sourceLogState=await fingerprint(p.sourceLog);await contents(p.sourceLog,sourceLogState);
 const configState=await fingerprint(p.config);if(!configState.exists)throw new LabError('RENAME_UNSUPPORTED','Config local ausente.');if(await sectionProbe(repo,tx,await contents(p.config,configState),'branch.'+op.to.slice(11)))throw new LabError('LAYER_EXISTS','Seção de configuração do destino já existe.');
 op.config=await snapshot(tx,p.config,'rename-config-before');op.sourceLog=await snapshot(tx,p.sourceLog,'rename-source-log');op.targetLog=await snapshot(tx,p.targetLog,'rename-target-log');
 tx.data.recovery.refOperation=op;await tx.record('rename-native-planned');return op;
}
export async function applyLayerRename(repo:RepoInfo,tx:Transaction,op:LayerRenamePlan):Promise<void>{
 const p=paths(repo,op);await noLocks(repo,op);await noCheckout(repo,op);if(await readRef(repo,op.from)!==op.oid||await readRef(repo,op.to))conflict('Refs mudaram antes da cópia de branch.');
 for(const name of ['config','sourceLog','targetLog'] as const)if(!sameFingerprint(await fingerprint(p[name]),op[name].before))conflict('Metadados mudaram antes da cópia: '+name);
 await git(repo.root,['branch','-c',op.from.slice(11),op.to.slice(11)]);failpoint('after-rename-native-copy');
 // If interrupted before this durable snapshot, recovery refuses the ambiguous copy and preserves both refs/backups.
 await copiedConfigIsSafe(repo,op,p.config);const targetLog=await fingerprint(p.targetLog);if(!copiedLogIsSafe(await contents(p.targetLog,targetLog),await contents(op.sourceLog.backup??p.sourceLog,op.sourceLog.before),op))conflict('Reflog copiado divergiu da origem.');
 if(!sameFingerprint(await fingerprint(p.sourceLog),op.sourceLog.before)||await readRef(repo,op.from)!==op.oid||await readRef(repo,op.to)!==op.oid)conflict('Origem ou destino mudou durante a cópia.');
 op.copied={config:await recorded(tx,p.config,'rename-config-copied'),targetLog:await recorded(tx,p.targetLog,'rename-log-copied')};await copiedConfigIsSafe(repo,op,op.copied.config.backup!);if(!copiedLogIsSafe(await contents(op.copied.targetLog.backup??p.targetLog,op.copied.targetLog.fingerprint),await contents(op.sourceLog.backup??p.sourceLog,op.sourceLog.before),op))conflict('Reflog mudou antes do snapshot da cópia.');op.phase='copied';await tx.record('rename-native-copied');failpoint('after-rename-copy');
 const finalFile=path.join(tx.dir,'rename-final.config');await fs.writeFile(finalFile,await contents(p.config,op.copied.config.fingerprint),{flag:'wx',mode:op.copied.config.fingerprint.mode});const remove=await git(repo.root,['config','--file',finalFile,'--remove-section','branch.'+op.from.slice(11)],{ok:[0,128]});if(remove.code!==0&&!/no such section/iu.test(remove.stderr.toString()))conflict('Não foi possível preparar configuração final.');op.finalConfig=await fingerprint(finalFile);await tx.record('rename-final-config-prepared');
 await noLocks(repo,op);for(const [name,expected]of [['config',op.copied.config.fingerprint],['sourceLog',op.sourceLog.before],['targetLog',op.copied.targetLog.fingerprint]] as const)if(!sameFingerprint(await fingerprint(p[name]),expected))conflict('Metadados mudaram antes do CAS de rename.');
 await updateDirectRefs(repo.root,[{kind:'verify',ref:op.to,oldOid:op.oid},{kind:'delete',ref:op.from,oldOid:op.oid}]);op.phase='retired';await tx.record('rename-source-retired');failpoint('after-rename-retire');
 await replaceCompared(p.config,op.copied.config.fingerprint,await contents(finalFile,op.finalConfig),op.config.before.mode);if(!sameFingerprint(await fingerprint(p.config),op.finalConfig))conflict('Configuração final mudou após publicação.');op.phase='configured';await tx.record('rename-config-published');failpoint('after-rename-config');
}

/** Validate paths/backups before any recovery write. Old protocol journals remain handled by the caller. */
export async function validateLayerRenameRecovery(repo:RenameRepo,directory:string,data:any):Promise<void>{
 const op=data.recovery?.refOperation as LayerRenamePlan;if(op?.protocol!=='native-copy-cas-v1')return;
 if(data.kind!=='rename-layer'||!['planned','copied','retired','configured'].includes(op.phase)||!op.from?.startsWith('refs/heads/layer/')||!op.to?.startsWith('refs/heads/layer/')||!(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(op.oid)))invalid('Plano de rename nativo inválido.');
 for(const ref of [op.from,op.to])if((await git(repo.root,['check-ref-format',ref],{ok:[0,1]})).code!==0)invalid('Ref inválida no plano de rename.');
 const layer=data.recovery.beforeRegistry?.layers?.find((entry:any)=>entry.id===op.id);if(!layer||layer.ref!==op.from||layer.oid!==op.oid)invalid('Identidade de rename não corresponde ao estado anterior.');
 const p=paths(repo,op),backupDir=path.join(directory,'transactions',data.id,'backups');
 const verify=async(source:string,state:Snapshot|RecordedSnapshot)=>{const expected='before'in state?state.before:state.fingerprint;if(!validFingerprint(expected)||expected.exists!==(state.backup!==null))invalid('Snapshot de rename inválido.');if(state.backup){if(path.dirname(state.backup)!==backupDir||!sameFingerprint(await fingerprint(state.backup),expected))conflict('Backup do rename foi alterado.');}if(!data.backups.some((entry:any)=>entry.source===source&&entry.copy===state.backup&&sameFingerprint(entry.fingerprint,expected)))invalid('Snapshot de rename sem backup correspondente.');};
 for(const name of ['config','sourceLog','targetLog'] as const)await verify(p[name],op[name]);if(!op.config.before.exists||op.targetLog.before.exists)invalid('Estado anterior incompatível com rename sem overwrite.');
 if(op.copied){if(!op.copied.config?.fingerprint?.exists)invalid('Configuração copiada ausente.');await verify(p.config,op.copied.config);await verify(p.targetLog,op.copied.targetLog);await copiedConfigIsSafe(repo,op,op.copied.config.backup!);if(!copiedLogIsSafe(await contents(op.copied.targetLog.backup??p.targetLog,op.copied.targetLog.fingerprint),await contents(op.sourceLog.backup??p.sourceLog,op.sourceLog.before),op))invalid('Backup do reflog não corresponde à cópia nativa planejada.');}else if(op.phase!=='planned')invalid('Etapa de rename sem cópia validada.');if(op.finalConfig&&!validFingerprint(op.finalConfig)||['retired','configured'].includes(op.phase)&&!op.finalConfig)invalid('Configuração final inválida.');
 for(const file of Object.values(p))await fingerprint(file);
}
export async function rollbackLayerRename(repo:RenameRepo,directory:string,data:any):Promise<void>{
 await validateLayerRenameRecovery(repo,directory,data);const op=data.recovery.refOperation as LayerRenamePlan,p=paths(repo,op);await noLocks(repo,op);
 const from=await readRef(repo,op.from),to=await readRef(repo,op.to),config=await fingerprint(p.config),sourceLog=await fingerprint(p.sourceLog),targetLog=await fingerprint(p.targetLog);
 const original=from===op.oid&&!to&&sameFingerprint(config,op.config.before)&&sameFingerprint(sourceLog,op.sourceLog.before)&&!targetLog.exists;if(original)return;
 if(!op.copied)conflict('Cópia interrompida antes do retrato durável; ambas as refs e os backups foram preservados para inspeção.');
 const configKnown=[op.config.before,op.copied.config.fingerprint,...(op.finalConfig?[op.finalConfig]:[])].some(fp=>sameFingerprint(config,fp));if(!configKnown)conflict('Config mudou após rename; preservada.');
 if(from&&from!==op.oid||to&&to!==op.oid||!from&&!to)conflict('Refs mudaram após rename; nenhuma ref externa será removida.');
 if(to){if(!sameFingerprint(targetLog,op.copied.targetLog.fingerprint)||from&&!sameFingerprint(sourceLog,op.sourceLog.before)||!from&&sourceLog.exists)conflict('Reflog mudou após rename; dados preservados.');}
 else{if(!from||targetLog.exists||!sameFingerprint(sourceLog,op.sourceLog.before)&&!rollbackLogIsSafe(await contents(p.sourceLog,sourceLog),op,data.id))conflict('Rollback incompleto divergiu; reflogs preservados.');}
 // Validate reservation ownership before removing its ref; unknown holder content is never deleted.
 if((await fingerprint(path.join(directory,'branch-protection','state.json'))).exists)await releaseLayerProtection(repo.root,op.to.slice('refs/heads/layer/'.length));
 await noCheckout(repo,op);
 if(to){await updateDirectRefs(repo.root,[from?{kind:'verify',ref:op.from,oldOid:op.oid}:{kind:'create',ref:op.from,newOid:op.oid},{kind:'delete',ref:op.to,oldOid:op.oid}],'Git Layer rollback rename '+data.id);}
 const currentLog=await fingerprint(p.sourceLog);if(!sameFingerprint(currentLog,op.sourceLog.before)){
  if(!rollbackLogIsSafe(await contents(p.sourceLog,currentLog),op,data.id))conflict('Reflog da origem mudou durante rollback; preservado.');
  await replaceCompared(p.sourceLog,currentLog,op.sourceLog.before.exists?await contents(op.sourceLog.backup!,op.sourceLog.before):null,op.sourceLog.before.mode||0o600);
 }
 const now=await fingerprint(p.config);if(!sameFingerprint(now,op.config.before)){if(![op.copied.config.fingerprint,...(op.finalConfig?[op.finalConfig]:[])].some(fp=>sameFingerprint(now,fp)))conflict('Config mudou durante rollback.');await replaceCompared(p.config,now,await contents(op.config.backup!,op.config.before),op.config.before.mode);}
}
