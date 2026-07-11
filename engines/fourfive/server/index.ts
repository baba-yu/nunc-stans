// Load .env (Node 20.12+/24) before anything reads process.env. No-op if absent.
try {
  process.loadEnvFile()
} catch {
  /* no .env file — rely on the ambient environment */
}

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { randomUUID } from 'node:crypto'
import { db, nowIso, DEFAULT_SESSION_TITLE } from './db'
import { FourfiveLlm } from './llm/nunc-ai'
import type { TurnOptions, TurnResult } from './llm/nunc-ai'
import { buildDependencyContext } from './llm/blueprint-prompt'
import { validateBlueprint } from './blueprint-schema'
import { RESERVED_ENTITY_NAMES } from './bundle/generate'

/** Reserved-name rail at PROPOSAL time (T9, 2026-07-10): the extractor
 * sometimes materializes a `metrics` TABLE, which the bundle step can only
 * refuse at freeze — a dead end the model would not back out of. Drop such
 * entities on ingest, loudly; declared measurements live in the metrics
 * list, never as tables. */
function stripReservedEntities<T extends { entities: Array<{ name: string }>; metrics?: Array<{ sql: string }> }>(bp: T): T {
  const dropped = bp.entities.filter((e) => RESERVED_ENTITY_NAMES.has(e.name))
  if (dropped.length) {
    console.warn('[codev] dropped reserved-name entities from the proposal:', dropped.map((e) => e.name).join(', '))
    bp.entities = bp.entities.filter((e) => !RESERVED_ENTITY_NAMES.has(e.name))
  }
  // Models habitually terminate SQL with ';' — the bundle rail requires one
  // bare statement, so normalize instead of dead-ending the freeze.
  for (const m of bp.metrics ?? []) m.sql = m.sql.trim().replace(/;+\s*$/, '')
  return bp
}
import { saveBlueprint, getLatestBlueprint, saveMarkdown, setSoftwareStack, createComposedApp, getBlueprintWithDependencies, getSessionApp, freezeAndBundle, FreezeError } from './workspace'
import { StrategyError, fetchServedApp, fetchServedMetrics, parseStrategyCard, saveSuperposition } from './strategy'
import { buildAppToolExecutor, fetchDeclaredTools, sweepServedApp } from './app-tools'
import { listComposableApps, updateDependencyPin, DependencyError } from './dependencies'
import { renderBlueprintMarkdown } from './markdown'
import type { BlueprintStepStatus, ChatMessage, Message, StrategyCard } from '../shared/types'
import type { Blueprint } from '../shared/blueprint'

// Single origin in production (behind the gate) and a same-origin vite
// proxy in dev: the browser never needs CORS, so none is offered.
const app = new Hono()

// Profile-resolved model access (PD7): no boot singleton — the default
// profile is re-resolved per request, so switching it on the Profiles
// screen changes the NEXT message with no server restart (S-5).
const llm = new FourfiveLlm()

/** F-2 B: the session's OWN served app's declared tool surface (PF7 —
 * the design chat holds an implicit `apps:<own-slug>` grant; cross-app
 * operation still requires an explicit profile skill and is not offered
 * here). null = no app / not served / apps-host unreachable — the turn
 * simply runs tool-less (honest degrade). */
async function sessionTools(sessionId: string) {
  const sessionApp = getSessionApp(sessionId)
  if (!sessionApp) return null
  const tools = await fetchDeclaredTools(sessionApp.slug)
  if (tools.length === 0) return null
  return { slug: sessionApp.slug, tools, exec: buildAppToolExecutor(sessionApp.slug) }
}

app.get('/api/health', (c) => {
  const h = llm.health()
  return c.json({ ok: true, provider: h.provider, model: h.model, profile: h.profile, version: '0.1.0' })
})

// --- sessions ---

app.get('/api/sessions', (c) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all()
  return c.json(rows)
})

