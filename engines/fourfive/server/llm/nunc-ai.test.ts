import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type {
  ChatMessage as AiChatMessage, ChatOptions, ChatResult, Provider,
} from '../../../../frontend/packages/ai/src/index.ts'
import type { ChatMessage } from '../../shared/types'
import { DEFAULT_CHAT_SYSTEM_PROMPT, FourfiveLlm, blueprintMaxTokens } from './nunc-ai'

// The 2026-07-10 serving hardening: promptless profiles get the design-
// partner framing, the blueprint call gets its OWN budget + grammar, and
// every blueprint failure mode is classified instead of a silent null.

const tmp: string[] = []
function makeStore(profiles: Record<string, object>, defaults?: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-nunc-ai-'))
  tmp.push(dir)
  fs.mkdirSync(path.join(dir, 'profiles'), { recursive: true })
  for (const [id, p] of Object.entries(profiles)) {
    fs.writeFileSync(path.join(dir, 'profiles', `${id}.json`), JSON.stringify(p))
  }
  if (defaults) fs.writeFileSync(path.join(dir, 'profiles', 'defaults.json'), JSON.stringify(defaults))
  return dir
}
afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

interface Captured {
  messages: AiChatMessage[]
  opts: ChatOptions
}

/** Scripted llama-cpp stand-in: records every call, answers from a queue
 * (an Error entry throws, mimicking the provider's HTTP failures). */
function fakeLlamaCpp(script: Array<Partial<ChatResult> | Error> = []) {
  const calls: Captured[] = []
  const queue = [...script]
  const provider: Provider = {
    name: 'llama-cpp',
    capabilities: {
      chat: true, stream: true, tools: true, structured: true,
      webSearch: 'none', thinking: true, memory: false,
    },
    async chat(messages: AiChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
      calls.push({ messages, opts })
      const next = queue.shift() ?? {}
      if (next instanceof Error) throw next
      return {
        text: '', usage: { inputTokens: 0, outputTokens: 0 },
        model: 'fake', provider: 'llama-cpp', ...next,
      }
    },
  }
  return { provider, calls }
}

const PROMPTLESS = { id: 'promptless', name: 'Promptless', provider: 'llama-cpp', model: 'm' }
const PROMPTED = {
  id: 'prompted', name: 'Prompted', provider: 'llama-cpp', model: 'm',
  system_prompt: 'Custom partner prompt.',
}

function makeLlm(script: Array<Partial<ChatResult> | Error> = []) {
  const dataDir = makeStore(
    { promptless: PROMPTLESS, prompted: PROMPTED },
    { 'fourfive-chat': 'promptless' },
  )
  const fake = fakeLlamaCpp(script)
  const llm = new FourfiveLlm({ dataDir, providers: { 'llama-cpp': fake.provider } })
  return { llm, calls: fake.calls }
}

describe('chat step system prompt', () => {
  it('falls back to the design-partner prompt when the profile has none', async () => {
    const { llm, calls } = makeLlm([{ text: 'hi' }])
    await llm.chat([{ role: 'user', content: 'hello' }], { maxTokens: 256 })
    expect(calls[0].opts.system).toBe(DEFAULT_CHAT_SYSTEM_PROMPT)
    expect(calls[0].opts.caller).toBe('fourfive-chat')
    // The per-message cap still governs the CHAT call.
    expect(calls[0].opts.maxTokens).toBe(256)
  })

  it("keeps the profile's own system prompt when it has one", async () => {
    const { llm, calls } = makeLlm([{ text: 'hi' }])
    await llm.chat([{ role: 'user', content: 'hello' }], { profileId: 'prompted' })
    expect(calls[0].opts.system).toBe('Custom partner prompt.')
  })
})

