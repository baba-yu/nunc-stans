import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// These imports hit a real workspace: vitest.config.ts points
// FOURFIVE_WORKSPACE at a throwaway tmp dir for the whole run.
import { db, nowIso, WORKSPACE_DIR } from './db'
import { saveBlueprint, freezeAndBundle, setSoftwareStack, getSessionApp, FreezeError } from './workspace'
import type { Blueprint } from '../shared/blueprint'

function newSession(): string {
  const id = randomUUID()
  const ts = nowIso()
  db.prepare('INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    id,
    'New session',
    ts,
    ts,
  )
  return id
}

const bp = (name: string): Blueprint => ({
  app: { name },
  mock_ui: { screens: [] },
  entities: [{ name: 'items', columns: [{ name: 'label', type: 'text', nullable: false }] }],
  business_logic: [],
  terminology: [],
  apis: [],
  open_questions: [],
  state_transitions: [],
  metrics: [{ name: 'item_count', label: 'Items', sql: 'SELECT COUNT(*) FROM items' }],
  stories: [],
})

describe('freezeAndBundle (PE11)', () => {
  it('writes the five bundle files and stamps frozen_at + bundle_hash', () => {
    const session = newSession()
    const { slug, version } = saveBlueprint(session, bp(`Freeze One ${randomUUID().slice(0, 8)}`))
    const res = freezeAndBundle(slug, version)
    expect(res.frozen_at).toBeTruthy()
    expect(res.bundle_hash).toMatch(/^[0-9a-f]{64}$/)
    const bundleDir = join(WORKSPACE_DIR, 'apps', slug, 'versions', String(version).padStart(3, '0'), 'bundle')
    for (const f of ['app.json', 'schema.sql', 'mcp-tools.json', 'ui.json', 'tests/scenarios.json']) {
      expect(existsSync(join(bundleDir, f)), f).toBe(true)
    }
    // Idempotent re-freeze: same hash, same stamp, nothing rewritten.
    const again = freezeAndBundle(slug, version)
    expect(again.bundle_hash).toBe(res.bundle_hash)
    expect(again.frozen_at).toBe(res.frozen_at)
  })

  it('a frozen version refuses to drift: mutated blueprint is caught', () => {
    const session = newSession()
    const { slug, version } = saveBlueprint(session, bp(`Freeze Two ${randomUUID().slice(0, 8)}`))
    freezeAndBundle(slug, version)
    const file = join(WORKSPACE_DIR, 'apps', slug, 'versions', String(version).padStart(3, '0'), 'blueprint.json')
    const mutated = JSON.parse(readFileSync(file, 'utf8')) as Blueprint
    mutated.app.description = 'sneaky edit behind the freeze'
    writeFileSync(file, JSON.stringify(mutated, null, 2))
    expect(() => freezeAndBundle(slug, version)).toThrowError(FreezeError)
    try {
      freezeAndBundle(slug, version)
    } catch (err) {
      expect((err as FreezeError).code).toBe('drift')
    }
  })

  it('setSoftwareStack patches an UNFROZEN version in place', () => {
    const session = newSession()
    saveBlueprint(session, bp(`Freeze Three ${randomUUID().slice(0, 8)}`))
    const before = getSessionApp(session)!.current_version
    expect(setSoftwareStack(session, 'Vue + SQLite')).toBe(true)
    expect(getSessionApp(session)!.current_version).toBe(before) // in place
  })

  it('setSoftwareStack on a FROZEN version rolls a new version (F7)', () => {
    const session = newSession()
    const { slug, version } = saveBlueprint(session, bp(`Freeze Four ${randomUUID().slice(0, 8)}`))
    freezeAndBundle(slug, version)
    const frozenRaw = readFileSync(
      join(WORKSPACE_DIR, 'apps', slug, 'versions', String(version).padStart(3, '0'), 'blueprint.json'),
      'utf8',
    )
    expect(setSoftwareStack(session, 'Rust + SQLite')).toBe(true)
    const app = getSessionApp(session)!
    expect(app.current_version).toBe(version + 1) // rolled, not patched
    const frozenRawAfter = readFileSync(
      join(WORKSPACE_DIR, 'apps', slug, 'versions', String(version).padStart(3, '0'), 'blueprint.json'),
      'utf8',
    )
    expect(frozenRawAfter).toBe(frozenRaw) // the frozen bytes never moved
    // and the frozen version still re-verifies byte-identical
    expect(() => freezeAndBundle(slug, version)).not.toThrow()
  })

  it('unknown app/version is a not_found refusal', () => {
    try {
      freezeAndBundle('no-such-app', 1)
      expect.unreachable()
    } catch (err) {
      expect((err as FreezeError).code).toBe('not_found')
    }
  })
})
