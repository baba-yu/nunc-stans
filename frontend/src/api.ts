import type { CommitmentsResponse, EdgesResponse, NewCommitment } from './types'

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
