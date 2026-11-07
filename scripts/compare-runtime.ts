import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { environment, prepare, type Timing } from './benchmark.ts';
import { gitExe, projectRoot } from '../tests/helpers.ts';

type Runtime = 'javascript' | 'typescript';
type BaselineKind = 'javascript' | 'compiled-typescript';
interface RuntimeCycle {
  runtime: Runtime;
  on: Timing;
  off: Timing;
}
interface TimingDelta {
  commandMs: number;
  commandPercent: number;
  verifiedMs: number;
  verifiedPercent: number;
  verificationMs: number;
  verificationPercent: number;
}
interface RuntimePair {
  repetition: number;
  order: [Runtime, Runtime];
  javascript: RuntimeCycle;
  typescript: RuntimeCycle;
  delta: { on: TimingDelta; off: TimingDelta };
}

function difference(typescript: Timing, javascript: Timing): TimingDelta {
  return {
    commandMs: typescript.commandMs - javascript.commandMs,
    commandPercent: 100 * (typescript.commandMs - javascript.commandMs) / javascript.commandMs,
    verifiedMs: typescript.verifiedMs - javascript.verifiedMs,
    verifiedPercent: 100 * (typescript.verifiedMs - javascript.verifiedMs) / javascript.verifiedMs,
    verificationMs: typescript.verificationMs - javascript.verificationMs,
    verificationPercent: 100 * (typescript.verificationMs - javascript.verificationMs) / javascript.verificationMs,
  };
}
function statistics(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const minimum = sorted[0];
  const maximum = sorted.at(-1);
  const lower = sorted[Math.floor((sorted.length - 1) / 2)];
  const upper = sorted[Math.floor(sorted.length / 2)];
  assert.ok(minimum !== undefined && maximum !== undefined && lower !== undefined && upper !== undefined);
  return { count: sorted.length, median: (lower + upper) / 2, minimum, maximum };
}
function timingSummary(values: Timing[]) {
  return {
    commandMs: statistics(values.map(value => value.commandMs)),
    verifiedMs: statistics(values.map(value => value.verifiedMs)),
    verificationMs: statistics(values.map(value => value.verificationMs)),
  };
}
function summaries(samples: RuntimePair[]) {
  const runtime = (name: Runtime) => ({
    on: timingSummary(samples.map(sample => sample[name].on)),
    off: timingSummary(samples.map(sample => sample[name].off)),
  });
  return {
    javascript: runtime('javascript'),
    typescript: runtime('typescript'),
    pairedDelta: {
      onMs: statistics(samples.map(sample => sample.delta.on.commandMs)),
      onPercent: statistics(samples.map(sample => sample.delta.on.commandPercent)),
      offMs: statistics(samples.map(sample => sample.delta.off.commandMs)),
      offPercent: statistics(samples.map(sample => sample.delta.off.commandPercent)),
    },
  };
}

const baselineRoot = process.argv[2];
assert.ok(baselineRoot, 'Usage: node scripts/compare-runtime.ts <baseline checkout> [output.json]');
const baselineKind = process.env.GIT_LAYER_BASELINE_KIND || 'javascript';
assert.ok(baselineKind === 'javascript' || baselineKind === 'compiled-typescript');
const roots: Record<Runtime, string> = { javascript: path.resolve(baselineRoot), typescript: projectRoot };
const count = Number(process.env.GIT_LAYER_COMPARE_COUNT || 100);
assert.ok(Number.isInteger(count) && count > 0);
const layout = process.env.GIT_LAYER_COMPARE_LAYOUT || 'distributed';
assert.ok(layout === 'distributed' || layout === 'exclusive');
const repetitions = Number(process.env.GIT_LAYER_BENCH_SAMPLES || 10);
assert.ok(Number.isInteger(repetitions) && repetitions > 0);
const output = path.resolve(process.argv[3] || path.join(projectRoot, 'docs', 'runtime-comparison.json'));
const fileMetadata = (root: string, file: string) => {
  const bytes = fs.readFileSync(path.join(root, file));
  return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
};
const sourceFiles = (runtime: Runtime) => {
  const extension = runtime === 'javascript' && baselineKind === 'javascript' ? 'mjs' : 'ts';
  return [`src/core.${extension}`, `src/cli.${extension}`, 'bin/git-layer', 'bin/git-layer.cmd']
    .map(file => fileMetadata(roots[runtime], file));
};
const sources = { javascript: sourceFiles('javascript'), typescript: sourceFiles('typescript') };
const generatedAssets = baselineKind === 'compiled-typescript'
  ? ['dist/core.js', 'dist/cli.js'].map(file => fileMetadata(roots.javascript, file)) : [];
