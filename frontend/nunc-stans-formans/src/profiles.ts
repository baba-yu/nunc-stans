// Profile-screen logic (Phase D, S-5): the pure parts of the Profiles
// view — form shape, payload assembly, and the context labels — kept out
// of the component so they unit-test without mounting Vue.

export interface ProfileForm {
  id: string
  name: string
  provider: string
  model: string
  systemPrompt: string
  skills: string // comma-separated in the form
  memoryRead: string
  memoryWrite: string
  verify: 'on' | 'off'
  verifyGoal: string
  maxIters: number
}

export interface ProfilePayload {
  id: string
  name: string
  provider: string
  model?: string
  system_prompt?: string
  skills?: string[]
  memory_scope?: { read: string[]; write: string[] }
  goal_verify?: { verify: 'on' | 'off'; goal?: string; maxIters?: number }
}

export const CONTEXTS = [
  { key: 'fourfive-chat', label: 'FourFive chat' },
  { key: 'news-steps', label: 'News steps' },
  { key: 'agents', label: 'Agents' },
] as const

export type ContextKey = (typeof CONTEXTS)[number]['key']

export const PROVIDERS = ['llama-cpp', 'ollama', 'anthropic-api', 'claude-code', 'mock']

export function blankForm(): ProfileForm {
  return {
    id: '', name: '', provider: 'llama-cpp', model: '', systemPrompt: '',
    skills: '', memoryRead: '', memoryWrite: '', verify: 'off',
    verifyGoal: '', maxIters: 2,
  }
}

const splitList = (s: string): string[] =>
  s.split(',').map(x => x.trim()).filter(Boolean)

/** Form → PUT body: empty optional fields are OMITTED (the gate denies
 * unknown fields but tolerates absent ones; an empty string is not a
 * model). */
export function toPayload(form: ProfileForm): ProfilePayload {
  const payload: ProfilePayload = {
    id: form.id.trim(),
    name: form.name.trim(),
    provider: form.provider.trim(),
  }
  if (form.model.trim()) payload.model = form.model.trim()
  if (form.systemPrompt.trim()) payload.system_prompt = form.systemPrompt.trim()
  const skills = splitList(form.skills)
  if (skills.length) payload.skills = skills
  const read = splitList(form.memoryRead)
  const write = splitList(form.memoryWrite)
  if (read.length || write.length) payload.memory_scope = { read, write }
  if (form.verify === 'on' || form.maxIters !== 2) {
    payload.goal_verify = { verify: form.verify }
    if (form.verifyGoal.trim()) payload.goal_verify.goal = form.verifyGoal.trim()
    if (form.maxIters !== 2) payload.goal_verify.maxIters = form.maxIters
  }
  return payload
}

/** Stored profile → editable form. */
export function toForm(p: ProfilePayload): ProfileForm {
  return {
    id: p.id,
    name: p.name,
    provider: p.provider,
    model: p.model ?? '',
    systemPrompt: p.system_prompt ?? '',
    skills: (p.skills ?? []).join(', '),
    memoryRead: (p.memory_scope?.read ?? []).join(', '),
    memoryWrite: (p.memory_scope?.write ?? []).join(', '),
    verify: p.goal_verify?.verify ?? 'off',
    verifyGoal: p.goal_verify?.goal ?? '',
    maxIters: p.goal_verify?.maxIters ?? 2,
  }
}

/** Duplicate: same settings, fresh id/name the user then edits. */
export function duplicateForm(p: ProfilePayload): ProfileForm {
  const form = toForm(p)
  form.id = `${p.id}-copy`
  form.name = `${p.name} (copy)`
  return form
}
