// The /strategy stage-3 read-out (Phase E, plan PE12; story S-7): a card
// grounded EXCLUSIVELY in the app's declared metrics. The metric values come
// from apps-host's PUBLISHED API (contracts/app-bundle.md §6) — the one read
// surface strategy features may quote; fourfive never opens the app's SQLite.
// The grounding-subset rule ("metrics the app does not measure are not
// grounds") is enforced HERE, in code: a card quoting anything outside the
// declaration fails the render, it is never softened into prose.
import type { ChatMessage, ServedMetric, StrategyCard } from '../shared/types'

/** apps-host's loopback origin (the gate strips /apps; server-to-server
 * traffic goes to the host directly). Env override for tests/dev. */
export const APPS_HOST_URL = process.env.FOURFIVE_APPS_URL ?? 'http://127.0.0.1:8788'

export type StrategyErrorCode = 'not_served' | 'unreachable' | 'no_metrics' | 'shape' | 'grounding'

const STATUS = {
  not_served: 409, // the app exists but no frozen bundle is being served
  unreachable: 502, // apps-host is down or answered garbage
  no_metrics: 422, // nothing declared → nothing can ground a read-out (PE8)
  shape: 422, // the model's output is not a card
  grounding: 422, // the card quotes outside the declaration — render refused
} as const

export class StrategyError extends Error {
  code: StrategyErrorCode
  status: (typeof STATUS)[StrategyErrorCode]
  constructor(code: StrategyErrorCode, message: string) {
    super(message)
    this.code = code
    this.status = STATUS[code]
  }
}

/** A served app as apps-host's `GET /api` lists it. */
export interface ServedApp {
  slug: string
  version: number
  name: string
}

async function getJson(url: string, f: typeof fetch): Promise<unknown> {
  let res: Response
  try {
    res = await f(url, { signal: AbortSignal.timeout(5_000) })
  } catch (err) {
    throw new StrategyError('unreachable', `apps-host is unreachable (${url}): ${(err as Error).message}`)
  }
  if (!res.ok) throw new StrategyError('unreachable', `apps-host answered ${res.status} for ${url}`)
  return res.json()
}

/** Resolve the SERVED version of the session's app — the strategy card is
 * stamped with what the metrics actually came from, not the session's
 * rolling blueprint version. */
export async function fetchServedApp(slug: string, f: typeof fetch = fetch, base: string = APPS_HOST_URL): Promise<ServedApp> {
  const list = (await getJson(`${base}/api`, f)) as ServedApp[]
  const app = Array.isArray(list) ? list.find((a) => a?.slug === slug) : undefined
  if (!app) {
    throw new StrategyError('not_served', `${slug} has no served bundle — freeze one with “Generate bundle” first`)
  }
  return app
}

export async function fetchServedMetrics(slug: string, f: typeof fetch = fetch, base: string = APPS_HOST_URL): Promise<ServedMetric[]> {
  const metrics = (await getJson(`${base}/${slug}/api/metrics`, f)) as ServedMetric[]
  if (!Array.isArray(metrics) || metrics.length === 0) {
    throw new StrategyError('no_metrics', `${slug} declares no metrics — nothing can ground a strategy read-out (PE8)`)
  }
  return metrics
}

/** The metrics-ONLY prompt (PE12): no chat history, no blueprint — the model
 * sees the declared measurements and nothing else about the business. */
export function buildStrategyMessages(app: ServedApp, metrics: ServedMetric[]): ChatMessage[] {
  const lines = metrics.map(
    (m) => `- ${m.name} ("${m.label}"): ${m.error ? 'unavailable (metric error)' : JSON.stringify(m.value)}`,
  )
  const system = [
    `You are FourFive's strategy reader. The ONLY facts you have about ${app.name} (${app.slug}@v${app.version}) are its declared metrics below. You know nothing else about this business — do not invent numbers, trends, or context.`,
    `Declared metrics (current values):\n${lines.join('\n')}`,
    'Output ONLY one JSON object — no prose, no code fences:\n{ "win": string, "constraint": string, "risk_to_watch": string, "grounding": string[] }',
    [
      '"win": the single strongest positive signal in these numbers (1-2 sentences).',
      '"constraint": the binding limitation these numbers show (1-2 sentences).',
      '"risk_to_watch": the metric movement that would hurt most next (1-2 sentences).',
      '"grounding": the metric NAMES from the declared list, exactly as written, that your three statements rely on. At least one; never a name outside the list.',
    ].join('\n'),
    'Match the language of the metric labels for the prose.',
  ].join('\n\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: 'Produce the strategy read-out JSON now.' },
  ]
}

