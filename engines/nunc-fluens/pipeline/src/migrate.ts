// analytics.sqlite migration (Phase C): same file, same schema, same
// data — new location (<data store>/world/). The junk siblings that
// accumulated next to the upstream DB (.partial/.dud/.bak/journals) are
// deliberately NOT migrated. Idempotent: re-running backs up the
// existing target first. The upstream copy is left in place until the
// T9 cutover retires the old stack.
import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { newsDbFile, worldDbFile } from './config.ts'

export interface MigrateResult {
  source: string
  target: string
  bytes: number
  backedUp: string | null
}

export function integrityCheck(dbFile: string): void {
  const db = new Database(dbFile, { readonly: true, fileMustExist: true })
  try {
    const row = db.pragma('integrity_check', { simple: true })
    if (row !== 'ok') throw new Error(`integrity_check failed for ${dbFile}: ${row}`)
  } finally {
    db.close()
  }
}

export function migrateDb(cfg: { dataDir: string; newsRepo: string }, todayIso: string): MigrateResult {
  const source = newsDbFile(cfg.newsRepo)
  const target = worldDbFile(cfg.dataDir)
  if (!existsSync(source)) throw new Error(`source DB not found: ${source}`)

  integrityCheck(source)

  mkdirSync(dirname(target), { recursive: true })
  let backedUp: string | null = null
  if (existsSync(target)) {
    backedUp = `${target}.bak-${todayIso}`
    renameSync(target, backedUp)
  }
  copyFileSync(source, target)
  integrityCheck(target)

  return { source, target, bytes: statSync(target).size, backedUp }
}
