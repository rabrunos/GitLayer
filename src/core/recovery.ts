import path from 'node:path';
import { lstat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { LabError } from './errors.js';
import { validOwnershipMetadata } from './ownership-state.js';
import { validateLayerRenameRecovery } from './layer-rename.js';
import { git, treeEntries } from './git.js';
import { comparableFileMode } from './platform.js';
import { collisionKey, safePath, validatePath } from './paths.js';
import { fingerprint, sameFingerprint, type Fingerprint } from './storage.js';
import { observeIndexIdentity, sameIndexIdentity, validDurableIndexIdentity, matchesDurableIndexIdentity } from './index-timestamp.js';

interface RecoveryRepo { root: string; gitDir: string; exclude: string; index: string }
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const object = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);
const oid = (value: unknown, allowEmpty = false): value is string => typeof value === 'string' && ((allowEmpty && value === '') || /^[0-9a-f]{4,128}$/.test(value));
const invalid = (message: string, details?: unknown): never => { throw new LabError('RECOVERY_INVALID', message, details); };

function validFingerprint(value: unknown): value is Fingerprint {
  if (!object(value) || typeof value.exists !== 'boolean' || typeof value.hash !== 'string' || !Number.isInteger(value.mode)) return false;
  return value.exists ? /^[0-9a-f]{64}$/.test(value.hash) && value.mode >= 0 && value.mode <= 0o777 : value.hash === '' && value.mode === 0;
}

function absolute(value: unknown): value is string {
  return typeof value === 'string' && path.isAbsolute(value) && path.resolve(value) === value && !/[\u0000\r\n]/.test(value);
}

async function branch(repo: RecoveryRepo, value: unknown): Promise<string> {
  if (typeof value !== 'string' || !value || value.startsWith('-') || /[\u0000\r\n]/.test(value)) invalid('Branch tradicional inválida no plano de recuperação.');
  const result = await git(repo.root, ['check-ref-format', `refs/heads/${value}`], { ok: [0, 1] });
  if (result.code !== 0) invalid('Referência de branch inválida no plano de recuperação.');
  return value as string;
}


interface RecoveryWorkspaceImage { kind:'rollback'|'forward-base'|'forward-layer'; path:string; bytes:Buffer; fingerprint:Fingerprint }

/** The original before/backup remain facts. This reducer only removes authority. */
export function recoveryBeforeWorkspace(data:any,workspace:any=data.recovery.beforeWorkspace):any {
  const result=structuredClone(workspace),intent=data.recovery.acknowledgements;
  if(intent){const removed=new Set<string>([...intent.revoked,...intent.pending]);if(result.acknowledgedMissing)result.acknowledgedMissing=result.acknowledgedMissing.filter((p:string)=>!removed.has(p));}
  return result;
}

function approvedRecoveryMetadata(repo:RecoveryRepo,dir:string,file:string):boolean {
    if (file === path.resolve(repo.index) || file === path.resolve(repo.exclude) || file === path.join(path.resolve(repo.gitDir), 'config')) return true;
    const relative = path.relative(dir, file).split(path.sep).join('/');
    if (relative === 'registry.json' || relative === 'workspace.json' || relative === 'capture.json') return true;
    if (/^(reservations|captures)\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.json$/.test(relative)) return true;
    if (/^indexes\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.index$/.test(relative)) return true;
    return /^shelves\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\/shelf\.json$/.test(relative);
}

/** Precompute approved index names only; lock existence is always observed afresh. */
export function recoveryIndexLockGuard(repo:RecoveryRepo,directory:string,plans:any|any[],additionalIndices:string[]=[]):()=>Promise<void>{
  const dir=path.resolve(directory),indices=new Set<string>([path.resolve(repo.index),...additionalIndices]);
  const privateIndex=(file:string)=>/^indexes\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.index$/u.test(path.relative(dir,file).split(path.sep).join('/'));
  for(const data of Array.isArray(plans)?plans:[plans]){
    for(const layer of data.recovery?.beforeRegistry?.layers??[])indices.add(path.join(dir,'indexes',layer.id+'.index'));
    for(const file of data.recovery?.files??[])if(privateIndex(file.path))indices.add(file.path);
  }
  for(const file of indices)if(file!==path.resolve(repo.index)&&!privateIndex(file))invalid('Índice fora do escopo de recuperação.');
  return async()=>{for(const index of indices){try{await lstat(index+'.lock');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}throw new LabError('LOCKED','Lock nativo de índice presente; recuperação preservou journals, índices e locks.',{path:index+'.lock'});}};
}

