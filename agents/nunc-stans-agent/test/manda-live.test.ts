// LIVE integration against the real manda binary (plan T1 spike + risk 8
// elicitation probe). Self-skips when no binary resolves (MANDA_BIN unset,
// nothing on PATH, no local release build) so pre-tag 3-OS CI stays green.
// Full lane per ~/manda/scripts/smoke.sh: append → propose → commit refused
// (agent origin) → commit refused (no mandate) → out-of-band grant →
// commit approved via ELICITATION (origin_verified expected true) →
// read (≤3) → out-of-mandate scope commit refused → decline path denies.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, appendFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MandaMemory, resolveMandaBin } from '../src/memory.ts'

const BIN = resolveMandaBin()

describe.skipIf(!BIN)('manda live lane (binary: ' + (BIN ?? 'none — skipped') + ')', () => {
  let dataDir: string
  let memory: MandaMemory

  const grant = (scope: string) =>
    appendFileSync(join(dataDir, 'mandates.jsonl'), JSON.stringify({
      id: `m-live-${scope.replace(/[^a-z0-9]+/gi, '-')}`, scope, access: ['read', 'write'],
      granted_at: '2026-07-07T00:00:00Z', expires_at: '2036-01-01T00:00:00Z',
    }) + '\n')

  beforeEach(() => { dataDir = mkdtempSync(join(tmpdir(), 'nsa-manda-live-')) })
  afterEach(async () => {
    await memory?.close()
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('walks the full lane; elicitation approval yields origin_verified', async () => {
    memory = await MandaMemory.connect({ dataDir, bin: BIN!, approval: 'elicit' })

    expect(await memory.listTools()).toEqual(expect.arrayContaining([
      'memory_append', 'memory_propose', 'memory_commit', 'memory_read', 'mandate_list',
    ]))

    expect((await memory.append('notes', 'event', 'live spike started')).ok).toBe(true)

    const cand = await memory.propose('notes', 'fact', 'live: the principal prefers Rust')
    expect(cand.text).toMatch(/proposed|cand-/)
    const candId = String(cand.body?.id ?? cand.text.match(/cand-[\w-]+/)?.[0])
    expect(candId).toMatch(/cand-/)

    const agentOrigin = await memory.commit(candId, 'agent_origin')
    expect(agentOrigin.text + agentOrigin.ok).toMatch(/no commit authority|false/)

    const noMandate = await memory.commit(candId, 'user_approved')
    expect(noMandate.text).toMatch(/no active write mandate/i)

    grant('notes/*')
    const committed = await memory.commit(candId, 'user_approved')
    expect(committed.text).toMatch(/under_mandate/)

    // The risk-8 probe proper: did the rmcp server actually elicit through
    // the TS SDK client, and did our approval yield a verified origin?
    const lane = readFileSync(join(dataDir, 'committed.jsonl'), 'utf8')
    console.log(`[probe] elicited=${memory.elicited} committed=${lane.trim()}`)
    expect(memory.elicited, 'rmcp never sent an elicitation request to the TS client').toBe(true)
    expect(lane).toMatch(/"origin_verified":true/)

    const read = await memory.read('notes')
    expect(read.ok).toBe(true)

    // Out-of-mandate scope: propose succeeds (candidate lane), commit refuses.
    const other = await memory.propose('drafts', 'fact', 'outside the granted scope')
    const refused = await memory.commit(String(other.body?.id ?? other.text.match(/cand-[\w-]+/)?.[0]), 'user_approved')
    expect(refused.text).toMatch(/no active write mandate/i)
  }, 30_000)

  it('an explicit decline denies the commit (elicit mode never downgrades)', async () => {
    memory = await MandaMemory.connect({
      dataDir, bin: BIN!, approval: 'elicit',
      approver: async () => ({ action: 'decline' }),
    })
    grant('notes/*')
    const cand = await memory.propose('notes', 'fact', 'to be declined')
    const res = await memory.commit(String(cand.body?.id ?? cand.text.match(/cand-[\w-]+/)?.[0]), 'user_approved')
    expect(res.ok).toBe(false)
    expect(existsSync(join(dataDir, 'committed.jsonl'))).toBe(false)
  }, 30_000)
})
