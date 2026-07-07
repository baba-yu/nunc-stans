// Post-C REDO V2 (R4): `nunc-fluens import` copies a news-shaped
// checkout's data into a fresh init-born instance — full old→v2
// mapping (incl. the docs/archives carry and references.txt), DB seed
// with backup, source left byte-untouched, exactly one commit — plus
// the non-virgin refusal. Old-shape knowledge lives only in
// src/import.ts.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync,
  statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import Database from 'better-sqlite3';
import { IMPORT_COMMIT_PREFIX, importNewsCheckout, looksNewsShaped } from '../src/import.ts';
import { initInstance } from '../src/instance.ts';
import { initDb } from '../src/db/db.ts';
import { publishAddable } from '../src/orchestrator/steps.ts';

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

function w(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

/** A tiny synthetic OLD-shape (news-era) checkout. Plain directory —
 * import never needs the source's git state. */
function makeNewsShapedSrc(opts: { withDb?: boolean } = {}): string {
  const src = mkdtempSync(join(tmpdir(), 'nf-import-src-'));
  w(join(src, 'report', 'en', 'news-20260101.md'), '# News Report 2026-01-01\n');
  w(join(src, 'report', 'ja', 'news-20260101.md'), '# ニュース 2026-01-01\n');
  w(join(src, 'future-prediction', 'en', 'future-prediction-20260101.md'), '# FP\n');
  w(join(src, 'memory', 'dormant', 'dormant-20260101.md'), '# Dormant pool\n');
  w(join(src, 'reference', 'glossary.yml'), 'terms: []\n'); // overwrites the seed
  w(join(src, 'reference', 'editorial-notes.md'), 'real editorial extra\n');
  w(join(src, 'docs', 'data', 'manifest.json'), '{"locales":["en"]}\n');
  w(join(src, 'docs', 'index.html'), '<html></html>\n'); // dashboard: NOT imported
  w(join(src, 'docs', 'assets', 'app.js'), '(() => {})();\n');
  w(join(src, 'docs', 'archives', 'snapshots', '20251201', 'graph-mix.json'), '{}\n');
  w(join(src, 'app', 'sourcedata', '2026-01-01', 'news_section.json'),
    '{"date":"2026-01-01"}\n');
  w(join(src, 'app', 'sourcedata', '2026-01-01', 'run.json'),
    '{"date":"2026-01-01","locales":["en","ja"]}\n');
  w(join(src, 'app', 'sourcedata', 'locales', '2026-01-01', 'ja', 'news_section.json'), '{}\n');
  w(join(src, 'README.md'), '# board\n');
  w(join(src, 'README.ja.md'), '# ボード\n');
  w(join(src, 'references.txt'), 'https://example.com/1\n');
  if (opts.withDb ?? true) {
    const dbFile = join(src, 'app', 'data', 'analytics.sqlite');
    initDb(dbFile);
    const db = new Database(dbFile);
    db.exec(`CREATE TABLE import_marker (v TEXT); INSERT INTO import_marker VALUES ('seeded');`);
    db.close();
  }
  return src;
}

/** Content+mtime fingerprint of every file under root (read-only proof). */
function snapshotTree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const st = statSync(p);
      const sha = createHash('sha1').update(readFileSync(p)).digest('hex');
      out.set(relative(root, p), `${st.mtimeMs}:${st.size}:${sha}`);
    }
  };
  walk(root);
  return out;
}

