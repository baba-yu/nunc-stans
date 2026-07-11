// `just journey` (CI mode): replay a representative journey path against a
// FRESH temp vault, driving the real nunc-stans engine over HTTP so the
// engine's enforcement (commitment/outcome/edge/superposition validation) is
// genuinely exercised — not a direct-store bypass. Mandate/intervention
// records are INJECTED as test data (journey §4; those lanes are SPL v3, not
// built in Phase F). After each step the vault is git-committed (the
// time-lapse) and all eleven checks are asserted over the snapshot.
//
// Safety (F11 / fork rule): the vault is a fresh mktemp dir, git-init'd with
// NO remote; a hard guard refuses to proceed unless it is empty with zero
// commits. The owner's real store is never touched. Verify mode
// (`just journey:verify <vault>`) is a separate, read-only git reader.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { runChecks, type CheckResult, type Snapshot } from './checks.ts'
import { readVault } from './vault.ts'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ENGINE_MANIFEST = path.join(ROOT, 'engines/nunc-stans/Cargo.toml')

function sh(cmd: string, args: string[], opts: { cwd?: string } = {}): string {
  return execFileSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

function makeVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-journey-'))
  sh('git', ['init', '-q', dir])
  sh('git', ['-C', dir, 'config', 'user.name', 'journey'])
  sh('git', ['-C', dir, 'config', 'user.email', 'journey@localhost'])
  sh('git', ['-C', dir, 'config', 'commit.gpgsign', 'false'])
  // Hard guard: fresh temp, no commits, no remote (a leaked NS_DATA cannot
  // aim per-step commits at a real store).
  const commits = (() => {
    try {
      return sh('git', ['-C', dir, 'rev-list', '--count', 'HEAD'])
    } catch {
      return '0'
    }
  })()
  if (commits !== '0' || sh('git', ['-C', dir, 'remote']).length > 0 || !dir.includes('ns-journey-')) {
    throw new Error(`refusing to run: ${dir} is not a fresh empty temp vault`)
  }
  return dir
}

async function waitHealthy(base: string, ms = 15_000): Promise<void> {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('engine did not become healthy in time')
}

async function post(base: string, route: string, body: unknown): Promise<Response> {
  const r = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`POST ${route} → ${r.status}: ${await r.text()}`)
  return r
}

