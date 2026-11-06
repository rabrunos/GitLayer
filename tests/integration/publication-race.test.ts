import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { listTransactions } from '../../src/core/storage.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const budget = { timeout: 180000 };
async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-scale-publication-race');
  const previous = { ...process.env }, env = isolatedEnvironment(owned.root, officialGit);
  let verified = false;
  t.after(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, previous);
    if (verified && previous.GL_STAGE2_PRESERVE_FIXTURES !== '1') cleanupFixture(owned);
    else t.diagnostic(JSON.stringify({ kind: 'retained-scale-publication-race', ...owned }));
  });
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string) => cp.execFileSync(officialGit, args, { cwd: repo, env: { ...env, ...(index ? { GIT_INDEX_FILE: index } : {}) }, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  native(['init', '-b', 'main']); fs.writeFileSync(path.join(repo, 'base.txt'), 'base\n'); native(['add', '--', 'base.txt']); native(['commit', '-m', 'base']);
  const seed = path.join(owned.root, 'seed.index'), target = path.join(repo, 'layer.txt');
  fs.writeFileSync(target, 'committed Layer A\n'); native(['read-tree', '--empty'], seed); native(['add', '--', 'layer.txt'], seed);
  const tree = native(['write-tree'], seed), commit = native(['commit-tree', tree, '-m', 'layer']); native(['update-ref', 'refs/heads/layer/a', commit]); fs.unlinkSync(target);
  const app = await GitLayers.init(repo); await app.register('a');
  const layer = (await app.list()).find(entry => entry.name === 'a')!, index = path.join(app.dir, 'indexes', layer.id + '.index');
  const before = { head: native(['rev-parse', 'HEAD']), refs: native(['for-each-ref', '--format=%(refname) %(objectname)']), main: fs.readFileSync(app.repo.index), index: fs.readFileSync(index) };
  const unchanged = () => {
    assert.equal(native(['rev-parse', 'HEAD']), before.head);
    const refs = new Map(native(['for-each-ref', '--format=%(refname) %(objectname)']).split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
    const previous = new Map(before.refs.split('\n').filter(Boolean).map(line => line.split(' ') as [string, string]));
    for (const [ref, oid] of previous) assert.equal(refs.get(ref), oid);
    const checkpoints = new Set([...previous].filter(([ref]) => ref.startsWith('refs/git-layers/state/')).map(([, oid]) => oid));
    for (const [ref, oid] of refs) if (!previous.has(ref)) { assert.match(ref, /^refs\/git-layers\/transactions\/[a-f0-9-]+\/[a-f0-9-]+$/u); assert(checkpoints.has(oid)); }
    assert.deepEqual(fs.readFileSync(app.repo.index), before.main); assert.deepEqual(fs.readFileSync(index), before.index);
    assert.equal(native(['show', 'layer/a:layer.txt']), 'committed Layer A');
  };
  return { owned, repo, target, native, app, env, unchanged, verified: () => { verified = true; } };
}

test('activation publication atomically refuses a destination created after its last absence check', budget, async t => {
  const f = await fixture(t), rename = fsp.rename, link = fsp.link;
  let injected = false;
  const inject = (destination: fs.PathLike) => { if (path.resolve(String(destination)) === f.target && !injected) { fs.writeFileSync(f.target, 'external later C\n', { flag: 'wx' }); injected = true; } };
  // A real competing create immediately at the actual publication syscall.
  fsp.rename = async (from, to) => { inject(to); return rename(from, to); };
  fsp.link = async (from, to) => { inject(to); return link(from, to); };
  try { await assert.rejects(f.app.on('a'), (error: any) => ['EXTERNAL_EDIT', 'EEXIST'].includes(error.code)); }
  finally { fsp.rename = rename; fsp.link = link; }
  assert(injected); assert.equal(fs.readFileSync(f.target, 'utf8'), 'external later C\n'); f.unchanged(); f.verified();
});

for (const point of ['before-new-file-publication', 'after-new-file-link', 'after-new-file-unlink']) test('Core publication interruption ' + point + ' refuses repeated recovery without inventing a healthy state', budget, async t => {
  const f = await fixture(t), previous = process.env.GIT_LAYERS_FAILPOINT;
  process.env.GIT_LAYERS_FAILPOINT = point;
  try { await assert.rejects(f.app.on('a'), { code: 'INJECTED_FAILURE' }); }
  finally { if (previous === undefined) delete process.env.GIT_LAYERS_FAILPOINT; else process.env.GIT_LAYERS_FAILPOINT = previous; }
  const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1);
  const data = pending[0], tracked = data.recovery.files.find((entry: any) => entry.path === f.target);
  assert(tracked && tracked.before.exists === false && tracked.after === undefined); assert.equal(tracked.backup, null);
  const sourceAlias = fs.readdirSync(f.repo).find(name => name.startsWith('layer.txt.git-layer-'));
  if (point === 'before-new-file-publication') { assert.equal(fs.existsSync(f.target), false); assert(sourceAlias); }
  else { assert.equal(fs.readFileSync(f.target, 'utf8'), 'committed Layer A\n'); assert.equal(fs.statSync(f.target).nlink, point === 'after-new-file-link' ? 2 : 1); }
  const journal = path.join(f.app.dir, 'transactions', data.id, 'journal.json'), bytes = fs.readFileSync(journal);
  const reopened = await GitLayers.open(f.repo);
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(reopened.recover(), (error: any) => ['RECOVERY_CONFLICT', 'UNSAFE_PATH'].includes(error.code));
    assert.deepEqual(fs.readFileSync(journal), bytes); f.unchanged();
  }
  assert.equal((await reopened.doctor()).safe, false);
  assert.equal((await reopened.exportRecovery(path.join(f.owned.root, 'export'))).complete, true);
  f.verified();
});

