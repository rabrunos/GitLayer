import fs from 'node:fs';

export class SelectionError extends Error {
  constructor(message) { super(message); this.name = 'SelectionError'; this.code = 'SELECTION_INVALID'; }
}
function readRetryResults(file) {
  let previous;
  try{previous=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){throw new SelectionError('Retry input is not readable JSON: '+error.message);}
  if(!Array.isArray(previous))throw new SelectionError('Retry input must be a results array');
  const statuses=new Set(['NOT_RUN','PASS','FAIL','ENV_BLOCKED','NOT_APPLICABLE']),keys=new Set();
  for(const [index,result] of previous.entries()) {
    if(!result||typeof result!=='object'||Array.isArray(result)||typeof result.scenario_id!=='string'||!/^[A-Z]+-\d{3,}$/.test(result.scenario_id)||typeof result.variant_id!=='string'||!result.variant_id||/[\x00-\x1f/\\]/.test(result.variant_id)||!statuses.has(result.execution_status))throw new SelectionError('Malformed retry result at index '+index+': require scenario_id, variant_id and a known execution_status');
    const key=(result.scenario_id+'/'+result.variant_id).toLowerCase();
    if(keys.has(key))throw new SelectionError('Duplicate retry result: '+key);
    keys.add(key);
  }
  return previous;
}
export function parseArgs(args) {
  const options = { jobs: 2, seed: '20261018', suite: 'broad' };
  const flags = new Set(['list', 'keep-fixtures', 'help', 'allow-empty']);
  const values = new Set(['id', 'family', 'command', 'profile', 'tier', 'capability', 'suite', 'jobs', 'seed', 'retry-failed', 'out', 'module', 'matrix']);
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i].slice(2);
    if (!args[i].startsWith('--') || seen.has(key)) throw new SelectionError('Unknown or repeated option: ' + args[i]);
    seen.add(key);
    if (flags.has(key)) { options[key] = true; continue; }
    if (!values.has(key)) throw new SelectionError('Unknown option: --' + key);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new SelectionError('Missing value: --' + key);
    if (['id', 'family', 'command', 'profile', 'tier', 'capability', 'module'].includes(key) && value.split(',').some(v => !v || v !== v.trim())) throw new SelectionError('Empty/whitespace selector: --' + key);
    options[key] = key === 'jobs' ? Number(value) : value;
  }
  if (!Number.isInteger(options.jobs) || options.jobs < 1 || options.jobs > 4) throw new SelectionError('--jobs must be 1..4');
  if (!['smoke', 'affected', 'daily', 'broad', 'optional', 'stress', 'all', 'harness'].includes(options.suite)) throw new SelectionError('Unknown suite: ' + options.suite);
  return options;
}
export function selectCases(cases, matrix, options) {
  const scenarios = new Map(matrix.map(s => [s.id, s]));
  const domains = {
    id: matrix.map(s => s.id), family: matrix.map(s => s.family), command: matrix.flatMap(s => s.commands),
    profile: [...matrix.flatMap(s => s.profiles ?? []), ...cases.map(c => c.profile)],
    tier: [...matrix.map(s => s.tier), ...cases.map(c => c.tier)],
    capability: cases.flatMap(c => c.capabilities ?? []), module: cases.map(c => c.module),
  };
  for (const [key, domain] of Object.entries(domains)) if (options[key] !== undefined) {
    const unknown = options[key].split(',').filter(v => !new Set(domain).has(v));
    if (unknown.length) throw new SelectionError('Unknown --' + key + ': ' + unknown.join(', '));
  }
  let failed;
  if (options['retry-failed']) {
    const previous = readRetryResults(options['retry-failed']);
    failed = new Set(previous.filter(r => r.execution_status === 'FAIL').map(r => r.scenario_id + '/' + r.variant_id));
    const available = new Set(cases.map(c => c.id + '/' + c.variant));
    for (const key of failed) if (!available.has(key)) throw new SelectionError('Failed variant no longer available; map it explicitly: ' + key);
  }
  const match = (value, target) => value === undefined || value.split(',').some(v => target.includes(v));
  return cases.filter(c => {
    const s = scenarios.get(c.id); if (!s) throw new SelectionError('Case has no scenario: ' + c.id);
    const suite = options.suite;
    if (suite === 'smoke' && c.tier !== 'smoke') return false;
    if (suite === 'harness' && s.family !== 'HARNESS') return false;
    if (suite === 'affected' && !['LAYER', 'INDEX', 'BRANCH', 'RECOVERY', 'MODEL', 'HARNESS'].includes(s.family)) return false;
    if (suite === 'daily' && !['daily', 'smoke'].includes(c.tier)) return false;
    if (suite === 'broad' && ['optional', 'stress'].includes(c.tier)) return false;
    if (suite === 'optional' && c.tier !== 'optional') return false;
    if (suite === 'stress' && c.tier !== 'stress') return false;
    return match(options.id, [c.id]) && match(options.family, [s.family]) && match(options.command, s.commands) && match(options.profile, [c.profile]) && match(options.tier, [c.tier]) && match(options.capability, c.capabilities ?? []) && match(options.module, [c.module]) && (!failed || failed.has(c.id + '/' + c.variant));
  });
}
export function selectionOutcome(selected, options) {
  const previous=options['retry-failed']?readRetryResults(options['retry-failed']):null;
  if (selected.length) return 'SELECTED';
  if (options.list) return 'EMPTY_LIST';
  if (options['allow-empty']) return 'EMPTY_ALLOWED';
  if(previous&&!previous.some(r=>r.execution_status==='FAIL'))return 'NO_FAILURES_TO_RETRY';
  throw new SelectionError('No executable case selected. Inspect --list, correct selectors, or deliberately use --allow-empty. No build/test ran.');
}
