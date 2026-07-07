// TS port of app/skills/build_evidence_reverse.py — the EVIDENCE tab's
// reverse index (evidence → predictions it supported, 90-day window,
// per-source-type exponential decay).
import type Database from 'better-sqlite3';
import { pyRound } from '../ingest/util.ts';

const DECAY_TAU_DAYS: Record<string, number> = {
  release: 14, news: 14, security_advisory: 30, business: 60, social: 7, default: 30,
};

function decayFor(kind: string | null): number {
  return DECAY_TAU_DAYS[kind ?? 'default'] ?? DECAY_TAU_DAYS.default;
}

function daysAgo(dateIso: string | null, today: string): number {
  if (!dateIso) return 9999;
  const d = Date.parse(dateIso.slice(0, 10) + 'T12:00:00Z');
  const t = Date.parse(today.slice(0, 10) + 'T12:00:00Z');
  if (!Number.isFinite(d) || !Number.isFinite(t)) return 9999;
  return Math.max(Math.round((t - d) / 86400000), 0);
}

export function buildEvidenceReverse(
  db: Database.Database, args: { topN?: number; todayIso: string },
): Record<string, unknown> {
  const topN = args.topN ?? 200;
  const rows = db.prepare(
    `SELECT pel.evidence_id, pel.prediction_id, pel.scope_id,
            pel.support_direction, pel.relatedness_score,
            pel.evidence_strength, pel.validation_date,
            ev.url, ev.title, ev.source_type, ev.first_seen_date,
            p.prediction_summary, p.prediction_short_label, p.prediction_date
       FROM prediction_evidence_links pel
       JOIN evidence_items ev ON pel.evidence_id = ev.evidence_id
       JOIN predictions p ON pel.prediction_id = p.prediction_id
      WHERE pel.validation_date >= date(?, '-90 days')`).all(args.todayIso) as any[];

  const byEv = new Map<string, any>();
  for (const r of rows) {
    let ent = byEv.get(r.evidence_id);
    if (ent === undefined) {
      ent = { linked_predictions: [] };
      byEv.set(r.evidence_id, ent);
    }
    if (!('title' in ent)) {
      ent.evidence_id = r.evidence_id;
      ent.title = r.title;
      ent.url = r.url;
      ent.source_type = r.source_type;
      ent.reported_at = r.first_seen_date;
    }
    const age = daysAgo(r.validation_date, args.todayIso);
    const tau = decayFor(r.source_type);
    const score = pyRound((r.relatedness_score ?? 0.0) * Math.exp(-age / Math.max(tau, 1)), 4);
    ent.linked_predictions.push({
      prediction_id: r.prediction_id,
      scope_id: r.scope_id,
      support_direction: r.support_direction,
      score,
      validation_date: r.validation_date,
      prediction_summary: r.prediction_summary,
      prediction_short_label: r.prediction_short_label,
      prediction_date: r.prediction_date,
    });
  }

  for (const ent of byEv.values()) {
    const best = new Map<string, any>();
    for (const p of ent.linked_predictions) {
      const cur = best.get(p.prediction_id);
      if (cur === undefined || p.score > cur.score) best.set(p.prediction_id, p);
    }
    ent.linked_predictions = [...best.values()].sort((a, b) => b.score - a.score);
    ent.total_score = pyRound(
      ent.linked_predictions.reduce((a: number, p: any) => a + p.score, 0), 4);
  }

  const ranked = [...byEv.values()].sort((a, b) => b.total_score - a.total_score).slice(0, topN);
  return {
    generated_at: args.todayIso,
    top_n: topN,
    evidence_count: ranked.length,
    evidence: ranked,
  };
}
