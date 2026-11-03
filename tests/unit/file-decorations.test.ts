import test from 'node:test';
import assert from 'node:assert/strict';
import { explorerFiles, fileDecoration, gitStatusLetter, layerOwnership } from '../../src/desktop/renderer/file-decorations.js';
import type { RepoSnapshot } from '../../src/desktop/shared.js';

test('Explorer: arquivo limpo não recebe mudança Git ou badge de base; Layer tem nome no tooltip', () => {
  assert.deepEqual(fileDecoration('main.ts', undefined), { git: '', title: 'Git: sem alterações.', bufferDirty: false });
  assert.equal(layerOwnership('base'), null);
  assert.equal(layerOwnership(null), null);
  assert.equal(layerOwnership('scripts'), 'layer/scripts');
  assert.equal(layerOwnership('feature/tools'), 'layer/feature/tools');
});

test('Explorer: badges refletem Git real e distinguem staging, disco, novos e buffer não salvo', () => {
  const status: RepoSnapshot['status'] = { base: { staged: [{ path: 'both.ts', status: 'A' }, { path: 'staged.ts', status: 'M' }, { path: 'conflict.ts', status: 'U' }], unstaged: [{ path: 'both.ts', status: 'M' }, { path: 'disk.ts', status: 'M' }, { path: 'conflict.ts', status: 'M' }] }, layers: [{ name: 'ai', staged: [], unstaged: [{ path: 'removed.ts', status: 'D' }] }], untracked: ['new.ts'] };
  assert.equal(fileDecoration('disk.ts', status).git, 'M');
  assert.match(fileDecoration('disk.ts', status).title, /No disco: Modificado/u);
  assert.equal(fileDecoration('staged.ts', status).git, 'M');
  assert.match(fileDecoration('staged.ts', status).title, /Preparado: Modificado/u);
  assert.equal(fileDecoration('both.ts', status).git, 'M');
  assert.match(fileDecoration('both.ts', status).title, /Há alterações no staging e no disco/u);
  assert.equal(fileDecoration('new.ts', status).git, 'U');
  assert.equal(fileDecoration('conflict.ts', status).git, '!');
  assert.equal(gitStatusLetter('R100'), 'R');
  assert.equal(gitStatusLetter('C100'), 'C');
  assert.equal(gitStatusLetter('T'), 'T');
  assert.equal(fileDecoration('removed.ts', status).git, 'D');
  assert.equal(fileDecoration('clean.ts', status, true).git, '');
  assert.equal(fileDecoration('clean.ts', status, true).bufferDirty, true);
  assert.match(fileDecoration('clean.ts', status, true).title, /Não salvo no editor/u);
  assert.equal(fileDecoration('disk.ts', status, true).git, 'M');
});

test('Explorer: deletados ausentes do disco permanecem na árvore com proprietário e estado corretos', () => {
  const workspace = { files: [{ path: 'clean.ts', owner: 'base' }], status: { base: { staged: [{ path: 'base-deleted.ts', status: 'D' }], unstaged: [] }, layers: [{ name: 'ai', staged: [], unstaged: [{ path: 'layer-deleted.ts', status: 'D' }] }], untracked: ['new.ts'] } };
  const files = explorerFiles(workspace);
  assert.deepEqual(files, [{ path: 'clean.ts', owner: 'base' }, { path: 'base-deleted.ts', owner: 'base' }, { path: 'layer-deleted.ts', owner: 'ai' }, { path: 'new.ts', owner: null }]);
  assert.equal(fileDecoration('layer-deleted.ts', workspace.status).git, 'D');
  assert.equal(layerOwnership(files.find(file => file.path === 'layer-deleted.ts')?.owner), 'layer/ai');
  assert.equal(workspace.files.length, 1, 'A decoração não altera o snapshot original.');
});
