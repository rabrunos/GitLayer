import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { context, createFixture, cleanupFixture, isolatedEnvironment, project } from '../../../scripts/git-compat/lib.mjs';

const source = 'docs/IMPLEMENTATION-2026-11-02.md GL-01/14/16 (three states, refusal/explicit discard and ownership); native Git object/index observation';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2)); };
const native = async (c, argv, options) => (await c.git(argv, options)).stdout;
const text = async (c, argv, options) => (await native(c, argv, options)).trim();
const list = value => value.split('\0').filter(Boolean).sort();
const cli = async (c, argv) => {
  const result = await c.cli(argv, { ok: [0, 2, 3, 4, 5] });
  const parsed = JSON.parse((result.stdout || result.stderr).trim());
  c.eq(`command.${argv[0]}.exit`, result.code, 0, source); c.eq(`command.${argv[0]}.ok`, parsed.ok, true, source);
  return parsed.result;
};

class InvalidSequence extends Error { constructor(message) { super(message); this.code = 'INVALID_SEQUENCE_PRECONDITION'; } }
function random(seed) {
  let value = parseInt(hash(String(seed)).slice(0, 8), 16) >>> 0;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return value >>> 0; };
}
export function recipe(seed, external) {
  const next = random(seed), payload = label => `${label} ${next().toString(16)}\n`;
  // Values, not an implementation of storage/projection: expected committed,
  // prepared and physical versions plus activation are the complete model.
  const steps = [ { type: 'edit', bytes: payload('prepared') }, { type: 'stage' }, { type: 'edit', bytes: payload('physical') } ];
  if (external) steps.push({ type: 'native-base-commit', bytes: payload('external-base') }, { type: 'recover' }, { type: 'native-clean', bytes: payload('temporary') });
  steps.push({ type: 'off' }, { type: 'on' });
  let active = true, committed = 'initial Layer\n', staged = committed, disk = committed;
  for (let i = 0; i < 6; i++) {
    const choices = active ? ['edit', 'stage', 'restore', 'unstage', 'off', ...(staged !== committed ? ['commit'] : [])] : ['on'];
    const type = choices[next() % choices.length]; const step = { type };
    if (type === 'edit') { step.bytes = payload(`generated-${i}`); disk = step.bytes; }
    if (type === 'stage') staged = disk;
    if (type === 'restore') disk = staged;
    if (type === 'unstage') staged = committed;
    if (type === 'commit') committed = staged;
    if (type === 'off') { active = false; staged = committed; disk = committed; }
    if (type === 'on') active = true;
    steps.push(step);
  }
  if (!active) steps.push({ type: 'on' });
  return steps;
}

async function initialize(c) {
  await c.init(); await c.layer('tools', 'layer.txt', 'initial Layer\n');
  const dir = await text(c, ['rev-parse', '--absolute-git-dir']);
  const registry = JSON.parse(fs.readFileSync(path.join(dir, 'layers', 'registry.json'), 'utf8'));
  const record = registry.layers.find(l => l.name === 'tools');
  const sentinel = path.join(c.root, 'sequence-sentinel.txt'); fs.writeFileSync(sentinel, 'outside repository sentinel\n');
  return { active: true, committed: 'initial Layer\n', staged: 'initial Layer\n', disk: 'initial Layer\n',
    main: await text(c, ['rev-parse', 'main']), ref: await text(c, ['rev-parse', 'layer/tools']),
    base: { 'base.txt': 'base one\n' }, index: path.join(dir, 'layers', 'indexes', `${record.id}.index`), sentinel, unsafe: false };
}

