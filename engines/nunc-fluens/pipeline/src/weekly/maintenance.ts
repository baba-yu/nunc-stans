// 6_weekly_maintenance — TS port of app/skills/weekly_maintenance.py:
// Step 0 candidate selection (change-signal SQL gate + caps + spillover
// queue + health check), the Step 1 judgement-fragment merge, and the
// Step 3 applied-or-escalated validation. Recorded deviations from the
// oracle: (1) dormant short ids ({YYYYMMDD}-{index}) are resolved to
// the DB's hashed prediction ids via the committed predictions.json —
// upstream compared short ids against sha ids directly, so the 90d
// health check would have warned on every dormant prediction once the
// project aged past 90 days; (2) the spillover-queue writer no longer
// duplicates its intro paragraph on every weekly append (cosmetic
// idempotency wart in the oracle's section-preserving rewrite).
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../ingest/ingest-core.ts';
import {
  parseMaintenanceCandidatesFile, parseMaintenanceJudgement,
  parseMaintenanceJudgementsFile,
} from '../schemas/sourcedata.ts';
import type { MaintenanceJudgement } from '../schemas/sourcedata.ts';
import { writeAtomic } from '../render/render-news-md.ts';
import { addDays, originIsoOf, originPredictions } from './dormant.ts';

export const PREDICTIONS_CAP = 30;
export const GLOSSARY_CAP = 20;
export const GLOSSARY_TTL_DAYS = 14;
export const ACTIVE_WINDOW_DAYS = 90;

export const SIGNAL_MAGNITUDE: Record<string, number> = {
  new_contradict: 1.0,
  relevance_drift: 1.0,
  landed_this_week: 0.5,
  new_chain_edge: 0.5,
  new_relation: 0.5,
};

// --- dormant-id resolution ---------------------------------------------------

export function parseDormantIds(text: string): { shortIds: string[]; shaIds: string[] } {
  const shaIds = [...text.matchAll(/prediction\.[0-9a-f]{8,32}\b/g)].map(m => m[0]);
  const shortIds = [...text.matchAll(/\b(\d{8}-\d+)\b/g)].map(m => m[1]);
  return { shortIds: [...new Set(shortIds)], shaIds: [...new Set(shaIds)] };
}

/** Resolve the snapshot's short ids to hashed prediction ids via the
 * committed predictions.json (origin date + 1-based index). */
export function resolveDormantSha(sourcedataRoot: string, text: string): Set<string> {
  const { shortIds, shaIds } = parseDormantIds(text);
  const out = new Set(shaIds);
  for (const id of shortIds) {
    const idx = Number.parseInt(id.split('-')[1], 10);
    const hash = originPredictions(sourcedataRoot, originIsoOf(id))[idx - 1]?.hash;
    if (hash) out.add(hash);
  }
  return out;
}

// --- Step 0: candidate selection ---------------------------------------------

