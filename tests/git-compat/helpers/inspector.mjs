import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { locateCheckpoint } from './checkpoint-location.mjs';
import { project, json, fileHash } from '../../../scripts/git-compat/lib.mjs';

// Observes the unmodified bundle through Node's loopback inspector. No hooks,
// monkey patches, failpoints, module replacements or product-source edits.
export async function pauseCore(c, { method, args, needle, locator, condition = '', expression = '({transaction:this.tx?.data,resources:process.getActiveResourcesInfo()})', label }) {
  const bundle = path.join(c.buildDir, 'core.mjs'), lines = fs.readFileSync(bundle, 'utf8').split('\n');
  const location = locator ? locateCheckpoint(lines, locator) : null;
  const matches = location ? [location.lineNumber] : lines.flatMap((line, n) => line.includes(needle) ? [n] : []);
  c.eq('Unique executable checkpoint source location', matches.length, 1);
  const lineNumber = matches[0];
  let child, socket, childDone = false, explicitlyKilled = false, runtimeReleased = false, readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  let stderr = '';
  const running = c.run(process.execPath, ['--inspect-brk=127.0.0.1:0', path.join(project, 'scripts/git-compat/core-call.mjs'), bundle, c.repo, method, JSON.stringify(args)], {
    timeout: 120000, ok: [0, 1, null], onSpawn(value) {
      child = value;
      child.stderr.on('data', chunk => { stderr += chunk.toString(); const match = stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/); if (match) readyResolve(match[1]); });
      child.once('error', readyReject); child.once('exit', (code, signal) => { childDone = true; readyReject(Error(`Inspector child ended before barrier (${code}/${signal})`)); });
    },
  });
  // Attach rejection handling immediately while readiness is being awaited.
  running.catch(() => {});
  const requests = new Map(), pauses = [], pausedWaiters = [], scripts = new Map(); let requestId = 0;
  const withTimeout = (promise, ms, description) => {
    let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(description)), ms); })]).finally(() => clearTimeout(timer));
  };
  async function rpc(methodName, params = {}) {
    const id = ++requestId; const response = new Promise((resolve, reject) => requests.set(id, { resolve, reject })); socket.send(JSON.stringify({ id, method: methodName, params }));
    return withTimeout(response, 10000, `Inspector RPC timeout: ${methodName}`).finally(() => requests.delete(id));
  }
  const nextPause = () => withTimeout(pauses.length ? Promise.resolve(pauses.shift()) : new Promise((resolve, reject) => pausedWaiters.push({ resolve, reject })), 45000, 'No observable checkpoint pause before deadline');
  async function closeSession() { if (socket && socket.readyState < 2) socket.close(); }
  async function finishNormally(expectedCodes = [0]) {
    if (!childDone && socket?.readyState === 1) { try { await rpc('Debugger.resume'); } catch { /* May already be resumed. */ } }
    await closeSession(); const result = await running; c.ok('Observed Core subprocess completion matches the explicit expected status', expectedCodes.includes(result.code), expectedCodes, result.code); return result;
  }
  try {
    const url = await withTimeout(ready, 10000, 'Inspector endpoint was not announced'); c.ok('Inspector binds only loopback', /^ws:\/\/127\.0\.0\.1:\d+\//.test(url));
    socket = new WebSocket(url);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) { const pending = requests.get(message.id); if (pending) message.error ? pending.reject(Error(JSON.stringify(message.error))) : pending.resolve(message.result ?? {}); }
      if (message.method === 'Debugger.scriptParsed') scripts.set(message.params.scriptId, message.params.url);
      if (message.method === 'Debugger.paused') { const waiter = pausedWaiters.shift(); if (waiter) waiter.resolve(message.params); else pauses.push(message.params); }
    });
    socket.addEventListener('close', () => { for (const p of requests.values()) p.reject(Error('Inspector closed')); for (const p of pausedWaiters) p.reject(Error('Inspector closed before pause')); });
    await withTimeout(new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }), 10000, 'Inspector WebSocket connection timeout');
    await rpc('Runtime.enable'); await rpc('Debugger.enable');
    const breakpoint = await rpc('Debugger.setBreakpointByUrl', { lineNumber, urlRegex: 'core\\.mjs$', ...(condition ? { condition } : {}) });
    await rpc('Runtime.runIfWaitingForDebugger'); runtimeReleased = true;
    let paused;
    for (let n = 0; n < 6; n++) { const event = await nextPause(); if (event.hitBreakpoints?.includes(breakpoint.breakpointId)) { paused = event; break; } await rpc('Debugger.resume'); }
    c.ok('Target breakpoint actually hit', Boolean(paused));
    const frame = paused.callFrames[0]; c.eq('Observed breakpoint remains on the exact requested executable line', frame.location.lineNumber, lineNumber);
    const evaluated = await rpc('Debugger.evaluateOnCallFrame', { callFrameId: frame.callFrameId, expression, returnByValue: true, silent: true });
    c.ok('Paused frame evaluation has no exception', !evaluated.exceptionDetails, 'successful local observation', evaluated.exceptionDetails);
    const loaded = await rpc('Debugger.getScriptSource', { scriptId: frame.location.scriptId });
    const loadedHash = crypto.createHash('sha256').update(loaded.scriptSource).digest('hex'); c.eq('Loaded Core bundle is unmodified', loadedHash, fileHash(bundle));
    const state = evaluated.result.value;
    c.eq('No active child process at the pause barrier', (state.resources ?? []).filter(name => name === 'ProcessWrap'), []);
    const evidence = { label, method, args, pid: child.pid, endpoint: url.replace(/\/[^/]+$/, '/<EPHEMERAL-INSPECTOR-ID>'), breakpoint: { requestedLine: lineNumber + 1, sourceLine: lines[lineNumber].trim(), condition, breakpointId: breakpoint.breakpointId, locator: location ?? { needle } }, actual: { functionName: frame.functionName, scriptUrl: scripts.get(frame.location.scriptId), line: frame.location.lineNumber + 1, column: frame.location.columnNumber, reason: paused.reason, hitBreakpoints: paused.hitBreakpoints }, loadedScriptSha256: loadedHash, state };
    const portable = JSON.parse(JSON.stringify(evidence).replaceAll(JSON.stringify(c.root).slice(1, -1), '<FIXTURE>'));
    json(path.join(c.artifactDir, `inspector-${label}.json`), portable);
    let settled = false;
    return {
      pid: child.pid, state, evidence,
      async kill() { c.ok('Kill targets the exclusive live inspector child', !childDone && Number.isInteger(child.pid) && child.pid > 0); explicitlyKilled = true; const sent = child.kill('SIGKILL'); c.ok('Abrupt process-handle termination delivered', sent); const result = await running; settled = true; await closeSession(); c.ok('Process exited after abrupt kill', childDone && result.code !== 0); return result; },
      async resume(expectedCodes = [0]) { const result = await finishNormally(expectedCodes); settled = true; return result; },
      // Cleanup preserves the primary assertion/error. The caller's explicit
      // resume owns the success/failure expectation for the managed operation.
      async dispose() { if (!settled && !explicitlyKilled) { await finishNormally([0, 1]); settled = true; } else await closeSession(); },
    };
  } catch (error) {
    // Once execution started, resume/disconnect on a setup failure so an
    // in-flight awaited Git subprocess can finish under normal supervision.
    if (runtimeReleased && socket?.readyState === 1) { try { await rpc('Debugger.resume'); } catch { /* Already running. */ } }
    await closeSession();
    // Before release, --inspect-brk proves no Core code or Git child has run.
    if (!runtimeReleased && !childDone && child) child.kill('SIGKILL');
    await running.catch(() => {});
    throw error;
  }
}
