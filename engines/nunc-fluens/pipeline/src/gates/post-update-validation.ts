// TS port of app/skills/post_update_validation.py — DB + JSON-export
// shape gate. In-process API returning {exit, lines} (the oracle
// printed to stdout; line text mirrored for parity).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { parseTimeWindow } from '../ingest/timewindow.ts';
import {
  DAILY_NEWS_REL, EXPORTS_REL, FP_REL, NON_EN_LOCALES,
} from '../world-paths.ts';

const EN_PREDICTION_COLS = [
  'title', 'reasoning_because', 'reasoning_given', 'reasoning_so_that',
  'reasoning_landing', 'plain_language', 'summary',
];
/** `<base>_<locale>` DB column names for the effective non-EN set —
 * unconfigured locales' columns stay NULL and are not demanded. */
const localeCols = (base: readonly string[], nonEn: readonly string[]): string[] =>
  base.flatMap(c => nonEn.map(l => `${c}_${l}`));
const TARGET_PREDICTION_COLS = ['target_start_date', 'target_end_date'];

const NEED_COLS = ['actor', 'job', 'outcome', 'motivation'];
const TASK_REQUIRED_5W1H = ['who_text', 'what_text', 'where_text', 'when_text', 'why_text'];

const VR_DIM_VALID = ['because', 'given', 'so_that', 'landing', 'none'];

function empty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && !v.trim());
}

/** Python f"{v!r:.N}"-style clip used in a couple of messages. */
function pyReprClip(s: unknown, width: number): string {
  const rep = s === null || s === undefined
    ? 'None'
    : `'${String(s).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  return rep.slice(0, width);
}

function checkPredictionsForDate(
  db: Database.Database, date: string, nonEn: readonly string[],
): string[] {
  const LOCALE_PREDICTION_COLS = localeCols(EN_PREDICTION_COLS, nonEn);
  const cols = ['prediction_id', 'source_row_index',
    ...EN_PREDICTION_COLS, ...LOCALE_PREDICTION_COLS, ...TARGET_PREDICTION_COLS];
  const rows = db.prepare(
    `SELECT ${cols.join(', ')} FROM predictions WHERE prediction_date = ? ORDER BY source_row_index`)
    .all(date) as any[];
  const errs: string[] = [];
  if (!rows.length) {
    errs.push(
      `no predictions rows for prediction_date='${date}' — writer + ingest `
      + `step never produced a row (check 1_daily_update Step 2 + ingest)`);
    return errs;
  }
  for (const rec of rows) {
    const pid = rec.prediction_id;
    const idx = rec.source_row_index;
    for (const col of EN_PREDICTION_COLS)
      if (empty(rec[col]))
        errs.push(
          `prediction #${idx} (${pid}): ${col} is NULL/empty — `
          + `title / reasoning / mid-tier spec requires writer to emit this`);
    for (const col of LOCALE_PREDICTION_COLS)
      if (empty(rec[col]))
        errs.push(
          `prediction #${idx} (${pid}): ${col} is NULL/empty — `
          + `locale-fanout did not write this column `
          + `(check sibling locale news file + ingest _update_prediction_locale_cols)`);
    for (const col of TARGET_PREDICTION_COLS)
      if (empty(rec[col]))
        errs.push(
          `prediction #${idx} (${pid}): ${col} is NULL — timewindow `
          + `parser couldn't extract from reasoning_landing=`
          + `${pyReprClip(rec.reasoning_landing, 80)} `
          + `(check app/src/timewindow.py patterns)`);
  }
  return errs;
}

