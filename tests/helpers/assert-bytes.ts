import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Compare every byte without handing large buffers to Node's assertion diff. */
export function assertBytesEqual(actual: Buffer, expected: Buffer, label = 'Byte content'): void {
  assert.equal(Buffer.isBuffer(actual), true, 'assertBytesEqual actual must be a Buffer');
  assert.equal(Buffer.isBuffer(expected), true, 'assertBytesEqual expected must be a Buffer');
  if (actual.equals(expected)) return;
  let firstDifferingOffset = 0;
  const commonLength = Math.min(actual.length, expected.length);
  while (firstDifferingOffset < commonLength && actual[firstDifferingOffset] === expected[firstDifferingOffset]) firstDifferingOffset++;
  const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const details = {
    actualLength: actual.length, expectedLength: expected.length,
    actualSha256: sha256(actual), expectedSha256: sha256(expected), firstDifferingOffset,
  };
  // Keep actual/expected booleans: even a custom deepStrictEqual message still
  // invokes Node24's unbounded Buffer inspection/Myers diff on failure.
  assert.equal(false, true, String(label).slice(0, 160) + ': byte mismatch ' + JSON.stringify(details));
}
