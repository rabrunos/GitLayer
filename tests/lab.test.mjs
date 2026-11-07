import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture } from './helpers.mjs';

function inRepo(run) {
  const f = fixture();
  try { run(f); }
  catch (error) { console.error(`Fixture retained for inspection: ${f.root}`); throw error; }
  f.cleanup();
}
function state(f, name) {
  const layers = JSON.parse(f.layer(['status', '--json'])).layers;
  const item = layers.find(layer => layer.name === name);
  assert.ok(item, `Layer ${name} appears in status`);
  return item;
}
const paths = entries => entries.map(entry => entry.path).sort();
function snapshot(f) {
  return { head: f.head(), branch: f.git(['symbolic-ref', 'HEAD']).trim(), index: f.mainIndex() };
}
function unchangedMain(f, before) {
  assert.equal(f.head(), before.head);
  assert.equal(f.git(['symbolic-ref', 'HEAD']).trim(), before.branch);
  assert.deepEqual(f.mainIndex(), before.index, 'Layer commands preserve bytes of the main index');
}
function seed(f, name, files) {
  f.layer(['create', name]);
  f.layer(['on', name]);
  for (const [path, text] of Object.entries(files)) f.write(path, text);
  f.layer(['add', name, ...Object.keys(files)]);
  f.layer(['commit', name, '-m', `Initial ${name} files`]);
}

// T10 is the separately reproducible scripts/benchmark.mjs, not a timing assertion here.
test('T01: three real Git branches start inactive with independent roots', () => inRepo(f => {
  const before = snapshot(f);
  const oids = [];
  for (const name of ['scripts', 'agents', 'tools']) {
    f.layer(['create', name]);
    const ref = `refs/heads/layer/${name}`;
    oids.push(f.git(['rev-parse', ref]).trim());
    assert.equal(f.git(['rev-list', '--parents', '--max-count=1', ref]).trim().split(' ').length, 1);
    assert.deepEqual(f.files(ref), []);
    assert.equal(state(f, name).active, false);
  }
  assert.equal(new Set(oids).size, 3);
  assert.match(f.layer(['list']), /scripts/);
  unchangedMain(f, before);
}));

test('T02: on/off materialize real files while HEAD and main index stay selected', () => inRepo(f => {
  seed(f, 'scripts', { 'src/helpers.js': 'helper\n', 'tools/run.js': 'run\n' });
  const before = snapshot(f);
  assert.equal(state(f, 'scripts').active, true);
  f.layer(['off', 'scripts']);
  assert.equal(existsSync(join(f.root, 'src/helpers.js')), false);
  assert.equal(existsSync(join(f.root, 'tools/run.js')), false);
  assert.equal(state(f, 'scripts').active, false);
  f.layer(['on', 'scripts']);
  assert.equal(f.read('src/helpers.js'), 'helper\n');
  assert.equal(f.read('tools/run.js'), 'run\n');
  unchangedMain(f, before);
}));

test('T03: normal git add and commit omit committed and modified Layer files', () => inRepo(f => {
  seed(f, 'scripts', { 'src/helpers.js': 'first\n' });
  f.write('src/helpers.js', 'Layer modification\n');
  f.write('src/application.js', 'application addition\n');
  f.write('app/base.txt', 'application modification\n');
  f.git(['add', '.']);
  const indexed = f.git(['ls-files', '-z']).split('\0').filter(Boolean).sort();
  assert.deepEqual(indexed, ['app/base.txt', 'src/application.js']);
  f.git(['commit', '-m', 'Application change']);
  assert.deepEqual(f.files('HEAD'), ['app/base.txt', 'src/application.js']);
  assert.equal(f.git(['show', 'HEAD:app/base.txt']), 'application modification\n');
  assert.equal(f.read('src/helpers.js'), 'Layer modification\n');
  assert.deepEqual(paths(state(f, 'scripts').modified), ['src/helpers.js']);
}));

