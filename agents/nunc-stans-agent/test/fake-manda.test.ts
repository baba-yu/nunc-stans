// Client logic against the fake-manda stub — runs on all 3 CI OSes with no
// manda binary. Refusal semantics mirror the real gateway (README + smoke).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MandaMemory, assertWritableScope } from '../src/memory.ts'

const STUB = join(dirname(fileURLToPath(import.meta.url)), 'fake-manda.mjs')

let dataDir: string
let memory: MandaMemory

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'nsa-fake-manda-'))
  memory = await MandaMemory.connect({
    dataDir, bin: process.execPath, args: [STUB], approval: 'attest',
  })
})

afterEach(async () => {
  await memory.close()
  rmSync(dataDir, { recursive: true, force: true })
})

const grantMandate = (scope: string, expiresAt: string) =>
  appendFileSync(join(dataDir, 'mandates.jsonl'), JSON.stringify({
    id: `m-test-${scope.replace(/[^a-z0-9]+/gi, '-')}`, scope, access: ['read', 'write'],
    granted_at: '2026-07-07T00:00:00Z', expires_at: expiresAt,
  }) + '\n')

describe('F3 guard (before manda is even asked)', () => {
  it('refuses commitment-scope proposals', async () => {
    await expect(memory.propose('self/commitment/x', 'fact', 'nope')).rejects.toThrow(/F3/)
  })
  it('assertWritableScope names the constitutional line', () => {
    expect(() => assertWritableScope('self/commitment')).toThrow(/user-only/)
    expect(() => assertWritableScope('notes')).not.toThrow()
  })
})

describe('lane flow against the stub', () => {
  it('lists the seven manda tools', async () => {
    expect(await memory.listTools()).toEqual(expect.arrayContaining([
      'memory_append', 'memory_propose', 'memory_commit', 'memory_read',
      'edge_append', 'edge_list', 'mandate_list',
    ]))
  })

  it('propose always lands in the candidate lane (no authority needed)', async () => {
    const res = await memory.propose('notes', 'fact', 'the principal prefers Rust')
    expect(res.ok).toBe(true)
    expect(res.body?.id).toMatch(/^cand-/)
  })

  it('commit with an agent origin is refused: no commit authority', async () => {
    const cand = await memory.propose('notes', 'fact', 'x')
    const res = await memory.commit(String(cand.body?.id), 'agent_origin')
    expect(res.ok).toBe(false)
    expect(res.text).toMatch(/no commit authority/)
  })

  it('commit without a mandate is refused — the refusal point is commit, not propose', async () => {
    const cand = await memory.propose('notes', 'fact', 'x')
    expect(cand.ok).toBe(true) // propose succeeded out-of-mandate, by design
    const res = await memory.commit(String(cand.body?.id), 'user_approved')
    expect(res.ok).toBe(false)
    expect(res.text).toMatch(/no active write mandate/)
  })

  it('commit under an active mandate succeeds', async () => {
    grantMandate('notes/*', '2036-01-01T00:00:00Z')
    const cand = await memory.propose('notes', 'fact', 'x')
    const res = await memory.commit(String(cand.body?.id), 'user_approved')
    expect(res.ok).toBe(true)
    expect(res.body?.status).toBe('under_mandate')
  })

  it('a lapsed mandate refuses like no mandate (silence means lapse)', async () => {
    grantMandate('notes/*', '2020-01-01T00:00:00Z')
    const cand = await memory.propose('notes', 'fact', 'x')
    const res = await memory.commit(String(cand.body?.id), 'user_approved')
    expect(res.ok).toBe(false)
    expect(res.text).toMatch(/no active write mandate/)
  })

  it('read surfaces at most 3 and reports the rest suppressed', async () => {
    grantMandate('notes/*', '2036-01-01T00:00:00Z')
    for (let i = 0; i < 5; i++) {
      const cand = await memory.propose('notes', 'fact', `fact ${i}`)
      expect((await memory.commit(String(cand.body?.id), 'user_approved')).ok).toBe(true)
    }
    const res = await memory.read('notes')
    expect((res.body?.surfaced as unknown[]).length).toBe(3)
    expect(res.body?.suppressed).toBe(2)
  })

  it('mandate_list inspects but cannot grant', async () => {
    grantMandate('notes/*', '2036-01-01T00:00:00Z')
    const res = await memory.mandateList()
    expect((res.body?.mandates as Array<{ id: string }>).map(m => m.id)).toContain('m-test-notes-')
    expect(await memory.listTools()).not.toContain('mandate_grant')
  })
})
