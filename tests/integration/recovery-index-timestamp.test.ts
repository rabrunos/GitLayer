import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test, { type TestContext } from 'node:test';
import { GitLayers } from '../../src/core/index.js';
import { assertBytesEqual } from '../helpers/assert-bytes.js';
import { readJournal } from '../helpers/read-journal.js';
import { createFixture, cleanupFixture, isolatedEnvironment, resolveGit } from '../../scripts/git-compat/lib.mjs';

const officialGit = resolveGit();
const budget = { timeout: 900000 }; // Compound fixture allowance; not a latency claim.
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const second = 1_000_000_000n;
type Role = 'MAIN' | 'private';
const configurations = [
  { label: 'true-default', trustctime: 'true', checkStat: 'default' },
  { label: 'false-minimal', trustctime: 'false', checkStat: 'minimal' },
] as const;

function fixture(t: TestContext) {
  const owned = createFixture(fs.realpathSync(os.tmpdir()), 'gl-recovery-index-time');
  const prior = { ...process.env }, preserve = prior.GL_STAGE2_PRESERVE_FIXTURES === '1';
  const events: unknown[] = [];
  let completed = false;
  const finish = () => { completed = true; };
  const validateOwned = () => {
    const stat = fs.lstatSync(owned.root), markerFile = path.join(owned.root, '.git-compat-owned.json');
    assert(stat.isDirectory() && !stat.isSymbolicLink()); assert(!fs.lstatSync(markerFile).isSymbolicLink());
    const marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
    assert.equal(marker.nonce, owned.nonce); assert.equal(marker.parent, owned.parent);
    assert.equal(path.dirname(fs.realpathSync(owned.root)), owned.parent);
    assert.equal(fs.realpathSync(path.dirname(owned.root)), owned.parent);
  };
  t.after(() => {
    try {
      validateOwned();
      if (preserve || !completed) {
        const receipt = { schema: 1, test: t.name, ...owned, retained: true, completed, events, policy: preserve ? 'GL_STAGE2_PRESERVE_FIXTURES=1; preserve setup, success and failure evidence' : 'Preserve incomplete setup or failed test evidence; no finish acknowledgment' };
        fs.writeFileSync(path.join(owned.root, 'RETENTION-RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
        t.diagnostic(JSON.stringify({ kind: 'retained-recovery-index-timestamp-fixture', ...receipt }));
      } else cleanupFixture(owned);
    } finally { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, prior); }
  });
  const relation = path.relative(path.resolve('.'), owned.root);
  assert(relation.startsWith('..') || path.isAbsolute(relation), 'Recovery fixture must be external to the development checkout');
  const env = isolatedEnvironment(owned.root, officialGit); if (preserve) env.GL_STAGE2_PRESERVE_FIXTURES = '1';
  for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
  const repo = path.join(owned.root, 'repository'); fs.mkdirSync(repo);
  const native = (args: string[], index?: string) => cp.execFileSync(officialGit, ['--no-pager', '-C', repo, ...args], {
    env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...(index ? { GIT_INDEX_FILE: index } : {}) }, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024,
  });
  const text = (args: string[], index?: string) => native(args, index).toString('utf8').trimEnd();
  const write = (file: string, value: string) => fs.writeFileSync(path.join(repo, file), value);
  const stat = (file: string) => fs.statSync(file, { bigint: true });
  const statReceipt = (file: string) => { const s = stat(file); return { dev: String(s.dev), ino: String(s.ino), size: String(s.size), mode: String(s.mode), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) }; };
  text(['init', '-b', 'main']); text(['config', '--local', 'core.autocrlf', 'false']);
  write('base.txt', 'base\n'); text(['add', '--', 'base.txt']); text(['commit', '-m', 'recovery timestamp fixture base']);
  return { owned, env, repo, native, text, write, stat, statReceipt, events, finish, validateOwned };
}

