import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCases, loadMatrix } from '../../../scripts/git-compat/registry.mjs';
import { cleanupFixture, context, createFixture, isolatedEnvironment, resolveGit } from '../../../scripts/git-compat/lib.mjs';

test('implementation matrix keeps every original ID and selected MODEL coverage explicitly non-exhaustive', async () => {
  const original = JSON.parse(fs.readFileSync('docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json', 'utf8')).scenarios;
  const document = JSON.parse(fs.readFileSync('tests/git-compat/scenarios.json', 'utf8'));
  const matrix = loadMatrix(), cases = await loadCases(['implementation'], { matrix });
  assert.equal(original.length, 344);
  assert.ok(original.every(scenario => matrix.some(current => current.id === scenario.id)));
  assert.equal(document.scenario_count, matrix.length);
  assert.equal(matrix.filter(scenario => scenario.family === 'IMPL').length, 11);
  assert.ok(cases.length >= 15, 'current cases may extend the fifteen historical implementation variants');
  assert.ok(cases.some(item => item.variant === 'interactive-newcomer-preview-cancel-confirm' && item.capabilities.includes('win32')));
  assert.equal(cases.filter(item => item.id === 'MODEL-008').length, 4);
  assert.equal(matrix.find(item => item.id === 'MODEL-008').implementation_2026_11_02.not_exhaustive, true);
});

test('headless snapshot inventories new layers and retained legacy separately without calling product', async t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'git-layer-snapshot-infra-'));
  const fixture = createFixture(parent, 'owned');
  t.after(() => { cleanupFixture(fixture); fs.rmdirSync(parent); });
  const gitPath = resolveGit(), artifacts = path.join(fixture.root, 'artifacts');
  const c = context({ root: fixture.root, repo: path.join(fixture.root, 'repo'), gitPath, buildDir: path.join(fixture.root, 'build-unused'), artifactDir: artifacts, packageRoot: fixture.root, env: isolatedEnvironment(fixture.root, gitPath) });
  await c.init();
  c.write('.git/layers/registry.json', '{"schema":1,"fixture":"new-layout"}\n');
  c.write('.git/git-layers/registry.json', '{"schema":1,"fixture":"retained"}\n');
  c.write('.git/other-internal-private', 'outside the metadata snapshot');
  const snapshot = await c.snapshot('two-layouts');
  assert.deepEqual(snapshot.metadata.map(entry => entry.path).sort(), ['.git/git-layers/registry.json', '.git/layers/registry.json']);
  assert.ok(snapshot.files.every(entry => !entry.path.startsWith('.git/')));
  assert.equal(snapshot.repository, undefined);
});
