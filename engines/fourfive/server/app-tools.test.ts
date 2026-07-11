// F-2 B rails: the design chat operates ONLY its own served app (PF7's
// implicit `apps:<own-slug>` grant), the executor mirrors the MCP dispatch's
// arg mapping onto the published REST routes, refusals/errors surface
// verbatim as tool results (never thrown into the loop), and the sweep +
// patrol prompt are deterministic functions of the published API.
import { describe, expect, it } from 'vitest'
import {
  buildAppToolExecutor,
  buildPatrolMessages,
  fetchDeclaredTools,
  ownAppToolAllowed,
  sweepServedApp,
} from './app-tools'

const okJson = (data: unknown): Response =>
  ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) }) as unknown as Response

const errRes = (status: number, body: unknown): Response =>
  ({ ok: false, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response

describe('ownAppToolAllowed (PF7: the implicit own-app grant)', () => {
  it('allows only the session slug, underscore-anchored', () => {
    expect(ownAppToolAllowed('runway-tracker', 'runway-tracker_deals_list')).toBe(true)
    expect(ownAppToolAllowed('runway-tracker', 'other-app_deals_list')).toBe(false)
    // the agent's prefix-leak rule, mirrored: 'app' must not match 'app-one_…'
    expect(ownAppToolAllowed('app', 'app-one_items_list')).toBe(false)
    expect(ownAppToolAllowed('app', 'app_items_list')).toBe(true)
  })
})

describe('fetchDeclaredTools (the REST tool surface)', () => {
  it('maps the declared list and filters anything outside the slug', async () => {
    const fake = (async () =>
      okJson([
        { name: 'my-app_deals_list', description: 'list', inputSchema: { type: 'object' } },
        { name: 'other-app_x_list', description: 'foreign', inputSchema: {} },
      ])) as unknown as typeof fetch
    const tools = await fetchDeclaredTools('my-app', fake, 'http://host')
    expect(tools.map((t) => t.name)).toEqual(['my-app_deals_list'])
    expect(tools[0].inputSchema).toEqual({ type: 'object' })
  })

  it('returns [] when the app is not served or the host is down (honest degrade)', async () => {
    const notServed = (async () => errRes(404, { error: 'no' })) as unknown as typeof fetch
    expect(await fetchDeclaredTools('my-app', notServed, 'http://host')).toEqual([])
    const down = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    expect(await fetchDeclaredTools('my-app', down, 'http://host')).toEqual([])
  })
})

describe('buildAppToolExecutor (five verbs → published REST, one write path)', () => {
  function capture() {
    const seen: { url: string; init?: RequestInit }[] = []
    const fake = (async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), init })
      return okJson({ ok: true })
    }) as unknown as typeof fetch
    return { seen, fake }
  }

  it('dispatches list/get/create/update/archive with the MCP arg mapping', async () => {
    const { seen, fake } = capture()
    const exec = buildAppToolExecutor('my-app', fake, 'http://host')
    await exec({ id: '1', name: 'my-app_deals_list', arguments: { archived: true, limit: 5 } })
    await exec({ id: '2', name: 'my-app_deals_get', arguments: { id: 'r1' } })
    await exec({ id: '3', name: 'my-app_deals_create', arguments: { name: 'Acme' } })
    await exec({ id: '4', name: 'my-app_deals_update', arguments: { id: 'r1', name: 'Acme 2' } })
    await exec({ id: '5', name: 'my-app_deals_archive', arguments: { id: 'r1' } })
    expect(seen[0].url).toBe('http://host/my-app/api/deals?archived=1&limit=5')
    expect(seen[1].url).toBe('http://host/my-app/api/deals/r1')
    expect(seen[2].url).toBe('http://host/my-app/api/deals')
    expect(seen[2].init?.method).toBe('POST')
    expect(JSON.parse(String(seen[2].init?.body))).toEqual({ name: 'Acme' })
    expect(seen[3].url).toBe('http://host/my-app/api/deals/r1')
    expect(seen[3].init?.method).toBe('PATCH')
    // update strips id from the body (it rides the URL)
    expect(JSON.parse(String(seen[3].init?.body))).toEqual({ name: 'Acme 2' })
    expect(seen[4].url).toBe('http://host/my-app/api/deals/r1/archive')
    expect(seen[4].init?.method).toBe('POST')
  })

  it('handles entity names containing underscores', async () => {
    const { seen, fake } = capture()
    const exec = buildAppToolExecutor('my-app', fake, 'http://host')
    await exec({ id: '1', name: 'my-app_cash_snapshots_list', arguments: {} })
    expect(seen[0].url).toBe('http://host/my-app/api/cash_snapshots')
  })

  it('refuses a foreign-app tool at call time without touching the host', async () => {
    const { seen, fake } = capture()
    const exec = buildAppToolExecutor('my-app', fake, 'http://host')
    const out = await exec({ id: '1', name: 'other-app_deals_list', arguments: {} })
    expect(out).toMatch(/refused/)
    expect(seen).toHaveLength(0)
  })

  it('surfaces a host refusal verbatim and never throws', async () => {
    const fake = (async () => errRes(400, { error: 'unknown field "bogus"' })) as unknown as typeof fetch
    const exec = buildAppToolExecutor('my-app', fake, 'http://host')
    const out = await exec({ id: '1', name: 'my-app_deals_create', arguments: { bogus: 1 } })
    expect(out).toMatch(/^error 400:/)
    expect(out).toMatch(/unknown field/)
    const down = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const out2 = await buildAppToolExecutor('my-app', down, 'http://host')({
      id: '2', name: 'my-app_deals_list', arguments: {},
    })
    expect(out2).toMatch(/unreachable/)
  })
})

