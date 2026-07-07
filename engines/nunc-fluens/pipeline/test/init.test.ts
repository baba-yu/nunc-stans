// Post-C REDO V2 (R1/R2): `nunc-fluens init` stamps a v2 instance from
// the engine template — full skeleton + seeds, one synthetic-identity
// commit, an initDb'd (ignored) store — plus bare-name resolution and
// the non-empty-dir refusal.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import Database from 'better-sqlite3';
import {
  INIT_COMMIT_MESSAGE, initInstance, instancesRoot, resolveInstanceDir,
} from '../src/instance.ts';

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

describe('initInstance', () => {
  it('creates the full v2 skeleton with template seeds, one commit, and a store db', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-init-'));
    const dir = join(root, 'inst');
    try {
      const r = initInstance(dir);

      // Skeleton + seeds from the template.
      for (const f of ['.gitignore', 'README.md', 'data/references.txt',
        'data/reference/news-topics.md', 'data/reference/citation-restrictions.md',
        'data/reference/glossary.yml',
        'data/sourcedata/.gitkeep', 'data/daily-news/.gitkeep',
        'data/future-prediction/.gitkeep', 'data/memory/.gitkeep',
        'data/exports/.gitkeep'])
        expect(existsSync(join(dir, ...f.split('/'))), f).toBe(true);
      const ignore = readFileSync(join(dir, '.gitignore'), 'utf8');
      expect(ignore).toContain('/store/');
      expect(ignore).toContain('/data/archives/');
      // The seeds carry real content (glossary seed term, citation
      // denylist, the topic list header the composer parses).
      expect(readFileSync(join(dir, 'data', 'reference', 'glossary.yml'), 'utf8'))
        .toContain('FixtureTerm');
      expect(readFileSync(join(dir, 'data', 'reference', 'news-topics.md'), 'utf8'))
        .toContain('## Topic list');

      // Exactly one initial commit, synthetic identity, clean tree.
      expect(git(dir, 'log', '--format=%s|%an <%ae>').trim())
        .toBe(`${INIT_COMMIT_MESSAGE}|nunc-fluens <nunc-fluens@localhost>`);
      expect(git(dir, 'status', '--porcelain').trim()).toBe('');
      // store/ is runtime state: present on disk, never tracked.
      expect(git(dir, 'ls-files', '--', 'store').trim()).toBe('');

      // The store DB exists and is schema-initialized.
      expect(r.dbFile).toBe(join(dir, 'store', 'world', 'analytics.sqlite'));
      const db = new Database(r.dbFile, { readonly: true });
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(db.prepare(
        `SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='source_files'`)
        .get()).toEqual({ n: 1 });
      db.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts an existing EMPTY dir and refuses a non-empty one', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-init-'));
    try {
      const empty = join(root, 'empty');
      mkdirSync(empty);
      expect(initInstance(empty).dir).toBe(empty);
      const full = join(root, 'full');
      mkdirSync(full);
      writeFileSync(join(full, 'something.txt'), 'x\n');
      expect(() => initInstance(full)).toThrow(/not empty/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('commits with the synthetic identity when the host has none', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-init-'));
    const fakeHome = mkdtempSync(join(tmpdir(), 'nf-home-'));
    // Hermetic spawn env: no global/system git config, no identity env.
    const KEYS = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'HOME', 'XDG_CONFIG_HOME',
      'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL',
      'EMAIL'] as const;
    const saved = new Map<string, string | undefined>(
      KEYS.map(k => [k, process.env[k]] as [string, string | undefined]));
    process.env.GIT_CONFIG_GLOBAL = '/dev/null';
    process.env.GIT_CONFIG_SYSTEM = '/dev/null';
    process.env.HOME = fakeHome;
    process.env.XDG_CONFIG_HOME = join(fakeHome, '.config');
    for (const k of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME',
      'GIT_COMMITTER_EMAIL', 'EMAIL']) delete process.env[k];
    try {
      const dir = join(root, 'inst');
      initInstance(dir);
      expect(git(dir, 'log', '-1', '--format=%an <%ae> %cn <%ce>').trim())
        .toBe('nunc-fluens <nunc-fluens@localhost> nunc-fluens <nunc-fluens@localhost>');
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('resolveInstanceDir', () => {
  it('bare names land under the engine instances/ home', () => {
    expect(resolveInstanceDir('myprofile')).toBe(join(instancesRoot(), 'myprofile'));
    // instancesRoot is module-relative (like promptsDir): the engine dir.
    expect(instancesRoot().replaceAll(sep, '/'))
      .toMatch(/engines\/nunc-fluens\/instances$/);
  });

  it('paths are used as-is', () => {
    expect(resolveInstanceDir(join(tmpdir(), 'somewhere')))
      .toBe(join(tmpdir(), 'somewhere'));
    expect(resolveInstanceDir('./rel/dir')).toBe('./rel/dir');
  });
});
