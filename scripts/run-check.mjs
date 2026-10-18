import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess } from './workshop.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [name, ...extra] = process.argv.slice(2);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const script = pkg.scripts[name];
// Existing project scripts use separate plain arguments, without shell syntax.
// Do not delegate to PowerShell/npm.ps1 or silently interpret shell operators.
if (!script || /[|&;"'`\r\n]/u.test(script) || !(script.startsWith('node ') || name === 'typecheck')) throw new Error('Verificação sem comando Node direto: ' + name);
const args = name === 'typecheck' ? ['node_modules/typescript/bin/tsc', '--noEmit', ...extra] : [...script.slice(5).split(' '), ...extra];
const startedAt = new Date().toISOString();
const result = await runProcess(process.execPath, args, { root });
const reports = path.join(root, '.workshop/reports'); await mkdir(reports, { recursive: true });
const file = 'check-' + name.replaceAll(':', '-');
await writeFile(path.join(reports, file + '.stdout.log'), result.stdout);
await writeFile(path.join(reports, file + '.stderr.log'), result.stderr);
const { stdout, stderr, ...outcome } = result;
await writeFile(path.join(reports, file + '.json'), JSON.stringify({ name, command: [process.execPath, ...args], cwd: root, startedAt, finishedAt: new Date().toISOString(), platform: process.platform, arch: process.arch, ...outcome }, null, 2) + '\n');
process.exitCode = result.exitCode ?? 1;
