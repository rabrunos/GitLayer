import fs from 'node:fs';
import path from 'node:path';
import { loadCases } from './runner.mjs';
import { context,json,walk,fileHash,relative,validateResult,applyOutcome } from './lib.mjs';
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const c=context(config), result=config.result;
result.started_at=new Date().toISOString();const start=Date.now();
try {
  const item=(await loadCases([config.module],{matrix:config.matrix})).find(c=>c.id+'/'+c.variant===config.caseKey);
  if (item.expectation) json(path.join(config.artifactDir, 'runtime-expectation.json'), item.expectation);
  await c.snapshot('before');
  const outcome=await item.run(c);
  applyOutcome(result,outcome);
  await c.snapshot('after');
  if(outcome?.execution_status==='ENV_BLOCKED') {
    if(!outcome.nonexecution_reason || !c.commands.length)throw Error('ENV_BLOCKED requires an actual capability probe and reason');
    result.execution_status='ENV_BLOCKED';result.product_status='NOT_ASSESSED';
  } else {
    if(!c.assertions.length) throw Error('Executable case supplied no assertions');
    result.execution_status='PASS';result.nonexecution_reason=null;
  }
} catch(error) {
  result.execution_status='FAIL';result.nonexecution_reason=null;
  result.failure_category=error.code==='ERR_ASSERTION'?'ASSERTION':'INFRASTRUCTURE_OR_PRODUCT';
  result.error=String(error.stack??error).replaceAll(config.root,'<FIXTURE>');
  if(result.product_status==='VERIFIED_SUPPORTED')result.product_status='TEST_GAP';
  try {await c.snapshot('after-failure');}catch(e){result.limits.push('Failure snapshot: '+e.message);}
}
result.ended_at=new Date().toISOString();result.duration_ms=Date.now()-start;
result.commands=c.commands;result.assertions=c.assertions;
result.evidence=walk(config.artifactDir).filter(p=>path.basename(p)!=='result.json').map(p=>({path:relative(config.packageRoot,p),sha256:fileHash(p),bytes:fs.statSync(p).size}));
json(path.join(config.artifactDir,'result.json'),result);
try {validateResult(result,config.packageRoot);}catch(e){result.execution_status='FAIL';result.product_status='TEST_GAP';result.validation_error=e.message;json(path.join(config.artifactDir,'result.json'),result);}
process.exitCode=result.execution_status==='FAIL'?1:0;