/** A managed add authorizes only its original Git context and planned checkpoint. */
export async function managedIndexContext(repo:RecoveryRepo,directory:string,data:any,expectedCheckpoint?:string,ownIndexLock=false):Promise<string>{
  const plan=data.recovery?.managedIndexPublication;if(!plan)return '';
  const before=data.recovery.beforeWorkspace,checkpoint='refs/git-layers/state/'+plan.layerId,working='refs/heads/'+before.branch;
  const locks=[repo.index+'.lock',...(ownIndexLock?[]:[plan.path+'.lock']),path.join(repo.gitDir,plan.ref+'.lock'),path.join(repo.gitDir,checkpoint+'.lock'),path.join(repo.gitDir,working+'.lock'),path.join(repo.gitDir,'packed-refs.lock')];
  const checkLocks=async()=>{for(const file of locks){try{await lstat(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}throw new LabError('LOCKED','Lock Git externo foi preservado durante staging gerenciado.',{path:file});}};
  await checkLocks();const result=await git(repo.root,['for-each-ref','--format=%(HEAD)%00%(refname)%00%(objectname)%00%(symref)',working,plan.ref,checkpoint]);
  const refs=new Map(result.stdout.toString().split('\n').filter(Boolean).map(line=>{const[head,ref,oid,symbolic]=line.split('\0');return[ref!,{head,oid,symbolic}];})),current=refs.get(checkpoint)?.oid;
  if([working,plan.ref,checkpoint].some(ref=>!!refs.get(ref)?.symbolic))throw new LabError('RECOVERY_CONFLICT','Referência simbólica externa foi preservada durante staging/recuperação.',{reason:'direct-ref-required',path:plan.path});
  if(refs.get(working)?.oid!==before.head||refs.get(working)?.head!=='*'||refs.get(plan.ref)?.oid!==plan.oid||!current||(expectedCheckpoint!==undefined?current!==expectedCheckpoint:current!==plan.checkpoint&&(!plan.checkpointPublished||current!==plan.tree)))throw new LabError('RECOVERY_CONFLICT','HEAD, ref ou checkpoint mudou depois da fronteira de staging; referências e índices externos preservados.',{reason:'managed-stage-context-changed',path:plan.path});
  await checkLocks();return current;
}

/** Reobserve a validated plan at each restore boundary; this does not authorize arbitrary paths. */
export async function recoveryFileState(repo:RecoveryRepo,directory:string,data:any,file:any):Promise<Fingerprint>{
  const index=file.path===path.resolve(repo.index)||/^indexes\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.index$/u.test(path.relative(path.resolve(directory),file.path).split(path.sep).join('/'));
  const noLock=async()=>{if(!index)return;try{await lstat(file.path+'.lock');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}throw new LabError('LOCKED','Lock nativo do índice apareceu durante a recuperação; índice, journal e lock foram preservados.',{path:file.path+'.lock'});};
  await noLock();
  const managed=data.recovery?.managedIndexPublication;
  if(managed)await managedIndexContext(repo,directory,data);
  if(managed?.path===file.path){
    const before=await observeIndexIdentity(file.path),current=await fingerprint(file.path),after=await observeIndexIdentity(file.path);
    const knownBefore=matchesDurableIndexIdentity(managed.before,after)&&sameFingerprint(current,file.before),knownAfter=managed.after!==null&&matchesDurableIndexIdentity(managed.after,after)&&sameFingerprint(current,file.after);
    if(!sameIndexIdentity(before,after)||!knownBefore&&!knownAfter)throw new LabError('RECOVERY_CONFLICT','Índice externo não corresponde à imagem BEFORE/AFTER duravelmente autorizada pelo staging; índice e journal preservados.',{reason:'managed-index-identity-changed',path:file.path});
    await managedIndexContext(repo,directory,data);await noLock();return current;
  }
  const creation=data.recovery?.createdIndexPublication;
  if(creation?.path===file.path){
    const before=await observeIndexIdentity(file.path),current=await fingerprint(file.path),after=await observeIndexIdentity(file.path);
    const knownBefore=before===null&&after===null&&sameFingerprint(current,file.before),knownAfter=matchesDurableIndexIdentity(creation.after,after)&&sameFingerprint(current,file.after);
    if(!sameIndexIdentity(before,after)||!knownBefore&&!knownAfter)throw new LabError('RECOVERY_CONFLICT','A identidade do índice criado não corresponde à publicação duravelmente autorizada; índice e journal preservados.',{reason:'created-index-identity-changed',path:file.path});
    await noLock();return current;
  }
  const publication=data.recovery?.activationIndexPublication;
  if(publication?.path===file.path){
    const before=await observeIndexIdentity(file.path),current=await fingerprint(file.path),after=await observeIndexIdentity(file.path);
    const knownBefore=matchesDurableIndexIdentity(publication.before,after)&&sameFingerprint(current,file.before),knownAfter=matchesDurableIndexIdentity(publication.after,after)&&sameFingerprint(current,file.after);
    if(!sameIndexIdentity(before,after)||!knownBefore&&!knownAfter)throw new LabError('RECOVERY_CONFLICT','A identidade ou fronteira temporal do índice de ativação não corresponde à imagem duravelmente autorizada. Índice, journal e backups foram preservados.',{reason:'activation-index-identity-changed',path:file.path});
    await noLock();return current;
  }
  const current=await fingerprint(file.path);if(managed)await managedIndexContext(repo,directory,data);await noLock();return current;
}

/** Read original facts only; absence of an optional legacy workspace plan creates no backup. */
async function readRecoveryWorkspaceBackup(directory:string,data:any,required=false){
  const file=path.join(path.resolve(directory),'workspace.json');
  const entry=data.recovery.files.find((f:any)=>f.path===file);
  if(!entry?.before.exists||!entry.backup){
    if(required)invalid('Revogação de confirmações sem backup original do workspace.');
    return undefined;
  }
  const original=await readFile(entry.backup);
  if(createHash('sha256').update(original).digest('hex')!==entry.before.hash)throw new LabError('RECOVERY_CONFLICT','Backup do workspace mudou durante a derivação.');
  let workspace:any;try{workspace=JSON.parse(original.toString('utf8'));}catch{invalid('Backup do workspace não contém JSON válido.');}
  if(!object(workspace)||!validOwnershipMetadata(workspace)||JSON.stringify(workspace.acknowledgedMissing??[])!==JSON.stringify(data.recovery.beforeWorkspace.acknowledgedMissing??[]))invalid('Confirmações do backup não correspondem ao workspace anterior.');
  return {file,entry,workspace};
}
/** An uncertain or observed publication cannot be treated as an unchanged absent before. */
export function assertRecoveryMaterializationState(repo:RecoveryRepo,directory:string,file:any,current:Fingerprint):void {
  if(approvedRecoveryMetadata(repo,path.resolve(directory),file.path)||file.before.exists||current.exists)return;
  const relative=path.relative(path.resolve(repo.root),file.path).split(path.sep).join('/');
  throw new LabError('RECOVERY_CONFLICT','A publicação de um arquivo do workspace está ausente ou incerta. A ausência atual pode ser estado anterior, edição externa ou rollback parcial; a recuperação exige inspeção. Journal e backups preservados; execute doctor e recovery-export.',{reason:'workspace-materialization-disappeared',paths:[{path:relative,beforePresent:false,afterRecorded:file.after!==undefined,recordedAfterPresent:file.after?.exists===true,present:false}]});
}
/** A legacy/incomplete plan cannot regrant absence authority beside known materialization. */
async function assertRecoveryMaterializationSafe(repo:RecoveryRepo,directory:string,data:any):Promise<void>{
  // The new protocol checks the same immutable backup in recoveryWorkspaceImages.
  if(data.recovery.acknowledgements===undefined)await readRecoveryWorkspaceBackup(directory,data);
  for(const file of data.recovery.files){
    if(!approvedRecoveryMetadata(repo,path.resolve(directory),file.path)&&file.before.exists===false)assertRecoveryMaterializationState(repo,directory,file,await fingerprint(file.path));
  }
  const retained:string[]=recoveryBeforeWorkspace(data).acknowledgedMissing??[];
  if(!retained.length)return;
  const conflicts:{path:string;present:boolean;restorable:boolean;recordedAfterPresent:boolean}[]=[];
  for(const relative of retained){
    const full=await safePath(repo.root,relative);
    const recorded=data.recovery.files.find((entry:any)=>entry.path===full);
    const current=await fingerprint(full);
    const restorable=recorded?.before.exists===true,recordedAfterPresent=recorded?.after?.exists===true;
    if(current.exists||restorable||recordedAfterPresent)conflicts.push({path:relative,present:current.exists,restorable,recordedAfterPresent});
  }
  if(conflicts.length)throw new LabError('RECOVERY_CONFLICT','A recuperação não pode repor confirmação de ausência de caminho presente ou materializado sem revogação durável. Journal, arquivos e backups preservados; execute doctor e recovery-export antes de decidir.',{reason:'acknowledged-materialization-without-revocation',paths:conflicts});
}
/** Call only after the complete recovery plan was validated. No arbitrary hash is trusted. */
export async function recoveryWorkspaceImages(repo:RecoveryRepo,directory:string,data:any):Promise<RecoveryWorkspaceImage[]> {
  const intent=data.recovery.acknowledgements;
  if(!intent)return [];
  const {file,entry,workspace}=(await readRecoveryWorkspaceBackup(directory,data,true))!;
  const removed=[...intent.revoked,...intent.pending];
  const image=(kind:RecoveryWorkspaceImage['kind'],value:any,mode:number):RecoveryWorkspaceImage=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');return {kind,path:file,bytes,fingerprint:{exists:true,hash:createHash('sha256').update(bytes).digest('hex'),mode}};};
  const images:RecoveryWorkspaceImage[]=removed.length?[image('rollback',recoveryBeforeWorkspace(data,workspace),entry.before.mode)]:[];
  const commit=data.recovery.commit;
  if(commit){
    const base=commit.base===true,previous=data.recovery.beforeWorkspace;
    if(!base){
      const head=await git(repo.root,['rev-parse','--verify','HEAD'],{ok:[0,128]}),branch=await git(repo.root,['symbolic-ref','--quiet','--short','HEAD'],{ok:[0,1]});
      if(head.code!==0||branch.code!==0||head.stdout.toString().trim()!==previous.head||branch.stdout.toString().trim()!==previous.branch)throw new LabError('RECOVERY_CONFLICT','HEAD mudou após o commit da Layer interrompido; estado e journal preservados.');
    }
    // Only the new protocol reconstructs Layer metadata from its exact before.
    // Ordinary creations can be reconciled again after conservative recovery.
    const forward=base?{...recoveryBeforeWorkspace(data),schema:1,head:commit.new,branch:previous.branch}:recoveryBeforeWorkspace(data);
    const normalizationHead=base?commit.new:previous.head;
    // Exactly the ownership normalization performed by save() on this HEAD tree.
    if(forward.baseReservations?.length){const committed=new Set((await treeEntries(repo.root,normalizationHead)).map(e=>e.path));if(forward.editing)forward.editing.acceptedBase=[...new Set([...forward.editing.acceptedBase??[],...forward.baseReservations.filter((p:string)=>committed.has(p))])];forward.baseReservations=forward.baseReservations.filter((p:string)=>!committed.has(p));}
    images.push(image(base?'forward-base':'forward-layer',forward,comparableFileMode(0o600)));
  }
  return images;
}

/**
 * Recovery is a write boundary: a JSON journal cannot authorize arbitrary paths.
 * Validate the complete plan before restoring even its first file.
 */
export async function validateRecovery(repo: RecoveryRepo, directory: string, data: any): Promise<void> {
  const dir = path.resolve(directory);
  if (![path.join(path.resolve(repo.gitDir), 'git-layers'), path.join(path.resolve(repo.gitDir), 'layers')].includes(dir)) invalid('Diretório de recuperação incompatível com o repositório.');
  if (!object(data) || data.schema !== 1 || !safeId(data.id) || !object(data.recovery)) invalid('Journal sem plano de recuperação válido.');
  const recovery = data.recovery;
  const beforeRegistry = recovery.beforeRegistry;
  const beforeWorkspace = recovery.beforeWorkspace;
  if (!object(beforeRegistry) || beforeRegistry.schema !== 1 || !Array.isArray(beforeRegistry.layers)) invalid('Registry anterior ausente ou inválido no journal.');
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const layer of beforeRegistry.layers) {
    if (!object(layer) || !safeId(layer.id) || typeof layer.name !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}_/-]*$/u.test(layer.name) || layer.name.split('/').some((component: string) => !component || component === '.' || component === '..' || component === '.git') || layer.name.includes('..') || layer.ref !== `refs/heads/layer/${layer.name}` || !oid(layer.oid) || !oid(layer.indexBase) || !['inactive', 'active', 'parked', 'recovery-required'].includes(layer.state) || !Array.isArray(layer.reservations) || (layer.shelf !== undefined && !safeId(layer.shelf))) invalid('Layer inválida no estado anterior do journal.');
    const validRef = await git(repo.root, ['check-ref-format', layer.ref], { ok: [0, 1] });
    if (validRef.code !== 0) invalid('Referência de Layer inválida no journal.');
    if (ids.has(layer.id) || names.has(layer.name)) invalid('Layers duplicadas no estado anterior do journal.');
    ids.add(layer.id); names.add(layer.name);
    for (const reserved of layer.reservations) validatePath(reserved);
  }
  if (!object(beforeWorkspace) || beforeWorkspace.schema !== 1 || !oid(beforeWorkspace.head, true)) invalid('Workspace anterior ausente ou inválido no journal.');
  if(!validOwnershipMetadata(beforeWorkspace))invalid('Propriedade anterior inválida no journal.');
  await branch(repo, beforeWorkspace.branch);
  for(const key of ['branchLayer','resumeLayer','returnBranch'])if(beforeWorkspace[key]!==undefined&&(typeof beforeWorkspace[key]!=='string'||!beforeWorkspace[key]))invalid('Papel opcional inválido no workspace anterior.');
  if(beforeWorkspace.branchLayer!==undefined){const layer=beforeRegistry.layers.find((entry:any)=>entry.name===beforeWorkspace.branchLayer);if(!layer||layer.state!=='inactive'||beforeWorkspace.branch!=='layer/'+layer.name)invalid('Papel Layer como branch não corresponde ao estado anterior.');}
  if(beforeWorkspace.branch.startsWith('layer/')&&beforeWorkspace.branchLayer!==beforeWorkspace.branch.slice(6))invalid('Branch Layer anterior sem papel explícito correspondente.');
  if(beforeWorkspace.resumeLayer!==undefined&&beforeWorkspace.resumeLayer!==beforeWorkspace.branchLayer)invalid('Retomada não corresponde à branch Layer anterior.');
  if(beforeWorkspace.returnBranch!==undefined)await branch(repo,beforeWorkspace.returnBranch);
  if(beforeWorkspace.editing!==undefined){
    const editing=beforeWorkspace.editing;if(!object(editing)||typeof editing.layer!=='string'||typeof editing.startedAt!=='string'||!Number.isFinite(Date.parse(editing.startedAt)))invalid('Destino de edição anterior inválido.');
    if(!beforeRegistry.layers.some((layer:any)=>layer.name===editing.layer&&layer.state==='active'&&layer.name!==beforeWorkspace.branchLayer))invalid('Destino de edição anterior sem Layer ativa correspondente.');
    const paths=(value:any):string[]=>{if(!Array.isArray(value)||value.some(path=>typeof path!=='string')||new Set(value).size!==value.length)invalid('Baseline de edição inválida ou duplicada.');for(const entry of value){try{validatePath(entry);}catch{invalid('Caminho inválido na baseline de edição.');}}return value;};
    const before=paths(editing.before);if(editing.unassigned!==undefined&&paths(editing.unassigned).some(path=>!before.includes(path)))invalid('Exceção de edição fora da baseline observada.');
  }
  const acknowledgements=recovery.acknowledgements;
  if(acknowledgements!==undefined){
    if(!object(acknowledgements)||Object.keys(acknowledgements).sort().join(',')!=='pending,revoked')invalid('Plano de revogação de confirmações inválido.');
    const previous=beforeWorkspace.acknowledgedMissing??[];
    for(const key of ['revoked','pending']){
      const paths=acknowledgements[key];if(!Array.isArray(paths))invalid('Lista de revogação inválida.');
      for(const p of paths){if(typeof p!=='string'||!previous.includes(p))invalid('Revogação fora das confirmações anteriores.');try{validatePath(p);}catch{invalid('Caminho de revogação inválido.');}}
    }
    const all=[...acknowledgements.revoked,...acknowledgements.pending];
    if(new Set(all.map(collisionKey)).size!==all.length)invalid('Revogações duplicadas ou conflitantes por caixa/Unicode.');
  }
  if (!Array.isArray(recovery.files) || !Array.isArray(data.backups)) invalid('Lista de arquivos/backups de recuperação ausente.');
  const journalDir = path.join(dir, 'transactions', data.id);
  const backupDir = path.join(journalDir, 'backups');

  const paths = new Set<string>();
  for (const file of recovery.files) {
    if (!object(file) || !absolute(file.path) || !validFingerprint(file.before) || (file.after !== undefined && !validFingerprint(file.after)) || (file.backup !== null && !absolute(file.backup))) invalid('Arquivo ou fingerprint inválido no plano de recuperação.');
    if (paths.has(file.path)) invalid('Arquivo duplicado no plano de recuperação.', { path: file.path });
    paths.add(file.path);
    if (!approvedRecoveryMetadata(repo,dir,file.path)) {
      const relative = path.relative(path.resolve(repo.root), file.path).split(path.sep).join('/');
      if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) invalid('Recuperação tentou acessar um caminho fora do workspace.', { path: file.path });
      const resolved = await safePath(repo.root, relative);
      if (resolved !== file.path) invalid('Caminho de recuperação não corresponde ao workspace.', { path: file.path });
    }
    // Also reject links/special files in approved internal paths and ancestors.
    await fingerprint(file.path);
    if (file.before.exists !== (file.backup !== null)) invalid('Backup incompatível com o estado anterior do arquivo.', { path: file.path });
    if (file.backup !== null) {
      if (path.dirname(file.backup) !== backupDir || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,220}$/.test(path.basename(file.backup))) invalid('Backup fora do diretório privado desta transação.', { backup: file.backup });
      const copied = await fingerprint(file.backup);
      if (!sameFingerprint(copied, file.before)) throw new LabError('RECOVERY_CONFLICT', 'O backup está ausente ou foi modificado. Nenhum arquivo foi restaurado.', { path: file.path, backup: file.backup });
    }
    const recorded = data.backups.find((entry: any) => object(entry) && entry.source === file.path && entry.copy === file.backup && validFingerprint(entry.fingerprint) && sameFingerprint(entry.fingerprint, file.before));
    if (!recorded) invalid('O arquivo não possui um backup correspondente no journal.', { path: file.path });
  }
  if (recovery.directories !== undefined) {
    if (!['deactivate','remove-layer'].includes(data.kind) || !Array.isArray(recovery.directories)) invalid('Plano de diretórios inválido para esta transação.');
    const directories = new Set<string>();
    const spellings = new Map<string, string>();
    for (const entry of recovery.directories) {
      if (!object(entry) || !absolute(entry.path) || !Number.isInteger(entry.mode) || entry.mode < 0 || entry.mode > 0o777 || directories.has(entry.path)) invalid('Diretório inválido ou duplicado no plano de recuperação.');
      directories.add(entry.path);
      const relative = path.relative(path.resolve(repo.root), entry.path).split(path.sep).join('/');
      if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) invalid('Diretório de recuperação fora do workspace.');
      for (let parent = relative; parent !== '.'; parent = path.posix.dirname(parent)) {
        const key = collisionKey(parent);
        if (spellings.has(key) && spellings.get(key) !== parent) invalid('Diretórios de recuperação diferem apenas por caixa/Unicode.');
        spellings.set(key, parent);
      }
      if (await safePath(repo.root, relative) !== entry.path) invalid('Diretório de recuperação incompatível com o workspace.');
      try {
        if (!(await lstat(entry.path)).isDirectory()) throw new LabError('RECOVERY_CONFLICT', `Um arquivo passou a ocupar o diretório: ${relative}`);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  if(recovery.refOperation!==undefined){const op=recovery.refOperation;const layer=beforeRegistry.layers.find((l:any)=>l.id===op?.id);if(!layer||!['rename','delete'].includes(op.kind)||op.from!==layer.ref||op.oid!==layer.oid)invalid('Operação de ref inválida.');if(op.kind==='rename'){if(typeof op.to!=='string'||!op.to.startsWith('refs/heads/layer/'))invalid('Destino de rename inválido.');await branch(repo,op.to.slice(11));}if(op.protocol!==undefined){if(op.kind!=='rename'||op.protocol!=='native-copy-cas-v1')invalid('Protocolo de ref desconhecido.');await validateLayerRenameRecovery(repo,dir,data);}}
  if (recovery.commit !== undefined) {
    const commit = recovery.commit;
    if (!object(commit) || !oid(commit.old, true) || !oid(commit.new) || typeof commit.ref !== 'string') invalid('Plano de commit inválido.');
    if (commit.base === true) {
      if (commit.ref !== `refs/heads/${beforeWorkspace.branch}` || commit.old !== beforeWorkspace.head) invalid('Commit da base não corresponde ao estado anterior.');
    } else {
      const layer = beforeRegistry.layers.find((entry: any) => entry.id === commit.layerId);
      if (!layer || commit.ref !== layer.ref || commit.old !== layer.oid) invalid('Commit de Layer não corresponde ao estado anterior.');
    }
  }
  if (recovery.switch !== undefined) {
    const planned = recovery.switch;
    if (!object(planned) || !oid(planned.fromOid) || !oid(planned.toOid) || planned.from !== beforeWorkspace.branch || planned.fromOid !== beforeWorkspace.head) invalid('Plano de troca de branch inválido.');
    await branch(repo, planned.from); await branch(repo, planned.to);
    if(planned.to.startsWith('layer/')&&(planned.openingName!==planned.to.slice(6)||!beforeRegistry.layers.some((l:any)=>l.name===planned.openingName)))invalid('Entrada Layer como branch não explícita no plano.');
    if(planned.from.startsWith('layer/')&&beforeWorkspace.branchLayer!==planned.from.slice(6))invalid('Saída Layer como branch sem estado anterior correspondente.');
    if(planned.resumeName&&planned.resumeName!==beforeWorkspace.branchLayer)invalid('Retomada de Layer inválida.');
  }
  if(recovery.managedIndexPublication!==undefined){
    const plan=recovery.managedIndexPublication,layer=object(plan)&&beforeRegistry.layers.find((entry:any)=>entry.id===plan.layerId);
    if(data.kind!=='stage'||!object(plan)||Object.keys(plan).sort().join(',')!=='after,before,checkpoint,checkpointPublished,layerId,oid,path,ref,tree'||typeof plan.checkpointPublished!=='boolean'||plan.checkpointPublished&&plan.tree===null||!layer||plan.path!==path.join(dir,'indexes',layer.id+'.index')||plan.ref!==layer.ref||plan.oid!==layer.oid||!oid(plan.checkpoint)||!validDurableIndexIdentity(plan.before)||beforeWorkspace.branchLayer===layer.name||recovery.createdIndexPublication!==undefined||recovery.activationIndexPublication!==undefined)invalid('Plano de staging gerenciado inválido.');
    const file=recovery.files.find((entry:any)=>entry.path===plan.path);
    if(!file?.before.exists||!file.backup||(plan.after===null?plan.tree!==null||file.after!==undefined:!validDurableIndexIdentity(plan.after)||!oid(plan.tree)||!file.after?.exists))invalid('Imagens BEFORE/AFTER do staging gerenciado inválidas.');
    for(const tree of [plan.checkpoint,...(plan.tree===null?[]:[plan.tree])])if((await git(repo.root,['cat-file','-t',tree])).stdout.toString().trim()!=='tree')invalid('Checkpoint de staging não é árvore Git.');
    await recoveryFileState(repo,dir,data,file);
  }
  if(recovery.managedIndexConflict!==undefined){
    const conflict=recovery.managedIndexConflict,plan=recovery.managedIndexPublication;
    if(!object(conflict)||Object.keys(conflict).sort().join(',')!=='path,reason'||conflict.path!==plan?.path||conflict.reason!=='source-changed')invalid('Marcador de conflito de staging inválido.');
    throw new LabError('RECOVERY_CONFLICT','Staging externo detectado; plano, índice e referências preservados.',{reason:'managed-index-conflict',path:conflict.path});
  }
  if(recovery.createdIndexPublication!==undefined){
    const creation=recovery.createdIndexPublication;
    if(!['create','register','activate'].includes(data.kind)||!object(creation)||Object.keys(creation).sort().join(',')!=='after,path'||!absolute(creation.path)||path.dirname(creation.path)!==path.join(dir,'indexes')||!/^[-A-Za-z0-9]+\.index$/u.test(path.basename(creation.path))||!validDurableIndexIdentity(creation.after)||recovery.activationIndexPublication!==undefined)invalid('Testemunho de criação de índice inválido.');
    const file=recovery.files.find((entry:any)=>entry.path===creation.path);
    if(!file||file.before.exists||file.backup!==null||!file.after?.exists)invalid('Testemunho de criação sem ausência BEFORE/AFTER correspondente.');
    await recoveryFileState(repo,dir,data,file);
  }
  if(recovery.activationIndexPublication!==undefined){
    const publication=recovery.activationIndexPublication;
    if(data.kind!=='activate'||!object(publication)||Object.keys(publication).sort().join(',')!=='after,before,path'||!absolute(publication.path)||path.dirname(publication.path)!==path.join(dir,'indexes')||!/^[-A-Za-z0-9]+\.index$/u.test(path.basename(publication.path))||!validDurableIndexIdentity(publication.before)||!validDurableIndexIdentity(publication.after))invalid('Testemunho de publicação do índice de ativação inválido.');
    const file=recovery.files.find((entry:any)=>entry.path===publication.path);
    if(!file||!file.before.exists||!file.after?.exists)invalid('Testemunho de índice sem BEFORE/AFTER correspondente.');
    await recoveryFileState(repo,dir,data,file);
  }
  if(recovery.activationIndexConflict!==undefined){
    const conflict=recovery.activationIndexConflict;
    if(!object(conflict)||Object.keys(conflict).sort().join(',')!=='path,reason'||conflict.reason!=='identity-changed'||!absolute(conflict.path)||path.dirname(conflict.path)!==path.join(dir,'indexes')||!/^[-A-Za-z0-9]+\.index$/u.test(path.basename(conflict.path))||!recovery.files.some((file:any)=>file.path===conflict.path))invalid('Conflito de identidade do índice de ativação inválido.');
    throw new LabError('RECOVERY_CONFLICT','A identidade física do índice publicado mudou externamente. Igualdade de bytes não autoriza restaurar seu timestamp ou staging anterior; journal, índice e backups foram preservados.',{reason:'activation-index-identity-changed',path:conflict.path});
  }
  if(acknowledgements!==undefined)await recoveryWorkspaceImages(repo,dir,data);
  await assertRecoveryMaterializationSafe(repo,dir,data);
}