test('T04: add dot takes free files across directories and skips both staged owners', () => inRepo(f => {
  seed(f, 'scripts', { 'src/scripts.js': 'scripts\n' });
  seed(f, 'agents', { 'tools/agents.js': 'agents\n' });
  seed(f, 'tools', { 'agents/tools.md': 'tools\n' });
  f.write('src/main-staged.js', 'main owns staging\n');
  f.git(['add', 'src/main-staged.js']);
  f.write('src/agent-staged.js', 'agents own staging\n');
  f.layer(['add', 'agents', 'src/agent-staged.js']);
  const free = ['src/new.js', 'tools/test.js', 'agents/instructions.md'];
  for (const file of free) f.write(file, `free ${file}\n`);
  const before = snapshot(f);
  f.layer(['add', 'scripts', '.']);
  assert.deepEqual(paths(state(f, 'scripts').staged), free.sort());
  assert.deepEqual(paths(state(f, 'agents').staged), ['src/agent-staged.js']);
  assert.deepEqual(paths(state(f, 'tools').staged), []);
  unchangedMain(f, before);
}));

test('T05: main and three Layers separate modifications and deletions', () => inRepo(f => {
  f.write('app/delete.txt', 'delete main\n');
  f.git(['add', '.']);
  f.git(['commit', '-m', 'Second application file']);
  for (const name of ['scripts', 'agents', 'tools']) {
    seed(f, name, { [`shared/${name}-keep.txt`]: `${name} keep\n`, [`shared/${name}-delete.txt`]: `${name} delete\n` });
  }
  f.write('app/base.txt', 'main modified\n');
  unlinkSync(join(f.root, 'app/delete.txt'));
  for (const name of ['scripts', 'agents', 'tools']) {
    f.write(`shared/${name}-keep.txt`, `${name} modified\n`);
    unlinkSync(join(f.root, `shared/${name}-delete.txt`));
  }
  f.git(['add', '.']);
  assert.deepEqual(f.git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean).sort(), ['app/base.txt', 'app/delete.txt']);
  const before = snapshot(f);
  for (const name of ['scripts', 'agents', 'tools']) {
    f.layer(['add', name, '.']);
    const staged = state(f, name).staged;
    assert.deepEqual(paths(staged), [`shared/${name}-delete.txt`, `shared/${name}-keep.txt`]);
    assert.deepEqual(staged.map(item => item.status).sort(), ['D', 'M']);
  }
  unchangedMain(f, before);
}));

test('T06: explicit files stage only selected literal paths', () => inRepo(f => {
  f.layer(['create', 'scripts']);
  f.layer(['on', 'scripts']);
  f.write('src/new.js', 'selected\n');
  f.write('src/other.js', 'not selected\n');
  f.write('src/a [x]!.js', 'literal selected\n');
  const before = snapshot(f);
  f.layer(['add', 'scripts', 'src/new.js']);
  assert.deepEqual(paths(state(f, 'scripts').staged), ['src/new.js']);
  f.layer(['add', 'scripts', 'src/a [x]!.js']);
  assert.deepEqual(paths(state(f, 'scripts').staged), ['src/a [x]!.js', 'src/new.js']);
  unchangedMain(f, before);
  f.git(['add', '.']);
  assert.deepEqual(f.git(['ls-files', '-z']).split('\0').filter(Boolean).sort(), ['app/base.txt', 'src/other.js']);
  assert.deepEqual(paths(state(f, 'scripts').staged), ['src/a [x]!.js', 'src/new.js']);
}));