async function interrupted(f: ReturnType<typeof fixture>, role: Role, config: typeof configurations[number], protocol:'legacy'|'managed'='legacy') {
  for (const [key, value] of [['core.trustctime', config.trustctime], ['core.checkStat', config.checkStat], ['core.fsmonitor', 'false'], ['core.filemode', 'false']]) f.text(['config', '--local', key!, value!]);
  const app = await GitLayers.init(f.repo), racy = role === 'MAIN' ? 'racy.txt' : 'layer-racy.txt', other = role === 'MAIN' ? 'other.txt' : 'layer-other.txt';
  let index = path.join(f.repo, '.git', 'index'), committed = 'HEAD', layerId: string | undefined;
  if (role === 'MAIN') {
    f.write(racy, 'AAAA\n'); f.write(other, 'OOOO\n');
    f.text(['add', '--', racy, other]); f.text(['commit', '-m', 'recovery A']);
    // A native commit is acknowledged through normal Core opening/guarding.
  } else {
    await app.create('a'); await app.on('a'); f.write(racy, 'AAAA\n'); f.write(other, 'OOOO\n');
    await app.add('a', [racy, other]); await app.commit('a', 'Layer recovery A');
    const layer = (await app.list()).find(candidate => candidate.name === 'a'); assert(layer?.id); layerId = layer.id;
    index = path.join(app.dir, 'indexes', layer.id + '.index'); committed = 'refs/heads/layer/a';
  }
  const head = f.text(['rev-parse', 'HEAD']), committedOID = f.text(['rev-parse', committed]);
  f.write(racy, 'BBBB\n');
  const target = Math.floor(Date.now() / 1000) + 5;
  fs.utimesSync(path.join(f.repo, racy), target, target);
  f.text(['add', '-f', '--', racy], index);
  // Prepare a native B tree/checkpoint before C. A later native checkpoint may
  // still smudge a racy stat-size field; its exact image is replayed separately.
  const treeB = f.text(['write-tree'], index);
  if (layerId) f.text(['update-ref', 'refs/git-layers/state/' + layerId, treeB]);
  const before = fs.readFileSync(index), initialStat = f.stat(index), bStat = f.stat(path.join(f.repo, racy));
  assert(initialStat.mtimeNs <= bStat.mtimeNs, 'Native source index must have racy eligibility before copying');
  const refs = f.text(['for-each-ref', '--format=%(refname)%00%(objectname)']);
  f.write(racy, 'CCCC\n'); fs.utimesSync(path.join(f.repo, racy), target, target); f.write(other, 'PPPP\n');
  const cStat = f.stat(path.join(f.repo, racy)); assert.equal(cStat.size, bStat.size); assert.equal(cStat.mtimeNs, bStat.mtimeNs);
  const diffArgs = ['diff', '--no-ext-diff', '--no-textconv', '--name-status', '-z', '--no-renames', '--', racy];
  assert.equal(f.native(diffArgs, index).toString('utf8'), 'M\0' + racy + '\0', 'Official Git original index must detect actual C');
  assertBytesEqual(fs.readFileSync(index), before, 'Independent original oracle preserves raw index'); assert.equal(f.stat(index).mtimeNs, initialStat.mtimeNs);
  while (Date.now() <= target * 1000 + 1100) await new Promise(resolve => setTimeout(resolve, 100));
  process.env.GIT_LAYERS_FAILPOINT = 'after-stage-index-publication';
  try { await assert.rejects(role === 'MAIN' ? app.baseStage([other]) : app.add('a', [other]), { code: 'INJECTED_FAILURE' }); }
  finally { delete process.env.GIT_LAYERS_FAILPOINT; }
  const published = fs.readFileSync(index); assert.notEqual(hash(published), hash(before)); assert.equal(f.text(['show', ':' + other], index), 'PPPP');
  const txRoot = path.join(app.dir, 'transactions');
  const pending = fs.readdirSync(txRoot).map(id => ({ id, journal: path.join(txRoot, id, 'journal.json') })).filter(entry => fs.existsSync(entry.journal)).map(entry => ({ ...entry, data: JSON.parse(fs.readFileSync(entry.journal, 'utf8')) })).filter(entry => entry.data.state !== 'completed');
  assert.equal(pending.length, 1); const transaction = pending[0]!;
  if(protocol==='legacy'){
    // Explicitly construct an old schema1 fixture. A file plan without timestamp
    // fields is no longer a legacy protocol when the new managed guard remains.
    f.validateOwned();const original=fs.readFileSync(transaction.journal),preserved=path.join(f.owned.root,'original-current-journal-'+transaction.id+'.json'),legacy=readJournal(transaction.journal);
    fs.writeFileSync(preserved,original,{flag:'wx'});delete legacy.recovery.managedIndexPublication;delete legacy.recovery.managedIndexConflict;
    assert.equal(legacy.schema,1);fs.writeFileSync(transaction.journal,JSON.stringify(legacy,null,2)+'\n');transaction.data=legacy;
    f.events.push({kind:'explicit-legacy-schema1-fixture',original:preserved,originalSHA256:hash(original),legacySHA256:hash(fs.readFileSync(transaction.journal)),originalSchema:JSON.parse(original.toString()).schema,legacySchema:1,removedGuards:['managedIndexPublication','managedIndexConflict'],realDataMigration:false});
  }else{assert.equal(transaction.data.schema,2);assert(transaction.data.recovery.managedIndexPublication);}
  const plan = transaction.data.recovery.files.find((entry: any) => entry.path === index);
  assert(plan?.backup); assert.equal(plan.before.hash, hash(before)); assertBytesEqual(fs.readFileSync(plan.backup), before, 'Recovery backup has exact original B raw index');
  assert(!('timestamp' in plan) && !('mtimeNs' in plan), 'Legacy journal file plan needs no new timestamp field');
  f.events.push({ role, config, before: f.statReceipt(plan.backup), sourceBeforeMtimeNs: String(initialStat.mtimeNs), backupSHA256: hash(before), transaction: transaction.id, publishedSHA256: hash(published) });
  return { app, role, layerId, treeB, index, before, published, initialStat, head, committed, committedOID, refs, racy, other, diffArgs, transaction, plan, protocol };
}

