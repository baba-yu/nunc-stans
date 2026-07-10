// FourFive's model access, on nunc-ai (Phase D, plan PD7): the env-singleton
// provider layer is gone — every turn resolves a PROFILE (explicit id from
// the request, else the `fourfive-chat` default from the store, else the
// offline demo) and calls through the one AI layer, which stamps the
// profile + verify chain into `<data store>/runs/ai-runs.jsonl`. The
// sqlite `llm_runs` table stays for this UI; the canonical audit row is
// the nunc-ai run log.
//
// Relative source import, not a workspace dep: the pipeline's Phase C
// lesson — raw node/tsx type-strips our own sources fine but must not
// resolve TS through node_modules.
import * as path from 'node:path'
import {
  createAi, loadDefaults, loadProfile,
} from '../../../../frontend/packages/ai/src/index.ts'
import type {
  Ai, ChatOptions as AiChatOptions, ChatResult, Profile, Provider, StreamEvent,
} from '../../../../frontend/packages/ai/src/index.ts'
import { readConfig, resolveDataDir } from '../../../../tools/lib/data-dir.ts'
import type { BlueprintOutcome, ChatMessage } from '../../shared/types'
import type { Blueprint } from '../../shared/blueprint'
import { blueprintResponseJsonSchema } from '../blueprint-schema'
import { buildBlueprintMessages, extractJson } from './blueprint-prompt'
import { DEMO_THINKING, demoResponder, proposeDemoBlueprint } from './offline-demo'

/** Per-message options from the chat surfaces. */
export interface TurnOptions {
  think?: boolean
  maxTokens?: number
  /** Explicit profile for this message (else the fourfive-chat default). */
  profileId?: string
  /** The S-6 toggle: verify this message against a goal. */
  verify?: { on: boolean; goal?: string }
}

export interface TurnResult {
  content: string
  model: string
  provider: string
  profileId: string
  usage?: { input: number; output: number }
}

/** What the chat stream forwards to the browser (superset of the old
 * thinking/content deltas; `verify` carries the S-6 loop boundaries). */
export type TurnEvent =
  | { kind: 'thinking'; delta: string }
  | { kind: 'content'; delta: string }
  | { kind: 'verify'; iteration: number; met: boolean; gaps: string[]; tokensIn: number; tokensOut: number }

/** The offline fallback when no profile is configured anywhere: the mock
 * provider carrying the canned invoice demo. Not stored — resolution
 * only falls back here so a fresh checkout still chats. */
const OFFLINE: Profile = { id: 'offline-demo', name: 'Offline demo', provider: 'mock' }

/** Chat-step fallback when the resolved profile carries no system_prompt.
 * Without one, code-eager models (Qwen3.6, live 2026-07-10) dump full app
 * implementations every turn — 8-14k tokens that then ride the history
 * into the blueprint prompt. Wording proven on the local-llama profile. */
export const DEFAULT_CHAT_SYSTEM_PROMPT =
  "You are FourFive's design partner. Help the user shape the app they want: " +
  'confirm requirements, ask at most a few clarifying questions, and summarize decisions. ' +
  'Keep replies under 300 words. Never write implementation code or HTML — the system ' +
  "builds the app from the design automatically. Reply in the user's language."

// The blueprint call's own output budget — NEVER the per-message chat cap
// (thinking models spend that on reasoning and truncate the JSON; the
// silent-blueprint failure of 2026-07-10). llama-server splits its context
// into --parallel slots, so one request gets llama_ctx/llama_parallel
// tokens for prompt and completion TOGETHER: half a slot goes to output
// here, the other half is what buildBlueprintMessages' history bound
// protects. With an external backend (llama_url) the local knobs don't
// describe the server; the clamp keeps the budget sane either way.
const BLUEPRINT_MAX_OUTPUT_TOKENS = 8000
const BLUEPRINT_MIN_OUTPUT_TOKENS = 2048

/** One serving knob: env > config > default (tools/llama.ts resolveKnob,
 * string-typed config values tolerated like the gate's knob()). */
function servingKnob(envValue: string | undefined, cfgValue: unknown, dflt: number): number {
  for (const v of [Number(envValue), Number(cfgValue)]) {
    if (Number.isInteger(v) && v > 0) return v
  }
  return dflt
}

