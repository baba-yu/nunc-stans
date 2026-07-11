import { describe, expect, it } from 'vitest'
import { perSlotCtx, toForm, toPayload } from './model-backend'
import type { ModelBackendState } from './model-backend'

const state: ModelBackendState = {
  catalog: [],
  llama_model: 'Qwen3.6-27B-Q4_K_M.gguf',
  llama_ctx: 32768,
  llama_parallel: 4,
  llama_url: '',
  defaults: { llama_ctx: 32768, llama_parallel: 4 },
  available_models: ['Qwen3.6-27B-Q4_K_M.gguf', 'qwen2.5-3b-instruct-q4_k_m.gguf'],
  effective_backend: 'local',
  applies_on: 'model-backend restart (just up / just llama)',
}

describe('toForm', () => {
  it('maps the GET shape onto the editable form', () => {
    expect(toForm(state)).toEqual({
      model: 'Qwen3.6-27B-Q4_K_M.gguf', ctx: 32768, parallel: 4, url: '',
    })
  })
  it('null model becomes the empty (automatic) choice', () => {
    expect(toForm({ ...state, llama_model: null }).model).toBe('')
  })
})

describe('toPayload', () => {
  it('omits an empty model (unset = automatic resolution)', () => {
    const p = toPayload({ model: '', ctx: 32768, parallel: 4, url: '' })
    expect(p).not.toHaveProperty('llama_model')
    expect(p.llama_ctx).toBe(32768)
    expect(p.llama_parallel).toBe(4)
  })
  it('always sends url — empty string is the explicit local choice', () => {
    expect(toPayload({ model: '', ctx: 32768, parallel: 4, url: '' }).llama_url).toBe('')
    expect(toPayload({ model: '', ctx: 32768, parallel: 4, url: ' http://x:1 ' }).llama_url).toBe('http://x:1')
  })
  it('keeps an explicit model and rounds the knobs', () => {
    const p = toPayload({ model: ' m.gguf ', ctx: 16384.4, parallel: 2.6, url: '' })
    expect(p.llama_model).toBe('m.gguf')
    expect(p.llama_ctx).toBe(16384)
    expect(p.llama_parallel).toBe(3)
  })
})

describe('perSlotCtx', () => {
  it('divides total context across parallel slots', () => {
    expect(perSlotCtx({ model: '', ctx: 32768, parallel: 4, url: '' })).toBe(8192)
    expect(perSlotCtx({ model: '', ctx: 32768, parallel: 0, url: '' })).toBe(32768)
  })
})
