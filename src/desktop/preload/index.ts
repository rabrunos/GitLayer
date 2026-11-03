import { contextBridge, ipcRenderer } from 'electron';
import type { APIResult, LabAPI, TerminalData, TerminalExit } from '../shared.js';

// No ipcRenderer object, filesystem primitive, arbitrary channel or Node object crosses this bridge.
const allowed = new Set(['runtime', 'open', 'initialize', 'demo', 'enableLayers', 'snapshot', 'read', 'write', 'mkdir', 'rename', 'delete', 'createLayer', 'registerLayer', 'activate', 'deactivate', 'stage', 'unstage', 'commit', 'diff', 'hunks', 'stageHunk', 'unstageHunk', 'restore', 'log', 'show', 'compare', 'captureStart', 'captureReview', 'captureConfirm', 'captureCancel', 'branches', 'branchCreate', 'branchDelete', 'switch', 'doctor', 'recover', 'identity', 'drafts', 'draftSave', 'draftRemove', 'dirty', 'closeReady', 'exportRecovery', 'advanced', 'terminalOpen', 'terminalWrite', 'terminalState', 'terminalResize', 'terminalClose', 'copyCommand', 'copyRelativePath']);
const api: LabAPI = Object.freeze({
  call: async (action: string, args: unknown = {}): Promise<APIResult> => {
    if (!allowed.has(action)) return { ok: false, error: { code: 'IPC_ACTION', message: 'Operação IPC não permitida.' } };
    return ipcRenderer.invoke('lab:request', action, args) as Promise<APIResult>;
  },
  onChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('lab:changed', listener);
    return () => ipcRenderer.removeListener('lab:changed', listener);
  },
  onBeforeClose: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('lab:before-close', listener);
    return () => ipcRenderer.removeListener('lab:before-close', listener);
  },
  onTerminalData: (callback: (event: TerminalData) => void) => {
    const listener = (_event: unknown, payload: TerminalData) => callback(payload);
    ipcRenderer.on('lab:terminal-data', listener);
    return () => ipcRenderer.removeListener('lab:terminal-data', listener);
  },
  onTerminalExit: (callback: (event: TerminalExit) => void) => {
    const listener = (_event: unknown, payload: TerminalExit) => callback(payload);
    ipcRenderer.on('lab:terminal-exit', listener);
    return () => ipcRenderer.removeListener('lab:terminal-exit', listener);
  }
});
contextBridge.exposeInMainWorld('lab', api);
