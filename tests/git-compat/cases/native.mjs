import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Native baselines only. A PASS here does not certify a Layer implementation.
// Every command is delegated to the harness' absolute, isolated Git observer.
const source = 'Git official manual for the effective binary version; exact argv is retained in command evidence';
const trim = (r) => r.stdout.trim();
const zlist = (r) => r.stdout.split('\0').filter(Boolean);
const inside = (c, ...parts) => {
  const target = path.resolve(c.root, ...parts);
  const rel = path.relative(path.resolve(c.root), target);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('Native fixture path escaped its owned group');
  return target;
};
const writeAt = (c, repo, name, data) => {
  const dest = inside(c, path.relative(c.root, repo), name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
};
const bytesAt = (repo, name) => fs.readFileSync(path.join(repo, name));
const gitAt = (c, repo, argv, options = {}) => c.git(argv, { ...options, cwd: repo });
const oid = async (c, rev = 'HEAD', repo = c.repo) => trim(await gitAt(c, repo, ['rev-parse', rev]));
const index = async (c, repo = c.repo, env) => (await gitAt(c, repo, ['ls-files', '--stage', '-z'], { env })).stdout;
const paths = async (c, repo = c.repo, env) => zlist(await gitAt(c, repo, ['ls-files', '-z'], { env }));
const staged = async (c, file, repo = c.repo, env) => (await gitAt(c, repo, ['show', `:${file}`], { env })).stdout;
const committed = async (c, file, rev = 'HEAD', repo = c.repo) => (await gitAt(c, repo, ['show', `${rev}:${file}`])).stdout;
async function identity(c, repo) {
  await gitAt(c, repo, ['config', 'user.name', 'Native Fixture']);
  await gitAt(c, repo, ['config', 'user.email', 'native@example.invalid']);
  await gitAt(c, repo, ['config', 'core.autocrlf', 'false']);
  await gitAt(c, repo, ['config', 'commit.gpgsign', 'false']);
}
async function fresh(c, name, options = {}) {
  const repo = inside(c, name);
  fs.mkdirSync(repo, { recursive: false });
  await gitAt(c, repo, ['init', ...(options.bare ? ['--bare'] : ['-b', 'main'])]);
  await identity(c, repo);
  if (!options.bare && options.seed !== false) {
    writeAt(c, repo, 'base.txt', 'base one\n');
    await gitAt(c, repo, ['add', '--', 'base.txt']);
    await gitAt(c, repo, ['commit', '-m', 'base']);
  }
  return repo;
}
async function commit(c, file, text, message = file, repo = c.repo) {
  writeAt(c, repo, file, text);
  await gitAt(c, repo, ['add', '--', file]);
  await gitAt(c, repo, ['commit', '-m', message]);
  return oid(c, 'HEAD', repo);
}
async function conflict(c, kind = 'content', repo = c.repo) {
  const base = await oid(c, 'HEAD', repo);
  await gitAt(c, repo, ['switch', '-c', 'other']);
  if (kind === 'delete') await gitAt(c, repo, ['rm', '--', 'base.txt']);
  else writeAt(c, repo, 'base.txt', kind === 'binary' ? Buffer.from([0, 2, 3]) : 'theirs\n');
  await gitAt(c, repo, ['add', '-A']);
  await gitAt(c, repo, ['commit', '-m', 'other']);
  await gitAt(c, repo, ['switch', 'main']);
  await commit(c, 'base.txt', kind === 'binary' ? Buffer.from([0, 4, 5]) : 'ours\n', 'main', repo);
  const ours = await oid(c, 'HEAD', repo);
  const theirs = await oid(c, 'other', repo);
  const result = await gitAt(c, repo, ['merge', '--no-edit', 'other'], { ok: [1] });
  c.eq('merge refuses unresolved content', result.code, 1, source);
  return { base, ours, theirs };
}
async function localRemote(c, name = 'remote.git') {
  const remote = await fresh(c, name, { bare: true });
  await c.git(['remote', 'add', 'origin', remote]);
  return remote;
}
function hook(c, name, body, repo = c.repo) {
  const dir = inside(c, `${path.basename(repo)}-hooks`);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, name);
  fs.writeFileSync(dest, `#!/bin/sh\nset -eu\n${body}\n`, { mode: 0o755 });
  return c.git(['config', 'core.hooksPath', dir], { cwd: repo });
}
function native(id, title, run, options = {}) {
  return {
    id, variant: 'native', title, profile: 'N0', tier: options.tier ?? 'daily',
    capabilities: options.capabilities ?? [], phase: 'NATIVE_BASELINE',
    productStatus: 'NOT_ASSESSED', timeout: options.timeout ?? 60000,
    async run(c) {
      if (options.init !== false) await c.init();
      await c.snapshot('native-before');
      const result = await run(c);
      await c.snapshot('native-after');
      return { limits: [...(options.limits ?? []), ...(result?.limits ?? [])] };
    },
  };
}

