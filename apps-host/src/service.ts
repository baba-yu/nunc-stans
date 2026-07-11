import { randomUUID } from 'node:crypto'
import type { ServedApp } from './bundles.ts'
import type { NormalizedColumn, NormalizedEntity } from './bundle-types.ts'
import { openAppData } from './appdb.ts'

// The single enforcement point (contract §5/§6): REST routes and MCP tool
// handlers both call THESE functions — parameterized SQL over declared
// columns only, deny-unknown, host-maintained audit columns, soft-delete.

export class ServiceError extends Error {
  status: 400 | 404 | 409
  constructor(status: 400 | 404 | 409, message: string) {
    super(message)
    this.status = status
  }
}

type Row = Record<string, unknown>

function entityOf(app: ServedApp, name: string): NormalizedEntity {
  const e = app.manifest.entities.find((x) => x.name === name)
  if (!e) throw new ServiceError(404, `unknown entity: ${name}`)
  return e
}

const pkOf = (e: NormalizedEntity): NormalizedColumn => e.columns.find((c) => c.pk)!

const writable = (e: NormalizedEntity): NormalizedColumn[] => e.columns.filter((c) => !c.pk && !c.audit)

function checkValue(e: NormalizedEntity, c: NormalizedColumn, v: unknown): unknown {
  if (v === null) {
    if (c.notNull) throw new ServiceError(400, `${e.name}.${c.name} may not be null`)
    return null
  }
  const wantNumber = c.type === 'INTEGER' || c.type === 'REAL' || c.type === 'NUMERIC'
  if (wantNumber) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new ServiceError(400, `${e.name}.${c.name} must be a number`)
    return v
  }
  if (typeof v !== 'string') throw new ServiceError(400, `${e.name}.${c.name} must be a string`)
  return v
}

function pickPayload(e: NormalizedEntity, payload: Row, opts: { allowPk: boolean }): Map<string, unknown> {
  const cols = new Map(writable(e).map((c) => [c.name, c]))
  const pk = pkOf(e)
  const out = new Map<string, unknown>()
  for (const [k, v] of Object.entries(payload)) {
    if (opts.allowPk && k === pk.name) {
      out.set(k, checkValue(e, pk, v))
      continue
    }
    const col = cols.get(k)
    if (!col) throw new ServiceError(400, `unknown field: ${e.name}.${k}`) // deny-unknown
    out.set(k, checkValue(e, col, v))
  }
  return out
}

function guardWrite(app: ServedApp, dataRoot: string): ReturnType<typeof openAppData> {
  const data = openAppData(dataRoot, app)
  if (data.readOnly) throw new ServiceError(409, `app is mounted read-only: ${data.reason ?? 'unknown reason'}`)
  return data
}

export function listRows(
  dataRoot: string,
  app: ServedApp,
  entity: string,
  opts: { archived?: boolean; limit?: number } = {},
): Row[] {
  const e = entityOf(app, entity)
  const data = openAppData(dataRoot, app)
  const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? 500)), 1000)
  const where = opts.archived ? 'archived_at IS NOT NULL' : 'archived_at IS NULL'
  return data.db
    .prepare(`SELECT * FROM ${e.name} WHERE ${where} ORDER BY created_at, ${pkOf(e).name} LIMIT ?`)
    .all(limit) as Row[]
}

export function getRow(dataRoot: string, app: ServedApp, entity: string, id: string): Row {
  const e = entityOf(app, entity)
  const data = openAppData(dataRoot, app)
  const row = data.db.prepare(`SELECT * FROM ${e.name} WHERE ${pkOf(e).name} = ?`).get(id) as Row | undefined
  if (!row) throw new ServiceError(404, `${entity}: no row ${id}`)
  return row
}

export function createRow(dataRoot: string, app: ServedApp, entity: string, payload: Row): Row {
  const e = entityOf(app, entity)
  const data = guardWrite(app, dataRoot)
  const picked = pickPayload(e, payload, { allowPk: true })
  for (const c of writable(e)) {
    if (c.notNull && !picked.has(c.name)) throw new ServiceError(400, `missing required field: ${e.name}.${c.name}`)
  }
  const pk = pkOf(e)
  // Host-generated ids follow the DECLARED pk type: a UUID string suits a
  // TEXT pk only — an INTEGER PRIMARY KEY is SQLite's rowid alias, so omit
  // the id and let SQLite assign it (S-8 execution 2026-07-10: a
  // chat-designed blueprint declared INTEGER ids and every UUID insert
  // died as a datatype mismatch). An explicitly supplied id still wins.
  if (!picked.has(pk.name) && pk.type !== 'INTEGER') picked.set(pk.name, randomUUID())
  const now = new Date().toISOString()
  const auditNames = new Set(e.columns.filter((c) => c.audit).map((c) => c.name))
  if (auditNames.has('created_at')) picked.set('created_at', now)
  if (auditNames.has('updated_at')) picked.set('updated_at', now)
  const names = [...picked.keys()]
  let assignedId = picked.get(pk.name)
  try {
    const info = data.db
      .prepare(`INSERT INTO ${e.name} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
      .run(...names.map((n) => picked.get(n)))
    if (assignedId === undefined) assignedId = info.lastInsertRowid
  } catch (err) {
    throw new ServiceError(400, `insert refused: ${(err as Error).message}`)
  }
  return getRow(dataRoot, app, entity, String(assignedId))
}

export function updateRow(dataRoot: string, app: ServedApp, entity: string, id: string, payload: Row): Row {
  const e = entityOf(app, entity)
  const data = guardWrite(app, dataRoot)
  getRow(dataRoot, app, entity, id) // 404 before 400s
  const picked = pickPayload(e, payload, { allowPk: false })
  if (picked.size === 0) throw new ServiceError(400, 'no fields to update')
  const now = new Date().toISOString()
  if (e.columns.some((c) => c.audit && c.name === 'updated_at')) picked.set('updated_at', now)
  const sets = [...picked.keys()].map((n) => `${n} = ?`).join(', ')
  try {
    data.db
      .prepare(`UPDATE ${e.name} SET ${sets} WHERE ${pkOf(e).name} = ?`)
      .run(...[...picked.values()], id)
  } catch (err) {
    throw new ServiceError(400, `update refused: ${(err as Error).message}`)
  }
  return getRow(dataRoot, app, entity, id)
}

export function archiveRow(dataRoot: string, app: ServedApp, entity: string, id: string): Row {
  const e = entityOf(app, entity)
  const data = guardWrite(app, dataRoot)
  getRow(dataRoot, app, entity, id)
  const now = new Date().toISOString()
  data.db
    .prepare(`UPDATE ${e.name} SET archived_at = ?, updated_at = ? WHERE ${pkOf(e).name} = ?`)
    .run(now, now, id)
  return getRow(dataRoot, app, entity, id)
}

export interface MetricValue {
  name: string
  label: string
  value: number | string | null
  error?: string
}

export function metricValues(dataRoot: string, app: ServedApp): MetricValue[] {
  const data = openAppData(dataRoot, app)
  return app.manifest.metrics.map((m) => {
    try {
      const row = data.metricsDb.prepare(`SELECT * FROM metric_${m.name}`).get() as Row | undefined
      const value = row ? (Object.values(row)[0] as number | string | null) : null
      return { name: m.name, label: m.label, value }
    } catch (err) {
      // A broken view is a readable metric error, never a crash (rail 6).
      return { name: m.name, label: m.label, value: null, error: (err as Error).message }
    }
  })
}
