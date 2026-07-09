// Phase E T8: the generated-app tool client — allowlist gating
// (apps:<slug>, agent-abi §2), the MCP round-trip against a fixture
// Streamable HTTP server (the same SDK server class apps-host runs), the
// tool turn through nunc-ai's bounded loop, refusals verbatim. 3-OS-safe:
// everything runs in-process, zero live tokens (scripted mock).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { createAi } from '../../../frontend/packages/ai/src/index.ts'
import type { Profile } from '../../../frontend/packages/ai/src/index.ts'
import { appsToolAllowed, connectAppsTools } from '../src/tools.ts'
import { runTurn } from '../src/chat.ts'
import type { AgentSession, TurnIO } from '../src/chat.ts'

// A fixture apps-host: two apps' worth of tools, one refusal path.
async function startFixtureHost(): Promise<{ url: string; close: () => Promise<void> }> {
  const mcp = new McpServer({ name: 'fixture-apps-host', version: '0.0.1' })
  mcp.tool('app-one_items_list', 'List app-one items', { archived: z.boolean().optional() }, async () => ({
    content: [{ type: 'text' as const, text: '[{"id":"r1","label":"human row"}]' }],
  }))
  mcp.tool('app-one_items_create', 'Create an app-one item', { label: z.string() }, async ({ label }) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({ id: 'r2', label }) }],
  }))
  mcp.tool('app-two_rows_list', 'List app-two rows', {}, async () => ({
    content: [{ type: 'text' as const, text: '[]' }],
  }))
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(), enableJsonResponse: true,
  })
  await mcp.connect(transport)
  const http = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c as Buffer))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      void transport.handleRequest(req, res, raw ? JSON.parse(raw) : undefined)
    })
  })
  await new Promise<void>(r => http.listen(0, '127.0.0.1', r))
  const { port } = http.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise(r => {
        // Kill keep-alive connections too, or close() waits out the socket.
        ;(http as Server).closeAllConnections()
        ;(http as Server).close(() => r())
      }),
  }
}

const PROFILE: Profile = {
  id: 'agents-apps', name: 'Apps agent', provider: 'mock',
  skills: ['apps:app-one'],
}

function scriptedIo(): TurnIO & { outs: string[]; metas: string[] } {
  const io = {
    outs: [] as string[], metas: [] as string[],
    out: (s: string) => { io.outs.push(s) },
    thinking: () => {},
    meta: (s: string) => { io.metas.push(s) },
    ask: async () => '',
  }
  return io
}

let host: Awaited<ReturnType<typeof startFixtureHost>>
beforeEach(async () => { host = await startFixtureHost() })
afterEach(async () => { await host.close() })

describe('appsToolAllowed (PE10 allowlist)', () => {
  it('grants by app prefix and by exact name, nothing ambient', () => {
    expect(appsToolAllowed(['apps:app-one'], 'app-one_items_list')).toBe(true)
    expect(appsToolAllowed(['apps:app-one'], 'app-two_rows_list')).toBe(false)
    expect(appsToolAllowed(['app-two_rows_list'], 'app-two_rows_list')).toBe(true)
    expect(appsToolAllowed([], 'app-one_items_list')).toBe(false)
    // A prefix grant must not leak into a lookalike slug.
    expect(appsToolAllowed(['apps:app'], 'app-one_items_list')).toBe(false)
  })
})

describe('connectAppsTools', () => {
  it('lists ONLY the granted tools and calls through', async () => {
    const io = scriptedIo()
    const tools = (await connectAppsTools(PROFILE, io.meta, host.url))!
    expect(tools.specs.map(t => t.name).sort()).toEqual(['app-one_items_create', 'app-one_items_list'])
    const r = await tools.call({ id: 'c1', name: 'app-one_items_list', arguments: {} })
    expect(r.isError).toBe(false)
    expect(r.text).toContain('human row')
    // Call-time defense in depth: a non-granted name is refused locally.
    const refused = await tools.call({ id: 'c2', name: 'app-two_rows_list', arguments: {} })
    expect(refused.isError).toBe(true)
    expect(refused.text).toContain('not granted')
    await tools.close()
  })

  it('returns null without connecting when the profile grants nothing', async () => {
    const io = scriptedIo()
    const none = await connectAppsTools({ ...PROFILE, skills: [] }, io.meta, host.url)
    expect(none).toBeNull()
  })

  it('degrades honestly when apps-host is unreachable', async () => {
    const io = scriptedIo()
    const down = await connectAppsTools(PROFILE, io.meta, 'http://127.0.0.1:1/')
    expect(down).toBeNull()
    expect(io.metas.join('\n')).toContain('apps-host unreachable')
  })
})

describe('the tool turn (S-7 rehearsal, zero tokens)', () => {
  it('model-requested calls run through MCP and land in the run log', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'nsa-tools-store-'))
    const logFile = join(dataDir, 'runs', 'ai-runs.jsonl')
    const ai = createAi({
      runLogFile: logFile,
      mock: {
        reply: 'created r2 alongside the human row',
        toolScript: [
          [{ id: 't1', name: 'app-one_items_list', arguments: {} }],
          [{ id: 't2', name: 'app-one_items_create', arguments: { label: 'agent row' } }],
        ],
      },
    })
    const io = scriptedIo()
    const tools = (await connectAppsTools(PROFILE, io.meta, host.url))!
    const s: AgentSession = { ai, profile: PROFILE, memory: null, tools, history: [], io }
    await runTurn(s, 'add a row next to the human one')
    expect(io.outs.join('')).toContain('created r2 alongside the human row')
    const metas = io.metas.join('\n')
    expect(metas).toContain('⚙ app-one_items_list')
    expect(metas).toContain('⚙ app-one_items_create')
    expect(metas).toContain('agent row')
    const entry = JSON.parse(readFileSync(logFile, 'utf8').trim().split('\n').at(-1)!)
    expect(entry.caller).toBe('nunc-stans-agent')
    expect(entry.profile).toBe('agents-apps')
    expect(entry.toolCalls).toEqual([
      { name: 'app-one_items_list', count: 1 },
      { name: 'app-one_items_create', count: 1 },
    ])
    await tools.close()
  })
})
