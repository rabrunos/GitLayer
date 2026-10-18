import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { inspectorEndpoint, connectInspector } from './debug-client.mjs';

const root = process.cwd(), reports = path.join(root, '.workshop/reports');
await mkdir(reports, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), 'lab-dev-verification-'));
const repo = path.join(temp, 'repo ação com espaços'), profile = path.join(temp, 'profile');
const probe = path.join(root, 'src', `development-probe-${process.pid}.ts`);
const evidence = { status: 'running', platform: process.platform, at: new Date().toISOString(), checks: [] };
function phase(value) { evidence.phase = value; console.log('Verificando:', value); }
let child, browser, page, inspector, output = '', createdProbe = false;
async function connectPage() {
  await inspectorEndpoint(9222, target => target.type === 'page' && target.url.startsWith('gitlayers://'));
  browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  page = context.pages().find(p => p.url().startsWith('gitlayers://')) ?? await context.waitForEvent('page', { timeout: 30000 });
  await page.getByTestId('workspace').waitFor();
}
try {
  phase('isolated-repository');
  const { createDemo } = await import(pathToFileURL(path.join(root, 'dist-debug/core/demo.js')).href);
  await createDemo(repo);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  child = spawn(process.execPath, ['scripts/dev.mjs', '--debug', '--repo', repo, '--profile', profile], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const endpoint = await inspectorEndpoint(9229);
  await connectPage();
  phase('main-breakpoint');
  inspector = await connectInspector(endpoint.webSocketDebuggerUrl);
  await inspector.command('Debugger.enable');
  const main = await readFile(path.join(root, 'dist-debug/desktop/main/index.js'), 'utf8');
  const lineNumber = main.split('\n').findIndex(line => line.startsWith('function ready()')) + 1;
  assert.ok(lineNumber > 0);
  const breakpoint = await inspector.command('Debugger.setBreakpointByUrl', { urlRegex: 'dist-debug[\\/]desktop[\\/]main[\\/]index\\.js$', lineNumber });
  assert.ok(breakpoint.locations.length, 'Main breakpoint must bind to the actual build');
  const paused = inspector.event('Debugger.paused');
  const snapshot = page.evaluate(() => window.lab.call('snapshot'));
  const frame = (await paused).callFrames[0];
  evidence.mainBreakpoint = { functionName: frame.functionName, url: frame.url, line: frame.location.lineNumber + 1 };
  await inspector.command('Debugger.removeBreakpoint', { breakpointId: breakpoint.breakpointId });
  await inspector.command('Debugger.resume'); await snapshot;
  inspector.close(); inspector = undefined;
  evidence.checks.push('actual-main-inspector-breakpoint-pause-resume');
  phase('renderer-inspector');
  const renderer = await browser.contexts()[0].newCDPSession(page);
  await renderer.send('Debugger.enable');
  const rendererPaused = new Promise(resolve => renderer.once('Debugger.paused', resolve));
  await renderer.send('Debugger.pause'); await rendererPaused; await renderer.send('Debugger.resume'); await renderer.detach();
  evidence.checks.push('actual-renderer-inspector-pause-resume');
  phase('watch-restart-and-draft');
  await page.locator('.file-row').filter({ hasText: 'README.md' }).click();
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.type('Buffer preservado pelo desenvolvimento.');
  await page.waitForFunction(() => document.querySelector('.editor-status')?.textContent.includes('Não salvo no editor'));
  await writeFile(probe, 'export const developmentProbe = true;\n', { flag: 'wx' }); createdProbe = true;
  const next = await inspectorEndpoint(9229, target => target.webSocketDebuggerUrl !== endpoint.webSocketDebuggerUrl, 60000);
  assert.notEqual(next.webSocketDebuggerUrl, endpoint.webSocketDebuggerUrl);
  await browser.close(); await connectPage();
  await page.getByText('1 rascunho(s) recuperado(s). Revise antes de salvar.', { exact: true }).waitFor();
  assert.match((await page.locator('.monaco-editor .view-lines').textContent()).replaceAll('\u00a0', ' '), /Buffer preservado pelo desenvolvimento\./);
  assert.doesNotMatch(await readFile(path.join(repo, 'README.md'), 'utf8'), /Buffer preservado/);
  evidence.checks.push('source-watch-build-restart-draft-restored-disk-unchanged');
  await page.getByRole('button', { name: /Salvar/ }).click();
  await page.waitForFunction(() => !document.querySelector('.editor-status')?.textContent.includes('Não salvo no editor'));
  await page.screenshot({ path: path.join(reports, 'dev-verified.png') });
  await page.evaluate(() => window.lab.call('closeReady')).catch(error => {
    if (!/Target page, context or browser has been closed/u.test(error.message)) throw error;
  });
  const deadline = Date.now() + 15000;
  while (child.exitCode === null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(child.exitCode, 0, 'Closing the app must stop the development task');
  evidence.checks.push('window-close-stops-development-parent');
  evidence.status = 'passed';
  phase('complete');
} catch (error) {
  evidence.status = 'failed'; evidence.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
} finally {
  if (inspector) {
    await inspector.command('Debugger.setSkipAllPauses', { skip: true }).catch(() => undefined);
    await inspector.command('Debugger.resume').catch(() => undefined);
    inspector.close();
  }
  try { if (page && !page.isClosed()) await page.evaluate(() => window.lab.call('closeReady')); } catch { /* Report failure above. */ }
  if (!page && browser) for (const candidate of browser.contexts()[0]?.pages() ?? []) {
    try { await candidate.evaluate(() => window.lab?.call('closeReady')); } catch { /* Still starting. */ }
  }
  await browser?.close().catch(() => undefined);
  if (child?.exitCode === null) {
    const deadline = Date.now() + 15000;
    while (child.exitCode === null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    if (child.exitCode === null) { evidence.cleanupError = 'Development process did not exit'; process.exitCode = 1; child.kill(); }
  }
  if (createdProbe) {
    await rm(probe);
    // tsc incremental does not remove outputs of a deleted source. Remove
    // only this test's unique probe so verify:maps never sees a stale source.
    const name = path.basename(probe, '.ts');
    for (const extension of ['.js', '.js.map', '.d.ts', '.d.ts.map']) await rm(path.join(root, 'dist-debug', name + extension), { force: true });
  }
  await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  await writeFile(path.join(reports, 'dev-session.log'), output);
  await writeFile(path.join(reports, 'dev-session.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}
