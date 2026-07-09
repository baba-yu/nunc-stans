import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { discoverApps } from './bundles.ts'
import { VERBS } from './bundle-types.ts'
import { ServiceError, archiveRow, createRow, getRow, listRows, updateRow } from './service.ts'
import type { HostConfig } from './api.ts'

// The MCP surface (contract §5): Streamable HTTP at /mcp (transport decided
// by the T1 spike). The tool list is recomputed from the served bundles on
// every tools/list — a bundle frozen mid-session is offered without a
// restart — and ONLY declared tools dispatch (declared surface = served
// surface). Handlers call the same service functions as REST: one write path.

function dispatchTool(cfg: HostConfig, name: string, args: Record<string, unknown>): unknown {
  for (const app of discoverApps(cfg.artifactRoot)) {
    if (!name.startsWith(`${app.slug}_`)) continue
    if (!app.tools.some((t) => t.name === name)) continue
    const rest = name.slice(app.slug.length + 1)
    const verb = VERBS.find((v) => rest.endsWith(`_${v}`))
    if (!verb) continue
    const entity = rest.slice(0, rest.length - verb.length - 1)
    switch (verb) {
      case 'list':
        return listRows(cfg.dataRoot, app, entity, {
          archived: args.archived === true,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
        })
      case 'get':
        return getRow(cfg.dataRoot, app, entity, String(args.id))
      case 'create':
        return createRow(cfg.dataRoot, app, entity, args)
      case 'update': {
        const { id, ...fields } = args
        return updateRow(cfg.dataRoot, app, entity, String(id), fields)
      }
      case 'archive':
        return archiveRow(cfg.dataRoot, app, entity, String(args.id))
    }
  }
  throw new ServiceError(404, `unknown tool: ${name}`)
}

function buildMcpServer(cfg: HostConfig): Server {
  const server = new Server({ name: 'apps-host', version: '0.1.0' }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: discoverApps(cfg.artifactRoot).flatMap((a) => a.tools),
  }))
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name
    const args = (req.params.arguments ?? {}) as Record<string, unknown>
    try {
      const result = dispatchTool(cfg, name, args)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
    } catch (err) {
      const msg = err instanceof ServiceError ? err.message : (err as Error).message
      // Refusals surface verbatim as tool errors — the agent renders them.
      return { content: [{ type: 'text' as const, text: msg }], isError: true }
    }
  })
  return server
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const isInitialize = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && (body as { method?: string }).method === 'initialize'

/** One transport (= one MCP session) per client; routed by mcp-session-id. */
export function mcpHandler(cfg: HostConfig): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const transports = new Map<string, StreamableHTTPServerTransport>()

  return async (req, res) => {
    const body = req.method === 'POST' ? await readBody(req) : undefined
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport = sessionId ? transports.get(sessionId) : undefined

    if (!transport) {
      if (req.method !== 'POST' || !isInitialize(body)) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'expected an initialize request or a known mcp-session-id' }))
        return
      }
      const t: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid: string) => {
          transports.set(sid, t)
        },
      })
      t.onclose = () => {
        if (t.sessionId) transports.delete(t.sessionId)
      }
      await buildMcpServer(cfg).connect(t)
      transport = t
    }

    await transport.handleRequest(req, res, body)
  }
}
