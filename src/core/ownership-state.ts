import { validatePath, collisionKey } from './paths.js';

/** Optional schema-1 additions. Legacy workspaces without them remain valid. */
export interface EditingOwnership {
  assigned?: string[];
  acceptedBase?: string[];
}
export interface WorkspaceOwnership {
  baseReservations?: string[];
  acknowledgedMissing?: string[];
}
function paths(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  try { return value.every(p => typeof p === 'string' && !!validatePath(p)) && new Set(value.map(collisionKey)).size === value.length; }
  catch { return false; }
}
export function validOwnershipMetadata(workspace: any): boolean {
  if (!workspace || typeof workspace !== 'object') return false;
  for (const key of ['baseReservations', 'acknowledgedMissing']) if (workspace[key] !== undefined && !paths(workspace[key])) return false;
  if (workspace.editing) {
    const editing=workspace.editing;
    if(!paths(editing.before)||editing.unassigned!==undefined&&(!paths(editing.unassigned)||editing.unassigned.some((p:string)=>!editing.before.includes(p))))return false;
    for (const key of ['assigned', 'acceptedBase']) if (workspace.editing[key] !== undefined && !paths(workspace.editing[key])) return false;
    if (workspace.editing.assigned?.some((p: string) => workspace.editing.before?.includes(p))) return false;
  }
  return true;
}
