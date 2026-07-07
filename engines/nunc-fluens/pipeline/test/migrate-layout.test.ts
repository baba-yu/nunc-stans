// Post-C T6 (P3): the sandbox layout migration — old news shape →
// product data/ shape — proven on a synthetic old-shape git repo, plus
// the shape detector and the publish add-list lockstep assertion.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateLayout, translateIgnoreLine } from '../src/migrate-layout.ts';
import { detectShape } from '../src/world-paths.ts';
import { publishAddable } from '../src/orchestrator/steps.ts';

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

function w(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

/** A tiny synthetic OLD-shape instance checkout (git repo). */
function makeOldShapeRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'nf-migrate-'));
  execFileSync('git', ['init', '-q', repo]);
  git(repo, 'config', 'user.email', 'fixture@example.com');
  git(repo, 'config', 'user.name', 'Fixture');
  w(join(repo, 'report', 'en', 'news-20260101.md'), '# News Report 2026-01-01\n');
  w(join(repo, 'future-prediction', 'en', 'future-prediction-20260101.md'), '# FP\n');
  w(join(repo, 'memory', 'dormant', 'dormant-20260101.md'), '# Dormant pool\n');
  w(join(repo, 'reference', 'glossary.yml'), 'terms: []\n');
  w(join(repo, 'docs', 'data', 'manifest.json'), '{"locales":["en"]}\n');
  w(join(repo, 'docs', 'index.html'), '<html></html>\n');
  w(join(repo, 'docs', 'assets', 'app.js'), '(() => {})();\n');
  w(join(repo, 'README.md'), '# board\n');
  w(join(repo, '.gitignore'), [
    '# instance ignores',
    'references.txt',
    '/app/data/',
    '/docs/archives/',
    'docs/data/snapshots/',
    '!/report/keep.md',
    '',
  ].join('\n'));
  w(join(repo, 'app', 'sourcedata', '2026-01-01', 'news_section.json'), '{}\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'fixture: old-shape instance');
  // Ignored on-disk leftovers the migration must plain-delete / carry.
  w(join(repo, 'docs', 'archives', 'snapshots', '20251201', 'graph-mix.json'), '{}\n');
  w(join(repo, 'references.txt'), 'https://example.com/1\n');
  return repo;
}

describe('detectShape', () => {
  it('classifies empty / old / new trees', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-shape-'));
    try {
      expect(detectShape(dir)).toBe('empty');
      mkdirSync(join(dir, 'report'));
      expect(detectShape(dir)).toBe('old');
      mkdirSync(join(dir, 'data', 'daily-news'), { recursive: true });
      expect(detectShape(dir)).toBe('new'); // new wins over old remnants
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('migrateLayout', () => {
  it('converts an old-shape repo in one commit and is idempotent', () => {
    const repo = makeOldShapeRepo();
    try {
      const r = migrateLayout(repo);
      expect(r.migrated).toBe(true);

      // Quartet + exports moved; docs/ fully gone (tracked dashboard
      // rm'd, ignored archives plain-deleted); app/ untouched.
      expect(existsSync(join(repo, 'data', 'daily-news', 'en', 'news-20260101.md'))).toBe(true);
      expect(existsSync(join(repo, 'data', 'future-prediction', 'en', 'future-prediction-20260101.md'))).toBe(true);
      expect(existsSync(join(repo, 'data', 'memory', 'dormant', 'dormant-20260101.md'))).toBe(true);
      expect(existsSync(join(repo, 'data', 'reference', 'glossary.yml'))).toBe(true);
      expect(existsSync(join(repo, 'data', 'exports', 'manifest.json'))).toBe(true);
      expect(existsSync(join(repo, 'report'))).toBe(false);
      expect(existsSync(join(repo, 'docs'))).toBe(false);
      expect(existsSync(join(repo, 'app', 'sourcedata', '2026-01-01', 'news_section.json'))).toBe(true);
      expect(detectShape(repo)).toBe('new');

      // Untracked-but-present files travel too (references.txt is
      // ignored and stays at the root).
      expect(existsSync(join(repo, 'references.txt'))).toBe(true);

      // .gitignore translated conservatively.
      const ignore = readFileSync(join(repo, '.gitignore'), 'utf8').split('\n');
      expect(ignore).toContain('references.txt');       // NOT the reference/ prefix
      expect(ignore).toContain('/app/data/');           // app/ does not move (P1)
      expect(ignore).toContain('/data/archives/');
      expect(ignore).toContain('data/exports/snapshots/');
      expect(ignore).toContain('!/data/daily-news/keep.md');

      // Exactly one migration commit, tree clean.
      expect(git(repo, 'log', '-1', '--format=%s').trim())
        .toBe('layout migration: post-c product data layout');
      expect(git(repo, 'log', '--oneline').trim().split('\n').length).toBe(2);
      expect(git(repo, 'status', '--porcelain').trim()).toBe('');

      // Second run: no-op, no new commit.
      const again = migrateLayout(repo);
      expect(again.migrated).toBe(false);
      expect(git(repo, 'log', '--oneline').trim().split('\n').length).toBe(2);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('refuses a non-git directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-nogit-'));
    try {
      mkdirSync(join(dir, 'report'));
      expect(() => migrateLayout(dir)).toThrow(/not a git work tree/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('.gitignore line translation', () => {
  it('maps known prefixes at segment boundaries only', () => {
    expect(translateIgnoreLine('/report/')).toBe('/data/daily-news/');
    expect(translateIgnoreLine('memory/')).toBe('data/memory/');
    expect(translateIgnoreLine('docs/data')).toBe('data/exports');
    expect(translateIgnoreLine('/docs/archives/snapshots/')).toBe('/data/archives/snapshots/');
    expect(translateIgnoreLine('references.txt')).toBe('references.txt');
    expect(translateIgnoreLine('reporting/')).toBe('reporting/');
    expect(translateIgnoreLine('# a comment about report/')).toBe('# a comment about report/');
    expect(translateIgnoreLine('')).toBe('');
  });
});

describe('publish add-list tracks the data/ constants', () => {
  it('names every artifact class by its new-shape path', () => {
    const list = publishAddable();
    for (const p of ['README.md', 'README.ja.md', 'README.es.md', 'README.fil.md',
      'data/exports', 'data/daily-news', 'data/future-prediction', 'data/memory',
      'references.txt', 'data/reference/citation-policy-review.md', 'app/sourcedata'])
      expect(list, p).toContain(p);
    for (const stale of ['report', 'future-prediction', 'memory', 'docs/data',
      'reference/citation-policy-review.md'])
      expect(list, `stale: ${stale}`).not.toContain(stale);
  });
});
