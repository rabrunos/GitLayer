import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { environment } from './benchmark.ts';
import { fixture, gitExe, projectRoot } from '../tests/helpers.ts';

type Runtime = 'javascript' | 'typescript';
interface StartupSample {
  repetition: number;
  runtime: Runtime;
  commandMs: number;
}

const baselineRoot = process.argv[2];
assert.ok(baselineRoot, 'Usage: node scripts/compare-startup.ts <JavaScript baseline checkout> [output.json]');
const baseline = path.resolve(baselineRoot);
const output = path.resolve(process.argv[3] || path.join(projectRoot, 'docs', 'startup-comparison.json'));
const sources: Record<Runtime, string> = {
  javascript: path.join(baseline, 'src', 'cli.mjs'),
  typescript: path.join(projectRoot, 'src', 'cli.ts'),
};
for (const file of Object.values(sources)) assert.ok(fs.existsSync(file), file);
const revision = spawnSync(gitExe, ['rev-parse', 'HEAD'], { cwd: baseline, encoding: 'utf8', windowsHide: true });
if (revision.error) throw revision.error;
assert.equal(revision.status, 0, revision.stderr);
const f = fixture();
const samples: StartupSample[] = [];
let expectedOutput: string | undefined;
function invoke(runtime: Runtime): number {
  const start = performance.now();
  const result = spawnSync(process.execPath, [sources[runtime], '--help'], {
    cwd: f.root, env: f.env, encoding: 'utf8', windowsHide: true,
  });
  const commandMs = performance.now() - start;
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  if (expectedOutput === undefined) expectedOutput = result.stdout;
  assert.equal(result.stdout, expectedOutput, 'Both CLIs must print identical help');
  return commandMs;
}
function summarize(runtime: Runtime) {
  const values = samples.filter(sample => sample.runtime === runtime).map(sample => sample.commandMs).sort((a, b) => a - b);
  const lower = values[Math.floor((values.length - 1) / 2)];
  const upper = values[Math.floor(values.length / 2)];
  assert.ok(lower !== undefined && upper !== undefined);
  return { count: values.length, medianMs: (lower + upper) / 2, minimumMs: values[0], maximumMs: values.at(-1) };
}
try {
  for (let warmup = 0; warmup < 3; warmup++) {
    invoke('javascript');
    invoke('typescript');
  }
  for (let repetition = 1; repetition <= 30; repetition++) {
    const order: Runtime[] = repetition % 2 ? ['javascript', 'typescript'] : ['typescript', 'javascript'];
    for (const runtime of order) samples.push({ repetition, runtime, commandMs: invoke(runtime) });
  }
  const report = {
    schema: 1,
    environment: environment(),
    baselineRevision: revision.stdout.trim(),
    method: {
      command: 'Complete Node CLI --help process, including module loading, native type stripping where applicable, output and process exit.',
      isolation: 'Same disposable repository, Node executable and isolated environment; no Git operations in measured command; no other test/benchmark run by the agent in parallel.',
      order: 'Three warmups per runtime, followed by thirty samples per runtime with alternating JavaScript/TypeScript order.',
      integrity: 'Exit zero, empty stderr and byte-identical stdout required for every invocation.',
      caches: 'Ordinary warm/uncontrolled OS caches; no cold-cache claim.',
    },
    sources: Object.entries(sources).map(([runtime, file]) => ({
      runtime, file: path.basename(file), sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    })),
    samples,
    summaries: { javascript: summarize('javascript'), typescript: summarize('typescript') },
    verified: true,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summaries));
  console.log(`Raw startup samples: ${output}`);
  f.cleanup();
} catch (error) {
  console.error(`Fixture retained for inspection: ${f.root}`);
  throw error;
}