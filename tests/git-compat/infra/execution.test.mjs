import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { project, context, createFixture, cleanupFixture, isolatedEnvironment, execute, json, relative } from '../../../scripts/git-compat/lib.mjs';
import { fileManifest } from '../../../scripts/git-compat/audit.mjs';
import { externalFixtureParent } from '../../../scripts/git-compat/fixture-parent.mjs';

test('binary subprocess evidence preserves bytes which are not valid UTF-8', async t => {
  const f = createFixture(externalFixtureParent(project), 'binary'); t.after(() => cleanupFixture(f));
  const c = context({ root: f.root, repo: path.join(f.root, 'repo'), artifactDir: path.join(f.root, 'evidence'), packageRoot: f.root, gitPath: process.execPath, env: isolatedEnvironment(f.root, process.execPath) });
  const r = await c.run(process.execPath, ['-e', 'process.stdout.write(Buffer.from([0,255,128,10]));process.stderr.write("diagnostic")']);
  assert.deepEqual(r.stdoutBuffer, Buffer.from([0, 255, 128, 10]));
  assert.deepEqual(fs.readFileSync(path.join(f.root, c.commands[0].stdout_binary_path)), r.stdoutBuffer);
  assert.equal(fs.readFileSync(path.join(f.root, c.commands[0].stderr_path), 'utf8'), 'diagnostic');
  assert.notDeepEqual(Buffer.from(fs.readFileSync(path.join(f.root, c.commands[0].stdout_path), 'utf8')), r.stdoutBuffer);
});

test('nested linked sources cannot disappear from an audit manifest', t => {
  const f = createFixture(externalFixtureParent(project), 'audit-links');
  t.after(() => cleanupFixture(f));
  fs.mkdirSync(path.join(f.root, 'src'));
  fs.mkdirSync(path.join(f.root, 'external'));
  fs.writeFileSync(path.join(f.root, 'external', 'source.ts'), 'synthetic source');
  const link = path.join(f.root, 'src', 'linked');
  fs.symlinkSync(path.join(f.root, 'external'), link, process.platform === 'win32' ? 'junction' : 'dir');
  try { assert.throws(() => fileManifest(f.root, ['src']), /Linked audit input refused/); }
  finally { fs.unlinkSync(link); }
});

