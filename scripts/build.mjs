import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile, chmod, rm } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { build as viteBuild } from 'vite';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Build interrompido (código ${result.status ?? 1}).`);
}

// Use a stable source root so renderer breakpoints survive extracting the ZIP elsewhere.
async function rendererSourceMaps(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) await rendererSourceMaps(full);
    else if (entry.isFile() && entry.name.endsWith('.map')) {
      const map = JSON.parse(await readFile(full, 'utf8'));
      map.sources = map.sources.map(source => {
        if (/^[a-z][a-z\d+.-]*:/iu.test(source)) return source;
        const local = resolve(dirname(full), map.sourceRoot ?? '', source);
        const normalized = local.split(sep).join('/');
        const dependency = normalized.indexOf('/node_modules/');
        const portable = dependency < 0 ? relative(process.cwd(), local).split(sep).join('/') : normalized.slice(dependency + 1);
        return `gitlayers-workshop:///${portable}`;
      });
      delete map.sourceRoot;
      await writeFile(full, JSON.stringify(map));
    }
  }
}

export async function buildProject({ debug = false, incremental = false } = {}) {
  const output = debug ? 'dist-debug' : 'dist';
  if (debug && !incremental) await rm(output, { recursive: true, force: true });
  await mkdir('.workshop/cache', { recursive: true });
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', debug ? 'tsconfig.debug.json' : 'tsconfig.json', ...(incremental ? ['--incremental', '--tsBuildInfoFile', '.workshop/cache/debug.tsbuildinfo'] : [])]);
  const bundle = { bundle: true, platform: 'node', target: 'node22', external: ['electron', 'node-pty'], sourcemap: debug ? 'linked' : false, sourcesContent: debug };
  await build({ ...bundle, entryPoints: ['src/desktop/main/index.ts'], outfile: `${output}/desktop/main/index.js`, format: 'esm' });
  await build({ ...bundle, entryPoints: ['src/desktop/preload/index.ts'], outfile: `${output}/desktop/preload/index.cjs`, format: 'cjs' });
  await viteBuild({ mode: debug ? 'workshop-debug' : 'production' });
  await chmod(`${output}/cli/index.js`, 0o755);
  await mkdir(`${output}/licenses`, { recursive: true });
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const inventory = [];
  for (const [location, resolution] of Object.entries(lock.packages)) {
    if (!location.startsWith('node_modules/') || resolution.dev === true) continue;
    const dir = resolve(location);
    const pkg = JSON.parse(await readFile(`${dir}/package.json`, 'utf8'));
    const name = pkg.name;
    inventory.push({ name, version: pkg.version, license: pkg.license, resolved: resolution.resolved });
    for (const entry of await readdir(dir)) {
      if (/^(licen[sc]e|notice|thirdpartynotices)(\.|$)/i.test(entry)) await cp(`${dir}/${entry}`, `${output}/licenses/${name.replaceAll('/', '-')}-${entry}`, { recursive: true });
    }
  }
  await writeFile(`${output}/licenses/dependencies.json`, JSON.stringify(inventory, null, 2) + '\n');
  if (debug) {
    await rendererSourceMaps(resolve(output, 'renderer'));
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    await writeFile(`${output}/package.json`, JSON.stringify({ name: pkg.name, version: pkg.version, private: true, type: 'module', main: 'desktop/main/index.js' }, null, 2) + '\n');
  }
  console.log(`Build ${debug ? 'de debug' : 'de produção'} concluído em ${output}: Core/CLI, Electron e renderer local com workers Monaco.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildProject();
