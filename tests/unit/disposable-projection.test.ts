import assert from 'node:assert/strict';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { createFixture, cleanupFixture } from '../../scripts/git-compat/lib.mjs';
import { prepareProjectionCleanup } from '../../src/core/disposable-projection.js';
import { Transaction, fingerprint } from '../../src/core/storage.js';

async function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-disposable-projection'); let verified = false;
  t.after(() => { if (verified && process.env.GL_STAGE2_PRESERVE_FIXTURES !== '1') cleanupFixture(owned); else t.diagnostic(JSON.stringify({ kind: 'retained-disposable-projection', ...owned })); });
  const tx = await Transaction.begin(path.join(owned.root, 'metadata'), 'activate', {}), directory = path.join(tx.dir, 'materialized');
  fs.mkdirSync(path.join(directory, 'nested'), { recursive: true });
  const paths = [path.join(directory, 'first.txt'), path.join(directory, 'nested', 'last.txt')];
  for (const file of paths) fs.writeFileSync(file, file.endsWith('first.txt') ? 'first\n' : 'last\n', { flag: 'wx' });
  const plan = await Promise.all(paths.map(async file => ({ path: file, fingerprint: await fingerprint(file) })));
  const cleanup = await prepareProjectionCleanup(tx, directory, plan);
  return { owned, tx, directory, paths, plan, cleanup, verified: () => { verified = true; } };
}

test('completed current projection cleanup removes only exact disposable files and empty directories with receipt', async t => {
  const f = await fixture(t), backup = path.join(f.tx.dir, 'backups', 'retained.txt'); fs.mkdirSync(path.dirname(backup)); fs.writeFileSync(backup, 'unique recovery evidence\n');
  await f.tx.finish(); const receipt = await f.cleanup(); assert.equal(receipt.status, 'removed'); assert.equal(receipt.removedFiles, 2); assert.equal(receipt.removedDirectories, 2);
  assert.equal(fs.existsSync(f.directory), false); assert.equal(fs.readFileSync(backup, 'utf8'), 'unique recovery evidence\n');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.tx.dir, 'materialized-cleanup.json'), 'utf8')).status, 'removed'); f.verified();
});

test('pending transaction never authorizes disposable cleanup', async t => {
  const f = await fixture(t), receipt = await f.cleanup(); assert.equal(receipt.status, 'retained'); assert.equal(receipt.removedFiles, 0);
  for (const file of f.plan) assert.deepEqual(await fingerprint(file.path), file.fingerprint); assert.equal(f.tx.data.state, 'pending'); f.verified();
});

for (const change of ['content', 'unknown-file', 'unknown-directory', 'hardlink', 'dependency']) test('projection cleanup retains the entire tree before effects on ' + change, async t => {
  const f = await fixture(t);
  if (change === 'content') fs.writeFileSync(f.paths[1]!, 'later unknown bytes\n');
  if (change === 'unknown-file') fs.writeFileSync(path.join(f.directory, 'unknown.txt'), 'external\n');
  if (change === 'unknown-directory') fs.mkdirSync(path.join(f.directory, 'unknown'));
  if (change === 'hardlink') await fsp.link(f.paths[1]!, path.join(f.owned.root, 'external-alias.txt'));
  if (change === 'dependency') f.tx.data.metadata = { requiredSource: f.paths[1] };
  await f.tx.finish(); const receipt = await f.cleanup(); assert.equal(receipt.status, 'retained'); assert.equal(receipt.removedFiles, 0); assert(receipt.reason);
  assert.equal(fs.existsSync(f.paths[0]!), true); assert.equal(fs.existsSync(f.paths[1]!), true); assert.equal(f.tx.data.state, 'completed'); f.verified();
});

test('cleanup I/O failure stays a completed transaction and retains remaining files with precise partial receipt', async t => {
  const f = await fixture(t); await f.tx.finish(); const original = fsp.unlink;
  fsp.unlink = async file => { if (path.resolve(String(file)) === f.paths[1]) throw Object.assign(new Error('synthetic ENOSPC'), { code: 'ENOSPC' }); return original(file); };
  let receipt;
  try { receipt = await f.cleanup(); } finally { fsp.unlink = original; }
  assert.equal(receipt.status, 'retained'); assert.equal(receipt.reason, 'ENOSPC'); assert.equal(receipt.removedFiles, 1);
  assert.equal(fs.existsSync(f.paths[0]!), false); assert.equal(fs.existsSync(f.paths[1]!), true); assert.equal(f.tx.data.state, 'completed'); f.verified();
});
test('external durable-journal replacement cannot authorize deletion from completed in-memory data', async t => {
  const f = await fixture(t); await f.tx.finish();
  const file = path.join(f.tx.dir, 'journal.json'), data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.metadata = { newlyRequiredMaterializedFile: f.paths[0] }; fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  const receipt = await f.cleanup(); assert.equal(receipt.status, 'retained'); assert.equal(receipt.reason, 'durable-journal-changed'); assert.equal(receipt.removedFiles, 0);
  for (const plan of f.plan) assert.deepEqual(await fingerprint(plan.path), plan.fingerprint); f.verified();
});