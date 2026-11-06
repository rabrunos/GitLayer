import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { git, gitText, discover, assertSupported, assertDirectManagedRefs, assertAttributes, treeEntries, type RepoInfo, type GitEntry } from './git.js';
import { updateDirectRef, deleteDirectRef, updateDirectRefs } from './git-ref.js';
import { validatePath, safePath, walk, assertNoCollisions, collisionKey } from './paths.js';
import { LabError } from './errors.js';
import { releaseLayerProtection, reserveLayerProtection, inspectBranchProtection } from './branch-protection.js';
import { resolveLayerDirectory } from './layout.js';
import { ignoredWithoutManagedExcludes } from './ignore.js';
import { doctorRepository, exportRepositoryRecovery } from './rescue.js';
import { comparableFileMode, gitPath } from './platform.js';
import { validateRecovery, recoveryBeforeWorkspace, recoveryWorkspaceImages, assertRecoveryMaterializationState, recoveryFileState, recoveryIndexLockGuard, managedIndexContext } from './recovery.js';
import { validOwnershipMetadata, type EditingOwnership, type WorkspaceOwnership } from './ownership-state.js';
import { captureEditingBoundary } from './editing-boundary.js';
import { stageIndex, stageIndexWithProof, publishPreparedIndexImage, type PublishedStagedIndex, type ManagedStageProof } from './index-stage.js';
import { prepareActivationSource, activationChanged, type ActivationSource, type ActivationIndexBinding } from './activation-source.js';
import { queryIndexDiff, queryIndexTree } from './index-query.js';
import { observeIndexIdentity, sameIndexIdentity, preserveIndexTimestamp, durableIndexIdentity, matchesDurableIndexIdentity, type IndexIdentity } from './index-timestamp.js';
import { prepareLayerRename, applyLayerRename, rollbackLayerRename } from './layer-rename.js';
import { publishNewFile } from './publication.js';
import { prepareProjectionCleanup } from './disposable-projection.js';
import { atomicJSON, readJSON, withLock, Transaction, listTransactions, fingerprint, fingerprintGitBlob, sameFingerprint, copyRegular, failpoint, type Fingerprint } from './storage.js';
export { LabError, git, gitText, validatePath };
export interface Layer { id:string; name:string; ref:string; oid:string; indexBase:string; state:'inactive'|'active'|'parked'|'recovery-required'; reservations:string[]; shelf?:string; remote?:string }
interface Registry { schema:1; layers:Layer[] }
interface Workspace extends WorkspaceOwnership { schema:1; head:string; branch:string; branchLayer?:string; resumeLayer?:string; returnBranch?:string; editing?:EditingOwnership & {layer:string; before:string[]; unassigned?:string[]; startedAt:string} }
interface Change { path:string; status:string }
interface RecoveryFile { path:string; backup:string|null; before:any; after?:any }
interface ManagedStageBoundary {path:string;check:(ownLock?:boolean)=>Promise<void>;planned:(after:any,identity:IndexIdentity,proof?:ManagedStageProof)=>Promise<void>;published:(image:PublishedStagedIndex)=>void;tree:()=>string;checkpoint:()=>string;checkpointed:()=>Promise<void>}
const BEGIN='# >>> Git Layers Lab managed paths >>>';
const END='# <<< Git Layers Lab managed paths <<<';
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const exists=async(p:string)=>fs.lstat(p).then(()=>true,()=>false);
const SAFE_ID=/^[a-zA-Z0-9-]+$/;
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
const identity={GIT_AUTHOR_NAME:'Git Layers Lab internal',GIT_AUTHOR_EMAIL:'internal@git-layers.invalid',GIT_COMMITTER_NAME:'Git Layers Lab internal',GIT_COMMITTER_EMAIL:'internal@git-layers.invalid'};

type EditingObservation={missing:{path:string;owner:string|null}[];candidates:string[];fresh:string[];externalBase:string[];disk:string[]};

