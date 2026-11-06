import fs from 'node:fs';
import path from 'node:path';
import { decodeIncrementalJournal, decodeJournalCheckpoint, encodeJournalCheckpoint } from '../../src/core/storage.js';

/** Semantic reader for durable-barrier assertions; raw byte-preservation oracles stay separate. */
export function readJournal(file: string): any {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (manifest.schema !== 2) return manifest;
  if (manifest.format === 'git-layer-journal-checkpoint-v2') return decodeJournalCheckpoint(manifest, file);
  return decodeIncrementalJournal(manifest,
    fs.readFileSync(path.join(path.dirname(file), 'events.log')),
    fs.readFileSync(path.join(path.dirname(file), 'events.tip')), file);
}

/** Forge a codec-valid owned fixture to exercise semantic recovery validation.
 * Corruption/checksum refusal has separate codec tests; error oracles stay unchanged.
 */
export function writeJournalFixture(file: string, data: any): void {
  if (data.schema === 2 && data.format === 'git-layer-journal-checkpoint-v2') {
    const semantic = { ...data, schema: 1 };
    delete semantic.format; delete semantic.checksum;
    fs.writeFileSync(file, JSON.stringify(encodeJournalCheckpoint(semantic), null, 2) + '\n');
  } else {
    if (data.schema !== 1) throw new Error('Fixture writer requires a known journal format.');
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}
