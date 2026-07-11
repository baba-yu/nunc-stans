// NL commitment authoring: the pure part of the ME AuthorForm's
// natural-language leg. The local model's proposal (via the gate's
// /api/self/commitment/extract) is coerced into the FORM's string fields —
// never trusted, always shown to the user for review before they Author.
// Kept out of the component so it unit-tests without mounting Vue
// (the topics.ts / parseProposal discipline).

export interface CommitmentDraft {
  slug: string
  title: string
  started_at: string
  money_jpy: string
  hours: string
  note: string
}

/** Kebab-case whatever the model called a slug so the form's
 * pattern="[a-z0-9-]+" accepts it (non-latin input can yield anything). */
export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '')
}

/** Coerce a model reply into the form's string fields. Drops anything
 * malformed rather than trusting model output — the user reviews the
 * prefilled form regardless. Returns null only when nothing usable came
 * back at all. */
export function parseCommitmentProposal(raw: unknown): CommitmentDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

  const slug = sanitizeSlug(str(o.slug))
  const title = str(o.title)
  const startedAt = /^\d{4}-\d{2}-\d{2}$/.test(str(o.started_at)) ? str(o.started_at) : ''
  const money =
    typeof o.money_jpy === 'number' && Number.isInteger(o.money_jpy) && o.money_jpy >= 0
      ? String(o.money_jpy)
      : ''
  const hours =
    typeof o.hours === 'number' && Number.isFinite(o.hours) && o.hours >= 0 ? String(o.hours) : ''

  if (!slug && !title && !startedAt) return null
  return { slug, title, started_at: startedAt, money_jpy: money, hours, note: str(o.note) }
}

/** The user's local date as YYYY-MM-DD — sent with the request so the
 * model resolves relative dates ("since June") in the user's timezone. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