type Prepared = Awaited<ReturnType<typeof interrupted>>;

/**
 * Exact counterfactual for the former live private write-tree checkpoint route.
 * Retained v7 failures were audited/replayed with official Git: epoch-1s B
 * can be smudged (stat size 5 -> 0 and checksum) by that native write-tree.
 * The current checkpoint validates the same native tree on an independent
 * copy; the restored live index must retain every original B byte and epoch1.
 * Keep this replay file/hash as history, not permission for arbitrary deltas.
 * Evidence: audit 525c276b... and exact native replay bc8446c6... .
 */
function nativeCheckpointReplay(f: ReturnType<typeof fixture>, prepared: Prepared) {
  assert.equal(prepared.role, 'private'); f.validateOwned();
  const copy = path.join(f.owned.root, 'native-checkpoint-replay-' + randomUUID() + '.index');
  assert.equal(path.dirname(copy), f.owned.root); assert(!fs.existsSync(copy));
  const original = { index: fs.readFileSync(prepared.index), indexStat: f.statReceipt(prepared.index), backup: fs.readFileSync(prepared.plan.backup), backupStat: f.statReceipt(prepared.plan.backup), journal: fs.readFileSync(prepared.transaction.journal), refs: f.text(['for-each-ref', '--format=%(refname)%00%(objectname)']), head: f.text(['rev-parse', 'HEAD']), main: fs.readFileSync(path.join(f.repo, '.git', 'index')) };
  assertBytesEqual(original.backup, prepared.before, 'Native replay input must be exact B from the preserved backup');
  const stage = f.native(['ls-files', '--stage', '-z'], prepared.plan.backup), flags = f.native(['ls-files', '-v', '-z'], prepared.plan.backup);
  const mode = Number(fs.lstatSync(prepared.plan.backup).mode) & 0o777, fd = fs.openSync(copy, 'wx+', mode);
  try {
    fs.writeFileSync(fd, original.backup);
    const opened = fs.fstatSync(fd, { bigint: true }), atPath = fs.lstatSync(copy, { bigint: true });
    assert(opened.isFile() && atPath.isFile() && !atPath.isSymbolicLink()); assert.equal(opened.nlink, 1n); assert.equal(opened.dev, atPath.dev); assert.equal(opened.ino, atPath.ino);
    f.validateOwned(); fs.fchmodSync(fd, mode); fs.futimesSync(fd, 1, 1); fs.fsyncSync(fd);
    const stamped = fs.fstatSync(fd, { bigint: true }), current = fs.lstatSync(copy, { bigint: true });
    assert.equal(stamped.dev, opened.dev); assert.equal(stamped.ino, opened.ino); assert.equal(stamped.nlink, 1n); assert.equal(stamped.mtimeNs, second);
    assert.equal(current.dev, opened.dev); assert.equal(current.ino, opened.ino); assert.equal(current.nlink, 1n); assert.equal(current.mtimeNs, second);
  } finally { fs.closeSync(fd); }
  assertBytesEqual(fs.readFileSync(copy), prepared.before, 'Derived native index starts with every original B byte');
  const tree = f.text(['write-tree'], copy), bytes = fs.readFileSync(copy);
  assert.equal(tree, prepared.treeB, 'Native checkpoint must preserve the complete B tree');
  assertBytesEqual(f.native(['ls-files', '--stage', '-z'], copy), stage, 'Native checkpoint preserves each path, mode, stage and blob OID');
  assertBytesEqual(f.native(['ls-files', '-v', '-z'], copy), flags, 'Native checkpoint preserves index flags');
  assert.equal(f.native(prepared.diffArgs, copy).toString('utf8'), 'M\0' + prepared.racy + '\0', 'The independent native replay must still detect C');
  assertBytesEqual(fs.readFileSync(copy), bytes, 'Read-only native replay observations preserve its exact final image');
  assertBytesEqual(fs.readFileSync(prepared.index), original.index, 'Derived replay never modifies the live published index'); assert.deepEqual(f.statReceipt(prepared.index), original.indexStat);
  assertBytesEqual(fs.readFileSync(prepared.plan.backup), original.backup, 'Derived replay preserves unique backup'); assert.deepEqual(f.statReceipt(prepared.plan.backup), original.backupStat);
  assertBytesEqual(fs.readFileSync(prepared.transaction.journal), original.journal, 'Derived replay preserves pending journal');
  assertBytesEqual(fs.readFileSync(path.join(f.repo, '.git', 'index')), original.main, 'Derived private replay preserves MAIN index');
  assert.equal(f.text(['for-each-ref', '--format=%(refname)%00%(objectname)']), original.refs); assert.equal(f.text(['rev-parse', 'HEAD']), original.head);
  f.events.push({ kind: 'exact-independent-native-checkpoint-replay', file: copy, beforeSHA256: hash(prepared.before), afterSHA256: hash(bytes), tree, exactComparisonRequired: true, comparisonRole: 'former-live-private-checkpoint-counterfactual', liveRawExpectation: 'exact-original-B', differsFromOriginal: !bytes.equals(prepared.before), originalIndexBackupJournalMainRefsPreserved: true });
  return { copy, bytes, tree, stage, flags };
}
type NativeReplay = ReturnType<typeof nativeCheckpointReplay>;