app.post('/api/sessions', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string
    mode?: 'new' | 'compose'
    name?: string
    dependencies?: { app_id: string }[]
  }
  const id = randomUUID()
  const ts = nowIso()

  if (body.mode === 'compose') {
    const name = body.name?.trim()
    if (body.dependencies !== undefined && !Array.isArray(body.dependencies)) {
      return c.json({ error: 'dependencies must be an array' }, 400)
    }
    const deps = [
      ...new Set(
        (body.dependencies ?? [])
          .map((d) => (typeof d?.app_id === 'string' ? d.app_id : ''))
          .filter(Boolean),
      ),
    ]
    if (!name) return c.json({ error: 'name is required for compose' }, 400)
    if (name.length > 200) return c.json({ error: 'name is too long (max 200 chars)' }, 400)
    if (deps.length === 0) return c.json({ error: 'compose requires at least one dependency' }, 400)
    let appRef: { id: string; slug: string }
    try {
      appRef = createComposedApp(name, deps)
    } catch (err) {
      if (err instanceof DependencyError) return c.json({ error: err.message }, 400)
      throw err
    }
    db.prepare(
      'INSERT INTO sessions (id, app_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, appRef.id, name, ts, ts)
    return c.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id), 201)
  }

  const title = body.title?.trim() || DEFAULT_SESSION_TITLE
  db.prepare(
    'INSERT INTO sessions (id, app_id, title, created_at, updated_at) VALUES (?, NULL, ?, ?, ?)',
  ).run(id, title, ts, ts)
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  return c.json(row, 201)
})

app.patch('/api/sessions/:id', async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json().catch(() => ({}))) as { title?: string }
  const title = (body.title ?? '').trim()
  if (!title) return c.json({ error: 'title is required' }, 400)
  const res = db
    .prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, nowIso(), id)
  if (res.changes === 0) return c.json({ error: 'session not found' }, 404)
  return c.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id))
})

// --- messages ---

app.get('/api/sessions/:id/messages', (c) => {
  const id = c.req.param('id')
  const rows = db
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(id)
  return c.json(rows)
})

app.post('/api/sessions/:id/messages', async (c) => {
  const sessionId = c.req.param('id')
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)
  if (!session) return c.json({ error: 'session not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    content?: string
    think?: boolean
    maxTokens?: number
    profileId?: string
    verify?: { on: boolean; goal?: string }
  }
  const content = (body.content ?? '').trim()
  if (!content) return c.json({ error: 'content is required' }, 400)

  // Per-message LLM options (Thinking toggle, output-token cap, profile
  // override, goal-verify toggle). Providers ignore what they don't support.
  const opts: TurnOptions = {
    think: body.think, maxTokens: body.maxTokens,
    profileId: body.profileId, verify: body.verify,
  }

  const userMsg: Message = {
    id: randomUUID(),
    session_id: sessionId,
    role: 'user',
    content,
    created_at: nowIso(),
  }
  insertMessage(userMsg)

  // Replay the full session history as the LLM context.
  const history = db
    .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as ChatMessage[]
  // Dependency context is rebuilt per turn (not persisted) so it always
  // reflects the current pinned blueprints.
  const depCtx = buildDependencyContext(getBlueprintWithDependencies(sessionId).dependencies)
  const llmHistory: ChatMessage[] = depCtx ? [depCtx, ...history] : history

  let assistantText: string
  let usage: { input: number; output: number } | undefined
  let toolCalls: { name: string; count: number }[] | undefined
  try {
    // F-2 B: when the session's app has a served bundle, the turn carries the
    // app's five verbs (PF7 implicit own-app grant); otherwise plain chat.
    const toolCtx = await sessionTools(sessionId)
    const result: TurnResult & { toolCalls?: { name: string; count: number }[] } = toolCtx
      ? await llm.chatWithTools(llmHistory, opts, toolCtx.tools, toolCtx.exec)
      : await llm.chat(llmHistory, opts)
    assistantText = result.content
    usage = result.usage
    toolCalls = result.toolCalls
    db.prepare(
      'INSERT INTO llm_runs (id, session_id, provider, model, prompt, response, created_at) VALUES (?,?,?,?,?,?,?)',
    ).run(
      randomUUID(),
      sessionId,
      result.provider,
      result.model,
      JSON.stringify(llmHistory),
      assistantText,
      nowIso(),
    )
  } catch (err) {
    assistantText = `⚠️ LLM call failed: ${(err as Error).message}`
  }

  const assistantMsg: Message = {
    id: randomUUID(),
    session_id: sessionId,
    role: 'assistant',
    content: assistantText,
    created_at: nowIso(),
    input_tokens: usage?.input,
    output_tokens: usage?.output,
  }
  insertMessage(assistantMsg)
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(assistantMsg.created_at, sessionId)

  // Try to (re)build the structured blueprint from the conversation. Failures
  // here never break the chat — the blueprint is best-effort, but the outcome
  // is classified and reported, never swallowed.
  const bp = await blueprintStep(sessionId, llmHistory, assistantText, opts)
  return c.json({
    userMessage: userMsg, assistantMessage: assistantMsg,
    blueprint: bp.blueprint, blueprintStatus: bp.status,
    // Additive (F-2 B): which app tools this turn executed, when any.
    ...(toolCalls ? { toolCalls } : {}),
  })
})

