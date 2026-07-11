// Chat-operated CRUD (Phase F, F-2 B): the design session's chat gains its
// OWN app's five verbs. The tool list is the app's frozen declared surface,
// fetched over apps-host's published REST (`GET /:slug/api/tools` — the same
// list /mcp serves); execution calls the same REST routes the human UI and
// the MCP endpoint use (one write path, one enforcement point).
//
// Gating (PF7): a design session holds an IMPLICIT `apps:<own-slug>` grant —
// operating the app you are designing needs no profile skill (you already
// have full UI CRUD on it). Cross-app tools are NOT offered here; any tool
// name outside the session's own slug is refused at call time too (the
// agent's offer-time + call-time double check, PE10 house style).
import type { ChatMessage, ToolCall, ToolSpec } from '../../../frontend/packages/ai/src/index.ts'
import type { ServedMetric } from '../shared/types'
import { APPS_HOST_URL } from './strategy.ts'

const VERBS = ['list', 'get', 'create', 'update', 'archive'] as const

/** PF7: the implicit own-app grant — a tool is allowed iff it belongs to the
 * session's own slug. The trailing underscore keeps `app` from matching
 * `app-one_…` (the agent's prefix-leak rule, mirrored). */
export function ownAppToolAllowed(slug: string, toolName: string): boolean {
  return toolName.startsWith(`${slug}_`)
}

/** Fetch the app's declared tool surface over the published API. Returns []
 * when the app is not served or apps-host is unreachable — the chat then
 * simply runs tool-less (honest degrade, never a crash). */
export async function fetchDeclaredTools(
  slug: string,
  f: typeof fetch = fetch,
  base: string = APPS_HOST_URL,
): Promise<ToolSpec[]> {
  try {
    const res = await f(`${base}/${slug}/api/tools`, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) return []
    const raw = (await res.json()) as { name?: unknown; description?: unknown; inputSchema?: unknown }[]
    if (!Array.isArray(raw)) return []
    return raw
      .filter((t) => typeof t.name === 'string' && ownAppToolAllowed(slug, t.name as string))
      .map((t) => ({
        name: t.name as string,
        description: typeof t.description === 'string' ? t.description : undefined,
        inputSchema: (t.inputSchema ?? { type: 'object' }) as Record<string, unknown>,
      }))
  } catch {
    return []
  }
}

/** Build the executor: `<slug>_<entity>_<verb>` → the published REST route
 * (mirrors apps-host mcp.ts dispatchTool's arg mapping exactly). Refusals and
 * API errors come back as the tool's text result — the model sees them
 * verbatim; nothing throws out of the loop. */
export function buildAppToolExecutor(
  slug: string,
  f: typeof fetch = fetch,
  base: string = APPS_HOST_URL,
): (call: ToolCall) => Promise<string> {
  return async (call) => {
    if (!ownAppToolAllowed(slug, call.name)) {
      return `refused: tool ${call.name} is outside this session's app (${slug}) — the design chat operates its own app only`
    }
    const rest = call.name.slice(slug.length + 1)
    const verb = VERBS.find((v) => rest.endsWith(`_${v}`))
    if (!verb) return `refused: ${call.name} does not name one of the five verbs`
    const entity = rest.slice(0, rest.length - verb.length - 1)
    const args = call.arguments ?? {}
    const url = (path: string) => `${base}/${slug}/api/${path}`
    try {
      let res: Response
      switch (verb) {
        case 'list': {
          const q = new URLSearchParams()
          if (args.archived === true) q.set('archived', '1')
          if (typeof args.limit === 'number') q.set('limit', String(args.limit))
          const qs = q.toString()
          res = await f(url(entity) + (qs ? `?${qs}` : ''), { signal: AbortSignal.timeout(10_000) })
          break
        }
        case 'get':
          res = await f(url(`${entity}/${String(args.id)}`), { signal: AbortSignal.timeout(10_000) })
          break
        case 'create':
          res = await f(url(entity), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(args),
            signal: AbortSignal.timeout(10_000),
          })
          break
        case 'update': {
          const { id, ...fields } = args
          res = await f(url(`${entity}/${String(id)}`), {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(fields),
            signal: AbortSignal.timeout(10_000),
          })
          break
        }
        case 'archive':
          res = await f(url(`${entity}/${String(args.id)}/archive`), {
            method: 'POST',
            signal: AbortSignal.timeout(10_000),
          })
          break
      }
      const text = await res.text()
      // Non-ok comes back verbatim (the host's {error} body is instructive);
      // the model must see the refusal, not a sanitized success.
      return res.ok ? text : `error ${res.status}: ${text}`
    } catch (err) {
      return `error: apps-host unreachable — ${(err as Error).message}`
    }
  }
}