async function observe(c, model) {
  const env = { GIT_INDEX_FILE: model.index };
  c.eq('oracle.head.symbolic', await text(c, ['symbolic-ref', 'HEAD']), 'refs/heads/main', source);
  c.eq('oracle.main.ref', await text(c, ['rev-parse', 'main']), model.main, source);
  c.eq('oracle.layer.ref', await text(c, ['rev-parse', 'layer/tools']), model.ref, source);
  c.eq('oracle.base.index.paths', list(await native(c, ['ls-files', '-z'])), Object.keys(model.base).sort(), source);
  c.eq('oracle.base.commit.paths', list(await native(c, ['ls-tree', '-r', '--name-only', '-z', 'main'])), Object.keys(model.base).sort(), source);
  for (const [file, bytes] of Object.entries(model.base)) {
    c.eq(`oracle.base.index.${file}`, await native(c, ['show', `:${file}`]), bytes, source);
    c.eq(`oracle.base.commit.${file}`, await native(c, ['show', `main:${file}`]), bytes, source);
    c.eq(`oracle.base.disk.${file}`, c.read(file), bytes, source);
  }
  c.eq('oracle.layer.index.paths', list(await native(c, ['ls-files', '-z'], { env })), ['layer.txt'], source);
  c.eq('oracle.layer.staged.bytes', await native(c, ['show', ':layer.txt'], { env }), model.staged, source);
  c.eq('oracle.layer.commit.bytes', await native(c, ['show', 'layer/tools:layer.txt']), model.committed, source);
  c.eq('oracle.layer.disk.presence', c.exists('layer.txt'), model.active, source);
  if (model.active) c.eq('oracle.layer.disk.bytes', c.read('layer.txt'), model.disk, source);
  c.eq('oracle.external.sentinel', fs.readFileSync(model.sentinel, 'utf8'), 'outside repository sentinel\n', source);
}

async function apply(c, model, step, ordinal) {
  if (!model.active && !['on', 'recover'].includes(step.type)) throw new InvalidSequence(`${step.type} needs an active Layer`);
  if (model.unsafe && step.type !== 'recover') throw new InvalidSequence('external HEAD must be acknowledged before another managed action');
  switch (step.type) {
    case 'edit': c.write('layer.txt', step.bytes); model.disk = step.bytes; break;
    case 'stage': await cli(c, ['add', 'tools', '--', 'layer.txt']); model.staged = model.disk; break;
    case 'unstage': await cli(c, ['unstage', 'tools', '--', 'layer.txt']); model.staged = model.committed; break;
    case 'restore': await cli(c, ['restore', 'tools', '--yes', '--', 'layer.txt']); model.disk = model.staged; break;
    case 'commit': {
      if (model.staged === model.committed) throw new InvalidSequence('commit requires a staged semantic difference');
      const old = model.ref; await cli(c, ['commit', 'tools', '-m', `seed sequence ${ordinal}`]);
      model.ref = await text(c, ['rev-parse', 'layer/tools']);
      c.eq('oracle.layer.commit.parent', await text(c, ['rev-parse', 'layer/tools^']), old, source);
      model.committed = model.staged; break;
    }
    case 'off': {
      const dirty = model.committed !== model.staged || model.staged !== model.disk;
      if (dirty) {
        const refused = await c.cli(['off', 'tools'], { ok: [3] });
        c.eq('oracle.dirty.off.refusal', JSON.parse(refused.stderr || refused.stdout).error.code, 'LAYER_DIRTY', source);
        await observe(c, model);
        await cli(c, ['off', 'tools', '--discard', '--yes']);
        model.staged = model.committed; model.disk = model.committed;
      } else await cli(c, ['off', 'tools']);
      model.active = false; break;
    }
    case 'on': if (model.active) throw new InvalidSequence('generated on expects inactive state'); await cli(c, ['on', 'tools']); model.active = true; break;
    case 'native-base-commit': {
      const old = model.main; c.write('base.txt', step.bytes); c.write('ordinary-sequence.txt', `ordinary ${hash(step.bytes).slice(0, 8)}\n`);
      model.base['base.txt'] = step.bytes; model.base['ordinary-sequence.txt'] = c.read('ordinary-sequence.txt');
      await c.git(['add', '.']);
      c.eq('oracle.native.add.excludes.layer', list(await native(c, ['ls-files', '-z'])), Object.keys(model.base).sort(), 'U-08');
      await c.git(['commit', '-m', `external base sequence ${ordinal}`]); model.main = await text(c, ['rev-parse', 'main']);
      c.eq('oracle.native.commit.parent', await text(c, ['rev-parse', 'main^']), old, source); model.unsafe = false;
      const status = await cli(c, ['status']); c.eq('oracle.compatible.native.commit.safe', status.safe, true, source);
      break;
    }
    case 'recover': c.eq('oracle.optional.recover.idempotent', (await cli(c, ['recover'])).recovered, [], source); model.unsafe = false; break;
    case 'native-clean': c.write('temporary-sequence.txt', step.bytes); await c.git(['clean', '-fd']); c.eq('oracle.native.clean.ordinary.removed', c.exists('temporary-sequence.txt'), false); break;
    default: throw new InvalidSequence(`unknown action ${step.type}`);
  }
}

