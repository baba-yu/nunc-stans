import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AppStatusResponse, BlueprintStepStatus, DependencyInfo, Message, PatrolResponse, Session, StrategyResponse, VerifyStep } from '../../shared/types'
import type { Blueprint } from '../../shared/blueprint'
import { api } from '../api/client'

function loadBool(key: string, dflt: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? dflt : v === 'true'
  } catch {
    return dflt
  }
}
function loadNum(key: string, dflt: number): number {
  try {
    const v = localStorage.getItem(key)
    const n = v === null ? NaN : Number(v)
    return Number.isFinite(n) ? n : dflt
  } catch {
    return dflt
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore persistence errors */
  }
}

export interface Scope {
  db: Set<string> // "table.column"
  logic: Set<string> // rule ids
  api: Set<string> // "METHOD path"
}

const EMPTY_SCOPE: Scope = { db: new Set(), logic: new Set(), api: new Set() }

function normalizeApi(s: string): string {
  return s.trim().replace(/\s+/, ' ')
}

export const useSessionStore = defineStore('session', () => {
  const sessions = ref<Session[]>([])
  const current = ref<Session | null>(null)
  const messages = ref<Message[]>([])
  const sending = ref(false)
  const provider = ref('…')
  const profile = ref<string | null>(null)
  const blueprint = ref<Blueprint | null>(null)
  // Why the last turn's blueprint step did/didn't move the right pane
  // (server-classified; null until a turn reports one). The panel shows a
  // hint for warn-worthy outcomes instead of silently keeping the old view.
  const blueprintStatus = ref<BlueprintStepStatus | null>(null)
  const dependencies = ref<DependencyInfo[]>([])
  const showNewSessionModal = ref(false)
  const usage = ref({ input: 0, output: 0, total: 0 })

  // LLM knobs (per message)
  const thinking = ref(loadBool('codev.thinking', false))
  const maxTokensOn = ref(loadBool('codev.maxTokensOn', false))
  const maxTokens = ref(loadNum('codev.maxTokens', 512))
  // Goal-verify toggle (S-6): explicit on/off is sent with EVERY message so
  // chat stays off-by-default regardless of the profile's own default.
  const verifyOn = ref(loadBool('codev.verifyOn', false))
  const verifyGoal = ref(localStorage.getItem('codev.verifyGoal') ?? '')

  // Markdown export
  const markdown = ref<string | null>(null)
  const markdownPath = ref<string | null>(null)
  const markdownLoading = ref(false)
  const showMarkdown = ref(false)
  const softwareStack = ref('') // user-specified, loaded from the blueprint

  // Live streaming assistant message (thinking + content + collapse state
  // + the goal-verify loop boundaries as they arrive).
  const streamingMsg = ref<{ content: string; thinking: string; thinkingOpen: boolean; verify: VerifyStep[] } | null>(null)
  // Thinking text per completed message id (collapsed/viewable; not persisted server-side).
  const thinkingById = ref<Record<string, string>>({})
  // Goal-verify chains per completed message id (S-6: gaps + cost stay visible).
  const verifyById = ref<Record<string, VerifyStep[]>>({})

  // "Scope of concern": the mock-UI field in focus drives cross-pane highlights.
  const activeFieldId = ref<string | null>(null)

  const scope = computed<Scope>(() => {
    const bp = blueprint.value
    const fid = activeFieldId.value
    if (!bp || !fid) return EMPTY_SCOPE
    const field = bp.mock_ui.screens.flatMap((s) => s.fields).find((f) => f.id === fid)
    if (!field) return EMPTY_SCOPE

    const db = new Set(field.maps_to)
    const tables = new Set([...db].map((d) => d.split('.')[0]))
    const logic = new Set<string>()
    const apiIds = new Set<string>()

    for (const rule of bp.business_logic) {
      const hit =
        rule.related_db.some((d) => db.has(d)) ||
        rule.inputs.includes(field.id) ||
        rule.outputs.includes(field.id)
      if (hit) {
        logic.add(rule.id)
        rule.related_api.forEach((a) => apiIds.add(normalizeApi(a)))
      }
    }

    for (const a of bp.apis) {
      const hit =
        a.related_ui.includes(field.id) ||
        a.related_db.some((t) => tables.has(t) || [...db].some((d) => d.startsWith(`${t}.`)))
      if (hit) apiIds.add(`${a.method} ${a.path}`)
    }

    return { db, logic, api: apiIds }
  })

  function setActiveField(id: string | null) {
    activeFieldId.value = id
  }
  function setThinking(value: boolean) {
    thinking.value = value
    save('codev.thinking', String(value))
  }
  function setVerifyOn(value: boolean) {
    verifyOn.value = value
    save('codev.verifyOn', String(value))
  }
  function setVerifyGoal(value: string) {
    verifyGoal.value = value
    save('codev.verifyGoal', value)
  }
  function setMaxTokensOn(value: boolean) {
    maxTokensOn.value = value
    save('codev.maxTokensOn', String(value))
  }
  function setMaxTokens(value: number) {
    const n = Math.max(64, Math.round(value || 0))
    maxTokens.value = n
    save('codev.maxTokens', String(n))
  }

  async function init() {
    try {
      const h = await api.health()
      provider.value = h.provider
      profile.value = h.profile ?? null
    } catch {
      provider.value = 'offline'
    }
    await refreshSessions()
    if (sessions.value.length > 0) {
      await openSession(sessions.value[0])
    } else {
      await newSession()
    }
  }

  async function refreshSessions() {
    sessions.value = await api.listSessions()
  }

  async function refreshUsage() {
    if (!current.value) return
    try {
      usage.value = await api.getUsage(current.value.id)
    } catch {
      usage.value = { input: 0, output: 0, total: 0 }
    }
  }

  async function newSession() {
    const s = await api.createSession()
    showNewSessionModal.value = false
    await refreshSessions()
    await openSession(s)
  }

  async function composeSession(name: string, appIds: string[]) {
    const s = await api.createComposeSession(name, appIds)
    showNewSessionModal.value = false
    await refreshSessions()
    await openSession(s)
  }

  /** Move a dependency's pin to its latest version and refresh the merged view. */
  async function bumpDependency(dep: DependencyInfo) {
    const cur = current.value
    if (!cur?.app_id || dep.current_version <= dep.pinned_version) return
    try {
      await api.updateDependencyPin(cur.app_id, dep.app_id, dep.current_version)
      const res = await api.getBlueprint(cur.id)
      blueprint.value = res.blueprint
      dependencies.value = res.dependencies
    } catch (e) {
      messages.value.push({
        id: `err-${Date.now()}`,
        session_id: cur.id,
        role: 'assistant',
        content: `⚠️ Failed to update dependency pin: ${(e as Error).message}`,
        created_at: new Date().toISOString(),
      })
    }
  }

  // The /strategy stage-3 card (PE12): ephemeral until the user SAVES it as
  // grounds (Phase F, F-3 — a superposition_state record + informed_by edge).
  // Dismiss stays the default; ephemeral remains the no-action behavior.
  const strategy = ref<StrategyResponse | null>(null)
  const strategyError = ref<string | null>(null)
  const strategyLoading = ref(false)
  // F-3 save-path state: 'idle' | 'saving' | 'saved' | an error string.
  const strategySaveState = ref<'idle' | 'saving' | 'saved' | { error: string }>('idle')

  // F-2: served-bundle status (the design‖app toggle) + the opening patrol.
  // Both ephemeral, probed lazily after session open — never block it. The
  // patrol fires once per session per page load, only when a bundle is served.
  const appStatus = ref<AppStatusResponse | null>(null)
  const patrol = ref<PatrolResponse['patrol']>(null)
  const patrolled = new Set<string>()

  function dismissPatrol() {
    patrol.value = null
  }

  async function probeApp(sessionId: string) {
    try {
      const st = await api.appStatus(sessionId)
      if (current.value?.id !== sessionId) return // stale probe — session switched
      appStatus.value = st
      if (st.served && !patrolled.has(sessionId)) {
        patrolled.add(sessionId)
        const res = await api.patrol(sessionId)
        if (current.value?.id === sessionId && res.patrol) patrol.value = res.patrol
      }
    } catch {
      // No status → the right pane simply stays design-only; no patrol.
    }
  }

  async function runStrategy() {
    if (!current.value || strategyLoading.value) return
    strategyLoading.value = true
    strategy.value = null
    strategyError.value = null
    try {
      strategy.value = await api.strategyReadout(current.value.id)
    } catch (e) {
      // Refusals render verbatim — a grounding violation is a FAILED render
      // (S-7), never silently retried or softened.
      strategyError.value = (e as Error).message
    } finally {
      strategyLoading.value = false
    }
  }

  function dismissStrategy() {
    strategy.value = null
    strategyError.value = null
    strategySaveState.value = 'idle'
  }

  // F-3: save the read-out as grounds. The card is re-validated server-side
  // against the live declaration before it is persisted (defense in depth).
  async function saveStrategy() {
    if (!current.value || !strategy.value || strategySaveState.value === 'saving') return
    strategySaveState.value = 'saving'
    try {
      await api.saveStrategy(current.value.id, strategy.value.card)
      strategySaveState.value = 'saved'
    } catch (e) {
      strategySaveState.value = { error: (e as Error).message }
    }
  }

  async function openSession(s: Session) {
    current.value = s
    activeFieldId.value = null
    dismissStrategy()
    dismissPatrol()
    appStatus.value = null
    blueprintStatus.value = null
    messages.value = await api.getMessages(s.id)
    const res = await api.getBlueprint(s.id)
    blueprint.value = res.blueprint
    dependencies.value = res.dependencies
    softwareStack.value = res.blueprint?.software_stack ?? ''
    await refreshUsage()
    // F-2: probe served-ness + fire the opening patrol in the background —
    // session open never waits on apps-host or a model.
    void probeApp(s.id)
  }

  async function send(content: string) {
    const text = content.trim()
    if (!current.value || !text || sending.value) return
    // A slash command, not a chat turn: /strategy renders the ephemeral
    // stage-3 card (PE12) instead of talking to the design chat. Trailing
    // words are tolerated (the read-out takes no arguments in v0).
    if (text === '/strategy' || text.startsWith('/strategy ')) {
      await runStrategy()
      return
    }
    sending.value = true
    const sid = current.value.id

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      session_id: sid,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    messages.value.push(optimistic)
    streamingMsg.value = { content: '', thinking: '', thinkingOpen: true, verify: [] }
    blueprintStatus.value = null
    let collapsed = false

    try {
      await api.streamMessage(
        sid,
        text,
        {
          think: thinking.value,
          maxTokens: maxTokensOn.value ? maxTokens.value : undefined,
          verify: { on: verifyOn.value, goal: verifyGoal.value.trim() || undefined },
        },
        (event, data) => {
          const sm = streamingMsg.value
          switch (event) {
            case 'user': {
              const m = JSON.parse(data) as Message
              const idx = messages.value.findIndex((x) => x.id === optimistic.id)
              if (idx >= 0) messages.value.splice(idx, 1, m)
              break
            }
            case 'thinking':
              if (sm) sm.thinking += JSON.parse(data) as string
              break
            case 'tool': {
              // F-2 B: one line per executed app-tool call, shown in the
              // dimmed thinking pane (meta activity, not reply content).
              const t = JSON.parse(data) as { name: string; arguments: Record<string, unknown> }
              if (sm) sm.thinking += `${sm.thinking ? '\n' : ''}⚙ ${t.name} ${JSON.stringify(t.arguments)}`
              break
            }
            case 'content':
              if (sm) {
                // Collapse the thinking section once the real reply starts.
                if (!collapsed && sm.thinking) {
                  sm.thinkingOpen = false
                  collapsed = true
                }
                sm.content += JSON.parse(data) as string
              }
              break
            case 'verify':
              if (sm) sm.verify.push(JSON.parse(data) as VerifyStep)
              break
            case 'assistant': {
              const m = JSON.parse(data) as Message
              messages.value.push(m)
              if (sm?.thinking) thinkingById.value[m.id] = sm.thinking
              if (sm?.verify.length) verifyById.value[m.id] = sm.verify
              streamingMsg.value = null
              break
            }
            case 'blueprint':
              blueprint.value = JSON.parse(data) as Blueprint | null
              break
            case 'blueprint_status':
              blueprintStatus.value = JSON.parse(data) as BlueprintStepStatus
              break
          }
        },
      )
      await refreshSessions()
      // Pick up server-side auto-naming (first blueprint names the session).
      const fresh = sessions.value.find((s) => s.id === sid)
      if (fresh && current.value) current.value.title = fresh.title
      await refreshUsage()
    } catch (e) {
      messages.value.push({
        id: `err-${Date.now()}`,
        session_id: sid,
        role: 'assistant',
        content: `⚠️ Failed to send: ${(e as Error).message}`,
        created_at: new Date().toISOString(),
      })
    } finally {
      sending.value = false
      // Salvage streamed content if the stream ended without an 'assistant' event.
      const sm = streamingMsg.value
      if (sm && sm.content) {
        messages.value.push({
          id: `local-${Date.now()}`,
          session_id: sid,
          role: 'assistant',
          content: sm.content,
          created_at: new Date().toISOString(),
        })
      }
      streamingMsg.value = null
    }
  }

  async function generateMarkdown() {
    if (!current.value || markdownLoading.value) return
    markdownLoading.value = true
    try {
      const res = await api.generateMarkdown(current.value.id, softwareStack.value)
      markdown.value = res.markdown
      markdownPath.value = res.path
      showMarkdown.value = true
    } catch (e) {
      markdown.value = `⚠️ Markdown generation failed: ${(e as Error).message}`
      markdownPath.value = null
      showMarkdown.value = true
    } finally {
      markdownLoading.value = false
    }
  }

  function closeMarkdown() {
    showMarkdown.value = false
  }

  // Phase E: freeze + bundle the session's current version. The result (or
  // the refusal — drift/validation errors surface verbatim) is shown in the
  // temp-app panel.
  const bundling = ref(false)
  const bundleResult = ref<{ slug: string; version: number; frozen_at: string; bundle_hash: string } | null>(null)
  const bundleError = ref<string | null>(null)

  async function generateBundle() {
    if (!current.value || bundling.value) return
    bundling.value = true
    bundleError.value = null
    try {
      bundleResult.value = await api.generateBundle(current.value.id)
    } catch (e) {
      bundleResult.value = null
      bundleError.value = (e as Error).message
    } finally {
      bundling.value = false
    }
  }

  async function renameSession(title: string) {
    const t = title.trim()
    if (!current.value || !t || t === current.value.title) return
    const updated = await api.renameSession(current.value.id, t)
    current.value.title = updated.title
    await refreshSessions()
  }

  return {
    sessions,
    current,
    messages,
    sending,
    provider,
    profile,
    blueprint,
    blueprintStatus,
    dependencies,
    showNewSessionModal,
    thinking,
    maxTokensOn,
    maxTokens,
    markdown,
    markdownPath,
    markdownLoading,
    showMarkdown,
    softwareStack,
    streamingMsg,
    thinkingById,
    verifyById,
    verifyOn,
    verifyGoal,
    setVerifyOn,
    setVerifyGoal,
    activeFieldId,
    scope,
    init,
    refreshSessions,
    newSession,
    composeSession,
    bumpDependency,
    openSession,
    send,
    setThinking,
    setMaxTokensOn,
    setMaxTokens,
    setActiveField,
    generateMarkdown,
    closeMarkdown,
    renameSession,
    usage,
    refreshUsage,
    bundling,
    bundleResult,
    bundleError,
    generateBundle,
    strategy,
    strategyError,
    strategyLoading,
    strategySaveState,
    runStrategy,
    dismissStrategy,
    saveStrategy,
    appStatus,
    patrol,
    dismissPatrol,
  }
})
