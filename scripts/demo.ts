#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../src/core/demo.js';
export { createDemo } from '../src/core/demo.js';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write('Uso: npm run demo -- <pasta-nova-ou-vazia>\nCria somente Git local real; recusa pasta não vazia e não executa scripts do exemplo.\n');
    process.exitCode = args[0] === '--help' || args[0] === '-h' ? 0 : 2;
  } else {
    try { process.stdout.write(`${JSON.stringify(await createDemo(args[0]!), null, 2)}\n`); }
    catch (error) {
      process.stderr.write(`Demonstração não concluída: ${error instanceof Error ? error.message : String(error)}\nA pasta de destino foi preservada para inspeção.\n`);
      process.exitCode = 1;
    }
  }
}
