import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit, execute, project, within } from './git-compat/lib.mjs';
import { validateFixtureParent } from './git-compat/fixture-parent.mjs';
import { validateOutputRoot } from './git-compat/output-root.mjs';

const usage = 'node scripts/benchmark-core.mjs --baseline-source EXISTING_SOURCE_ROOT --out NEW_ARTIFACT_DIRECTORY [--fixture-parent EXISTING_EXTERNAL_DIRECTORY] [--case-timeout-ms INTEGER]';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const median = numbers => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)];
function noLinks(file) {
  const absolute = path.resolve(file), volume = path.parse(absolute).root;
  let cursor = volume;
  for (const part of path.relative(volume, absolute).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('Linked path refused: ' + cursor); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
  }
}
function sourceFiles(directory, relative = '', excludeGit = false) {
  noLinks(directory);
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (excludeGit && !relative && entry.name === '.git') return [];
    const file = path.join(directory, entry.name), name = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isSymbolicLink()) throw Error('Source symlink refused');
    if (entry.isDirectory()) return sourceFiles(file, name, excludeGit);
    if (!entry.isFile()) throw Error('Source must contain regular files');
    const bytes = fs.readFileSync(file);
    return [{ path: name, size: bytes.length, sha256: sha256(bytes) }];
  });
}
export function parseBenchmarkArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--baseline-source', '--out', '--fixture-parent', '--case-timeout-ms'].includes(key) || options[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) throw Error(usage);
    options[key] = args[++i];
  }
  if (!options['--baseline-source'] || !options['--out']) throw Error(usage);
  const baseline = path.resolve(options['--baseline-source']); noLinks(baseline);
  for (const file of ['src/core/index.ts', 'src/core/git.ts', 'src/core/platform.ts']) if (!fs.statSync(path.join(baseline, file)).isFile()) throw Error('Baseline source missing: ' + file);
  const out = validateOutputRoot(options['--out'], { projectRoot: project });
  if (!within(path.join(project, 'artifacts'), out)) throw Error('--out must be a NEW directory below project artifacts/');
  if (fs.existsSync(out)) throw Error('--out already exists; evidence will not be overwritten');
  const fixtureParent = validateFixtureParent(options['--fixture-parent'] ?? os.tmpdir(), { projectRoot: project });
  const rawTimeout = options['--case-timeout-ms'] ?? '180000';
  if (!/^[1-9]\d*$/u.test(rawTimeout) || !Number.isSafeInteger(Number(rawTimeout)) || Number(rawTimeout) > 2147483647) throw Error('Invalid --case-timeout-ms');
  return { baseline, out, fixtureParent, caseTimeoutMs: Number(rawTimeout) };
}
function activityDelta(before, after) {
  const prior = before.map(entry => JSON.stringify(entry)), next = after.map(entry => JSON.stringify(entry));
  let overlap = 0;
  for (let count = Math.min(prior.length, next.length); count > 0; count--) {
    if (prior.slice(-count).every((entry, index) => entry === next[index])) { overlap = count; break; }
  }
  const retained = after.slice(overlap);
  const exact = overlap > 0 || after.length < 100;
  const byCommand = {};
  for (const entry of retained) { const verb = entry.command[1] ?? 'unknown'; byCommand[verb] = (byCommand[verb] ?? 0) + 1; }
  return { count: retained.length, exact, lowerBoundOnly: !exact, activityCapacity: 100, overlap, byCommand, retained };
}
function relativePortable(root, file) { return path.relative(root, file).split(path.sep).join('/'); }
function portable(value, replacements) {
  if (Array.isArray(value)) return value.map(item => portable(item, replacements));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, portable(item, replacements)]));
  if (typeof value !== 'string') return value;
  let text = value;
  for (const [from, to] of replacements) text = text.replaceAll(from, to).replaceAll(from.replaceAll('\\', '/'), to);
  return text;
}
async function worker(jobFile) {
  const job = readJSON(jobFile);
  assert.equal(job.schema, 1); assert(['baseline', 'current'].includes(job.version)); assert([0, 1].includes(job.layerCount));
  assert(path.isAbsolute(job.git)); assert(fs.statSync(job.git).isFile());
  noLinks(job.fixture.root); noLinks(job.out);
  assert(within(job.fixture.parent, job.fixture.root));
  assert.equal(readJSON(path.join(job.fixture.root, '.git-compat-owned.json')).nonce, job.fixture.nonce);
  assert(within(job.fixture.root, job.repo)); assert(within(job.out, job.caseOut)); assert(within(job.out, job.bundle));
  fs.mkdirSync(job.caseOut); fs.mkdirSync(job.repo);
  const replacements = [[job.fixture.root, '<FIXTURE>'], [project, '<PROJECT>'], [job.out, '<OUTPUT>']];
  const nativeCommands = [];
  const native = argv => {
    assert.equal(readJSON(path.join(job.fixture.root, '.git-compat-owned.json')).nonce, job.fixture.nonce);
    const started = performance.now();
    const args = ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', '-c', 'credential.helper=', ...argv];
    const result = spawnSync(job.git, args, { cwd: job.repo, env: process.env, shell: false, windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
    nativeCommands.push(portable({ executable: job.git, cwd: job.repo, argv: args, durationMs: performance.now() - started, status: result.status, signal: result.signal }, replacements));
    assert.equal(result.status, 0, result.stderr || result.error?.message); return result.stdout;
  };
  const snapshot = () => {
    const files = sourceFiles(job.repo, '', true);
    return { head: native(['rev-parse', 'HEAD']).trim(), branch: native(['symbolic-ref', 'HEAD']).trim(), refs: native(['for-each-ref', '--format=%(refname) %(objectname)']).trim(), index: native(['ls-files', '--stage', '-z']), files };
  };
  const result = { schema: 1, version: job.version, layerCount: job.layerCount, baseFiles: 10, layerFiles: job.layerCount ? 10 : 0, samplesPerMetric: 3, started: new Date().toISOString(), samples: [], nativeCommands, isolation: {}, limits: ['getGitActivity retains at most 100 outcomes; non-overlapping full windows are lower bounds.', 'Setup precedes timing; no OS cache eviction and no claim of cold-cache latency.', 'verifyExcludes is an internal-method microbenchmark, not a public API.', 'No SLO or universal performance conclusion is implied by three samples.'] };
  json(path.join(job.caseOut, 'results.json'), result);
  try {
    const { GitLayers, getGitActivity, git, resolveGitExecutable } = await import(pathToFileURL(job.bundle).href);
    assert.equal(fs.realpathSync(await resolveGitExecutable(process.env)), fs.realpathSync(job.git));
    native(['-c', 'init.templateDir=' + job.template, 'init', '--initial-branch=main']);
    native(['config', '--local', 'user.name', 'Synthetic Benchmark']); native(['config', '--local', 'user.email', 'benchmark@example.invalid']);
    native(['config', '--local', 'core.autocrlf', 'false']); native(['config', '--local', 'core.fsmonitor', 'false']);
    for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(job.repo, 'base-' + i + '.txt'), 'synthetic base ' + i + '\n');
    native(['add', '.']); native(['commit', '-m', 'Synthetic base']);
    const audit = (await git(job.repo, ['config', '--null', '--show-scope', '--show-origin', '--list'])).stdout.toString('utf8').split('\0');
    const configuration = [];
    for (let i = 0; i + 2 < audit.length; i += 3) {
      if (audit[i] === 'command') continue;
      const key = audit[i + 2].split('\n')[0];
      const origin = audit[i + 1].replaceAll('\\', '/').includes(job.fixture.root.replaceAll('\\', '/')) ? portable(audit[i + 1], replacements) : '[external configuration path omitted]';
      configuration.push({ scope: audit[i], origin, key });
    }
    result.isolation = { homeAndUserProfile: '<FIXTURE>/home', gitConfigurationsRequestedByEnvironment: true, effectiveConfigurationKeys: configuration, baselineSystemConfigLimitationObserved: configuration.some(entry => entry.scope === 'system' && entry.origin === '[external configuration path omitted]'), noConfigurationValuesRecorded: true };
    const setupAt = performance.now(); const app = await GitLayers.init(job.repo);
    if (job.layerCount) {
      await app.create('bench'); await app.on('bench');
      fs.mkdirSync(path.join(job.repo, 'layer'));
      const names = [];
      for (let i = 0; i < 10; i++) { const name = 'layer/item-' + i + '.txt'; names.push(name); fs.writeFileSync(path.join(job.repo, name), 'synthetic layer ' + i + '\n'); }
      await app.add('bench', names); await app.commit('bench', 'Synthetic layer');
    }
    result.setupDurationMs = performance.now() - setupAt;
    const beforeSnapshot = snapshot(); result.before = beforeSnapshot;
    for (const metric of ['status', 'verifyExcludes']) {
      if (metric === 'verifyExcludes' && typeof app.verifyExcludes !== 'function') throw Error('Internal verifyExcludes unavailable in source version');
      for (let sample = 1; sample <= 3; sample++) {
        const before = getGitActivity(); const at = performance.now();
        const value = metric === 'status' ? await app.status() : await app.verifyExcludes();
        const durationMs = performance.now() - at, activity = activityDelta(before, getGitActivity());
        if (metric === 'status') {
          assert.equal(value.safe, true, JSON.stringify(value.error)); assert.equal(value.branch, 'main');
          assert.equal(value.layers.filter(layer => layer.state === 'active').length, job.layerCount);
          assert.equal(value.base.staged.length, 0); assert.equal(value.base.unstaged.length, 0);
          for (const layer of value.layers) { assert.equal(layer.staged.length, 0); assert.equal(layer.unstaged.length, 0); }
        }
        result.samples.push({ metric, sample, durationMs, git: portable(activity, replacements) });
        json(path.join(job.caseOut, 'results.json'), result);
        console.log(JSON.stringify({ version: job.version, layers: job.layerCount, metric, sample, durationMs, subprocesses: activity.count, countExact: activity.exact }));
      }
    }
    result.after = snapshot(); assert.deepEqual(result.after, beforeSnapshot);
    result.semanticStatePreserved = true; result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL'; result.error = portable({ code: error.code, message: error.message, stack: error.stack }, replacements); process.exitCode = 1;
  } finally {
    result.finished = new Date().toISOString(); json(path.join(job.caseOut, 'results.json'), result);
  }
}
function summarize(results) {
  const comparisons = [];
  for (const layers of [0, 1]) for (const metric of ['status', 'verifyExcludes']) {
    const baseline = results.find(result => result.version === 'baseline' && result.layerCount === layers);
    const current = results.find(result => result.version === 'current' && result.layerCount === layers);
    const left = baseline?.samples.filter(sample => sample.metric === metric) ?? [], right = current?.samples.filter(sample => sample.metric === metric) ?? [];
    if (left.length !== 3 || right.length !== 3 || baseline.status !== 'PASS' || current.status !== 'PASS') { comparisons.push({ layers, metric, comparable: false }); continue; }
    const leftMs = median(left.map(sample => sample.durationMs)), rightMs = median(right.map(sample => sample.durationMs));
    comparisons.push({ layers, metric, comparable: true, baselineMedianMs: leftMs, currentMedianMs: rightMs, differenceMs: rightMs - leftMs, percentChange: leftMs ? 100 * (rightMs / leftMs - 1) : null, baselineRangeMs: [Math.min(...left.map(s => s.durationMs)), Math.max(...left.map(s => s.durationMs))], currentRangeMs: [Math.min(...right.map(s => s.durationMs)), Math.max(...right.map(s => s.durationMs))], subprocessCountsExact: [...left, ...right].every(s => s.git.exact), baselineGitCounts: left.map(s => s.git.count), currentGitCounts: right.map(s => s.git.count), baselineCheckIgnoreCounts: left.map(s => s.git.byCommand['check-ignore'] ?? 0), currentCheckIgnoreCounts: right.map(s => s.git.byCommand['check-ignore'] ?? 0) });
  }
  return comparisons;
}
export async function runBenchmark(args = process.argv.slice(2)) {
  const options = parseBenchmarkArgs(args);
  if (options.help) { console.log(usage); return; }
  const git = resolveGit();
  // Exclusive output creation revalidates the NEW-destination contract even if
  // another process created a directory after argument validation.
  fs.mkdirSync(path.dirname(options.out), { recursive: true }); fs.mkdirSync(options.out);
  const fixture = createFixture(options.fixtureParent, 'gitlayer-benchmark');
  const env = isolatedEnvironment(fixture.root, git), template = path.join(fixture.root, 'empty-template'); fs.mkdirSync(template);
  fs.mkdirSync(path.join(options.out, 'build')); fs.mkdirSync(path.join(options.out, 'sources')); fs.mkdirSync(path.join(options.out, 'cases'));
  const started = new Date().toISOString(); const sourceManifests = {}, cases = [], processes = [];
  const report = { schema: 1, started, runner: { file: 'scripts/benchmark-core.mjs', sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))) }, status: 'RUNNING', platform: { node: process.version, os: process.platform, arch: process.arch, release: os.release(), git: spawnSync(git, ['--version'], { env, encoding: 'utf8', windowsHide: true }).stdout.trim(), gitExecutable: git }, sourceManifests, cases, processes, fixture: { id: path.basename(fixture.root), disposable: true, cleanup: 'pending' }, methodology: { versions: ['baseline', 'current'], baseFiles: 10, layerCounts: [0, 1], layerFilesWhenActive: 10, samplesPerMetric: 3, metrics: ['public status', 'internal verifyExcludes'], execution: 'sequential; one isolated worker per version/case; setup excluded', baselineSystemConfigurationCaveat: 'The historical adapter can strip inherited GIT_CONFIG_*; each worker audits effective scopes/keys without recording values.', subprocessCounting: 'getGitActivity bounded to 100; overlap establishes exact deltas, otherwise count is a lower bound.' } };
  json(path.join(options.out, 'results.json'), report);
  try {
    const { build, version: esbuildVersion } = await import('esbuild'); report.platform.esbuild = esbuildVersion;
    for (const [version, root] of [['baseline', options.baseline], ['current', project]]) {
      const source = path.join(root, 'src', 'core'), snapshot = path.join(options.out, 'sources', version, 'src', 'core');
      const before = sourceFiles(source); fs.mkdirSync(snapshot, { recursive: true });
      for (const entry of before) { const target = path.join(snapshot, ...entry.path.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(source, ...entry.path.split('/')), target, fs.constants.COPYFILE_EXCL); }
      assert.deepEqual(sourceFiles(snapshot), before); assert.deepEqual(sourceFiles(source), before);
      sourceManifests[version] = { files: before, sha256: sha256(JSON.stringify(before)), sourceStableDuringCopy: true };
      const entryRoot = path.resolve(snapshot, '../..');
      const built = await build({ absWorkingDir: entryRoot, stdin: { contents: "export { GitLayers } from './src/core/index.ts';\nexport { getGitActivity, git } from './src/core/git.ts';\nexport { resolveGitExecutable } from './src/core/platform.ts';\n", resolveDir: entryRoot, sourcefile: 'benchmark-entry.mjs', loader: 'js' }, outfile: path.join(options.out, 'build', version + '.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: false, metafile: true, logLevel: 'silent' });
      if (Object.keys(built.metafile.inputs).some(input => input.includes('/desktop/') || input.includes('\\desktop\\'))) throw Error('Desktop input refused in headless benchmark');
      sourceManifests[version].bundleSha256 = sha256(fs.readFileSync(path.join(options.out, 'build', version + '.mjs')));
    }
    // Alternate version order between cases to reduce a fixed order bias. This
    // does not control cache/thermal/background effects or establish causality.
    for (const layers of [0, 1]) for (const version of layers ? ['current', 'baseline'] : ['baseline', 'current']) {
      const name = version + '-layers-' + layers, caseOut = path.join(options.out, 'cases', name);
      const job = { schema: 1, version, layerCount: layers, fixture, git, template, out: options.out, caseOut, repo: path.join(fixture.root, name), bundle: path.join(options.out, 'build', version + '.mjs') };
      const jobFile = path.join(options.out, name + '.job.json'); json(jobFile, job);
      console.log('START ' + name);
      const execution = await execute(process.execPath, [fileURLToPath(import.meta.url), '--worker', jobFile], { cwd: project, env, timeout: options.caseTimeoutMs, maxOutput: 8 * 1024 * 1024 });
      fs.writeFileSync(path.join(options.out, name + '.stdout'), execution.stdoutBuffer, { flag: 'wx' }); fs.writeFileSync(path.join(options.out, name + '.stderr'), execution.stderrBuffer, { flag: 'wx' });
      const replacement = [[fixture.root, '<FIXTURE>'], [options.out, '<OUTPUT>'], [project, '<PROJECT>']];
      processes.push(portable({ name, executable: process.execPath, argv: [fileURLToPath(import.meta.url), '--worker', jobFile], exit: execution.code, signal: execution.signal, timedOut: execution.timedOut, durationMs: execution.duration_ms, timeoutMs: options.caseTimeoutMs, termination: execution.termination, stdout: name + '.stdout', stderr: name + '.stderr' }, replacement));
      const resultFile = path.join(caseOut, 'results.json');
      if (fs.existsSync(resultFile)) cases.push(readJSON(resultFile));
      else cases.push({ version, layerCount: layers, status: 'FAIL', error: { message: 'Worker produced no result' } });
      if (execution.code !== 0 || execution.timedOut || execution.signal) cases.at(-1).status = 'FAIL';
      // Job files include local transient absolute fixture paths, not evidence.
      fs.unlinkSync(jobFile); json(path.join(options.out, 'results.json'), report);
      console.log('END ' + name + ' exit=' + execution.code);
    }
    report.comparisons = summarize(cases);
    const batch = report.comparisons.find(item => item.layers === 1 && item.metric === 'verifyExcludes');
    report.batchCheckIgnoreObserved = Boolean(batch?.comparable && batch.subprocessCountsExact && batch.baselineCheckIgnoreCounts.every(n => n === 10) && batch.currentCheckIgnoreCounts.every(n => n === 1));
    report.status = cases.length === 4 && cases.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL';
  } catch (error) { report.status = 'FAIL'; report.error = { message: error.message }; }
  finally {
    report.finished = new Date().toISOString();
    try { cleanupFixture(fixture); report.fixture.cleanup = 'owned fixture removed after nonce/ancestry verification'; }
    catch (error) { report.fixture.cleanup = 'FAILED: ' + error.message; report.status = 'FAIL'; }
    json(path.join(options.out, 'results.json'), report);
    const lines = ['# Core benchmark — measured results', '', 'Status: ' + report.status + '. Sequential synthetic Windows/headless fixtures; three samples per metric/case. Setup excluded; no SLO.', '', '| Layers | Metric | Baseline median ms | Current median ms | Change % | Git counts baseline → current |', '| --- | --- | ---: | ---: | ---: | --- |'];
    for (const row of report.comparisons ?? []) lines.push(row.comparable ? `| ${row.layers} | ${row.metric} | ${row.baselineMedianMs.toFixed(2)} | ${row.currentMedianMs.toFixed(2)} | ${row.percentChange?.toFixed(2) ?? 'n/a'} | ${row.baselineGitCounts.join('/')} → ${row.currentGitCounts.join('/')} (${row.subprocessCountsExact ? 'exact' : 'lower bounds possible'}) |` : `| ${row.layers} | ${row.metric} | not comparable | not comparable | — | inspect results.json |`);
    lines.push('', 'Observed check-ignore batching (ten files to one native check): ' + String(report.batchCheckIgnoreObserved ?? false) + '.', '', 'Counts come from the real adapter activity ring (capacity 100). Full-window/no-overlap counts are lower bounds. verifyExcludes directly invokes the real internal method; status invokes the public product API. Timing differences include all implementation changes and background/cache effects; the microbenchmark isolates the validation method more narrowly. Baseline configuration isolation can be weaker because its adapter strips inherited Git variables; effective scopes/keys are audited without configuration values.', '', 'See [results.json](results.json), per-case results, frozen Core sources and SHA-256 manifests for exact inputs, failures, limits and process outcomes. A passing benchmark is not full product certification.');
    fs.writeFileSync(path.join(options.out, 'BENCHMARK.md'), lines.join('\n') + '\n', 'utf8');
  }
  process.exitCode = report.status === 'PASS' ? 0 : 1; return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const promise = process.argv[2] === '--worker' && process.argv.length === 4 ? worker(process.argv[3]) : runBenchmark();
  promise.catch(error => { console.error(JSON.stringify({ status: 'FAIL', message: error.message })); process.exitCode = 2; });
}
