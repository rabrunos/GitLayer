import * as fs from 'node:fs/promises';
import { constants, type BigIntStats } from 'node:fs';
import { LabError } from './errors.js';
import { OPEN_NOFOLLOW } from './platform.js';
import { assertNoPathLinks } from './layout.js';

export interface IndexIdentity {
  dev: string; ino: string; nlink: number; size: number; mode: number;
  mtimeMs: number; ctimeMs: number; mtimeNs: bigint; ctimeNs: bigint;
}
export interface IndexTimestamp {
  sourceMtimeNs: string; requestedMtimeNs: string; observedMtimeNs: string; backwardsShiftNs: string;
}
export interface DurableIndexIdentity { dev: string; ino: string; nlink: 1; size: number; mode: number; mtimeNs: string }
/** ctime is deliberately excluded: native rename can change it without changing the published entry. */
export const durableIndexIdentity = (identity: IndexIdentity): DurableIndexIdentity => ({ dev: identity.dev, ino: identity.ino, nlink: 1, size: identity.size, mode: identity.mode, mtimeNs: identity.mtimeNs.toString() });
export function validDurableIndexIdentity(value: any): value is DurableIndexIdentity {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === 'dev,ino,mode,mtimeNs,nlink,size' &&
    typeof value.dev === 'string' && /^(0|[1-9]\d{0,39})$/u.test(value.dev) && typeof value.ino === 'string' && /^(0|[1-9]\d{0,39})$/u.test(value.ino) && value.nlink === 1 &&
    Number.isSafeInteger(value.size) && value.size >= 0 && Number.isSafeInteger(value.mode) && value.mode >= 0 && value.mode <= 0xffff && (value.mode & 0o170000) === 0o100000 &&
    typeof value.mtimeNs === 'string' && /^[1-9]\d{0,18}$/u.test(value.mtimeNs) && BigInt(value.mtimeNs) >= 1_000_000_000n && BigInt(value.mtimeNs) < 0x1_0000_0000n * 1_000_000_000n;
}
export const matchesDurableIndexIdentity = (expected: DurableIndexIdentity, current: IndexIdentity | null): boolean => current !== null && expected.dev === current.dev && expected.ino === current.ino && expected.nlink === current.nlink && expected.size === current.size && expected.mode === current.mode && expected.mtimeNs === current.mtimeNs.toString();
const codeOf = (error: unknown): string | undefined => (error as NodeJS.ErrnoException | undefined)?.code;
const changed = (file: string, sourceIndex: string, reason: string): never => {
  throw new LabError('EXTERNAL_EDIT', 'A identidade do indice mudou durante a validacao temporal; operacao recusada.', { path: file, sourceIndex, reason });
};
function identityFromStat(stat: BigIntStats): IndexIdentity {
  return { dev: stat.dev.toString(), ino: stat.ino.toString(), nlink: Number(stat.nlink), size: Number(stat.size), mode: Number(stat.mode),
    mtimeMs: Number(stat.mtimeNs) / 1e6, ctimeMs: Number(stat.ctimeNs) / 1e6, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs };
}
export const sameIndexIdentity = (left: IndexIdentity | null, right: IndexIdentity | null): boolean => left === null || right === null ? left === right :
  left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.size === right.size && left.mode === right.mode &&
  left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;

/** Observe an independent regular index without following path links. */
export async function observeIndexIdentity(file: string): Promise<IndexIdentity | null> {
  await assertNoPathLinks(file);
  try {
    const stat = await fs.lstat(file, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n) throw new LabError('UNSAFE_PATH', 'O indice deve ser arquivo regular independente.', { path: file });
    return identityFromStat(stat);
  } catch (error) { if (codeOf(error) === 'ENOENT') return null; throw error; }
}

/**
 * Preserve native Git racy-stat eligibility when index bytes are copied or
 * published. The caller owns the private file and must verify its byte image,
 * source freshness and locks separately. This helper never opens the source.
 * It writes metadata only through a proven FD, and returns the exact observed
 * timestamp/identity for the caller's subsequent optimistic revalidation.
 */
