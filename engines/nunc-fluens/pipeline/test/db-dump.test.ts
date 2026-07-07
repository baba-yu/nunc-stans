// Dumper format proof: the golden analytics.dump.sql (captured with
// CPython's iterdump) is executable SQL — loading it into a fresh DB and
// re-dumping with our dumper must reproduce the golden byte-for-byte.
// Also proves initDb applies the bundled schema identically (the CREATE
// statements come out of sqlite_master the same way).
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect, initDb } from '../src/db/db.ts';
import { dumpSql } from '../src/db/dump.ts';

const GOLDEN = join(import.meta.dirname, '..', 'goldens', 'expected', 'db', 'analytics.dump.sql');

describe('CPython-compatible dump format', () => {
  it('round-trips the golden dump byte-for-byte', () => {
    const golden = readFileSync(GOLDEN, 'utf8');
    const db = new Database(':memory:');
    try {
      // CPython's dump orders tables by name, so FK targets may come
      // later; the dump is only loadable with enforcement off (sqlite's
      // own default — better-sqlite3 switches it on).
      db.pragma('foreign_keys = OFF');
      db.exec(golden);
      expect(dumpSql(db)).toBe(golden);
    } finally {
      db.close();
    }
  });

  it('initDb produces the same schema objects as the golden', () => {
    const golden = readFileSync(GOLDEN, 'utf8');
    const dir = mkdtempSync(join(tmpdir(), 'nf-db-'));
    try {
      const p = join(dir, 'x.sqlite');
      initDb(p);
      const db = connect(p);
      const fresh = db.prepare(
        "SELECT sql FROM sqlite_master WHERE sql NOT NULL ORDER BY name").all() as Array<{ sql: string }>;
      db.close();
      const g = new Database(':memory:');
      g.pragma('foreign_keys = OFF');
      g.exec(golden);
      const fromGolden = g.prepare(
        "SELECT sql FROM sqlite_master WHERE sql NOT NULL AND name != 'sqlite_sequence' ORDER BY name").all() as Array<{ sql: string }>;
      g.close();
      const freshSql = fresh.map(r => r.sql).filter(s => !s.includes('sqlite_sequence'));
      expect(freshSql).toEqual(fromGolden.map(r => r.sql));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
