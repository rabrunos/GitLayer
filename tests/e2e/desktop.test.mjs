import { waitForAsync } from './wait.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { verifyInteractiveTerminal } from './terminal-scenario.mjs';

// This test launches the real local or packaged application. It intentionally does not
// pass --no-sandbox: unavailable sandbox/display is an environment failure,
// never evidence that the secure packaged application was tested successfully.
test('desktop real: Monaco local, Git real, limites IPC e conteúdo inerte', { timeout: 600_000 }, async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'git-layers-e2e-'));
  const repo = path.join(temp, 'repo com espaços ação');
  const profile = path.join(temp, 'profile');
  await mkdir(repo); await mkdir(profile);
  const evidence = { status: 'running', phase: 'core-import', platform: process.platform, arch: process.arch, appMode: process.env.LAB_E2E_APP ? 'local-source' : 'packaged', isolatedProfile: true, sandboxDisabled: false, checks: [], pageErrors: [], consoleErrors: [] };
  let app;
  let phase = evidence.phase;
  Object.defineProperty(evidence, 'phase', { enumerable: true, get: () => phase, set: value => { phase = value; console.log('UI phase: ' + value); } });
  try {
    const dist = path.resolve(process.env.LAB_E2E_DIST || 'dist');
    const { GitLayers } = await import(pathToFileURL(path.join(dist, 'core/index.js')).href);
    const { resolveGitExecutable, normalizeProcessEnvironment, DISABLED_GIT_HOOKS } = await import(pathToFileURL(path.join(dist, 'core/platform.js')).href);
    const env = normalizeProcessEnvironment(process.env);
    for (const key of Object.keys(env)) if (/^GIT_/i.test(key) || key === 'ELECTRON_RUN_AS_NODE') delete env[key];
    Object.assign(env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: path.join(temp, 'cache') });
    const gitExecutable = await resolveGitExecutable(env);
    const git = args => execFileSync(gitExecutable, ['-c', `core.hooksPath=${DISABLED_GIT_HOOKS}`, '-c', 'core.fsmonitor=false', ...args], { cwd: repo, env, encoding: 'utf8', shell: false, windowsHide: true });
    evidence.phase = 'git-fixture';
    evidence.gitVersion = git(['version']).trim();
    git(['init', '-b', 'main']); git(['config', '--local', 'core.autocrlf', 'false']); git(['config', '--local', 'user.name', 'Electron Test']); git(['config', '--local', 'user.email', 'test@example.invalid']);
    await writeFile(path.join(repo, 'README.md'), '# Electron fixture\n');
    await writeFile(path.join(repo, 'index.html'), '<script>globalThis.__repositoryExecuted = true; fetch("https://example.invalid/forbidden")</script>\n');
    git(['add', '--', 'README.md', 'index.html']); git(['commit', '-m', 'Base real']);
    const core = await GitLayers.open(repo); await core.init(); await core.create('ai'); await core.on('ai');
    await writeFile(path.join(repo, 'AGENTS.md'), 'Layer independente\n'); await core.add('ai', ['AGENTS.md']); await core.commit('ai', 'Layer real');
    evidence.checks.push('real-git-fixture-and-independent-layer');
    evidence.phase = 'electron-runtime';
    const executable = process.env.LAB_E2E_EXECUTABLE || (process.platform === 'darwin' ? path.resolve(`artifacts/Git Layers Lab-darwin-${process.arch}/Git Layers Lab.app/Contents/MacOS/git-layers-lab`) : path.resolve(`artifacts/Git Layers Lab-${process.platform}-${process.arch}/git-layers-lab${process.platform === 'win32' ? '.exe' : ''}`));
    await access(executable);
    // A packaged application's --version can launch its UI/profile instead of
    // exiting. Probe only the embedded runtime here; launch below tests sandbox.
    const runtime = spawnSync(executable, ['-p', 'process.versions.electron'], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', shell: false, timeout: 10_000, windowsHide: true });
    evidence.runtimeProbe = { exitCode: runtime.status, signal: runtime.signal, stdout: runtime.stdout, stderr: runtime.stderr, error: runtime.error?.message };
    assert.equal(runtime.status, 0, `O runtime Electron não respondeu: ${runtime.stderr || runtime.error || runtime.signal}`);
    evidence.phase = 'electron-launch';
    const args = [...(process.env.LAB_E2E_APP ? [path.resolve(process.env.LAB_E2E_APP)] : []), `--lab-profile=${profile}`, `--repo=${repo}`];
    app = await electron.launch({ executablePath: executable, args, env, chromiumSandbox: true, timeout: 30_000 });
    app.process().stdout?.on('data', chunk => process.stdout.write(chunk));
    app.process().stderr?.on('data', chunk => process.stderr.write(chunk));
    const page = await app.firstWindow();
    evidence.runtime = await app.evaluate(({ app }) => ({ executable: process.execPath, versions: process.versions, arch: process.arch, platform: process.platform, appPath: app.getAppPath(), packaged: app.isPackaged }));
    page.on('pageerror', error => evidence.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
    evidence.phase = 'workspace-open';
    await page.getByTestId('workspace').waitFor({ timeout: 30_000 });
    evidence.checks.push('desktop-opened-isolated-repository');
    const layerFile = page.locator('.file-row').filter({ hasText: 'AGENTS.md' });
    const layerBadge = layerFile.getByRole('img', { name: 'Layer ai', exact: true });
    await layerBadge.waitFor();
    assert.equal(await layerBadge.getAttribute('title'), 'Layer ai');
    assert.equal(await layerBadge.textContent(), '', 'Layer badge is a symbol, with its owner available to assistive technology and hover');
    assert.doesNotMatch(await layerFile.textContent(), /Layer ai/, 'Layer owner is not repeated as visible text beside the filename');
    await layerFile.click();
    const layerTab = page.getByRole('tab', { name: /AGENTS\.md/ });
    assert.equal(await layerTab.getByRole('img', { name: 'Layer ai', exact: true }).getAttribute('title'), 'Layer ai');
    assert.doesNotMatch(await layerTab.textContent(), /Layer ai/);
    evidence.checks.push('explorer-layer-symbol-owner-in-label-and-tooltip');
    const requests = [];
    page.on('request', request => { if (/^https?:/i.test(request.url())) requests.push(request.url()); });
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false); assert.equal(preferences.sandbox, true); assert.equal(preferences.webSecurity, true);
    evidence.checks.push('renderer-sandbox-context-isolation-web-security');
    evidence.phase = 'ipc-and-monaco';
    for (const target of ['../outside', '.git/config', '/etc/passwd']) {
      const denied = await page.evaluate(path => window.lab.call('read', { path }), target);
      assert.equal(denied.ok, false, `IPC should reject ${target}`);
    }
    assert.equal((await page.evaluate(() => window.lab.call('arbitrary-shell', { command: 'echo unsafe' }))).ok, false);
    assert.equal((await page.evaluate(() => window.lab.call('write', { path: '../outside', text: 'unsafe' }))).ok, false);
    await page.locator('.file-row').filter({ hasText: 'index.html' }).click();
    await page.locator('.monaco-editor').first().waitFor();
    assert.equal(await page.evaluate(() => globalThis.__repositoryExecuted), undefined);
    evidence.checks.push('ipc-boundaries-and-repository-content-inert');
    await page.locator('.file-row').filter({ hasText: 'README.md' }).click();
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.type('Editado no Monaco.');
    await page.waitForFunction(() => document.querySelector('.editor-status')?.textContent.includes('Não salvo no editor'));
    assert.equal(await readFile(path.join(repo, 'README.md'), 'utf8'), '# Electron fixture\n', 'Typing changes only the buffer');
    await page.getByRole('button', { name: /Salvar/ }).click();
    const readmeFile = page.locator('.file-row').filter({ hasText: 'README.md' });
    await readmeFile.locator('.git-decoration').filter({ hasText: 'M' }).waitFor();
    assert.equal(await readmeFile.getAttribute('data-git-status'), 'M');
    assert.equal(await readmeFile.locator('.git-decoration').textContent(), 'M', 'Saved disk modification receives the standard Git M marker');
    assert.equal(await page.getByRole('tab', { name: /README\.md/ }).locator('.git-decoration').textContent(), 'M');
    await page.getByTitle('Ver diff de README.md', { exact: true }).click();
    await page.locator('.diff-content').waitFor();
    assert.match(await page.locator('.hunks').textContent(), /Editado no Monaco\./);
    await page.getByRole('button', { name: 'Fechar diff', exact: true }).click();
    await page.getByRole('button', { name: 'Stage README.md', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mensagem de commit' }).fill('Commit real pela interface');
    await page.getByRole('button', { name: 'Commit na main', exact: true }).click();
    evidence.phase = 'real-commit';
    await waitForAsync(page, async () => {
      const result = await window.lab.call('log', { owner: 'base' });
      return result.ok && result.data[0]?.subject === 'Commit real pela interface';
    });
    assert.match(await readFile(path.join(repo, 'README.md'), 'utf8'), /Editado no Monaco\./);
    assert.equal(git(['log', '-1', '--format=%s']).trim(), 'Commit real pela interface');
    assert.equal(git(['symbolic-ref', 'HEAD']).trim(), 'refs/heads/main');
    assert.deepEqual(git(['ls-tree', '-r', '--name-only', 'layer/ai']).trim().split('\n'), ['AGENTS.md']);
    await readmeFile.locator('.git-decoration').waitFor({ state: 'detached' });
    assert.equal(await readmeFile.getAttribute('data-git-status'), '');
    assert.equal(await readmeFile.locator('.git-decoration').count(), 0, 'Real commit clears the file Git marker');
    assert.equal(await page.getByRole('tab', { name: /README\.md/ }).locator('.git-decoration').count(), 0);
    assert.equal(await layerBadge.getAttribute('title'), 'Layer ai', 'Layer ownership survives the independent main commit');
    evidence.checks.push('explorer-git-modified-marker-clears-after-real-commit');
    evidence.checks.push('monaco-save-stage-real-main-commit-layer-preserved');
    evidence.phase = 'doctor-assets-theme';
    const report = await page.evaluate(() => window.lab.call('doctor', { fsck: true }));
    assert.equal(report.ok, true); assert.equal(report.data.safe, true);
    const assets = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
    assert.equal(assets.some(url => /^https?:/i.test(url)), false);
    assert.deepEqual(requests, [], 'No normal operation requests network');
    await page.getByRole('button', { name: 'Alternar tema', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.deepEqual(evidence.pageErrors, [], 'Renderer has no unhandled JavaScript errors');
    evidence.checks.push('doctor-fsck-local-assets-network-free-theme');
    evidence.phase = 'real-terminal-command-panel';
    await page.getByTestId('terminal-toggle').click();
    await page.getByTestId('terminal-panel').waitFor();
    await waitForAsync(page, async () => {
      const result = await window.lab.call('terminalState');
      return result.ok && result.data.status === 'prompt';
    }, undefined, { timeout: 20_000 });
    const terminalBeforePanel = await page.evaluate(async () => (await window.lab.call('terminalState')).data.history);
    await page.getByTestId('terminal-command-select').selectOption('status');
    await page.getByLabel('Saída JSON (--json)', { exact: true }).check();
    await page.getByTestId('terminal-command-copy').click();
    const copiedCommand = await app.evaluate(({ clipboard }) => clipboard.readText());
    assert.equal(copiedCommand, await page.getByTestId('terminal-command-preview').textContent());
    assert.match(copiedCommand, /status.*--json/);
    assert.equal((await page.evaluate(async () => (await window.lab.call('terminalState')).data)).inputDirty, false);
    assert.equal(await page.getByTestId('terminal-command-run').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.lab.call('terminalCommand', { id: 'status', values: {}, execute: true })), { ok: false, error: { code: 'IPC_ACTION', message: 'Operação IPC não permitida.' } });
    // Clipboard only: execution requires the user's deliberate paste and Enter.
    assert.equal((await page.evaluate(async () => (await window.lab.call('terminalState')).data.history)).includes(copiedCommand), false);
    await page.getByTestId('terminal-output').locator('.xterm-helper-textarea').focus();
    await page.keyboard.press('ControlOrMeta+V');
    await page.keyboard.press('Enter');
    await waitForAsync(page, async before => {
      const result = await window.lab.call('terminalState');
      if (!result.ok || result.data.status !== 'prompt' || result.data.inputDirty) return false;
      return (result.data.history.match(/"ok"\s*:\s*true/g) ?? []).length > before;
    }, (terminalBeforePanel.match(/"ok"\s*:\s*true/g) ?? []).length, { timeout: 20_000 });
    evidence.checks.push('clipboard-only-panel-no-command-execution-ipc-manual-paste-status');
    evidence.phase = 'real-terminal-keyboard-cli';
    const terminalBeforeKeyboard = await page.evaluate(async () => (await window.lab.call('terminalState')).data.history);
    await page.getByTestId('terminal-output').locator('.xterm-helper-textarea').focus();
    assert.match(await page.evaluate(() => document.activeElement?.className ?? ''), /xterm-helper-textarea/);
    await page.keyboard.type('git layer status --json');
    await page.keyboard.press('Enter');
    await waitForAsync(page, async before => {
      const result = await window.lab.call('terminalState');
      if (!result.ok || result.data.status !== 'prompt' || result.data.inputDirty) return false;
      return (result.data.history.match(/"ok"\s*:\s*true/g) ?? []).length > before;
    }, (terminalBeforeKeyboard.match(/"ok"\s*:\s*true/g) ?? []).length, { timeout: 20_000 });
    assert.deepEqual(evidence.pageErrors, [], 'Terminal has no unhandled JavaScript errors');
    evidence.checks.push('real-pty-keyboard-git-layer-status');
    await page.getByTestId('terminal-output').locator('.xterm-helper-textarea').focus();
    await page.keyboard.type('echo linha em edição');
    await waitForAsync(page, async () => (await window.lab.call('terminalState')).data?.inputDirty === true);
    await page.getByTestId('terminal-command-copy').click();
    assert.equal((await page.evaluate(async () => (await window.lab.call('terminalState')).data)).inputDirty, true, 'Copy must preserve an unfinished input line');
    await page.getByTestId('terminal-output').locator('.xterm-helper-textarea').focus();
    await page.keyboard.press('Control+C');
    await waitForAsync(page, async () => { const result = await window.lab.call('terminalState'); return result.ok && result.data.status === 'prompt' && !result.data.inputDirty; });
    evidence.checks.push('copy-preserves-unfinished-terminal-line-and-manual-ctrl-c');
    const firstReply = await page.evaluate(async () => {
      const slow = window.lab.call('snapshot').then(() => 'snapshot');
      const fast = window.lab.call('terminalState').then(result => result.ok ? 'terminal' : 'error');
      const first = await Promise.race([slow, fast]); await slow; return first;
    });
    assert.equal(firstReply, 'terminal', 'PTY input/state must not wait behind a Git snapshot');
    evidence.checks.push('terminal-fast-lane-during-real-git-snapshot');
    evidence.phase = 'interactive-terminal-capture-restore-cancel';
    await verifyInteractiveTerminal(app, page, repo, core, evidence);
    await page.getByTestId('terminal-status').filter({ hasText: 'Pronto para comando' }).waitFor();
    assert.equal(await page.locator('.terminal-error').count(), 0, await page.locator('.terminal-error').allTextContents().then(values => values.join('\n')));
    evidence.terminalHistory = (await page.evaluate(async () => (await window.lab.call('terminalState')).data.history)).slice(-12000);
    if (process.env.LAB_E2E_SCREENSHOTS === '1' && process.env.LAB_E2E_REPORT_FILE) {
      const screenshot = path.join(path.dirname(process.env.LAB_E2E_REPORT_FILE), 'ui-desktop.png');
      await mkdir(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true });
      evidence.screenshot = path.basename(screenshot);
    }
    evidence.status = 'passed'; evidence.phase = 'complete';
  } catch (error) {
    evidence.status = 'failed';
    evidence.error = { name: error.name, message: error.message, stack: error.stack };
    if (app) {
      try {
        const page = app.windows()[0];
        evidence.terminalErrors = await page.locator('.terminal-error').allTextContents();
        evidence.fileRows = await page.locator('.file-row').evaluateAll(rows => rows.map(row => ({ html: row.outerHTML })));
        evidence.terminalHistory = await page.evaluate(async () => (await window.lab.call('terminalState')).data?.history);
        await page.screenshot({ path: path.join(path.dirname(process.env.LAB_E2E_REPORT_FILE || path.join(temp, 'report.json')), 'ui-failed.png') });
      } catch { /* Preserve the original failure. */ }
    }
    throw error;
  } finally {
    let cleanupError;
    try { if (app) await app.close(); } catch (error) { cleanupError = error; }
    try { await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    catch (error) { cleanupError ??= error; }
    const failedDuringCleanup = cleanupError && evidence.status !== 'failed';
    if (cleanupError) {
      evidence.cleanupError = { name: cleanupError.name, message: cleanupError.message };
      evidence.status = 'failed';
      if (failedDuringCleanup) evidence.phase = 'cleanup';
    }
    if (process.env.LAB_E2E_REPORT_FILE) {
      await mkdir(path.dirname(process.env.LAB_E2E_REPORT_FILE), { recursive: true });
      await writeFile(process.env.LAB_E2E_REPORT_FILE, JSON.stringify(evidence, null, 2) + '\n');
    }
    if (failedDuringCleanup) throw cleanupError;
  }
});

test('desktop: abrir Git existente e inicializar explicitamente uma pasta nova', { timeout: 180000 }, async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'git-layers-open-e2e-'));
  const fresh = path.join(temp, 'pasta nova ação');
  const existing = path.join(temp, 'Git existente');
  await mkdir(fresh); await mkdir(existing);
  const file = path.join(fresh, 'arquivo preservado.txt');
  await writeFile(file, 'conteúdo anterior\r\n');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const { resolveGitExecutable } = await import(pathToFileURL(path.resolve(process.env.LAB_E2E_DIST || 'dist', 'core/platform.js')).href);
  const git = await resolveGitExecutable(env);
  execFileSync(git, ['init', '-b', 'main'], { cwd: existing, env, windowsHide: true });
  let app;
  try {
    const executable = process.env.LAB_E2E_EXECUTABLE || path.resolve('artifacts/Git Layers Lab-win32-x64/git-layers-lab.exe');
    app = await electron.launch({ executablePath: executable, args: [...(process.env.LAB_E2E_APP ? [path.resolve(process.env.LAB_E2E_APP)] : []), '--lab-profile=' + path.join(temp, 'profile')], env, chromiumSandbox: true });
    const page = await app.firstWindow();
    await page.locator('.welcome').waitFor();
    const pick = directory => app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, directory);
    await pick(fresh);
    await page.getByTestId('open').click();
    await page.getByRole('alert').filter({ hasText: /Git|repositório/i }).waitFor();
    await assert.rejects(access(path.join(fresh, '.git')), { code: 'ENOENT' });
    await page.getByRole('button', { name: 'Inicializar pasta com Git', exact: true }).click();
    await page.getByTestId('workspace').waitFor();
    assert.equal(await readFile(file, 'utf8'), 'conteúdo anterior\r\n');
    assert.equal(execFileSync(git, ['rev-parse', '--is-inside-work-tree'], { cwd: fresh, encoding: 'utf8', windowsHide: true }).trim(), 'true');
    await pick(existing);
    await page.getByTestId('open').click();
    await page.waitForFunction(root => document.querySelector('.repo-bar')?.textContent.includes(root), existing);
    assert.equal((await page.evaluate(() => window.lab.call('runtime'))).data.repositoryOpen, true);
    if (process.env.LAB_E2E_REPORT_FILE) await writeFile(path.join(path.dirname(process.env.LAB_E2E_REPORT_FILE), 'ui-workspace.json'), JSON.stringify({ status: 'passed', platform: process.platform, checks: ['open-non-git-refuses-without-initialization', 'explicit-ui-initialize-preserves-existing-bytes', 'ui-opens-existing-git-folder'], dialogSelection: 'stubbed only OS folder picker; real window, IPC, filesystem and Git' }, null, 2) + '\n');
  } finally {
    if (app) await app.close();
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
