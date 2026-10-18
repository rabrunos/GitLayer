export interface FileEntry { path: string; owner: string | null }
export interface Change { path: string; status: string }
export interface GroupStatus { staged: Change[]; unstaged: Change[]; name?: string; state?: string }
export interface LayerEntry { id: string; name: string; ref: string; oid: string; state: string; reservations: string[] }
export interface RepoSnapshot {
  repo: { root: string; gitDir: string; head: string; branch: string };
  layers: LayerEntry[]; candidates: string[]; files: FileEntry[];
  directories?: string[];
  gitActivity?: { at: string; command: string[]; code: number; stderr: string; durationMs: number }[];
  status: { base: GroupStatus; layers: GroupStatus[]; untracked: string[]; safe?: boolean; error?: { code?: string; message?: string } };
  branches: unknown; capture?: unknown;
}
export interface ReadResult { text: string; hash: string; binary: boolean; size: number; eol: string; readOnly?: boolean }
export interface Draft { schema: 1; path: string; text: string; hash: string; eol: string; savedAt: string }
export interface APIResult { ok: boolean; data?: unknown; error?: { code: string; message: string; details?: unknown } }
export interface RuntimeStatus {
  platform: string; arch: string; appVersion: string; packaged: boolean;
  target: string; repositoryOpen: boolean; startupError?: string;
  git: { available: boolean; executable?: string; version?: string; error?: string; errorCode?: string };
}
export interface TerminalState {
  sessionId: string; shell: 'powershell' | 'bash'; cwd: string;
  cols: number; rows: number; history: string;
  status: 'starting' | 'prompt' | 'busy' | 'exited'; inputDirty: boolean;
}
export interface TerminalData {
  sessionId: string; data: string; status?: TerminalState['status']; inputDirty?: boolean;
}
export interface TerminalExit { sessionId: string; exitCode: number; signal?: number }
export interface LabAPI {
  call(action: string, args?: unknown): Promise<APIResult>;
  onChanged(callback: () => void): () => void;
  onBeforeClose(callback: () => void): () => void;
  onTerminalData(callback: (event: TerminalData) => void): () => void;
  onTerminalExit(callback: (event: TerminalExit) => void): () => void;
}
declare global { interface Window { lab: LabAPI } }