export const cases = [
  native('ENV-001', 'Inventory of the actual official binary', async c => {
    const version = await c.git(['version', '--build-options']);
    c.ok('Git version identified', /^git version \d+\.\d+/m.test(version.stdout), 'git version header', version.stdout, source);
    const inventory = await c.git(['help', '-a', '--no-aliases', '--no-external-commands']);
    c.ok('Builtins inventory contains add/commit', /\badd\b/.test(inventory.stdout) && /\bcommit\b/.test(inventory.stdout));
    await c.git(['help', '-g']);
    await c.git(['help', '-i']);
    c.ok('Absolute observer selected', path.isAbsolute(c.gitPath), true, c.gitPath);
  }, { tier: 'smoke', limits: ['Inventory is availability evidence, not functional coverage of the listed commands.'] }),
  native('ENV-003', 'Repository discovery and relative add from a subdirectory', async c => {
    c.write('src/deep/inner.txt', 'inside\n'); c.write('outside.txt', 'outside\n');
    const sub = path.join(c.repo, 'src', 'deep');
    c.eq('Same top-level from subdirectory', trim(await c.git(['rev-parse', '--show-toplevel'], { cwd: sub })).replaceAll('\\', '/'), c.repo.replaceAll('\\', '/'));
    await c.git(['add', '.'], { cwd: sub });
    c.eq('Relative add selects inner only', await paths(c), ['base.txt', 'src/deep/inner.txt']);
    c.eq('C option selects same repository', trim(await c.git(['-C', sub, 'rev-parse', 'HEAD'])), await oid(c));
  }),
  native('ENV-004', 'Separate git directory is discovered through a gitfile', async c => {
    const repo = inside(c, 'separate tree'), metadata = inside(c, 'separate metadata');
    fs.mkdirSync(repo);
    await c.git(['init', '-b', 'main', '--separate-git-dir', metadata, repo]);
    await identity(c, repo);
    c.ok('gitfile is a regular file', fs.statSync(path.join(repo, '.git')).isFile());
    c.eq('Resolved gitdir', path.resolve(trim(await gitAt(c, repo, ['rev-parse', '--absolute-git-dir']))), metadata);
    writeAt(c, repo, 'sentinel.txt', 'separate\n');
    await gitAt(c, repo, ['add', '--', 'sentinel.txt']);
    await gitAt(c, repo, ['commit', '-m', 'separate']);
    c.eq('Gitfile repository blob', await committed(c, 'sentinel.txt', 'HEAD', repo), 'separate\n');
  }),
  native('ENV-005', 'Explicit GIT_DIR and GIT_WORK_TREE agree with command options', async c => {
    const meta = trim(await c.git(['rev-parse', '--absolute-git-dir']));
    const env = { ...c.env, GIT_DIR: meta, GIT_WORK_TREE: c.repo };
    const a = await c.git(['rev-parse', 'HEAD'], { cwd: c.root, env });
    const b = await c.git([`--git-dir=${meta}`, `--work-tree=${c.repo}`, 'rev-parse', 'HEAD'], { cwd: c.root });
    c.eq('Explicit environment and options target same HEAD', a.stdout, b.stdout);
    c.write('explicit.txt', 'explicit\n');
    await c.git(['add', '--', 'explicit.txt'], { cwd: c.root, env });
    c.eq('Only intended worktree staged', await staged(c, 'explicit.txt'), 'explicit\n');
    c.ok('No accidental repository at group root', !fs.existsSync(path.join(c.root, '.git')));
  }),
  native('ENV-006', 'Configuration precedence and origin are observable', async c => {
    const globalConfig = inside(c, 'synthetic-global.config');
    fs.writeFileSync(globalConfig, '[compat]\n value = global\n');
    const env = { ...c.env, GIT_CONFIG_GLOBAL: globalConfig, COMPAT_VALUE: 'environment' };
    await c.git(['config', 'compat.value', 'local']);
    c.eq('Local overrides synthetic global', trim(await c.git(['config', 'compat.value'], { env })), 'local');
    c.eq('Command overrides local', trim(await c.git(['-c', 'compat.value=command', 'config', 'compat.value'], { env })), 'command');
    c.eq('Config-env is explicit', trim(await c.git(['--config-env=compat.value=COMPAT_VALUE', 'config', 'compat.value'], { env })), 'environment');
    const origins = await c.git(['config', '--show-origin', '--show-scope', '--get-all', 'compat.value'], { env });
    c.ok('Origin shows both isolated levels', origins.stdout.includes('global') && origins.stdout.includes('local'), 'global and local', origins.stdout);
  }),
  native('ENV-007', 'Include and includeIf onbranch select effective configuration', async c => {
    const include = inside(c, 'included.config'), conditional = inside(c, 'branch.config');
    fs.writeFileSync(include, '[compat]\n included = yes\n');
    fs.writeFileSync(conditional, '[compat]\n selected = main-only\n');
    await c.git(['config', 'include.path', include]);
    await c.git(['config', 'includeIf.onbranch:main.path', conditional]);
    c.eq('Include active', trim(await c.git(['config', 'compat.included'])), 'yes');
    c.eq('Branch conditional active on main', trim(await c.git(['config', 'compat.selected'])), 'main-only');
    await c.git(['switch', '-c', 'other']);
    c.eq('Branch conditional absent after switch', (await c.git(['config', '--get', 'compat.selected'], { ok: [1] })).code, 1);
  }),
  native('ENV-008', 'Simple and shell aliases execute in isolated repository context', async c => {
    await c.git(['config', 'alias.fixture-status', 'status --porcelain=v1']);
    c.write('untracked.txt', 'alias\n');
    c.eq('Simple alias matches builtin', (await c.git(['fixture-status'])).stdout, (await c.git(['status', '--porcelain=v1'])).stdout);
    await c.git(['config', 'alias.fixture-shell', '!f() { git rev-parse --show-toplevel; printf "argument=%s\\n" "$1"; }; f']);
    const result = await c.git(['fixture-shell', 'a b']);
    c.ok('Shell alias retains one spaced argument', result.stdout.includes('argument=a b\n'), 'argument=a b', result.stdout);
    c.ok('Shell alias repository context', result.stdout.replaceAll('\\', '/').includes(c.repo.replaceAll('\\', '/')));
  }),
  native('ENV-010', 'Ceiling directory prevents accidental parent repository discovery', async c => {
    c.write('deep/sub/keep.txt', 'keep\n');
    const cwd = path.join(c.repo, 'deep', 'sub');
    const result = await c.git(['rev-parse', '--show-toplevel'], { cwd, env: { ...c.env, GIT_CEILING_DIRECTORIES: path.join(c.repo, 'deep') }, ok: [128] });
    c.eq('Discovery blocked at explicit ceiling', result.code, 128);
    c.eq('Tracked base unchanged', await committed(c, 'base.txt'), 'base one\n');
  }, { limits: ['PATH-with-spaces executable discovery is not exercised by this ceiling variant.'] }),
  native('ENV-011', 'Queries outside a repository fail without implicit initialization', async c => {
    const empty = inside(c, 'not-a-repository'); fs.mkdirSync(empty);
    c.eq('Status outside repository rejected', (await c.git(['status', '--porcelain=v1'], { cwd: empty, ok: [128] })).code, 128);
    c.eq('Invalid option rejected', (await c.git(['status', '--compat-invalid-option'], { ok: [129] })).code, 129);
    c.ok('Query creates no .git', !fs.existsSync(path.join(empty, '.git')));
    c.eq('Original HEAD retained', await committed(c, 'base.txt'), 'base one\n');
  }),
  native('INIT-001', 'Unborn HEAD and first commit have no invented parent', async c => {
    await c.git(['init', '-b', 'main']); await identity(c, c.repo);
    c.eq('Unborn symref', trim(await c.git(['symbolic-ref', 'HEAD'])), 'refs/heads/main');
    c.eq('Unborn HEAD cannot resolve', (await c.git(['rev-parse', '--verify', 'HEAD'], { ok: [128] })).code, 128);
    await commit(c, 'first.txt', 'first\n');
    c.eq('Root has exactly its own OID', trim(await c.git(['rev-list', '--parents', '-n', '1', 'HEAD'])).split(' ').length, 1);
    c.eq('Root tree bytes', await committed(c, 'first.txt'), 'first\n');
  }, { init: false, tier: 'smoke' }),
  native('INIT-002', 'Init preserves preexisting bytes and leaves them untracked', async c => {
    c.write('preexisting.bin', Buffer.from([0, 255, 7]));
    await c.git(['init', '-b', 'main']);
    c.eq('Sentinel bytes preserved', [...bytesAt(c.repo, 'preexisting.bin')], [0, 255, 7]);
    c.eq('Init does not stage', await paths(c), []);
    c.ok('File remains untracked', (await c.git(['status', '--porcelain=v1'])).stdout.includes('?? preexisting.bin'));
  }, { init: false }),
  native('INIT-003', 'Reinitialization preserves existing refs and index', async c => {
    await c.git(['branch', 'saved']); c.write('new.txt', 'new\n'); await c.git(['add', '--', 'new.txt']);
    const before = { head: await oid(c), index: await index(c), refs: (await c.git(['show-ref'])).stdout };
    await c.git(['init']);
    c.eq('HEAD retained', await oid(c), before.head); c.eq('Index retained', await index(c), before.index);
    c.eq('Refs retained', (await c.git(['show-ref'])).stdout, before.refs); c.eq('Worktree retained', c.read('new.txt'), 'new\n');
  }),
  native('INIT-004', 'Bare repository has objects and refs but no worktree', async c => {
    const bare = await fresh(c, 'bare.git', { bare: true });
    c.eq('Bare flag', trim(await gitAt(c, bare, ['rev-parse', '--is-bare-repository'])), 'true');
    const blob = trim(await gitAt(c, bare, ['hash-object', '-w', '--stdin'], { stdin: 'bare\n' }));
    c.eq('Bare blob usable', (await gitAt(c, bare, ['cat-file', 'blob', blob])).stdout, 'bare\n');
    c.eq('Status requires worktree', (await gitAt(c, bare, ['status'], { ok: [128] })).code, 128);
    c.ok('No synthetic working file', !fs.existsSync(path.join(bare, 'base.txt')));
  }),
  native('INIT-005', 'Normal local clone receives remote Layer heads as tracking refs', async c => {
    await c.git(['branch', 'layer/ai']); const origin = await localRemote(c);
    await c.git(['push', '--all', 'origin']); await gitAt(c, origin, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    const clone = inside(c, 'normal clone'); await c.git(['clone', '--no-hardlinks', origin, clone]);
    c.eq('Initial local branch', trim(await gitAt(c, clone, ['symbolic-ref', 'HEAD'])), 'refs/heads/main');
    c.eq('Remote layer tracking ref', await oid(c, 'refs/remotes/origin/layer/ai', clone), await oid(c, 'layer/ai'));
    c.eq('No automatic local Layer branch', (await gitAt(c, clone, ['show-ref', '--verify', '--quiet', 'refs/heads/layer/ai'], { ok: [1] })).code, 1);
    c.ok('No arbitrary private metadata in clone', !fs.existsSync(path.join(clone, '.git', 'git-layers')) && !fs.existsSync(path.join(clone, '.git', 'layers')));
  }),
  native('INIT-006', 'Single-branch and no-checkout clone have distinct effects', async c => {
    await c.git(['branch', 'other']);
    const single = inside(c, 'single'), no = inside(c, 'no-checkout');
    await c.git(['clone', '--no-hardlinks', '--single-branch', '--branch', 'main', c.repo, single]);
    c.eq('Unselected remote branch absent', (await gitAt(c, single, ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/other'], { ok: [1] })).code, 1);
    await c.git(['clone', '--no-hardlinks', '--no-checkout', c.repo, no]);
    c.ok('No-checkout omits physical base', !fs.existsSync(path.join(no, 'base.txt')));
    c.eq('No-checkout still has commit', await oid(c, 'HEAD', no), await oid(c));
  }),
  native('INIT-007', 'Bare and mirror clone copy different namespaces', async c => {
    const head = await oid(c); await c.git(['update-ref', 'refs/compat/rescue', head]); await c.git(['tag', 'v1']);
    const bare = inside(c, 'bare-clone.git'), mirror = inside(c, 'mirror-clone.git');
    await c.git(['clone', '--no-hardlinks', '--bare', c.repo, bare]);
    await c.git(['clone', '--no-hardlinks', '--mirror', c.repo, mirror]);
    c.eq('Bare copies heads', await oid(c, 'refs/heads/main', bare), head);
    c.eq('Bare omits extra namespace', (await gitAt(c, bare, ['show-ref', '--verify', '--quiet', 'refs/compat/rescue'], { ok: [1] })).code, 1);
    c.eq('Mirror copies extra namespace', await oid(c, 'refs/compat/rescue', mirror), head);
    c.eq('Mirror configured explicitly', trim(await gitAt(c, mirror, ['config', 'remote.origin.mirror'])), 'true');
  }),
  native('INIT-008', 'Shallow local file transport deepens and unshallows history', async c => {
    await commit(c, 'base.txt', 'second\n'); await commit(c, 'base.txt', 'third\n');
    const clone = inside(c, 'shallow');
    const url = `file:///${c.repo.replaceAll('\\', '/')}`.replace('file:////', 'file:///');
    await c.git(['clone', '--no-hardlinks', '--depth=1', url, clone]);
    c.eq('Initially shallow', trim(await gitAt(c, clone, ['rev-parse', '--is-shallow-repository'])), 'true');
    c.eq('Depth one ancestry', trim(await gitAt(c, clone, ['rev-list', '--count', 'HEAD'])), '1');
    await gitAt(c, clone, ['fetch', '--deepen=1']);
    c.eq('Deepened ancestry', trim(await gitAt(c, clone, ['rev-list', '--count', 'HEAD'])), '2');
    await gitAt(c, clone, ['fetch', '--unshallow']);
    c.eq('Unshallow complete', trim(await gitAt(c, clone, ['rev-list', '--count', 'HEAD'])), '3');
  }),
  native('INIT-010', 'Shared clone declares alternates while dissociate removes dependency', async c => {
    const shared = inside(c, 'shared'), detached = inside(c, 'dissociated');
    await c.git(['clone', '--shared', '--no-checkout', c.repo, shared]);
    const sharedObjects = trim(await gitAt(c, shared, ['rev-parse', '--git-path', 'objects/info/alternates']));
    const sharedPath = path.resolve(shared, sharedObjects);
    c.ok('Shared clone alternate points only into owned group', fs.readFileSync(sharedPath, 'utf8').replaceAll('\\', '/').includes(c.repo.replaceAll('\\', '/')));
    await c.git(['clone', '--no-hardlinks', '--reference', c.repo, '--dissociate', c.repo, detached]);
    const alt = path.resolve(detached, trim(await gitAt(c, detached, ['rev-parse', '--git-path', 'objects/info/alternates'])));
    c.ok('Dissociate removes alternates dependency', !fs.existsSync(alt) || fs.readFileSync(alt, 'utf8').trim() === '');
    c.eq('Dissociated content', await committed(c, 'base.txt', 'HEAD', detached), 'base one\n');
    await gitAt(c, detached, ['fsck', '--full']);
  }, { limits: ['Origin remains immutable; no shared object-store GC is performed. --no-hardlinks is covered in other clone baselines.'] }),
  native('INIT-011', 'Controlled template files are copied without claiming ownership', async c => {
    const template = inside(c, 'template'), repo = inside(c, 'templated');
    fs.mkdirSync(template); fs.writeFileSync(path.join(template, 'unknown-sentinel.txt'), 'template-owned\n'); fs.mkdirSync(repo);
    await gitAt(c, repo, ['init', '-b', 'main', `--template=${template}`]);
    const gitdir = trim(await gitAt(c, repo, ['rev-parse', '--absolute-git-dir']));
    c.eq('Template bytes copied', fs.readFileSync(path.join(gitdir, 'unknown-sentinel.txt'), 'utf8'), 'template-owned\n');
    c.eq('No files auto-staged', await paths(c, repo), []);
  }, { limits: ['Template hook execution is covered separately by HOOK baselines.'] }),

  native('INDEX-002', 'Add dot in a subdirectory excludes changes outside it', async c => {
    await commit(c, 'src/tracked.txt', 'old\n');
    c.write('base.txt', 'outside changed\n'); c.write('src/tracked.txt', 'inside changed\n'); c.write('src/new.txt', 'new\n');
    c.write('.git/info/exclude', '/src/layer-only.txt\n'); c.write('src/layer-only.txt', 'ignored layer-equivalent\n');
    await c.git(['add', '.'], { cwd: path.join(c.repo, 'src') });
    c.eq('Inside staged', await staged(c, 'src/tracked.txt'), 'inside changed\n');
    c.eq('Outside not staged', await staged(c, 'base.txt'), 'base one\n');
    c.ok('Ignored projection excluded', !(await paths(c)).includes('src/layer-only.txt'));
  }, { limits: ['N0 equivalent ignore rules; real Layer state is tested by product cases.'] }),
  native('INDEX-003', 'Add all stages additions modifications and removals across tree', async c => {
    await commit(c, 'gone.txt', 'remove\n'); c.write('base.txt', 'changed\n'); c.write('deep/new.txt', 'new\n');
    fs.unlinkSync(path.join(c.repo, 'gone.txt')); await c.git(['add', '-A']);
    c.eq('All tree membership', await paths(c), ['base.txt', 'deep/new.txt']);
    c.eq('Modified blob staged', await staged(c, 'base.txt'), 'changed\n');
    c.eq('HEAD still contains removed path', await committed(c, 'gone.txt'), 'remove\n');
  }),
  native('INDEX-004', 'Add update excludes new untracked paths', async c => {
    c.write('base.txt', 'tracked\n'); c.write('new.txt', 'new\n'); await c.git(['add', '-u']);
    c.eq('Only tracked path remains in index', await paths(c), ['base.txt']);
    c.eq('Tracked update staged', await staged(c, 'base.txt'), 'tracked\n');
    c.eq('Untracked bytes preserved', c.read('new.txt'), 'new\n');
  }),
  native('INDEX-005', 'Explicit add of ignored path fails without staging it', async c => {
    c.write('.git/info/exclude', '/ignored.txt\n'); c.write('ignored.txt', 'ignored\n'); const before = await index(c);
    c.eq('Ignored add fails', (await c.git(['add', '--', 'ignored.txt'], { ok: [1] })).code, 1);
    c.eq('Index semantically unchanged', await index(c), before); c.eq('Bytes preserved', c.read('ignored.txt'), 'ignored\n');
  }, { limits: ['N0 ignore baseline; ownership metadata is not present.'] }),
  native('INDEX-006', 'Forced add bypasses an effective native ignore', async c => {
    c.write('.git/info/exclude', '/layer-only.txt\n'); c.write('layer-only.txt', 'projection\n');
    await c.git(['add', '-f', '--', 'layer-only.txt']);
    c.eq('Forced native add stages ignored bytes', await staged(c, 'layer-only.txt'), 'projection\n');
    c.eq('HEAD has not moved', trim(await c.git(['rev-list', '--count', 'HEAD'])), '1');
  }, { limits: ['Native ignore-equivalent risk baseline; product force policy remains undecided.'] }),
  native('INDEX-010', 'Intent-to-add marks an empty indexed blob without staging file content', async c => {
    c.write('intent.txt', 'intent contents\n'); await c.git(['add', '-N', '--', 'intent.txt']);
    const empty = trim(await c.git(['hash-object', '--stdin'], { stdin: '' }));
    c.ok('Intent index contains empty blob', (await index(c)).includes(`${empty} 0\tintent.txt`));
    c.eq('Intent hidden from cached diff by explicit mode', (await c.git(['diff', '--cached', '--ita-invisible-in-index', '--name-only'])).stdout, '');
    c.ok('Workspace diff exposes new contents', (await c.git(['diff', '--', 'intent.txt'])).stdout.includes('+intent contents'));
    await c.git(['add', '--', 'intent.txt']); await c.git(['commit', '-m', 'intent completed']);
    c.eq('Later ordinary add commits full content', await committed(c, 'intent.txt'), 'intent contents\n');
  }),
  native('INDEX-011', 'Commit snapshots staged B while retaining workspace C', async c => {
    c.write('base.txt', 'B\n'); await c.git(['add', '--', 'base.txt']); c.write('base.txt', 'C\n'); await c.git(['commit', '-m', 'staged B']);
    c.eq('Committed B', await committed(c, 'base.txt'), 'B\n'); c.eq('Workspace C', c.read('base.txt'), 'C\n');
    c.eq('Index B', await staged(c, 'base.txt'), 'B\n');
  }, { tier: 'smoke' }),
  native('INDEX-012', 'Rm cached differs from physical rm and refuses modified data', async c => {
    await commit(c, 'cached.txt', 'cached\n'); await commit(c, 'physical.txt', 'physical\n');
    c.write('base.txt', 'local\n'); const before = await index(c);
    c.eq('Rm refuses modified tracked file', (await c.git(['rm', '--', 'base.txt'], { ok: [1] })).code, 1);
    c.eq('Rejected rm preserves index', await index(c), before); c.eq('Rejected rm preserves disk', c.read('base.txt'), 'local\n');
    await c.git(['rm', '--cached', '--', 'cached.txt']); await c.git(['rm', '--', 'physical.txt']);
    c.ok('Cached removal preserves physical copy', c.exists('cached.txt')); c.ok('Normal removal removes disk copy', !c.exists('physical.txt'));
    c.eq('Both removed from staging', await paths(c), ['base.txt']);
  }),
  native('INDEX-013', 'Mv stages snapshots and rename presentation is optional', async c => {
    await c.git(['mv', '--', 'base.txt', 'renamed.txt']);
    c.eq('Rename tree membership', await paths(c), ['renamed.txt']);
    c.ok('Rename detection reports similarity', (await c.git(['diff', '--cached', '--name-status', '-M'])).stdout.includes('R100'));
    const plain = (await c.git(['diff', '--cached', '--name-status', '--no-renames'])).stdout;
    c.ok('Without rename detection explicit add and delete', plain.includes('D\tbase.txt') && plain.includes('A\trenamed.txt'));
    c.eq('Rename keeps bytes', c.read('renamed.txt'), 'base one\n');
  }, { limits: ['Similarity thresholds for edited rename variants are not exhaustively exercised.'] }),
  native('INDEX-014', 'Restore independently selects workspace index or explicit source', async c => {
    for (const mode of ['worktree', 'staged', 'source']) {
      const repo = await fresh(c, `restore-${mode}`); writeAt(c, repo, 'base.txt', 'B\n'); await gitAt(c, repo, ['add', 'base.txt']); writeAt(c, repo, 'base.txt', 'C\n');
      await gitAt(c, repo, ['restore', ...(mode === 'staged' ? ['--staged'] : mode === 'source' ? ['--source=HEAD'] : []), '--', 'base.txt']);
      c.eq(`${mode} index`, await staged(c, 'base.txt', repo), mode === 'staged' ? 'base one\n' : 'B\n');
      c.eq(`${mode} workspace`, fs.readFileSync(path.join(repo, 'base.txt'), 'utf8'), mode === 'staged' ? 'C\n' : mode === 'source' ? 'base one\n' : 'B\n');
    }
  }),
  native('INDEX-015', 'Path reset unstages exactly one path without moving HEAD', async c => {
    c.write('a.txt', 'a\n'); c.write('b.txt', 'b\n'); await c.git(['add', '--', 'a.txt', 'b.txt']); const head = await oid(c);
    await c.git(['reset', '--', 'a.txt']);
    c.eq('HEAD unchanged', await oid(c), head); c.eq('Only b stays staged', await paths(c), ['b.txt', 'base.txt']);
    c.eq('Unstaged a remains on disk', c.read('a.txt'), 'a\n');
  }),
  native('INDEX-016', 'Alternate index writes a real tree without altering main index or HEAD', async c => {
    const env = { ...c.env, GIT_INDEX_FILE: inside(c, 'alternate.index') }, before = await index(c), head = await oid(c);
    await c.git(['read-tree', '--empty'], { env }); c.write('alternate.txt', 'alternate\n'); await c.git(['add', '--', 'alternate.txt'], { env });
    const tree = trim(await c.git(['write-tree'], { env }));
    c.eq('Alternate tree has planned path only', zlist(await c.git(['ls-tree', '-r', '--name-only', '-z', tree])), ['alternate.txt']);
    c.eq('Alternate blob bytes', (await c.git(['show', `${tree}:alternate.txt`])).stdout, 'alternate\n');
    c.eq('Main index untouched', await index(c), before); c.eq('HEAD untouched', await oid(c), head);
  }, { tier: 'smoke' }),
  native('INDEX-017', 'An occupied native index lock is never removed by a failed add', async c => {
    const lock = path.resolve(c.repo, trim(await c.git(['rev-parse', '--git-path', 'index.lock']))); fs.writeFileSync(lock, `owned-by-fixture-${process.pid}\n`, { flag: 'wx' });
    c.write('base.txt', 'blocked\n'); const before = await index(c), head = await oid(c);
    c.eq('Locked add rejected', (await c.git(['add', '--', 'base.txt'], { ok: [128] })).code, 128);
    c.eq('Lock preserved', fs.readFileSync(lock, 'utf8'), `owned-by-fixture-${process.pid}\n`); c.eq('Index preserved', await index(c), before); c.eq('HEAD preserved', await oid(c), head);
  }, { limits: ['The fixture owns the lock sentinel; a live concurrent native writer is not demonstrated by this variant.'] }),

  native('COMMIT-001', 'Simple commit tree equals prepared bytes', async c => {
    c.write('base.txt', 'committed\n'); await c.git(['add', '--', 'base.txt']); const parent = await oid(c); await c.git(['commit', '-m', 'simple']);
    c.eq('Commit parent exact', trim(await c.git(['rev-parse', 'HEAD^'])), parent); c.eq('Committed bytes exact', await committed(c, 'base.txt'), 'committed\n');
    c.eq('Clean staging', (await c.git(['diff', '--cached', '--name-only'])).stdout, '');
  }, { tier: 'smoke', limits: ['N0 baseline contains no real Layer.'] }),
  native('COMMIT-002', 'Commit all includes tracked edits while excluding untracked ignored files', async c => {
    c.write('base.txt', 'tracked edit\n'); c.write('ordinary-new.txt', 'new\n'); c.write('.git/info/exclude', '/layer-only.txt\n'); c.write('layer-only.txt', 'ignored projection\n');
    await c.git(['commit', '-a', '-m', 'all tracked']);
    c.eq('Committed tracked edit', await committed(c, 'base.txt'), 'tracked edit\n'); c.eq('Only tracked path in tree', zlist(await c.git(['ls-tree', '-r', '--name-only', '-z', 'HEAD'])), ['base.txt']);
    c.eq('Ignored bytes preserved', c.read('layer-only.txt'), 'ignored projection\n');
  }, { limits: ['N0 equivalent ignore baseline; product ownership is not assessed.'] }),
  native('COMMIT-003', 'Path commit reads selected disk bytes and preserves unrelated staging', async c => {
    await commit(c, 'other.txt', 'original\n'); c.write('base.txt', 'staged A\n'); await c.git(['add', 'base.txt']); c.write('other.txt', 'disk B\n');
    await c.git(['commit', '-m', 'selected only', '--', 'other.txt']);
    c.eq('Selected disk content committed', await committed(c, 'other.txt'), 'disk B\n'); c.eq('Unrelated staged content not committed', await committed(c, 'base.txt'), 'base one\n'); c.eq('Unrelated staged content retained', await staged(c, 'base.txt'), 'staged A\n');
  }),
  native('COMMIT-004', 'Only and include consume distinct path selections', async c => {
    for (const mode of ['--only', '--include']) {
      const repo = await fresh(c, `commit-${mode.slice(2)}`); await commit(c, 'other.txt', 'old\n', 'other', repo);
      writeAt(c, repo, 'base.txt', 'A\n'); await gitAt(c, repo, ['add', 'base.txt']); writeAt(c, repo, 'other.txt', 'B\n');
      await gitAt(c, repo, ['commit', mode, '-m', mode, '--', 'other.txt']);
      c.eq(`${mode} selected content`, await committed(c, 'other.txt', 'HEAD', repo), 'B\n');
      c.eq(`${mode} unrelated staged content`, await committed(c, 'base.txt', 'HEAD', repo), mode === '--only' ? 'base one\n' : 'A\n');
      c.eq(`${mode} residual staging`, (await gitAt(c, repo, ['diff', '--cached', '--name-only'])).stdout, mode === '--only' ? 'base.txt\n' : '');
    }
  }),
  native('COMMIT-005', 'Allow-empty creates a new commit with an unchanged tree', async c => {
    const before = await oid(c), tree = await oid(c, 'HEAD^{tree}'); await c.git(['commit', '--allow-empty', '-m', 'deliberately empty']);
    c.ok('New commit identity', await oid(c) !== before); c.eq('Same tree', await oid(c, 'HEAD^{tree}'), tree); c.eq('Parent retained', await oid(c, 'HEAD^'), before);
  }),
  native('COMMIT-006', 'Missing identity fails without consuming staged changes', async c => {
    await c.git(['config', '--unset', 'user.name']); await c.git(['config', '--unset', 'user.email']); await c.git(['config', 'user.useConfigOnly', 'true']);
    c.write('base.txt', 'staged\n'); await c.git(['add', 'base.txt']); const before = await index(c), head = await oid(c);
    const env = { ...c.env, GIT_AUTHOR_NAME: '', GIT_AUTHOR_EMAIL: '', GIT_COMMITTER_NAME: '', GIT_COMMITTER_EMAIL: '' };
    const result = await c.git(['commit', '-m', 'must fail'], { env, ok: [128] });
    c.eq('Identity failure code', result.code, 128); c.eq('Ref preserved', await oid(c), head); c.eq('Staging preserved', await index(c), before); c.eq('Disk preserved', c.read('base.txt'), 'staged\n');
  }),
  native('COMMIT-007', 'Amend replaces message and content without inventing an extra parent', async c => {
    const initial = await oid(c); await c.git(['commit', '--amend', '-m', 'amended root']);
    const messageOnly = await oid(c); c.ok('Message amend changes identity', messageOnly !== initial); c.eq('Root remains parentless', trim(await c.git(['rev-list', '--parents', '-n', '1', 'HEAD'])).split(' ').length, 1);
    c.write('base.txt', 'amended content\n'); await c.git(['add', 'base.txt']); await c.git(['commit', '--amend', '--no-edit']);
    c.ok('Content amend changes identity', await oid(c) !== messageOnly); c.eq('Amended blob', await committed(c, 'base.txt'), 'amended content\n');
  }),
  native('COMMIT-008', 'Author and committer metadata remain distinct', async c => {
    await c.git(['commit', '--allow-empty', '--author=Other Author <other@example.invalid>', '-m', 'distinct identities'], { env: { ...c.env, GIT_COMMITTER_NAME: 'Fixture Committer', GIT_COMMITTER_EMAIL: 'committer@example.invalid', GIT_AUTHOR_DATE: '2001-02-03T04:05:06+00:00', GIT_COMMITTER_DATE: '2002-03-04T05:06:07+00:00' } });
    const authorTime = Date.parse('2001-02-03T04:05:06+00:00') / 1000, committerTime = Date.parse('2002-03-04T05:06:07+00:00') / 1000;
    c.eq('Metadata fields', trim(await c.git(['show', '-s', '--format=%an|%ae|%cn|%ce|%at|%ct', 'HEAD'])), `Other Author|other@example.invalid|Fixture Committer|committer@example.invalid|${authorTime}|${committerTime}`, 'https://raw.githubusercontent.com/git/git/v2.53.0/Documentation/pretty-formats.adoc');
  }),
  native('COMMIT-009', 'Fixup autosquash changes history while preserving the intended final tree', async c => {
    const base = await oid(c); const target = await commit(c, 'target.txt', 'A\n', 'target change');
    await commit(c, 'unrelated.txt', 'unrelated\n', 'unrelated'); c.write('target.txt', 'B\n'); await c.git(['add', 'target.txt']); await c.git(['commit', `--fixup=${target}`]);
    const tree = await oid(c, 'HEAD^{tree}'); await c.git(['rebase', '-i', '--autosquash', base], { env: { ...c.env, GIT_SEQUENCE_EDITOR: ':' } });
    c.eq('Final tree preserved', await oid(c, 'HEAD^{tree}'), tree); c.eq('Fixup squashed into target', trim(await c.git(['rev-list', '--count', `${base}..HEAD`])), '2');
    c.eq('Target final bytes', await committed(c, 'target.txt'), 'B\n');
  }),
  native('COMMIT-010', 'UTF-8 multiline message and trailer survive argv and file input', async c => {
    c.write('message.txt', 'Acentuação e espaços\n\ncorpo com duas linhas\nsegunda linha\n');
    await c.git(['commit', '--allow-empty', '--cleanup=verbatim', '-F', 'message.txt', '--trailer', 'Reviewed-by: Fixture <review@example.invalid>']);
    const message = (await c.git(['show', '-s', '--format=%B', 'HEAD'])).stdout;
    c.ok('Unicode subject preserved', message.startsWith('Acentuação e espaços\n')); c.ok('Body preserved', message.includes('corpo com duas linhas\nsegunda linha\n')); c.ok('Trailer exact', message.includes('Reviewed-by: Fixture <review@example.invalid>'));
  }),
  native('COMMIT-012', 'Failing pre-commit refuses publication and no-verify bypass is explicit', async c => {
    await hook(c, 'pre-commit', 'printf "invoked\\n" >> "$GIT_DIR/../hook-marker.txt"\nexit 1');
    // Hooks run with GIT_DIR sometimes unset; use the known worktree-relative path.
    const hooksDir = trim(await c.git(['config', 'core.hooksPath'])); fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\nprintf "invoked\\n" >> hook-marker.txt\nexit 1\n');
    c.write('base.txt', 'staged\n'); await c.git(['add', 'base.txt']); const head = await oid(c), before = await index(c);
    c.eq('Hook refusal', (await c.git(['commit', '-m', 'blocked'], { ok: [1] })).code, 1); c.eq('Ref unchanged', await oid(c), head); c.eq('Index unchanged', await index(c), before);
    await c.git(['commit', '--no-verify', '-m', 'explicit bypass']); c.eq('Bypass commits prepared bytes', await committed(c, 'base.txt'), 'staged\n'); c.eq('Hook ran exactly once', c.read('hook-marker.txt'), 'invoked\n');
  }),
  native('COMMIT-013', 'Reflog retains prior commit identity across amend', async c => {
    const prior = await oid(c); await c.git(['commit', '--amend', '-m', 'rewritten']); const current = await oid(c);
    const logs = trim(await c.git(['reflog', 'show', '--format=%H', 'HEAD'])).split('\n');
    c.eq('Latest reflog current', logs[0], current); c.ok('Prior identity retained in reflog', logs.includes(prior), prior, logs);
  }),
  native('BRANCH-001', 'Creating a branch at an explicit revision does not checkout', async c => {
    const old = await oid(c); await commit(c, 'base.txt', 'new\n'); const head = await oid(c), before = await index(c);
    await c.git(['branch', 'saved', old]);
    c.eq('New ref selects old commit', await oid(c, 'saved'), old); c.eq('HEAD unchanged', await oid(c), head); c.eq('Index unchanged', await index(c), before); c.eq('Workspace unchanged', c.read('base.txt'), 'new\n');
  }),
  native('BRANCH-002', 'Switch -c and checkout -b create and select real branches', async c => {
    for (const [name, command] of [['switch-created', ['switch', '-c']], ['checkout-created', ['checkout', '-b']]]) {
      await c.git([...command, name]); c.eq(`${name} symbolic HEAD`, trim(await c.git(['symbolic-ref', 'HEAD'])), `refs/heads/${name}`); c.eq(`${name} indexed bytes`, await staged(c, 'base.txt'), 'base one\n');
    }
  }),
  native('BRANCH-003', 'A compatible local edit carries across native branch switch', async c => {
    await c.git(['switch', '-c', 'other']); await commit(c, 'other.txt', 'other\n'); await c.git(['switch', 'main']); c.write('base.txt', 'local edit\n');
    await c.git(['switch', 'other']); c.eq('Compatible edit carried', c.read('base.txt'), 'local edit\n'); c.eq('Target file materialized', c.read('other.txt'), 'other\n'); c.eq('Index remains target committed base', await staged(c, 'base.txt'), 'base one\n');
  }),
  native('BRANCH-004', 'Switch refuses an edit that target checkout would overwrite', async c => {
    await c.git(['switch', '-c', 'other']); await commit(c, 'base.txt', 'other\n'); await c.git(['switch', 'main']); c.write('base.txt', 'local protected\n');
    const head = await oid(c), before = await index(c); c.eq('Unsafe switch rejected', (await c.git(['switch', 'other'], { ok: [1] })).code, 1);
    c.eq('HEAD unchanged', await oid(c), head); c.eq('Index unchanged', await index(c), before); c.eq('Local bytes protected', c.read('base.txt'), 'local protected\n');
  }),
  native('BRANCH-005', 'Native checkout overwrites ignored collision unless explicitly forbidden', async c => {
    for (const protect of [false, true]) {
      const repo = await fresh(c, protect ? 'ignore-protected' : 'ignore-default'); await gitAt(c, repo, ['switch', '-c', 'target']); await commit(c, 'collision.txt', 'tracked target\n', 'target', repo); await gitAt(c, repo, ['switch', 'main']);
      writeAt(c, repo, '.git/info/exclude', '/collision.txt\n'); writeAt(c, repo, 'collision.txt', 'ignored local\n'); const head = await oid(c, 'HEAD', repo);
      await gitAt(c, repo, ['checkout', ...(protect ? ['--no-overwrite-ignore'] : []), 'target'], { ok: protect ? [1] : [0] });
      c.eq(`ignored bytes protect=${protect}`, fs.readFileSync(path.join(repo, 'collision.txt'), 'utf8'), protect ? 'ignored local\n' : 'tracked target\n');
      c.eq(`HEAD selection protect=${protect}`, await oid(c, 'HEAD', repo), protect ? head : await oid(c, 'target', repo));
    }
  }),
  native('BRANCH-006', 'Forced checkout deliberately discards tracked local changes', async c => {
    await c.git(['switch', '-c', 'target']); await commit(c, 'base.txt', 'target\n'); await c.git(['switch', 'main']); c.write('base.txt', 'discarded local\n');
    await c.git(['checkout', '-f', 'target']); c.eq('Target selected', await oid(c), await oid(c, 'target')); c.eq('Local bytes replaced deliberately', c.read('base.txt'), 'target\n'); c.eq('Index target bytes', await staged(c, 'base.txt'), 'target\n');
  }, { limits: ['Untracked directory collision variants remain outside this tracked-file variant.'] }),
  native('BRANCH-007', 'Detached commit remains discoverable after returning to main', async c => {
    const main = await oid(c); await c.git(['tag', 'v1']); await c.git(['switch', '--detach', 'v1']); await commit(c, 'detached.txt', 'detached\n'); const detached = await oid(c);
    c.eq('Detached HEAD lacks symref', (await c.git(['symbolic-ref', '-q', 'HEAD'], { ok: [1] })).code, 1);
    await c.git(['switch', 'main']); c.eq('Main unchanged', await oid(c), main); c.eq('Detached object still readable', await committed(c, 'detached.txt', detached), 'detached\n'); c.ok('Reflog retains detached OID', (await c.git(['reflog', '--format=%H'])).stdout.includes(detached));
  }),
  native('BRANCH-008', 'Switch orphan removes tracked files while checkout orphan carries them', async c => {
    for (const mode of ['switch', 'checkout']) {
      const repo = await fresh(c, `orphan-${mode}`); await gitAt(c, repo, [mode, '--orphan', 'independent']);
      c.eq(`${mode} unborn HEAD`, (await gitAt(c, repo, ['rev-parse', '--verify', 'HEAD'], { ok: [128] })).code, 128);
      c.eq(`${mode} retained index`, await paths(c, repo), mode === 'checkout' ? ['base.txt'] : []);
      writeAt(c, repo, 'root.txt', 'root\n'); await gitAt(c, repo, ['add', 'root.txt']); await gitAt(c, repo, ['commit', '-m', 'independent root']);
      c.eq(`${mode} root no parent`, trim(await gitAt(c, repo, ['rev-list', '--parents', '-n', '1', 'HEAD'])).split(' ').length, 1);
    }
  }),
  native('BRANCH-009', 'Renaming active branch updates symref without changing tree', async c => {
    const head = await oid(c), before = await index(c); await c.git(['branch', '-m', 'renamed']);
    c.eq('Symref renamed', trim(await c.git(['symbolic-ref', 'HEAD'])), 'refs/heads/renamed'); c.eq('Same commit', await oid(c), head); c.eq('Same index', await index(c), before);
    await c.git(['branch', 'occupied']); await c.git(['branch', '-M', 'occupied']); c.eq('Force rename picks target', trim(await c.git(['symbolic-ref', 'HEAD'])), 'refs/heads/occupied');
  }, { limits: ['N0 only; product handling of an externally renamed base is assessed separately.'] }),
  native('BRANCH-010', 'Branch deletion distinguishes merged divergent and active heads', async c => {
    await c.git(['branch', 'merged']); await c.git(['branch', '-d', 'merged']); await c.git(['switch', '-c', 'divergent']); await commit(c, 'divergent.txt', 'divergent\n'); await c.git(['switch', 'main']);
    c.eq('Safe deletion rejects unmerged', (await c.git(['branch', '-d', 'divergent'], { ok: [1] })).code, 1); await c.git(['branch', '-D', 'divergent']);
    c.eq('Active deletion rejects even force', (await c.git(['branch', '-D', 'main'], { ok: [1] })).code, 1); c.eq('Main remains', await oid(c, 'main'), await oid(c));
  }),
  native('BRANCH-011', 'Set and unset upstream resolve through tracking refs', async c => {
    const remote = await localRemote(c); await c.git(['push', '-u', 'origin', 'main']);
    c.eq('Upstream resolves', await oid(c, '@{upstream}'), await oid(c)); c.eq('Branch remote config', trim(await c.git(['config', 'branch.main.remote'])), 'origin');
    await c.git(['branch', '--unset-upstream']); c.eq('Upstream removed', (await c.git(['rev-parse', '--verify', '@{upstream}'], { ok: [128] })).code, 128); c.eq('Remote branch retained', await oid(c, 'main', remote), await oid(c));
  }),
  native('BRANCH-012', 'Logical prefix collisions are rejected without relying on ref files', async c => {
    await c.git(['branch', 'ai']); const head = await oid(c);
    c.eq('Prefix collision rejected', (await c.git(['branch', 'ai/x'], { ok: [128] })).code, 128); c.eq('Original ref preserved', await oid(c, 'ai'), head);
    await c.git(['branch', 'camada-ação']); c.eq('Unicode branch resolves by Git', await oid(c, 'camada-ação'), head);
  }, { limits: ['Case-sensitive namespace combinations and second backend are not included in this files-backend variant.'] }),
  native('BRANCH-013', 'Previous branch shorthand and no-guess are explicit resolutions', async c => {
    await c.git(['switch', '-c', 'second']); await c.git(['switch', 'main']); await c.git(['switch', '-']); c.eq('Previous branch chosen', trim(await c.git(['symbolic-ref', '--short', 'HEAD'])), 'second');
    const before = await oid(c); c.eq('No-guess missing branch rejected', (await c.git(['switch', '--no-guess', 'missing'], { ok: [128] })).code, 128); c.eq('Failure preserves HEAD', await oid(c), before);
  }, { limits: ['Ambiguous multiple-remotes DWIM is not included in this variant.'] }),
  native('BRANCH-014', 'Native switch updates ignore and attribute rules with the target tree', async c => {
    await c.git(['switch', '-c', 'rules']); await commit(c, '.gitignore', 'candidate.txt\n'); await commit(c, '.gitattributes', '*.txt text eol=lf\n'); await c.git(['switch', 'main']); c.write('candidate.txt', 'candidate\n');
    c.eq('Not ignored on main', (await c.git(['check-ignore', 'candidate.txt'], { ok: [1] })).code, 1); await c.git(['switch', 'rules']); c.eq('Ignored after switching rules', trim(await c.git(['check-ignore', 'candidate.txt'])), 'candidate.txt');
    c.ok('Target attribute effective', (await c.git(['check-attr', 'eol', '--', 'candidate.txt'])).stdout.includes(': lf')); c.eq('Untracked bytes retained', c.read('candidate.txt'), 'candidate\n');
  }, { limits: ['Real active/modified Layers are not present in this N0 rules baseline.'] }),
  native('BRANCH-020', 'Post-checkout failure occurs after HEAD and worktree transition', async c => {
    await c.git(['switch', '-c', 'target']); await commit(c, 'base.txt', 'target bytes\n'); await c.git(['switch', 'main']); const old = await oid(c), target = await oid(c, 'target');
    await hook(c, 'post-checkout', 'printf "%s %s %s\\n" "$1" "$2" "$3" >> post-checkout-events.txt\nexit 17');
    const result = await c.git(['checkout', 'target'], { ok: [1] }); c.eq('Post hook failure exposed as boolean checkout status', result.code, 1, 'https://raw.githubusercontent.com/git/git/v2.53.0/builtin/checkout.c#L1147-L1152'); c.eq('HEAD already changed', await oid(c), target); c.eq('Disk already changed', c.read('base.txt'), 'target bytes\n'); c.eq('Hook observed real transition', c.read('post-checkout-events.txt').trim(), `${old} ${target} 1`);
  }),

  native('MERGE-001', 'Fast-forward moves main to existing target without creating a commit', async c => {
    await c.git(['switch', '-c', 'feature']); const target = await commit(c, 'feature.txt', 'feature\n'); await c.git(['switch', 'main']); await c.git(['merge', '--ff-only', 'feature']);
    c.eq('Exact existing target selected', await oid(c), target); c.eq('Only two commits', trim(await c.git(['rev-list', '--count', 'HEAD'])), '2'); c.eq('Feature bytes', await committed(c, 'feature.txt'), 'feature\n');
  }),
  native('MERGE-002', 'Explicit merge commit has both independently observed parents', async c => {
    await c.git(['switch', '-c', 'feature']); const feature = await commit(c, 'feature.txt', 'feature\n'); await c.git(['switch', 'main']); const main = await commit(c, 'main.txt', 'main\n');
    await c.git(['merge', '--no-ff', '--no-edit', 'feature']); c.eq('Parent ordering exact', trim(await c.git(['show', '-s', '--format=%P', 'HEAD'])), `${main} ${feature}`); c.eq('Combined tree membership', zlist(await c.git(['ls-tree', '-r', '--name-only', '-z', 'HEAD'])), ['base.txt', 'feature.txt', 'main.txt']);
  }),
  native('MERGE-003', 'No-commit and squash prepare the same tree with different merge state', async c => {
    for (const squash of [false, true]) {
      const repo = await fresh(c, squash ? 'squash' : 'no-commit'); await gitAt(c, repo, ['switch', '-c', 'feature']); await commit(c, 'feature.txt', 'feature\n', 'feature', repo); await gitAt(c, repo, ['switch', 'main']); await commit(c, 'main.txt', 'main\n', 'main', repo); const before = await oid(c, 'HEAD', repo);
      await gitAt(c, repo, ['merge', ...(squash ? ['--squash'] : ['--no-commit', '--no-ff']), 'feature']); c.eq(`HEAD before commit squash=${squash}`, await oid(c, 'HEAD', repo), before); c.eq(`Prepared tree squash=${squash}`, await staged(c, 'feature.txt', repo), 'feature\n');
      c.eq(`Merge state squash=${squash}`, (await gitAt(c, repo, ['rev-parse', '--verify', 'MERGE_HEAD'], { ok: squash ? [128] : [0] })).code, squash ? 128 : 0);
      await gitAt(c, repo, ['commit', '-m', 'finish']); c.eq(`Parent count squash=${squash}`, trim(await gitAt(c, repo, ['show', '-s', '--format=%P', 'HEAD'])).split(' ').length, squash ? 1 : 2);
    }
  }),
  native('MERGE-004', 'Content conflict retains independent stages 1 2 and 3', async c => {
    const { base, ours, theirs } = await conflict(c); const unmerged = (await c.git(['ls-files', '-u'])).stdout;
    for (const [stage, rev] of [[1, base], [2, ours], [3, theirs]]) { const blob = await oid(c, `${rev}:base.txt`); c.ok(`Stage ${stage} exact blob`, unmerged.includes(`${blob} ${stage}\tbase.txt`)); }
    c.eq('HEAD not advanced on conflict', await oid(c), ours); c.eq('MERGE_HEAD records other side', await oid(c, 'MERGE_HEAD'), theirs);
  }),
  native('MERGE-005', 'Add-add conflict has stages 2 and 3 and no invented base stage', async c => {
    await c.git(['switch', '-c', 'other']); await commit(c, 'added.txt', 'theirs\n'); await c.git(['switch', 'main']); await commit(c, 'added.txt', 'ours\n'); await c.git(['merge', '--no-edit', 'other'], { ok: [1] });
    const entries = (await c.git(['ls-files', '-u', '--', 'added.txt'])).stdout.trim().split('\n'); c.eq('Only two add-add stages', entries.map(x => x.match(/ (\d)\t/)[1]), ['2', '3']);
    c.eq('Ours recoverable', (await c.git(['show', ':2:added.txt'])).stdout, 'ours\n'); c.eq('Theirs recoverable', (await c.git(['show', ':3:added.txt'])).stdout, 'theirs\n');
  }),
  native('MERGE-006', 'Modify-delete retains the modified side in both merge directions', async c => {
    for (const direction of ['modify-ours', 'delete-ours']) {
      const repo = await fresh(c, direction); await gitAt(c, repo, ['switch', '-c', 'modified']); await commit(c, 'base.txt', 'modified\n', 'modified', repo); await gitAt(c, repo, ['switch', 'main']); await gitAt(c, repo, ['rm', 'base.txt']); await gitAt(c, repo, ['commit', '-m', 'deleted']);
      if (direction === 'modify-ours') await gitAt(c, repo, ['switch', 'modified']);
      await gitAt(c, repo, ['merge', '--no-edit', direction === 'modify-ours' ? 'main' : 'modified'], { ok: [1] });
      const entries = (await gitAt(c, repo, ['ls-files', '-u'])).stdout; c.ok(`${direction} has base`, / 1\tbase.txt/.test(entries)); c.ok(`${direction} has modified stage`, entries.includes(` ${direction === 'modify-ours' ? 2 : 3}\tbase.txt`)); c.eq(`${direction} modified disk recovery`, fs.readFileSync(path.join(repo, 'base.txt'), 'utf8'), 'modified\n');
    }
  }),
  native('MERGE-009', 'Binary merge conflict is detected through index stages', async c => {
    await commit(c, 'base.txt', Buffer.from([0, 1, 2]), 'binary ancestor'); const { ours } = await conflict(c, 'binary');
    c.eq('Three binary conflict stages', (await c.git(['ls-files', '-u'])).stdout.trim().split('\n').length, 3); c.eq('Conflict HEAD unchanged', await oid(c), ours); c.ok('Binary worktree has no textual markers', !bytesAt(c.repo, 'base.txt').includes(Buffer.from('<<<<<<<')));
  }),
  native('MERGE-010', 'Ours and theirs selections resolve to their exact respective blobs', async c => {
    for (const side of ['ours', 'theirs']) {
      const repo = await fresh(c, `resolve-${side}`); await conflict(c, 'content', repo); await gitAt(c, repo, ['checkout', `--${side}`, '--', 'base.txt']); await gitAt(c, repo, ['add', 'base.txt']); await gitAt(c, repo, ['commit', '-m', `resolved ${side}`]); c.eq(`${side} final blob`, await committed(c, 'base.txt', 'HEAD', repo), `${side}\n`); c.eq(`${side} no conflict stages`, (await gitAt(c, repo, ['ls-files', '-u'])).stdout, '');
    }
  }),
  native('MERGE-011', 'Abort continue and quit have distinct observable merge semantics', async c => {
    for (const action of ['abort', 'continue', 'quit']) {
      const repo = await fresh(c, `merge-${action}`); const { ours } = await conflict(c, 'content', repo);
      if (action === 'continue') { writeAt(c, repo, 'base.txt', 'resolved\n'); await gitAt(c, repo, ['add', 'base.txt']); }
      await gitAt(c, repo, ['merge', `--${action}`], { env: { ...c.env, GIT_EDITOR: ':' } });
      c.eq(`${action} merge state cleared`, (await gitAt(c, repo, ['rev-parse', '--verify', 'MERGE_HEAD'], { ok: [128] })).code, 128);
      if (action === 'abort') { c.eq('Abort restores ours disk', fs.readFileSync(path.join(repo, 'base.txt'), 'utf8'), 'ours\n'); c.eq('Abort restores index', (await gitAt(c, repo, ['ls-files', '-u'])).stdout, ''); }
      if (action === 'quit') c.ok('Quit preserves conflicted index', (await gitAt(c, repo, ['ls-files', '-u'])).stdout.length > 0);
      if (action !== 'continue') c.eq(`${action} HEAD retained`, await oid(c, 'HEAD', repo), ours);
      else { c.eq('Continue committed resolution', await committed(c, 'base.txt', 'HEAD', repo), 'resolved\n'); c.eq('Continue has merge parents', trim(await gitAt(c, repo, ['show', '-s', '--format=%P', 'HEAD'])).split(' ').length, 2); }
    }
  }),
  native('MERGE-012', 'Rerere reuses resolved bytes without automatically committing', async c => {
    await c.git(['config', 'rerere.enabled', 'true']); const { ours } = await conflict(c); c.write('base.txt', 'remembered resolution\n'); await c.git(['add', 'base.txt']); await c.git(['commit', '-m', 'resolution']); await c.git(['reset', '--hard', ours]);
    await c.git(['merge', '--no-edit', 'other'], { ok: [1] }); c.eq('Rerere reapplies learned bytes', c.read('base.txt'), 'remembered resolution\n'); c.eq('HEAD not automatically committed', await oid(c), ours); c.ok('Conflict index still requires explicit add', (await c.git(['ls-files', '-u'])).stdout.length > 0);
  }),
  native('MERGE-013', 'Unrelated histories require explicit authorization to merge', async c => {
    const main = await oid(c); await c.git(['switch', '--orphan', 'independent']); await commit(c, 'independent.txt', 'independent\n'); const independent = await oid(c); await c.git(['switch', 'main']);
    c.eq('Default unrelated merge rejected', (await c.git(['merge', '--no-edit', 'independent'], { ok: [128] })).code, 128); c.eq('Ref unchanged after refusal', await oid(c), main);
    await c.git(['merge', '--no-edit', '--allow-unrelated-histories', 'independent']); c.eq('Both roots joined explicitly', trim(await c.git(['show', '-s', '--format=%P', 'HEAD'])), `${main} ${independent}`); c.eq('Independent content retained', await committed(c, 'independent.txt'), 'independent\n');
  }),
  native('MERGE-014', 'Octopus creates the expected multi-parent history and combined tree', async c => {
    const main = await oid(c); const parents = [main];
    for (const name of ['one', 'two', 'three']) { await c.git(['switch', '-c', name, main]); parents.push(await commit(c, `${name}.txt`, `${name}\n`)); }
    await c.git(['switch', 'main']); await c.git(['merge', '--no-ff', '--no-edit', '-s', 'octopus', 'one', 'two', 'three']);
    c.eq('Octopus parents', trim(await c.git(['show', '-s', '--format=%P', 'HEAD'])), parents.join(' ')); for (const name of ['one', 'two', 'three']) c.eq(`${name} blob`, await committed(c, `${name}.txt`), `${name}\n`);
  }, { limits: ['Other strategy options are not claimed by this explicit octopus variant.'] }),
  native('MERGE-015', 'Merge-tree computes an object without changing HEAD index or workspace', async c => {
    await c.git(['switch', '-c', 'feature']); await commit(c, 'feature.txt', 'feature\n'); await c.git(['switch', 'main']); await commit(c, 'main.txt', 'main\n'); const head = await oid(c), before = await index(c);
    const result = await c.git(['merge-tree', '--write-tree', 'main', 'feature']); const tree = result.stdout.split('\n')[0];
    c.eq('Calculated feature blob', (await c.git(['show', `${tree}:feature.txt`])).stdout, 'feature\n'); c.eq('HEAD unchanged', await oid(c), head); c.eq('Index unchanged', await index(c), before); c.ok('Calculated file not materialized', !c.exists('feature.txt'));
  }, { limits: ['Conflicting merge-tree output is not included in this clean calculation variant.'] }),
  native('REWRITE-001', 'Linear rebase reapplies feature commits onto the advanced base', async c => {
    await c.git(['switch', '-c', 'feature']); const original = await commit(c, 'feature.txt', 'feature\n'); await c.git(['switch', 'main']); const main = await commit(c, 'main.txt', 'main\n'); await c.git(['switch', 'feature']); await c.git(['rebase', 'main']);
    c.ok('Rebased commit receives new identity', await oid(c) !== original); c.eq('Rebased parent is new main', await oid(c, 'HEAD^'), main); c.eq('Feature preserved', await committed(c, 'feature.txt'), 'feature\n'); c.eq('Base advancement preserved', await committed(c, 'main.txt'), 'main\n');
  }),
  native('REWRITE-002', 'Rebase conflict is explicitly resolved before continuation', async c => {
    await c.git(['switch', '-c', 'feature']); await commit(c, 'base.txt', 'feature\n'); await c.git(['switch', 'main']); const main = await commit(c, 'base.txt', 'main\n'); await c.git(['switch', 'feature']); await c.git(['rebase', 'main'], { ok: [1] });
    c.ok('Rebase exposes unmerged stages', (await c.git(['ls-files', '-u'])).stdout.length > 0); c.write('base.txt', 'resolved rebase\n'); await c.git(['add', 'base.txt']); await c.git(['rebase', '--continue'], { env: { ...c.env, GIT_EDITOR: ':' } });
    c.eq('Rebase resolved bytes', await committed(c, 'base.txt'), 'resolved rebase\n'); c.eq('Rebase parent', await oid(c, 'HEAD^'), main); c.eq('Conflict stages cleared', (await c.git(['ls-files', '-u'])).stdout, '');
  }),
  native('REWRITE-003', 'Rebase abort skip and quit retain their distinct native state', async c => {
    for (const action of ['abort', 'skip', 'quit']) {
      const repo = await fresh(c, `rebase-${action}`); await gitAt(c, repo, ['switch', '-c', 'feature']); const feature = await commit(c, 'base.txt', 'feature\n', 'feature', repo); await gitAt(c, repo, ['switch', 'main']); const main = await commit(c, 'base.txt', 'main\n', 'main', repo); await gitAt(c, repo, ['switch', 'feature']); await gitAt(c, repo, ['rebase', 'main'], { ok: [1] }); await gitAt(c, repo, ['rebase', `--${action}`]);
      if (action === 'abort') { c.eq('Abort restores feature ref', await oid(c, 'HEAD', repo), feature); c.eq('Abort restores feature bytes', await committed(c, 'base.txt', 'HEAD', repo), 'feature\n'); }
      if (action === 'skip') { c.eq('Skip selects upstream after dropping conflicting change', await oid(c, 'HEAD', repo), main); c.eq('Skip clears conflict', (await gitAt(c, repo, ['ls-files', '-u'])).stdout, ''); }
      if (action === 'quit') { c.eq('Quit preserves detached current state', await oid(c, 'HEAD', repo), main); c.ok('Quit preserves unmerged index', (await gitAt(c, repo, ['ls-files', '-u'])).stdout.length > 0); }
      c.eq(`${action} no continuation available`, (await gitAt(c, repo, ['rebase', '--continue'], { ok: [128] })).code, 128);
    }
  }),
  native('REWRITE-006', 'Autostash restores compatible local changes after successful rebase', async c => {
    await c.git(['switch', '-c', 'feature']); await commit(c, 'feature.txt', 'feature\n'); await c.git(['switch', 'main']); await commit(c, 'main.txt', 'main\n'); await c.git(['switch', 'feature']); c.write('base.txt', 'local dirty\n');
    await c.git(['rebase', '--autostash', 'main']); c.eq('Local changes restored', c.read('base.txt'), 'local dirty\n'); c.eq('Local changes not committed', await committed(c, 'base.txt'), 'base one\n'); c.eq('Temporary autostash removed', (await c.git(['stash', 'list'])).stdout, '');
  }, { limits: ['Autostash reapplication conflict is not included in this successful restoration variant.'] }),
  native('REWRITE-007', 'Cherry-pick normal and no-commit distinguish publication from preparation', async c => {
    const base = await oid(c); await c.git(['switch', '-c', 'source']); const change = await commit(c, 'picked.txt', 'picked\n');
    for (const noCommit of [false, true]) { await c.git(['switch', '-c', noCommit ? 'pick-index' : 'pick-commit', base]); await c.git(['cherry-pick', ...(noCommit ? ['-n'] : []), change]); c.eq(`Prepared blob noCommit=${noCommit}`, await staged(c, 'picked.txt'), 'picked\n'); c.eq(`Parent count noCommit=${noCommit}`, trim(await c.git(['rev-list', '--count', 'HEAD'])), noCommit ? '1' : '2'); if (noCommit) c.eq('No-commit HEAD exact', await oid(c), base); }
  }),
  native('REWRITE-008', 'Cherry-pick merge requires and honors selected mainline', async c => {
    const root = await oid(c); await c.git(['switch', '-c', 'side']); const side = await commit(c, 'side.txt', 'side\n'); await c.git(['switch', 'main']); await commit(c, 'main.txt', 'main\n'); await c.git(['merge', '--no-ff', '--no-edit', 'side']); const merge = await oid(c);
    await c.git(['switch', '-c', 'no-mainline', root]); c.eq('Merge pick without mainline refuses', (await c.git(['cherry-pick', merge], { ok: [128] })).code, 128); c.eq('Ref remains root', await oid(c), root);
    await c.git(['switch', '-c', 'parent-one', 'main^1']); await c.git(['cherry-pick', '-m', '1', merge]); c.eq('Parent-one difference adds side', await committed(c, 'side.txt'), 'side\n');
    await c.git(['switch', '-c', 'parent-two', side]); await c.git(['cherry-pick', '-m', '2', merge]); c.eq('Parent-two difference adds main', await committed(c, 'main.txt'), 'main\n');
  }),
  native('REWRITE-010', 'Revert publishes inverse changes and retains original history', async c => {
    const original = await commit(c, 'feature.txt', 'feature\n'); const before = await oid(c); await c.git(['revert', '--no-edit', original]);
    c.ok('New inverse commit', await oid(c) !== before); c.eq('Original remains direct ancestor', await oid(c, 'HEAD^'), original); c.ok('Added path removed by revert', !c.exists('feature.txt')); c.eq('Original object readable', await committed(c, 'feature.txt', original), 'feature\n');
  }, { limits: ['Dependent multiple-commit sequences and conflict cases are not included in this simple inverse variant.'] }),
  native('REWRITE-012', 'Reset soft mixed and hard affect the three states separately', async c => {
    for (const mode of ['soft', 'mixed', 'hard']) { const repo = await fresh(c, `reset-${mode}`); const old = await oid(c, 'HEAD', repo); await commit(c, 'base.txt', 'A committed\n', 'A', repo); writeAt(c, repo, 'base.txt', 'B staged\n'); await gitAt(c, repo, ['add', 'base.txt']); writeAt(c, repo, 'base.txt', 'C workspace\n'); await gitAt(c, repo, ['reset', `--${mode}`, old]); c.eq(`${mode} ref`, await oid(c, 'HEAD', repo), old); c.eq(`${mode} index`, await staged(c, 'base.txt', repo), mode === 'soft' ? 'B staged\n' : 'base one\n'); c.eq(`${mode} disk`, fs.readFileSync(path.join(repo, 'base.txt'), 'utf8'), mode === 'hard' ? 'base one\n' : 'C workspace\n'); }
  }),
  native('REWRITE-013', 'Reset keep and merge refuse overwriting a conflicting local edit', async c => {
    for (const mode of ['keep', 'merge']) { const repo = await fresh(c, `reset-${mode}`); const old = await oid(c, 'HEAD', repo); const current = await commit(c, 'base.txt', 'committed new\n', 'new', repo); writeAt(c, repo, 'base.txt', 'protected dirty\n'); const before = await index(c, repo); await gitAt(c, repo, ['reset', `--${mode}`, old], { ok: [128] }); c.eq(`${mode} ref retained`, await oid(c, 'HEAD', repo), current); c.eq(`${mode} index retained`, await index(c, repo), before); c.eq(`${mode} disk retained`, fs.readFileSync(path.join(repo, 'base.txt'), 'utf8'), 'protected dirty\n'); }
  }),

  ...[['STASH-001', [], false, false], ['STASH-002', ['-u'], true, false], ['STASH-003', ['-a'], true, true]].map(([id, flags, savesNew, savesIgnored]) => native(id, `Native stash ${flags.join(' ') || 'default'} has explicit inclusion boundaries`, async c => {
    c.write('.git/info/exclude', '/ignored.txt\n'); c.write('base.txt', 'dirty tracked\n'); c.write('new.txt', 'new\n'); c.write('ignored.txt', 'ignored\n'); const head = await oid(c); await c.git(['stash', 'push', ...flags, '-m', 'boundary']);
    c.eq('Tracked worktree restored', c.read('base.txt'), 'base one\n'); c.eq('Untracked disk membership', c.exists('new.txt'), !savesNew); c.eq('Ignored disk membership', c.exists('ignored.txt'), !savesIgnored); c.eq('HEAD unchanged', await oid(c), head); c.eq('Stash contains tracked change', await committed(c, 'base.txt', 'stash@{0}'), 'dirty tracked\n');
    await c.git(['stash', 'apply']); c.eq('Tracked bytes roundtrip', c.read('base.txt'), 'dirty tracked\n'); c.eq('Untracked bytes roundtrip', c.read('new.txt'), 'new\n'); c.eq('Ignored bytes roundtrip', c.read('ignored.txt'), 'ignored\n');
  }, { limits: id === 'STASH-003' ? ['Ignored N0 projection equivalent; real Layer metadata is not part of this native stash baseline.'] : [] })),
  native('STASH-004', 'Keep-index and staged-only distinguish staged from unstaged files', async c => {
    for (const option of ['--keep-index', '--staged']) { const repo = await fresh(c, `stash-${option.slice(2)}`); await commit(c, 'other.txt', 'old\n', 'other', repo); writeAt(c, repo, 'base.txt', 'staged\n'); await gitAt(c, repo, ['add', 'base.txt']); writeAt(c, repo, 'other.txt', 'unstaged\n'); await gitAt(c, repo, ['stash', 'push', option]); c.eq(`${option} staged blob`, await staged(c, 'base.txt', repo), option === '--keep-index' ? 'staged\n' : 'base one\n'); c.eq(`${option} other disk`, fs.readFileSync(path.join(repo, 'other.txt'), 'utf8'), option === '--keep-index' ? 'old\n' : 'unstaged\n'); c.eq(`${option} stash staged blob`, await committed(c, 'base.txt', 'stash@{0}', repo), 'staged\n'); }
  }, { limits: ['Uses disjoint tracked files to make inclusion boundaries unambiguous; same-file overlapping hunks remain a separate variant.'] }),
  native('STASH-006', 'Apply retains stash while successful pop removes it and conflicted pop retains it', async c => {
    c.write('base.txt', 'stash change\n'); await c.git(['stash', 'push']); const stash = await oid(c, 'stash@{0}'); await c.git(['stash', 'apply']); c.eq('Apply keeps entry', await oid(c, 'stash@{0}'), stash); await c.git(['reset', '--hard', 'HEAD']); await c.git(['stash', 'pop']); c.eq('Successful pop removes entry', (await c.git(['stash', 'list'])).stdout, '');
    await c.git(['stash', 'push']); await commit(c, 'base.txt', 'conflicting committed\n'); const conflictStash = await oid(c, 'stash@{0}'); await c.git(['stash', 'pop'], { ok: [1] }); c.eq('Conflicting pop retains entry', await oid(c, 'stash@{0}'), conflictStash); c.ok('Conflict represented in index', (await c.git(['ls-files', '-u'])).stdout.length > 0);
  }),
  native('STASH-007', 'Apply index restores staged B separately from disk C', async c => {
    c.write('base.txt', 'B\n'); await c.git(['add', 'base.txt']); c.write('base.txt', 'C\n'); await c.git(['stash', 'push']); await c.git(['stash', 'apply', '--index']); c.eq('Index roundtrip B', await staged(c, 'base.txt'), 'B\n'); c.eq('Disk roundtrip C', c.read('base.txt'), 'C\n'); c.eq('Commit remains original', await committed(c, 'base.txt'), 'base one\n');
  }, { limits: ['Conflict during --index application is not included in this successful roundtrip.'] }),
  native('STASH-008', 'Stash branch drop and clear manipulate refs with explicit disposal', async c => {
    c.write('base.txt', 'one\n'); await c.git(['stash', 'push', '-m', 'one']); c.write('base.txt', 'two\n'); await c.git(['stash', 'push', '-m', 'two']); await c.git(['stash', 'drop', 'stash@{1}']); c.eq('Drop removes selected entry only', trim(await c.git(['stash', 'list', '--format=%gs'])), 'On main: two');
    await c.git(['stash', 'branch', 'recovered']); c.eq('Recovered branch active', trim(await c.git(['symbolic-ref', '--short', 'HEAD'])), 'recovered'); c.eq('Stash bytes restored', c.read('base.txt'), 'two\n'); c.eq('Branch consumes successful stash', (await c.git(['stash', 'list'])).stdout, '');
    await c.git(['stash', 'push']); await c.git(['stash', 'clear']); c.eq('Clear removes stash ref', (await c.git(['show-ref', '--verify', '--quiet', 'refs/stash'], { ok: [1] })).code, 1);
  }),
  native('STASH-010', 'Clean dry run predicts file removal and directory flag changes scope', async c => {
    const sentinel = inside(c, 'outside-clean-sentinel.txt'); fs.writeFileSync(sentinel, 'outside\n'); c.write('.git/info/exclude', '/ignored.txt\n'); c.write('loose.txt', 'loose\n'); c.write('dir/nested.txt', 'nested\n'); c.write('ignored.txt', 'ignored\n');
    const dry = await c.git(['clean', '-n']); c.ok('Dry-run lists loose file', dry.stdout.includes('loose.txt')); c.ok('Dry-run changes nothing', c.exists('loose.txt') && c.exists('dir/nested.txt'));
    await c.git(['clean', '-f']); c.ok('File removed', !c.exists('loose.txt')); c.ok('Directory survives plain clean', c.exists('dir/nested.txt')); await c.git(['clean', '-fd']); c.ok('Directory removed with d', !c.exists('dir')); c.eq('Ignored preserved', c.read('ignored.txt'), 'ignored\n'); c.eq('Outside sentinel protected', fs.readFileSync(sentinel, 'utf8'), 'outside\n');
  }),
  native('STASH-011', 'Clean x and X differ in whether ordinary untracked files survive', async c => {
    for (const option of ['-fdx', '-fdX']) { const repo = await fresh(c, option === '-fdx' ? 'clean-all-untracked' : 'clean-ignored-only'); writeAt(c, repo, '.git/info/exclude', '/ignored.txt\n'); writeAt(c, repo, 'ignored.txt', 'ignored\n'); writeAt(c, repo, 'ordinary.txt', 'ordinary\n'); await gitAt(c, repo, ['clean', option]); c.ok(`${option} removes ignored`, !fs.existsSync(path.join(repo, 'ignored.txt'))); c.eq(`${option} ordinary membership`, fs.existsSync(path.join(repo, 'ordinary.txt')), option === '-fdX'); c.eq(`${option} tracked retained`, await committed(c, 'base.txt', 'HEAD', repo), 'base one\n'); }
  }, { limits: ['Uses ignored N0 fixture paths; no claim of Layer protection against clean -x.'] }),
  native('STASH-013', 'A discarded commit is recovered through reflog and a real rescue ref', async c => {
    const base = await oid(c), abandoned = await commit(c, 'abandoned.txt', 'recoverable\n'); await c.git(['reset', '--hard', base]); c.ok('Abandoned identity in reflog', (await c.git(['reflog', '--format=%H'])).stdout.includes(abandoned)); await c.git(['fsck', '--full', '--no-reflogs']); await c.git(['update-ref', 'refs/compat/rescue', abandoned]); c.eq('Rescue retains original bytes', await committed(c, 'abandoned.txt', 'refs/compat/rescue'), 'recoverable\n');
  }),

  native('REMOTE-001', 'Remote add rename and remove affect only fixture configuration', async c => {
    const remote = await localRemote(c); c.eq('Added URL exact', trim(await c.git(['remote', 'get-url', 'origin'])), remote); await c.git(['push', '-u', 'origin', 'main']); await c.git(['remote', 'rename', 'origin', 'fixture']); c.eq('Tracking ref renamed', await oid(c, 'refs/remotes/fixture/main'), await oid(c)); c.eq('Tracking config renamed', trim(await c.git(['config', 'branch.main.remote'])), 'fixture'); await c.git(['remote', 'remove', 'fixture']); c.eq('Remote list empty', (await c.git(['remote'])).stdout, ''); c.eq('Local branch remains', await oid(c, 'main'), await oid(c));
  }),
  native('REMOTE-002', 'Fetch updates tracking without updating HEAD index or workspace', async c => {
    const remote = await localRemote(c); await c.git(['push', 'origin', 'main']); const writer = inside(c, 'writer'); await c.git(['clone', '--no-hardlinks', '--branch', 'main', remote, writer]); await identity(c, writer); const advanced = await commit(c, 'base.txt', 'remote advanced\n', 'advance', writer); await gitAt(c, writer, ['branch', 'layer/ai']); await gitAt(c, writer, ['push', '--all', 'origin']); const head = await oid(c), before = await index(c); c.write('local.txt', 'local\n'); await c.git(['fetch', 'origin']);
    c.eq('Tracking advanced', await oid(c, 'origin/main'), advanced); c.eq('Layer tracking created', await oid(c, 'origin/layer/ai'), advanced); c.eq('HEAD unchanged', await oid(c), head); c.eq('Index unchanged', await index(c), before); c.eq('Workspace base unchanged', c.read('base.txt'), 'base one\n'); c.eq('Local untracked preserved', c.read('local.txt'), 'local\n');
  }),
  native('REMOTE-003', 'Explicit positive and negative refspecs select received Layer refs', async c => {
    const remote = await localRemote(c); for (const name of ['one', 'two', 'excluded']) await c.git(['branch', `layer/${name}`]); await c.git(['push', '--all', 'origin']); const receiver = await fresh(c, 'selective', { seed: false }); await gitAt(c, receiver, ['fetch', remote, '+refs/heads/layer/*:refs/remotes/fixture/layer/*', '^refs/heads/layer/excluded']);
    for (const name of ['one', 'two']) c.eq(`${name} received`, await oid(c, `refs/remotes/fixture/layer/${name}`, receiver), await oid(c)); c.eq('Negative ref omitted', (await gitAt(c, receiver, ['show-ref', '--verify', '--quiet', 'refs/remotes/fixture/layer/excluded'], { ok: [1] })).code, 1); c.eq('Main not selected', (await gitAt(c, receiver, ['show-ref', '--verify', '--quiet', 'refs/remotes/fixture/main'], { ok: [1] })).code, 1);
  }),
  native('REMOTE-004', 'Fetch prune removes stale tracking without deleting unrelated local refs', async c => {
    const remote = await localRemote(c); await c.git(['branch', 'gone']); await c.git(['tag', 'keep-tag']); await c.git(['push', '--all', 'origin']); await c.git(['push', 'origin', '--tags']); await c.git(['fetch', 'origin']); await gitAt(c, remote, ['update-ref', '-d', 'refs/heads/gone']); await c.git(['fetch', '--prune', 'origin']); c.eq('Stale tracking removed', (await c.git(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/gone'], { ok: [1] })).code, 1); c.eq('Local branch retained', await oid(c, 'gone'), await oid(c)); c.eq('Local tag retained by normal prune', await oid(c, 'keep-tag'), await oid(c));
  }, { limits: ['Explicit --prune-tags behavior is not included in this normal branch-prune variant.'] }),
  native('REMOTE-005', 'Pull ff-only advances a correctly configured local tracking branch', async c => {
    const remote = await localRemote(c); await c.git(['push', '-u', 'origin', 'main']); const writer = inside(c, 'pull-writer'); await c.git(['clone', '--no-hardlinks', '--branch', 'main', remote, writer]); await identity(c, writer); const advanced = await commit(c, 'remote.txt', 'remote\n', 'advance', writer); await gitAt(c, writer, ['push', 'origin', 'main']); await c.git(['pull', '--ff-only']); c.eq('Pull chooses existing remote commit', await oid(c), advanced); c.eq('Remote bytes materialized', c.read('remote.txt'), 'remote\n');
  }),
  native('REMOTE-007', 'Pushing main explicitly does not publish unrelated heads or rescue refs', async c => {
    const remote = await localRemote(c); await c.git(['branch', 'layer/ai']); await c.git(['update-ref', 'refs/compat/rescue', await oid(c)]); await c.git(['push', 'origin', 'main']); c.eq('Main published', await oid(c, 'main', remote), await oid(c)); c.eq('Layer omitted', (await gitAt(c, remote, ['show-ref', '--verify', '--quiet', 'refs/heads/layer/ai'], { ok: [1] })).code, 1); c.eq('Rescue omitted', (await gitAt(c, remote, ['show-ref', '--verify', '--quiet', 'refs/compat/rescue'], { ok: [1] })).code, 1);
  }),
  native('REMOTE-008', 'Explicit Layer-shaped ref push publishes committed content only', async c => {
    const remote = await localRemote(c); await c.git(['switch', '-c', 'layer/ai']); const selected = await commit(c, 'layer.txt', 'A committed\n'); c.write('layer.txt', 'B staged\n'); await c.git(['add', 'layer.txt']); c.write('layer.txt', 'C disk\n'); await c.git(['push', 'origin', 'refs/heads/layer/ai']); c.eq('Remote ref selects committed A', await oid(c, 'refs/heads/layer/ai', remote), selected); c.eq('Remote tree A', await committed(c, 'layer.txt', 'refs/heads/layer/ai', remote), 'A committed\n'); c.eq('Local index B', await staged(c, 'layer.txt'), 'B staged\n'); c.eq('Local disk C', c.read('layer.txt'), 'C disk\n');
  }, { limits: ['The ref is native with the approved layer/ prefix; a private product shelf is not created in this N0 baseline.'] }),
  native('REMOTE-009', 'Push all includes Layer-shaped heads but omits other namespaces', async c => {
    const remote = await localRemote(c); await c.git(['branch', 'layer/ai']); await c.git(['update-ref', 'refs/compat/rescue', await oid(c)]); await c.git(['push', '--all', 'origin']); c.eq('Layer head published by all', await oid(c, 'refs/heads/layer/ai', remote), await oid(c)); c.eq('Main head published', await oid(c, 'main', remote), await oid(c)); c.eq('Extra namespace omitted', (await gitAt(c, remote, ['show-ref', '--verify', '--quiet', 'refs/compat/rescue'], { ok: [1] })).code, 1);
  }),
  native('REMOTE-010', 'Mirror push deliberately publishes extra rescue namespaces', async c => {
    const remote = await localRemote(c); const rescue = await commit(c, 'synthetic-rescue.txt', 'synthetic public test content\n'); await c.git(['update-ref', 'refs/compat/rescue', rescue]); await c.git(['push', '--mirror', 'origin']); c.eq('Extra namespace published', await oid(c, 'refs/compat/rescue', remote), rescue); c.eq('Rescue bytes readable at receiver', await committed(c, 'synthetic-rescue.txt', 'refs/compat/rescue', remote), 'synthetic public test content\n');
  }),
  native('REMOTE-011', 'Non-FF and stale lease reject before an explicit force updates remote', async c => {
    const remote = await localRemote(c); const old = await oid(c); await c.git(['push', 'origin', 'main']); const writer = inside(c, 'lease-writer'); await c.git(['clone', '--no-hardlinks', '--branch', 'main', remote, writer]); await identity(c, writer); const newer = await commit(c, 'writer.txt', 'newer\n', 'writer', writer); await gitAt(c, writer, ['push', 'origin', 'main']); const local = await commit(c, 'local.txt', 'local\n');
    await c.git(['push', 'origin', 'main'], { ok: [1] }); c.eq('Non-FF preserves newer', await oid(c, 'main', remote), newer); await c.git(['push', `--force-with-lease=refs/heads/main:${old}`, 'origin', 'main'], { ok: [1] }); c.eq('Stale lease preserves newer', await oid(c, 'main', remote), newer); await c.git(['push', '--force', 'origin', 'main']); c.eq('Explicit force chooses local commit', await oid(c, 'main', remote), local);
  }),
  native('REMOTE-012', 'Atomic push prevents partial refs when server update hook rejects one', async c => {
    for (const atomic of [true, false]) { const remote = await fresh(c, atomic ? 'atomic.git' : 'partial.git', { bare: true }); await hook(c, 'update', 'case "$1" in refs/heads/rejected) exit 1 ;; esac\nexit 0', remote); await c.git(['branch', atomic ? 'accepted-a' : 'accepted-b']); const accepted = atomic ? 'accepted-a' : 'accepted-b'; await c.git(['push', ...(atomic ? ['--atomic'] : []), remote, `${accepted}:refs/heads/accepted`, 'main:refs/heads/rejected'], { ok: [1] }); c.eq(`Rejected ref absent atomic=${atomic}`, (await gitAt(c, remote, ['show-ref', '--verify', '--quiet', 'refs/heads/rejected'], { ok: [1] })).code, 1); c.eq(`Accepted ref state atomic=${atomic}`, (await gitAt(c, remote, ['show-ref', '--verify', '--quiet', 'refs/heads/accepted'], { ok: atomic ? [1] : [0] })).code, atomic ? 1 : 0); }
  }),
  native('REMOTE-013', 'Remote Layer-shaped ref can be deleted and recreated explicitly', async c => {
    const remote = await localRemote(c); await c.git(['branch', 'layer/ai']); await c.git(['push', 'origin', 'layer/ai']); await c.git(['push', 'origin', '--delete', 'layer/ai']); await c.git(['fetch', '--prune', 'origin']); c.eq('Remote Layer ref deleted', (await gitAt(c, remote, ['show-ref', '--verify', '--quiet', 'refs/heads/layer/ai'], { ok: [1] })).code, 1); c.eq('Local head remains', await oid(c, 'layer/ai'), await oid(c)); await c.git(['push', 'origin', 'layer/ai']); c.eq('Remote ref recreated', await oid(c, 'layer/ai', remote), await oid(c, 'layer/ai'));
  }, { limits: ['N0 does not contain a registered private Layer index; external product reconciliation remains separate.'] }),
  native('WORKTREE-001', 'Linked worktrees share objects and refs while keeping HEAD and index separate', async c => {
    const other = inside(c, 'linked'); await c.git(['branch', 'other']); await c.git(['worktree', 'add', other, 'other']);
    const mainDir = path.resolve(trim(await c.git(['rev-parse', '--absolute-git-dir']))), otherDir = path.resolve(trim(await gitAt(c, other, ['rev-parse', '--absolute-git-dir']))); c.ok('Private gitdir differs', mainDir !== otherDir); c.eq('Common object directory', path.resolve(other, trim(await gitAt(c, other, ['rev-parse', '--git-common-dir']))), mainDir);
    writeAt(c, other, 'base.txt', 'linked staged\n'); await gitAt(c, other, ['add', 'base.txt']); c.eq('Primary index independent', await staged(c, 'base.txt'), 'base one\n'); c.eq('Linked index bytes', await staged(c, 'base.txt', other), 'linked staged\n'); c.eq('Primary disk independent', c.read('base.txt'), 'base one\n');
  }),
  native('WORKTREE-003', 'A checked-out branch is protected while detached worktree is allowed', async c => {
    const blocked = inside(c, 'blocked-worktree'), detached = inside(c, 'detached-worktree'); await c.git(['worktree', 'add', blocked, 'main'], { ok: [128] }); c.ok('Refusal does not materialize base', !fs.existsSync(path.join(blocked, 'base.txt'))); await c.git(['worktree', 'add', '--detach', detached, 'HEAD']); c.eq('Detached head same commit', await oid(c, 'HEAD', detached), await oid(c)); c.eq('Detached has no symref', (await gitAt(c, detached, ['symbolic-ref', '-q', 'HEAD'], { ok: [1] })).code, 1);
  }),
  native('WORKTREE-004', 'Worktree move repair remove and prune preserve the primary repository', async c => {
    const a = inside(c, 'linked-a'), b = inside(c, 'linked-b'), moved = inside(c, 'linked-external-move'); await c.git(['branch', 'other']); await c.git(['worktree', 'add', a, 'other']); await c.git(['worktree', 'move', a, b]); c.eq('Moved worktree discovered', await oid(c, 'HEAD', b), await oid(c)); fs.renameSync(b, moved); await c.git(['worktree', 'repair', moved]); c.eq('Repaired worktree discovered', await oid(c, 'HEAD', moved), await oid(c)); await c.git(['worktree', 'remove', moved]); c.ok('Removed linked directory', !fs.existsSync(moved)); await c.git(['worktree', 'prune', '--expire=now']); c.eq('Primary remains readable', await committed(c, 'base.txt'), 'base one\n');
  }, { limits: ['Native lifecycle only; no private Layer metadata is involved.'] }),
  native('WORKTREE-005', 'Worktree locks block removal and are visible in porcelain listing', async c => {
    const linked = inside(c, 'locked-linked'); await c.git(['branch', 'other']); await c.git(['worktree', 'add', linked, 'other']); await c.git(['worktree', 'lock', '--reason', 'synthetic removable volume', linked]); c.ok('Lock reason listed', (await c.git(['worktree', 'list', '--porcelain'])).stdout.includes('locked synthetic removable volume')); await c.git(['worktree', 'remove', linked], { ok: [128] }); c.ok('Locked data preserved', fs.existsSync(path.join(linked, 'base.txt'))); await c.git(['worktree', 'prune', '--expire=now']); c.eq('Locked worktree still valid', await oid(c, 'HEAD', linked), await oid(c)); await c.git(['worktree', 'unlock', linked]); await c.git(['worktree', 'remove', linked]);
  }, { limits: ['Volume unavailability is not simulated; lock and prune retention are exercised while accessible.'] }),
  native('WORKTREE-006', 'Worktree-local config differs while common exclude applies to both trees', async c => {
    const linked = inside(c, 'config-linked'); await c.git(['branch', 'other']); await c.git(['worktree', 'add', linked, 'other']); await c.git(['config', 'extensions.worktreeConfig', 'true']); await c.git(['config', '--worktree', 'compat.choice', 'main']); await gitAt(c, linked, ['config', '--worktree', 'compat.choice', 'other']); c.eq('Primary local config', trim(await c.git(['config', 'compat.choice'])), 'main'); c.eq('Linked local config', trim(await gitAt(c, linked, ['config', 'compat.choice'])), 'other'); c.write('.git/info/exclude', '/shared-ignore.txt\n'); c.write('shared-ignore.txt', 'main\n'); writeAt(c, linked, 'shared-ignore.txt', 'other\n'); c.eq('Primary common ignore', trim(await c.git(['check-ignore', 'shared-ignore.txt'])), 'shared-ignore.txt'); c.eq('Linked common ignore', trim(await gitAt(c, linked, ['check-ignore', 'shared-ignore.txt'])), 'shared-ignore.txt');
  }),
  native('WORKTREE-007', 'Local submodule is a gitlink rather than a regular blob', async c => {
    const sub = await fresh(c, 'submodule-source'); const childHead = await oid(c, 'HEAD', sub); await c.git(['-c', 'protocol.file.allow=always', 'submodule', 'add', sub, 'modules/sub']); await c.git(['commit', '-m', 'submodule']); c.ok('Index gitlink mode and commit OID', (await index(c)).includes(`160000 ${childHead} 0\tmodules/sub`)); await c.git(['submodule', 'init']); await c.git(['-c', 'protocol.file.allow=always', 'submodule', 'update']); c.eq('Child HEAD exact', await oid(c, 'HEAD', path.join(c.repo, 'modules/sub')), childHead); c.ok('Submodule status reports commit', (await c.git(['submodule', 'status'])).stdout.includes(childHead));
  }),
  native('WORKTREE-009', 'Submodule deinit and absorbgitdirs retain Git-discoverable metadata', async c => {
    const sub = await fresh(c, 'absorbed-source'); await c.git(['-c', 'protocol.file.allow=always', 'submodule', 'add', sub, 'sub']); await c.git(['commit', '-m', 'submodule']); await c.git(['submodule', 'absorbgitdirs']); c.ok('Submodule uses gitfile', fs.statSync(path.join(c.repo, 'sub', '.git')).isFile()); const head = await oid(c, 'HEAD', path.join(c.repo, 'sub')); await c.git(['submodule', 'deinit', '-f', '--', 'sub']); c.ok('Deinit removes worktree file', !fs.existsSync(path.join(c.repo, 'sub', 'base.txt'))); await c.git(['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init']); c.eq('Reinitialized child commit', await oid(c, 'HEAD', path.join(c.repo, 'sub')), head);
  }),
  native('WORKTREE-010', 'Cone and non-cone sparse checkout change materialization but preserve history', async c => {
    await commit(c, 'included/a.txt', 'included\n'); await commit(c, 'excluded/b.txt', 'excluded\n'); const head = await oid(c);
    await c.git(['sparse-checkout', 'init', '--cone']); await c.git(['sparse-checkout', 'set', 'included']); c.ok('Included materialized', c.exists('included/a.txt')); c.ok('Excluded omitted', !c.exists('excluded/b.txt')); c.eq('Omitted blob remains committed', await committed(c, 'excluded/b.txt'), 'excluded\n'); await c.git(['sparse-checkout', 'add', 'excluded']); c.ok('Added cone materialized', c.exists('excluded/b.txt')); await c.git(['sparse-checkout', 'reapply']); await c.git(['sparse-checkout', 'disable']); await c.git(['sparse-checkout', 'set', '--no-cone', '/included/a.txt']); c.ok('Non-cone selected path', c.exists('included/a.txt')); c.ok('Non-cone excludes other path', !c.exists('excluded/b.txt')); await c.git(['sparse-checkout', 'list']); await c.git(['sparse-checkout', 'disable']); c.eq('Sparse operations never rewrite HEAD', await oid(c), head);
  }),
  native('WORKTREE-011', 'Sparse and split indexes remain operable by the Git observer', async c => {
    await commit(c, 'selected/a.txt', 'a\n'); await commit(c, 'omitted/b.txt', 'b\n'); const tree = await oid(c, 'HEAD^{tree}'); await c.git(['sparse-checkout', 'set', '--cone', '--sparse-index', 'selected']); c.eq('Sparse index writes equivalent tree', trim(await c.git(['write-tree'])), tree); c.ok('Sparse directory entry observable', (await c.git(['ls-files', '--sparse', '--stage'])).stdout.includes('040000')); await c.git(['sparse-checkout', 'disable']); await c.git(['update-index', '--split-index']); c.eq('Split index same tree', trim(await c.git(['write-tree'])), tree); c.eq('Split index blob readable', await staged(c, 'omitted/b.txt'), 'b\n'); await c.git(['update-index', '--no-split-index']);
  }),
  native('WORKTREE-012', 'Skip-worktree and assume-unchanged flags suppress status without owning files', async c => {
    for (const flag of ['skip-worktree', 'assume-unchanged']) { await c.git(['update-index', `--${flag}`, '--', 'base.txt']); c.write('base.txt', `${flag} dirty\n`); c.eq(`${flag} suppresses native status`, (await c.git(['status', '--porcelain=v1', '--', 'base.txt'])).stdout, ''); await c.git(['update-index', `--no-${flag}`, '--', 'base.txt']); c.ok(`${flag} clearing reveals change`, (await c.git(['status', '--porcelain=v1', '--', 'base.txt'])).stdout.includes(' M base.txt')); await c.git(['restore', '--', 'base.txt']); }
  }),
  native('WORKTREE-014', 'Native worktree add can select a Layer-shaped head with its own index', async c => {
    const main = await oid(c); await c.git(['branch', 'layer/ai']); const linked = inside(c, 'layer-linked'); await c.git(['worktree', 'add', linked, 'layer/ai']); c.eq('Linked Layer-shaped head selected', trim(await gitAt(c, linked, ['symbolic-ref', 'HEAD'])), 'refs/heads/layer/ai'); writeAt(c, linked, 'native.txt', 'linked\n'); await gitAt(c, linked, ['add', 'native.txt']); c.eq('Primary main remains selected', await oid(c), main); c.ok('Primary index does not inherit linked stage', !(await paths(c)).includes('native.txt'));
  }, { limits: ['No registered product Layer; this isolates the official ref-selection route rather than certifying U-07.'] }),

  native('PATH-001', 'Spaced accented NFC and NFD path bytes roundtrip through Git', async c => {
    const names = ['with space.txt', 'ação.txt', 'café.txt', 'cafe\u0301.txt'];
    for (const name of names) c.write(name, `${name}\n`); await c.git(['add', '--', ...names]); await c.git(['commit', '-m', 'unicode names']); const tracked = await paths(c); for (const name of names) { c.ok(`${JSON.stringify(name)} retained literally`, tracked.includes(name), name, tracked); c.eq(`${name} object content`, await committed(c, name), `${name}\n`); }
  }, { limits: ['Native path roundtrip only; Layer off/on is separately assessed and filesystem behavior is the actual host behavior.'] }),
  native('PATH-004', 'Literal pathspec and option terminator protect special file names', async c => {
    for (const name of ['-leading.txt', 'file[1].txt', 'file1.txt', '!bang.txt']) c.write(name, `${name}\n`); await c.git(['--literal-pathspecs', 'add', '--', '-leading.txt', 'file[1].txt', '!bang.txt']); c.eq('Exact literal selection', await paths(c), ['!bang.txt', '-leading.txt', 'base.txt', 'file[1].txt']); c.eq('Neighbor not prepared', (await c.git(['ls-files', '--error-unmatch', '--', 'file1.txt'], { ok: [1] })).code, 1);
  }),
  native('PATH-005', 'Top glob exclude and icase pathspecs select their documented sets', async c => {
    for (const name of ['src/a.txt', 'src/b.txt', 'src/other.js', 'ROOT.TXT']) c.write(name, 'selected\n'); await c.git(['add', '--', ':(top,glob)src/*.txt', ':(exclude)src/b.txt']); c.eq('Glob minus exclusion', await paths(c), ['base.txt', 'src/a.txt']); await c.git(['add', '--', ':(top,icase)root.txt']); c.ok('Icase selects actual original spelling', (await paths(c)).includes('ROOT.TXT'));
  }),
  native('PATH-006', 'NUL-delimited pathspec file preserves spaced names as single paths', async c => {
    const names = ['with space.txt', '[literal].txt', '-dash.txt']; for (const name of names) c.write(name, `${name}\n`); const spec = inside(c, 'paths.nul'); fs.writeFileSync(spec, Buffer.from(names.join('\0') + '\0')); await c.git(['--literal-pathspecs', 'add', `--pathspec-from-file=${spec}`, '--pathspec-file-nul']); c.eq('Exact number of selected paths', (await paths(c)).length, 4); for (const name of names) c.eq(`${name} staged bytes`, await staged(c, name), `${name}\n`);
  }, { limits: ['Newline-in-name is unavailable in ordinary Win32 file creation and is not claimed.'] }),
  native('PATH-007', 'EOL normalization is checked independently of physical file bytes', async c => {
    for (const setting of ['false', 'true', 'input']) { const repo = await fresh(c, `eol-${setting}`); await gitAt(c, repo, ['config', 'core.autocrlf', setting]); const input = Buffer.from('one\r\ntwo\r\n'); writeAt(c, repo, 'eol.txt', input); await gitAt(c, repo, ['add', 'eol.txt']); const prepared = await staged(c, 'eol.txt', repo); c.eq(`${setting} indexed EOL`, prepared, setting === 'false' ? input.toString() : 'one\ntwo\n'); c.eq(`${setting} add leaves original workspace bytes`, [...bytesAt(repo, 'eol.txt')], [...input]); await gitAt(c, repo, ['commit', '-m', 'eol']); fs.unlinkSync(path.join(repo, 'eol.txt')); await gitAt(c, repo, ['checkout', '--', 'eol.txt']); c.eq(`${setting} checkout EOL`, [...bytesAt(repo, 'eol.txt')], [...Buffer.from(setting === 'input' ? 'one\ntwo\n' : 'one\r\ntwo\r\n')]); }
  }, { limits: ['Mixed-EOL and attribute overrides are not exhaustively crossed with all autocrlf values.'] }),
  native('PATH-008', 'Per-directory attributes and info attributes override root and cached rules', async c => {
    await commit(c, '.gitattributes', '*.txt compat=root\n'); await commit(c, 'sub/.gitattributes', '*.txt compat=sub\n'); c.write('sub/file.txt', 'content\n'); c.eq('Subdirectory attribute wins', trim(await c.git(['check-attr', 'compat', '--', 'sub/file.txt'])), 'sub/file.txt: compat: sub'); c.write('.git/info/attributes', 'sub/file.txt compat=info\n'); c.eq('Info attribute wins over worktree rules', trim(await c.git(['check-attr', 'compat', '--', 'sub/file.txt'])), 'sub/file.txt: compat: info'); fs.unlinkSync(path.join(c.repo, '.git/info/attributes')); c.write('sub/.gitattributes', '*.txt compat=dirty\n'); c.eq('Cached attributes read staged rule', trim(await c.git(['check-attr', '--cached', 'compat', '--', 'sub/file.txt'])), 'sub/file.txt: compat: sub'); c.eq('Worktree attributes read dirty rule', trim(await c.git(['check-attr', 'compat', '--', 'sub/file.txt'])), 'sub/file.txt: compat: dirty');
  }, { limits: ['Global attributesFile is not included; all rules are confined to the fixture.'] }),
  native('PATH-009', 'Empty binary and larger-than-editor-limit blobs preserve exact bytes', async c => {
    const fixtures = [['empty.bin', Buffer.alloc(0)], ['binary.bin', Buffer.from([0, 255, 254, 13, 10, 0])], ['large.bin', Buffer.alloc(4 * 1024 * 1024 + 1, 7)]];
    for (const [name, data] of fixtures) { c.write(name, data); await c.git(['add', '--', name]); const hash = trim(await c.git(['hash-object', '--no-filters', '--', name])); const blob = await c.git(['cat-file', 'blob', hash]); c.eq(`${name} object size`, trim(await c.git(['cat-file', '-s', hash])), String(data.length)); c.eq(`${name} binary digest`, crypto.createHash('sha256').update(blob.stdoutBuffer).digest('hex'), crypto.createHash('sha256').update(data).digest('hex')); }
    await c.git(['commit', '-m', 'binary boundaries']);
  }, { tier: 'broad', limits: ['Native blobs only; no editor or textual Core API limit is certified.'] }),
  native('PATH-010', 'Git executable mode can be represented independently of host chmod support', async c => {
    await c.git(['update-index', '--chmod=+x', '--', 'base.txt']); c.ok('Index records executable bit', (await index(c)).startsWith('100755 ')); await c.git(['commit', '-m', 'executable']); c.ok('Tree records executable bit', (await c.git(['ls-tree', 'HEAD', '--', 'base.txt'])).stdout.startsWith('100755 ')); await c.git(['config', 'core.filemode', 'false']); await c.git(['update-index', '--chmod=-x', '--', 'base.txt']); c.ok('Explicit index mode remains operable with filemode false', (await index(c)).startsWith('100644 '));
  }, { limits: ['Physical chmod detection with core.filemode=true is not asserted on Windows; explicit Git modes are asserted.'] }),
  native('PATH-014', 'Ignore precedence negation and already-tracked files remain distinct', async c => {
    await commit(c, '.gitignore', '*.log\n!keep.log\n'); await commit(c, 'sub/.gitignore', '!inside.log\n'); c.write('.git/info/exclude', 'excluded.tmp\n'); for (const name of ['drop.log', 'keep.log', 'sub/inside.log', 'excluded.tmp']) c.write(name, 'candidate\n'); await c.git(['add', '.']); const tracked = await paths(c); c.ok('Root negation included', tracked.includes('keep.log')); c.ok('Nested negation included', tracked.includes('sub/inside.log')); c.ok('Ignore and info-exclude omitted', !tracked.includes('drop.log') && !tracked.includes('excluded.tmp')); await c.git(['add', '-f', 'drop.log']); await c.git(['commit', '-m', 'tracked despite ignore']); c.write('drop.log', 'changed tracked\n'); await c.git(['add', '.']); c.eq('Ignore does not untrack', await staged(c, 'drop.log'), 'changed tracked\n');
  }, { limits: ['Global excludesFile is not crossed with these fixture-local precedence rules.'] }),
  native('PATH-015', 'Empty directory has no tree entry while nested repository stages as gitlink', async c => {
    fs.mkdirSync(path.join(c.repo, 'empty')); const nested = path.join(c.repo, 'nested'); fs.mkdirSync(nested); await gitAt(c, nested, ['init', '-b', 'main']); await identity(c, nested); await commit(c, 'nested.txt', 'nested\n', 'nested', nested); await c.git(['add', '--', 'empty', 'nested']); c.ok('Empty directory not indexed', !(await paths(c)).includes('empty')); c.ok('Nested repository is gitlink', (await index(c)).includes(`160000 ${await oid(c, 'HEAD', nested)} 0\tnested`));
  }),
  native('INSPECT-001', 'Porcelain v1 v2 and NUL formats describe add modify delete rename and ignored states', async c => {
    await commit(c, 'delete.txt', 'delete\n'); await commit(c, 'rename.txt', 'rename\n'); c.write('base.txt', 'modified\n'); c.write('added with space.txt', 'added\n'); await c.git(['add', '--', 'added with space.txt']); await c.git(['rm', 'delete.txt']); await c.git(['mv', 'rename.txt', 'renamed.txt']); c.write('.git/info/exclude', '/ignored.txt\n'); c.write('ignored.txt', 'ignored\n');
    const a = await c.git(['status', '--porcelain=v1', '-z', '--ignored']), b = await c.git(['status', '--porcelain=v2', '-z', '--ignored']);
    for (const result of [a, b]) { c.ok('NUL format retains spaced name', result.stdout.includes('added with space.txt\0')); c.ok('Ignored state present', result.stdout.includes('ignored.txt\0')); }
    c.ok('V1 add and modify state', a.stdout.includes('A  added with space.txt\0') && a.stdout.includes(' M base.txt\0')); c.ok('V2 rename type retained', b.stdout.split('\0').some(x => x.startsWith('2 '))); await c.git(['status', '--short']);
  }, { limits: ['Unmerged porcelain is tested through independent conflict stages; this parser baseline has no concurrent merge state.'] }),
  native('INSPECT-002', 'Diff distinctly compares HEAD index and worktree', async c => {
    c.write('base.txt', 'B staged\n'); await c.git(['add', 'base.txt']); c.write('base.txt', 'C disk\n');
    const work = (await c.git(['diff', '--', 'base.txt'])).stdout, cached = (await c.git(['diff', '--cached', '--', 'base.txt'])).stdout, head = (await c.git(['diff', 'HEAD', '--', 'base.txt'])).stdout;
    c.ok('Workspace comparison B to C', work.includes('-B staged') && work.includes('+C disk')); c.ok('Index comparison A to B', cached.includes('-base one') && cached.includes('+B staged')); c.ok('HEAD comparison A to C', head.includes('-base one') && head.includes('+C disk'));
  }),
  native('INSPECT-003', 'Raw numstat name-status and difference exit codes remain machine distinguishable', async c => {
    await commit(c, 'binary.bin', Buffer.from([0, 1, 2])); c.write('binary.bin', Buffer.from([0, 4, 5])); c.write('base.txt', 'changed\n');
    const raw = await c.git(['diff', '--raw', '-z']), stats = await c.git(['diff', '--numstat', '-z']), names = await c.git(['diff', '--name-status', '-z']);
    c.ok('Raw NUL entry', raw.stdout.includes('\0base.txt\0')); c.ok('Binary numstat uses dash counts', stats.stdout.includes('-\t-\tbinary.bin\0')); c.ok('Name-status field separation', names.stdout.includes('M\0base.txt\0'));
    c.eq('Quiet difference is one', (await c.git(['diff', '--quiet'], { ok: [1] })).code, 1); c.eq('Exit-code difference is one', (await c.git(['diff', '--exit-code'], { ok: [1] })).code, 1); await c.git(['restore', '.']); c.eq('Quiet clean is zero', (await c.git(['diff', '--quiet'])).code, 0);
  }, { limits: ['Renames and special names have their own baselines; this case checks format and difference-code semantics.'] }),
  native('INSPECT-004', 'Whitespace options alter diff presentation without rewriting bytes', async c => {
    await commit(c, 'repeated.txt', 'a\nb\na\nc\n'); c.write('repeated.txt', 'a \nb\na\nc\n');
    for (const algorithm of ['histogram', 'patience', 'minimal']) c.eq(`${algorithm} difference detected`, (await c.git(['diff', `--diff-algorithm=${algorithm}`, '--quiet'], { ok: [1] })).code, 1);
    c.eq('Ignore trailing whitespace suppresses presentation difference', (await c.git(['diff', '--ignore-space-at-eol', '--quiet'])).code, 0); c.eq('Actual dirty bytes retained', c.read('repeated.txt'), 'a \nb\na\nc\n');
  }, { limits: ['Moved-line visualization flags are not exhaustively combined with algorithms.'] }),
  native('INSPECT-005', 'Log follow traces a rename without inventing persistent path identity', async c => {
    const original = await oid(c); await c.git(['mv', 'base.txt', 'renamed.txt']); await c.git(['commit', '-m', 'rename']); const renamed = await oid(c);
    const follow = trim(await c.git(['log', '--follow', '--format=%H', '--', 'renamed.txt'])).split('\n'); c.eq('Follow reaches rename and original', follow, [renamed, original]); c.eq('Ordinary path log stops at appearance', trim(await c.git(['log', '--format=%H', '--', 'renamed.txt'])), renamed); c.eq('Old revision old path', await committed(c, 'base.txt', original), 'base one\n');
  }, { limits: ['Merge-follow simplification variants are not included in this linear rename history.'] }),
  native('INSPECT-006', 'Two-dot three-dot and range-diff distinguish graph reachability from patch equivalence', async c => {
    const root = await oid(c); await c.git(['switch', '-c', 'left']); const left = await commit(c, 'same.txt', 'equivalent\n', 'left'); await c.git(['switch', '-c', 'right', root]); const right = await commit(c, 'same.txt', 'equivalent\n', 'right');
    c.eq('Two-dot selects right only', trim(await c.git(['rev-list', 'left..right'])), right); c.eq('Symmetric difference contains both identities', trim(await c.git(['rev-list', 'left...right'])).split('\n').sort(), [left, right].sort()); const range = await c.git(['range-diff', `${root}..left`, `${root}..right`]); c.ok('Range-diff pairs equivalent patches', range.stdout.includes('!') || range.stdout.includes('='), 'paired range-diff', range.stdout); c.eq('Equivalent trees can have different commits', await oid(c, 'left^{tree}'), await oid(c, 'right^{tree}'));
  }),
  native('INSPECT-007', 'Blame and annotate resolve line authorship without mutating repository state', async c => {
    await commit(c, 'lines.txt', 'one\ntwo\n'); const second = await commit(c, 'lines.txt', 'one\nchanged\n'); const before = await index(c), head = await oid(c); const blame = await c.git(['blame', '--line-porcelain', '--', 'lines.txt']); c.ok('Changed line attributed to real commit', blame.stdout.includes(`${second} 2 2`)); await c.git(['annotate', 'lines.txt']); c.eq('Inspection preserves index', await index(c), before); c.eq('Inspection preserves HEAD', await oid(c), head);
  }, { limits: ['Copy/move heuristics and capability-gated last-modified are not claimed.'] }),
  native('INSPECT-008', 'Grep chooses worktree index or revision explicitly', async c => {
    c.write('base.txt', 'staged needle\n'); await c.git(['add', 'base.txt']); c.write('base.txt', 'disk needle\n'); c.ok('Worktree grep disk content', (await c.git(['grep', 'disk needle'])).stdout.includes('base.txt:disk needle')); c.eq('Worktree does not expose index-only text', (await c.git(['grep', 'staged needle'], { ok: [1] })).code, 1); c.ok('Cached grep staged content', (await c.git(['grep', '--cached', 'staged needle'])).stdout.includes('base.txt:staged needle')); c.ok('Revision grep committed content', (await c.git(['grep', 'base one', 'HEAD'])).stdout.includes('HEAD:base.txt:base one'));
  }),
  native('INSPECT-009', 'Describe and name-rev produce names which still resolve to the intended objects', async c => {
    await c.git(['tag', '-a', 'v1', '-m', 'annotated']); const named = trim(await c.git(['describe', '--exact-match', 'HEAD'])); c.eq('Annotated tag describes exact commit', named, 'v1'); c.eq('Tag dereference resolves commit', await oid(c, `${named}^{commit}`), await oid(c)); const name = trim(await c.git(['name-rev', '--name-only', 'HEAD'])); c.eq('Name-rev result resolves', await oid(c, `${name}^{commit}`), await oid(c));
  }, { limits: ['Capability-gated format-rev is not available in every supported Git version and is not exercised here.'] }),
  native('INSPECT-010', 'Mailmap display and trailer parsing do not rewrite commit objects', async c => {
    const original = await oid(c), author = trim(await c.git(['show', '-s', '--format=%an|%ae', 'HEAD'])).split('|'); c.write('.mailmap', `Mapped Name <mapped@example.invalid> <${author[1]}>\n`);
    c.eq('Check-mailmap returns mapped identity', trim(await c.git(['check-mailmap', `${author[0]} <${author[1]}>`])), 'Mapped Name <mapped@example.invalid>'); c.eq('Pretty mailmap fields are mapped', trim(await c.git(['show', '-s', '--format=%aN|%aE', 'HEAD'])), 'Mapped Name|mapped@example.invalid'); c.ok('Shortlog aggregates mapped identity', (await c.git(['shortlog', '-sne', 'HEAD'])).stdout.includes('Mapped Name <mapped@example.invalid>'));
    const trailers = await c.git(['interpret-trailers', '--parse'], { stdin: 'subject\n\nSigned-off-by: Fixture <fixture@example.invalid>\n' }); c.eq('Trailer parsed exactly', trailers.stdout, 'Signed-off-by: Fixture <fixture@example.invalid>\n'); c.eq('Display does not rewrite commit', await oid(c), original);
  }),
  native('INSPECT-011', 'Notes are separate refs whose edits do not enter the commit tree', async c => {
    const tree = await oid(c, 'HEAD^{tree}'), head = await oid(c); await c.git(['notes', '--ref=compat', 'add', '-m', 'synthetic note']); c.eq('Note readable', trim(await c.git(['notes', '--ref=compat', 'show'])), 'synthetic note'); await c.git(['notes', '--ref=compat', 'add', '-f', '-m', 'revised note']); c.eq('Note revised', trim(await c.git(['notes', '--ref=compat', 'show'])), 'revised note'); c.eq('Tree unchanged', await oid(c, 'HEAD^{tree}'), tree); c.eq('HEAD unchanged', await oid(c), head); c.eq('Notes ref object is commit', trim(await c.git(['cat-file', '-t', 'refs/notes/compat'])), 'commit'); await c.git(['notes', '--ref=compat', 'prune', '--dry-run']);
  }, { limits: ['Notes merge strategy variants are not included in this add/replace/prune baseline.'] }),
  native('INSPECT-012', 'Lightweight and annotated tag refs have different object types', async c => {
    const head = await oid(c); await c.git(['tag', 'light']); await c.git(['tag', '-a', 'annotated', '-m', 'tag message']); c.eq('Light ref points directly at commit', await oid(c, 'refs/tags/light'), head); c.eq('Annotated ref points at tag object', trim(await c.git(['cat-file', '-t', 'refs/tags/annotated'])), 'tag'); c.eq('Annotated peeled object', await oid(c, 'annotated^{}'), head); await c.git(['tag', '-f', 'light', 'annotated']); c.eq('Mutable tag now points at explicit tag object', await oid(c, 'light'), await oid(c, 'annotated')); await c.git(['tag', '-d', 'light']); c.eq('Deleted tag absent', (await c.git(['show-ref', '--verify', '--quiet', 'refs/tags/light'], { ok: [1] })).code, 1);
  }, { limits: ['Cryptographic verification requires an ephemeral signing backend and is not claimed by this unsigned variant.'] }),
  native('INSPECT-013', 'Cherry detects patch equivalence despite different commit identities', async c => {
    const base = await oid(c); await c.git(['switch', '-c', 'one']); await commit(c, 'equivalent.txt', 'equivalent\n', 'one'); await c.git(['switch', '-c', 'two', base]); await commit(c, 'equivalent.txt', 'equivalent\n', 'two'); const cherry = await c.git(['cherry', 'one', 'two']); c.ok('Equivalent patch marked minus', cherry.stdout.startsWith('- ')); await c.git(['show-branch', 'one', 'two']); c.ok('Different message gives distinct identities', await oid(c, 'one') !== await oid(c, 'two'));
  }),

  native('PATCH-001', 'Apply check is read-only and invalid apply leaves state intact', async c => {
    c.write('base.txt', 'patched\n'); const patch = (await c.git(['diff', '--', 'base.txt'])).stdout; await c.git(['restore', 'base.txt']); const before = await index(c), head = await oid(c); await c.git(['apply', '--check'], { stdin: patch }); c.eq('Check leaves disk intact', c.read('base.txt'), 'base one\n'); await c.git(['apply'], { stdin: patch }); c.eq('Valid patch applied', c.read('base.txt'), 'patched\n'); const bytes = c.read('base.txt'); await c.git(['apply'], { stdin: patch, ok: [1] }); c.eq('Rejected repeat preserves disk', c.read('base.txt'), bytes); c.eq('Index not implicitly staged', await index(c), before); c.eq('HEAD unchanged', await oid(c), head);
  }),
  native('PATCH-002', 'Apply cached index and reverse target the documented snapshots', async c => {
    c.write('base.txt', 'patch result\n'); const patch = (await c.git(['diff'])).stdout; await c.git(['restore', '.']); await c.git(['apply', '--cached'], { stdin: patch }); c.eq('Cached changes index', await staged(c, 'base.txt'), 'patch result\n'); c.eq('Cached preserves disk', c.read('base.txt'), 'base one\n'); await c.git(['apply', '--cached', '-R'], { stdin: patch }); c.eq('Reverse restores index', await staged(c, 'base.txt'), 'base one\n');
    const coherent = await fresh(c, 'apply-index-clean'); await gitAt(c, coherent, ['apply', '--index'], { stdin: patch }); c.eq('Index option changes index', await staged(c, 'base.txt', coherent), 'patch result\n'); c.eq('Index option changes disk', fs.readFileSync(path.join(coherent, 'base.txt'), 'utf8'), 'patch result\n');
  }, { limits: ['Dirty index/worktree precondition failures remain distinct from these successful target-selection variants.'] }),
  native('PATCH-004', 'Binary rename patch preserves exact target bytes', async c => {
    const original = Buffer.from([0, 255, 1]), changed = Buffer.from([0, 254, 2]); await commit(c, 'old.bin', original); const base = await oid(c); await c.git(['mv', 'old.bin', 'new.bin']); c.write('new.bin', changed); await c.git(['add', 'new.bin']); const patch = (await c.git(['diff', '--cached', '--binary', '-M'])).stdout; await c.git(['reset', '--hard', base]); await c.git(['apply', '--index', '--binary'], { stdin: patch }); c.ok('Old file removed', !c.exists('old.bin')); c.eq('New binary exact', [...bytesAt(c.repo, 'new.bin')], [...changed]); c.ok('New binary staged', (await paths(c)).includes('new.bin'));
  }),
  native('PATCH-005', 'Format-patch and am transport authors messages and tree through local mailbox', async c => {
    const base = await oid(c); await commit(c, 'one.txt', 'one\n', 'first patch'); await commit(c, 'two.txt', 'two\n', 'second patch'); const tree = await oid(c, 'HEAD^{tree}'); const patches = (await c.git(['format-patch', '--stdout', `${base}..HEAD`])).stdout; await c.git(['switch', '-c', 'imported', base]); await c.git(['am', '--committer-date-is-author-date'], { stdin: patches }); c.eq('Imported tree equal', await oid(c, 'HEAD^{tree}'), tree); c.eq('Imported messages ordered', trim(await c.git(['log', '--format=%s', '--reverse', `${base}..HEAD`])), 'first patch\nsecond patch'); c.eq('Original author preserved', trim(await c.git(['show', '-s', '--format=%ae', 'HEAD'])), trim(await c.git(['show', '-s', '--format=%ae', 'main'])));
  }),
  native('PATCH-007', 'Synthetic mailbox is split and extracted without creating commits', async c => {
    const base = await oid(c); await commit(c, 'mail.txt', 'mail content\n', 'mail subject'); const mailbox = (await c.git(['format-patch', '-1', '--stdout'])).stdout; const splitDir = inside(c, 'mail-split'); fs.mkdirSync(splitDir); const mboxFile = inside(c, 'mailbox.mbox'); fs.writeFileSync(mboxFile, mailbox); const split = await c.git(['mailsplit', `-o${splitDir}`, '--', mboxFile]); c.eq('One mail split', trim(split), '1'); const message = inside(c, 'message.txt'), patchFile = inside(c, 'mail.patch'); const info = await c.git(['mailinfo', message, patchFile], { stdin: mailbox }); c.ok('Mail subject extracted', info.stdout.includes('Subject: mail subject')); const patch = fs.readFileSync(patchFile, 'utf8'); const first = trim(await c.git(['patch-id', '--stable'], { stdin: patch })).split(' ')[0]; const second = trim(await c.git(['patch-id', '--stable'], { stdin: patch })).split(' ')[0]; c.eq('Stable patch ID repeatable', first, second); c.eq('Tools do not publish another commit', trim(await c.git(['rev-list', '--count', `${base}..HEAD`])), '1');
  }),
  native('PATCH-008', 'Archive exports the selected committed tree with export-ignore rules', async c => {
    await commit(c, '.gitattributes', 'secret.txt export-ignore\n'); await commit(c, 'secret.txt', 'synthetic omitted\n'); await commit(c, 'visible.txt', 'committed archive bytes\n'); c.write('visible.txt', 'uncommitted local bytes\n'); const archive = inside(c, 'tree.tar'); await c.git(['archive', '--format=tar', `--output=${archive}`, 'HEAD']); const commitId = await c.git(['get-tar-commit-id'], { stdin: fs.readFileSync(archive) }); c.eq('Tar archive names exact commit', trim(commitId), await oid(c)); const data = fs.readFileSync(archive); c.ok('Committed bytes present', data.includes(Buffer.from('committed archive bytes\n'))); c.ok('Workspace bytes absent', !data.includes(Buffer.from('uncommitted local bytes\n'))); c.ok('Export-ignored contents absent', !data.includes(Buffer.from('synthetic omitted\n'))); const zip = inside(c, 'tree.zip'); await c.git(['archive', '--format=zip', `--output=${zip}`, 'HEAD']); c.ok('Zip archive signature', fs.readFileSync(zip).subarray(0, 2).equals(Buffer.from('PK')));
  }, { limits: ['Archive bytes are inspected directly; generic archive extraction and export-subst are not claimed.'] }),
  native('PATCH-009', 'Full and incremental bundles declare their heads and prerequisite commits', async c => {
    const base = await oid(c); const next = await commit(c, 'next.txt', 'next\n'); await c.git(['branch', 'layer/ai']); const full = inside(c, 'full.bundle'), incremental = inside(c, 'incremental.bundle'); await c.git(['bundle', 'create', full, '--all']); await c.git(['bundle', 'verify', full]); const heads = await c.git(['bundle', 'list-heads', full]); c.ok('Bundle includes Layer-shaped head', heads.stdout.includes('refs/heads/layer/ai')); await c.git(['bundle', 'create', incremental, `${base}..main`]); const empty = await fresh(c, 'bundle-empty', { bare: true }); await gitAt(c, empty, ['bundle', 'verify', incremental], { ok: [1] }); await gitAt(c, empty, ['fetch', full, 'refs/heads/main:refs/heads/main']); c.eq('Full bundle imported commit', await oid(c, 'main', empty), next); await gitAt(c, empty, ['bundle', 'verify', incremental]);
  }),
  native('PATCH-010', 'Fast-export and fast-import preserve branches tags trees and unusual bytes', async c => {
    await commit(c, 'odd.bin', Buffer.from([0, 255, 12, 34])); await c.git(['branch', 'layer/ai']); await c.git(['tag', '-a', 'v1', '-m', 'annotated']); const stream = await c.git(['fast-export', '--all']); const target = await fresh(c, 'fast-imported', { seed: false }); await gitAt(c, target, ['fast-import', '--quiet'], { stdin: stream.stdoutBuffer }); c.eq('Imported main tree exact', await oid(c, 'main^{tree}', target), await oid(c, 'main^{tree}')); c.eq('Imported Layer tree exact', await oid(c, 'layer/ai^{tree}', target), await oid(c, 'layer/ai^{tree}')); c.eq('Imported tag type', trim(await gitAt(c, target, ['cat-file', '-t', 'refs/tags/v1'])), 'tag'); await gitAt(c, target, ['fsck', '--full']);
  }),
];
