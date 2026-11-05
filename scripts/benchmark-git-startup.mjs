import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createFixture, execute, isolatedEnvironment, json, project, sha256, within } from './git-compat/lib.mjs';
import { externalFixtureParent, validateFixtureParent } from './git-compat/fixture-parent.mjs';
import { validateOutputRoot } from './git-compat/output-root.mjs';

const usage = 'node scripts/benchmark-git-startup.mjs --wrapper ABSOLUTE_GIT --direct ABSOLUTE_GIT --out NEW_EXTERNAL_DIRECTORY [--fixture-parent EXISTING_EXTERNAL_DIRECTORY] [--no-home]';
const common = ['--no-pager', '-c', 'color.ui=false', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', '-c', 'protocol.allow=never', '-c', 'gc.auto=0'];
export const queryVectors = Object.freeze([
  { name: 'version', argv: ['version', '--build-options'] },
  { name: 'exec-path', argv: ['--exec-path'] },
  { name: 'config', argv: ['config', '--null', '--show-scope', '--show-origin', '--list'] },
  { name: 'identity', argv: ['var', 'GIT_AUTHOR_IDENT'] },
  { name: 'discover', argv: ['rev-parse', '--path-format=absolute', '--show-toplevel', '--absolute-git-dir', '--git-common-dir', '--git-path', 'index', '--verify', 'HEAD'] },
  { name: 'status', argv: ['status', '--porcelain=v2', '--untracked-files=all'] },
  { name: 'refs', argv: ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)'] },
]);

function binary(file) {
  const resolved = path.resolve(file), stat = fs.lstatSync(resolved);
  if (!path.isAbsolute(file) || stat.isSymbolicLink() || !stat.isFile() || !/^git(?:\.exe)?$/iu.test(path.basename(resolved))) throw Error('Each executable must be an explicitly named absolute regular git/git.exe file.');
  return { path: resolved, realpath: fs.realpathSync(resolved), bytes: stat.size, mode: stat.mode, dev: stat.dev, ino: stat.ino, mtimeMs: stat.mtimeMs, sha256: sha256(fs.readFileSync(resolved)) };
}

export function parseStartupArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (Object.hasOwn(values, key)) throw Error('Repeated option: ' + key);
    if (key === '--no-home') { values[key] = true; continue; }
    if (!['--wrapper', '--direct', '--out', '--fixture-parent'].includes(key) || !args[index + 1] || args[index + 1].startsWith('--')) throw Error(usage);
    values[key] = args[++index];
  }
  if (!values['--wrapper'] || !values['--direct'] || !values['--out'] || !path.isAbsolute(values['--out'])) throw Error(usage);
  const out = validateOutputRoot(values['--out'], { projectRoot: project });
  validateFixtureParent(path.dirname(out), { projectRoot: project });
  if (fs.existsSync(out)) throw Error('Output must be new; existing evidence will never be overwritten.');
  const wrapper = binary(values['--wrapper']), direct = binary(values['--direct']);
  if (wrapper.realpath.toLowerCase() === direct.realpath.toLowerCase()) throw Error('Use two different executable paths; this experiment compares an explicit wrapper with an explicit backend.');
  return { wrapper, direct, out, fixtureParent: values['--fixture-parent'] ? validateFixtureParent(values['--fixture-parent'], { projectRoot: project }) : externalFixtureParent(project), modes: values['--no-home'] ? ['home', 'no-home'] : ['home'] };
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
export function summarizeStartup(records) {
  const measured = records.filter(record => record.phase === 'measured'), result = [];
  for (const mode of [...new Set(measured.map(record => record.mode))]) for (const vector of queryVectors) {
    const left = measured.filter(record => record.mode === mode && record.query === vector.name && record.executableRole === 'wrapper');
    const right = measured.filter(record => record.mode === mode && record.query === vector.name && record.executableRole === 'direct');
    const outcomes = [...left, ...right], complete = left.length === 3 && right.length === 3;
    const successful = complete && outcomes.every(record => record.exitCode === 0 && !record.signal && !record.timedOut && !record.outputTruncated && !record.error);
    const outputsEqual = complete && new Set(outcomes.map(record => record.rawStdoutSha256 + '/' + record.rawStderrSha256)).size === 1;
    if (!successful) { result.push({ mode, query: vector.name, comparable: false, complete, outputsEqual, reason: 'Missing or unsuccessful measured process; no latency claim.' }); continue; }
    const wrapperMedianMs = median(left.map(record => record.durationMs)), directMedianMs = median(right.map(record => record.durationMs));
    result.push({ mode, query: vector.name, comparable: outputsEqual, complete, outputsEqual, samplesPerExecutable: 3, wrapperMedianMs, directMedianMs, differenceMs: directMedianMs - wrapperMedianMs, percentChange: wrapperMedianMs ? 100 * (directMedianMs / wrapperMedianMs - 1) : null, wrapperRangeMs: [Math.min(...left.map(record => record.durationMs)), Math.max(...left.map(record => record.durationMs))], directRangeMs: [Math.min(...right.map(record => record.durationMs)), Math.max(...right.map(record => record.durationMs))], pairedDirectMinusWrapperMs: [1, 2, 3].map(sample => right.find(record => record.sample === sample).durationMs - left.find(record => record.sample === sample).durationMs), p95Ms: null, qualification: 'Three paired samples are exploratory; no statistical significance or universal causal claim.' });
  }
  return result;
}

