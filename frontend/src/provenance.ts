import type { Commitment, Edge } from './types'

export interface ProvenanceMix {
  /** commitments prompted by AI-routed information */
  aiPrompted: number
  /** total commitments */
  total: number
  /** aiPrompted / total, rounded to a percentage (0 when total is 0) */
  percent: number
}

// F9: of my own bets, the proportion prompted by AI-routed information. A
// commitment is AI-prompted iff it is the source (`from`) of an `informed_by`
// edge whose author is `ai` or `sensor`. Computed from edges alone and
// recomputed on the client, never asserted (journey check 6).
export function provenanceMix(commitments: Commitment[], edges: Edge[]): ProvenanceMix {
  const commitmentIds = new Set(commitments.map((c) => c.id))
  const aiPromptedIds = new Set<string>()
  for (const e of edges) {
    if (
      e.type === 'informed_by' &&
      (e.author === 'ai' || e.author === 'sensor') &&
      commitmentIds.has(e.from)
    ) {
      aiPromptedIds.add(e.from)
    }
  }
  const total = commitments.length
  const aiPrompted = aiPromptedIds.size
  const percent = total ? Math.round((aiPrompted / total) * 100) : 0
  return { aiPrompted, total, percent }
}
