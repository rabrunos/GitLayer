import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import test, { type TestContext } from 'node:test';
import { discover, type RepoInfo } from '../../src/core/git.js';
import { GitLayers } from '../../src/core/index.js';
import { queryIndexDiff, queryIndexTree } from '../../src/core/index-query.js';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { cleanupFixture, createFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const queryArgs = ['diff', '--name-status', '-z', '--no-renames', '--'];
const budget = { timeout: 900000 }; // Harness allowance for compound Git fixtures, not a product latency SLO.

function inventory(root: string): unknown[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const full = path.join(root, entry.name), stat = fs.lstatSync(full);
    assert(!stat.isSymbolicLink(), 'Owned query fixture inventory refuses links');
    if (stat.isDirectory()) return [{ path: entry.name + '/', directory: true }, ...inventory(full).map(row => ({ ...row as object, path: entry.name + '/' + (row as any).path }))];
    assert(stat.isFile()); return [{ path: entry.name, bytes: stat.size, mode: stat.mode & 0o777, hash: hash(fs.readFileSync(full)) }];
  });
}

function fixture(t: TestContext, retainEvidence = false) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-index-query');
  const prior = { ...process.env }, preserve = retainEvidence || prior.GL_STAGE2_PRESERVE_FIXTURES === '1';
  t.after(() => {
    try {
      if (preserve) {
        const markerFile = path.join(owned.root, '.git-compat-owned.json'), stat = fs.lstatSync(owned.root);
        assert(stat.isDirectory() && !stat.isSymbolicLink()); assert(!fs.lstatSync(markerFile).isSymbolicLink());
        const marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
        assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
        assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent); assert.equal(path.dirname(fs.realpathSync(owned.root)), owned.parent);
        const receipt = { schema: 1, test: t.name, ...owned, retained: true, policy: 'GL_STAGE2_PRESERVE_FIXTURES=1; preserve pass/failure/setup evidence' };
        fs.writeFileSync(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
        t.diagnostic(JSON.stringify({ kind: 'retained-index-query-fixture', ...receipt }));
      } else cleanupFixture(owned);
    } finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, prior); }
  });
  const relativeToProject = path.relative(path.toNamespacedPath(path.resolve('.')), path.toNamespacedPath(owned.root));
  assert(relativeToProject.startsWith('..') || path.isAbsolute(relativeToProject), 'Query fixture must be external to the project');
  const env = isolatedEnvironment(owned.root, officialGit); if (preserve) env.GL_STAGE2_PRESERVE_FIXTURES = '1';
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repo space'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string, input?: string) => cp.execFileSync(officialGit, args, {
    cwd: repo, env: { ...process.env, ...(index ? { GIT_INDEX_FILE: index } : {}) }, input, windowsHide: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  const write = (file: string, bytes: string) => { const full = path.join(repo, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, bytes); };
  native(['init', '-b', 'main']); native(['config', 'core.autocrlf', 'false']);
  const names = Array.from({ length: 16 }, (_, i) => 'origin/' + String(i).padStart(3, '0') + '-query file.txt');
  const seed = () => { for (const file of names) write(file, 'A committed\n'); native(['add', '--', 'origin']); native(['commit', '-m', 'query fixture A']); };
  return { owned, env, repo, native, write, names, seed };
}

function stagedABC(f: ReturnType<typeof fixture>, source: string) {
  // Official read-tree from an empty index leaves legitimate zero stat entries.
  // cacheinfo stages B without refreshing the unrelated clean A stat entries.
  f.native(['read-tree', '--empty'], source); f.native(['read-tree', 'HEAD'], source);
  const b = f.native(['hash-object', '-w', '--stdin'], undefined, 'B staged\n').trim();
  f.native(['update-index', '--cacheinfo', '100644,' + b + ',' + f.names[0]!], source);
  f.write(f.names[0]!, 'C disk\n'); f.write(f.names.at(-1)!, 'C last\n');
}

function privateIndex(repo: RepoInfo): string {
  const directory = path.join(repo.gitDir, 'layers', 'indexes'); fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, 'owned-query.index');
}

for (const role of ['MAIN', 'private'] as const) test('index query preserves exact ' + role + ' bytes with clean stat-only A and staged B versus disk C', budget, async t => {
  const f = fixture(t); f.seed(); const repo = await discover(f.repo);
  const source = role === 'MAIN' ? repo.index : privateIndex(repo); stagedABC(f, source);
  const control = path.join(f.owned.root, 'native-control.index'); fs.copyFileSync(source, control, fs.constants.COPYFILE_EXCL);
  assert.equal(fs.statSync(control).nlink, 1);
  const expected = Buffer.from(f.native(queryArgs, control));
  assert.deepEqual(expected.toString().split('\0').filter(Boolean), ['M', f.names[0], 'M', f.names.at(-1)]);
  const before = fs.readFileSync(source), main = fs.readFileSync(repo.index), state = inventory(f.repo), temporary = fs.readdirSync(f.env.TEMP).sort();
  for (let repeat = 0; repeat < 2; repeat++) {
    const observed = await queryIndexDiff(repo, source, queryArgs);
    assert.equal(observed.code, 0); assertBytesEqual(observed.stdout, expected, role + ' true changes');
    assertBytesEqual(fs.readFileSync(source), before, role + ' real index must be byte-identical');
    assertBytesEqual(fs.readFileSync(repo.index), main, 'MAIN index must be byte-identical');
    assert.deepEqual(inventory(f.repo), state); assert.deepEqual(fs.readdirSync(f.env.TEMP).sort(), temporary, 'Successful scratch query leaves no persistent temporary artifact');
  }
  assert.equal(f.native(['show', ':' + f.names[0]], source).trim(), 'B staged');
  assert.equal(f.native(['show', 'HEAD:' + f.names[0]]).trim(), 'A committed');
  assert.equal(fs.readFileSync(path.join(f.repo, f.names[0]!), 'utf8'), 'C disk\n');
  assertBytesEqual(fs.readFileSync(source), before, 'Independent native observations preserve real source');
});