app.get('/api/sessions/:id/blueprint', (c) => {
  return c.json(getBlueprintWithDependencies(c.req.param('id')))
})

// --- bundle generation (Phase E): generating IS freezing (F7, plan PE11) ---

function freezeResponse(c: Context, slug: string, version: number) {
  try {
    return c.json(freezeAndBundle(slug, version))
  } catch (err) {
    if (err instanceof FreezeError) {
      const status = err.code === 'not_found' ? 404 : err.code === 'drift' ? 409 : 422
      return c.json({ error: err.message }, status)
    }
    throw err
  }
}

// Session-scoped: freeze + bundle the session's CURRENT blueprint version
// (the S-8 flow — the button in the temp-app panel).
app.post('/api/sessions/:id/bundle', (c) => {
  const sessionApp = getSessionApp(c.req.param('id'))
  if (!sessionApp || sessionApp.current_version < 1) return c.json({ error: 'no blueprint yet' }, 400)
  return freezeResponse(c, sessionApp.slug, sessionApp.current_version)
})

// Direct: freeze + bundle a specific version (tools, tests, re-verification).
app.post('/api/apps/:slug/versions/:version/bundle', (c) => {
  const version = Number(c.req.param('version'))
  if (!Number.isInteger(version) || version < 1) return c.json({ error: 'version must be a positive integer' }, 400)
  return freezeResponse(c, c.req.param('slug'), version)
})

// --- strategy read-out (Phase E, plan PE12; story S-7) ---
// Grounded ONLY in the served bundle's declared metrics, fetched from
// apps-host's published API. EPHEMERAL by design: nothing is persisted —
// superposition_state + the informed_by edge are a named Phase F
// prerequisite, not silently absorbed here.
app.post('/api/sessions/:id/strategy', async (c) => {
  const sessionId = c.req.param('id')
  if (!db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)) {
    return c.json({ error: 'session not found' }, 404)
  }
  const sessionApp = getSessionApp(sessionId)
  if (!sessionApp) {
    return c.json({ error: 'this session has no app yet — the strategy read-out needs a served bundle' }, 400)
  }
  const body = (await c.req.json().catch(() => ({}))) as { profileId?: string }
  try {
    const served = await fetchServedApp(sessionApp.slug)
    const metrics = await fetchServedMetrics(sessionApp.slug)
    let raw: unknown
    try {
      raw = await llm.strategyReadout(served, metrics, { profileId: body.profileId })
    } catch (err) {
      // Model backend down/unreachable is an infrastructure failure, not a
      // strategy refusal — surface it verbatim like the chat path does.
      return c.json({ error: `LLM call failed: ${(err as Error).message}` }, 502)
    }
    const card = parseStrategyCard(raw, metrics.map((m) => m.name))
    return c.json({ card, app: served, metrics })
  } catch (err) {
    if (err instanceof StrategyError) return c.json({ error: err.message }, err.status)
    throw err
  }
})

