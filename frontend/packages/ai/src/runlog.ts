import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RunLogEntry } from './types.ts';

/** Append one JSONL entry to the run log (§2.6: every call is logged —
 * the audit substrate agent-abi needs). */
export function appendRunLog(file: string, entry: RunLogEntry): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
}
