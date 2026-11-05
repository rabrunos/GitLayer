import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeArtifactRoot } from '../../../scripts/git-compat/sanitize-history.mjs';
import { project, createFixture, cleanupFixture, fileHash, json, walk, relative } from '../../../scripts/git-compat/lib.mjs';
import { externalFixtureParent } from '../../../scripts/git-compat/fixture-parent.mjs';

const snapshot = root => Object.fromEntries(walk(root).map(file => [relative(root, file), fileHash(file)]));
const classification = result => ({ execution_status: result.execution_status, product_status: result.product_status, known_failure: result.known_failure, known_issue_id: result.known_issue_id, failure_category: result.failure_category, assertion_passed: result.assertions.map(a => a.passed) });

test('portable offline redaction preserves raw evidence, binary/source bytes, failures and updates declared hashes', t => {
  const f = createFixture(externalFixtureParent(project), 'redaction'); t.after(() => cleanupFixture(f));
  const root = path.join(f.root, 'artifacts'), dir = path.join(root, 'runs/r1/cases/c1'), backup = path.join(f.root, 'raw'); fs.mkdirSync(dir, { recursive: true });
  const host = 'C:\\Users\\Synthetic Person', stream = path.join(dir, '1.stderr'); fs.writeFileSync(stream, 'failure at ' + host + '\\file; S-1-5-21-123-456\n');
  const raw = fs.readFileSync(stream), result = { execution_status: 'FAIL', assertions: [{ passed: false, expected: 'preserved', observed: 'not preserved' }], error: 'failure at ' + host, evidence: [{ path: 'runs/r1/cases/c1/1.stderr', sha256: fileHash(stream), bytes: raw.length }] };
  json(path.join(dir, 'result.json'), result); json(path.join(root, 'runs/r1/results.json'), [result]); fs.writeFileSync(path.join(root, 'runs/r1/results.jsonl'), JSON.stringify(result) + '\n');
  const source = path.join(root, 'runs/r1/source/user.txt'); fs.mkdirSync(path.dirname(source), { recursive: true }); fs.writeFileSync(source, host); fs.writeFileSync(path.join(dir, 'binary.bin'), Buffer.from([0, 255, 128]));
  const plan = sanitizeArtifactRoot({ root, backup, profiles: [host], dryRun: true }); assert.ok(plan.changed_files > 0); assert.deepEqual(fs.readFileSync(stream), raw); assert.equal(fs.existsSync(backup), false);
  const audit = sanitizeArtifactRoot({ root, backup, profiles: [host] }); assert.ok(audit.changed_files > 0); assert.deepEqual(fs.readFileSync(path.join(backup, 'runs/r1/cases/c1/1.stderr')), raw);
  assert.equal(fs.readFileSync(source, 'utf8'), host); assert.deepEqual(fs.readFileSync(path.join(dir, 'binary.bin')), Buffer.from([0, 255, 128]));
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')); assert.equal(after.execution_status, 'FAIL'); assert.equal(after.assertions[0].passed, false); assert.equal(after.evidence[0].sha256, fileHash(stream)); assert.ok(after.error.includes('<HOST-PROFILE>'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'runs/r1/results.json'), 'utf8'))[0], after);
  assert.throws(() => sanitizeArtifactRoot({ root, backup, profiles: [host] }), /fresh/);
});

