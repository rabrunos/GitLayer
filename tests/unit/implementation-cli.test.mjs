import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = resolve(root, 'src/cli/index.ts');
// This path is never created. Usage rejection must not require metadata/Git IO.
const absentRepository = join(tmpdir(), 'git-layer-absent-' + randomUUID());
function run(args) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', cli, '--cwd', absentRepository, ...args], {
    cwd: root, encoding: 'utf8', timeout: 15_000, shell: false,
    maxBuffer: 1024 * 1024, windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}
function usage(args, expected) {
  const result = run([...args, '--json']);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stdout, '');
  const data = JSON.parse(result.stderr);
  assert.equal(data.ok, false);
  assert.equal(data.error.code, 'CLI_USAGE');
  assert.match(data.error.message, expected);
}

test('implementation CLI help exposes terminal-only product commands and explicit discard', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  for (const command of ['edit <nome>', 'edit-end', 'rename <nome>', 'remove <nome>', 'preview <on|off|remove>', 'open-branch <nome>', 'migrate --yes', 'protect', 'unprotect']) assert(result.stdout.includes(command), command);
  assert.match(result.stdout, /off <nome> \[--discard --yes\]/);
  assert.doesNotMatch(result.stdout, /off <nome>[^\n]*--park/);
});
test('implementation CLI refuses removed auto-park before opening repository', () => {
  usage(['off', 'a', '--park'], /GL-16.*commit.*--discard --yes/);
});
test('implementation CLI confirmation alone never authorizes deactivation discard', () => {
  usage(['off', 'a', '--yes'], /--yes.*exige --discard/);
});
test('implementation CLI migration requires explicit confirmation before metadata access', () => {
  usage(['migrate'], /migrate exige --yes.*preserva a origem/);
});
test('implementation CLI rejects discard on unrelated commands and stray path lists', () => {
  usage(['on', 'a', '--discard'], /--discard.*não é válida/);
  const result = run(['edit-end', '--json', '--', 'unexpected.txt']);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stderr).error.code, 'CLI_USAGE');
});
