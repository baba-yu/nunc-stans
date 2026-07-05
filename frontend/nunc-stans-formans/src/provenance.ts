import type { Commitment, Edge } from './types'

export interface ProvenanceMix {
  /** commitments prompted by AI-routed information */
  aiPrompted: number
  /** total commitments */
  total: number
  /** aiPrompted / total, rounded to a percentage (0 when total is 0) */
  percent: number
}

// F9 (constitution §5): "the proportion prompted by AI-routed information",
// computable from edges alone. A commitment is AI-prompted iff it is the source
// (`from`) of an `informed_by` edge (§3: "what prompted this bet") whose TARGET
// is a `world/*` node — i.e. a News item, which is AI-routed world intelligence
// (§6.1). What makes it AI-routed is the target scope, NOT the edge author: in
// Phase 3 the "create a commitment from this headline" button writes a
// user-authored edge (F3; author=ai edges are gated to Phase 4). An informed_by
// edge to a `self/*` prediction (the user's own) is not AI-routed and does not
// count. Recomputed on the client, never asserted (journey check 6).
export function provenanceMix(commitments: Commitment[], edges: Edge[]): ProvenanceMix {
  const commitmentIds = new Set(commitments.map((c) => c.id))
  const aiPromptedIds = new Set<string>()
  for (const e of edges) {
    if (
      e.type === 'informed_by' &&
      e.to.startsWith('world/') &&
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
