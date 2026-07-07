// TS port of app/skills/ingest_sourcedata.py — deterministic ingester
// for <sourcedataRoot>/<date>/*.json into the analytics DB. API takes
// the sourcedata root explicitly (the oracle anchored on repo_root).
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Db, ThemeRow } from './ingest-core.ts';
import {
  linkPredictionEvidence, loadThemes, matchOrCreatePrediction,
  pickThemePerScope, updatePredictionLocaleCols, upsertAssignment,
  upsertCandidate, upsertEvidence, upsertPrediction, upsertValidationRow,
} from './ingest-core.ts';
import { chainId, nowIso, relationId, sha1Hex } from './util.ts';
import { normalizeRelevance } from './analytics.ts';
import { commitNeed, type NeedRecord } from './commit-need.ts';
import {
  parseBridgesFile, parseChangeLogFile, parseHeadlinesFile, parseNeedsFile,
  parseNewsSectionFile, parsePredictionsFile, parseReadingsFile,
} from '../schemas/sourcedata.ts';

import { NON_EN_LOCALES } from '../world-paths.ts';

export const LOCALES = NON_EN_LOCALES;

export function dateDir(sourcedataRoot: string, dateIso: string): string {
  return join(sourcedataRoot, dateIso);
}

export function localeDateDir(sourcedataRoot: string, dateIso: string, locale: string): string {
  return join(sourcedataRoot, 'locales', dateIso, locale);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Options threaded through one day's ingest. `repoRootForRel` anchors
 * the repo-relative source_files.path (v2 rel paths look like
 * `data/sourcedata/<d>/x.json`; rows imported from a news-era DB keep
 * their original provenance strings — see src/import.ts); `todayIso`
 * feeds commit_need's date stamps. */
export interface IngestContext {
  sourcedataRoot: string;
  repoRootForRel: string;
  todayIso: string;
  /** The effective non-EN set for the locale fan-in (ingestDayLocales).
   * Absent = the full universe (ja/es/fil). */
  locales?: readonly string[];
}

function registerSourceFile(db: Db, ctx: IngestContext, args: {
  jsonPath: string; fileType: string; reportDate: string; locale?: string;
}): string {
  let rel = relative(ctx.repoRootForRel, args.jsonPath).replaceAll('\\', '/');
  if (rel.startsWith('..')) rel = args.jsonPath.replaceAll('\\', '/');
  const sourceFileId = 'source.' + sha1Hex('||' + rel).slice(0, 16);
  const content = readFileSync(args.jsonPath, 'utf8');
  db.prepare(
    `INSERT INTO source_files (
       source_file_id, path, file_type, report_date, content_sha, parsed_at, locale
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       report_date=excluded.report_date, content_sha=excluded.content_sha,
       parsed_at=excluded.parsed_at, locale=excluded.locale`)
    .run(sourceFileId, rel, args.fileType, args.reportDate,
      sha1Hex(content), nowIso(), args.locale ?? 'en');
  const row = db.prepare('SELECT source_file_id FROM source_files WHERE path = ?')
    .get(rel) as { source_file_id: string } | undefined;
  return row?.source_file_id ?? sourceFileId;
}

// --- per-file ingesters ---------------------------------------------------

function ingestPredictionsFile(db: Db, ctx: IngestContext, args: {
  dateIso: string; jsonPath: string; themes: ThemeRow[];
}): Map<string, string> {
  const pf = parsePredictionsFile(readJson(args.jsonPath));
  const sourceFileId = registerSourceFile(db, ctx, {
    jsonPath: args.jsonPath, fileType: 'daily_report', reportDate: pf.date,
  });
  const pidByJsonId = new Map<string, string>();
  pf.predictions.forEach((pred, idx) => {
    const predictionId = upsertPrediction(db, {
      predictionSummary: pred.body,
      shortLabel: pred.title,
      predictionDate: pf.date,
      sourceFileId,
      sourceRowIndex: idx,
      rawText: pred.body,
      title: pred.title,
      reasoningBecause: pred.reasoning.because,
      reasoningGiven: pred.reasoning.given,
      reasoningSoThat: pred.reasoning.so_that,
      reasoningLanding: pred.reasoning.landing,
      plainLanguage: pred.reasoning.plain_language,
      summaryText: pred.summary,
    });
    pidByJsonId.set(pred.id, predictionId);
    const matchByScope = pickThemePerScope(pred.body, args.themes);
    for (const scopeId of ['tech', 'business']) {
      const theme = matchByScope.get(scopeId);
      if (theme !== undefined) {
        upsertAssignment(db, {
          predictionId, scopeId, categoryId: theme.category_id,
          themeId: theme.theme_id, method: 'anchor', score: 1.0,
        });
      } else {
        upsertCandidate(db, {
          scopeId, predictionId, label: pred.title, shortLabel: pred.title,
          description: [...pred.body].slice(0, 280).join(''),
        });
      }
    }
  });
  return pidByJsonId;
}

function ingestNeedsFile(db: Db, ctx: IngestContext, args: {
  jsonPath: string; pidByJsonId: Map<string, string>;
}): number {
  const nf = parseNeedsFile(readJson(args.jsonPath));
  let total = 0;
  for (const [jsonPid, needs] of Object.entries(nf.by_prediction)) {
    const dbPid = args.pidByJsonId.get(jsonPid) ?? jsonPid;
    const records: NeedRecord[] = needs.map(n => {
      const rec: NeedRecord = { actor: n.actor, job: n.job };
      if (n.outcome !== null) rec.outcome = n.outcome;
      if (n.motivation !== null) rec.motivation = n.motivation;
      if (n.task !== null)
        rec.task = {
          who: n.task.who, what: n.task.what, where: n.task.where,
          when: n.task.when, why: n.task.why, how: n.task.how,
        };
      return rec;
    });
    const summary = commitNeed(db, {
      predictionId: dbPid, needRecords: records, todayIso: ctx.todayIso,
    });
    total += summary.need_count;
  }
  return total;
}

function ingestBridgesFile(db: Db, ctx: IngestContext, args: {
  dateIso: string; jsonPath: string; pidByJsonId: Map<string, string>;
}): number {
  const bf = parseBridgesFile(readJson(args.jsonPath));
  const sourceFileId = registerSourceFile(db, ctx, {
    jsonPath: args.jsonPath, fileType: 'future_prediction_report', reportDate: bf.date,
  });
  const themesForMatch = bf.validation_rows.length ? loadThemes(db) : [];
  let count = 0;
  for (const entry of bf.validation_rows) {
    let predictionId = args.pidByJsonId.get(entry.prediction_ref.id);
    if (predictionId === undefined) {
      const exists = db.prepare('SELECT 1 FROM predictions WHERE prediction_id = ?')
        .get(entry.prediction_ref.id);
      if (exists !== undefined) {
        predictionId = entry.prediction_ref.id;
      } else {
        predictionId = matchOrCreatePrediction(db, {
          row: {
            prediction_summary: entry.prediction_ref.short_label,
            prediction_date: entry.prediction_ref.prediction_date || '',
            related_items_text: entry.evidence_summary,
            reference_links: entry.reference_links.map(r => ({ url: r.url, title: r.label })),
            observed_relevance: entry.today_relevance,
            raw_row_markdown: entry.bridge.narrative,
            bridge_text: entry.bridge.narrative,
            support_dimension: entry.bridge.support_dimension,
          },
          themes: themesForMatch,
          sourceFileId,
        });
      }
    }
    const row = {
      prediction_summary: entry.prediction_ref.short_label,
      prediction_date: entry.prediction_ref.prediction_date,
      related_items_text: entry.evidence_summary,
      reference_links: entry.reference_links.map(r => ({ url: r.url, title: r.label })),
      observed_relevance: entry.today_relevance,
      raw_row_markdown: entry.bridge.narrative,
      bridge_text: entry.bridge.narrative,
      support_dimension: entry.bridge.support_dimension,
    };
    upsertValidationRow(db, {
      sourceFileId, validationDate: bf.date, predictionId, row,
    });
    const newRel = normalizeRelevance(entry.today_relevance);
    for (const scopeId of ['tech', 'business']) {
      db.prepare(
        `UPDATE prediction_scope_assignments
            SET latest_observed_relevance = ?, latest_realization_score = ?,
                latest_contradiction_score = ?, updated_at = ?
          WHERE prediction_id = ? AND scope_id = ?`)
        .run(entry.today_relevance, newRel, 0.0, nowIso(), predictionId, scopeId);
    }
    for (const ev of row.reference_links) {
      const evId = upsertEvidence(db, {
        url: ev.url, title: ev.title, firstSeen: bf.date, sourceFileId,
      });
      const scopeRows = db.prepare(
        'SELECT scope_id FROM prediction_scope_assignments WHERE prediction_id = ?')
        .all(predictionId) as Array<{ scope_id: string }>;
      for (const sr of scopeRows)
        linkPredictionEvidence(db, {
          predictionId, evidenceId: evId, scopeId: sr.scope_id,
          validationDate: bf.date, observedRelevance: entry.today_relevance,
          contradiction: 0.0, isNew: true,
        });
    }
    count += 1;
  }
  return count;
}

function ingestReadingsFile(db: Db, ctx: IngestContext, args: {
  dateIso: string; jsonPath: string;
}): Record<string, number> {
  const rf = parseReadingsFile(readJson(args.jsonPath));
  registerSourceFile(db, ctx, {
    jsonPath: args.jsonPath, fileType: 'other', reportDate: rf.date,
  });
  const now = nowIso();
  let chainInserted = 0, chainSkipped = 0;
  for (const edge of rf.chain_edges) {
    const cid = chainId(edge.source_prediction_id, edge.downstream_prediction_id, edge.via_evidence_id);
    try {
      db.prepare(
        `INSERT OR REPLACE INTO prediction_chain (
           chain_id, source_prediction_id, downstream_prediction_id,
           via_evidence_id, strength, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?,
                   COALESCE((SELECT created_at FROM prediction_chain WHERE chain_id = ?), ?), ?)`)
        .run(cid, edge.source_prediction_id, edge.downstream_prediction_id,
          edge.via_evidence_id, edge.strength, edge.notes, cid, now, now);
      chainInserted += 1;
    } catch (e) {
      chainSkipped += 1;
      console.error(
        `WARN ingest readings ${args.dateIso}: skip chain edge `
        + `${edge.source_prediction_id}->${edge.downstream_prediction_id} `
        + `via ${edge.via_evidence_id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  let relInserted = 0, relSkipped = 0;
  for (const rel of rf.relations) {
    const rid = relationId(rel.prediction_a, rel.prediction_b, rel.relation_type);
    try {
      db.prepare(
        `INSERT OR REPLACE INTO prediction_relations (
           relation_id, prediction_a, prediction_b, relation_type,
           family_id, prob_mass, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?,
                   COALESCE((SELECT created_at FROM prediction_relations WHERE relation_id = ?), ?), ?)`)
        .run(rid, rel.prediction_a, rel.prediction_b, rel.relation_type,
          rel.family_id, rel.prob_mass, rel.notes, rid, now, now);
      relInserted += 1;
    } catch (e) {
      relSkipped += 1;
      console.error(
        `WARN ingest readings ${args.dateIso}: skip relation `
        + `${rel.prediction_a}<>${rel.prediction_b} (${rel.relation_type}): `
        + `${e instanceof Error ? e.message : e}`);
    }
  }
  return {
    chain_edges: chainInserted, chain_edges_skipped: chainSkipped,
    relations: relInserted, relations_skipped: relSkipped,
    cluster_pointers: rf.cluster_pointers.length,
  };
}

function ingestCountOnlyFile(db: Db, ctx: IngestContext, args: {
  jsonPath: string; kind: 'headlines' | 'change_log' | 'news_section';
}): number {
  // headlines / change_log / news_section have no DB tables — register
  // provenance and return counts (mirrors the oracle).
  if (args.kind === 'headlines') {
    const hf = parseHeadlinesFile(readJson(args.jsonPath));
    registerSourceFile(db, ctx, { jsonPath: args.jsonPath, fileType: 'other', reportDate: hf.date });
    return hf.technical.length + hf.plain.length;
  }
  if (args.kind === 'change_log') {
    const cl = parseChangeLogFile(readJson(args.jsonPath));
    registerSourceFile(db, ctx, { jsonPath: args.jsonPath, fileType: 'other', reportDate: cl.date });
    return cl.items.length;
  }
  const ns = parseNewsSectionFile(readJson(args.jsonPath));
  registerSourceFile(db, ctx, { jsonPath: args.jsonPath, fileType: 'other', reportDate: ns.date });
  return ns.sections.reduce((acc, s) => acc + s.bullets.length, 0);
}

// --- public entry points ---------------------------------------------------

export interface IngestDayResult {
  summary: Record<string, unknown>;
  pidByJsonId: Map<string, string>;
}

export function ingestDay(db: Db, ctx: IngestContext, dateIso: string): IngestDayResult {
  const summary: Record<string, unknown> = {
    date: dateIso, predictions: 0, needs: 0, bridges: 0,
    headlines: 0, change_log: 0, news_section: 0,
    readings: { chain_edges: 0, relations: 0, cluster_pointers: 0 },
  };
  const base = dateDir(ctx.sourcedataRoot, dateIso);
  const pidByJsonId = new Map<string, string>();
  if (!existsSync(base)) return { summary, pidByJsonId };

  const themes = loadThemes(db);

  const predPath = join(base, 'predictions.json');
  if (existsSync(predPath)) {
    const m = ingestPredictionsFile(db, ctx, { dateIso, jsonPath: predPath, themes });
    for (const [k, v] of m) pidByJsonId.set(k, v);
    summary.predictions = m.size;
  }
  const needsPath = join(base, 'needs.json');
  if (existsSync(needsPath))
    summary.needs = ingestNeedsFile(db, ctx, { jsonPath: needsPath, pidByJsonId });
  const bridgesPath = join(base, 'bridges.json');
  if (existsSync(bridgesPath))
    summary.bridges = ingestBridgesFile(db, ctx, { dateIso, jsonPath: bridgesPath, pidByJsonId });
  const readingsPath = join(base, 'readings.json');
  if (existsSync(readingsPath))
    summary.readings = ingestReadingsFile(db, ctx, { dateIso, jsonPath: readingsPath });
  for (const [name, kind] of [
    ['headlines.json', 'headlines'], ['change_log.json', 'change_log'],
    ['news_section.json', 'news_section'],
  ] as const) {
    const p = join(base, name);
    if (existsSync(p)) summary[kind] = ingestCountOnlyFile(db, ctx, { jsonPath: p, kind });
  }
  return { summary, pidByJsonId };
}

export function ingestDayLocales(
  db: Db, ctx: IngestContext, dateIso: string, pidByJsonId: Map<string, string>,
): Record<string, Record<string, number>> {
  const summary: Record<string, Record<string, number>> = {};
  for (const loc of ctx.locales ?? LOCALES) {
    const locSummary = { predictions: 0, needs: 0, bridges: 0 };
    summary[loc] = locSummary;
    const base = localeDateDir(ctx.sourcedataRoot, dateIso, loc);
    if (!existsSync(base)) continue;

    const predPath = join(base, 'predictions.json');
    if (existsSync(predPath)) {
      const pf = parsePredictionsFile(readJson(predPath));
      // Build index→pid: with a pid map, look up source_row_index per pid;
      // otherwise fall back to a date query (mirrors the oracle).
      const idxToPid = new Map<number, string>();
      if (pidByJsonId.size === 0) {
        const rows = db.prepare(
          `SELECT prediction_id, source_row_index FROM predictions
           WHERE prediction_date = ? ORDER BY source_row_index`).all(pf.date) as
          Array<{ prediction_id: string; source_row_index: number }>;
        for (const r of rows) idxToPid.set(r.source_row_index, r.prediction_id);
      } else {
        for (const pid of pidByJsonId.values()) {
          const r = db.prepare(
            'SELECT source_row_index FROM predictions WHERE prediction_id = ?')
            .get(pid) as { source_row_index: number } | undefined;
          if (r !== undefined) idxToPid.set(r.source_row_index, pid);
        }
      }
      let count = 0;
      pf.predictions.forEach((pred, idx) => {
        const targetPid = idxToPid.get(idx);
        if (targetPid === undefined) return;
        updatePredictionLocaleCols(db, {
          predictionId: targetPid, locale: loc,
          summary: pred.body, shortLabel: pred.title, summaryText: pred.summary,
          title: pred.title, reasoningBecause: pred.reasoning.because,
          reasoningGiven: pred.reasoning.given, reasoningSoThat: pred.reasoning.so_that,
          reasoningLanding: pred.reasoning.landing, plainLanguage: pred.reasoning.plain_language,
        });
        count += 1;
      });
      locSummary.predictions = count;
    }

    const needsPath = join(base, 'needs.json');
    if (existsSync(needsPath) && pidByJsonId.size > 0) {
      const nf = parseNeedsFile(readJson(needsPath));
      let count = 0;
      for (const [jsonPid, needs] of Object.entries(nf.by_prediction)) {
        const dbPid = pidByJsonId.get(jsonPid) ?? jsonPid;
        const existing = db.prepare(
          'SELECT need_id FROM prediction_needs WHERE prediction_id = ? ORDER BY rowid')
          .all(dbPid) as Array<{ need_id: string }>;
        needs.forEach((n, idx) => {
          if (idx >= existing.length) return;
          const needId = existing[idx].need_id;
          db.prepare(
            `UPDATE prediction_needs SET
               actor_${loc} = ?, job_${loc} = ?,
               outcome_${loc} = COALESCE(?, outcome_${loc}),
               motivation_${loc} = COALESCE(?, motivation_${loc})
             WHERE need_id = ?`)
            .run(n.actor, n.job, n.outcome, n.motivation, needId);
          if (n.task !== null) {
            const trow = db.prepare('SELECT task_id FROM needs_tasks WHERE need_id = ?')
              .get(needId) as { task_id: string } | undefined;
            if (trow !== undefined) {
              const cells = ['who', 'what', 'where', 'when', 'why', 'how'] as const;
              const sets = cells.map(c => `${c}_text_${loc} = COALESCE(?, ${c}_text_${loc})`).join(', ');
              const sqlArgs: unknown[] = cells.map(c => n.task![c]);
              sqlArgs.push(trow.task_id);
              db.prepare(`UPDATE needs_tasks SET ${sets} WHERE task_id = ?`).run(...sqlArgs as never[]);
            }
          }
          count += 1;
        });
      }
      locSummary.needs = count;
    }

    const bridgesPath = join(base, 'bridges.json');
    if (existsSync(bridgesPath)) {
      const bf = parseBridgesFile(readJson(bridgesPath));
      const canonRowIds = (db.prepare(
        `SELECT vr.validation_row_id
           FROM validation_rows vr
           JOIN source_files sf ON vr.source_file_id = sf.source_file_id
          WHERE vr.validation_date = ? ORDER BY vr.rowid`).all(bf.date) as
        Array<{ validation_row_id: string }>).map(r => r.validation_row_id);
      let count = 0;
      bf.validation_rows.forEach((entry, idx) => {
        if (idx >= canonRowIds.length) return;
        db.prepare(
          `UPDATE validation_rows SET prediction_summary_${loc} = ?,
             bridge_text_${loc} = COALESCE(?, bridge_text_${loc})
           WHERE validation_row_id = ?`)
          .run(entry.prediction_ref.short_label, entry.bridge.narrative, canonRowIds[idx]);
        count += 1;
      });
      locSummary.bridges = count;
    }
  }
  return summary;
}
