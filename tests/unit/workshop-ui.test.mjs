import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runWorkshopUi } from '../../scripts/workshop-ui.mjs';

test('workshop UI: falha real antes da janela produz código não zero e logs novos', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lab-ui-runner-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    await mkdir(path.join(root, '.workshop', 'reports'), { recursive: true });
    await writeFile(path.join(root, '.workshop', 'reports', 'ui-evidence.json'), '{"status":"passed"}\n');
    await writeFile(path.join(root, '.workshop', 'reports', 'ui-desktop.png'), 'old screenshot');
    await writeFile(path.join(root, 'scripts', 'build-debug.mjs'), 'process.stdout.write("build output\\n"); process.stderr.write("build error\\n"); process.exitCode = 7;\n');
    const result = await runWorkshopUi({ root });
    assert.equal(result.exitCode, 7);
    const report = JSON.parse(await readFile(path.join(root, '.workshop', 'reports', 'ui.json'), 'utf8'));
    assert.equal(report.status, 'failed'); assert.equal(report.phase, 'build-debug');
    assert.equal(report.stages.length, 1); assert.equal(report.stages[0].exitCode, 7);
    assert.match(await readFile(path.join(root, '.workshop', 'reports', 'ui.stdout.log'), 'utf8'), /build output/);
    assert.match(await readFile(path.join(root, '.workshop', 'reports', 'ui.stderr.log'), 'utf8'), /build error/);
    await assert.rejects(readFile(path.join(root, '.workshop', 'reports', 'ui-evidence.json')), { code: 'ENOENT' });
    await assert.rejects(readFile(path.join(root, '.workshop', 'reports', 'ui-desktop.png')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }); }
});
