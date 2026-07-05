// T4b gate: rebuild the analytics DB from the golden inputs via the TS
// pipeline (init → per day: glossary extract + ingest-sourcedata →
// score) and byte-compare the normalized dump against the oracle's
// golden dump (both serialized by src/db/dump.ts — one serializer).
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect, initDb } from '../src/db/db.ts';
import { dumpSql } from '../src/db/dump.ts';
import { ingestDay, ingestDayLocales } from '../src/ingest/ingest-sourcedata.ts';
import { runGlossaryExtract } from '../src/ingest/glossary-extract.ts';
import { runScore } from '../src/ingest/score.ts';

const GOLDENS = join(import.meta.dirname, '..', 'goldens');
const INPUT = join(GOLDENS, 'input');
const M = JSON.parse(readFileSync(join(GOLDENS, 'fixture-manifest.json'), 'utf8'));

function daysBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let t = Date.parse(startIso + 'T12:00:00Z');
  const end = Date.parse(endIso + 'T12:00:00Z');
  for (; t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const TODAY = new Date().toISOString().slice(0, 10);
function normalize(text: string): string {
  return text
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '1970-01-01T00:00:00Z')
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, '1970-01-01 00:00:00')
    .replaceAll(TODAY, '<CAPTURE_DAY>');
}

describe('DB rebuild parity vs the oracle golden dump', () => {
  // The 7-day rebuild takes ~12s (LCS matching dominates).
  it('reproduces analytics.dump.sql byte-for-byte (normalized)', { timeout: 120_000 }, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'nf-t4b-'));
    try {
      // Recreate the oracle's work-root shape so source_files.path
      // strings (app/sourcedata/...) hash identically.
      mkdirSync(join(tmp, 'app'), { recursive: true });
      symlinkSync(join(INPUT, 'sourcedata'), join(tmp, 'app', 'sourcedata'));
      const ctx = {
        sourcedataRoot: join(tmp, 'app', 'sourcedata'),
        repoRootForRel: tmp,
        todayIso: TODAY,
      };
      const dbFile = join(tmp, 'analytics.sqlite');
      initDb(dbFile);
      const db = connect(dbFile);
      try {
        for (const d of daysBetween(M.dbRange.start, M.dbRange.end)) {
          runGlossaryExtract(db, {
            newsFile: join(INPUT, 'report', 'en', `news-${d.replaceAll('-', '')}.md`),
            seedYaml: join(INPUT, 'reference', 'glossary.yml'),
            todayIso: TODAY,
          });
          const { pidByJsonId } = ingestDay(db, ctx, d);
          ingestDayLocales(db, ctx, d, pidByJsonId);
        }
        const scoreResult = runScore(db);
        expect(scoreResult.latest).toBe(M.dbRange.end);
        const got = normalize(dumpSql(db));
        const golden = readFileSync(
          join(GOLDENS, 'expected', 'db', 'analytics.dump.sql'), 'utf8');
        expect(got).toBe(golden);
      } finally {
        db.close();
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