/** Observe the physical rollback publication before any later Git checkpoint. */
async function atRollbackPublication<T>(f: ReturnType<typeof fixture>, prepared: Prepared, operation: () => Promise<T>, expectedPublications = 1): Promise<T> {
  const originalRename: any = fs.promises.rename; let publications = 0;
  (fs.promises as any).rename = async (...args: any[]) => {
    const from = typeof args[0] === 'string' ? path.resolve(args[0]) : '', to = typeof args[1] === 'string' ? path.resolve(args[1]) : '';
    if (to !== prepared.index || !from.startsWith(prepared.index + '.recovery-')) return originalRename(...args);
    f.validateOwned(); assert.equal(path.dirname(from), path.dirname(prepared.index)); assert.match(from, /\.recovery-[0-9a-f-]{36}$/u);
    const before = fs.lstatSync(from, { bigint: true }); assert(before.isFile() && !before.isSymbolicLink()); assert.equal(before.nlink, 1n); assert.equal(before.mtimeNs, second);
    assertBytesEqual(fs.readFileSync(from), prepared.before, 'Rollback publication must contain all exact original B bytes before rename');
    const value = await originalRename(...args), after = fs.lstatSync(prepared.index, { bigint: true });
    assert(after.isFile() && !after.isSymbolicLink()); assert.equal(after.dev, before.dev); assert.equal(after.ino, before.ino); assert.equal(after.nlink, 1n); assert.equal(after.mode, before.mode); assert.equal(after.mtimeNs, second);
    assertBytesEqual(fs.readFileSync(prepared.index), prepared.before, 'Physical rollback publishes exact original B bytes before checkpoint');
    publications++; f.events.push({ kind: 'exact-rollback-publication-before-checkpoint', path: prepared.index, rawSHA256: hash(prepared.before), mtimeNs: String(after.mtimeNs), dev: String(after.dev), ino: String(after.ino) });
    return value;
  };
  syncBuiltinESMExports();
  try { const value = await operation(); assert.equal(publications, expectedPublications, 'Observe the exact number of physical rollback publications'); return value; }
  finally { (fs.promises as any).rename = originalRename; syncBuiltinESMExports(); }
}

