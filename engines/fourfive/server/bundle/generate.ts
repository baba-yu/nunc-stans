import { createHash } from 'node:crypto'
import Database from 'better-sqlite3'
import type { Blueprint } from '../../shared/blueprint'

// The bundle generator (Phase E, plan PE2/PE3): a PURE, deterministic
// transform from a validated blueprint to the five bundle files. No LLM, no
// clock, no randomness — same blueprint, same bytes, asserted by test and
// relied on by the freeze contract (PE11: regeneration of a frozen version
// must reproduce the bundle byte-for-byte).
// The bundle is DATA ONLY: apps-host interprets it; nothing here is code to
// execute. Shapes are the contract (contracts/app-bundle.md, drafted T5).

export class GenerationError extends Error {}

export interface NormalizedColumn {
  name: string
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'NUMERIC' | 'BLOB'
  pk?: true
  fk?: string // "<entity>.<column>", only when the target entity is in this app
  notNull?: true
  unique?: true
  audit?: true // appended by the generator, maintained by the host
}

export interface NormalizedEntity {
  name: string
  description?: string
  columns: NormalizedColumn[]
}

export interface BundleFiles {
  'app.json': string
  'schema.sql': string
  'mcp-tools.json': string
  'ui.json': string
  'tests/scenarios.json': string
}

const IDENT = /^[a-z][a-z0-9_]*$/
// Path segments the apps-host API claims for itself under /apps/<slug>/api/.
// 'status' and 'tools' joined in Phase F: both are static host routes there
// ('status' pre-existed unrecorded; 'tools' now serves the declared tool
// surface over REST) — an entity with either name would be shadowed.
export const RESERVED_ENTITY_NAMES = new Set(['manifest', 'metrics', 'api', 'mcp', 'health', 'status', 'tools'])
const AUDIT = ['created_at', 'updated_at', 'archived_at'] as const
const FORBIDDEN_METRIC_SQL =
  /\b(attach|pragma|insert|update|delete|drop|alter|create|replace|vacuum|reindex|detach|begin|commit|rollback)\b/i

function ident(raw: string, what: string): string {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!IDENT.test(s)) {
    throw new GenerationError(`${what} ${JSON.stringify(raw)} cannot be expressed as an identifier (need snake_case)`)
  }
  return s
}

function sqlType(raw: string): NormalizedColumn['type'] {
  const t = raw.trim().toLowerCase()
  if (['int', 'integer', 'bool', 'boolean'].includes(t)) return 'INTEGER'
  if (['real', 'float', 'double', 'number'].includes(t)) return 'REAL'
  if (['numeric', 'decimal'].includes(t)) return 'NUMERIC'
  if (t === 'blob') return 'BLOB'
  return 'TEXT' // text/string/varchar/date/datetime/… — SQLite is happy with TEXT
}

export function normalizeEntities(bp: Blueprint): NormalizedEntity[] {
  const names = new Set<string>()
  const entities: NormalizedEntity[] = []
  for (const e of bp.entities) {
    const name = ident(e.name, 'entity')
    if (RESERVED_ENTITY_NAMES.has(name)) throw new GenerationError(`entity name ${JSON.stringify(name)} is reserved by the apps-host API`)
    if (names.has(name)) throw new GenerationError(`duplicate entity name ${JSON.stringify(name)}`)
    names.add(name)

    const colNames = new Set<string>()
    const columns: NormalizedColumn[] = []
    for (const c of e.columns) {
      const cn = ident(c.name, `column (${name})`)
      if (colNames.has(cn)) throw new GenerationError(`duplicate column ${JSON.stringify(cn)} in entity ${JSON.stringify(name)}`)
      colNames.add(cn)
      const col: NormalizedColumn = { name: cn, type: sqlType(c.type) }
      if (c.pk) col.pk = true
      if (c.pk || c.nullable === false) col.notNull = true
      if (c.unique) col.unique = true
      if (c.fk) col.fk = c.fk // resolved against sibling entities below
      columns.push(col)
    }

    const pks = columns.filter((c) => c.pk)
    if (pks.length > 1) throw new GenerationError(`entity ${JSON.stringify(name)} declares ${pks.length} primary keys (v0 supports one)`)
    if (pks.length === 0) columns.unshift({ name: 'id', type: 'TEXT', pk: true, notNull: true })

    for (const a of AUDIT) {
      if (!colNames.has(a)) {
        const audit: NormalizedColumn = { name: a, type: 'TEXT', audit: true }
        if (a !== 'archived_at') audit.notNull = true
        columns.push(audit)
      }
    }
    const entity: NormalizedEntity = { name, columns }
    if (e.description) entity.description = e.description
    entities.push(entity)
  }

  // Resolve fks: keep only references to entities of THIS app (dependency
  // namespaces and unknown targets degrade to plain columns — recorded rule).
  for (const e of entities) {
    for (const c of e.columns) {
      if (!c.fk) continue
      const m = c.fk.trim().toLowerCase().replace(/[\s-]+/g, '_').match(/^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/)
      const target = m ? entities.find((x) => x.name === m[1]) : undefined
      const targetCol = target?.columns.find((x) => x.name === m?.[2])
      if (target && targetCol) c.fk = `${target.name}.${targetCol.name}`
      else delete c.fk
    }
  }
  return entities
}

