// The journey's eleven invariants (design/stories/test-spec-journey.md §2),
// as PURE functions over a vault snapshot. These are the contract `just
// journey` asserts after every step, and `just journey:verify` re-asserts
// read-only against a real vault's git history. Structural / ID-agnostic — no
// byte-identity or commit-SHA assertions (UUIDs and vault_commit dates are
// non-deterministic and are never asserted; check 1 compares record CONTENT
// across steps, which needs no id stability).
//
// A snapshot is the parsed contents of the self vault at one step. The runner
// builds it from the temp vault (CI mode) or from `git show` (verify mode);
// these functions never touch the filesystem, so they are trivially testable.

export interface Snapshot {
  /** me/commitments/<slug>.json */
  commitments: Record<string, unknown>[]
  /** me/outcomes/<slug>/<component>-NNN.json, flattened with their commitment
   * slug; `raw` is the original json string (append-only compare, check 1). */
  outcomes: { commitment: string; component: string; result: string; id?: string; raw?: string }[]
  /** me/edges.jsonl */
  edges: Edge[]
  /** me/mandates/<id>.json — injected test data (the mandate lane is SPL v3) */
  mandates: Mandate[]
  /** me/interventions/<id>.json — injected test data (journey §4) */
  interventions: Intervention[]
  /** me/superposition_state/<id>.json — the F-3 engine lane */
  superposition: Record<string, unknown>[]
  /** every path under me/ (relative), for the stray-file check */
  files: string[]
  /** vault git metadata the runner supplies (F11 / check 5) */
  vault: { hasRemote: boolean; dirName: string }
}

export interface Edge {
  id?: string
  type: string
  from: string
  to: string
  to_label?: string
  from_label?: string
  author: string
  created_at?: string
  note?: string
}

export interface Mandate {
  id: string
  scope?: string
  effective_at: string
  expires_at: string
  author: string
  // append-only suspend/resume/revoke events, if modeled inline for the fixture
  events?: { action: string; created_at: string }[]
}

export interface Intervention {
  id: string
  mandate_id: string
  intent?: string
  author: string
  created_at: string
  surface: {
    notice?: string
    options?: { label: string; text: string; in_user_draft?: boolean }[]
    cited_numbers?: { value: string; source: string; source_label?: string }[]
    // a `rank`/`score`/`recommended` field here would BE a ranking (check 10)
    [k: string]: unknown
  }
}

export interface CheckResult {
  check: number
  name: string
  pass: boolean
  detail?: string
}

const EDGE_TYPES = ['informed_by', 'serves', 'produced', 'closes', 'supersedes', 'dismisses']
const SUBJECTIVE = ['happy', 'unhappy', 'unchanged', 'refused_to_judge']
// The SPL result_type vocabulary (constitution §3; extensible but these are v1).
const OBSERVABLE = [
  'confirmed',
  'contradicted',
  'partially_confirmed',
  'became_irrelevant',
  'still_open',
  'refused_to_judge',
]

const SCOPE_ID = /^(world|self|artifact)\/[a-z_]+\/.+/

function nodeId(v: unknown): string | undefined {
  return typeof (v as { id?: unknown })?.id === 'string' ? (v as { id: string }).id : undefined
}

/** All self-scope node ids present in the snapshot (for reference resolution). */
function knownIds(s: Snapshot): Set<string> {
  const ids = new Set<string>()
  for (const c of s.commitments) { const id = nodeId(c); if (id) ids.add(id) }
  for (const sp of s.superposition) { const id = nodeId(sp); if (id) ids.add(id) }
  for (const m of s.mandates) ids.add(m.id)
  for (const iv of s.interventions) ids.add(iv.id)
  for (const o of s.outcomes) if (o.id) ids.add(o.id)
  return ids
}

