// apply-schema-edit against DB rows (Phase C decision C8): the taxonomy
// lives in analytics.sqlite's themes/categories/theme_candidates tables
// — the persistent store — so the weekly edit targets rows, not
// app/src/schema.sql text (which is now monorepo code and only the
// first-boot seed). Proposal parsing is the TS port of
// app/skills/apply_schema_edit.py parse_proposal/_classify, with one
// recorded bug fix: the oracle only recognized `1.`-numbered
// recommendations, but proposals moved to `### Action N:` headings —
// which made the upstream auto-apply a silent no-op for six straight
// Sundays (documented inside theme-review-20260705.md itself). This
// parser accepts both forms.
//
// Supported operations (the vocabulary real proposals use, per
// memory-policy §2.1): rewrite-description, add, promote-candidate,
// log-only. rename/merge/split are skip-and-log — they need their own
// design pass in the persistent-store architecture (attachments are no
// longer rebuilt from scratch each run).
import type { Db } from '../ingest/ingest-core.ts';

export interface Operation {
  kind: 'add' | 'rewrite-description' | 'rename' | 'merge' | 'split'
  | 'promote-candidate' | 'log-only';
  rawLine: string;
  args: Record<string, unknown>;
  block: Record<string, unknown> | null;
  note: string;
}

export interface ApplyResult {
  applied: Array<{ op: Operation; detail: string }>;
  skipped: Array<{ op: Operation; reason: string }>;
  failures: string[];
}

// --- proposal parsing -------------------------------------------------------

const RE_ADD = /\bAdd\s+`?([\w.\-]+)`?\s+theme\s+under\s+`?([\w.\-]+)`?/i;
const RE_ADD_NEW = /\bAdd\s+new\s+theme\s+`?([\w.\-]+)`?/i;
const RE_RENAME = /\bRename\s+`?([\w.\-]+)`?\s*[→>-]+\s*`?([\w.\-]+)`?/i;
const RE_MERGE = /\bMerge\s+`?([\w.\-]+)`?\s+into\s+`?([\w.\-]+)`?/i;
const RE_SPLIT = /\bSplit\s+`?([\w.\-]+)`?/i;
const RE_PROMOTE = /\bPromote\s+candidate\s+`?([\w.\-]+)`?/i;
const RE_TIGHTEN = /\b(?:Tighten|Rewrite)\s+description/i;
const RE_LOG_ONLY = /\b(Investigate|Investigation|No\s+splits|out of scope|no schema edit)\b/i;

function extractActionJson(itemText: string): Record<string, unknown> | null {
  const m = /```(?:action|json)\s*\n([\s\S]*?)\n[ \t]*```/.exec(itemText);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1].trim());
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

function classify(line: string): Operation {
  const base = { rawLine: line, block: null, note: '' };
  let m: RegExpExecArray | null;
  if ((m = RE_ADD.exec(line)))
    return { ...base, kind: 'add', args: { theme_id: m[1], category_id: m[2] } };
  if ((m = RE_ADD_NEW.exec(line)))
    return { ...base, kind: 'add', args: { theme_id: m[1] } };
  if ((m = RE_RENAME.exec(line)))
    return { ...base, kind: 'rename', args: { old_id: m[1], new_id: m[2] } };
  if ((m = RE_MERGE.exec(line)))
    return { ...base, kind: 'merge', args: { absorbed_id: m[1], survivor_id: m[2] } };
  if ((m = RE_SPLIT.exec(line)))
    return { ...base, kind: 'split', args: { theme_id: m[1] } };
  if ((m = RE_PROMOTE.exec(line)))
    return { ...base, kind: 'promote-candidate', args: { candidate_id: m[1] } };
  if (RE_TIGHTEN.test(line)) {
    const ids = [...line.matchAll(/`([\w.\-]+)`/g)].map(x => x[1]);
    const args: Record<string, unknown> = { theme_ids: ids };
    if (ids.length) args.theme_id = ids[0];
    return { ...base, kind: 'rewrite-description', args };
  }
  if (RE_LOG_ONLY.test(line))
    return { ...base, kind: 'log-only', args: {}, note: 'advisory; no schema edit' };
  return { ...base, kind: 'log-only', args: {}, note: 'unrecognized recommendation; skipping' };
}

const OP_KINDS = new Set(['add', 'rewrite-description', 'rename', 'merge',
  'split', 'promote-candidate', 'log-only']);
const ID_KEYS = ['theme_id', 'category_id', 'old_id', 'new_id',
  'absorbed_id', 'survivor_id', 'candidate_id'] as const;

