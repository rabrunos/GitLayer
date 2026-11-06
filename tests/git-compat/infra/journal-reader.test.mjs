import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { createFixture, cleanupFixture, fileHash, project, within } from '../../../scripts/git-compat/lib.mjs';
import { fileManifest } from '../../../scripts/git-compat/audit.mjs';
import { externalFixtureParent } from '../../../scripts/git-compat/fixture-parent.mjs';
import { readJournal } from '../helpers/read-journal.mjs';

// These tests exercise the actual frozen production codec, not Git or recovery.
async function fixture(t) {
  const owned = createFixture(externalFixtureParent(project), 'gl-journal-reader');
  let passed = false;
  t.after(() => { if (passed) cleanupFixture(owned); else t.diagnostic(JSON.stringify({ retained: true, reason: 'journal-reader-assertions-incomplete', ...owned })); });
  const frozen = path.join(owned.root, 'source'), core = path.join(frozen, 'src', 'core');
  const repo = path.join(owned.root, 'repo'), artifactDir = path.join(owned.root, 'evidence'), buildDir = path.join(artifactDir, 'build');
  fs.mkdirSync(path.dirname(core), { recursive: true });
  fs.cpSync(path.join(project, 'src', 'core'), core, { recursive: true, errorOnExist: true, force: false });
  const sourceFiles = fileManifest(frozen, ['src/core']);
  const built = await build({ absWorkingDir: frozen, entryPoints: { storage: path.join(core, 'storage.ts') }, outdir: buildDir, bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: 'external', metafile: true, outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
  assert(Object.keys(built.metafile.inputs).every(input => within(core, path.resolve(frozen, input))), 'Every production codec input comes from the owned frozen copy');
  assert.deepEqual(fileManifest(frozen, ['src/core']), sourceFiles, 'The copied production sources remain unchanged while compiling');
  const bundle = path.join(buildDir, 'storage.mjs'), bundleHash = fileHash(bundle);
  fs.mkdirSync(repo); fs.writeFileSync(path.join(artifactDir, 'build.json'), JSON.stringify({ source_basis: 'owned_frozen_production_copy', sourceFiles, bundleSha256: bundleHash }, null, 2) + '\n', { flag: 'wx' });
  const c = { repo, root: owned.root, artifactDir, buildDir, ok(label, condition) { assert.ok(condition, label); } };
  const storage = await import(pathToFileURL(bundle).href), directory = path.join(repo, '.git', 'layers');
  const hashes = files => files.map(file => [path.basename(file), fileHash(file)]);
  return { c, storage, directory, hashes, success() { assert.equal(fileHash(bundle), bundleHash); passed = true; } };
}

test('Journal reader resolves the owned frozen storage bundle and reads an unchanged legacy schema1 journal', { timeout: 60000 }, async t => {
  const f = await fixture(t), id = randomUUID(), folder = path.join(f.directory, 'transactions', id), at = '2026-01-01T00:00:00.000Z';
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'journal.json'), legacy = { schema: 1, id, kind: 'legacy-reader-fixture', state: 'pending', createdAt: at, updatedAt: at, steps: [{ step: 'prepared', at }], backups: [], recovery: { files: [] } };
  fs.writeFileSync(file, JSON.stringify(legacy) + '\n', { flag: 'wx' }); const before = fileHash(file);
  const missingBuild = path.join(f.c.artifactDir, 'missing-build'); fs.mkdirSync(missingBuild);
  await assert.rejects(readJournal({ ...f.c, buildDir: missingBuild }, id), { code: 'ERR_MODULE_NOT_FOUND' });
  assert.equal(fileHash(file), before, 'Missing bundle does not substitute a live TS reader or modify the journal');
  const observed = await readJournal(f.c, id); assert.equal(observed.file, file); assert.deepEqual(observed.value, legacy);
  assert.equal(fileHash(file), before); assert.deepEqual(fs.readdirSync(folder), ['journal.json']);
  f.success();
});

test('Journal reader replays real schema2 records and paired AFTER data from its production snapshot', { timeout: 60000 }, async t => {
  const f = await fixture(t), tx = await f.storage.Transaction.begin(f.directory, 'incremental-reader-fixture', {}), files = [];
  tx.data.recovery = { files }; await tx.record('prepared');
  const target = path.join(f.c.root, 'synthetic-file'); fs.writeFileSync(target, 'A bytes\n');
  const entry = await tx.backupTracked(target, 'file', await f.storage.fingerprint(target), files);
  fs.writeFileSync(target, 'C bytes\n'); entry.after = await f.storage.fingerprint(target); await tx.recordFileWrite(entry);
  const components = ['journal.json', 'events.log', 'events.tip'].map(name => path.join(tx.dir, name)), before = f.hashes(components);
  const manifest = JSON.parse(fs.readFileSync(components[0], 'utf8')); assert.equal(manifest.schema, 2); assert.notDeepEqual(manifest.base, tx.data);
  const observed = await readJournal(f.c, tx.id); assert.deepEqual(observed.value, tx.data);
  assert.equal(observed.value.steps.at(-1).step, 'write-completed'); assert.deepEqual(observed.value.recovery.files[0].after, entry.after);
  assert.deepEqual(f.hashes(components), before, 'Semantic decoding preserves all durable bytes'); assert.equal(fs.readFileSync(entry.backup, 'utf8'), 'A bytes\n');
  f.success();
});

test('Journal reader refuses a corrupt durable tip and preserves manifest, records and damaged bytes', { timeout: 60000 }, async t => {
  const f = await fixture(t), tx = await f.storage.Transaction.begin(f.directory, 'corrupt-tip-reader-fixture', {});
  tx.data.recovery = { files: [] }; await tx.record('prepared'); await tx.record('second');
  const components = ['journal.json', 'events.log', 'events.tip'].map(name => path.join(tx.dir, name));
  const tip = fs.readFileSync(components[2]); assert.equal(tip.length, 512); tip[0] = 0; fs.writeFileSync(components[2], tip);
  const before = f.hashes(components);
  await assert.rejects(readJournal(f.c, tx.id), { code: 'METADATA_INVALID' });
  await assert.rejects(readJournal(f.c, tx.id), { code: 'METADATA_INVALID' });
  assert.deepEqual(f.hashes(components), before, 'Refusal is repeatable without repair, truncation or defaults');
  f.success();
});