describe('importNewsCheckout', () => {
  it('maps the whole old shape into a fresh instance, one commit, source untouched', () => {
    const src = makeNewsShapedSrc();
    const root = mkdtempSync(join(tmpdir(), 'nf-import-'));
    const inst = join(root, 'inst');
    try {
      const before = snapshotTree(src);
      initInstance(inst);
      importNewsCheckout(src, inst);

      // Mapping: quartet + exports + sourcedata (incl. locales +
      // run.json) + references.txt + READMEs.
      for (const f of [
        'data/daily-news/en/news-20260101.md',
        'data/daily-news/ja/news-20260101.md',
        'data/future-prediction/en/future-prediction-20260101.md',
        'data/memory/dormant/dormant-20260101.md',
        'data/reference/glossary.yml',
        'data/reference/editorial-notes.md',
        'data/exports/manifest.json',
        'data/archives/snapshots/20251201/graph-mix.json',
        'data/sourcedata/2026-01-01/news_section.json',
        'data/sourcedata/2026-01-01/run.json',
        'data/sourcedata/locales/2026-01-01/ja/news_section.json',
        'data/references.txt',
        'README.md', 'README.ja.md'])
        expect(existsSync(join(inst, ...f.split('/'))), f).toBe(true);
      // Real editorial files OVERWRITE the seeds; untouched seeds survive.
      expect(readFileSync(join(inst, 'data', 'reference', 'glossary.yml'), 'utf8'))
        .toBe('terms: []\n');
      expect(existsSync(join(inst, 'data', 'reference', 'news-topics.md'))).toBe(true);
      expect(readFileSync(join(inst, 'data', 'references.txt'), 'utf8'))
        .toBe('https://example.com/1\n');
      expect(readFileSync(join(inst, 'README.md'), 'utf8')).toBe('# board\n');
      // The instance-side dashboard copy era is over: docs/ never comes.
      expect(existsSync(join(inst, 'docs'))).toBe(false);

      // DB seeded (marker table travels), the init-born DB backed up.
      const storeDb = join(inst, 'store', 'world', 'analytics.sqlite');
      const db = new Database(storeDb, { readonly: true });
      expect(db.prepare('SELECT v FROM import_marker').get()).toEqual({ v: 'seeded' });
      db.close();
      expect(readdirSync(join(inst, 'store', 'world'))
        .some(f => f.startsWith('analytics.sqlite.bak-'))).toBe(true);

      // Exactly two commits (init + import), synthetic identity, clean
      // tree; archives and store stay untracked (template .gitignore).
      const log = git(inst, 'log', '--format=%s|%an').trim().split('\n');
      expect(log).toHaveLength(2);
      expect(log[0]).toBe(`${IMPORT_COMMIT_PREFIX}${basename(src)}|nunc-fluens`);
      expect(git(inst, 'status', '--porcelain').trim()).toBe('');
      expect(git(inst, 'ls-files', '--', 'data/archives').trim()).toBe('');
      expect(git(inst, 'ls-files', '--', 'store').trim()).toBe('');
      // The tracked payload includes the mapped data.
      expect(git(inst, 'ls-files', '--', 'data/sourcedata').trim())
        .toContain('data/sourcedata/2026-01-01/news_section.json');

      // READ-ONLY source: byte- and mtime-identical after the import.
      expect(snapshotTree(src)).toEqual(before);
    } finally {
      rmSync(src, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a source without a DB leaves the empty init store in place (no backup)', () => {
    const src = makeNewsShapedSrc({ withDb: false });
    const root = mkdtempSync(join(tmpdir(), 'nf-import-'));
    const inst = join(root, 'inst');
    try {
      initInstance(inst);
      importNewsCheckout(src, inst);
      const worldDir = join(inst, 'store', 'world');
      expect(readdirSync(worldDir).some(f => f.includes('.bak-'))).toBe(false);
      const db = new Database(join(worldDir, 'analytics.sqlite'), { readonly: true });
      expect(db.prepare(
        `SELECT count(*) AS n FROM sqlite_master WHERE name='import_marker'`).get())
        .toEqual({ n: 0 });
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
      db.close();
    } finally {
      rmSync(src, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a non-virgin instance, a non-instance target, and a non-news source', () => {
    const src = makeNewsShapedSrc();
    const root = mkdtempSync(join(tmpdir(), 'nf-import-'));
    const inst = join(root, 'inst');
    try {
      initInstance(inst);
      importNewsCheckout(src, inst);
      // Second import: data/sourcedata is populated now.
      expect(() => importNewsCheckout(src, inst)).toThrow(/already carries sourcedata/);
      // A plain directory is not an initialized instance.
      const plain = join(root, 'plain');
      mkdirSync(plain);
      expect(() => importNewsCheckout(src, plain)).toThrow(/not an initialized v2 instance/);
      // A v2 instance is not a news-shaped source.
      const inst2 = join(root, 'inst2');
      initInstance(inst2);
      expect(() => importNewsCheckout(inst2, inst2)).toThrow(/news-shaped/);
    } finally {
      rmSync(src, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('publish add-list tracks the v2 constants', () => {
  // A missed rename here silently stops an artifact class from being
  // committed (the add list existsSync-filters).
  it('names every artifact class by its instance-layout path', () => {
    const list = publishAddable();
    for (const p of ['README.md', 'README.ja.md', 'README.es.md', 'README.fil.md',
      'data/exports', 'data/daily-news', 'data/future-prediction', 'data/memory',
      'data/references.txt', 'data/reference/citation-policy-review.md',
      'data/sourcedata'])
      expect(list, p).toContain(p);
    for (const stale of ['report', 'future-prediction', 'memory', 'docs/data',
      'references.txt', 'app/sourcedata',
      'reference/citation-policy-review.md'])
      expect(list, `stale: ${stale}`).not.toContain(stale);
  });
});

describe('looksNewsShaped', () => {
  it('detects report/ or app/sourcedata; a v2 instance is not news-shaped', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-shape-'));
    try {
      expect(looksNewsShaped(root)).toBe(false);
      mkdirSync(join(root, 'report'));
      expect(looksNewsShaped(root)).toBe(true);
      const appOnly = join(root, 'app-only');
      mkdirSync(join(appOnly, 'app', 'sourcedata'), { recursive: true });
      expect(looksNewsShaped(appOnly)).toBe(true);
      const inst = join(root, 'inst');
      initInstance(inst);
      expect(looksNewsShaped(inst)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
