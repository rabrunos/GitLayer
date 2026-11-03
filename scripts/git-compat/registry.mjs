import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { project } from './lib.mjs';
import { fileManifest, manifestFingerprint, sourceInputs } from './audit.mjs';

export const matrixPath = path.join(project, 'tests/git-compat/scenarios.json');
export const originalMatrixPath = path.join(project, 'docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json');
// Extensible schema registry: a new scope requires an explicit execution/report
// contract here. Unknown text must never silently become an excluded scenario.
export const VALID_SCOPES=Object.freeze(['DEFERRED_THIRD_PARTY','EXTERNAL_INVENTORY_ONLY','FUTURE_LAYOUT_SPECIFICATION','HARNESS_HEADLESS','OFFICIAL_BRIDGE_INVENTORY_ONLY','OFFICIAL_CONTRIB_IF_PROVEN','OFFICIAL_GIT_HEADLESS','OFFICIAL_GUI_INVENTORY_ONLY']);
export function loadMatrix(file = matrixPath) {
  const document = JSON.parse(fs.readFileSync(file, 'utf8'));
  const scenarios = Array.isArray(document) ? document : document.scenarios;
  if (!Array.isArray(scenarios) || !scenarios.length) throw Error('Scenario matrix must be nonempty');
  const keys = new Set();
  for (const s of scenarios) {
    if (!/^[A-Z]+-\d{3,}$/.test(s.id) || keys.has(s.id) || !s.family || !s.title || !s.scope || !Array.isArray(s.commands) || !Array.isArray(s.requirement_ids)) throw Error('Malformed/duplicate scenario: ' + s.id);
    if(!VALID_SCOPES.includes(s.scope))throw Object.assign(Error('Unknown scenario scope: '+s.scope+' ('+s.id+'). Register its explicit scope contract before use.'),{code:'MATRIX_INVALID'});
    keys.add(s.id);
  }
  const originals = JSON.parse(fs.readFileSync(originalMatrixPath, 'utf8')).scenarios;
  if (originals.some(s => !keys.has(s.id))) throw Error('Working matrix must preserve every original scenario ID');
  return scenarios;
}
export function runnerInputs(file = matrixPath) {
  return [...sourceInputs(project).filter(input => input !== 'src'), path.relative(project, file)];
}
export function currentRunnerFingerprint(file = matrixPath) { return manifestFingerprint(fileManifest(project, runnerInputs(file))); }
export function discoverCaseModules() {
  const directory = path.join(project, 'tests/git-compat/cases');
  if (fs.lstatSync(directory).isSymbolicLink()) throw Error('Linked case module directory refused');
  return fs.readdirSync(directory).filter(n => /^[a-z0-9-]+\.mjs$/.test(n)).map(n => {
    const stat = fs.lstatSync(path.join(directory, n));
    if (stat.isSymbolicLink() || !stat.isFile()) throw Error('Linked or nonregular case module refused: ' + n);
    return n.slice(0, -4);
  }).sort();
}
export const runtimeExpectationsPath = path.join(project, 'tests/git-compat/expectations-closure-2026-11-02.json');
export function loadRuntimeExpectations() {
  const document = JSON.parse(fs.readFileSync(runtimeExpectationsPath, 'utf8'));
  const seen = new Set();
  if (document.schema !== 1 || document.revision !== 'closure-2026-11-02-r2' || !Array.isArray(document.contracts)) throw Error('Invalid runtime expectation revision');
  for (const contract of document.contracts) {
    const key = contract.module + ':' + contract.id + '/' + contract.variant;
    if (seen.has(key) || !/^[a-z0-9-]+$/.test(contract.module) || !/^[A-Z]+-\d{3,}$/.test(contract.id) || typeof contract.variant !== 'string' || !contract.reason || !/^[a-f0-9]{64}$/.test(contract.predecessor_recipe_sha256)) throw Error('Invalid/duplicate runtime expectation: ' + key);
    seen.add(key);
  }
  return document;
}
export async function loadCases(modules = discoverCaseModules(), { matrix = loadMatrix() } = {}) {
  const expectations = loadRuntimeExpectations();
  const cases = [], ids = new Set(matrix.map(s => s.id)), keys = new Set();
  for (const name of modules) {
    if (!/^[a-z0-9-]+$/.test(name) || !discoverCaseModules().includes(name)) throw Error('Unknown case module: ' + name);
    const loaded = await import(pathToFileURL(path.join(project, 'tests/git-compat/cases', name + '.mjs')).href);
    if (!Array.isArray(loaded.cases)) throw Error('Module does not export a cases array: ' + name);
    for (const c of loaded.cases) {
      const key = (c.id + '/' + c.variant).toLowerCase();
      if (!ids.has(c.id) || typeof c.variant !== 'string' || !c.variant || /[\x00-\x1f/\\]/.test(c.variant) || keys.has(key) || typeof c.run !== 'function' || !Array.isArray(c.capabilities ?? [])) throw Error('Invalid/duplicate executable case: ' + key);
      keys.add(key);
      const contract = expectations.contracts.find(item => item.module === name && item.id === c.id && item.variant === c.variant);
      cases.push({ ...c, module: name, ...(contract ? { expectation: { revision: expectations.revision, authority: expectations.authority, file: path.relative(project, runtimeExpectationsPath).replaceAll('\\', '/'), ...contract } } : {}) });
    }
  }
  for (const contract of expectations.contracts.filter(item => modules.includes(item.module))) {
    if (!cases.some(item => item.module === contract.module && item.id === contract.id && item.variant === contract.variant)) throw Error('Runtime expectation has no executable recipe: ' + contract.module + ':' + contract.id + '/' + contract.variant);
  }
  return cases;
}