describe('proposeBlueprint', () => {
  const HISTORY: ChatMessage[] = [{ role: 'user', content: 'invoice app please' }]

  it('uses its own budget and the response grammar, never the per-message cap', async () => {
    const { llm, calls } = makeLlm([{ text: '{"app":{"name":"X"}}', stopReason: 'stop' }])
    const p = await llm.proposeBlueprint(HISTORY, null, { maxTokens: 512 })
    expect(p.outcome).toBe('ok')
    expect(p.proposed).toEqual({ app: { name: 'X' } })
    const opts = calls[0].opts
    expect(opts.caller).toBe('fourfive-blueprint')
    expect(opts.maxTokens).not.toBe(512)
    expect(opts.maxTokens).toBeGreaterThanOrEqual(2048)
    expect(opts.maxTokens).toBeLessThanOrEqual(8000)
    // Constrained decoding on llama-cpp: the blueprint-or-null schema rides along.
    expect(opts.jsonSchema).toBeDefined()
  })

  it("classifies the model's honest null (not enough info) as empty", async () => {
    const { llm } = makeLlm([{ text: 'null', stopReason: 'stop' }])
    const p = await llm.proposeBlueprint(HISTORY, null, {})
    expect(p).toMatchObject({ outcome: 'empty', proposed: null })
  })

  it('discards on stopReason length even when the truncated JSON parses', async () => {
    const { llm } = makeLlm([
      { text: '{"app":{"name":"X"}}', stopReason: 'length', usage: { inputTokens: 9000, outputTokens: 7000 } },
    ])
    const p = await llm.proposeBlueprint(HISTORY, null, {})
    expect(p.outcome).toBe('length-truncated')
    expect(p.proposed).toBeNull()
    expect(p.stopReason).toBe('length')
    expect(p.detail).toMatch(/7000 tokens/)
  })

  it('classifies unparseable model output', async () => {
    const { llm } = makeLlm([{ text: 'Sure! Here is the design you asked for.', stopReason: 'stop' }])
    const p = await llm.proposeBlueprint(HISTORY, null, {})
    expect(p.outcome).toBe('parse-failed')
    expect(p.proposed).toBeNull()
  })

  it('classifies the llama-server per-slot context refusal', async () => {
    const { llm } = makeLlm([
      new Error(
        'llama-cpp: HTTP 400: {"error":{"code":400,"message":"the request exceeds the available context size","type":"exceed_context_size_error"}}',
      ),
    ])
    const p = await llm.proposeBlueprint(HISTORY, null, {})
    expect(p.outcome).toBe('context-overflow')
    expect(p.detail).toMatch(/exceed/)
  })

  it('rethrows unrelated provider errors', async () => {
    const { llm } = makeLlm([new Error('ECONNREFUSED')])
    await expect(llm.proposeBlueprint(HISTORY, null, {})).rejects.toThrow('ECONNREFUSED')
  })

  it('keeps the offline demo path intact when no profile resolves', async () => {
    const llm = new FourfiveLlm({ dataDir: makeStore({}) })
    const invoice = await llm.proposeBlueprint(
      [{ role: 'user', content: 'I want an invoice app' }], null, {},
    )
    expect(invoice.outcome).toBe('ok')
    expect(invoice.proposed).toMatchObject({ app: { name: 'Invoice App' } })
    const other = await llm.proposeBlueprint([{ role: 'user', content: 'weather?' }], null, {})
    expect(other).toMatchObject({ outcome: 'empty', proposed: null })
  })
})

describe('blueprintMaxTokens', () => {
  const NO_ENV = {}

  it('halves the per-slot window (llama_ctx / llama_parallel), clamped', () => {
    expect(blueprintMaxTokens({}, NO_ENV)).toBe(4096) // defaults 32768/4 → 8192-slot
    expect(blueprintMaxTokens({ llama_ctx: 65536, llama_parallel: 4 }, NO_ENV)).toBe(8000) // ceiling
    expect(blueprintMaxTokens({ llama_ctx: '65536', llama_parallel: '4' }, NO_ENV)).toBe(8000) // string-typed config
    expect(blueprintMaxTokens({ llama_ctx: 8192, llama_parallel: 8 }, NO_ENV)).toBe(2048) // floor
  })

  it('lets the env knobs win, like the serving leg does', () => {
    expect(
      blueprintMaxTokens({ llama_ctx: 65536 }, { NS_LLAMA_CTX: '16384', NS_LLAMA_PARALLEL: '2' }),
    ).toBe(4096)
  })
})

