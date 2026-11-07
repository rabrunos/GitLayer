import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const gitExe = process.env.GIT_LAYER_GIT || 'git';
const split = text => text.split('\0').filter(Boolean);
const begin = '# >>> git-layer-lab';
const end = '# <<< git-layer-lab';

export function runGit(args, { cwd, index, input, allowFailure = false } = {}) {
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  if (index) env.GIT_INDEX_FILE = index;
  const result = spawnSync(gitExe, ['--literal-pathspecs', ...args], {
    cwd, env, input, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `git ${args[0]} terminou com código ${result.status}`);
  }
  return result;
}

export class GitLayer {
  constructor(cwd = process.cwd()) {
    this.cwd = path.resolve(cwd);
    const roots = runGit(['rev-parse', '--show-toplevel', '--absolute-git-dir'], { cwd: this.cwd }).stdout.trim().split(/\r?\n/);
    [this.root, this.gitDir] = roots;
    this.store = path.join(this.gitDir, 'git-layer-lab');
    this.stateFile = path.join(this.store, 'state.json');
    this.state = fs.existsSync(this.stateFile)
      ? JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) : { active: [] };
  }

  git(args, options = {}) { return runGit(args, { cwd: this.root, ...options }); }
  ref(name) { return `refs/heads/layer/${name}`; }
  names() {
    return this.git(['for-each-ref', '--format=%(refname:strip=3)', 'refs/heads/layer/']).stdout.trim().split(/\r?\n/).filter(Boolean);
  }
  tip(name) { return this.git(['rev-parse', '--verify', this.ref(name)]).stdout.trim(); }
  indexPath(name) { return path.join(this.store, 'indexes', Buffer.from(name).toString('base64url')); }
  index(name) {
    const index = this.indexPath(name);
    if (!fs.existsSync(index)) {
      fs.mkdirSync(path.dirname(index), { recursive: true });
      this.git(['read-tree', this.tip(name)], { index });
    }
    return index;
  }
  save() {
    fs.mkdirSync(this.store, { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state) + '\n');
  }
  active(name) { return this.state.active.includes(name); }
  requireActive(name) {
    this.tip(name);
    if (!this.active(name)) throw new Error(`Layer ${name} está inativa; execute on ${name}.`);
  }
  treeFiles(ref) {
    const result = this.git(['ls-tree', '-r', '--name-only', '-z', ref], { allowFailure: true });
    if (result.status !== 0) {
      // An unborn conventional branch has no tree yet.
      if (ref === 'HEAD' && this.git(['rev-parse', '--verify', 'HEAD'], { allowFailure: true }).status !== 0) return [];
      throw new Error(result.stderr.trim());
    }
    return split(result.stdout);
  }
  indexFiles(index) { return split(this.git(['ls-files', '--cached', '-z'], { index }).stdout); }
  owned(name) {
    return new Set([...this.treeFiles(this.ref(name)), ...this.indexFiles(this.index(name))]);
  }
  syncExclude() {
    const owned = new Set();
    for (const name of this.names()) for (const file of this.owned(name)) owned.add(file);
    const exclude = this.git(['rev-parse', '--git-path', 'info/exclude']).stdout.trim();
    const file = path.resolve(this.root, exclude);
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const start = old.indexOf(begin);
    let user = old;
    if (start !== -1) {
      const stop = old.indexOf(end, start);
      if (stop === -1) throw new Error('Bloco git-layer-lab incompleto em info/exclude.');
      user = old.slice(0, start) + old.slice(stop + end.length).replace(/^\r?\n/, '');
    }
    const rules = [...owned].sort().map(p => '/' + p.replace(/([\\*?\[\] #!])/g, '\\$1'));
    const next = user + (user && !user.endsWith('\n') ? '\n' : '') + begin + '\n' + rules.join('\n') + '\n' + end + '\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (old !== next) fs.writeFileSync(file, next);
  }

  create(name) {
    if (!name) throw new Error('Informe o nome da Layer.');
    this.git(['check-ref-format', this.ref(name)]);
    const exists = this.git(['show-ref', '--verify', '--quiet', this.ref(name)], { allowFailure: true });
    if (exists.status === 0) throw new Error(`Layer ${name} já existe.`);
    const tree = this.git(['mktree'], { input: '' }).stdout.trim();
    const oid = this.git(['commit-tree', tree], { input: `Initialize Layer ${name}\n` }).stdout.trim();
    this.git(['update-ref', '-m', `layer: create ${name}`, this.ref(name), oid, '0'.repeat(oid.length)]);
    this.index(name);
    this.save();
    return oid;
  }

  on(name) {
    this.tip(name);
    if (this.active(name)) return;
    this.syncExclude();
    this.git(['checkout-index', '-a', '-f', '-u'], { index: this.index(name) });
    this.state.active.push(name);
    this.save();
  }

  off(name) {
    this.tip(name);
    if (!this.active(name)) return;
    const index = this.index(name);
    const staged = this.git(['diff', '--cached', '--quiet', this.ref(name)], { index, allowFailure: true });
    const modified = this.git(['diff', '--quiet'], { index, allowFailure: true });
    if (staged.status > 1 || modified.status > 1) throw new Error((staged.stderr + modified.stderr).trim());
    if (staged.status !== 0 || modified.status !== 0) throw new Error(`Layer ${name} tem alterações; prepare e faça commit antes de off.`);
    for (const file of this.indexFiles(index)) fs.unlinkSync(path.join(this.root, file));
    this.state.active = this.state.active.filter(n => n !== name);
    this.save();
  }

  add(name, paths = ['.']) {
    this.requireActive(name);
    const scopes = paths.map(p => {
      const absolute = path.resolve(this.cwd, p);
      const relative = path.relative(this.root, absolute).split(path.sep).join('/');
      if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) throw new Error(`Caminho fora do repositório: ${p}`);
      return relative;
    });
    const selected = file => scopes.some(p => !p || p === file || file.startsWith(p + '/'));
    const index = this.index(name);
    const indexed = new Set(this.indexFiles(index));
    const own = new Set([...this.treeFiles(this.ref(name)), ...indexed]);
    const reserved = new Set([...this.treeFiles('HEAD'), ...this.indexFiles()]);
    for (const other of this.names()) if (other !== name) for (const file of this.owned(other)) reserved.add(file);
    const tracked = [...own].filter(p => selected(p) && (indexed.has(p) || fs.existsSync(path.join(this.root, p))));
    const free = split(this.git(['ls-files', '--others', '--exclude-standard', '--full-name', '-z', '--', ...paths], { cwd: this.cwd }).stdout)
      .filter(p => !reserved.has(p) && !own.has(p));
    const stage = (files, force) => {
      if (files.length) this.git(['add', '-A', ...(force ? ['-f'] : []), '--pathspec-from-file=-', '--pathspec-file-nul'], {
        index, input: files.join('\0') + '\0',
      });
    };
    stage(tracked, true);
    stage(free, false);
    this.syncExclude();
    return { updated: tracked.length, added: free.length };
  }

  commit(name, message) {
    if (!message?.trim()) throw new Error('A mensagem de commit não pode ser vazia.');
    const parent = this.tip(name);
    const index = this.index(name);
    const tree = this.git(['write-tree'], { index }).stdout.trim();
    const previous = this.git(['rev-parse', `${parent}^{tree}`]).stdout.trim();
    if (tree === previous) throw new Error(`Layer ${name} não tem alterações preparadas.`);
    const oid = this.git(['commit-tree', tree, '-p', parent], { input: message + '\n' }).stdout.trim();
    this.git(['update-ref', '-m', `layer: ${message.split('\n')[0]}`, this.ref(name), oid, parent]);
    this.syncExclude();
    return oid;
  }

  changes(name, staged) {
    const args = ['diff', ...(staged ? ['--cached', this.ref(name)] : []), '--name-status', '--no-renames', '-z'];
    const fields = split(this.git(args, { index: this.index(name) }).stdout);
    const changes = [];
    for (let i = 0; i < fields.length; i += 2) changes.push({ status: fields[i], path: fields[i + 1] });
    return changes;
  }
  status() {
    return { layers: this.names().map(name => ({ name, active: this.active(name), staged: this.changes(name, true), modified: this.active(name) ? this.changes(name, false) : [] })) };
  }
  log(name, args = []) { this.tip(name); return this.git(['--no-pager', 'log', this.ref(name), ...args]).stdout; }
}
