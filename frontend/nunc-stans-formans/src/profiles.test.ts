// Profiles-screen logic (Phase D, S-5): form <-> payload mapping.
import { describe, expect, it } from 'vitest'
import { blankForm, duplicateForm, toForm, toPayload } from './profiles'

describe('toPayload', () => {
  it('omits empty optional fields entirely', () => {
    const form = blankForm()
    form.id = 'local-chat'
    form.name = 'Local chat'
    expect(toPayload(form)).toEqual({ id: 'local-chat', name: 'Local chat', provider: 'ollama' })
  })

  it('carries the full record and splits comma lists', () => {
    const form = blankForm()
    Object.assign(form, {
      id: 'x', name: 'X', provider: 'ollama', model: 'qwen3.6:27b',
      systemPrompt: 'be brief', skills: 'memory, search',
      memoryRead: 'notes/*, self/commitment/*', memoryWrite: 'notes/*',
      verify: 'on', verifyGoal: 'cite sources', maxIters: 3,
    })
    expect(toPayload(form)).toEqual({
      id: 'x', name: 'X', provider: 'ollama', model: 'qwen3.6:27b',
      system_prompt: 'be brief', skills: ['memory', 'search'],
      memory_scope: { read: ['notes/*', 'self/commitment/*'], write: ['notes/*'] },
      goal_verify: { verify: 'on', goal: 'cite sources', maxIters: 3 },
    })
  })

  it('round-trips through toForm', () => {
    const payload = {
      id: 'y', name: 'Y', provider: 'anthropic-api', model: 'claude-sonnet-5',
      memory_scope: { read: ['a'], write: ['b'] },
      goal_verify: { verify: 'off' as const, maxIters: 4 },
    }
    expect(toPayload(toForm(payload))).toEqual(payload)
  })
})

describe('duplicateForm', () => {
  it('keeps the settings, renames id and name', () => {
    const dup = duplicateForm({ id: 'base', name: 'Base', provider: 'mock', model: 'm' })
    expect(dup.id).toBe('base-copy')
    expect(dup.name).toBe('Base (copy)')
    expect(dup.model).toBe('m')
  })
})
