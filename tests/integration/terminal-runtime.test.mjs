import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

test('real interactive PTY runs typed Git Layers and completes capture through its TTY', { timeout: 900000 }, async () => {
  const parent = path.resolve('.workshop/test-runtime');
  await mkdir(parent, { recursive: true });
  const runtime = await mkdtemp(path.join(parent, 'pty-'));
  try {
    const script = path.join(runtime, 'scenario.mjs');
    // Bundle current sources, then start plain Node. A --import tsx inherited
    // by node-pty's Windows Worker can deadlock its synchronous spawn handshake.
    await build({ entryPoints: ['tests/helpers/terminal-scenario.ts'], outfile: script, bundle: true, platform: 'node', format: 'esm', packages: 'external', sourcemap: 'inline' });
    const env = { ...process.env }; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
    const result = await promisify(execFile)(process.execPath, [script], { cwd: process.cwd(), env, timeout: 170000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  } finally { await rm(runtime, { recursive: true, force: true, maxRetries: 5 }); }
});
