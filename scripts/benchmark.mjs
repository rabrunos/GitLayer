import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { fixture, projectRoot, gitExe } from '../tests/helpers.mjs';

export function elapsed(action) {
  const start = performance.now();
  const result = action();
  return { ms: performance.now() - start, result };
}

export function data(count, layout) {
  const directoryCount = layout === 'distributed' ? Math.min(count, 100) : 1;
  const files = new Map();
  for (let i = 0; i < count; i++) {
    const folder = layout === 'distributed' ? `shared/d${String(i % directoryCount).padStart(3, '0')}` : 'scripts';
    const content = (`GitLayer deterministic payload ${i}\n` + 'x'.repeat(256)).slice(0, 255) + '\n';
    files.set(`${folder}/script-${String(i).padStart(5, '0')}.txt`, content);
  }
  return { files, directoryCount, bytes: [...files.values()].reduce((sum, s) => sum + Buffer.byteLength(s), 0) };
}

export function prepare(count, layout) {
  const setup = elapsed(() => fixture());
  const f = setup.result;
  const sample = { count, layout, fixtureMs: setup.ms };
  const generated = data(count, layout);
  const untouched = new Map([['app/base.txt', f.read('app/base.txt')]]);
  sample.applicationAndCompanionSetupMs = elapsed(() => {
    for (let i = 0; i < generated.directoryCount; i++) {
      const folder = layout === 'distributed' ? `shared/d${String(i).padStart(3, '0')}` : 'app';
      const p = `${folder}/main-${i}.txt`;
      f.write(p, 'Application file\n');
      untouched.set(p, 'Application file\n');
    }
    f.git(['add', '.']);
    f.git(['commit', '-m', 'Benchmark application files']);
    f.layer(['create', 'companion']);
    f.layer(['on', 'companion']);
    for (let i = 0; i < generated.directoryCount; i++) {
      const folder = layout === 'distributed' ? `shared/d${String(i).padStart(3, '0')}` : 'companion';
      const p = `${folder}/other-${i}.txt`;
      f.write(p, 'Other Layer file\n');
      untouched.set(p, 'Other Layer file\n');
    }
    f.layer(['add', 'companion', '.']);
    f.layer(['commit', 'companion', '-m', 'Benchmark companion files']);
  }).ms;
  sample.createAndIndexMs = elapsed(() => f.layer(['create', 'scripts'])).ms;
  sample.emptyActivationMs = elapsed(() => f.layer(['on', 'scripts'])).ms;
  sample.sourceFileGenerationMs = elapsed(() => {
    for (const [p, content] of generated.files) f.write(p, content);
  }).ms;
  sample.addMs = elapsed(() => f.layer(['add', 'scripts', '.'])).ms;
  sample.commitMs = elapsed(() => f.layer(['commit', 'scripts', '-m', `Benchmark ${count} ${layout}`])).ms;
  sample.extraMaterializationPreparationMs = 0;
  const head = f.head();
  const mainIndex = f.mainIndex();
  assert.equal(f.files('layer/scripts').length, count);
  assert.equal(f.files('main').filter(p => generated.files.has(p)).length, 0);
  const verify = present => {
    for (const [p, content] of generated.files) {
      if (present) assert.equal(f.read(p), content, p);
      else assert.equal(fs.existsSync(path.join(f.root, p)), false, p);
    }
    for (const [p, content] of untouched) assert.equal(f.read(p), content, p);
    assert.equal(f.head(), head, 'Conventional HEAD changed');
    assert.deepEqual(f.mainIndex(), mainIndex, 'Conventional index bytes changed');
  };
  const measure = (command, present) => {
    const start = performance.now();
    f.layer(command);
    const completed = performance.now();
    verify(present);
    const verified = performance.now();
    return { commandMs: completed - start, verifiedMs: verified - start, verificationMs: verified - completed };
  };
  // Measured preparation: removes generated source files, not an extraction from Git.
  sample.initialOffPreparation = measure(['off', 'scripts'], false);
  sample.files = generated.files.size;
  sample.bytes = generated.bytes;
  sample.directories = generated.directoryCount;
  sample.sharedWithMainAndAnotherLayer = layout === 'distributed';
  return { f, sample, files: generated.files, verify, measure };
}

export function environment() {
  return {
    date: new Date().toISOString(), platform: process.platform, release: os.release(), arch: process.arch,
    cpu: os.cpus()[0]?.model, logicalCpus: os.availableParallelism(), totalMemoryBytes: os.totalmem(),
    node: process.version, gitExecutable: gitExe, fixtureVolume: path.parse(os.tmpdir()).root,
    sources: ['src/core.mjs', 'src/cli.mjs', 'bin/git-layer', 'bin/git-layer.cmd', 'tests/helpers.mjs', 'scripts/benchmark.mjs', 'scripts/compare-materialization.mjs'].map(file => {
      const bytes = fs.readFileSync(path.join(projectRoot, file));
      return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }),
    caches: 'Ordinary OS/Git caches; no cold-cache claim; no GitLayer materialization cache.',
  };
}

function main() {
  const repetitions = Number(process.env.GIT_LAYER_BENCH_SAMPLES || 3);
  assert.ok(Number.isInteger(repetitions) && repetitions > 0);
  const report = {
    schema: 1, environment: environment(), repetitions,
    method: {
      primary: 'verifiedMs: wall clock from CLI invocation through full content/absence, other-origin content, HEAD and main-index-byte verification.',
      command: 'commandMs: complete synchronous CLI process, including process startup and all command effects.',
      preparation: 'Fixture initialization, other origins, Layer/index creation, empty on, source generation, add, commit and initial off are separately timed. No populated extraction precedes firstOn.',
      layouts: 'Distributed: up to 100 directories each containing main and companion Layer files. Exclusive: one Layer-only scripts directory.',
      files: '256-byte deterministic text files, no filesystem cache purge, no compression or sparse placeholders.',
      integrity: 'Every file read and compared byte-for-byte after on/reactivate; every absent path checked after off; other-origin bytes, conventional HEAD and index bytes checked each time.',
      scope: 'Controlled disposable repositories; no concurrent writers, filters, hooks, LFS, collisions or recovery.',
    }, samples: [],
  };
  const output = path.resolve(process.argv[2] || path.join(projectRoot, 'docs', 'benchmarks.json'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const checkpoint = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  checkpoint();
  const shapes = [[10, 'distributed'], [100, 'distributed'], [1000, 'distributed'], [10000, 'distributed'], [10000, 'exclusive']];
  for (const [count, layout] of shapes) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      const { f, sample, measure } = prepare(count, layout);
      try {
        sample.repetition = repetition;
        sample.git = f.git(['--version']).trim();
        sample.firstOn = measure(['on', 'scripts'], true);
        sample.off = measure(['off', 'scripts'], false);
        sample.reactivate = measure(['on', 'scripts'], true);
        sample.verified = true;
        report.samples.push(sample);
        checkpoint();
        console.log(JSON.stringify({ count, layout, repetition, firstOn: sample.firstOn, off: sample.off, reactivate: sample.reactivate }));
        f.cleanup();
      } catch (error) {
        sample.failed = error.message;
        sample.retainedFixture = path.basename(path.dirname(f.root));
        if (!report.samples.includes(sample)) report.samples.push(sample);
        checkpoint();
        throw error;
      }
    }
  }
  checkpoint();
  console.log(`Raw samples: ${output}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();