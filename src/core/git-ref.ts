import { git, gitText, type GitResult } from './git.js';
import { LabError } from './errors.js';

export type DirectRefOperation =
  | { kind: 'update'; ref: string; newOid: string; oldOid?: string }
  | { kind: 'create'; ref: string; newOid: string }
  | { kind: 'verify'; ref: string; oldOid?: string }
  | { kind: 'delete'; ref: string; oldOid?: string };

const invalid = (): never => { throw new LabError('INVALID_ARGUMENT', 'Operação de referência direta inválida.'); };
const oid = (value: unknown): value is string => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value);

/** Native Git owns ref storage and locks. An observed alias is never dereferenced or replaced. */
export async function updateDirectRefs(root: string, operations: readonly DirectRefOperation[], message?: string): Promise<GitResult> {
  // Clone every primitive before the first await; the caller cannot alter the
  // queued operation or its identity while native preparation is in flight.
  if (!Array.isArray(operations) || !operations.length || message !== undefined && (typeof message !== 'string' || message.includes('\0'))) invalid();
  const refs = new Set<string>();
  const planned = operations.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !['update', 'create', 'verify', 'delete'].includes(value.kind) || typeof value.ref !== 'string' || !value.ref.startsWith('refs/') || /[\u0000-\u0020\u007f]/u.test(value.ref) || refs.has(value.ref)) invalid();
    const allowed = value.kind === 'update' ? ['kind', 'ref', 'newOid', 'oldOid'] : value.kind === 'create' ? ['kind', 'ref', 'newOid'] : ['kind', 'ref', 'oldOid'];
    if (Object.keys(value).some(key => !allowed.includes(key))) invalid();
    const next = value.kind === 'update' || value.kind === 'create' ? value.newOid : undefined;
    const previous = value.kind !== 'create' ? value.oldOid : undefined;
    if (next !== undefined && !oid(next) || next === undefined && (value.kind === 'update' || value.kind === 'create') || previous !== undefined && previous !== '' && !oid(previous)) invalid();
    refs.add(value.ref); return { kind: value.kind, ref: value.ref, newOid: next, oldOid: previous };
  });
  const lengths = new Set(planned.flatMap(op => [op.newOid, op.oldOid].filter((value): value is string => !!value).map(value => value.length)));
  if (lengths.size > 1) invalid();
  let width = lengths.values().next().value as number | undefined;
  if (width === undefined && planned.some(op => op.oldOid === '')) {
    const format = await gitText(root, ['rev-parse', '--show-object-format']);
    if (format !== 'sha1' && format !== 'sha256') invalid(); width = format === 'sha1' ? 40 : 64;
  }
  const old = (value: string | undefined) => value === undefined ? '' : ' ' + (value === '' ? '0'.repeat(width!) : value);
  const lines = planned.map(op => op.kind === 'create' ? 'create ' + op.ref + ' ' + op.newOid : op.kind === 'update' ? 'update ' + op.ref + ' ' + op.newOid + old(op.oldOid) : op.kind + ' ' + op.ref + old(op.oldOid));
  return git(root, ['update-ref', '--no-deref', '--stdin', ...(message === undefined ? [] : ['-m', message])], {
    input: 'start\n' + lines.join('\n') + '\nprepare\n',
    afterPrepare: async () => {
      for (const op of planned) {
        const observed = await git(root, ['symbolic-ref', '--quiet', '--no-recurse', op.ref], { ok: [0, 1] });
        if (observed.code === 0) throw new LabError('EXTERNAL_REF', 'A referência deve ser direta; alias e destino foram preservados.', { reason: 'direct-ref-required', ref: op.ref, target: observed.stdout.toString('utf8').trimEnd() });
      }
    },
  });
}

export function updateDirectRef(root: string, ref: string, newOid: string, oldOid?: string): Promise<GitResult> {
  return updateDirectRefs(root, [{ kind: 'update', ref, newOid, ...(oldOid === undefined ? {} : { oldOid }) }]);
}
export function deleteDirectRef(root: string, ref: string, oldOid?: string): Promise<GitResult> {
  return updateDirectRefs(root, [{ kind: 'delete', ref, ...(oldOid === undefined ? {} : { oldOid }) }]);
}