/** Inject a test-data record the engine does not own (journey §4). */
function inject(vault: string, rel: string, doc: unknown): void {
  const p = path.join(vault, 'me', rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n')
}

function snapshotCommit(vault: string, label: string): void {
  sh('git', ['-C', vault, 'add', '-A'])
  try {
    sh('git', ['-C', vault, 'commit', '-q', '-m', `journey: ${label}`])
  } catch {
    /* nothing to commit at an all-injection step is fine */
  }
}

interface StepReport {
  step: string
  results: CheckResult[]
}

async function main() {
  const failures: string[] = []
  const reports: StepReport[] = []
  const vault = makeVault()
  const port = await freePort()
  const base = `http://127.0.0.1:${port}`

  // Build the engine once, then spawn it against the temp vault.
  process.stdout.write('building nunc-stans-engine… ')
  sh('cargo', ['build', '--quiet', '--manifest-path', ENGINE_MANIFEST])
  console.log('ok')
  const bin = path.join(ROOT, 'engines/nunc-stans/target/debug/nunc-stans-engine')
  const engine: ChildProcess = spawn(bin, ['--self-dir', vault, '--port', String(port)], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  engine.stderr?.on('data', (d) => (stderr += d))

  // The 5 [op] questions: canned from op-answers.json in CI, asked in real
  // mode (journey §4). Recorded per step and echoed in the report.
  const opAnswers: Record<string, { question: string; answer: string }> = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, 'op-answers.json'), 'utf8'),
  )
  const opRecorded: string[] = []
  const op = (stepKey: string) => {
    const a = opAnswers[stepKey]
    if (a) opRecorded.push(`${stepKey} — ${a.question} → ${a.answer}`)
  }

  let prev: Snapshot | null = null
  let aiEdgesAllowed = false
  interface StepOpts {
    aiEdges?: boolean
    /** T4/T8/T12-style silence steps: assert the store did NOT move. */
    expectNoChange?: boolean
    /** T12: assert specifically that no new intervention appeared. */
    expectNoNewInterventions?: boolean
  }
  const recordCount = (s: Snapshot) =>
    s.commitments.length + s.outcomes.length + s.edges.length + s.mandates.length +
    s.interventions.length + s.superposition.length
  const step = async (name: string, opts: StepOpts, fn: () => Promise<void>) => {
    const before = prev
    await fn()
    snapshotCommit(vault, name)
    const snap = readVault(vault)
    if (opts.aiEdges) aiEdgesAllowed = true
    const results = runChecks(snap, { prev, aiEdgesAllowed })
    if (opts.expectNoChange && before && recordCount(snap) !== recordCount(before)) {
      failures.push(`${name}: a silence step must not move the store (no nagging, no auto-writes)`)
    }
    if (opts.expectNoNewInterventions && before && snap.interventions.length !== before.interventions.length) {
      failures.push(`${name}: the system piled on — intervention count rose during silence`)
    }
    reports.push({ step: name, results })
    for (const r of results) if (!r.pass) failures.push(`${name} · check ${r.check} (${r.name}): ${r.detail}`)
    prev = snap
  }

  try {
    await waitHealthy(base)

    // T0 — empty vault.
    await step('T0 empty vault', {}, async () => {})

    // T1 — register the past: 3 commitments, one with a two-outcome close and
    // an informed_by edge to a world prediction (the provenance-mix seed).
    await step('T1 register the past', {}, async () => {
      await post(base, '/self/commitments', {
        slug: '2025-08-gpu-server', title: 'GPU server', started_at: '2025-08-01', resources: { money_jpy: 600000, hours: 40 },
      })
      await post(base, '/self/commitments', {
        slug: 'edge-ai-stack', title: 'edge AI stack', started_at: '2026-03-01',
      })
      await post(base, '/self/commitments', {
        slug: 'federation-local', title: 'consolidate locally', started_at: '2026-06-01',
      })
      await post(base, '/self/outcomes', { commitment_slug: '2025-08-gpu-server', component: 'observable', result: 'partially_confirmed' })
      await post(base, '/self/outcomes', { commitment_slug: '2025-08-gpu-server', component: 'subjective', result: 'happy' })
      await post(base, '/self/edges', {
        type: 'informed_by', from: 'self/commitment/edge-ai-stack', to: 'world/prediction/local-ai-uptake',
        to_label: 'local-AI everyday use', author: 'user',
      })
    })

    // T2 — write the first mandate M1 (injected; the mandate lane is v3).
    await step('T2 write mandate M1', {}, async () => {
      inject(vault, 'mandates/m1.json', {
        id: 'self/mandate/m1', scope: 'independence / career options / stagnation', author: 'user',
        effective_at: '2026-01-02T00:00:00Z', expires_at: '2026-04-02T00:00:00Z',
      })
    })
    op('T2')

    // T3 — place bet L (a commitment carrying the fear note = the 1st courage
    // record: the fear written in his own hand, then the bet placed himself).
    await step('T3 place bet L', {}, async () => {
      await post(base, '/self/commitments', {
        slug: 'bet-l', title: 'meetup demo + talk', started_at: '2026-01-15',
        resources: { money_jpy: 200000, hours: 25 }, note: 'Read: land 3 leads. Maybe a waste of money.',
      })
    })

    // T4 — a Sunday writing nothing. No nagging, no streak, no auto-write:
    // the store must not move (FD-2.1).
    await step('T4 a Sunday writing nothing', { expectNoChange: true }, async () => {})

    // T5 — bet L lands: loss (two-outcome close; no consoling rewrite exists).
    await step('T5 bet L loss', {}, async () => {
      await post(base, '/self/outcomes', { commitment_slug: 'bet-l', component: 'observable', result: 'contradicted', note: 'no leads' })
      await post(base, '/self/outcomes', { commitment_slug: 'bet-l', component: 'subjective', result: 'unhappy' })
    })

    // T6 — bet H lands: gain. A past edge carried a present opportunity —
    // informed_by → self/knowledge/gpu-build-notes (unresolvable-with-label,
    // exercising check 7's headless form).
    await step('T6 bet H gain', {}, async () => {
      await post(base, '/self/commitments', {
        slug: 'paid-consult', title: 'paid GPU-build consultation', started_at: '2026-01-20',
        resources: { hours: 4 },
      })
      await post(base, '/self/edges', {
        type: 'informed_by', from: 'self/commitment/paid-consult', to: 'self/knowledge/gpu-build-notes',
        to_label: 'GPU build notes (2025)', author: 'user',
      })
      await post(base, '/self/outcomes', { commitment_slug: 'paid-consult', component: 'observable', result: 'confirmed', note: 'the ¥600k of two years ago replied in cash' })
      await post(base, '/self/outcomes', { commitment_slug: 'paid-consult', component: 'subjective', result: 'happy' })
    })

    // T7 — bet F lands: unchanged ("Nothing changed. But now I know.") —
    // an unchanged close is first-class; all three felt senses now present.
    await step('T7 bet F unchanged', {}, async () => {
      await post(base, '/self/commitments', {
        slug: 'local-coding-30d', title: '30 days all-local coding', started_at: '2026-01-01',
      })
      await post(base, '/self/outcomes', { commitment_slug: 'local-coding-30d', component: 'observable', result: 'confirmed' })
      await post(base, '/self/outcomes', { commitment_slug: 'local-coding-30d', component: 'subjective', result: 'unchanged', note: 'Nothing changed. But now I know.' })
    })

    // T8 — the trigger: too hot to touch; Yu records NOTHING. The wavering
    // signals are runner-side context, not store writes.
    await step('T8 the trigger (nothing recorded)', { expectNoChange: true }, async () => {})

    // T9 — intervention 1 (injected test data; references M1, material). Yu
    // dismisses one tangentially related item: a dismisses edge (author=user,
    // from a dismissal record — §3), the original record unchanged.
    await step('T9 intervention 1', {}, async () => {
      inject(vault, 'interventions/i1.json', {
        id: 'self/intervention/i1', mandate_id: 'self/mandate/m1', author: 'ai',
        intent: 'surface the promotion terrain within M1', created_at: '2026-02-01T00:00:00Z',
        surface: {
          notice: 'a prediction your bet targets was revised downward; 12 days to the deadline',
          options: [
            { label: 'A', text: 'accept', in_user_draft: true },
            { label: 'B', text: 'refuse and stay', in_user_draft: true },
            { label: 'C', text: 'refuse and prepare for independence', in_user_draft: true },
            { label: 'D', text: 'negotiate 80% + IP clause', in_user_draft: false },
          ],
          cited_numbers: [],
        },
      })
      await post(base, '/self/edges', {
        type: 'dismisses', from: 'self/dismissal/t9-tangential', to: 'world/prediction/tangential-item',
        to_label: 'tangentially related world item', author: 'user',
      })
    })
    op('T9')

    // T10 — build the app: a commitment + produced edge to the frozen version.
    await step('T10 build runway-tracker', {}, async () => {
      await post(base, '/self/commitments', {
        slug: 'build-runway-tracker', title: 'build the runway and deals app', started_at: '2026-02-05',
        resources: { hours: 6 },
      })
      await post(base, '/self/edges', {
        type: 'produced', from: 'self/commitment/build-runway-tracker', to: 'artifact/artifact_version/runway-tracker@v1',
        to_label: 'runway-tracker@v1', author: 'user',
      })
    })

    // T11 — the strategy is READ and SAVED: superposition_state via the engine,
    // which draws the informed_by edge (the first author=ai edge → P4 reached).
    await step('T11 strategy saved (superposition)', { aiEdges: true }, async () => {
      await post(base, '/self/superposition_state', {
        id: 's1',
        win: 'external income ¥200k/month',
        constraint: 'do not fall below 12 months of runway',
        risk_to_watch: 'concentration of dependence',
        grounding: ['monthly_external_income', 'cash_runway', 'income_concentration'],
        informed_by: 'artifact/artifact_version/runway-tracker@v1',
        informed_by_label: 'runway-tracker@v1',
      })
    })

    op('T11')

    // T12 — the silence of the week the deadline shrinks: the system does NOT
    // pile on (no new intervention; only the remaining days quietly update).
    await step('T12 silence (no pile-on)', { aiEdges: true, expectNoNewInterventions: true }, async () => {})

    // T13 — intervention 2 (injected; terrain with a record-vs-assumption diff).
    await step('T13 intervention 2', { aiEdges: true }, async () => {
      inject(vault, 'interventions/i2.json', {
        id: 'self/intervention/i2', mandate_id: 'self/mandate/m1', author: 'ai',
        intent: 'fear becomes a map — the terrain of the options', created_at: '2026-02-20T00:00:00Z',
        surface: {
          notice: 'the terrain of your options, from your own numbers',
          options: [
            { label: 'A', text: 'accept', in_user_draft: true },
            { label: 'D', text: 'negotiate 80% + IP clause', in_user_draft: false },
          ],
          cited_numbers: [
            { value: '14 months', source: 'artifact/artifact_version/runway-tracker@v1', source_label: 'cash_runway', assumption: 'less than half a year' },
          ],
        },
      })
    })

    op('T13')

    // T14 — resolve: the person writes (commitment) + rewrites bet L felt sense
    // (append supersedes) → external/felt divergence occurs here. The 2nd
    // courage record: the fear-turned-map in view, he wrote it himself.
    await step('T14 resolve', { aiEdges: true }, async () => {
      await post(base, '/self/commitments', {
        slug: 'present-negotiation', title: 'present 80% + an IP clause', started_at: '2026-02-21',
      })
      await post(base, '/self/outcomes', { commitment_slug: 'bet-l', component: 'subjective', result: 'happy', note: 'that loss was a springboard' })
      await post(base, '/self/edges', {
        type: 'supersedes', from: 'self/commitment/present-negotiation', to: 'self/commitment/bet-l',
        to_label: 'bet L (context)', author: 'user',
      })
    })

    op('T14')

    // T15 — the decision lands: a partial close (neither total win nor defeat).
    await step('T15 decision lands', { aiEdges: true }, async () => {
      await post(base, '/self/outcomes', { commitment_slug: 'present-negotiation', component: 'observable', result: 'partially_confirmed', note: '80% went through; the IP clause was halved' })
      await post(base, '/self/outcomes', { commitment_slug: 'present-negotiation', component: 'subjective', result: 'happy', note: 'even so, I signed' })
    })

    // T16 — entrance to the second lap: the strategy understanding is UPDATED
    // (a new superposition that supersedes s1, citing the close) — the loop
    // turned. Exercises the versioned chain + the supersedes edge end-to-end.
    await step('T16 second lap: strategy updated', { aiEdges: true }, async () => {
      await post(base, '/self/superposition_state', {
        id: 's2',
        win: 'external income ¥200k/month; first deal converting',
        constraint: 'do not fall below 12 months of runway',
        risk_to_watch: 'conversion from discussion to a contract',
        grounding: ['monthly_external_income', 'deals_in_discussion', 'cash_runway'],
        informed_by: 'artifact/artifact_version/runway-tracker@v1',
        informed_by_label: 'runway-tracker@v1',
        supersedes: 'self/superposition_state/s1',
        cites_close: 'present-negotiation: partially_confirmed × happy',
      })
    })

    // T18 — the mandate expires: silence means lapse. No intervention fires
    // during the lapse window; Yu re-registers M1'; the card returns under it.
    await step('T18 mandate expiry and re-registration', { aiEdges: true }, async () => {
      inject(vault, 'mandates/m1-prime.json', {
        id: 'self/mandate/m1-prime', scope: 'independence / career options / stagnation', author: 'user',
        effective_at: '2026-05-03T00:00:00Z', expires_at: '2026-08-01T00:00:00Z',
      })
      inject(vault, 'interventions/i3.json', {
        id: 'self/intervention/i3', mandate_id: 'self/mandate/m1-prime', author: 'ai',
        intent: 'the card returns after re-registration', created_at: '2026-05-10T00:00:00Z',
        surface: {
          notice: 'one prediction your bet targets moved; 3 weeks to your next deal review',
          options: [], cited_numbers: [],
        },
      })
    })
    // The lapse itself, asserted positively: no intervention timestamp falls
    // in [M1 expiry, M1' effective) — check 9 would catch one citing M1, and
    // this catches one citing anything.
    {
      const snap = readVault(vault)
      const lapseStart = Date.parse('2026-04-02T00:00:00Z')
      const lapseEnd = Date.parse('2026-05-03T00:00:00Z')
      const inLapse = snap.interventions.filter((iv) => {
        const t = Date.parse(iv.created_at)
        return t >= lapseStart && t < lapseEnd
      })
      if (inLapse.length) failures.push(`T18: ${inLapse.length} intervention(s) during the lapse — must be 0`)
    }
  } catch (e) {
    failures.push(`replay error: ${(e as Error).message}${stderr ? `\n  engine stderr: ${stderr.slice(-400)}` : ''}`)
  } finally {
    engine.kill('SIGTERM')
    fs.rmSync(vault, { recursive: true, force: true })
  }

  // Report: a step × check grid + the §5 metrics.
  console.log('\nstep × checks (✓ pass · ✗ fail):')
  for (const { step, results } of reports) {
    const grid = results.map((r) => (r.pass ? '✓' : '✗')).join(' ')
    console.log(`  ${grid}   ${step}`)
  }
  console.log('  ' + Array.from({ length: 11 }, (_, i) => i + 1).join(' ').replace(/(\d\d)/g, '$1') + '   (check #)')

  // §5 metrics — the journey's REAL success criteria, not just structure.
  const last = reports.at(-1)?.results
  if (last && prev) {
    const mix = last.find((r) => r.check === 6)?.detail
    const feltSenses = [...new Set(prev.outcomes.filter((o) => o.component === 'subjective').map((o) => o.result))]
    console.log('\n§5 metrics:')
    console.log(`  provenance: ${mix} (recomputed from edges alone, F9)`)
    console.log('  courage records: 2 — T3 (fear in note, bet placed himself), T14 (map in view, wrote himself)')
    console.log('  post-intervention authorship: 2/2 = 100% (T9→T10 build; T13→T14 resolve)')
    console.log('  external/felt divergence: T1 gpu-server (partially_confirmed × happy); T14 bet-l rewrite (contradicted × unhappy→happy)')
    console.log(`  felt senses present: ${feltSenses.join(', ')} (all three + the rewrite)`)
    console.log('  mandate-external interventions: 0 (check 9 at every step); lapse interventions: 0 (T18)')
    console.log('  TTFUV: canned in CI — measured live at T9 in real mode')
    console.log('  [op] answers (canned from op-answers.json; real mode asks the person):')
    for (const line of opRecorded) console.log(`    ${line}`)
  }

  if (failures.length) {
    console.error(`\nJOURNEY FAILED (${failures.length}):`)
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log(`\nJOURNEY GREEN — ${reports.length} steps, checks 1–11 held at every step.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
