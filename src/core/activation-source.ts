import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { LabError } from './errors.js';
import { gitText, type RepoInfo } from './git.js';
import { assertNoPathLinks } from './layout.js';
import { observeIndexIdentity, sameIndexIdentity, preserveIndexTimestamp, type IndexIdentity } from './index-timestamp.js';
import { copyRegular, fingerprint, sameFingerprint, type Fingerprint } from './storage.js';

export interface ActivationSource {
  readonly sourceIndex: string;
  readonly index: string;
  readonly tree: string;
  readonly checkpointRef: string;
  readonly initialCheckpoint: string;
  checkpoint: string;
  readonly copyFingerprint: Fingerprint;
  readonly liveFingerprint: Fingerprint;
  revalidate(ownIndexLock?: boolean): Promise<void>;
  verifyCopy(): Promise<void>;
  adoptPublishedIndex(expected: IndexImage): Promise<void>;
}
interface IndexImage { fingerprint: Fingerprint; identity: IndexIdentity }
export interface ActivationIndexBinding extends IndexImage { checkpoint: string }
export const activationChanged = (code: string, reason: string, details: Record<string, unknown> = {}): never => {
  throw new LabError(code, 'A origem da ativação mudou externamente; arquivos, staging e referências desconhecidos foram preservados.', { reason: 'activation-source-changed', boundary: reason, ...details });
};
const codeOf = (error: unknown) => (error as NodeJS.ErrnoException | undefined)?.code;
async function noLock(file: string): Promise<void> {
  await assertNoPathLinks(file);
  try { await fs.lstat(file); } catch (error) { if (codeOf(error) === 'ENOENT') return; throw error; }
  activationChanged('LOCKED', 'native-lock', { path: file });
}
async function image(file: string, ownLock = false): Promise<IndexImage> {
  if (!ownLock) await noLock(file + '.lock');
  const before = await observeIndexIdentity(file), observed = await fingerprint(file), after = await observeIndexIdentity(file);
  if (!before || !after || !observed.exists || !sameIndexIdentity(before, after)) activationChanged('EXTERNAL_INDEX', 'index-observation', { path: file });
  if (!ownLock) await noLock(file + '.lock');
  return { fingerprint: observed, identity: after! };
}
async function sameImage(file: string, expected: IndexImage, ownLock = false): Promise<void> {
  const current = await image(file, ownLock);
  if (!sameFingerprint(current.fingerprint, expected.fingerprint) || !sameIndexIdentity(current.identity, expected.identity)) activationChanged('EXTERNAL_INDEX', 'index-image', { path: file });
}

/**
 * Bind one activation to current refs and a verified independent index image.
 * Only the private image is consumed by checkout/write-tree. Live indices are
 * observations, never a replacement authority after the initial binding.
 */