export async function preserveIndexTimestamp(file: string, sourceIndex: string, sourceMtimeNs: bigint, initial: IndexIdentity, options: { sync?: boolean } = {}): Promise<{ identity: IndexIdentity; timestamp: IndexTimestamp }> {
  const sync = options.sync === true;
  const second = 1_000_000_000n, millisecond = 1_000_000n;
  // Git stores cache_time seconds in uint32 and requires timestamp.sec != 0.
  // Round integer nanoseconds down; never let Number/Date round a boundary up.
  if (sourceMtimeNs < second || sourceMtimeNs / second > 0xffff_ffffn) throw new LabError('INDEX_TIMESTAMP_UNSAFE', 'O timestamp de origem nao admite uma copia temporal segura.', { sourceIndex, sourceMtimeNs: sourceMtimeNs.toString() });
  const candidates = [...new Set([
    sourceMtimeNs / 1_000n * 1_000n,
    (sourceMtimeNs / millisecond - 1n) * millisecond,
    (sourceMtimeNs / second - 1n) * second,
  ])].filter(value => value >= second && value <= sourceMtimeNs);
  const observations: Array<{ requestedMtimeNs: string; observedMtimeNs: string }> = [];
  const sameEntry = (left: IndexIdentity, right: IndexIdentity): boolean => left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.size === right.size && left.mode === right.mode;
  // O_NOFOLLOW is used where available. On Windows, prove the opened handle's
  // exact dev/ino and current path before any metadata write. No path-based
  // utimes/chmod can follow a replacement into the live index or another file.
  const handle = await fs.open(file, constants.O_RDWR | OPEN_NOFOLLOW);
  let expected = initial;
  try {
    for (const requested of candidates) {
      const opened = await handle.stat({ bigint: true }), openedIdentity = identityFromStat(opened);
      if (!opened.isFile() || opened.nlink !== 1n || !sameIndexIdentity(expected, openedIdentity)) changed(file, sourceIndex, 'index-identity-changed-before-timestamp');
      const atPath = await observeIndexIdentity(file);
      if (!sameIndexIdentity(expected, atPath)) changed(file, sourceIndex, 'index-identity-changed-before-timestamp');
      const seconds = requested / second, fraction = (requested % second).toString().padStart(9, '0');
      await handle.utimes(new Date(), seconds.toString() + '.' + fraction);
      const actualStat = await handle.stat({ bigint: true }), current = identityFromStat(actualStat), currentPath = await observeIndexIdentity(file);
      if (!actualStat.isFile() || actualStat.nlink !== 1n || !sameEntry(initial, current) || !sameIndexIdentity(current, currentPath)) changed(file, sourceIndex, 'index-identity-changed-during-timestamp');
      expected = current;
      observations.push({ requestedMtimeNs: requested.toString(), observedMtimeNs: current.mtimeNs.toString() });
      // Verify the real filesystem result. A nearby earlier value can add a
      // content recheck, but cannot remove native racy eligibility or invent M.
      if (current.mtimeNs >= second && current.mtimeNs <= sourceMtimeNs) {
        if (sync) {
          // Recovery publication needs this metadata durable before rename.
          // Sync the same proven descriptor, then reject changes during sync.
          await handle.sync();
          const synced = await handle.stat({ bigint: true }), syncedPath = await observeIndexIdentity(file);
          if (!synced.isFile() || synced.nlink !== 1n || !sameIndexIdentity(current, identityFromStat(synced)) || !sameIndexIdentity(current, syncedPath)) changed(file, sourceIndex, 'index-identity-changed-during-sync');
        }
        return { identity: current, timestamp: {
          sourceMtimeNs: sourceMtimeNs.toString(), requestedMtimeNs: requested.toString(), observedMtimeNs: current.mtimeNs.toString(), backwardsShiftNs: (sourceMtimeNs - current.mtimeNs).toString()
        } };
      }
    }
    throw new LabError('INDEX_TIMESTAMP_UNSAFE', 'O filesystem nao confirmou um timestamp seguro para o indice.', { sourceIndex, sourceMtimeNs: sourceMtimeNs.toString(), observations });
  } finally { await handle.close(); }
}
