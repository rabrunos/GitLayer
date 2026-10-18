import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import os from 'node:os';
import extract from '@electron-internal/extract-zip';

const input = process.argv[2];
if (!input || input.startsWith('-')) {
  console.error('Uso: npm run verify:extracted -- /caminho/git-layers-lab.zip');
  console.error('Extrai o ZIP, executa npm ci, build, CLI pelo Git, demo e doctor reais em diretório temporário. O teste gráfico separado é npm run test:e2e.');
  process.exit(2);
}
const temporary = await mkdtemp(join(os.tmpdir(), 'git-layers-extracted-'));
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' };
for (const key of Object.keys(env)) if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT)$/.test(key)) delete env[key];
const milestones = [];
function run(label, args, cwd, extraEnv = {}) {
  console.log(`\nVerificação: ${label}`);
  const result = spawnSync(process.execPath, args, { cwd, env: { ...env, ...extraEnv }, stdio: 'inherit', shell: false, timeout: 240_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label}: código ${result.status ?? result.signal}`);
  milestones.push(label);
}
try {
  await extract(resolve(input), { dir: temporary });
  let project;
  for (const folder of ['git-layers-lab-workshop', 'git-layers-lab']) {
    const candidate = join(temporary, folder);
    try { await access(join(candidate, 'package-lock.json')); project = candidate; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!project) throw new Error('O ZIP não contém git-layers-lab-workshop ou git-layers-lab com package-lock.json.');
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error('Execute pelo script npm run verify:extracted, para localizar o npm de forma portátil.');
  run('npm ci a partir do lockfile entregue', [npm, 'ci', '--no-audit', '--no-fund'], project);
  run('build da cópia extraída', [npm, 'run', 'build'], project);
  run('ajuda da CLI compilada', ['dist/cli/index.js', '--help'], project);
  run('gerar launchers locais sem instalação global', ['scripts/local-cli.mjs'], project);
  const demo = join(temporary, 'demo');
  run('demonstração real descartável', ['--import', 'tsx', 'scripts/demo.ts', demo], project);
  // Git discovers an external git-layer executable through PATH, without changing Git itself.
  const extension = spawnSync('git', ['layer', '--cwd', demo, 'doctor', '--json'], { cwd: project, env: { ...env, PATH: join(project, '.local-bin') + (process.platform === 'win32' ? ';' : ':') + env.PATH }, encoding: 'utf8', shell: false, timeout: 60_000 });
  if (extension.error) throw extension.error;
  if (extension.status !== 0) throw new Error(`git layer doctor: ${extension.stderr || extension.stdout}`);
  const evidence = JSON.parse(extension.stdout);
  if (evidence.ok !== true) throw new Error('doctor não confirmou o resultado da CLI.');
  const report = evidence.result;
  if (report?.safe !== true) throw new Error(`Demonstração falhou no doctor: ${extension.stdout}`);
  console.log(extension.stdout);
  milestones.push('git layer doctor --json com PATH local e Git real');
  console.log(JSON.stringify({ ok: true, milestones, gui: 'Não executada por este script; utilize npm run test:e2e em sessão gráfica com sandbox.' }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
