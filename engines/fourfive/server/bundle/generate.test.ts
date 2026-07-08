import { describe, expect, it } from 'vitest'
import { generateBundle, bundleHash, validateMetricSql, GenerationError } from './generate'
import type { Blueprint } from '../../shared/blueprint'

const bp = (over: Partial<Blueprint> = {}): Blueprint => ({
  app: { name: 'Runway Tracker' },
  mock_ui: { screens: [] },
  entities: [
    {
      name: 'Deals',
      columns: [
        { name: 'name', type: 'text', nullable: false },
        { name: 'status', type: 'text' },
        { name: 'expected value', type: 'number' },
      ],
    },
    {
      name: 'notes',
      columns: [
        { name: 'id', type: 'TEXT', pk: true },
        { name: 'deal_id', type: 'TEXT', fk: 'deals.id', nullable: false },
        { name: 'body', type: 'text' },
      ],
    },
  ],
  business_logic: [],
  terminology: [],
  apis: [],
  open_questions: [],
  state_transitions: [],
  metrics: [{ name: 'deal_count', label: 'Deals', sql: 'SELECT COUNT(*) FROM deals' }],
  stories: [{ id: 'st-1', title: 'Track a deal', scenario: 'Add one; count moves.' }],
  ...over,
})

describe('generateBundle', () => {
  it('is deterministic: same blueprint, same bytes, same hash', () => {
    const raw = JSON.stringify(bp())
    const a = generateBundle(bp(), 'runway-tracker', 1, raw)
    const b = generateBundle(bp(), 'runway-tracker', 1, raw)
    expect(a).toEqual(b)
    expect(bundleHash(a)).toBe(bundleHash(b))
  })

  it('generates DDL with injected id, audit columns, constraints, resolved fk', () => {
    const schema = generateBundle(bp(), 'x', 1, '{}')['schema.sql']
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS deals')
    expect(schema).toContain('id TEXT PRIMARY KEY') // injected for deals
    expect(schema).toContain('name TEXT NOT NULL')
    expect(schema).toContain('expected_value REAL') // "expected value" sanitized
    expect(schema).toContain('created_at TEXT NOT NULL')
    expect(schema).toContain('archived_at TEXT')
    expect(schema).toContain('deal_id TEXT NOT NULL REFERENCES deals(id)')
    expect(schema).toContain('CREATE VIEW IF NOT EXISTS metric_deal_count')
  })

  it('drops fks whose target is not an entity of this app', () => {
    const b = bp()
    b.entities[1].columns[1] = { name: 'deal_id', type: 'TEXT', fk: 'inventory.products' }
    const schema = generateBundle(b, 'x', 1, '{}')['schema.sql']
    expect(schema).not.toContain('REFERENCES inventory')
  })

  it('refuses a metric whose sql does not apply (unknown column)', () => {
    const b = bp({ metrics: [{ name: 'broken', label: 'x', sql: 'SELECT SUM(nope) FROM deals' }] })
    expect(() => generateBundle(b, 'x', 1, '{}')).toThrow(GenerationError)
  })

  it('refuses reserved and duplicate entity names', () => {
    expect(() =>
      generateBundle(bp({ entities: [{ name: 'metrics', columns: [] }] }), 'x', 1, '{}'),
    ).toThrow(/reserved/)
    expect(() =>
      generateBundle(
        bp({ entities: [{ name: 'a', columns: [] }, { name: 'A', columns: [] }] }),
        'x',
        1,
        '{}',
      ),
    ).toThrow(/duplicate/)
  })

  it('names tools <slug>_<entity>_<verb> and requires NOT NULL create fields', () => {
    const tools = JSON.parse(generateBundle(bp(), 'runway-tracker', 1, '{}')['mcp-tools.json']) as {
      tools: { name: string; inputSchema: { required?: string[] } }[]
    }
    const names = tools.tools.map((t) => t.name)
    expect(names).toContain('runway-tracker_deals_list')
    expect(names).toContain('runway-tracker_notes_archive')
    expect(names.every((n) => /^[a-zA-Z0-9_-]+$/.test(n))).toBe(true)
    const create = tools.tools.find((t) => t.name === 'runway-tracker_deals_create')!
    expect(create.inputSchema.required).toContain('name')
  })

  it('threads NOT NULL fk ancestors through scenarios via $id tokens', () => {
    const scen = JSON.parse(generateBundle(bp(), 'x', 1, '{}')['tests/scenarios.json']) as {
      scenarios: { name: string; steps: { op: string; entity?: string; payload?: Record<string, unknown> }[] }[]
    }
    const notes = scen.scenarios.find((s) => s.name === 'notes crud')!
    expect(notes.steps[0]).toMatchObject({ op: 'create', entity: 'deals' })
    const noteCreate = notes.steps.find((s) => s.op === 'create' && s.entity === 'notes')!
    expect(noteCreate.payload?.deal_id).toEqual({ $id: 'deals' })
    const metrics = scen.scenarios.find((s) => s.name === 'declared metrics answer')!
    expect(metrics.steps.at(-1)).toMatchObject({ op: 'metric', name: 'deal_count' })
  })

  it('refuses to generate with zero entities', () => {
    expect(() => generateBundle(bp({ entities: [] }), 'x', 1, '{}')).toThrow(/no entities/)
  })
})

describe('validateMetricSql', () => {
  it('accepts a single SELECT', () => {
    expect(() => validateMetricSql('SELECT COUNT(*) FROM deals')).not.toThrow()
  })
  it('rejects writes, multi-statements, and pragmas', () => {
    for (const sql of [
      'UPDATE deals SET name = 1',
      'SELECT 1; DROP TABLE deals',
      'PRAGMA journal_mode',
      'SELECT 1; --',
      "ATTACH DATABASE 'x' AS y",
      'select * from deals where 1=1; delete from deals',
    ]) {
      expect(() => validateMetricSql(sql), sql).toThrow(GenerationError)
    }
  })
})
