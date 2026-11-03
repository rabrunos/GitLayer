import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { project } from '../../../scripts/git-compat/lib.mjs';

const source = 'docs/IMPLEMENTATION-2026-11-02.md; docs/STORAGE-MIGRATION.md; GL-01..GL-27 approved 2026-11-02';
const text = value => Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
const raw = async (c, args, options = {}) => text((await c.git(args, options)).stdout);
const gt = async (c, args, options) => (await raw(c, args, options)).trim();
const spec = (id, variant, title, profile, run, extra = {}) => ({ id, variant, title, profile, tier: 'daily', phase: 'USER_REQUIREMENT', productStatus: 'VERIFIED_SUPPORTED', capabilities: ['node'], timeout: 300000, ...extra, run });
const cli = async (c, args, options = {}) => {
  const result = await c.cli(args, { ...options, ok: options.ok ?? [0, 2, 3, 4, 5, 128, 129] });
  const output = text(result.stdout).trim() || text(result.stderr).trim();
  return { ...result, body: JSON.parse(output) };
};
const success = async (c, args, options) => {
  const result = await cli(c, args, options);
  c.eq('CLI ' + args.join(' ') + ' exits zero', result.code, 0, source);
  c.eq('CLI reports success', result.body.ok, true, source); return result.body.result;
};
const refused = async (c, args, codes, options) => {
  const result = await cli(c, args, options);
  c.ok('CLI refusal exit is nonzero', result.code !== 0, true, result.code, source);
  c.ok('CLI refusal code is specific', [].concat(codes).includes(result.body.error?.code), codes, result.body.error, source);
  return result;
};
const initialize = async c => {
  await c.init(); await success(c, ['init']);
  c.implementationGitDir = await gt(c, ['rev-parse', '--absolute-git-dir']);
  c.ok('Storage parent is in owned fixture', path.resolve(c.implementationGitDir).startsWith(path.resolve(c.root) + path.sep));
};
const directory = c => {
  const current = path.join(c.implementationGitDir, 'layers');
  return fs.existsSync(current) ? current : path.join(c.implementationGitDir, 'git-layers');
};
const registry = c => JSON.parse(fs.readFileSync(path.join(directory(c), 'registry.json'), 'utf8'));
const layer = (c, name) => registry(c).layers.find(item => item.name === name);
const indexFile = (c, name) => path.join(directory(c), 'indexes', layer(c, name).id + '.index');
const index = (c, file) => raw(c, ['ls-files', '--stage', '-z'], file ? { env: { GIT_INDEX_FILE: file } } : {});
const seedLayer = async (c, name = 'tools', file = 'layer.txt', bytes = 'layer original\n') => {
  await success(c, ['create', name]); await success(c, ['on', name]); c.write(file, bytes);
  await success(c, ['add', name, '--', file]); await success(c, ['commit', name, '-m', 'synthetic seed ' + name]);
};
const names = value => value.split('\0').filter(Boolean).sort();
const tree = (c, ref) => raw(c, ['ls-tree', '-r', '--name-only', '-z', ref]).then(names);
const digest = data => createHash('sha256').update(data).digest('hex');
function inventory(root) {
  const output = [];
  const visit = (folder, prefix = '') => {
    for (const name of fs.readdirSync(folder).sort()) {
      const file = path.join(folder, name), relative = prefix + name, stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) { output.push({ path: relative, type: 'link', target: fs.readlinkSync(file) }); continue; }
      if (stat.isDirectory()) visit(file, relative + '/');
      else output.push({ path: relative, type: 'file', hash: digest(fs.readFileSync(file)), bytes: stat.size });
    }
  };
  visit(root); return output;
}
function evidence(c, name, value) { fs.writeFileSync(path.join(c.artifactDir, name + '.json'), JSON.stringify(value, null, 2) + '\n'); }
const modelLimits = ['Selected handled-exception boundaries only: not exhaustive over writes, syscalls, platforms, power loss, native concurrent writers or real process death. Existing real-death/interleaving variants remain separate evidence.'];

