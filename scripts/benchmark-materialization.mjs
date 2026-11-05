/** Isolated materialization experiment; not a Core transaction benchmark. */
import assert from 'node:assert/strict';
import { constants, createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomFillSync, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { copyRegular } from '../src/core/storage.ts';
import { resolveGitExecutable } from '../src/core/platform.ts';
import { isolatedEnvironment } from './git-compat/lib.mjs';

const arguments_ = process.argv.slice(2), option = (name, fallback) => { const i = arguments_.indexOf(name); return i < 0 ? fallback : arguments_[i + 1]; };
if (arguments_.includes('--help')) { console.log('node --import tsx scripts/benchmark-materialization.mjs --output <new.json> [--size-mib 100] [--samples 3] [--budget-mib 1024] [--time-budget-ms 300000]'); process.exit(0); }
const output = option('--output'), sizeMiB = Number(option('--size-mib', 100)), samples = Number(option('--samples', 3)), budgetMiB = Number(option('--budget-mib', 1024)), timeBudgetMs = Number(option('--time-budget-ms', 300000));
assert(output && path.isAbsolute(output), '--output must be an absolute new JSON path outside the fixture.');
assert(Number.isInteger(sizeMiB) && sizeMiB >= 1 && sizeMiB <= 1024); assert(Number.isInteger(samples) && samples >= 1 && samples <= 20); assert(Number.isInteger(budgetMiB) && budgetMiB >= sizeMiB * 4 + 128); assert(timeBudgetMs >= 1000);
await fs.access(output).then(() => { throw Error('Output already exists; preserve previous evidence.'); }, error => { if (error.code !== 'ENOENT') throw error; });
const size = sizeMiB * 1024 * 1024, project = path.resolve(fileURLToPath(new URL('../', import.meta.url))), root = await fs.mkdtemp(path.join(os.tmpdir(), 'gl-materialization-')), nonce = randomUUID(), marker = path.join(root, '.owned-fixture');
await fs.writeFile(marker, nonce, { flag: 'wx' });
const repo = path.join(root, 'repository'), home = path.join(root, 'home'), destinations = path.join(root, 'destinations'); await fs.mkdir(repo); await fs.mkdir(home); await fs.mkdir(destinations);
const available = await fs.statfs(root); assert(available.bavail * available.bsize > budgetMiB * 1024 * 1024, 'Insufficient free space for explicit peak budget.');
const executable = await resolveGitExecutable(); const env = isolatedEnvironment(root, executable); let gitCount = 0;
const git = (...args) => { gitCount++; return execFileSync(executable, ['-C', repo, ...args], { env, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd(); };
const fingerprint = async file => { const digest = createHash('sha256'); let bytes = 0; for await (const chunk of createReadStream(file)) { digest.update(chunk); bytes += chunk.length; } return { sha256: digest.digest('hex'), bytes }; };
const sourceFiles = ['scripts/benchmark-materialization.mjs', 'src/core/storage.ts', 'src/core/platform.ts', 'scripts/git-compat/lib.mjs']; const sourceFingerprintsBefore = []; for (const file of sourceFiles) sourceFingerprintsBefore.push({ file, ...(await fingerprint(path.join(project, file))) });
async function removeOwned(target) { assert.equal(await fs.readFile(marker, 'utf8'), nonce); const resolvedRoot = await fs.realpath(root), resolvedTarget = await fs.realpath(target), relative = path.relative(resolvedRoot, resolvedTarget); assert(relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)), 'Cleanup target must remain in the owned fixture.'); await fs.rm(resolvedTarget, { recursive: true }); }
const source = path.join(repo, 'source.bin'), sourceHandle = await fs.open(source, 'wx', 0o600), chunk = randomFillSync(Buffer.allocUnsafe(1024 * 1024));
try { for (let i = 0; i < sizeMiB; i++) await sourceHandle.writeFile(chunk); await sourceHandle.sync(); } finally { await sourceHandle.close(); }
const sourceImage = await fingerprint(source); assert.equal(sourceImage.bytes, size);
git('init', '-b', 'main'); git('config', '--local', 'core.autocrlf', 'false'); git('config', '--local', 'core.hooksPath', '/dev/null'); git('config', '--local', 'credential.helper', '');
const oid = git('hash-object', '-w', '--', 'source.bin'); git('update-index', '--add', '--cacheinfo', '100644', oid, 'source.bin');
const indexBefore = git('ls-files', '--stage', '-z');
let maxLogicalFixtureBytes = 0; const logicalFixtureBytes = async folder => { let total = 0; for (const entry of await fs.readdir(folder, { withFileTypes: true })) { const full = path.join(folder, entry.name); assert(!entry.isSymbolicLink()); total += entry.isDirectory() ? await logicalFixtureBytes(full) : (await fs.stat(full)).size; } return total; };
const results = [], errors = [], start = performance.now(); let maxRss = process.memoryUsage().rss, maxExternal = process.memoryUsage().external, logicalWrites = size, checksummedBytes = size;
const memory = setInterval(() => { const usage = process.memoryUsage(); maxRss = Math.max(maxRss, usage.rss); maxExternal = Math.max(maxExternal, usage.external); }, 10);
const hashed = async file => { const result = await fingerprint(file); checksummedBytes += result.bytes; return result.sha256; };
const durable = async file => { const handle = await fs.open(file, 'r+'); try { await handle.sync(); } finally { await handle.close(); } };
async function independence(destination) {
  assert.equal(await hashed(destination), sourceImage.sha256); assert.equal(await hashed(source), sourceImage.sha256);
  const target = await fs.open(destination, 'r+'); try { await target.write(Buffer.from([chunk[0] ^ 0xff]), 0, 1, 0); await target.sync(); } finally { await target.close(); }
  assert.equal(await hashed(source), sourceImage.sha256, 'Destination edit must not affect source.');
  const targetImage = await hashed(destination), origin = await fs.open(source, 'r+');
  try { await origin.write(Buffer.from([chunk[chunk.length - 1] ^ 0xff]), 0, 1, size - 1); await origin.sync(); } finally { await origin.close(); }
  assert.equal(await hashed(destination), targetImage, 'Source edit must not affect destination.');
  const restore = await fs.open(source, 'r+'); try { await restore.write(Buffer.from([chunk[chunk.length - 1]]), 0, 1, size - 1); await restore.sync(); } finally { await restore.close(); }
  assert.equal(await hashed(source), sourceImage.sha256); return { destinationEditPreservesSource: true, sourceEditPreservesDestination: true };
}
const methods = [
  { name: 'copyFile', durableInOperation: false, run: destination => fs.copyFile(source, destination, constants.COPYFILE_EXCL) },
  { name: 'copyFile-FICLONE_FORCE', durableInOperation: false, run: destination => fs.copyFile(source, destination, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE_FORCE) },
  { name: 'copyFile-FICLONE-fallback', durableInOperation: false, run: destination => fs.copyFile(source, destination, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE) },
  { name: 'copyRegular-safe-stream', durableInOperation: true, run: destination => copyRegular(source, destination) },
  { name: 'git-checkout-index', durableInOperation: false, git: true, run: destination => { const prefix = path.dirname(destination).replace(/\\/g, '/') + '/'; git('checkout-index', '--prefix=' + prefix, '--', 'source.bin'); } },
];
let filesystem;
if (process.platform === 'win32') {
  try { const drive = path.parse(root).root[0]; const command = "Get-Volume -DriveLetter '" + drive + "' | Select-Object DriveLetter,FileSystem,AllocationUnitSize,DriveType,Size,SizeRemaining | ConvertTo-Json -Compress"; filesystem = JSON.parse(execFileSync(path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true, env })); }
  catch (error) { filesystem = { probe: 'Get-Volume', error: { code: error.code, message: String(error.message) } }; }
} else filesystem = { statfsType: available.type, linuxExecution: process.platform === 'linux' };
let complete = false;
try {
  for (let sample = 0; sample < samples; sample++) {
    // Rotate the method order across samples to limit fixed-order warming effects.
    const ordered = [...methods.slice(sample % methods.length), ...methods.slice(0, sample % methods.length)];
    for (const method of ordered) {
      assert(performance.now() - start < timeBudgetMs, 'Explicit time budget exhausted.');
      const folder = path.join(destinations, sample + '-' + method.name); await fs.mkdir(folder); const destination = path.join(folder, method.git ? 'source.bin' : 'copy.bin');
      const before = performance.now(), commandsBefore = gitCount, ioBefore = process.resourceUsage();
      try {
        await method.run(destination); const operationMs = performance.now() - before; const flushBefore = performance.now(); if (!method.durableInOperation) await durable(destination); const flushMs = method.durableInOperation ? null : performance.now() - flushBefore;
        const ioAfter = process.resourceUsage(); logicalWrites += size;
        const row = { method: method.name, sample: sample + 1, bytes: size, operationMs, additionalFlushMs: flushMs, durableMs: operationMs + (flushMs ?? 0), durableInOperation: method.durableInOperation, gitSubprocesses: gitCount - commandsBefore, ioCounters: { fsRead: ioAfter.fsRead - ioBefore.fsRead, fsWrite: ioAfter.fsWrite - ioBefore.fsWrite, unit: 'OS counters; not byte counts' }, independence: await independence(destination), physicalCoWProven: false };
        maxLogicalFixtureBytes = Math.max(maxLogicalFixtureBytes, await logicalFixtureBytes(root)); assert(maxLogicalFixtureBytes <= budgetMiB * 1024 * 1024, 'Measured fixture bytes exceeded disk budget.'); results.push(row); console.log(JSON.stringify({ method: row.method, sample: row.sample, durableMs: row.durableMs, independent: true }));
      } catch (error) { const row = { method: method.name, sample: sample + 1, operationMs: performance.now() - before, code: error.code ?? error.name, message: String(error.message).split(root).join('<fixture>'), independenceCompleted: false }; errors.push(row); console.log(JSON.stringify(row)); if (error.code === 'ERR_ASSERTION') throw error; }
      await removeOwned(folder);
    }
  }
  assert.equal(git('ls-files', '--stage', '-z'), indexBefore, 'Materialization must preserve the source index.'); assert.equal(await hashed(source), sourceImage.sha256);
  const hardSource = path.join(root, 'hardlink-source.txt'), hardTarget = path.join(root, 'hardlink-target.txt'); await fs.writeFile(hardSource, 'original'); let hardlink;
  try { await fs.link(hardSource, hardTarget); await fs.writeFile(hardTarget, 'shared mutation'); hardlink = { created: true, sourceChangedThroughOtherName: await fs.readFile(hardSource, 'utf8') === 'shared mutation', adopted: false }; assert(hardlink.sourceChangedThroughOtherName); } catch (error) { hardlink = { created: false, code: error.code, adopted: false }; }
  const median = values => { const v = [...values].sort((a, b) => a - b), i = Math.floor(v.length / 2); return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2; };
  const summary = methods.map(method => { const rows = results.filter(row => row.method === method.name), times = rows.map(row => row.durableMs); return { method: method.name, completed: rows.length, failed: errors.filter(row => row.method === method.name).length, medianDurableMs: times.length ? median(times) : null, minimumMs: times.length ? Math.min(...times) : null, maximumMs: times.length ? Math.max(...times) : null, p95Ms: null }; });
  const sourceFingerprints = []; for (const file of sourceFiles) sourceFingerprints.push({ file, ...(await fingerprint(path.join(project, file))) }); assert.deepEqual(sourceFingerprints, sourceFingerprintsBefore, 'Experiment sources changed during execution.');
  const report = { schema: 1, kind: 'git-layer-materialization-experiment', complete: true, createdAt: new Date().toISOString(), platform: { node: process.version, uv: process.versions.uv, os: process.platform, release: os.release(), architecture: process.arch }, filesystem, conditions: { sourceMiB: sizeMiB, samples, peakDiskBudgetMiB: budgetMiB, plannedPeakLogicalMiB: sizeMiB * 4 + 128, timeBudgetMs, warmCache: 'No OS cache flush; random 1MiB block repeated to source size and Git blob created before timing; methods rotated across samples.', nativeCopyOperationExcludesFlush: true, verificationOutsideTiming: true, physicalIoBytesMeasured: false, p95: 'Not reported for three samples.', coreTransactionBenchmark: false }, source: { ...sourceImage, oid }, sourceFingerprintsBefore, sourceFingerprints, sourcesStable: true, summary, results, errors, hardlink, memory: { maxObservedRssBytes: maxRss, maxObservedExternalBytes: maxExternal, intervalMs: 10 }, resourceAccounting: { logicalWritesAtLeastBytes: logicalWrites, checksumReadBytes: checksummedBytes, peakDiskLimitIsNotCumulativeIoLimit: true, maxMeasuredLogicalFixtureBytes: maxLogicalFixtureBytes, physicalAllocatedBytesMeasured: false }, elapsedMs: performance.now() - start, limits: ['Flags/API success and independence do not prove shared physical extents or copy-on-write.', 'Raw copy/Git checkout-index omit Core ownership, backups, journals, CAS and final publication.', 'copyRegular includes source validation, hashing and fsync; native rows have separately measured destination fsync.', 'No power-loss certification; no direct native FSCTL block-clone prototype.', 'No Linux execution unless platform.os explicitly reports linux.'] };
  await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); complete = true;
} finally {
  clearInterval(memory);
  if (complete) { assert.equal(await fs.readFile(marker, 'utf8'), nonce); const canonical = await fs.realpath(root), temporary = await fs.realpath(os.tmpdir()); assert.equal(path.dirname(canonical).toLowerCase(), temporary.toLowerCase()); assert(path.basename(canonical).startsWith('gl-materialization-')); await removeOwned(canonical); }
  else console.error('Incomplete owned fixture preserved: ' + root);
}
