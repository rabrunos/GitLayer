import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const RENDERER_SOURCE_ROOT = 'gitlayers-workshop:///';

/** Check actual emitted payload and map content; this never launches Electron. */
export async function verifyDebugBuild(root = process.cwd()) {
  const local = (...parts) => resolve(root, ...parts);
  const pkg = JSON.parse(await readFile(local('package.json'), 'utf8'));
  const debugPkg = JSON.parse(await readFile(local('dist-debug/package.json'), 'utf8'));
  assert.equal(debugPkg.version, pkg.version, 'O debug deve usar a versão real do aplicativo.');
  assert.equal(debugPkg.type, 'module');
  assert.equal(debugPkg.main, 'desktop/main/index.js');
  let maps = 0;
  let rendererMaps = 0;
  let embeddedSources = 0;
  const projectSources = new Set();
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && entry.name.endsWith('.map')) {
        const map = JSON.parse(await readFile(full, 'utf8'));
        assert.equal(map.version, 3, full);
        assert.equal(map.sources.length, map.sourcesContent?.length, `Fontes ausentes: ${full}`);
        assert(map.sourcesContent.every(source => typeof source === 'string'), `Fonte sem conteúdo: ${full}`);
        maps++;
        embeddedSources += map.sources.length;
        const renderer = full.startsWith(local('dist-debug', 'renderer', 'assets') + sep);
        if (renderer) rendererMaps++;
        for (let index = 0; index < map.sources.length; index++) {
          const source = map.sources[index];
          let sourceFile;
          if (renderer) {
            assert(source.startsWith(RENDERER_SOURCE_ROOT), `Fonte renderer sem raiz portável: ${source}`);
            assert(!source.includes('/../'), `Caminho da máquina de build: ${source}`);
            sourceFile = local(source.slice(RENDERER_SOURCE_ROOT.length));
          } else {
            assert(!/^[a-z][a-z\d+.-]*:/iu.test(source) && !source.startsWith('/'), `Caminho de build absoluto: ${source}`);
            sourceFile = resolve(dirname(full), map.sourceRoot ?? '', source);
          }
          const src = local('src');
          if (sourceFile.startsWith(src + sep)) {
            assert.equal(map.sourcesContent[index], await readFile(sourceFile, 'utf8'), `Build de debug desatualizado: ${sourceFile}`);
            projectSources.add(sourceFile);
          }
        }
      }
    }
  };
  await visit(local('dist-debug'));
  for (const file of ['core/index.js', 'cli/index.js', 'desktop/main/index.js', 'desktop/preload/index.cjs']) {
    const full = local('dist-debug', file);
    const code = await readFile(full, 'utf8');
    const reference = /\/\/# sourceMappingURL=(.+)\s*$/u.exec(code);
    assert(reference, `sourceMappingURL ausente: ${file}`);
    await readFile(resolve(dirname(full), reference[1].trim()), 'utf8');
  }
  const assets = await readdir(local('dist-debug/renderer/assets'));
  for (const worker of ['editor', 'ts', 'json', 'css', 'html']) {
    assert(assets.some(name => name.startsWith(`${worker}.worker-`) && name.endsWith('.js.map')), `Mapa do worker ausente: ${worker}`);
  }
  for (const file of ['core/index.ts', 'cli/index.ts', 'desktop/main/index.ts', 'desktop/preload/index.ts', 'desktop/renderer/App.tsx', 'desktop/renderer/Editor.tsx', 'desktop/renderer/index.tsx']) {
    assert(projectSources.has(local('src', file)), `Fonte principal sem sourcemap: ${file}`);
  }
  return { ok: true, appVersion: debugPkg.version, maps, rendererMaps, embeddedSources, projectSources: projectSources.size, monacoWorkersWithMaps: 5, nativeGuiExecuted: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await verifyDebugBuild(), null, 2)); }
  catch (error) { console.error(`Debug build inválido: ${error.message}`); process.exitCode = 1; }
}
