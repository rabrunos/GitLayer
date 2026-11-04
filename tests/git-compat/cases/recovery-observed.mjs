import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pauseCore } from '../helpers/inspector.mjs';

const trim = r => r.stdout.trim();
const gt = async (c, args, options) => trim(await c.git(args, options));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const parseCLI = result => JSON.parse((result.stdout || result.stderr));
const registry = c => JSON.parse(c.read('.git/layers/registry.json'));
const lockPath = c => path.join(c.repo, '.git/layers/locks/coordinator');
const ownerPath = c => path.join(lockPath(c), 'owner.json');
const indexPath = c => path.join(c.repo, '.git/layers/indexes', registry(c).layers[0].id + '.index');
function journal(c, paused) {
  const id = paused.state.transaction?.id; c.ok('Observed transaction id is a fixture UUID', typeof id === 'string' && /^[a-f\d-]{36}$/.test(id));
  const file = path.join(c.repo, '.git/layers/transactions', id, 'journal.json'); return { file, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
}
function lockOwnedBy(c, paused) { const owner = JSON.parse(fs.readFileSync(ownerPath(c), 'utf8')); c.eq('Lock owner is the exclusive paused child', owner.pid, paused.pid); return sha(ownerPath(c)); }
async function orphanRefusal(c, ownerHash) {
  c.ok('Real abrupt death leaves coordinator lock', fs.existsSync(ownerPath(c))); const result = await c.cli(['recover'], { ok: [3] }); const body = parseCLI(result); c.eq('Subsequent recover conservatively refuses orphan lock', body.error.code, 'LOCKED'); c.eq('Refusal never removes or rewrites orphan ownership', sha(ownerPath(c)), ownerHash); const doctor = parseCLI(await c.cli(['doctor'], { ok: [3] })); c.eq('Pending interrupted operation never diagnosed healthy', doctor.result.safe, false); return { code: body.error.code, doctor: doctor.result };
}
async function twoFilesInactive(c) {
  await c.init(); await c.layer('tools', 'a-layer.txt', 'A layer\n'); c.write('b-layer.txt', 'B layer\n'); await c.cli(['add', 'tools', '--', 'b-layer.txt']); await c.cli(['commit', 'tools', '-m', 'second file']); await c.cli(['off', 'tools']); c.ok('Inactive setup has no projected files', !c.exists('a-layer.txt') && !c.exists('b-layer.txt'));
}
async function pauseFirstPublished(c, label) {
  const paused = await pauseCore(c, { method: 'on', args: ['tools'], needle: '    if (expected && !sameFingerprint(current, expected))', condition: 'file.endsWith("a-layer.txt")', label });
  const durable = journal(c, paused); c.ok('First materialization is recorded durably', durable.value.steps.some(step => step.step === 'write-completed' && step.details?.path.endsWith('a-layer.txt'))); c.eq('First projected bytes have been published', c.read('a-layer.txt'), 'A layer\n'); c.ok('Second projected path is still absent at barrier', !c.exists('b-layer.txt')); c.eq('On-disk registry has not falsely published active state', registry(c).layers[0].state, 'inactive'); return paused;
}
const spec = (id, variant, title, run, limits, productStatus = 'DOCUMENTED_RESTRICTION') => ({ id, variant, title, profile: 'L1', tier: 'broad', phase: 'CURRENT_PRODUCT', productStatus, capabilities: ['node'], timeout: 240000, async run(c) { const outcome = await run(c); return { ...outcome, limits: [...limits, ...(outcome?.limits ?? [])] }; } });

export const cases = [
  spec('RECOVERY-001', 'two-writers-observed-barrier', 'A real paused managed writer holds its lock while the second writer is refused', async c => {
    await c.init(); await c.layer(); c.write('layer.txt', 'B stage candidate\n'); const ref = await gt(c, ['rev-parse', 'layer/tools']), before = (await c.git(['ls-files', '--stage', '-z'], { env: { GIT_INDEX_FILE: indexPath(c) } })).stdout;
    const paused = await pauseCore(c, { method: 'add', args: ['tools', ['layer.txt']], locator: { method: 'mutateLocked', line: /^\s*if \(options\.reconcile !== false\) await this\.syncEditingInternal\(\);\s*$/, before: [/this\.tx = await Transaction\.begin\(/, /this\.tx\.data\.recovery = /, /await this\.tx\.record\("prepared"\)/], lookback: 12 }, label: 'writer-prepared' });
    try {
      lockOwnedBy(c, paused); const durable = journal(c, paused); c.eq('First writer transaction is staging', durable.value.kind, 'stage'); c.ok('First writer prepared journal is durable', durable.value.steps.some(s => s.step === 'prepared'));
      const other = parseCLI(await c.cli(['add', 'tools', '--', 'layer.txt'], { ok: [3] })); c.eq('Second managed writer refused while first is paused', other.error.code, 'LOCKED'); c.eq('Refused writer does not stage a subset', (await c.git(['ls-files', '--stage', '-z'], { env: { GIT_INDEX_FILE: indexPath(c) } })).stdout, before); c.eq('Neither stage attempt silently creates a commit', await gt(c, ['rev-parse', 'layer/tools']), ref);
      await paused.resume(); c.eq('First writer alone publishes intended staging', (await c.git(['show', ':layer.txt'], { env: { GIT_INDEX_FILE: indexPath(c) } })).stdout, 'B stage candidate\n'); c.eq('Stage leaves ref unchanged', await gt(c, ['rev-parse', 'layer/tools']), ref); c.ok('Normal completion releases its own lock', !fs.existsSync(lockPath(c))); c.eq('Post-completion status healthy', parseCLI(await c.cli(['status'])).result.safe, true);
    } finally { await paused.dispose(); }
  }, ['One deterministic staging interleaving, two real processes and a verified debugger barrier. Does not certify arbitrary concurrent commands or Git external writers.'], 'VERIFIED_SUPPORTED'),
  spec('RECOVERY-002', 'reader-during-observed-materialization', 'A reader sees a real partial projection as unsafe while its writer is paused', async c => {
    await twoFilesInactive(c); const ref = await gt(c, ['rev-parse', 'layer/tools']); const paused = await pauseFirstPublished(c, 'reader-partial-projection');
    try {
      lockOwnedBy(c, paused); const status = parseCLI(await c.cli(['status'])); c.eq('Reader does not claim health for a hybrid physical state', status.result.safe, false); c.eq('Reader identifies the pending transaction', status.result.error.code, 'RECOVERY_REQUIRED'); const doctor = parseCLI(await c.cli(['doctor'], { ok: [3] })); c.eq('Doctor reports unsafe transition', doctor.result.safe, false); c.eq('Base physical bytes protected during transition', c.read('base.txt'), 'base one\n');
      await paused.resume(); c.eq('Writer completes first path', c.read('a-layer.txt'), 'A layer\n'); c.eq('Writer completes second path', c.read('b-layer.txt'), 'B layer\n'); c.eq('Reader becomes healthy after actual publication', parseCLI(await c.cli(['status'])).result.safe, true); c.eq('Activation does not create a commit', await gt(c, ['rev-parse', 'layer/tools']), ref);
    } finally { await paused.dispose(); }
  }, ['One reader checkpoint after the first of two files is durably published. No general linearizability proof, no claim that every filesystem observation is an atomic snapshot.'], 'VERIFIED_SUPPORTED'),
  spec('RECOVERY-005', 'real-death-after-backup-before-unlink', 'Abrupt death after durable backup leaves the original file and an orphan lock', async c => {
    await c.init(); await c.layer(); const original = sha(path.join(c.repo, 'layer.txt')), ref = await gt(c, ['rev-parse', 'layer/tools']);
    const paused = await pauseCore(c, { method: 'off', args: ['tools'], locator: { method: 'remove', line: /^\s*await [\w$]+\.unlink\(file\);\s*$/, before: [/await this\.track\(file\)/, /sameFingerprint\(planned,/] }, condition: 'file.endsWith("layer.txt")', label: 'backup-before-unlink' });
    try {
      const ownerHash = lockOwnedBy(c, paused), durable = journal(c, paused); const backup = durable.value.backups.find(b => b.source === path.join(c.repo, 'layer.txt'));
      c.ok('Durable backup record points within owned fixture', backup?.copy && path.relative(c.root, backup.copy) !== '..' && !path.relative(c.root, backup.copy).startsWith('..' + path.sep)); c.eq('Backup bytes equal independently hashed source', sha(backup.copy), original); c.ok('Backup-ready step exists before mutation', durable.value.steps.some(s => s.step === 'backup-ready' && s.details?.path.endsWith('layer.txt'))); c.eq('Original file still present before unlink', sha(path.join(c.repo, 'layer.txt')), original); await c.snapshot('paused-after-backup');
      await paused.kill(); c.eq('Death before unlink preserves source bytes', sha(path.join(c.repo, 'layer.txt')), original); c.eq('Death does not rewind or advance Layer ref', await gt(c, ['rev-parse', 'layer/tools']), ref); c.eq('Journal remains pending after death', JSON.parse(fs.readFileSync(durable.file, 'utf8')).state, 'pending'); await orphanRefusal(c, ownerHash); c.eq('Backup remains available after refused recovery', sha(backup.copy), original);
    } finally { await paused.dispose(); }
  }, ['One observed boundary after backup-ready and immediately before the first unlink; not all write positions. Real SIGKILL is distinct from a failpoint. Orphan lock is never removed to force recovery; automatic rescue remains unproven.']),
  spec('RECOVERY-006', 'real-death-after-layer-ref-publication', 'Abrupt death after update-ref retains the new commit and pending durable recovery data', async c => {
    await c.init(); await c.layer(); c.write('layer.txt', 'B new commit\n'); await c.cli(['add', 'tools', '--', 'layer.txt']); const old = await gt(c, ['rev-parse', 'layer/tools']), base = await gt(c, ['rev-parse', 'HEAD']);
    const paused = await pauseCore(c, { method: 'commit', args: ['tools', 'observed interrupted commit'], locator: { method: 'commit', line: /^\s*[\w$]+\.oid = [\w$]+;\s*$/, before: [/\.record\("commit-ref-updated"/, /failpoint\("after-commit-ref"/] }, label: 'ref-published-before-metadata', expression: '({transaction:this.tx?.data,resources:process.getActiveResourcesInfo(),newOid:this.tx.data.recovery.commit.new,oldOid:this.registry.layers.find(layer=>layer.id===this.tx.data.recovery.commit.layerId)?.oid,ref:this.tx.data.recovery.commit.ref})' });
    try {
      const ownerHash = lockOwnedBy(c, paused), durable = journal(c, paused); c.eq('Prior in-memory OID still old at publication barrier', paused.state.oldOid, old); c.eq('Native Git independently sees the already published ref', await gt(c, ['rev-parse', 'layer/tools']), paused.state.newOid); c.ok('Durable journal records successful ref update', durable.value.steps.some(s => s.step === 'commit-ref-updated' && s.details?.oid === paused.state.newOid)); c.eq('Registry has not yet been saved to new OID', registry(c).layers[0].oid, old); c.eq('Journal proposed commit exact', durable.value.recovery.commit.new, paused.state.newOid); await c.snapshot('paused-after-ref-update');
      await paused.kill(); c.eq('New commit remains reachable after abrupt death', await gt(c, ['rev-parse', 'layer/tools']), paused.state.newOid); c.eq('New tree contains the intended staged bytes', (await c.git(['show', 'layer/tools:layer.txt'])).stdout, 'B new commit\n'); c.eq('Traditional HEAD preserved', await gt(c, ['rev-parse', 'HEAD']), base); await orphanRefusal(c, ownerHash); c.eq('Ref remains new after refused recovery', await gt(c, ['rev-parse', 'layer/tools']), paused.state.newOid);
    } finally { await paused.dispose(); }
  }, ['One post-update-ref/post-journal checkpoint before in-memory OID assignment and registry publication. No failpoint environment is enabled and no exception is injected. Recovery completion is blocked by the retained orphan lock and is not certified.']),
  spec('RECOVERY-007', 'real-death-after-first-materialized-file', 'Abrupt death during real materialization leaves a durable partial projection and unsafe diagnostics', async c => {
    await twoFilesInactive(c); const ref = await gt(c, ['rev-parse', 'layer/tools']); const paused = await pauseFirstPublished(c, 'death-after-first-published-file');
    try {
      const ownerHash = lockOwnedBy(c, paused), durable = journal(c, paused); await c.snapshot('paused-partial-materialization'); await paused.kill(); c.eq('First published bytes retained after death', c.read('a-layer.txt'), 'A layer\n'); c.ok('Second path remains unpublished after death', !c.exists('b-layer.txt')); c.eq('Layer history preserved', await gt(c, ['rev-parse', 'layer/tools']), ref); c.eq('Pending durable transaction retained', JSON.parse(fs.readFileSync(durable.file, 'utf8')).state, 'pending'); await orphanRefusal(c, ownerHash); c.eq('Base bytes remain intact', c.read('base.txt'), 'base one\n'); c.eq('Refused recovery does not erase first published file', c.read('a-layer.txt'), 'A layer\n');
    } finally { await paused.dispose(); }
  }, ['Only k=1 of two projected files is interrupted. Partial publication is explicitly observed, not mislabeled atomic. All k positions, automatic resume/rollback and edits after interruption remain separate unproven dimensions.']),
];