function configScopes(bytes, portable) {
  const fields = bytes.toString('utf8').split('\0'), result = [];
  for (let index = 0; index + 2 < fields.length; index += 3) result.push({ scope: fields[index], origin: portable(fields[index + 1]), key: fields[index + 2].split('\n')[0] });
  return result;
}

export async function runStartupBenchmark(args = process.argv.slice(2)) {
  const options = parseStartupArgs(args);
  if (options.help) { console.log(usage); return { help: true }; }
  const { out, wrapper, direct } = options;
  fs.mkdirSync(out); fs.mkdirSync(path.join(out, 'streams'));
  json(path.join(out, 'STARTED.json'), { schema: 1, status: 'STARTING', startedAt: new Date().toISOString(), executablesBefore: { wrapper, direct }, modes: options.modes, qualification: 'No successful benchmark is implied before results.json reaches a terminal state.' });
  const fixture = createFixture(options.fixtureParent, 'gl-startup'), repo = path.join(fixture.root, 'repo'); fs.mkdirSync(repo);
  const baseEnv = { ...isolatedEnvironment(fixture.root, wrapper.path), GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1' };
  // Both executable paths receive exactly this same synthetic config. The
  // optional no-HOME mode tests ~ expansion against fixture USERPROFILE.
  fs.appendFileSync(baseEnv.GIT_CONFIG_GLOBAL, '[startup]\n homeprobe = ~/git-startup-probe\n');
  const portable = value => String(value).replaceAll(fixture.root, '<FIXTURE>').replaceAll(fixture.root.replaceAll('\\', '/'), '<FIXTURE>');
  const records = [], snapshots = [], homeProbes = [], configuration = [], startedAt = new Date().toISOString();
  const report = { schema: 1, status: 'RUNNING', startedAt, node: process.version, platform: process.platform, arch: process.arch, release: os.release(), executablesBefore: { wrapper, direct }, fixture: { ...fixture, retained: true }, queryVectors, records, snapshots, homeProbes, configuration, methodology: { samplesPerExecutableAndQuery: 3, execution: 'sequential; alternating AB/BA order by sample and query', warmup: 'one unmeasured version query per executable and mode after fixture setup', cache: 'No OS cache eviction; first measured process is not an OS cold-cache claim.', scope: 'Native process startup microbenchmark; no Core validation latency is measured.', environment: 'Exactly the same isolated environment is supplied to both paths for each mode; HOME/USERPROFILE/XDG/config/identity/credentials/editors/pagers are fixture-owned.', subprocesses: 'Every direct spawn attempt is recorded. Descendants created internally by Git/wrapper are not observed; no physical-process total is inferred.', statistics: 'Median and observed range only; no p95 or significance claim with n=3.', adoption: 'This experiment never selects a new product executable or changes PATH, Git installation or global configuration.' }, references: ['https://gitforwindows.org/git-wrapper.html', 'https://github.com/git-for-windows/build-extra/blob/main/ReleaseNotes.md'] };
  const persist = () => json(path.join(out, 'results.json'), report);
  const owned = () => {
    const marker = JSON.parse(fs.readFileSync(path.join(fixture.root, '.git-compat-owned.json'), 'utf8'));
    assert.equal(marker.nonce, fixture.nonce); assert.equal(marker.parent, fixture.parent); assert.equal(fs.realpathSync(path.dirname(fixture.root)), fixture.parent); assert(within(fixture.root, repo));
  };
  async function run(executableRole, argv, phase, env, mode = 'home', query = null, sample = null) {
    owned(); const executable = executableRole === 'wrapper' ? wrapper.path : direct.path, sequence = records.length + 1;
    let execution, error; const tick = performance.now();
    try { execution = await execute(executable, [...common, ...argv], { cwd: repo, env, timeout: 30000, maxOutput: 4 * 1024 * 1024 }); }
    catch (caught) { error = { code: caught.code ?? null, message: caught.message }; }
    const durationMs = performance.now() - tick;
    const rawOut = execution?.stdoutBuffer ?? Buffer.alloc(0), rawErr = execution?.stderrBuffer ?? Buffer.alloc(0);
    const savedOut = Buffer.from(portable(rawOut.toString('utf8'))), savedErr = Buffer.from(portable(rawErr.toString('utf8')));
    const stdout = 'streams/' + String(sequence).padStart(4, '0') + '.stdout', stderr = 'streams/' + String(sequence).padStart(4, '0') + '.stderr';
    fs.writeFileSync(path.join(out, stdout), savedOut, { flag: 'wx' }); fs.writeFileSync(path.join(out, stderr), savedErr, { flag: 'wx' });
    const record = { sequence, phase, mode, query, sample, executableRole, executable, argv: [...common, ...argv], cwd: '<FIXTURE>/repo', exitCode: execution?.code ?? null, signal: execution?.signal ?? null, timedOut: execution?.timedOut ?? false, outputTruncated: execution?.outputTruncated ?? false, durationMs, supervisorDurationMs: execution?.duration_ms ?? null, pid: execution?.pid ?? null, termination: execution?.termination ?? null, error: error ?? null, rawStdoutBytes: rawOut.length, rawStderrBytes: rawErr.length, rawStdoutSha256: sha256(rawOut), rawStderrSha256: sha256(rawErr), stdout, stderr, evidenceStdoutSha256: sha256(savedOut), evidenceStderrSha256: sha256(savedErr), environmentSha256: sha256(JSON.stringify(Object.entries(env).sort(([a], [b]) => a.localeCompare(b)))) };
    records.push(record); persist();
    return { record, stdout: rawOut, stderr: rawErr };
  }
  const must = async (...args) => { const result = await run(...args); assert.equal(result.record.exitCode, 0, portable(result.stderr.toString('utf8')) || JSON.stringify(result.record.error)); assert.equal(result.record.signal, null); assert.equal(result.record.timedOut, false); return result; };
  async function snapshot(label) {
    const head = await must('wrapper', ['rev-parse', '--verify', 'HEAD'], 'observation', baseEnv);
    const refs = await must('wrapper', ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)'], 'observation', baseEnv);
    const indexPath = (await must('wrapper', ['rev-parse', '--path-format=absolute', '--git-path', 'index'], 'observation', baseEnv)).stdout.toString('utf8').trim();
    const files = [];
    function visit(directory, prefix = '') {
      for (const name of fs.readdirSync(directory).sort()) {
        if (!prefix && name === '.git') continue;
        const file = path.join(directory, name), relative = prefix ? prefix + '/' + name : name, stat = fs.lstatSync(file);
        assert(!stat.isSymbolicLink());
        if (stat.isDirectory()) visit(file, relative);
        else { assert(stat.isFile()); files.push({ path: relative, bytes: stat.size, mode: stat.mode & 0o777, sha256: sha256(fs.readFileSync(file)) }); }
      }
    }
    visit(repo);
    const value = { headSha256: sha256(head.stdout), refsSha256: sha256(refs.stdout), mainIndexSha256: sha256(fs.readFileSync(indexPath)), files };
    snapshots.push({ label, ...value }); return value;
  }
  try {
    await must('wrapper', ['init', '-b', 'main'], 'setup', baseEnv);
    fs.writeFileSync(path.join(repo, 'base.txt'), 'synthetic startup benchmark\n', { flag: 'wx' });
    await must('wrapper', ['add', '--', 'base.txt'], 'setup', baseEnv);
    await must('wrapper', ['commit', '-m', 'Synthetic startup fixture'], 'setup', baseEnv);
    const before = await snapshot('before measured read-only queries');
    for (const mode of options.modes) {
      const env = { ...baseEnv }; if (mode === 'no-home') delete env.HOME;
      for (const role of ['wrapper', 'direct']) {
        await must(role, ['version', '--build-options'], 'warmup', env, mode);
        const probe = await must(role, ['config', '--path', '--get', 'startup.homeprobe'], 'home-probe', env, mode);
        const expanded = path.resolve(probe.stdout.toString('utf8').trim()), expected = path.join(baseEnv.USERPROFILE, 'git-startup-probe');
        homeProbes.push({ mode, executableRole: role, result: portable(expanded), expected: portable(expected), matchesFixtureProfile: process.platform === 'win32' ? expanded.toLowerCase() === expected.toLowerCase() : expanded === expected });
      }
      for (let sample = 1; sample <= 3; sample++) for (const [index, vector] of queryVectors.entries()) {
        const order = (sample + index) % 2 ? ['wrapper', 'direct'] : ['direct', 'wrapper'];
        for (const role of order) {
          const result = await run(role, vector.argv, 'measured', env, mode, vector.name, sample);
          if (vector.name === 'config') configuration.push({ mode, sample, executableRole: role, scopes: configScopes(result.stdout, portable) });
        }
      }
    }
    const after = await snapshot('after measured read-only queries'); assert.deepEqual(after, before, 'Read-only queries changed HEAD, refs, MAIN index or workspace bytes/modes.');
    report.statePreserved = true; report.comparisons = summarizeStartup(records);
    report.executablesAfter = { wrapper: binary(wrapper.path), direct: binary(direct.path) };
    report.executableBytesUnchanged = wrapper.sha256 === report.executablesAfter.wrapper.sha256 && direct.sha256 === report.executablesAfter.direct.sha256;
    report.configScopesEqual = options.modes.every(mode => new Set(configuration.filter(entry => entry.mode === mode).map(entry => JSON.stringify(entry.scopes))).size === 1);
    report.homeBootstrapConfinedToFixture = homeProbes.every(probe => probe.matchesFixtureProfile);
    report.directSpawnAttempts = records.length; report.directMeasuredSpawnAttempts = records.filter(record => record.phase === 'measured').length; report.descendantProcessesObserved = false;
    report.status = report.executableBytesUnchanged && report.configScopesEqual && report.homeBootstrapConfinedToFixture && report.comparisons.every(comparison => comparison.comparable) && records.every(record => record.exitCode === 0 && !record.signal && !record.timedOut && !record.outputTruncated && !record.error) ? 'PASS' : 'FAIL';
  } catch (error) { report.status = 'FAIL'; report.error = { name: error.name, message: portable(error.message), stack: portable(error.stack ?? '') }; }
  finally {
    report.finishedAt = new Date().toISOString(); report.directSpawnAttempts = records.length; report.descendantProcessesObserved = false; persist();
  }
  console.log(JSON.stringify({ status: report.status, out, directSpawnAttempts: report.directSpawnAttempts, measured: report.directMeasuredSpawnAttempts ?? null, statePreserved: report.statePreserved ?? false, configScopesEqual: report.configScopesEqual ?? false, fixtureRetained: true }));
  process.exitCode = report.status === 'PASS' ? 0 : 1; return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runStartupBenchmark().catch(error => {
  console.error(JSON.stringify({ outcome: error.code ?? 'STARTUP_BENCHMARK_ERROR', error: error.message, noBenchmarkSuccess: true })); process.exitCode = 2;
});
