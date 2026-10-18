import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoCollisions, validatePath } from '../../src/core/paths.js';

test('portable relative paths preserve spaces, accents and literal pattern characters', () => {
  for (const file of ['README.md', 'src/app.ts', 'espaço/ação.txt', '.codex/config.toml', '-flag.txt', '#hash.txt', '!important.txt', 'file[1].txt']) {
    assert.equal(validatePath(file), file);
  }
});

test('absolute paths, empty components and traversal are refused', () => {
  for (const file of ['', '/', '/tmp/file', 'C:/file', 'C:\\file', '\\\\server\\share', '../secret', 'a/../secret', './a', 'a//b', 'a/', 'a\\b']) {
    assert.throws(() => validatePath(file), undefined, file);
  }
});

test('Git internals and aliases are protected at every depth and case', () => {
  for (const file of ['.git', '.git/config', 'nested/.GIT/HEAD', 'git~1/config', '.git~1/config', 'nested/．ｇｉｔ/config']) {
    assert.throws(() => validatePath(file), undefined, file);
  }
});

test('Windows reserved names, trailing spaces and trailing dots are refused', () => {
  for (const file of ['CON', 'con.txt', 'PRN', 'NUL.bin', 'AUX', 'COM1.log', 'LPT9', 'nested/COM¹.txt', 'file.', 'file ', 'dir./file', 'dir /file']) {
    assert.throws(() => validatePath(file), undefined, file);
  }
});

test('controls, bidirectional markers and nonportable punctuation are refused', () => {
  for (const file of ['a\0b', 'a\nb', 'a\rb', 'a\tb', 'a\u007fb', 'a\u202eb', 'a\u200bb', 'a:b', 'a*b', 'a?b', 'a|b', 'a<b', 'a>b', 'a"b']) {
    assert.throws(() => validatePath(file), undefined, JSON.stringify(file));
  }
});

test('noncanonical Unicode spelling is refused instead of silently renamed', () => {
  assert.equal(validatePath('ação.txt'), 'ação.txt');
  assert.throws(() => validatePath('ação.txt'));
});

test('path and component lengths have explicit upper bounds', () => {
  assert.throws(() => validatePath(`${'a'.repeat(241)}.txt`));
  assert.throws(() => validatePath(Array.from({ length: 30 }, () => 'a'.repeat(150)).join('/')));
});

test('equal paths from two owners collide even when they could contain identical bytes', () => {
  assert.throws(() => assertNoCollisions([{ path: 'same.txt', owner: 'base' }, { path: 'same.txt', owner: 'ai' }]));
});

test('file versus directory conflicts are checked by path components', () => {
  assert.throws(() => assertNoCollisions([{ path: 'tools', owner: 'base' }, { path: 'tools/analyze.py', owner: 'scripts' }]));
  assert.doesNotThrow(() => assertNoCollisions([{ path: 'tool', owner: 'base' }, { path: 'tools/analyze.py', owner: 'scripts' }]));
});

test('case and Unicode compatibility aliases cannot have separate owners', () => {
  for (const [a, b] of [['Readme.md', 'README.md'], ['Å.txt', 'å.txt'], ['Ａ.txt', 'A.txt'], ['straße.txt', 'strasse.txt']]) {
    assert.throws(() => assertNoCollisions([{ path: a!, owner: 'base' }, { path: b!, owner: 'ai' }]));
  }
});

test('directory case aliases collide with an ancestor file', () => {
  assert.throws(() => assertNoCollisions([{ path: 'TOOLS', owner: 'base' }, { path: 'tools/analyze.py', owner: 'scripts' }]));
});

test('shared directories and duplicate representations of one owned path are allowed', () => {
  assert.doesNotThrow(() => assertNoCollisions([
    { path: 'shared/base.txt', owner: 'base' },
    { path: 'shared/ai.txt', owner: 'ai' },
    { path: 'shared/scripts.py', owner: 'scripts' },
    { path: 'shared/ai.txt', owner: 'ai' },
  ]));
});
