import test from 'node:test';
import assert from 'node:assert/strict';
import { explorerRows, explorerTree } from '../../src/desktop/renderer/explorer-tree.js';

test('Explorer groups real siblings, folders first, with natural file ordering', () => {
  const files = [
    { path: 'a.txt', owner: 'base' },
    { path: 'z/file10.ts', owner: 'ai' },
    { path: 'z/file2.ts', owner: 'base' },
    { path: 'z/nested/file.ts', owner: 'scripts' },
  ];
  const tree = explorerTree(files, ['empty', 'z', 'z/nested']);
  assert.deepEqual(tree.map(node => node.path), ['empty', 'z', 'a.txt']);
  assert.deepEqual(tree[1]!.children.map(node => node.name), ['nested', 'file2.ts', 'file10.ts']);
  assert.deepEqual(tree[1]!.layers.sort(), ['ai', 'scripts']);
  assert.deepEqual(explorerRows(tree, new Set(), false).map(row => row.node.path), ['empty', 'z', 'a.txt']);
  assert.deepEqual(explorerRows(tree, new Set(['z']), false).map(row => row.node.path), ['empty', 'z', 'z/nested', 'z/file2.ts', 'z/file10.ts', 'a.txt']);
  assert.equal(files[1]!.path, 'z/file10.ts', 'Presentation never mutates the snapshot or ownership');
});

test('Explorer compacts only folder chains and retains empty and deleted paths', () => {
  const tree = explorerTree([{ path: 'docs/guides/start.md', owner: 'base' }, { path: 'removed/deleted.ts', owner: 'ai' }], ['empty/deep']);
  const rows = explorerRows(tree, new Set(['docs/guides', 'removed']), true);
  assert.deepEqual(rows.map(row => [row.chain.map(node => node.name).join('/'), row.depth, row.parent]), [
    ['docs/guides', 1, ''], ['start.md', 2, 'docs/guides'], ['empty/deep', 1, ''], ['removed', 1, ''], ['deleted.ts', 2, 'removed'],
  ]);
  assert.deepEqual(rows.at(-1)!.node.layers, ['ai']);
  assert.equal(explorerRows(tree, new Set(), false)[0]!.node.path, 'docs');
});

test('Explorer renders a directory once when it replaces a deleted tracked file', () => {
  const tree = explorerTree([{ path: 'replaced', owner: 'base' }, { path: 'replaced/new.ts', owner: null }], ['replaced']);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]!.directory, true);
  assert.equal(tree[0]!.children[0]!.path, 'replaced/new.ts');
});
