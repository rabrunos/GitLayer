import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {project,createFixture,cleanupFixture,isolatedEnvironment,context,fileHash,json,relative} from '../../../scripts/git-compat/lib.mjs';
import {validateOutputRoot} from '../../../scripts/git-compat/output-root.mjs';
import {inspectZipNames} from './zip-fixtures.mjs';

// The process cwd deliberately remains short. This exercises long file I/O,
// not CreateProcess's separate Windows working-directory limitation.
test('Windows ZIP preserves paths beyond MAX_PATH without changing policy',{skip:process.platform!=='win32',timeout:90000},async()=>{
  const evidenceParent=process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT;
  let evidenceRoot;
  if(evidenceParent){
    if(!path.isAbsolute(evidenceParent))throw Error('GIT_COMPAT_INFRA_EVIDENCE_ROOT must be absolute');
    const parent=validateOutputRoot(evidenceParent,{projectRoot:project});fs.mkdirSync(parent,{recursive:true});
    evidenceRoot=path.join(parent,'zip-long-'+crypto.randomUUID());fs.mkdirSync(evidenceRoot);
  }
  const fixture=createFixture(path.join(project,'.workshop/git-compat-infra'),'zl');
  const artifactDir=evidenceRoot??path.join(fixture.root,'evidence');
  const c=context({root:fixture.root,repo:path.join(fixture.root,'cwd'),gitPath:process.execPath,env:isolatedEnvironment(fixture.root,process.execPath),artifactDir,packageRoot:evidenceRoot??fixture.root,fixture});
  const ps=path.join(c.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const command='$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & ([scriptblock]::Create([IO.File]::ReadAllText($env:GIT_COMPAT_PACKAGE_SCRIPT))) -Source $env:GIT_COMPAT_ZIP_SOURCE -Destination $env:GIT_COMPAT_ZIP_DESTINATION -CheckDirectory $env:GIT_COMPAT_ZIP_CHECK';
  const extend=(start,min)=>{let p=start;while(p.length<min)p=path.join(p,'nested-long-name');return p;};
  const invoke=(source,zip,check,ok=[0])=>c.run(ps,['-NoProfile','-Command',command],{ok,env:{GIT_COMPAT_PACKAGE_SCRIPT:path.join(project,'scripts/git-compat/package.ps1'),GIT_COMPAT_ZIP_SOURCE:source,GIT_COMPAT_ZIP_DESTINATION:zip,GIT_COMPAT_ZIP_CHECK:check}});
  let failure,proof;
  try{
    const source=path.join(fixture.root,'source'),deep=extend(path.join(source,'nested'),350),emptyDirectory=path.join(deep,'empty directory');
    fs.mkdirSync(emptyDirectory,{recursive:true});const unicode=path.join(deep,'ação 東京.txt'),emptyFile=path.join(deep,'empty file.txt');
    fs.writeFileSync(unicode,'synthetic long-path bytes: ação 東京\n');fs.writeFileSync(emptyFile,'');
    const link=relative(source,unicode).split('/').map(encodeURIComponent).join('/'),report=path.join(source,'REPORT.md');fs.writeFileSync(report,'# Synthetic report\n\n[proof]('+link+')\n');
    const manifest=[report,unicode,emptyFile].map(p=>({path:relative(source,p),bytes:fs.statSync(p).size,sha256:fileHash(p)}));
    const outputParent=extend(path.join(fixture.root,'zip-output'),315);fs.mkdirSync(outputParent,{recursive:true});
    const zip=path.join(outputParent,'long archive.zip'),check=extend(path.join(fixture.root,'reopened'),325);
    const execution=await invoke(source,zip,check);
    if(evidenceRoot){fs.writeFileSync(path.join(evidenceRoot,'powershell.stdout.raw'),execution.stdoutBuffer);fs.writeFileSync(path.join(evidenceRoot,'powershell.stderr.raw'),execution.stderrBuffer);fs.copyFileSync(zip,path.join(evidenceRoot,'synthetic-long.zip'),fs.constants.COPYFILE_EXCL);}
    for(const f of manifest)c.eq('Reopened long file hash '+f.path,fileHash(path.join(check,f.path)),f.sha256);
    c.ok('Long empty directory retained',fs.statSync(path.join(check,relative(source,emptyDirectory))).isDirectory());
    c.ok('Long relative report link resolves',fs.existsSync(path.resolve(check,decodeURIComponent(link))));
    const raw=inspectZipNames(zip);c.ok('Raw central/local names match and contain no backslash',raw.entries.every(e=>e.name_hex===e.local_name_hex&&!e.contains_backslash));
    c.ok('Unicode raw entry has UTF8 flag',raw.entries.some(e=>e.name.endsWith('ação 東京.txt')&&e.utf8));
    c.eq('ZIP file hierarchy is exact',raw.entries.filter(e=>!e.directory).map(e=>e.name).sort(),manifest.map(f=>f.path).sort());
    const archiveHash=fileHash(zip);await invoke(source,zip,path.join(fixture.root,'unused-check'),[1]);c.eq('Existing long ZIP retained',fileHash(zip),archiveHash);
    const refused=path.join(outputParent,'must-not-create.zip');await invoke(source,refused,check,[1]);c.eq('Existing long extraction refused before ZIP creation',fs.existsSync(refused),false);
    const topSource=extend(path.join(fixture.root,'top-source'),325);fs.mkdirSync(topSource,{recursive:true});fs.writeFileSync(path.join(topSource,'proof.txt'),'top source longer than MAX_PATH\n');
    const topCheck=extend(path.join(fixture.root,'top-reopened'),325),topZip=path.join(outputParent,'top-source.zip');await invoke(topSource,topZip,topCheck);c.eq('Top-level long source hash retained',fileHash(path.join(topSource,'proof.txt')),fileHash(path.join(topCheck,'proof.txt')));
    const lengths={source_file:unicode.length,source_root:topSource.length,zip:zip.length,extraction_root:check.length,extracted_file:path.join(check,relative(source,unicode)).length};
    c.ok('All tested long path dimensions exceed 303 characters',Object.values(lengths).every(n=>n>=303));
    assert.equal(execution.outputTruncated,false);assert.equal(execution.timedOut,false);
    proof={status:'PASS',lengths,manifest,raw_directory:raw,package_sha256:fileHash(path.join(project,'scripts/git-compat/package.ps1')),cwd_policy:'Only fixture cwd; no process spawned with long cwd',global_policy_changed:false};
  }catch(error){failure=error;throw error;}
  finally{
    if(evidenceRoot){json(path.join(evidenceRoot,'proof.json'),{...(proof??{status:'FAIL'}),error:failure?.stack,assertions:c.assertions,commands:c.commands,scope:'Real Windows PowerShell/.NET ZIP I/O; synthetic owned files; no Git/product/network execution'});console.log('ZIP_LONG_EVIDENCE='+relative(project,evidenceRoot));}
    cleanupFixture(fixture);
  }
});
