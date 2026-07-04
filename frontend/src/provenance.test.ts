import { describe, expect, it } from 'vitest'
import { provenanceMix } from './provenance'
import type { Commitment, Edge } from './types'

function commitment(id: string): Commitment {
  return { id, title: id, started_at: '2026-01-01', resources: { money_jpy: null, hours: null }, note: null }
}

function edge(from: string, type: Edge['type'], to: string, author: Edge['author'] = 'user'): Edge {
  return {
    id: `e-${from}-${type}-${to}`,
    type,
    from,
    to,
    to_label: 'x',
    author,
    created_at: '2026-01-01T00:00:00Z',
  }
}

describe('provenanceMix (F9: informed_by to a world/* node = AI-routed)', () => {
  it('is 0/3 for the current vault (three commitments, only serves edges)', () => {
    const commitments = ['self/commitment/a', 'self/commitment/b', 'self/commitment/c'].map(commitment)
    const edges = [edge('self/commitment/a', 'serves', 'self/prediction/p2')]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 0, total: 3, percent: 0 })
  })

  it('counts a commitment AI-prompted when its informed_by targets world/*', () => {
    const commitments = ['self/commitment/a', 'self/commitment/b'].map(commitment)
    const edges = [
      edge('self/commitment/a', 'informed_by', 'world/prediction/prediction.abc'), // AI-routed
      edge('self/commitment/b', 'informed_by', 'self/prediction/mine'), // the user's own: not AI-routed
    ]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 1, total: 2, percent: 50 })
  })

  it('keys on target scope, not edge author (the button writes author=user)', () => {
    const commitments = [commitment('self/commitment/a')]
    // A user-authored informed_by edge to a News headline still counts.
    const edges = [edge('self/commitment/a', 'informed_by', 'world/prediction/prediction.xyz', 'user')]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 1, total: 1, percent: 100 })
  })

  it('dedupes multiple world edges to one commitment', () => {
    const commitments = [commitment('self/commitment/a')]
    const edges = [
      edge('self/commitment/a', 'informed_by', 'world/prediction/p1'),
      edge('self/commitment/a', 'informed_by', 'world/prediction/p2'),
    ]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 1, total: 1, percent: 100 })
  })

  it('ignores informed_by edges whose source is not a known commitment', () => {
    const commitments = [commitment('self/commitment/a')]
    const edges = [edge('self/commitment/ghost', 'informed_by', 'world/prediction/p1')]
    expect(provenanceMix(commitments, edges)).toEqual({ aiPrompted: 0, total: 1, percent: 0 })
  })

  it('is 0% (not NaN) with no commitments', () => {
    expect(provenanceMix([], [])).toEqual({ aiPrompted: 0, total: 0, percent: 0 })
  })
})