export function blueprintMaxTokens(
  cfg: Record<string, unknown> = readConfig(),
  env: Record<string, string | undefined> = process.env,
): number {
  const ctx = servingKnob(env.NS_LLAMA_CTX, cfg.llama_ctx, 32768)
  const parallel = servingKnob(env.NS_LLAMA_PARALLEL, cfg.llama_parallel, 4)
  const slot = Math.floor(ctx / Math.max(1, parallel))
  return Math.min(BLUEPRINT_MAX_OUTPUT_TOKENS, Math.max(BLUEPRINT_MIN_OUTPUT_TOKENS, Math.floor(slot / 2)))
}

/** proposeBlueprint's classified result: the parsed candidate (non-null
 * only when outcome is 'ok') plus why. 'empty' is the model's honest "not
 * enough info yet" (the prompt's `null` escape hatch) — a no-op, not a
 * failure. The route handler decides what to persist and surface. */
export interface BlueprintProposal {
  proposed: unknown
  outcome: Extract<BlueprintOutcome, 'ok' | 'empty' | 'parse-failed' | 'length-truncated' | 'context-overflow'>
  stopReason?: string
  detail?: string
}

/** Test seams: a fixed store dir (else resolveDataDir()) and override
 * providers passed through to createAi. Production callers pass nothing. */
export interface FourfiveLlmOptions {
  dataDir?: string
  providers?: Record<string, Provider>
}

export class FourfiveLlm {
  private ai: Ai
  private dataDir: string

  constructor(opts: FourfiveLlmOptions = {}) {
    if (opts.dataDir) {
      this.dataDir = opts.dataDir
    } else {
      const resolved = resolveDataDir()
      if (resolved.warning) console.warn(`[codev] ${resolved.warning}`)
      // Post-R13 the resolver always lands on the in-repo default when
      // nothing else is configured; null survives only for hard misconfig.
      if (!resolved.dir) throw new Error('no data store resolvable — set NS_DATA or run just bootstrap')
      this.dataDir = resolved.dir
    }
    this.ai = createAi({
      runLogFile: path.join(this.dataDir, 'runs', 'ai-runs.jsonl'),
      mock: { responder: demoResponder, thinking: DEMO_THINKING },
      ...(opts.providers ? { providers: opts.providers } : {}),
    })
  }

  /** Explicit id > fourfive-chat default > offline demo. An explicit id
   * that names a missing/invalid profile throws — the surfaces show it. */
  resolveProfile(explicitId?: string): Profile {
    if (explicitId) return loadProfile(this.dataDir, explicitId)
    const defaultId = loadDefaults(this.dataDir)['fourfive-chat']
    if (!defaultId) return OFFLINE
    try {
      return loadProfile(this.dataDir, defaultId)
    } catch (err) {
      console.warn(`[codev] fourfive-chat default profile unusable, using the offline demo: ${(err as Error).message}`)
      return OFFLINE
    }
  }

  /** The resolved default, for /api/health — recomputed per call so a
   * Profiles-screen change shows up with no restart. */
  health(): { provider: string; model: string; profile: string } {
    const p = this.resolveProfile()
    return { provider: p.provider, model: p.model ?? '(provider default)', profile: p.id }
  }

  private aiOptions(profile: Profile, opts: TurnOptions, caller: string): AiChatOptions {
    const out: AiChatOptions = {
      caller,
      profile: profile.id,
      model: profile.model,
      // A profile with no prompt of its own still gets the design-partner
      // framing — promptless must not mean unguided (2026-07-10).
      system: profile.system_prompt?.trim() ? profile.system_prompt : DEFAULT_CHAT_SYSTEM_PROMPT,
      think: opts.think,
      maxTokens: opts.maxTokens,
    }
    // Verify: the per-message toggle overrides the profile's default in
    // BOTH directions (§2.6: off by default for chat, toggle per message).
    if (opts.verify?.on) {
      out.verify = {
        ...profile.goal_verify,
        verify: 'on',
        goal: opts.verify.goal ?? profile.goal_verify?.goal,
      }
    } else if (opts.verify && !opts.verify.on) {
      out.verify = { verify: 'off' }
    } else if (profile.goal_verify) {
      out.verify = profile.goal_verify
    }
    return out
  }

  async chat(messages: ChatMessage[], opts: TurnOptions): Promise<TurnResult> {
    const profile = this.resolveProfile(opts.profileId)
    const result = await this.ai.chat(profile.provider, messages, this.aiOptions(profile, opts, 'fourfive-chat'))
    return toTurnResult(result, profile)
  }

