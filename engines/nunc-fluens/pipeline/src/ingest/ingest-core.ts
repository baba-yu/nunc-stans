// TS port of the app/src/ingest.py helpers the sourcedata path uses:
// theme matching, prediction/evidence/validation upserts, the LCS
// match-or-create fallback, and locale-column fan-in. The legacy
// markdown ingest entry points are deliberately not ported (the daily
// DAG is sourcedata-driven; see the Phase C plan T4b/T4c notes).
import type Database from 'better-sqlite3';
import { canonicalizeUrl, hashId, nowIso, pyJsonDumps } from './util.ts';
import { fuzzyMatchWithSize } from './fuzzy.ts';
import { parseTimeWindow } from './timewindow.ts';
import { normalizeRelevance } from './analytics.ts';
import { NON_EN_LOCALES } from '../world-paths.ts';

export type Db = Database.Database;

export interface ThemeRow {
  theme_id: string;
  scope_id: string;
  category_id: string;
  canonical_label: string;
  short_label: string | null;
  description: string | null;
}

export interface EvidenceItem { url: string; title: string | null }

export interface ValidationRowData {
  prediction_summary: string;
  prediction_date: string;
  related_items_text: string;
  reference_links: EvidenceItem[];
  observed_relevance: number | null;
  raw_row_markdown: string;
  bridge_text: string | null;
  support_dimension: string | null;
}

// --- theme matching ----------------------------------------------------

const TOKEN_RE = /[A-Za-z0-9]+|[぀-ヿ一-鿿]+/g;

export function tokens(text: string): Set<string> {
  if (!text) return new Set();
  const out = new Set<string>();
  for (const m of text.matchAll(TOKEN_RE))
    if (m[0].length >= 2) out.add(m[0].toLowerCase());
  return out;
}

function themeKeywords(theme: ThemeRow): Set<string> {
  const out = tokens(theme.canonical_label);
  for (const t of tokens(theme.short_label ?? '')) out.add(t);
  for (const t of tokens(theme.description ?? '')) out.add(t);
  return out;
}

function idfScore(textTokens: Set<string>, themeTokens: Set<string>, df: Map<string, number>): number {
  // Sorted iteration to match the oracle's determinism fix: exact
  // rational ties between themes exist on the live corpus, so the float
  // sum order decides winners and must be identical on both sides.
  // (ASCII + BMP CJK tokens sort identically in JS and Python.)
  const shared = [...textTokens].filter(t => themeTokens.has(t)).sort();
  let sum = 0.0;
  for (const tok of shared) {
    const d = df.get(tok) ?? 0;
    if (d > 0) sum += 1.0 / d;
  }
  return sum;
}

export const SECONDARY_SCOPE_MIN_RATIO = 0.5;

export function loadThemes(db: Db): ThemeRow[] {
  return db.prepare(
    `SELECT theme_id, scope_id, category_id, canonical_label, short_label, description
     FROM themes WHERE status IN ('active', 'candidate')`).all() as ThemeRow[];
}

export function pickThemePerScope(text: string, themes: ThemeRow[]): Map<string, ThemeRow> {
  const textTokens = tokens(text);
  const themeTokens = themes.map(themeKeywords);
  const df = new Map<string, number>();
  for (const ts of themeTokens)
    for (const tok of ts) df.set(tok, (df.get(tok) ?? 0) + 1);
  const bestPerScope = new Map<string, [number, ThemeRow]>();
  themes.forEach((theme, i) => {
    const score = idfScore(textTokens, themeTokens[i], df);
    if (score <= 0) return;
    const cur = bestPerScope.get(theme.scope_id);
    if (cur === undefined || score > cur[0]) bestPerScope.set(theme.scope_id, [score, theme]);
  });
  if (bestPerScope.size === 0) return new Map();
  let primary = -Infinity;
  for (const [s] of bestPerScope.values()) if (s > primary) primary = s;
  const threshold = primary * SECONDARY_SCOPE_MIN_RATIO;
  const out = new Map<string, ThemeRow>();
  for (const [scope, [s, t]] of bestPerScope) if (s >= threshold) out.set(scope, t);
  return out;
}

