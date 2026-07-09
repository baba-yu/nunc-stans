// TS port of app/skills/extract_glossary_candidates.py — deterministic
// glossary candidate extraction from a news markdown file + idempotent
// seed loading. (define/validate-glossary-terms are LLM-side and land
// with the orchestrator.)
import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { Db } from './ingest-core.ts';
import { pyJsonDumps } from './util.ts';

const STOPWORDS = new Set(`
  the and but for not nor with this that these those have has had
  will would shall should can could may might must do does did
  today yesterday tomorrow then now monday tuesday wednesday thursday
  friday saturday sunday january february march april may june
  july august september october november december summary headlines
  future change log news tech business mix non-tech ai api ui js
  note paalala nota important the openclaw nemoclaw hermes
`.split(/\s+/).filter(Boolean));

const TOKEN_RE = new RegExp(
  '\\b('
  + '[A-Z]{2,12}(?:&[A-Z]{1,8})?'
  + '|[A-Z][a-z]+[A-Z][A-Za-z0-9]+'
  + '|[A-Z]{2,}[\\-\\.][A-Za-z0-9\\-\\.]+'
  + '|[a-z]+\\.[a-z]+(?:\\.[a-z]+)?'
  + ')\\b', 'g');

const BLOCKLIST = new Set([
  'AI', 'API', 'URL', 'ID', 'GPU', 'CPU', 'CEO', 'CFO', 'CTO',
  'USA', 'EU', 'UK', 'US', 'EN', 'JA', 'ES', 'FIL',
]);

export function extractCandidates(newsText: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of newsText.matchAll(TOKEN_RE)) {
    const tok = m[1];
    if (BLOCKLIST.has(tok)) continue;
    if (STOPWORDS.has(tok.toLowerCase())) continue;
    if (/^\d+$/.test(tok.replaceAll('-', '').replaceAll('.', ''))) continue;
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  return counts;
}

interface SeedEntry {
  term: string;
  aliases?: string[] | null;
  quick_def?: string; quick_def_ja?: string; quick_def_es?: string; quick_def_fil?: string;
  why_it_matters?: string; why_it_matters_ja?: string;
  why_it_matters_es?: string; why_it_matters_fil?: string;
  canonical_link?: string; status?: string; reviewed_by_human?: unknown;
}

export function initGlossarySeed(db: Db, seedYaml: string, todayIso: string): { inserted: number } {
  if (!existsSync(seedYaml)) return { inserted: 0 };
  const data = parseYaml(readFileSync(seedYaml, 'utf8')) ?? {};
  let inserted = 0;
  const hasRow = db.prepare('SELECT 1 FROM glossary_terms WHERE term = ?');
  const ins = db.prepare(
    `INSERT INTO glossary_terms (
       term, aliases_json, quick_def, quick_def_ja, quick_def_es, quick_def_fil,
       why_it_matters, why_it_matters_ja, why_it_matters_es, why_it_matters_fil,
       canonical_link, status, first_seen_date,
       occurrences_30d, distinct_days_14d, reviewed_by_human
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`);
  for (const entry of (data.terms ?? []) as SeedEntry[]) {
    if (hasRow.get(entry.term) !== undefined) continue; // insert mode only
    ins.run(
      entry.term, pyJsonDumps(entry.aliases ?? []),
      entry.quick_def ?? null, entry.quick_def_ja ?? null,
      entry.quick_def_es ?? null, entry.quick_def_fil ?? null,
      entry.why_it_matters ?? null, entry.why_it_matters_ja ?? null,
      entry.why_it_matters_es ?? null, entry.why_it_matters_fil ?? null,
      entry.canonical_link ?? null, entry.status ?? 'candidate', todayIso,
      entry.reviewed_by_human ? 1 : 0);
    inserted += 1;
  }
  return { inserted };
}

function upsertOccurrence(db: Db, term: string, occurrenceDate: string, hitCount: number, source: string): void {
  db.prepare(
    `INSERT INTO glossary_occurrences (term, occurrence_date, hit_count, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (term, occurrence_date) DO UPDATE SET
       hit_count = hit_count + excluded.hit_count`)
    .run(term, occurrenceDate, hitCount, source);
}

function addCandidateIfNew(db: Db, term: string, today: string): boolean {
  if (db.prepare('SELECT 1 FROM glossary_terms WHERE term = ?').get(term) !== undefined) return false;
  db.prepare(
    `INSERT INTO glossary_terms (
       term, aliases_json, status, first_seen_date,
       occurrences_30d, distinct_days_14d, reviewed_by_human
     ) VALUES (?, '[]', 'candidate', ?, 0, 0, 0)`)
    .run(term, today);
  return true;
}

function recomputeRolling(db: Db, term: string, today: string): void {
  const r1 = db.prepare(
    `SELECT COALESCE(SUM(hit_count), 0) AS hits_30d
       FROM glossary_occurrences
      WHERE term = ? AND occurrence_date >= date(?, '-30 days')`)
    .get(term, today) as { hits_30d: number };
  const r2 = db.prepare(
    `SELECT COUNT(DISTINCT occurrence_date) AS days_14d
       FROM glossary_occurrences
      WHERE term = ? AND occurrence_date >= date(?, '-14 days')`)
    .get(term, today) as { days_14d: number };
  db.prepare(
    `UPDATE glossary_terms SET occurrences_30d = ?, distinct_days_14d = ?, last_seen_date = ?
      WHERE term = ?`)
    .run(r1.hits_30d, r2.days_14d ?? 0, today, term);
}

function dateFromNewsFilename(name: string): string | null {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(name);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function runGlossaryExtract(db: Db, args: {
  newsFile: string; seedYaml?: string | null; todayIso: string;
}): Record<string, unknown> {
  if (!existsSync(args.newsFile)) throw new Error(`news file not found: ${args.newsFile}`);
  const today = dateFromNewsFilename(args.newsFile.split(/[\\/]/).pop() ?? '') ?? args.todayIso;
  const text = readFileSync(args.newsFile, 'utf8');
  let seeded = 0;
  if (args.seedYaml) seeded = initGlossarySeed(db, args.seedYaml, args.todayIso).inserted;
  const counts = extractCandidates(text);
  let newCandidates = 0, bumped = 0;
  for (const [term, hits] of counts) {
    if (addCandidateIfNew(db, term, today)) newCandidates += 1;
    upsertOccurrence(db, term, today, hits, 'news');
    bumped += 1;
  }
  for (const term of counts.keys()) recomputeRolling(db, term, today);
  return {
    today, seeded, new_candidates: newCandidates,
    occurrences_bumped: bumped, tokens_seen: counts.size,
  };
}
