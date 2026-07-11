// Self-test for the eleven journey checks: a clean snapshot passes all eleven,
// and each targeted violation fails exactly the check that owns it. Runnable
// with `node tests/journey/checks.selftest.ts` (node type-stripping) — no
// vitest, no workspace package. `just journey` runs this as the checks gate.
import assert from 'node:assert/strict'
import { runChecks, check1, mandateStatusAt } from './checks.ts'
import type { Snapshot } from './checks.ts'

let passed = 0
const t = (name: string, fn: () => void) => {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (e) {
    console.error(`  FAIL ${name}: ${(e as Error).message}`)
    process.exitCode = 1
  }
}

/** A clean, journey-shaped snapshot that passes all eleven checks. */
function clean(): Snapshot {
  return {
    commitments: [
      { id: 'self/commitment/2025-08-gpu-server', author: 'user', title: 'GPU server' },
      { id: 'self/commitment/bet-l', author: 'user', title: 'meetup talk' },
    ],
    outcomes: [
      { commitment: 'bet-l', component: 'observable', result: 'contradicted', id: 'self/outcome/bet-l/observable-001' },
      { commitment: 'bet-l', component: 'subjective', result: 'unhappy', id: 'self/outcome/bet-l/subjective-001' },
    ],
    edges: [
      {
        id: 'e1', type: 'serves', from: 'self/commitment/bet-l', to: 'self/prediction/p2',
        to_label: 'P2 local-AI demand', author: 'user',
      },
      {
        id: 'e2', type: 'informed_by', from: 'self/commitment/bet-l', to: 'world/prediction/abc',
        to_label: 'small-firm local-AI uptake', author: 'user',
      },
    ],
    mandates: [
      {
        id: 'self/mandate/m1', scope: 'independence / career', author: 'user',
        effective_at: '2026-01-02T00:00:00Z', expires_at: '2026-04-02T00:00:00Z',
      },
    ],
    interventions: [
      {
        id: 'self/intervention/i1', mandate_id: 'self/mandate/m1', author: 'ai',
        intent: 'surface the promotion terrain', created_at: '2026-02-01T00:00:00Z',
        surface: {
          notice: 'a prediction your bet targets was revised downward',
          options: [
            { label: 'A', text: 'accept', in_user_draft: true },
            { label: 'B', text: 'refuse and stay', in_user_draft: true },
            { label: 'D', text: 'negotiate 80% + IP clause', in_user_draft: false },
          ],
          cited_numbers: [
            { value: '14 months', source: 'artifact/artifact_version/runway-tracker@v1', source_label: 'cash_runway' },
          ],
        },
      },
    ],
    superposition: [
      { id: 'self/superposition_state/s1', author: 'ai', win: 'income diversifying' },
    ],
    files: [
      'commitments/2025-08-gpu-server.json',
      'commitments/bet-l.json',
      'outcomes/bet-l/observable-001.json',
      'outcomes/bet-l/subjective-001.json',
      'edges.jsonl',
      'mandates/m1.json',
      'interventions/i1.json',
      'superposition_state/s1.json',
    ],
    vault: { hasRemote: false, dirName: 'self' },
  }
}

const failing = (s: Snapshot, n: number, aiEdgesAllowed = true) =>
  runChecks(s, { aiEdgesAllowed }).find((r) => r.check === n)!

// The happy path: all eleven pass.
t('a clean journey snapshot passes all eleven checks', () => {
  const results = runChecks(clean(), { aiEdgesAllowed: true })
  const failed = results.filter((r) => !r.pass)
  assert.equal(failed.length, 0, `unexpected failures: ${JSON.stringify(failed)}`)
  assert.equal(results.length, 11)
})

// Check 1 — append-only.
t('check 1 catches an edited-in-place prior record', () => {
  const prev = clean()
  const cur = clean()
  ;(cur.commitments[0] as { title: string }).title = 'GPU server (edited!)'
  assert.equal(check1(prev, cur).pass, false)
})
t('check 1 catches a disappeared prior record', () => {
  const prev = clean()
  const cur = clean()
  cur.commitments.pop()
  assert.equal(check1(prev, cur).pass, false)
})
t('check 1 allows appends (new records)', () => {
  const prev = clean()
  const cur = clean()
  cur.commitments.push({ id: 'self/commitment/new', author: 'user' })
  assert.equal(check1(prev, cur).pass, true)
})

// Check 2 — edge shape.
t('check 2 fails an edge with no to_label', () => {
  const s = clean()
  s.edges[0].to_label = ''
  assert.equal(failing(s, 2).pass, false)
})
t('check 2 fails an edge with a non-scope-id endpoint', () => {
  const s = clean()
  s.edges[0].to = 'not-a-scope-id'
  assert.equal(failing(s, 2).pass, false)
})

// Check 3 — close cardinality.
t('check 3 fails a second external-form outcome', () => {
  const s = clean()
  s.outcomes.push({ commitment: 'bet-l', component: 'observable', result: 'confirmed', id: 'x' })
  assert.equal(failing(s, 3).pass, false)
})
t('check 3 fails a close edge to a missing commitment', () => {
  const s = clean()
  s.edges.push({ id: 'c', type: 'closes', from: 'self/outcome/x', to: 'self/commitment/ghost', to_label: 'ghost', author: 'user' })
  assert.equal(failing(s, 3).pass, false)
})

