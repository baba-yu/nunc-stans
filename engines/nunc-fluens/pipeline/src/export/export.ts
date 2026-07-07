/* eslint-disable @typescript-eslint/no-explicit-any */
// TS port of app/src/export.py — the analytics DB → docs/data/*.json
// export layer (scope graphs, mix merge, glossary, manifest).
//
// Serialization note (accepted divergence, recorded in the goldens
// manifest): the oracle writes python-repr floats (`1.0`); JS writes
// `1`. JSON numbers are typeless, every consumer parses the file, so
// export parity is asserted on parsed values, not bytes.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Db } from '../ingest/ingest-core.ts';
import { hashId, nowIso, pyRound, sha1Hex } from '../ingest/util.ts';
import { WINDOWS, windowRange } from '../ingest/analytics.ts';
import { parseWeekBucket } from '../ingest/timewindow.ts';
import { boldHint, deriveShortLabel } from './short-label.ts';

const SCHEMA_VERSION = '1.0';
const LOCALES = ['en', 'ja', 'es', 'fil'] as const;
const DEFAULT_LOCALE = 'en';
const SECONDARY_THEME_THRESHOLD = 0.55;

const TOKEN_RE = /[A-Za-z0-9]+|[぀-ヿ一-鿿]+/g;

function tok(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  const out = new Set<string>();
  for (const m of s.matchAll(TOKEN_RE)) if (m[0].length >= 2) out.add(m[0].toLowerCase());
  return out;
}

function loc(en: any, ja: any, es: any, fil: any): Record<string, any> {
  return { en, ja: ja || en, es: es || en, fil: fil || en };
}

function localeField(row: any, baseField: string): Record<string, any> {
  const en = row[baseField] ?? null;
  const out: Record<string, any> = { en };
  for (const l of ['ja', 'es', 'fil']) {
    const v = row[`${baseField}_${l}`] ?? null;
    out[l] = v || en;
  }
  return out;
}

