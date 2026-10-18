import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';

async function fixture(t: TestContext, committed = true) {
  const container = os.tmpdir();
  mkdirSync(container, { recursive: true });
  const temporary = mkdtempSync(path.join(container, 'editor-'));
  const root = path.join(temporary, 'repo');
  const home = path.join(temporary, 'home');
  mkdirSync(home);
  const keys = ['HOME', 'XDG_CONFIG_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'GIT_LAYERS_FAILPOINT'];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.HOME = home;
  process.env.XDG_CONFIG_HOME = home;
  process.env.GIT_CONFIG_GLOBAL = path.join(home, 'global-config-must-not-be-created');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  for (const key of keys.slice(4)) delete process.env[key];
  t.after(() => {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    rmSync(temporary, { recursive: true, force: true });
  });
  const app = await GitLayers.init(root);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { env: process.env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  const write = (file: string, bytes: string | Buffer) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), bytes);
  };
  const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
  if (committed) {
    await app.configureIdentity('Editor Fixture', 'editor@example.invalid');
    git('config', '--local', 'core.autocrlf', 'false');
    write('README.md', 'base bytes\n');
    await app.baseStage(['README.md']);
    await app.baseCommit('First real base commit');
  }
  return { root, home, app, git, write, read };
}

test('editor Core initializes an unborn repository, configures only local identity and creates its first real commit', async t => {
  const f = await fixture(t, false);
  assert.equal(f.app.repo.head, '');
  assert.equal(f.git('symbolic-ref', '--short', 'HEAD'), 'main');
  await assert.rejects(() => f.app.create('too-early'), { code: 'UNBORN_HEAD' });
  const configured = await f.app.configureIdentity('Consented Local Identity', 'local@example.invalid');
  assert.equal(configured.scope, 'local');
  assert.equal(f.git('config', '--local', '--get', 'user.name'), 'Consented Local Identity');
  assert.equal(f.git('config', '--local', '--get', 'user.email'), 'local@example.invalid');
  assert.equal(existsSync(path.join(f.home, 'global-config-must-not-be-created')), false);
  await f.app.writeFile('README.md', '# Criado pelo editor\n');
  await f.app.baseStage(['README.md']);
  await f.app.baseCommit('Primeiro commit pela API do editor');
  assert.equal(f.git('show', 'HEAD:README.md'), '# Criado pelo editor');
  assert.equal(f.git('log', '-1', '--format=%an <%ae>'), 'Consented Local Identity <local@example.invalid>');
  assert.equal(f.git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 1);
  assert.equal((await f.app.status()).safe, true);
});

test('editor Core preserves UTF-8 CRLF, rejects stale saves and exposes binary content as read-only', async t => {
  const f = await fixture(t);
  const bytes = Buffer.from('ação e acentuação\r\nsegunda linha\r\n');
  f.write('texto.txt', bytes);
  const opened = await f.app.readFile('texto.txt');
  assert.equal(opened.eol, 'CRLF');
  assert.equal(opened.binary, false);
  assert.equal(opened.readOnly, false);
  assert.equal(opened.text, bytes.toString('utf8'));
  const edited = `${opened.text}terceira linha\r\n`;
  const saved = await f.app.writeFile('texto.txt', edited, opened.hash);
  assert.deepEqual(readFileSync(path.join(f.root, 'texto.txt')), Buffer.from(edited));
  assert.equal(saved.eol, 'CRLF');
  await assert.rejects(() => f.app.writeFile('texto.txt', 'stale old buffer', opened.hash), { code: 'EXTERNAL_EDIT' });
  assert.equal(f.read('texto.txt'), edited);
  f.write('texto.txt', 'externally edited bytes\r\n');
  await assert.rejects(() => f.app.writeFile('texto.txt', edited, saved.hash), { code: 'EXTERNAL_EDIT' });
  assert.equal(f.read('texto.txt'), 'externally edited bytes\r\n');
  const binary = Buffer.from([0, 255, 128, 13, 10, 1, 0]);
  f.write('binary.bin', binary);
  const binaryInfo = await f.app.readFile('binary.bin');
  assert.equal(binaryInfo.binary, true);
  assert.equal(binaryInfo.readOnly, true);
  assert.equal(binaryInfo.text, '');
  await assert.rejects(() => f.app.writeFile('binary.bin', 'must not replace a binary', binaryInfo.hash), { code: 'BINARY_FILE' });
  assert.deepEqual(readFileSync(path.join(f.root, 'binary.bin')), binary);
  for (const file of ['../outside', '.git/config', '/etc/passwd']) await assert.rejects(() => f.app.readFile(file));
});

