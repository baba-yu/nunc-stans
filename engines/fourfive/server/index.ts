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
import type { TurnOptions } from './llm/nunc-ai'
import { buildDependencyContext } from './llm/blueprint-prompt'
import { validateBlueprint } from './blueprint-schema'
import { saveBlueprint, getLatestBlueprint, saveMarkdown, setSoftwareStack, createComposedApp, getBlueprintWithDependencies, getSessionApp, freezeAndBundle, FreezeError } from './workspace'
import { listComposableApps, updateDependencyPin, DependencyError } from './dependencies'
import { renderBlueprintMarkdown } from './markdown'
import type { ChatMessage, Message } from '../shared/types'

// Single origin in production (behind the gate) and a same-origin vite
// proxy in dev: the browser never needs CORS, so none is offered.
const app = new Hono()

// Profile-resolved model access (PD7): no boot singleton — the default
// profile is re-resolved per request, so switching it on the Profiles
// screen changes the NEXT message with no server restart (S-5).
const llm = new FourfiveLlm()

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
  try {
    const result = await llm.chat(llmHistory, opts)
    assistantText = result.content
    usage = result.usage
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
  // here never break the chat — the blueprint is best-effort.
  let blueprint = getLatestBlueprint(sessionId)
  try {
    const fullHistory: ChatMessage[] = [...llmHistory, { role: 'assistant', content: assistantText }]
    const proposed = await llm.proposeBlueprint(fullHistory, blueprint, opts)
    if (proposed != null) {
      const result = validateBlueprint(proposed)
      if (result.success) {
        // software_stack is user-owned; the LLM never sets it. Carry it forward.
        result.data.software_stack = blueprint?.software_stack
        const changed = JSON.stringify(result.data) !== JSON.stringify(blueprint)
        if (changed) {
          saveBlueprint(sessionId, result.data)
          blueprint = result.data
        }
      } else {
        console.warn('[codev] proposed blueprint failed validation:', result.error.issues.length, 'issues')
      }
    }
  } catch (err) {
    console.warn('[codev] blueprint step error:', (err as Error).message)
  }

  return c.json({ userMessage: userMsg, assistantMessage: assistantMsg, blueprint })
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

    let blueprint = getLatestBlueprint(sessionId)
    try {
      const fullHistory: ChatMessage[] = [...llmHistory, { role: 'assistant', content: assistantText }]
      const proposed = await llm.proposeBlueprint(fullHistory, blueprint, opts)
      if (proposed != null) {
        const valid = validateBlueprint(proposed)
        if (valid.success) {
          valid.data.software_stack = blueprint?.software_stack
          if (JSON.stringify(valid.data) !== JSON.stringify(blueprint)) {
            saveBlueprint(sessionId, valid.data)
            blueprint = valid.data
          }
        }
      }
    } catch (err) {
      console.warn('[codev] blueprint step error:', (err as Error).message)
    }
    await stream.writeSSE({ event: 'blueprint', data: JSON.stringify(blueprint) })
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

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port })
{
  const h = llm.health()
  console.log(`[codev] server http://localhost:${port}  (default profile: ${h.profile} → ${h.provider} / ${h.model})`)
}
