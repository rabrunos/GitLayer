import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { resolveReportPhase, phaseReportText } from '../../../scripts/git-compat/report-phase.mjs';
import { generateReport } from '../../../scripts/git-compat/report.mjs';
import { baseResult, counts } from '../../../scripts/git-compat/runner.mjs';
import { createFixture, cleanupFixture, isolatedEnvironment, project, json, fileHash, relative } from '../../../scripts/git-compat/lib.mjs';
import { fileManifest, manifestFingerprint } from '../../../scripts/git-compat/audit.mjs';

const recipe = 'source/tests/git-compat/cases/implementation.mjs';
const selected = [{ selection_status: 'SELECTED', execution_status: 'FAIL', product_status: 'PRODUCT_GAP', reproduction: { fixture_recipe_path: recipe } }];
test('report phase keeps historical context and boilerplate as the default', () => {
  for (const context of [{}, { operation:'review', sections:[] }, { phase:'infrastructure-review-2026-10-19' }]) {
    const phase=resolveReportPhase(context, []), text=phaseReportText(phase);
    assert.equal(phase.implementation,false); assert.equal(text.scope,'');
    assert.equal(text.findingsIntro,'Nenhuma correção de produto nesta rodada.');
    assert.match(text.defects,/Não foram corrigidos Core\/CLI\/desktop/u);
    assert.match(text.findingNext,/apenas em tarefa autorizada/u);
  }
});
test('explicit implementation separates user authorization from technical choices without approving results', () => {
  const context={ operation:{ phase:'implementation-2026-11-02', user_authorization:'Synthetic authorization declaration', technical_choices:['Synthetic engineering choice'] } };
  const before=structuredClone({context,selected}), phase=resolveReportPhase(context,selected), text=phaseReportText(phase);
  assert.equal(phase.id,'implementation-2026-11-02'); assert.equal(phase.source,'explicit-context');
  assert.match(text.scope,/Declaração de autorização do usuário/u); assert.match(text.scope,/Escolhas técnicas do Codex/u);
  assert.match(text.scope,/não são novos requisitos aprovados/u); assert.match(text.defects,/MODEL-008 continua não exaustivo/u);
  assert.doesNotMatch(Object.values(text).join('\n'),/Não foram corrigidos|Nenhuma correção de produto|corrigir o produto apenas/u);
  assert.deepEqual({context,selected},before); assert.equal(selected[0].execution_status,'FAIL');
});
test('only a selected frozen implementation recipe selects the implementation prose automatically', () => {
  const inferred=resolveReportPhase({},selected); assert.equal(inferred.source,'selected-frozen-implementation-recipe'); assert.equal(inferred.implementation,true);
  for (const variants of [[{...selected[0],selection_status:'NOT_SELECTED'}],[{...selected[0],reproduction:{fixture_recipe_path:recipe+'.backup'}}],[]]) assert.equal(resolveReportPhase({},variants).implementation,false);
  for (const context of [{phase:'implementation-2026-11-02'},{fase:'implementation-2026-11-02'},{operation:'implementation-2026-11-02'},{operation:{fase:'implementation-2026-11-02'}}]) assert.equal(resolveReportPhase(context).implementation,true);
});
test('unknown, contradictory or malformed phase declarations fail instead of silently changing scope', () => {
  for (const [context,results] of [[{phase:'future-unapproved'},[]],[{phase:null},[]],[{phase:'implementation-2026-11-02',fase:'legacy-validation-v2'},[]],[{phase:'legacy-validation-v2'},selected],[{operation:{phase:'implementation-2026-11-02',technical_choices:'not an array'}},[]],[{user_authorization:''},[]]]) assert.throws(()=>resolveReportPhase(context,results));
});

