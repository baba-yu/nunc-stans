// The chat turn engine (Phase D T9, v1 plan §2.11): model calls go
// exclusively through nunc-ai (streaming + visible thinking + the
// goal-verify loop per the profile), memory goes exclusively through the
// manda gateway (propose → interactive approval → commit; refusals are
// SHOWN, never silently retried). Pure of terminal concerns: the REPL in
// cli.ts supplies out/ask, tests supply fakes.
import type {
  Ai, ChatMessage, Profile, StreamEvent,
} from '../../../frontend/packages/ai/src/index.ts'
import type { MandaMemory, ToolResult } from './memory.ts'

export interface TurnIO {
  /** Normal output (content deltas arrive unbuffered). */
  out: (s: string) => void
  /** Reasoning output — rendered visibly but distinctly. */
  thinking: (s: string) => void
  /** One-line status/meta output. */
  meta: (s: string) => void
  /** Interactive question; resolves with the user's answer. */
  ask: (q: string) => Promise<string>
}

export interface AgentSession {
  ai: Ai
  profile: Profile
  memory: MandaMemory | null
  history: ChatMessage[]
  io: TurnIO
}

export const HELP = [
  'commands:',
  '  /remember <scope> <text>   propose a memory, then commit with your approval',
  '  /recall <scope>            read committed memories (≤3 surfaced, audited)',
  '  /mandates                  list mandates and their state',
  '  /help                      this help',
  '  /exit                      leave',
].join('\n')

export function describeMandates(res: ToolResult): string {
  const mandates = (res.body?.mandates ?? []) as Array<Record<string, unknown>>
  if (!Array.isArray(mandates) || mandates.length === 0) {
    return 'no active mandate — memory is read-only until the principal grants one\n' +
      '(append ONE line to $MANDA_DATA_DIR/mandates.jsonl yourself; `nunc-stans-agent mandate-template` prints it)'
  }
  return mandates
    .map(m => `mandate ${m.id ?? '?'} scope=${m.scope ?? '?'} access=${JSON.stringify(m.access ?? [])}`
      + ` expires=${m.expires_at ?? '?'}${m.active === false ? ' [INACTIVE]' : ''}`)
    .join('\n')
}

async function rememberFlow(s: AgentSession, scope: string, text: string): Promise<void> {
  if (!s.memory) {
    s.io.meta('memory is off: no manda binary resolved (set MANDA_BIN) — nothing was stored')
    return
  }
  let proposed: ToolResult
  try {
    proposed = await s.memory.propose(scope, 'fact', text)
  } catch (e) {
    // The F3 guard rejects commitment scopes before manda is even asked.
    s.io.meta(`refused: ${e instanceof Error ? e.message : e}`)
    return
  }
  if (!proposed.ok) {
    s.io.meta(`propose failed: ${proposed.text}`)
    return
  }
  const candId = String(proposed.body?.id ?? proposed.text.match(/cand-[\w-]+/)?.[0] ?? '')
  s.io.meta(`proposed ${candId} (candidate lane — no authority yet)`)
  const answer = (await s.io.ask(`commit ${candId} to the committed lane? [y/N] `)).trim().toLowerCase()
  if (answer !== 'y' && answer !== 'yes') {
    s.io.meta('left in the candidate lane (not committed)')
    return
  }
  const committed = await s.memory.commit(candId, 'user_approved')
  if (committed.ok) {
    const verified = committed.body?.origin_verified
    s.io.meta(`committed under mandate${verified === true ? ' (origin verified interactively)' : ''}`)
  } else {
    // The refusal point (out-of-mandate, lapsed, declined) — shown verbatim.
    s.io.meta(`commit REFUSED: ${committed.text}`)
  }
}

async function recallFlow(s: AgentSession, scope: string): Promise<void> {
  if (!s.memory) {
    s.io.meta('memory is off: no manda binary resolved (set MANDA_BIN)')
    return
  }
  const res = await s.memory.read(scope)
  if (!res.ok) {
    s.io.meta(`read failed: ${res.text}`)
    return
  }
  const surfaced = (res.body?.surfaced ?? res.body?.records ?? []) as Array<Record<string, unknown>>
  if (!Array.isArray(surfaced) || surfaced.length === 0) {
    s.io.meta(`nothing committed under ${scope}`)
    return
  }
  for (const r of surfaced) s.io.meta(`· ${r.content ?? JSON.stringify(r)}`)
  const suppressed = res.body?.suppressed
  if (typeof suppressed === 'number' && suppressed > 0) {
    s.io.meta(`(+${suppressed} suppressed — the ≤3 surface cap; narrow the scope to see others)`)
  }
}

/** One user turn: a /command or a streamed chat call. Returns false when
 * the session should end. */
export async function runTurn(s: AgentSession, input: string): Promise<boolean> {
  const line = input.trim()
  if (!line) return true
  if (line === '/exit' || line === '/quit') return false
  if (line === '/help') { s.io.meta(HELP); return true }
  if (line === '/mandates') {
    if (!s.memory) { s.io.meta('memory is off: no manda binary resolved (set MANDA_BIN)'); return true }
    s.io.meta(describeMandates(await s.memory.mandateList()))
    return true
  }
  const remember = /^\/remember\s+(\S+)\s+(.+)$/s.exec(line)
  if (remember) { await rememberFlow(s, remember[1], remember[2]); return true }
  const recall = /^\/recall\s+(\S+)$/.exec(line)
  if (recall) { await recallFlow(s, recall[1]); return true }
  if (line.startsWith('/')) { s.io.meta(`unknown command ${line.split(/\s/)[0]} — /help lists them`); return true }

  // A chat turn: stream with visible thinking; the goal-verify loop (if
  // the profile turns it on) surfaces its boundaries as meta lines.
  s.history.push({ role: 'user', content: line })
  const onEvent = (e: StreamEvent) => {
    if (e.type === 'thinking') s.io.thinking(e.delta)
    else if (e.type === 'content') s.io.out(e.delta)
    else if (e.type === 'verify') {
      s.io.meta(`\n[verify ${e.iteration}] ${e.verdict.met ? 'goal met' : `unmet — ${e.verdict.gaps.join('; ')}`}`
        + ` (${e.tokensIn}/${e.tokensOut} tok)`)
    }
  }
  const result = await s.ai.chatStream(s.profile.provider, s.history, {
    caller: 'nunc-stans-agent',
    profile: s.profile.id,
    model: s.profile.model,
    system: s.profile.system_prompt,
    verify: s.profile.goal_verify,
  }, onEvent)
  s.io.out('\n')
  s.io.meta(`[${result.provider} · ${result.model} · ${result.usage.inputTokens}/${result.usage.outputTokens} tok]`)
  s.history.push({ role: 'assistant', content: result.text })
  return true
}