export function validateMetricSql(sql: string): void {
  const s = sql.trim()
  if (!/^select\b/i.test(s)) throw new GenerationError(`metric sql must be a single SELECT: ${JSON.stringify(sql)}`)
  if (s.includes(';')) throw new GenerationError('metric sql must be one statement (no ";")')
  const bad = s.match(FORBIDDEN_METRIC_SQL)
  if (bad) throw new GenerationError(`metric sql may not contain ${JSON.stringify(bad[0].toUpperCase())}`)
}

function ddl(entities: NormalizedEntity[], metrics: { name: string; sql: string }[]): string {
  const parts: string[] = []
  for (const e of entities) {
    const cols = e.columns.map((c) => {
      let line = `  ${c.name} ${c.type}`
      if (c.pk) line += ' PRIMARY KEY'
      if (c.notNull && !c.pk) line += ' NOT NULL'
      if (c.unique) line += ' UNIQUE'
      if (c.fk) {
        const [t, tc] = c.fk.split('.')
        line += ` REFERENCES ${t}(${tc})`
      }
      return line
    })
    parts.push(`CREATE TABLE IF NOT EXISTS ${e.name} (\n${cols.join(',\n')}\n);`)
  }
  for (const m of metrics) {
    parts.push(`CREATE VIEW IF NOT EXISTS metric_${m.name} AS\n${m.sql.trim()};`)
  }
  return parts.join('\n\n') + '\n'
}

// Prove the DDL actually applies and every metric view answers — on a
// throwaway in-memory DB, at generation time, so a broken metric is a 422 at
// the Generate button, not a runtime surprise in apps-host (rail 3).
function proveSchema(schema: string, metrics: { name: string }[]): void {
  const db = new Database(':memory:')
  try {
    db.exec(schema)
    for (const m of metrics) db.prepare(`SELECT * FROM metric_${m.name}`).get()
  } catch (err) {
    throw new GenerationError(`schema does not apply cleanly: ${(err as Error).message}`)
  } finally {
    db.close()
  }
}

const JSON_TYPE: Record<NormalizedColumn['type'], string> = {
  TEXT: 'string',
  INTEGER: 'number',
  REAL: 'number',
  NUMERIC: 'number',
  BLOB: 'string',
}

function writableColumns(e: NormalizedEntity): NormalizedColumn[] {
  return e.columns.filter((c) => !c.pk && !c.audit)
}

function toolsJson(slug: string, entities: NormalizedEntity[]): unknown {
  const tools: unknown[] = []
  for (const e of entities) {
    const props: Record<string, unknown> = {}
    const required: string[] = []
    for (const c of writableColumns(e)) {
      props[c.name] = { type: JSON_TYPE[c.type] }
      if (c.notNull) required.push(c.name)
    }
    const idParam = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }
    tools.push(
      {
        name: `${slug}_${e.name}_list`,
        description: `List ${e.name} rows (archived excluded unless archived=true)`,
        inputSchema: {
          type: 'object',
          properties: { archived: { type: 'boolean' }, limit: { type: 'number' } },
          additionalProperties: false,
        },
      },
      {
        name: `${slug}_${e.name}_get`,
        description: `Get one ${e.name} row by id`,
        inputSchema: idParam,
      },
      {
        name: `${slug}_${e.name}_create`,
        description: `Create a ${e.name} row`,
        inputSchema: { type: 'object', properties: props, required, additionalProperties: false },
      },
      {
        name: `${slug}_${e.name}_update`,
        description: `Update fields of a ${e.name} row`,
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, ...props },
          required: ['id'],
          additionalProperties: false,
        },
      },
      {
        name: `${slug}_${e.name}_archive`,
        description: `Archive (soft-delete) a ${e.name} row`,
        inputSchema: idParam,
      },
    )
  }
  return { tools }
}

function sampleValue(c: NormalizedColumn, variant: 1 | 2): unknown {
  switch (c.type) {
    case 'INTEGER':
    case 'NUMERIC':
      return variant
    case 'REAL':
      return variant + 0.5
    default:
      return variant === 1 ? `${c.name} sample` : `${c.name} updated`
  }
}

