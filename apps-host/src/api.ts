import { Hono } from 'hono'
import type { Context } from 'hono'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { discoverApps, findApp } from './bundles.ts'
import type { ServedApp } from './bundles.ts'
import { openAppData } from './appdb.ts'
import { ServiceError, archiveRow, createRow, getRow, listRows, metricValues, updateRow } from './service.ts'

// The published REST surface (contract §6), host-relative — the gate mounts
// it at /apps/. Discovery is a per-request filesystem scan (stat-cheap; a
// bundle frozen mid-session is served seconds later with no restart, S-8).

const MAX_BODY_BYTES = 262_144

export interface HostConfig {
  artifactRoot: string // <data store>/artifact
  dataRoot: string // <data store>
}

async function jsonBody(c: Context): Promise<Record<string, unknown>> {
  const text = await c.req.text()
  if (text.length > MAX_BODY_BYTES) throw new ServiceError(400, 'payload too large')
  if (!text) return {}
  try {
    const v = JSON.parse(text) as unknown
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object')
    return v as Record<string, unknown>
  } catch {
    throw new ServiceError(400, 'body must be a JSON object')
  }
}

function withApp(cfg: HostConfig, c: Context, fn: (app: ServedApp) => Response | Promise<Response>) {
  const slug = c.req.param('slug') ?? ''
  const app = findApp(cfg.artifactRoot, slug)
  if (!app) return c.json({ error: `no served app: ${slug}` }, 404)
  return fn(app)
}

export function buildApi(cfg: HostConfig): Hono {
  const api = new Hono()

  api.onError((err, c) => {
    if (err instanceof ServiceError) return c.json({ error: err.message }, err.status)
    console.error('apps-host:', err)
    return c.json({ error: 'internal error' }, 500)
  })

  api.get('/api/health', (c) => c.json({ ok: true, name: 'apps-host', version: '0.1.0' }))

  api.get('/api', (c) =>
    c.json(discoverApps(cfg.artifactRoot).map((a) => ({ slug: a.slug, version: a.version, name: a.manifest.name }))),
  )

  api.get('/:slug/api/manifest', (c) => withApp(cfg, c, (app) => c.json(app.manifest)))

  api.get('/:slug/api/metrics', (c) => withApp(cfg, c, (app) => c.json(metricValues(cfg.dataRoot, app))))

  // Surface the mount state (read-only reason etc.) for the UI shell.
  api.get('/:slug/api/status', (c) =>
    withApp(cfg, c, (app) => {
      const data = openAppData(cfg.dataRoot, app)
      return c.json({ slug: app.slug, version: app.version, readOnly: data.readOnly, reason: data.reason ?? null })
    }),
  )

  api.get('/:slug/api/:entity', (c) =>
    withApp(cfg, c, (app) =>
      c.json(
        listRows(cfg.dataRoot, app, c.req.param('entity'), {
          archived: c.req.query('archived') === '1' || c.req.query('archived') === 'true',
          limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        }),
      ),
    ),
  )

  api.post('/:slug/api/:entity', (c) =>
    withApp(cfg, c, async (app) => c.json(createRow(cfg.dataRoot, app, c.req.param('entity'), await jsonBody(c)), 201)),
  )

  api.get('/:slug/api/:entity/:id', (c) =>
    withApp(cfg, c, (app) => c.json(getRow(cfg.dataRoot, app, c.req.param('entity'), c.req.param('id')))),
  )

  api.patch('/:slug/api/:entity/:id', (c) =>
    withApp(cfg, c, async (app) =>
      c.json(updateRow(cfg.dataRoot, app, c.req.param('entity'), c.req.param('id'), await jsonBody(c))),
    ),
  )

  api.post('/:slug/api/:entity/:id/archive', (c) =>
    withApp(cfg, c, (app) => c.json(archiveRow(cfg.dataRoot, app, c.req.param('entity'), c.req.param('id')))),
  )

  // --- the generic UI shell (one vite build for every app) -----------------
  // Served at /apps/<slug>/ through the gate; the page fetches `api/...`
  // RELATIVE so neither the shell nor this host hardcodes the gate prefix.
  const uiDist = resolve(import.meta.dirname, '..', 'ui', 'dist')
  const MIME: Record<string, string> = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.map': 'application/json',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  }

  api.get('/:slug/assets/:file', (c) => {
    const file = c.req.param('file')
    if (!/^[\w.-]+$/.test(file)) return c.text('not found', 404)
    const path = join(uiDist, 'assets', file)
    if (!existsSync(path)) return c.text('not found', 404)
    const ext = file.slice(file.lastIndexOf('.'))
    return c.body(readFileSync(path), 200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable', // hashed filenames
    })
  })

  api.get('/:slug/', (c) =>
    withApp(cfg, c, (app) => {
      void app
      const index = join(uiDist, 'index.html')
      if (!existsSync(index)) return c.text('ui shell not built — run: pnpm -C apps-host build', 503)
      return c.html(readFileSync(index, 'utf8'))
    }),
  )

  // The shell's relative fetches need the trailing slash; a relative
  // Location re-resolves correctly behind any mount prefix.
  api.get('/:slug', (c) => c.body(null, 302, { location: `${c.req.param('slug')}/` }))

  return api
}
