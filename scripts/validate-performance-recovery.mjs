import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { project, createFixture, execute, isolatedEnvironment, json, resolveGit } from './git-compat/lib.mjs';
import { compareManifests, fileManifest, manifestFingerprint, unchanged } from './git-compat/audit.mjs';
import { externalFixtureParent, validateFixtureParent } from './git-compat/fixture-parent.mjs';
import { validateOutputRoot } from './git-compat/output-root.mjs';

export const phases = Object.freeze(['focus', 'full', 'infra', 'broad', 'typecheck', 'build', 'smoke', 'scale']);
const usage = 'node scripts/validate-performance-recovery.mjs --phase scale|focus|full|infra|broad|typecheck|build|smoke --out NEW_EXTERNAL_DIRECTORY [--fixture-parent EXISTING_EXTERNAL_DIRECTORY]';
const testFlags = concurrency => ['--test', '--test-concurrency=' + concurrency, '--test-timeout=900000', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=tap', '--test-reporter-destination=stderr'];

export function phaseCommand(phase, out) {
  const focus = [
    'tests/integration/checkpoint-symref.test.ts',
    'tests/integration/git-ref.test.ts',
    'tests/integration/materialized-source.test.ts',
    'tests/integration/storage-git-blob.test.ts',
    'tests/integration/git-stdout-consumer.test.ts',
    'tests/integration/storage-buffer.test.mjs',
    'tests/unit/publication.test.ts',
    'tests/unit/disposable-projection.test.ts',
    'tests/integration/initial-index-publication.test.ts',
    'tests/integration/managed-stage-boundary.test.ts',
    'tests/integration/activation-frontier.test.ts',
    'tests/integration/scale-copy-failures.test.ts',
    'tests/integration/scale-journal.test.ts',
    'tests/integration/scale-refs.test.ts',
    'tests/integration/publication-race.test.ts',
    'tests/unit/performance-validation.test.mjs',
    'tests/unit/assert-bytes.test.ts',
    'tests/integration/index-query.test.ts',
    'tests/integration/deactivation-concurrency.test.ts',
    'tests/integration/staging-racy.test.ts',
    'tests/integration/recovery-index-timestamp.test.ts',
    'tests/unit/git-startup-benchmark.test.mjs',
    'tests/git-compat/infra/external-fixtures.test.mjs',
    'tests/integration/performance-discovery.test.ts',
    'tests/integration/performance-streaming.test.ts',
    'tests/integration/performance-recovery.test.ts',
    'tests/integration/performance-journal.test.ts',
    'tests/integration/performance-journal-recovery.test.ts',
    'tests/integration/review-target-preview.test.ts',
    'tests/integration/security-ownership.test.ts',
    'tests/integration/security-base-origin.test.ts',
    'tests/integration/security-atomic-stage.test.ts',
    'tests/integration/security-editing-transition.test.ts',
    'tests/integration/security-diagnostics.test.ts',
    'tests/integration/security-index-concurrency.test.ts',
    'tests/integration/security-ignore-refresh.test.ts',
    'tests/integration/security-protection.test.ts',
  ];
  const commands = {
    scale: { argv: ['--import', 'tsx', ...testFlags(2),
      'tests/integration/checkpoint-symref.test.ts',
      'tests/integration/git-ref.test.ts',
      'tests/integration/materialized-source.test.ts',
      'tests/integration/storage-git-blob.test.ts',
      'tests/integration/git-stdout-consumer.test.ts',
      'tests/integration/storage-buffer.test.mjs',
      'tests/unit/performance-validation.test.mjs',
      'tests/unit/paths.test.ts',
      'tests/unit/publication.test.ts', 'tests/unit/disposable-projection.test.ts',
      'tests/integration/initial-index-publication.test.ts',
      'tests/integration/managed-stage-boundary.test.ts',
      'tests/integration/activation-frontier.test.ts', 'tests/integration/scale-copy-failures.test.ts',
      'tests/integration/publication-race.test.ts',
      'tests/integration/scale-journal.test.ts', 'tests/integration/scale-refs.test.ts',
      'tests/integration/performance-journal.test.ts', 'tests/integration/performance-journal-recovery.test.ts',
      'tests/integration/performance-streaming.test.ts', 'tests/integration/deactivation-concurrency.test.ts',
      'tests/integration/recovery-index-timestamp.test.ts',
    ], timeoutMs: 60 * 60 * 1000, nodeTest: true, scope: 'Stage 2B directed integrity/durability gate; remaining 1B/2 regressions run in the separate full headless campaign.' },
    focus: { argv: ['--import', 'tsx', ...testFlags(2), ...focus], timeoutMs: 2 * 60 * 60 * 1000, nodeTest: true, scope: 'Directed performance/recovery, R-02/R-03 and selected D-01/D-02/D-03/D-04 regressions; full runs the remaining tests.' },
    full: { argv: ['--import', 'tsx', ...testFlags(2), 'tests/unit/*.test.ts', 'tests/unit/*.test.mjs', 'tests/integration/*.test.ts', 'tests/integration/*.test.mjs'], timeoutMs: 3 * 60 * 60 * 1000, nodeTest: true, npmEquivalent: 'npm.cmd test', scope: 'Same corpus, concurrency and per-test timeout as package.json test; adds spec/TAP evidence reporters.' },
    infra: { argv: [...testFlags(1), 'tests/git-compat/infra/*.test.mjs'], timeoutMs: 30 * 60 * 1000, nodeTest: true, npmEquivalent: 'npm.cmd run compat:infra', scope: 'Same infrastructure corpus and concurrency as package.json compat:infra; explicit per-test budget and evidence reporters.' },
    broad: { argv: ['scripts/git-compat/runner.mjs', '--suite', 'broad', '--jobs', '2', '--seed', '20261105', '--out', path.join(out, 'matrix')], timeoutMs: 3 * 60 * 60 * 1000, scope: 'Broad compatibility matrix; its selected, executed and environment-blocked counts remain separate from headless tests.' },
    typecheck: { argv: ['node_modules/typescript/bin/tsc', '--noEmit'], timeoutMs: 120000, npmEquivalent: 'npm.cmd run typecheck' },
    build: { argv: ['scripts/build-core.mjs'], timeoutMs: 120000, npmEquivalent: 'npm.cmd run build:core', scope: 'Independent Core/CLI build in dist-core; no desktop build.' },
    smoke: { argv: ['scripts/smoke-core-cli.mjs', '--out', path.join(out, 'smoke')], timeoutMs: 30 * 60 * 1000, scope: 'Compiled, relocated Core/CLI smoke; not a full suite. The smoke also invokes the independent build.' },
  };
  if (!Object.hasOwn(commands, phase)) throw Object.assign(Error('Unknown validation phase: ' + phase), { code: 'VALIDATION_SELECTION_INVALID' });
  return { executable: process.execPath, ...commands[phase] };
}

export function parseValidationArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!['--phase', '--out', '--fixture-parent'].includes(key) || Object.hasOwn(values, key) || !args[index + 1] || args[index + 1].startsWith('--')) throw Object.assign(Error(usage), { code: 'VALIDATION_SELECTION_INVALID' });
    values[key] = args[++index];
  }
  if (!phases.includes(values['--phase']) || !values['--out'] || !path.isAbsolute(values['--out'])) throw Object.assign(Error(usage), { code: 'VALIDATION_SELECTION_INVALID' });
  const out = validateOutputRoot(values['--out'], { projectRoot: project });
  validateFixtureParent(path.dirname(out), { projectRoot: project });
  if (fs.existsSync(out)) throw Object.assign(Error('Validation output must be new; retry with a different root so earlier failures remain intact.'), { code: 'VALIDATION_OUTPUT_EXISTS' });
  const fixtureParent = values['--fixture-parent'] ? validateFixtureParent(values['--fixture-parent'], { projectRoot: project }) : externalFixtureParent(project);
  return { phase: values['--phase'], out, fixtureParent };
}