function assertRecovered(f: ReturnType<typeof fixture>, prepared: Prepared, replay?: NativeReplay) {
  const guarded=prepared.protocol==='managed',expected = prepared.before; assert(expected, 'Recovery requires exact original B bytes');
  assertBytesEqual(fs.readFileSync(prepared.index), expected, prepared.role === 'MAIN' ? 'MAIN rollback preserves exact original raw B index' : guarded?'Guarded private rollback preserves every original B byte without live write-tree':'Legacy private rollback preserves exact original B bytes while checkpoint refresh stays in its copy');
  assert.equal(f.stat(prepared.index).mtimeNs, second, 'Restored index keeps the exact conservative nonzero Git boundary');
  if(prepared.role==='private'){
    assert(replay && prepared.layerId); assertBytesEqual(f.native(['ls-files', '--stage', '-z'], prepared.index), replay.stage, 'Recovered path/mode/stage/blob OIDs match native replay');
    assertBytesEqual(f.native(['ls-files', '-v', '-z'], prepared.index), replay.flags, 'Recovered index flags match native replay');
    assert.equal(f.text(['rev-parse', 'refs/git-layers/state/' + prepared.layerId]), replay.tree, 'Recovered private checkpoint tree remains the original B tree');
    assertBytesEqual(fs.readFileSync(replay.copy), replay.bytes, 'Former live write-tree counterfactual remains exactly retained');
  }
  const beforeRead = f.statReceipt(prepared.index);
  assert.equal(f.native(prepared.diffArgs, prepared.index).toString('utf8'), 'M\0' + prepared.racy + '\0', 'Official Git continues detecting C after rollback and checkpoint');
  assertBytesEqual(fs.readFileSync(prepared.index), expected, 'Independent final oracle does not rewrite source'); assert.deepEqual(f.statReceipt(prepared.index), beforeRead);
  assertBytesEqual(fs.readFileSync(prepared.plan.backup), prepared.before, 'Recovery and checkpoint keep the unique original raw B backup');
  assert.equal(f.text(['show', ':' + prepared.racy], prepared.index), 'BBBB'); assert.equal(f.text(['show', ':' + prepared.other], prepared.index), 'OOOO');
  assert.equal(fs.readFileSync(path.join(f.repo, prepared.racy), 'utf8'), 'CCCC\n'); assert.equal(fs.readFileSync(path.join(f.repo, prepared.other), 'utf8'), 'PPPP\n');
  assert.equal(f.text(['show', prepared.committed + ':' + prepared.racy]), 'AAAA'); assert.equal(f.text(['rev-parse', 'HEAD']), prepared.head);
  assert.equal(f.text(['rev-parse', prepared.committed]), prepared.committedOID); assert.equal(f.text(['for-each-ref', '--format=%(refname)%00%(objectname)']), prepared.refs);
  assert.equal(JSON.parse(fs.readFileSync(prepared.transaction.journal, 'utf8')).state, 'completed');
}

for (const role of ['MAIN', 'private'] as const) for (const config of configurations) test('GL19 rollback preserves racy B/C detection and exact ' + role + ' index with ' + config.label + ' legacy plan', budget, async t => {
  const f = fixture(t), prepared = await interrupted(f, role, config), replay = role === 'private' ? nativeCheckpointReplay(f, prepared) : undefined;
  const result = await atRollbackPublication(f, prepared, () => prepared.app.recover()); assert(result.recovered.includes(prepared.transaction.id)); assertRecovered(f, prepared, replay);
  const completedJournal = fs.readFileSync(prepared.transaction.journal), completedStat = f.statReceipt(prepared.index);
  const repeat = await prepared.app.recover(); assert.deepEqual(repeat.recovered, []); assertRecovered(f, prepared, replay);
  assertBytesEqual(fs.readFileSync(prepared.transaction.journal), completedJournal, 'Repeated completed recovery does not rewrite the journal'); assert.deepEqual(f.statReceipt(prepared.index), completedStat);
  f.events.push({ recovered: result.recovered, repeated: repeat.recovered, restored: completedStat, exactRawIndexSHA256: hash(prepared.before), nativeDiff: 'M\\0' + prepared.racy + '\\0' });
  f.finish();
});