// --- Check 1 — append-only (F2 / Inv 1) ---------------------------------
// Every record present in the PREVIOUS step is present, byte-for-byte in its
// json, in this step. New records may appear; nothing is edited or removed.
export function check1(prev: Snapshot | null, cur: Snapshot): CheckResult {
  const name = 'append-only: prior records unchanged'
  if (!prev) return { check: 1, name, pass: true, detail: 'first step' }
  const curByKey = new Map<string, string>()
  const key = (kind: string, id: string | undefined, fallback: string) => `${kind}:${id ?? fallback}`
  const index = (snap: Snapshot, into: Map<string, string>) => {
    snap.commitments.forEach((c, i) => into.set(key('commitment', nodeId(c), `#${i}`), JSON.stringify(c)))
    snap.superposition.forEach((c, i) => into.set(key('superposition', nodeId(c), `#${i}`), JSON.stringify(c)))
    // Compare outcomes by their ORIGINAL json (raw) so an in-place edit to a
    // field the flattened projection drops (note/recorded_at) is still caught.
    snap.outcomes.forEach((o, i) => into.set(key('outcome', o.id, `#${i}`), o.raw ?? JSON.stringify(o)))
    snap.edges.forEach((e, i) => into.set(key('edge', e.id, `#${i}`), JSON.stringify(e)))
    // Positional fallback for id-less records too, so two id-less records
    // cannot collide on one key and mask a disappearance/edit.
    snap.mandates.forEach((m, i) => into.set(key('mandate', m.id, `#${i}`), JSON.stringify(m)))
    snap.interventions.forEach((iv, i) => into.set(key('intervention', iv.id, `#${i}`), JSON.stringify(iv)))
  }
  index(cur, curByKey)
  const prevByKey = new Map<string, string>()
  index(prev, prevByKey)
  for (const [k, v] of prevByKey) {
    if (!curByKey.has(k)) return { check: 1, name, pass: false, detail: `record ${k} disappeared` }
    if (curByKey.get(k) !== v) return { check: 1, name, pass: false, detail: `record ${k} was edited in place` }
  }
  return { check: 1, name, pass: true }
}

// --- Check 2 — edge shape (§3) ------------------------------------------
export function check2(s: Snapshot): CheckResult {
  const name = 'every edge: to_label, valid type, valid scope-id endpoints'
  for (const e of s.edges) {
    if (!e.to_label || !e.to_label.trim()) return fail(2, name, `edge ${e.id ?? e.to} has no to_label`)
    if (!EDGE_TYPES.includes(e.type)) return fail(2, name, `edge ${e.id} has unknown type ${e.type}`)
    if (!SCOPE_ID.test(e.from)) return fail(2, name, `edge from '${e.from}' is not a scope id`)
    if (!SCOPE_ID.test(e.to)) return fail(2, name, `edge to '${e.to}' is not a scope id`)
  }
  return ok(2, name)
}

// --- Check 3 — close cardinality (NS-2) ---------------------------------
// A `closes` edge points to a real commitment; at most 1 observable outcome
// per commitment.
export function check3(s: Snapshot): CheckResult {
  const name = 'close points to a real commitment; ≤1 external-form outcome'
  const commitmentIds = new Set(s.commitments.map(nodeId).filter(Boolean) as string[])
  for (const e of s.edges.filter((e) => e.type === 'closes')) {
    if (e.to.startsWith('self/commitment/') && !commitmentIds.has(e.to)) {
      return fail(3, name, `closes edge points to missing commitment ${e.to}`)
    }
  }
  const observableCount = new Map<string, number>()
  for (const o of s.outcomes.filter((o) => o.component === 'observable')) {
    observableCount.set(o.commitment, (observableCount.get(o.commitment) ?? 0) + 1)
  }
  for (const [slug, n] of observableCount) {
    if (n > 1) return fail(3, name, `commitment ${slug} has ${n} external-form outcomes (max 1)`)
  }
  return ok(3, name)
}

// --- Check 4 — authorship (F3 / §9) -------------------------------------
// Commitments are ALWAYS user-authored. Edges are user-authored until the
// ai-initiative phase (the journey's superposition/intervention edges are the
// first author=ai edges; the runner sets aiEdgesAllowed once it reaches them).
export function check4(s: Snapshot, aiEdgesAllowed: boolean): CheckResult {
  const name = 'commitments author=user always; edges author=user until P4'
  for (const c of s.commitments) {
    const a = (c as { author?: string }).author
    if (a && a !== 'user') return fail(4, name, `commitment ${nodeId(c)} authored by '${a}', not user`)
  }
  if (!aiEdgesAllowed) {
    for (const e of s.edges) {
      if (e.author !== 'user') return fail(4, name, `edge ${e.id} authored by '${e.author}' before P4`)
    }
  }
  return ok(4, name)
}

