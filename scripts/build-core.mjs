import { builtinModules } from 'node:module';
import { lstat, mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// This entry point imports only esbuild and Node APIs. It never loads Vite,
// Electron, the desktop sources, or the manual demonstration repository.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist-core');
const packageInfo = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
try {
  const stat = await lstat(output);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('dist-core deve ser um diretório real, sem link.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await mkdir(output);
}
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/u, '')));
const result = await build({
  absWorkingDir: root,
  entryPoints: { 'core/index': 'src/core/index.ts', 'cli/index': 'src/cli/index.ts' },
  outdir: output,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  charset: 'utf8',
  sourcemap: false,
  metafile: true,
  logLevel: 'info',
  plugins: [{
    name: 'core-node-only',
    setup(builder) {
      builder.onResolve({ filter: /^[^./\\]/ }, args => {
        if (args.kind === 'entry-point') return undefined;
        if (builtins.has(args.path.replace(/^node:/u, ''))) return undefined;
        return { errors: [{ text: `Dependência externa não permitida no Core/CLI independente: ${args.path}` }] };
      });
    },
  }],
});
await writeFile(resolve(output, 'package.json'), JSON.stringify({
  name: 'git-layer-core', version: packageInfo.version, private: true,
  type: 'module', engines: packageInfo.engines,
  bin: { 'git-layer': './cli/index.js' }, exports: './core/index.js',
}, null, 2) + '\n', 'utf8');
await writeFile(resolve(output, 'build-manifest.json'), JSON.stringify({
  schema: 1, build: 'core-cli', node: process.version,
  inputs: Object.keys(result.metafile.inputs).sort(),
  outputs: Object.entries(result.metafile.outputs).map(([file, info]) => ({ file: file.replaceAll('\\', '/'), bytes: info.bytes })),
  runtimeDependencies: ['Node.js >=22.12.0', 'Git oficial local'],
}, null, 2) + '\n', 'utf8');
await chmod(resolve(output, 'cli/index.js'), 0o755);
console.log('Core/CLI independente compilado em dist-core/. Execute node dist-core/cli/index.js --help.');