test('existing summaries and nested result homonyms are generic text while authoritative hashes and classifications survive', t => {
  const f = createFixture(externalFixtureParent(project), 'redaction-layout'); t.after(() => cleanupFixture(f));
  const root = path.join(f.root, 'artifacts'), dir = path.join(root, 'runs/r-layout/cases/c-authority'), backup = path.join(f.root, 'raw');
  fs.mkdirSync(dir, { recursive: true });
  const host = 'C:\\Users\\Synthetic Person';
  const existing = path.join(root, 'existing/existing-fixture/results.json');
  json(existing, { id: 'existing-fixture', sourceFingerprint: 'source-preserved', sourceUnchanged: true, results: [{ name: 'integration-domain', exit: 1, signal: null, timed_out: true, summary: ['# fail 1'], path: host }] });
  const homonyms = [
    ['evidence/results.json', { kind: 'unrelated-object', execution_status: 'FAIL', path: host }],
    ['evidence/result.json', [{ execution_status: 'PASS', path: host, evidence: [{ path: 'not-authoritative/missing', sha256: '0'.repeat(64), bytes: 99 }] }]],
    ['regression/runs/nested/cases/c2/result.json', { execution_status: 'FAIL', path: host, evidence: [{ path: 'not-authoritative/missing' }] }],
  ];
  for (const [name, value] of homonyms) json(path.join(dir, name), value);
  const genericLines = path.join(dir, 'evidence/results.jsonl'); fs.writeFileSync(genericLines, JSON.stringify({ execution_status: 'FAIL', path: host }) + '\n');
  const binary = path.join(dir, 'binary-evidence/results.json'); fs.mkdirSync(path.dirname(binary), { recursive: true }); fs.writeFileSync(binary, Buffer.from([0, 255, 128, 10]));
  const genericFiles = [existing, ...homonyms.map(([name]) => path.join(dir, name)), genericLines, binary];
  const result = { execution_status: 'FAIL', product_status: 'PRODUCT_GAP', known_failure: 'XFAIL_STRICT', known_issue_id: 'SYNTHETIC-KEEP', failure_category: 'ASSERTION', assertions: [{ passed: false, expected: 'A', observed: 'B' }], error: 'Synthetic semantic failure without host text', future_extension: { version: 99, note: 'retained' }, evidence: genericFiles.map(file => ({ path: relative(root, file), sha256: fileHash(file), bytes: fs.statSync(file).size })) };
  json(path.join(dir, 'result.json'), result); json(path.join(root, 'runs/r-layout/results.json'), [result]); fs.writeFileSync(path.join(root, 'runs/r-layout/results.jsonl'), JSON.stringify(result) + '\n');
  const before = snapshot(root), rawExisting = fs.readFileSync(existing), beforeClass = classification(result);
  const plan = sanitizeArtifactRoot({ root, backup, profiles: [host], dryRun: true });
  assert.deepEqual(snapshot(root), before); assert.equal(fs.existsSync(backup), false); assert.equal(fs.existsSync(path.join(root, 'SANITIZATION.json')), false);
  assert.deepEqual(plan.authoritative_files, { cases: 1, runs: 1, jsonl: 1 });
  assert.ok(plan.changes.some(change => change.path === 'runs/r-layout/cases/c-authority/result.json'), 'dry-run plans evidence hash updates even when authoritative text has no host identity');
  const audit = sanitizeArtifactRoot({ root, backup, profiles: [host] });
  assert.deepEqual(plan.changes.map(change => change.path).sort(), audit.changes.map(change => change.path).sort());
  assert.deepEqual(fs.readFileSync(path.join(backup, 'existing/existing-fixture/results.json')), rawExisting);
  const existingAfter = JSON.parse(fs.readFileSync(existing, 'utf8'));
  assert.equal(Array.isArray(existingAfter), false); assert.equal(existingAfter.id, 'existing-fixture'); assert.equal(existingAfter.results[0].exit, 1); assert.equal(existingAfter.results[0].timed_out, true); assert.equal(existingAfter.results[0].path, '<HOST-PROFILE>');
  assert.equal(existingAfter.sanitization_derivative, undefined, 'generic objects are not rewritten as result protocol');
  const object = JSON.parse(fs.readFileSync(path.join(dir, homonyms[0][0]), 'utf8')); assert.deepEqual(object, { kind: 'unrelated-object', execution_status: 'FAIL', path: '<HOST-PROFILE>' });
  const array = JSON.parse(fs.readFileSync(path.join(dir, homonyms[1][0]), 'utf8')); assert.equal(Array.isArray(array), true); assert.equal(array[0].execution_status, 'PASS'); assert.equal(array[0].path, '<HOST-PROFILE>'); assert.equal(array[0].evidence[0].sha256, '0'.repeat(64));
  const nested = JSON.parse(fs.readFileSync(path.join(dir, homonyms[2][0]), 'utf8')); assert.equal(nested.path, '<HOST-PROFILE>'); assert.equal(nested.evidence[0].path, 'not-authoritative/missing'); assert.equal(nested.sanitization_derivative, undefined);
  assert.deepEqual(JSON.parse(fs.readFileSync(genericLines, 'utf8')), { execution_status: 'FAIL', path: '<HOST-PROFILE>' }); assert.deepEqual(fs.readFileSync(binary), Buffer.from([0, 255, 128, 10]));
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
  assert.deepEqual(classification(after), beforeClass); assert.equal(after.sanitization_derivative, true);
  assert.deepEqual(after.future_extension, result.future_extension);
  for (const item of after.evidence) { const file = path.join(root, item.path); assert.equal(item.sha256, fileHash(file)); assert.equal(item.bytes, fs.statSync(file).size); }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'runs/r-layout/results.json'), 'utf8')), [after]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'runs/r-layout/results.jsonl'), 'utf8')), after);
});

