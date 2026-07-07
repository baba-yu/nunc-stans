// TS port of app/skills/validate_glossary_terms.py — form (det),
// dedupe (det), and the semantic LLM-as-judge queue + audit-log write.
// Every verdict lands in glossary_audit; a 'fail' retires the row with
// reviewed_by_human=1 so define-glossary-terms' quiet-rule doesn't
// churn on it. Semantic verdicts map match→pass, mismatch→fail,
// uncertain→warn (the audit CHECK constraint owns the vocabulary; a
// 'warn' row keeps the term in the pending-semantic queue).
import type { Db } from '../ingest/ingest-core.ts';

const FORBIDDEN_IN_QUICK_DEF = new Set([
  'leverage', 'synergy', 'paradigm', 'ecosystem',
  'utilize', 'facilitate',
  'stochastic', 'heuristic', 'asymptotic',
]);

const GENERIC_TERM_WORDS = new Set([
  'today', 'yesterday', 'tomorrow', 'future', 'past',
  'news', 'summary', 'headlines', 'report',
  'team', 'company', 'user', 'users',
  'thing', 'stuff', 'issue', 'case',
]);

export interface GlossaryRow {
  term: string;
  aliases_json: string | null;
  quick_def: string | null;
  why_it_matters: string | null;
  canonical_link: string | null;
}

export interface Verdict {
  check_type: 'form' | 'semantic' | 'dedupe';
  verdict: 'pass' | 'warn' | 'fail';
  reason: string;
  suggested_fix?: string;
}

function wordCount(s: string): number {
  return (s.match(/\S+/g) ?? []).length;
}

