// SQL-text dump compatible with CPython's sqlite3 iterdump
// (Lib/sqlite3/dump.py) — the golden analytics.dump.sql was captured
// with it, so the TS pipeline must emit identical bytes (before the
// manifest's volatile-field normalization). Value quoting is delegated
// to SQLite's own quote() at SELECT time, exactly like the original.
import type Database from 'better-sqlite3';

export function* iterDump(db: Database.Database): Generator<string> {
  yield 'BEGIN TRANSACTION;';

  const tables = db.prepare(
    "SELECT name, type, sql FROM sqlite_master WHERE sql NOT NULL AND type == 'table' ORDER BY name",
  ).all() as Array<{ name: string; type: string; sql: string }>;

  for (const { name, sql } of tables) {
    if (name === 'sqlite_sequence') {
      yield 'DELETE FROM "sqlite_sequence";';
    } else if (name === 'sqlite_stat1') {
      yield 'ANALYZE "sqlite_stat1";';
    } else if (name.startsWith('sqlite_')) {
      continue;
    } else {
      yield `${sql};`;
    }

    const cols = (db.pragma(`table_info("${name}")`) as Array<{ name: string }>)
      .map(c => c.name);
    const values = cols.map(c => `quote("${c}")`).join(`||','||`);
    const q = `SELECT 'INSERT INTO "${name}" VALUES('||${values}||')' AS stmt FROM "${name}"`;
    for (const row of db.prepare(q).iterate() as IterableIterator<{ stmt: string }>)
      yield `${row.stmt};`;
  }

  const extras = db.prepare(
    "SELECT name, type, sql FROM sqlite_master WHERE sql NOT NULL AND type IN ('index', 'trigger', 'view')",
  ).all() as Array<{ sql: string }>;
  for (const { sql } of extras) yield `${sql};`;

  yield 'COMMIT;';
}

export function dumpSql(db: Database.Database): string {
  return [...iterDump(db)].map(l => l + '\n').join('');
}