// --- upserts -------------------------------------------------------------

export function upsertEvidence(db: Db, args: {
  url: string; title: string | null; firstSeen: string; sourceFileId: string | null;
}): string {
  const canonical = canonicalizeUrl(args.url);
  const existing = db.prepare(
    'SELECT evidence_id FROM evidence_items WHERE canonical_url = ?').get(canonical) as
    { evidence_id: string } | undefined;
  if (existing !== undefined) {
    db.prepare(
      `UPDATE evidence_items SET last_seen_date = ?, title = COALESCE(?, title), updated_at = ?
       WHERE evidence_id = ?`)
      .run(args.firstSeen, args.title, nowIso(), existing.evidence_id);
    return existing.evidence_id;
  }
  const evidenceId = hashId('evidence', canonical);
  db.prepare(
    `INSERT INTO evidence_items (
       evidence_id, url, canonical_url, title, source_type, first_seen_date,
       last_seen_date, memory_status, source_file_id
     ) VALUES (?, ?, ?, ?, 'news', ?, ?, 'active_memory', ?)`)
    .run(evidenceId, args.url, canonical, args.title, args.firstSeen, args.firstSeen, args.sourceFileId);
  return evidenceId;
}

export function upsertPrediction(db: Db, args: {
  predictionSummary: string; shortLabel: string; predictionDate: string;
  sourceFileId: string; sourceRowIndex: number; rawText: string;
  title?: string | null; reasoningBecause?: string | null; reasoningGiven?: string | null;
  reasoningSoThat?: string | null; reasoningLanding?: string | null;
  plainLanguage?: string | null; summaryText?: string | null;
}): string {
  const predictionId = hashId('prediction', args.predictionDate, args.predictionSummary);
  db.prepare(
    `INSERT OR IGNORE INTO predictions (
       prediction_id, prediction_summary, prediction_short_label, title,
       reasoning_because, reasoning_given, reasoning_so_that,
       reasoning_landing, plain_language, summary,
       prediction_date, source_file_id, source_row_index, raw_text
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      predictionId, args.predictionSummary, args.shortLabel, args.title ?? null,
      args.reasoningBecause ?? null, args.reasoningGiven ?? null, args.reasoningSoThat ?? null,
      args.reasoningLanding ?? null, args.plainLanguage ?? null, args.summaryText ?? null,
      args.predictionDate, args.sourceFileId, args.sourceRowIndex, args.rawText);

  let targetStart: string | null = null, targetEnd: string | null = null;
  if (args.reasoningLanding) {
    try {
      [targetStart, targetEnd] = parseTimeWindow(args.reasoningLanding, args.predictionDate);
    } catch { /* mirror the oracle's bare except: leave NULL */ }
  }

  db.prepare(
    `UPDATE predictions SET
       prediction_summary = ?, prediction_short_label = ?,
       title = COALESCE(?, title),
       reasoning_because = COALESCE(?, reasoning_because),
       reasoning_given = COALESCE(?, reasoning_given),
       reasoning_so_that = COALESCE(?, reasoning_so_that),
       reasoning_landing = COALESCE(?, reasoning_landing),
       plain_language = COALESCE(?, plain_language),
       summary = COALESCE(?, summary),
       target_start_date = COALESCE(?, target_start_date),
       target_end_date = COALESCE(?, target_end_date),
       prediction_date = ?,
       source_file_id = COALESCE(?, source_file_id),
       source_row_index = COALESCE(?, source_row_index),
       raw_text = COALESCE(?, raw_text),
       updated_at = ?
     WHERE prediction_id = ?`)
    .run(
      args.predictionSummary, args.shortLabel, args.title ?? null,
      args.reasoningBecause ?? null, args.reasoningGiven ?? null, args.reasoningSoThat ?? null,
      args.reasoningLanding ?? null, args.plainLanguage ?? null, args.summaryText ?? null,
      targetStart, targetEnd, args.predictionDate, args.sourceFileId, args.sourceRowIndex,
      args.rawText, nowIso(), predictionId);
  return predictionId;
}

export function upsertAssignment(db: Db, args: {
  predictionId: string; scopeId: string; categoryId: string | null;
  themeId: string | null; method: string; score: number | null;
}): void {
  db.prepare(
    `INSERT INTO prediction_scope_assignments (
       prediction_id, scope_id, category_id, theme_id,
       assignment_method, assignment_score
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(prediction_id, scope_id) DO UPDATE SET
       category_id=excluded.category_id, theme_id=excluded.theme_id,
       assignment_method=excluded.assignment_method,
       assignment_score=excluded.assignment_score, updated_at=?`)
    .run(args.predictionId, args.scopeId, args.categoryId, args.themeId,
      args.method, args.score, nowIso());
}

export function upsertCandidate(db: Db, args: {
  scopeId: string; predictionId: string; label: string; shortLabel: string; description: string;
}): void {
  const candidateId = hashId('candidate', args.scopeId, args.predictionId);
  db.prepare(
    `INSERT OR IGNORE INTO theme_candidates (
       candidate_id, scope_id, suggested_theme_label, suggested_short_label,
       suggested_description, origin_prediction_id, candidate_reason, status
     ) VALUES (?, ?, ?, ?, ?, ?, 'no_keyword_match', 'pending')`)
    .run(candidateId, args.scopeId, args.label, args.shortLabel, args.description, args.predictionId);
}

export function upsertValidationRow(db: Db, args: {
  sourceFileId: string; validationDate: string; predictionId: string | null;
  row: ValidationRowData;
}): string {
  const { row } = args;
  const validationRowId = hashId(
    'validation', args.validationDate, row.prediction_date || '', row.prediction_summary);
  db.prepare(
    `INSERT OR REPLACE INTO validation_rows (
       validation_row_id, source_file_id, validation_date, prediction_id,
       prediction_summary, prediction_date, related_items_text,
       reference_links_json, observed_relevance, raw_row_markdown,
       bridge_text, support_dimension
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      validationRowId, args.sourceFileId, args.validationDate, args.predictionId,
      row.prediction_summary, row.prediction_date || null, row.related_items_text,
      pyJsonDumps(row.reference_links.map(e => ({ url: e.url, title: e.title })), false),
      row.observed_relevance, row.raw_row_markdown, row.bridge_text, row.support_dimension);
  if (row.related_items_text && row.related_items_text.includes('[REVIVED]')) {
    db.prepare(
      `UPDATE predictions SET huge_longshot_hit_at = ? WHERE prediction_id = ?
       AND (huge_longshot_hit_at IS NULL OR huge_longshot_hit_at < ?)`)
      .run(args.validationDate, args.predictionId, args.validationDate);
  }
  return validationRowId;
}

export function linkPredictionEvidence(db: Db, args: {
  predictionId: string; evidenceId: string; scopeId: string; validationDate: string;
  observedRelevance: number | null; contradiction: number; isNew: boolean;
}): void {
  const strength = normalizeRelevance(args.observedRelevance);
  db.prepare(
    `INSERT OR REPLACE INTO prediction_evidence_links (
       prediction_id, evidence_id, scope_id, support_direction,
       relatedness_score, evidence_strength, contradiction_score,
       evidence_recency_type, validation_date
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      args.predictionId, args.evidenceId, args.scopeId,
      args.contradiction > 0 && strength < 0.3 ? 'contradict' : 'support',
      strength, strength, args.contradiction,
      args.isNew ? 'new' : 'continuing', args.validationDate);
}

// --- match-or-create (LCS phase only — no fastembed in the oracle env) ---

export function matchOrCreatePrediction(db: Db, args: {
  row: ValidationRowData; themes: ThemeRow[]; sourceFileId: string;
}): string {
  const { row } = args;
  if (row.prediction_date) {
    const candidates = db.prepare(
      'SELECT prediction_id, prediction_summary FROM predictions WHERE prediction_date = ?')
      .all(row.prediction_date) as Array<{ prediction_id: string; prediction_summary: string }>;
    let best: { prediction_id: string } | null = null;
    let bestRatio = 0.0, bestLcs = 0;
    for (const r of candidates) {
      const [ratio, lcs] = fuzzyMatchWithSize(row.prediction_summary, r.prediction_summary);
      if (ratio > bestRatio || (ratio === bestRatio && lcs > bestLcs)) {
        bestRatio = ratio;
        bestLcs = lcs;
        best = r;
      }
    }
    if (best !== null && bestRatio >= 0.55) return best.prediction_id;
  }
  // Python slices by code points, JS by UTF-16 units — spread first.
  const placeholderShort = row.prediction_summary
    ? [...row.prediction_summary].slice(0, 40).join('') : 'Prediction';
  const predictionId = upsertPrediction(db, {
    predictionSummary: row.prediction_summary,
    shortLabel: placeholderShort,
    predictionDate: row.prediction_date || '',
    sourceFileId: args.sourceFileId,
    sourceRowIndex: 0,
    rawText: row.raw_row_markdown,
  });
  const matchByScope = pickThemePerScope(row.prediction_summary, args.themes);
  for (const scopeId of ['tech', 'business']) {
    const theme = matchByScope.get(scopeId);
    if (theme !== undefined)
      upsertAssignment(db, {
        predictionId, scopeId, categoryId: theme.category_id, themeId: theme.theme_id,
        method: 'centroid', score: 0.5,
      });
  }
  return predictionId;
}

// --- locale fan-in --------------------------------------------------------

export function updatePredictionLocaleCols(db: Db, args: {
  predictionId: string; locale: string; summary: string; shortLabel: string;
  summaryText?: string | null; title?: string | null;
  reasoningBecause?: string | null; reasoningGiven?: string | null;
  reasoningSoThat?: string | null; reasoningLanding?: string | null;
  plainLanguage?: string | null;
}): void {
  const { locale } = args;
  if (locale === 'en' || !(NON_EN_LOCALES as readonly string[]).includes(locale)) return;
  const sets: Array<[string, unknown]> = [
    [`prediction_summary_${locale}`, args.summary],
    [`prediction_short_label_${locale}`, args.shortLabel],
    [`summary_${locale}`, args.summaryText ?? null],
    [`title_${locale}`, args.title ?? null],
    [`reasoning_because_${locale}`, args.reasoningBecause ?? null],
    [`reasoning_given_${locale}`, args.reasoningGiven ?? null],
    [`reasoning_so_that_${locale}`, args.reasoningSoThat ?? null],
    [`reasoning_landing_${locale}`, args.reasoningLanding ?? null],
    [`plain_language_${locale}`, args.plainLanguage ?? null],
  ];
  const pieces: string[] = [];
  const sqlArgs: unknown[] = [];
  for (const [col, val] of sets) {
    if (col.startsWith('prediction_summary_') || col.startsWith('prediction_short_label_')) {
      pieces.push(`${col} = ?`);
      sqlArgs.push(val);
    } else {
      pieces.push(`${col} = COALESCE(?, ${col})`);
      sqlArgs.push(val);
    }
  }
  pieces.push('updated_at = ?');
  sqlArgs.push(nowIso());
  sqlArgs.push(args.predictionId);
  db.prepare(`UPDATE predictions SET ${pieces.join(', ')} WHERE prediction_id = ?`).run(...sqlArgs as never[]);
}