export async function prepareActivationSource(repo: RepoInfo, sourceIndex: string, layer: { id: string; ref: string; oid: string }, transactionDirectory: string, expected: ActivationIndexBinding, inputIndex = sourceIndex): Promise<ActivationSource> {
  layer = { id: layer.id, ref: layer.ref, oid: layer.oid };
  expected = { checkpoint: expected.checkpoint, fingerprint: { ...expected.fingerprint }, identity: { ...expected.identity } };
  const checkpointRef = 'refs/git-layers/state/' + layer.id;
  const workingRef = 'refs/heads/' + repo.branch;
  const locks = [sourceIndex + '.lock', path.join(repo.commonDir, layer.ref + '.lock'), path.join(repo.commonDir, checkpointRef + '.lock'), path.join(repo.commonDir, 'packed-refs.lock')];
  const refs = async (ownIndexLock = false) => {
    for (const lock of locks.slice(ownIndexLock ? 1 : 0)) await noLock(lock);
    const output = await gitText(repo.root, ['for-each-ref', '--format=%(HEAD)%00%(refname)%00%(objectname)%00%(symref)', layer.ref, checkpointRef, workingRef]);
    const current = new Map(output.split('\n').filter(Boolean).map(line => { const [head, ref, oid, symbolic] = line.split('\0'); return [ref!, { head, oid, symbolic }] as const; }));
    for (const ref of [layer.ref, checkpointRef, workingRef]) if (current.get(ref)?.symbolic) activationChanged('EXTERNAL_REF', 'symbolic-ref', { ref, reason: 'direct-ref-required' });
    if (current.get(layer.ref)?.oid !== layer.oid) activationChanged('EXTERNAL_REF', 'layer-ref', { ref: layer.ref });
    if (current.get(workingRef)?.oid !== repo.head || current.get(workingRef)?.head !== '*') activationChanged('EXTERNAL_HEAD', 'working-head', { ref: workingRef });
    const checkpoint = current.get(checkpointRef)?.oid;
    if (!checkpoint || !/^[a-f0-9]{40,64}$/u.test(checkpoint)) activationChanged('CHECKPOINT_MISMATCH', 'checkpoint-missing', { ref: checkpointRef });
    for (const lock of locks.slice(ownIndexLock ? 1 : 0)) await noLock(lock);
    return checkpoint!;
  };
  const checkpoint = await refs(); let original = await image(sourceIndex);
  if (checkpoint !== expected.checkpoint || !sameFingerprint(original.fingerprint, expected.fingerprint) || !sameIndexIdentity(original.identity, expected.identity)) activationChanged('EXTERNAL_INDEX', 'initial-binding', { path: sourceIndex });
  const input = inputIndex === sourceIndex ? original : await image(inputIndex);
  const index = path.join(transactionDirectory, 'activation-' + randomUUID() + '.index');
  const copied = await copyRegular(inputIndex, index, input.fingerprint.mode);
  if (!sameFingerprint(copied, input.fingerprint)) activationChanged('EXTERNAL_INDEX', 'index-copy', { path: inputIndex });
  const created = await observeIndexIdentity(index);
  if (!created) activationChanged('EXTERNAL_INDEX', 'index-copy-missing', { path: sourceIndex });
  await preserveIndexTimestamp(index, inputIndex, input.identity.mtimeNs, created!, { sync: true });
  await sameImage(sourceIndex, original);
  if (await refs() !== checkpoint) activationChanged('CHECKPOINT_MISMATCH', 'checkpoint-during-copy', { ref: checkpointRef });
  const tree = await gitText(repo.root, ['write-tree'], { index });
  if (inputIndex === sourceIndex && tree !== checkpoint) activationChanged('CHECKPOINT_MISMATCH', 'copied-tree', { expected: checkpoint, observed: tree });
  // Native write-tree may refresh TREE/stat bytes. Re-establish the conservative
  // temporal boundary on that private file before checkout consumes it.
  const written = await observeIndexIdentity(index);
  if (!written) activationChanged('EXTERNAL_INDEX', 'validated-copy-missing', { path: sourceIndex });
  await preserveIndexTimestamp(index, inputIndex, input.identity.mtimeNs, written!, { sync: true });
  const prepared = await image(index);
  const result: ActivationSource = {
    sourceIndex, index, tree, checkpointRef, checkpoint, initialCheckpoint: checkpoint, copyFingerprint: { ...prepared.fingerprint },
    get liveFingerprint() { return { ...original.fingerprint }; },
    async revalidate(ownIndexLock = false) {
      await sameImage(sourceIndex, original, ownIndexLock);
      if (inputIndex !== sourceIndex) await sameImage(inputIndex, input);
      if (await refs(ownIndexLock) !== result.checkpoint) activationChanged('CHECKPOINT_MISMATCH', 'checkpoint-ref', { ref: checkpointRef });
      await sameImage(sourceIndex, original, ownIndexLock);
    },
    async verifyCopy() { await sameImage(index, prepared); },
    async adoptPublishedIndex(expected: IndexImage) {
      expected = { fingerprint: { ...expected.fingerprint }, identity: { ...expected.identity } };
      const current = await image(sourceIndex);
      if (!sameFingerprint(current.fingerprint, expected.fingerprint) || !sameIndexIdentity(current.identity, expected.identity)) activationChanged('EXTERNAL_INDEX', 'published-shelf-index', { path: sourceIndex });
      original = current;
    }
  };
  await result.revalidate(); return result;
}