test('activation detects a destination edited after the no-replace link without replacing the later bytes during rollback', budget, async t => {
  const f = await fixture(t), original = fsp.link; let injected = false;
  fsp.link = async (from, to) => { await original(from, to); if (path.resolve(String(to)) === f.target && !injected) { fs.writeFileSync(f.target, 'later physical C\n'); injected = true; } };
  try { await assert.rejects(f.app.on('a'), { code: 'EXTERNAL_EDIT' }); }
  finally { fsp.link = original; }
  assert(injected); assert.equal(fs.readFileSync(f.target, 'utf8'), 'later physical C\n'); f.unchanged();
  assert.equal((await f.app.doctor()).safe, false); assert((await listTransactions(f.app.dir)).length > 0); f.verified();
});

for (const boundary of ['before-link', 'after-link', 'after-unlink']) test('owned process death at publication ' + boundary + ' preserves journal bytes Git state and the disputed coordinator lock', budget, async t => {
  const f = await fixture(t), coreURL = pathToFileURL(path.resolve('src/core/index.ts')).href;
  const childSource = `
    import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
    import { GitLayers } from ${JSON.stringify(coreURL)};
    const root = process.env.GL_PUB_ROOT, nonce = process.env.GL_PUB_NONCE, repo = process.env.GL_PUB_REPO, boundary = process.env.GL_PUB_BOUNDARY;
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.git-compat-owned.json'),'utf8')).nonce, nonce);
    assert.equal(path.dirname(fs.realpathSync(repo)), fs.realpathSync(root));
    const target = path.join(repo,'layer.txt'), app = await GitLayers.open(repo), originalLink = fs.promises.link, originalUnlink = fs.promises.unlink;
    const barrier = async (source) => { process.stdout.write(JSON.stringify({pid:process.pid,nonce,boundary,source})+'\\n'); await new Promise(()=>{setInterval(()=>{},1000);}); };
    fs.promises.link = async (from,to) => { if(path.resolve(String(to)) !== target)return originalLink(from,to); if(boundary==='before-link')await barrier(String(from)); await originalLink(from,to); if(boundary==='after-link')await barrier(String(from)); };
    fs.promises.unlink = async (file) => { await originalUnlink(file); if(boundary==='after-unlink'&&String(file).startsWith(target+'.git-layer-'))await barrier(String(file)); };
    await app.on('a'); throw Error('Owned publication barrier not reached');
  `;
  const child = cp.spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', childSource], { cwd: path.resolve('.'), env: { ...f.env, GL_PUB_ROOT: f.owned.root, GL_PUB_NONCE: f.owned.nonce, GL_PUB_REPO: f.repo, GL_PUB_BOUNDARY: boundary }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  let ended = false;
  t.after(async () => { if (!ended && child.exitCode === null && child.signalCode === null) { child.kill(); await exited; } });
  const ready = await new Promise<any>((resolve, reject) => {
    let stdout = '', stderr = ''; const timer = setTimeout(() => reject(new Error('Owned child publication timeout: ' + stderr)), 120000);
    child.stderr.on('data', bytes => { stderr += String(bytes); });
    child.stdout.on('data', bytes => { stdout += String(bytes); if (stdout.includes('\n')) { clearTimeout(timer); try { resolve(JSON.parse(stdout.split('\n')[0]!)); } catch (error) { reject(error); } } });
    child.once('error', error => { clearTimeout(timer); reject(error); }); child.once('exit', () => { clearTimeout(timer); reject(new Error('Owned child exited before barrier: ' + stderr)); });
  });
  assert.equal(ready.pid, child.pid); assert.equal(ready.nonce, f.owned.nonce); assert.equal(ready.boundary, boundary);
  const owner = path.join(f.app.dir, 'locks', 'coordinator', 'owner.json'), ownerBytes = fs.readFileSync(owner); assert.equal(JSON.parse(ownerBytes.toString()).pid, child.pid);
  const pending = await listTransactions(f.app.dir); assert.equal(pending.length, 1);
  const journal = path.join(f.app.dir, 'transactions', pending[0].id, 'journal.json'), journalBytes = fs.readFileSync(journal);
  assert.equal(pending[0].recovery.files.find((entry: any) => entry.path === f.target).after, undefined);
  if (boundary === 'before-link') { assert.equal(fs.existsSync(f.target), false); assert.equal(fs.readFileSync(ready.source, 'utf8'), 'committed Layer A\n'); }
  else { assert.equal(fs.readFileSync(f.target, 'utf8'), 'committed Layer A\n'); assert.equal(fs.statSync(f.target).nlink, boundary === 'after-link' ? 2 : 1); }
  assert(child.kill()); await exited; ended = true;
  const reopened = await GitLayers.open(f.repo);
  for (let attempt = 0; attempt < 2; attempt++) { await assert.rejects(reopened.recover(), { code: 'LOCKED' }); assert.deepEqual(fs.readFileSync(journal), journalBytes); assert.deepEqual(fs.readFileSync(owner), ownerBytes); f.unchanged(); }
  assert.equal((await reopened.doctor()).safe, false); assert.equal((await reopened.exportRecovery(path.join(f.owned.root, 'export'))).complete, true);
  t.diagnostic(JSON.stringify({ kind: 'publication-owned-child-death', boundary, pid: ready.pid, powerLoss: false, disputedLockPreserved: true, automaticRecoveryCompleted: false })); f.verified();
});
test('rollback publication refuses a competing create after its absent-destination validation', budget, async t => {
  const f = await fixture(t); await f.app.on('a');
  process.env.GIT_LAYERS_FAILPOINT = 'after-deactivate-files';
  try { await assert.rejects(f.app.off('a'), { code: 'INJECTED_FAILURE' }); } finally { delete process.env.GIT_LAYERS_FAILPOINT; }
  assert.equal(fs.existsSync(f.target), false);
  const rename = fsp.rename, link = fsp.link; let injected = false;
  const inject = (destination: fs.PathLike) => { if (path.resolve(String(destination)) === f.target && !injected) { fs.writeFileSync(f.target, 'external rollback C\n', { flag: 'wx' }); injected = true; } };
  fsp.rename = async (from, to) => { inject(to); return rename(from, to); };
  fsp.link = async (from, to) => { inject(to); return link(from, to); };
  try { await assert.rejects(f.app.recover(), (error: any) => ['EXTERNAL_EDIT', 'RECOVERY_CONFLICT'].includes(error.code)); }
  finally { fsp.rename = rename; fsp.link = link; }
  assert(injected); assert.equal(fs.readFileSync(f.target, 'utf8'), 'external rollback C\n'); f.unchanged();
  assert((await listTransactions(f.app.dir)).length > 0); assert.equal((await f.app.doctor()).safe, false); f.verified();
});