function pyTitle(s: string): string {
  return s.replace(/[A-Za-z]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Python round(x, 2) — see util.pyRound. */
export function pyRound2(x: number): number {
  return pyRound(x, 2);
}

function grassLevelFor(attn: number): number {
  if (attn <= 0.05) return 0;
  if (attn <= 0.25) return 1;
  if (attn <= 0.5) return 2;
  if (attn <= 0.75) return 3;
  return 4;
}

function blankMetricBundle(nodeType: string): Record<string, any> {
  return {
    attention_score: 0.0, realization_score: 0.0, contradiction_score: 0.0,
    grass_level: 0, streak_days: 0, new_signal: 0.0, continuing_signal: 0.0,
    status: nodeType === 'prediction' ? 'no_signal' : 'dormant',
  };
}

function metricBundleTheme(r: any): Record<string, any> {
  return {
    attention_score: r.attention_score ?? 0.0,
    realization_score: r.realization_score ?? 0.0,
    contradiction_score: r.contradiction_signal ?? 0.0,
    grass_level: r.grass_level ?? 0,
    streak_days: r.streak_days ?? 0,
    new_signal: r.new_signal ?? 0.0,
    continuing_signal: r.continuing_signal ?? 0.0,
    status: r.status ?? 'dormant',
  };
}

function metricBundleCategory(r: any): Record<string, any> {
  return {
    attention_score: r.attention_score ?? 0.0,
    realization_score: r.realization_score ?? 0.0,
    contradiction_score: r.contradiction_signal ?? 0.0,
    grass_level: r.grass_level ?? 0,
    streak_days: 0, new_signal: 0.0, continuing_signal: 0.0,
    status: r.status ?? 'dormant',
  };
}

function metricBundlePrediction(r: any): Record<string, any> {
  const realization = r.realization_score ?? 0.0;
  const contradiction = r.contradiction_score ?? 0.0;
  const newRel = r.new_evidence_relevance ?? 0.0;
  const contRel = r.continuing_evidence_relevance ?? 0.0;
  let attention = Math.max(newRel, contRel, realization);
  if (attention > 1.0) attention = 1.0;
  return {
    attention_score: attention, realization_score: realization,
    contradiction_score: contradiction, grass_level: grassLevelFor(attention),
    streak_days: 0, new_signal: newRel, continuing_signal: contRel,
    status: r.observation_status ?? 'no_signal',
  };
}

function ringLayout(count: number, radius: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < count; i++)
    out.push([
      radius * Math.cos(2 * Math.PI * i / count),
      radius * Math.sin(2 * Math.PI * i / count),
    ]);
  return out;
}

function latestReportDate(db: Db): string | null {
  const row = db.prepare(
    "SELECT MAX(report_date) AS d FROM source_files WHERE file_type='daily_report'").get() as any;
  return row?.d ?? null;
}

function earliestReportDate(db: Db): string | null {
  const row = db.prepare(
    "SELECT MIN(report_date) AS d FROM source_files WHERE file_type='daily_report'").get() as any;
  return row?.d ?? null;
}

function loadDormantSet(publishRoot: string): Set<string> {
  const dir = join(publishRoot, 'memory', 'dormant');
  if (!existsSync(dir)) return new Set();
  const snapshots = readdirSync(dir).filter(f => /^dormant-.*\.md$/.test(f)).sort();
  if (snapshots.length === 0) return new Set();
  let text: string;
  try {
    text = readFileSync(join(dir, snapshots[snapshots.length - 1]), 'utf8');
  } catch {
    return new Set();
  }
  const out = new Set<string>();
  for (const m of text.matchAll(/^\|\s*(\d{8})-(\d+)\s*\|/gm)) {
    const d = m[1];
    out.add(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}||${Number(m[2])}`);
  }
  return out;
}

function relToRepo(path: string, publishRoot: string): string {
  const rel = relative(publishRoot, path).replaceAll('\\', '/');
  return rel.startsWith('..') ? path.replaceAll('\\', '/') : rel;
}

function buildEvidenceClusterIndex(db: Db, scopeId: string):
  [Map<string, string>, Map<string, any[]>] {
  const rows = db.prepare(
    `WITH ev_theme_counts AS (
       SELECT pel.evidence_id, psa.theme_id, COUNT(*) AS cnt
       FROM prediction_evidence_links pel
       JOIN prediction_scope_assignments psa
         ON pel.prediction_id = psa.prediction_id AND pel.scope_id = psa.scope_id
       WHERE pel.scope_id = ? AND psa.theme_id IS NOT NULL
       GROUP BY pel.evidence_id, psa.theme_id
     ),
     ranked AS (
       SELECT evidence_id, theme_id, cnt,
              ROW_NUMBER() OVER (PARTITION BY evidence_id ORDER BY cnt DESC, theme_id) AS rn
       FROM ev_theme_counts
     )
     SELECT r.evidence_id, r.theme_id,
            strftime('%Y-%W', ev.first_seen_date) AS week_bucket,
            ev.first_seen_date
     FROM ranked r
     JOIN evidence_items ev ON r.evidence_id = ev.evidence_id
     WHERE r.rn = 1 AND ev.first_seen_date IS NOT NULL`).all(scopeId) as any[];
  const evidenceToCluster = new Map<string, string>();
  const clusterToEvidence = new Map<string, any[]>();
  for (const row of rows) {
    const ck = `${row.theme_id}|${row.week_bucket}`;
    evidenceToCluster.set(row.evidence_id, ck);
    if (!clusterToEvidence.has(ck)) clusterToEvidence.set(ck, []);
    clusterToEvidence.get(ck)!.push({
      evidence_id: row.evidence_id, theme_id: row.theme_id,
      week_bucket: row.week_bucket, first_seen_date: row.first_seen_date,
    });
  }
  return [evidenceToCluster, clusterToEvidence];
}

function computeClusterTrend(clusterEvidences: any[], latestDate: string | null): string {
  if (!clusterEvidences.length || !latestDate) return 'flat';
  const latest = Date.parse(latestDate + 'T12:00:00Z');
  if (!Number.isFinite(latest)) return 'flat';
  const weeksBack = new Map<number, number>();
  for (const ev of clusterEvidences) {
    const d = Date.parse(String(ev.first_seen_date ?? '') + 'T12:00:00Z');
    if (!Number.isFinite(d)) continue;
    const delta = Math.round((latest - d) / 86400000);
    if (delta < 0 || delta > 28) continue;
    const wk = Math.floor(delta / 7);
    weeksBack.set(wk, (weeksBack.get(wk) ?? 0) + 1);
  }
  const recent = (weeksBack.get(0) ?? 0) + (weeksBack.get(1) ?? 0);
  const prior = (weeksBack.get(2) ?? 0) + (weeksBack.get(3) ?? 0);
  if (recent === 0 && prior === 0) return 'flat';
  if (prior === 0) return recent >= 2 ? 'accelerating' : 'flat';
  if (recent > prior * 1.5) return 'accelerating';
  if (recent < prior * 0.7) return 'decelerating';
  return 'flat';
}

function loadLayoutMap(db: Db, scopeId: string): Map<string, any> {
  const rows = db.prepare(
    'SELECT node_id, x, y, z, radius, fixed FROM graph_node_layouts WHERE scope_id = ?')
    .all(scopeId) as any[];
  const out = new Map<string, any>();
  for (const r of rows)
    out.set(r.node_id, { x: r.x, y: r.y, z: r.z ?? 0.0, radius: r.radius, fixed: Boolean(r.fixed) });
  return out;
}

function grassDaily(
  db: Db, scopeId: string, windowsRanges: Map<string, [string, string]>,
  groupCol: 'theme_id' | 'category_id',
): Map<string, any[]> {
  const out = new Map<string, any[]>();
  for (const [wid, [start, end]] of windowsRanges) {
    const rows = db.prepare(
      `SELECT psa.${groupCol} AS g, pel.validation_date AS d,
              SUM(COALESCE(pel.evidence_strength, 0)) AS s
       FROM prediction_evidence_links pel
       JOIN prediction_scope_assignments psa
         ON pel.prediction_id = psa.prediction_id AND pel.scope_id = psa.scope_id
       WHERE psa.scope_id = ? AND psa.${groupCol} IS NOT NULL
         AND pel.validation_date BETWEEN ? AND ?
       GROUP BY psa.${groupCol}, pel.validation_date
       ORDER BY psa.${groupCol}, pel.validation_date`).all(scopeId, start, end) as any[];
    for (const r of rows) {
      const attn = Math.min(1.0, (r.s ?? 0.0) / 3.0);
      const key = `${r.g}||${wid}`;
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push({ date: r.d, grass_level: grassLevelFor(attn), attention_score: attn });
    }
  }
  return out;
}

function predictionGrassDaily(
  db: Db, scopeId: string, windowsRanges: Map<string, [string, string]>,
): Map<string, any[]> {
  const out = new Map<string, any[]>();
  for (const [wid, [start, end]] of windowsRanges) {
    const rows = db.prepare(
      `SELECT prediction_id, validation_date, MAX(evidence_strength) AS attn
       FROM prediction_evidence_links
       WHERE scope_id = ? AND validation_date BETWEEN ? AND ?
       GROUP BY prediction_id, validation_date
       ORDER BY validation_date`).all(scopeId, start, end) as any[];
    for (const r of rows) {
      const attn = r.attn ?? 0.0;
      const key = `${r.prediction_id}||${wid}`;
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push({ date: r.validation_date, grass_level: grassLevelFor(attn), attention_score: attn });
    }
  }
  return out;
}

export function buildScopeGraph(db: Db, scopeId: string, publishRoot: string): Record<string, any> {
  const latest = latestReportDate(db);
  const earliest = earliestReportDate(db) ?? latest;

  const categories = db.prepare(
    `SELECT category_id, label, short_label, description, sort_order,
            label_ja, label_es, label_fil,
            short_label_ja, short_label_es, short_label_fil,
            description_ja, description_es, description_fil
     FROM categories WHERE scope_id = ? AND active = 1 ORDER BY sort_order`).all(scopeId) as any[];

  const themes = db.prepare(
    `SELECT theme_id, category_id, canonical_label, short_label, description,
            label_ja, label_es, label_fil,
            short_label_ja, short_label_es, short_label_fil,
            description_ja, description_es, description_fil
     FROM themes WHERE scope_id = ? AND status IN ('active', 'candidate')`).all(scopeId) as any[];

  const themeTokensList = themes.map(th =>
    new Set([...tok(th.canonical_label), ...tok(th.short_label ?? ''), ...tok(th.description ?? '')]));
  const df = new Map<string, number>();
  for (const ts of themeTokensList) for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1);

  const extraThemeParents = (summary: string, primaryThemeId: string): string[] => {
    const toks = tok(summary);
    if (toks.size === 0) return [];
    const scored: Array<[number, string, string]> = [];
    themes.forEach((th, i) => {
      const shared = [...toks].filter(t => themeTokensList[i].has(t)).sort();
      let s = 0.0;
      for (const t of shared) {
        const d = df.get(t) ?? 0;
        if (d > 0) s += 1.0 / d;
      }
      if (s > 0) scored.push([s, th.theme_id, th.category_id]);
    });
    if (!scored.length) return [];
    let best = -Infinity;
    for (const [s] of scored) if (s > best) best = s;
    if (best <= 0) return [];
    const thresh = best * SECONDARY_THEME_THRESHOLD;
    return scored.filter(([s, thId]) => s >= thresh && thId !== primaryThemeId).map(([, thId]) => thId);
  };

  const subthemes = db.prepare(
    `SELECT st.subtheme_id, st.theme_id, st.canonical_label, st.short_label,
            st.description, t.category_id,
            st.label_ja, st.label_es, st.label_fil,
            st.short_label_ja, st.short_label_es, st.short_label_fil,
            st.description_ja, st.description_es, st.description_fil
     FROM subthemes st
     JOIN themes t ON st.theme_id = t.theme_id
     WHERE t.scope_id = ? AND st.status IN ('active', 'candidate')`).all(scopeId) as any[];

  const predictions = db.prepare(
    `SELECT p.prediction_id, p.prediction_summary, p.prediction_short_label,
            p.prediction_date, p.source_row_index, sf.path AS source_path,
            p.prediction_summary_ja, p.prediction_summary_es, p.prediction_summary_fil,
            p.prediction_short_label_ja, p.prediction_short_label_es, p.prediction_short_label_fil,
            p.huge_longshot_hit_at,
            p.title AS prediction_title,
            p.reasoning_because, p.reasoning_given,
            p.reasoning_so_that, p.reasoning_landing, p.plain_language,
            p.title_ja, p.title_es, p.title_fil,
            p.reasoning_because_ja, p.reasoning_because_es, p.reasoning_because_fil,
            p.reasoning_given_ja, p.reasoning_given_es, p.reasoning_given_fil,
            p.reasoning_so_that_ja, p.reasoning_so_that_es, p.reasoning_so_that_fil,
            p.reasoning_landing_ja, p.reasoning_landing_es, p.reasoning_landing_fil,
            p.plain_language_ja, p.plain_language_es, p.plain_language_fil,
            p.target_start_date, p.target_end_date,
            p.summary AS pred_summary,
            p.summary_ja AS pred_summary_ja,
            p.summary_es AS pred_summary_es,
            p.summary_fil AS pred_summary_fil,
            psa.category_id, psa.theme_id, psa.subtheme_id,
            psa.latest_realization_score, psa.latest_contradiction_score,
            psa.latest_observed_relevance, psa.latest_observation_status
     FROM predictions p
     JOIN prediction_scope_assignments psa ON p.prediction_id = psa.prediction_id
     LEFT JOIN source_files sf ON p.source_file_id = sf.source_file_id
     WHERE psa.scope_id = ? AND psa.theme_id IS NOT NULL`).all(scopeId) as any[];

  const dormantSet = loadDormantSet(publishRoot);

  const windowsRanges = new Map<string, [string, string]>();
  if (latest !== null)
    for (const [wid, days] of WINDOWS) windowsRanges.set(wid, windowRange(latest, days));

  let themeMetrics = new Map<string, any>();
  let categoryMetrics = new Map<string, any>();
  let predictionMetrics = new Map<string, any>();
  let themeGrass = new Map<string, any[]>();
  let categoryGrass = new Map<string, any[]>();
  let predictionGrass = new Map<string, any[]>();
  if (latest) {
    for (const r of db.prepare(
      `SELECT theme_id, window_id, attention_score, realization_score,
              contradiction_signal, grass_level, new_signal, continuing_signal,
              status, streak_days
       FROM topic_daily_activity
       WHERE scope_id = ? AND activity_level = 'theme' AND activity_date = ?`)
      .all(scopeId, latest) as any[])
      themeMetrics.set(`${r.theme_id}||${r.window_id}`, metricBundleTheme(r));
    for (const r of db.prepare(
      `SELECT category_id, window_id, attention_score, realization_score,
              contradiction_signal, grass_level, status
       FROM category_daily_activity WHERE scope_id = ? AND activity_date = ?`)
      .all(scopeId, latest) as any[])
      categoryMetrics.set(`${r.category_id}||${r.window_id}`, metricBundleCategory(r));
    for (const r of db.prepare(
      `SELECT prs.prediction_id, prs.window_id, prs.new_evidence_relevance,
              prs.continuing_evidence_relevance, prs.realization_score,
              prs.contradiction_score, prs.observation_status
       FROM prediction_realization_snapshots prs
       JOIN (
         SELECT prediction_id, scope_id, window_id, MAX(validation_date) AS d
         FROM prediction_realization_snapshots WHERE scope_id = ?
         GROUP BY prediction_id, scope_id, window_id
       ) latest
         ON prs.prediction_id = latest.prediction_id
        AND prs.scope_id = latest.scope_id
        AND prs.window_id = latest.window_id
        AND prs.validation_date = latest.d
       WHERE prs.scope_id = ?`).all(scopeId, scopeId) as any[])
      predictionMetrics.set(`${r.prediction_id}||${r.window_id}`, metricBundlePrediction(r));
    themeGrass = grassDaily(db, scopeId, windowsRanges, 'theme_id');
    categoryGrass = grassDaily(db, scopeId, windowsRanges, 'category_id');
    predictionGrass = predictionGrassDaily(db, scopeId, windowsRanges);
  }

  const [evidenceToCluster, clusterToEvidence] = buildEvidenceClusterIndex(db, scopeId);
  const themeLabelLookup = new Map(themes.map(th => [th.theme_id, th]));

  const clusterToPredictions = new Map<string, any[]>();
  for (const row of db.prepare(
    `SELECT pel.evidence_id, pel.prediction_id,
            p.prediction_short_label AS short_label, p.title AS title,
            p.prediction_date AS pred_date,
            p.target_start_date AS target_start, p.target_end_date AS target_end
     FROM prediction_evidence_links pel
     JOIN predictions p ON pel.prediction_id = p.prediction_id
     WHERE pel.scope_id = ?`).all(scopeId) as any[]) {
    const ck = evidenceToCluster.get(row.evidence_id);
    if (!ck) continue;
    if (!clusterToPredictions.has(ck)) clusterToPredictions.set(ck, []);
    const bucket = clusterToPredictions.get(ck)!;
    if (bucket.some(p => p.prediction_id === row.prediction_id)) continue;
    bucket.push({
      prediction_id: row.prediction_id, title: row.title, short_label: row.short_label,
      pred_date: row.pred_date, target_start_date: row.target_start, target_end_date: row.target_end,
    });
  }

  const relationsIndex = new Map<string, any[]>();
  for (const row of db.prepare(
    `SELECT pr.relation_id, pr.prediction_a, pr.prediction_b,
            pr.relation_type, pr.family_id, pr.prob_mass, pr.notes,
            pb.prediction_short_label AS b_label, pb.title AS b_title,
            pb.prediction_date AS b_pred_date,
            pb.target_start_date AS b_target_start, pb.target_end_date AS b_target_end
     FROM prediction_relations pr
     JOIN predictions pb ON pr.prediction_b = pb.prediction_id
     ORDER BY pr.prediction_a, pr.relation_type`).all() as any[]) {
    if (!relationsIndex.has(row.prediction_a)) relationsIndex.set(row.prediction_a, []);
    relationsIndex.get(row.prediction_a)!.push({
      relation_id: row.relation_id, other_prediction_id: row.prediction_b,
      other_title: row.b_title, other_short_label: row.b_label,
      relation_type: row.relation_type, family_id: row.family_id,
      prob_mass: row.prob_mass, notes: row.notes,
      other_pred_date: row.b_pred_date,
      other_target_start_date: row.b_target_start,
      other_target_end_date: row.b_target_end,
    });
  }

  const downstreamIndex = new Map<string, any[]>();
  const upstreamIndex = new Map<string, any[]>();
  for (const row of db.prepare(
    `SELECT pc.source_prediction_id, pc.downstream_prediction_id,
            pc.via_evidence_id, pc.strength, pc.notes,
            p2.prediction_short_label AS downstream_label, p2.title AS downstream_title,
            p2.prediction_date AS downstream_pred_date,
            p2.target_start_date AS downstream_target_start,
            p2.target_end_date AS downstream_target_end,
            p1.prediction_short_label AS source_label, p1.title AS source_title,
            p1.prediction_date AS source_pred_date,
            p1.target_start_date AS source_target_start,
            p1.target_end_date AS source_target_end
     FROM prediction_chain pc
     JOIN predictions p1 ON pc.source_prediction_id = p1.prediction_id
     JOIN predictions p2 ON pc.downstream_prediction_id = p2.prediction_id
     WHERE NOT EXISTS (
       SELECT 1 FROM prediction_relations pr
       WHERE pr.prediction_a = pc.source_prediction_id
         AND pr.prediction_b = pc.downstream_prediction_id
         AND pr.relation_type = 'entails')
     ORDER BY pc.strength DESC`).all() as any[]) {
    if (!downstreamIndex.has(row.source_prediction_id)) downstreamIndex.set(row.source_prediction_id, []);
    downstreamIndex.get(row.source_prediction_id)!.push({
      prediction_id: row.downstream_prediction_id, title: row.downstream_title,
      short_label: row.downstream_label, strength: row.strength, notes: row.notes,
      via_evidence_id: row.via_evidence_id, pred_date: row.downstream_pred_date,
      target_start_date: row.downstream_target_start, target_end_date: row.downstream_target_end,
    });
    if (!upstreamIndex.has(row.downstream_prediction_id)) upstreamIndex.set(row.downstream_prediction_id, []);
    upstreamIndex.get(row.downstream_prediction_id)!.push({
      prediction_id: row.source_prediction_id, title: row.source_title,
      short_label: row.source_label, strength: row.strength, notes: row.notes,
      via_evidence_id: row.via_evidence_id, pred_date: row.source_pred_date,
      target_start_date: row.source_target_start, target_end_date: row.source_target_end,
    });
  }

  const layouts = loadLayoutMap(db, scopeId);

  const nodes: any[] = [];
  const idIndex = new Map<string, any>();

  const catCoords = ringLayout(categories.length, 600.0);
  const catToCoord = new Map<string, [number, number]>();
  categories.forEach((cat, i) => catToCoord.set(cat.category_id, catCoords[i]));

  const buildMetrics = (kind: string, ident: string): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [windowId] of WINDOWS) {
      let bundle: Record<string, any>;
      if (kind === 'theme') {
        bundle = { ...(themeMetrics.get(`${ident}||${windowId}`) ?? blankMetricBundle('theme')) };
        bundle.grass_daily = [...(themeGrass.get(`${ident}||${windowId}`) ?? [])];
      } else if (kind === 'category') {
        bundle = { ...(categoryMetrics.get(`${ident}||${windowId}`) ?? blankMetricBundle('category')) };
        bundle.grass_daily = [...(categoryGrass.get(`${ident}||${windowId}`) ?? [])];
      } else if (kind === 'prediction') {
        bundle = { ...(predictionMetrics.get(`${ident}||${windowId}`) ?? blankMetricBundle('prediction')) };
        bundle.grass_daily = [...(predictionGrass.get(`${ident}||${windowId}`) ?? [])];
      } else {
        bundle = { ...blankMetricBundle(kind) };
        bundle.grass_daily = [];
      }
      out[windowId] = bundle;
    }
    return out;
  };

  categories.forEach((cat, ci) => {
    const nodeId = cat.category_id;
    const coord = catCoords[ci];
    const layout = layouts.get(nodeId)
      ?? { x: coord[0], y: coord[1], z: 0.0, radius: 28.0, fixed: false };
    const catLabels = localeField(cat, 'label');
    const catShortLabels = localeField(cat, 'short_label');
    if (!catShortLabels.en)
      for (const kk of ['en', 'ja', 'es', 'fil'])
        if (!catShortLabels[kk]) catShortLabels[kk] = catLabels[kk];
    const node = {
      id: nodeId, type: 'category', scope_id: scopeId,
      label: cat.label, short_label: cat.short_label || cat.label,
      description: cat.description,
      labels: { label: catLabels, short_label: catShortLabels, description: localeField(cat, 'description') },
      category_id: cat.category_id, theme_id: null, subtheme_id: null, prediction_id: null,
      parent_ids: [] as string[], child_ids: [] as string[],
      metrics_by_window: buildMetrics('category', nodeId),
      visibility: { min_zoom: 0.0, max_zoom: null, default_visible: true },
      layout,
      detail: {
        title: cat.label, subtitle: `Category · ${pyTitle(scopeId)}`,
        description: cat.description, scope_id: scopeId, node_type: 'category',
      },
    };
    nodes.push(node);
    idIndex.set(nodeId, node);
  });

  const themesByCat = new Map<string, any[]>();
  for (const th of themes) {
    if (!themesByCat.has(th.category_id)) themesByCat.set(th.category_id, []);
    themesByCat.get(th.category_id)!.push(th);
  }
  for (const [catId, group] of themesByCat) {
    const center = catToCoord.get(catId) ?? [0.0, 0.0];
    const ring = ringLayout(group.length, 180.0);
    group.forEach((th, gi) => {
      const nodeId = th.theme_id;
      const [dx, dy] = ring[gi];
      const layout = layouts.get(nodeId)
        ?? { x: center[0] + dx, y: center[1] + dy, z: 0.0, radius: 24.0, fixed: false };
      const labelEn = th.canonical_label;
      const shortEn = th.short_label || labelEn;
      const descEn = th.description;
      const node = {
        id: nodeId, type: 'theme', scope_id: scopeId,
        label: th.canonical_label,
        short_label: th.short_label || th.canonical_label,
        description: th.description,
        labels: {
          label: loc(labelEn, th.label_ja, th.label_es, th.label_fil),
          short_label: loc(shortEn, th.short_label_ja, th.short_label_es, th.short_label_fil),
          description: loc(descEn, th.description_ja, th.description_es, th.description_fil),
        },
        category_id: th.category_id, theme_id: th.theme_id,
        subtheme_id: null, prediction_id: null,
        parent_ids: [th.category_id], child_ids: [] as string[],
        metrics_by_window: buildMetrics('theme', nodeId),
        visibility: { min_zoom: 0.75, max_zoom: null, default_visible: false },
        layout,
        detail: {
          title: th.canonical_label, subtitle: `Theme · ${pyTitle(scopeId)}`,
          description: th.description, scope_id: scopeId, node_type: 'theme',
          parent_category_id: th.category_id,
        },
      };
      nodes.push(node);
      idIndex.set(nodeId, node);
      const parent = idIndex.get(th.category_id);
      if (parent !== undefined) parent.child_ids.push(nodeId);
    });
  }

  for (const st of subthemes) {
    const themeNode = idIndex.get(st.theme_id);
    if (themeNode === undefined) continue;
    const nodeId = st.subtheme_id;
    const layout = layouts.get(nodeId) ?? {
      x: themeNode.layout.x + 60.0, y: themeNode.layout.y + 40.0,
      z: 0.0, radius: 16.0, fixed: false,
    };
    const labelEn = st.canonical_label;
    const shortEn = st.short_label || labelEn;
    const node = {
      id: nodeId, type: 'subtheme', scope_id: scopeId,
      label: st.canonical_label, short_label: st.short_label || st.canonical_label,
      description: st.description,
      labels: {
        label: loc(labelEn, st.label_ja, st.label_es, st.label_fil),
        short_label: loc(shortEn, st.short_label_ja, st.short_label_es, st.short_label_fil),
        description: loc(st.description, st.description_ja, st.description_es, st.description_fil),
      },
      category_id: st.category_id, theme_id: st.theme_id,
      subtheme_id: st.subtheme_id, prediction_id: null,
      parent_ids: [st.theme_id], child_ids: [] as string[],
      metrics_by_window: Object.fromEntries(WINDOWS.map(([w]) => [w, blankMetricBundle('subtheme')])),
      visibility: { min_zoom: 1.25, max_zoom: null, default_visible: false },
      layout,
      detail: {
        title: st.canonical_label, subtitle: `Subtheme · ${pyTitle(scopeId)}`,
        description: st.description, scope_id: scopeId, node_type: 'subtheme',
        parent_theme_id: st.theme_id, parent_category_id: st.category_id,
      },
    };
    nodes.push(node);
    idIndex.set(nodeId, node);
    themeNode.child_ids.push(nodeId);
  }

  // Predictions
  const predByParent = new Map<string, any[]>();
  for (const pr of predictions) {
    const parentId = pr.subtheme_id || pr.theme_id;
    if (!parentId) continue;
    if (!predByParent.has(parentId)) predByParent.set(parentId, []);
    predByParent.get(parentId)!.push(pr);
  }
  for (const [parentId, group] of predByParent) {
    const parentNode = idIndex.get(parentId);
    if (parentNode === undefined) continue;
    const ring = ringLayout(group.length, 55.0);
    group.forEach((pr, gi) => {
      const nodeId = pr.prediction_id;
      const [dx, dy] = ring[gi];
      const layout = layouts.get(nodeId) ?? {
        x: parentNode.layout.x + dx, y: parentNode.layout.y + dy,
        z: 0.0, radius: 9.0, fixed: false,
      };
      const summary = pr.prediction_summary ?? '';
      const shortLabel = pr.prediction_short_label
        || deriveShortLabel(summary, boldHint(summary), 0);
      const label = shortLabel;

      const evidence = (db.prepare(
        `SELECT pel.evidence_id, pel.validation_date, pel.support_direction,
                pel.relatedness_score, pel.evidence_strength, pel.contradiction_score,
                pel.evidence_recency_type,
                ev.url, ev.title, ev.source_name, ev.source_type
         FROM prediction_evidence_links pel
         JOIN evidence_items ev ON pel.evidence_id = ev.evidence_id
         WHERE pel.prediction_id = ? AND pel.scope_id = ?
         ORDER BY pel.validation_date DESC`).all(pr.prediction_id, scopeId) as any[])
        .map(r => ({
          evidence_id: r.evidence_id, title: r.title, url: r.url,
          source_name: r.source_name, source_type: r.source_type,
          support_direction: r.support_direction, relatedness_score: r.relatedness_score,
          evidence_strength: r.evidence_strength, validation_date: r.validation_date,
          evidence_recency_type: r.evidence_recency_type,
        }));

      const validationReportsRows = db.prepare(
        `SELECT vr.validation_date AS d, sf.path AS path,
                vr.bridge_text, vr.bridge_text_ja, vr.bridge_text_es, vr.bridge_text_fil,
                vr.support_dimension,
                vr.bridge_target_start_date, vr.bridge_target_end_date
         FROM validation_rows vr
         JOIN source_files sf ON vr.source_file_id = sf.source_file_id
         WHERE vr.prediction_id = ?
         ORDER BY vr.validation_date DESC`).all(pr.prediction_id) as any[];
      const validationReports = validationReportsRows.map(r => ({ date: r.d, path: r.path }));
      const bridges = validationReportsRows.filter(r => r.bridge_text).map(r => ({
        date: r.d, text: r.bridge_text,
        text_locales: loc(r.bridge_text, r.bridge_text_ja, r.bridge_text_es, r.bridge_text_fil),
        dimension: r.support_dimension,
        target_start_date: r.bridge_target_start_date,
        target_end_date: r.bridge_target_end_date,
      }));
      const validationPath = validationReports.length ? validationReports[0].path : null;

      const poolClusterCounts = new Map<string, number>();
      for (const ev of evidence) {
        const ck = evidenceToCluster.get(ev.evidence_id);
        if (ck) poolClusterCounts.set(ck, (poolClusterCounts.get(ck) ?? 0) + 1);
      }
      const clusterSummaries: any[] = [];
      for (const [ck, countInPool] of
        [...poolClusterCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
        const bar = ck.indexOf('|');
        const themeId = ck.slice(0, bar);
        const weekBucket = ck.slice(bar + 1);
        const clusterEvs = clusterToEvidence.get(ck) ?? [];
        const clusterTotal = clusterEvs.length;
        const th = themeLabelLookup.get(themeId);
        const themeLabel = th?.canonical_label ? th.canonical_label : themeId;
        const trend = computeClusterTrend(clusterEvs, latest);
        const [weekStart, weekEnd] = parseWeekBucket(weekBucket);
        const companions = (clusterToPredictions.get(ck) ?? [])
          .filter(p => p.prediction_id !== pr.prediction_id);
        clusterSummaries.push({
          theme_id: themeId, theme_label: themeLabel, week_bucket: weekBucket,
          target_start_date: weekStart, target_end_date: weekEnd,
          size_in_pool: countInPool, cluster_total: clusterTotal,
          share: clusterTotal ? pyRound2(countInPool / clusterTotal) : 0,
          trend, companion_predictions: companions.slice(0, 10),
        });
      }

      const relationsForP = relationsIndex.get(pr.prediction_id) ?? [];
      const groupedRelations = new Map<string, any[]>();
      for (const rel of relationsForP) {
        if (!groupedRelations.has(rel.relation_type)) groupedRelations.set(rel.relation_type, []);
        groupedRelations.get(rel.relation_type)!.push(rel);
      }
      const relationNarratives: string[] = [];
      if (groupedRelations.has('negation')) {
        const negs = groupedRelations.get('negation')!;
        relationNarratives.push(
          `⚠ Negation pair: this prediction has ${negs.length} explicit counter-prediction`
          + `${negs.length > 1 ? 's' : ''} in the system. Treating both as independent `
          + `forecasts inflates the apparent hit rate — only one can land.`);
      }
      if (groupedRelations.has('exclusive_variant')) {
        const ev = groupedRelations.get('exclusive_variant')!;
        const fams = [...new Set(ev.filter(r => r.family_id).map(r => r.family_id))].sort();
        relationNarratives.push(
          `This prediction is one of ${ev.length + 1} variants in exclusive family `
          + `'${fams.length ? fams[0] : '?'}'. The family shares a single outcome space `
          + `— only one variant lands.`);
      }
      if (groupedRelations.has('equivalent')) {
        const eqs = groupedRelations.get('equivalent')!;
        relationNarratives.push(
          `Equivalent to ${eqs.length} other prediction${eqs.length > 1 ? 's' : ''} in the `
          + `system (same content, different wording) — candidate for merge to avoid double-counting.`);
      }
      if (groupedRelations.has('entails')) {
        const ent = groupedRelations.get('entails')!;
        relationNarratives.push(
          `Entails ${ent.length} downstream prediction${ent.length > 1 ? 's' : ''} (logical `
          + `implication, not evidence-mediated) — if this lands, those follow by definition.`);
      }
      if (groupedRelations.has('parallel') && relationNarratives.length === 0) {
        const par = groupedRelations.get('parallel')!;
        relationNarratives.push(
          `Parallel to ${par.length} other prediction${par.length > 1 ? 's' : ''} — independent `
          + `facets, both can be true at once.`);
      }
      const relationNarrative = relationNarratives.join(' ');

      const downstreamChain = downstreamIndex.get(pr.prediction_id) ?? [];
      const upstreamChain = upstreamIndex.get(pr.prediction_id) ?? [];
      let chainNarrative: string;
      if (downstreamChain.length) {
        chainNarrative = downstreamChain.length === 1
          ? `If this prediction lands, ${downstreamChain.length} downstream prediction gets strengthened (chain effect).`
          : `If this prediction lands, ${downstreamChain.length} downstream predictions get strengthened (chain effect).`;
      } else if (upstreamChain.length) {
        chainNarrative =
          `This prediction is itself a downstream of ${upstreamChain.length} other prediction`
          + `${upstreamChain.length > 1 ? 's' : ''} — its support pool grows as the upstream lands.`;
      } else {
        chainNarrative = '';
      }

      let clusterNarrative: string;
      const TREND_SINGLE: Record<string, string> = {
        accelerating: 'the cluster is accelerating',
        decelerating: 'the cluster is fading',
        flat: 'the cluster is steady',
      };
      const TREND_MULTI: Record<string, string> = {
        accelerating: 'accelerating', decelerating: 'fading', flat: 'steady',
      };
      if (!clusterSummaries.length) {
        clusterNarrative =
          'No cluster pattern detected — evidence either has no theme assignment yet '
          + 'or arrived without a first-seen date anchor.';
      } else if (clusterSummaries.length === 1) {
        const cs = clusterSummaries[0];
        clusterNarrative =
          `This prediction is supported by a single cluster: ${cs.size_in_pool} of `
          + `${cs.cluster_total} items in '${cs.theme_label}' (${cs.week_bucket}); `
          + `${TREND_SINGLE[cs.trend]}. Concentrated support — if this thread breaks, `
          + `the prediction loses its base.`;
      } else {
        const largest = clusterSummaries[0];
        clusterNarrative =
          `Broad support across ${clusterSummaries.length} clusters. Largest is `
          + `'${largest.theme_label}' (${largest.size_in_pool} of ${largest.cluster_total} `
          + `items, ${TREND_MULTI[largest.trend]}). Multi-thread support is more robust `
          + `than single-cluster concentration.`;
      }

      const needs = (db.prepare(
        `SELECT n.need_id, n.actor, n.actor_ja, n.actor_es, n.actor_fil,
                n.job, n.job_ja, n.job_es, n.job_fil,
                n.outcome, n.outcome_ja, n.outcome_es, n.outcome_fil,
                n.motivation, n.motivation_ja, n.motivation_es, n.motivation_fil,
                n.reviewed_by_human,
                n.target_start_date AS need_start, n.target_end_date AS need_end,
                t.task_id,
                t.who_text, t.who_text_ja, t.who_text_es, t.who_text_fil,
                t.what_text, t.what_text_ja, t.what_text_es, t.what_text_fil,
                t.where_text, t.where_text_ja, t.where_text_es, t.where_text_fil,
                t.when_text, t.when_text_ja, t.when_text_es, t.when_text_fil,
                t.why_text, t.why_text_ja, t.why_text_es, t.why_text_fil,
                t.how_text, t.how_text_ja, t.how_text_es, t.how_text_fil,
                t.status,
                t.target_start_date AS task_start, t.target_end_date AS task_end
         FROM prediction_needs n
         LEFT JOIN needs_tasks t ON n.need_id = t.need_id
         WHERE n.prediction_id = ?
         ORDER BY n.actor`).all(pr.prediction_id) as any[])
        .map(r => ({
          need_id: r.need_id, actor: r.actor, job: r.job,
          outcome: r.outcome, motivation: r.motivation,
          actor_locales: loc(r.actor, r.actor_ja, r.actor_es, r.actor_fil),
          job_locales: loc(r.job, r.job_ja, r.job_es, r.job_fil),
          outcome_locales: loc(r.outcome, r.outcome_ja, r.outcome_es, r.outcome_fil),
          motivation_locales: loc(r.motivation, r.motivation_ja, r.motivation_es, r.motivation_fil),
          reviewed_by_human: Boolean(r.reviewed_by_human),
          target_start_date: r.need_start, target_end_date: r.need_end,
          task: r.task_id ? {
            task_id: r.task_id,
            who: r.who_text, what: r.what_text, where: r.where_text,
            when: r.when_text, why: r.why_text, how: r.how_text,
            who_locales: loc(r.who_text, r.who_text_ja, r.who_text_es, r.who_text_fil),
            what_locales: loc(r.what_text, r.what_text_ja, r.what_text_es, r.what_text_fil),
            where_locales: loc(r.where_text, r.where_text_ja, r.where_text_es, r.where_text_fil),
            when_locales: loc(r.when_text, r.when_text_ja, r.when_text_es, r.when_text_fil),
            why_locales: loc(r.why_text, r.why_text_ja, r.why_text_es, r.why_text_fil),
            how_locales: loc(r.how_text, r.how_text_ja, r.how_text_es, r.how_text_fil),
            status: r.status,
            target_start_date: r.task_start, target_end_date: r.task_end,
          } : null,
        }));

      const parents = [parentId];
      for (const extraTh of extraThemeParents(summary, pr.theme_id))
        if (!parents.includes(extraTh)) parents.push(extraTh);

      const shortForLocale = (direct: any, localSummary: any): string | null => {
        if (direct) return direct;
        if (localSummary) return deriveShortLabel(localSummary, boldHint(localSummary), 0);
        return null;
      };
      const shortLabelLocales = {
        en: shortLabel,
        ja: shortForLocale(pr.prediction_short_label_ja, pr.prediction_summary_ja) || shortLabel,
        es: shortForLocale(pr.prediction_short_label_es, pr.prediction_summary_es) || shortLabel,
        fil: shortForLocale(pr.prediction_short_label_fil, pr.prediction_summary_fil) || shortLabel,
      };
      const summaryLocales = {
        en: summary,
        ja: pr.prediction_summary_ja || summary,
        es: pr.prediction_summary_es || summary,
        fil: pr.prediction_summary_fil || summary,
      };
      const titleLocales = loc(pr.prediction_title, pr.title_ja, pr.title_es, pr.title_fil);

      const node = {
        id: nodeId, type: 'prediction', scope_id: scopeId,
        label, short_label: shortLabel, title: pr.prediction_title,
        description: summary,
        labels: {
          label: { ...shortLabelLocales },
          short_label: shortLabelLocales,
          title: titleLocales,
          description: summaryLocales,
          summary: summaryLocales,
        },
        category_id: pr.category_id, theme_id: pr.theme_id,
        subtheme_id: pr.subtheme_id, prediction_id: pr.prediction_id,
        parent_ids: parents, child_ids: [] as string[],
        metrics_by_window: buildMetrics('prediction', nodeId),
        visibility: { min_zoom: 2.0, max_zoom: null, default_visible: false },
        layout,
        detail: {
          title: shortLabel,
          title_clean: pr.prediction_title,
          reasoning: {
            because: pr.reasoning_because, given: pr.reasoning_given,
            so_that: pr.reasoning_so_that, landing: pr.reasoning_landing,
            plain_language: pr.plain_language,
          },
          reasoning_locales: {
            because: loc(pr.reasoning_because, pr.reasoning_because_ja, pr.reasoning_because_es, pr.reasoning_because_fil),
            given: loc(pr.reasoning_given, pr.reasoning_given_ja, pr.reasoning_given_es, pr.reasoning_given_fil),
            so_that: loc(pr.reasoning_so_that, pr.reasoning_so_that_ja, pr.reasoning_so_that_es, pr.reasoning_so_that_fil),
            landing: loc(pr.reasoning_landing, pr.reasoning_landing_ja, pr.reasoning_landing_es, pr.reasoning_landing_fil),
            plain_language: loc(pr.plain_language, pr.plain_language_ja, pr.plain_language_es, pr.plain_language_fil),
          },
          title_locales: loc(pr.prediction_title, pr.title_ja, pr.title_es, pr.title_fil),
          summary_short: pr.pred_summary,
          summary_short_locales: {
            en: pr.pred_summary,
            ja: pr.pred_summary_ja || pr.pred_summary,
            es: pr.pred_summary_es || pr.pred_summary,
            fil: pr.pred_summary_fil || pr.pred_summary,
          },
          bridges, needs,
          readings: {
            clusters: clusterSummaries,
            cluster_narrative: clusterNarrative,
            downstream: downstreamChain,
            upstream: upstreamChain,
            chain_narrative: chainNarrative,
            relations: relationsForP,
            relation_narrative: relationNarrative,
          },
          subtitle: `Prediction · ${pyTitle(scopeId)}`,
          description: summary,
          scope_id: scopeId,
          node_type: 'prediction',
          prediction_summary: summary,
          prediction_summary_locales: summaryLocales,
          prediction_date: pr.prediction_date,
          source_report_path: pr.source_path,
          validation_report_path: validationPath,
          validation_reports: validationReports,
          parent_category_id: pr.category_id,
          parent_theme_id: pr.theme_id,
          parent_subtheme_id: pr.subtheme_id,
          latest_observed_relevance: pr.latest_observed_relevance,
          latest_realization_score: pr.latest_realization_score,
          latest_contradiction_score: pr.latest_contradiction_score,
          latest_observation_status: pr.latest_observation_status,
          huge_longshot_hit_at: pr.huge_longshot_hit_at,
          target_start_date: pr.target_start_date,
          target_end_date: pr.target_end_date,
          dormant: dormantSet.has(`${pr.prediction_date}||${pr.source_row_index}`),
          evidence,
        },
      };
      nodes.push(node);
      idIndex.set(nodeId, node);
      parentNode.child_ids.push(nodeId);
      for (const extraTh of parents.slice(1)) {
        const thNode = idIndex.get(extraTh);
        if (thNode !== undefined && !thNode.child_ids.includes(nodeId))
          thNode.child_ids.push(nodeId);
      }
    });
  }

  // No-empty-theme rule
  const predNodes = nodes.filter(n => n.type === 'prediction');
  const predTokensById = new Map(predNodes.map(p => [p.id, tok(p.description || p.label || '')]));
  const themeNodes = nodes.filter(n => n.type === 'theme');
  for (const thNode of themeNodes) {
    if (thNode.child_ids.length) continue;
    const thTokens = new Set([
      ...tok(thNode.label || ''), ...tok(thNode.short_label || ''), ...tok(thNode.description || ''),
    ]);
    if (thTokens.size === 0) continue;
    let bestPred: any = null;
    let bestScore = 0.0;
    for (const p of predNodes) {
      const pt = predTokensById.get(p.id) ?? new Set<string>();
      const shared = [...thTokens].filter(t => pt.has(t)).sort();
      if (!shared.length) continue;
      let score = 0.0;
      for (const t of shared) {
        const d = df.get(t) ?? 0;
        if (d > 0) score += 1.0 / d;
      }
      if (score > bestScore) {
        bestScore = score;
        bestPred = p;
      }
    }
    if (bestPred === null) continue;
    if (!bestPred.parent_ids.includes(thNode.id)) bestPred.parent_ids.push(thNode.id);
    if (!thNode.child_ids.includes(bestPred.id)) thNode.child_ids.push(bestPred.id);
  }

  // Aggregate metrics from secondary children
  const isEmptyBundle = (b: any) =>
    (b.attention_score || 0) === 0 && (b.realization_score || 0) === 0
    && !(b.grass_daily && b.grass_daily.length);
  const rollupInto = (parentNode: any, childType: string): void => {
    for (const [windowId] of WINDOWS) {
      const bundle = parentNode.metrics_by_window[windowId];
      if (!bundle || !isEmptyBundle(bundle)) continue;
      const dateAttn = new Map<string, number>();
      const attns: number[] = [];
      const reals: number[] = [];
      for (const cid of parentNode.child_ids) {
        const cn = idIndex.get(cid);
        if (cn === undefined || cn.type !== childType) continue;
        const cm = cn.metrics_by_window[windowId] ?? {};
        if (typeof cm.attention_score === 'number') attns.push(cm.attention_score);
        if (typeof cm.realization_score === 'number') reals.push(cm.realization_score);
        for (const entry of cm.grass_daily ?? []) {
          const d = entry.date;
          if (!d) continue;
          dateAttn.set(d, (dateAttn.get(d) ?? 0.0) + (entry.attention_score || 0));
        }
      }
      if (dateAttn.size === 0 && attns.length === 0 && reals.length === 0) continue;
      const newGrass = [...dateAttn.keys()].sort().map(d => {
        const attn = Math.min(1.0, dateAttn.get(d)!);
        return { date: d, grass_level: grassLevelFor(attn), attention_score: attn };
      });
      bundle.grass_daily = newGrass;
      if (attns.length) {
        bundle.attention_score = Math.max(...attns);
        bundle.grass_level = grassLevelFor(bundle.attention_score);
      }
      if (reals.length) bundle.realization_score = reals.reduce((a, b) => a + b, 0) / reals.length;
      const attnNow = bundle.attention_score;
      const realNow = bundle.realization_score;
      if (attnNow >= 0.5 && realNow >= 0.5) bundle.status = 'active';
      else if (attnNow >= 0.3) bundle.status = 'continuing';
      else bundle.status = 'dormant';
    }
  };
  for (const thNode of themeNodes) rollupInto(thNode, 'prediction');
  for (const catNode of nodes.filter(n => n.type === 'category')) rollupInto(catNode, 'theme');

  // Links
  const links: any[] = [];
  const knownIds = new Set(idIndex.keys());
  for (const node of nodes)
    for (const parentId of node.parent_ids) {
      if (!knownIds.has(parentId)) continue;
      links.push({
        id: `link.${parentId}__${node.id}`, source: parentId, target: node.id,
        type: 'contains', weight: 1.0, status: 'active',
      });
    }

  const crossCatPairs = new Set<string>();
  const linkedCategories = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'prediction') continue;
    const cats = new Set<string>();
    for (const pid of node.parent_ids) {
      const pn = idIndex.get(pid);
      if (pn === undefined) continue;
      if ((pn.type === 'theme' || pn.type === 'subtheme') && pn.category_id)
        cats.add(pn.category_id);
    }
    if (cats.size < 2) continue;
    const ordered = [...cats].sort();
    for (const c of ordered) linkedCategories.add(c);
    for (let i = 0; i < ordered.length; i++)
      for (let j = i + 1; j < ordered.length; j++)
        crossCatPairs.add(`${ordered[i]}\0${ordered[j]}`);
  }
  for (const pair of [...crossCatPairs].sort()) {
    const [a, b] = pair.split('\0');
    links.push({
      id: `link.shares.${a}__${b}`, source: a, target: b,
      type: 'shares_prediction', weight: 0.6, status: 'active',
    });
  }
  for (const catId of linkedCategories) {
    const cn = idIndex.get(catId);
    if (cn === undefined) continue;
    cn.visibility.min_zoom = 0.0;
    cn.visibility.default_visible = true;
  }

  const dateRange = { start: earliest ?? latest, end: latest };
  const windows: Record<string, any> = {};
  if (latest !== null)
    for (const [wid, days] of WINDOWS) {
      const [s, e] = windowRange(latest, days);
      windows[wid] = { start: s, end: e };
    }
  else
    for (const [wid] of WINDOWS) windows[wid] = { start: null, end: null };

  const scopeRow = db.prepare('SELECT label FROM scopes WHERE scope_id = ?').get(scopeId) as any;
  const scopeLabel = scopeRow ? scopeRow.label : pyTitle(scopeId);

  return {
    schema_version: SCHEMA_VERSION,
    scope_id: scopeId,
    scope_label: scopeLabel,
    generated_at: nowIso(),
    date_range: dateRange,
    windows,
    nodes,
    links,
    legend: {
      heat_metric: 'attention_score',
      warning_metric: 'realization_score',
      warning_threshold: 0.4,
    },
  };
}

function buildManifest(db: Db, buildId: string): Record<string, any> {
  const latest = latestReportDate(db) ?? '';
  const windows = (db.prepare(
    'SELECT window_id, label, days, is_default FROM metric_windows ORDER BY sort_order')
    .all() as any[]).map(r => ({ window_id: r.window_id, label: r.label, days: r.days }));
  const dw = db.prepare(
    'SELECT window_id FROM metric_windows WHERE is_default = 1 LIMIT 1').get() as any;
  return {
    schema_version: SCHEMA_VERSION,
    build_id: buildId,
    latest_report_date: latest,
    default_scope: 'mix',
    default_window: dw?.window_id ?? '30d',
    default_locale: DEFAULT_LOCALE,
    locales: [...LOCALES],
    windows,
    scopes: [
      { scope_id: 'mix', label: 'Mix', graph_file: 'graph-mix.json' },
      { scope_id: 'tech', label: 'Tech', graph_file: 'graph-tech.json' },
      { scope_id: 'business', label: 'Business', graph_file: 'graph-business.json' },
    ],
  };
}

function validateGraph(graph: any): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    nodeIds.add(node.id);
    for (const winId of ['7d', '30d', '90d'])
      if (!(winId in (node.metrics_by_window ?? {})))
        errors.push(`node ${node.id} missing metrics_by_window.${winId}`);
  }
  for (const link of graph.links) {
    if (!nodeIds.has(link.source))
      errors.push(`link ${link.id} references missing source ${link.source}`);
    if (!nodeIds.has(link.target))
      errors.push(`link ${link.id} references missing target ${link.target}`);
  }
  return errors;
}

function buildMixGraph(tech: any, business: any, buildId: string): Record<string, any> {
  const nodes: any[] = [];
  const idIndex = new Map<string, any>();
  const ingest = (srcNodes: any[]) => {
    for (const n of srcNodes) {
      const existing = idIndex.get(n.id);
      if (existing === undefined) {
        const cp = { ...n, parent_ids: [...(n.parent_ids ?? [])], child_ids: [...(n.child_ids ?? [])] };
        nodes.push(cp);
        idIndex.set(cp.id, cp);
      } else {
        for (const pid of n.parent_ids ?? [])
          if (!existing.parent_ids.includes(pid)) existing.parent_ids.push(pid);
        for (const cid of n.child_ids ?? [])
          if (!existing.child_ids.includes(cid)) existing.child_ids.push(cid);
      }
    }
  };
  ingest(tech.nodes);
  ingest(business.nodes);

  const links: any[] = [];
  const seenLinkIds = new Set<string>();
  for (const src of [...(tech.links ?? []), ...(business.links ?? [])]) {
    if (src.type === 'shares_prediction') continue;
    if (seenLinkIds.has(src.id)) continue;
    seenLinkIds.add(src.id);
    links.push({ ...src });
  }

  const crossCatPairs = new Set<string>();
  const linkedCategories = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'prediction') continue;
    const cats = new Set<string>();
    for (const pid of node.parent_ids) {
      const pn = idIndex.get(pid);
      if (pn === undefined) continue;
      if ((pn.type === 'theme' || pn.type === 'subtheme') && pn.category_id)
        cats.add(pn.category_id);
    }
    if (cats.size < 2) continue;
    const ordered = [...cats].sort();
    for (const c of ordered) linkedCategories.add(c);
    for (let i = 0; i < ordered.length; i++)
      for (let j = i + 1; j < ordered.length; j++)
        crossCatPairs.add(`${ordered[i]}\0${ordered[j]}`);
  }
  for (const pair of [...crossCatPairs].sort()) {
    const [a, b] = pair.split('\0');
    const linkId = `link.shares.${a}__${b}`;
    if (seenLinkIds.has(linkId)) continue;
    seenLinkIds.add(linkId);
    links.push({
      id: linkId, source: a, target: b,
      type: 'shares_prediction', weight: 0.6, status: 'active',
    });
  }
  for (const catId of linkedCategories) {
    const cn = idIndex.get(catId);
    if (cn === undefined) continue;
    if (!cn.visibility) cn.visibility = { min_zoom: 0.0, max_zoom: null, default_visible: true };
    cn.visibility.min_zoom = 0.0;
    cn.visibility.default_visible = true;
  }

  return {
    schema_version: tech.schema_version ?? SCHEMA_VERSION,
    scope_id: 'mix',
    scope_label: 'Mix',
    generated_at: buildId,
    date_range: tech.date_range ?? business.date_range,
    windows: tech.windows ?? business.windows,
    nodes,
    links,
    legend: tech.legend ?? business.legend,
  };
}

export function runExport(db: Db, args: { outputDir: string; publishRoot: string }): Record<string, any> {
  const outDir = args.outputDir;
  mkdirSync(outDir, { recursive: true });
  const buildId = nowIso();
  const written: string[] = [];
  const scopeGraphs: Record<string, any> = {};

  for (const scopeId of ['tech', 'business']) {
    const graph = buildScopeGraph(db, scopeId, args.publishRoot);
    scopeGraphs[scopeId] = graph;
    const errs = validateGraph(graph);
    if (errs.length) graph._validation_errors = errs;
    const target = join(outDir, `graph-${scopeId}.json`);
    const serialized = JSON.stringify(graph, null, 2);
    writeFileSync(target, serialized, 'utf8');
    written.push(target);
    db.prepare(
      `INSERT INTO graph_exports (
         export_id, scope_id, window_id, output_path, schema_version,
         generated_at, node_count, link_count, date_start, date_end, content_sha
       ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        hashId('export', scopeId, buildId), scopeId, relToRepo(target, args.publishRoot),
        SCHEMA_VERSION, buildId, graph.nodes.length, graph.links.length,
        graph.date_range.start, graph.date_range.end, sha1Hex(serialized));
  }

  const mixGraph = buildMixGraph(scopeGraphs.tech, scopeGraphs.business, buildId);
  const mixErrs = validateGraph(mixGraph);
  if (mixErrs.length) mixGraph._validation_errors = mixErrs;
  const mixTarget = join(outDir, 'graph-mix.json');
  const mixSerialized = JSON.stringify(mixGraph, null, 2);
  writeFileSync(mixTarget, mixSerialized, 'utf8');
  written.push(mixTarget);
  db.prepare(
    `INSERT INTO graph_exports (
       export_id, scope_id, window_id, output_path, schema_version,
       generated_at, node_count, link_count, date_start, date_end, content_sha
     ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      hashId('export', 'mix', buildId), 'tech', relToRepo(mixTarget, args.publishRoot),
      SCHEMA_VERSION, buildId, mixGraph.nodes.length, mixGraph.links.length,
      mixGraph.date_range?.start ?? null, mixGraph.date_range?.end ?? null,
      sha1Hex(mixSerialized));

  const glossaryTerms: any[] = [];
  for (const row of db.prepare(
    `SELECT term, aliases_json, quick_def,
            quick_def_ja, quick_def_es, quick_def_fil,
            why_it_matters,
            why_it_matters_ja, why_it_matters_es, why_it_matters_fil,
            canonical_link
       FROM glossary_terms
      WHERE status = 'active' AND quick_def IS NOT NULL AND quick_def <> ''
      ORDER BY term`).all() as any[]) {
    let aliases: any[] = [];
    if (row.aliases_json) {
      try {
        const parsed = JSON.parse(row.aliases_json);
        aliases = Array.isArray(parsed) ? parsed : [];
      } catch { aliases = []; }
    }
    glossaryTerms.push({
      term: row.term,
      aliases,
      quick_def: row.quick_def,
      why_it_matters: row.why_it_matters,
      quick_def_locales: loc(row.quick_def, row.quick_def_ja, row.quick_def_es, row.quick_def_fil),
      why: loc(row.why_it_matters, row.why_it_matters_ja, row.why_it_matters_es, row.why_it_matters_fil),
      canonical_link: row.canonical_link,
    });
  }
  const glossaryPath = join(outDir, 'glossary.json');
  writeFileSync(glossaryPath,
    JSON.stringify({ generated_at: buildId, terms: glossaryTerms }, null, 2), 'utf8');
  written.push(glossaryPath);

  const manifest = buildManifest(db, buildId);
  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  written.push(manifestPath);

  return { files: written, build_id: buildId };
}