for(const config of configurations)test('GL19 guarded managed rollback preserves exact original B index and racy C detection with '+config.label,budget,async t=>{
  const f=fixture(t),prepared=await interrupted(f,'private',config,'managed'),replay=nativeCheckpointReplay(f,prepared);
  const result=await atRollbackPublication(f,prepared,()=>prepared.app.recover());assert(result.recovered.includes(prepared.transaction.id));assertRecovered(f,prepared,replay);
  const journal=fs.readFileSync(prepared.transaction.journal),identity=f.statReceipt(prepared.index);assert.deepEqual((await prepared.app.recover()).recovered,[]);assertRecovered(f,prepared,replay);assertBytesEqual(fs.readFileSync(prepared.transaction.journal),journal,'Repeated guarded recovery preserves completed journal');assert.deepEqual(f.statReceipt(prepared.index),identity);
  f.events.push({kind:'guarded-exact-original-B',recovered:result.recovered,sourceSHA256:hash(prepared.before),finalSHA256:hash(fs.readFileSync(prepared.index)),nativeReplaySHA256:hash(replay.bytes),nativeDiff:'M\\0'+prepared.racy+'\\0',noArbitraryStatDeltaAllowed:true});f.finish();
});

for (const mode of ['sync-EIO-after-effect', 'timestamp-tamper-during-sync'] as const) test('GL19 index rollback preserves published index backup journal and temporary on ' + mode, budget, async t => {
  const f = fixture(t), prepared = await interrupted(f, 'MAIN', configurations[1]);
  const originalOpen: any = fs.promises.open; let injected = false, temporary: string | undefined;
  const publishedStat = f.statReceipt(prepared.index), backup = fs.readFileSync(prepared.plan.backup);
  (fs.promises as any).open = async (...args: any[]) => {
    const handle = await originalOpen(...args), file = typeof args[0] === 'string' ? path.resolve(args[0]) : '';
    if (!injected && file.startsWith(prepared.index + '.recovery-') && typeof args[1] === 'number' && (args[1] & fs.constants.O_RDWR) === fs.constants.O_RDWR) {
      assert.equal(path.dirname(file), path.dirname(prepared.index));
      const opened = await handle.stat({ bigint: true }), atPath = fs.lstatSync(file, { bigint: true });
      assert(opened.isFile() && atPath.isFile() && !atPath.isSymbolicLink()); assert.equal(opened.nlink, 1n); assert.equal(opened.dev, atPath.dev); assert.equal(opened.ino, atPath.ino);
      assertBytesEqual(fs.readFileSync(file), prepared.before, 'Fault target is the nonce-owned recovery copy of exact B');
      const sync = handle.sync.bind(handle);
      handle.sync = async () => {
        await sync(); injected = true; temporary = file;
        if (mode === 'sync-EIO-after-effect') throw Object.assign(new Error('Owned timestamp sync EIO after real fsync'), { code: 'EIO' });
        const later = Math.floor(Date.now() / 1000) + 30; await handle.utimes(later, later);
      };
    }
    return handle;
  };
  syncBuiltinESMExports();
  try { await atRollbackPublication(f, prepared, () => assert.rejects(prepared.app.recover(), { code: mode === 'sync-EIO-after-effect' ? 'EIO' : 'EXTERNAL_EDIT' }), 0); }
  finally { (fs.promises as any).open = originalOpen; syncBuiltinESMExports(); }
  assert(injected && temporary, 'Only the proven owned recovery FD must be faulted');
  assertBytesEqual(fs.readFileSync(prepared.index), prepared.published, 'Failed temporal preparation cannot rename over the live index'); assert.deepEqual(f.statReceipt(prepared.index), publishedStat);
  assertBytesEqual(fs.readFileSync(prepared.plan.backup), backup, 'Unique backup preserved'); assertBytesEqual(fs.readFileSync(temporary), prepared.before, 'Unpublished recovery copy retained');
  assert.notEqual(JSON.parse(fs.readFileSync(prepared.transaction.journal, 'utf8')).state, 'completed');
  assert.equal(fs.readFileSync(path.join(f.repo, prepared.racy), 'utf8'), 'CCCC\n'); assert.equal(f.text(['rev-parse', 'HEAD']), prepared.head);
  const retry = await atRollbackPublication(f, prepared, () => prepared.app.recover()); assert(retry.recovered.includes(prepared.transaction.id)); assertRecovered(f, prepared);
  assert(fs.existsSync(temporary), 'Successful retry does not delete earlier failed evidence');
  f.events.push({ mode, injected: true, unpublishedTemporary: temporary, beforeRetryJournalPending: true, retryRecovered: retry.recovered });
  f.finish();
});
