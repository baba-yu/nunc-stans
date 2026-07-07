// 4_weekly_memory live path — dormant pool tier transitions per
// pipeline/prompts/memory-policy.md §1 and the operational algorithm the oracle
// documented in the dormant-20260705.md preamble:
//   - exits:        pool row with max_rel ≥ 4 over the validation window
//   - re-anchor:    matched < 4, not due → Last relevance/Days quiet only
//   - re-anchor+advance: matched < 4 AND next_ping ≤ today → also 14→30→60
//   - advance:      unmatched AND due → interval step, Days quiet += 7
//   - untouched:    unmatched, not due → Days quiet += 7
//   - force-dormant: aged-out origin slice (today-13 .. today-7) not in
//     the pool with max_rel < 4 → enter at 14d
// Deviations from the oracle's conversational flow (recorded in the
// phase plan): validation matching goes through the hashed prediction
// ids in the committed predictions.json (origin date + 1-based index),
// falling back to prediction_date + summary LCS matching only for rows
// with a NULL prediction_id; the snapshot preamble is a deterministic
// summary rather than LLM prose (§1.4 mandates only header + tier table).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../ingest/ingest-core.ts';
import { fuzzyMatchWithSize } from '../ingest/fuzzy.ts';
import { MEMORY_DIR } from '../world-paths.ts';

export interface DormantRow {
  id: string;
  short: string;
  signals: string;
  firstSeen: string;
  lastRelevance: string;
  nextPing: string;
  daysQuiet: number;
}

export type Interval = 14 | 30 | 60;

// --- date helpers -----------------------------------------------------------

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000)
    .toISOString().slice(0, 10);
}

export function daysDiff(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(toIso + 'T12:00:00Z') - Date.parse(fromIso + 'T12:00:00Z')) / 86400000);
}

/** `3 (7/05)` — month unpadded, day two-digit (the corpus' current
 * convention; legacy rows carry whatever string they froze with). */
export function relStamp(rel: number, dateIso: string): string {
  const [, m, d] = dateIso.split('-');
  return `${rel} (${Number(m)}/${d})`;
}

/** The interval is not a snapshot column; it is recoverable from the
 * next-ping weekday because pings are only ever set on the Sunday run:
 * Sunday+14 ≡ Sunday, +30 ≡ Tuesday, +60 ≡ Thursday (mod 7). Rows
 * whose ping predates the weekly cadence decode to 14 (conservative:
 * they advance to 30 when due). */
export function intervalOf(nextPing: string): Interval {
  const dow = new Date(nextPing + 'T12:00:00Z').getUTCDay();
  if (dow === 2) return 30;
  if (dow === 4) return 60;
  return 14;
}

export function advanceInterval(i: Interval): Interval {
  return i === 14 ? 30 : 60;
}

// --- snapshot parse / format ------------------------------------------------

const ROW_RE = /^\|\s*(\d{8}-\d+)\s*\|/;

export function parseDormantSnapshot(text: string): DormantRow[] {
  const rows: DormantRow[] = [];
  for (const line of text.split('\n')) {
    if (!ROW_RE.test(line)) continue;
    const cells = line.split('|').map(c => c.trim());
    // cells[0] and cells[8] are the empty edges of `| a | ... | g |`.
    if (cells.length < 9) continue;
    rows.push({
      id: cells[1], short: cells[2], signals: cells[3], firstSeen: cells[4],
      lastRelevance: cells[5], nextPing: cells[6],
      daysQuiet: Number.parseInt(cells[7], 10),
    });
  }
  return rows;
}

function idKey(id: string): [string, number] {
  const [date, idx] = id.split('-');
  return [date, Number.parseInt(idx, 10)];
}

export function sortRows(rows: DormantRow[]): DormantRow[] {
  return [...rows].sort((a, b) => {
    const [da, ia] = idKey(a.id);
    const [db2, ib] = idKey(b.id);
    return da !== db2 ? (da < db2 ? -1 : 1) : ia - ib;
  });
}

