import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { parseTapSummary, parseValidationArgs, phaseCommand, phases } from '../../scripts/validate-performance-recovery.mjs';
import { project } from '../../scripts/git-compat/lib.mjs';

test('performance validation full uses exactly the npm headless corpus and budgets through Node argv', () => {
  const packageInfo = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
  const full = phaseCommand('full', os.tmpdir());
  assert.equal(full.executable, process.execPath);
  assert.deepEqual(full.argv.filter(arg => !arg.startsWith('--test-reporter')), packageInfo.scripts.test.split(/\s+/u).slice(1));
  assert.equal(full.timeoutMs, 3 * 60 * 60 * 1000);
  assert(full.argv.includes('--test-reporter-destination=stdout'));
  assert(full.argv.includes('--test-reporter-destination=stderr'));
  const infra = phaseCommand('infra', os.tmpdir());
  assert.deepEqual(infra.argv.filter(arg => !arg.startsWith('--test-reporter') && !arg.startsWith('--test-timeout=')), packageInfo.scripts['compat:infra'].split(/\s+/u).slice(1));
  const focus = phaseCommand('focus', os.tmpdir());
  for (const file of ['tests/unit/performance-validation.test.mjs', 'tests/unit/assert-bytes.test.ts', 'tests/integration/index-query.test.ts', 'tests/integration/deactivation-concurrency.test.ts', 'tests/integration/staging-racy.test.ts', 'tests/integration/recovery-index-timestamp.test.ts', 'tests/unit/git-startup-benchmark.test.mjs', 'tests/git-compat/infra/external-fixtures.test.mjs', 'tests/integration/performance-discovery.test.ts', 'tests/integration/performance-streaming.test.ts', 'tests/integration/performance-recovery.test.ts', 'tests/integration/performance-journal.test.ts', 'tests/integration/performance-journal-recovery.test.ts']) assert(focus.argv.includes(file), 'New regression file omitted from focus: ' + file);
});

test('performance validation runs one explicit phase and rejects invalid selectors before creating outputs', () => {
  assert.deepEqual(parseValidationArgs(['--help']), { help: true });
  const out = path.join(os.tmpdir(), 'gl-validation-uncreated-' + randomUUID());
  for (const args of [[], ['--phase', 'all', '--out', out], ['--phase', 'full', '--out', out, '--phase', 'infra'], ['--phase', 'full', '--out', 'relative'], ['--phase', 'full', '--unknown', 'value']]) {
    assert.throws(() => parseValidationArgs(args), { code: 'VALIDATION_SELECTION_INVALID' });
    assert.equal(fs.existsSync(out), false);
  }
  const broad = phaseCommand('broad', out);
  assert.equal(broad.argv.at(-1), path.join(out, 'matrix'));
  assert.equal(broad.argv[broad.argv.indexOf('--jobs') + 1], '2');
  assert.throws(() => phaseCommand('all', out), { code: 'VALIDATION_SELECTION_INVALID' });
  assert.deepEqual(phases, ['focus', 'full', 'infra', 'broad', 'typecheck', 'build', 'smoke']);
});

test('performance validation parses only final TAP totals and keeps failures, skips and cancellation distinct', () => {
  const prefix = 'TAP version 13\n    # tests 999\n# Subtest: synthetic runner control\nok 1 - synthetic runner control\n';
  assert.deepEqual(parseTapSummary(prefix + '# tests 6\n# suites 0\n# pass 2\n# fail 1\n# cancelled 1\n# skipped 1\n# todo 1\n# duration_ms 10.5\n'), {
    format: 'Node.js TAP final summary', counts: { tests: 6, suites: 0, pass: 2, fail: 1, cancelled: 1, skipped: 1, todo: 1, duration_ms: 10.5 }, complete: true, consistent: true,
  });
  assert.equal(parseTapSummary(prefix).complete, false);
  assert.equal(parseTapSummary('# tests 6\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n').consistent, false);
});
