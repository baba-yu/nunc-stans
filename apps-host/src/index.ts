#!/usr/bin/env node
// apps-host: the generated-app host (Phase E). Serves every frozen app
// bundle under the single origin — generic CRUD + metrics API, the
// manifest-driven UI shell, and the declared MCP tool surface — by
// INTERPRETING bundle manifests; no generated code is ever executed
// (plan PE2/PE3). Loopback-only behind the gate at /apps/ (PE4).
//
// T1 scaffold: port + health so the stack wiring and the MCP transport
// spike have a home. The real host lands at T6 per
// contracts/app-bundle.md (drafted T5).
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

export const APPS_HOST_PORT = 8788

export function buildApp(): Hono {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ ok: true, name: 'apps-host', version: '0.1.0' }))
  return app
}

// Serve only when run directly (tests import buildApp).
if (import.meta.url === `file://${process.argv[1]}`) {
  serve({ fetch: buildApp().fetch, port: APPS_HOST_PORT, hostname: '127.0.0.1' })
  console.log(`apps-host listening on http://127.0.0.1:${APPS_HOST_PORT}`)
}