test('editor Core renames within a Layer, refuses cross-owner destinations and backs up confirmed deletion bytes', { timeout: 300000 }, async t => {
  const f = await fixture(t);
  for (const name of ['ai', 'other']) {
    await f.app.create(name);
    await f.app.on(name);
    f.write(`${name}.txt`, `${name} bytes\n`);
    await f.app.add(name, [`${name}.txt`]);
    await f.app.commit(name, `Seed ${name}`);
  }
  const main = f.git('rev-parse', 'main');
  await assert.rejects(() => f.app.renameFile('ai.txt', 'README.md'));
  assert.equal(f.read('README.md'), 'base bytes\n');
  assert.equal(f.read('ai.txt'), 'ai bytes\n');
  unlinkSync(path.join(f.root, 'other.txt'));
  await assert.rejects(() => f.app.renameFile('ai.txt', 'other.txt'), { code: 'OWNERSHIP' });
  await assert.rejects(() => f.app.renameFile('README.md', 'other.txt'), { code: 'OWNERSHIP' });
  assert.equal(existsSync(path.join(f.root, 'other.txt')), false);
  assert.equal(f.read('ai.txt'), 'ai bytes\n');
  await f.app.restore('other', ['other.txt'], true);
  const renamed = await f.app.renameFile('ai.txt', 'renamed á.txt');
  assert.equal(renamed.owner, 'ai');
  assert.equal(existsSync(path.join(f.root, 'ai.txt')), false);
  assert.equal(f.read('renamed á.txt'), 'ai bytes\n');
  assert.ok((await f.app.list()).find(item => item.name === 'ai')!.reservations.includes('renamed á.txt'));
  await assert.rejects(() => f.app.baseStage(['renamed á.txt']), { code: 'OWNERSHIP' });
  await f.app.add('ai', ['ai.txt', 'renamed á.txt']);
  await f.app.commit('ai', 'Rename in the same owner');
  assert.deepEqual(f.git('-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', 'layer/ai').split('\n'), ['renamed á.txt']);
  const discarded = 'latest local bytes to recover\r\n';
  f.write('renamed á.txt', discarded);
  await assert.rejects(() => f.app.deleteFile('renamed á.txt'), { code: 'CONFIRM_REQUIRED' });
  assert.equal(f.read('renamed á.txt'), discarded);
  const deleted = await f.app.deleteFile('renamed á.txt', true);
  assert.equal(existsSync(path.join(f.root, 'renamed á.txt')), false);
  const journal = JSON.parse(readFileSync(path.join(deleted.backup, 'journal.json'), 'utf8')) as { backups: Array<{ source: string; copy: string | null }> };
  const backup = journal.backups.find(item => item.source === path.join(f.root, 'renamed á.txt'))!;
  assert.ok(backup.copy);
  assert.equal(readFileSync(backup.copy, 'utf8'), discarded);
  await f.app.add('ai', ['renamed á.txt']);
  await f.app.commit('ai', 'Delete owned file');
  assert.equal(f.git('ls-tree', '-r', '--name-only', 'layer/ai'), '');
  assert.equal(f.read('other.txt'), 'other bytes\n');
  assert.equal(f.read('README.md'), 'base bytes\n');
  assert.equal(f.git('rev-parse', 'main'), main);
});