  async chatStream(
    messages: ChatMessage[],
    opts: TurnOptions,
    onEvent: (e: TurnEvent) => void | Promise<void>,
  ): Promise<TurnResult> {
    const profile = this.resolveProfile(opts.profileId)
    const pending: Promise<void>[] = []
    const forward = (e: StreamEvent) => {
      let mapped: TurnEvent | null = null
      if (e.type === 'thinking') mapped = { kind: 'thinking', delta: e.delta }
      else if (e.type === 'content') mapped = { kind: 'content', delta: e.delta }
      else if (e.type === 'verify') {
        mapped = {
          kind: 'verify', iteration: e.iteration,
          met: e.verdict.met, gaps: e.verdict.gaps,
          tokensIn: e.tokensIn, tokensOut: e.tokensOut,
        }
      }
      if (mapped) {
        const r = onEvent(mapped)
        if (r) pending.push(r.catch(() => {}))
      }
    }
    const result = await this.ai.chatStream(
      profile.provider, messages, this.aiOptions(profile, opts, 'fourfive-chat'), forward,
    )
    await Promise.all(pending)
    return toTurnResult(result, profile)
  }

  /** The blueprint step. The offline profile short-circuits to the canned
   * demo; real profiles get the extractor prompt through nunc-ai (never
   * verified — the zod validation downstream is the gate, §2.6 cost rule).
   * The result is CLASSIFIED, never a silent null: 2026-07-10 every
   * blueprint failure under local serving was invisible. */
  async proposeBlueprint(
    history: ChatMessage[],
    current: Blueprint | null,
    opts: TurnOptions,
  ): Promise<BlueprintProposal> {
    const profile = this.resolveProfile(opts.profileId)
    if (profile.provider === 'mock') {
      const proposed = proposeDemoBlueprint(history)
      return { proposed, outcome: proposed == null ? 'empty' : 'ok' }
    }
    const maxTokens = blueprintMaxTokens()
    let result: ChatResult
    try {
      result = await this.ai.chat(profile.provider, buildBlueprintMessages(history, current), {
        caller: 'fourfive-blueprint',
        profile: profile.id,
        model: profile.model,
        // Own generous budget — never opts.maxTokens, the per-message chat
        // cap (thinking models spend that on reasoning before the JSON).
        maxTokens,
        // Constrained decoding where the backend compiles schemas to a
        // grammar (llama-server). Other providers are left to the prompt:
        // the anthropic provider ignores jsonSchema and ollama's format
        // support for anyOf-rooted schemas is unproven.
        ...(profile.provider === 'llama-cpp' ? { jsonSchema: blueprintResponseJsonSchema } : {}),
        verify: { verify: 'off' },
      })
    } catch (err) {
      const msg = (err as Error).message
      // llama-server refuses a prompt bigger than its per-slot window
      // (ctx/parallel) with HTTP 400 exceed_context_size_error.
      if (/exceed_context|context size/i.test(msg)) {
        return { proposed: null, outcome: 'context-overflow', detail: msg.slice(0, 300) }
      }
      throw err
    }
    const text = result.text.trim()
    if (result.stopReason === 'length') {
      // Truncated JSON can still parse (zod defaults would then validate a
      // half-empty blueprint and wipe saved sections) — always discard.
      return {
        proposed: null,
        outcome: 'length-truncated',
        stopReason: result.stopReason,
        detail: `output hit the ${maxTokens}-token blueprint budget after ${result.usage.outputTokens} tokens`,
      }
    }
    const proposed = extractJson(text)
    if (proposed == null) {
      if (text === '' || text === 'null') return { proposed: null, outcome: 'empty', stopReason: result.stopReason }
      return {
        proposed: null,
        outcome: 'parse-failed',
        stopReason: result.stopReason,
        detail: `model output is not blueprint JSON (${text.length} chars): ${text.slice(0, 80)}`,
      }
    }
    return { proposed, outcome: 'ok', stopReason: result.stopReason }
  }
}

function toTurnResult(result: ChatResult, profile: Profile): TurnResult {
  return {
    content: result.text,
    model: result.model,
    provider: result.provider,
    profileId: profile.id,
    usage: { input: result.usage.inputTokens, output: result.usage.outputTokens },
  }
}
