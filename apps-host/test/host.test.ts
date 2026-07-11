import { beforeEach, describe, expect, it } from 'vitest'
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApi } from '../src/api.ts'
import type { HostConfig } from '../src/api.ts'
import { resetAppDataCache } from '../src/appdb.ts'
import { runScenarios } from '../src/runner.ts'
import { findApp } from '../src/bundles.ts'

const FIXTURES = join(import.meta.dirname, 'fixtures', 'artifact')

let cfg: HostConfig
beforeEach(() => {
  resetAppDataCache()
  cfg = { artifactRoot: FIXTURES, dataRoot: mkdtempSync(join(tmpdir(), 'apps-host-test-')) }
})

const api = () => buildApi(cfg)

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

describe('apps-host REST surface (contract §6)', () => {
  it('lists served apps from the bundle scan', async () => {
    const res = await api().request('/api')
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual([{ slug: 'fixture-app', version: 1, name: 'Fixture App' }])
  })

  it('serves the declared tool surface over REST, verbatim (Phase F)', async () => {
    const res = await api().request('/fixture-app/api/tools')
    expect(res.status).toBe(200)
    const tools = await json<{ name: string }[]>(res)
    // The same frozen mcp-tools.json /mcp serves: slug-prefixed five-verb names.
    expect(tools.length).toBeGreaterThan(0)
    for (const t of tools) expect(t.name).toMatch(/^fixture-app_[a-z0-9_]+_(list|get|create|update|archive)$/)
    // 404 for an unserved slug, like every other app route.
    expect((await api().request('/ghost-app/api/tools')).status).toBe(404)
  })

  it('serves the manifest and creates the data file lazily on first write', async () => {
    const res = await api().request('/fixture-app/api/manifest')
    expect((await json<{ slug: string }>(res)).slug).toBe('fixture-app')

    const created = await api().request('/fixture-app/api/deals', {
      method: 'POST',
      body: JSON.stringify({ name: 'Acme deal', status: 'discussion' }),
    })
    expect(created.status).toBe(201)
    const row = await json<Record<string, unknown>>(created)
    expect(row.id).toBeTruthy()
    expect(row.created_at).toBeTruthy()
    expect(row.updated_at).toBeTruthy()
    expect(row.archived_at).toBeNull()
  })

  it('walks the crud contract: list excludes archived, ?archived=1 includes', async () => {
    const a = api()
    const row = await json<{ id: string }>(
      await a.request('/fixture-app/api/deals', { method: 'POST', body: JSON.stringify({ name: 'D1' }) }),
    )
    expect((await json<unknown[]>(await a.request('/fixture-app/api/deals'))).length).toBe(1)

    const patched = await a.request(`/fixture-app/api/deals/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'won' }),
    })
    expect(patched.status).toBe(200)
    expect((await json<{ status: string }>(patched)).status).toBe('won')

    const archived = await a.request(`/fixture-app/api/deals/${row.id}/archive`, { method: 'POST' })
    expect(archived.status).toBe(200)
    expect((await json<unknown[]>(await a.request('/fixture-app/api/deals'))).length).toBe(0)
    expect((await json<unknown[]>(await a.request('/fixture-app/api/deals?archived=1'))).length).toBe(1)
  })

  it('denies unknown fields, missing required fields, and unknown entities', async () => {
    const a = api()
    expect(
      (await a.request('/fixture-app/api/deals', { method: 'POST', body: JSON.stringify({ nope: 1 }) })).status,
    ).toBe(400)
    expect(
      (await a.request('/fixture-app/api/deals', { method: 'POST', body: JSON.stringify({ status: 'x' }) })).status,
    ).toBe(400) // name is required
    expect((await a.request('/fixture-app/api/nonsense')).status).toBe(404)
    expect((await a.request('/no-such-app/api/deals')).status).toBe(404)
  })

  it('enforces the fk at create time (fk to a real row works, dangling is refused)', async () => {
    const a = api()
    const deal = await json<{ id: string }>(
      await a.request('/fixture-app/api/deals', { method: 'POST', body: JSON.stringify({ name: 'D' }) }),
    )
    const note = await a.request('/fixture-app/api/notes', {
      method: 'POST',
      body: JSON.stringify({ deal_id: deal.id, body: 'hi' }),
    })
    expect(note.status).toBe(201)
    const dangling = await a.request('/fixture-app/api/notes', {
      method: 'POST',
      body: JSON.stringify({ deal_id: 'ghost', body: 'hi' }),
    })
    expect(dangling.status).toBe(400)
  })

  it('serves declared metric values and nothing else', async () => {
    const a = api()
    await a.request('/fixture-app/api/deals', { method: 'POST', body: JSON.stringify({ name: 'D' }) })
    const metrics = await json<{ name: string; value: number }[]>(await a.request('/fixture-app/api/metrics'))
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({ name: 'deal_count', value: 1 })
  })

  it('mounts read-only on schema drift and refuses writes with the reason (contract §3)', async () => {
    const dir = join(cfg.dataRoot, 'apps', 'fixture-app')
    mkdirSync(dir, { recursive: true })
    appendFileSync(
      join(dir, 'installed.jsonl'),
      JSON.stringify({ slug: 'fixture-app', version: 1, schema_hash: 'deadbeef', installed_at: '2026-01-01' }) + '\n',
    )
    const a = api()
    const status = await json<{ readOnly: boolean; reason: string }>(await a.request('/fixture-app/api/status'))
    expect(status.readOnly).toBe(true)
    expect(status.reason).toContain('schema drift')
    const write = await a.request('/fixture-app/api/deals', { method: 'POST', body: JSON.stringify({ name: 'D' }) })
    expect(write.status).toBe(409)
  })
})

describe('bundle runner (contract §8)', () => {
  it("executes the fixture bundle's scenarios green", () => {
    const app = findApp(FIXTURES, 'fixture-app')!
    const result = runScenarios(app)
    expect(result.failures).toEqual([])
    expect(result.passed).toBe(3)
  })
})

describe('INTEGER primary keys (found by S-8 execution, 2026-07-10)', () => {
  // A chat-designed blueprint may declare `id INTEGER PRIMARY KEY` (the
  // rowid alias); the host must let SQLite assign it instead of forcing a
  // UUID string into an INTEGER column (datatype mismatch on every create).
  it('creates rows by letting SQLite assign the rowid pk', async () => {
    const artifactRoot = mkdtempSync(join(tmpdir(), 'apps-host-intpk-'))
    const dir = join(artifactRoot, 'apps', 'int-pk-app', 'versions', '001', 'bundle')
    mkdirSync(join(dir, 'tests'), { recursive: true })
    writeFileSync(
      join(dir, 'app.json'),
      JSON.stringify({
        slug: 'int-pk-app',
        version: 1,
        name: 'Int PK App',
        entities: [
          {
            name: 'items',
            columns: [
              { name: 'id', type: 'INTEGER', pk: true, notNull: true },
              { name: 'title', type: 'TEXT' },
              { name: 'created_at', type: 'TEXT', notNull: true, audit: true },
              { name: 'updated_at', type: 'TEXT', notNull: true, audit: true },
              { name: 'archived_at', type: 'TEXT', audit: true },
            ],
          },
        ],
        metrics: [],
        stories: [],
        ui: { screens: [] },
        blueprint_hash: '0'.repeat(64),
      }),
    )
    writeFileSync(
      join(dir, 'schema.sql'),
      'CREATE TABLE IF NOT EXISTS items (\n' +
        '  id INTEGER PRIMARY KEY,\n  title TEXT,\n' +
        '  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL,\n  archived_at TEXT\n);\n',
    )
    writeFileSync(join(dir, 'mcp-tools.json'), JSON.stringify({ tools: [] }))
    writeFileSync(join(dir, 'ui.json'), JSON.stringify({ screens: [] }))
    writeFileSync(join(dir, 'tests', 'scenarios.json'), JSON.stringify({ scenarios: [] }))

    const a = buildApi({ artifactRoot, dataRoot: mkdtempSync(join(tmpdir(), 'apps-host-intpk-data-')) })
    const created = await a.request('/int-pk-app/api/items', {
      method: 'POST',
      body: JSON.stringify({ title: 'first' }),
    })
    expect(created.status).toBe(201)
    const row = await json<{ id: number; title: string; created_at: string }>(created)
    expect(row.id).toBe(1)
    expect(row.title).toBe('first')
    expect(row.created_at).toBeTruthy()
    const second = await json<{ id: number }>(
      await a.request('/int-pk-app/api/items', { method: 'POST', body: JSON.stringify({ title: 'second' }) }),
    )
    expect(second.id).toBe(2)
  })
})
