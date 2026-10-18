import { setTimeout } from 'node:timers/promises';

/** Poll in Node: the installed Playwright's browser predicate treats a Promise
 * as truthy, so waitForFunction(async ...) can return before the condition. */
export async function waitUntil(check, { timeout = 30000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  do {
    const value = await check();
    if (value) return value;
    await setTimeout(interval);
  } while (Date.now() < deadline);
  throw new Error(`Asynchronous condition did not become true within ${timeout} ms`);
}

export function waitForAsync(page, predicate, arg, options) {
  return waitUntil(() => page.evaluate(predicate, arg), options);
}
