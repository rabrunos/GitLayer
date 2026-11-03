import fs from 'node:fs';
import path from 'node:path';
import {project,fileHash,json,safeEvidence} from '../../../scripts/git-compat/lib.mjs';
import {inspectZipNames,storedZip} from './zip-fixtures.mjs';

const createCommand='$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & ([scriptblock]::Create([IO.File]::ReadAllText($env:GIT_COMPAT_PACKAGE_SCRIPT))) -Source $env:GIT_COMPAT_ZIP_SOURCE -Destination $env:GIT_COMPAT_ZIP_DESTINATION -CheckDirectory $env:GIT_COMPAT_ZIP_CHECK';
const checkCommand='$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & ([scriptblock]::Create([IO.File]::ReadAllText($env:GIT_COMPAT_PACKAGE_SCRIPT))) -ArchiveToCheck $env:GIT_COMPAT_ZIP_INPUT -CheckDirectory $env:GIT_COMPAT_ZIP_CHECK';

export async function exerciseZipPortability(c){
  const source=path.join(c.root,'zip-source'),reopened=path.join(c.root,'dotnet-reader'),zip=path.join(c.root,'portable.zip'),independent=path.join(c.root,'standard-reader');
  fs.mkdirSync(path.join(source,'evidence','empty directory'),{recursive:true});fs.mkdirSync(path.join(source,'subdir'));
  const files=new Map([
    ['REPORT.md','# Synthetic report\n\n[proof](evidence/proof.txt)\n[Unicode](evidence/a%C3%A7%C3%A3o%20%E6%9D%B1%E4%BA%AC.txt)\n[details](subdir/details.md)\n'],
    ['evidence/proof.txt','only synthetic bytes\n'],['evidence/ação 東京.txt','Unicode name and exact bytes: ação 東京\n'],['evidence/empty file.txt',Buffer.alloc(0)],
    ['subdir/details.md','# Details\n\n[report](../REPORT.md)\n[proof](../evidence/proof.txt)\n'],
  ]);
  for(const [rel,bytes] of files)fs.writeFileSync(path.join(source,rel),bytes);
  const manifest=[...files.keys()].map(rel=>({path:rel,sha256:fileHash(path.join(source,rel))}));json(path.join(source,'manifest.json'),manifest);manifest.push({path:'manifest.json',sha256:fileHash(path.join(source,'manifest.json'))});
  const system=c.env.SystemRoot??'C:\\Windows',ps=path.join(system,'System32/WindowsPowerShell/v1.0/powershell.exe'),env={GIT_COMPAT_PACKAGE_SCRIPT:path.join(project,'scripts/git-compat/package.ps1'),GIT_COMPAT_ZIP_SOURCE:source,GIT_COMPAT_ZIP_DESTINATION:zip,GIT_COMPAT_ZIP_CHECK:reopened};
  await c.run(ps,['-NoProfile','-Command',createCommand],{env});
  fs.copyFileSync(zip,path.join(c.artifactDir,'synthetic-portable.zip'),fs.constants.COPYFILE_EXCL);
  const observed=inspectZipNames(zip);json(path.join(c.artifactDir,'zip-raw-directory.json'),observed);
  c.ok('Raw local and central ZIP names contain no backslash',observed.entries.every(e=>!e.contains_backslash),true,observed.entries.map(e=>({name:e.name,contains_backslash:e.contains_backslash})), 'PKWARE APPNOTE 4.4.17.1');
  c.eq('Archive contains exact file hierarchy',[...observed.entries.filter(e=>!e.directory).map(e=>e.name)].sort(),manifest.map(e=>e.path).sort());
  c.ok('Unicode entry is explicitly UTF-8',observed.entries.find(e=>e.name==='evidence/ação 東京.txt')?.utf8===true);
  c.ok('Empty directory has canonical trailing slash',observed.entries.some(e=>e.name==='evidence/empty directory/'));
  function verify(root,label){
    for(const f of manifest)c.eq(label+' exact file hash '+f.path,fileHash(safeEvidence(root,f.path)),f.sha256);
    c.ok(label+' empty directory preserved',fs.statSync(path.join(root,'evidence','empty directory')).isDirectory());
    for(const report of ['REPORT.md','subdir/details.md'])for(const m of fs.readFileSync(path.join(root,report),'utf8').matchAll(/\]\(([^)]+)\)/gu)){
      const target=path.resolve(root,path.dirname(report),decodeURIComponent(m[1]));c.ok(label+' relative Markdown link '+report+' -> '+m[1],fs.existsSync(target));
    }
  }
  verify(reopened,'.NET reader');
  // The native Windows bsdtar reader is independent of .NET. No custom entry
  // normalization or Node extractor is used for the recipient-side proof.
  const tar=path.join(system,'System32','tar.exe');let reader;
  if(fs.existsSync(tar)){
    const version=await c.run(tar,['--version']);const listing=await c.run(tar,['-tf',zip],{ok:[0,1]});
    if(listing.code===0){fs.mkdirSync(independent);await c.run(tar,['-xf',zip,'-C',independent]);verify(independent,'Windows tar reader');reader={executable:tar,version:version.stdout.trim(),listing:listing.stdout,extraction:'standard tar -xf ZIP -C destination; no name transformation'};}
    else{c.ok('Tar diagnostic is the observed UTF-8 filename limitation',listing.stderr.includes('Archive entry has empty or unreadable filename'),true,listing.stderr);reader={available:false,executable:tar,version:version.stdout.trim(),exit:listing.code,reason:listing.stderr.trim(),upstream_context:'https://github.com/libarchive/libarchive/issues/3063'};}
  }else reader={available:false,reason:'Native Windows System32/tar.exe is absent; no installation, GUI alias, Linux requirement or substituted custom extractor.'};
  const tarObservation=reader,programFiles=path.join(path.parse(system).root,'Program Files');
  const jarRoots=[path.join(programFiles,'Eclipse Adoptium'),path.join(programFiles,'Java')];
  const jarCandidates=jarRoots.flatMap(root=>fs.existsSync(root)?fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()).map(e=>path.join(root,e.name,'bin','jar.exe')):[]).filter(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  if(reader.available===false&&jarCandidates.length){
    const jar=jarCandidates.sort().at(-1),version=await c.run(jar,['--version']),listing=await c.run(jar,['--list','--file',zip]);fs.mkdirSync(independent);
    await c.run(jar,['--extract','--file',zip],{cwd:independent});verify(independent,'JDK jar standard reader');
    reader={executable:jar,version:version.stdout.trim(),listing:listing.stdout,extraction:'standard jar --extract --file ZIP in destination cwd; no name transformation',tar_observation:tarObservation};
  }
  const originalZip=fileHash(zip),existingCheck=path.join(c.root,'already-exists');fs.mkdirSync(existingCheck);fs.writeFileSync(path.join(existingCheck,'canary.txt'),'preserve existing directory\n');
  await c.run(ps,['-NoProfile','-Command',createCommand],{env:{...env,GIT_COMPAT_ZIP_CHECK:path.join(c.root,'unused-check')},ok:[1]});c.eq('Existing ZIP is never overwritten',fileHash(zip),originalZip);
  const newZip=path.join(c.root,'must-not-create.zip');await c.run(ps,['-NoProfile','-Command',createCommand],{env:{...env,GIT_COMPAT_ZIP_DESTINATION:newZip,GIT_COMPAT_ZIP_CHECK:existingCheck},ok:[1]});c.eq('Existing check destination rejected before ZIP write',fs.existsSync(newZip),false);c.eq('Existing directory bytes retained',fs.readFileSync(path.join(existingCheck,'canary.txt'),'utf8'),'preserve existing directory\n');
  const canary=path.join(c.root,'outside-canary.txt');fs.writeFileSync(canary,'outside extraction target, owned synthetic bytes\n');
  const absolute=canary.replaceAll('\\','/'),rooted=absolute.replace(/^[a-z]:/iu,'');
  const bad=[
    ['traversal',[{name:'../outside-canary.txt'}]],['absolute',[{name:rooted}]],['drive',[{name:absolute}]],['backslash',[{name:'evidence\\literal.txt'}]],
    ['duplicate-case',[{name:'Evidence/Proof.txt'},{name:'evidence/proof.txt'}]],['symlink-mode',[{name:'link',data:'outside-canary.txt',external_attributes:0xa1ff0000}]],
    ['parent-file',[{name:'parent'},{name:'PARENT/child.txt'}]],['empty-segment',[{name:'a//proof.txt'}]],['double-slash-directory',[{name:'a//',data:''}]],['dot-segment',[{name:'a/./proof.txt'}]],['alternate-stream',[{name:'proof.txt:stream'}]],
  ];
  for(const [name,entries] of bad){
    const input=path.join(c.root,'bad-'+name+'.zip'),dest=path.join(c.root,'rejected-'+name);fs.writeFileSync(input,storedZip(entries));
    const result=await c.run(ps,['-NoProfile','-Command',checkCommand],{env:{GIT_COMPAT_PACKAGE_SCRIPT:env.GIT_COMPAT_PACKAGE_SCRIPT,GIT_COMPAT_ZIP_INPUT:input,GIT_COMPAT_ZIP_CHECK:dest},ok:[1]});
    c.ok('Unsafe '+name+' rejected by archive validation',/Unsafe|Invalid|Duplicate|conflict|reparse|symlink/iu.test(result.stderr),true,result.stderr);
    c.eq('Unsafe '+name+' rejected before extraction directory creation',fs.existsSync(dest),false);c.eq('Unsafe '+name+' preserves exterior canary',fs.readFileSync(canary,'utf8'),'outside extraction target, owned synthetic bytes\n');
  }
  let sourceReparse;
  const link=path.join(source,'owned-junction');
  try{fs.symlinkSync(existingCheck,link,process.platform==='win32'?'junction':'dir');sourceReparse={probe:'owned fixture junction/symlink created'};}
  catch(error){if(!['EPERM','EACCES','ENOTSUP'].includes(error.code))throw error;sourceReparse={available:false,reason:error.code};}
  if(sourceReparse.probe){
    const rejected=path.join(c.root,'linked-source.zip');await c.run(ps,['-NoProfile','-Command',createCommand],{env:{...env,GIT_COMPAT_ZIP_DESTINATION:rejected,GIT_COMPAT_ZIP_CHECK:path.join(c.root,'linked-source-check')},ok:[1]});c.eq('Source junction rejected before ZIP creation',fs.existsSync(rejected),false);c.eq('Junction target bytes retained',fs.readFileSync(path.join(existingCheck,'canary.txt'),'utf8'),'preserve existing directory\n');fs.unlinkSync(link);
  }
  const proof={manifest,zipBytes:fs.statSync(zip).size,raw_directory_names_checked:true,raw_backslashes:observed.entries.filter(e=>e.contains_backslash).length,independent_reader:reader,negative_cases:bad.map(([name])=>name),source_reparse_probe:sourceReparse};json(path.join(c.artifactDir,'portable-package-proof.json'),proof);
  return {limits:[...(reader.available===false?[reader.reason+'; no JDK jar executable found under the explicit Program Files installation roots.']:[]),...(reader.tar_observation?.available===false?['Windows tar reader limitation recorded: '+reader.tar_observation.reason+'; independent full extraction instead passed with installed JDK jar.']:[]),...(sourceReparse.available===false?['Source junction creation unavailable: '+sourceReparse.reason+'; ZIP Unix-symlink-mode rejection was still executed.']:[]),'Portable artifact proof on Windows with raw ZIP header inspection and available native standard reader; no Linux product execution is claimed.']};
}