test('Core preview and patch queries keep private MAIN metadata refs and worktree byte-identical with zero stat entries', budget, async t => {
  const f = fixture(t); f.seed(); const app = await GitLayers.init(f.repo);
  await app.create('a'); await app.on('a'); f.write('layer/a.txt', 'A Layer committed\n'); f.write('layer/clean.txt', 'A clean\n');
  await app.add('a', ['layer/a.txt', 'layer/clean.txt']); await app.commit('a', 'Layer A');
  const layer = (await app.list()).find(entry => entry.name === 'a')!, index = path.join(app.dir, 'indexes', layer.id + '.index');
  const seeded = path.join(f.owned.root, 'stat-zero-layer.index'); f.native(['read-tree', 'layer/a'], seeded);
  const b = f.native(['hash-object', '-w', '--stdin'], undefined, 'B Layer staged\n').trim();
  f.native(['update-index', '--cacheinfo', '100644,' + b + ',layer/a.txt'], seeded);
  const checkpoint = f.native(['write-tree'], seeded).trim(); fs.writeFileSync(index, fs.readFileSync(seeded));
  f.native(['update-ref', 'refs/git-layers/state/' + layer.id, checkpoint]); f.write('layer/a.txt', 'C Layer disk\n');
  const before = inventory(f.repo), temp = fs.readdirSync(f.env.TEMP).sort();
  const preview = await app.preview('off', 'a');
  assert(preview.impediments.some(item => item.code === 'LAYER_DIRTY'));
  assert.deepEqual(inventory(f.repo), before, 'Preview cannot refresh real private stat data');
  const patch = await app.diff('a'); assert(patch.includes('-B Layer staged')); assert(patch.includes('+C Layer disk'));
  assert.deepEqual(inventory(f.repo), before, 'Patch query cannot refresh real private stat data');
  const basePatch = await app.diff('base'); assert.equal(basePatch, '');
  assert.deepEqual(inventory(f.repo), before, 'MAIN patch query cannot persist any changes');
  assert.deepEqual(fs.readdirSync(f.env.TEMP).sort(), temp);
  // Preserve a real Layer-query failure through status' public diagnostic.
  // The wrapper only adds one nonce-owned artifact to this fixture's proven
  // private scratch; the command itself is still the official Git executable.
  const originalSpawn = cp.spawn; let artifact: string | undefined, injectedDirectory: string | undefined;
  cp.spawn = function (executable: any, args: any, options: any) {
    const scratch = options?.env?.GIT_INDEX_FILE;
    if (!artifact && options?.cwd === f.repo && Array.isArray(args) && args.includes('diff') && typeof scratch === 'string') {
      const directory = path.dirname(path.resolve(scratch)), receipt = path.join(directory, 'owner.json');
      if (fs.existsSync(receipt)) {
        const owner = JSON.parse(fs.readFileSync(receipt, 'utf8'));
        if (owner.sourceIndex === index) {
          assert.equal(owner.kind, 'git-layer-index-query'); assert.equal(owner.directory, directory); assert.equal(owner.parent, fs.realpathSync(f.env.TEMP));
          assert.equal(path.dirname(directory), fs.realpathSync(f.env.TEMP)); assert(!fs.lstatSync(directory).isSymbolicLink());
          assert.match(owner.nonce, /^[a-f0-9-]{36}$/u); assert(path.basename(directory).startsWith('git-layer-index-query-' + owner.nonce + '-'));
          artifact = path.join(directory, 'status-later-evidence-' + f.owned.nonce + '.txt'); injectedDirectory = directory;
          fs.writeFileSync(artifact, 'later status evidence ' + f.owned.nonce, { flag: 'wx' });
        }
      }
    }
    return (originalSpawn as any).call(this, executable, args, options);
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  let observed: Awaited<ReturnType<GitLayers['status']>>;
  try { observed = await app.status(); } finally { cp.spawn = originalSpawn; syncBuiltinESMExports(); }
  assert(artifact && injectedDirectory, 'The exact Layer scratch interleaving must execute');
  assert.equal(observed.safe, false); assert.equal(observed.error.code, 'UNSAFE_PATH');
  const evidence = observed.error.details.indexQuery;
  assert.equal(evidence.sourceIndex, index); assert.equal(evidence.directory, injectedDirectory); assert.equal(evidence.retained, true);
  assert.equal(fs.readFileSync(artifact, 'utf8'), 'later status evidence ' + f.owned.nonce);
  assert(fs.existsSync(evidence.receipt)); assert(fs.existsSync(path.join(injectedDirectory, 'index')));
  assert.deepEqual(inventory(f.repo), before, 'Status failure must preserve source indices, refs, metadata and all workspace bytes');
  t.diagnostic(JSON.stringify({ kind: 'retained-status-index-query-error', code: observed.error.code, indexQuery: evidence }));
});

test('index query preserves an existing real index lock and retains query errors for inspection', budget, async t => {
  const f = fixture(t); f.seed(); const repo = await discover(f.repo), source = privateIndex(repo); stagedABC(f, source);
  const before = fs.readFileSync(source), lock = source + '.lock', lockBytes = Buffer.from('owned lock ' + f.owned.nonce + '\n');
  fs.writeFileSync(lock, lockBytes, { flag: 'wx' });
  await assert.rejects(queryIndexDiff(repo, source, queryArgs), { code: 'LOCKED' });
  assertBytesEqual(fs.readFileSync(source), before); assertBytesEqual(fs.readFileSync(lock), lockBytes);
  fs.unlinkSync(lock); // Explicitly owned synthetic lock, removed only to exercise a separate error branch.
  const validBackup = path.join(f.owned.root, 'valid-before-index.bin'); fs.writeFileSync(validBackup, before, { flag: 'wx' });
  const invalid = Buffer.from('owned invalid index ' + f.owned.nonce + '\n'); fs.writeFileSync(source, invalid);
  let observed: any;
  try { await queryIndexDiff(repo, source, queryArgs); assert.fail('Official Git must reject the intentionally invalid owned index'); }
  catch (error) { observed = error; }
  assert.equal(observed.code, 'GIT_FAILED'); assert.equal(observed.details.indexQuery.retained, true);
  const directory = path.resolve(observed.details.indexQuery.directory);
  assert.equal(path.dirname(directory), fs.realpathSync(f.env.TEMP)); assert(!fs.lstatSync(directory).isSymbolicLink());
  assert(fs.existsSync(path.join(directory, 'owner.json'))); assert(fs.existsSync(path.join(directory, 'index')));
  assertBytesEqual(fs.readFileSync(source), invalid); assertBytesEqual(fs.readFileSync(path.join(directory, 'index')), invalid); assertBytesEqual(fs.readFileSync(validBackup), before);
  t.diagnostic(JSON.stringify({ kind: 'retained-query-error', directory, code: observed.code, details: observed.details.indexQuery }));
});

test('index query of an absent unborn MAIN does not create the real index or mutate refs bytes', budget, async t => {
  const f = fixture(t), repo = await discover(f.repo); assert.equal(repo.head, ''); assert.equal(fs.existsSync(repo.index), false);
  const before = inventory(f.repo), temp = fs.readdirSync(f.env.TEMP).sort();
  const result = await queryIndexDiff(repo, repo.index, queryArgs);
  assert.equal(result.code, 0); assert.equal(result.stdout.length, 0); assert.equal(fs.existsSync(repo.index), false);
  assert.deepEqual(inventory(f.repo), before); assert.deepEqual(fs.readdirSync(f.env.TEMP).sort(), temp);
});

test('index query refuses TEMP in the workspace or Git directory before making any temporary or repository change', budget, async t => {
  const f = fixture(t); f.seed(); const repo = await discover(f.repo), source = privateIndex(repo); stagedABC(f, source);
  const before = inventory(f.repo), sourceBytes = fs.readFileSync(source), externalTemp = fs.readdirSync(f.env.TEMP).sort();
  const keys = ['TEMP', 'TMP', 'TMPDIR'] as const, previous = keys.map(key => [key, process.env[key]] as const);
  try {
    for (const protectedRoot of [repo.root, repo.gitDir]) {
      for (const key of keys) process.env[key] = protectedRoot;
      await assert.rejects(queryIndexDiff(repo, source, queryArgs), { code: 'UNSAFE_PATH' });
      assert.deepEqual(inventory(f.repo), before); assertBytesEqual(fs.readFileSync(source), sourceBytes);
      assert.deepEqual(fs.readdirSync(f.env.TEMP).sort(), externalTemp);
    }
  } finally { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('index query rejects cached revisions output redirects and unsafe paths before any query side effects', budget, async t => {
  const f = fixture(t); f.seed(); const repo = await discover(f.repo), source = privateIndex(repo); stagedABC(f, source);
  const before = inventory(f.repo), sourceBytes = fs.readFileSync(source), temp = fs.readdirSync(f.env.TEMP).sort(), output = path.join(f.owned.root, 'must-not-exist.patch');
  const invalid: Array<{ args: string[]; code: string }> = [
    { args: ['diff', '--cached', '--'], code: 'INVALID_ARGUMENT' },
    { args: ['diff', 'HEAD', '--'], code: 'INVALID_ARGUMENT' },
    { args: ['diff', '--output=' + output, '--'], code: 'INVALID_ARGUMENT' },
    { args: ['diff', '--', '../escape'], code: 'INVALID_PATH' },
    { args: ['diff', '--', '.git/config'], code: 'PROTECTED_PATH' },
    { args: ['diff', '--name-status'], code: 'INVALID_ARGUMENT' },
  ];
  for (const item of invalid) {
    await assert.rejects(queryIndexDiff(repo, source, item.args), { code: item.code });
    assert.deepEqual(inventory(f.repo), before); assertBytesEqual(fs.readFileSync(source), sourceBytes);
    assert.deepEqual(fs.readdirSync(f.env.TEMP).sort(), temp); assert.equal(fs.existsSync(output), false);
  }
  // A caller may mutate its own argv after the async call starts. Validation
  // must bind an independent snapshot before the first await, not later run
  // a redirect or revision that was never approved by this query boundary.
  const callerArgs = [...queryArgs], pending = queryIndexDiff(repo, source, callerArgs);
  callerArgs.splice(0, callerArgs.length, 'diff', '--output=' + output, '--');
  const result = await pending;
  assert.equal(result.code, 0); assert.deepEqual(result.stdout.toString().split('\0').filter(Boolean), ['M', f.names[0], 'M', f.names.at(-1)]);
  assert.equal(fs.existsSync(output), false); assertBytesEqual(fs.readFileSync(source), sourceBytes);
  assert.deepEqual(inventory(f.repo), before); assert.deepEqual(fs.readdirSync(f.env.TEMP).sort(), temp);
});

async function concurrentChild(t: TestContext, boundary: 'copy' | 'git' | 'lock' | 'scratch-lock' | 'unknown' | 'cleanup-after-effect') {
  const f = fixture(t); f.seed(); const repo = await discover(f.repo), source = privateIndex(repo); stagedABC(f, source);
  const before = fs.readFileSync(source), alternate = f.native(['hash-object', '-w', '--stdin'], undefined, 'External native staged bytes\n').trim();
  const bundle = path.join(f.owned.root, 'query-bundle.mjs'), config = path.join(f.owned.root, 'child-config.json');
  const { build } = await import('esbuild');
  await build({ entryPoints: [path.resolve('src/core/index-query.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' });
  fs.writeFileSync(config, JSON.stringify({ repo, source, alternate, file: f.names[1], git: officialGit, boundary, ownedRoot: f.owned.root, nonce: f.owned.nonce, expectedBefore: hash(before) }) + '\n', { flag: 'wx' });
  const script = `
    import assert from 'node:assert/strict'; import fs from 'node:fs'; import cp from 'node:child_process'; import path from 'node:path'; import { createHash } from 'node:crypto'; import { syncBuiltinESMExports } from 'node:module';
    const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), target = path.resolve(config.source);
    const owner = JSON.parse(fs.readFileSync(path.join(config.ownedRoot, '.git-compat-owned.json'), 'utf8')); assert.equal(owner.nonce, config.nonce); assert(target.startsWith(config.ownedRoot+path.sep)); assert.equal(fs.realpathSync(config.ownedRoot),config.ownedRoot);
    const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex'); assert.equal(digest(target), config.expectedBefore); const sourceBefore=fs.readFileSync(target);
    let injected = false, changedBytes, newArtifact;
    function external(scratch) { if(injected) return; injected = true; if(config.boundary === 'lock') { fs.writeFileSync(target + '.lock', 'owned writer lock ' + config.nonce, {flag:'wx'}); return; }
      if(config.boundary==='scratch-lock' || config.boundary==='unknown') { assert(scratch && scratch!==target); scratch=path.resolve(scratch); const directory=path.dirname(scratch), receipt=JSON.parse(fs.readFileSync(path.join(directory,'owner.json'),'utf8'));
        assert.equal(receipt.kind,'git-layer-index-query'); assert.equal(receipt.sourceIndex,target); assert(directory.startsWith(config.ownedRoot+path.sep));
        newArtifact=config.boundary==='scratch-lock'?scratch+'.lock':path.join(directory,'later-evidence-'+config.nonce+'.txt'); fs.writeFileSync(newArtifact,'later evidence '+config.nonce,{flag:'wx'}); return;
      }
      cp.execFileSync(config.git, ['update-index', '--cacheinfo', '100644,' + config.alternate + ',' + config.file], {cwd:config.repo.root,env:{...process.env,GIT_INDEX_FILE:target},windowsHide:true,stdio:'pipe'}); changedBytes = fs.readFileSync(target);
    }
    if(config.boundary==='cleanup-after-effect') {
      const mkdtemp=fs.promises.mkdtemp, unlink=fs.promises.unlink, rmdir=fs.promises.rmdir, temp=fs.realpathSync(process.env.TEMP); let directory, queryNonce, receiptProven=false;
      fs.promises.mkdtemp=async function(prefix,...args) { const result=await mkdtemp.call(this,prefix,...args); if(typeof prefix==='string' && path.dirname(path.resolve(prefix))===temp && path.basename(prefix).startsWith('git-layer-index-query-')) { directory=path.resolve(result); const match=/^git-layer-index-query-([a-f0-9-]{36})-/u.exec(path.basename(prefix)); assert(match); queryNonce=match[1]; } return result; };
      fs.promises.unlink=async function(file,...args) { if(directory && typeof file==='string' && path.resolve(file)===path.join(directory,'owner.json')) { const owner=JSON.parse(fs.readFileSync(file,'utf8')); assert.equal(owner.kind,'git-layer-index-query'); assert.equal(owner.nonce,queryNonce); assert.equal(owner.sourceIndex,target); assert.equal(owner.directory,directory); assert.equal(owner.parent,temp); receiptProven=true; } return unlink.call(this,file,...args); };
      fs.promises.rmdir=async function(file,...args) { if(directory && typeof file==='string' && path.resolve(file)===directory) { assert(receiptProven,'Only the exact nonce-proven query directory may be faulted'); await rmdir.call(this,file,...args); assert.equal(fs.existsSync(directory),false); injected=true; throw Object.assign(new Error('Simulated EIO after successful owned rmdir; not a real I/O or power-loss experiment'),{code:'EIO'}); } return rmdir.call(this,file,...args); };
    }
    else if(config.boundary === 'copy') { const original = fs.promises.open; let opens=0; fs.promises.open = async function(file,...args) { const handle=await original.call(this,file,...args);
      if(typeof file==='string' && path.resolve(file)===target && ++opens===2) { const read=handle.read.bind(handle); handle.read=async function(...readArgs) { const result=await read(...readArgs); if(result.bytesRead>0) external(); return result; }; } return handle;
    }; }
    else { const original=cp.spawn; cp.spawn=function(executable,args,options) { const child=original.call(this,executable,args,options); if(options?.cwd===config.repo.root && Array.isArray(args) && args.includes('diff') && options.env?.GIT_INDEX_FILE!==target) child.once('spawn',()=>external(options.env?.GIT_INDEX_FILE)); return child; }; }
    syncBuiltinESMExports(); const {queryIndexDiff}=await import(process.argv[1]); let error;
    try { await queryIndexDiff(config.repo,target,['diff','--name-status','-z','--no-renames','--']); assert.fail('Source/lock interference must refuse query success'); } catch(caught) { error=caught; }
    assert(injected,'Targeted interleaving did not execute'); const allowed=config.boundary==='cleanup-after-effect'?['EIO']:config.boundary==='unknown'?['UNSAFE_PATH']:['EXTERNAL_EDIT','EXTERNAL_CHANGE','LOCKED']; assert(error && allowed.includes(error.code), 'Unexpected error '+error?.code+': '+error?.message);
    if(config.boundary==='lock') assert.equal(fs.readFileSync(target+'.lock','utf8'),'owned writer lock '+config.nonce);
    else if(config.boundary==='cleanup-after-effect') { assert.equal(fs.readFileSync(target).equals(sourceBefore),true,'Cleanup failure cannot change the source index'); }
    else if(config.boundary==='scratch-lock'||config.boundary==='unknown') { assert.equal(fs.readFileSync(newArtifact,'utf8'),'later evidence '+config.nonce); assert.equal(fs.readFileSync(target).equals(sourceBefore),true,'Scratch interference cannot change the source index'); }
    else { assert(!digest(target).includes(config.expectedBefore)); assert.equal(fs.readFileSync(target).equals(changedBytes),true,'External index bytes must be preserved exactly'); }
    if(config.boundary==='cleanup-after-effect') { assert.equal(error.details.indexQuery.retained,false); assert.notEqual(error.details.indexQuery.retention,'complete'); assert.equal(error.details.indexQuery.filePresence.directory.state,'absent'); assert.equal(error.details.indexQuery.filePresence.index.state,'absent'); assert.equal(error.details.indexQuery.filePresence.owner.state,'absent'); assert.equal(fs.existsSync(error.details.indexQuery.directory),false); }
    else { assert.equal(error.details.indexQuery.retained,true); assert(fs.existsSync(path.join(error.details.indexQuery.directory,'owner.json'))); }
    process.stdout.write(JSON.stringify({boundary:config.boundary,injected,error:{code:error.code,message:error.message,indexQuery:error.details.indexQuery},sourceHash:digest(target)}));
  `;
  const child = cp.spawnSync(process.execPath, ['--input-type=module', '-e', script, pathToFileURL(bundle).href, config], { cwd: path.resolve('.'), env: process.env, windowsHide: true, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const observed = JSON.parse(child.stdout); assert.equal(observed.boundary, boundary); assert.equal(observed.injected, true);
  assert.equal(f.native(['rev-parse', 'HEAD']).trim(), repo.head); assert.equal(fs.readFileSync(path.join(f.repo, f.names[0]!), 'utf8'), 'C disk\n');
  t.diagnostic(JSON.stringify({ kind: 'own-child-query-interleaving', ...observed }));
}

for (const boundary of ['copy', 'git', 'lock'] as const) test('index query refuses a real owned writer at the ' + boundary + ' boundary and retains later evidence', budget, async t => concurrentChild(t, boundary));
for (const boundary of ['scratch-lock', 'unknown'] as const) test('index query preserves ' + boundary + ' evidence appearing during the Git query without broad cleanup', budget, async t => concurrentChild(t, boundary));
test('index query reports absent scratch evidence honestly after a simulated EIO following successful owned rmdir', budget, async t => concurrentChild(t, 'cleanup-after-effect'));

// A byte-identical index copy with a later filesystem mtime can suppress Git's
// native racy-stat content check. Keep A committed, B staged and C on disk with
// equal B/C size+mtime; the original index is always written by official Git.
for (const role of ['MAIN', 'private'] as const) for (const statConfig of [
  { label: 'default stat configuration', trustctime: 'true', checkStat: 'default' },
  { label: 'trustctime false and checkStat minimal', trustctime: 'false', checkStat: 'minimal' },
] as const) test('index query preserves racy B versus C for ' + role + ' with ' + statConfig.label, budget, async t => {
  const f = fixture(t), file = f.names[0]!;
  f.native(['config', 'core.trustctime', statConfig.trustctime]); f.native(['config', 'core.checkStat', statConfig.checkStat]);
  f.write(file, 'AAAA\n'); f.native(['add', '--', file]); f.native(['commit', '-m', 'native racy A']);
  const repo = await discover(f.repo), source = role === 'MAIN' ? repo.index : privateIndex(repo);
  if (role === 'private') f.native(['read-tree', 'HEAD'], source);
  const head = f.native(['rev-parse', 'HEAD']).trim(), mainBefore = fs.readFileSync(repo.index);
  f.write(file, 'BBBB\n');
  const filePath = path.join(f.repo, file), targetSecond = Math.floor(Date.now() / 1000) + 5;
  fs.utimesSync(filePath, targetSecond, targetSecond); f.native(['add', '--', file], source);
  const bStat = fs.statSync(filePath, { bigint: true }), sourceStat = fs.statSync(source, { bigint: true }), before = fs.readFileSync(source);
  assert(sourceStat.mtimeNs <= bStat.mtimeNs, 'The native index must be racy; the test never rewrites its timestamp');
  const cachedStat = f.native(['ls-files', '--debug', '--', file], source); assert.match(cachedStat, /size:\s+5\b/u);
  assert.equal(f.native(['show', ':' + file], source), 'BBBB\n'); assert.equal(f.native(['show', 'HEAD:' + file]), 'AAAA\n');
  f.write(file, 'CCCC\n'); fs.utimesSync(filePath, targetSecond, targetSecond);
  const cStat = fs.statSync(filePath, { bigint: true }); assert.equal(cStat.size, bStat.size); assert.equal(cStat.mtimeNs, bStat.mtimeNs);
  while (Date.now() <= targetSecond * 1000 + 1500) await new Promise(resolve => setTimeout(resolve, 100));
  const naive = path.join(f.owned.root, 'naive-later.index'); fs.writeFileSync(naive, before, { flag: 'wx' });
  assert(fs.statSync(naive, { bigint: true }).mtimeNs > cStat.mtimeNs, 'A freshly written byte copy must exercise the timestamp window');
  const nativeFreshCopy = f.native([...queryArgs, file], naive);
  if (statConfig.checkStat === 'minimal') assert.equal(nativeFreshCopy, '', 'The controlled fixture must demonstrate the false-clean naive copy');
  const state = inventory(f.repo), temporary = fs.readdirSync(f.env.TEMP).sort(), observedTimes: Array<{ source: string; scratch: string }> = [];
  const originalSpawn = cp.spawn;
  cp.spawn = function (executable: any, args: any, options: any) {
    const alternate = options?.env?.GIT_INDEX_FILE;
    if (options?.cwd === f.repo && Array.isArray(args) && args.includes('diff') && typeof alternate === 'string' && path.resolve(alternate) !== source) {
      const scratch = path.resolve(alternate), directory = path.dirname(scratch), owner = JSON.parse(fs.readFileSync(path.join(directory, 'owner.json'), 'utf8'));
      assert.equal(owner.kind, 'git-layer-index-query'); assert.equal(owner.sourceIndex, source); assert.equal(owner.directory, directory); assert.equal(owner.parent, fs.realpathSync(f.env.TEMP));
      assert.match(owner.nonce, /^[a-f0-9-]{36}$/u); assert(path.basename(directory).startsWith('git-layer-index-query-' + owner.nonce + '-'));
      const sourceNs = fs.statSync(source, { bigint: true }).mtimeNs, scratchNs = fs.statSync(scratch, { bigint: true }).mtimeNs;
      assert(scratchNs >= 1_000_000_000n && scratchNs <= sourceNs, 'Actual scratch timestamp must retain native racy eligibility');
      assertBytesEqual(fs.readFileSync(scratch), before, 'Timestamp adjustment cannot alter the prepared index image');
      observedTimes.push({ source: sourceNs.toString(), scratch: scratchNs.toString() });
    }
    return (originalSpawn as any).call(this, executable, args, options);
  } as typeof cp.spawn;
  syncBuiltinESMExports();
  try {
    const names = await queryIndexDiff(repo, source, [...queryArgs, file]);
    assertBytesEqual(names.stdout, Buffer.from('M\0' + file + '\0'), 'Core must detect C against staged B in the native racy window');
    const patch = await queryIndexDiff(repo, source, ['diff', '--no-renames', '--', file]);
    assert(patch.stdout.toString().includes('-BBBB\n')); assert(patch.stdout.toString().includes('+CCCC\n'));
  } finally { cp.spawn = originalSpawn; syncBuiltinESMExports(); }
  assert.equal(observedTimes.length, 2); assertBytesEqual(fs.readFileSync(source), before, 'Both Core queries preserve the raw live index');
  assert.equal(fs.statSync(source, { bigint: true }).mtimeNs, sourceStat.mtimeNs, 'Core cannot edit the native source index timestamp');
  if (role === 'private') assertBytesEqual(fs.readFileSync(repo.index), mainBefore, 'Private query preserves MAIN index');
  const nativeOriginal = f.native([...queryArgs, file], source);
  assertBytesEqual(Buffer.from(nativeOriginal), Buffer.from('M\0' + file + '\0'), 'Official Git using the original native index is the independent oracle');
  assertBytesEqual(fs.readFileSync(source), before, 'Native oracle preserves the captured B index');
  assert.deepEqual(inventory(f.repo), state); assert.deepEqual(fs.readdirSync(f.env.TEMP).sort(), temporary);
  assert.equal(f.native(['show', ':' + file], source), 'BBBB\n'); assert.equal(f.native(['show', 'HEAD:' + file]), 'AAAA\n');
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'CCCC\n'); assert.equal(f.native(['rev-parse', 'HEAD']).trim(), head);
  t.diagnostic(JSON.stringify({ kind: 'native-racy-index-query', role, statConfig, sourceMtimeNs: sourceStat.mtimeNs.toString(), worktreeMtimeNs: cStat.mtimeNs.toString(), nativeFreshCopyDetected: nativeFreshCopy !== '', originalIndexTimestampEdited: false, observedTimes }));
});

async function timestampChild(t: TestContext, mode: 'rounding' | 'unrepresentable' | 'write-error' | 'prepared-tamper' | 'zero-second-source' | 'overflow-source' | 'path-replaced-at-open') {
  const f = fixture(t); f.seed(); const repo = await discover(f.repo), source = privateIndex(repo); stagedABC(f, source);
  const before = fs.readFileSync(source), sourceNs = fs.statSync(source, { bigint: true }).mtimeNs, state = inventory(f.repo);
  const bundle = path.join(f.owned.root, 'timestamp-query-bundle.mjs'), configFile = path.join(f.owned.root, 'timestamp-child-config.json');
  const { build } = await import('esbuild');
  await build({ entryPoints: [path.resolve('src/core/index-query.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' });
  fs.writeFileSync(configFile, JSON.stringify({ repo, source, sourceNs: sourceNs.toString(), expectedBefore: hash(before), expectedPaths: [f.names[0], f.names.at(-1)], mode, ownedRoot: f.owned.root, nonce: f.owned.nonce }) + '\n', { flag: 'wx' });
  const script = `
    import assert from 'node:assert/strict'; import fs from 'node:fs'; import cp from 'node:child_process'; import path from 'node:path'; import { createHash } from 'node:crypto'; import { syncBuiltinESMExports } from 'node:module';
    const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),target=path.resolve(config.source),marker=JSON.parse(fs.readFileSync(path.join(config.ownedRoot,'.git-compat-owned.json'),'utf8'));
    assert.equal(marker.nonce,config.nonce);assert.equal(path.dirname(fs.realpathSync(config.ownedRoot)),marker.parent);assert(target.startsWith(config.ownedRoot+path.sep));
    const before=fs.readFileSync(target),digest=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(digest(before),config.expectedBefore);
    const second=1000000000n,actualSourceNs=BigInt(config.sourceNs),sourceNs=config.mode==='rounding'?(actualSourceNs/second)*second-1n:config.mode==='zero-second-source'?second-1n:config.mode==='overflow-source'?(0xffffffffn+2n)*second:actualSourceNs;
    let injected=false,diffSpawns=0,savedCopy=null;const requests=[],observed=[],openedHandles=[];
    if(['rounding','zero-second-source','overflow-source'].includes(config.mode)) { const lstat=fs.promises.lstat;fs.promises.lstat=async function(file,options,...rest){const result=await lstat.call(this,file,options,...rest);if(typeof file==='string'&&path.resolve(file)===target&&options?.bigint){injected=true;return Object.assign(Object.create(Object.getPrototypeOf(result)),result,{mtimeNs:sourceNs,mtimeMs:sourceNs/1000000n});}return result;}; }
    function ownedScratch(file){if(typeof file!=='string'||path.basename(file)!=='index'||path.resolve(file)===target)return false;const directory=path.dirname(path.resolve(file)),receipt=path.join(directory,'owner.json');if(!fs.existsSync(receipt))return false;const owner=JSON.parse(fs.readFileSync(receipt,'utf8'));assert.equal(owner.sourceIndex,target);assert.equal(owner.kind,'git-layer-index-query');assert.equal(owner.directory,directory);assert.equal(owner.parent,fs.realpathSync(process.env.TEMP));assert(path.basename(directory).startsWith('git-layer-index-query-'+owner.nonce+'-'));assert(directory.startsWith(config.ownedRoot+path.sep));return true;}
    const asNs=value=>{assert.equal(typeof value,'string');const [seconds,fraction='']=value.split('.');return BigInt(seconds)*second+BigInt(fraction.padEnd(9,'0').slice(0,9));};
    const open=fs.promises.open;fs.promises.open=async function(file,flags,...args){const scratch=ownedScratch(file);
      if(scratch&&!injected&&config.mode==='path-replaced-at-open'&&typeof flags==='number'&&(flags&fs.constants.O_RDWR)===fs.constants.O_RDWR){savedCopy=path.join(path.dirname(file),'original-independent-copy-'+config.nonce+'.index');fs.renameSync(file,savedCopy);fs.linkSync(target,file);injected=true;}
      const handle=await open.call(this,file,flags,...args);if(!scratch)return handle;
      const opened=await handle.stat({bigint:true}),utimes=handle.utimes.bind(handle);openedHandles.push({dev:opened.dev.toString(),ino:opened.ino.toString(),flags});
      handle.utimes=async function(atime,mtime){assert(ownedScratch(file));const current=await handle.stat({bigint:true});assert.equal(current.dev,opened.dev);assert.equal(current.ino,opened.ino);assert(current.isFile());const requested=asNs(mtime);assert(requested>=second&&requested<=sourceNs,'Requested timestamp must be integer-rounded down from exact source ns');requests.push(requested.toString());
        if(config.mode==='unrepresentable'||config.mode==='rounding'&&requests.length===1){injected=true;return utimes(atime,(sourceNs/second+2n).toString());}
        const result=await utimes(atime,mtime);if(config.mode==='write-error'){injected=true;throw Object.assign(new Error('Synthetic EIO after actual nonce-owned handle.utimes'),{code:'EIO'});}return result;};return handle;};
    if(config.mode==='prepared-tamper'){const rename=fs.promises.rename;fs.promises.rename=async function(from,to,...args){const result=await rename.call(this,from,to,...args);if(!injected&&typeof to==='string'&&path.basename(to)==='owner.json'&&fs.existsSync(to)){const owner=JSON.parse(fs.readFileSync(to,'utf8'));if(owner.kind==='git-layer-index-query'&&owner.sourceIndex===target&&owner.phase==='prepared'){const scratch=path.join(path.dirname(to),'index');assert(ownedScratch(scratch));fs.utimesSync(scratch,Number(sourceNs/second+10n),Number(sourceNs/second+10n));injected=true;}}return result;};}
    const spawn=cp.spawn;cp.spawn=function(executable,args,options){if(options?.cwd===config.repo.root&&Array.isArray(args)&&args.includes('diff')){diffSpawns++;const scratch=options.env?.GIT_INDEX_FILE;assert(ownedScratch(scratch));const actual=fs.statSync(scratch,{bigint:true}).mtimeNs;assert(actual>=second&&actual<=sourceNs);assert.equal(digest(fs.readFileSync(scratch)),config.expectedBefore);observed.push(actual.toString());}return spawn.call(this,executable,args,options);};
    syncBuiltinESMExports();const {queryIndexDiff}=await import(process.argv[1]);let error=null,result=null;try{result=await queryIndexDiff(config.repo,target,['diff','--name-status','-z','--no-renames','--']);}catch(caught){error=caught;}
    assert(injected,'The nonce-owned timestamp interleaving must execute');assert.equal(digest(fs.readFileSync(target)),config.expectedBefore,'Live index bytes must remain exact');assert.equal(fs.statSync(target,{bigint:true}).mtimeNs,actualSourceNs,'Actual live index timestamp must remain exact');
    if(config.mode==='rounding'){assert.equal(error,null);assert.equal(diffSpawns,1);assert(requests.length>=2,'A rounded-up actual time must force a nearer safe fallback');assert.deepEqual(result.stdout.toString().split('\\0').filter(Boolean),['M',config.expectedPaths[0],'M',config.expectedPaths[1]]);}
    else {const expected=config.mode==='write-error'?'EIO':['prepared-tamper','path-replaced-at-open'].includes(config.mode)?'EXTERNAL_EDIT':'INDEX_TIMESTAMP_UNSAFE';assert(error&&error.code===expected,'Unexpected timestamp failure '+error?.code+': '+error?.message);assert.equal(diffSpawns,0,'An unsafe timestamp/image must be refused before the official diff');assert.equal(error.details.indexQuery.retained,true);assert.equal(error.details.indexQuery.copyCompleted,true);assert.equal(digest(fs.readFileSync(path.join(error.details.indexQuery.directory,'index'))),config.expectedBefore);if(['zero-second-source','overflow-source','path-replaced-at-open'].includes(config.mode))assert.equal(requests.length,0,'An unproved/unrepresentable index must receive no metadata write');if(config.mode==='path-replaced-at-open'){assert(savedCopy);assert.equal(digest(fs.readFileSync(savedCopy)),config.expectedBefore);assert.equal(fs.statSync(target).nlink,2,'The synthetic hardlink remains as interference evidence; product must not remove it');}}
    process.stdout.write(JSON.stringify({mode:config.mode,injected,diffSpawns,sourceNs:sourceNs.toString(),requests,observed,openedHandles,error:error?{code:error.code,indexQuery:error.details.indexQuery}:null,sourceRawBytesPreserved:true,sourceTimestampPreserved:true,sourceLinkCountChangedOnlyByFixture:config.mode==='path-replaced-at-open'}));
  `;
  const child = cp.spawnSync(process.execPath, ['--input-type=module', '-e', script, pathToFileURL(bundle).href, configFile], { cwd: path.resolve('.'), env: process.env, windowsHide: true, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr || child.error?.message); const observed = JSON.parse(child.stdout);
  assert.equal(observed.mode, mode); assert.equal(observed.sourceRawBytesPreserved, true); assert.equal(observed.sourceTimestampPreserved, true);
  assertBytesEqual(fs.readFileSync(source), before); assert.equal(fs.statSync(source, { bigint: true }).mtimeNs, sourceNs); assert.deepEqual(inventory(f.repo), state);
  assert.equal(f.native(['rev-parse', 'HEAD']).trim(), repo.head); assert.equal(fs.readFileSync(path.join(f.repo, f.names[0]!), 'utf8'), 'C disk\n');
  t.diagnostic(JSON.stringify({ kind: 'own-child-index-timestamp', ...observed }));
}

for (const mode of ['rounding', 'unrepresentable', 'write-error', 'prepared-tamper', 'zero-second-source', 'overflow-source', 'path-replaced-at-open'] as const) test('index query preserves racy timestamp safety under owned ' + mode + ' interleaving', budget, async t => timestampChild(t, mode));

test('recovery tree validation preserves live MAIN and private B/C indices while matching official write-tree twice', budget, async t => {
  const f = fixture(t); f.seed(); const repo = await discover(f.repo);
  const refs = f.native(['for-each-ref', '--format=%(refname)%00%(objectname)']), head = f.native(['rev-parse', 'HEAD']);
  const observations: Array<{ role: string; tree: string; sourceMtimeNs: string }> = [];
  for (const role of ['MAIN', 'private'] as const) {
    const source = role === 'MAIN' ? repo.index : privateIndex(repo); stagedABC(f, source);
    const original = fs.readFileSync(source), sourceStat = fs.lstatSync(source, { bigint: true });
    const main = fs.readFileSync(repo.index), mainStat = fs.lstatSync(repo.index, { bigint: true });
    const control = path.join(f.owned.root, 'native-tree-control-' + role + '.index');
    fs.copyFileSync(source, control, fs.constants.COPYFILE_EXCL); assert.equal(fs.lstatSync(control).nlink, 1);
    // The native control creates any missing tree objects before the immutable
    // repository-byte snapshot. Tree validation may create/freshen Git objects.
    const expectedTree = f.native(['write-tree'], control).trim(); assert.match(expectedTree, /^[a-f0-9]{40,64}$/u);
    const before = inventory(f.repo), temporary = fs.readdirSync(f.env.TEMP).sort();
    for (let repeat = 0; repeat < 2; repeat++) {
      const result = await queryIndexTree(repo, source);
      assert.equal(result.code, 0); assert.equal(result.stdout.toString('utf8').trim(), expectedTree);
      assertBytesEqual(fs.readFileSync(source), original, role + ' tree validation preserves every live index byte');
      const actual = fs.lstatSync(source, { bigint: true });
      assert.equal(actual.dev, sourceStat.dev); assert.equal(actual.ino, sourceStat.ino);
      assert.equal(actual.mode, sourceStat.mode); assert.equal(actual.mtimeNs, sourceStat.mtimeNs); assert.equal(actual.ctimeNs, sourceStat.ctimeNs);
      assertBytesEqual(fs.readFileSync(repo.index), main, 'Alternate tree validation preserves exact MAIN bytes');
      const actualMain = fs.lstatSync(repo.index, { bigint: true });
      assert.equal(actualMain.dev, mainStat.dev); assert.equal(actualMain.ino, mainStat.ino);
      assert.equal(actualMain.mtimeNs, mainStat.mtimeNs); assert.equal(actualMain.ctimeNs, mainStat.ctimeNs);
      assert.equal(f.native(['for-each-ref', '--format=%(refname)%00%(objectname)']), refs); assert.equal(f.native(['rev-parse', 'HEAD']), head);
      assert.deepEqual(inventory(f.repo), before, 'No source index, refs, metadata or workspace bytes changed after tree objects were preseeded');
      assert.deepEqual(fs.readdirSync(f.env.TEMP).sort(), temporary, 'Successful tree validation cleans only its own transient copy');
    }
    assert.equal(f.native(['show', ':' + f.names[0]], source), 'B staged\n');
    assert.equal(f.native(['show', 'HEAD:' + f.names[0]]), 'A committed\n');
    assert.equal(fs.readFileSync(path.join(f.repo, f.names[0]!), 'utf8'), 'C disk\n');
    observations.push({ role, tree: expectedTree, sourceMtimeNs: sourceStat.mtimeNs.toString() });
  }
  t.diagnostic(JSON.stringify({ kind: 'recovery-tree-validation-native-controls', observations, liveIndicesPreserved: true, refsPreserved: true, worktreeCPreserved: true }));
});

test('recovery tree validation rejects a controlled missing blob when cached equality alone succeeds and retains all evidence', budget, async t => {
  const f = fixture(t, true); f.seed(); const repo = await discover(f.repo), source = privateIndex(repo);
  assert.equal(f.native(['rev-parse', '--show-object-format']).trim(), 'sha1', 'The owned binary-fixture oracle explicitly uses SHA-1/index-v2');
  const file = 'missing-owned.txt', blobOID = f.native(['hash-object', '-w', '--stdin'], undefined, 'B missing object\n').trim();
  assert.match(blobOID, /^[a-f0-9]{40}$/u); f.write(file, 'C preserved on disk\n');
  // Official Git creates a valid one-entry index with no cache-tree. It must
  // inspect the referenced blob rather than return a cached TREE extension.
  f.native(['-c', 'index.version=2', 'update-index', '--add', '--cacheinfo', '100644,' + blobOID + ',' + file], source);
  const original = fs.readFileSync(source); assert.equal(original.toString('ascii', 0, 4), 'DIRC'); assert.equal(original.readUInt32BE(4), 2); assert.equal(original.readUInt32BE(8), 1);
  const entryEnd = 12 + Math.ceil((62 + Buffer.byteLength(file) + 1) / 8) * 8;
  assert.equal(original.length, entryEnd + 20, 'The native source index has no TREE or other extension');
  const backup = path.join(f.owned.root, 'before-missing-object.index'); fs.writeFileSync(backup, original, { flag: 'wx' });
  const nativeKnown = path.join(f.owned.root, 'native-known-tree.index'); fs.copyFileSync(source, nativeKnown, fs.constants.COPYFILE_EXCL);
  const checkpoint = f.native(['write-tree'], nativeKnown).trim(); assert.match(checkpoint, /^[a-f0-9]{40}$/u);
  const blob = path.join(repo.commonDir, 'objects', blobOID.slice(0, 2), blobOID.slice(2));
  const quarantine = path.join(f.owned.root, 'moved-own-blob-' + f.owned.nonce + '.bin');
  const ownedReal = fs.realpathSync(f.owned.root), marker = JSON.parse(fs.readFileSync(path.join(ownedReal, '.git-compat-owned.json'), 'utf8'));
  assert.equal(marker.nonce, f.owned.nonce); assert.equal(marker.parent, f.owned.parent); assert.equal(fs.realpathSync(path.dirname(ownedReal)), f.owned.parent);
  for (const target of [fs.realpathSync(blob), quarantine]) {
    const relative = path.relative(ownedReal, path.resolve(target)); assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'Only a regular blob inside the owned fixture may be moved');
  }
  const blobStat = fs.lstatSync(blob, { bigint: true }); assert(blobStat.isFile() && !blobStat.isSymbolicLink()); assert.equal(blobStat.nlink, 1n); assert(!fs.existsSync(quarantine));
  const blobBytes = fs.readFileSync(blob), blobHandle = fs.openSync(blob, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try { const opened = fs.fstatSync(blobHandle, { bigint: true }); assert(opened.isFile()); assert.equal(opened.dev, blobStat.dev); assert.equal(opened.ino, blobStat.ino); assert.equal(opened.nlink, 1n); }
  finally { fs.closeSync(blobHandle); }
  // No deletion: retain the exact nonce-owned loose object outside objects/.
  fs.renameSync(blob, quarantine);
  const moved = fs.lstatSync(quarantine, { bigint: true }); assert(moved.isFile() && !moved.isSymbolicLink()); assert.equal(moved.dev, blobStat.dev); assert.equal(moved.ino, blobStat.ino); assert.equal(moved.nlink, 1n);
  assert(!fs.existsSync(blob)); assertBytesEqual(fs.readFileSync(quarantine), blobBytes, 'Relocated object evidence is exact');
  const nativeCached = path.join(f.owned.root, 'native-cached-missing-blob.index'), nativeMissing = path.join(f.owned.root, 'native-missing-tree.index');
  // Each native command receives its own complete initial byte image. A cached
  // diff cannot change the index used by the independent write-tree control.
  for (const control of [nativeCached, nativeMissing]) {
    fs.copyFileSync(source, control, fs.constants.COPYFILE_EXCL); assert.equal(fs.lstatSync(control).nlink, 1);
    assertBytesEqual(fs.readFileSync(control), original, 'Each negative native control starts with the exact no-TREE source index');
  }
  const nativeRun = (args: string[], index: string) => cp.spawnSync(officialGit, args, { cwd: f.repo, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_INDEX_FILE: index }, windowsHide: true, shell: false, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  const cached = nativeRun(['diff', '--no-ext-diff', '--no-textconv', '--cached', '--quiet', checkpoint, '--'], nativeCached);
  assert.ifError(cached.error); assert.equal(cached.status, 0, cached.stderr); assert.equal(cached.signal, null);
  const nativeFailure = nativeRun(['write-tree'], nativeMissing);
  assert.ifError(nativeFailure.error); assert.equal(nativeFailure.status, 128, nativeFailure.stderr); assert.equal(nativeFailure.signal, null);
  const sourceStat = fs.lstatSync(source, { bigint: true }), main = fs.readFileSync(repo.index), mainStat = fs.lstatSync(repo.index, { bigint: true });
  const refs = f.native(['for-each-ref', '--format=%(refname)%00%(objectname)']), head = f.native(['rev-parse', 'HEAD']), before = inventory(f.repo);
  let observed: any;
  try { await queryIndexTree(repo, source); assert.fail('The fixed native write-tree validation must reject the missing owned blob'); }
  catch (error) { observed = error; }
  assert.equal(observed.code, 'GIT_FAILED'); assert.equal(observed.details.indexQuery.retained, true); assert.equal(observed.details.indexQuery.operation, 'write-tree-validation');
  assertBytesEqual(fs.readFileSync(source), original, 'Missing-blob validation cannot publish a changed live index'); assertBytesEqual(fs.readFileSync(backup), original, 'Unique pre-failure index backup remains exact');
  const after = fs.lstatSync(source, { bigint: true }); assert.equal(after.dev, sourceStat.dev); assert.equal(after.ino, sourceStat.ino); assert.equal(after.mode, sourceStat.mode); assert.equal(after.mtimeNs, sourceStat.mtimeNs); assert.equal(after.ctimeNs, sourceStat.ctimeNs);
  assertBytesEqual(fs.readFileSync(repo.index), main, 'Missing private blob does not modify MAIN'); const afterMain = fs.lstatSync(repo.index, { bigint: true }); assert.equal(afterMain.mtimeNs, mainStat.mtimeNs); assert.equal(afterMain.ctimeNs, mainStat.ctimeNs);
  assert.equal(f.native(['for-each-ref', '--format=%(refname)%00%(objectname)']), refs); assert.equal(f.native(['rev-parse', 'HEAD']), head);
  assert.deepEqual(inventory(f.repo), before); assertBytesEqual(fs.readFileSync(quarantine), blobBytes, 'Git failure preserves the relocated blob evidence');
  const evidence = observed.details.indexQuery, directory = path.resolve(evidence.directory), receipt = JSON.parse(fs.readFileSync(evidence.receipt, 'utf8'));
  assert.equal(path.dirname(directory), fs.realpathSync(f.env.TEMP)); assert(!fs.lstatSync(directory).isSymbolicLink()); assert.equal(receipt.kind, 'git-layer-index-query'); assert.equal(receipt.operation, 'write-tree-validation'); assert.equal(receipt.phase, 'failed'); assert.equal(receipt.error.code, 'GIT_FAILED'); assert.equal(receipt.sourceIndex, source);
  assert.match(receipt.nonce, /^[a-f0-9-]{36}$/u); assert(path.basename(directory).startsWith('git-layer-index-query-' + receipt.nonce + '-')); assert.equal(receipt.parent, fs.realpathSync(f.env.TEMP)); assert(fs.existsSync(path.join(directory, 'index')));
  t.diagnostic(JSON.stringify({ kind: 'recovery-tree-validation-missing-owned-blob', cachedEqualityExit: cached.status, nativeWriteTreeExit: nativeFailure.status, queryCode: observed.code, checkpoint, originalIndexBytes: original.length, originalIndexSHA256: hash(original), sourceAndBackupPreserved: true, movedBlobSHA256: hash(blobBytes), evidence }));
});
