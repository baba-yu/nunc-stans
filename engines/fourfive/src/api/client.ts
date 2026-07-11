import type {
  AppListItem,
  HealthResponse,
  Message,
  SendMessageResponse,
  Session,
  SessionBlueprintResponse,
  StrategyCard,
  StrategyResponse,
  UsageResponse,
} from '../../shared/types'

// Base-relative API root: '/fourfive/api' when mounted on the single origin
// (vite base '/fourfive/'), and the same in standalone dev where the vite
// proxy rewrites it back to the local server's '/api'.
const API = import.meta.env.BASE_URL + 'api'

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => http<HealthResponse>(`${API}/health`),
  listSessions: () => http<Session[]>(`${API}/sessions`),
  createSession: (title?: string) =>
    http<Session>(`${API}/sessions`, { method: 'POST', body: JSON.stringify({ title }) }),
  renameSession: (sessionId: string, title: string) =>
    http<Session>(`${API}/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  getMessages: (sessionId: string) => http<Message[]>(`${API}/sessions/${sessionId}/messages`),
  sendMessage: (sessionId: string, content: string, think?: boolean, maxTokens?: number) =>
    http<SendMessageResponse>(`${API}/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, think, maxTokens }),
    }),
  getBlueprint: (sessionId: string) =>
    http<SessionBlueprintResponse>(`${API}/sessions/${sessionId}/blueprint`),
  listApps: () => http<AppListItem[]>(`${API}/apps`),
  createComposeSession: (name: string, appIds: string[]) =>
    http<Session>(`${API}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'compose', name, dependencies: appIds.map((app_id) => ({ app_id })) }),
    }),
  updateDependencyPin: (appId: string, depId: string, version: number) =>
    http<{ ok: boolean }>(`${API}/apps/${appId}/dependencies/${depId}`, {
      method: 'PATCH',
      body: JSON.stringify({ version }),
    }),
  getUsage: (sessionId: string) => http<UsageResponse>(`${API}/sessions/${sessionId}/usage`),
  generateMarkdown: (sessionId: string, stack?: string) =>
    http<{ markdown: string; path: string | null }>(`${API}/sessions/${sessionId}/markdown`, {
      method: 'POST',
      body: JSON.stringify({ stack }),
    }),
  // Phase E: freeze the session's current blueprint version and emit its
  // bundle (generating IS freezing — F7).
  generateBundle: (sessionId: string) =>
    http<{ slug: string; version: number; frozen_at: string; bundle_hash: string; files: string[] }>(
      `${API}/sessions/${sessionId}/bundle`,
      { method: 'POST', body: '{}' },
    ),
  // Phase E (PE12): the /strategy stage-3 read-out — ephemeral until saved.
  strategyReadout: (sessionId: string) =>
    http<StrategyResponse>(`${API}/sessions/${sessionId}/strategy`, { method: 'POST', body: '{}' }),
  // Phase F (F-3): save the read-out as grounds — a superposition_state record
  // in the self scope with an informed_by edge to the served bundle.
  saveStrategy: (sessionId: string, card: StrategyCard) =>
    http<{ saved: true; id: string; informed_by_edge: string; app: { slug: string; version: number } }>(
      `${API}/sessions/${sessionId}/strategy/save`,
      { method: 'POST', body: JSON.stringify({ card }) },
    ),

  // Consume the SSE message stream, invoking `on(event, data)` per event.
  // `data` is the raw (JSON-encoded) payload string; the caller parses it.
  async streamMessage(
    sessionId: string,
    content: string,
    opts: {
      think?: boolean
      maxTokens?: number
      profileId?: string
      verify?: { on: boolean; goal?: string }
    },
    on: (event: string, data: string) => void,
  ): Promise<void> {
    const res = await fetch(`${API}/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content, think: opts.think, maxTokens: opts.maxTokens,
        profileId: opts.profileId, verify: opts.verify,
      }),
    })
    if (!res.ok || !res.body) {
      throw new Error(`${res.status} ${res.statusText}: ${await res.text().catch(() => '')}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, sep)
        buf = buf.slice(sep + 2)
        let event = 'message'
        let data = ''
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5).trimStart()
        }
        on(event, data)
      }
    }
  },
}
