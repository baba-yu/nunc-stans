import { describe, expect, it } from 'vitest'
import { cleanTopic, mergeProposal, parseProposal, validateTopics } from './topics'
import type { Topic } from './topics'

const t = (name: string, intent: Topic['intent'] = 'broad', mandatory = false, note?: string): Topic =>
  note ? { name, intent, mandatory, note } : { name, intent, mandatory }

describe('validateTopics', () => {
  it('mirrors the gate rails', () => {
    expect(validateTopics([])).toMatch(/at least one/)
    expect(validateTopics([t('')])).toMatch(/needs a name/)
    expect(validateTopics([t('A'), t('A')])).toMatch(/duplicate/) // gate is case-sensitive
    expect(validateTopics([t('A'), t('a')])).toBeNull() // distinct strings to the pipeline
    expect(validateTopics([t('A', 'deep', true)])).toBeNull()
  })
})

describe('mergeProposal (W9 — refine by name, never blind-overwrite)', () => {
  it('adds a genuinely new topic and reports it', () => {
    const { merged, changes } = mergeProposal([t('Hardware')], [t('Physical AI', 'watch')])
    expect(merged.map((x) => x.name)).toEqual(['Hardware', 'Physical AI'])
    expect(changes).toEqual([{ kind: 'add', after: t('Physical AI', 'watch') }])
  })

  it('refines an existing topic in place, keeping its canonical spelling', () => {
    const { merged, changes } = mergeProposal(
      [t('Agent Harness', 'broad', false)],
      [t('agent harness', 'deep', true, 'track harness ideas')], // different case
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual(t('Agent Harness', 'deep', true, 'track harness ideas')) // name kept
    expect(changes[0].kind).toBe('refine')
    expect(changes[0].before).toMatchObject({ intent: 'broad', mandatory: false })
  })

  it('never removes existing topics the proposal omits', () => {
    const { merged } = mergeProposal([t('Keep me'), t('Me too')], [t('New one')])
    expect(merged.map((x) => x.name)).toEqual(['Keep me', 'Me too', 'New one'])
  })

  it('does not surface a no-op refine as a change', () => {
    const { changes } = mergeProposal([t('X', 'deep', true)], [t('X', 'deep', true)])
    expect(changes).toEqual([])
  })

  it('a proposal empty note does not erase an existing note', () => {
    const { merged } = mergeProposal([t('X', 'broad', false, 'keep this')], [t('X', 'deep', false)])
    expect(merged[0].note).toBe('keep this')
  })
})

describe('parseProposal (W4 — tolerant of model output)', () => {
  it('accepts a wrapper or a bare array and drops malformed entries', () => {
    expect(parseProposal({ topics: [{ name: 'A', intent: 'deep', mandatory: true }] })).toEqual([
      t('A', 'deep', true),
    ])
    expect(parseProposal([{ name: 'B' }, { intent: 'deep' }, null, 'x'])).toEqual([t('B', 'broad', false)])
  })

  it('defaults an unknown intent to broad', () => {
    expect(parseProposal([{ name: 'C', intent: 'loud' }])[0].intent).toBe('broad')
  })
})

describe('cleanTopic', () => {
  it('drops an empty note and trims', () => {
    expect(cleanTopic({ name: '  A  ', intent: 'broad', mandatory: false, note: '  ' })).toEqual(t('A'))
  })
})