// The NOT NULL fk ancestors an entity's create depends on, innermost first.
function requiredAncestors(e: NormalizedEntity, all: NormalizedEntity[], seen: string[] = []): string[] {
  const out: string[] = []
  for (const c of e.columns) {
    if (!c.fk || !c.notNull) continue
    const target = c.fk.split('.')[0]
    if (seen.includes(target)) throw new GenerationError(`NOT NULL foreign-key cycle involving ${JSON.stringify(target)}`)
    const t = all.find((x) => x.name === target)!
    for (const a of [...requiredAncestors(t, all, [...seen, e.name]), target]) {
      if (!out.includes(a)) out.push(a)
    }
  }
  return out
}

function createPayload(e: NormalizedEntity): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const c of writableColumns(e)) {
    if (c.fk) {
      // The runner substitutes the id of the last-created row of the target.
      if (c.notNull) payload[c.name] = { $id: c.fk.split('.')[0] }
      continue
    }
    if (c.notNull || !c.unique) payload[c.name] = sampleValue(c, 1)
  }
  return payload
}

function scenariosJson(entities: NormalizedEntity[], metrics: { name: string }[]): unknown {
  const scenarios = entities.map((e) => {
    const steps: unknown[] = []
    for (const a of requiredAncestors(e, entities)) {
      const anc = entities.find((x) => x.name === a)!
      steps.push({ op: 'create', entity: a, payload: createPayload(anc) })
    }
    const writable = writableColumns(e).filter((c) => !c.fk)
    steps.push(
      { op: 'create', entity: e.name, payload: createPayload(e) },
      { op: 'list', entity: e.name, expect: { count: 1 } },
      { op: 'get', entity: e.name },
    )
    if (writable.length) {
      steps.push({ op: 'update', entity: e.name, payload: { [writable[0].name]: sampleValue(writable[0], 2) } })
    }
    steps.push(
      { op: 'archive', entity: e.name },
      { op: 'list', entity: e.name, expect: { count: 0 } },
      { op: 'list', entity: e.name, archived: true, expect: { count: 1 } },
    )
    return { name: `${e.name} crud`, steps }
  })
  if (metrics.length) {
    // One row per entity, created exactly once in dependency order (a
    // duplicate create could trip UNIQUE columns).
    const order: string[] = []
    for (const e of entities) {
      for (const n of [...requiredAncestors(e, entities), e.name]) {
        if (!order.includes(n)) order.push(n)
      }
    }
    scenarios.push({
      name: 'declared metrics answer',
      steps: [
        ...order.map((n) => ({ op: 'create', entity: n, payload: createPayload(entities.find((x) => x.name === n)!) })),
        ...metrics.map((m) => ({ op: 'metric', name: m.name, expect: { ok: true } })),
      ] as unknown[],
    })
  }
  return { scenarios }
}

const serialize = (v: unknown): string => JSON.stringify(v, null, 2) + '\n'

/**
 * blueprintRaw is the persisted blueprint.json BYTES (its hash pins the
 * bundle to the exact frozen source, F7); bp is the same content already
 * validated through the zod schema (which also defaults pre-E blueprints'
 * metrics/stories to []).
 */
export function generateBundle(bp: Blueprint, slug: string, version: number, blueprintRaw: string): BundleFiles {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) throw new GenerationError(`slug ${JSON.stringify(slug)} is not tool-name safe`)
  const entities = normalizeEntities(bp)
  if (entities.length === 0) throw new GenerationError('no entities to generate (design some tables first)')

  const metricNames = new Set<string>()
  for (const m of bp.metrics) {
    if (metricNames.has(m.name)) throw new GenerationError(`duplicate metric name ${JSON.stringify(m.name)}`)
    metricNames.add(m.name)
    validateMetricSql(m.sql)
  }

  const schema = ddl(entities, bp.metrics)
  proveSchema(schema, bp.metrics)

  const appJson: Record<string, unknown> = {
    slug,
    version,
    name: bp.app.name,
  }
  if (bp.app.description) appJson.description = bp.app.description
  appJson.entities = entities
  appJson.metrics = bp.metrics
  appJson.stories = bp.stories
  appJson.ui = { screens: bp.mock_ui.screens }
  appJson.blueprint_hash = createHash('sha256').update(blueprintRaw).digest('hex')

  return {
    'app.json': serialize(appJson),
    'schema.sql': schema,
    'mcp-tools.json': serialize(toolsJson(slug, entities)),
    'ui.json': serialize({ screens: bp.mock_ui.screens }),
    'tests/scenarios.json': serialize(scenariosJson(entities, bp.metrics)),
  }
}

/** Stable hash over the whole bundle: file names + bytes, sorted. */
export function bundleHash(files: BundleFiles): string {
  const h = createHash('sha256')
  for (const name of Object.keys(files).sort()) {
    h.update(name).update('\0').update(files[name as keyof BundleFiles]).update('\0')
  }
  return h.digest('hex')
}
