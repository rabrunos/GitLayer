import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GitLayers } from './index.js';
import { DISABLED_GIT_HOOKS, normalizeProcessEnvironment, resolveGitExecutable } from './platform.js';

const execFileAsync = promisify(execFile);

async function fixtureGit(root: string, args: string[]): Promise<string> {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(normalizeProcessEnvironment(process.env))) {
    if (!key.toUpperCase().startsWith('GIT_')) env[key] = value;
  }
  env.GIT_CONFIG_NOSYSTEM = '1';
  // Git for Windows accepts /dev/null, but rejects Node's \\.\nul spelling
  // when opening a config file. Keep the demo isolated from global config.
  env.GIT_CONFIG_GLOBAL = '/dev/null';
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_OPTIONAL_LOCKS = '0';
  env.GIT_NO_LAZY_FETCH = '1';
  const { stdout } = await execFileAsync(await resolveGitExecutable(env), [
    '-c', 'core.hooksPath=' + DISABLED_GIT_HOOKS,
    '-c', 'core.fsmonitor=false',
    '-c', 'commit.gpgsign=false',
    '-c', 'tag.gpgsign=false',
    '-c', 'maintenance.auto=false',
    '-c', 'gc.auto=0',
    ...args,
  ], { cwd: root, env, shell: false, timeout: 30_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', windowsHide: true });
  return stdout;
}

/** Creates only a new/empty directory explicitly chosen by the caller. */
export async function createDemo(destination: string): Promise<{ root: string; head: string; layers: unknown; guide: string }> {
  const root = resolve(destination);
  // Check every existing ancestor before creating anything through that path.
  let ancestor = root;
  for (;;) {
    try {
      const info = await lstat(ancestor);
      if (info.isSymbolicLink()) throw new Error(`O destino atravessa link simbólico: ${ancestor}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const next = resolve(ancestor, '..');
    if (next === ancestor) break;
    ancestor = next;
  }
  try {
    const existing = await lstat(root);
    if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error('O destino precisa ser uma pasta real, sem links.');
    if ((await readdir(root)).length !== 0) throw new Error(`A pasta não está vazia; nenhum conteúdo será sobrescrito: ${root}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(root, { recursive: true });
  }
  await fixtureGit(root, ['init', '--initial-branch=main']);
  await fixtureGit(root, ['config', '--local', 'user.name', 'Git Layers Lab Demo']);
  await fixtureGit(root, ['config', '--local', 'user.email', 'demo@example.invalid']);
  await fixtureGit(root, ['config', '--local', 'core.autocrlf', 'false']);
  await fixtureGit(root, ['config', '--local', 'commit.gpgsign', 'false']);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'README.md'), '# Git Layers Lab — demonstração descartável\n\nRepositório local de teste, sem remotos. Consulte docs/DEMO.md no projeto do aplicativo.\n', 'utf8');
  await writeFile(join(root, 'src/app.ts'), 'export function welcome(name: string): string {\n  return `Olá, ${name}!`;\n}\n', 'utf8');
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'git-layers-demo', private: true, version: '0.0.0', description: 'Dados de demonstração; nenhum script é executado automaticamente.' }, null, 2) + '\n', 'utf8');
  await fixtureGit(root, ['--literal-pathspecs', 'add', '--', 'README.md', 'src/app.ts', 'package.json']);
  await fixtureGit(root, ['commit', '-m', 'Base inicial da demonstração']);

  await fixtureGit(root, ['switch', '-c', 'dev']);
  await writeFile(join(root, 'src/app.ts'), 'export function welcome(name: string): string {\n  return `Olá, ${name}! Bem-vindo à branch dev.`;\n}\n', 'utf8');
  await fixtureGit(root, ['--literal-pathspecs', 'add', '--', 'src/app.ts']);
  await fixtureGit(root, ['commit', '-m', 'Variação compatível da base']);
  await fixtureGit(root, ['switch', 'main']);

  await fixtureGit(root, ['switch', '-c', 'collision-demo']);
  await mkdir(join(root, 'scripts'));
  await writeFile(join(root, 'scripts/debug.py'), '# Este arquivo pertence à BASE nesta branch e colide com a Layer scripts.\nprint("colisão intencional")\n', 'utf8');
  await fixtureGit(root, ['--literal-pathspecs', 'add', '--', 'scripts/debug.py']);
  await fixtureGit(root, ['commit', '-m', 'Colisão intencional para demonstrar recusa segura']);
  await fixtureGit(root, ['switch', 'main']);

  await GitLayers.init(root);
  const core = await GitLayers.open(root);
  await core.create('ai');
  await core.create('scripts');
  await core.on('ai');
  await core.on('scripts');
  await mkdir(join(root, '.codex'), { recursive: true });
  await writeFile(join(root, 'AGENTS.md'), '# Instruções locais de exemplo\n\nEste conteúdo pertence à Layer ai.\n', 'utf8');
  await writeFile(join(root, '.codex/config.toml'), '# Exemplo inerte: o aplicativo não executa configurações do repositório.\n[lab]\nenabled = true\n', 'utf8');
  await core.add('ai', ['AGENTS.md', '.codex/config.toml']);
  await core.commit('ai', 'Arquivos próprios da Layer ai');
  await mkdir(join(root, 'scripts'), { recursive: true });
  await mkdir(join(root, 'tools'), { recursive: true });
  await writeFile(join(root, 'scripts/debug.py'), '# Arquivo de exemplo da Layer scripts; não executado pelo aplicativo.\nprint("debug local")\n', 'utf8');
  await writeFile(join(root, 'tools/analyze.py'), '# Arquivo de exemplo da Layer scripts; não executado pelo aplicativo.\ndef analyze(value):\n    return {"length": len(value)}\n', 'utf8');
  await core.add('scripts', ['scripts/debug.py', 'tools/analyze.py']);
  await core.commit('scripts', 'Ferramentas próprias da Layer scripts');
  const head = (await fixtureGit(root, ['symbolic-ref', '--short', 'HEAD'])).trim();
  if (head !== 'main') throw new Error(`A demonstração terminou em uma branch inesperada: ${head}`);
  return { root, head, layers: await core.list(), guide: 'Abra esta pasta no Git Layers Lab. Consulte docs/DEMO.md para edição, staging, captura, shelves e colisão.' };
}