test('successful activation retires only its newly extracted materialized directory after durable completion', budget, async t => {
  const f = await fixture(t); await f.app.on('a');
  assert.equal(fs.readFileSync(f.target, 'utf8'), 'committed Layer A\n'); assert.equal(fs.lstatSync(f.target).nlink, 1); f.unchanged();
  const transactions = path.join(f.app.dir, 'transactions');
  const receipts = fs.readdirSync(transactions).map(id => path.join(transactions, id)).filter(folder => fs.existsSync(path.join(folder, 'materialized-cleanup.json')));
  assert.equal(receipts.length, 1); const receipt = JSON.parse(fs.readFileSync(path.join(receipts[0]!, 'materialized-cleanup.json'), 'utf8'));
  assert.equal(receipt.status, 'removed'); assert.equal(receipt.removedFiles, 1); assert.equal(fs.existsSync(path.join(receipts[0]!, 'materialized')), false);
  const journal = JSON.parse(fs.readFileSync(path.join(receipts[0]!, 'journal.json'), 'utf8')); assert.equal(journal.state, 'completed');
  for (const backup of journal.backups) if (backup.copy !== null) assert.equal(fs.existsSync(backup.copy), true);
  assert.deepEqual(await listTransactions(f.app.dir), []); f.verified();
});