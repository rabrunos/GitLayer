import { createHash } from 'node:crypto';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f\d]{64}$/iu.test(value);
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,''));
const domain = name => /^(?:src\/|tests\/(?:unit|integration)\/)/u.test(name) || ['package.json','package-lock.json','tsconfig.json'].includes(name);
function relativePath(value) {
 if(typeof value !== 'string'||!value||value.startsWith('/')||value.includes('\\')||value.includes(':')||value.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Closure evidence path must be a safe relative path');
 return value;
}
export function normalizeClosureManifest(manifest,{domainOnly=false}={}) {
 if(!Array.isArray(manifest)||!manifest.length)throw Error('Missing nonempty source manifest');
 const seen=new Set();return manifest.filter(file=>!domainOnly||domain(file.path)).map(file=>{
  const name=relativePath(file.path),bytes=file.bytes??file.size;
  if(seen.has(name)||!Number.isSafeInteger(bytes)||bytes<0||!sha(file.sha256))throw Error('Invalid/duplicate source manifest entry: '+name);
  seen.add(name);return {path:name,bytes,sha256:file.sha256.toLowerCase()};
 }).sort((a,b)=>a.path.localeCompare(b.path));
}
function difference(before,after) {
 const a=new Map(before.map(file=>[file.path,file])),b=new Map(after.map(file=>[file.path,file]));
 return [...new Set([...a.keys(),...b.keys()])].sort().flatMap(name=>a.get(name)?.sha256===b.get(name)?.sha256&&a.get(name)?.bytes===b.get(name)?.bytes?[]:[{path:name,kind:!a.has(name)?'added':!b.has(name)?'removed':'modified',before:a.get(name)??null,after:b.get(name)??null}]);
}
/** Verifies closure provenance only. It neither executes Git/product nor certifies product support. */
export function validateImplementationClosure({requirements,finalEvidence,currentSources,readReference,requirementsSha256,reportSha256}) {
 const rows=requirements.requirements??requirements.requisitos;
 if(!Array.isArray(rows)||rows.length!==27)throw Error('REQUIREMENTS must contain exactly 27 requirements');
 const references=[];
 const reference=(value,label)=>{
  if(!value||typeof value!=='object'||!sha(value.sha256))throw Error(label+' requires path and SHA-256');
  const name=relativePath(value.path),bytes=readReference(name),actual=digest(bytes);
  if(actual!==value.sha256.toLowerCase())throw Error(label+' hash differs: '+name);
  references.push({path:name,sha256:actual,bytes:bytes.length});return bytes;
 };
 const identifiers=new Set();
 const statuses=new Set(['IMPLEMENTED','PARTIAL','NOT-IMPLEMENTED','NOT_IMPLEMENTED','IMPLEMENTADO','IMPLEMENTADA','PARCIAL','NAO_IMPLEMENTADO','NÃO_IMPLEMENTADO','NAO_IMPLEMENTADA','NÃO_IMPLEMENTADA']);
 for(const row of rows){
  const id=row.id??row.requirement_id;
  if(typeof id!=='string'||!/^GL-\d{2}$/u.test(id)||Number(id.slice(3))<1||Number(id.slice(3))>27||identifiers.has(id))throw Error('Missing/duplicate/invalid GL requirement ID');
  identifiers.add(id);const status=String(row.status??row.implementationStatus??'').toUpperCase();
  if(!statuses.has(status))throw Error('Unclosed/unknown requirement status: '+id+' '+status);
  if(status!=='IMPLEMENTED'&&!['IMPLEMENTADO','IMPLEMENTADA'].includes(status)&&(!Array.isArray(row.limitations)||!row.limitations.length))throw Error('Partial/unimplemented requirement needs explicit limitations: '+id);
  const evidence=row.evidence??row.evidencias;
  if(!Array.isArray(evidence)||!evidence.length)throw Error('Requirement has no hashed evidence: '+id);
  for(const entry of evidence)reference(entry,'Requirement '+id);
 }
 if(String(finalEvidence.status).toLowerCase()!=='closed')throw Error('FINAL-EVIDENCE status must be closed');
 if(finalEvidence.requirementsSha256&&finalEvidence.requirementsSha256.toLowerCase()!==requirementsSha256)throw Error('FINAL-EVIDENCE requirements hash differs');
 if(finalEvidence.reportSha256&&finalEvidence.reportSha256.toLowerCase()!==reportSha256)throw Error('FINAL-EVIDENCE report hash differs');
 const expected=normalizeClosureManifest(currentSources,{domainOnly:true}),final=normalizeClosureManifest(finalEvidence.sourceManifest);
 if(!expected.length||JSON.stringify(expected)!==JSON.stringify(final))throw Error('FINAL-EVIDENCE source manifest differs from the current product/test domain');
 if(!Array.isArray(finalEvidence.tests)||!finalEvidence.tests.length)throw Error('FINAL-EVIDENCE has no terminal test executions');
 const tests=finalEvidence.tests.map(entry=>{
  if(typeof entry.command!=='string'||!entry.command.trim()||!Number.isInteger(entry.exitCode))throw Error('Test requires command and terminal exitCode');
  if(!['previous-full-suite','previous-focused','current-focused','current-typecheck'].includes(entry.sourceCoverage))throw Error('Unknown test source coverage');
  const artifact=parse(reference(entry.artifact,'Test artifact'));
  if((artifact.code??artifact.exitCode??artifact.exit_code)!==entry.exitCode)throw Error('Declared test exit differs from terminal artifact');
  if(artifact.command&&artifact.command!==entry.command)throw Error('Declared command differs from terminal artifact');
  const manifestRef=entry.sourceManifest??{path:entry.sourceManifestPath,sha256:entry.sourceManifestSha256};
  if(entry.sourceManifestSha256&&manifestRef.sha256?.toLowerCase()!==entry.sourceManifestSha256.toLowerCase())throw Error('Test manifest SHA declarations disagree');
  const rawManifest=parse(reference(manifestRef,'Test source manifest')),normalized=normalizeClosureManifest(rawManifest);
  const snapshotPrefix=manifestRef.path.includes('/')?manifestRef.path.slice(0,manifestRef.path.lastIndexOf('/')+1):'';
  for(const file of normalized){const archived=reference({path:snapshotPrefix+'source/'+file.path,sha256:file.sha256},'Archived test source');if(archived.length!==file.bytes)throw Error('Archived test source size differs: '+file.path);}
  const fingerprint=digest(JSON.stringify(rawManifest));
  if(artifact.sourceUnchanged!==true||artifact.before!==fingerprint||artifact.after!==fingerprint)throw Error('Test did not finish with the declared stable source fingerprint');
  if(!Array.isArray(rawManifest)||normalized.some(file=>!domain(file.path)))throw Error('Test source manifest contains paths outside the declared product/test domain');
  const delta=difference(normalized,final),matchesFinal=delta.length===0;
  if(entry.sourceCoverage.startsWith('current-')&&!matchesFinal)throw Error('Current test source snapshot differs from final sources');
  const typecheck=/typecheck/iu.test(entry.command);
  if(entry.sourceCoverage==='current-typecheck'&&!typecheck)throw Error('current-typecheck must identify the typecheck command');
  return {command:entry.command,exitCode:entry.exitCode,sourceCoverage:entry.sourceCoverage,artifact:entry.artifact,sourceManifest:manifestRef,sourceFingerprint:fingerprint,matchesFinal,typecheck,changesAfterThisSnapshot:delta};
 });
 if(!tests.some(test=>test.sourceCoverage.startsWith('current-')&&test.typecheck))throw Error('Missing current-snapshot terminal typecheck');
 if(!tests.some(test=>test.sourceCoverage==='current-focused'&&!test.typecheck))throw Error('Missing current-snapshot focused regression execution');
 if(!tests.some(test=>test.sourceCoverage==='previous-full-suite'))throw Error('Missing explicitly labelled full-suite execution');
 return {schema:1,scope:'Traceability and closure validation only; not an assertion that all requirements or tests pass.',requirements:rows.map(row=>({id:row.id??row.requirement_id,status:row.status??row.implementationStatus})),requirementsSha256,reportSha256,sourceDomain:'src/**; tests/unit/**; tests/integration/**; package.json; package-lock.json; tsconfig.json',sourceManifest:final,tests,currentFullSuite:tests.some(test=>test.sourceCoverage==='previous-full-suite'&&test.matchesFinal),currentFocusedAllExitZero:tests.filter(test=>test.sourceCoverage.startsWith('current-')).every(test=>test.exitCode===0),references:[...new Map(references.map(ref=>[ref.path,ref])).values()].sort((a,b)=>a.path.localeCompare(b.path))};
}

/** Original catalog bytes are immutable; the working matrix may add IDs. Counts are derived from rows. */
export function validateScenarioPreservation({originalBytes,baselineOriginalBytes,workingBytes,expectedOriginalCount=344}) {
 const originalHash=digest(originalBytes),baselineHash=digest(baselineOriginalBytes);
 if(originalHash!==baselineHash)throw Error('Original scenario reference differs from the initial local baseline bytes');
 const original=parse(originalBytes),working=parse(workingBytes);
 const rows=value=>Array.isArray(value)?value:value.scenarios;
 const originalRows=rows(original),workingRows=rows(working);
 const ids=(value,label)=>{if(!Array.isArray(value)||!value.length)throw Error(label+' requires nonempty scenario rows');const names=value.map(row=>row.id);if(names.some(id=>typeof id!=='string'||!id.trim())||new Set(names).size!==names.length)throw Error(label+' has duplicate/invalid scenario IDs');return names;};
 const originalIds=ids(originalRows,'Original reference'),workingIds=ids(workingRows,'Working matrix');
 if(originalIds.length!==expectedOriginalCount)throw Error('Original reference count differs from the received catalog protocol');
 if(!Array.isArray(original)&&original.scenario_count!==undefined&&original.scenario_count!==originalRows.length)throw Error('Original declared scenario count differs from rows');
 if(!Array.isArray(working)&&working.scenario_count!==undefined&&working.scenario_count!==workingRows.length)throw Error('Working declared scenario count differs from rows');
 const workingSet=new Set(workingIds),originalSet=new Set(originalIds),missing=originalIds.filter(id=>!workingSet.has(id));
 if(missing.length)throw Error('Working matrix lost original scenario IDs: '+missing.join(','));
 const byScope=value=>value.reduce((counts,row)=>{const scope=row.scope??'UNSPECIFIED';counts[scope]=(counts[scope]??0)+1;return counts;},{});
 return {schema:1,scope:'Catalog preservation and calculated inventory only; no assertion of scenario implementation, execution or product support.',original:{sha256:originalHash,baselineSha256:baselineHash,bytes:originalBytes.length,count:originalRows.length,ids:originalIds,byScope:byScope(originalRows)},working:{sha256:digest(workingBytes),bytes:workingBytes.length,count:workingRows.length,ids:workingIds,byScope:byScope(workingRows),addedIds:workingIds.filter(id=>!originalSet.has(id))},originalBytesPreserved:true,allOriginalIdsPresent:true};
}

/** Normalize only no-rename no-index diff metadata. Never rewrite hunk or binary payload bytes. */
export function normalizeImplementationPatch(patch) {
 const splitPath=(token,side)=>{const quoted=token.startsWith('"');if(quoted&&!token.endsWith('"'))return null;const value=quoted?token.slice(1,-1):token,match=value.match(new RegExp('^'+side+'/(?:baseline/before|source)/(.+)$','u'));return match?{tail:match[1],normalized:(quoted?'"':'')+side+'/'+match[1]+(quoted?'"':'')}:null;};
 let payload=false;
 return patch.split(/(?<=\n)/u).map(line=>{
  if(line.startsWith('diff --git ')){
   payload=false;const ending=line.match(/\r?\n$/u)?.[0]??'',body=line.slice('diff --git '.length,ending?-ending.length:undefined),candidates=[];
   for(const match of body.matchAll(/ (?="?b\/(?:baseline\/before|source)\/)/gu)){const left=splitPath(body.slice(0,match.index),'a'),right=splitPath(body.slice(match.index+1),'b');if(left&&right&&left.tail===right.tail)candidates.push([left.normalized,right.normalized]);}
   if(candidates.length!==1)throw Error('Unrecognized/ambiguous no-rename diff metadata; refusing to publish a modified patch');
   return 'diff --git '+candidates[0].join(' ')+ending;
  }
  if(line.startsWith('@@ ')||line.startsWith('GIT binary patch'))payload=true;
  if(!payload&&/^(?:---|\+\+\+) /u.test(line))return line.replace(/^((?:---|\+\+\+) "?[ab]\/)(?:baseline\/before|source)\//u,'$1');
  return line;
 }).join('');
}
