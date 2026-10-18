import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { git, gitText } from '../../src/core/git.js';
import { safePath, walk } from '../../src/core/paths.js';
import { resolveGitExecutable } from '../../src/core/platform.js';
import { atomicJSON, fingerprint, readJSON, sameFingerprint, Transaction } from '../../src/core/storage.js';

async function directory(t: TestContext): Promise<string> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'git-layers-portability-'));
  const root = path.join(parent, 'pasta com espaços ação');
  await fs.mkdir(root);
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  return root;
}

async function repository(t: TestContext): Promise<{ root: string; app: GitLayers }> {
  const root = await directory(t);
  const previous = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM };
  process.env.GIT_CONFIG_GLOBAL = path.join(root, 'no-global-config');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', '--local', 'user.name', 'Portability Test']);
  await git(root, ['config', '--local', 'user.email', 'portability@example.invalid']);
  await git(root, ['config', '--local', 'core.autocrlf', 'true']);
  await fs.writeFile(path.join(root, 'README.md'), 'base\r\n');
  await git(root, ['add', '--', 'README.md']);
  await git(root, ['commit', '-m', 'Disposable base']);
  return { root, app: await GitLayers.init(root) };
}

const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

test('real Git discovery returns an executable without a repository or shell', async () => {
  const executable = await resolveGitExecutable();
  assert.ok(path.isAbsolute(executable));
  assert.equal((await fs.stat(executable)).isFile(), true);
  assert.match(await gitText(os.tmpdir(), ['version']), /^git version /);
});

test('atomic metadata replacement and transaction copies preserve supported physical modes', async t => {
  const root = await directory(t);
  const file = path.join(root, 'metadados.json');
  for (let revision = 0; revision < 8; revision++) {
    await atomicJSON(file, { schema: 1, revision, text: 'ação' });
    assert.equal((await readJSON<any>(file)).revision, revision);
  }
  const tx = await Transaction.begin(path.join(root, 'private'), 'portable-backup', {});
  const backup = await tx.backup(file, 'metadata');
  assert.ok(backup);
  assert.equal(sameFingerprint(await fingerprint(file), await fingerprint(backup)), true);
  assert.deepEqual((await fs.readdir(root)).filter(name => name.endsWith('.tmp')), []);
});

test('Git CRLF projection, binary staging and parking preserve the main index in accented paths', async t => {
  const { root, app } = await repository(t);
  await app.create('scripts');
  await app.on('scripts');
  const text = 'ferramentas ação/texto com espaços.txt';
  const binary = 'ferramentas ação/dados.bin';
  await fs.mkdir(path.dirname(path.join(root, text)), { recursive: true });
  const staged = Buffer.from('primeira linha\r\nsegunda linha\r\n', 'utf8');
  const changed = Buffer.from('primeira linha\r\nedição posterior\r\n', 'utf8');
  const bytes = Buffer.from([0, 255, 13, 10, 128, 0, 65]);
  await fs.writeFile(path.join(root, text), staged);
  await fs.writeFile(path.join(root, binary), bytes);
  const baseIndex = digest(await fs.readFile(app.repo.index));
  await app.add('scripts', [text, binary]);
  await fs.writeFile(path.join(root, text), changed);
  await app.commit('scripts', 'Exact staged bytes');
  assert.equal(await gitText(root, ['symbolic-ref', '--short', 'HEAD']), 'main');
  assert.equal(digest(await fs.readFile(app.repo.index)), baseIndex);
  assert.deepEqual((await git(root, ['show', `layer/scripts:${binary}`])).stdout, bytes);
  assert.equal((await git(root, ['show', `layer/scripts:${text}`])).stdout.toString(), staged.toString().replace(/\r\n/g, '\n'));
  await app.off('scripts', true);
  assert.equal((await fingerprint(path.join(root, text))).exists, false);
  await app.on('scripts');
  assert.deepEqual(await fs.readFile(path.join(root, text)), changed);
  assert.deepEqual(await fs.readFile(path.join(root, binary)), bytes);
  assert.equal(digest(await fs.readFile(app.repo.index)), baseIndex);
});

test('directory junctions and symlink ancestors cannot enter projection, traversal or storage', async t => {
  const root = await directory(t);
  const outside = await directory(t);
  const link = path.join(root, 'junction');
  await fs.writeFile(path.join(outside, 'preservar.txt'), 'outside bytes');
  await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await fs.lstat(link)).isSymbolicLink(), true);
  await assert.rejects(() => safePath(root, 'junction/preservar.txt'), { code: 'UNSAFE_PATH' });
  await assert.rejects(() => walk(root), { code: 'UNSAFE_PATH' });
  await assert.rejects(() => fingerprint(path.join(link, 'preservar.txt')), { code: 'UNSAFE_PATH' });
  await assert.rejects(() => atomicJSON(path.join(link, 'metadata.json'), { schema: 1 }), { code: 'UNSAFE_PATH' });
  assert.equal(await fs.readFile(path.join(outside, 'preservar.txt'), 'utf8'), 'outside bytes');
  await assert.rejects(() => fs.lstat(path.join(outside, 'metadata.json')), { code: 'ENOENT' });
});

test('existing executable Git metadata survives edits when the filesystem ignores executable bits', async t => {
  const { root, app } = await repository(t);
  await git(root, ['config', '--local', 'core.filemode', 'false']);
  const blob = await gitText(root, ['hash-object', '-w', '--stdin'], { input: '# example\n' });
  const tree = await gitText(root, ['mktree'], { input: `100755 blob ${blob}\trun.sh\n` });
  const commit = await gitText(root, ['commit-tree', tree], { input: 'Executable imported as an independent layer\n' });
  await git(root, ['update-ref', 'refs/heads/layer/executable', commit, '']);
  await app.register('executable');
  await app.on('executable');
  await fs.writeFile(path.join(root, 'run.sh'), '# updated example\r\n');
  await app.add('executable', ['run.sh']);
  await app.commit('executable', 'Retain executable metadata');
  assert.match(await gitText(root, ['ls-tree', 'layer/executable', '--', 'run.sh']), /^100755 blob /);
  await app.off('executable');
  await app.on('executable');
  assert.equal(await fs.readFile(path.join(root, 'run.sh'), 'utf8'), '# updated example\r\n');
  assert.match(await gitText(root, ['ls-tree', 'layer/executable', '--', 'run.sh']), /^100755 blob /);
});

test('a repository that explicitly disables hooks with the platform null device remains supported', async t => {
  const { root, app } = await repository(t);
  await git(root, ['config', '--local', 'core.hooksPath', process.platform === 'win32' ? 'NUL' : '/dev/null']);
  await app.create('disabled-hooks');
  assert.equal((await app.list())[0]?.name, 'disabled-hooks');
});
