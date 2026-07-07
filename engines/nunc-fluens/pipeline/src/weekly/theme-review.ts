// 5_weekly_theme_review live path — the deterministic halves: the
// 3-time-state snapshot (rollback target + reader-facing time series)
// and the §2.1 pain-point analysis handed to the proposal-composing
// LLM step. C8: the rollback target carries taxonomy.json (the live
// themes/categories/theme_candidates rows) alongside the seed
// schema.sql copy the Sunday flow-check gate expects.
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../ingest/ingest-core.ts';
import { schemaPath } from '../db/db.ts';
import { docsDataDir, MEMORY_DIR } from '../world-paths.ts';
import { dumpTaxonomy } from './apply-schema-edit.ts';

const GRAPHS = ['graph-tech.json', 'graph-business.json', 'graph-mix.json'];
const SNAP_RETENTION = 5;

export function preReviewDir(newsRepo: string, stem: string): string {
  return join(newsRepo, MEMORY_DIR, 'snapshots', `${stem}-pre-review`);
}

/** Step 2: write memory/snapshots/<stem>-pre-review/ (rollback target:
 * graphs + manifest + seed schema.sql + taxonomy.json) and
 * docs/data/snapshots/<stem>/ (reader-facing: graphs + manifest).
 * Retention mirrors upstream archive_snapshots.py: keep the 5 most
 * recent under docs/data/snapshots (the Pages artifact tars ./docs and
 * ~70MB per week broke the deploy past ~100MB); older ones MOVE to the
 * gitignored docs/archives/snapshots/, never deleted. index.json is
 * regenerated with its `default` field preserved.
 * Returns the repo-relative paths to commit. */
export function snapshotThreeTimeState(db: Db, newsRepo: string, date: string): string[] {
  const stem = date.replaceAll('-', '');
  const dataDir = docsDataDir(newsRepo);
  const pre = preReviewDir(newsRepo, stem);
  const reader = join(dataDir, 'snapshots', stem);
  mkdirSync(pre, { recursive: true });
  mkdirSync(reader, { recursive: true });
  for (const f of [...GRAPHS, 'manifest.json']) {
    const src = join(dataDir, f);
    if (!existsSync(src))
      throw new Error(`snapshot-3-time-state: ${src} missing — has update-pages run today?`);
    copyFileSync(src, join(pre, f));
    copyFileSync(src, join(reader, f));
  }
  copyFileSync(schemaPath(), join(pre, 'schema.sql'));
  writeFileSync(join(pre, 'taxonomy.json'),
    JSON.stringify(dumpTaxonomy(db), null, 2) + '\n', 'utf8');

  const snapRoot = join(dataDir, 'snapshots');
  const stems = readdirSync(snapRoot)
    .filter(f => /^\d{8}$/.test(f))
    .sort();
  const keep = stems.slice(-SNAP_RETENTION);
  const archiveRoot = join(newsRepo, 'docs', 'archives', 'snapshots');
  for (const s of stems) {
    if (keep.includes(s)) continue;
    mkdirSync(archiveRoot, { recursive: true });
    renameSync(join(snapRoot, s), join(archiveRoot, s));
  }
  const indexPath = join(snapRoot, 'index.json');
  let indexDefault = 'live';
  if (existsSync(indexPath)) {
    try {
      indexDefault = JSON.parse(readFileSync(indexPath, 'utf8')).default ?? 'live';
    } catch { /* regenerate from scratch */ }
  }
  writeFileSync(indexPath,
    JSON.stringify({ snapshots: keep, default: indexDefault }, null, 2) + '\n', 'utf8');

  return [
    join(MEMORY_DIR, 'snapshots', `${stem}-pre-review`),
    'docs/data/snapshots',
  ];
}

// --- §2.1 pain-point analysis ------------------------------------------------

export interface ThemeStat {
  theme_id: string;
  label: string;
  category_id: string;
  children: number;
}

export interface ScopeAnalysis {
  scope: string;
  totalPredictions: number;
  themes: ThemeStat[];
  underused: ThemeStat[];       // child count ∈ {0, 1}
  overpopulated: ThemeStat[];   // child count ≥ 6
  categoryDensity: Array<{ category_id: string; count: number; share: number }>;
  dominant: string[];           // categories at ≥ 50 %
}

export function analyzeScope(graphPath: string): ScopeAnalysis {
  const g = JSON.parse(readFileSync(graphPath, 'utf8'));
  const nodes: any[] = g.nodes ?? [];
  const themes: ThemeStat[] = nodes
    .filter(n => n.type === 'theme')
    .map(n => ({
      theme_id: n.theme_id, label: n.label, category_id: n.category_id,
      children: (n.child_ids ?? []).length,
    }));
  const preds = nodes.filter(n => n.type === 'prediction');
  const byCat = new Map<string, number>();
  for (const p of preds)
    if (p.category_id)
      byCat.set(p.category_id, (byCat.get(p.category_id) ?? 0) + 1);
  const categoryDensity = [...byCat.entries()]
    .map(([category_id, count]) => ({
      category_id, count,
      share: preds.length ? count / preds.length : 0,
    }))
    .sort((a, b) => b.share - a.share);
  return {
    scope: String(g.scope_id ?? g.scope_label ?? ''),
    totalPredictions: preds.length,
    themes: themes.sort((a, b) => b.children - a.children),
    underused: themes.filter(t => t.children <= 1),
    overpopulated: themes.filter(t => t.children >= 6),
    categoryDensity,
    dominant: categoryDensity.filter(c => c.share >= 0.5).map(c => c.category_id),
  };
}

export interface PainPoints {
  scopes: ScopeAnalysis[];
  pendingCandidates: Array<{
    candidate_id: string; scope_id: string; suggested_theme_label: string;
    candidate_reason: string | null; nearest_theme_id: string | null;
  }>;
  /** §6.1: active terms that keep tripping warnings — a writer-prompt signal. */
  glossaryRepeatWarnings: Array<{ term: string; warns: number }>;
  taxonomy: Array<{ theme_id: string; category_id: string; label: string; description: string | null }>;
}

export function collectPainPoints(db: Db, newsRepo: string): PainPoints {
  const dataDir = docsDataDir(newsRepo);
  const scopes = GRAPHS
    .map(f => join(dataDir, f))
    .filter(p => existsSync(p))
    .map(analyzeScope);
  const pendingCandidates = db.prepare(
    `SELECT candidate_id, scope_id, suggested_theme_label, candidate_reason,
            nearest_theme_id
       FROM theme_candidates WHERE status = 'pending'
      ORDER BY created_at`,
  ).all() as PainPoints['pendingCandidates'];
  // Post-C P7: glossary_audit warn rows older than 30d are pruned by
  // pruneGlossaryAudit (daily glossary-validate step), so this count is
  // effectively a rolling ~30d window, not all-time — accepted in P7 as
  // aligned with the "recent pain" intent of this input.
  const glossaryRepeatWarnings = db.prepare(
    `SELECT a.term, COUNT(*) AS warns
       FROM glossary_audit a
       JOIN glossary_terms t ON t.term = a.term AND t.status = 'active'
      WHERE a.verdict = 'warn'
      GROUP BY a.term HAVING COUNT(*) >= 2
      ORDER BY warns DESC`,
  ).all() as PainPoints['glossaryRepeatWarnings'];
  const taxonomy = db.prepare(
    `SELECT theme_id, category_id, canonical_label AS label, description
       FROM themes WHERE status = 'active' ORDER BY theme_id`,
  ).all() as PainPoints['taxonomy'];
  return { scopes, pendingCandidates, glossaryRepeatWarnings, taxonomy };
}