function checkNeedsForDate(
  db: Database.Database, date: string, nonEn: readonly string[],
): string[] {
  const NEED_LOCALE_COLS = localeCols(NEED_COLS, nonEn);
  const TASK_LOCALE_REQUIRED = localeCols(TASK_REQUIRED_5W1H, nonEn);
  const predIds = (db.prepare(
    'SELECT prediction_id FROM predictions WHERE prediction_date = ?')
    .all(date) as any[]).map(r => r.prediction_id);
  const errs: string[] = [];
  if (!predIds.length) {
    errs.push(`no predictions for ${date}, can't check needs`);
    return errs;
  }
  const placeholders = predIds.map(() => '?').join(',');
  // Column list assembled as an array so an empty locale set (EN-only)
  // never leaves a dangling comma in the SQL.
  const selectCols = [
    'n.prediction_id', 'n.need_id',
    'n.actor', 'n.job', 'n.outcome', 'n.motivation',
    'n.target_start_date AS need_target_start',
    'n.target_end_date AS need_target_end',
    ...NEED_LOCALE_COLS.map(c => `n.${c}`),
    't.task_id',
    ...TASK_REQUIRED_5W1H.map(c => `t.${c}`),
    't.how_text',
    ...TASK_LOCALE_REQUIRED.map(c => `t.${c}`),
    't.target_start_date AS task_target_start',
    't.target_end_date AS task_target_end',
    't.status',
  ].join(', ');
  const rows = db.prepare(
    `SELECT ${selectCols}
     FROM prediction_needs n
     LEFT JOIN needs_tasks t ON t.need_id = n.need_id
     WHERE n.prediction_id IN (${placeholders})
     ORDER BY n.prediction_id, n.actor`).all(...predIds) as any[];
  if (!rows.length) {
    errs.push(
      `no prediction_needs rows for predictions on ${date} — `
      + `extract-needs was not called or returned empty`);
    return errs;
  }
  const seenPids = new Set<string>();
  for (const rec of rows) {
    seenPids.add(rec.prediction_id);
    const nid = rec.need_id;
    const actorTag = rec.actor ? `'${String(rec.actor).slice(0, 40)}'` : "'?'";
    for (const col of NEED_COLS)
      if (empty(rec[col]))
        errs.push(`need ${nid} (${actorTag}): ${col} is NULL/empty — extract-needs JSON spec requires this`);
    for (const col of NEED_LOCALE_COLS)
      if (empty(rec[col]))
        errs.push(`need ${nid} (${actorTag}): ${col} is NULL/empty — extract-needs locale fan-out missing`);
    if (rec.task_id === null || rec.task_id === undefined) {
      errs.push(`need ${nid} (${actorTag}): no needs_tasks row — extract-needs must always emit a task per need`);
      continue;
    }
    for (const col of TASK_REQUIRED_5W1H)
      if (empty(rec[col]))
        errs.push(
          `task ${rec.task_id} (${actorTag}): 5W1H ${col} is NULL/empty — `
          + `extract-needs must emit all of who/what/where/when/why (how is the only nullable cell)`);
    for (const col of TASK_LOCALE_REQUIRED)
      if (empty(rec[col]))
        errs.push(`task ${rec.task_id} (${actorTag}): locale ${col} is NULL/empty`);
    const whenText = rec.when_text ?? '';
    const [parseStart, parseEnd] = parseTimeWindow(whenText);
    if (parseStart && parseEnd) {
      const pairs: Array<[string, string]> = [
        ['task_target_start', parseStart], ['task_target_end', parseEnd],
        ['need_target_start', parseStart], ['need_target_end', parseEnd],
      ];
      for (const [col, want] of pairs) {
        if (empty(rec[col])) {
          const where = col.startsWith('task_') ? 'needs_tasks' : 'prediction_needs';
          errs.push(
            `task ${rec.task_id} (${actorTag}): ${where}.${col.slice(5)} `
            + `is NULL but when_text=${pyReprClip(whenText, 60)} parses to ${want} — `
            + `commit_need must call timewindow.parse_time_window `
            + `(check app/skills/extract_needs.py)`);
        }
      }
    }
  }
  for (const pid of predIds.filter(p => !seenPids.has(p)).sort())
    errs.push(`prediction ${pid}: zero prediction_needs rows attached`);
  return errs;
}

function checkValidationRowsForDate(
  db: Database.Database, date: string, nonEn: readonly string[],
): string[] {
  const selectCols = [
    'validation_row_id', 'prediction_id', 'support_dimension',
    'bridge_text', ...nonEn.map(l => `bridge_text_${l}`),
  ].join(', ');
  const rows = db.prepare(
    `SELECT ${selectCols}
     FROM validation_rows WHERE validation_date = ? ORDER BY validation_row_id`)
    .all(date) as any[];
  const errs: string[] = [];
  if (!rows.length) {
    errs.push(
      `no validation_rows for validation_date='${date}' — `
      + `check 2_future_prediction Step 4 + ingest`);
    return errs;
  }
  for (const rec of rows) {
    const vrid = rec.validation_row_id;
    if (empty(rec.bridge_text))
      errs.push(`validation_row ${vrid}: bridge_text is NULL/empty — writer's ## Bridge paragraph not parsed`);
    for (const l of nonEn)
      if (empty(rec[`bridge_text_${l}`]))
        errs.push(
          `validation_row ${vrid}: bridge_text_${l} is NULL/empty — `
          + `locale-fanout did not write this column (check sibling locale FP file)`);
    const sd = rec.support_dimension;
    if (sd === null || sd === undefined || !VR_DIM_VALID.includes(sd))
      errs.push(
        `validation_row ${vrid}: support_dimension=${sd === null ? 'None' : `'${sd}'`} not in `
        + `('because', 'given', 'so_that', 'landing', 'none') — bridge body missing the dimension keyword`);
  }
  return errs;
}