/** Grammar-level guard for providers that honor jsonSchema (llama.cpp):
 * grounding entries are constrained to the declared names. Advisory only —
 * parseStrategyCard below is the enforcement (S-7: checked in code). */
export function strategyJsonSchema(declared: string[]): object {
  return {
    type: 'object',
    properties: {
      win: { type: 'string' },
      constraint: { type: 'string' },
      risk_to_watch: { type: 'string' },
      grounding: { type: 'array', items: { enum: declared }, minItems: 1 },
    },
    required: ['win', 'constraint', 'risk_to_watch', 'grounding'],
    additionalProperties: false,
  }
}

/** Validate the model's output into a card. Throws — never repairs — on a
 * missing field or a grounding entry outside the declaration: S-7's
 * mechanical criterion is that such a card FAILS the render. */
export function parseStrategyCard(raw: unknown, declared: string[]): StrategyCard {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new StrategyError('shape', 'the model did not return a strategy JSON object')
  }
  const o = raw as Record<string, unknown>
  for (const key of ['win', 'constraint', 'risk_to_watch'] as const) {
    if (typeof o[key] !== 'string' || !(o[key] as string).trim()) {
      throw new StrategyError('shape', `strategy card is missing "${key}"`)
    }
  }
  if (!Array.isArray(o.grounding) || o.grounding.some((g) => typeof g !== 'string')) {
    throw new StrategyError('shape', 'strategy card "grounding" must be an array of metric names')
  }
  const grounding = [...new Set((o.grounding as string[]).map((g) => g.trim()))].filter(Boolean)
  const undeclared = grounding.filter((g) => !declared.includes(g))
  if (undeclared.length) {
    throw new StrategyError(
      'grounding',
      `grounding quotes undeclared metric${undeclared.length > 1 ? 's' : ''} ${undeclared.map((g) => `"${g}"`).join(', ')} — metrics the app does not measure are not grounds; render refused`,
    )
  }
  if (grounding.length === 0) {
    throw new StrategyError('grounding', 'the card quotes no declared metric — an ungrounded read-out is refused')
  }
  return {
    win: (o.win as string).trim(),
    constraint: (o.constraint as string).trim(),
    risk_to_watch: (o.risk_to_watch as string).trim(),
    grounding,
  }
}

// --- save-path (Phase F, F-3): read-out → superposition_state ------------
// The card is ephemeral until the user saves it; saving turns a read-out into
// GROUNDS for a decision (journey T11). The self scope is the ns engine's
// jurisdiction, so the save is a published-API → published-API hop (§13-A):
// fourfive never writes the vault, it POSTs the ns engine's own endpoint. The
// engine draws the informed_by edge to the artifact. Grounding ⊆ declared is
// re-checked HERE against the live served metrics (defense in depth) before
// anything is persisted, so a crafted save cannot smuggle an undeclared metric.

/** The ns engine's published API (self scope). Env override for tests/dev. */
export const NS_ENGINE_URL = process.env.NS_ENGINE_URL ?? 'http://127.0.0.1:8721'

export interface SavedSuperposition {
  id: string
  informed_by_edge: string
}

/** Persist a (re-validated) card as a superposition_state grounded in the
 * served app. Throws StrategyError('grounding'|'shape') if the card no longer
 * matches the declaration, or Error on an engine failure (surfaced 502). */
export async function saveSuperposition(
  card: StrategyCard,
  app: ServedApp,
  declared: string[],
  f: typeof fetch = fetch,
  base: string = NS_ENGINE_URL,
): Promise<SavedSuperposition> {
  // Re-validate against the live declaration before persisting (the render
  // enforced it once; a save request is a fresh, untrusted entry point).
  const validated = parseStrategyCard(card, declared)
  const versionRef = `artifact/artifact_version/${app.slug}@v${app.version}`
  const body = {
    win: validated.win,
    constraint: validated.constraint,
    risk_to_watch: validated.risk_to_watch,
    grounding: validated.grounding,
    informed_by: versionRef,
    informed_by_label: `${app.slug}@v${app.version}`,
  }
  let res: Response
  try {
    res = await f(`${base}/self/superposition_state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    })
  } catch (err) {
    throw new Error(`nunc-stans engine is unreachable (${base}): ${(err as Error).message}`)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`nunc-stans engine refused the save (${res.status}): ${detail}`)
  }
  return (await res.json()) as SavedSuperposition
}
