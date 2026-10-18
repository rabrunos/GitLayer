import { spawnSync } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ensureNoDevelopmentSession } from './development-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await ensureNoDevelopmentSession(root);
// Invoke npm's JS entry directly: PowerShell may block npm.ps1.
const require = createRequire(import.meta.url);
const candidates = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')].filter(Boolean);
let npm;
for (const candidate of candidates) {
  try { await access(candidate); npm = candidate; break; } catch { /* Try beside Node. */ }
}
if (!npm) throw new Error('npm-cli.js não encontrado. Instale Node.js 22.12+ com npm.');
const env = { ...process.env, npm_config_cache: path.join(root, '.workshop/npm-cache'), electron_config_cache: path.join(root, '.workshop/electron-cache') };
await mkdir(env.npm_config_cache, { recursive: true });
const installed = spawnSync(process.execPath, [npm, 'ls', '--depth=0', '--json'], { cwd: root, env, encoding: 'utf8', windowsHide: true });
let electronReady = false;
try { await access(require('electron')); electronReady = true; } catch { /* Repair incomplete install. */ }
if (installed.status !== 0 || !electronReady || process.argv.includes('--install')) {
  console.log('Instalando as versões do lockfile com caches locais...');
  const result = spawnSync(process.execPath, [npm, 'ci', '--no-fund'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
} else console.log('Dependências e runtime presentes; instalação preservada.');
const result = spawnSync(process.execPath, ['scripts/workshop.mjs', 'prepare'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