// --- strategy SAVE (Phase F, F-3): read-out → superposition_state ---------
// The card the user is looking at becomes GROUNDS for a decision: persisted in
// the self scope via the ns engine's published API, with an informed_by edge
// to the served bundle. Dismiss stays the default; this is the opt-in save.
app.post('/api/sessions/:id/strategy/save', async (c) => {
  const sessionId = c.req.param('id')
  if (!db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)) {
    return c.json({ error: 'session not found' }, 404)
  }
  const sessionApp = getSessionApp(sessionId)
  if (!sessionApp) {
    return c.json({ error: 'this session has no app — nothing to ground a read-out in' }, 400)
  }
  const body = (await c.req.json().catch(() => ({}))) as { card?: StrategyCard }
  if (!body.card) return c.json({ error: 'a card is required to save' }, 400)
  try {
    // Re-fetch the live declaration and re-validate before persisting — the
    // save endpoint is a fresh entry point, not to be trusted with the client's
    // word that the grounding is declared (defense in depth).
    const served = await fetchServedApp(sessionApp.slug)
    const metrics = await fetchServedMetrics(sessionApp.slug)
    const saved = await saveSuperposition(body.card, served, metrics.map((m) => m.name))
    return c.json({ saved: true, ...saved, app: served })
  } catch (err) {
    if (err instanceof StrategyError) return c.json({ error: err.message }, err.status)
    // engine unreachable / refused — an infrastructure failure, surfaced 502
    return c.json({ error: (err as Error).message }, 502)
  }
})

// --- app status + opening patrol (Phase F, F-2) ---------------------------

// F-2 A: does this session's app have a served bundle? Cheap probe for the
// design‖app toggle — never blocks session open (the client asks lazily).
app.get('/api/sessions/:id/app-status', async (c) => {
  const sessionId = c.req.param('id')
  if (!db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)) {
    return c.json({ error: 'session not found' }, 404)
  }
  const sessionApp = getSessionApp(sessionId)
  if (!sessionApp) return c.json({ slug: null, served: false })
  try {
    const served = await fetchServedApp(sessionApp.slug)
    return c.json({ slug: served.slug, served: true, version: served.version, name: served.name })
  } catch {
    return c.json({ slug: sessionApp.slug, served: false })
  }
})

// F-2 B: the interactive opening patrol. The AI sweeps the served app's rows
// + metrics (deterministic server code over the published API) and opens with
// ONE status question. EPHEMERAL (the strategy-card precedent): nothing
// persists unless the human replies through the normal tool-enabled chat.
// The unattended/scheduled form stays OUT (F14 / SPL v3 — handoff).
app.post('/api/sessions/:id/patrol', async (c) => {
  const sessionId = c.req.param('id')
  if (!db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)) {
    return c.json({ error: 'session not found' }, 404)
  }
  const sessionApp = getSessionApp(sessionId)
  if (!sessionApp) return c.json({ patrol: null, reason: 'this session has no app' })
  const sweep = await sweepServedApp(sessionApp.slug)
  if (!sweep) return c.json({ patrol: null, reason: 'no served bundle' })
  const body = (await c.req.json().catch(() => ({}))) as { profileId?: string }
  try {
    const text = await llm.patrolOpener(sweep, { profileId: body.profileId })
    return c.json({ patrol: { text, app: sweep.app, rows: sweep.rows, metrics: sweep.metrics } })
  } catch (err) {
    return c.json({ error: `LLM call failed: ${(err as Error).message}` }, 502)
  }
})

// --- apps & dependencies ---

app.get('/api/apps', (c) => c.json(listComposableApps(db)))

