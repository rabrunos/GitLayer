import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateDocumentation,writeDocumentationResult,docsOptions} from '../../../scripts/git-compat/docs.mjs';
import {createFixture,cleanupFixture,project} from '../../../scripts/git-compat/lib.mjs';
import {validateOutputRoot} from '../../../scripts/git-compat/output-root.mjs';
import {externalFixtureParent} from '../../../scripts/git-compat/fixture-parent.mjs';

const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('documentation validator: fourteen independent positive and negative controls',{timeout:60000},async t=>{
  const evidenceParent=process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT;
  let evidenceRoot;
  if(evidenceParent){
    if(!path.isAbsolute(evidenceParent))throw Error('GIT_COMPAT_INFRA_EVIDENCE_ROOT must be absolute');
    const parent=validateOutputRoot(evidenceParent,{projectRoot:project});
    fs.mkdirSync(parent,{recursive:true});
    evidenceRoot=path.join(parent,'docs-controls-'+crypto.randomUUID());fs.mkdirSync(evidenceRoot);
  }
  const fixture=createFixture(externalFixtureParent(project),'docs'),root=fixture.root,records=[];
  const historical=path.join(project,'docs/git-compat/DOCUMENTATION-VALIDATION.json'),historicalHash=hash(historical);
  try{
    const initial=validateDocumentation(),targets=new Set([...initial.input_manifest.map(f=>f.path),...initial.links.filter(l=>l.passed).map(l=>l.resolved)]);
    for(const rel of targets){
      const from=path.join(project,rel),to=path.join(root,rel);
      if(fs.statSync(from).isDirectory())fs.mkdirSync(to,{recursive:true});
      else{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
    }
    const validate=()=>validateDocumentation({root}),matrix=path.join(root,'tests/git-compat/scenarios.json'),matrixBytes=fs.readFileSync(matrix),matrixDoc=JSON.parse(matrixBytes),scenarios=Array.isArray(matrixDoc)?matrixDoc:matrixDoc.scenarios;
    const writeMatrix=()=>fs.writeFileSync(matrix,JSON.stringify(matrixDoc));
    const reference=path.join(root,'docs/git-compat/reference/05-Prompt-Codex.md'),referenceBytes=fs.readFileSync(reference);
    const controls=path.join(root,'docs/git-compat/validator-controls.md');
    fs.writeFileSync(path.join(root,'docs/git-compat/arquivo espaço.txt'),'synthetic text\n');
    const controlText='# Repetido\n\n# Repetido\n\n[segundo](#repetido-1)\n[unicode](arquivo%20espa%C3%A7o.txt)\n[ângulo](<arquivo espaço.txt>)\n[referência][alvo]\n[alvo]: arquivo%20espa%C3%A7o.txt\n\n`[ignorado](nao-existe.md)`\n\n```text\n[fenced](nao-existe.md)\n```\n';
    async function control(name,expected,exercise){
      await t.test(name,()=>{
        let observed;
        try{observed=exercise();assert.deepEqual(observed,expected);records.push({name,expected,observed,status:'PASS'});}
        catch(error){records.push({name,expected,observed:observed??null,status:'FAIL',error:error.message});throw error;}
      });
    }
    await control('baseline and historical AGENTS root context',{status:'PASS',historical_context:true},()=>{const r=validate();return{status:r.status,historical_context:r.links.some(l=>l.context==='historical-project-root')};});
    await control('new scenario ID accepted','PASS',()=>{try{scenarios.push({...scenarios[0],id:'HARNESS-999991'});writeMatrix();return validate().status;}finally{scenarios.pop();fs.writeFileSync(matrix,matrixBytes);}});
    await control('original scenario removal rejected',false,()=>{const first=scenarios.shift();try{writeMatrix();return validate().assertions.find(a=>a.id==='original-ids-preserved-in-extensible-matrix').passed;}finally{scenarios.unshift(first);fs.writeFileSync(matrix,matrixBytes);}});
    await control('duplicate scenario ID rejected',false,()=>{try{scenarios.push(scenarios[0]);writeMatrix();return validate().assertions.find(a=>a.id==='working-matrix-ids-valid-unique').passed;}finally{scenarios.pop();fs.writeFileSync(matrix,matrixBytes);}});
    await control('changed original reference rejected',false,()=>{try{fs.appendFileSync(reference,'\n');return validate().assertions.find(a=>a.id==='original-reference-19-byte-preserved').passed;}finally{fs.writeFileSync(reference,referenceBytes);}});
    await control('duplicate headings, Unicode spaces, references and code controls','PASS',()=>{fs.writeFileSync(controls,controlText);return validate().status;});
    await control('broken local link rejected','FAIL',()=>{try{fs.writeFileSync(controls,controlText+'\n[quebrado](arquivo-ausente.md)\n');return validate().status;}finally{fs.writeFileSync(controls,controlText);}});
    await control('missing Markdown anchor rejected','FAIL',()=>{try{fs.writeFileSync(controls,controlText.replace('#repetido-1','#ancora-ausente'));return validate().status;}finally{fs.writeFileSync(controls,controlText);}});
    await control('absolute and escaping links rejected',2,()=>{try{fs.writeFileSync(controls,controlText+'\n[absolute](C:/outside.md)\n[escape](../../../outside.md)\n');return validate().links.filter(l=>!l.passed).length;}finally{fs.writeFileSync(controls,controlText);}});
    await control('unclosed fence rejected',false,()=>{try{fs.writeFileSync(controls,controlText+'\n~~~\n');return validate().assertions.find(a=>a.id==='closed-markdown-fences').passed;}finally{fs.writeFileSync(controls,controlText);}});
    await control('new output succeeds; existing output and linked parent preserved',{refused:true,unchanged:true,linked_refused:true,linked_output_absent:true},()=>{
      const out=path.join(root,'docs-output.json');writeDocumentationResult(out,{synthetic:true});const before=hash(out);let refused=false,linkedRefused=false;
      try{writeDocumentationResult(out,{synthetic:false});}catch(error){refused=/new path/u.test(error.message);}
      const target=path.join(root,'output-target'),link=path.join(root,'linked-output');fs.mkdirSync(target);fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
      try{writeDocumentationResult(path.join(link,'must-not-exist.json'),{synthetic:true});}catch(error){linkedRefused=error.code==='OUTPUT_ROOT_INVALID';}finally{fs.unlinkSync(link);}
      return{refused,unchanged:hash(out)===before,linked_refused:linkedRefused,linked_output_absent:!fs.existsSync(path.join(target,'must-not-exist.json'))};
    });
    await control('historical output path refused',true,()=>{try{writeDocumentationResult(historical,{synthetic:false});return false;}catch(error){return error.code==='OUTPUT_ROOT_INVALID'||/outside documentation/u.test(error.message);}});
    await control('invalid or repeated options rejected',{refused:3,valid:{out:'a'}},()=>{let refused=0;for(const args of [['--unknown'],['--out'],['--out','a','--out','b']])try{docsOptions(args);}catch{refused++;}return{refused,valid:docsOptions(['--out','a'])};});
    await control('restored fixture and historical audit unchanged',{status:'PASS',unchanged:true},()=>({status:validate().status,unchanged:hash(historical)===historicalHash}));
    assert.equal(records.length,14);
  }finally{
    if(evidenceRoot){fs.writeFileSync(path.join(evidenceRoot,'controls.json'),JSON.stringify({role:'Synthetic documentation-validator controls; no Git, network or product execution',status:records.length===14&&records.every(r=>r.status==='PASS')?'PASS':'FAIL',historical_audit_sha256:historicalHash,controls:records},null,2)+'\n',{flag:'wx'});console.log('DOCS_EVIDENCE='+path.relative(project,evidenceRoot).replaceAll('\\','/'));}
    cleanupFixture(fixture);
  }
});