// --- Check 5 — locality (F11 / Inv 20) ----------------------------------
export function check5(s: Snapshot): CheckResult {
  const name = 'self vault has no remote and is not a hidden folder'
  if (s.vault.hasRemote) return fail(5, name, 'the self vault has a git remote (F11 violation)')
  if (s.vault.dirName.startsWith('.')) return fail(5, name, `vault dir '${s.vault.dirName}' is hidden`)
  return ok(5, name)
}

// --- Check 6 — provenance mix from edges alone (F9) ---------------------
// Of the user's commitments, the proportion prompted by AI-routed (world/*)
// information — recomputable from `informed_by` edges alone.
export function check6(s: Snapshot): CheckResult {
  const name = 'provenance mix recomputable from edges alone'
  const commitmentIds = new Set(s.commitments.map(nodeId).filter(Boolean) as string[])
  let worldPrompted = 0
  const prompted = new Set<string>()
  for (const e of s.edges.filter((e) => e.type === 'informed_by')) {
    if (commitmentIds.has(e.from)) {
      prompted.add(e.from)
      if (e.to.startsWith('world/')) worldPrompted++
    }
  }
  const total = commitmentIds.size
  const mix = total === 0 ? 0 : worldPrompted / total
  return { check: 6, name, pass: true, detail: `world-prompted ${worldPrompted}/${total} = ${mix.toFixed(2)}` }
}

// --- Check 7 — broken reference carries a to_label (§10-A, headless form) -
// A cross-scope or dangling edge target still carries a non-empty to_label so
// the screen can display the record when id resolution fails.
export function check7(s: Snapshot): CheckResult {
  const name = 'a broken/cross-scope reference is displayable by to_label'
  const ids = knownIds(s)
  for (const e of s.edges) {
    const resolvable = e.to.startsWith('self/') && ids.has(e.to)
    if (!resolvable && (!e.to_label || !e.to_label.trim())) {
      return fail(7, name, `edge to '${e.to}' cannot resolve and has no to_label`)
    }
  }
  return ok(7, name)
}

// --- Check 8 — no stray files (F5 / §10-A) ------------------------------
export function check8(s: Snapshot): CheckResult {
  const name = 'no files outside the designated me/ lanes'
  const allowed = /^(commitments\/[^/]+\.json|outcomes\/[^/]+\/[^/]+\.json|edges\.jsonl|mandates\/[^/]+\.json|mandate_events\.jsonl|interventions\/[^/]+\.json|superposition_state\/[^/]+\.json)$/
  for (const f of s.files) {
    if (!allowed.test(f)) return fail(8, name, `stray file under me/: ${f}`)
  }
  return ok(8, name)
}

// --- Check 9 — mandate-external interventions = 0 (SPL Inv 12–13 / F15) --
// Every intervention references a mandate that was ACTIVE at the
// intervention's own created_at (existed, effective ≤ t < expires, not
// revoked, not suspended). Honestly scoped: "names an active mandate" — the
// semantic scope match (subject ⊆ mandate.scope) is not mechanized (free-text
// scope; recorded, not enforced — see the plan's honesty ledger).
export function check9(s: Snapshot): CheckResult {
  const name = 'every intervention references a mandate active at its timestamp'
  const byId = new Map(s.mandates.map((m) => [m.id, m]))
  for (const iv of s.interventions) {
    const m = byId.get(iv.mandate_id)
    if (!m) return fail(9, name, `intervention ${iv.id} references unknown mandate ${iv.mandate_id}`)
    const status = mandateStatusAt(m, iv.created_at)
    if (status !== 'active') {
      return fail(9, name, `intervention ${iv.id} fired under a ${status} mandate (${m.id})`)
    }
  }
  return ok(9, name)
}

export function mandateStatusAt(m: Mandate, atIso: string): 'active' | 'pending' | 'expired' | 'revoked' | 'suspended' {
  const t = Date.parse(atIso)
  const eff = Date.parse(m.effective_at)
  const exp = Date.parse(m.expires_at)
  // Fail CLOSED on an unparseable timestamp (mirror the engine's status_at):
  // never let a NaN comparison fall through to 'active'.
  if (Number.isNaN(t) || Number.isNaN(eff) || Number.isNaN(exp)) return 'expired'
  const events = (m.events ?? []).filter((e) => Date.parse(e.created_at) <= t)
  if (events.some((e) => e.action === 'revoke')) return 'revoked'
  if (t < eff) return 'pending'
  if (t >= exp) return 'expired'
  const suspendResume = events
    .filter((e) => e.action === 'suspend' || e.action === 'resume')
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  if (suspendResume.at(-1)?.action === 'suspend') return 'suspended'
  return 'active'
}

