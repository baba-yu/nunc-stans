#!/usr/bin/env node
// apps-host: the generated-app host (Phase E, contracts/app-bundle.md).
// Serves every frozen app bundle under the single origin — generic CRUD +
// metrics API (api.ts), the declared MCP tool surface (mcp.ts), and the
// manifest-driven UI shell — by INTERPRETING bundle manifests; no generated
// code is ever executed (plan PE2/PE3). Loopback-only behind the gate at
// /apps/ (PE4); one process owns all app data (single writer).
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { buildApi } from './api.ts'
import type { HostConfig } from './api.ts'
import { mcpHandler } from './mcp.ts'
import { resolveDataDir } from '../../tools/lib/data-dir.ts'
import { join } from 'node:path'

export const APPS_HOST_PORT = 8788

export function startHost(cfg: HostConfig, port: number, host = '127.0.0.1'): Promise<Server> {
  const listener = getRequestListener(buildApi(cfg).fetch)
  const mcp = mcpHandler(cfg)
  const server = createServer((req, res) => {
    if (req.url === '/mcp' || req.url?.startsWith('/mcp?')) {
      void mcp(req, res).catch((err) => {
        console.error('apps-host mcp:', err)
        if (!res.headersSent) res.writeHead(500).end()
      })
      return
    }
    listener(req, res)
  })
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)))
}

// Serve only when run directly (tests import startHost / buildApi).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { dir, warning } = resolveDataDir()
  if (warning) console.error(warning)
  if (!dir) {
    console.error('apps-host: no data store resolved (set NS_DATA or just bootstrap <dir>)')
    process.exit(1)
  }
  const cfg: HostConfig = { artifactRoot: join(dir, 'artifact'), dataRoot: dir }
  await startHost(cfg, APPS_HOST_PORT)
  console.log(`apps-host listening on http://127.0.0.1:${APPS_HOST_PORT} (store: ${dir})`)
}
