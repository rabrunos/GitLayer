import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { cleanupFixture, createFixture, execute, fileHash, isolatedEnvironment, json, project, relative, resolveGit, safeEvidence, within } from '../../../scripts/git-compat/lib.mjs';
import { fileManifest, manifestFingerprint } from '../../../scripts/git-compat/audit.mjs';
import { inspectZipNames } from './zip-fixtures.mjs';

const id = 'portability-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
const evidenceParent = process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT;
if (evidenceParent && !path.isAbsolute(evidenceParent)) throw Error('GIT_COMPAT_INFRA_EVIDENCE_ROOT must be absolute');
const evidenceRoot = evidenceParent ? path.join(evidenceParent, id) : path.join(project, 'artifacts/git-compat/auxiliary/review-r01', id);
fs.mkdirSync(evidenceRoot, { recursive: true });
console.log('PORTABILITY_EVIDENCE=' + relative(project, evidenceRoot));
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

test('fresh copy accepts an authorized source baseline and reports its archived execution after a later edit without private brief', { timeout: 360000 }, async () => {
  const parentBefore = fileManifest(project, ['src']);
  // The short exclusive root matters on Windows: Git appends transaction UUIDs
  // to its private refs. It is never an existing checkout or a user repository.
  const fixture = createFixture(project, 'p'), copyRoot = fixture.root;
  const dependencyLink = path.join(copyRoot, 'node_modules'), dependencies = fs.realpathSync(path.join(project, 'node_modules'));
  const commands = [], proof = { role: 'R-01 reusable fresh-copy end-to-end control; no changes to parent product', parentSourceFingerprintBefore: manifestFingerprint(parentBefore), fixture: '<FRESH-COPY>', privateBriefInitiallyAbsent: null };
  let env;
  async function run(label, executable, argv, { timeout = 180000, envOverrides = {}, expectedCode = 0 } = {}) {
    const result = await execute(executable, argv, { cwd: copyRoot, env: { ...env, ...envOverrides }, timeout, maxOutput: 4 * 1024 * 1024 });
    const stdout = label + '.stdout', stderr = label + '.stderr';
    fs.writeFileSync(path.join(evidenceRoot, stdout), result.stdoutBuffer); fs.writeFileSync(path.join(evidenceRoot, stderr), result.stderrBuffer);
    const portable = value => String(value).replaceAll(copyRoot, '<FRESH-COPY>');
    commands.push({ label, executable, argv: argv.map(portable), cwd: '<FRESH-COPY>', code: result.code, signal: result.signal, timed_out: result.timedOut, output_truncated: result.outputTruncated, duration_ms: result.duration_ms, stdout, stderr, termination: result.termination });
    json(path.join(evidenceRoot, 'commands.json'), commands);
    assert.equal(result.timedOut, false, label + ' timed out'); assert.equal(result.outputTruncated, false, label + ' output truncated');
    assert.equal(result.code, expectedCode, label + ': ' + result.stderr + '\n' + result.stdout);
    return result;
  }
  try {
    for (const input of ['src', 'scripts', 'tests', 'docs', 'AGENTS.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'README.md']) {
      const target = path.join(copyRoot, input); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(path.join(project, input), target, { recursive: true, errorOnExist: true, force: false });
    }
    proof.desktopConfigurationsAbsent = ['tsconfig.debug.json', 'vite.config.ts'].every(input => !fs.existsSync(path.join(copyRoot, input)));
    assert.equal(proof.desktopConfigurationsAbsent, true, 'headless copy has no desktop build configuration');
    proof.privateBriefInitiallyAbsent = !fs.existsSync(path.join(copyRoot, '.workshop/briefs'));
    assert.equal(proof.privateBriefInitiallyAbsent, true);
    fs.symlinkSync(dependencies, dependencyLink, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(fs.lstatSync(dependencyLink).isSymbolicLink(), true); assert.equal(fs.realpathSync(dependencyLink), dependencies);
    const gitPath = resolveGit(), environmentFixture = createFixture(copyRoot, 'env');
    env = isolatedEnvironment(environmentFixture.root, gitPath);
    await run('01-git-init', gitPath, ['init', '-b', 'main', copyRoot]);
    const matrixFile = path.join(copyRoot, 'tests/git-compat/scenarios.json'), originalFile = path.join(copyRoot, 'docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json');
    const matrix = read(matrixFile).scenarios ?? read(matrixFile), originals = read(originalFile).scenarios;
    assert.ok(originals.every(s => matrix.some(m => m.id === s.id)));
    const sourceFile = path.join(copyRoot, 'src/core/index.ts'), sourceBefore = fileHash(sourceFile);
    fs.appendFileSync(sourceFile, '\n// R-01 authorized fixture source before this execution: ' + id + '\n');
    const testedSourceHash = fileHash(sourceFile), expectedTestedManifest = fileManifest(copyRoot, ['src']);
    assert.notEqual(testedSourceHash, sourceBefore);
    const outputRoot = path.join(copyRoot, 'artifacts');
    await run('02-copied-runner', process.execPath, [path.join(copyRoot, 'scripts/git-compat/runner.mjs'), '--suite', 'all', '--id', 'HARNESS-015,INDEX-001', '--jobs', '2', '--out', outputRoot]);
    const pointer = read(path.join(outputRoot, 'latest-run.json')), runDir = path.join(outputRoot, 'runs', pointer.id), summary = read(path.join(runDir, 'summary.json'));
    const results = read(path.join(runDir, 'results.json')), baselineBefore = read(path.join(runDir, 'baseline-before.json')), baselineAfter = read(path.join(runDir, 'baseline-after.json'));
    assert.equal(summary.exit_code, 0); assert.equal(summary.source_unchanged, true); assert.equal(summary.runner_unchanged, true);
    assert.deepEqual(summary.productDelta, { added: [], removed: [], changed: [] }); assert.deepEqual(summary.runnerDelta, { added: [], removed: [], changed: [] });
    assert.deepEqual(baselineBefore.product, expectedTestedManifest); assert.deepEqual(baselineBefore.product, baselineAfter.product);
    assert.equal(summary.sourceFingerprint, manifestFingerprint(expectedTestedManifest));
    assert.notEqual(summary.sourceFingerprint, proof.parentSourceFingerprintBefore);
    assert.equal(new Set(results.map(r => r.scenario_id)).size, matrix.length);
    assert.ok(originals.every(s => results.some(r => r.scenario_id === s.id)));
    const selected = results.filter(r => r.selection_status === 'SELECTED');
    assert.deepEqual([...new Set(selected.map(r => r.scenario_id))].sort(), ['HARNESS-015', 'INDEX-001']);
    assert.ok(selected.every(r => r.execution_status === 'PASS'));
    const layerWorkflow = selected.find(r => r.scenario_id === 'INDEX-001' && r.phase !== 'NATIVE_BASELINE');
    assert.ok(layerWorkflow, 'selected real Core/CLI Layer case is present');
    assert.ok(layerWorkflow.commands.some(c => c.argv.includes('add')));
    const frozenSourceFile = path.join(runDir, 'source/src/core/index.ts');
    assert.equal(fileHash(frozenSourceFile), testedSourceHash);
    assert.equal(fs.existsSync(path.join(copyRoot, '.workshop/briefs')), false);

    // A legitimate later source state must not invalidate this immutable run.
    fs.appendFileSync(sourceFile, '\n// R-01 later authorized fixture source, after the execution snapshot.\n');
    const currentSourceHash = fileHash(sourceFile), currentSourceFingerprint = manifestFingerprint(fileManifest(copyRoot, ['src']));
    assert.notEqual(currentSourceHash, testedSourceHash); assert.notEqual(currentSourceFingerprint, summary.sourceFingerprint);
    const reportOutput = path.join(copyRoot, 'new-report');
    await run('03-copied-report', process.execPath, [path.join(copyRoot, 'scripts/git-compat/report.mjs'), '--run-dir', runDir, '--out', reportOutput], { timeout: 180000 });
    const validation = read(path.join(reportOutput, 'PACKAGE-VALIDATION.json')), manifest = read(path.join(reportOutput, 'MANIFEST.json'));
    assert.equal(validation.execution_eligible_pass, true); assert.equal(validation.execution_exit_code, 0); assert.equal(validation.current_product_not_required_to_equal_historical_source, true);
    assert.equal(validation.source_unchanged_during_execution, true); assert.equal(validation.matrix_scenario_ids, matrix.length); assert.equal(validation.original_ids_preserved, originals.length);
    assert.equal(validation.all_hashes_verified, true); assert.equal(validation.results_validated, true); assert.equal(validation.relative_entry_links_verified, true);
    assert.equal(manifest.scenario_ids, matrix.length); assert.equal(manifest.original_ids_preserved, originals.length);
    assert.ok(manifest.files.every(f => !/(?:^|\/)(?:node_modules|\.git|briefs)(?:\/|$)/u.test(f.path)));
    assert.equal(manifest.files.find(f => f.path === 'source/src/core/index.ts').sha256, testedSourceHash);
    const zip = path.join(reportOutput, validation.zip), names = inspectZipNames(zip);
    assert.ok(names.entries.every(e => !e.contains_backslash));
    const zipFiles = names.entries.filter(e => !e.directory).map(e => e.name).sort();
    assert.deepEqual(zipFiles, [...manifest.files.map(f => f.path), 'MANIFEST.json'].sort());
    assert.equal(fileHash(zip), validation.sha256);
    const reopenedRoots = fs.readdirSync(path.join(copyRoot, '.workshop')).filter(name => /^v-[a-f0-9]+$/u.test(name));
    assert.equal(reopenedRoots.length, 1);
    let reopened = path.join(copyRoot, '.workshop', reopenedRoots[0]);
    for (const f of manifest.files) { const file = safeEvidence(reopened, f.path); assert.equal(fileHash(file), f.sha256); assert.equal(fs.statSync(file).size, f.bytes); }
    const reporter = read(path.join(reopened, 'REPORTER.json'));
    assert.equal(reporter.execution_runner_fingerprint, summary.runnerFingerprint);
    assert.ok(reporter.files.some(f => f.path === 'scripts/git-compat/report.mjs' && f.sha256 === fileHash(path.join(copyRoot, f.path))));
    assert.equal(fileHash(path.join(reopened, 'source/src/core/index.ts')), testedSourceHash);
    assert.notEqual(fileHash(path.join(reopened, 'source/src/core/index.ts')), currentSourceHash);
    assert.equal(new Set(read(path.join(reopened, 'runs', summary.id, 'results.json')).map(r => r.scenario_id)).size, matrix.length);
    assert.equal(fs.existsSync(path.join(copyRoot, '.workshop/briefs')), false);

    // A recipient has top-level source/ and runs/ID, without runDir/source or
    // the original .workshop. Reopen the actual ZIP and render that layout.
    const extracted = path.join(copyRoot, 'extracted-report'), ps = path.join(env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const extractCommand = '$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & ([scriptblock]::Create([IO.File]::ReadAllText($env:GIT_COMPAT_PACKAGE_SCRIPT))) -ArchiveToCheck $env:GIT_COMPAT_ZIP_INPUT -CheckDirectory $env:GIT_COMPAT_ZIP_CHECK';
    await run('04-extract-real-package', ps, ['-NoProfile', '-Command', extractCommand], { envOverrides: { GIT_COMPAT_PACKAGE_SCRIPT: path.join(copyRoot, 'scripts/git-compat/package.ps1'), GIT_COMPAT_ZIP_INPUT: zip, GIT_COMPAT_ZIP_CHECK: extracted } });
    const extractedRun = path.join(extracted, 'runs', summary.id);
    assert.equal(fs.existsSync(path.join(extractedRun, 'source')), false);
    assert.equal(fileHash(path.join(extracted, 'source/src/core/index.ts')), testedSourceHash);
    const workshop = path.join(copyRoot, '.workshop'), preservedWorkshop = path.join(copyRoot, '.workshop-preserved');
    const ownership = read(path.join(copyRoot, '.git-compat-owned.json'));
    assert.equal(ownership.nonce, fixture.nonce); assert.equal(ownership.parent, fixture.parent);
    assert.ok(within(copyRoot, workshop) && within(copyRoot, preservedWorkshop));
    assert.equal(fs.lstatSync(workshop).isSymbolicLink(), false); assert.equal(fs.existsSync(preservedWorkshop), false);
    fs.renameSync(workshop, preservedWorkshop);
    reopened = path.join(preservedWorkshop, reopenedRoots[0]);
    assert.equal(fs.existsSync(workshop), false);
    const reexportOutput = path.join(copyRoot, 'new-report-from-export');
    await run('05-report-extracted-without-workshop', process.execPath, [path.join(copyRoot, 'scripts/git-compat/report.mjs'), '--run-dir', extractedRun, '--out', reexportOutput]);
    const reexport = read(path.join(reexportOutput, 'PACKAGE-VALIDATION.json'));
    assert.equal(reexport.execution_eligible_pass, true); assert.equal(reexport.results_validated, true); assert.equal(reexport.all_hashes_verified, true);
    assert.equal(reexport.matrix_scenario_ids, matrix.length); assert.equal(reexport.original_ids_preserved, originals.length);
    assert.equal(fs.statSync(workshop).isDirectory(), true); assert.equal(fs.existsSync(path.join(workshop, 'briefs')), false);
    assert.equal(fileHash(sourceFile), currentSourceHash);

    const extractedResults = path.join(extractedRun, 'results.json'), originalResults = fs.readFileSync(extractedResults), rejectedIdentityOutput = path.join(copyRoot, 'must-reject-foreign-result');
    try {
      const foreign = JSON.parse(originalResults); foreign[0].run_id = 'run-foreign-identity'; json(extractedResults, foreign);
      const rejected = await run('06-reject-foreign-result', process.execPath, [path.join(copyRoot, 'scripts/git-compat/report.mjs'), '--run-dir', extractedRun, '--out', rejectedIdentityOutput], { expectedCode: 2 });
      assert.match(rejected.stderr, /Result provenance disagrees/u); assert.equal(fs.existsSync(rejectedIdentityOutput), false);
    } finally { fs.writeFileSync(extractedResults, originalResults); }
    const extractedMatrix = path.join(extractedRun, 'matrix.json'), originalMatrix = fs.readFileSync(extractedMatrix), rejectedMatrixOutput = path.join(copyRoot, 'must-reject-foreign-matrix');
    try {
      const foreign = JSON.parse(originalMatrix); foreign.scenarios[0].title += ' synthetic unarchived change'; json(extractedMatrix, foreign);
      const rejected = await run('07-reject-unarchived-matrix', process.execPath, [path.join(copyRoot, 'scripts/git-compat/report.mjs'), '--run-dir', extractedRun, '--out', rejectedMatrixOutput], { expectedCode: 2 });
      assert.match(rejected.stderr, /Run matrix disagrees/u); assert.equal(fs.existsSync(rejectedMatrixOutput), false);
    } finally { fs.writeFileSync(extractedMatrix, originalMatrix); }
    assert.deepEqual(fs.readFileSync(extractedResults), originalResults); assert.deepEqual(fs.readFileSync(extractedMatrix), originalMatrix);

    proof.run = { id: summary.id, exit: summary.exit_code, selected: selected.map(r => r.scenario_id + '/' + r.variant_id), allIds: matrix.length, originalIds: originals.length, sourceFingerprint: summary.sourceFingerprint, runnerFingerprint: summary.runnerFingerprint, currentSourceFingerprint, sourceUnchangedDuringExecution: true, runnerUnchangedDuringExecution: true };
    proof.sources = { initialCopyHash: sourceBefore, testedHash: testedSourceHash, laterCurrentHash: currentSourceHash, archivedHash: fileHash(path.join(reopened, 'source/src/core/index.ts')), currentDiffersFromTested: true };
    proof.report = { validation, reporter, canonicalZipNames: true, allReopenedHashesChecked: manifest.files.length, noPrivateBrief: true, dependencies: 'Existing parent node_modules reused only for module loading via owned junction; never installed, modified or exported' };
    proof.reportFromExtracted = { validation: reexport, runDirSourceAbsent: true, sourceLayout: 'package-top-level/source', newWorkshopCreated: true, originalWorkshopRenamedInsideOwnedFixture: true, currentSourceStillDiffersFromTested: true, foreignResultRejectedExit: 2, unarchivedMatrixRejectedExit: 2, negativeDestinationsNeverCreated: true, originalInputsRestoredExactly: true };
    for (const [from, to] of [[zip, 'fresh-copy-report.zip'], [path.join(reportOutput, 'PACKAGE-VALIDATION.json'), 'PACKAGE-VALIDATION.json'], [path.join(reportOutput, 'RELATORIO-TECNICO.md'), 'RELATORIO-TECNICO.md'], [path.join(reportOutput, 'MANIFEST.json'), 'nested-MANIFEST.json'], [path.join(reopened, 'REPORTER.json'), 'REPORTER.json'], ...['summary.json', 'baseline-before.json', 'baseline-after.json', 'source-manifest.json', 'results.json', 'selection.json'].map(name => [path.join(runDir, name), 'run-' + name])]) fs.copyFileSync(from, path.join(evidenceRoot, to), fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(path.join(reexportOutput, reexport.zip), path.join(evidenceRoot, 'reported-again-from-extracted.zip'), fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(path.join(reexportOutput, 'PACKAGE-VALIDATION.json'), path.join(evidenceRoot, 'REEXPORTED-PACKAGE-VALIDATION.json'), fs.constants.COPYFILE_EXCL);
    assert.equal(fileHash(sourceFile), currentSourceHash, 'report does not modify the current copy source');
  } catch (error) { proof.error = String(error.stack ?? error); throw error; }
  finally {
    if (fs.existsSync(dependencyLink)) {
      assert.equal(fs.lstatSync(dependencyLink).isSymbolicLink(), true); assert.equal(fs.realpathSync(dependencyLink), dependencies);
      fs.unlinkSync(dependencyLink);
    }
    cleanupFixture(fixture);
    const parentAfter = fileManifest(project, ['src']); proof.parentSourceFingerprintAfter = manifestFingerprint(parentAfter); proof.parentProductUnchanged = JSON.stringify(parentAfter) === JSON.stringify(parentBefore);
    json(path.join(evidenceRoot, 'fresh-copy-proof.json'), proof);
    assert.deepEqual(parentAfter, parentBefore, 'parent product sources remain byte-for-byte unchanged');
  }
});
