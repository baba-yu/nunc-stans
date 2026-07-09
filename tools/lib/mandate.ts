// The one place a mandate line is shaped. A mandate authorizes the agent
// to touch a scope; it is granted by the PRINCIPAL out of band (A1) — this
// only FORMATS the line. Two callers: `nunc-stans-agent mandate-template`
// (prints it for the human to append) and `tools/setup.ts` (appends it
// after the human approves interactively — the terminal y/N IS the
// out-of-band grant). Nothing here ever writes a file.

export interface MandateLine {
  id: string
  scope: string
  access: string[]
  external_side_effects: boolean
  granted_at: string
  expires_at: string
}

/** Build a mandate record for `scope`, granted at `now`, expiring after
 * `days` (default 30). read+write, no external side effects. */
export function mandateLine(scope: string, now: Date, days = 30): MandateLine {
  const expires = new Date(now.getTime() + days * 24 * 3600 * 1000)
  const id = `m-${now.toISOString().slice(0, 10)}-${scope.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`
  return {
    id,
    scope,
    access: ['read', 'write'],
    external_side_effects: false,
    granted_at: now.toISOString(),
    expires_at: expires.toISOString(),
  }
}

/** The single JSONL line to append to `mandates.jsonl`. */
export function mandateJsonl(scope: string, now: Date, days = 30): string {
  return JSON.stringify(mandateLine(scope, now, days))
}