/** Shared domain service. No checkout of Layers and no synthetic HEAD. */
export class GitLayers {
  repo:RepoInfo; dir:string; private registry:Registry={schema:1,layers:[]}; private workspace:Workspace;
  private tx?:Transaction; private recoveryFiles:RecoveryFile[]=[]; private recoveryFileMap=new Map<string,RecoveryFile>(); private publicationCheck?:()=>Promise<void>; private transactionTrees?:Map<string,GitEntry[]>; private projectionCleanup?:()=>Promise<unknown>; private activationSource?:ActivationSource; private managedStage?:ManagedStageBoundary; private transactionFinalCheck?:()=>Promise<void>; private validatedIndexes=new Map<string,ActivationIndexBinding>();
  private constructor(repo:RepoInfo,dir:string){this.repo=repo;this.dir=dir;this.workspace={schema:1,head:repo.head,branch:repo.branch};}
  static async open(root:string):Promise<GitLayers>{const repo=await discover(root);const lab=new GitLayers(repo,await resolveLayerDirectory(repo.gitDir));await lab.load();return lab;}
  static async init(root:string):Promise<GitLayers>{await fs.mkdir(root,{recursive:true});try{await discover(root);}catch(e){if(await exists(path.join(root,'.git')))throw e;await git(root,['init','-b','main']);} const lab=await GitLayers.open(root);await lab.init();return lab;}
  private async load(){
    if(await exists(path.join(this.dir,'registry.json'))){
      this.registry=await readJSON<Registry>(path.join(this.dir,'registry.json'),v=>Array.isArray(v.layers)&&v.layers.every((l:any)=>typeof l.id==='string'&&/^[a-zA-Z0-9-]+$/.test(l.id)&&typeof l.name==='string'&&l.ref===`refs/heads/layer/${l.name}`&&typeof l.oid==='string'&&typeof l.indexBase==='string'&&/^[0-9a-f]{40,64}$/.test(l.oid)&&/^[0-9a-f]{40,64}$/.test(l.indexBase)&&(l.shelf===undefined||typeof l.shelf==='string')&&(l.remote===undefined||typeof l.remote==='string')&&['inactive','active','parked','recovery-required'].includes(l.state)&&Array.isArray(l.reservations)&&l.reservations.every((p:any)=>typeof p==='string')));
      if(new Set(this.registry.layers.map(l=>l.id)).size!==this.registry.layers.length||new Set(this.registry.layers.map(l=>l.name)).size!==this.registry.layers.length)throw new LabError('METADATA_INVALID','Layers duplicadas nos metadados.');
      for(const l of this.registry.layers){this.name(l.name);for(const p of l.reservations)validatePath(p);if(l.shelf&&!/^[a-zA-Z0-9-]+$/.test(l.shelf))throw new LabError('METADATA_INVALID','Shelf inválida.');}
      this.workspace=await readJSON<Workspace>(path.join(this.dir,'workspace.json'),v=>typeof v.head==='string'&&typeof v.branch==='string'&&(v.branchLayer===undefined||typeof v.branchLayer==='string')&&(v.resumeLayer===undefined||typeof v.resumeLayer==='string')&&(v.returnBranch===undefined||typeof v.returnBranch==='string')&&(v.editing===undefined||(v.editing&&typeof v.editing.startedAt==='string'&&(v.editing.unassigned===undefined||Array.isArray(v.editing.unassigned)&&v.editing.unassigned.every((p:any)=>typeof p==='string'&&!!validatePath(p)))&&typeof v.editing.layer==='string'&&Array.isArray(v.editing.before)&&v.editing.before.every((p:any)=>typeof p==='string'&&!!validatePath(p)))));
      if(!validOwnershipMetadata(this.workspace))throw new LabError('METADATA_INVALID','Metadados de propriedade inválidos.');
      const editing=this.workspace.editing;if(editing&&(!Number.isFinite(Date.parse(editing.startedAt))||new Set(editing.before).size!==editing.before.length||editing.unassigned&&(new Set(editing.unassigned).size!==editing.unassigned.length||editing.unassigned.some(p=>!editing.before.includes(p)))))throw new LabError('METADATA_INVALID','Baseline do destino de edição inválida.');
    } else if(await exists(path.join(this.dir,'workspace.json'))) throw new LabError('METADATA_INVALID','Registry ausente; metadados preservados.');
  }
  async init(){
    await assertSupported(this.repo,false);
    if(await exists(path.join(this.dir,'registry.json')))return this.list();
    if(await exists(this.dir)&& (await fs.readdir(this.dir)).some(x=>x!=='locks'&&x!=='branch-protection'))throw new LabError('METADATA_INVALID','Diretório de metadados preexistente: inspecione antes de inicializar.');
    if(await exists(path.join(this.dir,'branch-protection'))){const protection=await inspectBranchProtection(this.repo.root);if(!protection.healthy)throw new LabError('PROTECTION_CONFLICT','A proteção preexistente está inconsistente.',protection);}
    await fs.mkdir(this.dir,{recursive:true});
    return withLock(this.dir,async()=>{await atomicJSON(path.join(this.dir,'registry.json'),this.registry);await atomicJSON(path.join(this.dir,'workspace.json'),this.workspace);return this.list();});
  }
  private name(name:string){if(typeof name!=='string'||name.toLowerCase()==='base'||!/^[\p{L}\p{N}][\p{L}\p{N}_/-]*$/u.test(name)||name.includes('..')||name.endsWith('/')||name.split('/').some(x=>!x||x==='.'||x==='.git'))throw new LabError('INVALID_NAME','Nome de Layer inválido. base é reservado à branch tradicional. Use letras, números, hífen, sublinhado e barras.');return name;}
  private layer(name:string,active=false){const l=this.registry.layers.find(l=>l.name===name);if(!l)throw new LabError('LAYER_UNKNOWN',`Layer ${name} não registrada.`);if(active&&l.state!=='active'&&this.workspace.branchLayer!==name)throw new LabError('LAYER_INACTIVE',`Ative a Layer ${name} antes desta operação.`);return l;}
  private index(l:Layer){return this.workspace.branchLayer===l.name?this.repo.index:this.privateIndex(l);}
  private privateIndex(l:Layer){return path.join(this.dir,'indexes',`${l.id}.index`);}
  /** Only immutable object IDs are reused, within one locked mutation. Live indices/refs never are. */
  private async entries(ref:string,index?:string):Promise<GitEntry[]>{
    if(!this.tx||!this.transactionTrees||index||!/^[0-9a-f]{40,64}$/.test(ref))return treeEntries(this.repo.root,ref,index);
    const cached=this.transactionTrees.get(ref);if(cached)return cached.map(entry=>({...entry}));
    const entries=await treeEntries(this.repo.root,ref);
    if(this.transactionTrees.size<64&&entries.length+[...this.transactionTrees.values()].reduce((count,tree)=>count+tree.length,0)<=100000)this.transactionTrees.set(ref,entries.map(entry=>({...entry})));
    return entries;
  }
  private async save(){if(this.workspace.baseReservations?.length){const committed=new Set((await this.entries(this.repo.head)).map(e=>e.path));if(this.workspace.editing)this.workspace.editing.acceptedBase=[...new Set([...this.workspace.editing.acceptedBase??[],...this.workspace.baseReservations.filter(p=>committed.has(p))])];this.workspace.baseReservations=this.workspace.baseReservations.filter(p=>!committed.has(p));}if(!validOwnershipMetadata(this.workspace))throw new LabError('METADATA_INVALID','Estado de propriedade não pode ser publicado.');await this.writeJSON(path.join(this.dir,'registry.json'),this.registry);await this.writeJSON(path.join(this.dir,'workspace.json'),this.workspace);for(const l of this.registry.layers)await this.writeJSON(path.join(this.dir,'reservations',`${l.id}.json`),{schema:1,paths:l.reservations});}
  private async track(file:string,expected?:Fingerprint){
    file=path.resolve(file);if(!this.tx||this.recoveryFileMap.has(file))return;
    const before=expected?{...expected}:await fingerprint(file);
    const tracked=await this.tx.backupTracked(file,'file-'+this.recoveryFiles.length,before,this.recoveryFiles);
    this.recoveryFileMap.set(file,tracked);
  }
  private async after(file:string,expected?:any){file=path.resolve(file);const current=await fingerprint(file);if(this.tx){const f=this.recoveryFileMap.get(file);if(f){f.after=expected??current;await this.tx.recordFileWrite(f);}else await this.tx.record('write-completed',{path:file});}if(expected&&!sameFingerprint(current,expected))throw new LabError('EXTERNAL_EDIT',`O resultado físico diverge da operação: ${file}`);}
  private async writeJSON(file:string,value:unknown){const planned=await fingerprint(file);if(planned.exists&&planned.hash===hash(JSON.stringify(value,null,2)+'\n'))return;await this.track(file);if(!sameFingerprint(planned,await fingerprint(file)))throw new LabError('EXTERNAL_EDIT',`Metadado mudou: ${file}`);await atomicJSON(file,value);await this.after(file);}
  /** A managed publication invalidates old absence authority even before a later disk query. */
  private async beginKnownMaterialization(file:string):Promise<string|undefined>{
    const relative=path.relative(this.repo.root,file).split(path.sep).join('/');
    if(!relative||relative==='..'||relative.startsWith('../')||path.isAbsolute(relative))return;
    const previous:string[]=this.tx?.data.recovery?.beforeWorkspace.acknowledgedMissing??[];
    const current=this.workspace.acknowledgedMissing??[];
    // Metadata paths cannot appear in these validated workspace-relative lists.
    if(!previous.includes(relative)&&!current.includes(relative))return;
    if(!this.tx)throw new LabError('RECOVERY_REQUIRED','Materialização de caminho reconhecido exige plano recuperável; preserve o journal e exporte os backups.',{path:relative});
    if(!previous.includes(relative)){
      // This acknowledgement was created in this operation. The original before
      // has no such authority to restore, so never add it outside the strict subset.
      this.workspace.acknowledgedMissing=current.filter(p=>p!==relative);
      return;
    }
    await this.track(path.join(this.dir,'workspace.json'));
    const old=this.tx.data.recovery.acknowledgements??{revoked:[],pending:[]};
    const revoked=[...old.revoked] as string[];
    const pending=[...new Set<string>([...old.pending,...(revoked.includes(relative)?[]:[relative])])];
    this.tx.data.recovery.acknowledgements={revoked,pending};
    // Pending is durable before physical publication. A failed or uncertain
    // publication must not make rollback regrant the previous authority.
    await this.tx.record('acknowledgement-materialization-pending',{path:relative});
    if(this.workspace.acknowledgedMissing)this.workspace.acknowledgedMissing=this.workspace.acknowledgedMissing.filter(p=>p!==relative);
    return relative;
  }
  private async completeKnownMaterialization(relative:string|undefined){
    if(relative===undefined)return;
    const previous:string[]=this.tx?.data.recovery?.beforeWorkspace.acknowledgedMissing??[];
    const old=this.tx?.data.recovery?.acknowledgements;
    if(!this.tx||!previous.includes(relative)||!old||!old.revoked.includes(relative)&&!old.pending.includes(relative))throw new LabError('RECOVERY_INVALID','Materialização sem plano de revogação correspondente.',{path:relative});
    this.tx.data.recovery.acknowledgements={revoked:[...new Set<string>([...old.revoked,relative])],pending:old.pending.filter((p:string)=>p!==relative)};
    await this.tx.record('acknowledgement-materialization-completed',{path:relative});
  }
  private async writeBytes(file:string,bytes:Buffer|string,mode?:number,expected?:any){
    const planned=expected??await fingerprint(file);await this.track(file);const materialization=await this.beginKnownMaterialization(file);await fs.mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.git-layer-${randomUUID()}`;
    const h=await fs.open(tmp,'wx',mode??0o600);try{await h.writeFile(bytes);if(mode!==undefined)await h.chmod(mode);await h.sync();}finally{await h.close();}
    if(!sameFingerprint(planned,await fingerprint(file))){await fs.unlink(tmp);throw new LabError('EXTERNAL_EDIT',`O destino mudou durante a operação: ${file}`);}
    const temporaryMode=comparableFileMode((await fs.stat(tmp)).mode),written={exists:true,hash:hash(bytes),mode:temporaryMode};if(planned.exists)await fs.rename(tmp,file);else await publishNewFile(tmp,file,written);await this.after(file,written);await this.completeKnownMaterialization(materialization);
  }
  private async writeCopy(file:string,source:string,mode:number,expected:any,sourceHash:string){
    await this.track(file);const materialization=await this.beginKnownMaterialization(file);
    const tmp=`${file}.git-layer-${randomUUID()}`;
    const copied=await copyRegular(source,tmp,mode);
    if(copied.hash!==sourceHash)throw new LabError('EXTERNAL_EDIT',`A materializa\u00e7\u00e3o privada mudou antes da publica\u00e7\u00e3o: ${source}`);
    if(!sameFingerprint(expected,await fingerprint(file))){await fs.unlink(tmp);throw new LabError('EXTERNAL_EDIT',`O destino mudou durante a operação: ${file}`);}
    if(expected.exists)await fs.rename(tmp,file);else await publishNewFile(tmp,file,copied);await this.after(file,copied);await this.completeKnownMaterialization(materialization);
  }
  private async remove(file:string,expected?:any){const planned=expected??await fingerprint(file);await this.track(file);if(!sameFingerprint(planned,await fingerprint(file)))throw new LabError('EXTERNAL_EDIT',`O arquivo mudou antes de ser removido: ${file}`);await fs.unlink(file);await this.after(file,{exists:false,hash:'',mode:0});}
  private async pruneLayerDirectories(paths: string[], retainedPaths: string[]): Promise<void> {
    const ancestors = (files: string[]): Set<string> => {
      const directories = new Set<string>();
      for (const file of files) for (let dir = path.posix.dirname(file); dir !== '.'; dir = path.posix.dirname(dir)) directories.add(dir);
      return directories;
    };
    const retained = new Set([...ancestors(retainedPaths)].map(collisionKey));
    const candidates = [...ancestors(paths)].sort((a, b) => b.split('/').length - a.split('/').length);
    for (const relative of candidates) {
      if (retained.has(collisionKey(relative))) continue;
      const full = await safePath(this.repo.root, relative);
      let before;
      try { before = await fs.lstat(full); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
      if (!before.isDirectory() || before.isSymbolicLink()) throw new LabError('UNSAFE_PATH', `Diretório da Layer foi substituído: ${relative}`);
      // Never traverse or recursively remove local children, including empty folders.
      if ((await fs.readdir(full)).length) continue;
      const directories = this.tx!.data.recovery.directories ??= [];
      directories.push({ path: full, mode: before.mode & 0o777 });
      await this.tx!.record('directory-removal-planned', { path: full });
      try {
        await safePath(this.repo.root, relative, false);
        const current = await fs.lstat(full);
        if (current.dev !== before.dev || current.ino !== before.ino) throw new LabError('EXTERNAL_EDIT', `O diretório mudou antes da remoção: ${relative}`);
        await fs.rmdir(full);
      } catch (error) {
        // A new child or a concurrently removed folder must never trigger recursion.
        if (['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes((error as NodeJS.ErrnoException).code ?? '')) continue;
        throw error;
      }
      await this.tx!.record('directory-removed', { path: full });
    }
  }
  private async refresh(){this.repo=await discover(this.repo.root);await this.load();}
  private async guard(requireCommit=true,ownsLock=false){
    this.validatedIndexes.clear();
    await this.refresh();if(await resolveLayerDirectory(this.repo.gitDir)!==this.dir)throw new LabError('LAYOUT_CHANGED','O layout mudou; reabra o repositório antes de operar.');await assertSupported(this.repo,requireCommit);
    if(!(await exists(path.join(this.dir,'registry.json'))))throw new LabError('NOT_INITIALIZED','Execute git layer init.');
    const pending=await listTransactions(this.dir);if(pending.length)throw new LabError('RECOVERY_REQUIRED','Há transações incompletas. Execute doctor e recover.',pending);
    if(this.workspace.branchLayer&&(this.workspace.branch!=='layer/'+this.workspace.branchLayer||!this.registry.layers.some(l=>l.name===this.workspace.branchLayer&&l.state!=='active'))||this.workspace.resumeLayer&&this.workspace.resumeLayer!==this.workspace.branchLayer||this.workspace.editing&&!this.registry.layers.some(l=>l.name===this.workspace.editing!.layer&&l.state==='active'&&l.name!==this.workspace.branchLayer))throw new LabError('METADATA_INVALID','Papéis de branch, Layer ativa e destino inconsistentes.');
    if((!ownsLock&&await exists(path.join(this.dir,'locks','coordinator')))||await exists(this.repo.index+'.lock'))throw new LabError('LOCKED','Há um lock real; nenhum lock será apagado automaticamente.');
    if(this.repo.branch.startsWith('layer/')&&this.workspace.branchLayer!==this.repo.branch.slice(6))throw new LabError('EXPLICIT_LAYER_REQUIRED','Layer selecionada pelo Git direto. A prevenção universal não existe; retorne pela rota nativa e use open-branch para entrada gerenciada.');
    if(this.repo.head!==this.workspace.head||this.repo.branch!==this.workspace.branch){
      if(this.workspace.branchLayer&&this.repo.branch!==this.workspace.branch)throw new LabError('EXTERNAL_HEAD','Saída nativa do modo Layer como branch: estado preservado; volte à branch anterior para sair pela CLI.');
      await this.verifyExcludes();await this.owners();this.workspace={...this.workspace,head:this.repo.head,branch:this.repo.branch};
    }
    const layerRefs=new Map((this.registry.layers.length?await gitText(this.repo.root,['for-each-ref','--format=%(refname)%00%(objectname)%00%(symref)','refs/heads/layer/']):'').split('\n').filter(Boolean).map(line=>{const [ref,oid,symbolic]=line.split('\0');return [ref!,{oid,symbolic}] as const;}));
    for(const l of this.registry.layers){
      const observed=layerRefs.get(l.ref),oid=observed?.oid;
      if(observed?.symbolic)throw new LabError('EXTERNAL_REF','A branch simbólica da Layer foi preservada; é necessária uma referência direta.',{reason:'direct-ref-required',ref:l.ref});
      if(!oid)throw new LabError('EXTERNAL_REF',`Referência ${l.ref} removida/renomeada externamente; dados preservados.`);
      if(this.workspace.branchLayer===l.name){l.oid=oid;l.indexBase=oid;}
      else if(oid!==l.oid||l.indexBase!==l.oid)throw new LabError('EXTERNAL_REF',`Referência da Layer ${l.name} mudou externamente; índice preservado.`);
      this.validatedIndexes.set(l.id,await this.validateLayerIndex(l));
    }
    if(await exists(path.join(this.dir,'branch-protection','state.json'))){const protection=await inspectBranchProtection(this.repo.root);if(!protection.healthy)throw new LabError('PROTECTION_CONFLICT','A proteção configurada divergiu; inspecione as reservas preservadas.',protection);}
    await this.verifyExcludes();await this.owners();
  }
  private async validateLayerIndex(l:Layer){
    // A Layer used as the working branch owns the main index; its retained
    // private index must still match its original checkpoint before any reuse.
    const index=this.workspace.branchLayer===l.name?this.privateIndex(l):this.index(l);
    if(await exists(index+'.lock'))throw new LabError('LOCKED',`Lock do índice privado da Layer ${l.name} presente; nenhum lock será removido.`,{path:index+'.lock'});
    if(!(await exists(index)))throw new LabError('INDEX_MISSING',`Índice privado da Layer ${l.name} ausente.`);
    const indexIdentity=await observeIndexIdentity(index),indexFingerprint=await fingerprint(index);
    if(!indexIdentity||!sameIndexIdentity(indexIdentity,await observeIndexIdentity(index)))activationChanged('EXTERNAL_INDEX','index-before-validation',{path:index});
    await this.entries('INDEX',index);
    const reservations=await readJSON<any>(path.join(this.dir,'reservations',l.id+'.json'),v=>Array.isArray(v.paths)&&v.paths.every((p:any)=>typeof p==='string'&&!!validatePath(p)));
    if(JSON.stringify(reservations.paths)!==JSON.stringify(l.reservations))throw new LabError('RESERVATIONS_INVALID',`Reservas inconsistentes na Layer ${l.name}.`);
    const state='refs/git-layers/state/'+l.id;
    const observedCheckpoint=(await gitText(this.repo.root,['for-each-ref','--format=%(refname)%00%(objectname)%00%(symref)',state])).split('\n').map(line=>line.split('\0')).find(fields=>fields[0]===state);
    if(observedCheckpoint?.[2])throw new LabError('EXTERNAL_REF','O checkpoint simbólico foi preservado; é necessária uma referência direta.',{reason:'direct-ref-required',ref:state});
    const checkpoint=observedCheckpoint?.[1];if(!checkpoint)throw new LabError('CHECKPOINT_MISMATCH',`Checkpoint ausente da Layer ${l.name}.`);
    if((await git(this.repo.root,['diff','--cached','--quiet',checkpoint,'--'],{index,ok:[0,1]})).code!==0)throw new LabError('CHECKPOINT_MISMATCH',`Checkpoint diferente do índice privado da Layer ${l.name}.`);
    if(!sameFingerprint(indexFingerprint,await fingerprint(index))||!sameIndexIdentity(indexIdentity,await observeIndexIdentity(index)))activationChanged('EXTERNAL_INDEX','index-during-validation',{path:index});
    return {index,checkpoint,fingerprint:indexFingerprint,identity:indexIdentity!};
  }
  private async mutate<T>(kind:string,fn:()=>Promise<T>,requireCommit=true,options:{reconcile?:boolean}={}){
    return withLock(this.dir,async()=>{await this.guard(requireCommit,true);return this.mutateLocked(kind,fn,options);});
  }
  /** Only callers already holding the coordinator lock and a fresh guard may enter. */
  private async mutateLocked<T>(kind:string,fn:()=>Promise<T>,options:{reconcile?:boolean;revokedAcknowledgements?:string[]}={}):Promise<T>{
    this.tx=await Transaction.begin(this.dir,kind,{head:this.repo.head,branch:this.repo.branch});this.recoveryFiles=[];this.recoveryFileMap.clear();this.tx.data.recovery={files:this.recoveryFiles,beforeRegistry:structuredClone(this.registry),beforeWorkspace:structuredClone(this.workspace)};
    if(options.revokedAcknowledgements?.length){
      const previous=this.tx.data.recovery.beforeWorkspace.acknowledgedMissing??[],revoked=[...options.revokedAcknowledgements];
      if(revoked.some(p=>!previous.includes(p))||new Set(revoked.map(collisionKey)).size!==revoked.length)throw new LabError('RECOVERY_INVALID','Revogação conhecida não corresponde ao contexto anterior.');
      this.tx.data.recovery.acknowledgements={revoked,pending:[]};
      // A crash before this backup/prepared is complete remains an invalid pending
      // journal: it must never restore or complete an unrecorded observation.
      await this.track(path.join(this.dir,'workspace.json'));
    }
    await this.tx.record('prepared');
    try{
      this.transactionTrees=new Map();if(options.reconcile!==false)await this.syncEditingInternal();const value=await fn();
      if(this.publicationCheck)await this.publicationCheck();await this.save();if(this.transactionFinalCheck)await this.transactionFinalCheck();
      if(kind==='rename-layer')failpoint('after-layer-rename-metadata');await this.tx.finish();if(this.projectionCleanup)await this.projectionCleanup().catch(()=>undefined);if(this.transactionFinalCheck)await this.transactionFinalCheck();return value;
    }catch(e){
      const conflictPath=e instanceof LabError&&(e.details as any)?.reason==='activation-source-changed'?(e.details as any)?.path:undefined;
      const activationConflict=typeof conflictPath==='string'&&this.recoveryFileMap.has(conflictPath)&&(kind==='activate'&&this.activationSource?.sourceIndex===conflictPath||this.tx.data.recovery.createdIndexPublication?.path===conflictPath);
      const managedConflict=!!this.managedStage&&e instanceof LabError&&(e.details as any)?.reason==='managed-stage-source-changed',sourceConflict=activationConflict||managedConflict;
      // A final observation can fail after finish(). Publish the protected
      // failure checkpoint before recording any optional conflict marker.
      await this.tx.fail(e);
      if(activationConflict){this.tx.data.recovery.activationIndexConflict={path:conflictPath,reason:'identity-changed'};await this.tx.record('activation-index-conflict',{path:conflictPath});}
      if(managedConflict){this.tx.data.recovery.managedIndexConflict={path:this.managedStage!.path,reason:'source-changed'};await this.tx.record('managed-index-conflict',{path:this.managedStage!.path});}
      if(!sourceConflict&&!(e instanceof LabError&&e.code==='INJECTED_FAILURE')){try{
        const rollbackLocks=await this.rollback(this.tx.data);await rollbackLocks();
        if(kind==='activate'&&this.activationSource){const source=this.activationSource,current=await gitText(this.repo.root,['rev-parse','--verify',source.checkpointRef]);if(current!==source.initialCheckpoint){if(current!==source.tree)throw new LabError('RECOVERY_CONFLICT','Checkpoint externo da ativação foi preservado.');await updateDirectRef(this.repo.root,source.checkpointRef,source.initialCheckpoint,current);}}
        const mainStageFailure=kind==='stage-base'||kind==='stage'&&!this.managedStage;
        if(mainStageFailure)await this.validateMainStageRollback(this.tx.data);
        await rollbackLocks();await this.tx.finish();await this.refresh();
        // Activation never authorizes rebuilding checkpoints from a live index
        // that may have changed after its original proof. Its known ref image
        // above is restored by CAS; external staging remains unaccepted.
        if(kind!=='activate'&&!this.managedStage&&!mainStageFailure)for(const l of this.registry.layers){await rollbackLocks();await this.checkpoint(l);if(this.workspace.branchLayer!==l.name)await this.reserveProtection(l.name);}await rollbackLocks();
      }catch{/* keep journal and bytes, caller sees original error */}}
      throw e;
    }finally{this.tx=undefined;this.transactionTrees=undefined;this.recoveryFiles=[];this.recoveryFileMap.clear();this.publicationCheck=undefined;this.projectionCleanup=undefined;this.activationSource=undefined;this.managedStage=undefined;this.transactionFinalCheck=undefined;}
  }
  /** Stable no-target queries observe ownership without publishing a no-op transaction. */
  private async syncEditingForStatus(){
    return withLock(this.dir,async()=>{
      // Preserve the original editing-sync guard requirement; do not refresh again below.
      await this.guard(true,true);
      if(this.workspace.editing)return this.mutateLocked('editing-sync',async()=>({synced:true}));
      const maximum=(this.workspace.acknowledgedMissing?.length??0)+1;
      for(let attempt=0;attempt<maximum;attempt++){
        const observation=await this.editingObservation();
        const present=new Set(this.registry.layers.some(l=>l.state==='active')?observation.disk:await walk(this.repo.root));
        const revoked=(this.workspace.acknowledgedMissing??[]).filter(p=>present.has(p));
        if(revoked.length){
          const observed=new Set(revoked);
          // Persist the observed revocation before any ownership diagnosis can reject.
          // Do not recalculate it if the file disappears before publication.
          await this.mutateLocked('editing-sync',async()=>{
            this.workspace.acknowledgedMissing=(this.workspace.acknowledgedMissing??[]).filter(p=>!observed.has(p));
            return {revokedAcknowledgements:revoked};
          },{reconcile:false,revokedAcknowledgements:revoked});
          continue;
        }
        // Reuse this very observation, so a second precheck cannot lose its meaning.
        // After a real revocation the loop observes again, diagnosing interval renames.
        await this.editingCandidates(false,observation);return {synced:true};
      }
      throw new LabError('EXTERNAL_EDIT','A observação de propriedade não convergiu; metadados preservados.');
    });
  }
  private async rollback(data:any,existingLocks?:()=>Promise<void>):Promise<()=>Promise<void>>{
    await validateRecovery(this.repo,this.dir,data);const nativeLocks=existingLocks??recoveryIndexLockGuard(this.repo,this.dir,data,this.registry.layers.map(layer=>this.privateIndex(layer))),managed=data.recovery?.managedIndexPublication;let refsRestored=false,acceptedManaged:{identity:IndexIdentity;fingerprint:any}|undefined;
    const acceptManaged=async(expected:any,allowed:ReturnType<typeof durableIndexIdentity>[])=>{const identity=await observeIndexIdentity(managed.path);if(!identity||!allowed.some(value=>matchesDurableIndexIdentity(value,identity))||!sameFingerprint(expected,await fingerprint(managed.path))||!sameIndexIdentity(identity,await observeIndexIdentity(managed.path)))throw new LabError('RECOVERY_CONFLICT','O índice restaurado mudou após sua publicação; journal preservado.',{reason:'managed-index-identity-changed',path:managed.path});acceptedManaged={identity,fingerprint:expected};};
    const checkLocks=async()=>{await nativeLocks();if(managed){await managedIndexContext(this.repo,this.dir,data,refsRestored?managed.checkpoint:undefined);if(acceptedManaged&&(!sameIndexIdentity(acceptedManaged.identity,await observeIndexIdentity(managed.path))||!sameFingerprint(acceptedManaged.fingerprint,await fingerprint(managed.path))||!sameIndexIdentity(acceptedManaged.identity,await observeIndexIdentity(managed.path))))throw new LabError('RECOVERY_CONFLICT','Índice externo detectado após restauração; contexto e journal preservados.',{reason:'managed-index-identity-changed',path:managed.path});}};
    await checkLocks();const workspaceImages=await recoveryWorkspaceImages(this.repo,this.dir,data),derived=workspaceImages.find(image=>image.kind==='rollback');await checkLocks();await this.rollbackRefs(data);refsRestored=true;
    if(data.recovery?.commit){const c=data.recovery.commit;const current=await gitText(this.repo.root,['rev-parse','--verify',c.ref]);if(current!==c.old)throw new LabError('RECOVERY_REQUIRED','Uma referência já avançou; finalize a recuperação pelo commit existente.');}
    if(data.recovery?.switch){const s=data.recovery.switch;const r=await discover(this.repo.root);if(r.branch!==s.from)throw new LabError('RECOVERY_REQUIRED','A branch já mudou; recuperação exige inspeção.');}
    for (const directory of [...(data.recovery.directories ?? [])].sort((a, b) => a.path.length - b.path.length)) {
      const relative = path.relative(this.repo.root, directory.path).split(path.sep).join('/');
      const full = await safePath(this.repo.root, relative);
      // mkdir preserves any directory/content that appeared after interruption.
      await checkLocks();await fs.mkdir(full, { recursive: true, mode: directory.mode });
    }
    for(const f of [...(data.recovery?.files??[])].reverse()){
      await checkLocks();const current=await recoveryFileState(this.repo,this.dir,data,f),image=derived?.path===f.path?derived:undefined,desired=image?.fingerprint??f.before;await checkLocks();
      assertRecoveryMaterializationState(this.repo,this.dir,f,current);
      if(sameFingerprint(current,desired)){if(managed?.path===f.path)await acceptManaged(desired,[managed.before,...(managed.after===null?[]:[managed.after])]);continue;}
      if(!sameFingerprint(current,f.before)&&(!f.after||!sameFingerprint(current,f.after))&&!workspaceImages.some(entry=>entry.path===f.path&&sameFingerprint(current,entry.fingerprint)))throw new LabError('RECOVERY_CONFLICT',`Mudança posterior detectada: ${f.path}. Exporte os backups.`);
      if(f.backup){if(!sameFingerprint(await fingerprint(f.backup),f.before))throw new LabError('RECOVERY_CONFLICT',`Backup alterado: ${f.backup}`);await fs.mkdir(path.dirname(f.path),{recursive:true});const temporary=`${f.path}.recovery-${randomUUID()}`;let restoredIdentity:IndexIdentity|undefined;if(image){const handle=await fs.open(temporary,'wx',desired.mode);try{await handle.writeFile(image.bytes);await handle.chmod(desired.mode);await handle.sync();}finally{await handle.close();}}else{const copied=await copyRegular(f.backup,temporary,desired.mode);if(!sameFingerprint(copied,desired))throw new LabError('RECOVERY_CONFLICT',`Backup mudou durante a restauração: ${f.backup}`);}const recoveryIndex=f.path===path.resolve(this.repo.index)||/^indexes\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.index$/u.test(path.relative(path.resolve(this.dir),f.path).split(path.sep).join('/'));
        if(recoveryIndex){
          // A legacy backup has bytes/mode but no trustworthy original index mtime.
          // Git cache_time seconds are uint32; 1s is the earliest nonzero boundary.
          // This retains every possible native racy check, at the cost of rehashing.
          const initial=await observeIndexIdentity(temporary);
          if(!initial)throw new LabError('RECOVERY_CONFLICT','O indice temporario desapareceu durante a recuperacao.',{path:temporary});
          const restored=await preserveIndexTimestamp(temporary,f.path,1_000_000_000n,initial,{sync:true});
          restoredIdentity=restored.identity;
          if(!sameFingerprint(await fingerprint(temporary),desired)||!sameIndexIdentity(restored.identity,await observeIndexIdentity(temporary)))throw new LabError('RECOVERY_CONFLICT','O indice temporario mudou durante a recuperacao; backup e journal preservados.',{path:temporary});
        }
        await checkLocks();if(!sameFingerprint(await recoveryFileState(this.repo,this.dir,data,f),current)){await fs.unlink(temporary);throw new LabError('RECOVERY_CONFLICT',`Arquivo mudou durante a recuperação: ${f.path}`);}await checkLocks();if(current.exists)await fs.rename(temporary,f.path);else await publishNewFile(temporary,f.path,desired);if(managed?.path===f.path){if(!restoredIdentity)throw new LabError('RECOVERY_INVALID','Restauração de índice sem identidade própria.');await acceptManaged(desired,[durableIndexIdentity(restoredIdentity)]);}}else if(current.exists){if(!sameFingerprint(await recoveryFileState(this.repo,this.dir,data,f),current))throw new LabError('RECOVERY_CONFLICT',`Arquivo mudou antes da remoção na recuperação: ${f.path}`);await checkLocks();await fs.unlink(f.path);}
    }
    await checkLocks();return checkLocks;
  }
  async list(){await this.load();const known=structuredClone(this.registry.layers);for(const name of await this.candidates()){const ref='refs/heads/layer/'+name;known.push({id:'',name,ref,oid:await gitText(this.repo.root,['rev-parse','--verify',ref]),indexBase:'',state:'inactive',reservations:[]});}for(const remote of await this.remoteCandidates())known.push({id:'',...remote,indexBase:'',state:'inactive',reservations:[]});return known;}
  async candidates(){const refs=(await gitText(this.repo.root,['for-each-ref','--format=%(refname)','refs/heads/layer/'])).split('\n').filter(Boolean);return refs.filter(r=>!this.registry.layers.some(l=>l.ref===r)).map(r=>r.slice('refs/heads/layer/'.length));}
  async remoteCandidates(){
    const remotes=(await gitText(this.repo.root,['remote'])).split('\n').filter(Boolean).sort((a,b)=>b.length-a.length);
    const lines=(await gitText(this.repo.root,['for-each-ref','--format=%(refname)%00%(objectname)%00%(symref)','refs/remotes/'])).split('\n').filter(Boolean);
    return lines.flatMap(line=>{const [ref,oid,symref]=line.split('\0');if(symref)return [];const remote=remotes.find(remote=>ref!.startsWith('refs/remotes/'+remote+'/layer/'));if(!remote)return [];return [{name:ref!.slice(('refs/remotes/'+remote+'/layer/').length),remote,ref:ref!,oid:oid!}];});
  }
  private async recognizedLayerRevision(name:string){this.name(name);const local=await git(this.repo.root,['rev-parse','--verify','refs/heads/layer/'+name+'^{commit}'],{ok:[0,128]});if(local.code===0)return local.stdout.toString().trim();const remotes=(await this.remoteCandidates()).filter(candidate=>candidate.name===name);if(remotes.length!==1)throw new LabError(remotes.length?'LAYER_AMBIGUOUS':'LAYER_UNKNOWN','Escolha uma origem remota única ou crie explicitamente a branch local no Git.',remotes);return remotes[0]!.oid;}
  private async localLayerRevision(name:string){this.name(name);const ref='refs/heads/layer/'+name;const local=await git(this.repo.root,['rev-parse','--verify',ref+'^{commit}'],{ok:[0,128]});if(local.code===0)return local.stdout.toString().trim();const remotes=(await this.remoteCandidates()).filter(candidate=>candidate.name===name);if(remotes.length!==1)throw new LabError(remotes.length?'LAYER_AMBIGUOUS':'LAYER_UNKNOWN',remotes.length?'Há várias origens remotas; crie explicitamente a branch local desejada no Git.':'Layer local/remota não encontrada.',remotes);await git(this.repo.root,['branch','--track','layer/'+name,remotes[0]!.ref]);return this.revision(ref);}
  private async ownPaths(l:Layer):Promise<string[]>{return [...new Set([...(await this.entries(l.oid)).map(e=>e.path),...(await this.entries('INDEX',this.index(l))).map(e=>e.path),...l.reservations])];}
  private async owners(extra?:Layer,baseRef?:string,workspace:Workspace=this.workspace):Promise<Map<string,string>>{
    const entries:{path:string,owner:string}[]=[];for(const e of await this.entries(baseRef??this.repo.head))entries.push({path:e.path,owner:'base'});if(!baseRef){for(const e of await this.entries('INDEX'))entries.push({path:e.path,owner:'base'});for(const p of workspace.baseReservations??[])entries.push({path:p,owner:'base'});for(const p of workspace.editing?.acceptedBase??[])entries.push({path:p,owner:'base'});}
    for(const l of this.registry.layers.filter(l=>l.state==='active'||l.id===extra?.id))for(const p of await this.ownPaths(l))entries.push({path:p,owner:l.name});
    assertNoCollisions(entries);return new Map(entries.map(e=>[e.path,e.owner]));
  }
  private async reserveProtection(name:string){if(await exists(path.join(this.dir,'branch-protection','state.json')))await reserveLayerProtection(this.repo.root,name);}
  private async releaseProtection(name:string){if(await exists(path.join(this.dir,'branch-protection','state.json')))await releaseLayerProtection(this.repo.root,name);}
  private async protectedPaths(){const all:string[]=[];for(const l of this.registry.layers.filter(l=>l.state==='active'))all.push(...await this.ownPaths(l));return [...new Set(all)].sort();}
  private async userExcludeText(){
    const old=await fs.readFile(this.repo.exclude,'utf8').catch((e:any)=>{if(e.code==='ENOENT')return '';throw e;});
    const starts=old.split(BEGIN).length-1,ends=old.split(END).length-1;if(starts!==ends||starts>1)throw new LabError('EXCLUDE_INVALID','Bloco de exclusoes inconsistente.');
    return starts?old.slice(0,old.indexOf(BEGIN))+old.slice(old.indexOf(END)+END.length).replace(/^\r?\n/,''):old;
  }
  private async excludeText(paths:string[]){const clean=await this.userExcludeText();
    // Root-anchored exact file patterns; escape all gitignore metacharacters.
    const escape=(p:string)=>p.replace(/[\\*?\[\]#! ]/g,'\\$&');
    let unassigned=this.workspace.editing?.unassigned;
    if(unassigned){
      const candidates=[...new Set([...unassigned,...this.workspace.baseReservations??[]])],present:string[]=[];
      // An absent path has no exemption: a later recreation is observed again
      // under the user's current rules, without guessing ignore intent.
      for(const p of candidates){
        try{const stat=await fs.lstat(await safePath(this.repo.root,p));if(stat.isSymbolicLink()||stat.isFile()&&stat.nlink>1||!stat.isFile()&&!stat.isDirectory())throw new LabError('UNSAFE_PATH','Exceção de ignore exige arquivo regular sem links.',{path:p});if(stat.isFile())present.push(p);}
        catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      }
      const ignored=await ignoredWithoutManagedExcludes(this.repo,present,clean);
      unassigned=present.filter(p=>!ignored.has(p));
    }
    const rules=[...(unassigned?['/**','!*/',...unassigned.map(p=>'!/'+escape(p))]:[]),...paths.map(p=>'/'+escape(p))];
    return clean+(clean&&!clean.endsWith('\n')?'\n':'')+BEGIN+'\n'+rules.join('\n')+(rules.length?'\n':'')+END+'\n';
  }
  private async updateExcludes(){const before=await fingerprint(this.repo.exclude);const text=await this.excludeText(await this.protectedPaths());await this.writeBytes(this.repo.exclude,text,undefined,before);await this.verifyExcludes();}
  private async verifyExcludes(){
    const paths=await this.protectedPaths();if(!paths.length)return;
    const base=new Set((await this.entries('INDEX')).map(e=>e.path));const contamination=paths.filter(p=>base.has(p));if(contamination.length)throw new LabError('BASE_CONTAMINATED','Arquivos de Layer preparados externamente na branch de trabalho. Retire somente esses caminhos do índice principal com Git restore --staged; preserve o disco e revise commits nativos.',{paths:contamination});
    const ignored=(await git(this.repo.root,['check-ignore','--no-index','-z','--stdin'],{input:paths.join('\0')+'\0',ok:[0,1]})).stdout.toString().split('\0');const set=new Set(ignored);
    const missing=paths.filter(p=>!set.has(p));if(missing.length)throw new LabError('IGNORE_UNSAFE','Exclusão inefetiva; .gitignore pode anular a proteção. Confira git check-ignore -v --no-index e revise negações antes de preparar arquivos.',{paths:missing});
  }
  private async checkpoint(l:Layer){
    if(this.workspace.branchLayer===l.name)return (await queryIndexTree(this.repo,this.repo.index)).stdout.toString().trim();
    const index=this.index(l),tracked=this.recoveryFileMap.get(index),guard=this.tx?this.validatedIndexes.get(l.id):undefined;
    // Own mutations recorded AFTER; post-rollback validation uses BEFORE.
    // An untracked mutation needs the guard's known source, never a later C.
    if(this.tx&&!tracked&&!guard)throw new LabError('RECOVERY_REQUIRED','Checkpoint sem origem de \u00edndice validada.',{path:index});
    const planned=this.tx?(tracked?(this.tx.data.state==='completed'?tracked.before:tracked.after??tracked.before):guard!.fingerprint):undefined;
    const expected={...(planned??await fingerprint(index))},identity=this.tx&&!tracked?guard!.identity:await observeIndexIdentity(index);
    const revalidate=async()=>{
      if(await exists(index+'.lock'))throw new LabError('LOCKED','Lock nativo do \u00edndice presente; checkpoint recusado.',{path:index+'.lock'});
      const before=await observeIndexIdentity(index),current=await fingerprint(index),after=await observeIndexIdentity(index);
      if(!expected.exists||!identity||!sameIndexIdentity(identity,before)||!sameIndexIdentity(identity,after)||!sameFingerprint(expected,current))throw new LabError(this.tx?'EXTERNAL_INDEX':'RECOVERY_CONFLICT','O \u00edndice mudou durante a valida\u00e7\u00e3o do checkpoint; imagem externa preservada.',{path:index,reason:'checkpoint-source-changed'});
    };
    await revalidate();await this.track(index,expected);await revalidate();
    // Git validates/builds the tree on a verified timestamp-bounded copy.
    // Its TREE/stat refresh never rewrites the live private index.
    const tree=(await queryIndexTree(this.repo,index)).stdout.toString().trim();
    await revalidate();await this.after(index,expected);await revalidate();
    const result=await this.checkpointTree(l,tree);await revalidate();return result;
  }
  private async checkpointTree(l:Layer,tree:string,expected?:string){const state=`refs/git-layers/state/${l.id}`;const prev=(await git(this.repo.root,['rev-parse','--verify',state],{ok:[0,128]})).stdout.toString().trim();if(expected!==undefined&&prev!==expected)activationChanged('CHECKPOINT_MISMATCH','checkpoint-before-publication',{ref:state});if(prev&&this.tx)await updateDirectRef(this.repo.root,`refs/git-layers/transactions/${this.tx.id}/${l.id}`,prev);const old=(expected===undefined?prev:expected)||'0'.repeat(tree.length);await updateDirectRef(this.repo.root,state,tree,old);return tree;}
  async create(name:string){this.name(name);return this.mutate('create',async()=>{await git(this.repo.root,['check-ref-format',`refs/heads/layer/${name}`]);if(this.registry.layers.some(l=>l.name===name))throw new LabError('LAYER_EXISTS','Layer já registrada.');const ref=`refs/heads/layer/${name}`;const present=await git(this.repo.root,['show-ref','--verify','--quiet',ref],{ok:[0,1]});if(present.code===0)throw new LabError('LAYER_EXISTS','Branch existente. Use register explicitamente.');const empty=await gitText(this.repo.root,['mktree'],{input:''});const oid=await gitText(this.repo.root,['commit-tree',empty,'-m','Git Layers Lab: inicialização de árvore vazia (commit raiz)'],{env:identity});await updateDirectRef(this.repo.root,ref,oid,'');const created=await this.registerInternal(name,oid);await this.reserveProtection(name);return created;});}
  async register(name:string){this.name(name);return this.mutate('register',async()=>{if(this.registry.layers.some(l=>l.name===name))throw new LabError('LAYER_EXISTS','Layer já registrada.');const oid=await this.localLayerRevision(name);const registered=await this.registerInternal(name,oid);await this.reserveProtection(name);return registered;});}
  private async registerInternal(name:string,oid:string){
    const entries=await this.entries(oid),l:Layer={id:randomUUID(),name,ref:`refs/heads/layer/${name}`,oid,indexBase:oid,state:'inactive',reservations:[]};
    const index=this.index(l),scratch=path.join(this.tx!.dir,'register-'+l.id+'.index'),tree=await gitText(this.repo.root,['rev-parse','--verify',oid+'^{tree}']);
    await fs.mkdir(path.join(this.dir,'indexes'),{recursive:true});await this.track(index);const tracked=this.recoveryFileMap.get(index)!;
    if(tracked.before.exists)activationChanged('EXTERNAL_INDEX','registration-index-present',{path:index});
    // Build and validate only an independent image. Neither live staging nor a
    // second write-tree over the published index can become its initial truth.
    await git(this.repo.root,['read-tree',oid],{index:scratch});
    const scratchIdentity=await observeIndexIdentity(scratch),prepared=await fingerprint(scratch);
    const checkPrepared=async()=>{if(!scratchIdentity||!sameIndexIdentity(scratchIdentity,await observeIndexIdentity(scratch))||!sameFingerprint(prepared,await fingerprint(scratch))||!sameIndexIdentity(scratchIdentity,await observeIndexIdentity(scratch)))activationChanged('EXTERNAL_INDEX','registration-image-changed',{path:scratch});};
    await checkPrepared();const verified=(await queryIndexTree(this.repo,scratch)).stdout.toString().trim();await checkPrepared();
    if(verified!==tree)activationChanged('CHECKPOINT_MISMATCH','registration-image-tree',{path:scratch});
    const checkRef=async()=>{if(await gitText(this.repo.root,['rev-parse','--verify',l.ref])!==oid)activationChanged('EXTERNAL_REF','registration-layer-ref',{ref:l.ref});};
    const published=await publishPreparedIndexImage(this.repo,index,this.tx!.dir,{path:scratch,fingerprint:prepared},entries.map(entry=>entry.path),{expected:tracked.before,
      beforePublish:async()=>{await checkPrepared();await checkRef();},
      planned:async(after,identity)=>{tracked.after=after;this.tx!.data.recovery.createdIndexPublication={path:index,after:durableIndexIdentity(identity)};await this.tx!.record('index-creation-prepared',{path:index});}
    });
    const checkCreated=async(checkpoint=false)=>{
      if(!sameIndexIdentity(published.identity,await observeIndexIdentity(index))||!sameFingerprint(published.fingerprint,await fingerprint(index))||!sameIndexIdentity(published.identity,await observeIndexIdentity(index)))activationChanged('EXTERNAL_INDEX','registration-index-changed',{path:index});
      if(await exists(index+'.lock'))activationChanged('LOCKED','registration-index-lock',{path:index+'.lock'});await checkRef();
      if(checkpoint&&await gitText(this.repo.root,['rev-parse','--verify','refs/git-layers/state/'+l.id])!==tree)activationChanged('CHECKPOINT_MISMATCH','registration-checkpoint-changed',{ref:'refs/git-layers/state/'+l.id});
    };
    await checkCreated();await this.after(index,published.fingerprint);failpoint('after-register-index');await checkCreated();await this.checkpointTree(l,tree,'');await checkCreated(true);
    const previousPublication=this.publicationCheck,previousFinal=this.transactionFinalCheck;
    this.publicationCheck=async()=>{if(previousPublication)await previousPublication();await checkCreated(true);};
    this.transactionFinalCheck=async()=>{if(previousFinal)await previousFinal();await checkCreated(true);};
    this.registry.layers.push(l);return structuredClone(l);
  }
  private layerPath(p:string){validatePath(p);if(p.split('/').some(x=>['.gitignore','.gitattributes','.gitmodules'].includes(x.toLowerCase())))throw new LabError('LAYER_CONTROL_FILE',`${p}: arquivos de controle ficam na branch tradicional.`);return p;}
  private async validateDestinations(paths:string[],allowOwned=false){const disk=await walk(this.repo.root);const owners=await this.owners();const entries=disk.filter(p=>!allowOwned||!owners.has(p)).map(p=>({path:p,owner:'arquivo local preexistente'}));assertNoCollisions([...entries,...paths.map(p=>({path:p,owner:'projeção a ativar'}))]);for(const p of paths){await safePath(this.repo.root,p);if(await exists(path.join(this.repo.root,p))&&!allowOwned)throw new LabError('LOCAL_COLLISION',`Arquivo preexistente não será sobrescrito: ${p}`);}}
  private async diskSnapshot(paths:string[]){const result:{path:string,bytes:string|null,mode:number}[]=[];for(const p of paths){const full=await safePath(this.repo.root,p);const f=await fingerprint(full);result.push({path:p,bytes:f.exists?(await fs.readFile(full)).toString('base64'):null,mode:f.mode});}return result;}
  private async publish(snapshot:({path:string,bytes:string|null,mode:number}|{path:string,source:string,sourceHash:string,mode:number})[]){for(const f of snapshot){const full=await safePath(this.repo.root,f.path);if('source' in f){await this.writeCopy(full,f.source,f.mode,{exists:false,hash:'',mode:0},f.sourceHash);}else if(f.bytes===null){if(await exists(full))throw new LabError('EXTERNAL_EDIT',`Arquivo apareceu onde deveria permanecer ausente: ${f.path}`);}else await this.writeBytes(full,Buffer.from(f.bytes,'base64'),f.mode||0o644,{exists:false,hash:'',mode:0});}}
  private async materialize(l:Layer){
    const bound=this.activationSource;if(!bound)throw new LabError('RECOVERY_REQUIRED','A materialização exige origem de ativação validada.');
    await bound.revalidate();await bound.verifyCopy();const temporary=path.join(this.tx!.dir,'materialized');await fs.mkdir(temporary,{recursive:true});
    const entries=await this.entries('INDEX',bound.index);
    if(entries.length)await git(this.repo.root,['checkout-index','--all',`--prefix=${gitPath(temporary)}/`],{index:bound.index});
    await bound.verifyCopy();await bound.revalidate();const snapshot=[],disposable=[];
    for(const e of entries){
      if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(e.oid))throw new LabError('INVALID_GIT_OUTPUT','OID de blob Git não suportado.');
      const source=path.join(temporary,e.path),observed=await fingerprintGitBlob(source,e.oid.length===40?'sha1':'sha256');
      if(!observed.exists)throw new LabError('EXTERNAL_EDIT',`Materialized file disappeared: ${e.path}`);
      // Anchor the first physical hash to Git, before any publication. Raw blob
      // bytes are valid Git content; converted checkout bytes require Git's own
      // filtered output. Never adopt a new hash from a changed private file.
      if(observed.blobOid!==e.oid){
        const expected=createHash('sha256');
        await git(this.repo.root,['cat-file','--filters','--path='+e.path,e.oid],{index:bound.index,consumeStdout:chunk=>{expected.update(chunk);}});
        if(expected.digest('hex')!==observed.hash)throw new LabError('EXTERNAL_EDIT','A extração privada não corresponde ao conteúdo Git solicitado.',{path:e.path,reason:'materialized-content-mismatch',oid:e.oid});
      }
      snapshot.push({path:e.path,source,sourceHash:observed.hash,mode:e.mode==='100755'?0o755:0o644});
      disposable.push({path:source,fingerprint:{exists:observed.exists,hash:observed.hash,mode:observed.mode}});
    }
    await bound.verifyCopy();await bound.revalidate();
    this.projectionCleanup=await prepareProjectionCleanup(this.tx!,temporary,disposable);return snapshot;
  }
  async on(name:string){return withLock(this.dir,async()=>{
    await this.guard(true,true);const active=this.registry.layers.find(l=>l.name===name&&l.state==='active');
    if(active&&!this.workspace.editing&&!this.workspace.acknowledgedMissing?.length){await this.editingCandidates();return structuredClone(active);}
    return this.mutateLocked('activate',async()=>{
      let l=this.registry.layers.find(l=>l.name===name);
      if(!l){await this.registerInternal(this.name(name),await this.localLayerRevision(name));l=this.layer(name);await this.writeJSON(path.join(this.dir,'reservations',l.id+'.json'),{schema:1,paths:l.reservations});this.validatedIndexes.set(l.id,await this.validateLayerIndex(l));}
      if(this.workspace.branchLayer===name)throw new LabError('LAYER_IS_BRANCH','Esta origem já é a branch de trabalho; não será projetada duas vezes.');
      if(l.state==='active')return l;
      const binding=this.validatedIndexes.get(l.id);if(!binding)throw new LabError('RECOVERY_REQUIRED','A ativação exige uma fronteira validada do índice.');
      const paths=await this.ownPaths(l);for(const p of paths)this.layerPath(p);await this.owners(l);await assertAttributes(this.repo.root,paths);await this.validateDestinations(paths);
      let snapshot,source:ActivationSource,shelfFile:string|undefined,shelfImage:any;
      if(l.shelf){
        shelfFile=path.join(this.dir,'shelves',l.id,l.shelf,'shelf.json');shelfImage=await fingerprint(shelfFile);
        const shelf=await readJSON<any>(shelfFile,v=>Array.isArray(v.files)&&v.index==='index'&&v.oid===l.oid&&Array.isArray(v.reservations)&&v.reservations.every((p:any)=>typeof p==='string'&&!!this.layerPath(p))&&v.files.every((f:any)=>typeof f.path==='string'&&!!this.layerPath(f.path)&&(f.bytes===null||(typeof f.bytes==='string'&&Buffer.from(f.bytes,'base64').toString('base64')===f.bytes))&&Number.isInteger(f.mode)&&f.mode>=0&&f.mode<=511));
        for(const f of shelf.files)this.layerPath(f.path);
        if(!sameFingerprint(shelfImage,await fingerprint(shelfFile))||new Set(shelf.files.map((f:any)=>f.path)).size!==shelf.files.length||shelf.files.some((f:any)=>!paths.includes(f.path)))throw new LabError('SHELF_INVALID','Shelf contém destinos não autorizados ou mudou.');
        const shelfIndex=path.join(this.dir,'shelves',l.id,l.shelf,'index');
        source=await prepareActivationSource(this.repo,this.index(l),l,this.tx!.dir,binding,shelfIndex);this.activationSource=source;
        const shelfEntries=await this.entries('INDEX',source.index);if(shelfEntries.some(e=>!paths.includes(e.path)))throw new LabError('SHELF_INVALID','Índice da shelf contém outro proprietário.');
        await source.revalidate();const target=this.index(l),expected=source.liveFingerprint;await this.track(target);
        const published=await publishPreparedIndexImage(this.repo,target,this.tx!.dir,{path:source.index,fingerprint:source.copyFingerprint},paths,{expected,
          beforePublish:async()=>{await source.revalidate(true);await source.verifyCopy();if(!sameFingerprint(shelfImage,await fingerprint(shelfFile!)))activationChanged('SHELF_INVALID','shelf-json-before-index-publication',{path:shelfFile});},
          planned:async(after,identity)=>{const entry=this.recoveryFileMap.get(target);if(!entry||!sameFingerprint(entry.before,expected))activationChanged('EXTERNAL_INDEX','shelf-index-before-publication',{path:target});entry!.after=after;this.tx!.data.recovery.activationIndexPublication={path:target,before:durableIndexIdentity(binding.identity),after:durableIndexIdentity(identity)};await this.tx!.record('index-publication-prepared',{path:target});}
        });
        await source.adoptPublishedIndex(published);await this.after(target,published.fingerprint);l.reservations=shelf.reservations;snapshot=shelf.files;
      }else{
        source=await prepareActivationSource(this.repo,this.index(l),l,this.tx!.dir,binding);this.activationSource=source;snapshot=await this.materialize(l);
      }
      const previousCheck=this.publicationCheck,previousFinal=this.transactionFinalCheck;
      const finalCheck=async()=>{if(previousFinal)await previousFinal();await source.revalidate();if(shelfFile&&!sameFingerprint(shelfImage,await fingerprint(shelfFile)))activationChanged('SHELF_INVALID','shelf-json-changed',{path:shelfFile});};
      const check=async()=>{if(previousCheck)await previousCheck();await finalCheck();};
      this.publicationCheck=check;this.transactionFinalCheck=finalCheck;await check();
      l.state='active';await this.owners();await check();await this.updateExcludes();await check();await this.publish(snapshot);await check();
      failpoint('after-activate-files');delete l.shelf;
      await source.verifyCopy();await this.checkpointTree(l,source.tree,source.checkpoint);source.checkpoint=source.tree;await check();
      await this.reserveProtection(name);return l;
    });
  });}
  private async changes(l:Layer){const staged=await this.changed(['diff','--cached','--name-status','-z','--no-renames',l.oid,'--'],this.index(l));const all=await this.ownPaths(l);const unstaged=all.length?await this.changed(['diff','--name-status','-z','--no-renames','--'],this.index(l)):[];const indexed=new Set((await this.entries('INDEX',this.index(l))).map(e=>e.path));for(const p of l.reservations)if(!indexed.has(p)&&await exists(path.join(this.repo.root,p)))unstaged.push({path:p,status:'?'});return {staged,unstaged};}
  private async changed(args:string[],index?:string):Promise<Change[]>{const out=(await (args[0]==='diff'&&!args.includes('--cached')&&!args.includes('--staged')?queryIndexDiff(this.repo,index??this.repo.index,args):git(this.repo.root,args,{index}))).stdout.toString().split('\0').filter(Boolean);const results:Change[]=[];for(let i=0;i<out.length;i+=2)results.push({status:out[i]!,path:out[i+1]!});return results;}
  /** Legacy callers get a refusal instead of the removed auto-park behavior. */
  async off(name:string,park=false){if(park)throw new LabError('AUTO_PARK_REMOVED','GL-16: auto-guardar removido. Faça commit, cancele ou use descarte explícito.');return this.deactivate(name);}
  async deactivate(name:string,options:{discard?:boolean}={}){return this.mutate('deactivate',()=>this.deactivateInternal(name,options.discard===true));}
  private async deactivateInternal(name:string,discard=false){
    if(this.workspace.branchLayer===name)throw new LabError('LAYER_IS_BRANCH','Saia do modo branch antes de desativar esta origem.');
    const l=this.layer(name,true);const paths=await this.ownPaths(l);const snapshot=[];
    // Capture the plan before the clean proof; later bytes cannot authorize their own removal.
    for(const p of paths)snapshot.push({path:p,fingerprint:await fingerprint(await safePath(this.repo.root,p))});
    const c=await this.changes(l);const dirty=!!(c.staged.length||c.unstaged.length||l.reservations.length);
    if(dirty&&!discard)throw new LabError('LAYER_DIRTY','Há pendências: faça commit, cancele ou descarte explicitamente. Nada foi guardado nem descartado.',c);
    await this.editingCandidates();const retainedPaths=[...await this.owners()].filter(([,owner])=>owner!==name).map(([p])=>p);
    // Validate the entire plan before removing even the first path; remove() checks each path again.
    for(const f of snapshot)if(!sameFingerprint(f.fingerprint,await fingerprint(await safePath(this.repo.root,f.path))))throw new LabError('EXTERNAL_EDIT',`Arquivo mudou depois do plano: ${f.path}`,{reason:'deactivation-plan-changed',path:f.path});
    // Persist the complete plan before the first removal, including size/IO validation.
    this.tx!.data.deactivation={layer:name,discard,paths};await this.tx!.record('deactivation-planned');
    for(const f of snapshot){if(!f.fingerprint.exists)continue;await this.remove(await safePath(this.repo.root,f.path),f.fingerprint);}
    failpoint('after-deactivate-files');await this.pruneLayerDirectories(paths,retainedPaths);failpoint('after-deactivate-directories');
    if(discard){await this.track(this.index(l));await git(this.repo.root,['read-tree',l.oid],{index:this.index(l)});await this.after(this.index(l));l.reservations=[];await this.checkpoint(l);}
    l.state='inactive';if(this.workspace.editing?.layer===name)delete this.workspace.editing;await this.updateExcludes();return structuredClone(l);
  }
  private async editingObservation(workspace:Workspace=this.workspace,includeBase=false) {
    const editing=workspace.editing;
    if(!editing&&!this.registry.layers.some(l=>l.state==='active'))return {missing:[] as {path:string;owner:string|null}[],candidates:[] as string[],fresh:[] as string[],externalBase:[] as string[],disk:[] as string[]};
    const disk=await walk(this.repo.root),present=new Set(disk),before=new Set(editing?.before??[]),owners=await this.owners(undefined,undefined,workspace);
    const acknowledged=new Set(workspace.acknowledgedMissing??[]);
    const missing=[...new Set([...before,...[...owners].filter(([,owner])=>editing||includeBase||owner!=='base').map(([p])=>p)])].filter(p=>!present.has(p)&&!acknowledged.has(p)).sort().map(p=>({path:p,owner:owners.get(p)??null}));
    const fresh=disk.filter(p=>!before.has(p)&&!owners.has(p));
    const captured=(editing?.assigned??[]).filter(p=>present.has(p)&&owners.get(p)===editing?.layer);
    const committedBase=new Set((await this.entries(this.repo.head)).map(e=>e.path));
    const nativeBaseNew=(!editing||includeBase)&&missing.length?[...owners].filter(([p,o])=>o==='base'&&!committedBase.has(p)&&!workspace.baseReservations?.includes(p)&&!editing?.acceptedBase?.includes(p)).map(([p])=>p):[];
    const uncertainExisting=includeBase&&missing.some(entry=>entry.owner!==null)?disk.filter(p=>!owners.has(p)):[];
    const candidates=[...new Set([...fresh,...captured,...nativeBaseNew,...uncertainExisting])].sort();
    const accepted=new Set([...editing?.acceptedBase??[],...workspace.baseReservations??[]]);
    const externalBase=[...new Set([...(editing?[...owners]:[]).filter(([p,o])=>o==='base'&&(!acknowledged.has(p)||present.has(p))&&!before.has(p)&&!accepted.has(p)&&!p.split('/').some(c=>['.gitignore','.gitattributes','.gitmodules'].includes(c.toLowerCase()))).map(([p])=>p),...(includeBase?nativeBaseNew:[])])].sort();
    return {missing,candidates,fresh,externalBase,disk};
  }
  private async ownershipReviewInternal(ownsMainLock=false,retainedAbsences:readonly string[]=[],observed?:EditingObservation) {
    const observation=observed??await this.editingObservation(this.workspace,true),owners=await this.owners();
    const paths=[...new Set([...observation.disk,...owners.keys(),...this.workspace.editing?.before??[],...retainedAbsences])].sort();
    const files=[];for(const p of paths)files.push({path:p,...await fingerprint(await safePath(this.repo.root,p))});
    const indexes=[];indexes.push({owner:'base',entries:await gitText(this.repo.root,['ls-files','--stage','-z'])});
    for(const l of this.registry.layers)indexes.push({owner:l.name,entries:await gitText(this.repo.root,['ls-files','--stage','-z'],{index:this.index(l)})});
    const refs=await gitText(this.repo.root,['for-each-ref','--format=%(refname) %(objectname)','refs/heads/']);
    const config=await gitText(this.repo.root,['config','--null','--list']);
    const head=await gitText(this.repo.root,['rev-parse','--verify','HEAD']),branch=await gitText(this.repo.root,['symbolic-ref','--quiet','HEAD']);
    if(!ownsMainLock&&await exists(this.repo.index+'.lock'))throw new LabError('LOCKED','O índice principal está bloqueado por outro processo; refaça a revisão depois.');
    const configured=await git(this.repo.root,['config','--null','--path','--get','core.excludesFile'],{ok:[0,1]});
    const globalFile=configured.code===0?configured.stdout.toString().replace(/\0$/u,''):path.join(process.env.XDG_CONFIG_HOME||path.join(process.env.HOME||os.homedir(),'.config'),'git','ignore');
    let globalIgnore:unknown=null;if(globalFile){const absolute=path.resolve(this.repo.root,globalFile);try{globalIgnore={path:absolute,fingerprint:await fingerprint(await fs.realpath(absolute))};}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;globalIgnore={path:absolute,missing:true};}}
    const observationToken=hash(JSON.stringify({head,branch,refs,indexes,files,config,globalIgnore,userExclude:await this.userExcludeText()}));
    const token=hash(JSON.stringify({workspace:this.workspace,owners:[...owners].sort(),observationToken}));
    return {token,observationToken,editingTarget:this.workspace.editing?.layer??null,missing:observation.missing,candidates:observation.candidates,externalBase:observation.externalBase,ambiguous:!!(observation.missing.length&&observation.candidates.length),readOnly:true as const};
  }
  async ownershipReview(){await this.guard(false);return this.ownershipReviewInternal();}
  async resolveOwnership(selection:{token:string;renames?:{from:string;to:string}[];independent?:string[];deleted?:string[];acceptBase?:string[]}) {
    return this.mutate('ownership-resolve',async()=>{
      const review=await this.ownershipReviewInternal();
      if(typeof selection.token!=='string'||selection.token!==review.token)throw new LabError('OWNERSHIP_REVIEW_STALE','O estado mudou. Execute ownership-review novamente antes de resolver.');
      const editing=this.workspace.editing;
      const owners=await this.owners(),missing=new Map(review.missing.map(p=>[p.path,p.owner]));
      const candidates=new Set(review.candidates),accepted=new Set(review.externalBase),handled=new Set<string>();
      const renames=selection.renames??[],independent=selection.independent??[],deleted=selection.deleted??[],acceptBase=selection.acceptBase??[];
      if(!Array.isArray(renames)||!Array.isArray(independent)||!Array.isArray(deleted)||!Array.isArray(acceptBase)||!renames.length&&!independent.length&&!deleted.length&&!acceptBase.length)throw new LabError('OWNERSHIP_SELECTION','Escolha renomeações, criações independentes, exclusões ou caminhos da base explicitamente.');
      const all=[...renames.flatMap(r=>[r.from,r.to]),...independent,...deleted,...acceptBase];for(const p of all){validatePath(p);if(handled.has(p))throw new LabError('OWNERSHIP_SELECTION','Caminho repetido na resolução.',{path:p});handled.add(p);}
      // Validate the entire selection, including retained staging, before changing any owner.
      for(const r of renames){
        if(!missing.has(r.from)||!candidates.has(r.to))throw new LabError('OWNERSHIP_SELECTION','Renomeação deve relacionar uma ausência e um candidato desta revisão.',r);
        const owner=missing.get(r.from),current=owners.get(r.to);
        if(owner&&owner!=='base')this.layer(owner,true);
        if(current){
          if(!editing||current!==editing.layer||!(editing.assigned??[]).includes(r.to))throw new LabError('OWNERSHIP','O destino já tem origem explícita; transferência não suportada.',r);
          const l=this.layer(current,true),committed=new Set((await this.entries(l.oid)).map(e=>e.path)),indexed=new Set((await this.entries('INDEX',this.index(l))).map(e=>e.path));
          if(committed.has(r.to)||indexed.has(r.to))throw new LabError('OWNERSHIP_REVIEW_STAGED','O candidato já está preparado ou commitado. Retire o staging sem alterar o disco e refaça a revisão; histórico commitado não é transferido.',{path:r.to,owner:current});
        }
        if(owner&&owner!=='base')this.layerPath(r.to);
      }
      for(const p of independent){if(!candidates.has(p))throw new LabError('OWNERSHIP_SELECTION','Criação independente deve ser um candidato atual.',{path:p});const current=owners.get(p);if(current&&(!editing||current!==editing.layer||!(editing.assigned??[]).includes(p)))throw new LabError('OWNERSHIP_SELECTION','O caminho já pertence a uma origem explícita; para staging na base use a decisão base, sem reatribuir ao destino.',{path:p,owner:current});}
      for(const p of deleted)if(!missing.has(p))throw new LabError('OWNERSHIP_SELECTION','Exclusão reconhecida deve ser uma ausência atual.',{path:p});
      for(const p of acceptBase)if(!accepted.has(p))throw new LabError('OWNERSHIP_SELECTION','Aceite somente caminhos já pertencentes à base nesta revisão.',{path:p});
      // Revalidate the observations immediately before publishing metadata; tokens never grant future authority.
      if((await this.ownershipReviewInternal()).token!==review.token)throw new LabError('OWNERSHIP_REVIEW_STALE','O estado mudou durante a resolução; nenhuma origem foi alterada.');
      const acknowledged=new Set(this.workspace.acknowledgedMissing??[]);
      for(const r of renames){
        const owner=missing.get(r.from);const previous=owners.get(r.to);
        if(previous){const l=this.layer(previous,true);l.reservations=l.reservations.filter(p=>p!==r.to);}
        if(editing)editing.assigned=(editing.assigned??[]).filter(p=>p!==r.to);
        if(owner==='base'){this.forgetBaseOwnership(r.from);this.workspace.baseReservations=[...new Set([...this.workspace.baseReservations??[],r.to])];}
        else if(owner){const l=this.layer(owner,true);l.reservations=[...new Set([...l.reservations,r.to])];}
        else if(editing)await this.rememberUnownedPath(r.to);
        acknowledged.add(r.from);
      }
      for(const p of deleted){acknowledged.add(p);if(owners.get(p)==='base')this.forgetBaseOwnership(p);}
      for(const p of independent){if(!owners.has(p)){if(editing){const l=this.layer(editing.layer,true);this.layerPath(p);l.reservations=[...new Set([...l.reservations,p])];}else this.workspace.baseReservations=[...new Set([...this.workspace.baseReservations??[],p])];}if(editing)editing.assigned=(editing.assigned??[]).filter(x=>x!==p);}
      if(editing)editing.acceptedBase=[...new Set([...editing.acceptedBase??[],...acceptBase])];
      if(acceptBase.length){const committed=new Set((await this.entries(this.repo.head)).map(e=>e.path));this.workspace.baseReservations=[...new Set([...this.workspace.baseReservations??[],...acceptBase.filter(p=>!committed.has(p))])];}
      this.workspace.acknowledgedMissing=[...acknowledged];await this.owners();await this.updateExcludes();
      this.publicationCheck=async()=>{if((await this.ownershipReviewInternal(false,review.missing.map(entry=>entry.path))).observationToken!==review.observationToken)throw new LabError('OWNERSHIP_REVIEW_STALE','Arquivos, Git ou regras de ignore mudaram antes da publicação; refaça a revisão.');};
      return {renames,independent,deleted,acceptedBase:acceptBase,staging:'unchanged',files:'unchanged'};
    },true,{reconcile:false});
  }
  private async rememberUnownedPath(p:string){const editing=this.workspace.editing;if(!editing)return;editing.assigned=(editing.assigned??[]).filter(candidate=>candidate!==p);editing.before=[...new Set([...editing.before,p])];const ignored=await ignoredWithoutManagedExcludes(this.repo,[p],await this.userExcludeText());if(!ignored.has(p))editing.unassigned=[...new Set([...editing.unassigned??[],p])];}
  /** Logical candidate discovery never decides provenance from content similarity. */
  private async editingCandidates(ownsMainLock=false,observed?:EditingObservation):Promise<string[]>{
    const editing=this.workspace.editing;if(editing)this.layer(editing.layer,true);
    const observation=observed??await this.editingObservation(this.workspace,!!editing);
    if(observation.missing.length&&observation.candidates.length){const review=observed?await this.ownershipReviewInternal(ownsMainLock,[],observed):await this.ownershipReviewInternal(ownsMainLock);throw new LabError('OWNERSHIP_AMBIGUOUS','Há caminhos ausentes e candidatos novos cuja origem não pode ser deduzida. Execute ownership-review e resolva explicitamente antes de preparar, commitar ou descartar.',review);}
    if(!editing)return [];
    if(observation.externalBase.length)throw new LabError('EDITING_BASE_INTERFERENCE','Caminhos novos apareceram na base antes da reconciliação do destino. Eles continuam na base; revise staging/histórico nativos ou aceite explicitamente com ownership-resolve base.',{paths:observation.externalBase,editingTarget:editing.layer,guidance:'Use base-unstage para retirar preparação preservando bytes, ou ownership-review e ownership-resolve base para aceitar a origem já existente. Não há reatribuição automática.'});
    const ignored=await ignoredWithoutManagedExcludes(this.repo,observation.fresh,await this.userExcludeText());
    const eligible=observation.fresh.filter(p=>!ignored.has(p)&&!p.split('/').some(component=>['.gitignore','.gitattributes','.gitmodules'].includes(component.toLowerCase()))).map(p=>this.layerPath(p));
    if(eligible.length){const actual=new Set((await git(this.repo.root,['check-ignore','--no-index','-z','--stdin'],{input:eligible.join('\0')+'\0',ok:[0,1]})).stdout.toString().split('\0').filter(Boolean));const exposed=eligible.filter(p=>!actual.has(p));if(exposed.length)throw new LabError('EDITING_IGNORE_UNSAFE','Regras de ignore de maior prioridade neutralizam a proteção de arquivos novos. Nenhuma origem foi atribuída; revise as negações antes de usar Git add direto.',{paths:exposed,editingTarget:editing.layer,guidance:'Revise .gitignore e exclusões, confira git check-ignore -v --no-index e consulte ownership-review. Force e comandos externos continuam fora da prevenção.'});}
    return eligible;
  }
  /** Native unstaging cannot revoke an explicitly accepted base origin. */
  private async retainAcceptedBase(){
    const accepted=this.workspace.editing?.acceptedBase??[];if(!accepted.length)return;
    const committed=await this.entries(this.repo.head);
    const tracked=new Set(committed.map(entry=>entry.path)),orphaned=accepted.filter(p=>!tracked.has(p));
    if(orphaned.length)this.workspace.baseReservations=[...new Set([...this.workspace.baseReservations??[],...orphaned])];
  }
  /** A deliberate rename/delete/release retires only the optional base markers. */
  private forgetBaseOwnership(...paths:string[]){
    const retired=new Set(paths);
    if(this.workspace.baseReservations)this.workspace.baseReservations=this.workspace.baseReservations.filter(p=>!retired.has(p));
    const editing=this.workspace.editing;if(!editing)return;
    if(editing.acceptedBase)editing.acceptedBase=editing.acceptedBase.filter(p=>!retired.has(p));
    if(editing.unassigned)editing.unassigned=editing.unassigned.filter(p=>!retired.has(p));
  }
  /** Record uncertainty before any walk that may remove acknowledged authority. */
  private async beginAcknowledgementObservation():Promise<string[]>{
    const current=this.workspace.acknowledgedMissing??[];if(!current.length)return [];
    if(!this.tx)throw new LabError('RECOVERY_REQUIRED','Observação de confirmações exige journal recuperável.');
    const previous=this.tx.data.recovery.beforeWorkspace.acknowledgedMissing??[];
    if(current.some(p=>!previous.includes(p)))throw new LabError('RECOVERY_INVALID','Confirmação criada nesta operação ainda não pode ser observada para revogação.');
    await this.track(path.join(this.dir,'workspace.json'));
    const old=this.tx.data.recovery.acknowledgements??{revoked:[],pending:[]};
    const revoked=[...old.revoked] as string[],known=new Set(revoked);
    const pending=[...new Set<string>([...old.pending,...current].filter(p=>!known.has(p)))];
    this.tx.data.recovery.acknowledgements={revoked,pending};
    await this.tx.record('acknowledgement-observation-pending');
    return pending;
  }
  /** Publish the observed union durably before changing authority in memory. */
  private async completeAcknowledgementObservation(present:Set<string>){
    const old=this.tx?.data.recovery.acknowledgements;if(!old)return;
    const revoked=[...new Set<string>([...old.revoked,...old.pending.filter((p:string)=>present.has(p))])];
    this.tx!.data.recovery.acknowledgements={revoked,pending:[]};
    await this.tx!.record('acknowledgement-observation-completed');
    const removed=new Set(revoked);if(this.workspace.acknowledgedMissing)this.workspace.acknowledgedMissing=this.workspace.acknowledgedMissing.filter(p=>!removed.has(p));
  }
  private async observeAcknowledgementsFromDisk(){
    const pending=await this.beginAcknowledgementObservation();if(!pending.length)return;
    await this.completeAcknowledgementObservation(new Set(await walk(this.repo.root)));
  }
  private async syncEditingInternal(){
    await this.retainAcceptedBase();
    await this.observeAcknowledgementsFromDisk();
    const editing=this.workspace.editing,assigned=await this.editingCandidates();if(!editing)return {assigned};
    const l=this.layer(editing.layer,true);
    if(assigned.length){l.reservations=[...new Set([...l.reservations,...assigned])];editing.assigned=[...new Set([...editing.assigned??[],...assigned])];await this.owners();}
    // A query also refreshes stale exemptions after external ignore changes.
    // Preserve the user's text and avoid a write if the generated block agrees.
    const before=await fingerprint(this.repo.exclude);
    const current=await fs.readFile(this.repo.exclude,'utf8').catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return '';throw error;});
    const expected=await this.excludeText(await this.protectedPaths());
    if(current!==expected){await this.writeBytes(this.repo.exclude,expected,undefined,before);await this.verifyExcludes();}
    else if(!sameFingerprint(before,await fingerprint(this.repo.exclude)))throw new LabError('EXTERNAL_EDIT','Regras de exclusão mudaram durante a reconciliação; texto externo preservado.');
    this.workspace.acknowledgedMissing=this.workspace.acknowledgedMissing??[];
    await this.observeAcknowledgementsFromDisk();
    return {assigned};
  }
  /** Read-only transition/claim check: never assigns interval creations to the old target. */
  private async checkEditingTransition(previous:Workspace){
    const observation=await this.editingObservation(previous,true);
    if(observation.missing.length&&observation.candidates.length)throw new LabError('OWNERSHIP_AMBIGUOUS','A origem de caminhos mudou durante a escolha do destino ou antes de uma nova reserva. Revise sem atribuir pela nova fronteira.',{missing:observation.missing,candidates:observation.candidates,externalBase:observation.externalBase,guidance:'Após a recusa, execute ownership-review e resolva explicitamente; nenhum token de um contexto não publicado concede autoridade.'});
    if(observation.externalBase.length)throw new LabError('EDITING_BASE_INTERFERENCE','Preparação externa alterou a base durante a escolha do destino; nenhuma origem será reatribuída.',{paths:observation.externalBase,guidance:'Revise o índice principal e execute ownership-review antes de tentar novamente.'});
  }
  async target(name?:string){return this.mutate('editing-target',async()=>{
    if(name){this.layer(name,true);if(this.workspace.branchLayer===name)throw new LabError('LAYER_IS_BRANCH','Esta já é a branch de trabalho; use o fluxo Git normal.');const previous=structuredClone(this.workspace);const boundary=await captureEditingBoundary(this.repo,{readOwners:()=>this.owners(),readUserExclude:()=>this.userExcludeText()});await this.checkEditingTransition(previous);this.workspace.editing={layer:name,before:boundary.before,unassigned:boundary.unassigned,assigned:[],acceptedBase:[],startedAt:new Date().toISOString()};this.publicationCheck=async()=>{await boundary.revalidate();await this.checkEditingTransition(previous);};}
    else{await this.syncEditingInternal();delete this.workspace.editing;}
    await this.updateExcludes();return this.editingTarget();
  });}
  async editingTarget(){return {target:this.workspace.editing?.layer??null,startedAt:this.workspace.editing?.startedAt??null,observation:'reconciled-at-product-command',protectionScope:'observed paths; force, higher-priority ignores and destructive native commands remain bypasses',nativeNewFileProtection:this.workspace.editing?.unassigned?'exclude-until-observed':'none',staging:'explicit'};}
  async preview(action:'on'|'off'|'remove',name:string){
    await this.refresh();const impediments:{code:string,message:string}[]=[];
    try{await this.guard();}catch(e){impediments.push({code:(e as any).code,message:message(e)});}
    const persisted=this.registry.layers.find(l=>l.name===name);let unreconciled:string[]=[];let logicalComplete=true;
    try{if(this.workspace.editing?.layer===name)unreconciled=await this.editingCandidates();}catch(e){logicalComplete=false;impediments.push({code:(e as any).code,message:message(e)});}
    const l=persisted?{...persisted,reservations:[...persisted.reservations,...unreconciled]}:undefined;let paths:string[]=[];let pending:any=null;
    if(!l){const oid=await this.recognizedLayerRevision(name);paths=(await this.entries(oid)).map(e=>e.path);if(action==='off')impediments.push({code:'LAYER_INACTIVE',message:'Layer reconhecida e ainda não ativada.'});if(action==='remove'&&(await git(this.repo.root,['show-ref','--verify','--quiet','refs/heads/layer/'+name],{ok:[0,1]})).code!==0)impediments.push({code:'LAYER_REMOTE_ONLY',message:'Não há referência local para remover; o remoto não será alterado.'});}
    else{paths=await this.ownPaths(l);if(l.state==='active')pending=await this.changes(l);if(this.workspace.branchLayer===name)impediments.push({code:'LAYER_IS_BRANCH',message:'Esta origem é a branch de trabalho.'});}
    if(action==='on'&&l?.state!=='active')try{for(const p of paths)this.layerPath(p);if(l)await this.owners(l);else assertNoCollisions([...[...await this.owners()].map(([path,owner])=>({path,owner})),...paths.map(path=>({path,owner:'Layer a ativar'}))]);await this.validateDestinations(paths);}catch(e){impediments.push({code:(e as any).code,message:message(e)});}
    if(pending&&(pending.staged.length||pending.unstaged.length||l!.reservations.length))impediments.push({code:'LAYER_DIRTY',message:'Faça commit, cancele ou escolha descarte explícito.'});
    if(l?.shelf)impediments.push({code:'LEGACY_SHELF',message:'Trabalho legado preservado; on restaura essa shelf após validar colisões.'});
    return {action,layer:name,appears:action==='on'&&l?.state!=='active'?paths:[],disappears:action!=='on'&&l?.state==='active'?paths:[],pending,impediments,unreconciled,logicalComplete,readOnly:true,revalidatedOnApply:true};
  }
  private async registerLocalIdentity(name:string){this.name(name);await this.refresh();if(!this.registry.layers.some(l=>l.name===name)){if((await git(this.repo.root,['show-ref','--verify','--quiet','refs/heads/layer/'+name],{ok:[0,1]})).code!==0)throw new LabError('LAYER_REMOTE_ONLY','Crie ou ative a referência local antes desta operação; nenhuma referência remota será removida.');await this.register(name);}}
  async renameLayer(name:string,newName:string){this.name(newName);await this.registerLocalIdentity(name);return this.mutate('rename-layer',async()=>{
    const l=this.layer(name);if(this.workspace.branchLayer===name)throw new LabError('LAYER_IS_BRANCH','Saia desta branch antes de renomeá-la.');
    const ref='refs/heads/layer/'+newName;await git(this.repo.root,['check-ref-format',ref]);if(this.registry.layers.some(x=>x.name===newName)||(await git(this.repo.root,['show-ref','--verify','--quiet',ref],{ok:[0,1]})).code===0)throw new LabError('LAYER_EXISTS','Destino já existe.');
    const plan=await prepareLayerRename(this.repo,this.tx!,l,ref);await this.releaseProtection(name);
    await applyLayerRename(this.repo,this.tx!,plan);failpoint('after-layer-ref-change');
    l.name=newName;l.ref=ref;if(this.workspace.editing?.layer===name)this.workspace.editing.layer=newName;await this.reserveProtection(newName);failpoint('after-layer-rename-protection');return structuredClone(l);
  });}
  async removeLayer(name:string,options:{discard?:boolean}={}){await this.registerLocalIdentity(name);return this.mutate('remove-layer',async()=>{
    const l=this.layer(name);if(this.workspace.branchLayer===name)throw new LabError('LAYER_IS_BRANCH','Não remova a branch de trabalho.');
    if(l.shelf)throw new LabError('LEGACY_SHELF','Shelf legada preservada; reative e resolva esse trabalho antes de remover.');
    if(l.state==='active')await this.deactivateInternal(name,options.discard===true);
    else if(l.reservations.length||(await this.changed(['diff','--cached','--name-status','-z',l.oid,'--'],this.index(l))).length)throw new LabError('LAYER_DIRTY','índice/reservas inativos exigem resolução explícita antes da remoção.');
    this.tx!.data.recovery.refOperation={kind:'delete',id:l.id,from:l.ref,oid:l.oid};await this.tx!.record('remove-ref-planned');await updateDirectRef(this.repo.root,`refs/git-layers/transactions/${this.tx!.id}/removed-commit`,l.oid,'');await this.tx!.record('removed-commit-retained');await this.releaseProtection(name);await deleteDirectRef(this.repo.root,l.ref,l.oid);failpoint('after-layer-ref-change');
    this.registry.layers=this.registry.layers.filter(x=>x.id!==l.id);if(this.workspace.editing?.layer===name)delete this.workspace.editing;return {removed:name,remoteChanged:false,recoveryRetained:true};
  });}
  private async rollbackRefs(data:any){const managed=data.recovery?.managedIndexPublication;if(managed){const current=await managedIndexContext(this.repo,this.dir,data);if(current!==managed.checkpoint)await updateDirectRef(this.repo.root,'refs/git-layers/state/'+managed.layerId,managed.checkpoint,current);}const op=data.recovery?.refOperation;if(!op)return;if(op.protocol!==undefined){if(op.kind!=='rename'||op.protocol!=='native-copy-cas-v1')throw new LabError('RECOVERY_INVALID','Protocolo de ref desconhecido; journal preservado.');await rollbackLayerRename(this.repo,this.dir,data);return;}
    const read=async(ref:string)=>(await git(this.repo.root,['rev-parse','--verify',ref],{ok:[0,128]})).stdout.toString().trim();
    const from=await read(op.from);if(op.kind==='rename'){const to=await read(op.to);if(from===op.oid&&!to)return;if(from||to!==op.oid)throw new LabError('RECOVERY_CONFLICT','Refs mudaram após rename; dados preservados.');await updateDirectRefs(this.repo.root,[{kind:'create',ref:op.from,newOid:op.oid},{kind:'delete',ref:op.to,oldOid:op.oid}]);}
    else{if(from===op.oid)return;if(from)throw new LabError('RECOVERY_CONFLICT','Ref removida foi recriada; preservada.');await updateDirectRef(this.repo.root,op.from,op.oid,'');}
  }
  private async expand(paths:string[]){if(!paths.length)throw new LabError('PATH_REQUIRED','Informe caminhos explícitos.');const disk=await walk(this.repo.root);const known=[...new Set([...(await this.owners()).keys(),...disk])];const result=new Set<string>();for(const raw of paths){if(raw==='.'||raw===''){for(const p of known)result.add(p);continue;}const p=validatePath(raw.replace(/\/$/,''));await safePath(this.repo.root,p);const matching=known.filter(k=>k===p||k.split('/').slice(0,p.split('/').length).join('/')===p);if(!matching.length)throw new LabError('PATH_MISSING',`Caminho não encontrado: ${p}`);for(const f of matching)result.add(f);}return [...result];}
  private async beginManagedStage(layer:Layer):Promise<ManagedStageBoundary>{
    const index=this.index(layer),token=this.validatedIndexes.get(layer.id);
    if(!token)throw new LabError('RECOVERY_REQUIRED','Staging da Layer exige índice validado.');
    const original={fingerprint:{...token.fingerprint},identity:{...token.identity}},plan={path:index,layerId:layer.id,ref:layer.ref,oid:layer.oid,checkpoint:token.checkpoint,checkpointPublished:false,before:durableIndexIdentity(token.identity),after:null as ReturnType<typeof durableIndexIdentity>|null,tree:null as string|null};
    let expected=original,checkpoint=token.checkpoint;
    const changed=(code:string,boundary:string):never=>{throw new LabError(code,'A origem ou publicação do staging mudou externamente; índice, referências e recuperação foram preservados.',{reason:'managed-stage-source-changed',boundary,path:index});};
    const check=async(ownLock=false)=>{
      if(!sameIndexIdentity(expected.identity,await observeIndexIdentity(index))||!sameFingerprint(expected.fingerprint,await fingerprint(index))||!sameIndexIdentity(expected.identity,await observeIndexIdentity(index)))changed('EXTERNAL_INDEX','index-image');
      try{await managedIndexContext(this.repo,this.dir,this.tx!.data,checkpoint,ownLock);}catch(error){if(error instanceof LabError)changed(error.code==='LOCKED'?'LOCKED':'EXTERNAL_REF','git-context');throw error;}
    };
    const boundary:ManagedStageBoundary={path:index,check,
      planned:async(after,identity,proof)=>{if(!proof||!sameIndexIdentity(original.identity,proof.beforeIdentity))changed('EXTERNAL_INDEX','prepared-before-image');const file=this.recoveryFileMap.get(index);if(!file||!sameFingerprint(file.before,original.fingerprint))changed('EXTERNAL_INDEX','backup-before-image');file!.after={...after};plan.after=durableIndexIdentity(identity);plan.tree=proof!.tree;await this.tx!.record('index-publication-prepared',{path:index});},
      published:image=>{if(image.tree!==plan.tree||!sameIndexIdentity(original.identity,image.beforeIdentity))changed('EXTERNAL_INDEX','published-proof');expected={fingerprint:{...image.fingerprint},identity:{...image.identity}};},
      tree:()=>{if(!plan.tree)throw new LabError('RECOVERY_REQUIRED','Árvore de staging não foi publicada.');return plan.tree;},checkpoint:()=>checkpoint,checkpointed:async()=>{checkpoint=plan.tree!;plan.checkpointPublished=true;await this.tx!.record('managed-stage-checkpoint-published',{path:index});}
    };
    this.managedStage=boundary;this.tx!.data.recovery.managedIndexPublication=plan;await this.track(index);await this.tx!.record('managed-index-source-prepared',{path:index});await check();
    const previousPublication=this.publicationCheck,previousFinal=this.transactionFinalCheck;
    this.publicationCheck=async()=>{if(previousPublication)await previousPublication();await check();};this.transactionFinalCheck=async()=>{if(previousFinal)await previousFinal();await check();};return boundary;
  }
  /** A failed MAIN add never authorizes a rewrite of an unrelated private index. */
  private async validateMainStageRollback(data:any){
    const current=await discover(this.repo.root),before=data.recovery.beforeWorkspace;
    if(current.head!==before.head||current.branch!==before.branch)throw new LabError('RECOVERY_CONFLICT','HEAD mudou durante rollback de staging MAIN; contexto externo preservado.');
    await queryIndexTree(this.repo,this.repo.index);
    for(const layer of data.recovery.beforeRegistry.layers as Layer[]){
      const token=this.validatedIndexes.get(layer.id),index=this.privateIndex(layer);
      const unchanged=async()=>!!token&&sameIndexIdentity(token.identity,await observeIndexIdentity(index))&&sameFingerprint(token.fingerprint,await fingerprint(index))&&sameIndexIdentity(token.identity,await observeIndexIdentity(index));
      if(!await unchanged())throw new LabError('RECOVERY_CONFLICT','Índice privado externo foi preservado durante rollback MAIN.');
      const tree=(await queryIndexTree(this.repo,index)).stdout.toString().trim();
      if(tree!==token!.checkpoint||!await unchanged()||await gitText(this.repo.root,['rev-parse','--verify','refs/git-layers/state/'+layer.id])!==token!.checkpoint||await gitText(this.repo.root,['rev-parse','--verify',layer.ref])!==layer.oid)throw new LabError('RECOVERY_CONFLICT','Checkpoint ou ref externa foi preservada durante rollback MAIN.');
    }
  }
  async add(name:string,paths:string[]){return this.mutate('stage',()=>this.addInternal(name,paths));}
  private async addInternal(name:string,paths:string[]){if(this.workspace.branchLayer===name)return this.stageBaseInternal(paths);const l=this.layer(name,true),boundary=await this.beginManagedStage(l);const files=await this.expand(paths);await assertAttributes(this.repo.root,files);const owners=await this.owners();if(files.some(p=>!owners.has(p)))await this.checkEditingTransition(structuredClone(this.workspace));for(const p of files){this.layerPath(p);const owner=owners.get(p);if(owner&&owner!==name)throw new LabError('OWNERSHIP',`${p} pertence a ${owner}. Lote inteiro recusado.`);await safePath(this.repo.root,p);}
    const prior=new Set(await this.ownPaths(l));for(const p of files)if(!prior.has(p))l.reservations.push(p);await this.owners();await this.updateExcludes();await this.editingCandidates();await this.stageIndexInternal(this.index(l),files,true);failpoint('after-stage-index');await boundary.check();await this.checkpointTree(l,boundary.tree(),boundary.checkpoint());await boundary.checkpointed();await boundary.check();failpoint('after-stage-checkpoint');return {paths:files};}
  async unstage(name:string,paths:string[]){return this.mutate('unstage',async()=>{if(this.workspace.branchLayer===name)return this.unstageBaseInternal(paths);const l=this.layer(name,true);const files=await this.authorized(l,paths);await this.track(this.index(l));await git(this.repo.root,['restore','--staged',`--source=${l.oid}`,'--',...files],{index:this.index(l)});await this.after(this.index(l));await this.checkpoint(l);return {paths:files};},true,{reconcile:false});}
  private async authorized(l:Layer,paths:string[]){const own=new Set(await this.ownPaths(l));const files=await this.expand(paths);for(const p of files)if(!own.has(p))throw new LabError('OWNERSHIP',`${p} não pertence à Layer ${l.name}.`);return files;}
  async release(name:string,paths:string[]){return this.mutate('release',async()=>{if(name==='base'){const committed=new Set((await this.entries(this.repo.head)).map(e=>e.path)),indexed=new Set((await this.entries('INDEX')).map(e=>e.path));for(const p of paths){validatePath(p);if(committed.has(p)||indexed.has(p)||!this.workspace.baseReservations?.includes(p)&&!this.workspace.editing?.acceptedBase?.includes(p))throw new LabError('RELEASE_UNSAFE','Release base exige reserva explícita, sem HEAD ou staging.');}this.forgetBaseOwnership(...paths);for(const p of paths)await this.rememberUnownedPath(p);await this.updateExcludes();return {paths};}const l=this.layer(name,true);const committed=new Set((await this.entries(l.oid)).map(e=>e.path));const indexed=new Set((await this.entries('INDEX',this.index(l))).map(e=>e.path));for(const p of paths){validatePath(p);if(committed.has(p)||indexed.has(p)||!l.reservations.includes(p))throw new LabError('RELEASE_UNSAFE','Release somente para reserva nunca commitada e sem staging.');}l.reservations=l.reservations.filter(p=>!paths.includes(p));if(this.workspace.editing?.layer===name){this.workspace.editing.before=[...new Set([...this.workspace.editing.before,...paths])];for(const p of paths)await this.rememberUnownedPath(p);}await this.updateExcludes();return {paths};});}
  async commit(name:string,msg:string){if(!msg.trim())throw new LabError('EMPTY_MESSAGE','Mensagem de commit vazia.');return this.mutate('commit-layer',async()=>{if(this.workspace.branchLayer===name)return this.baseCommitInternal(msg);const l=this.layer(name,true);const {staged}=await this.changes(l);if(!staged.length)throw new LabError('NOTHING_STAGED','Nenhuma alteração preparada.');await git(this.repo.root,['var','GIT_AUTHOR_IDENT']);await git(this.repo.root,['var','GIT_COMMITTER_IDENT']);const tree=await this.checkpoint(l);await this.owners();const oid=await gitText(this.repo.root,['commit-tree',tree,'-p',l.oid,'-F','-'],{input:msg+'\n'});this.tx!.data.recovery.commit={ref:l.ref,old:l.oid,new:oid,layerId:l.id};await this.tx!.record('commit-prepared',{oid});await this.editingCandidates();await updateDirectRef(this.repo.root,l.ref,oid,l.oid);await this.tx!.record('commit-ref-updated',{oid});failpoint('after-commit-ref');l.oid=oid;l.indexBase=oid;const newPaths=new Set((await this.entries(oid)).map(e=>e.path));l.reservations=l.reservations.filter(p=>!newPaths.has(p));await this.updateExcludes();return {oid,ref:l.ref,tree};});}
  async status(name?:string){await this.load();let safe=true;let error:any;if(this.workspace.editing||this.registry.layers.some(l=>l.state==='active'))try{await this.syncEditingForStatus();}catch(e){safe=false;error={code:(e as any).code,message:message(e),details:(e as any).details};}try{await this.guard(false);}catch(e){safe=false;error={code:(e as any).code,message:message(e),details:(e as any).details};}const base={staged:await this.changed(['diff','--cached','--name-status','-z','--no-renames',...(this.repo.head?[this.repo.head]:[]),'--']),unstaged:await this.changed(['diff','--name-status','-z','--no-renames','--'])};const indexedBase=new Set((await this.entries('INDEX')).map(e=>e.path));for(const p of this.workspace.baseReservations??[])if(!indexedBase.has(p)&&await exists(path.join(this.repo.root,p)))base.unstaged.push({path:p,status:'?'});const layers=[];for(const l of this.registry.layers){let c={staged:[] as Change[],unstaged:[] as Change[]};try{if(l.state==='active')c=await this.changes(l);}catch(e){safe=false;error??={code:(e as any).code,message:message(e),details:(e as any).details};}if(!name||l.name===name)layers.push({...structuredClone(l),...(!safe&&error?.code==='RECOVERY_REQUIRED'?{previousState:l.state,state:'recovery-required' as const}:{}),...c});}let owners=new Map<string,string>();try{owners=await this.owners();}catch{}const untracked=(await git(this.repo.root,['ls-files','--others','--exclude-standard','-z'])).stdout.toString().split('\0').filter(p=>p&&!owners.has(p));const protection=await inspectBranchProtection(this.repo.root);if(!protection.healthy){safe=false;error={code:'PROTECTION_CONFLICT',message:'Proteção de branches inconsistente.',details:protection.problems};}const recognized=[...structuredClone(this.registry.layers),...(await this.candidates()).map(name=>({name,id:'',state:'inactive',remote:undefined})),...(await this.remoteCandidates()).map(remote=>({...remote,id:'',state:'inactive'}))];return {branch:this.repo.branch,head:this.repo.head,role:this.workspace.branchLayer?'layer-branch':'traditional',branchLayer:this.workspace.branchLayer??null,editingTarget:this.workspace.editing?.layer??null,editingObservation:'at-product-command',branchProtection:protection,nativeProtection:{universal:false,directDestructiveCommands:false,scope:'exclusões de staging comum e reservas opcionais de branch; Git direto conserva seu significado'},ownership:{baseReservations:this.workspace.baseReservations??[],acknowledgedMissing:this.workspace.acknowledgedMissing??[]},recognized:recognized.map(l=>({name:l.name,registered:!!l.id,active:l.state==='active',role:l.name===this.workspace.branchLayer&&!l.remote?'branch':'layer',remote:l.remote??null})),base,layers,untracked,safe,error};}
  async diff(name:string,staged=false,paths:string[]=[]){await this.guard(false);return this.diffInternal(name,staged,paths);}
  private async diffInternal(name:string,staged=false,paths:string[]=[]){for(const p of paths)validatePath(p);if(name==='base'){const args=['diff',...(staged?['--cached',...(this.repo.head?[this.repo.head]:[])]:[]),'--no-renames','--',...paths];return (await (staged?git(this.repo.root,args):queryIndexDiff(this.repo,this.repo.index,args))).stdout.toString();}const l=this.layer(name,true);const own=await this.ownPaths(l);const files=paths.length?await this.authorized(l,paths):own;if(!files.length)return '';const args=['diff',...(staged?['--cached',l.oid]:[]),'--no-renames','--',...(paths.length?files:[])];return (await (staged?git(this.repo.root,args,{index:this.index(l)}):queryIndexDiff(this.repo,this.index(l),args))).stdout.toString();}
  async log(name='base'){await this.refresh();const ref=name==='base'?this.repo.head:await this.recognizedLayerRevision(name);if(!ref)return [];const output=await gitText(this.repo.root,['log','-50','--format=%H%x00%P%x00%an%x00%aI%x00%s',ref,'--']);return output?output.split('\n').map(line=>{const [oid,parents,author,date,subject]=line.split('\0');return {oid,parents:parents?.split(' ').filter(Boolean),author,date,subject};}):[];}
  private async revision(rev:string){if(typeof rev!=='string'||rev.startsWith('-')||/[\0\r\n]/.test(rev))throw new LabError('INVALID_REV','Revisão inválida.');return gitText(this.repo.root,['rev-parse','--verify',`${rev}^{commit}`]);}
  async show(rev:string){const oid=await this.revision(rev);return (await git(this.repo.root,['show','--format=fuller','--stat','--patch',oid,'--'])).stdout.toString();}
  async compare(from:string,to:string){return (await git(this.repo.root,['diff',await this.revision(from),await this.revision(to),'--'])).stdout.toString();}
  async restore(name:string,paths:string[],confirmed=false){if(!confirmed)throw new LabError('CONFIRM_REQUIRED','Restaurar disco a partir do índice exige confirmação. Staging será preservado e cópias de recuperação serão criadas.');return this.mutate('restore',async()=>{const files=name==='base'?await this.baseAuthorized(paths):await this.authorized(this.layer(name,true),paths);const index=name==='base'?undefined:this.index(this.layer(name));const entries=await this.entries('INDEX',index);const temporary=path.join(this.tx!.dir,'restore');await fs.mkdir(temporary,{recursive:true});const included=files.filter(p=>entries.some(e=>e.path===p));if(included.length)await git(this.repo.root,['checkout-index',`--prefix=${gitPath(temporary)}/`,'--',...included],{index});for(const p of files){const full=await safePath(this.repo.root,p);const entry=entries.find(e=>e.path===p);if(entry)await this.writeBytes(full,await fs.readFile(path.join(temporary,p)),entry.mode==='100755'?0o755:0o644);else if(await exists(full))await this.remove(full);}return {paths:files,backup:this.tx!.dir};},false);}
  private async baseAuthorized(paths:string[]){const files=await this.expand(paths);const owners=await this.owners();for(const p of files){const owner=owners.get(p);if(owner&&owner!=='base')throw new LabError('OWNERSHIP',`Este arquivo pertence à Layer ${owner}. Prepare-o no painel dessa Layer.`,{path:p,owner});}return files;}
  private async stageIndexInternal(index:string,files:string[],force=false){
    const boundary=this.managedStage?.path===index?this.managedStage:undefined;
    const expected=await fingerprint(index);await this.track(index);
    if(boundary)await boundary.check();
    const options={expected,beforePublish:async()=>{await this.editingCandidates(index===this.repo.index);if(boundary)await boundary.check(true);},planned:async(after:any,identity:IndexIdentity,proof?:ManagedStageProof)=>{if(boundary)return boundary.planned(after,identity,proof);const entry=this.recoveryFiles.find(file=>file.path===index);if(!entry||!sameFingerprint(entry.before,expected))throw new LabError('EXTERNAL_EDIT','O índice mudou antes da preparação técnica.');entry.after=after;await this.tx!.record('index-publication-prepared',{path:index});}};
    if(boundary){const published=await stageIndexWithProof(this.repo,index,this.tx!.dir,['add',...(force?['-f']:[]),'-A','--',...files],options);boundary.published(published);failpoint('after-stage-index-publication');await boundary.check();await this.after(index,published.fingerprint);}
    else{const published=await stageIndex(this.repo,index,this.tx!.dir,['add',...(force?['-f']:[]),'-A','--',...files],options);failpoint('after-stage-index-publication');await this.after(index,published);}
  }
  private async stageBaseInternal(paths:string[]){const files=await this.baseAuthorized(paths);await this.editingCandidates();await this.stageIndexInternal(this.repo.index,files);return {paths:files};}
  async baseStage(paths:string[]){return this.mutate('stage-base',()=>this.stageBaseInternal(paths),false);}
  async baseUnstage(paths:string[]){return this.mutate('unstage-base',()=>this.unstageBaseInternal(paths),false,{reconcile:false});}
  private async unstageBaseInternal(paths:string[]){
    const initialIndex=await fingerprint(this.repo.index);
    const files=await this.baseAuthorized(paths);
    const indexed=new Set((await this.entries('INDEX')).map(entry=>entry.path));
    const committed=new Set((await this.entries(this.repo.head)).map(entry=>entry.path));
    if(!sameFingerprint(initialIndex,await fingerprint(this.repo.index)))throw new LabError('EXTERNAL_EDIT','O índice principal mudou durante a validação do unstage.');
    // Native staging identifies a destination, never the source of an ambiguous rename.
    // Observe before restore and retain only unambiguous or explicitly accepted base origins.
    await this.beginAcknowledgementObservation();
    const context=structuredClone(this.workspace),observation=await this.editingObservation(context,true);
    const present=new Set(context.editing||this.registry.layers.some(l=>l.state==='active')?observation.disk:await walk(this.repo.root));
    await this.completeAcknowledgementObservation(present);
    if(context.acknowledgedMissing)context.acknowledgedMissing=[...this.workspace.acknowledgedMissing??[]];
    const selectedNew=new Set(files.filter(p=>indexed.has(p)&&!committed.has(p)));
    const missingSelected=observation.missing.filter(entry=>selectedNew.has(entry.path));
    if(missingSelected.length)throw new LabError('OWNERSHIP_AMBIGUOUS','O staging é a última origem conhecida de caminhos ausentes. Resolva a renomeação ou exclusão com ownership-review antes do unstage.',{missing:missingSelected,candidates:observation.candidates});
    const uncertain=new Set(observation.missing.length?observation.candidates:[]);
    const retained=files.filter(p=>selectedNew.has(p)&&present.has(p)&&!uncertain.has(p));
    const accepted=new Set([...context.baseReservations??[],...context.editing?.acceptedBase??[]]);
    const newlyRetained=new Set(retained.filter(p=>!accepted.has(p)));
    await this.track(this.repo.index);
    if(!sameFingerprint(initialIndex,await fingerprint(this.repo.index)))throw new LabError('EXTERNAL_EDIT','O índice principal mudou antes do unstage.');
    if(this.repo.head)await git(this.repo.root,['restore','--staged',`--source=${this.repo.head}`,'--',...files]);else await git(this.repo.root,['rm','--cached','--ignore-unmatch','--',...files]);
    await this.after(this.repo.index);
    if(retained.length){this.workspace.baseReservations=[...new Set([...this.workspace.baseReservations??[],...retained])];await this.updateExcludes();}
    if(newlyRetained.size)this.publicationCheck=async()=>{
      // Recheck without the provisional markers: they must not hide an interval rename.
      const current=await this.editingObservation(context,true);
      const stillPresent=new Set(context.editing||this.registry.layers.some(l=>l.state==='active')?current.disk:await walk(this.repo.root)),vanished=[...newlyRetained].filter(p=>!stillPresent.has(p));
      if(vanished.length||current.missing.length&&current.candidates.some(p=>newlyRetained.has(p)))throw new LabError('OWNERSHIP_AMBIGUOUS','A origem mudou durante o unstage; revise a recuperação e resolva a origem explicitamente.',{missing:current.missing,vanished,candidates:current.candidates});
    };
    return {paths:files};
  }
  async baseCommit(msg:string){if(!msg.trim())throw new LabError('EMPTY_MESSAGE','Mensagem de commit vazia.');return this.mutate('commit-base',()=>this.baseCommitInternal(msg),false);}
  private async baseCommitInternal(msg:string){const changes=await this.changed(['diff','--cached','--name-status','-z',...(this.repo.head?[this.repo.head]:[]),'--']);if(!changes.length)throw new LabError('NOTHING_STAGED','Nada preparado na branch tradicional.');const owners=await this.owners();for(const c of changes)if(owners.get(c.path)&&owners.get(c.path)!=='base')throw new LabError('BASE_CONTAMINATED',`${c.path} pertence a uma Layer.`);await this.track(this.repo.index);const old=this.repo.head;const tree=await gitText(this.repo.root,['write-tree']);const oid=await gitText(this.repo.root,['commit-tree',tree,...(old?['-p',old]:[]),'-F','-'],{input:msg+'\n'});this.tx!.data.recovery.commit={ref:`refs/heads/${this.repo.branch}`,old,new:oid,base:true};await this.tx!.record('commit-prepared',{oid});await this.editingCandidates();await updateDirectRef(this.repo.root,`refs/heads/${this.repo.branch}`,oid,old);await this.after(this.repo.index);await this.tx!.record('commit-ref-updated',{oid});failpoint('after-commit-ref');this.repo=await discover(this.repo.root);this.workspace={...this.workspace,schema:1,head:this.repo.head,branch:this.repo.branch};if(this.workspace.branchLayer){const l=this.layer(this.workspace.branchLayer);l.oid=oid;l.indexBase=oid;const committed=new Set((await this.entries(oid)).map(e=>e.path));l.reservations=l.reservations.filter(p=>!committed.has(p));}return {oid,ref:`refs/heads/${this.repo.branch}`,tree};}
  async configureIdentity(name:string,email:string){if(!name.trim()||!email.includes('@')||/[\r\n\0]/.test(name+email))throw new LabError('IDENTITY_INVALID','Nome/email inválidos.');return this.mutate('identity',async()=>{const config=await gitText(this.repo.root,['rev-parse','--path-format=absolute','--git-path','config']);await this.track(config);await git(this.repo.root,['config','--local','user.name',name]);await git(this.repo.root,['config','--local','user.email',email]);await this.after(config);return {name,email,scope:'local'};},false);}
  async branches(){const out=await gitText(this.repo.root,['for-each-ref','--format=%(refname:short)%00%(objectname)','refs/heads/']);return out.split('\n').filter(Boolean).filter(s=>!s.startsWith('layer/')).map(line=>{const [name,oid]=line.split('\0');return {name,oid,current:name===this.repo.branch};});}
  private async branchName(name:string){if(typeof name!=='string'||name.startsWith('-')||name.startsWith('layer/')||/[\0\n\r]/.test(name))throw new LabError('INVALID_BRANCH','Informe uma branch tradicional válida.');await git(this.repo.root,['check-ref-format',`refs/heads/${name}`]);return name;}
  async branchCreate(name:string){await this.branchName(name);return this.mutate('branch-create',async()=>{await git(this.repo.root,['branch',name]);return {name};});}
  async branchDelete(name:string){await this.branchName(name);return this.mutate('branch-delete',async()=>{if(name===this.repo.branch)throw new LabError('CURRENT_BRANCH','Não é possível excluir a branch atual.');await git(this.repo.root,['branch','-d','--',name]);return {name};});}
  async switch(branch:string,options:{resumeLayer?:boolean}={}){await this.branchName(branch);return this.mutate('switch',()=>this.switchInternal(branch,undefined,options.resumeLayer!==false));}
  async openLayerBranch(name:string){this.name(name);await this.refresh();if(!this.registry.layers.some(l=>l.name===name))await this.register(name);return this.mutate('switch',()=>this.switchInternal('layer/'+name,name));}
  private async switchInternal(branch:string,openingName?:string,allowResume=true){
    if(branch===this.repo.branch)return {branch,head:this.repo.head};
    const staged=await this.changed(['diff','--cached','--name-status','-z',this.repo.head,'--']);const unstaged=await this.changed(['diff','--name-status','-z','--']);if(staged.length||unstaged.length)throw new LabError('BASE_DIRTY','Faça commit ou stash das alterações tracked da branch de trabalho antes de trocar.');
    const committedBase=new Set((await this.entries(this.repo.head)).map(e=>e.path));if((this.workspace.baseReservations??[]).some(p=>!committedBase.has(p)))throw new LabError('BASE_DIRTY','Arquivos pendentes da origem de trabalho exigem commit ou liberação explícita antes de trocar.');
    if(this.workspace.editing)throw new LabError('EDITING_ACTIVE','Encerre o destino de edição antes de trocar a branch.');
    const target=await this.revision('refs/heads/'+branch);const targetEntries=await this.entries(target);const ownerMap=await this.owners();const currentBase=new Set((await this.entries(this.repo.head)).map(e=>e.path));
    const opening=openingName?this.layer(openingName):undefined;const leaving=this.workspace.branchLayer?this.layer(this.workspace.branchLayer):undefined;const resume=allowResume&&!!leaving&&this.workspace.resumeLayer===leaving.name;
    if(opening?.shelf)throw new LabError('LEGACY_SHELF','Resolva a shelf legada antes de abrir como branch.');
    if(opening){const c=opening.state==='active'?await this.changes(opening):{staged:await this.changed(['diff','--cached','--name-status','-z',opening.oid,'--'],this.privateIndex(opening)),unstaged:[]};if(c.staged.length||c.unstaged.length||opening.reservations.length)throw new LabError('LAYER_DIRTY','Resolva pendências desta Layer antes de abri-la como branch.');}
    const projected=this.registry.layers.filter(l=>l.state==='active'&&l.id!==opening?.id);const composition=targetEntries.map(e=>({path:e.path,owner:'branch de destino'}));
    for(const l of projected)for(const p of await this.ownPaths(l))composition.push({path:p,owner:l.name});
    if(resume)for(const e of await this.entries(this.repo.head)){this.layerPath(e.path);composition.push({path:e.path,owner:leaving!.name});}
    assertNoCollisions(composition);
    const local=(await walk(this.repo.root)).filter(p=>!currentBase.has(p)&&!ownerMap.has(p));assertNoCollisions([...targetEntries.map(e=>({path:e.path,owner:'branch de destino'})),...local.map(p=>({path:p,owner:'arquivo local não gerenciado'}))]);
    const controlNames=new Set(['.gitignore','.gitattributes','.gitmodules']);const oldControls=(await this.entries(this.repo.head)).filter(e=>controlNames.has(path.basename(e.path)));const newControls=targetEntries.filter(e=>controlNames.has(path.basename(e.path)));if(projected.length&&JSON.stringify(oldControls)!==JSON.stringify(newControls)){
      // Read control objects before touching disk. Changed attributes/modules are still refused;
      // .gitignore changes are allowed only if target rules cannot override managed exclusions.
      const attributeEntries=(entries:GitEntry[])=>entries.filter(e=>path.basename(e.path)!=='.gitignore');
      if(JSON.stringify(attributeEntries(oldControls))!==JSON.stringify(attributeEntries(newControls)))throw new LabError('TARGET_CONTROLS_CHANGED','Destino altera atributos/módulos usados por outras Layers; composição não aplicada.');
      for(const entry of newControls.filter(e=>path.basename(e.path)==='.gitignore')){const text=(await git(this.repo.root,['cat-file','blob',entry.oid])).stdout.toString();if(text.split(/\r?\n/).some(line=>line.startsWith('!')))throw new LabError('TARGET_CONTROLS_CHANGED','Destino tem negações de ignore; não é possível assegurar a projeção antes da troca.');}
    }
    const snapshots=[];for(const l of projected)snapshots.push(...await this.diskSnapshot(await this.ownPaths(l)));
    const openingFiles=opening?.state==='active'?await this.diskSnapshot(await this.ownPaths(opening)):[];
    if(leaving){leaving.oid=this.repo.head;leaving.indexBase=this.repo.head;await this.track(this.privateIndex(leaving));await git(this.repo.root,['read-tree',leaving.oid],{index:this.privateIndex(leaving)});await this.after(this.privateIndex(leaving));}
    const resumeFiles=resume?await this.diskSnapshot([...currentBase]):[];for(const f of resumeFiles)await this.track(await safePath(this.repo.root,f.path));
    this.tx!.data.recovery.switch={from:this.repo.branch,to:branch,fromOid:this.repo.head,toOid:target,snapshots:[...snapshots,...resumeFiles],openingName,resumeName:resume?leaving!.name:undefined,openingWasActive:opening?.state==='active',returnBranch:this.workspace.returnBranch};await this.tx!.record('switch-prepared');
    for(const f of [...snapshots,...openingFiles])if(f.bytes!==null)await this.remove(await safePath(this.repo.root,f.path),{exists:true,hash:hash(Buffer.from(f.bytes,'base64')),mode:f.mode});
    if(opening)await this.releaseProtection(opening.name);
    await git(this.repo.root,['switch','--no-guess','--no-overwrite-ignore',branch]);for(const f of resumeFiles)await this.after(await safePath(this.repo.root,f.path));await this.tx!.record('switch-head-updated');failpoint('after-switch-head');
    const previousBranch=this.repo.branch;this.repo=await discover(this.repo.root);
    if(opening){const wasActive=opening.state==='active';opening.state='inactive';this.workspace={schema:1,head:this.repo.head,branch:this.repo.branch,branchLayer:opening.name,...(wasActive?{resumeLayer:opening.name}:{}),returnBranch:previousBranch};}
    else{this.workspace={schema:1,head:this.repo.head,branch:this.repo.branch};}
    if(resume)leaving!.state='active';await this.updateExcludes();await this.publish([...snapshots,...resumeFiles]);if(leaving){await this.checkpoint(leaving);await this.reserveProtection(leaving.name);}return {branch,head:this.repo.head,role:opening?'layer-branch':'traditional',otherLayers:projected.map(l=>l.name)};
  }
  async captureStart(name:string,scope=''){return this.mutate('capture-start',async()=>{this.layer(name,true);if(await exists(path.join(this.dir,'capture.json')))throw new LabError('CAPTURE_EXISTS','Já existe uma captura; revise, retome ou cancele.');if(scope&&scope!=='.'){validatePath(scope);await safePath(this.repo.root,scope);}else scope='';const id=randomUUID();const files=await walk(this.repo.root,scope);const session={schema:1,id,layer:name,scope,before:files,createdAt:new Date().toISOString()};await this.writeJSON(path.join(this.dir,'capture.json'),session);await this.writeJSON(path.join(this.dir,'captures',`${id}.json`),session);return session;});}
  private async capture(){if(!(await exists(path.join(this.dir,'capture.json'))))throw new LabError('CAPTURE_NONE','Nenhuma sessão de captura ativa.');return readJSON<any>(path.join(this.dir,'capture.json'),v=>typeof v.id==='string'&&SAFE_ID.test(v.id)&&typeof v.layer==='string'&&!!this.layer(v.layer)&&typeof v.scope==='string'&&(!v.scope||!!validatePath(v.scope))&&Array.isArray(v.before)&&v.before.every((p:any)=>typeof p==='string'&&!!validatePath(p)));}
  async captureReview(){const s=await this.capture();this.layer(s.layer,true);const before=new Set(s.before);const owners=await this.owners();const candidates=[];for(const p of await walk(this.repo.root,s.scope)){if(before.has(p)||owners.has(p))continue;try{this.layerPath(p);}catch{continue;}const ignored=(await git(this.repo.root,['check-ignore','--no-index','-q','--',p],{ok:[0,1]})).code===0;candidates.push({path:p,ignored});}return {id:s.id,layer:s.layer,scope:s.scope,candidates};}
  async captureConfirm(paths:string[]){return this.mutate('capture-confirm',async()=>{const review=await this.captureReview();const allowed=new Set(review.candidates.map(c=>c.path));if(!paths.length||paths.some(p=>!allowed.has(p)))throw new LabError('CAPTURE_SELECTION','Selecione somente candidatos atuais. Arquivos ignorados exigem seleção explícita.');const result=await this.addInternal(review.layer,paths);await this.remove(path.join(this.dir,'capture.json'));await this.writeJSON(path.join(this.dir,'captures',`${review.id}.json`),{schema:1,...review,state:'confirmed',selected:paths});return result;});}
  async captureCancel(){return this.mutate('capture-cancel',async()=>{const s=await this.capture();await this.remove(path.join(this.dir,'capture.json'));await this.writeJSON(path.join(this.dir,'captures',`${s.id}.json`),{...s,state:'cancelled'});return {cancelled:true,filesPreserved:true};});}
  async diffHunks(owner:string,p:string,staged=false){await this.guard(false);return this.diffHunksInternal(owner,p,staged);}
  private async diffHunksInternal(owner:string,p:string,staged=false){validatePath(p);const index=owner==='base'?undefined:this.index(this.layer(owner,true));const patch=await this.diffInternal(owner,staged,[p]);const entries=await this.entries('INDEX',index);const entry=entries.find(e=>e.path===p);const disk=await fingerprint(await safePath(this.repo.root,p));const token=hash(JSON.stringify({owner,p,staged,head:owner==='base'?this.repo.head:this.layer(owner).oid,index:await fingerprint(index??this.repo.index),disk,oid:entry?.oid}));const hunks:{index:number,header:string,patch:string}[]=[];
    if(!entry||entry.mode!=='100644'||patch.includes('GIT binary patch')||patch.includes('Binary files')||patch.includes('old mode')||patch.includes('new mode')||patch.includes('deleted file')||patch.includes('new file'))return {token,patch,hunks,supported:false,reason:'Use o arquivo inteiro para binários, arquivos novos, exclusões ou mudanças de modo.'};
    const lines=patch.split('\n');const first=lines.findIndex(l=>l.startsWith('@@ '));if(first<0)return {token,patch,hunks,supported:false};const header=lines.slice(0,first).join('\n')+'\n';let current:string[]=[];for(const line of lines.slice(first)){if(line.startsWith('@@ ')&&current.length){hunks.push({index:hunks.length,header:current[0]!,patch:header+current.join('\n')+'\n'});current=[];}current.push(line);}if(current.length){while(current.at(-1)==='')current.pop();hunks.push({index:hunks.length,header:current[0]!,patch:header+current.join('\n')+'\n'});}return {token,patch,hunks,supported:true};
  }
  async partialStage(owner:string,p:string,hunkIndex:number,token:string){return this.patchHunk(owner,p,hunkIndex,token,false);}
  async partialUnstage(owner:string,p:string,hunkIndex:number,token:string){return this.patchHunk(owner,p,hunkIndex,token,true);}
  private async patchHunk(owner:string,p:string,hunkIndex:number,token:string,reverse:boolean){return this.mutate(reverse?'partial-unstage':'partial-stage',async()=>{
    const current=await this.diffHunksInternal(owner,p,reverse);if(current.token!==token)throw new LabError('STALE_PATCH','O arquivo ou índice mudou. Atualize o diff antes de preparar o trecho.');const hunk=current.hunks[hunkIndex];if(!Number.isSafeInteger(hunkIndex)||!hunk)throw new LabError('HUNK_UNSUPPORTED','Trecho inválido ou não suportado; o arquivo inteiro não foi preparado.');const index=owner==='base'?undefined:this.index(this.layer(owner,true));if(owner==='base')await this.baseAuthorized([p]);else await this.authorized(this.layer(owner,true),[p]);const flags=reverse?['--reverse']:[];await git(this.repo.root,['apply','--cached',...flags,'--check','--whitespace=nowarn','-'],{index,input:hunk.patch});await this.track(index??this.repo.index);await git(this.repo.root,['apply','--cached',...flags,'--whitespace=nowarn','-'],{index,input:hunk.patch});await this.after(index??this.repo.index);if(owner!=='base')await this.checkpoint(this.layer(owner));return {path:p,hunk:hunkIndex};},false);}
  async files(){const owners=await this.owners();const disk=await walk(this.repo.root);return [...new Set([...disk,...owners.keys()])].sort().map(p=>({path:p,owner:owners.get(p)??null}));}
  async readFile(p:string){const full=await safePath(this.repo.root,validatePath(p),false);const stat=await fs.stat(full);if(!stat.isFile())throw new LabError('NOT_FILE','Selecione um arquivo regular.');if(stat.size>4*1024*1024)return {text:'',hash:(await fingerprint(full)).hash,binary:false,size:stat.size,eol:'LF',readOnly:true,mode:stat.mode};const bytes=await fs.readFile(full);let text='';let binary=bytes.includes(0);try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{binary=true;}if(bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)text='\ufeff'+text;return {text:binary?'':text,hash:hash(bytes),binary,size:bytes.length,eol:bytes.includes(Buffer.from('\r\n'))?'CRLF':'LF',readOnly:binary,mode:stat.mode};}
  async writeFile(p:string,text:string,expectedHash?:string){if(typeof text!=='string'||text.length>4*1024*1024)throw new LabError('TEXT_INVALID','Texto inválido ou grande demais.');return this.mutate('editor-save',async()=>{const full=await safePath(this.repo.root,validatePath(p));const before=await fingerprint(full);if(before.exists){if(!expectedHash||before.hash!==expectedHash)throw new LabError('EXTERNAL_EDIT','O arquivo mudou ou falta sua versão. Compare/recarregue antes de salvar.');const read=await this.readFile(p);if(read.binary||read.readOnly)throw new LabError('BINARY_FILE','Arquivo não editável como texto.');}else if(expectedHash)throw new LabError('EXTERNAL_EDIT','O arquivo foi removido externamente.');await this.writeBytes(full,Buffer.from(text,'utf8'),before.exists?before.mode:0o644);return this.readFile(p);},false);}
  async mkdir(p:string){return this.mutate('mkdir',async()=>{const full=await safePath(this.repo.root,validatePath(p));await fs.mkdir(full,{recursive:false});return {path:p};},false);}
  async deleteFile(p:string,confirmed=false){if(!confirmed)throw new LabError('CONFIRM_REQUIRED','Confirme a exclusão; uma cópia recuperável será preservada.');return this.mutate('file-delete',async()=>{const owner=(await this.owners()).get(p);await this.remove(await safePath(this.repo.root,validatePath(p),false));if(owner==='base')this.forgetBaseOwnership(p);this.workspace.acknowledgedMissing=[...new Set([...this.workspace.acknowledgedMissing??[],p])];await this.updateExcludes();return {path:p,backup:this.tx!.dir};},false);}
  async renameFile(from:string,to:string){return this.mutate('file-rename',async()=>{const source=await safePath(this.repo.root,validatePath(from),false);const target=await safePath(this.repo.root,validatePath(to));if(await exists(target))throw new LabError('LOCAL_COLLISION','O destino já existe.');const owners=await this.owners();const owner=owners.get(from);const targetOwner=owners.get(to);if(targetOwner&&targetOwner!==owner)throw new LabError('OWNERSHIP','Transferência entre proprietários não suportada.');if(owner&&owner!=='base'){this.layerPath(to);const l=this.layer(owner,true);l.reservations.push(to);await this.owners();await this.updateExcludes();}if(owner==='base'){this.forgetBaseOwnership(from);this.workspace.baseReservations=[...new Set([...this.workspace.baseReservations??[],to])];}if(this.workspace.editing){this.workspace.editing.assigned=(this.workspace.editing.assigned??[]).filter(p=>p!==from);}
    const before=await fingerprint(source);const bytes=await fs.readFile(source);if(hash(bytes)!==before.hash)throw new LabError('EXTERNAL_EDIT','A origem mudou durante a renomeação.');await this.writeBytes(target,bytes,before.mode,{exists:false,hash:'',mode:0});await this.remove(source,before);this.workspace.acknowledgedMissing=[...new Set([...this.workspace.acknowledgedMissing??[],from])];if(!owner)await this.rememberUnownedPath(to);await this.updateExcludes();return {from,to,owner:owner??null};},false);}
  async doctor(fsck=false){const checks:{name:string,ok:boolean,detail:any}[]=[];const check=async(name:string,fn:()=>Promise<unknown>)=>{try{checks.push({name,ok:true,detail:await fn()});}catch(e){checks.push({name,ok:false,detail:{code:(e as any).code,message:message(e)}});}};
    await check('Locks e resgate independente',async()=>{const rescue=await doctorRepository(this.repo.root);if(!rescue.safe)throw new LabError('RECOVERY_REQUIRED','Diagnóstico de resgate encontrou impedimentos.',rescue.checks.filter(c=>!c.ok));return {safe:true};});
    await check('HEAD e recursos suportados',async()=>{await this.refresh();await assertSupported(this.repo,false);return {head:this.repo.head,branch:this.repo.branch,gitDir:this.repo.gitDir};});await check('Metadados, refs, índices, propriedade e exclusões',async()=>{await this.guard(false);return {layers:this.registry.layers.length,paths:(await this.owners()).size};});await check('Índice principal',async()=>{const entries=await this.entries('INDEX');return {paths:entries.length,fingerprint:await fingerprint(this.repo.index)};});for(const l of this.registry.layers)await check(`Layer ${l.name}: objetos e checkpoint`,async()=>{const {index,checkpoint}=await this.validateLayerIndex(l);return {ref:l.ref,oid:l.oid,tree:checkpoint,checkpoint,indexRole:this.workspace.branchLayer===l.name?'retained-private':'layer-private',index,state:l.state,reservations:l.reservations,shelf:l.shelf};});
    if(fsck)await check('git fsck',async()=>{const r=await git(this.repo.root,['fsck','--full','--no-reflogs'],{timeout:120000});return (r.stdout.toString()+r.stderr.toString()).trim()||'Objetos verificados.';});let transactions:any[]=[];await check('Journals',async()=>{transactions=await listTransactions(this.dir);if(transactions.length)throw new LabError('RECOVERY_REQUIRED','Journals pendentes.',transactions.map(t=>t.id));return {pending:0};});let spaceBytes=0;const sum=async(dir:string)=>{for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=path.join(dir,e.name);if(e.isDirectory())await sum(p);else if(e.isFile())spaceBytes+=(await fs.stat(p)).size;}};await sum(this.dir);return {safe:checks.every(c=>c.ok),checks,transactions,spaceBytes,capture:await exists(path.join(this.dir,'capture.json'))?await this.capture():null};
  }
  private async checkRecoveryRefs(){try{await assertDirectManagedRefs(this.repo.root,'refs/heads/'+this.repo.branch);}catch(error){if(error instanceof LabError&&error.code==='EXTERNAL_REF')throw new LabError('RECOVERY_CONFLICT','Referência simbólica externa foi preservada; recuperação requer inspeção.',error.details);throw error;}}
  async recover(){if(await resolveLayerDirectory(this.repo.gitDir)!==this.dir)throw new LabError('LAYOUT_CHANGED','O layout mudou; reabra o repositório antes de recuperar.');return withLock(this.dir,async()=>{await this.refresh();await this.checkRecoveryRefs();const pending=await listTransactions(this.dir);
      // Reobserve relevant native index locks at recovery publication/finalization
      // boundaries. This is optimistic observation, not a lock on other programs.
      for(const data of pending)await validateRecovery(this.repo,this.dir,data);
      const retainedLayers=[...this.registry.layers,...pending.flatMap(data=>data.recovery.beforeRegistry.layers as Layer[])];
      const plannedIndices=pending.flatMap(data=>data.recovery.files.filter((file:any)=>/^indexes\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.index$/u.test(path.relative(this.dir,file.path).split(path.sep).join('/'))).map((file:any)=>file.path as string));
      const nativeRecoveryLocks=recoveryIndexLockGuard(this.repo,this.dir,pending,[...retainedLayers.map(l=>this.privateIndex(l)),...plannedIndices]),restoredGuards:(()=>Promise<void>)[]=[];
      const managedRecovered=new Map(pending.filter(data=>data.recovery.managedIndexPublication).map(data=>[data.recovery.managedIndexPublication.layerId,data.recovery.managedIndexPublication]));
      const checkRecoveryLocks=async()=>{await nativeRecoveryLocks();for(const guard of restoredGuards)await guard();},rollbackPending=async(data:any)=>{const guard=await this.rollback(data,nativeRecoveryLocks);if(data.recovery.managedIndexPublication)restoredGuards.push(guard);};await checkRecoveryLocks();
      const recovered=[];for(const data of pending){await checkRecoveryLocks();const journal=path.join(this.dir,'transactions',data.id,'journal.json');await validateRecovery(this.repo,this.dir,data);const workspaceImages=await recoveryWorkspaceImages(this.repo,this.dir,data);for(const f of data.recovery.files){const cur=await recoveryFileState(this.repo,this.dir,data,f);if(!sameFingerprint(cur,f.before)&&(!f.after||!sameFingerprint(cur,f.after))&&!workspaceImages.some(image=>image.path===f.path&&sameFingerprint(cur,image.fingerprint)))throw new LabError('RECOVERY_CONFLICT',`Mudança posterior detectada: ${f.path}`);}const commit=data.recovery?.commit;if(commit){const current=await gitText(this.repo.root,['rev-parse','--verify',commit.ref]);if(current===commit.new){if(commit.base){this.repo=await discover(this.repo.root);if(this.repo.branch!==data.recovery.beforeWorkspace.branch||this.repo.head!==commit.new)throw new LabError('RECOVERY_CONFLICT','HEAD não corresponde ao commit interrompido.');this.registry=structuredClone(data.recovery.beforeRegistry);this.workspace={...recoveryBeforeWorkspace(data),schema:1,head:this.repo.head,branch:this.repo.branch};if(this.workspace.branchLayer){const l=this.layer(this.workspace.branchLayer);l.oid=current;l.indexBase=current;const committed=new Set((await this.entries(current)).map(e=>e.path));l.reservations=l.reservations.filter(p=>!committed.has(p));}}else{this.registry=data.recovery.beforeRegistry;if(data.recovery.acknowledgements!==undefined)this.workspace=recoveryBeforeWorkspace(data);const l=this.registry.layers.find(l=>l.id===commit.layerId);if(!l)throw new LabError('RECOVERY_CONFLICT','Layer do commit não encontrada.');l.oid=current;l.indexBase=current;const committed=new Set((await this.entries(current)).map(e=>e.path));l.reservations=l.reservations.filter(p=>!committed.has(p));}this.workspace=recoveryBeforeWorkspace(data,this.workspace);await checkRecoveryLocks();await this.save();await checkRecoveryLocks();await this.updateExcludes();}else if(current===commit.old)await rollbackPending(data);else throw new LabError('RECOVERY_CONFLICT','Ref mudou após a falha; exporte os backups.');
      }else if(data.recovery?.switch){
        const sw=data.recovery.switch;const actual=await discover(this.repo.root);
        if(actual.branch===sw.from&&actual.head===sw.fromOid)await rollbackPending(data);
        else if(actual.branch===sw.to&&actual.head===sw.toOid){
          if(!Array.isArray(sw.snapshots))throw new LabError('RECOVERY_INVALID','Retrato de projeção ausente.');
          this.registry=structuredClone(data.recovery.beforeRegistry);
          const owned=new Set<string>();
          for(const l of this.registry.layers.filter(l=>l.state==='active')){
            for(const entry of await this.entries(l.oid))owned.add(entry.path);
            for(const entry of await this.entries('INDEX',this.privateIndex(l)))owned.add(entry.path);
            for(const p of l.reservations)owned.add(p);
          }
          if(sw.resumeName)for(const entry of await this.entries(sw.fromOid))owned.add(entry.path);
          // Validate every snapshot and backup before changing roles or writing bytes.
          for(const f of sw.snapshots){this.layerPath(f.path);if(!owned.has(f.path)||(f.bytes!==null&&(typeof f.bytes!=='string'||Buffer.from(f.bytes,'base64').toString('base64')!==f.bytes))||!Number.isInteger(f.mode))throw new LabError('RECOVERY_INVALID','Retrato de projeção inválido.');const plan=data.recovery.files.find((x:any)=>x.path===path.join(this.repo.root,f.path));if(f.bytes!==null&&(!plan||!plan.backup||hash(Buffer.from(f.bytes,'base64'))!==plan.before.hash||f.mode!==plan.before.mode))throw new LabError('RECOVERY_INVALID','Projeção difere do backup.');}
          this.repo=actual;
          if(sw.openingName){const opened=this.layer(sw.openingName);opened.state='inactive';this.workspace={schema:1,head:actual.head,branch:actual.branch,branchLayer:sw.openingName,...(sw.openingWasActive?{resumeLayer:sw.openingName}:{}),returnBranch:sw.from};}
          else this.workspace={schema:1,head:actual.head,branch:actual.branch};
          if(sw.resumeName){const resumed=this.layer(sw.resumeName);resumed.state='active';resumed.oid=sw.fromOid;resumed.indexBase=sw.fromOid;}
          this.workspace=recoveryBeforeWorkspace(data,this.workspace);await this.owners();await checkRecoveryLocks();await this.updateExcludes();
          for(const f of sw.snapshots){if(f.bytes===null)continue;await checkRecoveryLocks();const full=await safePath(this.repo.root,f.path);const planned={exists:true,hash:hash(Buffer.from(f.bytes,'base64')),mode:f.mode};const current=await fingerprint(full);if(sameFingerprint(current,planned))continue;if(current.exists)throw new LabError('RECOVERY_CONFLICT',`Destino mudou: ${f.path}`);await checkRecoveryLocks();await this.writeBytes(full,Buffer.from(f.bytes,'base64'),f.mode,current);const plan=data.recovery.files.find((x:any)=>x.path===full);plan.after=await fingerprint(full);await checkRecoveryLocks();await atomicJSON(journal,data);}
          await checkRecoveryLocks();await this.save();
        }else throw new LabError('RECOVERY_CONFLICT','HEAD divergiu da troca interrompida; exporte os backups.');
      }else await rollbackPending(data);
      await checkRecoveryLocks();await this.checkRecoveryRefs();data.state='completed';data.recoveredAt=new Date().toISOString();await atomicJSON(journal,data);recovered.push(data.id);await this.refresh();}
      // Validate every retained index before acknowledging an external HEAD or
      // rebuilding checkpoints. The working branch's stage is legitimate Git state.
      const moved=this.repo.head!==this.workspace.head||this.repo.branch!==this.workspace.branch;let acknowledged=false;
      if(moved){await assertSupported(this.repo,false);if(this.workspace.branchLayer&&this.repo.branch!==this.workspace.branch)throw new LabError('EXTERNAL_HEAD','Saída nativa do modo branch; estado preservado.');}
      const validatedCheckpoints=new Map<string,string>();
      for(const l of this.registry.layers){
        const current=await gitText(this.repo.root,['rev-parse','--verify',l.ref]);const self=this.workspace.branchLayer===l.name&&this.repo.branch==='layer/'+l.name;
        if(self){if(current!==this.repo.head)throw new LabError('EXTERNAL_REF','HEAD e origem da Layer divergiram.');acknowledged ||= l.oid!==current||l.indexBase!==current;l.oid=current;l.indexBase=current;}
        else if(current!==l.oid||l.indexBase!==l.oid)throw new LabError('EXTERNAL_REF',`Ref externa da Layer ${l.name} ainda diverge; índice preservado.`);
        if(!recovered.length||self){const validated=await this.validateLayerIndex(l);validatedCheckpoints.set(l.id,validated.checkpoint);}
      }
      await this.verifyExcludes();await this.owners();
      const rebuildCheckpoints=!!(recovered.length||moved||acknowledged);
      for(const l of this.registry.layers){
        await checkRecoveryLocks();
        const managed=managedRecovered.get(l.id);
        if(managed){const tree=(await queryIndexTree(this.repo,this.index(l))).stdout.toString().trim();await checkRecoveryLocks();if(tree!==managed.checkpoint||await gitText(this.repo.root,['rev-parse','--verify','refs/git-layers/state/'+l.id])!==managed.checkpoint)throw new LabError('CHECKPOINT_MISMATCH','O staging recuperado divergiu da árvore anterior conhecida; índice e ref preservados.');}
        else if(rebuildCheckpoints)await this.checkpoint(l);
        else{
          // Preserve native object validation without rewriting a coherent live index/ref.
          const tree=(await queryIndexTree(this.repo,this.index(l))).stdout.toString().trim();
          const self=this.workspace.branchLayer===l.name&&this.repo.branch==='layer/'+l.name;
          if(!self&&tree!==validatedCheckpoints.get(l.id))throw new LabError('CHECKPOINT_MISMATCH',`Checkpoint diferente do indice privado da Layer ${l.name}; estado preservado.`);
        }
        await checkRecoveryLocks();if(this.workspace.branchLayer!==l.name)await this.reserveProtection(l.name);
      }
      if(moved||acknowledged){this.workspace={...this.workspace,schema:1,head:this.repo.head,branch:this.repo.branch};await checkRecoveryLocks();await this.save();}
      await checkRecoveryLocks();
      await this.checkRecoveryRefs();return {recovered,head:this.repo.head,branch:this.repo.branch};});}
  async exportRecovery(destination:string){return exportRepositoryRecovery(this.repo.root,destination);}
  async advanced(action:string,args:string[]=[]){
    // Explicit local complement subset. Integration/rewrite commands require inactive Layers.
    if(!['amend','tag','tag-delete','stash','stash-pop','stash-list','merge','merge-abort','merge-continue','cherry-pick','cherry-pick-abort','cherry-pick-continue','revert','revert-abort','revert-continue'].includes(action))throw new LabError('UNSUPPORTED','Operação não suportada.');
    if(action==='stash-list')return gitText(this.repo.root,['stash','list']);
    throw new LabError('NOT_IMPLEMENTED',`Complemento ${action} ainda não implementado. Fluxos obrigatórios permanecem disponíveis.`);
  }
}
