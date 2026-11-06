import fs from 'node:fs';
import path from 'node:path';
import {sha256,walk,fileHash,json} from '../../../scripts/git-compat/lib.mjs';
const spec=(id,variant,title,run,extra={})=>({id,variant,title,profile:'N0',tier:'broad',phase:'NATIVE_BASELINE',productStatus:'NOT_ASSESSED',capabilities:[],timeout:180000,run,...extra});
const gt=async(c,args,opts)=>(await c.git(args,opts)).stdout.trim();
const cli=async(c,args,ok=[0])=>{const r=await c.cli(args,{ok});return {...r,body:JSON.parse((r.stdout||r.stderr))};};
const metadata=c=>walk(path.join(c.repo,'.git/layers')).map(p=>[path.relative(c.repo,p),fileHash(p)]).sort();
const layerIndex=c=>{const l=JSON.parse(c.read('.git/layers/registry.json')).layers[0];return path.join(c.repo,'.git/layers/indexes',l.id+'.index');};
export const cases=[
  spec('PATH-002','case-rename-physical-filesystem','Case-only names are measured on the actual filesystem',async c=>{
    await c.init();c.write('Foo.txt','first\n');await c.git(['add','Foo.txt']);await c.git(['commit','-m','case file']);
    const same=fs.existsSync(path.join(c.repo,'foo.txt'));json(path.join(c.artifactDir,'case-capability.json'),{caseInsensitive:same});
    if(same){c.write('foo.txt','second\n');c.eq('same physical file',c.read('Foo.txt'),'second\n');await c.git(['mv','Foo.txt','intermediate.txt']);await c.git(['mv','intermediate.txt','foo.txt']);c.eq('Git spelling after explicit rename',await gt(c,['ls-files','--','foo.txt']),'foo.txt');}
    else{c.write('foo.txt','second\n');await c.git(['add','foo.txt']);c.eq('distinct names', (await gt(c,['ls-files','--','Foo.txt','foo.txt'])).split('\n').length,2);}
    return {limits:['Current filesystem measured only; Core case-collision refusal is covered separately by existing integration, not inferred from native rename.']};
  }),
  spec('PATH-003','long-path-and-ntfs-name-protection','Long fixture path roundtrip and protected Windows reserved index name',async c=>{
    await c.init();await c.git(['config','--local','core.longpaths','true']);const long=Array.from({length:16},(_,i)=>'segment'+i+'abcdefgh').join('/')+'/file.txt';c.write(long,'long synthetic\n');await c.git(['add','--',long]);c.eq('long path staged bytes',(await c.git(['show',':'+long])).stdout,'long synthetic\n');
    if(process.platform==='win32'){
      const oid=await gt(c,['hash-object','-w','--stdin'],{stdin:'reserved synthetic\n'});const result=await c.git(['-c','core.protectNTFS=true','update-index','--add','--cacheinfo',`100644,${oid},aux.txt`],{ok:[0,128]});
      if(result.code===0){const checked=await c.git(['-c','core.protectNTFS=true','checkout-index','--','aux.txt'],{ok:[1,128]});c.ok('reserved name not materialized',checked.code!==0);}
      c.eq('reserved file absent',c.exists('aux.txt'),false);
    }
    return {limits:['One path >260 characters with core.longpaths=true and aux.txt protection; not every Windows reserved spelling or filesystem limit.']};
  }),
  spec('PATH-011','owned-hardlink-junction-boundaries','Hardlinks and a junction remain inside the dedicated fixture group',async c=>{
    await c.init();c.write('original.txt','hardlink bytes\n');fs.linkSync(path.join(c.repo,'original.txt'),path.join(c.repo,'linked.txt'));
    c.ok('hardlink count',fs.statSync(path.join(c.repo,'original.txt')).nlink>=2);await c.git(['add','original.txt','linked.txt']);c.eq('hardlinks stored as ordinary blobs',await gt(c,['rev-parse',':original.txt']),await gt(c,['rev-parse',':linked.txt']));
    if(process.platform==='win32'){const target=path.join(c.root,'junction-target');fs.mkdirSync(target);fs.writeFileSync(path.join(target,'sentinel.txt'),'keep\n');fs.symlinkSync(target,path.join(c.repo,'junction'),'junction');c.eq('junction identified',fs.lstatSync(path.join(c.repo,'junction')).isSymbolicLink(),true);fs.unlinkSync(path.join(c.repo,'junction'));c.eq('target preserved',fs.readFileSync(path.join(target,'sentinel.txt'),'utf8'),'keep\n');}
    return {limits:['Hardlink native representation and controlled junction unlink proved. Symlink privilege, FIFO/device types and Layer refusals are not certified by this variant.']};
  }),
  spec('WORKTREE-013','untracked-cache-and-controlled-fsmonitor','Caches preserve semantic status through edits',async c=>{
    await c.init();for(let i=0;i<100;i++)c.write(`untracked/file${i}.txt`,`${i}\n`);const baseline=(await c.git(['status','--porcelain=v2','-z','--untracked-files=all'])).stdout;
    await c.git(['update-index','--untracked-cache']);await c.git(['config','--local','core.untrackedCache','true']);c.eq('untracked cache semantics',(await c.git(['status','--porcelain=v2','-z','--untracked-files=all'])).stdout,baseline);
    // A controlled monitor reports every path dirty, using the documented v2 protocol.
    c.write('.git/monitor.sh','#!/bin/sh\nprintf "token\\0/\\0"\n');await c.git(['config','--local','core.fsmonitor',path.join(c.repo,'.git/monitor.sh').replaceAll('\\','/')]);await c.git(['config','--local','core.fsmonitorHookVersion','2']);
    c.eq('monitor semantics',(await c.git(['status','--porcelain=v2','-z','--untracked-files=all'])).stdout,baseline);c.write('base.txt','changed\n');c.ok('monitor detects edit',(await c.git(['status','--porcelain=v2'])).stdout.includes('base.txt'));
    await c.git(['config','--local','core.fsmonitor','false']);await c.git(['update-index','--no-untracked-cache']);c.ok('baseline after disabling',(await c.git(['status','--porcelain=v2'])).stdout.includes('base.txt'));
    return {limits:['Synthetic v2 monitor and untracked cache, no global service or fsmonitor daemon. Does not certify event loss of a production monitor.']};
  }),
  spec('WORKTREE-008','dirty-nested-local-submodules','Nested submodule boundaries and recursive status use only fixture repositories',async c=>{
    await c.init();const child=path.join(c.root,'child'),leaf=path.join(c.root,'leaf');for(const dir of[leaf,child]){fs.mkdirSync(dir);await c.git(['init','-b','main'],{cwd:dir});fs.writeFileSync(path.join(dir,'file.txt'),'submodule\n');await c.git(['add','.'],{cwd:dir});await c.git(['commit','-m','submodule root'],{cwd:dir});}
    await c.git(['submodule','add',leaf,'nested'],{cwd:child});await c.git(['commit','-am','nested gitlink'],{cwd:child});await c.git(['submodule','add',child,'modules/child']);await c.git(['commit','-am','root gitlink']);await c.git(['submodule','update','--init','--recursive']);
    c.write('modules/child/nested/file.txt','dirty nested\n');const recursive=await c.git(['submodule','foreach','--recursive','git status --porcelain']);c.ok('recursive dirty leaf',recursive.stdout.includes('file.txt'));c.ok('root gitlink dirty',(await c.git(['status','--porcelain=v2'])).stdout.includes('modules/child'));await c.git(['diff','--submodule=log']);
    await c.git(['restore','--source=HEAD','--worktree','--recurse-submodules','--','modules/child']);c.eq('recursive restore native',c.read('modules/child/nested/file.txt'),'submodule\n');
    return {limits:['Local nested submodules and dirty tracked bytes; no third-party hosting or product submodule support.']};
  }),
  spec('INSPECT-014','bugreport-diagnose-disposable-output','Official diagnostic reports are written only inside the fixture',async c=>{
    await c.init();const out=path.join(c.root,'diagnostics');fs.mkdirSync(out);const report=await c.git(['bugreport','--output-directory',out],{env:{GIT_EDITOR:'true'}});c.ok('bugreport file produced',fs.readdirSync(out).some(n=>n.startsWith('git-bugreport')));await c.git(['diagnose','--mode=stats','--output-directory',out]);c.ok('diagnose archive produced',fs.readdirSync(out).some(n=>n.endsWith('.zip')));
    json(path.join(c.artifactDir,'diagnostics-proof.json'),{files:fs.readdirSync(out),stdout:report.stdout.replaceAll(c.root,'<FIXTURE>'),rawReportsNotExported:true});
    return {limits:['Diagnostic raw contents stay in disposable fixture and are not included in the evidence ZIP. Native report generation, not product diagnostics.']};
  }),
  spec('INDEX-007','native-vs-managed-mixed-batch','Native partial add differs from atomic managed mixed-owner refusal',async c=>{
    await c.init();await c.layer();c.write('base.txt','base changed\n');c.write('new.txt','new\n');c.write('layer.txt','layer changed\n');const ownBefore=(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout;
    await c.git(['add','--','base.txt','layer.txt','new.txt'],{ok:[1]});c.eq('native accepted ordinary paths',(await c.git(['diff','--cached','--name-only'])).stdout.split('\n').filter(Boolean).sort(),['base.txt','new.txt']);c.eq('native excluded projection',(await c.git(['ls-files','--','layer.txt'])).stdout,'');
    const before=(await c.git(['ls-files','--stage','-z'])).stdout;const refused=await cli(c,['add','tools','--','layer.txt','base.txt','new.txt'],[3]);c.eq('managed ownership error',refused.body.error.code,'OWNERSHIP');c.eq('base index unchanged',(await c.git(['ls-files','--stage','-z'])).stdout,before);c.eq('Layer index atomic',(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout,ownBefore);
  },{profile:'L1',phase:'CURRENT_PRODUCT',productStatus:'VERIFIED_SUPPORTED'}),
  spec('LAYER-009','native-vs-managed-owner-rename','Managed collision refusal and native force rename have different effects',async c=>{
    await c.init();await c.layer();const head=await gt(c,['rev-parse','HEAD']),own=await gt(c,['rev-parse','layer/tools']);const idx=(await c.git(['ls-files','--stage','-z'])).stdout;
    // Core API complements the CLI because renameFile has no CLI verb.
    let refused;try{await c.core('renameFile',['base.txt','layer.txt']);}catch(e){refused=JSON.parse(e.result.stderr).error.code;}
    c.eq('managed destination refused',refused,'LOCAL_COLLISION');c.eq('managed index preserved',(await c.git(['ls-files','--stage','-z'])).stdout,idx);c.eq('managed layer bytes',c.read('layer.txt'),'layer one\n');
    await c.git(['mv','-f','base.txt','layer.txt']);c.eq('native physically overwrites ignored projection',c.read('layer.txt'),'base one\n');c.eq('native head not committed',await gt(c,['rev-parse','HEAD']),head);c.eq('Layer commit unchanged',await gt(c,['rev-parse','layer/tools']),own);c.eq('native staged renamed blob',(await c.git(['show',':layer.txt'])).stdout,'base one\n');
    return {productStatus:'DOCUMENTED_RESTRICTION',limits:['Explicit native force rename bypasses Layer ownership protection. Managed ownership transfer is not implied; native destructive commands are a documented boundary.']};
  },{profile:'L1',phase:'CURRENT_PRODUCT',productStatus:'DOCUMENTED_RESTRICTION'}),
  ...['edited','removed'].map(kind=>spec('LAYER-013','capture-stale-'+kind,'Capture rechecks candidate paths but does not freeze reviewed bytes',async c=>{
    await c.init();await c.layer();await cli(c,['capture-start','tools']);c.write('candidate.txt','reviewed A\n');const review=await cli(c,['capture-review']);c.ok('candidate reviewed',review.body.result.candidates.some(x=>x.path==='candidate.txt'));
    const before=(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout;
    if(kind==='edited'){c.write('candidate.txt','later B\n');await cli(c,['capture-confirm','--','candidate.txt']);c.eq('current bytes staged',(await c.git(['show',':candidate.txt'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout,'later B\n');}
    else{fs.unlinkSync(path.join(c.repo,'candidate.txt'));const r=await cli(c,['capture-confirm','--','candidate.txt'],[3]);c.eq('removed candidate rejected',r.body.error.code,'CAPTURE_SELECTION');c.eq('removed no stage effect',(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout,before);}
    return {productStatus:'PENDING_PRODUCT_SPEC',limits:['Current behavior characterized. Desired token/content contract for a stale review was explicitly undecided in LAYER-013; no silent requirement invented.']};
  },{profile:'L1',phase:'CURRENT_PRODUCT',productStatus:'PENDING_PRODUCT_SPEC'})),
  spec('MODEL-009','diagnostic-export-evidence-monotonic','Unsafe external ref diagnostics and successful raw exports preserve all source metadata',async c=>{
    await c.init();await c.layer();const original=await gt(c,['rev-parse','layer/tools']),tree=await gt(c,['rev-parse','layer/tools^{tree}']);const advanced=await gt(c,['commit-tree',tree,'-p',original,'-m','external']);await c.git(['update-ref','refs/heads/layer/tools',advanced]);const before=metadata(c),main=(await c.git(['ls-files','--stage','-z'])).stdout,own=(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout;
    const exports=[];
    for(let i=0;i<2;i++){
      const status=await cli(c,['status']);c.eq('unsafe status '+i,status.body.result.safe,false);const doctor=await cli(c,['doctor'],[3]);c.eq('unsafe doctor '+i,doctor.body.result.safe,false);c.eq('unsafe doctor envelope '+i,doctor.body.ok,false);
      const destination=path.join(c.root,'export-'+i);const result=await cli(c,['recovery-export',destination]);c.eq('complete export '+i,result.body.result.complete,true);
      const manifest=JSON.parse(fs.readFileSync(path.join(destination,'recovery-export.json'),'utf8'));c.eq('complete manifest '+i,manifest.complete,true);c.eq('copied registry bytes '+i,fs.readFileSync(path.join(destination,'metadata/layers/registry.json'),'utf8'),c.read('.git/layers/registry.json'));
      for(const entry of manifest.entries.filter(e=>e.type==='file'))c.eq('manifest file hash '+i+' '+entry.path,fileHash(path.join(destination,entry.path)),entry.sha256);
      exports.push({exit:result.code,complete:manifest.complete,entries:manifest.entries.length});c.eq('metadata evidence unchanged '+i,metadata(c),before);
    }
    c.eq('external ref not reset',await gt(c,['rev-parse','layer/tools']),advanced);c.eq('main index unchanged',(await c.git(['ls-files','--stage','-z'])).stdout,main);c.eq('private index unchanged',(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout,own);c.eq('disk preserved',c.read('layer.txt'),'layer one\n');json(path.join(c.artifactDir,'raw-export-observations.json'),exports);
    return {limits:['Two successful metadata exports from one unsafe external-ref fixture. Not a complete object clone or atomic snapshot of an externally mutating repository.']};
  },{profile:'L6',phase:'CURRENT_PRODUCT',productStatus:'VERIFIED_SUPPORTED'}),
  spec('REF-015','real-journals-and-private-retention-measured','Actual refusal/discard cycles create measured retained journals and checkpoint objects',async c=>{
    await c.init();await c.layer();const measure=async label=>({label,countObjects:(await c.git(['count-objects','-v'])).stdout,metadataFiles:walk(path.join(c.repo,'.git/layers')).length,metadataBytes:walk(path.join(c.repo,'.git/layers')).reduce((n,p)=>n+fs.statSync(p).size,0)});const records=[await measure('before')];
    for(let i=0;i<3;i++){c.write('layer.txt',`stage${i}\n`);await cli(c,['add','tools','--','layer.txt']);c.write('layer.txt',`disk${i}\n`);const before=(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout;const r=await cli(c,['off','tools'],[3]);c.eq('dirty off refused '+i,r.body.error.code,'LAYER_DIRTY');c.eq('refused index retained '+i,(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:layerIndex(c)}})).stdout,before);c.eq('refused disk retained '+i,c.read('layer.txt'),`disk${i}\n`);await cli(c,['off','tools','--discard','--yes']);await cli(c,['on','tools']);c.eq('only committed bytes restored '+i,c.read('layer.txt'),'layer one\n');}
    records.push(await measure('after'));await c.git(['fsck','--full','--no-reflogs']);c.ok('actual journal retention recorded',records[1].metadataFiles>records[0].metadataFiles);json(path.join(c.artifactDir,'actual-retention.json'),records);
    return {productStatus:'PENDING_PRODUCT_SPEC',limits:['Three real staged/dirty refusal and explicit-discard cycles measured. No auto-shelf was created; growth is measured without inventing a retention policy or treating it as a leak.']};
  },{profile:'L4',phase:'CURRENT_PRODUCT',productStatus:'PENDING_PRODUCT_SPEC',tier:'stress',timeout:300000}),
  spec('MODEL-003','park-staged-dirty-absence-roundtrip','Repeated dirty refusals preserve all states; authorized discard restores only committed A',async c=>{
    await c.init();await c.layer();const own=layerIndex(c),head=await gt(c,['rev-parse','HEAD']),ref=await gt(c,['rev-parse','layer/tools']);
    c.write('layer.txt','staged B\n');await cli(c,['add','tools','--','layer.txt']);fs.unlinkSync(path.join(c.repo,'layer.txt'));c.write('reserved.txt','reserved physical\n');
    const ambiguous=await cli(c,['add','tools','--','reserved.txt'],[3]);
    c.eq('external absence and newcomer require an ownership decision',ambiguous.body.error.code,'OWNERSHIP_AMBIGUOUS');
    const review=(await cli(c,['ownership-review'])).body.result;
    c.eq('ownership review identifies only the missing Layer path',review.missing,[{path:'layer.txt',owner:'tools'}]);
    c.eq('ownership review identifies the independent newcomer',review.candidates,['reserved.txt']);
    const decisionState=async()=>({
      head:await gt(c,['rev-parse','HEAD']),branch:await gt(c,['symbolic-ref','HEAD']),refs:(await c.git(['for-each-ref','--format=%(refname) %(objectname)'])).stdout,
      mainIndex:(await c.git(['ls-files','--stage','-z'])).stdout,mainIndexSHA256:fileHash(path.join(c.repo,'.git/index')),
      layerIndex:(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:own}})).stdout,layerIndexSHA256:fileHash(own),
      files:Object.fromEntries(['base.txt','layer.txt','reserved.txt'].map(file=>{const full=path.join(c.repo,file);if(!fs.existsSync(full))return[file,{exists:false}];const stat=fs.lstatSync(full);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('Ownership decision fixture requires regular owned files');return[file,{exists:true,mode:stat.mode&0o777,sha256:fileHash(full),bytesBase64:fs.readFileSync(full).toString('base64')}];})),
    });
    const beforeDecision=await decisionState();
    const resolution=await cli(c,['ownership-resolve','deleted','--token',review.token,'--','layer.txt']);
    const afterDecision=await decisionState();
    c.eq('recognizing only the external deletion preserves HEAD refs indexes bytes and modes',afterDecision,beforeDecision);
    const owners=await c.core('files',[]);
    c.eq('newcomer remains unassigned until the original explicit add',owners.find(file=>file.path==='reserved.txt')?.owner,null);
    const unchangedAfterOwnershipRead=await decisionState();
    c.eq('read-only ownership observation preserves all Git and physical state',unchangedAfterOwnershipRead,beforeDecision);
    json(path.join(c.artifactDir,'model003-ownership-decision.json'),{review:{editingTarget:review.editingTarget,missing:review.missing,candidates:review.candidates},resolution:resolution.body.result,beforeDecision,afterDecision,owners,unchangedAfterOwnershipRead});
    await cli(c,['add','tools','--','reserved.txt']);await cli(c,['unstage','tools','--','reserved.txt']);
    c.write('base.txt','base staged\n');await c.git(['add','base.txt']);const index=(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:own}})).stdout,base=(await c.git(['ls-files','--stage','-z'])).stdout,registration=c.read('.git/layers/registry.json');
    for(let i=0;i<2;i++){const r=await cli(c,['off','tools'],[3]);c.eq('dirty off rejected '+i,r.body.error.code,'LAYER_DIRTY');c.eq('dirty absence retained '+i,c.exists('layer.txt'),false);c.eq('reservation bytes retained '+i,c.read('reserved.txt'),'reserved physical\n');c.eq('staged B retained '+i,(await c.git(['show',':layer.txt'],{env:{GIT_INDEX_FILE:own}})).stdout,'staged B\n');c.eq('Layer index retained '+i,(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:own}})).stdout,index);c.eq('registry retained '+i,c.read('.git/layers/registry.json'),registration);c.eq('Base stage retained '+i,(await c.git(['ls-files','--stage','-z'])).stdout,base);}
    await cli(c,['off','tools','--discard','--yes']);await cli(c,['on','tools']);c.eq('committed A restored',c.read('layer.txt'),'layer one\n');c.eq('discarded reservation absent',c.exists('reserved.txt'),false);c.eq('base stage after discard',(await c.git(['ls-files','--stage','-z'])).stdout,base);c.eq('HEAD retained',await gt(c,['rev-parse','HEAD']),head);c.eq('Layer ref retained',await gt(c,['rev-parse','layer/tools']),ref);
  },{profile:'L4',phase:'CURRENT_PRODUCT',productStatus:'VERIFIED_SUPPORTED',timeout:300000}),
  spec('MODEL-005','seeded-owner-independence','A seeded owner mutation preserves the other owner and Base stage',async c=>{
    await c.init();await c.layer('one','one.txt','one A\n');await c.layer('two','two.txt','two A\n');c.write('base.txt','base B\n');await c.git(['add','base.txt']);
    const records=JSON.parse(c.read('.git/layers/registry.json')).layers;const chosen=(parseInt(sha256(String(c.seed)).slice(0,2),16)%2)?'one':'two',other=chosen==='one'?'two':'one';
    const idx=name=>path.join(c.repo,'.git/layers/indexes',records.find(r=>r.name===name).id+'.index');
    const before={head:await gt(c,['rev-parse','HEAD']),base:(await c.git(['ls-files','--stage','-z'])).stdout,otherRef:await gt(c,['rev-parse','layer/'+other]),otherIndex:(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:idx(other)}})).stdout,otherDisk:c.read(other+'.txt')};
    c.write(chosen+'.txt','chosen staged B\n');await cli(c,['add',chosen,'--',chosen+'.txt']);c.write(chosen+'.txt','chosen dirty C\n');await cli(c,['commit',chosen,'-m','seeded owner']);
    c.eq('chosen commit uses staging',(await c.git(['show','layer/'+chosen+':'+chosen+'.txt'])).stdout,'chosen staged B\n');c.eq('chosen dirty disk preserved',c.read(chosen+'.txt'),'chosen dirty C\n');
    c.eq('independent owners',{head:await gt(c,['rev-parse','HEAD']),base:(await c.git(['ls-files','--stage','-z'])).stdout,otherRef:await gt(c,['rev-parse','layer/'+other]),otherIndex:(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:idx(other)}})).stdout,otherDisk:c.read(other+'.txt')},before);
    json(path.join(c.artifactDir,'seeded-owner.json'),{seed:c.seed,chosen,other});
  },{profile:'L3',phase:'CURRENT_PRODUCT',productStatus:'VERIFIED_SUPPORTED',timeout:300000}),
  spec('RECOVERY-011','real-exclusive-index-file-handle','A fixture-owned Windows exclusive file handle blocks staging without erasing state',async c=>{
    await c.init();await c.layer();c.write('layer.txt','to stage\n');
    const target=layerIndex(c),main=path.join(c.repo,'.git/index'),records=JSON.parse(c.read('.git/layers/registry.json')).layers,checkpoint='refs/git-layers/state/'+records[0].id;
    const persist=(name,value)=>fs.writeFileSync(path.join(c.artifactDir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
    const image=file=>{const stat=fs.lstatSync(file,{bigint:true});if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1n)throw Error('Expected one regular owned image');const bytes=fs.readFileSync(file);return {bytes,proof:{sha256:sha256(bytes),size:String(stat.size),mode:String(stat.mode),dev:String(stat.dev),ino:String(stat.ino),mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs),nlink:String(stat.nlink)}};};
    const inventory=()=>{const entries=[];const visit=dir=>{for(const name of fs.readdirSync(dir).sort()){const file=path.join(dir,name),stat=fs.lstatSync(file,{bigint:true}),relative=path.relative(c.repo,file).split(path.sep).join('/');if(stat.isSymbolicLink())throw Error('Unexpected metadata link');if(stat.isDirectory()){entries.push({path:relative,kind:'directory'});visit(file);}else{if(!stat.isFile()||stat.nlink!==1n)throw Error('Unexpected metadata entry');entries.push({path:relative,kind:'file',...image(file).proof});}}};visit(path.join(c.repo,'.git/layers'));return entries;};
    const nativeRefs=async()=>({head:await gt(c,['rev-parse','HEAD']),layer:await gt(c,['rev-parse','layer/tools']),checkpoint:await gt(c,['rev-parse',checkpoint]),all:(await c.git(['for-each-ref','--format=%(refname)%00%(objectname)%00%(symref)'])).stdout});
    const nativeStage=async()=>({main:(await c.git(['ls-files','--stage','-z'])).stdout,private:(await c.git(['ls-files','--stage','-z'],{env:{GIT_INDEX_FILE:target}})).stdout,privateBlob:(await c.git(['show',':layer.txt'],{env:{GIT_INDEX_FILE:target}})).stdout});
    const beforeNative={refs:await nativeRefs(),stage:await nativeStage()},beforeMain=image(main),beforePrivate=image(target),beforeDisk={base:image(path.join(c.repo,'base.txt')),layer:image(path.join(c.repo,'layer.txt'))},beforeMetadata=inventory();
    fs.writeFileSync(path.join(c.artifactDir,'exclusive-main-before.index'),beforeMain.bytes,{flag:'wx'});fs.writeFileSync(path.join(c.artifactDir,'exclusive-private-before.index'),beforePrivate.bytes,{flag:'wx'});
    persist('exclusive-before.json',{native:beforeNative,main:beforeMain.proof,private:beforePrivate.proof,disk:{base:beforeDisk.base.proof,layer:beforeDisk.layer.proof},metadata:beforeMetadata});
    c.eq('committed Layer A is the preexisting private stage',beforeNative.stage.privateBlob,'layer one\n');
    const ps=path.join(c.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
    const command="$s = [IO.File]::Open($env:GIT_COMPAT_LOCK_TARGET,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None); [Console]::Out.WriteLine('FILE_LOCK_READY'); [Console]::Out.Flush(); try { [Threading.ManualResetEvent]::new($false).WaitOne(60000) | Out-Null } finally { $s.Dispose() }";
    let holder;let resolveReady,rejectReady;const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const holding=c.run(ps,['-NoProfile','-Command',command],{env:{GIT_COMPAT_LOCK_TARGET:target},ok:[0],okSignals:['SIGKILL'],timeout:65000,onSpawn(child){holder=child;let text='';child.stdout.on('data',chunk=>{text+=chunk.toString();if(text.includes('FILE_LOCK_READY'))resolveReady();});child.once('exit',()=>rejectReady(Error('File holder exited before test completed')));}});
    holding.catch(rejectReady);
    try{
      await ready;
      // The guarded source FD is opened before a transaction or native add.
      // Preserve the real refusal surface; do not manufacture a Git failure.
      const failed=await cli(c,['add','tools','--','layer.txt'],[3]);
      c.eq('guarded source FD refuses the exclusive handle',failed.body.error.code,'EBUSY');
      c.ok('busy refusal names the expected source-index open',failed.body.error.message.includes("open '"+target+"'"));
      c.ok('busy source refusal is not a fabricated native Git error',failed.body.error.details===undefined);
      const blockedRefs=await nativeRefs();persist('exclusive-while-blocked-refs.json',blockedRefs);
      c.eq('HEAD unchanged while blocked',blockedRefs.head,beforeNative.refs.head);c.eq('Layer ref unchanged while blocked',blockedRefs.layer,beforeNative.refs.layer);c.eq('checkpoint unchanged while blocked',blockedRefs.checkpoint,beforeNative.refs.checkpoint);c.eq('all refs unchanged while blocked',blockedRefs.all,beforeNative.refs.all);
    }finally{holder?.kill('SIGKILL');await holding;}
    const afterNative={refs:await nativeRefs(),stage:await nativeStage()},afterMain=image(main),afterPrivate=image(target),afterDisk={base:image(path.join(c.repo,'base.txt')),layer:image(path.join(c.repo,'layer.txt'))},afterMetadata=inventory();
    fs.writeFileSync(path.join(c.artifactDir,'exclusive-main-after.index'),afterMain.bytes,{flag:'wx'});fs.writeFileSync(path.join(c.artifactDir,'exclusive-private-after.index'),afterPrivate.bytes,{flag:'wx'});
    persist('exclusive-after.json',{native:afterNative,main:afterMain.proof,private:afterPrivate.proof,disk:{base:afterDisk.base.proof,layer:afterDisk.layer.proof},metadata:afterMetadata});
    c.eq('exclusive holder was owned child',Number.isInteger(holder?.pid),true);
    c.eq('MAIN raw bytes preserved',afterMain.bytes,beforeMain.bytes);c.eq('MAIN mode timestamp and identity preserved',afterMain.proof,beforeMain.proof);
    c.eq('private index raw bytes preserved',afterPrivate.bytes,beforePrivate.bytes);c.eq('private index mode timestamp and identity preserved',afterPrivate.proof,beforePrivate.proof);
    c.eq('native staging preserved after release',afterNative.stage,beforeNative.stage);c.eq('native HEAD Layer checkpoint and all refs preserved after release',afterNative.refs,beforeNative.refs);
    c.eq('base disk raw bytes preserved',afterDisk.base.bytes,beforeDisk.base.bytes);c.eq('base disk mode timestamp and identity preserved',afterDisk.base.proof,beforeDisk.base.proof);
    c.eq('dirty Layer disk raw bytes preserved',afterDisk.layer.bytes,beforeDisk.layer.bytes);c.eq('dirty Layer disk mode timestamp and identity preserved',afterDisk.layer.proof,beforeDisk.layer.proof);c.eq('dirty disk preserved',c.read('layer.txt'),'to stage\n');
    c.eq('metadata and journal inventory preserved without new transaction',afterMetadata,beforeMetadata);
    await c.git(['fsck','--full','--no-reflogs']);
    return {productStatus:'DOCUMENTED_RESTRICTION',limits:['Real FileShare.None contention against the Layer index. Disk-full, fsync failure, every rename boundary and every storage permission failure remain TEST_GAP; no global ACL or physical volume was changed.']};
  },{profile:'L6',phase:'CURRENT_PRODUCT',productStatus:'DOCUMENTED_RESTRICTION',capabilities:['win32'],timeout:180000}),
];
