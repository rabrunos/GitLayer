import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { LabError } from './errors.js';

/** Portable policy: preserve spelling; refuse rather than rename nonportable paths. */
export function validatePath(input: string): string {
  if (typeof input !== 'string' || input.length === 0 || input.length > 4096) {
    throw new LabError('INVALID_PATH', 'O caminho deve ser relativo, não vazio e ter até 4096 caracteres.');
  }
  if (path.posix.isAbsolute(input) || path.win32.isAbsolute(input) || input.includes('\\')) {
    throw new LabError('INVALID_PATH', `Caminho absoluto ou separador não portátil: ${input}`);
  }
  if (/[\u0000-\u001f\u007f<>:"|?*\ud800-\udfff\ufffd]/u.test(input) || /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(input)) {
    throw new LabError('INVALID_PATH', `O caminho contém caracteres não portáteis: ${input}`);
  }
  if (input.normalize('NFC') !== input) {
    throw new LabError('UNICODE_PATH', `O caminho não está em Unicode NFC. Renomeie-o explicitamente: ${input}`);
  }
  const components = input.split('/');
  for (const component of components) {
    const compatible = component.normalize('NFKC').toLowerCase();
    if (!component || compatible === '.' || compatible === '..' || component.length > 240 || /[. ]$/u.test(component) || /[. ]$/u.test(compatible)) {
      throw new LabError('INVALID_PATH', `Componente de caminho não portátil: ${input}`);
    }
    if (compatible === '.git' || /^git~[1-9]$/iu.test(compatible) || /^\.git~[1-9]$/iu.test(compatible)) {
      throw new LabError('PROTECTED_PATH', `O diretório interno do Git é protegido: ${input}`);
    }
    if (/^(con|conin\$|conout\$|clock\$|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/iu.test(compatible)) {
      throw new LabError('INVALID_PATH', `Nome reservado do Windows: ${input}`);
    }
  }
  return input;
}

export function collisionKey(input: string): string {
  return input.normalize('NFKC').toUpperCase().toLowerCase();
}

/** Compare components, including canonical Unicode/case variants and file/dir overlap. */
export function assertNoCollisions(entries: { path: string; owner: string }[]): void {
  const seen = new Map<string, { path: string; owner: string }>();
  const directories = new Map<string, { path: string; owner: string }>();
  for (const entry of entries) {
    validatePath(entry.path);
    const key = collisionKey(entry.path);
    const previous = seen.get(key);
    if (previous && (previous.owner !== entry.owner || previous.path !== entry.path)) {
      throw new LabError('PATH_COLLISION', `Colisão entre ${previous.owner} e ${entry.owner}: ${previous.path} / ${entry.path}`, { first: previous, second: entry });
    }
    seen.set(key, entry);
    const components = entry.path.split('/');
    for (let i = 1; i < components.length; i++) {
      const directory = components.slice(0, i).join('/');
      const directoryKey = collisionKey(directory);
      const other = directories.get(directoryKey);
      if (other && other.path !== directory) {
        throw new LabError('PATH_COLLISION', `Diretórios diferem apenas por caixa/Unicode: ${other.path} / ${directory}`, { first: other, second: entry });
      }
      directories.set(directoryKey, { path: directory, owner: entry.owner });
    }
  }
  for (const [key, entry] of seen) {
    const parts = key.split('/');
    for (let i = 1; i < parts.length; i++) {
      const previous = seen.get(parts.slice(0, i).join('/'));
      if (previous && previous.owner !== entry.owner) {
        throw new LabError('PATH_COLLISION', `Colisão arquivo/diretório entre ${previous.owner} e ${entry.owner}: ${previous.path} / ${entry.path}`, { first: previous, second: entry });
      }
    }
  }
}

/** Resolve an approved relative path without following a symlink or special file. */
export async function safePath(root: string, input: string, allowMissing = true): Promise<string> {
  const p = validatePath(input);
  const canonicalRoot = await realpath(root);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new LabError('UNSAFE_PATH', 'A raiz do workspace não pode ser um link.');
  }
  let current = canonicalRoot;
  const parts = p.split('/');
  for (let i = 0; i < parts.length; i++) {
    // Existing empty directories also participate in portable alias protection.
    const siblings = await readdir(current);
    const alias = siblings.find(name => collisionKey(name) === collisionKey(parts[i]!) && name !== parts[i]);
    if (alias) throw new LabError('PATH_COLLISION', `Caminho existente difere apenas por caixa/Unicode: ${alias} / ${parts[i]}`);
    current = path.join(current, parts[i]!);
    let stat;
    try { stat = await lstat(current); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && allowMissing) {
        return path.join(canonicalRoot, ...parts);
      }
      throw error;
    }
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new LabError('UNSAFE_PATH', `Links e arquivos especiais não são suportados: ${p}`);
    }
    if (stat.isFile() && stat.nlink > 1) throw new LabError('UNSAFE_PATH', `Hardlink não suportado: ${p}`);
    if (i < parts.length - 1 && !stat.isDirectory()) {
      throw new LabError('PATH_COLLISION', `Um arquivo ocupa um diretório necessário: ${p}`);
    }
    if (stat.isDirectory()) {
      // Nested repositories are not a safe composition target either.
      try {
        await lstat(path.join(current, '.git'));
        throw new LabError('NESTED_REPOSITORY', `Repositório aninhado não suportado: ${p}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
  return current;
}

/** Snapshot regular files only; refuse links, skip protected Git internals. */
export async function walk(root: string, scope = ''): Promise<string[]> {
  const canonicalRoot = await realpath(root);
  const start = scope ? await safePath(canonicalRoot, scope, false) : canonicalRoot;
  const files: string[] = [];
  const visit = async (absolute: string, relative: string): Promise<void> => {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new LabError('UNSAFE_PATH', `Links e arquivos especiais não são percorridos: ${relative}`);
    }
    if (stat.isFile()) {
      if (stat.nlink > 1) throw new LabError('UNSAFE_PATH', `Hardlink não suportado: ${relative}`);
      files.push(validatePath(relative)); return;
    }
    const children = await readdir(absolute, { withFileTypes: true });
    if (relative && children.some(child => collisionKey(child.name) === '.git')) {
      throw new LabError('NESTED_REPOSITORY', `Repositório aninhado não é percorrido: ${relative}`);
    }
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      if (collisionKey(child.name) === '.git') continue;
      const next = relative ? `${relative}/${child.name}` : child.name;
      validatePath(next);
      if (child.isSymbolicLink()) {
        throw new LabError('UNSAFE_PATH', `Link não suportado: ${next}`);
      }
      await visit(path.join(absolute, child.name), next);
    }
  };
  await visit(start, scope);
  return files;
}
