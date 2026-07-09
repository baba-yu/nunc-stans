import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configFile, requireConfig, resolveDataDir, resolveNewsRepo,
} from '../src/config.ts';
import { linkNewsRepo } from '../src/config.ts';
import { defaultDataDir } from '../../../../tools/lib/data-dir.ts';
import { integrityCheck } from '../src/migrate.ts';
import { initDb } from '../src/db/db.ts';

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
  it('env overrides win; the store falls back to the in-repo default (R13)', () => {
    process.env.NS_DATA = join(tmp, 'store');
    process.env.NS_NEWS_REPO = join(tmp, 'news');
    expect(requireConfig()).toEqual({ dataDir: join(tmp, 'store'), newsRepo: join(tmp, 'news') });
    delete process.env.NS_NEWS_REPO;
    expect(() => requireConfig()).toThrow(/just news-link/);
    // No NS_DATA and no config data_dir: the store resolves to the
    // in-repo default <repo>/data (R13) instead of refusing — only the
    // news-repo link stays a hard requirement.
    delete process.env.NS_DATA;
    process.env.NS_NEWS_REPO = join(tmp, 'news');
    expect(requireConfig()).toEqual({ dataDir: defaultDataDir(), newsRepo: join(tmp, 'news') });
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

describe('integrityCheck', () => {
  // The Phase-C migrate-db command was retired with the V2
  // template/instance split (`import` seeds each instance store
  // directly); the shared integrity probe it left behind is what
  // import's DB seed leans on.
  it('accepts a healthy DB and refuses a corrupt/missing one', () => {
    const good = join(tmp, 'good.sqlite');
    initDb(good);
    expect(() => integrityCheck(good)).not.toThrow();
    const junk = join(tmp, 'junk.sqlite');
    writeFileSync(junk, 'not a sqlite file at all');
    expect(() => integrityCheck(junk)).toThrow();
    expect(() => integrityCheck(join(tmp, 'nope.sqlite'))).toThrow();
  });
});
