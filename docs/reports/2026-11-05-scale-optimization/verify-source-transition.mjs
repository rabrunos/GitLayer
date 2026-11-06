import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PIN = Object.freeze({
  path: 'tests/git-compat/cases/additional.mjs', oldBytes: 24649, newBytes: 29430,
  fullResult: 'bbd1f54f359073387c92e69b23c6c63b82be40435768b954867b0d65b33218e2', broadResult: 'e88c8fc0ad29250b8103f2c5d0db21b466ef41ceb2bb64a741910cddad5ad086',
  fullManifest: 'ebc33cf6ea88267eebc14c8adeb76a9bfe8c15288bb965c27b8172313fc513f9', broadManifest: '21063f39bb36a0ad9f83eb6fc1991c9cd1bb4db42582c01c1e41193df5a150b6',
  oldSha: '39723049690326a71b6d7c50d6053f02ada84935360f643b275107f341f5510a',
  newSha: '9e1b1047fd947aef64d36286b216f327adc9c2bbc6e9685d35f19995a5536acf',
  full: '1c0646a4edef5a2616050417dcba89abb5fd3e1ff2ed1f7a94b01bc333f4045d',
  broad: 'c5f919feb2de4cb4ef81d6011dcf1193eca5441afcdb6023f065e202e61350fc',
  core: '807ad17f66e41e3147792049797a48b56c919737734bbe2a847149a07909ee8b',
  benchmark: 'dcada2527e12c8b65b437f8011125798c484f75adba7c6727cd366657cf3dceb',
  runner: '7800196cefe33e3f6768864beccde7d47d03b53ce615cabd786bdc79e8a40761',
  clock: '6be8636d434964e1ddca42f14604f1c6828884866f8668c94c9209b277222322',
  audit: '0ab28aa3aea6d89a401958889ddd0ff739e574899d936bc4e6c4aa3776331d27',
  lib: 'bd36f29ee217d5bcfd2b2af38dd3e93090574b9b8ade0482b747eab3034f0b81',
  fixtureParent: '541fad4150ee6921e861795fac9b70c40fb456dd19a46d7815782f17bb12a930',
  outputRoot: '5a6b8df9ee1db83eb1dd3524faf67c26d135408c65f77a85ea12d3379c463071',
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const selfHash = () => hash(fs.readFileSync(fileURLToPath(import.meta.url)));
const fullGlobs = ['tests/unit/*.test.ts', 'tests/unit/*.test.mjs', 'tests/integration/*.test.ts', 'tests/integration/*.test.mjs'];
const fullArgv = ['--import', 'tsx', '--test', '--test-concurrency=2', '--test-timeout=900000', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=tap', '--test-reporter-destination=stderr', ...fullGlobs];
function plainFile(file) {
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular source/evidence file required');
  return { bytes: stat.size, sha256: hash(fs.readFileSync(file)) };
}
function phasePass(record, phase, fingerprint) {
  assert.equal(record.phase, phase); assert.equal(record.status, 'PASS'); assert.equal(record.error, null);
  assert.equal(record.process.exitCode, 0); assert.equal(record.process.signal, null); assert.equal(record.process.timedOut, false); assert.equal(record.process.outputTruncated, false);
  assert.equal(record.source.sourceUnchanged, true); assert.equal(record.source.beforeFingerprint, fingerprint); assert.equal(record.source.afterFingerprint, fingerprint); assert.equal(record.source.archive, 'source/'); assert.equal(record.source.count, 234);
}
function fullPass(record) {
  phasePass(record, 'full', PIN.full); assert.deepEqual(record.command.argv, fullArgv);
  assert(record.summary.complete && record.summary.consistent);
  const c = record.summary.counts; assert.equal(c.tests, 603); assert.equal(c.pass, 599); assert.equal(c.fail, 0); assert.equal(c.cancelled, 0); assert.equal(c.skipped, 4); assert.equal(c.todo, 0);
}
function broadPass(record) {
  phasePass(record, 'broad', PIN.broad);
  assert.equal(record.summary.format, 'compatibility-matrix'); assert.equal(record.summary.exitCode, 0); assert.equal(record.summary.sourceUnchanged, true); assert.equal(record.summary.runnerUnchanged, true); assert.equal(record.summary.selected, 361);
  const argv = record.command.argv; assert.equal(argv[0], 'scripts/git-compat/runner.mjs'); const flags = {};
  for (let i = 1; i < argv.length; i++) { const key = argv[i]; assert(['--suite', '--jobs', '--seed', '--out', '--keep-fixtures'].includes(key) && !Object.hasOwn(flags, key)); if (key === '--keep-fixtures') flags[key] = true; else { assert(i + 1 < argv.length); flags[key] = argv[++i]; } }
  assert.equal(flags['--suite'], 'broad'); assert.equal(flags['--jobs'], '2'); assert.equal(flags['--seed'], '20261105'); assert.equal(flags['--keep-fixtures'], true); assert(path.isAbsolute(flags['--out']));
}
function manifestJSON(root, expected) {
  assert.equal(plainFile(path.join(root, 'SOURCE-MANIFEST.json')).sha256, expected === PIN.full ? PIN.fullManifest : PIN.broadManifest);
  const source = read(path.join(root, 'SOURCE-MANIFEST.json')), after = read(path.join(root, 'AFTER-MANIFEST.json'));
  assert.equal(source.schema, 1); assert.equal(source.fingerprint, expected); assert.equal(after.fingerprint, expected); assert.deepEqual(after.inputs, source.inputs); assert.deepEqual(after.files, source.files); assert.equal(source.files.length, 234);
  assert.equal(hash(Buffer.from(JSON.stringify(source.files.map(f => [f.path, f.sha256])))), expected);
  assert.equal(new Set(source.files.map(f => f.path)).size, 234);
  for (const f of source.files) { assert(typeof f.path === 'string' && !path.isAbsolute(f.path) && !f.path.includes('\\') && !f.path.split('/').includes('..')); assert(Number.isSafeInteger(f.bytes) && f.bytes >= 0); assert.match(f.sha256, /^[a-f0-9]{64}$/); }
  return source;
}
export async function collectSourceTransition({ project, fullRoot, broadRoot, clockProgram }) {
  const fullFile = path.join(fullRoot, 'result.json'), broadFile = path.join(broadRoot, 'result.json');
  assert.equal(plainFile(fullFile).sha256, PIN.fullResult); assert.equal(plainFile(broadFile).sha256, PIN.broadResult);
  const full = read(fullFile), broad = read(broadFile); fullPass(full); broadPass(broad);
  const fm = manifestJSON(fullRoot, PIN.full), bm = manifestJSON(broadRoot, PIN.broad); assert.deepEqual(fm.inputs, bm.inputs);
  const fullArchive = path.join(fullRoot, 'source'), broadArchive = path.join(broadRoot, 'source');
  const bootstrap = [['scripts/git-compat/audit.mjs', PIN.audit], ['scripts/git-compat/lib.mjs', PIN.lib]];
  for (const [file, expected] of bootstrap) { const actual = plainFile(path.join(fullArchive, file)), declared = fm.files.find(f => f.path === file); assert.equal(actual.sha256, expected); assert.deepEqual(actual, { bytes: declared.bytes, sha256: declared.sha256 }); }
  // Import only the hash-verified frozen implementation and its hash-verified local dependency.
  const { fileManifest, manifestFingerprint } = await import(pathToFileURL(path.join(fullArchive, 'scripts/git-compat/audit.mjs')).href);
  const actualFull = fileManifest(fullArchive, fm.inputs), actualBroad = fileManifest(broadArchive, bm.inputs), actualLive = fileManifest(project, fm.inputs);
  assert.deepEqual(actualFull, fm.files, 'Actual full archive must match its sealed manifest'); assert.deepEqual(actualBroad, bm.files, 'Actual new broad archive must match its sealed manifest'); assert.deepEqual(actualLive, bm.files, 'Live functional files must equal the new broad archive');
  const old = fm.files.find(f => f.path === PIN.path), next = bm.files.find(f => f.path === PIN.path);
  assert.deepEqual(old, { path: PIN.path, sha256: PIN.oldSha, bytes: PIN.oldBytes }); assert.deepEqual(next, { path: PIN.path, sha256: PIN.newSha, bytes: PIN.newBytes });
  const expectedNew = fm.files.map(f => f.path === PIN.path ? { ...f, sha256: PIN.newSha, bytes: PIN.newBytes } : f);
  assert.deepEqual(bm.files, expectedNew, 'Exactly one fixed recipe can differ, including its byte count'); assert.equal(manifestFingerprint(expectedNew), PIN.broad);
  const unchanged = fm.files.filter(f => f.path !== PIN.path); assert.equal(unchanged.length, 233);
  const corpus = fm.files.filter(f => /^tests\/(?:unit|integration)\/[^/]+\.test\.(?:ts|mjs)$/u.test(f.path)), helpers = fm.files.filter(f => f.path.startsWith('tests/helpers/'));
  assert.equal(corpus.length, 60); assert(helpers.length > 0); assert(!corpus.some(f => f.path === PIN.path));
  assert.deepEqual(bm.files.filter(f => corpus.some(c => c.path === f.path)), corpus); assert.deepEqual(bm.files.filter(f => f.path.startsWith('tests/helpers/')), helpers);
  const core = fm.files.filter(f => f.path.startsWith('src/core/')); assert.equal(core.length, 22); assert.equal(manifestFingerprint(core), PIN.core); assert.deepEqual(bm.files.filter(f => f.path.startsWith('src/core/')), core);
  const benchmarkInputs = core.map(f => ({ path: f.path.slice('src/core/'.length), bytes: f.bytes, sha256: f.sha256 })).sort((a,b) => a.path.localeCompare(b.path)); assert(benchmarkInputs.every(f => !f.path.includes('/'))); assert.equal(hash(Buffer.from(JSON.stringify(benchmarkInputs))), PIN.benchmark);
  assert.equal(plainFile(path.join(project, 'scripts/benchmark-scale.mjs')).sha256, PIN.runner); assert.equal(plainFile(clockProgram).sha256, PIN.clock);
  for (const [name, expected] of [['lib.mjs', PIN.lib], ['fixture-parent.mjs', PIN.fixtureParent], ['output-root.mjs', PIN.outputRoot]]) assert.equal(plainFile(path.join(path.dirname(clockProgram), 'git-compat', name)).sha256, expected);
  const evidence = {
    schema: 1, kind: 'git-layer-one-recipe-source-transition-v1', fixedRecipe: { path: PIN.path, before: { bytes: PIN.oldBytes, sha256: PIN.oldSha }, after: { bytes: PIN.newBytes, sha256: PIN.newSha } },
    full: { functionalFingerprint: PIN.full, resultSha256: plainFile(fullFile).sha256, manifestSha256: plainFile(path.join(fullRoot, 'SOURCE-MANIFEST.json')).sha256, afterManifestSha256: plainFile(path.join(fullRoot, 'AFTER-MANIFEST.json')).sha256, status: full.status, counts: full.summary.counts, argv: full.command.argv, commandTimeoutMs: full.command.timeoutMs },
    broad: { functionalFingerprint: PIN.broad, resultSha256: plainFile(broadFile).sha256, manifestSha256: plainFile(path.join(broadRoot, 'SOURCE-MANIFEST.json')).sha256, afterManifestSha256: plainFile(path.join(broadRoot, 'AFTER-MANIFEST.json')).sha256, status: broad.status, selected: broad.summary.selected, counts: broad.summary.counts, commandArgvSha256: hash(Buffer.from(JSON.stringify(broad.command.argv))), retainedFixtures: true },
    verification: { functionalEntries: actualFull.length, unchangedEntries: unchanged.length, allSourceArchivesVerified: true, liveMatchesNewBroad: true, exactInputs: fm.inputs, unchangedManifestSha256: hash(Buffer.from(JSON.stringify(unchanged))), executedFullGlobs: fullGlobs, executedFullEntryCount: corpus.length, executedFullCorpusFingerprint: manifestFingerprint(corpus), executedFullCorpus: corpus, helperCount: helpers.length, helperFingerprint: manifestFingerprint(helpers), helpers, coreCount: core.length, coreTupleFingerprint: PIN.core, benchmarkFingerprint: PIN.benchmark, observerSha256: PIN.runner, clockRunnerSha256: PIN.clock, frozenAuditSha256: PIN.audit, frozenLibrarySha256: PIN.lib },
    qualification: 'The full actually ran on the original full fingerprint. The later complete broad uses a different fingerprint with one reviewed matrix-only recipe port. No full run on the later complete fingerprint is claimed. All other 233 functional entries, including the executed full corpus/helpers/runtime, are exact.',
  };
  const capture = () => {
    const f = fileManifest(fullArchive, fm.inputs), b = fileManifest(broadArchive, bm.inputs), live = fileManifest(project, fm.inputs);
    assert.deepEqual(f, fm.files); assert.deepEqual(b, bm.files); assert.deepEqual(live, bm.files);
    assert.equal(plainFile(fullFile).sha256, evidence.full.resultSha256); assert.equal(plainFile(broadFile).sha256, evidence.broad.resultSha256);
    for (const [file, expected] of bootstrap) assert.equal(plainFile(path.join(fullArchive, file)).sha256, expected);
    for (const [root, sourceSha, afterSha] of [[fullRoot, evidence.full.manifestSha256, evidence.full.afterManifestSha256], [broadRoot, evidence.broad.manifestSha256, evidence.broad.afterManifestSha256]]) { assert.equal(plainFile(path.join(root, 'SOURCE-MANIFEST.json')).sha256, sourceSha); assert.equal(plainFile(path.join(root, 'AFTER-MANIFEST.json')).sha256, afterSha); }
    return { fullFunctionalFingerprint: manifestFingerprint(f), broadFunctionalFingerprint: manifestFingerprint(b), liveFunctionalFingerprint: manifestFingerprint(live), fullManifestWithBytesSha256: hash(Buffer.from(JSON.stringify(f))), broadManifestWithBytesSha256: hash(Buffer.from(JSON.stringify(b))), liveManifestWithBytesSha256: hash(Buffer.from(JSON.stringify(live))), checkerSha256: selfHash() };
  };
  return { evidence, capture };
}
export function readApprovedProof(file, approvedSha) {
  assert.match(approvedSha, /^[a-f0-9]{64}$/); assert.equal(plainFile(file).sha256, approvedSha, 'The exact externally approved proof bytes are required');
  const proof = read(file); assert.equal(proof.schema, 1); assert.equal(proof.kind, 'approved-one-recipe-source-transition-proof'); assert.equal(proof.generatorSha256, selfHash());
  const e = proof.evidence; assert.equal(e.kind, 'git-layer-one-recipe-source-transition-v1'); assert.equal(e.full.functionalFingerprint, PIN.full); assert.equal(e.broad.functionalFingerprint, PIN.broad); assert.equal(e.full.status, 'PASS'); assert.equal(e.broad.status, 'PASS');
  assert.deepEqual(e.fixedRecipe, { path: PIN.path, before: { bytes: PIN.oldBytes, sha256: PIN.oldSha }, after: { bytes: PIN.newBytes, sha256: PIN.newSha } });
  assert.equal(e.verification.functionalEntries, 234); assert.equal(e.verification.unchangedEntries, 233); assert.equal(e.verification.allSourceArchivesVerified, true); assert.equal(e.verification.liveMatchesNewBroad, true); assert.equal(e.verification.executedFullEntryCount, 60); assert.equal(e.verification.coreTupleFingerprint, PIN.core); assert.equal(e.verification.benchmarkFingerprint, PIN.benchmark); assert.equal(e.verification.observerSha256, PIN.runner); assert.equal(e.verification.clockRunnerSha256, PIN.clock);
  return proof;
}
export async function verifyApprovedTransition({ proofFile, approvedProofSha, ...context }) {
  const proof = readApprovedProof(proofFile, approvedProofSha), recomputed = await collectSourceTransition(context); assert.deepEqual(recomputed.evidence, proof.evidence, 'Approved proof must equal a fresh verification of both actual archives and live input');
  const projection = { fullFunctionalFingerprint: PIN.full, broadFunctionalFingerprint: PIN.broad, liveFunctionalFingerprint: PIN.broad, sourceTransitionProofSha256: approvedProofSha, soleChangedRecipe: proof.evidence.fixedRecipe, unchangedExecutedFullCorpusFingerprint: proof.evidence.verification.executedFullCorpusFingerprint, unchangedHelperFingerprint: proof.evidence.verification.helperFingerprint, allSourceArchivesVerified: true };
  return { proof, projection, captureInputState() { assert.equal(plainFile(proofFile).sha256, approvedProofSha); return { ...recomputed.capture(), approvedProofSha256: approvedProofSha }; } };
}
export async function createSourceTransitionProof({ out, ...context }) {
  const collected = await collectSourceTransition(context); const { validateFixtureParent } = await import(pathToFileURL(path.join(context.project, 'scripts/git-compat/fixture-parent.mjs')).href); validateFixtureParent(path.dirname(out), { projectRoot: context.project }); assert(!fs.existsSync(out));
  const proof = { schema: 1, kind: 'approved-one-recipe-source-transition-proof', generatedAt: new Date().toISOString(), generatorSha256: selfHash(), evidence: collected.evidence };
  const bytes = Buffer.from(JSON.stringify(proof, null, 2) + '\n'); fs.writeFileSync(out, bytes, { flag: 'wx' }); return { file: path.basename(out), bytes: bytes.length, sha256: hash(bytes), rootApprovalRequiredBeforeBenchmark: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); assert.equal(args.shift(), '--create-proof-authorized', 'Proof generation requires explicit release after actual new broad PASS'); const o = {};
  while (args.length) { const key = args.shift(); assert(['--project', '--full-root', '--broad-root', '--clock-runner', '--out'].includes(key) && !Object.hasOwn(o, key) && args.length); o[key] = path.resolve(args.shift()); }
  for (const key of ['--project', '--full-root', '--broad-root', '--clock-runner', '--out']) assert(o[key]);
  process.stdout.write(JSON.stringify(await createSourceTransitionProof({ project: o['--project'], fullRoot: o['--full-root'], broadRoot: o['--broad-root'], clockProgram: o['--clock-runner'], out: o['--out'] })) + '\n');
}
