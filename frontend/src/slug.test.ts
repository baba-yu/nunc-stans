import { describe, expect, it } from 'vitest'
import { slugForHeadline } from './slug'

const VALID = /^[a-z0-9-]+$/

describe('slugForHeadline', () => {
  it('produces a valid, readable slug for an ASCII headline', () => {
    const s = slugForHeadline('prediction.81e76659807bd1fc', 'MCP stdio transport turns off by Q1 2027')
    expect(s).toMatch(VALID)
    expect(s.startsWith('news-807bd1fc-')).toBe(true)
    expect(s).toContain('mcp-stdio')
  })

  it('stays valid and unique for all-CJK / all-emoji headlines (no collapse to "news")', () => {
    const a = slugForHeadline('prediction.aaaaaaaaaaaaaaaa', '速報 円安加速')
    const b = slugForHeadline('prediction.bbbbbbbbbbbbbbbb', '🎉🎊🚀')
    expect(a).toMatch(VALID)
    expect(b).toMatch(VALID)
    expect(a).not.toBe(b) // distinct ids -> distinct slugs, no 409
    expect(a).toBe('news-aaaaaaaa')
    expect(b).toBe('news-bbbbbbbb')
  })

  it('never exceeds 100 chars and never has a trailing dash', () => {
    const s = slugForHeadline('prediction.deadbeefdeadbeef', 'x '.repeat(200))
    expect(s.length).toBeLessThanOrEqual(100)
    expect(s.endsWith('-')).toBe(false)
    expect(s).toMatch(VALID)
  })

  it('falls back to a placeholder tail when the id has no alphanumerics', () => {
    const s = slugForHeadline('///', 'a headline')
    expect(s).toMatch(VALID)
    expect(s.startsWith('news-x')).toBe(true)
  })
})
