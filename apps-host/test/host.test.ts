import { beforeEach, describe, expect, it } from 'vitest'
import { appendFileSync, mkdirSync, mkdtempSync } from 'node:fs'
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