async function executeSequence(c, steps, label) {
  const model = await initialize(c), trace = [];
  let currentStep = -1;
  try {
    await observe(c, model);
    for (let i = 0; i < steps.length; i++) {
      currentStep = i;
      await apply(c, model, steps[i], i); await observe(c, model);
      trace.push({ ordinal: i, input: steps[i], expected: { active: model.active, committed: model.committed, staged: model.staged, disk: model.disk, base: structuredClone(model.base), unsafe: model.unsafe }, outcome: 'MATCH' });
    }
    return { trace, final: model };
  } catch (error) {
    error.sequenceStep = currentStep; error.sequencePrefix = steps.slice(0, currentStep + 1); throw error;
  } finally { save(path.join(c.artifactDir, `sequence-${label}.json`), { label, steps, trace, assertions: c.assertions }); }
}

async function replay(c, steps, attempt) {
  const fixture = createFixture(c.root, `counterexample-${attempt}`), artifactDir = path.join(c.artifactDir, 'reduction', String(attempt));
  const target = context({ ...c, root: fixture.root, repo: path.join(fixture.root, 'repo'), env: isolatedEnvironment(fixture.root, c.gitPath), artifactDir });
  let outcome;
  try { await executeSequence(target, steps, `replay-${attempt}`); outcome = { status: 'PASS' }; }
  catch (error) {
    const assertion = target.assertions.findLast(a => a.passed === false);
    outcome = { status: error.code === 'INVALID_SEQUENCE_PRECONDITION' ? 'INVALID_PRECONDITION' : error.code === 'ERR_ASSERTION' ? 'DIVERGENCE' : 'INFRASTRUCTURE_FAILURE', message: error.message, assertion: assertion && { id: assertion.id, expected: assertion.expected, observed: assertion.observed } };
  } finally {
    c.commands.push(...target.commands); cleanupFixture(fixture);
  }
  save(path.join(artifactDir, 'replay-outcome.json'), outcome); return outcome;
}

async function generated(c, external) {
  const seed = `${c.seed ?? '20261018'}:${external ? 'external' : 'managed'}`, steps = recipe(seed, external);
  save(path.join(c.artifactDir, 'seed-recipe.json'), { seed, generator: 'xorshift32-current-v2', expectationRevision: 'closure-2026-11-02-r2', steps, oracle: 'independent semantic committed/index/physical state and exact base tree', reduction: 'replay first failing prefix, then at most four greedy deletion candidates in new isolated fixtures; invalid preconditions retained in log' });
  try {
    await executeSequence(c, steps, 'original');
    return { limits: ['One seed and a bounded sequence of one existing Layer file; this is not all operations/permutations. Reduction is available on actual semantic divergence; no product divergence was fabricated to claim reduction execution.'] };
  } catch (error) {
    if (error.code !== 'ERR_ASSERTION') throw error;
    const failed = c.assertions.findLast(a => a.passed === false);
    let smallest = error.sequencePrefix; const attempts = [];
    const original = await replay(c, smallest, 0); attempts.push({ candidate: smallest, outcome: original });
    if (original.status === 'DIVERGENCE' && original.assertion?.id === failed?.id) {
      for (let i = 0, attempt = 1; i < smallest.length && attempt <= 4; i++, attempt++) {
        const candidate = smallest.filter((_, index) => index !== i), outcome = await replay(c, candidate, attempt); attempts.push({ candidate, outcome });
        if (outcome.status === 'DIVERGENCE' && outcome.assertion?.id === failed.id) { smallest = candidate; i = -1; }
      }
    }
    save(path.join(c.artifactDir, 'counterexample-reduction.json'), { seed, original: error.sequencePrefix, smallestObserved: smallest, attempts, minimality: 'BOUNDED_SEARCH_NOT_GLOBAL_MINIMUM', signature: failed?.id });
    throw error;
  }
}