export const cases = [
  spec('IMPL-001', 'native-default-recognition', 'Native default flow and recognized inactive candidate remain independent', 'L0', async c => {
    await initialize(c); const head = await gt(c, ['rev-parse', 'HEAD']);
    await c.git(['branch', 'layer/native-candidate']);
    const list = await success(c, ['list']);
    c.eq('Native prefix candidate recognized without manual registration', list.some(item => item.name === 'native-candidate' && item.state === 'inactive'), true);
    c.eq('Recognition does not move HEAD', await gt(c, ['rev-parse', 'HEAD']), head);
    c.write('normal.txt', 'native ordinary content\n'); await c.git(['add', '.']); await c.git(['commit', '-m', 'normal native commit']);
    c.eq('Native commit tree has only ordinary files', await tree(c, 'HEAD'), ['base.txt', 'normal.txt']);
    const status = await success(c, ['status']);
    c.eq('No editing target by default', status.editingTarget, null); c.eq('Native HEAD advance accepted when composition remains valid', status.safe, true);
    c.eq('Native prefix remains inactive', status.recognized.find(item => item.name === 'native-candidate').active, false);
  }),
  spec('IMPL-002', 'composition-editing-target', 'Two physical Layers and explicit new-file target preserve existing origins', 'L2', async c => {
    await initialize(c); await seedLayer(c, 'tools', 'tools.txt'); await seedLayer(c, 'notes', 'notes.txt', 'notes original\n');
    const head = await gt(c, ['rev-parse', 'HEAD']), otherIndex = await index(c, indexFile(c, 'notes'));
    c.write('preexisting.txt', 'ordinary before target\n'); await success(c, ['edit', 'tools']); c.write('target-new.txt', 'target new unstaged\n');
    const status = await success(c, ['status']);
    c.eq('Editing target is explicit', status.editingTarget, 'tools');
    c.eq('Both Layer files physically coexist', [c.read('tools.txt'), c.read('notes.txt')], ['layer original\n', 'notes original\n']);
    c.ok('New target file reserved without retroactive old-file assignment', layer(c, 'tools').reservations.includes('target-new.txt') && !layer(c, 'tools').reservations.includes('preexisting.txt'));
    await refused(c, ['commit', 'tools', '-m', 'must not auto-stage'], 'NOTHING_STAGED');
    await c.git(['add', '.']);
    c.eq('Native add excludes active origins including target reservation', names(await raw(c, ['ls-files', '-z'])), ['base.txt', 'preexisting.txt']);
    await success(c, ['add', 'tools', '--', 'target-new.txt']); await success(c, ['commit', 'tools', '-m', 'target one commit']);
    c.eq('Other Layer staging stays intact', await index(c, indexFile(c, 'notes')), otherIndex);
    c.eq('Layer commit does not move work branch', await gt(c, ['rev-parse', 'HEAD']), head);
    await success(c, ['edit-end']);
    const ended = await success(c, ['status']);
    c.eq('Ending editing restores normal destination', ended.editingTarget, null);
    c.eq('Ending editing keeps both Layers active', ended.layers.filter(item => item.state === 'active').length, 2);
  }),
  spec('IMPL-003', 'assign-preexisting-explicitly', 'Existing local file can be explicitly assigned without automatic capture', 'L1', async c => {
    await initialize(c); await seedLayer(c);
    c.write('local-before.txt', 'preexisting local content\n'); await success(c, ['edit', 'tools']);
    c.eq('Target does not retroactively reserve old file', layer(c, 'tools').reservations.includes('local-before.txt'), false);
    await success(c, ['add', 'tools', '--', 'local-before.txt']); await success(c, ['commit', 'tools', '-m', 'explicit assignment']);
    c.eq('Assigned native Layer blob exact', await raw(c, ['show', 'layer/tools:local-before.txt']), 'preexisting local content\n');
    c.eq('Assignment keeps main tree separate', await tree(c, 'main'), ['base.txt']);
  }),
  spec('IMPL-004', 'dirty-off-preview-discard', 'Dirty deactivation refuses; preview and explicit discard retain committed history', 'L2', async c => {
    await initialize(c); await seedLayer(c); await seedLayer(c, 'other', 'other.txt', 'other preserved\n');
    c.write('layer.txt', 'dirty discarded only after explicit action\n');
    const before = await gt(c, ['rev-parse', 'layer/tools']);
    await refused(c, ['off', 'tools'], 'LAYER_DIRTY');
    c.eq('Refusal preserves dirty bytes', c.read('layer.txt'), 'dirty discarded only after explicit action\n');
    const preview = await success(c, ['preview', 'off', 'tools']);
    c.eq('Preview declares read-only', preview.readOnly, true); c.ok('Preview exposes dirty impediment', preview.impediments.some(item => item.code === 'LAYER_DIRTY'));
    await success(c, ['off', 'tools', '--discard', '--yes']);
    c.eq('Discard removes only selected projection', c.exists('layer.txt'), false); c.eq('Other origin survives', c.read('other.txt'), 'other preserved\n');
    c.eq('Discard preserves native history', await gt(c, ['rev-parse', 'layer/tools']), before);
    c.eq('No new auto-park shelf is created', layer(c, 'tools').shelf ?? null, null);
    await success(c, ['on', 'tools']); c.eq('Reactivation loads committed version, not discarded bytes', c.read('layer.txt'), 'layer original\n');
  }),
  spec('IMPL-004', 'interactive-newcomer-preview-cancel-confirm', 'Real ConPTY preview sees an unobserved newcomer; cancel preserves state and sim discards only that Layer', 'L3', async c => {
    await initialize(c); await seedLayer(c); await seedLayer(c, 'other', 'other.txt', 'other committed\n');
    c.write('base.txt', 'base staged\n'); await c.git(['add', '--', 'base.txt']); c.write('base.txt', 'base physical\n');
    c.write('other.txt', 'other staged\n'); await success(c, ['add', 'other', '--', 'other.txt']); c.write('other.txt', 'other physical\n');
    c.write('layer.txt', 'own staged\n'); await success(c, ['add', 'tools', '--', 'layer.txt']); c.write('layer.txt', 'own physical\n');
    c.write('ordinary-before.txt', 'ordinary before target\n'); await success(c, ['edit', 'tools']); c.write('newcomer.txt', 'newcomer not observed by product\n');
    const observe = async () => ({ head: await gt(c, ['symbolic-ref', 'HEAD']), refs: await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)']), heads: await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), main: await index(c), mainBytes: digest(fs.readFileSync(path.join(c.implementationGitDir, 'index'))), own: await index(c, indexFile(c, 'tools')), ownBytes: digest(fs.readFileSync(indexFile(c, 'tools'))), other: await index(c, indexFile(c, 'other')), otherBytes: digest(fs.readFileSync(indexFile(c, 'other'))), metadata: inventory(directory(c)), exclude: digest(fs.readFileSync(path.join(c.implementationGitDir, 'info/exclude'))), config: digest(fs.readFileSync(path.join(c.implementationGitDir, 'config'))), disk: Object.fromEntries(['base.txt', 'layer.txt', 'other.txt', 'ordinary-before.txt', 'newcomer.txt'].map(file => [file, c.read(file)])) });
    const before = await observe();
    async function confirm(answer, label) {
      const request = path.join(c.root, 'confirmation-' + label + '.json');
      fs.writeFileSync(request, JSON.stringify({ executable: process.execPath, argv: [path.join(c.buildDir, 'cli.mjs'), '--cwd', c.repo, 'off', 'tools', '--discard'], cwd: c.repo, steps: [{ pattern: 'Confirmar? Digite sim: ', send: answer + '\r' }], timeout: 30000 }));
      const processResult = await c.run(process.execPath, [path.join(project, 'scripts/git-compat/pty-call.mjs'), request], { timeout: 35000 });
      const result = JSON.parse(processResult.stdout); c.eq('ConPTY backend ' + label, result.backend, 'node-pty 1.1.0 / real ConPTY'); c.eq('CLI child exit ' + label, result.code, 0); c.eq('Prompt answered ' + label, result.steps_completed, 1);
      const output = result.output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replaceAll('\r', '');
      const prompt = output.indexOf('Confirmar? Digite sim: '), prefix = output.slice(0, prompt), start = prefix.indexOf('{');
      c.ok('Preview precedes confirmation ' + label, prompt > start && start >= 0);
      const preview = JSON.parse(prefix.slice(start).trim()); c.eq('Interactive preview logical completeness ' + label, preview.logicalComplete, true);
      c.ok('Interactive preview includes unobserved newcomer ' + label, preview.unreconciled.includes('newcomer.txt')); c.ok('Interactive preview lists disappearance ' + label, preview.disappears.includes('newcomer.txt')); c.ok('Interactive preview exposes impediment ' + label, preview.impediments.some(item => item.code === 'LAYER_DIRTY'));
      evidence(c, 'interactive-' + label, { ...result, executable: '<NODE>', argv: ['<HEADLESS-CLI>', '--cwd', '<FIXTURE>/repo', 'off', 'tools', '--discard'], cwd: '<FIXTURE>/repo', preview }); return output;
    }
    const cancelled = await confirm('nao', 'cancel'); c.ok('Cancellation is explicit', cancelled.includes('"cancelled": true')); c.eq('Cancellation preserves all observed states and bytes', await observe(), before);
    await confirm('sim', 'confirm'); c.eq('Selected Layer file removed', c.exists('layer.txt'), false); c.eq('Unobserved new file removed only after confirmation', c.exists('newcomer.txt'), false); c.eq('Ordinary preexisting remains', c.read('ordinary-before.txt'), before.disk['ordinary-before.txt']);
    c.eq('Other Layer staged bytes retained', await index(c, indexFile(c, 'other')), before.other); c.eq('Other Layer index raw bytes retained', digest(fs.readFileSync(indexFile(c, 'other'))), before.otherBytes); c.eq('Other Layer physical bytes retained', c.read('other.txt'), before.disk['other.txt']); c.eq('Main semantic stage retained', await index(c), before.main); c.eq('Main physical bytes retained', c.read('base.txt'), before.disk['base.txt']); c.eq('Native branch refs unchanged', await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/']), before.heads); c.eq('Repository config unchanged', digest(fs.readFileSync(path.join(c.implementationGitDir, 'config'))), before.config);
    await success(c, ['on', 'tools']); c.eq('Reactivation uses committed content', c.read('layer.txt'), 'layer original\n'); c.eq('Discarded newcomer does not resurrect', c.exists('newcomer.txt'), false); c.eq('No new shelf', layer(c, 'tools').shelf ?? null, null);
    return { limits: ['One real Windows ConPTY confirmation path using the public headless CLI; no editor/desktop. Preview cancellation and explicit sim are separate actions. Other prompt/interrupt timings remain outside this variant.'] };
  }, { capabilities: ['node', 'win32'], timeout: 180000 }),
  spec('IMPL-005', 'layer-lifecycle-and-external-ref', 'Rename/remove preserve other origins and diagnose external ref identity changes', 'L1', async c => {
    await initialize(c); await seedLayer(c);
    const oid = await gt(c, ['rev-parse', 'layer/tools']);
    await success(c, ['rename', 'tools', 'renamed']);
    c.eq('Rename keeps native history', await gt(c, ['rev-parse', 'layer/renamed']), oid);
    c.eq('Rename keeps projected bytes', c.read('layer.txt'), 'layer original\n');
    await success(c, ['remove', 'renamed', '--yes']);
    c.eq('Managed removal does not remove base bytes', c.read('base.txt'), 'base one\n');
    c.eq('Removed native branch is absent', (await c.git(['show-ref', '--verify', '--quiet', 'refs/heads/layer/renamed'], { ok: [1] })).code, 1);
    await seedLayer(c, 'external', 'external.txt');
    await c.git(['branch', '-m', 'layer/external', 'layer/outside']);
    const status = await success(c, ['status']);
    c.eq('External rename is diagnosed', status.safe, false); c.eq('External rename error specific', status.error?.code, 'EXTERNAL_REF');
    c.eq('External rename preserves file bytes', c.read('external.txt'), 'layer original\n');
  }),
  spec('IMPL-006', 'deliberate-branch-with-other-layer', 'Deliberate Layer branch uses native index while keeping another Layer physical', 'L2', async c => {
    await initialize(c); await seedLayer(c, 'tools', 'tools.txt'); await seedLayer(c, 'other', 'other.txt', 'other origin\n');
    const main = await gt(c, ['rev-parse', 'main']), other = await gt(c, ['rev-parse', 'layer/other']);
    await success(c, ['open-branch', 'tools']);
    c.eq('HEAD is deliberate real Layer branch', await gt(c, ['symbolic-ref', 'HEAD']), 'refs/heads/layer/tools');
    c.eq('Other Layer remains physically available', c.read('other.txt'), 'other origin\n');
    c.eq('Base file not in Layer native tree', c.exists('base.txt'), false);
    c.write('tools.txt', 'native full branch change\n'); await c.git(['add', '.']); await c.git(['commit', '-m', 'native current Layer branch']);
    c.eq('Native Layer branch commit excludes the other origin', await tree(c, 'HEAD'), ['tools.txt']);
    c.eq('Other native history is independent', await gt(c, ['rev-parse', 'layer/other']), other);
    const status = await success(c, ['status']); c.eq('Role explicitly reported', status.role, 'layer-branch');
    await success(c, ['switch', 'main']);
    c.eq('Return to main preserves its ref', await gt(c, ['rev-parse', 'HEAD']), main);
    c.eq('Previously active Layer resumes its physical role', c.read('tools.txt'), 'native full branch change\n');
    c.eq('Other Layer remains present after exit', c.read('other.txt'), 'other origin\n');
  }),
  spec('IMPL-007', 'native-protection-and-explicit-bypass', 'Native worktree reservation prevents ordinary selection and documents Git bypass', 'L1', async c => {
    await initialize(c); await seedLayer(c); await success(c, ['off', 'tools']); await success(c, ['protect']);
    const head = await gt(c, ['rev-parse', 'HEAD']);
    const blocked = await c.git(['switch', 'layer/tools'], { ok: [128] });
    c.eq('Native selection is prevented by Git itself', blocked.code, 128); c.eq('Prevented selection preserves HEAD', await gt(c, ['rev-parse', 'HEAD']), head);
    await c.git(['switch', '--ignore-other-worktrees', 'layer/tools']);
    c.eq('Explicit native bypass really succeeds', await gt(c, ['symbolic-ref', 'HEAD']), 'refs/heads/layer/tools');
    const doctor = await cli(c, ['doctor']);
    c.eq('Bypass is diagnosed as unsafe', doctor.body.result.safe, false);
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: ['GL-22 is bounded opt-in prevention: native --ignore-other-worktrees is an observed bypass. No universal or default prevention claim.'] };
  }),
  spec('IMPL-008', 'raw-rescue-invalid-metadata-lock', 'Independent doctor/export salvage invalid metadata and lock evidence', 'L6', async c => {
    await initialize(c); const registryFile = path.join(directory(c), 'registry.json'), broken = '{ exact invalid registry bytes';
    fs.writeFileSync(registryFile, broken);
    fs.mkdirSync(path.join(directory(c), 'locks', 'coordinator'), { recursive: true });
    fs.writeFileSync(path.join(directory(c), 'locks', 'coordinator', 'inspect-me'), 'unknown owner is preserved');
    const doctor = await cli(c, ['doctor']); c.eq('Unsafe diagnostic has nonzero exit', doctor.code, 3); c.eq('Unsafe state is explicit', doctor.body.result.safe, false);
    const destination = path.join(c.root, 'raw-rescue');
    const result = await success(c, ['recovery-export', destination]);
    c.eq('Export completed without normal metadata load', result.complete, true);
    c.eq('Invalid bytes copied exactly', fs.readFileSync(path.join(destination, 'metadata', path.basename(directory(c)), 'registry.json'), 'utf8'), broken);
    c.eq('Source invalid bytes untouched', fs.readFileSync(registryFile, 'utf8'), broken);
    c.eq('Source disputed lock untouched', fs.readFileSync(path.join(directory(c), 'locks', 'coordinator', 'inspect-me'), 'utf8'), 'unknown owner is preserved');
  }),
  spec('IMPL-009', 'explicit-layout-migration', 'New layout default and explicit copy migration preserve all native Git state', 'L0', async c => {
    await initialize(c); const current = directory(c), legacy = path.join(c.implementationGitDir, 'git-layers');
    c.eq('Fresh product initializes layers', path.basename(current), 'layers');
    fs.renameSync(current, legacy);
    const original = inventory(legacy), refs = await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)']), mainIndex = await index(c);
    await refused(c, ['migrate'], 'CLI_USAGE');
    await success(c, ['migrate', '--yes']);
    c.eq('Legacy bytes retained', inventory(legacy), original);
    c.eq('Migration changes no native refs', await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)']), refs);
    c.eq('Migration changes no native index', await index(c), mainIndex);
    c.eq('New location contains original registry', fs.readFileSync(path.join(current, 'registry.json'), 'utf8'), fs.readFileSync(path.join(legacy, 'registry.json'), 'utf8'));
    c.eq('Migration can be reopened healthy', (await success(c, ['doctor'])).safe, true);
  }),
  spec('IMPL-010', 'share-local-bare-and-recognize-clone', 'Native local transport shares only committed Layer history and clone recognizes without activation', 'L3', async c => {
    await initialize(c); await seedLayer(c);
    const committed = await gt(c, ['rev-parse', 'layer/tools']);
    c.write('layer.txt', 'staged B not published\n'); await success(c, ['add', 'tools', '--', 'layer.txt']); c.write('layer.txt', 'disk C not published\n');
    const bare = path.join(c.root, 'receiver.git'), clone = path.join(c.root, 'second-clone');
    await c.git(['init', '--bare', '-b', 'main', bare]); await c.git(['-c', 'protocol.file.allow=always', 'push', bare, 'refs/heads/main:refs/heads/main', 'refs/heads/layer/tools:refs/heads/layer/tools']);
    await c.git(['-c', 'protocol.file.allow=always', 'clone', bare, clone]);
    c.eq('Native clone has no local Layer branch before recognition', (await c.git(['show-ref', '--verify', '--quiet', 'refs/heads/layer/tools'], { cwd: clone, ok: [1] })).code, 1);
    const cloneCli = async args => {
      const result = await c.run(process.execPath, [path.join(c.buildDir, 'cli.mjs'), '--cwd', clone, '--json', ...args], { cwd: clone, timeout: c.cliTimeoutMs });
      return JSON.parse(result.stdout).result;
    };
    await cloneCli(['init']); const list = await cloneCli(['list']);
    c.eq('Clone recognizes transported Layer without activation', list.some(item => item.name === 'tools' && item.state === 'inactive'), true);
    c.eq('Clone inactive Layer file absent', fs.existsSync(path.join(clone, 'layer.txt')), false);
    c.eq('Clone received original remote-tracking ref', (await raw(c, ['rev-parse', 'origin/layer/tools'], { cwd: clone })).trim(), committed);
    c.eq('Remote preview stays read-only', (await cloneCli(['preview', 'on', 'tools'])).readOnly, true);
    const remoteLog = await cloneCli(['log', 'tools']);
    c.eq('Remote history can be inspected before creating local branch', remoteLog[0].oid, committed);
    c.eq('Preview and log do not create local branch', (await c.git(['show-ref', '--verify', '--quiet', 'refs/heads/layer/tools'], { cwd: clone, ok: [1] })).code, 1);
    await cloneCli(['on', 'tools']);
    c.eq('Activation establishes local Layer at received native commit', (await raw(c, ['rev-parse', 'layer/tools'], { cwd: clone })).trim(), committed);
    c.eq('Clone activates committed A only', fs.readFileSync(path.join(clone, 'layer.txt'), 'utf8'), 'layer original\n');
    c.eq('Original stage B remains local', await raw(c, ['show', ':layer.txt'], { env: { GIT_INDEX_FILE: indexFile(c, 'tools') } }), 'staged B not published\n');
    c.eq('Original disk C remains local', c.read('layer.txt'), 'disk C not published\n');
    return { limits: ['Local file transport only; no hosted provider, personal remote, network credential or visual integration was tested.'] };
  }, { capabilities: ['node', 'local-transport'] }),
  spec('IMPL-011', 'native-whole-commit-and-optional-hunk', 'Whole-file preparation creates one native commit and optional hunk staging preserves later disk edits', 'L3', async c => {
    await initialize(c); const original = Array.from({ length: 30 }, (_, i) => 'line ' + String(i + 1).padStart(2, '0')).join('\n') + '\n';
    await seedLayer(c, 'tools', 'layer.txt', original);
    const initial = await gt(c, ['rev-parse', 'layer/tools']);
    c.write('layer.txt', original.replace('line 02', 'hunk first changed').replace('line 28', 'hunk second changed'));
    const hunks = await c.core('diffHunks', ['tools', 'layer.txt', false]);
    c.ok('Two separated optional hunks are available', hunks.hunks.length === 2, 2, hunks.hunks.length);
    await c.core('partialStage', ['tools', 'layer.txt', 0, hunks.token]);
    await success(c, ['commit', 'tools', '-m', 'optional native subset']);
    const first = await raw(c, ['show', 'layer/tools:layer.txt']);
    c.ok('Optional subset commit records first hunk only', first.includes('hunk first changed') && !first.includes('hunk second changed'));
    await success(c, ['add', 'tools', '--', 'layer.txt']); await success(c, ['commit', 'tools', '-m', 'remaining selected changes']);
    c.write('layer.txt', 'whole desired replacement\n'); await success(c, ['add', 'tools', '--', 'layer.txt']);
    const before = await gt(c, ['rev-parse', 'layer/tools']);
    await success(c, ['commit', 'tools', '-m', 'whole one normal commit']);
    c.eq('Whole preparation produces exactly one native parent step', await gt(c, ['rev-parse', 'layer/tools^']), before);
    c.eq('Exactly three user commits were explicitly requested', await gt(c, ['rev-list', '--count', initial + '..layer/tools']), '3');
    c.eq('Latest native blob is the full prepared content', await raw(c, ['show', 'layer/tools:layer.txt']), 'whole desired replacement\n');
    c.eq('Work branch history remains separate', await tree(c, 'main'), ['base.txt']);
  }),
  ...[
    ['stage', 'after-stage-index'],
    ['rename', 'after-layer-ref-change'],
    ['deactivate', 'after-deactivate-files'],
    ['openbranch', 'after-switch-head'],
  ].map(([operation, failpoint]) => spec('MODEL-008', 'implementation-handled-' + operation, 'Selected handled exception after ' + operation + ' publication: recover and inspect native state', 'L6', async c => {
    await initialize(c); await seedLayer(c);
    const refs = await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)']), main = await gt(c, ['rev-parse', 'main']), staged = await index(c, indexFile(c, 'tools'));
    let command;
    if (operation === 'stage') { c.write('layer.txt', 'later unstaged B must survive recovery\n'); command = ['add', 'tools', '--', 'layer.txt']; }
    if (operation === 'rename') command = ['rename', 'tools', 'renamed'];
    if (operation === 'deactivate') command = ['off', 'tools'];
    if (operation === 'openbranch') command = ['open-branch', 'tools'];
    await c.snapshot('before-selected-exception');
    await refused(c, command, 'INJECTED_FAILURE', { env: { GIT_LAYERS_FAILPOINT: failpoint } });
    const observedBeforeRecovery = { head: await gt(c, ['symbolic-ref', 'HEAD']), refs: await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)']), filePresent: c.exists('layer.txt') };
    const recovery = await cli(c, ['recover']);
    evidence(c, 'selected-boundary', { operation, failpoint, observedBeforeRecovery, recoveryExit: recovery.code, recovery: recovery.body, limits: modelLimits });
    c.eq('Selected handled exception can be recovered', recovery.code, 0, source);
    c.eq('Recovery keeps work branch main history', await gt(c, ['rev-parse', 'main']), main);
    c.eq('Recovery creates no extra Layer commit', await gt(c, ['rev-list', '--count', 'layer/tools']), '2');
    if (operation === 'stage') {
      c.eq('Staging recovery restores prior semantic alternate index', await index(c, indexFile(c, 'tools')), staged);
      c.eq('Staging recovery preserves later working bytes', c.read('layer.txt'), 'later unstaged B must survive recovery\n');
    } else {
      c.eq('Committed bytes remain physically available', c.read('layer.txt'), 'layer original\n');
      if (operation !== 'openbranch') c.eq('Selected rollback restores all prior native refs', await raw(c, ['for-each-ref', '--format=%(refname) %(objectname)']), refs);
    }
    c.eq('Post-recovery state is actually healthy', (await success(c, ['status'])).safe, true);
    return { productStatus: 'DOCUMENTED_RESTRICTION', limits: modelLimits };
  }, { productStatus: 'DOCUMENTED_RESTRICTION', tier: 'broad' })),
];
