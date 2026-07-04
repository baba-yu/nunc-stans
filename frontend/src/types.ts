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

// A flattened News prediction (world scope), produced by the federation-side
// world adapter (frontend/scripts/build-world.mjs) from News's export. The
// world view reads these; nothing here is persisted into self (F6).
export interface WorldPrediction {
  /** the News prediction id; becomes `world/prediction/<id>` on an edge */
  id: string
  label: string
  scope: string | null
  summary: string | null
  date: string | null
}

// POST /self/edges body. The engine assigns `id` and `created_at`; the client
// must not send them (the engine rejects unknown fields).
export interface NewEdge {
  type: EdgeType
  from: string
  to: string
  to_label: string
  from_label?: string
  note?: string
  author: Author
}
