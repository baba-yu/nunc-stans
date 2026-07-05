// Shared test helper: rebuild the analytics DB from the golden inputs
// via the TS pipeline, mirroring capture.ts run()'s oracle recipe.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { connect, initDb } from '../../src/db/db.ts';
import { ingestDay, ingestDayLocales } from '../../src/ingest/ingest-sourcedata.ts';
import { runGlossaryExtract } from '../../src/ingest/glossary-extract.ts';
import { runScore } from '../../src/ingest/score.ts';

export const GOLDENS = join(import.meta.dirname, '..', '..', 'goldens');
export const INPUT = join(GOLDENS, 'input');
export const MANIFEST = JSON.parse(readFileSync(join(GOLDENS, 'fixture-manifest.json'), 'utf8'));
export const TODAY = new Date().toISOString().slice(0, 10);

export function normalizeVolatile(text: string): string {
  return text
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '1970-01-01T00:00:00Z')
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, '1970-01-01 00:00:00')
    .replaceAll(TODAY, '<CAPTURE_DAY>');
}

export function daysBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let t = Date.parse(startIso + 'T12:00:00Z');
  const end = Date.parse(endIso + 'T12:00:00Z');
  for (; t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export interface BuiltDb {
  db: Database.Database;
  /** Oracle-work-root-shaped temp dir (app/sourcedata + report + memory symlinks). */
  workRoot: string;
}

/** init → per day in the manifest dbRange: glossary extract +
 * ingest-sourcedata (incl. locales) → score. Caller closes db and
 * removes workRoot. */
export function buildGoldenDb(): BuiltDb {
  const workRoot = mkdtempSync(join(tmpdir(), 'nf-build-'));
  mkdirSync(join(workRoot, 'app'), { recursive: true });
  symlinkSync(join(INPUT, 'sourcedata'), join(workRoot, 'app', 'sourcedata'));
  for (const part of ['report', 'future-prediction', 'memory', 'reference'])
    symlinkSync(join(INPUT, part), join(workRoot, part));
  const ctx = {
    sourcedataRoot: join(workRoot, 'app', 'sourcedata'),
    repoRootForRel: workRoot,
    todayIso: TODAY,
  };
  const dbFile = join(workRoot, 'analytics.sqlite');
  initDb(dbFile);
  const db = connect(dbFile);
  for (const d of daysBetween(MANIFEST.dbRange.start, MANIFEST.dbRange.end)) {
    runGlossaryExtract(db, {
      newsFile: join(workRoot, 'report', 'en', `news-${d.replaceAll('-', '')}.md`),
      seedYaml: join(workRoot, 'reference', 'glossary.yml'),
      todayIso: TODAY,
    });
    const { pidByJsonId } = ingestDay(db, ctx, d);
    ingestDayLocales(db, ctx, d, pidByJsonId);
  }
  runScore(db);
  return { db, workRoot };
}
