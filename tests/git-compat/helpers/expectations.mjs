import { createHash } from 'node:crypto';

function canonical(value) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value)) {
    if(Object.getPrototypeOf(value)!==Array.prototype||Object.getOwnPropertySymbols(value).length||Object.getOwnPropertyNames(value).length!==value.length+1||Array.from({length:value.length},(_,index)=>index).some(index=>!Object.hasOwn(value,index)||Object.getOwnPropertyDescriptor(value,index).get))throw Error('Expectation values must be complete finite JSON data');
    return '['+value.map(canonical).join(',')+']';
  }
  if(typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value))) {
    if(Object.getOwnPropertySymbols(value).length||Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor=>descriptor.get||descriptor.set||!descriptor.enumerable))throw Error('Expectation values must be complete finite JSON data');
    return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  }
  throw Error('Expectation values must be complete finite JSON data');
}
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const equal=(a,b)=>canonical(a)===canonical(b);
export const expectationFingerprint=spec=>createHash('sha256').update(canonical(spec)).digest('hex');
export function validateExpectation(spec,{previous}={}) {
  if(!plain(spec)||spec.schema_version!==1||typeof spec.id!=='string'||!spec.id||!Number.isInteger(spec.revision)||spec.revision<1||typeof spec.reason!=='string'||!spec.reason.trim()||!plain(spec.desired)||!Object.keys(spec.desired).length||!Array.isArray(spec.known_gaps))throw Error('Malformed versioned expectation');
  canonical(spec);
  const issues=new Set();
  for(const gap of spec.known_gaps) {
    if(!plain(gap)||typeof gap.issue_id!=='string'||!gap.issue_id||issues.has(gap.issue_id)||!plain(gap.environment)||!Object.keys(gap.environment).length||!plain(gap.observation)||!Object.keys(gap.observation).length)throw Error('Malformed strict gap observation');
    issues.add(gap.issue_id);
    if(equal(gap.observation,spec.desired))throw Error('A known gap cannot also be the desired result');
  }
  if(spec.revision===1&&spec.supersedes!==undefined)throw Error('Initial expectation cannot supersede a previous revision');
  if(spec.revision>1) {
    if(!plain(spec.supersedes)||!Number.isInteger(spec.supersedes.revision)||spec.supersedes.revision<1||spec.supersedes.revision>=spec.revision||!/^[a-f0-9]{64}$/.test(spec.supersedes.sha256??''))throw Error('An expectation change must retain its previous revision and fingerprint');
    if(previous&&(previous.id!==spec.id||previous.revision!==spec.supersedes.revision||expectationFingerprint(previous)!==spec.supersedes.sha256))throw Error('Expectation revision does not match its stated predecessor');
  }
  return true;
}
export function evaluateExpectation(spec,observation,{sourceFingerprint,environment}={}) {
  validateExpectation(spec);
  if(!/^[a-f0-9]{64}$/.test(sourceFingerprint??'')||!plain(environment)||!plain(observation))throw Error('Expectation evaluation requires source provenance, environment and complete observation');
  canonical(observation);canonical(environment);
  const relevant=spec.known_gaps.filter(gap=>Object.entries(gap.environment).every(([key,value])=>Object.hasOwn(environment,key)&&equal(environment[key],value)));
  const provenance={expectation_id:spec.id,expectation_revision:spec.revision,expectation_sha256:expectationFingerprint(spec),source_fingerprint:sourceFingerprint,environment:structuredClone(environment)},observed=structuredClone(observation);
  if(equal(observation,spec.desired))return {...provenance,classification:relevant.length?'ADVANCE_NEEDS_REVIEW':'DESIRED_MATCH',execution_status:'PASS',product_status:'VERIFIED_SUPPORTED',known_failure:relevant.length?'XPASS_NEEDS_REVIEW':'NONE',issue_ids:relevant.map(gap=>gap.issue_id),observed};
  const gaps=relevant.filter(gap=>equal(observation,gap.observation));
  if(gaps.length)return {...provenance,classification:'KNOWN_GAP',execution_status:'PASS',product_status:'PRODUCT_GAP',known_failure:'NONE',issue_ids:gaps.map(gap=>gap.issue_id),observed};
  return {...provenance,classification:'UNEXPECTED_CHANGE',execution_status:'FAIL',product_status:'TEST_GAP',known_failure:'NONE',issue_ids:[],observed,desired:structuredClone(spec.desired),applicable_known_observations:relevant.map(gap=>({issue_id:gap.issue_id,observation:structuredClone(gap.observation)}))};
}
