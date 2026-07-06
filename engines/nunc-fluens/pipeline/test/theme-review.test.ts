// 5_weekly_theme_review live-path logic: proposal parsing (including
// the `### Action N:` heading form whose absence made the upstream
// auto-apply a silent no-op for six Sundays — the real 07-05 proposal
// documents it), C8 DB-row application with snapshot/rollback, and the
// 3-time-state snapshot with retention.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INPUT } from './helpers/build-db.ts';
import { schemaPath } from '../src/db/db.ts';
import {
  applyOps, dumpTaxonomy, parseProposal, planLines, restoreTaxonomy,
  validateTaxonomy,
} from '../src/weekly/apply-schema-edit.ts';
import {
  analyzeScope, collectPainPoints, snapshotThreeTimeState,
} from '../src/weekly/theme-review.ts';

const TODAY = '2026-07-06';
const REAL_PROPOSAL = readFileSync(
  join(INPUT, 'memory', 'theme-review', 'theme-review-20260705.md'), 'utf8');

let db: Database.Database;
beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(schemaPath(), 'utf8'));
});
afterEach(() => db.close());

describe('proposal parsing', () => {
  it('parses the real 07-05 proposal (### Action form): 2 rewrites + 2 log-only', () => {
    const ops = parseProposal(REAL_PROPOSAL);
    expect(ops.map(o => o.kind)).toEqual(
      ['rewrite-description', 'rewrite-description', 'log-only', 'log-only']);
    expect(ops[0].block?.theme_id).toBe('business.ai_revenue_disclosure');
    expect(ops[1].block?.theme_id).toBe('business.cloud_vs_local_distribution');
    // The oracle's numbered-only parser returned [] here — the silent
    // no-op the proposal itself complains about. Guard the fix.
    expect(ops.length).toBeGreaterThan(0);
  });

  it('still parses the numbered-list form with prose classification', () => {
    const text = [
      '# Theme review — week ending 2026-07-06', '',
      '## Recommended actions', '',
      '1. Add `tech.new_theme` theme under `tech.models` — cluster emerged.',
      '', '   ```action',
      '   {"kind": "add", "theme_id": "tech.new_theme", "category_id": "tech.models"}',
      '   ```', '',
      '2. Investigate matcher behaviour on business scope.', '',
    ].join('\n');
    const ops = parseProposal(text);
    expect(ops.map(o => o.kind)).toEqual(['add', 'log-only']);
    expect(ops[0].args.theme_id).toBe('tech.new_theme');
  });

  it('rename/merge/split classify but are refused at apply time (C8)', () => {
    const text = [
      '## Recommended actions', '',
      '### Action 1: Rename `tech.old` → `tech.new`', 'Rename `tech.old` → `tech.new`.', '',
    ].join('\n');
    const ops = parseProposal(text);
    expect(ops[0].kind).toBe('rename');
    const r = applyOps(db, ops, TODAY);
    expect(r.applied).toEqual([]);
    expect(r.skipped[0].reason).toContain('C8');
  });

  it('throws on a missing Recommended actions section', () => {
    expect(() => parseProposal('# nothing here\n')).toThrow(/Recommended actions/);
  });
});

