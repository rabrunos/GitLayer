import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { prepare, elapsed, environment, type BenchmarkSample, type Timing } from './benchmark.ts';
import { projectRoot, gitExe } from '../tests/helpers.ts';

interface StrategyTiming extends Timing {
  cleanup?: Timing;
  extractionMs?: number;
  publicationMs?: number;
  archiveMs?: number;
  archiveBytes?: number;
  cacheOff?: Timing;
  cachedReactivate?: Timing;
}
type StrategyName = 'checkoutIndexDirect' | 'checkoutTemporaryThenRename' | 'archiveThenTar';
interface MaterializationSample extends BenchmarkSample {
  currentCLI?: { firstOn: Timing; off: Timing; reactivate: Timing; finalOff: Timing };
  readTreeIndexMs?: number;
  strategies?: Partial<Record<StrategyName, StrategyTiming>>;
  order?: StrategyName[];
}

const count = Number(process.env.GIT_LAYER_COMPARE_COUNT || 10000);
const repetitions = Number(process.env.GIT_LAYER_BENCH_SAMPLES || 3);
assert.ok(Number.isInteger(count) && count > 0);
assert.ok(Number.isInteger(repetitions) && repetitions > 0);
const samples: MaterializationSample[] = [];
const report = {
  schema: 1, environment: environment(), count, layout: 'distributed', repetitions,
  method: {
    primary: 'verifiedMs: complete strategy plus comparison of every file, conventional HEAD/index and the other origins.',
    command: 'commandMs includes complete subprocess/file operations; no time-to-first-file measurement.',
    alternatives: 'Native checkout-index directly; native checkout-index into private directory then rename every file; native archive creation then tar extraction; cached per-file rename reactivation.',
    preparation: 'Each sample records the same explicit fixture/source/add/commit/initial-off preparation as benchmark.ts. Private read-tree index creation is separately timed.',
    cache: 'Cached reactivation avoids Git extraction but adds first extraction/publication and retained materialization plus per-file off renames; ordinary OS caches are warm/uncontrolled.',
    observer: 'Async content reads in batches of 64; initial baseline at commit 35e1638 used a synchronous observer.',
    order: 'Strategy order rotates per repetition. Preparation and filesystem removal between strategies are reported, outside activation times.',
  }, samples,
};
const output = path.resolve(process.argv[2] || path.join(projectRoot, 'docs', 'materialization-comparison-typescript.json'));
fs.mkdirSync(path.dirname(output), { recursive: true });
const checkpoint = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
checkpoint();
for (let repetition = 1; repetition <= repetitions; repetition++) {
  const { f, sample: preparation, files, verify, measure: measureCLI } = await prepare(count, 'distributed');
  const sample: MaterializationSample = preparation;
  try {
    sample.currentCLI = {
      firstOn: await measureCLI(['on', 'scripts'], true),
      off: await measureCLI(['off', 'scripts'], false),
      reactivate: await measureCLI(['on', 'scripts'], true),
      finalOff: await measureCLI(['off', 'scripts'], false),
    };
    const index = path.join(f.root, '.git', 'comparison-index');
    const cache = path.join(f.root, '.git', 'comparison-cache');
    const archive = path.join(f.root, '.git', 'comparison.tar');
    const env = { ...f.env, GIT_INDEX_FILE: index };
    const run = (executable: string, args: string[], commandEnv: NodeJS.ProcessEnv = env): void => {
      const result = spawnSync(executable, args, { cwd: f.root, env: commandEnv, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `${executable} ${args.join(' ')}: ${result.stderr}`);
    };
    const git = (args: string[]): void => run(gitExe, args);
    sample.readTreeIndexMs = elapsed(() => git(['read-tree', 'layer/scripts'])).ms;
    sample.repetition = repetition;
    sample.git = f.git(['--version']).trim();
    sample.strategies = {};
    const measure = async (action: () => void | Promise<void>, present = true): Promise<StrategyTiming> => {
      const start = performance.now();
      await action();
      const complete = performance.now();
      await verify(present);
      const verified = performance.now();
      return { commandMs: complete - start, verifiedMs: verified - start, verificationMs: verified - complete };
    };
    const remove = () => measure(() => {
      for (const p of files.keys()) fs.unlinkSync(path.join(f.root, p));
    }, false);
    const renameEach = (from: string, to: string): void => {
      for (const p of files.keys()) {
        const destination = path.join(to, p);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.renameSync(path.join(from, p), destination);
      }
    };
    const strategies: [StrategyName, () => Promise<StrategyTiming>][] = [
      ['checkoutIndexDirect', async () => {
        const result = await measure(() => git(['checkout-index', '--all', '--force', '--index']));
        result.cleanup = await remove();
        return result;
      }],
      ['checkoutTemporaryThenRename', async () => {
        let extractionMs: number | undefined;
        let publicationMs: number | undefined;
        const result = await measure(() => {
          fs.mkdirSync(cache, { recursive: true });
          extractionMs = elapsed(() => git(['checkout-index', '--all', '--force', `--prefix=${cache.replaceAll('\\', '/')}/`])).ms;
          publicationMs = elapsed(() => renameEach(cache, f.root)).ms;
        });
        result.extractionMs = extractionMs;
        result.publicationMs = publicationMs;
        result.cacheOff = await measure(() => renameEach(f.root, cache), false);
        result.cachedReactivate = await measure(() => renameEach(cache, f.root));
        result.cleanup = await remove();
        return result;
      }],
      ['archiveThenTar', async () => {
        let archiveMs: number | undefined;
        let extractionMs: number | undefined;
        const result = await measure(() => {
          archiveMs = elapsed(() => git(['archive', '--format=tar', `--output=${archive}`, 'layer/scripts'])).ms;
          const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
          extractionMs = elapsed(() => run(tar, ['-xf', archive, '-C', f.root], f.env)).ms;
        });
        result.archiveMs = archiveMs;
        result.extractionMs = extractionMs;
        result.archiveBytes = fs.statSync(archive).size;
        result.cleanup = await remove();
        return result;
      }],
    ];
    const offset = (repetition - 1) % strategies.length;
    const ordered = [...strategies.slice(offset), ...strategies.slice(0, offset)];
    sample.order = ordered.map(([name]) => name);
    for (const [name, strategy] of ordered) {
      sample.strategies[name] = await strategy();
      console.log(JSON.stringify({ repetition, count, strategy: name, ...sample.strategies[name] }));
    }
    sample.verified = true;
    report.samples.push(sample);
    checkpoint();
    f.cleanup();
  } catch (error) {
    sample.failed = error instanceof Error ? error.message : String(error);
    sample.retainedFixture = path.basename(path.dirname(f.root));
    if (!report.samples.includes(sample)) report.samples.push(sample);
    checkpoint();
    throw error;
  }
}
checkpoint();
console.log(`Raw strategy samples: ${output}`);