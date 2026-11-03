import fs from 'node:fs';
import path from 'node:path';
import { project } from '../../../scripts/git-compat/lib.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCases, loadMatrix, loadRuntimeExpectations } from '../../../scripts/git-compat/registry.mjs';
import { parseArgs, selectCases, baseResult } from '../../../scripts/git-compat/runner.mjs';
import { resolveReportPhase, phaseReportText } from '../../../scripts/git-compat/report-phase.mjs';
import { recipe } from '../cases/product-extra.mjs';

const revision = 'closure-2026-11-02-r2';
test('R01 current runtime contracts bind executable cases while preserving the complete historical catalog', async () => {
  const document = loadRuntimeExpectations(), matrix = loadMatrix(), cases = await loadCases();
  const original = JSON.parse(fs.readFileSync(path.join(project, 'docs/git-compat/reference/03-Cenarios-Git-Layers-v2.json'), 'utf8')).scenarios;
  assert.equal(original.length, 344);
  assert.ok(original.every(s => matrix.some(current => current.id === s.id)));
  const currentKeys = new Set(cases.map(c => c.id + '/' + c.variant));
  assert.ok(document.catalog_before.implemented_variant_keys.every(key => currentKeys.has(key)), 'new recipes may extend the matrix; no original executable key may disappear');
  assert.equal(document.policy.no_group_disabled, true);
  const prior = JSON.parse(fs.readFileSync(path.join(project, 'tests/git-compat/expectations-closure-2026-11-02-r1.json'), 'utf8'));
  assert.equal(prior.revision, 'closure-2026-11-02-r1');
  assert.ok(prior.contracts.every(contract => document.contracts.some(current => current.module === contract.module && current.id === contract.id && current.variant === contract.variant)));
  for (const module of ['native-optional', 'recovery-observed', 'harness-extra', 'revision']) assert.ok(document.contracts.some(contract => contract.module === module));
  assert.ok(document.contracts.length > 80);
  for (const contract of document.contracts) {
    const item = cases.find(c => c.module === contract.module && c.id === contract.id && c.variant === contract.variant);
    assert.ok(item, 'binding must resolve to an actual executable recipe');
    assert.equal(item.expectation.revision, revision);
    assert.equal(item.expectation.predecessor_recipe_sha256, contract.predecessor_recipe_sha256);
    const result = baseResult(matrix.find(s => s.id === item.id), item, { id: 'infra', seed: 'fixture', sourceFingerprint: 'source', runnerFingerprint: 'runner' });
    assert.equal(result.execution_status, 'NOT_RUN');
    assert.equal(result.product_status, 'NOT_ASSESSED');
    assert.ok(result.limits.some(limit => limit.includes(revision)));
  }
  const broad = selectCases(cases, matrix, parseArgs(['--suite', 'broad']));
  assert.ok(broad.length > 300, 'broad selection must retain native, product, recovery and generated groups');
  for (const name of ['product', 'product-extra', 'additional', 'recovery-observed', 'recovery-interleaved', 'native', 'native-advanced']) assert.ok(broad.some(c => c.module === name), name);
  for (const id of ['COMMIT-014', 'LAYER-010', 'LAYER-015', 'LAYER-016', 'RECOVERY-009', 'MODEL-003', 'MODEL-006', 'MODEL-007', 'MODEL-009', 'LAYOUT-012']) assert.ok(broad.some(c => c.id === id), id);
});

test('R01 generated current contracts remain deterministic and valid across discard/recommit boundaries', () => {
  for (const external of [false, true]) for (let seed = 0; seed < 256; seed++) {
    const steps = recipe('closure-' + seed, external);
    assert.deepEqual(steps, recipe('closure-' + seed, external));
    let active = true, committed = 'initial Layer\n', staged = committed, disk = committed;
    for (const step of steps) {
      if (!active) assert.ok(['on', 'recover'].includes(step.type));
      if (step.type === 'edit') disk = step.bytes;
      if (step.type === 'stage') staged = disk;
      if (step.type === 'restore') disk = staged;
      if (step.type === 'unstage') staged = committed;
      if (step.type === 'commit') { assert.notEqual(staged, committed, 'current recipe must not commit discarded staging'); committed = staged; }
      if (step.type === 'off') { active = false; staged = committed; disk = committed; }
      if (step.type === 'on') { assert.equal(active, false); active = true; }
    }
    assert.equal(active, true);
  }
});

test('R01 reporter identifies current executable expectations without reclassifying execution or historical runs', () => {
  const selected = { selection_status: 'SELECTED', execution_status: 'FAIL', product_status: 'TEST_GAP', limits: ['Executable expectation closure-2026-11-02-r2: product:COMMIT-014/native-add-then-native-commit; version file'], reproduction: { fixture_recipe_path: 'source/tests/git-compat/cases/product.mjs' } };
  const before = structuredClone(selected), phase = resolveReportPhase({}, [selected]);
  assert.equal(phase.id, 'closure-2026-11-02');
  assert.equal(phase.source, 'selected-versioned-runtime-contract');
  assert.equal(phase.implementation, true);
  assert.ok(phaseReportText(phase).scope.includes('Fechamento e sincronização'));
  assert.deepEqual(selected, before);
  assert.throws(() => resolveReportPhase({ phase: 'legacy-validation-v2' }, [selected]), /conflicts/);
  assert.equal(resolveReportPhase({ phase: 'closure-2026-11-02' }, []).id, 'closure-2026-11-02');
  assert.equal(resolveReportPhase({}, []).id, 'legacy-validation-v2');
  const unselected = { ...selected, selection_status: 'NOT_SELECTED' };
  assert.equal(resolveReportPhase({}, [unselected]).id, 'legacy-validation-v2');
});