test('single-run input uses artifact-base paths and leaves nearby existing summaries untouched', t => {
  const f = createFixture(externalFixtureParent(project), 'redaction-run'); t.after(() => cleanupFixture(f));
  const base = path.join(f.root, 'artifacts'), root = path.join(base, 'runs/one'), dir = path.join(root, 'cases/c1'), backup = path.join(f.root, 'raw'), host = 'C:\\Users\\Synthetic Person';
  const generic = path.join(dir, 'evidence/result.json'); json(generic, { literal: host, execution_status: 'FAIL', evidence: [{ path: 'unrelated/missing' }] });
  const nearby = path.join(base, 'existing/e1/results.json'); json(nearby, { id: 'e1', path: host, results: [{ exit: 1 }] }); const nearbyRaw = fs.readFileSync(nearby);
  const result = { execution_status: 'FAIL', known_failure: 'NONE', known_issue_id: null, failure_category: 'ASSERTION', assertions: [{ passed: false, expected: 1, observed: 2 }], error: host, evidence: [{ path: 'runs/one/cases/c1/evidence/result.json', sha256: fileHash(generic), bytes: fs.statSync(generic).size }] };
  json(path.join(dir, 'result.json'), result); json(path.join(root, 'results.json'), [result]); fs.writeFileSync(path.join(root, 'results.jsonl'), JSON.stringify(result) + '\n');
  const before = snapshot(base), plan = sanitizeArtifactRoot({ root, backup, profiles: [host], dryRun: true });
  assert.deepEqual(snapshot(base), before); assert.equal(fs.existsSync(backup), false); assert.deepEqual(plan.authoritative_files, { cases: 1, runs: 1, jsonl: 1 });
  sanitizeArtifactRoot({ root, backup, profiles: [host] }); assert.deepEqual(fs.readFileSync(nearby), nearbyRaw);
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')); assert.deepEqual(classification(after), classification(result)); assert.equal(after.error, '<HOST-PROFILE>'); assert.equal(after.evidence[0].sha256, fileHash(generic));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'results.json'), 'utf8')), [after]); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'results.jsonl'), 'utf8')), after);
  assert.equal(JSON.parse(fs.readFileSync(generic, 'utf8')).evidence[0].path, 'unrelated/missing');
});

test('invalid authoritative shapes fail before text writes in dry-run and real modes', t => {
  const invalid = [
    { kind: 'run-object', run: { id: 'wrong-layout-shape', results: [] }, expected: /Authoritative run results must be an array/ },
    { kind: 'case-array', run: [], case: [], expected: /Authoritative case result: .* must be an object/ },
    { kind: 'run-null-item', run: [null], expected: /Authoritative run result .* must be an object/ },
    { kind: 'run-array-item', run: [[]], expected: /Authoritative run result .* must be an object/ },
    { kind: 'run-evidence-object', run: [{ evidence: {} }], expected: /evidence must be an array/ },
    { kind: 'case-evidence-null', run: [], case: { evidence: null }, expected: /evidence must be an array/ },
    { kind: 'run-null-evidence-item', run: [{ evidence: [null] }], expected: /evidence entries require a path/ },
    { kind: 'run-invalid-evidence-path', run: [{ evidence: [{ path: null }] }], expected: /evidence entries require a path/ },
  ];
  for (const item of invalid) {
    const f = createFixture(externalFixtureParent(project), 'redaction-invalid'); t.after(() => cleanupFixture(f));
    const root = path.join(f.root, 'artifacts'), dir = path.join(root, 'runs/bad/cases/c1'), backup = path.join(f.root, 'raw'), host = 'C:\\Users\\Synthetic Person'; fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '0.stderr'), host);
    json(path.join(root, 'runs/bad/results.json'), item.run);
    if ('case' in item) json(path.join(dir, 'result.json'), item.case);
    const before = snapshot(root);
    for (const dryRun of [true, false]) { assert.throws(() => sanitizeArtifactRoot({ root, backup, profiles: [host], dryRun }), item.expected, item.kind); assert.deepEqual(snapshot(root), before); assert.equal(fs.existsSync(backup), false); }
  }
});