test('T07: native log/show/trees prove independent Layer ancestry and main commits', () => inRepo(f => {
  const first = new Map();
  for (const name of ['scripts', 'agents', 'tools']) {
    seed(f, name, { [`shared/${name}.txt`]: `${name} first\n` });
    first.set(name, f.git(['rev-parse', `layer/${name}`]).trim());
  }
  const before = snapshot(f);
  for (const name of ['scripts', 'agents', 'tools']) {
    f.write(`shared/${name}.txt`, `${name} second\n`);
    f.layer(['add', name, `shared/${name}.txt`]);
    f.layer(['commit', name, '-m', `Second ${name}`]);
    assert.equal(f.git(['rev-parse', `layer/${name}^`]).trim(), first.get(name));
    assert.equal(f.git(['show', `layer/${name}:shared/${name}.txt`]), `${name} second\n`);
    assert.deepEqual(f.files(`layer/${name}`), [`shared/${name}.txt`]);
    assert.match(f.layer(['log', name]), new RegExp(`Second ${name}`));
    assert.equal(f.git(['merge-base', '--is-ancestor', 'main', `layer/${name}`], { ok: false }).status, 1);
  }
  unchangedMain(f, before);
  f.write('app/base.txt', 'independent main\n');
  f.git(['add', '.']);
  f.git(['commit', '-m', 'Main independent']);
  assert.deepEqual(f.files('main'), ['app/base.txt']);
  for (const name of ['scripts', 'agents', 'tools']) {
    assert.doesNotMatch(f.git(['log', '--format=%s', `layer/${name}`]), /Main independent/);
    assert.equal(f.git(['show', '-s', '--format=%an <%ae>', `layer/${name}`]).trim(), 'GitLayer Lab <lab@example.invalid>');
  }
}));

test('T08: commit records staged B and preserves unstaged C; off refuses dirty Layers', () => inRepo(f => {
  seed(f, 'scripts', { 'src/version.txt': 'A\n' });
  const before = snapshot(f);
  f.write('src/version.txt', 'B prepared\n');
  f.layer(['add', 'scripts', 'src/version.txt']);
  assert.notEqual(f.layer(['off', 'scripts'], { ok: false }).status, 0);
  f.write('src/version.txt', 'C after staging\n');
  f.layer(['commit', 'scripts', '-m', 'Commit B']);
  assert.equal(f.git(['show', 'layer/scripts:src/version.txt']), 'B prepared\n');
  assert.equal(f.read('src/version.txt'), 'C after staging\n');
  assert.deepEqual(paths(state(f, 'scripts').staged), []);
  assert.deepEqual(paths(state(f, 'scripts').modified), ['src/version.txt']);
  assert.notEqual(f.layer(['off', 'scripts'], { ok: false }).status, 0);
  assert.equal(f.read('src/version.txt'), 'C after staging\n');
  unchangedMain(f, before);
}));

test('T09: repeated reactivation restores all contents without removing shared app directories', () => inRepo(f => {
  const contents = Object.fromEntries(Array.from({ length: 10 }, (_, n) => [`app/shared/d${n}/layer.txt`, `content ${n}\n`]));
  f.write('app/shared/main.txt', 'keep application\n');
  f.git(['add', '.']);
  f.git(['commit', '-m', 'Application shared directory']);
  seed(f, 'scripts', contents);
  const before = snapshot(f);
  for (let round = 0; round < 2; round++) {
    f.layer(['off', 'scripts']);
    for (const path of Object.keys(contents)) assert.equal(existsSync(join(f.root, path)), false);
    assert.equal(f.read('app/shared/main.txt'), 'keep application\n');
    f.layer(['on', 'scripts']);
    for (const [path, text] of Object.entries(contents)) assert.equal(f.read(path), text);
  }
  unchangedMain(f, before);
}));

test('add dot and relative files use the invoking subdirectory', () => inRepo(f => {
  f.layer(['create', 'scripts']);
  f.layer(['on', 'scripts']);
  f.write('scope/one.txt', 'one\n');
  f.write('scope/deeper/two.txt', 'two\n');
  f.write('outside/three.txt', 'three\n');
  f.layer(['add', 'scripts', '.'], { cwd: join(f.root, 'scope') });
  assert.deepEqual(paths(state(f, 'scripts').staged), ['scope/deeper/two.txt', 'scope/one.txt']);
  f.layer(['add', 'scripts', '../outside/three.txt'], { cwd: join(f.root, 'scope') });
  assert.deepEqual(paths(state(f, 'scripts').staged), ['outside/three.txt', 'scope/deeper/two.txt', 'scope/one.txt']);
}));

