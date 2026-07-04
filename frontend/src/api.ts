import type { CommitmentsResponse, EdgesResponse, NewCommitment, NewEdge, WorldPrediction } from './types'

// Read a response whether the engine answered with its JSON error contract
// ({error: ...}) or axum answered with a plain-text extractor rejection
// (4xx/415 with a text body). Never let response parsing throw.
async function readResult<T>(r: Response): Promise<T | { error: string }> {
  const text = await r.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { error: text || `HTTP ${r.status}` }
  }
}

export async function getCommitments(): Promise<CommitmentsResponse> {
  const r = await fetch('/self/commitments')
  if (!r.ok) throw new Error(`GET /self/commitments: HTTP ${r.status}`)
  return r.json()
}

export async function getEdges(): Promise<EdgesResponse> {
  const r = await fetch('/self/edges')
  if (!r.ok) throw new Error(`GET /self/edges: HTTP ${r.status}`)
  return r.json()
}

export interface AuthorResult {
  ok: boolean
  id?: string
  vault_committed?: boolean
  error?: string
}

export async function createCommitment(body: NewCommitment): Promise<AuthorResult> {
  const r = await fetch('/self/commitments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const out = await readResult<{ id: string; vault_committed: boolean }>(r)
  if (r.ok && 'id' in out) {
    return { ok: true, id: out.id, vault_committed: out.vault_committed }
  }
  return { ok: false, error: 'error' in out ? out.error : `HTTP ${r.status}` }
}

export interface EdgeResult {
  ok: boolean
  error?: string
}

export async function appendEdge(body: NewEdge): Promise<EdgeResult> {
  const r = await fetch('/self/edges', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const out = await readResult<{ edge: unknown }>(r)
  if (r.ok) return { ok: true }
  return { ok: false, error: 'error' in out ? (out as { error: string }).error : `HTTP ${r.status}` }
}

// The world view's data: News headlines flattened by the federation-side
// adapter and served as a static file (same origin). Absent file (adapter not
// run / NEWS_WORLD unset) degrades to an empty world view, not an error.
export async function getWorld(): Promise<WorldPrediction[]> {
  try {
    const r = await fetch('/world-headlines.json')
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