describe('sweepServedApp + buildPatrolMessages (the deterministic opening sweep)', () => {
  const routes = (over: Record<string, unknown> = {}) =>
    (async (url: string | URL) => {
      const u = String(url)
      const table: Record<string, unknown> = {
        '/my-app/api/manifest': {
          slug: 'my-app', version: 2, name: 'My App',
          entities: [{ name: 'deals' }, { name: 'notes' }],
        },
        '/my-app/api/metrics': [{ name: 'cash_runway', label: 'Cash runway', value: 7.5 }],
        '/my-app/api/deals?limit=1000': [
          { created_at: '2026-07-01T00:00:00Z' },
          { created_at: '2026-07-09T00:00:00Z' },
        ],
        '/my-app/api/notes?limit=1000': [],
        ...over,
      }
      for (const [suffix, data] of Object.entries(table)) {
        if (u.endsWith(suffix)) return okJson(data)
      }
      return errRes(404, {})
    }) as unknown as typeof fetch

  it('sweeps counts, latest timestamps, and metrics', async () => {
    const sweep = await sweepServedApp('my-app', routes(), 'http://host')
    expect(sweep).not.toBeNull()
    expect(sweep!.app).toEqual({ slug: 'my-app', version: 2, name: 'My App' })
    expect(sweep!.rows).toEqual([
      { entity: 'deals', count: 2, latest: '2026-07-09T00:00:00Z' },
      { entity: 'notes', count: 0, latest: null },
    ])
    expect(sweep!.metrics[0].name).toBe('cash_runway')
  })

  it('returns null when the app is not served', async () => {
    const none = (async () => errRes(404, {})) as unknown as typeof fetch
    expect(await sweepServedApp('ghost', none, 'http://host')).toBeNull()
  })

  it('builds a materiality-shaped patrol prompt: the sweep, one question, no commands', async () => {
    const sweep = (await sweepServedApp('my-app', routes(), 'http://host'))!
    const msgs = buildPatrolMessages(sweep)
    expect(msgs).toHaveLength(2)
    const system = msgs[0].content
    expect(system).toContain('my-app@v2')
    expect(system).toContain('deals: 2 rows')
    expect(system).toContain('notes: 0 rows (empty)')
    expect(system).toContain('cash_runway')
    expect(system).toContain('ONE brief status question')
    expect(system).toContain('Never command, never recommend')
  })
})