// Check 4 — authorship.
t('check 4 fails a non-user commitment', () => {
  const s = clean()
  ;(s.commitments[0] as { author: string }).author = 'ai'
  assert.equal(failing(s, 4).pass, false)
})
t('check 4 fails an ai edge before P4', () => {
  const s = clean()
  s.edges[0].author = 'ai'
  assert.equal(runChecks(s, { aiEdgesAllowed: false }).find((r) => r.check === 4)!.pass, false)
})
t('check 4 permits ai edges once P4 is reached', () => {
  const s = clean()
  s.edges.push({ id: 'ib', type: 'informed_by', from: 'self/superposition_state/s1', to: 'artifact/artifact_version/runway-tracker@v1', to_label: 'runway-tracker@v1', author: 'ai' })
  assert.equal(runChecks(s, { aiEdgesAllowed: true }).find((r) => r.check === 4)!.pass, true)
})

// Check 5 — locality.
t('check 5 fails a vault with a remote', () => {
  const s = clean()
  s.vault.hasRemote = true
  assert.equal(failing(s, 5).pass, false)
})
t('check 5 fails a hidden vault dir', () => {
  const s = clean()
  s.vault.dirName = '.self'
  assert.equal(failing(s, 5).pass, false)
})

// Check 6 — provenance mix.
t('check 6 recomputes the world-prompted mix from edges', () => {
  const r = failing(clean(), 6)
  assert.match(r.detail!, /world-prompted 1\/2 = 0\.50/)
})

// Check 7 — broken reference by to_label.
t('check 7 passes a dangling reference that carries a to_label', () => {
  // e2 points at world/prediction/abc (unresolvable in-vault) but has a to_label
  assert.equal(failing(clean(), 7).pass, true)
})
t('check 7 fails a dangling reference with no to_label', () => {
  const s = clean()
  s.edges.push({ id: 'broken', type: 'informed_by', from: 'self/commitment/bet-l', to: 'world/prediction/gone', to_label: '', author: 'user' })
  assert.equal(failing(s, 7).pass, false)
})

// Check 8 — no stray files.
t('check 8 fails a stray file under me/', () => {
  const s = clean()
  s.files.push('secret-notes.txt')
  assert.equal(failing(s, 8).pass, false)
})

// Check 9 — mandate-external interventions = 0.
t('check 9 fails an intervention citing an unknown mandate', () => {
  const s = clean()
  s.interventions[0].mandate_id = 'self/mandate/ghost'
  assert.equal(failing(s, 9).pass, false)
})
t('check 9 fails an intervention fired after mandate expiry (T18 lapse)', () => {
  const s = clean()
  s.interventions[0].created_at = '2026-05-01T00:00:00Z' // after m1 expires 2026-04-02
  assert.equal(failing(s, 9).pass, false)
})
t('mandateStatusAt models the lifecycle (pending/active/expired/suspended/revoked)', () => {
  const m = clean().mandates[0]
  assert.equal(mandateStatusAt(m, '2026-01-01T00:00:00Z'), 'pending')
  assert.equal(mandateStatusAt(m, '2026-02-01T00:00:00Z'), 'active')
  assert.equal(mandateStatusAt(m, '2026-05-01T00:00:00Z'), 'expired')
  const suspended = { ...m, events: [{ action: 'suspend', created_at: '2026-01-10T00:00:00Z' }] }
  assert.equal(mandateStatusAt(suspended, '2026-02-01T00:00:00Z'), 'suspended')
  const revoked = { ...m, events: [{ action: 'revoke', created_at: '2026-01-10T00:00:00Z' }, { action: 'resume', created_at: '2026-01-11T00:00:00Z' }] }
  assert.equal(mandateStatusAt(revoked, '2026-02-01T00:00:00Z'), 'revoked')
})

// Check 10 — materiality.
t('check 10 fails a ranking field', () => {
  const s = clean()
  ;(s.interventions[0].surface as Record<string, unknown>).recommended = 'B'
  assert.equal(failing(s, 10).pass, false)
})
t('check 10 fails exactly-one option (disguised recommendation)', () => {
  const s = clean()
  s.interventions[0].surface.options = [{ label: 'A', text: 'accept' }]
  s.interventions[0].surface.notice = undefined
  assert.equal(failing(s, 10).pass, false)
})
t('check 10 fails a cited number with no source record', () => {
  const s = clean()
  s.interventions[0].surface.cited_numbers = [{ value: '14 months', source: 'just a guess' }]
  assert.equal(failing(s, 10).pass, false)
})
t('check 10 permits a single factual notice with no options', () => {
  const s = clean()
  s.interventions[0].surface.options = []
  assert.equal(failing(s, 10).pass, true)
})

// Check 11 — two-outcome close.
t('check 11 fails a close missing the felt-sense axis', () => {
  const s = clean()
  s.outcomes = s.outcomes.filter((o) => o.component !== 'subjective')
  assert.equal(failing(s, 11).pass, false)
})
t('check 11 fails an out-of-vocabulary felt sense', () => {
  const s = clean()
  s.outcomes.find((o) => o.component === 'subjective')!.result = 'ecstatic'
  assert.equal(failing(s, 11).pass, false)
})
t('check 11 fails an out-of-vocabulary observable result', () => {
  const s = clean()
  s.outcomes.find((o) => o.component === 'observable')!.result = 'kinda_worked'
  assert.equal(failing(s, 11).pass, false)
})

console.log(`\ncheck self-test: ${passed} assertions passed${process.exitCode ? ', SOME FAILED' : ''}`)