app.patch('/api/apps/:id/dependencies/:depId', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { version?: number }
  if (typeof body.version !== 'number' || !Number.isInteger(body.version)) {
    return c.json({ error: 'version must be an integer' }, 400)
  }
  try {
    updateDependencyPin(db, c.req.param('id'), c.req.param('depId'), body.version)
  } catch (err) {
    if (err instanceof DependencyError) return c.json({ error: err.message }, 400)
    throw err
  }
  return c.json({ ok: true })
})

app.get('/api/sessions/:id/usage', (c) => {
  const id = c.req.param('id')
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(input_tokens), 0) AS input, COALESCE(SUM(output_tokens), 0) AS output
       FROM messages WHERE session_id = ?`,
    )
    .get(id) as { input: number; output: number }
  return c.json({ input: row.input, output: row.output, total: row.input + row.output })
})

// Streaming variant used by the browser: SSE stream of
// user -> thinking* -> content* -> assistant -> blueprint -> done.
// The blueprint is generated AFTER the chat reply (the slow part) and pushed on
// the same stream, so the right pane updates without blocking the reply.
app.post('/api/sessions/:id/messages/stream', async (c) => {
  const sessionId = c.req.param('id')
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)
  if (!session) return c.json({ error: 'session not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    content?: string
    think?: boolean
    maxTokens?: number
    profileId?: string
    verify?: { on: boolean; goal?: string }
  }
  const content = (body.content ?? '').trim()
  if (!content) return c.json({ error: 'content is required' }, 400)
  const opts: TurnOptions = {
    think: body.think, maxTokens: body.maxTokens,
    profileId: body.profileId, verify: body.verify,
  }

  const userMsg: Message = {
    id: randomUUID(),
    session_id: sessionId,
    role: 'user',
    content,
    created_at: nowIso(),
  }
  insertMessage(userMsg)
  const history = db
    .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as ChatMessage[]
  const depCtx = buildDependencyContext(getBlueprintWithDependencies(sessionId).dependencies)
  const llmHistory: ChatMessage[] = depCtx ? [depCtx, ...history] : history

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: 'user', data: JSON.stringify(userMsg) })

    let assistantText = ''
    let usage: { input: number; output: number } | undefined
    try {
      // F-2 B: a served app makes this a tool-enabled turn — non-streamed in
      // v0 (the agent precedent). Each executed call goes out as an additive
      // `tool` event; the final text arrives as ONE content event. Old
      // clients ignore unknown event names.
      const toolCtx = await sessionTools(sessionId)
      if (toolCtx) {
        const result = await llm.chatWithTools(llmHistory, opts, toolCtx.tools, async (call) => {
          await stream.writeSSE({ event: 'tool', data: JSON.stringify({ name: call.name, arguments: call.arguments }) })
          return toolCtx.exec(call)
        })
        assistantText = result.content
        usage = result.usage
        if (assistantText) await stream.writeSSE({ event: 'content', data: JSON.stringify(assistantText) })
      } else {
        // Wire protocol unchanged for old events (user/thinking/content/
        // assistant/blueprint/done); `verify` is additive — the S-6 loop
        // boundaries, one event per judge verdict.
        const result = await llm.chatStream(llmHistory, opts, async (e) => {
          if (e.kind === 'thinking') await stream.writeSSE({ event: 'thinking', data: JSON.stringify(e.delta) })
          else if (e.kind === 'content') await stream.writeSSE({ event: 'content', data: JSON.stringify(e.delta) })
          else if (e.kind === 'verify') {
            await stream.writeSSE({
              event: 'verify',
              data: JSON.stringify({
                iteration: e.iteration, met: e.met, gaps: e.gaps,
                tokensIn: e.tokensIn, tokensOut: e.tokensOut,
              }),
            })
          }
        })
        assistantText = result.content
        usage = result.usage
      }
    } catch (err) {
      assistantText = `⚠️ LLM call failed: ${(err as Error).message}`
      await stream.writeSSE({ event: 'content', data: JSON.stringify(assistantText) })
    }

    const assistantMsg: Message = {
      id: randomUUID(),
      session_id: sessionId,
      role: 'assistant',
      content: assistantText,
      created_at: nowIso(),
      input_tokens: usage?.input,
      output_tokens: usage?.output,
    }
    insertMessage(assistantMsg)
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(assistantMsg.created_at, sessionId)
    await stream.writeSSE({ event: 'assistant', data: JSON.stringify(assistantMsg) })

    const bp = await blueprintStep(sessionId, llmHistory, assistantText, opts)
    await stream.writeSSE({ event: 'blueprint', data: JSON.stringify(bp.blueprint) })
    // Additive event (old clients ignore unknown event names): why the
    // right pane did or didn't move this turn.
    await stream.writeSSE({ event: 'blueprint_status', data: JSON.stringify(bp.status) })
    await stream.writeSSE({ event: 'done', data: '1' })
  })
})

app.post('/api/sessions/:id/markdown', async (c) => {
  const sessionId = c.req.param('id')
  const body = (await c.req.json().catch(() => ({}))) as { stack?: string }
  if (typeof body.stack === 'string') setSoftwareStack(sessionId, body.stack)
  const bp = getLatestBlueprint(sessionId)
  if (!bp) return c.json({ error: 'no blueprint yet' }, 400)
  const markdown = renderBlueprintMarkdown(bp)
  const saved = saveMarkdown(sessionId, markdown)
  return c.json({ markdown, path: saved?.path ?? null })
})

function insertMessage(m: Message): void {
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, created_at, input_tokens, output_tokens) VALUES (?,?,?,?,?,?,?)',
  ).run(m.id, m.session_id, m.role, m.content, m.created_at, m.input_tokens ?? null, m.output_tokens ?? null)
}

// The best-effort blueprint step shared by both message routes: propose,
// validate, persist-if-changed — and CLASSIFY the outcome. Silent nulls
// hid every blueprint failure under local serving (2026-07-10); anything
// warn-worthy hits the server log here and the panel via the status.
async function blueprintStep(
  sessionId: string,
  llmHistory: ChatMessage[],
  assistantText: string,
  opts: TurnOptions,
): Promise<{ blueprint: Blueprint | null; status: BlueprintStepStatus }> {
  let blueprint = getLatestBlueprint(sessionId)
  let status: BlueprintStepStatus = { outcome: 'ok' }
  try {
    const fullHistory: ChatMessage[] = [...llmHistory, { role: 'assistant', content: assistantText }]
    const proposal = await llm.proposeBlueprint(fullHistory, blueprint, opts)
    if (proposal.outcome !== 'ok') {
      status = { outcome: proposal.outcome, ...(proposal.detail ? { detail: proposal.detail } : {}) }
    } else {
      const result = validateBlueprint(proposal.proposed)
      if (result.success) {
        stripReservedEntities(result.data)
        // software_stack is user-owned; the LLM never sets it. Carry it forward.
        result.data.software_stack = blueprint?.software_stack
        if (JSON.stringify(result.data) !== JSON.stringify(blueprint)) {
          saveBlueprint(sessionId, result.data)
          blueprint = result.data
        }
      } else {
        status = {
          outcome: 'invalid',
          detail: `proposed blueprint failed validation: ${result.error.issues.length} issues — ${result.error.issues
            .slice(0, 4)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(' | ')}`,
        }
      }
    }
  } catch (err) {
    status = { outcome: 'error', detail: (err as Error).message }
  }
  if (status.outcome !== 'ok' && status.outcome !== 'empty') {
    console.warn(`[codev] blueprint step ${status.outcome}: ${status.detail ?? ''}`)
  }
  return { blueprint, status }
}

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port })
{
  const h = llm.health()
  console.log(`[codev] server http://localhost:${port}  (default profile: ${h.profile} → ${h.provider} / ${h.model})`)
}
