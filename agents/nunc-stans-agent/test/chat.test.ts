// T9 (Phase D): the chat turn engine — streaming render calls, the
// /remember approve/decline flows against fake-manda, refusals surfaced,
// the run-log stamp. 3-OS-safe (mock provider + the stdio stub).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAi } from '../../../frontend/packages/ai/src/index.ts'
import type { Profile } from '../../../frontend/packages/ai/src/index.ts'
import { MandaMemory } from '../src/memory.ts'
import { describeMandates, runTurn } from '../src/chat.ts'
import type { AgentSession, TurnIO } from '../src/chat.ts'

const STUB = join(dirname(fileURLToPath(import.meta.url)), 'fake-manda.mjs')

interface Scripted extends TurnIO {
  outs: string[]
  thinks: string[]
  metas: string[]
  answers: string[]
}

function scriptedIo(answers: string[] = []): Scripted {
  const io: Scripted = {
    outs: [], thinks: [], metas: [], answers,
    out: s => { io.outs.push(s) },
    thinking: s => { io.thinks.push(s) },
    meta: s => { io.metas.push(s) },
    ask: async () => io.answers.shift() ?? '',
  }
  return io
}

let dataDir: string
let mandaDir: string
let memory: MandaMemory

const PROFILE: Profile = {
  id: 'test-agent', name: 'Test agent', provider: 'mock',
  goal_verify: { verify: 'off' },
}

function makeSession(io: TurnIO, withMemory = true): AgentSession {
  const ai = createAi({
    runLogFile: join(dataDir, 'runs', 'ai-runs.jsonl'),
    mock: { reply: 'a streamed reply', thinking: 'pondering the question' },
  })
  return { ai, profile: PROFILE, memory: withMemory ? memory : null, history: [], io }
}

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'nsa-chat-store-'))
  mandaDir = mkdtempSync(join(tmpdir(), 'nsa-chat-manda-'))
  memory = await MandaMemory.connect({
    dataDir: mandaDir, bin: process.execPath, args: [STUB], approval: 'attest',
  })
})

afterEach(async () => {
  await memory.close()
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(mandaDir, { recursive: true, force: true })
})

const grant = (scope: string) =>
  appendFileSync(join(mandaDir, 'mandates.jsonl'), JSON.stringify({
    id: 'm-test', scope, access: ['read', 'write'],
    granted_at: '2026-07-07T00:00:00Z', expires_at: '2036-01-01T00:00:00Z',
  }) + '\n')

describe('chat turns', () => {
  it('streams thinking + content and stamps the run log with the profile', async () => {
    const io = scriptedIo()
    const s = makeSession(io)
    expect(await runTurn(s, 'hello there')).toBe(true)
    expect(io.thinks.join('')).toBe('pondering the question')
    expect(io.outs.join('')).toContain('a streamed reply')
    expect(s.history.map(m => m.role)).toEqual(['user', 'assistant'])
    const entry = JSON.parse(readFileSync(join(dataDir, 'runs', 'ai-runs.jsonl'), 'utf8').trim())
    expect(entry).toMatchObject({ caller: 'nunc-stans-agent', profile: 'test-agent', provider: 'mock' })
  })

  it('/exit ends the session; empty input keeps it', async () => {
    const io = scriptedIo()
    const s = makeSession(io)
    expect(await runTurn(s, '   ')).toBe(true)
    expect(await runTurn(s, '/exit')).toBe(false)
  })
})

describe('memory flows through manda', () => {
  it('/remember proposes, asks, commits under a mandate', async () => {
    grant('notes/*')
    const io = scriptedIo(['y'])
    const s = makeSession(io)
    await runTurn(s, '/remember notes the principal prefers Rust')
    const metas = io.metas.join('\n')
    expect(metas).toMatch(/proposed cand-/)
    expect(metas).toMatch(/committed under mandate/)
  })

  it('declining the commit leaves the candidate lane only', async () => {
    grant('notes/*')
    const io = scriptedIo(['n'])
    const s = makeSession(io)
    await runTurn(s, '/remember notes a fact')
    expect(io.metas.join('\n')).toMatch(/left in the candidate lane/)
  })

  it('an out-of-mandate commit is REFUSED and shown verbatim', async () => {
    const io = scriptedIo(['y'])
    const s = makeSession(io)
    await runTurn(s, '/remember drafts outside any mandate')
    expect(io.metas.join('\n')).toMatch(/commit REFUSED: .*no active write mandate/)
  })

  it('F3: a self-commitment write is refused before manda is asked', async () => {
    const io = scriptedIo(['y'])
    const s = makeSession(io)
    await runTurn(s, '/remember self/commitment/x sneaky')
    expect(io.metas.join('\n')).toMatch(/refused: F3/)
  })

  it('/recall surfaces committed rows and the suppression count', async () => {
    grant('notes/*')
    const io = scriptedIo(['y', 'y', 'y', 'y', 'y'])
    const s = makeSession(io)
    for (let i = 0; i < 5; i++) await runTurn(s, `/remember notes fact number ${i}`)
    const io2 = scriptedIo()
    await runTurn({ ...s, io: io2 }, '/recall notes')
    const metas = io2.metas.join('\n')
    expect(metas).toMatch(/fact number/)
    expect(metas).toMatch(/\+2 suppressed/)
  })

  it('memory OFF states are explicit, never silent', async () => {
    const io = scriptedIo()
    const s = makeSession(io, false)
    await runTurn(s, '/remember notes x')
    await runTurn({ ...s, io }, '/mandates')
    expect(io.metas.join('\n')).toMatch(/memory is off/)
  })
})

describe('mandate rendering', () => {
  it('empty list renders the readable no-mandate state', async () => {
    const res = await memory.mandateList()
    expect(describeMandates(res)).toMatch(/no active mandate/)
  })
  it('grants render with scope and expiry', async () => {
    grant('notes/*')
    const res = await memory.mandateList()
    expect(describeMandates(res)).toMatch(/scope=notes\/\*.*expires=2036/)
  })
})