function loadPredictionNodes(exportsDir: string): Map<string, [string, any]> {
  const out = new Map<string, [string, any]>();
  if (!existsSync(exportsDir)) return out;
  for (const name of readdirSync(exportsDir).filter(f => /^graph-.*\.json$/.test(f)).sort()) {
    let d: any;
    try {
      d = JSON.parse(readFileSync(join(exportsDir, name), 'utf8'));
    } catch { continue; }
    for (const node of d.nodes ?? []) {
      const nid = node.id ?? '';
      if (nid.startsWith('prediction.') && !out.has(nid)) out.set(nid, [name, node]);
    }
  }
  return out;
}

function checkJsonExportsForDate(
  exportsDir: string, db: Database.Database, date: string,
  allLocales: readonly string[],
): string[] {
  const errs: string[] = [];
  const predIds = (db.prepare(
    'SELECT prediction_id FROM predictions WHERE prediction_date = ?')
    .all(date) as any[]).map(r => r.prediction_id);
  if (!predIds.length) {
    errs.push(`no predictions for ${date}, can't check exports`);
    return errs;
  }
  if (!existsSync(exportsDir)) {
    errs.push(`exports dir missing: ${exportsDir}`);
    return errs;
  }
  const index = loadPredictionNodes(exportsDir);
  if (index.size === 0) {
    errs.push(
      `no prediction nodes found across ${EXPORTS_REL}/graph-*.json — `
      + 'run the update-pages export first');
    return errs;
  }
  for (const pid of predIds) {
    const hit = index.get(pid);
    if (hit === undefined) {
      errs.push(`export missing: prediction ${pid} not in any ${EXPORTS_REL}/graph-*.json`);
      continue;
    }
    const [srcName, node] = hit;
    const tag = `${srcName} / ${pid}`;
    const titleBag = (node.labels ?? {}).title;
    if (typeof titleBag !== 'object' || titleBag === null || Array.isArray(titleBag)) {
      errs.push(`${tag}: labels.title is not a dict`);
    } else {
      for (const l of allLocales)
        if (!titleBag[l]) errs.push(`${tag}: labels.title.${l} is missing/empty`);
    }
    const det = node.detail ?? {};
    const tl = det.title_locales;
    if (typeof tl !== 'object' || tl === null || Array.isArray(tl)) {
      errs.push(`${tag}: detail.title_locales missing or not dict`);
    } else {
      for (const l of allLocales)
        if (!tl[l]) errs.push(`${tag}: detail.title_locales.${l} empty`);
    }
    const rl = det.reasoning_locales;
    if (typeof rl !== 'object' || rl === null || Array.isArray(rl)) {
      errs.push(`${tag}: detail.reasoning_locales missing or not dict`);
    } else {
      for (const key of ['because', 'given', 'so_that', 'landing', 'plain_language']) {
        const bag = rl[key];
        if (typeof bag !== 'object' || bag === null || Array.isArray(bag)) {
          errs.push(`${tag}: detail.reasoning_locales.${key} missing/not dict`);
          continue;
        }
        for (const l of allLocales)
          if (!bag[l]) errs.push(`${tag}: detail.reasoning_locales.${key}.${l} empty`);
      }
    }
    (det.bridges ?? []).forEach((b: any, i: number) => {
      const bl = b.text_locales;
      if (typeof bl !== 'object' || bl === null || Array.isArray(bl)) {
        errs.push(`${tag}: detail.bridges[${i}].text_locales missing`);
        return;
      }
      for (const l of allLocales)
        if (!bl[l]) errs.push(`${tag}: detail.bridges[${i}].text_locales.${l} empty`);
    });
    (det.needs ?? []).forEach((n: any, i: number) => {
      for (const key of ['actor_locales', 'job_locales', 'outcome_locales', 'motivation_locales']) {
        const bag = n[key];
        if (typeof bag !== 'object' || bag === null || Array.isArray(bag)) {
          errs.push(`${tag}: detail.needs[${i}].${key} missing`);
          continue;
        }
        for (const l of allLocales)
          if (!bag[l]) errs.push(`${tag}: detail.needs[${i}].${key}.${l} empty`);
      }
      const t = n.task;
      if (typeof t !== 'object' || t === null || Array.isArray(t)) {
        errs.push(`${tag}: detail.needs[${i}].task missing`);
        return;
      }
      for (const cell of ['who', 'what', 'where', 'when', 'why']) {
        const bag = t[`${cell}_locales`];
        if (typeof bag !== 'object' || bag === null || Array.isArray(bag)) {
          errs.push(`${tag}: detail.needs[${i}].task.${cell}_locales missing`);
          continue;
        }
        for (const l of allLocales)
          if (!bag[l]) errs.push(`${tag}: detail.needs[${i}].task.${cell}_locales.${l} empty`);
      }
    });
  }
  return errs;
}

