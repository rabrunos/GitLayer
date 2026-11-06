import test from 'node:test';
import assert from 'node:assert/strict';
import { locateCheckpoint } from '../helpers/checkpoint-location.mjs';
const remove = { method: 'remove', line: /^\s*await [\w$]+\.unlink\(file\);\s*$/, before: [/this\.track\(file\)/, /sameFingerprint\(planned,/] };
const source = binding => [
  '  async other(file) {', '    await fs0.unlink(file);', '  }',
  '  async remove(file, expected) {', '    await this.track(file);', '    if (!sameFingerprint(planned, current)) throw Error();', '    await ' + binding + '.unlink(file);', '    await this.after(file);', '  }',
];
test('Inspector locator ignores matching lines in other methods and accepts variable generated filesystem bindings', () => {
  for (const binding of ['fs', 'fs2', 'fs7', 'fs123']) {
    const location=locateCheckpoint(source(binding),remove);assert.equal(location.lineNumber,6);assert.equal(location.methodStart,3);assert.equal(location.methodEnd,8);
  }
});
test('Inspector locator refuses missing, duplicated, unclosed or ambiguous methods before any child can start', () => {
  const original=source('fs7');
  for (const changed of [original.slice(0,3), [...original,...original.slice(3)], original.slice(0,-1), [...original.slice(0,7),original[6],...original.slice(7)], original.filter(line=>!line.includes('this.track'))]) assert.throws(()=>locateCheckpoint(changed,remove),assert.AssertionError);
});
test('Inspector commit checkpoint requires durable journal then publication barrier before the unique assignment', () => {
  const locator={method:'commit',line:/^\s*[\w$]+\.oid = [\w$]+;\s*$/,before:[/\.record\("commit-ref-updated"/,/failpoint\("after-commit-ref"/]};
  const lines=['  async guard() {','    l.oid = oid2;','  }','  async commit(name, msg) {','    await this.tx.record("commit-ref-updated", {oid:next});','    failpoint("after-commit-ref");','    layer.oid = next;','  }','  async baseCommit(msg) {','    l.oid = oid2;','  }'];
  assert.equal(locateCheckpoint(lines,locator).lineNumber,6);
  const reversed=[...lines];[reversed[4],reversed[5]]=[reversed[5],reversed[4]];assert.throws(()=>locateCheckpoint(reversed,locator),assert.AssertionError);
});


test('Inspector prepared checkpoint retains all three ordered predecessors across the 13-line transaction setup', () => {
  const locator = { method: 'mutateLocked', line: /^\s*if \(options\.reconcile !== false\) await this\.syncEditingInternal\(\);\s*$/, before: [/this\.tx = await Transaction\.begin\(/, /this\.tx\.data\.recovery = /, /await this\.tx\.record\("prepared"\)/], lookback: 16 };
  const lines = [
    '  async other(options) {',
    '    this.tx = await Transaction.begin(this.dir, kind, metadata);',
    '    this.tx.data.recovery = {};',
    '    await this.tx.record("prepared");',
    '    if (options.reconcile !== false) await this.syncEditingInternal();',
    '  }',
    '  async mutateLocked(kind, fn, options = {}) {',
    '    this.tx = await Transaction.begin(this.dir, kind, metadata);',
    '    this.recoveryFiles = [];',
    '    this.recoveryFileMap.clear();',
    '    this.tx.data.recovery = {files:this.recoveryFiles};',
    '    if (options.revokedAcknowledgements?.length) {',
    '      const previous = [], revoked = [];',
    '      if (revoked.length) throw Error();',
    '      this.tx.data.recovery.acknowledgements = {revoked,pending:[]};',
    '      await this.track(workspaceFile);',
    '    }',
    '    await this.tx.record("prepared");',
    '    try {',
    '      this.transactionTrees = new Map();',
    '      if (options.reconcile !== false) await this.syncEditingInternal();',
    '      return await fn();',
    '    } finally {}',
    '  }',
  ];
  const location = locateCheckpoint(lines, locator);
  assert.equal(location.lineNumber, 20); assert.equal(location.methodStart, 6);
  assert.equal(location.lineNumber - 7, 13);
  assert.deepEqual(location.orderedPredecessors, locator.before.map(pattern => pattern.source));
  assert.throws(() => locateCheckpoint(lines, { ...locator, lookback: 12 }), assert.AssertionError);
  for (const missing of [7, 10, 17]) assert.throws(() => locateCheckpoint(lines.filter((_, n) => n !== missing), locator), assert.AssertionError);
  const reversed = [...lines]; [reversed[10], reversed[17]] = [reversed[17], reversed[10]];
  assert.throws(() => locateCheckpoint(reversed, locator), assert.AssertionError);
  const duplicate = [...lines]; duplicate.splice(21, 0, lines[20]);
  assert.throws(() => locateCheckpoint(duplicate, locator), assert.AssertionError);
});