function mdCell(s: string): string {
  return s.replaceAll('|', '\\|');
}

export function formatDormantSnapshot(args: {
  today: string;
  preamble: string[];
  rows: DormantRow[];
}): string {
  const lines = [
    `# Dormant pool — week ending ${args.today}`,
    '',
    ...args.preamble,
    '',
    '## Tier: Dormant — interval ≥ 14 days',
    '',
    '| ID | Prediction (short) | Signals | First seen | Last relevance | Next ping | Days quiet |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const r of sortRows(args.rows)) {
    lines.push(`| ${r.id} | ${mdCell(r.short)} | ${mdCell(r.signals)} | `
      + `${r.firstSeen} | ${r.lastRelevance} | ${r.nextPing} | ${r.daysQuiet} |`);
  }
  return lines.join('\n') + '\n';
}

export function dormantDir(newsRepo: string): string {
  return join(newsRepo, MEMORY_DIR, 'dormant');
}

/** Latest dormant-YYYYMMDD.md strictly before `today` (steady-state:
 * a previous snapshot must exist; bootstrap ended 2026-04-26). */
export function latestDormantSnapshot(
  newsRepo: string, today: string,
): { path: string; date: string } | null {
  const dir = dormantDir(newsRepo);
  if (!existsSync(dir)) return null;
  const stem = today.replaceAll('-', '');
  const dates = readdirSync(dir)
    .map(f => /^dormant-(\d{8})\.md$/.exec(f)?.[1])
    .filter((d): d is string => d !== undefined && d < stem)
    .sort();
  if (!dates.length) return null;
  const d = dates[dates.length - 1];
  return {
    path: join(dir, `dormant-${d}.md`),
    date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`,
  };
}

// --- validation-hit collection ----------------------------------------------

export interface HitSummary {
  maxRel: number;
  latestDate: string;
  latestRel: number;
}

interface ValidationRow {
  validation_date: string;
  prediction_id: string | null;
  prediction_date: string | null;
  prediction_summary: string;
  observed_relevance: number;
}

function summarize(hits: ValidationRow[]): HitSummary | undefined {
  if (!hits.length) return undefined;
  let maxRel = 0;
  let latest = hits[0];
  for (const h of hits) {
    if (h.observed_relevance > maxRel) maxRel = h.observed_relevance;
    if (h.validation_date >= latest.validation_date) latest = h;
  }
  return { maxRel, latestDate: latest.validation_date, latestRel: latest.observed_relevance };
}

/** Ordered hashed prediction ids (+ titles/bodies) for one origin day,
 * from the committed sourcedata. Index is 1-based in dormant ids. */
export function originPredictions(
  sourcedataRoot: string, originIso: string,
): Array<{ hash: string; title: string; body: string }> {
  const p = join(sourcedataRoot, originIso, 'predictions.json');
  if (!existsSync(p)) return [];
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  const preds = Array.isArray(doc?.predictions) ? doc.predictions : [];
  return preds.map((x: any) => ({
    hash: String(x?.id ?? ''), title: String(x?.title ?? ''), body: String(x?.body ?? ''),
  }));
}

export function originIsoOf(dormantId: string): string {
  const d = dormantId.split('-')[0];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

const FUZZY_THRESHOLD = 0.5;

/** Hits for one dormant id over the window: prediction_id equality via
 * the origin predictions.json when resolvable, else prediction_date +
 * summary LCS fallback (the oracle's documented matching). */
export function hitsFor(args: {
  windowRows: ValidationRow[];
  sourcedataRoot: string;
  dormantId: string;
  shortText: string;
}): HitSummary | undefined {
  const origin = originIsoOf(args.dormantId);
  const index = Number.parseInt(args.dormantId.split('-')[1], 10);
  const preds = originPredictions(args.sourcedataRoot, origin);
  const hash = preds[index - 1]?.hash;
  const matched = args.windowRows.filter(r => {
    if (hash && r.prediction_id) return r.prediction_id === hash;
    if (r.prediction_date !== origin) return false;
    const [ratio] = fuzzyMatchWithSize(r.prediction_summary, args.shortText);
    return ratio >= FUZZY_THRESHOLD;
  });
  return summarize(matched);
}

export function windowValidationRows(
  db: Db, startIso: string, endIso: string,
): ValidationRow[] {
  return db.prepare(
    `SELECT validation_date, prediction_id, prediction_date,
            prediction_summary, observed_relevance
       FROM validation_rows
      WHERE validation_date >= ? AND validation_date <= ?
        AND observed_relevance IS NOT NULL`,
  ).all(startIso, endIso) as ValidationRow[];
}

/** Most recent re-cited wording for a prediction hash — the "short"
 * text a new entrant enters the pool with (§1.4: the wording it was
 * first cited with in future-prediction-*.md). */
export function latestSummaryFor(db: Db, hash: string): string | null {
  const r = db.prepare(
    `SELECT prediction_summary FROM validation_rows
      WHERE prediction_id = ? AND prediction_summary <> ''
      ORDER BY validation_date DESC LIMIT 1`,
  ).get(hash) as { prediction_summary: string } | undefined;
  return r?.prediction_summary ?? null;
}

// --- transitions ------------------------------------------------------------

export interface AgedOutCandidate {
  id: string;
  short: string;
  hits: HitSummary | undefined;
}

export interface TransitionResult {
  rows: DormantRow[];
  exits: string[];
  reAnchored: string[];
  advanced: string[];
  entrants: string[];
  hotSkipped: string[];
}

export function computeTransitions(args: {
  today: string;
  prevRows: DormantRow[];
  poolHits: Map<string, HitSummary | undefined>;
  agedOut: AgedOutCandidate[];
}): TransitionResult {
  const { today } = args;
  const rows: DormantRow[] = [];
  const exits: string[] = [];
  const reAnchored: string[] = [];
  const advanced: string[] = [];
  const entrants: string[] = [];
  const hotSkipped: string[] = [];

  for (const prev of args.prevRows) {
    const hits = args.poolHits.get(prev.id);
    if (hits && hits.maxRel >= 4) {
      exits.push(prev.id);
      continue;
    }
    const due = prev.nextPing <= today;
    const row = { ...prev };
    if (hits) {
      row.lastRelevance = relStamp(hits.latestRel, hits.latestDate);
      row.daysQuiet = daysDiff(hits.latestDate, today);
      reAnchored.push(prev.id);
    } else {
      row.daysQuiet = prev.daysQuiet + 7;
    }
    if (due) {
      row.nextPing = addDays(today, advanceInterval(intervalOf(prev.nextPing)));
      advanced.push(prev.id);
    }
    rows.push(row);
  }

  const inPool = new Set(args.prevRows.map(r => r.id));
  for (const cand of args.agedOut) {
    if (inPool.has(cand.id)) continue;
    if (cand.hits && cand.hits.maxRel >= 4) {
      hotSkipped.push(cand.id);
      continue;
    }
    entrants.push(cand.id);
    rows.push({
      id: cand.id,
      short: cand.short,
      signals: '', // frozen at entry — filled by the signal-extraction LLM step
      firstSeen: originIsoOf(cand.id),
      lastRelevance: cand.hits
        ? relStamp(cand.hits.latestRel, cand.hits.latestDate) : 'n/a',
      nextPing: addDays(today, 14),
      daysQuiet: cand.hits
        ? daysDiff(cand.hits.latestDate, today)
        : daysDiff(originIsoOf(cand.id), today),
    });
  }

  return { rows: sortRows(rows), exits, reAnchored, advanced, entrants, hotSkipped };
}
