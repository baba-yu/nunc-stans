import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ServedApp } from './bundles.ts'
import { IDENT } from './bundle-types.ts'

// Per-app user data (contract §7): <data root>/apps/<slug>/data.sqlite,
// created lazily on first serve; installed.jsonl is the append-only record of
// installs/version switches. Schema drift between the recorded schema_hash
// and the served bundle mounts the app READ-ONLY with an instructive reason
// (migrations are out of scope in v0, contract §3).

const FORBIDDEN_METRIC_SQL =
  /\b(attach|pragma|insert|update|delete|drop|alter|create|replace|vacuum|reindex|detach|begin|commit|rollback)\b/i

// Host-side half of rail 3 (defense in depth beside the generator's): the
// metric declarations are re-checked before their views are ever applied.
export function validateManifestMetrics(app: ServedApp): string | null {
  for (const m of app.manifest.metrics) {
    if (!IDENT.test(m.name)) return `metric name ${JSON.stringify(m.name)} is not an identifier`
    const s = m.sql.trim()
    if (!/^select\b/i.test(s)) return `metric ${m.name}: sql must be a single SELECT`
    if (s.includes(';')) return `metric ${m.name}: sql must be one statement`
    const bad = s.match(FORBIDDEN_METRIC_SQL)
    if (bad) return `metric ${m.name}: sql may not contain ${bad[0].toUpperCase()}`
  }
  return null
}

export interface AppData {
  db: Database.Database
  metricsDb: Database.Database // read-only connection for metric views
  readOnly: boolean
  reason?: string
}

interface InstalledLine {
  slug: string
  version: number
  schema_hash: string
  installed_at: string
}

function lastInstalled(file: string): InstalledLine | null {
  if (!existsSync(file)) return null
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
  if (!lines.length) return null
  try {
    return JSON.parse(lines[lines.length - 1]) as InstalledLine
  } catch {
    return null
  }
}

const cache = new Map<string, AppData>()

/** Open (and if needed initialize) one app's data. Cached per slug@version. */
export function openAppData(dataRoot: string, app: ServedApp): AppData {
  const key = `${app.slug}@${app.version}`
  const hit = cache.get(key)
  if (hit) return hit

  const dir = join(dataRoot, 'apps', app.slug)
  mkdirSync(dir, { recursive: true })
  const dbPath = join(dir, 'data.sqlite')
  const installedFile = join(dir, 'installed.jsonl')
  const schemaHash = createHash('sha256').update(app.schemaSql).digest('hex')

  const metricError = validateManifestMetrics(app)
  const prev = lastInstalled(installedFile)
  const drift = prev !== null && prev.schema_hash !== schemaHash

  const readOnly = drift || metricError !== null
  const reason = metricError
    ? `metric rail refused: ${metricError}`
    : drift
      ? `schema drift: data.sqlite was installed for ${prev!.slug}@v${prev!.version} (schema ${prev!.schema_hash.slice(0, 12)}…), the served bundle differs — mounted read-only; migrations are out of scope in v0`
      : undefined

  const db = new Database(dbPath, { readonly: false })
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  if (!readOnly) {
    db.exec(app.schemaSql) // idempotent by contract (§3)
    if (!prev || prev.version !== app.version) {
      const line: InstalledLine = {
        slug: app.slug,
        version: app.version,
        schema_hash: schemaHash,
        installed_at: new Date().toISOString(),
      }
      appendFileSync(installedFile, JSON.stringify(line) + '\n')
    }
  }
  const metricsDb = new Database(dbPath, { readonly: true })
  metricsDb.pragma('query_only = ON')

  const data: AppData = { db, metricsDb, readOnly, ...(reason ? { reason } : {}) }
  cache.set(key, data)
  return data
}

/** Test hook: drop cached connections (fresh stores per test). */
export function resetAppDataCache(): void {
  for (const d of cache.values()) {
    try {
      d.db.close()
      d.metricsDb.close()
    } catch {
      /* already closed */
    }
  }
  cache.clear()
}