function syntheticRun(t, implementation) {
  const owned=createFixture(os.tmpdir(),'gitlayer-report-phase'); t.after(()=>cleanupFixture(owned));
  const root=path.join(owned.root,'archive'), id='run-synthetic-'+randomUUID(), runDir=path.join(root,'runs',id), source=path.join(runDir,'source');
  const document=JSON.parse(fs.readFileSync(path.join(project,'tests/git-compat/scenarios.json'),'utf8')), matrix=document.scenarios??document;
  const put=(name,data)=>{const file=path.join(source,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
  put('src/synthetic.ts','// SYNTHETIC RENDERER CONTROL. Never executed as product.\n');
  put('tests/git-compat/scenarios.json',JSON.stringify(document)); put('tests/git-compat/known-issues.json',JSON.stringify({version:1,issues:[]}));
  put('docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json',fs.readFileSync(path.join(project,'docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json')));
  put('docs/git-compat/README.md','# Synthetic renderer control\nNo product or Git executed.\n');
  const product=fileManifest(source,['src']), runner=fileManifest(source,['tests','docs']), sourceFingerprint=manifestFingerprint(product), runnerFingerprint=manifestFingerprint(runner);
  const baseline={schema_version:'3.0',captured_at:new Date().toISOString(),product,runner,repository:{},policy:'Synthetic phase renderer, no product or Git process'};
  json(path.join(runDir,'baseline-before.json'),baseline);json(path.join(runDir,'baseline-after.json'),baseline);json(path.join(runDir,'source-manifest.json'),fileManifest(source,['src','tests','docs']));
  json(path.join(runDir,'matrix.json'),{scenarios:matrix});json(path.join(runDir,'known-issues.json'),{version:1,issues:[]});json(path.join(runDir,'environment.json'),{role:'SYNTHETIC_INFRASTRUCTURE_CONTROL_NOT_PRODUCT'});
  const info={id,seed:'synthetic-phase',sourceFingerprint,runnerFingerprint}, results=matrix.map(item=>baseResult(item,null,info));
  const result=baseResult(matrix[0],{variant:'synthetic-phase',phase:'HARNESS',module:implementation?'implementation':'fixture'},info);
  const evidenceFile=path.join(runDir,'evidence/control.txt');fs.mkdirSync(path.dirname(evidenceFile),{recursive:true});fs.writeFileSync(evidenceFile,'synthetic renderer evidence\n');
  Object.assign(result,{selection_status:'SELECTED',execution_status:'PASS',product_status:'NOT_ASSESSED',environment_path:relative(root,path.join(runDir,'environment.json')),started_at:baseline.captured_at,ended_at:baseline.captured_at,duration_ms:1,nonexecution_reason:null,assertions:[{id:'synthetic-renderer-phase',expected:'A',observed:'A',passed:true,evidence_paths:[],contract_source:'Synthetic rendering control'}],evidence:[{path:relative(root,evidenceFile),sha256:fileHash(evidenceFile),bytes:fs.statSync(evidenceFile).size}],findings:[{id:'SYNTHETIC-PHASE',classification:'HARNESS_CONTROL',condition:'Synthetic prose rendering only',expected:'phase aware prose',observed:'phase aware prose',confidence:'control',source:'Synthetic report phase test'}]});
  results[0]=result;json(path.join(runDir,'results.json'),results);json(path.join(runDir,'selection.json'),{selected:[result.scenario_id+'/'+result.variant_id]});
  const summary={schema_version:'3.0',id,outcome:'SELECTED',started_at:baseline.captured_at,ended_at:baseline.captured_at,duration_ms:1,sourceFingerprint,runnerFingerprint,runnerFingerprintEnd:runnerFingerprint,source_unchanged:true,runner_unchanged:true,productDelta:{added:[],removed:[],changed:[]},runnerDelta:{added:[],removed:[],changed:[]},options:{jobs:1,suite:'harness',seed:'synthetic-phase'},counts:counts(results),selected:1,worker_processes:1,matrix_input:'tests/git-compat/scenarios.json',exit_code:0};
  json(path.join(runDir,'summary.json'),summary);
  return {owned,root,runDir,results,summary,out:path.join(owned.root,'new-report')};
}
test('real renderer ZIP uses phase aware prose and preserves historical default in independent synthetic runs', {timeout:90000}, async t => {
  for (const implementation of [false,true]) {
    const f=syntheticRun(t,implementation), before=structuredClone({summary:f.summary,results:f.results});
    const validation=await generateReport({'run-dir':f.runDir,out:f.out,title:'Synthetic phase renderer control — no product execution'});
    assert.equal(validation.all_hashes_verified,true);assert.equal(validation.relative_entry_links_verified,true);
    const report=fs.readFileSync(path.join(f.out,'RELATORIO-TECNICO.md'),'utf8'), findings=fs.readFileSync(path.join(f.out,'ACHADOS.md'),'utf8');
    if(implementation){assert.match(report,/Implementação do produto de 02\/11\/2026/u);assert.doesNotMatch(report+findings,/Não foram corrigidos Core\/CLI\/desktop|Nenhuma correção de produto nesta rodada|corrigir o produto apenas em tarefa autorizada/u);}
    else{assert.match(report,/Não foram corrigidos Core\/CLI\/desktop/u);assert.match(findings,/Nenhuma correção de produto nesta rodada/u);}
    assert.deepEqual({summary:JSON.parse(fs.readFileSync(path.join(f.runDir,'summary.json'),'utf8')),results:JSON.parse(fs.readFileSync(path.join(f.runDir,'results.json'),'utf8'))},before);
  }
});
