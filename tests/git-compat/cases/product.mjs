import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Product targets use the public CLI. Every state oracle below uses the official
// Git executable through c.git, never the product's src/core/git.ts adapter.
const source = 'docs/IMPLEMENTATION-2026-11-02.md GL-01/14/16/19/20/22/25; closure R-01; native Git independent object/index/bytes oracles';
const utf8 = value => Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
const sha = value => createHash('sha256').update(value).digest('hex');
const allowed = [0, 1, 2, 3, 4, 5, 128, 129, 130];
const spec = (id, variant, title, profile, tier, run, extra = {}) => ({ id, variant, title, profile, tier,
  capabilities: [], phase: 'CURRENT_PRODUCT', productStatus: 'VERIFIED_SUPPORTED', timeout: 180000, run, ...extra });
const git = async (c, args, options) => utf8((await c.git(args, options)).stdout).trim();
const raw = async (c, args, options) => utf8((await c.git(args, options)).stdout);
const index = (c, file) => raw(c, ['ls-files', '--stage', '-z'], file ? { env: { GIT_INDEX_FILE: file } } : {});
const cli = async (c, args, options = {}) => {
  const result = await c.cli(args, { ...options, ok: allowed });
  const output = utf8(result.stdout || result.stderr).trim();
  let body;
  try { body = JSON.parse(output); } catch { throw new Error(`Invalid CLI JSON: ${output.slice(0, 600)}`); }
  return { ...result, body, value: body.result, error: body.error };
};
const success = async (c, args, options) => {
  const result = await cli(c, args, options);
  c.eq(`cli.${args[0]}.exit`, result.code, 0, source);
  c.eq(`cli.${args[0]}.ok`, result.body.ok, true, source);
  return result.value;
};
const diagnostic = async c => {
  const result = await cli(c, ['doctor']);
  c.eq('doctor.exit.reflects.safe', result.code, result.value.safe ? 0 : 3, source);
  c.eq('doctor.envelope.reflects.safe', result.body.ok, result.value.safe, source);
  return result.value;
};
const refusal = async (c, args, codes, options) => {
  const result = await cli(c, args, options);
  c.ok(`cli.${args[0]}.refused`, result.code !== 0, 'nonzero exit', result.code, source);
  c.ok(`cli.${args[0]}.code`, [].concat(codes).includes(result.error?.code), codes, result.error, source);
  return result;
};
const setup = async c => { await c.init(); await success(c, ['init']); };
const fixtureMetadata = c => path.join(c.repo, '.git', fs.existsSync(path.join(c.repo, '.git', 'layers')) ? 'layers' : 'git-layers');
const record = (c, name = 'tools') => JSON.parse(fs.readFileSync(path.join(fixtureMetadata(c), 'registry.json'), 'utf8')).layers.find(l => l.name === name);
const layerIndex = (c, name = 'tools') => path.join(fixtureMetadata(c), 'indexes', record(c, name).id + '.index');
const layer = async (c, name = 'tools', file = 'layer.txt', bytes = 'layer one\n') => {
  await success(c, ['create', name]); await success(c, ['on', name]);
  c.write(file, bytes); await success(c, ['add', name, '--', file]);
  await success(c, ['commit', name, '-m', `fixture ${name}`]);
};
const finding = (id, condition, command, expected, observed, extra = {}) => ({ id, classification: 'PRODUCT_GAP',
  condition, command, expected, observed, source, confidence: 'observed', ...extra });
const restrictionFinding = (...args) => ({ ...finding(...args), classification: 'DOCUMENTED_RESTRICTION' });
const gap = findings => ({ productStatus: 'PRODUCT_GAP', findings });
const names = text => text.split('\0').filter(Boolean).sort();
const treeNames = (c, ref) => raw(c, ['ls-tree', '-r', '--name-only', '-z', ref]).then(names);
const inventory = directory => {
  const entries = [];
  const visit = (parent, prefix = '') => {
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      const rel = prefix + entry.name, full = path.join(parent, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Synthetic export fixture unexpectedly contains a link');
      if (entry.isDirectory()) { entries.push({ path: rel + '/', type: 'directory' }); visit(full, rel + '/'); }
      else if (entry.isFile()) entries.push({ path: rel, type: 'file', sha256: sha(fs.readFileSync(full)), bytes: fs.statSync(full).size });
      else throw new Error('Synthetic export fixture unexpectedly contains a special file');
    }
  };
  visit(directory); return entries.sort((a, b) => a.path.localeCompare(b.path));
};
async function verifiedExport(c, destination, label) {
  const gitDir = await git(c, ['rev-parse', '--absolute-git-dir']);
  const directory = path.join(gitDir, fs.existsSync(path.join(gitDir, 'layers')) ? 'layers' : 'git-layers');
  const before = inventory(directory), refs = await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)']), mainIndex = await index(c), disk = c.read('layer.txt');
  c.eq(`export.${label}.destination.initially.absent`, fs.existsSync(destination), false);
  const result = await success(c, ['recovery-export', destination]);
  c.eq(`export.${label}.complete`, result.complete, true);
  const manifest = JSON.parse(fs.readFileSync(path.join(destination, 'recovery-export.json'), 'utf8'));
  c.eq(`export.${label}.manifest.complete`, manifest.complete, true);
  const copied = path.join(destination, 'metadata', path.basename(directory));
  c.eq(`export.${label}.copied.metadata.exact`, inventory(copied), before);
  c.eq(`export.${label}.source.metadata.exact`, inventory(directory), before);
  c.eq(`export.${label}.source.refs.exact`, await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)']), refs);
  c.eq(`export.${label}.source.main.index`, await index(c), mainIndex);
  c.eq(`export.${label}.source.disk`, c.read('layer.txt'), disk);
  fs.writeFileSync(path.join(c.artifactDir, `export-${label}-observation.json`), JSON.stringify({ runtime: process.version, complete: result.complete, sourceBefore: before, sourceAfter: inventory(directory), copiedMetadata: inventory(copied), manifest }, null, 2));
}

async function ordinaryAdd(c, commit) {
  await setup(c); await layer(c, 'tools', 'tools/layer-only.txt');
  c.write('base.txt', 'base two\n'); c.write('ordinary-new.txt', 'ordinary\n');
  c.write('tools/layer-only.txt', 'layer dirty only\n');
  const before = { head: await git(c, ['rev-parse', 'HEAD']), ref: await git(c, ['rev-parse', 'layer/tools']),
    index: await index(c, layerIndex(c)) };
  await c.snapshot('before-native-add'); await c.git(['add', '.']);
  c.eq('main.index.names', names(await raw(c, ['ls-files', '-z'])), ['base.txt', 'ordinary-new.txt'], 'U-08; Git add');
  c.eq('main.index.base', await raw(c, ['show', ':base.txt']), 'base two\n');
  c.eq('main.index.new', await raw(c, ['show', ':ordinary-new.txt']), 'ordinary\n');
  c.eq('layer.index.unchanged', await index(c, layerIndex(c)), before.index);
  c.eq('layer.ref.unchanged', await git(c, ['rev-parse', 'layer/tools']), before.ref);
  c.eq('head.add.does.not.commit', await git(c, ['rev-parse', 'HEAD']), before.head);
  c.eq('layer.disk', c.read('tools/layer-only.txt'), 'layer dirty only\n');
  if (commit) {
    await c.git(['commit', '-m', 'native base only']);
    c.eq('commit.exact.tree', await treeNames(c, 'HEAD'), ['base.txt', 'ordinary-new.txt']);
    c.eq('commit.parent', await git(c, ['rev-parse', 'HEAD^']), before.head);
    c.eq('commit.layer.ref', await git(c, ['rev-parse', 'layer/tools']), before.ref);
    c.eq('commit.layer.index', await index(c, layerIndex(c)), before.index);
    const status = await success(c, ['status']);
    c.eq('product.compatible.native.head.safe', status.safe, true);
    c.eq('commit.layer.index.after.reconciliation', await index(c, layerIndex(c)), before.index);
    c.eq('commit.layer.disk.after.reconciliation', c.read('tools/layer-only.txt'), 'layer dirty only\n');
    return { limits: ['Compatible native base commit only; conflicting controls, overlap and unsupported topologies remain separately diagnosed.'] };
  }
}

