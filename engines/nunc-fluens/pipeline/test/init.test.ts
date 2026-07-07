// Post-C REDO V2/V3 (R1/R2/R9): `nunc-fluens init` stamps a v2 instance
// from the engine template — full skeleton + seeds, an instance.json
// birth stamp, an initDb'd (disposable) store — plus bare-name
// resolution and the non-empty-dir refusal. Instances are git-less: no
// repo, no identity, no ignore file is ever created.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import Database from 'better-sqlite3';
import {
  initInstance, instancesRoot, readInstanceStamp, requireInstance,
  resolveInstanceDir,
} from '../src/instance.ts';

describe('initInstance', () => {
  it('creates the full v2 skeleton with template seeds, an instance.json stamp, and a store db', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-init-'));
    const dir = join(root, 'inst');
    try {
      const r = initInstance(dir, '2026-07-07');

      // Skeleton + seeds from the template.
      for (const f of ['README.md', 'instance.json',
        'data/history/reference-history.log',
        'data/reference/news-topics.md', 'data/reference/citation-restrictions.md',
        'data/reference/glossary.yml',
        'data/sourcedata/.gitkeep', 'data/daily-news/.gitkeep',
        'data/future-prediction/.gitkeep', 'data/exports/.gitkeep'])
        expect(existsSync(join(dir, ...f.split('/'))), f).toBe(true);
      // The seeds carry real content (glossary seed term, citation
      // denylist, the topic list header the composer parses).
      expect(readFileSync(join(dir, 'data', 'reference', 'glossary.yml'), 'utf8'))
        .toContain('FixtureTerm');
      expect(readFileSync(join(dir, 'data', 'reference', 'news-topics.md'), 'utf8'))
        .toContain('## Topic list');
      // The citation ledger is born empty.
      expect(readFileSync(
        join(dir, 'data', 'history', 'reference-history.log'), 'utf8')).toBe('');

      // Git-less (R9): no repo, no ignore file — an instance is a
      // plain directory.
      expect(existsSync(join(dir, '.git'))).toBe(false);
      expect(existsSync(join(dir, '.gitignore'))).toBe(false);

      // instance.json: pretty-printed stamp with the injected date.
      const raw = readFileSync(join(dir, 'instance.json'), 'utf8');
      expect(raw.endsWith('\n')).toBe(true);
      expect(JSON.parse(raw)).toEqual(
        { nunc_fluens: 1, created: '2026-07-07', imports: [] });
      expect(readInstanceStamp(dir)).toEqual(
        { nunc_fluens: 1, created: '2026-07-07', imports: [] });

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

  it('defaults the created date to today when not injected', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-init-'));
    const dir = join(root, 'inst');
    try {
      initInstance(dir);
      const stamp = readInstanceStamp(dir)!;
      expect(stamp.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(stamp.created).toBe(new Date().toISOString().slice(0, 10));
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

  it('rolls back a dir it created on failure; leaves a pre-existing dir with a hint', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-init-'));
    try {
      // init would have created the dir, but the parent is read-only:
      // the stamp fails inside the guarded section — the rollback path
      // removes any partial debris and rethrows; the non-empty-dir
      // guard cannot trip on retry.
      const roRoot = join(root, 'ro');
      mkdirSync(roRoot);
      chmodSync(roRoot, 0o555);
      const created = join(roRoot, 'inst');
      try {
        expect(() => initInstance(created)).toThrow();
        expect(existsSync(created)).toBe(false);
      } finally {
        chmodSync(roRoot, 0o755);
      }
      // The dir pre-existed (empty) but is read-only: the template copy
      // fails MID-STAMP, and the dir is the owner's to remove — the
      // error names the fix.
      const pre = join(root, 'pre');
      mkdirSync(pre);
      chmodSync(pre, 0o555);
      try {
        expect(() => initInstance(pre)).toThrow(/remove .* and re-run init/);
        expect(existsSync(pre)).toBe(true);
      } finally {
        chmodSync(pre, 0o755);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('requireInstance', () => {
  it('recreates a missing store db (copied/cleaned instance) instead of refusing', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-req-'));
    try {
      const dir = join(root, 'inst');
      initInstance(dir);
      // store/ is disposable runtime state: a copied or cleaned
      // instance legitimately lacks it.
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
      expect(() => requireInstance(plain)).toThrow(/missing instance\.json/);
      // No store was conjured into the refused dir.
      expect(existsSync(join(plain, 'store'))).toBe(false);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });

  it('refuses a foreign instance.json (no nunc_fluens field) and a missing sourcedata tree', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-req-'));
    try {
      // instance.json exists but is not ours.
      const foreign = join(root, 'foreign');
      mkdirSync(join(foreign, 'data', 'sourcedata'), { recursive: true });
      writeFileSync(join(foreign, 'instance.json'), '{"something": "else"}\n');
      expect(() => requireInstance(foreign)).toThrow(/missing instance\.json/);
      // Stamp ok, sourcedata missing.
      const noSd = join(root, 'no-sd');
      mkdirSync(noSd, { recursive: true });
      writeFileSync(join(noSd, 'instance.json'),
        '{"nunc_fluens": 1, "created": "2026-07-07", "imports": []}\n');
      expect(() => requireInstance(noSd)).toThrow(/data\/sourcedata/);
    } finally {
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

// Bare names are accepted EVERYWHERE an instance is named, not just by
// init/import — the quickstart's init <name> -> link/daily/schedule
// <name> flow must hold without switching to the path form midway.
describe('bare instance names (link + run guard)', () => {
  const CLI = join(import.meta.dirname, '..', 'src', 'cli.ts');

  it('requireInstance resolves a bare name to the instances/ home', () => {
    const name = `nf-test-bare-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
    const dir = resolveInstanceDir(name);
    try {
      initInstance(dir);
      const box = requireInstance(name);
      expect(box.root).toBe(dir);
      // And a missing bare name reports the RESOLVED path, not the raw
      // name (the old message misdirected users back to init).
      let msg = '';
      try {
        requireInstance(`${name}-missing`);
      } catch (e) {
        msg = e instanceof Error ? e.message : String(e);
      }
      expect(msg).toContain(join(instancesRoot(), `${name}-missing`));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('link resolves a bare name (CLI-level sugar, same as init/import)', () => {
    const name = `nf-test-link-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
    const dir = resolveInstanceDir(name);
    const fakeCfgHome = mkdtempSync(join(tmpdir(), 'nf-xdg-'));
    try {
      initInstance(dir);
      const env = { ...process.env, XDG_CONFIG_HOME: fakeCfgHome };
      delete (env as Record<string, string | undefined>).NS_NEWS_REPO;
      const r = spawnSync(process.execPath, [CLI, 'link', name], { encoding: 'utf8', env });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(`news_repo = ${dir}`);
      // The config landed in the sandboxed home, holding the resolved path.
      const cfg = readFileSync(join(fakeCfgHome, 'nunc-stans', 'config.json'), 'utf8');
      expect(JSON.parse(cfg).news_repo).toBe(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(fakeCfgHome, { recursive: true, force: true });
    }
  });
});
