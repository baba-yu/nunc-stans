// Topic-editor logic (topics-authoring T6): the pure parts of the World
// topic panel — the model, validation, and the NL-authoring MERGE (W9:
// an authored proposal is merged into the existing set, refining by name,
// never blind-overwriting, and the diff is shown before the user saves).
// Kept out of the component so it unit-tests without mounting Vue.

export type TopicIntent = 'deep' | 'broad' | 'watch'
export const TOPIC_INTENTS: TopicIntent[] = ['deep', 'broad', 'watch']

export interface Topic {
  name: string
  intent: TopicIntent
  mandatory: boolean
  note?: string
}

export interface TopicsFile {
  topics: Topic[]
  reference_sites?: string[]
}

export interface TopicsResponse extends TopicsFile {
  writable: boolean
  read_only_reason?: string
}

/** Mirror the gate's validation so the UI can block Save before the PUT
 * (the gate re-checks — this is a courtesy, not the authority). */
export function validateTopics(topics: Topic[]): string | null {
  if (topics.length === 0) return 'add at least one topic'
  const seen = new Set<string>()
  for (const t of topics) {
    const name = t.name.trim()
    if (!name) return 'every topic needs a name'
    if (!TOPIC_INTENTS.includes(t.intent)) return `"${name}": intent must be deep, broad, or watch`
    if (seen.has(name)) return `duplicate topic name "${name}"`
    seen.add(name)
  }
  return null
}

/** Trim a topic to the wire shape (drop an empty note). */
export function cleanTopic(t: Topic): Topic {
  const out: Topic = { name: t.name.trim(), intent: t.intent, mandatory: t.mandatory }
  if (t.note && t.note.trim()) out.note = t.note.trim()
  return out
}

export interface TopicChange {
  kind: 'add' | 'refine'
  before?: Topic
  after: Topic
}

export interface MergeResult {
  merged: Topic[]
  changes: TopicChange[]
}

const norm = (s: string): string => s.trim().toLowerCase()

/**
 * Merge an AUTHORED proposal into the existing topics (W9). Matching is by
 * normalized name: a proposal that names an existing topic REFINES it (its
 * fields win, but a field the proposal leaves empty keeps the existing
 * value); a new name is ADDED. Nothing is removed — authoring never blind-
 * overwrites — and every change is returned for the diff-review step.
 * Order: existing topics keep their positions (refined in place), new ones
 * append in proposal order.
 */
export function mergeProposal(existing: Topic[], proposal: Topic[]): MergeResult {
  const byName = new Map(existing.map((t) => [norm(t.name), t]))
  const merged = existing.map((t) => ({ ...t }))
  const mergedByName = new Map(merged.map((t) => [norm(t.name), t]))
  const changes: TopicChange[] = []

  for (const p of proposal) {
    const key = norm(p.name)
    if (!key) continue
    const prior = byName.get(key)
    if (prior) {
      const target = mergedByName.get(key)!
      const before = { ...target }
      target.name = prior.name // keep the canonical existing spelling
      target.intent = p.intent
      target.mandatory = p.mandatory
      if (p.note && p.note.trim()) target.note = p.note.trim()
      // A refine that changes nothing is not surfaced as a change.
      if (JSON.stringify(cleanTopic(before)) !== JSON.stringify(cleanTopic(target))) {
        changes.push({ kind: 'refine', before, after: { ...target } })
      }
    } else {
      const added = cleanTopic(p)
      merged.push(added)
      mergedByName.set(key, added)
      changes.push({ kind: 'add', after: added })
    }
  }
  return { merged, changes }
}

/** Parse a topics reply from the local model into Topic[] (W4). Tolerant of
 * a `{topics:[…]}` wrapper or a bare array; drops anything malformed rather
 * than trusting model output — the user reviews the result regardless. */
export function parseProposal(raw: unknown): Topic[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { topics?: unknown }).topics)
      ? (raw as { topics: unknown[] }).topics
      : []
  const out: Topic[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) continue
    const intent = TOPIC_INTENTS.includes(o.intent as TopicIntent) ? (o.intent as TopicIntent) : 'broad'
    const t: Topic = { name, intent, mandatory: o.mandatory === true }
    if (typeof o.note === 'string' && o.note.trim()) t.note = o.note.trim()
    out.push(t)
  }
  return out
}