export const cases = [
  spec('ENV-013', 'cli-headless-lifecycle', 'CLI headless creates, stages and commits a real Layer', 'L1', 'smoke', async c => {
    await setup(c); await success(c, ['--help']); await layer(c);
    c.eq('head.symbolic', await git(c, ['symbolic-ref', 'HEAD']), 'refs/heads/main');
    c.eq('layer.blob', await raw(c, ['show', 'layer/tools:layer.txt']), 'layer one\n');
    c.eq('base.tree', await treeNames(c, 'main'), ['base.txt']);
    c.eq('status.safe', (await success(c, ['status'])).safe, true);
    await c.git(['fsck', '--full', '--no-reflogs']);
  }),
  spec('INDEX-001', 'native-add-dot-layer', 'Native add . stages ordinary paths and excludes active Layer', 'L1', 'smoke', c => ordinaryAdd(c, false), { phase: 'USER_REQUIREMENT' }),
  spec('COMMIT-014', 'native-add-then-native-commit', 'Native commit after add . contains only the exact base tree', 'L1', 'daily', c => ordinaryAdd(c, true), { phase: 'USER_REQUIREMENT' }),
  spec('INDEX-006', 'forced-native-add-diagnosed', 'Forced native add bypasses excludes and is diagnosed', 'L5', 'daily', async c => {
    await setup(c); await layer(c); const head = await git(c, ['rev-parse', 'main']);
    await c.git(['add', '-f', '--', 'layer.txt']);
    c.eq('forced.index.blob', await raw(c, ['show', ':layer.txt']), 'layer one\n');
    c.eq('forced.product.safe', (await success(c, ['status'])).safe, false);
    await refusal(c, ['base-commit', '-m', 'must refuse'], ['PATH_COLLISION', 'BASE_CONTAMINATED']);
    c.eq('forced.main.preserved', await git(c, ['rev-parse', 'main']), head);
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['GL-01/09: explicit native -f bypasses ignore rules. Managed base commit diagnoses contamination; this is not universal interception.'] };
  }),
  spec('INDEX-019', 'layer-index-native-roundtrip', 'Official Git reads and writes a copy of the real Layer index', 'L3', 'smoke', async c => {
    await setup(c); await layer(c); c.write('layer.txt', 'staged two\n'); await success(c, ['add', 'tools', '--', 'layer.txt']);
    c.write('layer.txt', 'disk three\n'); const main = await index(c), original = await index(c, layerIndex(c));
    const copy = path.join(c.root, 'copied-layer.index'); fs.copyFileSync(layerIndex(c), copy);
    const env = { GIT_INDEX_FILE: copy };
    c.eq('native.index.copy', await index(c, copy), original);
    c.eq('native.index.blob', await raw(c, ['show', ':layer.txt'], { env }), 'staged two\n');
    const tree = await git(c, ['write-tree'], { env });
    await c.git(['read-tree', tree], { env }); c.eq('roundtrip.semantic', await index(c, copy), original);
    c.write('extra.txt', 'native new\n'); await c.git(['add', '--', 'extra.txt'], { env });
    c.eq('copy.can.stage', await raw(c, ['show', ':extra.txt'], { env }), 'native new\n');
    c.eq('original.preserved', await index(c, layerIndex(c)), original); c.eq('main.preserved', await index(c), main);
    c.eq('disk.third.state', c.read('layer.txt'), 'disk three\n');
  }),
  spec('INDEX-020', 'index-selection-subprocess-isolation', 'Interleaved CLI and native staging preserve three independent indexes', 'L2', 'daily', async c => {
    await setup(c); await layer(c, 'one', 'one.txt'); await layer(c, 'two', 'two.txt');
    c.write('one.txt', 'one staged\n'); await success(c, ['add', 'one', '--', 'one.txt']);
    c.write('two.txt', 'two staged\n'); await success(c, ['add', 'two', '--', 'two.txt']);
    c.write('base.txt', 'base staged\n'); await c.git(['add', '--', 'base.txt']);
    c.eq('base.index', await raw(c, ['show', ':base.txt']), 'base staged\n');
    for (const name of ['one', 'two']) {
      c.eq(`${name}.index.paths`, names(await raw(c, ['ls-files', '-z'], { env: { GIT_INDEX_FILE: layerIndex(c, name) } })), [`${name}.txt`]);
      c.eq(`${name}.index.content`, await raw(c, ['show', `:${name}.txt`], { env: { GIT_INDEX_FILE: layerIndex(c, name) } }), `${name} staged\n`);
    }
    c.eq('new.cli.safe', (await success(c, ['status'])).safe, true);
    c.eq('base.only.base', names(await raw(c, ['ls-files', '-z'])), ['base.txt']);
    return { limits: ['Effective GIT_INDEX_FILE use proven by resulting isolated entries; internal child environment is not instrumented.'] };
  }),
  spec('REMOTE-016', 'local-push-commit-not-stage', 'Local bare receiver receives committed A while staging B and disk C stay local', 'L3', 'daily', async c => {
    await setup(c); await layer(c, 'tools', 'layer.txt', 'committed A\n');
    const committed = await git(c, ['rev-parse', 'layer/tools']);
    c.write('layer.txt', 'staged B\n'); await success(c, ['add', 'tools', '--', 'layer.txt']); c.write('layer.txt', 'disk C\n');
    const before = await index(c, layerIndex(c)); const bare = path.join(c.root, 'receiver.git');
    await c.git(['init', '--bare', bare]); await c.git(['-c', 'protocol.file.allow=always', 'push', bare, 'refs/heads/layer/tools:refs/heads/layer/tools']);
    c.eq('receiver.ref', await git(c, ['--git-dir', bare, 'rev-parse', 'refs/heads/layer/tools']), committed);
    c.eq('receiver.blob', await raw(c, ['--git-dir', bare, 'show', 'refs/heads/layer/tools:layer.txt']), 'committed A\n');
    c.eq('local.staged', await raw(c, ['show', ':layer.txt'], { env: { GIT_INDEX_FILE: layerIndex(c) } }), 'staged B\n');
    c.eq('local.index.preserved', await index(c, layerIndex(c)), before); c.eq('local.disk', c.read('layer.txt'), 'disk C\n');
  }),
  ...['checkout', 'switch'].flatMap(command => ['inactive', 'active'].map(state => spec(command === 'checkout' ? 'BRANCH-016' : 'BRANCH-017', `absolute-${command}-${state}`, `Native absolute ${command} selects a ${state} Layer ref`, 'L1', 'daily', async c => {
    await setup(c); await layer(c); if (state === 'inactive') await success(c, ['off', 'tools']);
    const layerOid = await git(c, ['rev-parse', 'layer/tools']); const main = await git(c, ['rev-parse', 'main']);
    await c.snapshot('before-native-selection'); const result = await c.git([command, 'layer/tools'], { ok: allowed });
    c.eq('selection.exit', result.code, 0); c.eq('selection.real.HEAD', await git(c, ['symbolic-ref', 'HEAD']), 'refs/heads/layer/tools');
    c.eq('selection.commit', await git(c, ['rev-parse', 'HEAD']), layerOid); c.eq('selection.main.preserved', await git(c, ['rev-parse', 'main']), main);
    c.eq('selection.disk', c.read('layer.txt'), 'layer one\n'); c.eq('selection.base.absent', c.exists('base.txt'), false);
    const status = await success(c, ['status']); c.eq('selection.diagnosed', status.safe, false); c.eq('selection.diagnosis', status.error?.code, 'EXPLICIT_LAYER_REQUIRED');
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['GL-22: protection was not enabled in this fixture. Direct Git selects the real ref; the product refuses an unacknowledged Layer HEAD. Opt-in reservations and explicit bypass are tested separately by IMPL-007.', ...(state === 'inactive' ? ['Registered inactive Layer is not an empty-registry L0 state.'] : [])] };
  }, { phase: 'USER_REQUIREMENT', productStatus: 'DOCUMENTED_RESTRICTION' }))),
  spec('BRANCH-018', 'managed-refusal-native-bypass', 'Managed switch refusal and absolute Git transition are separate observations', 'L1', 'daily', async c => {
    await setup(c); await layer(c); await success(c, ['off', 'tools']); const before = await git(c, ['symbolic-ref', 'HEAD']);
    await refusal(c, ['switch', 'layer/tools'], 'INVALID_BRANCH'); c.eq('managed.head', await git(c, ['symbolic-ref', 'HEAD']), before);
    await c.git(['switch', 'layer/tools']); c.eq('native.head', await git(c, ['symbolic-ref', 'HEAD']), 'refs/heads/layer/tools');
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['GL-22 distinguishes managed switch, deliberate open-branch and native selection. This fixture has no opt-in protection; managed refusal cannot certify native prevention.'] };
  }, { phase: 'USER_REQUIREMENT', productStatus: 'DOCUMENTED_RESTRICTION' }),
  spec('BRANCH-019', 'native-ref-list-vs-registration', 'Native refs include both registered and unregistered layer branches', 'L1', 'daily', async c => {
    await setup(c); await layer(c); const empty = await git(c, ['mktree'], { stdin: '' }); const oid = await git(c, ['commit-tree', empty, '-m', 'unregistered'], { stdin: '' });
    await c.git(['update-ref', 'refs/heads/layer/candidate', oid]);
    c.eq('native.branches', (await git(c, ['for-each-ref', '--format=%(refname)', 'refs/heads/'])).split('\n').sort(), ['refs/heads/layer/candidate', 'refs/heads/layer/tools', 'refs/heads/main']);
    const listed = await success(c, ['list']); c.eq('product.recognized', listed.map(l => l.name).sort(), ['candidate', 'tools']); c.eq('candidate.recognized.inactive', listed.find(l => l.name === 'candidate').state, 'inactive');
    c.eq('product.traditional', (await success(c, ['branches'])).map(l => l.name), ['main']);
    return { limits: ['Prefix classification is a product convention; native Git does not acquire a new ref type.'] };
  }),
  spec('WORKTREE-014', 'native-worktree-selects-layer', 'Native worktree add selects Layer while product conservatively refuses topology', 'L1', 'daily', async c => {
    await setup(c); await layer(c); const wt = path.join(c.root, 'linked-layer'); const mainIndex = await index(c);
    await c.git(['worktree', 'add', wt, 'layer/tools']);
    c.eq('linked.head', await git(c, ['symbolic-ref', 'HEAD'], { cwd: wt }), 'refs/heads/layer/tools');
    c.eq('linked.layer.bytes', fs.readFileSync(path.join(wt, 'layer.txt'), 'utf8'), 'layer one\n');
    c.eq('main.head', await git(c, ['symbolic-ref', 'HEAD']), 'refs/heads/main'); c.eq('main.index.preserved', await index(c), mainIndex);
    const status = await success(c, ['status']); c.eq('main.multiple.safe', status.safe, false); c.eq('main.multiple.code', status.error?.code, 'MULTIPLE_WORKTREES');
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['Unprotected real native worktree can select the Layer ref. An unmanaged linked worktree is conservatively refused; protection worktrees use a separate opt-in validated topology.'] };
  }, { phase: 'USER_REQUIREMENT', productStatus: 'DOCUMENTED_RESTRICTION' }),
  spec('LAYER-001', 'zero-layers-native-daily', 'Zero Layers preserves a native base add and commit workflow', 'L0', 'smoke', async c => {
    await setup(c); const old = await git(c, ['rev-parse', 'HEAD']); c.write('base.txt', 'native base\n'); await c.git(['add', '.']); await c.git(['commit', '-m', 'native']);
    c.eq('base.native.blob', await raw(c, ['show', 'HEAD:base.txt']), 'native base\n'); c.eq('base.parent', await git(c, ['rev-parse', 'HEAD^']), old);
    await success(c, ['recover']); c.eq('status.safe', (await success(c, ['status'])).safe, true); c.eq('layers.empty', await success(c, ['list']), []);
  }),
  spec('LAYER-002', 'two-disjoint-real-layers', 'Two active Layers retain independent real histories and indexes', 'L2', 'smoke', async c => {
    await setup(c); const head = await git(c, ['rev-parse', 'HEAD']); await layer(c, 'one', 'one.txt', 'one\n'); await layer(c, 'two', 'two.txt', 'two\n');
    c.eq('main.head', await git(c, ['rev-parse', 'HEAD']), head); c.eq('main.tree', await treeNames(c, 'main'), ['base.txt']);
    c.eq('main.index', names(await raw(c, ['ls-files', '-z'])), ['base.txt']);
    for (const name of ['one', 'two']) { c.eq(`${name}.tree`, await treeNames(c, `layer/${name}`), [`${name}.txt`]); c.eq(`${name}.index`, names(await raw(c, ['ls-files', '-z'], { env: { GIT_INDEX_FILE: layerIndex(c, name) } })), [`${name}.txt`]); }
  }),
  spec('LAYER-003', 'commit-one-preserves-other-owners', 'Committing Layer A preserves staged Base, staged B and dirty A disk', 'L3', 'daily', async c => {
    await setup(c); await layer(c, 'one', 'one.txt'); await layer(c, 'two', 'two.txt');
    c.write('base.txt', 'base staged\n'); await c.git(['add', 'base.txt']); c.write('one.txt', 'one staged\n'); await success(c, ['add', 'one', '--', 'one.txt']); c.write('one.txt', 'one dirty\n');
    c.write('two.txt', 'two staged\n'); await success(c, ['add', 'two', '--', 'two.txt']);
    const before = { main: await git(c, ['rev-parse', 'main']), two: await git(c, ['rev-parse', 'layer/two']), baseIndex: await index(c), twoIndex: await index(c, layerIndex(c, 'two')) };
    await success(c, ['commit', 'one', '-m', 'only one']); c.eq('one.commit.blob', await raw(c, ['show', 'layer/one:one.txt']), 'one staged\n'); c.eq('one.disk.dirty', c.read('one.txt'), 'one dirty\n');
    c.eq('base.ref', await git(c, ['rev-parse', 'main']), before.main); c.eq('base.index', await index(c), before.baseIndex); c.eq('two.ref', await git(c, ['rev-parse', 'layer/two']), before.two); c.eq('two.index', await index(c, layerIndex(c, 'two')), before.twoIndex);
  }),
  spec('LAYER-004', 'same-bytes-local-collision', 'Activation refuses appropriation of an identical local file', 'L5', 'daily', async c => {
    await setup(c); await layer(c); await success(c, ['off', 'tools']); c.write('layer.txt', 'layer one\n'); const idx = await index(c, layerIndex(c));
    await refusal(c, ['on', 'tools'], ['PATH_COLLISION', 'LOCAL_COLLISION']); c.eq('bytes.preserved', c.read('layer.txt'), 'layer one\n'); c.eq('state.inactive', record(c).state, 'inactive'); c.eq('index.preserved', await index(c, layerIndex(c)), idx);
  }),
  spec('LAYER-005', 'base-owned-add-refused', 'Layer add refuses a base-owned path without changing either index', 'L5', 'daily', async c => {
    await setup(c); await layer(c); const main = await index(c), own = await index(c, layerIndex(c));
    await refusal(c, ['add', 'tools', '--', 'base.txt'], 'OWNERSHIP'); c.eq('base.index', await index(c), main); c.eq('layer.index', await index(c, layerIndex(c)), own); c.eq('base.bytes', c.read('base.txt'), 'base one\n');
  }),
  ...['one-first', 'two-first'].map(order => spec('LAYER-006', `collision-${order}`, 'Two Layer owners of the same path refuse the second activation', 'L5', 'broad', async c => {
    await setup(c); await layer(c, 'one', 'shared.txt', 'one\n'); await success(c, ['off', 'one']); await layer(c, 'two', 'shared.txt', 'two\n'); await success(c, ['off', 'two']);
    const first = order === 'one-first' ? 'one' : 'two', second = first === 'one' ? 'two' : 'one';
    await success(c, ['on', first]); await refusal(c, ['on', second], 'PATH_COLLISION'); c.eq('first.bytes', c.read('shared.txt'), `${first}\n`); c.eq('first.state', record(c, first).state, 'active'); c.eq('second.state', record(c, second).state, 'inactive');
    return { limits: ['Distinct-byte collision and both activation orders exercised; equal-byte Layer-vs-Layer variant remains unexecuted.'] };
  })),
  spec('LAYER-007', 'reserve-unstage-release', 'Unstage keeps ownership until explicit release and preserves physical bytes', 'L1', 'smoke', async c => {
    await setup(c); await success(c, ['create', 'tools']); await success(c, ['on', 'tools']); c.write('new.txt', 'reserved bytes\n');
    await success(c, ['add', 'tools', '--', 'new.txt']); await refusal(c, ['release', 'tools', '--', 'new.txt'], 'RELEASE_UNSAFE');
    await success(c, ['unstage', 'tools', '--', 'new.txt']); c.eq('reserve.after.unstage', record(c).reservations, ['new.txt']); c.eq('empty.index', await index(c, layerIndex(c)), '');
    await success(c, ['release', 'tools', '--', 'new.txt']); c.eq('released.reservations', record(c).reservations, []); c.eq('physical.preserved', c.read('new.txt'), 'reserved bytes\n');
    c.ok('released.untracked', (await success(c, ['status'])).untracked.includes('new.txt'), true);
  }),
  spec('LAYER-008', 'delete-stage-recreate-owner', 'Staged deletion keeps committed ownership when the physical path is recreated', 'L3', 'daily', async c => {
    await setup(c); await layer(c); fs.unlinkSync(path.join(c.repo, 'layer.txt')); await success(c, ['add', 'tools', '--', 'layer.txt']); c.eq('deletion.index', await index(c, layerIndex(c)), '');
    c.write('layer.txt', 'recreated local\n'); await refusal(c, ['base-add', '--', 'layer.txt'], 'OWNERSHIP'); c.eq('recreated.bytes', c.read('layer.txt'), 'recreated local\n');
    await success(c, ['add', 'tools', '--', 'layer.txt']); c.eq('layer.new.index', await raw(c, ['show', ':layer.txt'], { env: { GIT_INDEX_FILE: layerIndex(c) } }), 'recreated local\n');
    return { limits: ['Deletion staged then recreation exercised; ownership release after a committed deletion is a separate unexecuted ordering.'] };
  }),
  spec('LAYER-010', 'park-four-dimensions', 'Dirty off refuses without effects; explicit discard restores only committed content', 'L4', 'daily', async c => {
    await setup(c); await layer(c); c.write('absent.txt', 'committed absence target\n'); await success(c, ['add', 'tools', '--', 'absent.txt']); await success(c, ['commit', 'tools', '-m', 'second path']);
    c.write('layer.txt', 'staged A\n'); await success(c, ['add', 'tools', '--', 'layer.txt']); c.write('layer.txt', 'disk B\n'); c.write('reserved.txt', 'reservation\n'); await success(c, ['add', 'tools', '--', 'reserved.txt']); await success(c, ['unstage', 'tools', '--', 'reserved.txt']); fs.unlinkSync(path.join(c.repo, 'absent.txt'));
    const head = await git(c, ['rev-parse', 'layer/tools']), staged = await index(c, layerIndex(c)), registration = record(c), base = await index(c);
    await refusal(c, ['off', 'tools'], 'LAYER_DIRTY'); const park = await refusal(c, ['off', 'tools', '--park'], 'CLI_USAGE'); c.eq('legacy.park.exit', park.code, 2);
    c.eq('refusal.index', await index(c, layerIndex(c)), staged); c.eq('refusal.registry', record(c), registration); c.eq('refusal.dirty', c.read('layer.txt'), 'disk B\n'); c.eq('refusal.reservation', c.read('reserved.txt'), 'reservation\n'); c.eq('refusal.absence', c.exists('absent.txt'), false);
    await success(c, ['off', 'tools', '--discard', '--yes']); c.eq('discard.inactive', record(c).state, 'inactive'); for (const file of ['layer.txt', 'reserved.txt', 'absent.txt']) c.eq(`discard.absent.${file}`, c.exists(file), false);
    await success(c, ['on', 'tools']); c.eq('resume.commit', await git(c, ['rev-parse', 'layer/tools']), head); c.eq('resume.committed', c.read('layer.txt'), 'layer one\n'); c.eq('resume.committed.absence.target', c.read('absent.txt'), 'committed absence target\n'); c.eq('discard.reservation.not.resurrected', c.exists('reserved.txt'), false); c.eq('discard.reservations.cleared', record(c).reservations, []); c.eq('base.index.preserved', await index(c), base);
  }),
  ...['confirm', 'cancel'].map(action => spec('LAYER-011', `capture-scope-${action}`, `Capture scope review and ${action} preserve exact ownership and bytes`, 'L1', 'daily', async c => {
    await setup(c); await layer(c); c.write('scope/preexisting.txt', 'preexisting\n'); await success(c, ['capture-start', 'tools', '--path', 'scope']); c.write('scope/new.txt', 'new\n'); c.write('outside.txt', 'outside\n');
    const review = await success(c, ['capture-review']); c.eq('capture.candidates', review.candidates.map(p => p.path), ['scope/new.txt']);
    await success(c, action === 'confirm' ? ['capture-confirm', '--', 'scope/new.txt'] : ['capture-cancel']);
    c.eq('capture.active.removed', c.exists('.git/layers/capture.json'), false); c.eq('new.bytes', c.read('scope/new.txt'), 'new\n'); c.eq('outside.bytes', c.read('outside.txt'), 'outside\n');
    c.eq('new.reservation', record(c).reservations.includes('scope/new.txt'), action === 'confirm'); c.eq('preexisting.unowned', record(c).reservations.includes('scope/preexisting.txt'), false);
  })),
  spec('LAYER-012', 'capture-off-cancel-trap', 'Legacy capture cancellation remains available after clean deactivation', 'L1', 'daily', async c => {
    await setup(c); await layer(c); await success(c, ['capture-start', 'tools']); c.write('capture-new.txt', 'must survive\n'); await success(c, ['off', 'tools']);
    const stored = c.read('.git/layers/capture.json'); await refusal(c, ['capture-review'], 'LAYER_INACTIVE');
    c.eq('capture.metadata.preserved.before.cancel', c.read('.git/layers/capture.json'), stored); await success(c, ['capture-cancel']);
    c.eq('capture.cancelled.without.reactivation', c.exists('.git/layers/capture.json'), false); c.eq('layer.remains.inactive', record(c).state, 'inactive'); c.eq('new.bytes', c.read('capture-new.txt'), 'must survive\n');
    return { limits: ['Legacy explicit capture compatibility API; editing target and destructive preview use their current separate contracts.'] };
  }),
  spec('LAYER-014', 'external-ref-advanced-preserves-index', 'An externally advanced Layer ref is diagnosed without resetting staged or dirty content', 'L5', 'daily', async c => {
    await setup(c); await layer(c); c.write('layer.txt', 'staged B\n'); await success(c, ['add', 'tools', '--', 'layer.txt']); c.write('layer.txt', 'dirty C\n'); const idx = await index(c, layerIndex(c));
    const old = await git(c, ['rev-parse', 'layer/tools']); const tree = await git(c, ['rev-parse', 'layer/tools^{tree}']); const next = await git(c, ['commit-tree', tree, '-p', old, '-m', 'external advance']); await c.git(['update-ref', 'refs/heads/layer/tools', next, old]);
    await refusal(c, ['add', 'tools', '--', 'layer.txt'], 'EXTERNAL_REF'); c.eq('staged.preserved', await index(c, layerIndex(c)), idx); c.eq('dirty.preserved', c.read('layer.txt'), 'dirty C\n'); c.eq('external.ref.preserved', await git(c, ['rev-parse', 'layer/tools']), next);
    c.eq('doctor.unsafe', (await diagnostic(c)).safe, false); await refusal(c, ['recover'], 'EXTERNAL_REF');
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['Automatic external-ref reconciliation is absent; conservative refusal verified.'] };
  }),
  ...['delete', 'rename'].map(action => spec('LAYER-015', `external-ref-${action}`, `External ref ${action} preserves indexes and remains raw-exportable`, 'L5', 'daily', async c => {
    await setup(c); await layer(c); const idx = await index(c, layerIndex(c)); const old = await git(c, ['rev-parse', 'layer/tools']);
    if (action === 'delete') await c.git(['update-ref', '-d', 'refs/heads/layer/tools', old]); else await c.git(['branch', '-m', 'layer/tools', 'layer/renamed']);
    const status = await success(c, ['status']); c.eq('status.unsafe', status.safe, false); c.eq('diagnosis.external.ref', status.error?.code, 'EXTERNAL_REF');
    await refusal(c, ['recover'], ['EXTERNAL_REF', 'GIT_FAILED']); c.eq('index.preserved', await index(c, layerIndex(c)), idx); c.eq('bytes.preserved', c.read('layer.txt'), 'layer one\n');
    await verifiedExport(c, path.join(c.root, `rescue-${action}`), `external-ref-${action}`);
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['External deletion/rename is preserved and diagnosed; automatic reconciliation is not implemented. Missing-ref recovery may expose Git failure while the independent doctor/export remain usable.'] };
  })),
  spec('LAYER-016', 'missing-lifecycle-cli-surface', 'Public CLI rename and remove preserve native commits and unrelated state', 'L1', 'broad', async c => {
    await setup(c); await layer(c); const idx = await index(c, layerIndex(c)), ref = await git(c, ['rev-parse', 'layer/tools']), base = await index(c), head = await git(c, ['rev-parse', 'HEAD']);
    await success(c, ['rename', 'tools', 'renamed']); c.eq('rename.native.ref', await git(c, ['rev-parse', 'layer/renamed']), ref); c.eq('rename.old.ref.absent', (await c.git(['show-ref', '--verify', '--quiet', 'refs/heads/layer/tools'], { ok: [1] })).code, 1); c.eq('rename.private.index', await index(c, layerIndex(c, 'renamed')), idx); c.eq('rename.disk', c.read('layer.txt'), 'layer one\n');
    await success(c, ['remove', 'renamed', '--yes']); c.eq('remove.registration.absent', (await success(c, ['list'])).some(l => l.name === 'renamed'), false); c.eq('remove.native.ref.absent', (await c.git(['show-ref', '--verify', '--quiet', 'refs/heads/layer/renamed'], { ok: [1] })).code, 1); c.eq('remove.projection.absent', c.exists('layer.txt'), false); c.eq('removed.commit.retained', await git(c, ['cat-file', '-t', ref]), 'commit'); c.eq('base.index', await index(c), base); c.eq('head', await git(c, ['rev-parse', 'HEAD']), head);
  }),
  ...['malformed-registry', 'future-workspace', 'missing-workspace'].map(damage => spec('RECOVERY-009', damage, `Invalid metadata ${damage} remains diagnosable and raw-exportable`, 'L6', 'daily', async c => {
    await setup(c); await layer(c); const ref = await git(c, ['rev-parse', 'layer/tools']), indexPath = layerIndex(c), idx = await index(c, indexPath);
    const target = damage === 'malformed-registry' ? '.git/layers/registry.json' : '.git/layers/workspace.json';
    if (damage === 'missing-workspace') fs.unlinkSync(path.join(c.repo, target)); else c.write(target, damage === 'malformed-registry' ? '{invalid json' : JSON.stringify({ schema: 999, head: '', branch: 'main' }));
    const damaged = c.exists(target) ? c.read(target) : null;
    c.eq('doctor.unsafe', (await diagnostic(c)).safe, false); await refusal(c, ['recover'], 'METADATA_INVALID'); await verifiedExport(c, path.join(c.root, 'rescue'), damage);
    c.eq('damaged.preserved', c.exists(target) ? c.read(target) : null, damaged); c.eq('ref.preserved', await git(c, ['rev-parse', 'layer/tools']), ref); c.eq('index.preserved', await index(c, indexPath), idx); c.eq('disk.preserved', c.read('layer.txt'), 'layer one\n');
    return { limits: ['Raw export preserves available metadata; it does not automatically repair invalid state or include the complete object store/worktree.'] };
  })),
  ...['after-stage-index', 'after-stage-checkpoint'].map(point => spec('RECOVERY-008', `failpoint-${point}`, 'Injected stage failure preserves a subsequent external disk edit during recovery', 'L6', 'daily', async c => {
    await setup(c); await layer(c); const ref = await git(c, ['rev-parse', 'layer/tools']); c.write('layer.txt', 'staged before failure\n');
    await refusal(c, ['add', 'tools', '--', 'layer.txt'], 'INJECTED_FAILURE', { env: { GIT_LAYERS_FAILPOINT: point } });
    c.write('layer.txt', 'external later\n'); const doctor = await diagnostic(c); c.eq('pending.unsafe', doctor.safe, false); c.ok('pending.journal.exists', doctor.transactions.length > 0, true);
    await success(c, ['recover']); c.eq('disk.later.preserved', c.read('layer.txt'), 'external later\n'); c.eq('ref.preserved', await git(c, ['rev-parse', 'layer/tools']), ref); c.eq('recovered.safe', (await success(c, ['status'])).safe, true);
    return { limits: ['INJECTED_FAILURE tests exception recovery; this is explicitly not abrupt process death.'] };
  })),
  ...['changed', 'missing'].map(damage => spec('RECOVERY-010', `backup-${damage}`, 'Recovery rejects an altered or absent durable backup before restoration', 'L6', 'broad', async c => {
    await setup(c); await layer(c); c.write('layer.txt', 'new staged\n'); await refusal(c, ['add', 'tools', '--', 'layer.txt'], 'INJECTED_FAILURE', { env: { GIT_LAYERS_FAILPOINT: 'after-stage-index' } });
    const transactions = (await diagnostic(c)).transactions; const tx = transactions[0]; const backup = tx.backups.find(b => b.copy !== null); c.ok('backup.present.in.plan', !!backup, true);
    if (damage === 'changed') fs.writeFileSync(backup.copy, 'tampered\n'); else fs.unlinkSync(backup.copy);
    const idx = await index(c, layerIndex(c)), bytes = c.read('layer.txt'); await refusal(c, ['recover'], ['RECOVERY_CONFLICT', 'ENOENT']);
    c.eq('index.no.partial.restore', await index(c, layerIndex(c)), idx); c.eq('disk.preserved', c.read('layer.txt'), bytes); c.ok('journal.retained', (await diagnostic(c)).transactions.length > 0, true);
    return { limits: ['Representative index/exclude backup corruption; all backup ordering permutations are not exercised.'] };
  })),
  spec('RECOVERY-014', 'reopen-recover-idempotence', 'Repeated reopening/recovery retains exact refs, indexes and completed-journal count', 'L1', 'broad', async c => {
    await setup(c); await layer(c); const before = { ref: await git(c, ['rev-parse', 'layer/tools']), idx: await index(c, layerIndex(c)), entries: fs.readdirSync(path.join(c.repo, '.git', 'layers', 'transactions')).sort() };
    for (let i = 0; i < 3; i++) { await success(c, ['status']); const r = await success(c, ['recover']); c.eq(`recovery.${i}.empty`, r.recovered, []); }
    c.eq('ref.exact', await git(c, ['rev-parse', 'layer/tools']), before.ref); c.eq('index.semantic', await index(c, layerIndex(c)), before.idx); c.eq('journals.no.new', fs.readdirSync(path.join(c.repo, '.git', 'layers', 'transactions')).sort(), before.entries);
  }),
  spec('RECOVERY-004', 'real-product-storage-lock-owner-killed', 'Abrupt death of the real product lock owner leaves a preserved lock', 'L6', 'broad', async c => {
    await setup(c); await layer(c); const dir = path.join(c.repo, '.git', 'layers');
    // This imports the unchanged product withLock implementation. READY is
    // emitted from its callback, after owner.json has been durably published.
    // It proves actual death with a product lock, not a sleep or failpoint.
    const code = `import {pathToFileURL} from 'node:url'; const {withLock}=await import(pathToFileURL(process.argv[1]).href); await withLock(process.argv[2],async()=>{process.stdout.write('LOCK_READY\\n'); await new Promise(()=>{setInterval(()=>{},1000)});});`;
    let barrier = false, childPid;
    const result = await c.run(process.execPath, ['--input-type=module', '-e', code, path.join(c.buildDir, 'storage.mjs'), dir], {
      timeout: 15000, ok: [null, 1], onSpawn(child) {
        childPid = child.pid; let out = '';
        child.stdout.on('data', chunk => { out += chunk.toString(); if (!barrier && out.includes('LOCK_READY\n')) { barrier = true; child.kill('SIGKILL'); } });
      },
    });
    c.eq('death.observed.ready.barrier', barrier, true); c.eq('death.not.timeout', result.timedOut, false);
    const ownerPath = '.git/layers/locks/coordinator/owner.json'; c.eq('lock.survives', c.exists(ownerPath), true);
    const ownerBytes = c.read(ownerPath), owner = JSON.parse(ownerBytes); c.eq('owner.exact.child', owner.pid, childPid);
    await refusal(c, ['create', 'blocked-after-death'], 'LOCKED'); await refusal(c, ['recover'], 'LOCKED');
    c.eq('lock.unchanged', c.read(ownerPath), ownerBytes); c.eq('existing.layer.bytes', c.read('layer.txt'), 'layer one\n');
    const doctor = await diagnostic(c); c.eq('doctor.actual.safe.with.orphan.lock', doctor.safe, false);
    await verifiedExport(c, path.join(c.root, 'dead-lock-export'), 'orphan-lock');
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['Real storage.withLock owner death after callback entry. Lock bytes are preserved and diagnosed unsafe; no Core mutation ran inside callback. This does not certify death at every transaction boundary or power loss.'] };
  }, { productStatus: 'DOCUMENTED_RESTRICTION' }),
  spec('RECOVERY-012', 'switch-snapshot-json-limit-49mib', 'Oversized switch journal is refused before withdrawing the projection', 'L6', 'stress', async c => {
    await setup(c); await c.git(['branch', 'target']); const bytes = Buffer.alloc(49 * 1024 * 1024, 65); await layer(c, 'tools', 'large.bin', bytes);
    const expectedHash = sha(bytes), head = await git(c, ['rev-parse', 'HEAD']), ref = await git(c, ['rev-parse', 'layer/tools']), idx = await index(c, layerIndex(c));
    await refusal(c, ['switch', 'target'], 'METADATA_INVALID', { timeout: 180000 });
    c.eq('head.not.switched', await git(c, ['rev-parse', 'HEAD']), head); c.eq('layer.ref.preserved', await git(c, ['rev-parse', 'layer/tools']), ref); c.eq('private.index.preserved', await index(c, layerIndex(c)), idx); c.eq('projection.preserved.before.recover', sha(fs.readFileSync(path.join(c.repo, 'large.bin'))), expectedHash);
    await success(c, ['recover'], { timeout: 180000 }); c.eq('large.bytes.preserved', sha(fs.readFileSync(path.join(c.repo, 'large.bin'))), expectedHash); c.eq('large.recovered.safe', (await success(c, ['status'])).safe, true);
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['One 49 MiB projection exceeds the journal JSON budget; operation is refused before projection withdrawal. This is a size boundary, not support for arbitrary file sizes.'] };
  }, { timeout: 300000, productStatus: 'DOCUMENTED_RESTRICTION' }),
  spec('REF-008', 'gc-retains-private-staged-objects', 'Aggressive fixture-only GC retains committed and checkpoint content after explicit discard', 'L4', 'broad', async c => {
    await setup(c); await layer(c); c.write('layer.txt', 'private staged B\n'); await success(c, ['add', 'tools', '--', 'layer.txt']); c.write('layer.txt', 'private dirty C\n'); c.write('reservation.txt', 'reserved disk\n'); await success(c, ['add', 'tools', '--', 'reservation.txt']); await success(c, ['unstage', 'tools', '--', 'reservation.txt']);
    const stagedOid = await git(c, ['rev-parse', ':layer.txt'], { env: { GIT_INDEX_FILE: layerIndex(c) } }); await refusal(c, ['off', 'tools'], 'LAYER_DIRTY'); await success(c, ['off', 'tools', '--discard', '--yes']);
    await c.git(['reflog', 'expire', '--expire=now', '--expire-unreachable=now', '--all']); await c.git(['gc', '--prune=now']);
    c.eq('gc.staged.blob', await raw(c, ['cat-file', '-p', stagedOid]), 'private staged B\n'); c.eq('gc.committed.blob', await raw(c, ['show', 'layer/tools:layer.txt']), 'layer one\n');
    await success(c, ['on', 'tools']); c.eq('gc.committed.reactivated', c.read('layer.txt'), 'layer one\n'); c.eq('gc.discarded.reservation.absent', c.exists('reservation.txt'), false);
    await c.git(['fsck', '--full', '--no-reflogs']);
  }),
  spec('STASH-003', 'native-stash-all-projected-layer', 'Native stash -a includes and removes ignored Layer projection', 'L1', 'broad', async c => {
    await setup(c); await layer(c); const ref = await git(c, ['rev-parse', 'layer/tools']), idx = await index(c, layerIndex(c)); c.write('layer.txt', 'dirty projected\n');
    await c.git(['stash', 'push', '-a', '-m', 'fixture only']); c.eq('native.removed.projection', c.exists('layer.txt'), false); c.eq('stash.third.parent.blob', await raw(c, ['show', 'stash@{0}^3:layer.txt']), 'dirty projected\n');
    c.eq('layer.ref.preserved', await git(c, ['rev-parse', 'layer/tools']), ref); c.eq('layer.index.preserved', await index(c, layerIndex(c)), idx);
    await c.git(['stash', 'apply']); c.eq('native.apply.restores.bytes', c.read('layer.txt'), 'dirty projected\n');
    return { productStatus: 'DOCUMENTED_RESTRICTION', findings: [restrictionFinding('NATIVE-STASH-ALL-LAYER', 'active Layer projection ignored in base', 'git stash push -a', 'Explicit native -a includes ignored Layer paths; managed preservation cannot intercept it', 'Projection saved in stash third parent and removed from worktree; apply restored bytes')], limits: ['This proves native stash semantics and risk, not a managed stash implementation.'] };
  }),
  ...['-fdx', '-fdX'].map(flags => spec('STASH-011', flags === '-fdx' ? 'native-clean-including-ignored' : 'native-clean-only-ignored', 'Native clean removes ignored Layer projection with its explicit ignore flags', 'L1', 'broad', async c => {
    await setup(c); await layer(c); c.write('.gitignore', 'ignored.tmp\n'); c.write('ignored.tmp', 'ignored\n'); c.write('ordinary.tmp', 'untracked\n'); const ref = await git(c, ['rev-parse', 'layer/tools']), idx = await index(c, layerIndex(c));
    await c.git(['clean', flags]); c.eq('layer.removed', c.exists('layer.txt'), false); c.eq('ignored.removed', c.exists('ignored.tmp'), false); c.eq('ordinary.presence', c.exists('ordinary.tmp'), flags === '-fdX');
    c.eq('ref.preserved', await git(c, ['rev-parse', 'layer/tools']), ref); c.eq('index.preserved', await index(c, layerIndex(c)), idx);
    return { productStatus: 'DOCUMENTED_RESTRICTION', findings: [restrictionFinding('NATIVE-CLEAN-IGNORED-LAYER', 'active ignored projection and ordinary untracked file', [c.gitPath, 'clean', flags], 'Explicit native ignored-file deletion is a documented bypass; no universal interception is claimed', { layerPresent: false, ordinaryPresent: flags === '-fdX' })] };
  })),
  spec('MODEL-001', 'on-off-roundtrip-three-times', 'Repeated clean activation/deactivation preserves Base and Layer bytes', 'L1', 'daily', async c => {
    await setup(c); await layer(c, 'tools', 'nested/layer.txt'); const base = await git(c, ['rev-parse', 'main']), own = await git(c, ['rev-parse', 'layer/tools']), idx = await index(c);
    for (let i = 0; i < 3; i++) { await success(c, ['off', 'tools']); c.eq(`off.${i}.file.absent`, c.exists('nested/layer.txt'), false); await success(c, ['on', 'tools']); c.eq(`on.${i}.bytes`, c.read('nested/layer.txt'), 'layer one\n'); }
    c.eq('base.ref', await git(c, ['rev-parse', 'main']), base); c.eq('base.index', await index(c), idx); c.eq('layer.ref', await git(c, ['rev-parse', 'layer/tools']), own); c.eq('base.disk', c.read('base.txt'), 'base one\n');
  }),
  spec('MODEL-002', 'disjoint-activation-commutes', 'Opposite activation orders compose the same disjoint files and index entries', 'L2', 'broad', async c => {
    await setup(c); await layer(c, 'one', 'one.txt', 'one\n'); await layer(c, 'two', 'two.txt', 'two\n'); await success(c, ['off', 'one']); await success(c, ['off', 'two']);
    await success(c, ['on', 'one']); await success(c, ['on', 'two']); const first = { one: c.read('one.txt'), two: c.read('two.txt'), base: await index(c), a: await index(c, layerIndex(c, 'one')), b: await index(c, layerIndex(c, 'two')) };
    await success(c, ['off', 'one']); await success(c, ['off', 'two']); await success(c, ['on', 'two']); await success(c, ['on', 'one']);
    c.eq('composition.commutative', { one: c.read('one.txt'), two: c.read('two.txt'), base: await index(c), a: await index(c, layerIndex(c, 'one')), b: await index(c, layerIndex(c, 'two')) }, first);
    return { limits: ['Two orders in one fixture with full off reset; independent clone ordering and side effects of journals are not equated.'] };
  }),
  spec('MODEL-004', 'mixed-owner-batch-permutations', 'Mixed-owner batch refusal is atomic for every position of the invalid path', 'L2', 'daily', async c => {
    await setup(c); await layer(c, 'one', 'one.txt'); await layer(c, 'two', 'two.txt'); c.write('valid-a.txt', 'a\n'); c.write('valid-b.txt', 'b\n');
    const before = await index(c, layerIndex(c, 'one'));
    for (const paths of [['two.txt', 'valid-a.txt', 'valid-b.txt'], ['valid-a.txt', 'two.txt', 'valid-b.txt'], ['valid-a.txt', 'valid-b.txt', 'two.txt']]) {
      await refusal(c, ['add', 'one', '--', ...paths], 'OWNERSHIP'); c.eq('index.atomic', await index(c, layerIndex(c, 'one')), before); c.eq('reservations.atomic', record(c, 'one').reservations, []);
    }
    c.eq('valid.a.bytes', c.read('valid-a.txt'), 'a\n'); c.eq('valid.b.bytes', c.read('valid-b.txt'), 'b\n');
  }),
  spec('LAYOUT-011', 'native-index-v2-v4-copy', 'Official Git converts a copy of the Layer index to versions 2 and 4 without semantic loss', 'L1', 'broad', async c => {
    await setup(c); await layer(c); const original = await index(c, layerIndex(c)), main = await index(c); const copy = path.join(c.root, 'version.index'); fs.copyFileSync(layerIndex(c), copy);
    for (const version of [2, 4]) { await c.git(['update-index', `--index-version=${version}`], { env: { GIT_INDEX_FILE: copy } }); c.eq(`version.${version}.semantics`, await index(c, copy), original); const bytes = fs.readFileSync(copy); c.eq(`version.${version}.header`, bytes.subarray(0, 4).toString(), 'DIRC'); c.eq(`version.${version}.actual`, bytes.readUInt32BE(4), version); }
    c.eq('product.index.unchanged', await index(c, layerIndex(c)), original); c.eq('main.index.unchanged', await index(c), main);
  }),
  spec('LAYOUT-012', 'native-objects-private-coordination', 'Native refs/trees/blobs are distinguished from JSON coordination metadata', 'L3', 'broad', async c => {
    await setup(c); await layer(c); c.write('layer.txt', 'staged\n'); await success(c, ['add', 'tools', '--', 'layer.txt']); const l = record(c);
    c.eq('storage.current.name', fs.existsSync(path.join(c.repo, '.git', 'layers')), true); c.eq('storage.legacy.not.created', fs.existsSync(path.join(c.repo, '.git', 'git-layers')), false);
    const tree = await git(c, ['rev-parse', `refs/git-layers/state/${l.id}`]); c.eq('checkpoint.native.tree', await git(c, ['cat-file', '-t', tree]), 'tree'); c.eq('layer.native.commit', await git(c, ['cat-file', '-t', l.ref]), 'commit');
    const entries = await git(c, ['ls-tree', '-r', tree]); c.ok('checkpoint.real.entry', entries.includes('\tlayer.txt'), 'tree has layer.txt', entries);
    await c.git(['pack-refs', '--all']); c.eq('packed.ref.readable', await git(c, ['rev-parse', l.ref]), l.oid); c.eq('metadata.schema', JSON.parse(c.read('.git/layers/registry.json')).schema, 1);
    return { limits: ['Fresh repositories use layers; explicit legacy opening/migration is covered separately. Native refs/git-layers state refs keep their established identity.'] };
  }),
  spec('HARNESS-009', 'measured-product-scan-size-10-1000', 'Measure actual status and mutation time/process counts with 10 and 1000 fixture files', 'L1', 'stress', async c => {
    await setup(c); await layer(c); const measurements = [];
    for (const count of [10, 1000]) {
      for (let i = 0; i < count; i++) c.write(`scan/file-${String(i).padStart(5, '0')}.txt`, `synthetic ${i}\n`);
      const startCommands = c.commands.length, started = performance.now(); const status = await success(c, ['status']);
      c.eq(`scale.${count}.safe`, status.safe, true); c.eq(`scale.${count}.untracked`, status.untracked.length, count);
      measurements.push({ files: count, statusMs: performance.now() - started, directProcesses: c.commands.length - startCommands });
      c.write('layer.txt', `stage with ${count}\n`); const beforeStage = performance.now(); await success(c, ['add', 'tools', '--', 'layer.txt']); measurements.at(-1).stageMs = performance.now() - beforeStage;
    }
    fs.writeFileSync(path.join(c.artifactDir, 'scale-measurements.json'), JSON.stringify(measurements, null, 2));
    return { limits: ['Measured 1 active Layer and 10/1000 files only. 10/100 Layers, 10000 files, internal Git child counts, bytes read and peak RSS remain TEST_GAP. No asymptotic conclusion from two points.'] };
  }, { timeout: 300000 }),
  spec('HARNESS-010', 'measured-completed-journal-scan-0-100-1000', 'Measure status and mutation cost with synthetic completed journals', 'L1', 'stress', async c => {
    await setup(c); await layer(c); const parent = path.join(c.repo, '.git', 'layers', 'transactions'); const measurements = [];
    // These are explicitly synthetic historical metadata records, not fake
    // executions of product transactions. Actual product queries read them.
    for (const count of [0, 100, 1000]) {
      for (let i = count === 1000 ? 100 : 0; i < count; i++) {
        const id = `synthetic-${String(i).padStart(6, '0')}`, folder = path.join(parent, id); fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(path.join(folder, 'journal.json'), JSON.stringify({ schema: 1, id, kind: 'synthetic-retention-fixture', state: 'completed', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', steps: [], backups: [] }));
      }
      const started = performance.now(); const status = await success(c, ['status']); c.eq(`retention.${count}.safe`, status.safe, true);
      const measurement = { addedSyntheticCompletedJournals: count, totalJournals: fs.readdirSync(parent).length, statusMs: performance.now() - started };
      c.write('layer.txt', `retention ${count}\n`); const mutation = performance.now(); await success(c, ['add', 'tools', '--', 'layer.txt']); measurement.stageMs = performance.now() - mutation; measurements.push(measurement);
      c.eq(`synthetic.retained.${count}`, Array.from({ length: count }, (_, i) => fs.existsSync(path.join(parent, `synthetic-${String(i).padStart(6, '0')}`, 'journal.json'))).filter(Boolean).length, count);
    }
    fs.writeFileSync(path.join(c.artifactDir, 'retention-measurements.json'), JSON.stringify(measurements, null, 2));
    return { limits: ['0/100/1000 ADDED synthetic completed records plus actual setup journals; no simulated product execution. Shelves and long-term retention policy are not tested by this scaling experiment.'] };
  }, { timeout: 300000 }),
];