/** Only Node's final unindented TAP totals count; never add separate campaigns. */
export function parseTapSummary(text) {
  const counts = {};
  for (const match of text.matchAll(/^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\s+([0-9]+(?:\.[0-9]+)?)\s*$/gmu)) counts[match[1]] = Number(match[2]);
  const complete = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].every(key => Number.isSafeInteger(counts[key]));
  const consistent = complete && counts.tests === counts.pass + counts.fail + counts.cancelled + counts.skipped + counts.todo;
  return { format: 'Node.js TAP final summary', counts, complete, consistent };
}

function functionalInputs() {
  return ['src', 'scripts', 'tests', ...fs.readdirSync(project).filter(name => /^(?:package.*|tsconfig.*)\.json$/u.test(name)).sort()];
}

function archiveSources(out, manifest) {
  for (const file of manifest) {
    const target = path.join(out, 'source', file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(project, file.path), target, fs.constants.COPYFILE_EXCL);
  }
  const copied = fileManifest(path.join(out, 'source'), manifest.map(file => file.path));
  if (manifestFingerprint(copied) !== manifestFingerprint(manifest)) throw Error('Archived functional inputs do not match their source manifest.');
}

function nestedPhaseResult(phase, out) {
  if (phase === 'broad') {
    const pointer = JSON.parse(fs.readFileSync(path.join(out, 'matrix', 'latest-run.json'), 'utf8'));
    const summary = JSON.parse(fs.readFileSync(path.join(out, 'matrix', pointer.summary), 'utf8'));
    return { format: 'compatibility-matrix', file: 'matrix/' + pointer.summary, selected: summary.selected, counts: summary.counts, exitCode: summary.exit_code, sourceUnchanged: summary.source_unchanged, runnerUnchanged: summary.runner_unchanged };
  }
  if (phase === 'smoke') {
    const folders = fs.readdirSync(path.join(out, 'smoke')).filter(name => name.startsWith('smoke-'));
    if (folders.length !== 1) throw Error('Expected exactly one compiled smoke result in this new phase root.');
    const file = 'smoke/' + folders[0] + '/result.json', result = JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
    return { format: 'compiled-smoke', file, status: result.status, commands: result.commandCount, snapshots: result.snapshotCount, steps: result.steps };
  }
  return null;
}

