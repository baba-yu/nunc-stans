// Pure week-bucketing model for the timeline view (S-9) — no DOM, no fetch.
// The self scope as a time series: commitments opened (started_at), closed
// (the observable outcome's recorded_at), edges by author (created_at), and
// a weekly provenance mix. Interventions and mandate windows have no records
// yet (Phase D+); the view reserves their lanes, this model knows nothing of
// them.
import { provenanceMix, type ProvenanceMix } from './provenance'
import type { Author, Commitment, Edge, Outcome } from './types'

/// ISO-8601 week key ('2026-W27') for a YYYY-MM-DD date or an RFC3339
/// timestamp. UTC throughout: vault timestamps are Z-suffixed and
/// started_at is a plain user-entered date.
export function isoWeekKey(dateISO: string): string {
  const d = new Date(dateISO.length === 10 ? dateISO + 'T00:00:00Z' : dateISO)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7 // Mon=1 .. Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - day) // this week's Thursday decides the year
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** UTC Monday 00:00 of the week containing the date. */
function mondayOf(dateISO: string): Date {
  const d = new Date(dateISO.length === 10 ? dateISO + 'T00:00:00Z' : dateISO)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 1 - day)
  return t
}

export interface WeekRow {
  key: string
  /** commitment ids opened this week (by started_at) */
  opened: string[]
  /** commitment ids whose observable outcome was recorded this week */
  closed: string[]
  /** edges appended this week, by author */
  edges: Record<Author, number>
  /** provenance mix over the commitments OPENED this week */
  mix: ProvenanceMix
}

/// Contiguous weeks, oldest → newest, spanning every event; weeks with no
/// events still appear (a gap is information).
export function buildWeeks(
  commitments: Commitment[],
  edges: Edge[],
  outcomes: Outcome[],
): WeekRow[] {
  const dates: string[] = [
    ...commitments.map((c) => c.started_at),
    ...edges.map((e) => e.created_at),
    ...outcomes.map((o) => o.recorded_at),
  ].filter((s) => typeof s === 'string' && s.length >= 10)
  if (dates.length === 0) return []

  const mondays = dates.map((s) => mondayOf(s).getTime())
  const first = Math.min(...mondays)
  const last = Math.max(...mondays)

  const rows = new Map<string, WeekRow>()
  for (let t = first; t <= last; t += 7 * 86400000) {
    const key = isoWeekKey(new Date(t).toISOString())
    rows.set(key, {
      key,
      opened: [],
      closed: [],
      edges: { user: 0, ai: 0, sensor: 0 },
      mix: { aiPrompted: 0, total: 0, percent: 0 },
    })
  }

  const byId = new Map(commitments.map((c) => [c.id, c]))
  for (const c of commitments) {
    rows.get(isoWeekKey(c.started_at))?.opened.push(c.id)
  }
  for (const o of outcomes) {
    if (o.component === 'observable') {
      rows.get(isoWeekKey(o.recorded_at))?.closed.push(o.commitment)
    }
  }
  for (const e of edges) {
    const row = rows.get(isoWeekKey(e.created_at))
    if (row && e.author in row.edges) row.edges[e.author]++
  }
  for (const row of rows.values()) {
    const openedCommitments = row.opened
      .map((id) => byId.get(id))
      .filter((c): c is Commitment => Boolean(c))
    row.mix = provenanceMix(openedCommitments, edges)
  }
  return [...rows.values()]
}