const spec = (id, variant, title, profile, run, extra = {}) => ({ id, variant, title, profile, tier: 'broad', phase: 'CURRENT_PRODUCT', productStatus: 'VERIFIED_SUPPORTED', capabilities: [], timeout: 600000, run, ...extra });
export const cases = [
  spec('MODEL-006', 'seeded-real-cli-state-sequence', 'Seeded valid public CLI sequence checks committed/staged/disk states after every step', 'L3', c => generated(c, false)),
  spec('MODEL-007', 'seeded-native-and-managed-sequence', 'Seeded compatible native/base and managed Layer sequence checks exact trees without mandatory recovery', 'L3', c => generated(c, true)),
  spec('ENV-004', 'product-cli-separate-gitdir', 'Public Layer lifecycle works with a gitfile and separate metadata directory', 'L1', async c => {
    await c.init(); const head = await text(c, ['rev-parse', 'HEAD']), directory = path.join(c.root, 'separate-git-store');
    await c.git(['init', '--separate-git-dir', directory]); c.eq('gitfile.is.file', fs.statSync(path.join(c.repo, '.git')).isFile(), true);
    c.eq('gitdir.discovered', path.resolve(await text(c, ['rev-parse', '--absolute-git-dir'])), path.resolve(directory));
    await c.layer('tools', 'layer.txt', 'separate metadata\n');
    c.eq('main.preserved', await text(c, ['rev-parse', 'main']), head); c.eq('layer.native.blob', await native(c, ['show', 'layer/tools:layer.txt']), 'separate metadata\n');
    await cli(c, ['off', 'tools']); c.eq('off.file.absent', c.exists('layer.txt'), false); await cli(c, ['on', 'tools']); c.eq('on.bytes', c.read('layer.txt'), 'separate metadata\n');
    c.eq('metadata.in.discovered.directory', fs.existsSync(path.join(directory, 'layers', 'registry.json')), true); c.eq('status.safe', (await cli(c, ['status'])).safe, true);
  }),
  spec('MERGE-001', 'core-merge-not-implemented-native-ff', 'Core merge complement refuses while official Git can fast-forward the same topology', 'L0', async c => {
    await c.init(); await cli(c, ['init']); const old = await text(c, ['rev-parse', 'HEAD']), tree = await text(c, ['rev-parse', 'HEAD^{tree}']);
    const target = await text(c, ['commit-tree', tree, '-p', old, '-m', 'fast forward target']); await c.git(['branch', 'feature', target]);
    const index = await native(c, ['ls-files', '--stage', '-z']);
    const result = await c.run(process.execPath, [path.join(project, 'scripts/git-compat/core-call.mjs'), path.join(c.buildDir, 'core.mjs'), c.repo, 'advanced', JSON.stringify(['merge', ['--ff-only', 'feature']])], { ok: [1] });
    const error = JSON.parse(result.stderr).error; c.eq('core.refusal.exact', error.code, 'NOT_IMPLEMENTED'); c.eq('core.head.not.advanced', await text(c, ['rev-parse', 'HEAD']), old); c.eq('core.index.preserved', await native(c, ['ls-files', '--stage', '-z']), index); c.eq('core.disk.preserved', c.read('base.txt'), 'base one\n');
    await c.git(['merge', '--ff-only', 'feature']); c.eq('native.fast.forward', await text(c, ['rev-parse', 'HEAD']), target); c.eq('native.parent', await text(c, ['rev-parse', 'HEAD^']), old);
    return { productStatus: 'PRODUCT_GAP', findings: [{ id: 'CORE-MERGE-NOT-IMPLEMENTED', classification: 'PRODUCT_GAP', condition: 'Initialized product, no registered Layers, feature is direct descendant of main', command: 'Core advanced("merge", ["--ff-only", "feature"])', expected: 'Characterize absent managed merge separately from native fast-forward support', observed: { code: result.code, error, nativeHead: target }, source: 'src/core/index.ts:236-241', confidence: 'observed' }], limits: ['Only a true fast-forward topology is characterized; conflicts/abort/continue are not implemented or certified by this case.'] };
  }, { productStatus: 'PRODUCT_GAP' }),
];
