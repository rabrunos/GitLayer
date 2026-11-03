import assert from 'node:assert/strict';

// The inspector observes esbuild's formatted, unmodified bundle. Refuse a
// changed/ambiguous shape before starting a child; never fall back globally.
export function locateCheckpoint(lines, { method, line, before = [], lookback = 6 }) {
  assert.ok(Array.isArray(lines) && lines.every(value => typeof value === 'string'));
  assert.match(method, /^[A-Za-z_$][\w$]*$/);
  assert.ok(line instanceof RegExp && !line.global && !line.sticky);
  assert.ok(before.every(pattern => pattern instanceof RegExp && !pattern.global && !pattern.sticky));
  assert.ok(Number.isSafeInteger(lookback) && lookback > 0 && lookback <= 20);
  const headers = lines.flatMap((value, n) => {
    const match = value.match(/^(\s*)async ([A-Za-z_$][\w$]*)\([^\n]*\) \{$/);
    return match?.[2] === method ? [{ n, indent: match[1] }] : [];
  });
  assert.equal(headers.length, 1, 'Unique checkpoint method boundary');
  const { n: start, indent } = headers[0];
  const end = lines.findIndex((value, n) => n > start && value === indent + '}');
  assert.ok(end > start, 'Exact checkpoint method closing boundary');
  const matches = lines.flatMap((value, n) => n > start && n < end && line.test(value) ? [n] : []);
  assert.equal(matches.length, 1, 'Unique executable checkpoint within method');
  const lineNumber = matches[0];
  let prior = Math.max(start, lineNumber - lookback) - 1;
  for (const pattern of before) {
    const candidates = lines.flatMap((value, n) => n > prior && n < lineNumber && pattern.test(value) ? [n] : []);
    assert.equal(candidates.length, 1, 'Unique ordered checkpoint predecessor ' + pattern.source);
    prior = candidates[0];
  }
  return { lineNumber, method, methodStart: start, methodEnd: end, linePattern: line.source, orderedPredecessors: before.map(pattern => pattern.source), lookback };
}
