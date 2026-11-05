import test from 'node:test';
import path from 'node:path';
import {project,createFixture,cleanupFixture,isolatedEnvironment,resolveGit,context,json} from '../../../scripts/git-compat/lib.mjs';
import {exerciseZipPortability} from './zip-portability.mjs';
import {externalFixtureParent} from '../../../scripts/git-compat/fixture-parent.mjs';

test('R-04 real Windows ZIP names, standard reader, Unicode/empty entries and safety controls',{skip:process.platform!=='win32',timeout:90000},async()=>{
  const id='z-'+new Date().toISOString().replace(/[:.]/gu,'-'),parent=path.join(project,'.workshop/git-compat',id),fixture=createFixture(externalFixtureParent(project),'zip');
  const artifactDir=path.join(parent,'evidence'),gitPath=resolveGit(),env=isolatedEnvironment(fixture.root,gitPath),c=context({root:fixture.root,repo:path.join(fixture.root,'unused-repo'),gitPath,env,artifactDir,packageRoot:parent,fixture});
  let error,outcome;try{outcome=await exerciseZipPortability(c);}catch(e){error=e;throw e;}finally{
    json(path.join(artifactDir,'unit-result.json'),{status:error?'FAIL':'PASS',error:error?.stack,outcome,assertions:c.assertions,commands:c.commands});cleanupFixture(fixture);console.log('ZIP_EVIDENCE='+path.relative(project,parent).replaceAll('\\','/'));
  }
});
