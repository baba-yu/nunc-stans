// SQLite integrity verification, shared by `nunc-fluens import`'s DB
// seed and anything else that copies an analytics.sqlite around. (The
// Phase-C `migrate-db` command that once lived here was retired with
// the V2 template/instance split: import seeds each instance's store
// directly from its source checkout.)
import Database from 'better-sqlite3'

export function integrityCheck(dbFile: string): void {
  const db = new Database(dbFile, { readonly: true, fileMustExist: true })
  try {
    const row = db.pragma('integrity_check', { simple: true })
    if (row !== 'ok') throw new Error(`integrity_check failed for ${dbFile}: ${row}`)
  } finally {
    db.close()
  }
}