// --- the interactive opening patrol (F-2 B) -------------------------------
// On session open the AI sweeps the served app's record state and OPENS with
// one status question ("入力がない場合はAIがアプリのレコード状況を巡回して、
// 人間に調子をうかがってレコードを作るのが体験"). The SWEEP is deterministic
// server code over the published API — the model only phrases the opener;
// its confirmed answers become creates through the normal tool-enabled chat.

export interface AppSweep {
  app: { slug: string; version: number; name: string }
  metrics: ServedMetric[]
  rows: { entity: string; count: number; latest: string | null }[]
}

/** Deterministic sweep of a served app: manifest → per-entity row counts +
 * latest created_at, plus the metric values. null when not served. */
export async function sweepServedApp(
  slug: string,
  f: typeof fetch = fetch,
  base: string = APPS_HOST_URL,
): Promise<AppSweep | null> {
  try {
    const mres = await f(`${base}/${slug}/api/manifest`, { signal: AbortSignal.timeout(5_000) })
    if (!mres.ok) return null
    const manifest = (await mres.json()) as {
      slug: string; version: number; name: string
      entities?: { name: string }[]
    }
    const metrics = await f(`${base}/${slug}/api/metrics`, { signal: AbortSignal.timeout(5_000) })
      .then((r) => (r.ok ? (r.json() as Promise<ServedMetric[]>) : []))
      .catch(() => [] as ServedMetric[])
    const rows: AppSweep['rows'] = []
    for (const e of manifest.entities ?? []) {
      try {
        const r = await f(`${base}/${slug}/api/${e.name}?limit=1000`, { signal: AbortSignal.timeout(5_000) })
        if (!r.ok) continue
        const list = (await r.json()) as { created_at?: string }[]
        const latest = list.length
          ? list.map((x) => x.created_at ?? '').sort().at(-1) || null
          : null
        rows.push({ entity: e.name, count: list.length, latest })
      } catch {
        /* one entity failing must not kill the sweep */
      }
    }
    return {
      app: { slug: manifest.slug, version: manifest.version, name: manifest.name },
      metrics: Array.isArray(metrics) ? metrics : [],
      rows,
    }
  } catch {
    return null
  }
}

/** The patrol prompt: the sweep and nothing else. Materiality discipline
 * (journey check 10): ask ONE brief status question; no commands, no
 * recommendations, no invented numbers. */
export function buildPatrolMessages(sweep: AppSweep): ChatMessage[] {
  const rowLines = sweep.rows.map(
    (r) => `- ${r.entity}: ${r.count} row${r.count === 1 ? '' : 's'}${r.latest ? `, newest ${r.latest}` : ' (empty)'}`,
  )
  const metricLines = sweep.metrics.map(
    (m) => `- ${m.name} ("${m.label}"): ${m.error ? 'unavailable' : JSON.stringify(m.value)}`,
  )
  const system = [
    `You are opening a work session for ${sweep.app.name} (${sweep.app.slug}@v${sweep.app.version}). The ONLY facts you have are the app's current record state below.`,
    `Rows:\n${rowLines.join('\n') || '- (no entities)'}`,
    `Metrics:\n${metricLines.join('\n') || '- (none declared)'}`,
    'Open the conversation: in at most 3 short sentences, note what stands out in the records (staleness, an empty table, a metric that moved) and ask ONE brief status question inviting the person to report what happened. Never command, never recommend, never invent a number not shown above. Match the language of the app name and labels.',
  ].join('\n\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: 'Open the session now.' },
  ]
}
