import { describe, expect, it } from 'vitest'
import { localToday, parseCommitmentProposal, sanitizeSlug } from './commitment-extract'

describe('sanitizeSlug', () => {
  it('kebab-cases and strips anything outside a-z0-9-', () => {
    expect(sanitizeSlug('Eikaiwa Monthly')).toBe('eikaiwa-monthly')
    expect(sanitizeSlug('英会話--x')).toBe('x')
    expect(sanitizeSlug('--a__b--')).toBe('a-b')
    expect(sanitizeSlug('')).toBe('')
  })
})

describe('parseCommitmentProposal (tolerant of model output)', () => {
  it('coerces a well-formed proposal into form strings', () => {
    expect(
      parseCommitmentProposal({
        slug: 'eikaiwa',
        title: '英会話を月3万円で続ける',
        started_at: '2026-06-01',
        money_jpy: 30000,
        hours: null,
        note: null,
      }),
    ).toEqual({
      slug: 'eikaiwa',
      title: '英会話を月3万円で続ける',
      started_at: '2026-06-01',
      money_jpy: '30000',
      hours: '',
      note: '',
    })
  })

  it('drops malformed fields rather than trusting the model', () => {
    const got = parseCommitmentProposal({
      slug: 'OK Slug!',
      title: 'x',
      started_at: 'June 2026', // not YYYY-MM-DD
      money_jpy: 12.5, // not an integer
      hours: -1, // negative
      note: 42, // not a string
    })
    expect(got).toEqual({
      slug: 'ok-slug',
      title: 'x',
      started_at: '',
      money_jpy: '',
      hours: '',
      note: '',
    })
  })

  it('returns null when nothing usable came back', () => {
    expect(parseCommitmentProposal(null)).toBeNull()
    expect(parseCommitmentProposal([])).toBeNull()
    expect(parseCommitmentProposal('json')).toBeNull()
    expect(parseCommitmentProposal({ money_jpy: 100 })).toBeNull()
  })
})

describe('localToday', () => {
  it('formats the local date as YYYY-MM-DD', () => {
    expect(localToday(new Date(2026, 6, 10))).toBe('2026-07-10')
    expect(localToday(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
