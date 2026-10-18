import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePath } from '../../src/core/paths.js';
import { comparableFileMode, DISABLED_GIT_HOOKS, gitExecutableCandidates, gitPath, normalizeProcessEnvironment, workspaceInputPath } from '../../src/core/platform.js';

test('Windows child environment has exactly one case-insensitive value per key', () => {
  const source = { Path: 'C:\\second', PATH: 'C:\\first', SystemRoot: 'C:\\Windows', git_dir: 'wrong', UNUSED: undefined };
  assert.deepEqual(normalizeProcessEnvironment(source, 'win32'), { GIT_DIR: 'wrong', PATH: 'C:\\first', SYSTEMROOT: 'C:\\Windows' });
  assert.equal(source.Path, 'C:\\second');
  assert.deepEqual(normalizeProcessEnvironment({ PATH: '/one', Path: '/two' }, 'linux'), { PATH: '/one', Path: '/two' });
});

test('Git for Windows discovery accepts quoted PATH and standard system/per-user installations', () => {
  const candidates = gitExecutableCandidates('win32', {
    Path: '"D:\\Tools with spaces\\Git\\cmd";D:\\Other;d:\\other;.;relative;\\root-relative;/root-relative;;',
    ProgramFiles: 'D:\\Program Files', 'ProgramFiles(x86)': 'D:\\Program Files (x86)',
    LocalAppData: 'D:\\Usuários\\ação\\AppData\\Local', SystemDrive: 'D:',
  });
  assert.deepEqual(candidates.slice(0, 2), ['D:\\Tools with spaces\\Git\\cmd\\git.exe', 'D:\\Other\\git.exe']);
  assert.ok(candidates.includes('D:\\Program Files\\Git\\cmd\\git.exe'));
  assert.ok(candidates.includes('D:\\Program Files (x86)\\Git\\cmd\\git.exe'));
  assert.ok(candidates.includes('D:\\Usuários\\ação\\AppData\\Local\\Programs\\Git\\cmd\\git.exe'));
  assert.equal(candidates.filter(candidate => candidate.toLowerCase() === 'd:\\other\\git.exe').length, 1);
  assert.ok(candidates.every(candidate => !candidate.endsWith('.cmd') && /^[A-Za-z]:\\/.test(candidate)));
});

test('executable discovery refuses repository-relative PATH entries and keeps POSIX spelling', () => {
  assert.deepEqual(gitExecutableCandidates('linux', { PATH: ':.:relative:/usr/bin:/bin:/usr/bin' }), ['/usr/bin/git', '/bin/git']);
  assert.deepEqual(gitExecutableCandidates('linux', {}), ['/usr/bin/git', '/bin/git']);
  assert.deepEqual(gitExecutableCandidates('linux', { PATH: '' }), []);
  assert.ok(gitExecutableCandidates('win32', {}).includes('C:\\Program Files\\Git\\cmd\\git.exe'));
  assert.equal(gitExecutableCandidates('win32', { PATH: '\\\\server\\share\\Git\\cmd' })[0], '\\\\server\\share\\Git\\cmd\\git.exe');
});

test('Git absolute paths use forward slashes without changing POSIX literal backslashes', () => {
  assert.equal(gitPath('C:\\Usuários\\ação\\repo', 'win32'), 'C:/Usuários/ação/repo');
  assert.equal(gitPath('\\\\server\\share\\repo', 'win32'), '//server/share/repo');
  assert.equal(gitPath('/tmp/literal\\name', 'linux'), '/tmp/literal\\name');
  assert.equal(DISABLED_GIT_HOOKS, '/dev/null');
});

test('file mode comparison retains POSIX modes and Windows read-only integrity', () => {
  assert.equal(comparableFileMode(0o100755, 'linux'), 0o755);
  assert.equal(comparableFileMode(0o100644, 'linux'), 0o644);
  assert.equal(comparableFileMode(0o100755, 'win32'), 0o666);
  assert.equal(comparableFileMode(0o100666, 'win32'), 0o666);
  assert.equal(comparableFileMode(0o100444, 'win32'), 0o444);
  assert.notEqual(comparableFileMode(0o100666, 'win32'), comparableFileMode(0o100444, 'win32'));
});


test('Windows native user input becomes a portable relative path without normalizing traversal', () => {
  assert.equal(workspaceInputPath('pasta com espaços\\ação.txt', 'win32'), 'pasta com espaços/ação.txt');
  assert.equal(workspaceInputPath('.\\pasta\\ação.txt', 'win32'), 'pasta/ação.txt');
  assert.equal(workspaceInputPath('././pasta/ação.txt', 'win32'), 'pasta/ação.txt');
  assert.equal(workspaceInputPath('.\\', 'win32'), '.');
  assert.equal(workspaceInputPath('./', 'linux'), '.');
  assert.equal(workspaceInputPath('', 'win32'), '');
  assert.equal(workspaceInputPath('pasta\\arquivo.txt', 'linux'), 'pasta\\arquivo.txt');
  for (const input of ['C:\\pasta\\arquivo', '\\\\servidor\\pasta', '..\\segredo', '.\\..\\segredo', 'a\\..\\segredo']) {
    assert.throws(() => validatePath(workspaceInputPath(input, 'win32')), undefined, input);
  }
});
