import { describe, expect, it } from 'vitest'
import {
  BLUEPRINT_MAX_CONVO_CHARS, BLUEPRINT_MAX_TURNS,
  buildDependencyContext, buildBlueprintMessages,
} from './blueprint-prompt'
import type { Blueprint } from '../../shared/blueprint'

const BP: Blueprint = {
  app: { name: 'Warehouse Tracker' },
  mock_ui: { screens: [] },
  entities: [{ name: 'products', columns: [{ name: 'id', type: 'TEXT', pk: true }] }],
  business_logic: [],
  terminology: [],
  apis: [],
  open_questions: [],
  state_transitions: [],
  metrics: [],
  stories: [],
}

const BP2: Blueprint = {
  app: { name: 'Shipping' },
  mock_ui: { screens: [] },
  entities: [{ name: 'shipments', columns: [{ name: 'id', type: 'TEXT', pk: true }] }],
  business_logic: [],
  terminology: [],
  apis: [],
  open_questions: [],
  state_transitions: [],
  metrics: [],
  stories: [],
}

describe('buildDependencyContext', () => {
  it('returns null when there are no dependencies with blueprints', () => {
    expect(buildDependencyContext([])).toBeNull()
    expect(
      buildDependencyContext([{ name: 'X', slug: 'x', pinned_version: 1, blueprint: null }]),
    ).toBeNull()
  })

  it('builds a system message with namespacing rules and the dependency JSON', () => {
    const msg = buildDependencyContext([
      { name: 'Warehouse Tracker', slug: 'warehouse', pinned_version: 3, blueprint: BP },
    ])
    expect(msg?.role).toBe('system')
    expect(msg?.content).toContain('Warehouse Tracker')
    expect(msg?.content).toContain('warehouse')
    expect(msg?.content).toContain('v3')
    expect(msg?.content).toContain('READ-ONLY')
    expect(msg?.content).toContain('"products"')
    expect(msg?.content).toContain('never redefine')
  })

  it('includes both section headings when there are two dependencies', () => {
    const msg = buildDependencyContext([
      { name: 'Warehouse Tracker', slug: 'warehouse', pinned_version: 3, blueprint: BP },
      { name: 'Shipping', slug: 'shipping', pinned_version: 1, blueprint: BP2 },
    ])
    expect(msg?.content).toContain('(namespace: warehouse, pinned v3)')
    expect(msg?.content).toContain('(namespace: shipping, pinned v1)')
  })
})

describe('buildBlueprintMessages', () => {
  it('hoists system-role history entries into the system prompt instead of the transcript', () => {
    const history = [
      { role: 'system' as const, content: 'DEP-CONTEXT-MARKER' },
      { role: 'user' as const, content: 'hello' },
    ]
    const msgs = buildBlueprintMessages(history, null)

    expect(msgs).toHaveLength(2)

    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toContain('DEP-CONTEXT-MARKER')

    expect(msgs[1].role).toBe('user')
    expect(msgs[1].content).not.toContain('DEP-CONTEXT-MARKER')
    expect(msgs[1].content).not.toContain('system:')
    expect(msgs[1].content).toContain('user: hello')
  })

  // The bounded window (2026-07-10): the blueprint prompt must not outgrow
  // the serving slot however long the chat gets — the current blueprint
  // carries the accumulated design, so dropping old turns loses nothing.
  const turn = (i: number) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `t${String(i).padStart(2, '0')}`,
  })

  it('keeps a short conversation intact with no omission marker', () => {
    const msgs = buildBlueprintMessages([{ role: 'user', content: 'hello' }], null)
    expect(msgs[1].content).toContain('user: hello')
    expect(msgs[1].content).not.toContain('omitted')
  })

  it('keeps only the newest turns past the turn cap and marks the omission', () => {
    const history = Array.from({ length: BLUEPRINT_MAX_TURNS + 10 }, (_, i) => turn(i))
    const user = buildBlueprintMessages(history, null)[1].content
    expect(user).toContain('earlier turns omitted')
    expect(user).not.toContain('t09') // 26 turns, window 16 → t10..t25 survive
    expect(user).toContain('t10')
    expect(user).toContain('t25')
  })

  it('respects the character budget, newest turns winning', () => {
    const big = 'x'.repeat(Math.floor(BLUEPRINT_MAX_CONVO_CHARS / 3))
    const history = [
      { role: 'user' as const, content: `A${big}` },
      { role: 'assistant' as const, content: `B${big}` },
      { role: 'user' as const, content: `C${big}` },
      { role: 'assistant' as const, content: `D${big}` },
    ]
    const user = buildBlueprintMessages(history, null)[1].content
    expect(user).toContain('earlier turns omitted')
    expect(user).toContain('user: C')
    expect(user).toContain('assistant: D')
    expect(user).not.toContain('user: A')
    expect(user).not.toContain('assistant: B')
  })

  it('clips a single turn that alone busts the budget', () => {
    const history = [{ role: 'user' as const, content: 'y'.repeat(BLUEPRINT_MAX_CONVO_CHARS + 5000) }]
    const user = buildBlueprintMessages(history, null)[1].content
    expect(user).toContain('…[clipped]')
    expect(user.length).toBeLessThan(BLUEPRINT_MAX_CONVO_CHARS + 2000)
  })
})
