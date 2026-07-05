import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configFile, requireConfig, resolveDataDir, resolveNewsRepo,
} from '../src/config.ts';
import { linkNewsRepo } from '../src/config.ts';
import { migrateDb } from '../src/migrate.ts';

const ENV = ['NS_DATA', 'FED_DATA', 'NS_NEWS_REPO', 'XDG_CONFIG_HOME'] as const;
const saved: Record<string, string | undefined> = {};
let tmp: string;

beforeEach(() => {
  for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
  tmp = mkdtempSync(join(tmpdir(), 'nf-t3-'));
  process.env.XDG_CONFIG_HOME = join(tmp, 'xdg'); // isolate the config file
});
afterEach(() => {
  for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  rmSync(tmp, { recursive: true, force: true });
});

describe('config resolution', () => {
  it('env overrides win and requireConfig demands both values', () => {
    process.env.NS_DATA = join(tmp, 'store');
    process.env.NS_NEWS_REPO = join(tmp, 'news');
    expect(requireConfig()).toEqual({ dataDir: join(tmp, 'store'), newsRepo: join(tmp, 'news') });
    delete process.env.NS_NEWS_REPO;
    expect(() => requireConfig()).toThrow(/just news-link/);
    delete process.env.NS_DATA;
    expect(() => requireConfig()).toThrow(/just bootstrap/);
  });

  it('linkNewsRepo merges into the config without clobbering other keys', () => {
    mkdirSync(join(process.env.XDG_CONFIG_HOME!, 'nunc-stans'), { recursive: true });
    writeFileSync(configFile(), JSON.stringify({ data_dir: '/somewhere' }) + '\n');
    linkNewsRepo(join(tmp, 'news'));
    const cfg = JSON.parse(readFileSync(configFile(), 'utf8'));
    expect(cfg).toEqual({ data_dir: '/somewhere', news_repo: join(tmp, 'news') });
    expect(resolveDataDir().dir).toBe('/somewhere');
    expect(resolveNewsRepo()).toBe(join(tmp, 'news'));
  });
});

describe('migrate-db', () => {
  function makeNewsRepo(): string {
    const repo = join(tmp, 'news');
    mkdirSync(join(repo, 'app', 'data'), { recursive: true });
    const db = new Database(join(repo, 'app', 'data', 'analytics.sqlite'));
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); INSERT INTO t (v) VALUES (\'x\');');
    db.close();
    // junk siblings that must NOT be migrated
    for (const junk of ['analytics.sqlite.dud', 'analytics.sqlite.partial2', 'analytics.sqlite-journal.bak'])
      writeFileSync(join(repo, 'app', 'data', junk), 'junk');
    return repo;
  }

  it('copies, verifies, excludes junk, and backs up on re-run', () => {
    const newsRepo = makeNewsRepo();
    const dataDir = join(tmp, 'store');
    const r1 = migrateDb({ dataDir, newsRepo }, '2026-07-06');
    expect(existsSync(r1.target)).toBe(true);
    expect(r1.backedUp).toBeNull();
    const copied = new Database(r1.target, { readonly: true });
    expect(copied.prepare('SELECT count(*) AS n FROM t').get()).toEqual({ n: 1 });
    copied.close();
    // junk stayed behind
    expect(existsSync(join(dataDir, 'world', 'analytics.sqlite.dud'))).toBe(false);
    // idempotent re-run backs the previous target up
    const r2 = migrateDb({ dataDir, newsRepo }, '2026-07-07');
    expect(r2.backedUp).toBe(`${r2.target}.bak-2026-07-07`);
    expect(existsSync(r2.backedUp!)).toBe(true);
  });

  it('refuses a missing source', () => {
    expect(() => migrateDb({ dataDir: join(tmp, 'store'), newsRepo: join(tmp, 'nope') }, '2026-07-06'))
      .toThrow(/source DB not found/);
  });
});
