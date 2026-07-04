// These types mirror contracts/edge.schema.json and the nuncstans-engine's
// self-scope records. The JSON Schema in contracts/ is the source of truth;
// keep these in sync with it, not the other way round. The frontend never
// imports engine internals — it only speaks the wire shapes over HTTP.

export type EdgeType =
  | 'informed_by'
  | 'serves'
  | 'produced'
  | 'closes'
  | 'supersedes'
  | 'dismisses'

export type Author = 'user' | 'ai' | 'sensor'

export interface Edge {
  id: string
  type: EdgeType
  from: string
  to: string
  to_label: string
  from_label?: string
  author: Author
  created_at: string
  note?: string
}

export interface Resources {
  money_jpy: number | null
  hours: number | null
}

export interface Commitment {
  id: string
  title: string
  started_at: string
  resources: Resources
  note: string | null
}

export interface Outcome {
  id: string
  commitment: string
  component: 'observable' | 'subjective'
  result: string
  note: string | null
  recorded_at: string
}

// Response envelopes from the engine.
export interface CommitmentsResponse {
  commitments: Commitment[]
  malformed_skipped: number
}

export interface EdgesResponse {
  edges: Edge[]
  malformed_skipped: number
}

export interface NewCommitment {
  slug: string
  title: string
  started_at: string
  resources: Resources
  note: string | null
}