describe('C8 apply on DB rows', () => {
  it('applies the real 07-05 rewrite-description blocks to the seeded taxonomy', () => {
    const ops = parseProposal(REAL_PROPOSAL);
    const before = db.prepare(
      'SELECT description FROM themes WHERE theme_id = ?')
      .get('business.ai_revenue_disclosure') as any;
    expect(before.description).toContain('Big-3'); // the broad pre-sharpen anchors
    const r = applyOps(db, ops, TODAY);
    expect(r.failures).toEqual([]);
    expect(r.applied.length).toBe(2);
    const after = db.prepare(
      `SELECT description, description_ja, updated_at FROM themes WHERE theme_id = ?`)
      .get('business.ai_revenue_disclosure') as any;
    expect(after.description).toContain('disclosure-mechanic vocabulary');
    expect(after.description).not.toContain('Big-3');
    expect(after.description_ja).toContain('開示メカニクス');
    expect(after.updated_at).toBe(TODAY);
    expect(validateTaxonomy(db)).toEqual([]);
  });

  it('add: inserts under an existing category, scope inherited, idempotent', () => {
    const block = {
      kind: 'add', theme_id: 'tech.test_theme', category_id: 'tech.models',
      label_en: 'Test Theme', short_label_en: 'Test', tooltip_en: 'Test tooltip',
      description_en: 'keyword one, keyword two.',
      label_ja: 'テスト', short_label_ja: 'テスト',
      label_es: 'Prueba', short_label_es: 'Prueba',
      label_fil: 'Pagsubok', short_label_fil: 'Pagsubok',
    };
    const op = { kind: 'add' as const, rawLine: 'Add new theme `tech.test_theme`',
      args: {}, block, note: '' };
    const r1 = applyOps(db, [op], TODAY);
    expect(r1.applied.length).toBe(1);
    const row = db.prepare('SELECT * FROM themes WHERE theme_id = ?')
      .get('tech.test_theme') as any;
    expect(row.scope_id).toBe('tech');
    expect(row.status).toBe('active');
    expect(row.generated_label).toBe('Test tooltip');
    expect(row.label_ja).toBe('テスト');
    // Re-apply: idempotent skip.
    const r2 = applyOps(db, [op], TODAY);
    expect(r2.applied).toEqual([]);
    expect(r2.skipped[0].reason).toContain('already exists');
  });

  it('add: refuses a nonexistent category (§2.3)', () => {
    const op = { kind: 'add' as const, rawLine: '', args: {}, note: '',
      block: { kind: 'add', theme_id: 'tech.x', category_id: 'tech.does_not_exist',
        label_en: 'X', short_label_en: 'X', description_en: 'x.' } };
    const r = applyOps(db, [op], TODAY);
    expect(r.skipped[0].reason).toContain('does not exist');
  });

  it('promote-candidate: adds the theme and stamps the candidate row', () => {
    db.prepare(
      `INSERT INTO theme_candidates (candidate_id, scope_id, suggested_theme_label, status)
       VALUES ('cand-1', 'tech', 'Emerging Cluster', 'pending')`).run();
    const op = { kind: 'promote-candidate' as const, rawLine: 'Promote candidate `cand-1`',
      args: {}, note: '',
      block: { kind: 'promote-candidate', candidate_id: 'cand-1',
        theme_id: 'tech.emerging_cluster', category_id: 'tech.models',
        label_en: 'Emerging Cluster', short_label_en: 'Emerging',
        description_en: 'cluster keywords.' } };
    const r = applyOps(db, [op], TODAY);
    expect(r.applied.length).toBe(1);
    const cand = db.prepare(
      'SELECT status, promoted_theme_id FROM theme_candidates WHERE candidate_id = ?')
      .get('cand-1') as any;
    expect(cand).toMatchObject({ status: 'promoted', promoted_theme_id: 'tech.emerging_cluster' });
  });

  it('dump/restore round-trips after destructive edits', () => {
    const snap = dumpTaxonomy(db);
    // Mutate: rewrite one description + add a theme.
    db.prepare(`UPDATE themes SET description = 'clobbered' WHERE theme_id =
      (SELECT theme_id FROM themes LIMIT 1)`).run();
    db.prepare(
      `INSERT INTO themes (theme_id, scope_id, category_id, canonical_label, status)
       SELECT 'tech.added', scope_id, category_id, 'Added', 'active'
         FROM themes LIMIT 1`).run();
    restoreTaxonomy(db, snap);
    expect(dumpTaxonomy(db)).toEqual(snap);
    expect(db.prepare(`SELECT 1 FROM themes WHERE theme_id = 'tech.added'`).get())
      .toBeUndefined();
  });
});

