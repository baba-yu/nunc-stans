import { describe, expect, it } from 'vitest'
import { validateBlueprint } from './blueprint-schema'

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
