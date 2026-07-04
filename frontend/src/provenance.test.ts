import { describe, expect, it } from 'vitest'
import { provenanceMix } from './provenance'
import type { Commitment, Edge } from './types'

function commitment(id: string): Commitment {
  return { id, title: id, started_at: '2026-01-01', resources: { money_jpy: null, hours: null }, note: null }
}

function edge(from: string, type: Edge['type'], author: Edge['author']): Edge {
  return {
    id: `e-${from}-${type}-${author}`,
    type,
    from,
    to: 'world/item/x',
    to_label: 'x',
    author,
    created_at: '2026-01-01T00:00:00Z',
  }
}

describe('provenanceMix', () => {
  it('is 0/3 for the current vault (three commitments, no informed_by edges)', () => {
    const commitments = ['self/commitment/a', 'self/commitment/b', 'self/commitment/c'].map(commitment)
    const edges = [edge('self/commitment/a', 'serves', 'user')]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 0, total: 3, percent: 0 })
  })

  it('counts a commitment AI-prompted only via informed_by authored by ai or sensor', () => {
    const commitments = ['self/commitment/a', 'self/commitment/b'].map(commitment)
    const edges = [
      edge('self/commitment/a', 'informed_by', 'ai'), // counts
      edge('self/commitment/b', 'informed_by', 'user'), // author=user: not AI-routed
    ]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 1, total: 2, percent: 50 })
  })

  it('counts sensor as AI-routed and dedupes multiple edges to one commitment', () => {
    const commitments = [commitment('self/commitment/a')]
    const edges = [
      edge('self/commitment/a', 'informed_by', 'sensor'),
      edge('self/commitment/a', 'informed_by', 'ai'),
    ]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 1, total: 1, percent: 100 })
  })

  it('ignores informed_by edges whose source is not a known commitment', () => {
    const commitments = [commitment('self/commitment/a')]
    const edges = [edge('self/commitment/ghost', 'informed_by', 'ai')]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 0, total: 1, percent: 0 })
  })

  it('is 0% (not NaN) with no commitments', () => {
    expect(provenanceMix([], [])).toEqual({ aiPrompted: 0, total: 0, percent: 0 })
  })
})