if (baselineKind === 'compiled-typescript') {
  for (const file of ['src/core.ts', 'src/cli.ts']) {
    const baselineSource = sources.javascript.find(source => source.file === file);
    const nativeSource = sources.typescript.find(source => source.file === file);
    assert.ok(baselineSource && nativeSource);
    assert.equal(baselineSource.sha256, nativeSource.sha256, `Compiled and native runtimes must use identical canonical ${file}`);
  }
}
const diagnosticFile = 'scripts/compare-runtime.ts';
const diagnostic = { file: diagnosticFile, sha256: createHash('sha256').update(fs.readFileSync(path.join(projectRoot, diagnosticFile))).digest('hex') };
const { f, sample: preparation, verify } = await prepare(count, layout);
const samples: RuntimePair[] = [];
const warmups: RuntimeCycle[] = [];
const report: {
  schema: number;
  environment: ReturnType<typeof environment>;
  count: number;
  baselineKind: BaselineKind;
  git: string;
  repetitions: number;
  layout: string;
  sources: typeof sources;
  generatedAssets: typeof generatedAssets;
  diagnostic: typeof diagnostic;
  revisions: Record<Runtime, string>;
  method: Record<string, string>;
  preparation: typeof preparation;
  warmups: RuntimeCycle[];
  samples: RuntimePair[];
  summaries?: ReturnType<typeof summaries>;
  completed?: boolean;
  failed?: string;
  retainedFixture?: string;
} = {
  schema: 1, environment: environment(), count, baselineKind, git: f.git(['--version']).trim(), repetitions, layout, sources, generatedAssets, diagnostic,
  revisions: {
    javascript: f.git(['rev-parse', 'HEAD'], { cwd: roots.javascript }).trim(),
    typescript: f.git(['rev-parse', 'HEAD'], { cwd: roots.typescript }).trim(),
  },
  method: {
    command: 'Complete git layer subprocess through the real launcher, including startup and every file operation; only the child PATH prefix selects baseline JavaScript or native TypeScript.',
    baseline: baselineKind === 'compiled-typescript'
      ? 'The javascript role runs JavaScript emitted from the same canonical TypeScript Core and CLI as the native typescript role; matching canonical source hashes are required and generated assets are hashed separately.'
      : 'The javascript role runs the original JavaScript baseline; the typescript role runs the migrated TypeScript natively.',
    fixture: 'One disposable repository, identical files, Git Layer index and refs for both runtimes; prepare() uses the TypeScript CLI and the existing ' + layout + ' layout.',
    observer: 'Original prepare().verify() checks all contents or absences, all other-origin contents, conventional HEAD and main-index bytes after every command.',
    warmups: 'One complete on/off cycle per runtime, recorded separately; the javascript-role warmup is the first populated Git extraction and the native typescript-role warmup follows it. Neither is included in paired summaries.',
    pairs: repetitions + ' measured pairs; baseline JavaScript/native TypeScript order alternates each pair. Every cycle starts inactive, activates and verifies, then deactivates and verifies.',
    delta: (baselineKind === 'compiled-typescript'
      ? 'Positive deltas mean native TypeScript is slower than JavaScript emitted from the same TypeScript source; '
      : 'Positive deltas mean native TypeScript is slower than the original JavaScript baseline; ')
      + 'each pair records absolute milliseconds and percentages for command, verification and their total.',
    limits: 'Local warm/uncontrolled OS caches and timing variation; no concurrent agent tests or benchmarks. Descriptive observations, not a statistical equivalence claim.',
  },
  preparation, warmups, samples,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
const checkpoint = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const invoke = (runtime: Runtime, args: string[]): void => {
  const env = { ...f.env, PATH: path.join(roots[runtime], 'bin') + path.delimiter + (f.env.PATH || '') };
  const result = spawnSync(gitExe, ['layer', ...args], {
    cwd: f.root, env, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${runtime}: git layer ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
};
const measure = async (runtime: Runtime, command: string[], present: boolean): Promise<Timing> => {
  const start = performance.now();
  invoke(runtime, command);
  const completed = performance.now();
  await verify(present);
  const verified = performance.now();
  return { commandMs: completed - start, verifiedMs: verified - start, verificationMs: verified - completed };
};
const cycle = async (runtime: Runtime): Promise<RuntimeCycle> => ({
  runtime,
  on: await measure(runtime, ['on', 'scripts'], true),
  off: await measure(runtime, ['off', 'scripts'], false),
});
try {
  checkpoint();
  for (const runtime of ['javascript', 'typescript'] as const) {
    warmups.push(await cycle(runtime));
    checkpoint();
  }
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    const order: [Runtime, Runtime] = repetition % 2 ? ['javascript', 'typescript'] : ['typescript', 'javascript'];
    const results = new Map<Runtime, RuntimeCycle>();
    for (const runtime of order) results.set(runtime, await cycle(runtime));
    const javascript = results.get('javascript');
    const typescript = results.get('typescript');
    assert.ok(javascript && typescript);
    const sample = { repetition, order, javascript, typescript, delta: { on: difference(typescript.on, javascript.on), off: difference(typescript.off, javascript.off) } };
    samples.push(sample);
    checkpoint();
    console.log(JSON.stringify(sample));
  }
  report.summaries = summaries(samples);
  report.completed = true;
  checkpoint();
  console.log(JSON.stringify(report.summaries));
  console.log(`Raw paired runtime samples: ${output}`);
  f.cleanup();
} catch (error) {
  report.failed = error instanceof Error ? error.message : String(error);
  report.retainedFixture = path.basename(path.dirname(f.root));
  checkpoint();
  throw error;
}