function checkLocaleFilesExist(
  base: string, kind: string, date: string, allLocales: readonly string[],
): string[] {
  const errs: string[] = [];
  const stem = kind === 'news'
    ? `news-${date.replaceAll('-', '')}`
    : `future-prediction-${date.replaceAll('-', '')}`;
  const sub = kind === 'news' ? DAILY_NEWS_REL : FP_REL;
  for (const l of allLocales) {
    const p = join(base, sub, l, `${stem}.md`);
    if (!existsSync(p)) errs.push(`missing: ${p}`);
    else if (statSync(p).size === 0) errs.push(`empty: ${p}`);
  }
  return errs;
}

export interface GateResult { exit: number; lines: string[]; stderr?: string }

export type PuvCheck = 'news' | 'future-prediction' | 'exports' | 'all';

export function postUpdateValidation(args: {
  check: PuvCheck; date: string; db: string; exportsDir: string; repoRoot: string;
  /** Effective non-EN set; explicit parameter (not ambient config)
   * because the gate also runs from tests/freeze without a RunCtx. */
  locales?: readonly string[];
}): GateResult {
  if (!existsSync(args.db))
    return { exit: 2, lines: [], stderr: `FAIL: DB not found: ${args.db}\n` };
  const nonEn = args.locales ?? NON_EN_LOCALES;
  const allLocales = ['en', ...nonEn];
  const lines: string[] = [];
  const runCheck = (name: string, errs: string[]): boolean => {
    if (errs.length) {
      lines.push(`FAIL ${name}: ${errs.length} issue(s)`);
      for (const e of errs) lines.push(`  - ${e}`);
      return false;
    }
    lines.push(`OK ${name}`);
    return true;
  };
  const db = new Database(args.db, { readonly: true });
  let allPass = true;
  try {
    if (args.check === 'news' || args.check === 'all') {
      allPass = runCheck(`locale files (news, ${args.date})`,
        checkLocaleFilesExist(args.repoRoot, 'news', args.date, allLocales)) && allPass;
      allPass = runCheck(`predictions schema (${args.date})`,
        checkPredictionsForDate(db, args.date, nonEn)) && allPass;
      allPass = runCheck(`needs + 5W1H (${args.date})`,
        checkNeedsForDate(db, args.date, nonEn)) && allPass;
    }
    if (args.check === 'future-prediction' || args.check === 'all') {
      allPass = runCheck(`locale files (future-prediction, ${args.date})`,
        checkLocaleFilesExist(args.repoRoot, 'future-prediction', args.date, allLocales)) && allPass;
      allPass = runCheck(`validation_rows schema (${args.date})`,
        checkValidationRowsForDate(db, args.date, nonEn)) && allPass;
    }
    if (args.check === 'exports' || args.check === 'all') {
      allPass = runCheck(`JSON exports (${args.date})`,
        checkJsonExportsForDate(args.exportsDir, db, args.date, allLocales)) && allPass;
    }
  } finally {
    db.close();
  }
  return { exit: allPass ? 0 : 1, lines };
}
