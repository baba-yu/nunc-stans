// TS port of app/skills/define_glossary_terms.py — candidate→active
// promotion, quiet-active retirement, and the pending-definition list
// the LLM fill step consumes. State-only against glossary_terms; the
// definition text itself comes from the orchestrator's LLM step and is
// persisted via commitDefinition (locale fan-out included per
// design/skills/define-glossary-terms.md §Locale contract).
import type { Db } from './ingest-core.ts';

export const PROMOTE_THRESHOLD_DAYS_14D = 3;

export interface PendingDefinition {
  term: string;
  aliases_json: string | null;
  occurrences_30d: number;
  distinct_days_14d: number;
}

export function promoteEligible(db: Db, today: string): string[] {
  const eligible = db.prepare(
    `SELECT term FROM glossary_terms
      WHERE status = 'candidate' AND distinct_days_14d >= ?`,
  ).all(PROMOTE_THRESHOLD_DAYS_14D) as Array<{ term: string }>;
  const upd = db.prepare(
    `UPDATE glossary_terms SET status = 'active', updated_at = ? WHERE term = ?`);
  for (const r of eligible) upd.run(today, r.term);
  return eligible.map(r => r.term);
}

export function retireQuiet(db: Db, today: string): string[] {
  const rows = db.prepare(
    `SELECT term FROM glossary_terms
      WHERE status = 'active'
        AND reviewed_by_human = 0
        AND occurrences_30d = 0
        AND (last_seen_date IS NULL OR last_seen_date < date(?, '-30 days'))`,
  ).all(today) as Array<{ term: string }>;
  const upd = db.prepare(
    `UPDATE glossary_terms SET status='retired', updated_at=? WHERE term=?`);
  for (const r of rows) upd.run(today, r.term);
  return rows.map(r => r.term);
}

export function pendingDefinitions(db: Db): PendingDefinition[] {
  return db.prepare(
    `SELECT term, aliases_json, occurrences_30d, distinct_days_14d
       FROM glossary_terms
      WHERE status = 'active' AND (quick_def IS NULL OR quick_def = '')`,
  ).all() as PendingDefinition[];
}

export interface DefinitionFill {
  term: string;
  quick_def: string;
  why_it_matters: string;
  quick_def_ja?: string | null;
  quick_def_es?: string | null;
  quick_def_fil?: string | null;
  why_it_matters_ja?: string | null;
  why_it_matters_es?: string | null;
  why_it_matters_fil?: string | null;
  canonical_link?: string | null;
}

export function commitDefinition(db: Db, today: string, d: DefinitionFill): void {
  db.prepare(
    `UPDATE glossary_terms
        SET quick_def = ?, why_it_matters = ?,
            quick_def_ja = COALESCE(?, quick_def_ja),
            quick_def_es = COALESCE(?, quick_def_es),
            quick_def_fil = COALESCE(?, quick_def_fil),
            why_it_matters_ja = COALESCE(?, why_it_matters_ja),
            why_it_matters_es = COALESCE(?, why_it_matters_es),
            why_it_matters_fil = COALESCE(?, why_it_matters_fil),
            canonical_link = COALESCE(?, canonical_link),
            updated_at = ?
      WHERE term = ?`,
  ).run(
    d.quick_def, d.why_it_matters,
    d.quick_def_ja ?? null, d.quick_def_es ?? null, d.quick_def_fil ?? null,
    d.why_it_matters_ja ?? null, d.why_it_matters_es ?? null,
    d.why_it_matters_fil ?? null,
    d.canonical_link ?? null, today, d.term,
  );
}

/** LLM-refused terms retire with reviewed_by_human=1 so the quiet-rule
 * never flaps them (spec: refusal is a curation decision, not silence). */
export function retireRefused(db: Db, today: string, term: string): void {
  db.prepare(
    `UPDATE glossary_terms
        SET status='retired', reviewed_by_human=1, updated_at=?
      WHERE term=?`,
  ).run(today, term);
}