export function parseProposal(text: string): Operation[] {
  const section = /^##\s+Recommended actions\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(text);
  if (!section)
    throw new Error('no `## Recommended actions` section found');
  const body = section[1];
  // Numbered-list form (the format the oracle parsed) …
  let items = [...body.matchAll(/^\s*\d+\.\s+([\s\S]+?)(?=^\s*\d+\.\s+|(?![\s\S]))/gm)]
    .map(m => m[1]);
  // … or the `### Action N:` heading form real proposals moved to.
  if (!items.length)
    items = [...body.matchAll(/^###\s+Action\s+\d+[:.]?\s*([\s\S]+?)(?=^###\s+Action\s+\d+|(?![\s\S]))/gm)]
      .map(m => m[1]);
  const ops: Operation[] = [];
  for (const raw of items) {
    const flat = raw.split('\n').map(l => l.trim()).join(' ').trim();
    const block = extractActionJson(raw);
    const op = classify(flat);
    if (block) {
      op.block = block;
      const jk = block.kind;
      if (typeof jk === 'string' && OP_KINDS.has(jk)) {
        op.kind = jk as Operation['kind'];
        for (const k of ID_KEYS)
          if (k in block && !(k in op.args)) op.args[k] = block[k];
      }
    }
    ops.push(op);
  }
  return ops;
}

export function planLines(ops: Operation[]): string[] {
  if (!ops.length) return ['(no operations)'];
  return ops.map((op, i) => {
    if (op.kind === 'log-only')
      return `${i + 1}. [log-only] ${op.note}: ${op.rawLine.slice(0, 80)}`;
    const args = Object.entries(op.args)
      .filter(([k]) => k !== 'json_block')
      .map(([k, v]) => `${k}=${v}`).join(' ');
    return `${i + 1}. [${op.kind}] ${args}${op.block ? ' (+JSON action block)' : ''}`;
  });
}

// --- taxonomy snapshot / restore --------------------------------------------

const TAXONOMY_TABLES = ['categories', 'themes', 'subthemes', 'theme_candidates'] as const;
const TABLE_PK: Record<string, string> = {
  categories: 'category_id', themes: 'theme_id',
  subthemes: 'subtheme_id', theme_candidates: 'candidate_id',
};

export interface TaxonomySnapshot {
  version: 1;
  tables: Record<string, Array<Record<string, unknown>>>;
}

export function dumpTaxonomy(db: Db): TaxonomySnapshot {
  const tables: TaxonomySnapshot['tables'] = {};
  for (const t of TAXONOMY_TABLES)
    tables[t] = db.prepare(`SELECT * FROM ${t} ORDER BY ${TABLE_PK[t]}`)
      .all() as Array<Record<string, unknown>>;
  return { version: 1, tables };
}

/** Restore the taxonomy tables to a snapshot: update-or-insert every
 * snapshotted row, then delete rows added since (children first). Safe
 * immediately after a failed apply — a just-added theme cannot have
 * attachments yet (the matcher only runs at ingest/score time). */
export function restoreTaxonomy(db: Db, snap: TaxonomySnapshot): void {
  const run = db.transaction(() => {
    for (const t of TAXONOMY_TABLES) {
      const pk = TABLE_PK[t];
      const rows = snap.tables[t] ?? [];
      for (const row of rows) {
        const cols = Object.keys(row);
        const exists = db.prepare(`SELECT 1 FROM ${t} WHERE ${pk} = ?`).get(row[pk]);
        if (exists) {
          const sets = cols.filter(c => c !== pk).map(c => `${c} = @${c}`).join(', ');
          db.prepare(`UPDATE ${t} SET ${sets} WHERE ${pk} = @${pk}`).run(row);
        } else {
          db.prepare(`INSERT INTO ${t} (${cols.join(', ')})
                      VALUES (${cols.map(c => `@${c}`).join(', ')})`).run(row);
        }
      }
    }
    const keep = (t: string) =>
      new Set((snap.tables[t] ?? []).map(r => String(r[TABLE_PK[t]])));
    for (const t of [...TAXONOMY_TABLES].reverse()) {
      const pk = TABLE_PK[t];
      const keepSet = keep(t);
      const current = db.prepare(`SELECT ${pk} AS pk FROM ${t}`).all() as Array<{ pk: string }>;
      for (const { pk: id } of current)
        if (!keepSet.has(String(id)))
          db.prepare(`DELETE FROM ${t} WHERE ${pk} = ?`).run(id);
    }
  });
  run();
}

// --- apply ------------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function insertTheme(db: Db, block: Record<string, unknown>, today: string): string | null {
  const themeId = str(block.theme_id);
  const categoryId = str(block.category_id);
  const labelEn = str(block.label_en);
  const shortEn = str(block.short_label_en);
  const descEn = str(block.description_en);
  if (!themeId || !categoryId || !labelEn || !shortEn || !descEn)
    return 'add requires theme_id, category_id, label_en, short_label_en, description_en';
  const cat = db.prepare(
    'SELECT scope_id FROM categories WHERE category_id = ?').get(categoryId) as
    { scope_id: string } | undefined;
  if (!cat)
    return `category '${categoryId}' does not exist (new categories need their own design discussion per §2.3)`;
  if (db.prepare('SELECT 1 FROM themes WHERE theme_id = ?').get(themeId))
    return `theme '${themeId}' already exists (idempotent skip)`;
  db.prepare(
    `INSERT INTO themes (theme_id, scope_id, category_id, canonical_label,
       short_label, generated_label, description,
       label_ja, label_es, label_fil,
       short_label_ja, short_label_es, short_label_fil,
       description_ja, description_es, description_fil,
       status, first_seen_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(
    themeId, cat.scope_id, categoryId, labelEn, shortEn,
    str(block.tooltip_en) ?? labelEn, descEn,
    str(block.label_ja), str(block.label_es), str(block.label_fil),
    str(block.short_label_ja), str(block.short_label_es), str(block.short_label_fil),
    str(block.description_ja), str(block.description_es), str(block.description_fil),
    today, today,
  );
  return null;
}

function applyOne(db: Db, op: Operation, today: string): { ok: boolean; detail: string } {
  const block = op.block ?? {};
  switch (op.kind) {
    case 'rewrite-description': {
      const themeId = str(block.theme_id) ?? str(op.args.theme_id as string);
      const descEn = str(block.new_description_en);
      if (!themeId) return { ok: false, detail: 'rewrite-description without a theme_id' };
      if (!descEn) return { ok: false, detail: 'rewrite-description without new_description_en (action block required)' };
      if (!db.prepare('SELECT 1 FROM themes WHERE theme_id = ?').get(themeId))
        return { ok: false, detail: `theme '${themeId}' not present in the DB` };
      db.prepare(
        `UPDATE themes SET description = ?,
           description_ja = COALESCE(?, description_ja),
           description_es = COALESCE(?, description_es),
           description_fil = COALESCE(?, description_fil),
           updated_at = ?
         WHERE theme_id = ?`,
      ).run(descEn, str(block.new_description_ja), str(block.new_description_es),
        str(block.new_description_fil), today, themeId);
      return { ok: true, detail: `description rewritten for ${themeId}` };
    }
    case 'add': {
      const err = insertTheme(db, block, today);
      return err ? { ok: false, detail: err }
        : { ok: true, detail: `theme ${block.theme_id} added under ${block.category_id}` };
    }
    case 'promote-candidate': {
      const candidateId = str(block.candidate_id) ?? str(op.args.candidate_id as string);
      if (!candidateId) return { ok: false, detail: 'promote-candidate without a candidate_id' };
      const cand = db.prepare(
        'SELECT status FROM theme_candidates WHERE candidate_id = ?').get(candidateId) as
        { status: string } | undefined;
      if (!cand) return { ok: false, detail: `candidate '${candidateId}' not found` };
      if (cand.status === 'promoted')
        return { ok: false, detail: `candidate '${candidateId}' already promoted (idempotent skip)` };
      const err = insertTheme(db, block, today);
      if (err) return { ok: false, detail: err };
      db.prepare(
        `UPDATE theme_candidates SET status='promoted', promoted_theme_id=?, updated_at=?
         WHERE candidate_id = ?`,
      ).run(str(block.theme_id), today, candidateId);
      return { ok: true, detail: `candidate ${candidateId} promoted to ${block.theme_id}` };
    }
    case 'log-only':
      return { ok: true, detail: `log-only: ${op.rawLine.slice(0, 80)}` };
    default:
      return {
        ok: false,
        detail: `${op.kind} is not supported against the persistent DB (C8) — `
          + 'needs its own design pass; skipped',
      };
  }
}

/** Apply the proposal's operations to the DB rows. Per-op mapping
 * problems skip that one op and continue (the oracle's rule); SQL-level
 * failures abort and the caller restores from the taxonomy snapshot. */
export function applyOps(db: Db, ops: Operation[], today: string): ApplyResult {
  const result: ApplyResult = { applied: [], skipped: [], failures: [] };
  for (const op of ops) {
    if (op.kind === 'log-only') {
      result.skipped.push({ op, reason: op.note || 'log-only' });
      continue;
    }
    try {
      const r = applyOne(db, op, today);
      if (r.ok) result.applied.push({ op, detail: r.detail });
      else result.skipped.push({ op, reason: r.detail });
    } catch (e) {
      result.failures.push(
        `[${op.kind}] ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
  }
  return result;
}

/** Post-apply validation (the oracle's step 3 checks, DB flavor). */
export function validateTaxonomy(db: Db): string[] {
  const errs: string[] = [];
  const fk = db.pragma('foreign_key_check') as unknown[];
  if (fk.length) errs.push(`foreign_key_check: ${fk.length} violation(s)`);
  const orphans = db.prepare(
    `SELECT COUNT(*) AS n FROM themes t
      WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.category_id = t.category_id)`,
  ).get() as { n: number };
  if (orphans.n) errs.push(`${orphans.n} theme(s) reference a missing category`);
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') errs.push(`integrity_check: ${integrity}`);
  return errs;
}
