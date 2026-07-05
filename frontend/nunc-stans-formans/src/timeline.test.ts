import { describe, expect, it } from 'vitest'
import { buildWeeks, isoWeekKey } from './timeline'
import type { Commitment, Edge, Outcome } from './types'

describe('isoWeekKey', () => {
  it('buckets plain dates and rfc3339 timestamps', () => {
    expect(isoWeekKey('2026-06-29')).toBe('2026-W27') // a Monday
    expect(isoWeekKey('2026-07-05')).toBe('2026-W27') // its Sunday
    expect(isoWeekKey('2026-07-06')).toBe('2026-W28')
    expect(isoWeekKey('2026-06-29T10:00:00Z')).toBe('2026-W27')
  })

  it('handles ISO year boundaries', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01') // a Thursday
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53') // Friday of 2026-W53
  })
})

function c(slug: string, started: string): Commitment {
  return {
    id: `self/commitment/${slug}`,
    title: slug,
    started_at: started,
    resources: { money_jpy: null, hours: null },
    note: null,
  }
}

describe('buildWeeks', () => {
  const c1 = c('tl-a', '2026-06-29')
  const c2 = c('tl-b', '2026-07-01')
  const informed: Edge = {
    id: 'e1',
    type: 'informed_by',
    from: c1.id,
    to: 'world/prediction/x',
    to_label: 'seed headline',
    author: 'user',
    created_at: '2026-06-29T10:00:00Z',
  }
  const closeA: Outcome = {
    id: 'o1',
    commitment: c1.id,
    component: 'observable',
    result: 'confirmed',
    note: null,
    recorded_at: '2026-07-06T09:00:00Z',
  }

  it('buckets opens, closes, edges, and the weekly mix', () => {
    const weeks = buildWeeks([c1, c2], [informed], [closeA])
    expect(weeks.map((w) => w.key)).toEqual(['2026-W27', '2026-W28'])
    const [w27, w28] = weeks
    expect(w27.opened).toEqual([c1.id, c2.id])
    expect(w27.edges.user).toBe(1)
    // Of the two commitments opened in W27, one has an informed_by → world/*
    // edge: 1/2 = 50%.
    expect(w27.mix).toEqual({ aiPrompted: 1, total: 2, percent: 50 })
    expect(w28.closed).toEqual([c1.id])
    expect(w28.opened).toEqual([])
    expect(w28.mix.total).toBe(0)
  })

  it('keeps empty weeks between events (a gap is information)', () => {
    const lateClose: Outcome = { ...closeA, recorded_at: '2026-07-20T09:00:00Z' }
    const weeks = buildWeeks([c1], [], [lateClose])
    expect(weeks.map((w) => w.key)).toEqual(['2026-W27', '2026-W28', '2026-W29', '2026-W30'])
    expect(weeks[1].opened).toEqual([])
    expect(weeks[3].closed).toEqual([c1.id])
  })

  it('ignores subjective outcomes for the close marker', () => {
    const felt: Outcome = { ...closeA, component: 'subjective', result: 'happy' }
    const weeks = buildWeeks([c1], [], [felt])
    expect(weeks.every((w) => w.closed.length === 0)).toBe(true)
  })

  it('returns nothing for an empty vault', () => {
    expect(buildWeeks([], [], [])).toEqual([])
  })
})
