import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStartupArgs, queryVectors, summarizeStartup } from '../../scripts/benchmark-git-startup.mjs';

test('Git startup benchmark controls reject malformed invocation without running Git', () => {
  assert.deepEqual(parseStartupArgs(['--help']), { help: true });
  for (const args of [[], ['--wrapper', 'relative'], ['--unknown', 'value'], ['--no-home', '--no-home'], ['--wrapper', 'one', '--wrapper', 'two']]) assert.throws(() => parseStartupArgs(args));
  assert.deepEqual(queryVectors.map(vector => vector.name), ['version', 'exec-path', 'config', 'identity', 'discover', 'status', 'refs']);
  assert(queryVectors.every(vector => !['add', 'commit', 'update-ref', 'switch', 'reset'].includes(vector.argv[0])));
});

test('Git startup benchmark compares three paired samples without inventing p95 or accepting divergent output', () => {
  const records = [];
  for (const vector of queryVectors) for (let sample = 1; sample <= 3; sample++) for (const executableRole of ['wrapper', 'direct']) records.push({ phase: 'measured', mode: 'home', query: vector.name, sample, executableRole, exitCode: 0, signal: null, timedOut: false, error: null, durationMs: (executableRole === 'wrapper' ? 100 : 80) + sample, rawStdoutSha256: 'same', rawStderrSha256: 'same' });
  const result = summarizeStartup(records);
  assert.equal(result.length, 7); assert(result.every(row => row.comparable && row.wrapperMedianMs === 102 && row.directMedianMs === 82 && row.p95Ms === null));
  assert.deepEqual(result[0].pairedDirectMinusWrapperMs, [-20, -20, -20]);
  records[0].rawStdoutSha256 = 'changed'; assert.equal(summarizeStartup(records)[0].comparable, false);
  records[0].exitCode = 1; assert.equal(summarizeStartup(records)[0].reason, 'Missing or unsuccessful measured process; no latency claim.');
});
