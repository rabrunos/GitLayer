import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildTerminalArguments, buildTerminalCommand, quoteTerminalArgument, terminalCommands } from '../../src/desktop/commands.js';

test('terminal: catálogo histórico preservado cobre a CLI anterior; novos comandos headless são lacuna explícita do laboratório', () => {
  const source = readFileSync(new URL('../../src/cli/index.ts', import.meta.url), 'utf8');
  const block = source.match(/const COMMAND_FLAGS[\s\S]*?\n\};/u)?.[0];
  assert.ok(block, 'A lista de comandos da CLI precisa continuar auditável.');
  const commands = [...block.matchAll(/(?:^|[,{])\s*(?:'([^']+)'|([a-z]+))\s*:/gu)].map(match => match[1] ?? match[2]);
  const catalog = terminalCommands.map(command => command.id);
  assert.equal(new Set(catalog).size, catalog.length);
  // 2026-11-02 GL23/24: this task explicitly preserves desktop sources.
  // Keep its complete prior catalog invariant and enumerate the exact CLI gap.
  const terminalDeferred = ['edit','edit-end','migrate','open-branch','ownership-review','ownership-resolve','preview','protect','remove','rename','rename-file','unprotect'];
  assert.deepEqual(catalog.toSorted(), ['help', ...commands.filter(command => !terminalDeferred.includes(command!))].toSorted());
  assert.deepEqual(commands.filter(command => !catalog.includes(command!)).toSorted(), terminalDeferred.toSorted());
  for (const command of terminalCommands) assert.ok(command.label && command.description && command.group);
});

test('terminal: caminhos viram argumentos literais depois de -- e campos opcionais não executam nada', () => {
  assert.deepEqual(buildTerminalArguments('status', {}), ['status']);
  assert.deepEqual(buildTerminalArguments('add', { layer: 'ai', paths: 'src/a b.ts\r\n-arquivo\nacentuação.txt', json: true }), ['add', 'ai', '--json', '--', 'src/a b.ts', '-arquivo', 'acentuação.txt']);
  assert.deepEqual(buildTerminalArguments('restore', { owner: 'ai', paths: ['a'] }), ['restore', 'ai', '--', 'a']);
  assert.deepEqual(buildTerminalArguments('restore', { owner: 'ai', yes: true, paths: ['a'] }), ['restore', 'ai', '--yes', '--', 'a']);
  assert.deepEqual(buildTerminalArguments('diff', { owner: 'ai', staged: false }), ['diff', 'ai']);
  assert.equal(terminalCommands.find(command => command.id === 'diff')?.fields[0]?.kind, 'owner');
  assert.equal(terminalCommands.find(command => command.id === 'restore')?.fields[0]?.kind, 'owner');
  assert.deepEqual(buildTerminalArguments('diff', { owner: 'base', staged: true, paths: ['main.ts'] }), ['diff', 'base', '--staged', '--', 'main.ts']);
  assert.deepEqual(buildTerminalArguments('restore', { owner: 'base', paths: ['main.ts'] }), ['restore', 'base', '--', 'main.ts']);
  assert.deepEqual(buildTerminalArguments('capture', { layer: 'scripts' }), ['capture', 'scripts']);
});

test('terminal: valida campos, tipos, controles e staging parcial antes de escrever no PTY', () => {
  assert.throws(() => buildTerminalArguments('merge', {}), /não disponível/u);
  assert.throws(() => buildTerminalArguments('status', { cwd: 'outra-pasta' }), /não permitido/u);
  assert.throws(() => buildTerminalArguments('restore', { owner: 'ai', paths: ['a'], json: true }), /não permitido/u);
  assert.throws(() => buildTerminalArguments('doctor', { fsck: 'true' }), /booleano/u);
  assert.throws(() => buildTerminalArguments('commit', { layer: 'ai', message: '\x1b[2J' }), /controle/u);
  assert.throws(() => buildTerminalArguments('show', { revision: '--json' }), /começar com/u);
  assert.throws(() => buildTerminalArguments('add', { layer: 'ai', paths: [] }), /Preencha/u);
  assert.throws(() => buildTerminalArguments('hunks', { owner: 'base', paths: ['a', 'b'] }), /exatamente um/u);
  assert.throws(() => buildTerminalArguments('stage-hunk', { owner: 'base', hunk: '-1', token: 'abc', paths: ['a'] }), /inteiro não negativo/u);
  assert.deepEqual(buildTerminalArguments('stage-hunk', { owner: 'base', hunk: '0', token: 'abc', paths: ['a'] }), ['stage-hunk', 'base', '--hunk', '0', '--token', 'abc', '--', 'a']);
});

test('terminal: PowerShell usa strings literais para apóstrofos e metacaracteres', () => {
  const payload = 'O\'Brien; $(Get-Process) "aspas" & | % ! ` Unicode ç';
  assert.equal(quoteTerminalArgument(payload, 'powershell'), "'O''Brien; $(Get-Process) \"aspas\" & | % ! ` Unicode ç'");
  assert.equal(buildTerminalCommand('commit', { layer: 'ai', message: payload }, 'powershell'), `git-layer 'commit' 'ai' '-m' ${quoteTerminalArgument(payload, 'powershell')}`);
  assert.throws(() => quoteTerminalArgument('a\rb', 'powershell'), /controle/u);
});

test('terminal: Bash real preserva argumentos e não avalia metacaracteres da mensagem', { skip: process.platform === 'win32' ? 'Roundtrip Bash do host; o fluxo PowerShell tem verificação separada.' : false }, () => {
  const message = 'O\'Brien; $(printf INJETADO) "aspas" & | % ! `printf ERRO` Unicode ç';
  const expected = ['commit', 'ai', '-m', message];
  const shellText = `git-layer() { printf '%s\\0' "$@"; }; ${buildTerminalCommand('commit', { layer: 'ai', message }, 'bash')}`;
  const result = execFileSync('/bin/bash', ['--noprofile', '--norc', '-c', shellText]);
  assert.deepEqual(result.toString('utf8').split('\0').slice(0, -1), expected);
  const paths = ['C:\\pasta com espaços\\O\'Brien.txt', '-arquivo', 'áçõ.ts'];
  const pathText = `git-layer() { printf '%s\\0' "$@"; }; ${buildTerminalCommand('add', { layer: 'scripts', paths }, 'bash')}`;
  assert.deepEqual(execFileSync('/bin/bash', ['--noprofile', '--norc', '-c', pathText]).toString('utf8').split('\0').slice(0, -1), ['add', 'scripts', '--', ...paths]);
});
