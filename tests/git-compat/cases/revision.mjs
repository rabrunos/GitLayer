import path from 'node:path';
import { project } from '../../../scripts/git-compat/lib.mjs';

const control = (id, variant, title, file, timeout = 120000) => ({
  id, variant, title, profile: 'N0', tier: id === 'HARNESS-026' ? 'broad' : 'smoke', phase: 'HARNESS', productStatus: 'NOT_ASSESSED', capabilities: ['node'], timeout,
  async run(c) {
    const evidenceRoot = path.join(c.artifactDir, 'regression');
    const r = await c.run(process.execPath, ['--test', '--test-concurrency=1', ...[].concat(file).map(name => path.join(project, 'tests/git-compat/infra', name))], {
      timeout: timeout - 5000, env: { GIT_COMPAT_INFRA_EVIDENCE_ROOT: evidenceRoot },
    });
    c.eq('Real regression subprocess exits successfully', r.code, 0);
    c.ok('Node test runner records zero failures', /(?:#|ℹ) fail 0\b/.test(r.stdout));
    return { limits: ['Infrastructure controls use synthetic fixtures. Their PASS does not certify product functionality; detailed expected/observed process outcomes remain attached.'] };
  },
});
export const cases = [
  control('HARNESS-024', 'supervisor-final-process-state', 'A proposed PASS cannot override worker failure, timeout, truncation or protocol errors', 'supervisor.test.mjs'),
  control('HARNESS-025', 'selection-and-expectation-evolution', 'Strict CLI selection, extensible matrix and versioned exact expectations', ['extensibility.test.mjs', 'runtime-expectations.test.mjs']),
  control('HARNESS-026', 'fresh-copy-and-archived-report', 'Fresh source baseline and portable archived report without a historical brief', 'portability.test.mjs', 480000),
];