describe('snapshots + pain points', () => {
  function fakeGraph(scope: string): unknown {
    return {
      scope_id: scope,
      nodes: [
        { type: 'theme', theme_id: `${scope}.big`, label: 'Big', category_id: `${scope}.cat_a`,
          child_ids: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
        { type: 'theme', theme_id: `${scope}.thin`, label: 'Thin', category_id: `${scope}.cat_b`,
          child_ids: ['p7'] },
        { type: 'prediction', prediction_id: 'p1', category_id: `${scope}.cat_a` },
        { type: 'prediction', prediction_id: 'p2', category_id: `${scope}.cat_a` },
        { type: 'prediction', prediction_id: 'p3', category_id: `${scope}.cat_b` },
      ],
    };
  }

  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'nf-theme-'));
    const dataDir = join(repo, 'docs', 'data');
    mkdirSync(join(dataDir, 'snapshots'), { recursive: true });
    for (const [f, scope] of [['graph-tech.json', 'tech'],
      ['graph-business.json', 'business'], ['graph-mix.json', 'mix']] as const)
      writeFileSync(join(dataDir, f), JSON.stringify(fakeGraph(scope)), 'utf8');
    writeFileSync(join(dataDir, 'manifest.json'),
      JSON.stringify({ locales: ['en', 'ja', 'es', 'fil'], default_locale: 'en' }), 'utf8');
    // Six historical reader-facing snapshots → retention must prune to 5.
    for (const s of ['20260524', '20260531', '20260607', '20260614', '20260621', '20260628'])
      mkdirSync(join(dataDir, 'snapshots', s), { recursive: true });
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('analyzeScope flags underused / overpopulated / dominance', () => {
    const a = analyzeScope(join(repo, 'docs', 'data', 'graph-tech.json'));
    expect(a.overpopulated.map(t => t.theme_id)).toEqual(['tech.big']);
    expect(a.underused.map(t => t.theme_id)).toEqual(['tech.thin']);
    expect(a.dominant).toEqual(['tech.cat_a']); // 2/3 ≈ 66.7 %
  });

  it('snapshotThreeTimeState writes both dirs, prunes to 5, regenerates index', () => {
    snapshotThreeTimeState(db, repo, '2026-07-05');
    const pre = join(repo, 'memory', 'snapshots', '20260705-pre-review');
    for (const f of ['graph-tech.json', 'graph-business.json', 'graph-mix.json',
      'manifest.json', 'schema.sql', 'taxonomy.json'])
      expect(existsSync(join(pre, f)), f).toBe(true);
    const idx = JSON.parse(readFileSync(
      join(repo, 'docs', 'data', 'snapshots', 'index.json'), 'utf8'));
    expect(idx).toEqual({
      snapshots: ['20260607', '20260614', '20260621', '20260628', '20260705'],
      default: 'live',
    });
    expect(existsSync(join(repo, 'docs', 'data', 'snapshots', '20260524'))).toBe(false);
    expect(existsSync(join(repo, 'docs', 'data', 'snapshots', '20260531'))).toBe(false);
  });

  it('collectPainPoints bundles scopes, candidates, and taxonomy', () => {
    db.prepare(
      `INSERT INTO theme_candidates (candidate_id, scope_id, suggested_theme_label, status)
       VALUES ('c1', 'tech', 'A Cluster', 'pending')`).run();
    const p = collectPainPoints(db, repo);
    expect(p.scopes.length).toBe(3);
    expect(p.pendingCandidates.map(c => c.candidate_id)).toEqual(['c1']);
    expect(p.taxonomy.length).toBeGreaterThan(10); // the seeded taxonomy
  });

  it('planLines renders a human-readable plan', () => {
    const ops = parseProposal(REAL_PROPOSAL);
    const lines = planLines(ops);
    expect(lines[0]).toContain('[rewrite-description]');
    expect(lines[0]).toContain('(+JSON action block)');
  });
});