function sentenceCount(s: string): number {
  if (!s) return 0;
  return s.trim().split(/(?<=[.!?])\s+/).filter(p => p).length;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formCheck(row: GlossaryRow): Verdict {
  const term = (row.term ?? '').trim();
  const qd = (row.quick_def ?? '').trim();
  const why = (row.why_it_matters ?? '').trim();
  const issues: string[] = [];

  if (!term) return { check_type: 'form', verdict: 'fail', reason: 'term is empty' };
  if (GENERIC_TERM_WORDS.has(term.toLowerCase()))
    issues.push(`term '${term}' looks like a generic English word, not a proper noun / acronym`);
  if (!qd) return { check_type: 'form', verdict: 'fail', reason: 'quick_def is empty' };

  const qdWords = wordCount(qd);
  if (qdWords > 25) issues.push(`quick_def is ${qdWords} words (cap 25)`);
  const qdSentences = sentenceCount(qd);
  if (qdSentences > 2) issues.push(`quick_def has ${qdSentences} sentences (cap 2)`);

  const qdLower = qd.toLowerCase();
  const forbiddenHits = [...FORBIDDEN_IN_QUICK_DEF]
    .filter(w => new RegExp(`\\b${escapeRe(w)}\\b`).test(qdLower));
  if (forbiddenHits.length)
    issues.push(`quick_def contains forbidden jargon: ${forbiddenHits.join(', ')}`);

  if (why) {
    const whyWords = wordCount(why);
    if (whyWords > 30) issues.push(`why_it_matters is ${whyWords} words (cap 30)`);
  }

  if (!issues.length) return { check_type: 'form', verdict: 'pass', reason: '' };
  const blocking = issues.some(i =>
    i.includes('generic English') || i.includes('forbidden jargon'));
  return { check_type: 'form', verdict: blocking ? 'fail' : 'warn', reason: issues.join('; ') };
}

function parseAliases(raw: string | null): string[] {
  try {
    const a = JSON.parse(raw ?? '[]');
    return Array.isArray(a) ? a.filter(x => x).map(x => String(x).trim()) : [];
  } catch {
    return [];
  }
}

export function dedupeCheck(db: Db, row: GlossaryRow): Verdict {
  const term = (row.term ?? '').trim();
  if (!term) return { check_type: 'dedupe', verdict: 'pass', reason: '' };
  const own = new Set([term.toLowerCase(),
    ...parseAliases(row.aliases_json).map(a => a.toLowerCase())]);
  const others = db.prepare(
    `SELECT term, aliases_json FROM glossary_terms
      WHERE status = 'active' AND term <> ?`,
  ).all(term) as Array<{ term: string; aliases_json: string | null }>;
  for (const other of others) {
    const otherSet = new Set([other.term.toLowerCase(),
      ...parseAliases(other.aliases_json).map(a => a.toLowerCase())]);
    if (otherSet.has(term.toLowerCase())) {
      return {
        check_type: 'dedupe', verdict: 'fail',
        reason: `term '${term}' is already an alias of active term '${other.term}'`,
        suggested_fix: `retire and add to '${other.term}' aliases_json`,
      };
    }
    const overlaps = [...own].some(x => otherSet.has(x));
    if (overlaps && other.term.length > term.length
      && other.term.toLowerCase().includes(term.toLowerCase())) {
      return {
        check_type: 'dedupe', verdict: 'warn',
        reason: `term '${term}' overlaps with longer active term '${other.term}'`,
        suggested_fix: `consider merging into '${other.term}'`,
      };
    }
  }
  return { check_type: 'dedupe', verdict: 'pass', reason: '' };
}

export function listPendingSemantic(db: Db, limit = 25): GlossaryRow[] {
  return db.prepare(
    `SELECT t.term, t.aliases_json, t.quick_def, t.why_it_matters,
            t.canonical_link
       FROM glossary_terms t
      WHERE t.status = 'active'
        AND t.quick_def IS NOT NULL
        AND t.reviewed_by_human = 0
        AND NOT EXISTS (
          SELECT 1 FROM glossary_audit a
           WHERE a.term = t.term
             AND a.check_type = 'semantic'
             AND a.verdict IN ('pass', 'fail')
        )
      ORDER BY t.term
      LIMIT ?`,
  ).all(limit) as GlossaryRow[];
}

export function commitValidation(db: Db, args: {
  term: string; verdicts: Verdict[]; today: string;
}): void {
  const ins = db.prepare(
    `INSERT INTO glossary_audit (term, check_type, verdict, reason, suggested_fix, checked_at)
     VALUES (?, ?, ?, ?, ?, ?)`);
  let hasFail = false;
  for (const v of args.verdicts) {
    ins.run(args.term, v.check_type, v.verdict, v.reason ?? null,
      v.suggested_fix ?? null, args.today);
    if (v.verdict === 'fail') hasFail = true;
  }
  if (hasFail) {
    db.prepare(
      `UPDATE glossary_terms
          SET status = 'retired', reviewed_by_human = 1, updated_at = ?
        WHERE term = ?`,
    ).run(args.today, args.term);
  }
}

/** 30-day retention for glossary_audit (post-C decision P7).
 *
 * Semantic pass/fail rows are deliberately EXEMPT: listPendingSemantic's
 * anti-join exists to avoid re-judging terms with the LLM — pruning those
 * rows would re-queue every term for the judge each month. Form/dedupe
 * rows and semantic 'warn's are size hygiene and prune freely.
 *
 * Determinism: keyed on the caller's todayIso (goldens pin todayIso), so
 * never CURRENT_TIMESTAMP / julianday('now') here. The `<` compare is
 * lexicographic, which is correct for both checked_at forms in the table:
 * pipeline writes are date-only 'YYYY-MM-DD', and any legacy
 * DEFAULT-CURRENT_TIMESTAMP 'YYYY-MM-DD HH:MM:SS' rows order the same way
 * ('YYYY-MM-DD HH:MM:SS' sorts after its own 'YYYY-MM-DD' prefix, so a
 * boundary-day timestamp is kept just like a boundary-day date).
 *
 * Accepted downstream behavior shifts (recorded in P7):
 * - theme-review's glossaryRepeatWarnings COUNT becomes a rolling ~30d
 *   window instead of all-time (aligned with its "recent pain" intent);
 * - maintenance's ttlStaleGlossary may fall back to first_seen_date once
 *   a term's audit rows are all pruned. */
export function pruneGlossaryAudit(db: Db, todayIso: string): number {
  return db.prepare(
    `DELETE FROM glossary_audit
      WHERE checked_at < date(?, '-30 days')
        AND NOT (check_type = 'semantic' AND verdict IN ('pass', 'fail'))`,
  ).run(todayIso).changes;
}

export interface ValidateGlossarySummary {
  checked: number;
  /** Audit rows removed by the 30d retention pass (pruneGlossaryAudit). */
  prunedAudit: number;
  retiredByFormOrDedupe: string[];
  warned: string[];
  pendingSemantic: GlossaryRow[];
}

/** The deterministic half (form + dedupe + audit + queue listing). The
 * semantic judge is orchestrator-driven: the caller prompts the LLM
 * over pendingSemantic and commits its verdicts via commitValidation. */
export function runValidateGlossary(db: Db, args: {
  today: string; limit?: number;
}): ValidateGlossarySummary {
  // Retention runs first so today's own writes are never in scope. This
  // rides the daily glossary-validate step, which is replay/dry-run
  // skipped — the prune never executes against golden state.
  const prunedAudit = pruneGlossaryAudit(db, args.today);
  const limit = args.limit ?? 200;
  const rows = db.prepare(
    `SELECT term, aliases_json, quick_def, why_it_matters, canonical_link
       FROM glossary_terms
      WHERE status = 'active'
      ORDER BY term
      LIMIT ?`,
  ).all(limit) as GlossaryRow[];
  const retired: string[] = [];
  const warned: string[] = [];
  for (const row of rows) {
    const verdicts = [formCheck(row), dedupeCheck(db, row)];
    commitValidation(db, { term: row.term, verdicts, today: args.today });
    if (verdicts.some(v => v.verdict === 'fail')) retired.push(row.term);
    else if (verdicts.some(v => v.verdict === 'warn')) warned.push(row.term);
  }
  return {
    checked: rows.length,
    prunedAudit,
    retiredByFormOrDedupe: retired,
    warned,
    pendingSemantic: listPendingSemantic(db, limit),
  };
}
