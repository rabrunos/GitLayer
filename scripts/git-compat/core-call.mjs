import { pathToFileURL } from 'node:url';
const [modulePath, repo, method, rawArgs] = process.argv.slice(2);
try {
  const { GitLayers } = await import(pathToFileURL(modulePath).href);
  const core = method === 'init' ? await GitLayers.init(repo) : await GitLayers.open(repo);
  if (method !== 'init' && typeof core[method] !== 'function') throw Error('Unknown Core method');
  const result = method === 'init' ? await core.list() : await core[method](...JSON.parse(rawArgs));
  process.stdout.write(JSON.stringify({ ok: true, result: result ?? null }) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ ok: false, error: { code: error.code ?? 'UNEXPECTED', message: error.message } }) + '\n');
  process.exitCode = 1;
}
