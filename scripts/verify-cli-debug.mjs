import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { connectInspector } from './debug-client.mjs';
import { defaultWorkshopRepository } from './workshop.mjs';

const root = process.cwd(), repo = path.resolve(process.argv[2] ?? defaultWorkshopRepository());
const reports = path.join(root, '.workshop/reports'); await mkdir(reports, { recursive: true });
const evidence = { status: 'running', platform: process.platform, repo, checks: [] };
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const child = spawn(process.execPath, ['--inspect-brk=127.0.0.1:0', 'dist-debug/cli/index.js', '--cwd', repo, 'status', '--json'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '', stderr = '', client;
child.stdout.on('data', chunk => { stdout += chunk; });
const closed = new Promise(resolve => child.once('close', resolve));
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI inspector did not start')), 10000);
    child.stderr.on('data', chunk => {
      stderr += chunk; const match = /ws:\/\/127\.0\.0\.1:\d+\/[^\s]+/u.exec(stderr);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.once('error', reject);
  });
  client = await connectInspector(url); await client.command('Debugger.enable');
  const source = await readFile('dist-debug/core/index.js', 'utf8');
  const lineNumber = source.split('\n').findIndex(line => line.includes('static async open(root)'));
  assert.ok(lineNumber >= 0);
  const breakpoint = await client.command('Debugger.setBreakpointByUrl', { urlRegex: 'dist-debug[\\/]core[\\/]index\\.js$', lineNumber });
  let paused = client.event('Debugger.paused');
  await client.command('Runtime.runIfWaitingForDebugger');
  let frame = (await paused).callFrames[0];
  if (frame.functionName !== 'open') {
    paused = client.event('Debugger.paused'); await client.command('Debugger.resume'); frame = (await paused).callFrames[0];
  }
  assert.equal(frame.functionName, 'open');
  const argument = await client.command('Debugger.evaluateOnCallFrame', { callFrameId: frame.callFrameId, expression: 'root', returnByValue: true });
  assert.equal(path.resolve(argument.result.value), repo);
  evidence.breakpoint = { functionName: frame.functionName, line: frame.location.lineNumber + 1, argument: argument.result.value };
  await client.command('Debugger.removeBreakpoint', { breakpointId: breakpoint.breakpointId });
  await client.command('Debugger.resume'); await client.command('Debugger.disable'); client.close(); client = undefined;
  let timer;
  const code = await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('CLI did not exit after debugger detached')), 30000); })]);
  clearTimeout(timer); assert.equal(code, 0, stderr); assert.equal(JSON.parse(stdout).ok, true);
  evidence.checks.push('cli-core-breakpoint-argument-pause-resume-status-exit-zero'); evidence.status = 'passed';
} catch (error) { evidence.status = 'failed'; evidence.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  if (client) { await client.command('Debugger.setSkipAllPauses', { skip: true }).catch(() => undefined); await client.command('Debugger.resume').catch(() => undefined); client.close(); }
  if (child.exitCode === null) {
    if (process.platform === 'win32') spawn(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill();
  }
  await writeFile(path.join(reports, 'cli-debug.json'), JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(path.join(reports, 'cli-debug.stdout.log'), stdout); await writeFile(path.join(reports, 'cli-debug.stderr.log'), stderr);
  console.log(JSON.stringify(evidence, null, 2));
}
