// The /strategy read-out rails (plan PE12; S-7's mechanical criterion):
// grounding ⊆ declared names is enforced in code — a violation FAILS the
// render — and the metrics-only prompt carries nothing but the declaration.
import { describe, expect, it } from 'vitest'
import {
  StrategyError,
  buildStrategyMessages,
  fetchServedApp,
  fetchServedMetrics,
  parseStrategyCard,
  strategyJsonSchema,
} from './strategy'
import type { ServedApp } from './strategy'
import { demoStrategyCard } from './llm/offline-demo'
import type { ServedMetric } from '../shared/types'

const APP: ServedApp = { slug: 'runway-tracker', version: 1, name: 'Runway Tracker' }
const METRICS: ServedMetric[] = [
  { name: 'monthly_external_income', label: 'Monthly external income', value: 3200 },
  { name: 'deals_in_discussion', label: 'Deals in discussion', value: 2 },
  { name: 'cash_runway', label: 'Cash runway (months)', value: 7.5 },
  { name: 'income_concentration', label: 'Income concentration', value: 0.8 },
]
const DECLARED = METRICS.map((m) => m.name)

const okJson = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response

/** Route fetches by URL suffix; anything unrouted is a 404. */
const fakeFetch = (routes: Record<string, unknown>): typeof fetch =>
  (async (url: string | URL) => {
    const u = String(url)
    for (const [suffix, data] of Object.entries(routes)) {
      if (u.endsWith(suffix)) return okJson(data)
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response
  }) as typeof fetch

describe('parseStrategyCard (the grounding gate)', () => {
  const card = {
    win: ' Income is diversifying. ',
    constraint: 'Runway is under 8 months.',
    risk_to_watch: 'Concentration rising again.',
    grounding: ['cash_runway', 'income_concentration', 'cash_runway'],
  }

  it('accepts a declared-only card, trimming and deduping', () => {
    const parsed = parseStrategyCard(card, DECLARED)
    expect(parsed.win).toBe('Income is diversifying.')
    expect(parsed.grounding).toEqual(['cash_runway', 'income_concentration'])
  })

  it('FAILS the render on a grounding entry outside the declaration, naming it', () => {
    const bad = { ...card, grounding: ['cash_runway', 'burn_rate'] }
    expect(() => parseStrategyCard(bad, DECLARED)).toThrowError(/"burn_rate"/)
    try {
      parseStrategyCard(bad, DECLARED)
    } catch (err) {
      expect(err).toBeInstanceOf(StrategyError)
      expect((err as StrategyError).code).toBe('grounding')
      expect((err as StrategyError).status).toBe(422)
    }
  })

  it('refuses an ungrounded card (empty grounding)', () => {
    expect(() => parseStrategyCard({ ...card, grounding: [] }, DECLARED)).toThrowError(/no declared metric/)
    expect(() => parseStrategyCard({ ...card, grounding: ['  '] }, DECLARED)).toThrowError(/no declared metric/)
  })

  it('refuses a missing or empty field, and non-object output', () => {
    expect(() => parseStrategyCard({ ...card, win: undefined }, DECLARED)).toThrowError(/"win"/)
    expect(() => parseStrategyCard({ ...card, constraint: '  ' }, DECLARED)).toThrowError(/"constraint"/)
    expect(() => parseStrategyCard(null, DECLARED)).toThrowError(/JSON object/)
    expect(() => parseStrategyCard([card], DECLARED)).toThrowError(/JSON object/)
    expect(() => parseStrategyCard({ ...card, grounding: 'cash_runway' }, DECLARED)).toThrowError(/array/)
  })
})

describe('buildStrategyMessages (metrics ONLY)', () => {
  it('carries the version stamp, every declared metric with its value, and the subset rule', () => {
    const msgs = buildStrategyMessages(APP, METRICS)
    expect(msgs).toHaveLength(2)
    const system = msgs[0].content
    expect(system).toContain('runway-tracker@v1')
    for (const m of METRICS) {
      expect(system).toContain(m.name)
      expect(system).toContain(String(m.value))
    }
    expect(system).toContain('never a name outside the list')
  })

  it('marks an errored metric unavailable instead of quoting a stale value', () => {
    const msgs = buildStrategyMessages(APP, [
      { name: 'cash_runway', label: 'Cash runway', value: null, error: 'no such table' },
    ])
    expect(msgs[0].content).toContain('unavailable (metric error)')
  })
})

describe('strategyJsonSchema (grammar-level guard)', () => {
  it('constrains grounding items to the declared names', () => {
    const schema = strategyJsonSchema(DECLARED) as {
      properties: { grounding: { items: { enum: string[] }; minItems: number } }
      required: string[]
    }
    expect(schema.properties.grounding.items.enum).toEqual(DECLARED)
    expect(schema.properties.grounding.minItems).toBe(1)
    expect(schema.required).toEqual(['win', 'constraint', 'risk_to_watch', 'grounding'])
  })
})

describe('served-app resolution (published API only)', () => {
  const list = [APP, { slug: 'other-app', version: 3, name: 'Other' }]

  it('resolves the served version for the slug', async () => {
    const app = await fetchServedApp('runway-tracker', fakeFetch({ '/api': list }), 'http://host')
    expect(app).toEqual(APP)
  })

  it('409s when the app has no served bundle', async () => {
    const err = await fetchServedApp('unserved', fakeFetch({ '/api': list }), 'http://host').catch((e) => e)
    expect(err).toBeInstanceOf(StrategyError)
    expect((err as StrategyError).code).toBe('not_served')
    expect((err as StrategyError).status).toBe(409)
  })

  it('502s when apps-host is down', async () => {
    const down = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const err = await fetchServedApp('runway-tracker', down, 'http://host').catch((e) => e)
    expect((err as StrategyError).code).toBe('unreachable')
    expect((err as StrategyError).status).toBe(502)
  })

  it('refuses a metric-less app — nothing can ground the read-out', async () => {
    const f = fakeFetch({ '/runway-tracker/api/metrics': [] })
    const err = await fetchServedMetrics('runway-tracker', f, 'http://host').catch((e) => e)
    expect((err as StrategyError).code).toBe('no_metrics')
    expect((err as StrategyError).status).toBe(422)
  })

  it('returns the served metric values', async () => {
    const f = fakeFetch({ '/runway-tracker/api/metrics': METRICS })
    await expect(fetchServedMetrics('runway-tracker', f, 'http://host')).resolves.toEqual(METRICS)
  })
})

describe('offline demo card (PE12 mock-degradation rule)', () => {
  it('passes the same grounding gate as live output, quoting real declared names', () => {
    const parsed = parseStrategyCard(demoStrategyCard(METRICS), DECLARED)
    expect(parsed.grounding.length).toBeGreaterThan(0)
    for (const g of parsed.grounding) expect(DECLARED).toContain(g)
  })

  it('stays valid with a single declared metric', () => {
    const one = METRICS.slice(0, 1)
    const parsed = parseStrategyCard(demoStrategyCard(one), one.map((m) => m.name))
    expect(parsed.grounding).toEqual(['monthly_external_income'])
  })
})
