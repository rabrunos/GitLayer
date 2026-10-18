import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { developmentInputFingerprint } from '../../scripts/development-inputs.mjs';

test('Dev ignores duplicate write/metadata notifications but detects source changes, additions and deletions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lab-watch-inputs-'));
  try {
    await mkdir(path.join(root, 'src'));
    const source = path.join(root, 'src/main.ts');
    await writeFile(source, 'export const value = 1;');
    const original = await developmentInputFingerprint(root);
    await utimes(source, new Date(), new Date());
    await writeFile(source, 'export const value = 1;');
    assert.equal(await developmentInputFingerprint(root), original, 'Identical bytes must not restart the editor twice');
    await writeFile(source, 'export const value = 2;');
    const edited = await developmentInputFingerprint(root);
    assert.notEqual(edited, original, 'Same-length source edits must trigger a build');
    const added = path.join(root, 'src/new.ts');
    await writeFile(added, '');
    assert.notEqual(await developmentInputFingerprint(root), edited, 'Even an empty new module changes build inputs');
    await rm(added);
    assert.equal(await developmentInputFingerprint(root), edited);
    await writeFile(path.join(root, 'tsconfig.debug.json'), '{}');
    assert.notEqual(await developmentInputFingerprint(root), edited, 'Debug configuration also invalidates the build');
  } finally { await rm(root, { recursive: true, force: true }); }
});
