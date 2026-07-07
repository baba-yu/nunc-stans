// Post-C REDO V2 (R1/R2): `nunc-fluens init` stamps a v2 instance from
// the engine template — full skeleton + seeds, one synthetic-identity
// commit, an initDb'd (ignored) store — plus bare-name resolution and
// the non-empty-dir refusal.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import Database from 'better-sqlite3';
import {
  INIT_COMMIT_MESSAGE, initInstance, instancesRoot, requireInstance,
  resolveInstanceDir,
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
      // The identity is seeded into the LOCAL config at birth, so
      // run-side PLAIN git commits (publish, Sunday commitOnly) inherit
      // it on an identity-less host too.
      expect(git(dir, 'config', '--local', 'user.name').trim()).toBe('nunc-fluens');
      expect(git(dir, 'config', '--local', 'user.email').trim())
        .toBe('nunc-fluens@localhost');
      expect(git(dir, 'config', '--local', 'commit.gpgsign').trim()).toBe('false');
      writeFileSync(join(dir, 'data', 'references.txt'), 'plain-commit probe\n');
      git(dir, 'add', '-A');
      git(dir, 'commit', '--quiet', '-m', 'publish-shaped plain commit'); // no -c flags
      expect(git(dir, 'log', '-1', '--format=%s|%an <%ae>').trim())
        .toBe('publish-shaped plain commit|nunc-fluens <nunc-fluens@localhost>');
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is hermetic against a hostile host config (forced gpgsign, global hooks)', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-init-'));
    const fakeHome = mkdtempSync(join(tmpdir(), 'nf-home-'));
    // A developer host that forces signing through a broken gpg and
    // routes every repo at always-failing global hooks: init must still
    // succeed (gitSynthetic pins gpgsign/hooksPath off per invocation).
    const hooks = join(fakeHome, 'hooks');
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'pre-commit'), '#!/bin/sh\necho hostile-hook >&2\nexit 1\n');
    chmodSync(join(hooks, 'pre-commit'), 0o755);
    const cfg = join(fakeHome, 'gitconfig');
    writeFileSync(cfg, '[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = /nonexistent-gpg\n'
      + `[core]\n\thooksPath = ${hooks}\n`);
    const KEYS = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'HOME', 'XDG_CONFIG_HOME',
      'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL',
      'EMAIL'] as const;
    const saved = new Map<string, string | undefined>(
      KEYS.map(k => [k, process.env[k]] as [string, string | undefined]));
    process.env.GIT_CONFIG_GLOBAL = cfg;
    process.env.GIT_CONFIG_SYSTEM = '/dev/null';
    process.env.HOME = fakeHome;
    process.env.XDG_CONFIG_HOME = join(fakeHome, '.config');
    for (const k of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME',
      'GIT_COMMITTER_EMAIL', 'EMAIL']) delete process.env[k];
    try {
      const dir = join(root, 'inst');
      initInstance(dir);
      expect(git(dir, 'log', '-1', '--format=%s|%an <%ae>').trim())
        .toBe(`${INIT_COMMIT_MESSAGE}|nunc-fluens <nunc-fluens@localhost>`);
      // Local seeding pins signing OFF for later plain-git commits.
      expect(git(dir, 'config', '--local', 'commit.gpgsign').trim()).toBe('false');
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rolls back a dir it created on failure; leaves a pre-existing dir with a hint', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-init-'));
    // Deterministic mid-stamp failure: a fake `git` that always fails,
    // first on PATH (the template copy has happened by then).
    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'git'), '#!/bin/sh\nexit 1\n');
    chmodSync(join(bin, 'git'), 0o755);
    const savedPath = process.env.PATH;
    process.env.PATH = `${bin}:${savedPath}`;
    try {
      // init created the dir: the partial stamp is removed on failure,
      // so a retry does not trip the non-empty-dir refusal.
      const created = join(root, 'created');
      expect(() => initInstance(created)).toThrow();
      expect(existsSync(created)).toBe(false);
      // The dir pre-existed (empty): left in place, error names the fix.
      const pre = join(root, 'pre');
      mkdirSync(pre);
      expect(() => initInstance(pre)).toThrow(/remove .* and re-run init/);
      expect(existsSync(pre)).toBe(true);
    } finally {
      process.env.PATH = savedPath;
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('requireInstance', () => {
  it('recreates a missing store db (fresh clone / git clean) instead of refusing', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-req-'));
    try {
      const dir = join(root, 'inst');
      initInstance(dir);
      // store/ is gitignored runtime state: a clone of the instance repo
      // (or git clean -xdf) legitimately lacks it.
      rmSync(join(dir, 'store'), { recursive: true, force: true });
      const box = requireInstance(dir);
      expect(box.root).toBe(dir);
      const dbFile = join(dir, 'store', 'world', 'analytics.sqlite');
      expect(existsSync(dbFile)).toBe(true);
      const db = new Database(dbFile, { readonly: true });
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
      db.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('still refuses a dir that is not v2-shaped at all', () => {
    const plain = mkdtempSync(join(tmpdir(), 'nf-req-'));
    try {
      expect(() => requireInstance(plain)).toThrow(/missing \.git/);
      // No store was conjured into the refused dir.
      expect(existsSync(join(plain, 'store'))).toBe(false);
    } finally {
      rmSync(plain, { recursive: true, force: true });
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
