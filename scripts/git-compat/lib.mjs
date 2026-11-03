import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';

export const project = path.resolve(import.meta.dirname, '../..');
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
export const fileHash = p => sha256(fs.readFileSync(p));
export const json = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); };
export const relative = (root, p) => path.relative(root, p).split(path.sep).join('/');
export function walk(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(e => {
    const p = path.join(root, e.name);
    if (e.isSymbolicLink()) return [];
    return e.isDirectory() ? walk(p) : e.isFile() ? [p] : [];
  });
}
export function fingerprint(paths) {
  const files = paths.flatMap(p => fs.statSync(p).isDirectory() ? walk(p) : [p]).sort();
  return sha256(JSON.stringify(files.map(p => [relative(project, p), fileHash(p)])));
}
export function within(root, target) {
  const r = path.relative(path.resolve(root), path.resolve(target));
  return r !== '' && r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r);
}
export function gitVerb(argv) {
  let i=0;const withValue=new Set(['-C','-c','--git-dir','--work-tree','--namespace','--config-env','--super-prefix']);
  while(i<argv.length&&String(argv[i]).startsWith('-')) {if(argv[i]==='--'){i++;break;}i+=withValue.has(argv[i])?2:1;}
  return argv[i];
}
export function applyOutcome(result,outcome) {
  if(outcome===undefined||outcome===null)return;
  if(typeof outcome!=='object'||Array.isArray(outcome))throw Error('Malformed case outcome');
  const allowed=new Set(['productStatus','findings','limits','execution_status','nonexecution_reason']);
  if(Object.keys(outcome).some(k=>!allowed.has(k)))throw Error('Unexpected case outcome key');
  if(outcome.execution_status!==undefined&&outcome.execution_status!=='ENV_BLOCKED')throw Error('Cases cannot declare execution success/failure');
  if(outcome.limits!==undefined&&(!Array.isArray(outcome.limits)||outcome.limits.some(v=>typeof v!=='string')))throw Error('Malformed outcome limits');
  if(outcome.findings!==undefined&&(!Array.isArray(outcome.findings)||outcome.findings.some(v=>!v||typeof v!=='object'||typeof v.id!=='string')))throw Error('Malformed outcome findings');
  if(outcome.productStatus!==undefined)result.product_status=outcome.productStatus;
  if(outcome.findings!==undefined)result.findings=outcome.findings;
  if(outcome.limits!==undefined)result.limits.push(...outcome.limits);
  if(outcome.nonexecution_reason!==undefined)result.nonexecution_reason=outcome.nonexecution_reason;
}
export function safeEvidence(root, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').includes('..')) throw Error('Unsafe evidence path');
  const p = path.resolve(root, rel);
  if (!within(root, p)) throw Error('Evidence escapes package');
  let cursor = root;
  for (const part of rel.split('/')) { cursor = path.join(cursor, part); if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('Evidence link refused'); }
  if (!fs.statSync(p).isFile()) throw Error('Evidence not a file');
  return p;
}
export function resolveGit() {
  const lookup = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['git'], { encoding: 'utf8', windowsHide: true });
  if (lookup.status !== 0) throw Error('Official Git executable unavailable: ' + lookup.stderr);
  const executable = lookup.stdout.trim().split(/\r?\n/)[0];
  if (!path.isAbsolute(executable) || !fs.statSync(executable).isFile()) throw Error('Git must resolve to absolute executable');
  return fs.realpathSync(executable);
}
export function isolatedEnvironment(root, gitPath, inherited = process.env) {
  const home = path.join(root, 'home'); fs.mkdirSync(home, { recursive: true });
  const config = path.join(home, '.gitconfig');
  const hooks = path.join(home, 'hooks'); fs.mkdirSync(hooks);
  // Defaults belong in synthetic global scope so cases can deliberately study
  // local hooks/config without a command-scope override changing the oracle.
  fs.writeFileSync(config, `[core]\n hooksPath = /dev/null\n[credential]\n helper =\n[protocol]\n allow = never\n[protocol "file"]\n allow = always\n[gc]\n auto = 0\n[user]\n name = Synthetic Validation\n email = validation@example.invalid\n[commit]\n gpgsign = false\n[tag]\n gpgsign = false\n`);
  const temp = path.join(root, 'temp'); fs.mkdirSync(temp);
  const env = {};
  // Deliberate allowlist: no credentials, host Git redirectors, NODE_OPTIONS or user helpers.
  for (const key of ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS']) {
    const found = Object.keys(inherited).find(k => k.toLowerCase() === key.toLowerCase());
    if (found && inherited[found]) env[key] = inherited[found];
  }
  const system = env.SystemRoot ?? env.WINDIR ?? 'C:\\Windows';
  const gitDir = path.dirname(gitPath);
  env.PATH = [path.dirname(process.execPath), gitDir, path.resolve(gitDir, '../usr/bin'), path.join(system, 'System32'), system, path.join(system, 'System32/WindowsPowerShell/v1.0')].join(path.delimiter);
  Object.assign(env, {
    HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, 'xdg'), APPDATA: path.join(home, 'appdata'), LOCALAPPDATA: path.join(home, 'local'),
    TEMP: temp, TMP: temp, TMPDIR: temp,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: config, GIT_CONFIG_GLOBAL: config,
    GIT_CEILING_DIRECTORIES: root,
    GIT_AUTHOR_NAME: 'Synthetic Validation', GIT_AUTHOR_EMAIL: 'validation@example.invalid',
    GIT_COMMITTER_NAME: 'Synthetic Validation', GIT_COMMITTER_EMAIL: 'validation@example.invalid',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00+0000', GIT_COMMITTER_DATE: '2026-01-01T00:00:00+0000',
    GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', GIT_PAGER: 'cat', PAGER: 'cat',
    GIT_EDITOR: 'false', GIT_SEQUENCE_EDITOR: 'false', GIT_ASKPASS: 'false', SSH_ASKPASS: 'false',
    LC_ALL: 'C', LANG: 'C', NO_COLOR: '1',
  });
  return env;
}
export const DEFAULT_COMMAND_TIMEOUT_MS=30000;
export const DEFAULT_CLI_TIMEOUT_MS=90000;
export function executionTimeout(value,label='timeout') {
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>2147483647)throw new RangeError(label+' must be a positive finite number <= 2147483647 milliseconds');
  return value;
}
export async function execute(executable, argv, { cwd, env, stdin, timeout = DEFAULT_COMMAND_TIMEOUT_MS, maxOutput = 8 * 1024 * 1024, onSpawn } = {}) {
  timeout=executionTimeout(timeout);
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argv, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), timedOut = false, outputTruncated = false, error, termination = null, stopping = false, closed = false, drainTimer;
    const parentExited = () => child.exitCode !== null || child.signalCode !== null;
    const boundPipeDrain = () => {
      drainTimer = setTimeout(() => {
        if (closed) return;
        termination.forced_stream_close = true;
        termination.descendant_tree_confirmed = false;
        // Descendants may retain inherited pipe handles after the owned parent
        // exits. Closing our pipe ends bounds the wait; it does not kill or
        // certify those descendants. Never signal an exited/reusable PID.
        child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      }, 1000);
    };
    const stop = reason => {
      if (stopping) return;
      stopping = true;
      termination = { reason, method: 'no PID signalling', parent_already_exited: parentExited(), tree_exit: null, tree_error: null, direct_handle_killed: false, descendant_tree_confirmed: false, forced_stream_close: false, drain_timeout_ms: 1000 };
      if (termination.parent_already_exited) {
        termination.method = 'parent already exited; PID signalling refused; bounded pipe drain only';
      } else if (!Number.isInteger(child.pid)) {
        termination.method = 'spawn did not yield an owned PID; bounded pipe drain only';
      } else if (process.platform === 'win32') {
        const killer = path.join(env?.SystemRoot ?? process.env.SystemRoot ?? 'C:\\Windows', 'System32/taskkill.exe');
        const killed = spawnSync(killer, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8', timeout: 2000 });
        // Restricted Windows jobs can refuse taskkill's process-tree query.
        // Always release our own process handle; never let cleanup itself hang.
        const fallback = !parentExited() ? child.kill('SIGKILL') : false;
        Object.assign(termination, { method:'owned PID taskkill /T /F; owned process handle fallback',tree_exit:killed.status,tree_error:killed.stderr?.trim(),direct_handle_killed:fallback,descendant_tree_confirmed:killed.status===0 });
      } else {
        termination.method = 'owned process group SIGKILL; direct process handle fallback';
        try { process.kill(-child.pid, 'SIGKILL'); termination.group_signal_sent = true; }
        catch { termination.direct_handle_killed = !parentExited() ? child.kill('SIGKILL') : false; }
      }
      boundPipeDrain();
    };
    const collect = stream => chunk => {
      if (stdout.length + stderr.length + chunk.length > maxOutput) { outputTruncated = true; stop('output_limit'); return; }
      if (stream === 'out') stdout = Buffer.concat([stdout, chunk]); else stderr = Buffer.concat([stderr, chunk]);
    };
    child.stdout.on('data', collect('out')); child.stderr.on('data', collect('err'));
    child.on('error', e => { error = e; }); child.stdin.on('error', () => {});
    const timer = setTimeout(() => { timedOut = true; stop('timeout'); }, timeout);
    child.on('close', (code, signal) => {
      closed = true; clearTimeout(timer); clearTimeout(drainTimer);
      if (error) { try{if(error&&typeof error==='object')error.timeout_ms=timeout;}catch{/* Observability must not replace an immutable original error. */} reject(error); return; }
      resolve({ executable, argv, cwd, pid:child.pid, code, status: code, signal, timedOut, timed_out: timedOut, timeout_ms: timeout, termination, stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), stdoutBuffer: stdout, stderrBuffer: stderr, outputTruncated, duration_ms: Date.now() - started });
    });
    child.stdin.end(stdin === undefined ? undefined : stdin);
    if (onSpawn) { try { onSpawn(child); } catch (e) { error = e; stop('on_spawn_error'); } }
  });
}
export function createFixture(parent, name) {
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, name.replace(/[^\w-]/g, '_') + '-'));
  const nonce = crypto.randomUUID();
  json(path.join(root, '.git-compat-owned.json'), { nonce, parent: fs.realpathSync(parent) });
  return { root, nonce, parent: fs.realpathSync(parent) };
}
export function cleanupFixture(fixture) {
  if (!within(fixture.parent, fixture.root)) throw Error('Cleanup refused: outside owned parent');
  if (fs.lstatSync(fixture.root).isSymbolicLink()) throw Error('Cleanup refused: linked root');
  const marker = JSON.parse(fs.readFileSync(path.join(fixture.root, '.git-compat-owned.json'), 'utf8'));
  if (marker.nonce !== fixture.nonce || marker.parent !== fixture.parent || fs.realpathSync(path.dirname(fixture.root)) !== fixture.parent) throw Error('Cleanup refused: identity mismatch');
  // Node rm unlinks junctions/symlinks rather than traversing their targets; root is proven above.
  fs.rmSync(fixture.root, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
}
export function context(config) {
  const { repo, root, gitPath, buildDir, artifactDir, packageRoot, env } = config;
  const commandTimeoutMs=executionTimeout(config.commandTimeoutMs===undefined?DEFAULT_COMMAND_TIMEOUT_MS:config.commandTimeoutMs,'commandTimeoutMs');
  const cliTimeoutMs=executionTimeout(config.cliTimeoutMs===undefined?DEFAULT_CLI_TIMEOUT_MS:config.cliTimeoutMs,'cliTimeoutMs');
  const commands = [], assertions = [], snapshots = [];
  fs.mkdirSync(repo, { recursive: true }); fs.mkdirSync(artifactDir, { recursive: true });
  const portable = text => text.replaceAll(root, '<FIXTURE>').replaceAll(project, '<PROJECT>').replace(/S-1-\d+(?:-\d+)+/g, '<HOST-SID>').replace(/\(in the user's security context\)/g,'(synthetic fixture context)');
  const c = {
    ...config, commandTimeoutMs, cliTimeoutMs, commands, assertions, snapshots,
    write(rel, data) { const p = path.resolve(repo, rel); if (!within(root, p)) throw Error('Write outside fixture'); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); },
    read(rel) { const p = path.resolve(repo, rel); if (!within(root, p)) throw Error('Read outside fixture'); return fs.readFileSync(p, 'utf8'); },
    exists(rel) { return fs.existsSync(path.resolve(repo, rel)); },
    eq(id, observed, expected, source = 'case independent contract') {
      let passed = true; try { assert.deepStrictEqual(observed, expected); } catch { passed = false; }
      assertions.push({ id, expected, observed, passed, evidence_paths: snapshots.map(p => relative(packageRoot, p)), contract_source: source });
      assert.deepStrictEqual(observed, expected, id);
    },
    ok(id, condition, expected = true, observed = condition, source = 'case independent contract') {
      assertions.push({ id, expected, observed, passed: Boolean(condition), evidence_paths: snapshots.map(p => relative(packageRoot, p)), contract_source: source });
      assert.ok(condition, id);
    },
    async run(executable, argv, options = {}) {
      if (/^(electron|code|git-gui|gitk)(?:\.exe|\.cmd)?$/i.test(path.basename(executable)) || argv.some(a => /(?:^|[\\/])src[\\/]desktop(?:[\\/]|$)/i.test(String(a)))) throw Error('GUI route refused by headless harness');
      if(executable===gitPath) {const verb=gitVerb(argv);if(['gui','citool','gitk'].includes(verb)||(verb==='help'&&argv.some(a=>['-w','--web'].includes(a)))||(verb==='instaweb'&&!argv.some(a=>['--start','--stop','--restart'].includes(a))))throw Error('GUI route refused by headless harness');}
      const cwd = options.cwd ?? repo;
      if (!within(root, cwd) && path.resolve(cwd) !== path.resolve(root)) throw Error('Command outside fixture refused');
      const timeout=executionTimeout(options.timeout===undefined?commandTimeoutMs:options.timeout);
      const result = await execute(executable, argv, { ...options, timeout, cwd, env: { ...env, ...options.env } });
      const n = String(commands.length + 1).padStart(4, '0');
      const stdoutPath = path.join(artifactDir, n + '.stdout'), stderrPath = path.join(artifactDir, n + '.stderr');
      fs.writeFileSync(stdoutPath, portable(result.stdout)); fs.writeFileSync(stderrPath, portable(result.stderr));
      const binaryPaths = {};
      for (const [name, buffer, decoded] of [['stdout', result.stdoutBuffer, result.stdout], ['stderr', result.stderrBuffer, result.stderr]]) {
        if (buffer && !Buffer.from(decoded, 'utf8').equals(buffer)) {
          const rawPath = path.join(artifactDir, n + '.' + name + '.bin'); fs.writeFileSync(rawPath, buffer);
          binaryPaths[name + '_binary_path'] = relative(packageRoot, rawPath);
        }
      }
      let stdinPath = null;
      if (options.stdin !== undefined) { stdinPath = path.join(artifactDir, n + '.stdin'); fs.writeFileSync(stdinPath, options.stdin); }
      const cmd = { executable, argv: argv.map(a => portable(String(a))), cwd: portable(cwd), pid:result.pid, exit_code: result.code, timed_out: result.timedOut, timeout_ms:result.timeout_ms, signal: result.signal, termination:result.termination, stdout_path: relative(packageRoot, stdoutPath), stderr_path: relative(packageRoot, stderrPath), stdin_path: stdinPath && relative(packageRoot, stdinPath), duration_ms: result.duration_ms, expected_exit_codes: options.ok ?? [0], expected_signals:options.okSignals??[], output_truncated: result.outputTruncated, env_overrides: Object.fromEntries(Object.entries(options.env ?? {}).map(([k,v]) => [k, portable(String(v))])) };
      Object.assign(cmd,binaryPaths); commands.push(cmd);
      if (result.timedOut || result.outputTruncated || (!(options.ok ?? [0]).includes(result.code) && !(options.okSignals??[]).includes(result.signal))) throw Object.assign(Error(`Command failed ${argv.join(' ')}: exit=${result.code}, timeout=${result.timedOut}\n${result.stderr}`), { result });
      return result;
    },
    git(argv, options) { return c.run(gitPath, argv, options); },
    cli(argv, options = {}) { return c.run(process.execPath, [path.join(buildDir, 'cli.mjs'), '--cwd', repo, '--json', ...argv], { ...options, timeout:options.timeout===undefined?cliTimeoutMs:options.timeout }); },
    async core(method, args = [], options = {}) {
      const result = await c.run(process.execPath, [path.join(project, 'scripts/git-compat/core-call.mjs'), path.join(buildDir, 'core.mjs'), repo, method, JSON.stringify(args)], options);
      const value = JSON.parse(result.stdout);
      return value.result;
    },
    async init() {
      await c.git(['init', '-b', 'main']);
      for (const [key, value] of [['user.name', 'Synthetic Validation'], ['user.email', 'validation@example.invalid'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false'], ['tag.gpgsign', 'false']]) await c.git(['config', '--local', key, value]);
      c.write('base.txt', 'base one\n'); await c.git(['add', '--', 'base.txt']); await c.git(['commit', '-m', 'Synthetic base']);
    },
    async layer(name = 'tools', file = 'layer.txt', text = 'layer one\n') {
      await c.cli(['init']); await c.cli(['create', name]); await c.cli(['on', name]); c.write(file, text); await c.cli(['add', name, '--', file]); await c.cli(['commit', name, '-m', 'Synthetic Layer']);
    },
    async snapshot(label) {
      const snap = { label, files: [], metadata: [], commands: {} };
      if (!fs.existsSync(path.join(repo,'.git')) && !fs.existsSync(path.join(repo,'HEAD'))) {
        snap.repository='NOT_INITIALIZED';
        const p=path.join(artifactDir,`snapshot-${label.replace(/[^\w-]/g,'_')}.json`);json(p,snap);snapshots.push(p);return snap;
      }
      for (const [key, argv, ok] of [
        ['head', ['rev-parse', '--verify', 'HEAD'], [0,128]], ['symref', ['symbolic-ref', '-q', 'HEAD'], [0,1,128]],
        ['index', ['ls-files', '--stage', '-z'], [0,128]], ['refs', ['for-each-ref', '--format=%(refname) %(objectname)'], [0,128]],
        ['status', ['status', '--porcelain=v2', '-z', '--untracked-files=all'], [0,128]], ['tree', ['ls-tree', '-rz', 'HEAD'], [0,128]],
      ]) { snap.commands[key] = (await c.git(argv, { ok })).stdout; }
      for (const p of walk(repo)) {
        const rel = relative(repo, p);
        if (rel.startsWith('.git/') && !rel.startsWith('.git/git-layers/') && !rel.startsWith('.git/layers/')) continue;
        const stat = fs.statSync(p); const item = { path: rel, sha256: fileHash(p), bytes: stat.size, mode: stat.mode };
        (rel.startsWith('.git/') ? snap.metadata : snap.files).push(item);
      }
      snap.head = snap.commands.head.trim(); snap.symref = snap.commands.symref.trim(); snap.index = snap.commands.index; snap.refs = snap.commands.refs;
      const p = path.join(artifactDir, `snapshot-${label.replace(/[^\w-]/g, '_')}.json`); json(p, snap); snapshots.push(p); return snap;
    },
  };
  return c;
}

export function validateResult(result, packageRoot) {
  const required = ['schema_version','run_id','scenario_id','variant_id','phase','scope','requirement_ids','implementation_status','selection_status','execution_status','product_status','known_failure','known_issue_id','source_fingerprint','runner_fingerprint','environment_path','started_at','ended_at','duration_ms','commands','assertions','evidence','reproduction','nonexecution_reason','limits'];
  for (const key of required) if (!(key in result)) throw Error('Result missing ' + key);
  const enums = { phase:['NATIVE_BASELINE','CURRENT_PRODUCT','USER_REQUIREMENT','HARNESS','SPECIFICATION'], execution_status:['NOT_RUN','PASS','FAIL','ENV_BLOCKED','NOT_APPLICABLE'],product_status:['NOT_ASSESSED','PENDING_PRODUCT_SPEC','TEST_GAP','PRODUCT_GAP','DOCUMENTED_RESTRICTION','VERIFIED_SUPPORTED'],known_failure:['NONE','XFAIL_STRICT','XPASS_NEEDS_REVIEW'],selection_status:['SELECTED','NOT_SELECTED','OUT_OF_SCOPE_CURRENT_PHASE'],implementation_status:['SPEC_ONLY','IMPLEMENTED'] };
  if(result.schema_version !== '2.0' || !/^[A-Z]+-\d{3,}$/.test(result.scenario_id)) throw Error('Invalid result identity');
  for(const [key, values] of Object.entries(enums)) if(!values.includes(result[key])) throw Error('Invalid result enum: '+key);
  if (['PASS','FAIL'].includes(result.execution_status)) {
    if (result.implementation_status !== 'IMPLEMENTED' || result.selection_status !== 'SELECTED' || !result.source_fingerprint || !result.runner_fingerprint || !result.environment_path || !Number.isFinite(result.duration_ms) || result.duration_ms < 0 || !Number.isFinite(Date.parse(result.started_at)) || !Number.isFinite(Date.parse(result.ended_at))) throw Error('Executed result incomplete');
  }
  if(result.environment_path!==null)safeEvidence(packageRoot,result.environment_path);
  if (result.implementation_status === 'SPEC_ONLY' && result.execution_status !== 'NOT_RUN') throw Error('Specification cannot execute');
  if (result.selection_status !== 'SELECTED' && result.execution_status !== 'NOT_RUN') throw Error('Unselected cannot execute');
  if (['NOT_RUN','ENV_BLOCKED','NOT_APPLICABLE'].includes(result.execution_status) && !result.nonexecution_reason) throw Error('Missing nonexecution reason');
  if (result.execution_status === 'PASS' && (!result.assertions.length || result.assertions.some(a => a.passed !== true) || !result.evidence.length)) throw Error('Vacuous or false PASS');
  if (result.product_status === 'VERIFIED_SUPPORTED' && (result.execution_status !== 'PASS' || !['CURRENT_PRODUCT','USER_REQUIREMENT'].includes(result.phase))) throw Error('False product support');
  if (result.known_failure === 'XFAIL_STRICT' && (result.execution_status !== 'FAIL' || !result.known_issue_id)) throw Error('Invalid XFAIL');
  if (result.known_failure === 'XPASS_NEEDS_REVIEW' && (result.execution_status !== 'PASS' || !result.known_issue_id)) throw Error('Invalid XPASS');
  for (const cmd of result.commands) {
    if(!cmd.executable || !Array.isArray(cmd.argv) || !('exit_code' in cmd) || typeof cmd.timed_out !== 'boolean' || !('signal' in cmd)) throw Error('Malformed command');
    for(const key of ['stdout_path','stderr_path','stdin_path','stdout_binary_path','stderr_binary_path']) if(cmd[key]) safeEvidence(packageRoot, cmd[key]);
  }
  for (const a of result.assertions) {if(!a.id || !('expected' in a) || !('observed' in a) || !Array.isArray(a.evidence_paths) || ![true,false,null].includes(a.passed)) throw Error('Malformed assertion');for(const p of a.evidence_paths)safeEvidence(packageRoot,p);}
  for (const e of result.evidence) { const p = safeEvidence(packageRoot, e.path); if (!/^[0-9a-f]{64}$/.test(e.sha256) || fileHash(p) !== e.sha256 || fs.statSync(p).size !== e.bytes) throw Error('Evidence hash/size mismatch'); }
  return true;
}
