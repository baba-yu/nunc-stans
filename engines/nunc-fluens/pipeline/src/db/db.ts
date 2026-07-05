// TS port of app/src/db.py — connection factory + schema apply. The
// schema is the verbatim copy of the oracle's schema.sql (this package
// carries its own copy because app/ is deleted at T12).
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function schemaPath(): string {
  return join(import.meta.dirname, 'schema.sql');
}

export function connect(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = MEMORY');
  db.pragma('temp_store = MEMORY');
  db.pragma('foreign_keys = ON');
  return db;
}

/** Create (idempotent) the database by executing the bundled schema. */
export function initDb(path: string): void {
  const sql = readFileSync(schemaPath(), 'utf8');
  const db = connect(path);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}
