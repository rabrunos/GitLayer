import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { normalizeProcessEnvironment } from '../../core/platform.js';

const execute = promisify(execFile);

/** A Windows GUI executable cannot supply Node's interactive console handles. */
export async function terminalRuntime(): Promise<string> {
  if (process.platform !== 'win32') return process.execPath;
  const env = normalizeProcessEnvironment(process.env);
  const candidates = [env.LAB_NODE_EXECUTABLE,
    ...(env.PATH ?? '').split(';').map(directory => path.win32.isAbsolute(directory) ? path.join(directory, 'node.exe') : ''),
    ...[env.PROGRAMW6432, env.PROGRAMFILES].filter(Boolean).map(directory => path.join(directory!, 'nodejs/node.exe'))];
  for (const candidate of new Set(candidates)) {
    if (!candidate || !path.isAbsolute(candidate)) continue;
    try {
      if (!(await stat(candidate)).isFile()) continue;
      const { stdout } = await execute(candidate, ['-p', 'JSON.stringify({node:process.versions.node,electron:process.versions.electron})'], { env, windowsHide: true, timeout: 5000 });
      const runtime = JSON.parse(stdout);
      const [major, minor] = String(runtime.node).split('.').map(Number);
      if (!runtime.electron && (major > 22 || (major === 22 && minor >= 12))) return candidate;
    } catch { /* Try the next absolute installed runtime. Never execute a repository script. */ }
  }
  throw new Error('A CLI interativa no Windows exige Node.js 22.12+. Instale-o e reabra o aplicativo, ou defina LAB_NODE_EXECUTABLE com o caminho absoluto de node.exe.');
}