export async function runValidation(args = process.argv.slice(2)) {
  const options = parseValidationArgs(args);
  if (options.help) { console.log(usage); return { help: true }; }
  const { phase, out, fixtureParent } = options, command = phaseCommand(phase, out), inputs = functionalInputs();
  const before = fileManifest(project, inputs), beforeFingerprint = manifestFingerprint(before);
  fs.mkdirSync(out); // exclusive: no earlier campaign or unknown output is reused
  json(path.join(out, 'SOURCE-MANIFEST.json'), { schema: 1, inputs, fingerprint: beforeFingerprint, files: before });
  let fixture, execution, caught, after, sourceDelta, sourceUnchanged = false, summary = null;
  const startedAt = new Date().toISOString(), stdout = path.join(out, 'stdout.log'), stderr = path.join(out, 'stderr.log');
  fs.writeFileSync(stdout, '', { flag: 'wx' }); fs.writeFileSync(stderr, '', { flag: 'wx' });
  try {
    archiveSources(out, before);
    if (!unchanged(compareManifests(before, fileManifest(project, inputs)))) throw Error('Functional inputs changed during archiving; no validation process was started.');
    const git = resolveGit(); fixture = createFixture(fixtureParent, 'glv');
    const env = isolatedEnvironment(fixture.root, git);
    env.GIT_COMPAT_EXTERNAL_FIXTURE_PARENT = fixtureParent;
    env.GIT_COMPAT_INFRA_EVIDENCE_ROOT = path.join(out, 'infra-observations');
    env.GL_STAGE2_RECOVERY_EVIDENCE = path.join(out, 'recovery-observations');
    env.GL_STAGE2_PRESERVE_FIXTURES = '1';
    env.GL_SECURITY_KEEP_FIXTURES = '1';
    env.GL_SECURITY_ATOMIC_STAGE_EVIDENCE = path.join(out, 'atomic-stage-observations');
    // Keep the coordinator's short external root after the phase. The tests
    // clean their own proven fixtures; disputed/failed leftovers are evidence,
    // and this wrapper never removes their sole copy to present a clean run.
    json(path.join(out, 'STARTED.json'), { schema: 1, phase, startedAt, cwd: project, ...command, testTimeoutMs: command.nodeTest ? 900000 : null, sourceFingerprint: beforeFingerprint, inputCount: before.length, node: process.version, platform: process.platform, arch: process.arch, release: os.release(), officialGit: git, fixture, environmentPolicy: 'isolated HOME/USERPROFILE/XDG/config/identity/credentials/editors/temporary paths; no shell; no host configuration edits', performanceFixturePolicy: { environmentFlag: 'GL_STAGE2_PRESERVE_FIXTURES=1', retainPassedAndFailed: true, ownershipReceipts: 'Each performance fixture validates its marker/nonce and ancestry, then emits its retained root in TAP diagnostics and writes a local retention receipt.' }, evidence: { stdout: 'stdout.log', stderr: 'stderr.log' } });
    execution = await execute(command.executable, command.argv, {
      cwd: project, env, timeout: command.timeoutMs, maxOutput: 64 * 1024 * 1024,
      onSpawn(child) {
        json(path.join(out, 'PROCESS.json'), { phase, startedAt, pid: child.pid, executable: command.executable, argv: command.argv });
        child.stdout.on('data', chunk => { fs.appendFileSync(stdout, chunk); process.stdout.write(chunk); });
        child.stderr.on('data', chunk => { fs.appendFileSync(stderr, chunk); });
      },
    });
    summary = command.nodeTest ? parseTapSummary(fs.readFileSync(stderr, 'utf8')) : nestedPhaseResult(phase, out);
  } catch (error) { caught = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }; }
  finally {
    try {
      after = fileManifest(project, inputs); sourceDelta = compareManifests(before, after); sourceUnchanged = unchanged(sourceDelta);
      json(path.join(out, 'AFTER-MANIFEST.json'), { schema: 1, inputs, fingerprint: manifestFingerprint(after), files: after });
    } catch (error) { caught ??= { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }; }
  }
  const processSucceeded = !!execution && execution.code === 0 && !execution.signal && !execution.timedOut && !execution.outputTruncated;
  const summarySucceeded = command.nodeTest ? !!summary?.complete && summary.consistent && summary.counts.fail === 0 && summary.counts.cancelled === 0 : phase === 'broad' ? summary?.exitCode === 0 && summary.sourceUnchanged && summary.runnerUnchanged : phase === 'smoke' ? summary?.status === 'PASS' : true;
  const passed = !caught && processSucceeded && summarySucceeded && sourceUnchanged;
  const record = {
    schema: 1, phase, status: passed ? 'PASS' : 'FAIL', startedAt, endedAt: new Date().toISOString(), cwd: project, command,
    source: { inputs, beforeFingerprint, afterFingerprint: after ? manifestFingerprint(after) : null, sourceUnchanged, delta: sourceDelta ?? null, count: before.length, archive: 'source/' },
    process: execution && { pid: execution.pid, exitCode: execution.code, signal: execution.signal, timedOut: execution.timedOut, outputTruncated: execution.outputTruncated, timeoutMs: command.timeoutMs, durationMs: execution.duration_ms, termination: execution.termination },
    summary, error: caught ?? null, streams: { stdout: 'stdout.log', stderr: 'stderr.log' },
    workingStorage: fixture ? { ...fixture, retained: true, reason: 'Preserved phase environment and any remaining evidence; tests own cleanup independently.' } : null,
    qualification: 'One phase on one identified source snapshot; never sum this summary with another phase or retry to construct a full campaign.',
  };
  json(path.join(out, 'result.json'), record);
  console.log(JSON.stringify({ phase, status: record.status, out, sourceFingerprint: beforeFingerprint, sourceUnchanged, processExit: record.process?.exitCode ?? null, summary }));
  process.exitCode = passed ? 0 : 1; return record;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runValidation().catch(error => {
  console.error(JSON.stringify({ outcome: error.code ?? 'VALIDATION_INFRASTRUCTURE_ERROR', error: error.message, noTestSuccess: true })); process.exitCode = 2;
});
