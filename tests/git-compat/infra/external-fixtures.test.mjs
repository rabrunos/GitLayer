import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createFixture, cleanupFixture, execute, isolatedEnvironment, project, resolveGit, within } from '../../../scripts/git-compat/lib.mjs';
import { externalFixtureParent } from '../../../scripts/git-compat/fixture-parent.mjs';

test('external infrastructure fixtures validate their parent before creation and preserve nonce ownership', t => {
  const parent = externalFixtureParent(project), fixture = createFixture(parent, 'gl-external-control');
  t.after(() => cleanupFixture(fixture));
  assert.equal(within(project, fixture.root), false);
  assert.equal(fs.realpathSync(path.dirname(fixture.root)), parent);
  const marker = JSON.parse(fs.readFileSync(path.join(fixture.root, '.git-compat-owned.json'), 'utf8'));
  assert.equal(marker.nonce, fixture.nonce); assert.equal(marker.parent, parent);
});

test('real matrix runner refuses a Git fixture parent before producing output or domain fixtures', { timeout: 30000 }, async t => {
  const fixture = createFixture(externalFixtureParent(project), 'gl-runner-parent-control');
  t.after(() => cleanupFixture(fixture));
  const git = resolveGit(), env = isolatedEnvironment(fixture.root, git), output = path.join(fixture.root, 'must-not-exist');
  const protectedParent = path.join(fixture.root, 'synthetic-repository'); fs.mkdirSync(protectedParent); fs.writeFileSync(path.join(protectedParent, '.git'), 'gitdir: deliberately-unresolved\n');
  const before = fs.readdirSync(protectedParent);
  const result = await execute(process.execPath, [path.join(project, 'scripts/git-compat/runner.mjs'), '--suite', 'harness', '--id', 'HARNESS-015', '--jobs', '1', '--out', output], {
    cwd: project, env: { ...env, GIT_COMPAT_EXTERNAL_FIXTURE_PARENT: protectedParent }, timeout: 20000,
  });
  assert.equal(result.code, 2, result.stderr); assert.equal(result.timedOut, false);
  assert.equal(JSON.parse(result.stderr).outcome, 'EXISTING_FIXTURE_PARENT_INVALID');
  assert.equal(fs.existsSync(output), false); assert.deepEqual(fs.readdirSync(protectedParent), before);
});
