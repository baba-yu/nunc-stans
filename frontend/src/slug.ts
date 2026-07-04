import type { WorldPrediction } from './types'

// Derive a commitment slug from a News headline that is always valid
// ([a-z0-9-]+, <=100) AND unique per headline. The News id ("prediction.<hash>")
// contributes a stable suffix so headlines with no ASCII alphanumerics
// (all-CJK/emoji/punctuation) don't all collapse to the same slug and 409 on
// the second commit. The result is the default; the user can edit it (F3).
export function slugForHeadline(id: string, label: string): string {
  const tail = (id.match(/[a-z0-9]+$/i)?.[0] ?? id.replace(/[^a-z0-9]/gi, '')).slice(-8).toLowerCase()
  const base = `news-${tail || 'x'}`
  const words = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const slug = words ? `${base}-${words}` : base
  return slug.slice(0, 100).replace(/-+$/g, '')
}

export function slugFor(h: WorldPrediction): string {
  return slugForHeadline(h.id, h.label)
}