function changedPredictions(db: Db, today: string): Map<string, string[]> {
  const signals = new Map<string, string[]>();
  const push = (pid: string | null, sig: string) => {
    if (!pid) return;
    const arr = signals.get(pid) ?? [];
    arr.push(sig);
    signals.set(pid, arr);
  };
  const sevenAgo = addDays(today, -7);
  const fourteenAgo = addDays(today, -14);

  for (const { prediction_id } of db.prepare(
    `SELECT DISTINCT prediction_id FROM prediction_evidence_links
      WHERE validation_date >= ? AND support_direction = 'contradict'`,
  ).all(sevenAgo) as Array<{ prediction_id: string }>)
    push(prediction_id, 'new_contradict');

  for (const { prediction_id } of db.prepare(
    `SELECT DISTINCT v1.prediction_id
       FROM validation_rows v1
      WHERE v1.validation_date >= ?
        AND v1.observed_relevance IS NOT NULL
        AND ABS(
              v1.observed_relevance - COALESCE(
                (SELECT v2.observed_relevance FROM validation_rows v2
                  WHERE v2.prediction_id = v1.prediction_id
                    AND v2.validation_date BETWEEN ? AND ?
                    AND v2.observed_relevance IS NOT NULL
                  ORDER BY v2.validation_date DESC LIMIT 1),
                v1.observed_relevance)
            ) >= 2`,
  ).all(sevenAgo, fourteenAgo, sevenAgo) as Array<{ prediction_id: string | null }>)
    push(prediction_id, 'relevance_drift');

  for (const { prediction_id } of db.prepare(
    `SELECT prediction_id FROM predictions
      WHERE huge_longshot_hit_at IS NOT NULL AND huge_longshot_hit_at >= ?`,
  ).all(sevenAgo) as Array<{ prediction_id: string }>)
    push(prediction_id, 'landed_this_week');

  for (const { pid } of db.prepare(
    `SELECT DISTINCT source_prediction_id AS pid FROM prediction_chain
      WHERE created_at >= ?
     UNION
     SELECT DISTINCT downstream_prediction_id AS pid FROM prediction_chain
      WHERE created_at >= ?`,
  ).all(sevenAgo, sevenAgo) as Array<{ pid: string | null }>)
    push(pid, 'new_chain_edge');

  for (const { pid } of db.prepare(
    `SELECT DISTINCT prediction_a AS pid FROM prediction_relations
      WHERE created_at >= ?
     UNION
     SELECT DISTINCT prediction_b AS pid FROM prediction_relations
      WHERE created_at >= ?`,
  ).all(sevenAgo, sevenAgo) as Array<{ pid: string | null }>)
    push(pid, 'new_relation');

  return signals;
}

function activePredictions(db: Db, today: string, dormantSha: Set<string>): Set<string> {
  const cutoff = addDays(today, -ACTIVE_WINDOW_DAYS);
  const rows = db.prepare(
    `SELECT prediction_id FROM predictions
      WHERE prediction_date IS NOT NULL AND prediction_date >= ?`,
  ).all(cutoff) as Array<{ prediction_id: string }>;
  return new Set(rows.map(r => r.prediction_id).filter(p => !dormantSha.has(p)));
}

function ttlStaleGlossary(db: Db, today: string): Array<[string, number]> {
  const rows = db.prepare(
    `SELECT g.term, g.first_seen_date,
            (SELECT MAX(checked_at) FROM glossary_audit a WHERE a.term = g.term)
              AS last_check
       FROM glossary_terms g
      WHERE g.status = 'active'`,
  ).all() as Array<{ term: string; first_seen_date: string | null; last_check: string | null }>;
  const out: Array<[string, number]> = [];
  const todayMs = Date.parse(today + 'T12:00:00Z');
  for (const r of rows) {
    const ref = (r.last_check ? r.last_check.slice(0, 10) : r.first_seen_date) ?? today;
    const refMs = Date.parse(ref + 'T12:00:00Z');
    if (Number.isNaN(refMs)) continue;
    const days = Math.round((todayMs - refMs) / 86400000);
    if (days >= GLOSSARY_TTL_DAYS) out.push([r.term, days]);
  }
  return out;
}

export interface CandidatesPayload {
  week_ending: string;
  predictions: Array<{
    prediction_id: string; change_signals: string[]; confidence_drift_score: number;
  }>;
  glossary_terms: Array<{ term_id: string; ttl_expired_days: number }>;
  spillover: {
    predictions: CandidatesPayload['predictions'];
    glossary_terms: CandidatesPayload['glossary_terms'];
  };
  health_warnings: string[];
}

export function computeCandidates(
  db: Db, weekEnding: string, dormantSha: Set<string>,
): CandidatesPayload {
  const active = activePredictions(db, weekEnding, dormantSha);
  const changed = changedPredictions(db, weekEnding);
  const reviewQueue = [...changed.keys()].filter(p => active.has(p)).sort();

  const predRecords = reviewQueue.map(pid => {
    const sigs = [...new Set(changed.get(pid)!)].sort();
    const magnitudeSum = sigs.reduce((s, x) => s + (SIGNAL_MAGNITUDE[x] ?? 1.0), 0);
    return {
      prediction_id: pid,
      change_signals: sigs,
      confidence_drift_score: sigs.length * magnitudeSum,
    };
  });
  predRecords.sort((a, b) =>
    b.confidence_drift_score - a.confidence_drift_score
    || (a.prediction_id < b.prediction_id ? -1 : 1));

  const glossPairs = ttlStaleGlossary(db, weekEnding)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const glossRecords = glossPairs.map(([term, days]) =>
    ({ term_id: term, ttl_expired_days: days }));

  const cutoff = addDays(weekEnding, -ACTIVE_WINDOW_DAYS);
  const old = db.prepare(
    `SELECT prediction_id, prediction_date FROM predictions
      WHERE prediction_date IS NOT NULL AND prediction_date < ?
      ORDER BY prediction_date`,
  ).all(cutoff) as Array<{ prediction_id: string; prediction_date: string }>;
  const healthWarnings = old
    .filter(r => !dormantSha.has(r.prediction_id))
    .map(r => `prediction ${r.prediction_id}: prediction_date=${r.prediction_date} `
      + 'is older than 90 days but is NOT in the dormant snapshot — dormant '
      + 'detection has a leak');

  return {
    week_ending: weekEnding,
    predictions: predRecords.slice(0, PREDICTIONS_CAP),
    glossary_terms: glossRecords.slice(0, GLOSSARY_CAP),
    spillover: {
      predictions: predRecords.slice(PREDICTIONS_CAP),
      glossary_terms: glossRecords.slice(GLOSSARY_CAP),
    },
    health_warnings: healthWarnings,
  };
}

export function writeCandidatesFile(dateDir: string, payload: CandidatesPayload): string {
  const serial = {
    week_ending: payload.week_ending,
    predictions: payload.predictions,
    glossary_terms: payload.glossary_terms,
  };
  parseMaintenanceCandidatesFile(serial);
  const out = join(dateDir, 'maintenance-candidates.json');
  writeAtomic(out, JSON.stringify(serial, null, 2) + '\n');
  return out;
}

const QUEUE_INTRO = [
  '# Maintenance spillover queue',
  '',
  'Predictions / glossary terms trimmed by Step 0 caps. '
  + 'Entries here are force-promoted on a 4-week starvation '
  + 'guarantee. See design/scheduled/6_weekly_maintenance.md.',
  '',
];

export function mergeSpilloverIntoQueue(
  queuePath: string, spillover: CandidatesPayload['spillover'], weekEnding: string,
): void {
  const existing = existsSync(queuePath) ? readFileSync(queuePath, 'utf8') : '';
  const starved = new Map<string, number>();
  for (const line of existing.split('\n')) {
    const m = /\|\s*([\w.\-]+)\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|\s*(\d+)\s*\|/.exec(line);
    if (m) starved.set(m[1], Number.parseInt(m[2], 10));
  }
  const allNew = [
    ...spillover.predictions.map(p => p.prediction_id),
    ...spillover.glossary_terms.map(g => g.term_id),
  ];
  if (!allNew.length) return;
  for (const id of allNew) starved.set(id, (starved.get(id) ?? 0) + 1);

  const header = `## ${weekEnding}`;
  const lines = [...QUEUE_INTRO];
  // Preserve prior sections (from the first `## ` on) except this week's.
  const priorSections = existing.split('\n');
  const firstSection = priorSections.findIndex(l => l.trim().startsWith('## '));
  if (firstSection !== -1) {
    for (let i = firstSection; i < priorSections.length; i++) {
      if (priorSections[i].trim() === header) break;
      lines.push(priorSections[i]);
    }
  }
  lines.push(header, '', '| id | first_seen_week | weeks_starved |', '|---|---|---|');
  for (const id of [...allNew].sort())
    lines.push(`| ${id} | ${weekEnding} | ${starved.get(id)} |`);
  lines.push('');
  writeAtomic(queuePath, lines.join('\n').replace(/\s+$/, '') + '\n');
}

export function writeHealthLog(
  healthPath: string, weekEnding: string, warnings: string[],
): void {
  if (!warnings.length) return;
  const body = [
    '# Maintenance health log', '',
    `Week ending: ${weekEnding}`, '',
    'Step 0 health-check assertion (predictions older than 90 days '
    + 'AND not in dormant snapshot) returned non-zero rows. The '
    + 'dormant detection has a leak; see design/scheduled/'
    + '4_weekly_memory.md. Maintenance run continues; this is a '
    + 'separate ticket.', '',
    '## Findings', '',
    ...warnings.map(w => `- ${w}`),
    '',
  ];
  writeAtomic(healthPath, body.join('\n'));
}

// --- Step 1: merge judgement fragments ---------------------------------------

export function mergeJudgementsFiles(dateDir: string): string {
  if (!existsSync(dateDir))
    throw new Error(`date directory missing: ${dateDir}`);
  const sources = readdirSync(dateDir)
    .filter(f => f.startsWith('maintenance-judgements.') && f.endsWith('.json')
      && f !== 'maintenance-judgements.json')
    .sort();
  if (!sources.length)
    throw new Error(`no maintenance-judgements.<pid>.json files under ${dateDir}`);

  const weekEnding = dateDir.replaceAll('\\', '/').split('/').filter(Boolean).pop()!;
  const seen = new Set<string>();
  const merged: MaintenanceJudgement[] = [];
  for (const src of sources) {
    const raw = JSON.parse(readFileSync(join(dateDir, src), 'utf8'));
    let judgementsRaw: unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)
      && 'judgements' in raw && ('week_ending' in raw || 'prediction_id' in raw))
      judgementsRaw = (raw as any).judgements;
    else if (Array.isArray(raw)) judgementsRaw = raw;
    else throw new Error(`${src}: unrecognized payload shape (expected `
      + 'MaintenanceJudgementsFile, per-pred dict, or bare list)');
    if (!Array.isArray(judgementsRaw))
      throw new Error(`${src}: judgements must be a list`);
    judgementsRaw.forEach((j, i) => {
      const rec = parseMaintenanceJudgement(j, `${src}.judgements[${i}]`);
      const key = `${rec.prediction_id} ${rec.stream} ${rec.entry_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(rec);
    });
  }
  merged.sort((a, b) =>
    a.prediction_id.localeCompare(b.prediction_id)
    || a.stream.localeCompare(b.stream)
    || a.entry_id.localeCompare(b.entry_id));
  const outPath = join(dateDir, 'maintenance-judgements.json');
  writeAtomic(outPath,
    JSON.stringify({ week_ending: weekEnding, judgements: merged }, null, 2) + '\n');
  return outPath;
}

// --- Step 3: validate applied-or-escalated ------------------------------------

const STREAM_TO_FILENAME: Record<string, string> = {
  reasoning: 'predictions',
  bridge: 'bridges',
  needs: 'needs',
  readings: 'predictions',
  glossary: 'glossary',
};

function staleApplied(
  weekDir: string, stream: string, predictionId: string, entryId: string,
): boolean {
  const filename = STREAM_TO_FILENAME[stream] ?? stream;
  if (existsSync(join(weekDir, `${filename}.${predictionId}.json`))) return true;
  if (existsSync(join(weekDir, `maintenance-update.${stream}.${predictionId}.json`)))
    return true;
  const merged = join(weekDir, `${filename}.json`);
  if (existsSync(merged)) {
    const blob = readFileSync(merged, 'utf8');
    if (blob.includes(predictionId) || (entryId && blob.includes(entryId))) return true;
  }
  return false;
}

export function validateRun(args: {
  db: Db;
  sourcedataRoot: string;
  newsRepo: string;
  weekEnding: string;
}): string[] {
  const errors: string[] = [];
  const weekDir = join(args.sourcedataRoot, args.weekEnding);
  const judgementsPath = join(weekDir, 'maintenance-judgements.json');
  if (!existsSync(judgementsPath)) {
    errors.push(`missing: ${judgementsPath} (Step 1 did not write merged `
      + 'judgements; cannot validate)');
    return errors;
  }
  let bundle;
  try {
    bundle = parseMaintenanceJudgementsFile(
      JSON.parse(readFileSync(judgementsPath, 'utf8')));
  } catch (e) {
    errors.push(`${judgementsPath}: ${e instanceof Error ? e.message : e}`);
    return errors;
  }
  const brokenPath = join(
    args.newsRepo, 'memory', 'maintenance', args.weekEnding, 'broken.md');
  const brokenText = existsSync(brokenPath) ? readFileSync(brokenPath, 'utf8') : '';

  for (const j of bundle.judgements) {
    if (j.verdict === 'fresh') continue;
    if (j.verdict === 'stale') {
      if (!staleApplied(weekDir, j.stream, j.prediction_id, j.entry_id))
        errors.push(`verdict=stale but no applied JSON for `
          + `prediction=${j.prediction_id} stream=${j.stream} `
          + `entry=${j.entry_id} under ${weekDir}`);
    } else if (j.verdict === 'retire') {
      if (j.stream === 'glossary') {
        const row = args.db.prepare(
          'SELECT status FROM glossary_terms WHERE term = ?').get(j.entry_id) as
          { status: string } | undefined;
        if (!row)
          errors.push(`verdict=retire but glossary term '${j.entry_id}' not found in DB`);
        else if (row.status !== 'retired')
          errors.push(`verdict=retire but glossary term '${j.entry_id}' has `
            + `status='${row.status}' (expected 'retired')`);
      } else {
        const marker = join(weekDir, `retired.${j.stream}.${j.prediction_id}.json`);
        if (!existsSync(marker))
          errors.push(`verdict=retire but no marker ${marker} for `
            + `non-glossary stream ${j.stream}`);
      }
    } else if (j.verdict === 'broken') {
      if (!existsSync(brokenPath))
        errors.push(`verdict=broken but missing ${brokenPath}`);
      else if (!brokenText.includes(j.prediction_id))
        errors.push(`verdict=broken but ${j.prediction_id} not mentioned in ${brokenPath}`);
    }
  }
  return errors;
}

// --- judge context assembly ----------------------------------------------------

/** The candidate prediction's full 4-stream state, compact enough for
 * one judge prompt. */
export function buildJudgeContext(db: Db, pid: string): Record<string, unknown> {
  const prediction = db.prepare(
    `SELECT prediction_id, prediction_date, title, summary, plain_language,
            reasoning_because, reasoning_given, reasoning_so_that,
            reasoning_landing, status, huge_longshot_hit_at
       FROM predictions WHERE prediction_id = ?`,
  ).get(pid);
  const bridges = db.prepare(
    `SELECT validation_row_id, validation_date, observed_relevance,
            support_dimension, bridge_text
       FROM validation_rows WHERE prediction_id = ?
      ORDER BY validation_date DESC LIMIT 12`,
  ).all(pid);
  const needs = db.prepare(
    `SELECT n.need_id, n.actor, n.job, n.outcome,
            t.task_id, t.what_text, t.status
       FROM prediction_needs n
       LEFT JOIN needs_tasks t ON t.need_id = n.need_id
      WHERE n.prediction_id = ?`,
  ).all(pid);
  const chain = db.prepare(
    `SELECT source_prediction_id, downstream_prediction_id, created_at
       FROM prediction_chain
      WHERE source_prediction_id = ? OR downstream_prediction_id = ?`,
  ).all(pid, pid);
  const relations = db.prepare(
    `SELECT prediction_a, prediction_b, relation_type, created_at
       FROM prediction_relations
      WHERE prediction_a = ? OR prediction_b = ?`,
  ).all(pid, pid);
  return { prediction, bridges, needs, readings: { chain, relations } };
}
