import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { project, walk, relative, fileHash, json, safeEvidence, within } from './lib.mjs';
import { validateOutputRoot } from './output-root.mjs';

// An explicit, offline derivative operation. Published ZIPs and archived source
// bytes are never rewritten. Raw originals stay in a fresh private directory.
export function redactText(text, profiles = [process.env.USERPROFILE, process.env.HOME].filter(Boolean)) {
  let clean = text.replace(/S-1-\d+(?:-\d+)+/g, '<HOST-SID>');
  for (const profile of profiles) for (const value of [profile.replaceAll('\\', '\\\\'), profile, profile.replaceAll('\\', '/')]) clean = clean.replaceAll(value, '<HOST-PROFILE>');
  return clean.replace(/((?:owned by:|current user is:)\s*(?:\\n|\r?\n)\s*)[^\r\n]*?\(<HOST-SID>\)/g, '$1<HOST-IDENTITY> (<HOST-SID>)');
}
export function sanitizeArtifactRoot({ root, backup, profiles, dryRun = false }) {
  root = validateOutputRoot(root, { projectRoot: project, label: '--root' });
  if (!fs.statSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw Error('Artifact root must be a real directory');
  const isRun = fs.existsSync(path.join(root, 'results.json')) && path.basename(path.dirname(root)) === 'runs';
  if (!isRun && !fs.existsSync(path.join(root, 'runs'))) throw Error('Expected one run directory or an artifact root containing runs');
  const artifactBase = isRun ? path.dirname(path.dirname(root)) : root;
  backup = validateOutputRoot(backup ?? path.join(project, '.workshop/private-raw-evidence', crypto.randomUUID()), { projectRoot: project, label: '--backup' });
  if (backup === root || within(root, backup) || fs.existsSync(backup)) throw Error('Raw backup must be a fresh directory outside the input tree');
  const files = (isRun ? walk(root) : ['runs', 'existing'].flatMap(n => walk(path.join(root, n))))
    .filter(p => !relative(root, p).split('/').some(n => ['source', 'reports', 'reporter'].includes(n)))
    .filter(p => /\.(?:json|jsonl|stdout|stderr|txt|md|patch)$/.test(p));
  // A filename alone is not a result protocol. Existing-suite summaries and
  // nested evidence may legitimately use result(s).json with unrelated shapes.
  const caseResults = [], runResults = [];
  function recordShape(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Authoritative ' + label + ' must be an object');
    if ('evidence' in value) {
      if (!Array.isArray(value.evidence)) throw Error('Authoritative ' + label + ' evidence must be an array');
      for (const item of value.evidence) {
        if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.path !== 'string' || !item.path) throw Error('Authoritative ' + label + ' evidence entries require a path');
        safeEvidence(artifactBase, item.path);
      }
    }
  }
  for (const p of files) {
    const rel = relative(artifactBase, p);
    if (/^runs\/[^/]+\/cases\/[^/]+\/result\.json$/.test(rel)) {
      const old = JSON.parse(fs.readFileSync(p, 'utf8'));
      recordShape(old, 'case result: ' + rel);
      caseResults.push({ p, old });
    } else if (/^runs\/[^/]+\/results\.json$/.test(rel)) {
      const old = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (!Array.isArray(old)) throw Error('Authoritative run results must be an array: ' + rel);
      old.forEach((value, index) => recordShape(value, 'run result [' + index + ']: ' + rel));
      runResults.push({ p, old });
    }
  }
  // Validate authoritative shapes before changing any text. JSONL is the
  // projection of its adjacent authoritative array, never an arbitrary homonym.
  const resultFiles = new Set([...caseResults, ...runResults].map(item => item.p));
  const projections = new Set(runResults.map(item => item.p + 'l').filter(p => fs.existsSync(p)));
  const changes = new Map(), plannedBytes = new Map();
  function write(p, clean) {
    const original = fs.readFileSync(p), bytes = Buffer.from(clean); if (original.equals(bytes)) return;
    plannedBytes.set(p, bytes);
    const rel = relative(root, p);
    if (!changes.has(rel)) {
      changes.set(rel, { path: rel, raw_sha256: fileHash(p), reason: 'Host identity redaction or evidence hashes updated; statuses/assertions preserved' });
      if (!dryRun) { const to = path.join(backup, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, original, { flag: 'wx' }); }
    }
    if (!dryRun) { fs.writeFileSync(p, clean); changes.get(rel).sanitized_sha256 = fileHash(p); }
  }
  for (const p of files.filter(p => !resultFiles.has(p) && !projections.has(p))) {
    const bytes = fs.readFileSync(p), raw = bytes.toString('utf8');
    if (!Buffer.from(raw).equals(bytes)) continue; // raw binary evidence is not text
    const clean = redactText(raw, profiles); if (clean !== raw) write(p, clean);
  }
  function update(result) {
    const clean = JSON.parse(redactText(JSON.stringify(result), profiles));
    for (const e of clean.evidence ?? []) {
      const p = safeEvidence(artifactBase, e.path), bytes = plannedBytes.get(p) ?? fs.readFileSync(p);
      e.sha256 = crypto.createHash('sha256').update(bytes).digest('hex'); e.bytes = bytes.length;
    }
    if (JSON.stringify(clean) !== JSON.stringify(result)) clean.sanitization_derivative = true;
    return clean;
  }
  for (const { p, old } of caseResults) {
    const clean = update(old);
    if (JSON.stringify(old) !== JSON.stringify(clean)) write(p, JSON.stringify(clean, null, 2) + '\n');
  }
  for (const { p, old } of runResults) {
    const clean = old.map(update);
    if (JSON.stringify(old) !== JSON.stringify(clean)) {
      write(p, JSON.stringify(clean, null, 2) + '\n');
    }
    const lines = p + 'l'; if (projections.has(lines)) write(lines, clean.map(r => JSON.stringify(r)).join('\n') + '\n');
  }
  const audit = { at: new Date().toISOString(), dry_run: dryRun, raw_backup: dryRun ? null : relative(project, backup), changed_files: changes.size, changes: [...changes.values()], authoritative_layouts: ['runs/<id>/results.json', 'runs/<id>/cases/<case>/result.json'], authoritative_files: { cases: caseResults.length, runs: runResults.length, jsonl: projections.size }, policy: 'Explicit offline derivative; only exact runner layouts receive protocol/hash updates, other homonymous files remain generic text. No historical preparation directory, no status removed, no archived source or published ZIP rewritten.' };
  if (!dryRun) { fs.mkdirSync(backup, { recursive: true }); json(path.join(backup, 'SANITIZATION.json'), audit); json(path.join(root, 'SANITIZATION.json'), audit); }
  return audit;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--dry-run' && !options.dryRun) options.dryRun = true;
      else if (['--root', '--backup'].includes(args[i]) && options[args[i].slice(2)] === undefined && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i].slice(2)] = args[++i];
      else throw Error('Usage: sanitize-history.mjs --root ARTIFACT_ROOT [--backup NEW_PRIVATE_DIRECTORY] [--dry-run]');
    }
    if (!options.root) throw Error('Explicit --root required. Run only after all evidence producers finish.');
    console.log(JSON.stringify(sanitizeArtifactRoot(options), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 2; }
}