// --- Check 10 — intervention materiality (Inv 19 / audit doc) -----------
// no ranking (no rank/score/recommended field) / ≥2 options OR a single
// factual notice / all cited numbers carry a source scope-id.
export function check10(s: Snapshot): CheckResult {
  const name = 'interventions are material: no ranking, ≥2 options or a notice, numbers traceable'
  for (const iv of s.interventions) {
    const sf = iv.surface ?? {}
    for (const banned of ['rank', 'score', 'recommended', 'ranking']) {
      if (banned in sf) return fail(10, name, `intervention ${iv.id} surface carries a ranking field '${banned}'`)
      if ((sf.options ?? []).some((o) => banned in (o as Record<string, unknown>))) {
        return fail(10, name, `intervention ${iv.id} option carries a ranking field '${banned}'`)
      }
    }
    const n = (sf.options ?? []).length
    const hasNotice = !!sf.notice && sf.notice.trim().length > 0
    if (!(n >= 2 || (n === 0 && hasNotice))) {
      return fail(10, name, `intervention ${iv.id}: needs ≥2 options or a single notice (never exactly one option)`)
    }
    for (const cn of sf.cited_numbers ?? []) {
      if (!SCOPE_ID.test(cn.source)) {
        return fail(10, name, `intervention ${iv.id}: cited number '${cn.value}' source '${cn.source}' is not a record`)
      }
    }
  }
  return ok(10, name)
}

// --- Check 11 — two-outcome close (§3 / SPL split) ----------------------
// A closed commitment has exactly one observable (SPL result_type) + at least
// one subjective (happy/unhappy/unchanged/refused_to_judge) outcome. Enforced
// by the EXISTING outcome lane; the runner asserts it per close.
export function check11(s: Snapshot): CheckResult {
  const name = 'close = two outcomes: external-form (result_type) + felt-sense'
  for (const o of s.outcomes) {
    // The observable (external-form) vocabulary is EXTENSIBLE (constitution §3;
    // the engine validates SHAPE only) — match that: a lowercase_snake token,
    // so a legitimate future result_type is not a false-fail. OBSERVABLE stays
    // as the documented v1 set.
    if (o.component === 'observable' && !/^[a-z_]+$/.test(o.result)) {
      return fail(11, name, `observable outcome '${o.result}' on ${o.commitment} is not a lowercase_snake result_type`)
    }
    // The felt-sense vocabulary is CLOSED (3 words + refused_to_judge).
    if (o.component === 'subjective' && !SUBJECTIVE.includes(o.result)) {
      return fail(11, name, `felt-sense '${o.result}' on ${o.commitment} is not happy/unhappy/unchanged/refused_to_judge`)
    }
  }
  // For any commitment WITH outcomes, require the two-axis close.
  const byCommitment = new Map<string, Set<string>>()
  for (const o of s.outcomes) {
    if (!byCommitment.has(o.commitment)) byCommitment.set(o.commitment, new Set())
    byCommitment.get(o.commitment)!.add(o.component)
  }
  for (const [slug, comps] of byCommitment) {
    if (!comps.has('observable') || !comps.has('subjective')) {
      return fail(11, name, `commitment ${slug} closed without both external-form and felt-sense`)
    }
  }
  return ok(11, name)
}

function ok(check: number, name: string): CheckResult {
  return { check, name, pass: true }
}
function fail(check: number, name: string, detail: string): CheckResult {
  return { check, name, pass: false, detail }
}

export interface RunChecksOpts {
  prev?: Snapshot | null
  aiEdgesAllowed?: boolean
}

/** Run all eleven checks over a snapshot. */
export function runChecks(s: Snapshot, opts: RunChecksOpts = {}): CheckResult[] {
  return [
    check1(opts.prev ?? null, s),
    check2(s),
    check3(s),
    check4(s, opts.aiEdgesAllowed ?? false),
    check5(s),
    check6(s),
    check7(s),
    check8(s),
    check9(s),
    check10(s),
    check11(s),
  ]
}