test('new free files retain normal .gitignore and info/exclude rules', () => inRepo(f => {
  f.write('.gitignore', '*.skip\n');
  f.git(['add', '.gitignore']);
  f.git(['commit', '-m', 'Application ignore']);
  const exclude = join(f.root, '.git/info/exclude');
  const original = readFileSync(exclude, 'utf8') + '\nlocal.secret\n';
  f.write('.git/info/exclude', original);
  f.layer(['create', 'scripts']);
  f.layer(['on', 'scripts']);
  f.write('src/keep.txt', 'eligible\n');
  f.write('src/ignored.skip', 'ignored by user\n');
  f.write('local.secret', 'local ignored\n');
  f.layer(['add', 'scripts', '.']);
  assert.deepEqual(paths(state(f, 'scripts').staged), ['src/keep.txt']);
  assert.ok(readFileSync(exclude, 'utf8').startsWith(original));
  f.layer(['commit', 'scripts', '-m', 'Keep eligible only']);
  f.write('src/keep.txt', 'tracked own update\n');
  f.layer(['add', 'scripts', 'src/keep.txt']);
  assert.deepEqual(paths(state(f, 'scripts').staged), ['src/keep.txt']);
  f.git(['add', '.']);
  assert.deepEqual(f.git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean), []);
}));

test('a staged deletion keeps ownership until commit, and own add can reintroduce it', () => inRepo(f => {
  seed(f, 'scripts', { 'src/recreated.txt': 'A\n' });
  f.layer(['create', 'agents']);
  f.layer(['on', 'agents']);
  unlinkSync(join(f.root, 'src/recreated.txt'));
  f.layer(['add', 'scripts', '.']);
  f.write('src/recreated.txt', 'B recreated\n');
  f.layer(['add', 'agents', '.']);
  assert.deepEqual(paths(state(f, 'agents').staged), []);
  f.layer(['add', 'scripts', 'src/recreated.txt']);
  f.layer(['commit', 'scripts', '-m', 'Recreated own file']);
  assert.equal(f.git(['show', 'layer/scripts:src/recreated.txt']), 'B recreated\n');
}));
test('a main staged deletion keeps ownership when the file is recreated before commit', () => inRepo(f => {
  f.layer(['create', 'scripts']);
  f.layer(['on', 'scripts']);
  unlinkSync(join(f.root, 'app/base.txt'));
  f.git(['add', 'app/base.txt']);
  f.write('app/base.txt', 'main recreated after staging deletion\n');
  const before = snapshot(f);
  f.layer(['add', 'scripts', '.']);
  assert.deepEqual(paths(state(f, 'scripts').staged), []);
  assert.equal(f.git(['diff', '--cached', '--name-status']).trim(), 'D\tapp/base.txt');
  assert.equal(f.read('app/base.txt'), 'main recreated after staging deletion\n');
  unchangedMain(f, before);
}));

test('commit without a Layer reports no staging and refuses non-TTY pending interaction', () => inRepo(f => {
  f.layer(['create', 'scripts']);
  f.layer(['on', 'scripts']);
  assert.match(f.layer(['commit']), /Nenhuma altera/);
  f.write('src/pending.txt', 'pending staging\n');
  f.layer(['add', 'scripts', 'src/pending.txt']);
  const before = snapshot(f);
  const tip = f.git(['rev-parse', 'layer/scripts']).trim();
  const result = f.layer(['commit'], { ok: false, input: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /terminal|interativ/i);
  assert.equal(f.git(['rev-parse', 'layer/scripts']).trim(), tip);
  assert.deepEqual(paths(state(f, 'scripts').staged), ['src/pending.txt']);
  assert.equal(f.read('src/pending.txt'), 'pending staging\n');
  unchangedMain(f, before);
}));