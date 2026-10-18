import { waitForAsync } from './wait.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function verifyInteractiveTerminal(app, page, repo, core, evidence) {
  const commands = page.locator('.terminal-commands');
  const state = () => page.evaluate(async () => (await window.lab.call('terminalState')).data);
  const waitText = async (text, after) => waitForAsync(page, async ({ text, after }) => {
    const result = await window.lab.call('terminalState');
    return result.ok && result.data.history.slice(after).includes(text);
  }, { text, after }, { timeout: 30000 });
  const prompt = () => waitForAsync(page, async () => {
    const result = await window.lab.call('terminalState');
    return result.ok && result.data.status === 'prompt' && !result.data.inputDirty;
  }, undefined, { timeout: 30000 });
  const type = async (text, enter = false) => {
    await page.getByTestId('terminal-output').locator('.xterm-helper-textarea').focus();
    await page.keyboard.type(text); if (enter) await page.keyboard.press('Enter');
  };
  const pasteCommand = async () => {
    await page.getByTestId('terminal-command-copy').click();
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), await page.getByTestId('terminal-command-preview').textContent());
    await page.getByTestId('terminal-output').locator('.xterm-helper-textarea').focus();
    await page.keyboard.press('ControlOrMeta+V');
    await page.keyboard.press('Enter');
  };
  await mkdir(path.join(repo, 'captura ação'));
  const capture = async () => {
    await prompt();
    await page.getByTestId('terminal-command-select').selectOption('capture');
    await commands.getByLabel(/^Layer/).selectOption('ai');
    await commands.getByLabel('Pasta de captura (opcional)', { exact: true }).fill('captura ação');
    const before = (await state()).history.length;
    await pasteCommand();
    await waitText('Captura ativa.', before);
  };
  await capture();
  assert.equal((await state()).status, 'busy');
  const activeSession = (await state()).sessionId;
  const captureSession = await core.captureReview();
  await page.getByTestId('terminal-command-copy').click();
  assert.equal((await state()).sessionId, activeSession, 'Copying must preserve the terminal session');
  assert.equal((await core.captureReview()).id, captureSession.id, 'Copying must preserve the active capture');
  const file = 'captura ação/arquivo ação.txt';
  await writeFile(path.join(repo, file), 'capturado no xterm\n');
  let before = (await state()).history.length;
  await type('q'); await waitText('Números separados por vírgula', before);
  before = (await state()).history.length;
  await type('todos', true); await waitText('Confirmar atribuição e staging?', before);
  await type('sim', true);
  await prompt();
  const capturedDeadline = Date.now() + 30000;
  let captured;
  do {
    captured = (await core.status()).layers.find(layer => layer.name === 'ai').staged.some(change => change.path === file);
    if (!captured) await new Promise(resolve => setTimeout(resolve, 100));
  } while (!captured && Date.now() < capturedDeadline);
  assert.ok(captured, (await state()).history);
  evidence.checks.push('xterm-interactive-capture-q-selection-confirmation-real-staging');
  await writeFile(path.join(repo, file), 'edição local a restaurar\n');
  await page.getByTestId('terminal-command-select').selectOption('restore');
  await commands.getByLabel(/^Proprietário/).selectOption('ai');
  await commands.getByLabel(/^Caminhos relativos/).fill(file);
  assert.equal(await commands.getByLabel('Confirmar explicitamente sem perguntar (--yes)', { exact: true }).isChecked(), false);
  before = (await state()).history.length;
  await pasteCommand();
  await waitText('Confirmar? Digite sim:', before);
  await type('sim', true); await prompt();
  // Wait for the new bytes too: an old/redrawn prompt is not completion proof.
  const deadline = Date.now() + 30000;
  while (await readFile(path.join(repo, file), 'utf8') !== 'capturado no xterm\n' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await readFile(path.join(repo, file), 'utf8'), 'capturado no xterm\n');
  evidence.checks.push('xterm-restore-requires-sim-and-preserves-staging');
  await capture();
  const cancelledFile = 'captura ação/cancelado.txt';
  await writeFile(path.join(repo, cancelledFile), 'preservado após Ctrl+C\n');
  await page.getByTestId('terminal-output').locator('.xterm-helper-textarea').focus();
  await page.keyboard.press('Control+C'); await prompt();
  await assert.rejects(() => core.captureReview(), { code: 'CAPTURE_NONE' });
  assert.equal(await readFile(path.join(repo, cancelledFile), 'utf8'), 'preservado após Ctrl+C\n');
  evidence.checks.push('xterm-ctrl-c-cancels-capture-preserves-files-and-returns-prompt');
}
