// T4b gate: rebuild the analytics DB from the golden inputs via the TS
// pipeline and byte-compare the normalized dump against the oracle's
// golden dump (both serialized by src/db/dump.ts — one serializer).
import { describe, expect, it } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { dumpSql } from '../src/db/dump.ts';
import {
  buildGoldenDb, GOLDENS, goldenCaptureCollision, MANIFEST, normalizeVolatile,
} from './helpers/build-db.ts';

describe('DB rebuild parity vs the oracle golden dump', () => {
  // The 7-day rebuild takes ~12s (LCS matching dominates).
  it.skipIf(goldenCaptureCollision())(
    'reproduces analytics.dump.sql byte-for-byte (normalized)', { timeout: 120_000 }, () => {
    const { db, workRoot } = buildGoldenDb();
    try {
      expect(MANIFEST.dbRange.end).toBeTruthy();
      const got = normalizeVolatile(dumpSql(db));
      const golden = readFileSync(join(GOLDENS, 'expected', 'db', 'analytics.dump.sql'), 'utf8');
      expect(got).toBe(golden);
    } finally {
      db.close();
      rmSync(workRoot, { recursive: true, force: true });
    }
  });
});
