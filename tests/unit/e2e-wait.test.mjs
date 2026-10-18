import test from 'node:test';
import assert from 'node:assert/strict';
import { waitUntil } from '../e2e/wait.mjs';

test('UI polling awaits false asynchronous results instead of approving a truthy Promise', async () => {
  let attempts = 0;
  await waitUntil(async () => { await Promise.resolve(); return ++attempts === 3; }, { interval: 1 });
  assert.equal(attempts, 3);
  await assert.rejects(waitUntil(async () => false, { timeout: 5, interval: 1 }), /did not become true/);
});
