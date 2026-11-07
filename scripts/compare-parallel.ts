import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { prepare, elapsed, environment, inBatches, type BenchmarkSample, type Timing } from './benchmark.ts';
import { projectRoot, gitExe } from '../tests/helpers.ts';

type RemovalMode = 'sync' | 'async';
type Phase = 'probe' | 'confirmation';
interface ParallelSample {
  phase: Phase;
  repetition: number;
  workers: number;
  removalMode: RemovalMode;
  checkout: Timing;
  removal: Timing;
  verified: boolean;
}
interface ParallelReport {
  schema: number;
  environment: ReturnType<typeof environment>;
  count: number;
  layout: 'distributed';
  samples: ParallelSample[];
  method: Record<string, string>;
  preparation?: BenchmarkSample;
  git?: string;
  readTreeIndexMs?: number;
  selectedWorker?: number;
  completed?: boolean;
  failed?: string;
  retainedFixture?: string;
}

async function main(): Promise<void> {
  const count = Number(process.env.GIT_LAYER_COMPARE_COUNT || 10000);
  assert.ok(Number.isInteger(count) && count > 0);
  const output = path.resolve(process.argv[2] || path.join(projectRoot, 'docs', 'parallel-comparison-typescript.json'));
  const report: ParallelReport = {
    schema: 1, environment: environment(), count, layout: 'distributed', samples: [],
    method: {
      primary: 'verifiedMs: complete command followed by verification of all file contents/absences, other origins, HEAD and conventional-index bytes.',
      command: 'commandMs ends after the complete checkout or unlink of all files. Child processes have exited and all filesystem calls completed.',
      observer: 'Async fs.promises.readFile in batches of 64. Different observer from the synchronous initial materialization baseline; all file bytes are still compared.',
      preparation: 'One disposable fixture, source generation/add/commit/initial off explicitly timed by prepare; one independent native read-tree index.',
      probes: 'Workers 1, 4 and 8, one complete extraction each, threshold zero via per-command -c only. Best observed commandMs selects the confirmation worker.',
      confirmations: 'Three subsequent extractions with the selected worker on the same fixture. Separate from selection samples; no cold-cache claim.',
      removal: 'Same file set removed completely after each extraction. Sync probes use unlinkSync; async uses fs.promises.unlink in batches of 64 with the default libuv pool. Each mode occurs three times.',
    },
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const checkpoint = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  checkpoint();
  console.log(JSON.stringify({ phase: 'prepare', count, directories: 100 }));
  const { f, sample: preparation, files, verify } = await prepare(count, 'distributed');
  report.preparation = preparation;
  report.git = f.git(['--version']).trim();
  try {
    const index = path.join(f.root, '.git', 'parallel-comparison-index');
    const env = { ...f.env, GIT_INDEX_FILE: index };
    const git = (args: string[]): void => {
      const result = spawnSync(gitExe, args, { cwd: f.root, env, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    };
    report.readTreeIndexMs = elapsed(() => git(['read-tree', 'layer/scripts'])).ms;
    checkpoint();
    console.log(JSON.stringify({ phase: 'prepared', preparation }));
    const measure = async (action: () => void | Promise<void>, present: boolean): Promise<Timing> => {
      const start = performance.now();
      await action();
      const completed = performance.now();
      await verify(present);
      const verified = performance.now();
      return { commandMs: completed - start, verifiedMs: verified - start, verificationMs: verified - completed };
    };
    const execute = async (workers: number, phase: Phase, repetition: number, removalMode: RemovalMode): Promise<void> => {
      console.log(JSON.stringify({ phase, repetition, workers, removalMode, state: 'starting' }));
      const checkout = await measure(() => git(['-c', `checkout.workers=${workers}`, '-c', 'checkout.thresholdForParallelism=0', 'checkout-index', '--all', '--force', '--index']), true);
      const removal = await measure(async () => {
        if (removalMode === 'sync') for (const p of files.keys()) fs.unlinkSync(path.join(f.root, p));
        else await inBatches(files.keys(), p => fs.promises.unlink(path.join(f.root, p)));
      }, false);
      const result = { phase, repetition, workers, removalMode, checkout, removal, verified: true };
      report.samples.push(result);
      checkpoint();
      console.log(JSON.stringify(result));
    };
    await execute(1, 'probe', 1, 'sync');
    await execute(4, 'probe', 1, 'async');
    await execute(8, 'probe', 1, 'sync');
    const best = [...report.samples].sort((a, b) => a.checkout.commandMs - b.checkout.commandMs)[0];
    assert.ok(best);
    report.selectedWorker = best.workers;
    checkpoint();
    for (let repetition = 1; repetition <= 3; repetition++) {
      await execute(report.selectedWorker, 'confirmation', repetition, repetition === 2 ? 'sync' : 'async');
    }
    report.completed = true;
    checkpoint();
    f.cleanup();
  } catch (error) {
    report.failed = error instanceof Error ? error.message : String(error);
    report.retainedFixture = path.basename(path.dirname(f.root));
    checkpoint();
    throw error;
  }
  console.log(`Raw parallel samples: ${output}`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });