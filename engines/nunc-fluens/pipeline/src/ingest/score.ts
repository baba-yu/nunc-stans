// TS port of app/src/score.py — daily activity rows for themes and
// categories plus prediction realization snapshots across 7d/30d/90d.
import type { Db } from './ingest-core.ts';
import { hashId, nowIso } from './util.ts';
import {
  attentionScore, continuingSignalFromSum, grassLevel, newSignalFromSum,
  normalizeRelevance, predictionStatus, realizationScore, themeStatus,
  WINDOWS, addDaysIso, windowRange,
} from './analytics.ts';

function latestReportDate(db: Db): string | null {
  const row = db.prepare(
    "SELECT MAX(report_date) AS d FROM source_files WHERE file_type = 'daily_report'")
    .get() as { d: string | null } | undefined;
  return row?.d ?? null;
}

interface Metrics {
  new_signal: number; continuing_signal: number; contradiction_signal: number;
  attention_score: number; realization_score: number; grass_level: number;
  new_evidence_count: number; active_prior_evidence_count: number;
  prediction_count: number; status: string; streak_days: number;
}

function themeWindowMetrics(db: Db, args: {
  scopeId: string; themeId: string; windowStart: string; windowEnd: string;
}): Metrics {
  const rows = db.prepare(
    `SELECT pel.relatedness_score, pel.evidence_strength,
            pel.contradiction_score, pel.evidence_recency_type
       FROM prediction_evidence_links pel
       JOIN prediction_scope_assignments psa
         ON pel.prediction_id = psa.prediction_id AND pel.scope_id = psa.scope_id
      WHERE psa.scope_id = ? AND psa.theme_id = ?
        AND pel.validation_date BETWEEN ? AND ?`)
    .all(args.scopeId, args.themeId, args.windowStart, args.windowEnd) as
    Array<{ evidence_strength: number | null; evidence_recency_type: string }>;

  const newRelevance: number[] = [];
  const contRelevance: number[] = [];
  for (const r of rows) {
    const strength = r.evidence_strength ?? 0.0;
    if (r.evidence_recency_type === 'new') newRelevance.push(strength);
    else contRelevance.push(strength);
  }

  const predictionCount = (db.prepare(
    `SELECT COUNT(*) AS cnt FROM prediction_scope_assignments
      WHERE scope_id = ? AND theme_id = ?`)
    .get(args.scopeId, args.themeId) as { cnt: number }).cnt || 0;

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const newSignal = newSignalFromSum(sum(newRelevance));
  const continuingSignal = continuingSignalFromSum(sum(contRelevance));
  const atten = attentionScore(newSignal, continuingSignal);
  const meanNew = newRelevance.length ? sum(newRelevance) / newRelevance.length : 0.0;
  const meanCont = contRelevance.length ? sum(contRelevance) / contRelevance.length : 0.0;
  const realization = realizationScore(meanNew, meanCont);

  // Streak: consecutive dates with any evidence, ending at windowEnd.
  const dateRows = db.prepare(
    `SELECT DISTINCT pel.validation_date
       FROM prediction_evidence_links pel
       JOIN prediction_scope_assignments psa
         ON pel.prediction_id = psa.prediction_id AND pel.scope_id = psa.scope_id
      WHERE psa.scope_id = ? AND psa.theme_id = ?`)
    .all(args.scopeId, args.themeId) as Array<{ validation_date: string | null }>;
  const dates = new Set(dateRows.map(r => r.validation_date).filter(Boolean) as string[]);
  let streak = 0;
  let cursor = args.windowEnd;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }

  return {
    new_signal: newSignal,
    continuing_signal: continuingSignal,
    contradiction_signal: 0.0,
    attention_score: atten,
    realization_score: realization,
    grass_level: grassLevel(atten),
    status: themeStatus(atten, realization),
    new_evidence_count: newRelevance.length,
    active_prior_evidence_count: contRelevance.length,
    prediction_count: predictionCount,
    streak_days: streak,
  };
}

function upsertTopicActivity(db: Db, args: {
  activityDate: string; windowId: string; scopeId: string;
  categoryId: string | null; themeId: string; metrics: Metrics;
}): void {
  const activityId = hashId(
    'activity', args.scopeId, args.themeId, '', args.windowId, args.activityDate, 'theme');
  const m = args.metrics;
  db.prepare(
    `INSERT OR REPLACE INTO topic_daily_activity (
       activity_id, activity_date, window_id, scope_id,
       category_id, theme_id, subtheme_id, activity_level,
       new_signal, continuing_signal, contradiction_signal,
       attention_score, realization_score, grass_level,
       new_evidence_count, active_prior_evidence_count, prediction_count,
       status, streak_days, last_active_date, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      activityId, args.activityDate, args.windowId, args.scopeId,
      args.categoryId, args.themeId, null, 'theme',
      m.new_signal, m.continuing_signal, m.contradiction_signal,
      m.attention_score, m.realization_score, m.grass_level,
      m.new_evidence_count, m.active_prior_evidence_count, m.prediction_count,
      m.status, m.streak_days, args.activityDate, nowIso());
}

function scoreThemes(db: Db, scopeId: string, latest: string): number {
  const themes = db.prepare(
    `SELECT theme_id, category_id, first_seen_date FROM themes
      WHERE scope_id = ? AND status IN ('active', 'candidate')`)
    .all(scopeId) as Array<{ theme_id: string; category_id: string | null }>;
  let inserted = 0;
  for (const theme of themes) {
    for (const [windowId, days] of WINDOWS) {
      const [start, end] = windowRange(latest, days);
      const metrics = themeWindowMetrics(db, {
        scopeId, themeId: theme.theme_id, windowStart: start, windowEnd: end,
      });
      upsertTopicActivity(db, {
        activityDate: latest, windowId, scopeId,
        categoryId: theme.category_id, themeId: theme.theme_id, metrics,
      });
      inserted += 1;
    }
  }
  return inserted;
}

function scoreCategories(db: Db, scopeId: string, latest: string): number {
  const categories = (db.prepare(
    'SELECT category_id FROM categories WHERE scope_id = ? AND active = 1')
    .all(scopeId) as Array<{ category_id: string }>).map(r => r.category_id);
  let inserted = 0;
  const priority = ['new', 'active', 'continuing', 'dormant'];
  for (const categoryId of categories) {
    for (const [windowId] of WINDOWS) {
      const rows = db.prepare(
        `SELECT attention_score, realization_score, contradiction_signal,
                grass_level, status, prediction_count
           FROM topic_daily_activity
          WHERE scope_id = ? AND category_id = ? AND window_id = ?
            AND activity_level = 'theme' AND activity_date = ?`)
        .all(scopeId, categoryId, windowId, latest) as Array<{
          attention_score: number | null; realization_score: number | null;
          status: string; prediction_count: number | null;
        }>;
      let metrics: Record<string, unknown>;
      if (rows.length === 0) {
        metrics = {
          attention_score: 0.0, realization_score: 0.0, contradiction_signal: 0.0,
          grass_level: 0, theme_count: 0, active_theme_count: 0,
          prediction_count: 0, status: 'dormant',
        };
      } else {
        const atts = rows.map(r => r.attention_score ?? 0.0);
        const rels = rows.map(r => r.realization_score ?? 0.0);
        const predTotal = rows.reduce((a, r) => a + (r.prediction_count ?? 0), 0);
        const realization = predTotal > 0
          ? rows.reduce((a, r) => a + (r.realization_score ?? 0.0) * (r.prediction_count ?? 0), 0) / predTotal
          : rels.reduce((a, b) => a + b, 0) / rels.length;
        const atten = Math.max(...atts);
        let status = 'dormant';
        for (const p of priority)
          if (rows.some(r => r.status === p)) { status = p; break; }
        metrics = {
          attention_score: atten, realization_score: realization,
          contradiction_signal: 0.0, grass_level: grassLevel(atten),
          theme_count: rows.length,
          active_theme_count: rows.filter(r => ['active', 'continuing', 'new'].includes(r.status)).length,
          prediction_count: predTotal, status,
        };
      }
      const activityId = hashId('catactivity', scopeId, categoryId, windowId, latest);
      db.prepare(
        `INSERT OR REPLACE INTO category_daily_activity (
           category_activity_id, activity_date, window_id, scope_id, category_id,
           attention_score, realization_score, contradiction_signal, grass_level,
           theme_count, active_theme_count, prediction_count, status, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          activityId, latest, windowId, scopeId, categoryId,
          metrics.attention_score, metrics.realization_score,
          metrics.contradiction_signal, metrics.grass_level,
          metrics.theme_count, metrics.active_theme_count,
          metrics.prediction_count, metrics.status, nowIso());
      inserted += 1;
    }
  }
  return inserted;
}

function snapshotPredictions(db: Db, latest: string): number {
  const rows = db.prepare(
    `SELECT p.prediction_id, psa.scope_id,
            psa.latest_observed_relevance, psa.latest_realization_score,
            psa.latest_contradiction_score
       FROM predictions p
       JOIN prediction_scope_assignments psa ON p.prediction_id = psa.prediction_id`)
    .all() as Array<{
      prediction_id: string; scope_id: string;
      latest_observed_relevance: number | null; latest_realization_score: number | null;
    }>;
  let n = 0;
  for (const row of rows) {
    const realization = row.latest_realization_score ?? 0.0;
    const newRel = normalizeRelevance(row.latest_observed_relevance);
    const status = predictionStatus(realization);
    for (const [windowId] of WINDOWS) {
      db.prepare(
        `INSERT OR REPLACE INTO prediction_realization_snapshots (
           prediction_id, scope_id, validation_date, window_id,
           new_evidence_relevance, continuing_evidence_relevance,
           observed_relevance, realization_score, contradiction_score,
           observation_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          row.prediction_id, row.scope_id, latest, windowId,
          newRel, 0.0, row.latest_observed_relevance, realization, 0.0, status);
      db.prepare(
        `UPDATE prediction_scope_assignments SET latest_observation_status = ?
          WHERE prediction_id = ? AND scope_id = ?`)
        .run(status, row.prediction_id, row.scope_id);
      n += 1;
    }
  }
  return n;
}

export function runScore(db: Db): Record<string, unknown> {
  const latest = latestReportDate(db);
  if (latest === null) return { status: 'no-data' };
  let themeRows = 0;
  for (const scopeId of ['tech', 'business']) themeRows += scoreThemes(db, scopeId, latest);
  let categoryRows = 0;
  for (const scopeId of ['tech', 'business']) categoryRows += scoreCategories(db, scopeId, latest);
  const predRows = snapshotPredictions(db, latest);
  return {
    latest, theme_activity_rows: themeRows,
    category_activity_rows: categoryRows, prediction_snapshots: predRows,
  };
}
