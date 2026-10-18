import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { defaultWorkshopRepository, ensureWorkshopDemo, PROJECT_ROOT } from './workshop.mjs';

const repo = defaultWorkshopRepository();
const file = path.join(repo, `.workshop-reuse-check-${randomUUID()}.txt`);
const content = 'Edição local preservada · ação\r\n';
const readme = await readFile(path.join(repo, 'README.md'));
await writeFile(file, content, { flag: 'wx' });
try {
  const result = await ensureWorkshopDemo();
  assert.equal(result.reused, true);
  assert.equal(await readFile(file, 'utf8'), content);
  assert.deepEqual(await readFile(path.join(repo, 'README.md')), readme);
  await mkdir(path.join(PROJECT_ROOT, '.workshop/reports'), { recursive: true });
  await writeFile(path.join(PROJECT_ROOT, '.workshop/reports/demo-reuse.json'), JSON.stringify({ status: 'passed', at: new Date().toISOString(), platform: process.platform, ...result, localEditPreserved: true, existingReadmeUnchanged: true }, null, 2) + '\n');
  console.log('Demonstração reutilizada; edição local e README preservados: ' + repo);
} finally {
  // Remove only our uniquely named, unchanged probe. User edits remain intact.
  if (await readFile(file, 'utf8') === content) await unlink(file);
}
