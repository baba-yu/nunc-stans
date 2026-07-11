import { describe, expect, it } from 'vitest'
import { blueprintResponseJsonSchema, blueprintSchema, validateBlueprint } from './blueprint-schema'

// Phase E: metrics[] / stories[] arrive as optional collections — every
// pre-E persisted blueprint must keep parsing (plan derived decision), and
// metric names are identifier-checked at this first trust boundary (PE8).

const PRE_E_BLUEPRINT = {
  app: { name: 'Legacy App' },
  mock_ui: { screens: [] },
  entities: [{ name: 'items', columns: [{ name: 'id', type: 'TEXT', pk: true }] }],
  business_logic: [],
  terminology: [],
  apis: [],
  open_questions: [],
  state_transitions: [],
  // no metrics, no stories — the pre-Phase-E shape
}

describe('blueprint schema (Phase E fields)', () => {
  it('parses a pre-E blueprint, defaulting metrics/stories to []', () => {
    const r = validateBlueprint(PRE_E_BLUEPRINT)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.metrics).toEqual([])
      expect(r.data.stories).toEqual([])
    }
  })

  it('accepts a declared metric and a story', () => {
    const r = validateBlueprint({
      ...PRE_E_BLUEPRINT,
      metrics: [{ name: 'open_items', label: 'Open items', sql: 'SELECT COUNT(*) FROM items' }],
      stories: [{ id: 'st-1', title: 'Track items', scenario: 'Add an item; the count moves.' }],
    })
    expect(r.success).toBe(true)
  })

  it('rejects a metric name that is not a snake_case identifier', () => {
    for (const name of ['Open Items', 'open-items', '1open', 'metric_<x>', '']) {
      const r = validateBlueprint({
        ...PRE_E_BLUEPRINT,
        metrics: [{ name, label: 'x', sql: 'SELECT 1' }],
      })
      expect(r.success, `name ${JSON.stringify(name)} should be rejected`).toBe(false)
    }
  })

  it('rejects a metric with empty sql or label', () => {
    expect(
      validateBlueprint({ ...PRE_E_BLUEPRINT, metrics: [{ name: 'a', label: '', sql: 'SELECT 1' }] }).success,
    ).toBe(false)
    expect(
      validateBlueprint({ ...PRE_E_BLUEPRINT, metrics: [{ name: 'a', label: 'A', sql: '' }] }).success,
    ).toBe(false)
  })
})

describe('blueprintResponseJsonSchema (constrained-decoding mirror)', () => {
  const objectSchema = blueprintResponseJsonSchema.anyOf[0] as unknown as {
    properties: Record<string, unknown>
    required: string[]
  }

  it('offers the null escape hatch — "not enough info yet" stays expressible under the grammar', () => {
    expect(blueprintResponseJsonSchema.anyOf.some((s) => (s as { type?: string }).type === 'null')).toBe(true)
  })

  it('mirrors the zod key set, software_stack excluded (user-owned, the LLM never sets it)', () => {
    const mirrored = Object.keys(objectSchema.properties).sort()
    const zodKeys = Object.keys(blueprintSchema.shape)
      .filter((k) => k !== 'software_stack')
      .sort()
    expect(mirrored).toEqual(zodKeys)
  })

  it('requires only app — everything else is defaulted by zod on the way in', () => {
    expect(objectSchema.required).toEqual(['app'])
  })
})