describe('chatWithTools (F-2 B: the tool-enabled turn)', () => {
  const P = { id: 'tooly', name: 'Tooly', provider: 'llama-cpp', model: 'm' }
  const TOOLS = [{ name: 'my-app_deals_create', inputSchema: { type: 'object' } }]

  it('drives the loop, counts executed calls, and forces verify off', async () => {
    const fake = fakeLlamaCpp([
      { toolCalls: [{ id: 't1', name: 'my-app_deals_create', arguments: { name: 'Acme' } }] },
      { text: 'created it' },
    ])
    const dataDir = makeStore({ tooly: P }, { 'fourfive-chat': 'tooly' })
    const llm = new FourfiveLlm({ dataDir, providers: { 'llama-cpp': fake.provider } })
    const executed: string[] = []
    const result = await llm.chatWithTools(
      [{ role: 'user', content: '受注1件入れといて' }],
      { verify: { on: true, goal: 'must be ignored' } }, // tools force verify OFF
      TOOLS,
      async (call) => {
        executed.push(call.name)
        return '{"id":"r1"}'
      },
    )
    expect(result.content).toBe('created it')
    expect(executed).toEqual(['my-app_deals_create'])
    expect(result.toolCalls).toEqual([{ name: 'my-app_deals_create', count: 1 }])
    // every provider call in the loop carried verify off (no judge ran):
    // 2 calls total (tool round + final), none with a goal prompt
    expect(fake.calls).toHaveLength(2)
  })

  it('falls back to plain chat when the provider declares no tool support', async () => {
    const fake = fakeLlamaCpp([{ text: 'plain answer' }])
    fake.provider.capabilities.tools = false
    const dataDir = makeStore({ tooly: P }, { 'fourfive-chat': 'tooly' })
    const llm = new FourfiveLlm({ dataDir, providers: { 'llama-cpp': fake.provider } })
    const result = await llm.chatWithTools(
      [{ role: 'user', content: 'hi' }], {}, TOOLS, async () => 'never',
    )
    expect(result.content).toBe('plain answer')
    expect('toolCalls' in result && result.toolCalls).toBeFalsy()
  })
})

describe('patrolOpener (F-2 B: the interactive opening patrol)', () => {
  const SWEEP = {
    app: { slug: 'my-app', version: 2, name: 'My App' },
    metrics: [{ name: 'cash_runway', label: 'Cash runway', value: 7.5 }],
    rows: [
      { entity: 'deals', count: 2, latest: '2026-07-09T00:00:00Z' },
      { entity: 'notes', count: 0, latest: null },
    ],
  }

  it('short-circuits to the canned patrol on the offline profile', async () => {
    const llm = new FourfiveLlm({ dataDir: makeStore({}) }) // no default → offline mock
    const text = await llm.patrolOpener(SWEEP, {})
    expect(text).toContain('My App')
    expect(text).toContain('notes')
    expect(text).toMatch(/\?/) // it asks a question, it does not command
  })

  it('phrases the opener from the sweep on a live provider, verify off', async () => {
    const fake = fakeLlamaCpp([{ text: 'Deals moved last on the 9th — anything new since?' }])
    const dataDir = makeStore(
      { tooly: { id: 'tooly', name: 'T', provider: 'llama-cpp', model: 'm' } },
      { 'fourfive-chat': 'tooly' },
    )
    const llm = new FourfiveLlm({ dataDir, providers: { 'llama-cpp': fake.provider } })
    const text = await llm.patrolOpener(SWEEP, {})
    expect(text).toContain('anything new since?')
    expect(fake.calls).toHaveLength(1)
    const system = fake.calls[0].messages[0].content
    expect(system).toContain('my-app@v2')
    expect(system).toContain('ONE brief status question')
  })
})
