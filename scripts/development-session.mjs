import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';

const marker = root => path.join(root, '.workshop/dev-session.json');
export async function ensureNoDevelopmentSession(root) {
  let session;
  try { session = JSON.parse(await readFile(marker(root), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!Number.isSafeInteger(session.parentPid) || session.parentPid <= 0) throw new Error('Registro da sessão de desenvolvimento inválido; preserve-o para inspeção.');
  try { process.kill(session.parentPid, 0); }
  catch (error) { if (error.code === 'ESRCH') return; throw error; }
  throw new Error('Já há uma sessão Dev/Debug neste workshop. Use a janela existente ou feche-a antes de preparar/iniciar outra.');
}
export async function recordDevelopmentSession(root, session) {
  await mkdir(path.dirname(marker(root)), { recursive: true });
  await writeFile(marker(root), JSON.stringify({ ...session, parentPid: process.pid }, null, 2) + '\n');
}
export async function clearDevelopmentSession(root) {
  try {
    const session = JSON.parse(await readFile(marker(root), 'utf8'));
    if (session.parentPid === process.pid) await rm(marker(root));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
