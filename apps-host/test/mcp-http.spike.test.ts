// T1 spike (plan PE6, the PD10 pattern): prove the TS SDK's Streamable
// HTTP transport interoperates client ↔ server BEFORE the MCP surface is
// built on it. Server side = what apps-host will run; client side = the
// same SDK client class the agent already uses for manda (stdio there,
// HTTP here). Round-trip: initialize → list tools → call one.
// Fallback if this ever breaks: the stdio bridge (plan PE6), recorded —
// not silently swapped.
import { describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { z } from 'zod'

async function startSpikeServer() {
  const mcp = new McpServer({ name: 'apps-host-spike', version: '0.0.1' })
  // Shape of a future generated tool: <slug>_<entity>_<verb> (plan PE7).
  mcp.tool(
    'spike-app_echo_create',
    'Echo back a message (spike stand-in for a CRUD tool)',
    { message: z.string() },
    async ({ message }) => ({ content: [{ type: 'text' as const, text: `echo:${message}` }] }),
  )
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  })
  await mcp.connect(transport)
  const http = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      const body = raw ? JSON.parse(raw) : undefined
      void transport.handleRequest(req, res, body)
    })
  })
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r))
  const { port } = http.address() as AddressInfo
  return {
    url: new URL(`http://127.0.0.1:${port}/`),
    close: () => new Promise<void>((r) => http.close(() => r())),
  }
}

describe('MCP Streamable HTTP spike (PE6)', () => {
  it('SDK client round-trips initialize, tools/list, tools/call over HTTP', async () => {
    const server = await startSpikeServer()
    const client = new Client({ name: 'spike-client', version: '0.0.1' })
    try {
      await client.connect(new StreamableHTTPClientTransport(server.url))
      const tools = await client.listTools()
      expect(tools.tools.map((t) => t.name)).toContain('spike-app_echo_create')

      const result = await client.callTool({
        name: 'spike-app_echo_create',
        arguments: { message: 'hi' },
      })
      const content = result.content as { type: string; text?: string }[]
      expect(content[0]?.type).toBe('text')
      expect(content[0]?.text).toBe('echo:hi')
    } finally {
      await client.close().catch(() => {})
      await server.close()
    }
  })
})