test('exited parent PID is never signalled and descendant-held pipes have a bounded drain', { timeout: 30000 }, async t => {
  const f = createFixture(externalFixtureParent(project), 'pipe-drain');
  const nonce = crypto.randomUUID(), evidenceParent = process.env.GIT_COMPAT_INFRA_EVIDENCE_ROOT;
  if (evidenceParent && !path.isAbsolute(evidenceParent)) throw Error('GIT_COMPAT_INFRA_EVIDENCE_ROOT must be absolute');
  const evidence = path.join(evidenceParent ?? path.join(project, 'artifacts/git-compat/auxiliary/review-r02'), 'pipe-drain-' + nonce);
  const readyFile = path.join(f.root, 'ready.json'), finishedFile = path.join(f.root, 'finished.json'), parentFile = path.join(f.root, 'parent.json');
  const descendantScript = path.join(f.root, 'descendant.mjs'), parentScript = path.join(f.root, 'parent.mjs');
  const env = isolatedEnvironment(f.root, process.execPath);
  fs.writeFileSync(descendantScript, `import fs from 'node:fs';
const record={nonce:${JSON.stringify(nonce)},pid:process.pid,started:Date.now()};
fs.writeFileSync(${JSON.stringify(readyFile)},JSON.stringify(record));
process.stdout.write('bounded descendant ready\\n');process.send(record);
setTimeout(()=>{fs.writeFileSync(${JSON.stringify(finishedFile)},JSON.stringify({...record,finished:Date.now(),reason:'bounded natural self-exit'}));process.exit(0);},7000);
`);
  fs.writeFileSync(parentScript, `import {spawn} from 'node:child_process';import fs from 'node:fs';
const child=spawn(process.execPath,[${JSON.stringify(descendantScript)}],{env:process.env,detached:true,windowsHide:true,stdio:['ignore','inherit','inherit','ipc']});
child.unref();child.once('message',record=>{if(record.nonce!==${JSON.stringify(nonce)}||record.pid!==child.pid)process.exit(3);fs.writeFileSync(${JSON.stringify(parentFile)},JSON.stringify({nonce:record.nonce,parentPid:process.pid,spawnedChildPid:child.pid}));process.exit(0);});
child.once('error',error=>{process.stderr.write(String(error));process.exit(4);});
`);
  let result, parentExit, finished, ready, caught;
  const waitUntil = async (predicate, ms, label) => {
    const deadline = Date.now() + ms;
    while (!predicate()) { if (Date.now() >= deadline) throw Error(label); await new Promise(resolve => setTimeout(resolve, 25)); }
  };
  try {
    result = await execute(process.execPath, [parentScript], { cwd: f.root, env, timeout: 1500, onSpawn(child) { child.once('exit', (code, signal) => { parentExit = { code, signal, at: Date.now(), pid: child.pid }; }); } });
    ready = JSON.parse(fs.readFileSync(readyFile, 'utf8'));
    const parent = JSON.parse(fs.readFileSync(parentFile, 'utf8'));
    assert.equal(parent.nonce, nonce); assert.equal(parent.spawnedChildPid, ready.pid); assert.equal(parent.parentPid, result.pid);
    assert.equal(parentExit.code, 0); assert.equal(result.code, 0); assert.equal(result.timedOut, true);
    assert.equal(result.termination.parent_already_exited, true); assert.equal(result.termination.forced_stream_close, true);
    assert.equal(result.termination.tree_exit, null); assert.equal(result.termination.direct_handle_killed, false); assert.equal(result.termination.descendant_tree_confirmed, false);
    assert.match(result.termination.method, /PID signalling refused/u);
    assert.equal(fs.existsSync(finishedFile), false, 'execute returned before the descendant natural deadline');
  } catch (error) { caught = error; }
  finally {
    // The only descendant is deliberately self-bounded. Observe its own nonce
    // and PID signal file, then its disappearance; no CIM or PID kill is used.
    if (fs.existsSync(readyFile)) {
      ready ??= JSON.parse(fs.readFileSync(readyFile, 'utf8'));
      await waitUntil(() => fs.existsSync(finishedFile), 20000, 'Bounded descendant did not publish its natural self-exit');
      finished = JSON.parse(fs.readFileSync(finishedFile, 'utf8'));
      assert.equal(finished.nonce, nonce); assert.equal(finished.pid, ready.pid);
      await waitUntil(() => { try { process.kill(ready.pid, 0); return false; } catch (error) { if (error.code === 'ESRCH') return true; throw error; } }, 3000, 'Owned descendant PID still present after self-exit signal');
    }
    fs.mkdirSync(evidence, { recursive: true });
    for (const file of [descendantScript, parentScript]) fs.copyFileSync(file, path.join(evidence, path.basename(file)));
    fs.writeFileSync(path.join(evidence, 'stdout.bin'), result?.stdoutBuffer ?? Buffer.alloc(0)); fs.writeFileSync(path.join(evidence, 'stderr.bin'), result?.stderrBuffer ?? Buffer.alloc(0));
    json(path.join(evidence, 'pipe-drain-proof.json'), { role: 'Real exited-parent / independently bounded descendant pipe lifecycle', node: process.version, platform: process.platform, parentExit, ready, finished, result: result && { code: result.code, signal: result.signal, timedOut: result.timedOut, duration_ms: result.duration_ms, termination: result.termination }, error: caught?.stack ?? null, noDescendantKillOrCim: true });
    console.log('PIPE_DRAIN_EVIDENCE=' + relative(project, evidence));
    cleanupFixture(f);
  }
  if (caught) throw caught;
});
