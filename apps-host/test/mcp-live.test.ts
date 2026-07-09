import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { startHost } from '../src/index.ts'
import { resetAppDataCache } from '../src/appdb.ts'

// The real MCP surface over the real HTTP server (contract §5): the same SDK
// client class the agent uses, against startHost() — declared tools listed,
// CRUD round-trips through the single write path, refusals surface verbatim.

const FIXTURES = join(import.meta.dirname, 'fixtures', 'artifact')

let server: Server
let client: Client

beforeEach(async () => {
  resetAppDataCache()
  server = await startHost(
    { artifactRoot: FIXTURES, dataRoot: mkdtempSync(join(tmpdir(), 'apps-host-mcp-')) },
    0,
  )
  const { port } = server.address() as AddressInfo
  client = new Client({ name: 'mcp-live-test', version: '0.0.1' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)))
})

afterEach(async () => {
  await client.close().catch(() => {})
  await new Promise<void>((r) => server.close(() => r()))
})

// callTool's result type is a union (structured tool results included) — read
// the text content defensively.
const textOf = (result: unknown): string => {
  const content = (result as { content?: { type: string; text?: string }[] }).content
  return content?.[0]?.text ?? ''
}
const isError = (result: unknown): boolean => (result as { isError?: boolean }).isError === true

describe('apps-host MCP surface', () => {
  it('lists exactly the declared tools of served bundles', async () => {
    const tools = await client.listTools()
    const names = tools.tools.map((t) => t.name)
    expect(names).toContain('fixture-app_deals_create')
    expect(names).toContain('fixture-app_notes_archive')
    expect(names).toHaveLength(10)
  })

  it('creates and lists through tools — one write path with REST', async () => {
    const created = await client.callTool({
      name: 'fixture-app_deals_create',
      arguments: { name: 'Via MCP', status: 'discussion' },
    })
    expect(isError(created)).toBe(false)
    const row = JSON.parse(textOf(created)) as { id: string; name: string }
    expect(row.name).toBe('Via MCP')

    const listed = await client.callTool({ name: 'fixture-app_deals_list', arguments: {} })
    const rows = JSON.parse(textOf(listed)) as unknown[]
    expect(rows).toHaveLength(1)
  })

  it('surfaces refusals verbatim as tool errors', async () => {
    const bad = await client.callTool({
      name: 'fixture-app_deals_create',
      arguments: { nope: 'x' },
    })
    expect(isError(bad)).toBe(true)
    expect(textOf(bad)).toContain('unknown field')

    const unknown = await client.callTool({ name: 'fixture-app_ghosts_list', arguments: {} })
    expect(isError(unknown)).toBe(true)
    expect(textOf(unknown)).toContain('unknown tool')
  })
})
