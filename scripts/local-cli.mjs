#!/usr/bin/env node
import { mkdir, writeFile, chmod, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(project, 'dist', 'cli', 'index.js');
try {
  await access(cli);
  const target = join(project, '.local-bin');
  await mkdir(target, { recursive: true });
  const unixLauncher = join(target, 'git-layer');
  await writeFile(unixLauncher, "#!/usr/bin/env node\nimport { runCli } from '../dist/cli/index.js';\nprocess.exitCode = await runCli();\n", 'utf8');
  await chmod(unixLauncher, 0o755);
  await writeFile(join(target, 'git-layer.cmd'), '@echo off\r\nnode "%~dp0..\\dist\\cli\\index.js" %*\r\n', 'utf8');
  process.stdout.write(`Launchers locais criados em ${target}\n`);
  if (process.platform === 'win32') process.stdout.write(`PowerShell (somente este terminal): $env:Path = '${target.replaceAll("'", "''")};' + $env:Path\n`);
  else process.stdout.write(`Neste terminal: export PATH='${target.replaceAll("'", "'\\''")}':"$PATH"\n`);
  process.stdout.write('Depois: git layer -h (ou git-layer --help)\nNenhuma instalação global foi feita.\n');
} catch (error) {
  process.stderr.write(`Não foi possível preparar a CLI local: ${error instanceof Error ? error.message : String(error)}\nExecute npm run build primeiro.\n`);
  process.exitCode = 1;
}
