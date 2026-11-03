import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { project, resolveGit } from './git-compat/lib.mjs';
import { validateOutputRoot } from './git-compat/output-root.mjs';
import { validateImplementationClosure, validateScenarioPreservation, normalizeImplementationPatch } from './implementation-evidence-closure.mjs';

const DEFAULT_BRIEF = '.workshop/briefs/implementation-2026-11-02-5dfe2f02';
const usage = 'node scripts/package-implementation-evidence.mjs --out NEW_DIRECTORY --report FINAL_REPORT.md [--brief-root ROOT] [--evidence-root ROOT] [--zip-name NAME.zip]';
const inside = (root, file) => { const rel=path.relative(root,file); return !rel || rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel); };
const rel = (root, file) => path.relative(root,file).split(path.sep).join('/');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/u,''));
const json = (file,value) => fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n','utf8');
function noLinks(file) {
 const absolute=path.resolve(file),volume=path.parse(absolute).root;let cursor=volume;
 for(const part of path.relative(volume,absolute).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);try{if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Linked input/output refused: '+cursor);}catch(error){if(error.code==='ENOENT')return;throw error;}}
}
function portableName(name) {
 if(!name||name.includes('\\')||name.includes(':')||name.startsWith('/')||/[\u0000-\u001f<>"|?*]/u.test(name)||name.split('/').some(part=>!part||part==='.'||part==='..'||/[. ]$/u.test(part)||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(part)))throw Error('Nonportable package path: '+name);
}
function stableBytes(file) {
 noLinks(file);const before=fs.lstatSync(file);
 if(!before.isFile()||before.nlink!==1||before.size>64*1024*1024)throw Error('Input must be a bounded regular unlinked file: '+file);
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
 try{const opened=fs.fstatSync(fd);if(opened.dev!==before.dev||opened.ino!==before.ino||!opened.isFile())throw Error('Input identity changed');const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd),current=fs.lstatSync(file);if(current.isSymbolicLink()||current.dev!==before.dev||current.ino!==before.ino||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||after.ctimeMs!==opened.ctimeMs||current.size!==after.size||current.mtimeMs!==after.mtimeMs)throw Error('Input changed during read: '+file);return bytes;}finally{fs.closeSync(fd);}
}
function filesIn(root, rejectRepo=false, skipped=[], prefix='', excluded=[]) {
 if(excluded.some(directory=>inside(directory,root)))return [];
 noLinks(root);if(!fs.lstatSync(root).isDirectory())throw Error('Expected directory: '+root);
 if(rejectRepo&&fs.existsSync(path.join(root,'.git'))){skipped.push({path:prefix,reason:'repository/fixture omitted'});return [];}
 return fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
  const file=path.join(root,entry.name),name=prefix?prefix+'/'+entry.name:entry.name;
  if(entry.isSymbolicLink())throw Error('Symlink in package input: '+name);
  if(entry.isDirectory()){
   if(rejectRepo&&['.git','.workshop','node_modules','profiles','fixtures','fixture','worktrees','home','temp'].includes(entry.name)){skipped.push({path:name,reason:'fixture/cache/private directory omitted'});return [];}
   return filesIn(file,rejectRepo,skipped,name,excluded);
  }
  if(!entry.isFile())throw Error('Special input file refused: '+name);
  if(excluded.some(directory=>inside(directory,file)))return [];
  portableName(name);return [{file,path:name}];
 });
}
const credentialName = name => /(?:^|\/)(?:\.env(?:$|\.(?!example$|sample$|template$))|id_rsa(?:$|\.)|id_ed25519(?:$|\.)|credentials(?:\.json)?$)|\.(?:pfx|p12|pem|key)$/iu.test(name);
const sourceExcluded = name => name.split('/').some(part=>['.git','artifacts','.workshop','node_modules','.local-bin','__pycache__'].includes(part))||/^dist(?:$|-)/u.test(name.split('/')[0])||/\.(?:zip|log|tsbuildinfo|exe|dll|node|asar)$/iu.test(name);
function inventory(entries) {return entries.map(entry=>{const bytes=stableBytes(entry.file);return {path:entry.path,bytes:bytes.length,sha256:hash(bytes)};}).sort((a,b)=>a.path.localeCompare(b.path));}
function copyEntries(entries,destination,manifest) {
 for(const entry of entries){if(credentialName(entry.path))throw Error('Credential-like filename requires exclusion/review: '+entry.path);const bytes=stableBytes(entry.file),expected=manifest.find(item=>item.path===entry.path);if(bytes.length!==expected.bytes||hash(bytes)!==expected.sha256)throw Error('Input changed before copy: '+entry.path);const target=path.join(destination,...entry.path.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
}
export function parseImplementationPackageArgs(args) {
 if(args.length===1&&args[0]==='--help')return {help:true};const values={};
 for(let i=0;i<args.length;i++){const key=args[i];if(!['--out','--report','--brief-root','--evidence-root','--zip-name'].includes(key)||values[key]!==undefined||!args[i+1]||args[i+1].startsWith('--'))throw Error(usage);values[key]=args[++i];}
 if(!values['--out']||!values['--report'])throw Error(usage);
 const out=validateOutputRoot(values['--out'],{projectRoot:project});if(!inside(path.join(project,'artifacts'),out)||fs.existsSync(out))throw Error('--out must be a new directory below artifacts/');
 const report=path.resolve(values['--report']),brief=path.resolve(values['--brief-root']??path.join(project,DEFAULT_BRIEF)),evidence=path.resolve(values['--evidence-root']??path.join(project,'artifacts/implementation-2026-11-02'));
 for(const input of [report,brief,evidence])noLinks(input);
 if(!fs.statSync(report).isFile()||!fs.statSync(brief).isDirectory()||!fs.statSync(evidence).isDirectory())throw Error('Report, brief and evidence inputs must exist');
 if(!inside(project,report)||!inside(path.join(project,'.workshop/briefs'),brief)||!inside(path.join(project,'artifacts'),evidence))throw Error('Inputs outside approved project roots');
 if(inside(out,report)||inside(out,brief)||inside(out,evidence))throw Error('Package input cannot be inside its new output');
 const zipName=values['--zip-name']??'Git-Layer-Implementacao-2026-11-02-Evidencias.zip';if(!/^[\w.-]+\.zip$/u.test(zipName))throw Error('Unsafe ZIP name');
 return {out,report,brief,evidence,zipName};
}
function markdownProse(text) {
 let fence=null;return text.split(/\r?\n/u).map(line=>{const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);if(fence){if(marker&&marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;return '';}if(marker){fence={char:marker[1][0],length:marker[1].length};return '';}return line.replace(/(`+)[\s\S]*?\1/gu,'');}).join('\n');
}
function linkDestinations(text) {
 const links=[];for(const match of markdownProse(text).matchAll(/\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/gu))links.push(match[1].startsWith('<')?match[1].slice(1,-1):match[1]);return links;
}
function validateEntryLinks(root,file) {
 const links=[];for(const link of linkDestinations(fs.readFileSync(file,'utf8'))){if(/^[a-z][a-z\d+.-]*:/iu.test(link)&&!/^file:|^[a-z]:[\\/]/iu.test(link))continue;const raw=link.split('#')[0].split('?')[0];if(/^file:|^[a-z]:[\\/]|^\/|\\/iu.test(raw))throw Error('Absolute/nonportable entry link: '+link);const target=raw?path.resolve(path.dirname(file),decodeURIComponent(raw)):file;if(!inside(root,target)||!fs.existsSync(target))throw Error('Broken/escaping entry link: '+link);noLinks(target);links.push({link,target:rel(root,target)});}return links;
}
export function packageImplementationEvidence(args=process.argv.slice(2)) {
 const options=parseImplementationPackageArgs(args);if(options.help){console.log(usage);return;}
 const git=resolveGit(),env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^GIT_/iu.test(key)&&key!=='NODE_OPTIONS'));
 Object.assign(env,{GIT_OPTIONAL_LOCKS:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_PAGER:'',GIT_ASKPASS:'',SSH_ASKPASS:''});
 const native=(argv,{cwd=project,ok=[0],input,binary=false}={})=>{const args=['--no-pager','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','credential.helper=','-c','diff.external=',...argv],r=spawnSync(git,args,{cwd,env,input,shell:false,windowsHide:true,encoding:binary?undefined:'utf8',timeout:60000,maxBuffer:64*1024*1024});if(!ok.includes(r.status))throw Error('Read-only Git command failed: '+(r.stderr||r.error?.message));return r.stdout;};
 const sourceEntries=()=>{
  const names=new TextDecoder('utf-8',{fatal:true}).decode(native(['ls-files','--cached','--others','--exclude-standard','-z'],{binary:true})).split('\0').filter(Boolean);
  return [...new Set(names)].filter(name=>!sourceExcluded(name)).sort().map(name=>{portableName(name);if(credentialName(name))throw Error('Credential-like tracked source refused: '+name);const file=path.resolve(project,...name.split('/'));if(!inside(project,file))throw Error('Source path escapes project');noLinks(file);try{fs.lstatSync(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}return {file,path:name};}).filter(Boolean);
 };
 const baselineEntries=filesIn(path.join(options.brief,'before')),baselineManifest=inventory(baselineEntries),expectedBaseline=readJSON(path.join(options.brief,'baseline-files.json'));
 if(!Array.isArray(expectedBaseline)||expectedBaseline.length!==301||expectedBaseline.length!==baselineManifest.length||baselineManifest.some(file=>{const old=expectedBaseline.find(item=>item.path===file.path);return !old||old.length!==file.bytes||old.sha256.toLowerCase()!==file.sha256;}))throw Error('Initial local baseline copy/hash proof disagrees');
 const briefRoot=path.join(options.brief,'package/Git-Layer-Implementacao-2026-11-02'),briefEntries=filesIn(briefRoot),briefManifest=inventory(briefEntries),received=readJSON(path.join(briefRoot,'MANIFEST.json'));
 if(!Array.isArray(received.arquivos)||briefManifest.length!==received.arquivos.length+1||received.arquivos.some(file=>!briefManifest.some(item=>item.path===file.caminho&&item.bytes===file.bytes&&item.sha256===file.sha256)))throw Error('Received brief manifest disagrees');
 const skipped=[],getEvidence=()=>filesIn(options.evidence,true,skipped,'',[options.out]).filter(entry=>!(/\.(?:exe|dll|node|asar|msi)$/iu.test(entry.path)));
 const sources=sourceEntries(),sourceManifest=inventory(sources),evidence=getEvidence(),evidenceManifest=inventory(evidence);
 const scenarioReference='docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json';
 const scenarioPreservation=validateScenarioPreservation({originalBytes:stableBytes(path.join(project,scenarioReference)),baselineOriginalBytes:stableBytes(path.join(options.brief,'before',scenarioReference)),workingBytes:stableBytes(path.join(project,'tests/git-compat/scenarios.json'))});
 const closureFile=path.join(options.evidence,'FINAL-EVIDENCE.json'),requirementsFile=path.join(options.evidence,'REQUIREMENTS.json');
 const closure=validateImplementationClosure({requirements:readJSON(requirementsFile),finalEvidence:readJSON(closureFile),currentSources:sourceManifest,requirementsSha256:hash(stableBytes(requirementsFile)),reportSha256:hash(stableBytes(options.report)),readReference:name=>{
  const target=path.resolve(options.evidence,...name.split('/'));if(!inside(options.evidence,target)||!evidenceManifest.some(file=>file.path===name))throw Error('Closure reference is missing/excluded from the portable evidence: '+name);return stableBytes(target);
 }});
 const metadata=filesIn(options.brief).filter(entry=>!entry.path.startsWith('before/')&&!entry.path.startsWith('package/')&&!entry.path.includes('/before/')),metadataManifest=inventory(metadata);
 const baselineState=readJSON(path.join(options.brief,'baseline.json'));
 const rootZip=path.join(project,'Git-Layer-Implementacao-2026-11-02.zip'),rootZipExpected='2008e9f9de9ba7e99693c89b49d3a9a53e5e79aea09c8a365526f43d32256140';
 const rootZipObserved=hash(stableBytes(rootZip));if(rootZipObserved!==rootZipExpected)throw Error('Original received ZIP differs from the authorized baseline');
 const repositorySnapshot=()=>({head:native(['rev-parse','--verify','HEAD']).trim(),branch:native(['symbolic-ref','--short','HEAD']).trim(),status:native(['status','--porcelain=v2','--branch','--untracked-files=all']).trimEnd().split(/\r?\n/u),staged:native(['diff','--cached','--name-status','-z'])});
 const initialStaged=(baselineState.status??[]).filter(line=>/^[12u] /u.test(line)&&line.split(' ')[1]?.[0]!=='.');
 if(initialStaged.length)throw Error('Initial nonempty stage requires its own semantic-index snapshot, not an inferred reconstruction');
 const repositoryBefore=repositorySnapshot();if(repositoryBefore.head!==baselineState.head||repositoryBefore.branch!==baselineState.branch||repositoryBefore.staged!=='')throw Error('Project HEAD/branch/staged state differs from the initial baseline');
 const labPath=name=>name.startsWith('src/desktop/')||name.startsWith('tests/e2e/')||name==='scripts/workshop-ui.mjs'||name.startsWith('tests/unit/file-decorations')||name==='tests/unit/explorer-tree.test.ts';
 const labBefore=baselineManifest.filter(file=>labPath(file.path)),labAfter=sourceManifest.filter(file=>labPath(file.path));
 if(JSON.stringify(labBefore)!==JSON.stringify(labAfter))throw Error('Desktop/laboratory input differs from the preserved initial local bytes');
 const preservation={initialBaselineFiles:baselineManifest.length,initialBaselineHashesVerified:true,originalZip:{sha256:rootZipObserved,expectedSha256:rootZipExpected,rawZipExcluded:true},headBranchPreserved:true,initialStageEmpty:true,currentStageEmpty:true,laboratoryFiles:labBefore.length,laboratoryHashesUnchanged:true,laboratoryManifest:labBefore,repositoryBefore};
 if([...baselineManifest,...briefManifest,...sourceManifest,...evidenceManifest,...metadataManifest].reduce((sum,file)=>sum+file.bytes,0)>512*1024*1024)throw Error('Package input exceeds 512 MiB; review selection rather than silently truncating');
 fs.mkdirSync(path.dirname(options.out),{recursive:true});fs.mkdirSync(options.out);const stage=path.join(options.out,'content'),reopened=path.join(options.out,'reopened');fs.mkdirSync(stage);
 json(path.join(options.out,'STARTED.json'),{started:new Date().toISOString(),runnerSha256:hash(stableBytes(fileURLToPath(import.meta.url))),policy:'No project commit, push, checkout, global configuration or real-data migration; read-only Git inventory/diff and owned artifact output only.'});
 try{
  copyEntries(sources,path.join(stage,'source'),sourceManifest);copyEntries(baselineEntries,path.join(stage,'baseline/before'),baselineManifest);copyEntries(briefEntries,path.join(stage,'brief'),briefManifest);copyEntries(evidence,path.join(stage,'evidence'),evidenceManifest);
  copyEntries(metadata,path.join(stage,'baseline'),metadataManifest);
  json(path.join(stage,'PRESERVATION.json'),preservation);json(path.join(stage,'CLOSURE-VALIDATION.json'),closure);json(path.join(stage,'SCENARIO-PRESERVATION.json'),scenarioPreservation);
  const beforeMap=new Map(baselineManifest.map(file=>[file.path,file])),currentMap=new Map(sourceManifest.map(file=>[file.path,file]));
  const changes=[...new Set([...beforeMap.keys(),...currentMap.keys()])].sort().flatMap(name=>{const before=beforeMap.get(name),after=currentMap.get(name);return before?.sha256===after?.sha256?[]:[{path:name,kind:!before?'added':!after?'removed':'modified',before:before??null,after:after??null}];});
  fs.mkdirSync(path.join(stage,'changes'));json(path.join(stage,'changes/CHANGES.json'),{basis:'Initial LOCAL state, including preexisting uncommitted/untracked changes, not HEAD alone.',changes});
  let patch=native(['diff','--no-index','--binary','--no-renames','--no-ext-diff','--no-textconv','--','baseline/before','source'],{cwd:stage,ok:[0,1]});
  patch=normalizeImplementationPatch(patch);fs.writeFileSync(path.join(stage,'changes/implementation.patch'),patch,'utf8');
  const sourceCapture=name=>/(?:^|\/)(?:source|sources|before|after|baseline)(?:\/|$)/u.test(name);
  const derived=new Map(evidence.filter(entry=>entry.path.endsWith('.md')&&!sourceCapture(entry.path)).map(entry=>[path.resolve(entry.file),'review/'+entry.path]));
  const mapOriginal=file=>{
   file=path.resolve(file);if(derived.has(file))return path.join(stage,derived.get(file));
   if(inside(path.join(options.brief,'before'),file))return path.join(stage,'baseline/before',path.relative(path.join(options.brief,'before'),file));
   if(inside(briefRoot,file))return path.join(stage,'brief',path.relative(briefRoot,file));
   if(inside(options.brief,file))return path.join(stage,'baseline',path.relative(options.brief,file));
   if(inside(options.evidence,file))return path.join(stage,'evidence',path.relative(options.evidence,file));
   if(inside(project,file))return path.join(stage,'source',path.relative(project,file));return null;
  };
  const rewrite=(text,original,target)=>{
   let fence=null;return text.split(/(?<=\n)/u).map(line=>{const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);if(fence){if(marker&&marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;return line;}if(marker){fence={char:marker[1][0],length:marker[1].length};return line;}
    return line.replace(/\]\((<[^>]+>|[^\s)]+)(\s+"[^"]*")?\)/gu,(whole,value,title='')=>{const raw=value.startsWith('<')?value.slice(1,-1):value;if(/^[a-z][a-z\d+.-]*:/iu.test(raw)&&!/^file:|^[a-z]:[\\/]/iu.test(raw)||raw.startsWith('#'))return whole;const markerAt=raw.search(/[?#]/u),base=markerAt<0?raw:raw.slice(0,markerAt),suffix=markerAt<0?'':raw.slice(markerAt);const originalTarget=path.resolve(path.dirname(original),decodeURIComponent(base)),mapped=mapOriginal(originalTarget);if(!mapped)return whole;return ']('+encodeURI(rel(path.dirname(target),mapped))+suffix+title+')';});
   }).join('');
  };
  const derivations=[];for(const entry of evidence.filter(entry=>derived.has(path.resolve(entry.file)))){const destination=path.join(stage,derived.get(path.resolve(entry.file))),bytes=stableBytes(entry.file),text=rewrite(bytes.toString('utf8'),entry.file,destination);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,text,{flag:'wx'});derivations.push({original:'evidence/'+entry.path,originalSha256:hash(bytes),derived:rel(stage,destination),derivedSha256:hash(Buffer.from(text)),policy:'Only local Markdown destinations rewritten; original evidence remains byte-exact.'});}
  const reportBytes=stableBytes(options.report),report=rewrite(reportBytes.toString('utf8'),options.report,path.join(stage,'REPORT.md'));fs.writeFileSync(path.join(stage,'REPORT.md'),report,{flag:'wx'});
  json(path.join(stage,'SOURCE-MANIFEST.json'),{current:sourceManifest,initialLocal:baselineManifest,receivedBrief:briefManifest});json(path.join(stage,'EVIDENCE-MANIFEST.json'),{original:evidenceManifest,omissions:skipped,markdownDerivations:derivations});
  const links=validateEntryLinks(stage,path.join(stage,'REPORT.md'));json(path.join(stage,'ENTRY-LINKS.json'),{file:'REPORT.md',checked:links.length,links});
  if(JSON.stringify(inventory(sourceEntries()))!==JSON.stringify(sourceManifest)||JSON.stringify(inventory(baselineEntries))!==JSON.stringify(baselineManifest)||JSON.stringify(inventory(metadata))!==JSON.stringify(metadataManifest)||JSON.stringify(inventory(getEvidence()))!==JSON.stringify(evidenceManifest))throw Error('Source/baseline/evidence changed during package preparation');
  json(path.join(stage,'PACKAGING.json'),{prepared:new Date().toISOString(),runner:'source/scripts/package-implementation-evidence.mjs',runnerSha256:hash(stableBytes(fileURLToPath(import.meta.url))),packager:'source/scripts/git-compat/package.ps1',packagerSha256:hash(stableBytes(path.join(project,'scripts/git-compat/package.ps1'))),originalReportSha256:hash(reportBytes),packagedReportSha256:hash(Buffer.from(report)),counts:{source:sourceManifest.length,initialLocal:baselineManifest.length,brief:briefManifest.length,evidence:evidenceManifest.length,changes:changes.length},policy:'Manifest covers staged content, excluding itself. Closed ZIP validation/hash is external PACKAGE-VALIDATION.json; no self-referential hash claim.'});
  const manifest=inventory(filesIn(stage));json(path.join(stage,'MANIFEST.json'),{schema:1,files:manifest});
  const zip=path.join(options.out,options.zipName),powershell=path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const command='$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & ([scriptblock]::Create([IO.File]::ReadAllText($env:GIT_COMPAT_PACKAGE_SCRIPT))) -Source $env:GIT_COMPAT_ZIP_SOURCE -Destination $env:GIT_COMPAT_ZIP_DESTINATION -CheckDirectory $env:GIT_COMPAT_ZIP_CHECK';
  const packaged=spawnSync(powershell,['-NoProfile','-Command',command],{cwd:project,shell:false,windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024,env:{...env,GIT_COMPAT_PACKAGE_SCRIPT:path.join(project,'scripts/git-compat/package.ps1'),GIT_COMPAT_ZIP_SOURCE:stage,GIT_COMPAT_ZIP_DESTINATION:zip,GIT_COMPAT_ZIP_CHECK:reopened}});
  fs.writeFileSync(path.join(options.out,'package.stdout'),packaged.stdout??'');fs.writeFileSync(path.join(options.out,'package.stderr'),packaged.stderr??'');
  if(packaged.status!==0)throw Error('Reviewed ZIP packager failed: '+(packaged.stderr||packaged.error?.message));
  const reopenedFiles=inventory(filesIn(reopened)),expected=[...manifest,{path:'MANIFEST.json',bytes:fs.statSync(path.join(stage,'MANIFEST.json')).size,sha256:hash(stableBytes(path.join(stage,'MANIFEST.json')))}].sort((a,b)=>a.path.localeCompare(b.path));
  if(JSON.stringify(reopenedFiles)!==JSON.stringify(expected))throw Error('Reopened ZIP has missing, extra or differing files');
  const reopenedLinks=validateEntryLinks(reopened,path.join(reopened,'REPORT.md'));
  if(JSON.stringify(inventory(sourceEntries()))!==JSON.stringify(sourceManifest)||JSON.stringify(inventory(baselineEntries))!==JSON.stringify(baselineManifest)||JSON.stringify(inventory(metadata))!==JSON.stringify(metadataManifest)||JSON.stringify(inventory(getEvidence()))!==JSON.stringify(evidenceManifest))throw Error('Inputs changed before closed ZIP validation completed');
  const repositoryAfter=repositorySnapshot();if(repositoryAfter.head!==repositoryBefore.head||repositoryAfter.branch!==repositoryBefore.branch||repositoryAfter.staged!==repositoryBefore.staged)throw Error('Project HEAD/branch/stage changed during packaging');
  const validation={schema:1,finished:new Date().toISOString(),zip:options.zipName,sha256:hash(stableBytes(zip)),bytes:fs.statSync(zip).size,manifestFiles:manifest.length,allHashesAndSizesVerified:true,noMissingOrExtraReopenedFiles:true,entryReportLinksVerified:true,entryReportLinks:reopenedLinks.length,sourcesStable:true,projectHeadBranchStagePreserved:true,laboratoryInputHashesPreserved:true,originalReceivedZipHashVerified:true,finalRepositoryStatus:repositoryAfter.status,initialLocalBaselineFiles:baselineManifest.length,receivedBriefFiles:briefManifest.length,traceabilityClosed:true,originalScenarioBytesPreserved:true,originalScenarioIdsPreserved:true,scenarioCounts:{original:scenarioPreservation.original.count,working:scenarioPreservation.working.count,added:scenarioPreservation.working.addedIds.length},currentFullSuite:closure.currentFullSuite,currentFocusedAllExitZero:closure.currentFocusedAllExitZero,requirementsStatuses:closure.requirements,packagerExit:packaged.status,packagerSignal:packaged.signal};json(path.join(options.out,'PACKAGE-VALIDATION.json'),validation);fs.writeFileSync(zip+'.sha256',validation.sha256+'  '+options.zipName+'\n');fs.writeFileSync(path.join(options.out,'REPORT.md'),'# Git Layer \u2014 implementa\u00e7\u00e3o e evid\u00eancias\n\n[Relat\u00f3rio completo](content/REPORT.md). [Valida\u00e7\u00e3o do pacote](PACKAGE-VALIDATION.json).\n',{flag:'wx'});console.log(JSON.stringify(validation,null,2));return validation;
 }catch(error){json(path.join(options.out,'PACKAGE-FAILURE.json'),{failed:new Date().toISOString(),message:error.message,policy:'Partial output retained; do not overwrite. Retry only into a new output after correcting the cause.'});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{packageImplementationEvidence();}catch(error){console.error(JSON.stringify({status:'FAIL',message:error.message}));process.exitCode=2;}}
