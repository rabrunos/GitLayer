import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { cleanupFixture, createFixture } from '../../scripts/git-compat/lib.mjs';

function boundedFailure(actual: Buffer, expected: Buffer, firstDifferingOffset: number, label = 'fixture bytes') {
  assert.throws(() => assertBytesEqual(actual, expected, label), (error: unknown) => {
    assert(error instanceof assert.AssertionError);
    assert.equal(typeof error.actual, 'boolean'); assert.equal(typeof error.expected, 'boolean');
    assert.equal(error.actual, false); assert.equal(error.expected, true);
    assert.equal(error.operator, 'strictEqual'); assert(error.message.length < 768);
    const start = error.message.indexOf('{"actualLength":'), end = error.message.indexOf('}', start) + 1;
    assert(start >= 0 && end > start && end - start <= 512, 'Bounded diagnostic JSON must be delimited before the boolean diff');
    const details = JSON.parse(error.message.slice(start, end));
    assert.equal(details.actualLength, actual.length); assert.equal(details.expectedLength, expected.length);
    assert.equal(details.firstDifferingOffset, firstDifferingOffset);
    assert.match(details.actualSha256, /^[a-f0-9]{64}$/u); assert.match(details.expectedSha256, /^[a-f0-9]{64}$/u);
    assert.notEqual(details.actualSha256, details.expectedSha256);
    assert.equal(Object.values(error).some(value => Buffer.isBuffer(value)), false);
    return true;
  });
}

test('bounded byte assertion compares separate equal buffers and empty buffers exactly', () => {
  const expected = Buffer.from([0, 255, 3, 0, 19]), actual = Buffer.from(expected);
  assert.notEqual(actual, expected); assertBytesEqual(actual, expected); assertBytesEqual(Buffer.alloc(0), Buffer.alloc(0));
});

for (const [name, actual, expected, offset] of [
  ['length', Buffer.from([1, 2]), Buffer.from([1, 2, 3]), 2],
  ['front', Buffer.from([9, 2, 3, 4, 5]), Buffer.from([1, 2, 3, 4, 5]), 0],
  ['middle', Buffer.from([1, 2, 9, 4, 5]), Buffer.from([1, 2, 3, 4, 5]), 2],
  ['end', Buffer.from([1, 2, 3, 4, 9]), Buffer.from([1, 2, 3, 4, 5]), 4],
] as const) test('bounded byte assertion diagnoses ' + name + ' without attaching buffers', () => {
  boundedFailure(actual, expected, offset, 'synthetic label '.repeat(100));
});

test('byte assertion failures keep diagnostics and observed RSS bounded in an owned heap-limited child', { timeout: 45000 }, t => {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-assert-bytes-unit');
  t.after(() => cleanupFixture(owned));
  const home = path.join(owned.root, 'home'), temporary = path.join(owned.root, 'temp');
  fs.mkdirSync(home); fs.mkdirSync(temporary);
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT']) {
    const source = Object.keys(process.env).find(name => name.toLowerCase() === key.toLowerCase());
    if (source && process.env[source]) env[key] = process.env[source];
  }
  Object.assign(env, { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, 'xdg'), APPDATA: path.join(home, 'appdata'), LOCALAPPDATA: path.join(home, 'local'), TEMP: temporary, TMP: temporary, TMPDIR: temporary, PATH: path.dirname(process.execPath), NO_COLOR: '1' });
  const childScript = `
    import assert from 'node:assert/strict';
    const { assertBytesEqual } = await import(process.argv[1]);
    global.gc(); const baseline = process.memoryUsage(), rows = [];
    for (const size of [256, 144 * 1024, 1024 * 1024]) {
      const expected = Buffer.alloc(size, 0x11), actual = Buffer.from(expected);
      if (size === 256) actual.fill(0xee); else actual[Math.floor(size / 2)] ^= 0xff;
      let caught;
      try { assertBytesEqual(actual, expected, 'owned child'); } catch (error) { caught = error; }
      assert(caught instanceof assert.AssertionError);
      assert.equal(typeof caught.actual, 'boolean'); assert.equal(typeof caught.expected, 'boolean');
      assert.equal(caught.actual, false); assert.equal(caught.expected, true); assert(caught.message.length < 768);
      assert.equal(Object.values(caught).some(value => Buffer.isBuffer(value)), false);
      rows.push({ bytes: size, difference: size === 256 ? 'many bytes' : 'one middle byte', messageLength: caught.message.length, actual: caught.actual, expected: caught.expected });
    }
    const after = process.memoryUsage(), maxRssBytes = process.resourceUsage().maxRSS * 1024;
    const rssDelta = Math.max(0, maxRssBytes - baseline.rss);
    assert(rssDelta < 64 * 1024 * 1024, 'Bounded byte assertions exceeded 64 MiB RSS growth: ' + rssDelta);
    assert(maxRssBytes < 384 * 1024 * 1024, 'Owned child exceeded 384 MiB RSS: ' + maxRssBytes);
    process.stdout.write(JSON.stringify({ rows, baselineRssBytes: baseline.rss, afterRssBytes: after.rss, maxRssBytes, rssDelta }));
  `;
  // Native type stripping loads this erasable helper without a compiler child.
  // Heap96MiB does not cap external/ArrayBuffer allocations. Large inputs have
  // one changed byte so a formatter regression cannot create a huge edit trace;
  // the many-byte mismatch uses only256B. RSS is an observed assertion budget.
  // No Git, shell, inherited NODE_OPTIONS or legacy Buffer formatter is invoked.
  const child = cp.spawnSync(process.execPath, ['--max-old-space-size=96', '--expose-gc', '--experimental-strip-types', '--input-type=module', '-e', childScript, pathToFileURL(path.resolve(import.meta.dirname, '../helpers/assert-bytes.ts')).href], {
    cwd: owned.root, env, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 64 * 1024,
  });
  assert.equal(child.status, 0, String(child.error?.message ?? child.stderr).slice(0, 2048));
  const observed = JSON.parse(child.stdout); assert.equal(observed.rows.length, 3);
  assert.deepEqual(observed.rows.map((row: { bytes: number }) => row.bytes), [256, 144 * 1024, 1024 * 1024]);
  t.diagnostic(JSON.stringify({ kind: 'bounded-byte-assertion-child', ...observed }));
});
