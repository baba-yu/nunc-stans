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
  Ai, ChatOptions as AiChatOptions, ChatResult, Profile, StreamEvent,
} from '../../../../frontend/packages/ai/src/index.ts'
import { resolveDataDir } from '../../../../tools/lib/data-dir.ts'
import type { ChatMessage } from '../../shared/types'
import type { Blueprint } from '../../shared/blueprint'
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

export class FourfiveLlm {
  private ai: Ai
  private dataDir: string

  constructor() {
    const resolved = resolveDataDir()
    if (resolved.warning) console.warn(`[codev] ${resolved.warning}`)
    // Post-R13 the resolver always lands on the in-repo default when
    // nothing else is configured; null survives only for hard misconfig.
    if (!resolved.dir) throw new Error('no data store resolvable — set NS_DATA or run just bootstrap')
    this.dataDir = resolved.dir
    this.ai = createAi({
      runLogFile: path.join(this.dataDir, 'runs', 'ai-runs.jsonl'),
      mock: { responder: demoResponder, thinking: DEMO_THINKING },
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
      system: profile.system_prompt,
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
   * verified — the zod validation downstream is the gate, §2.6 cost rule). */
  async proposeBlueprint(
    history: ChatMessage[],
    current: Blueprint | null,
    opts: TurnOptions,
  ): Promise<unknown> {
    const profile = this.resolveProfile(opts.profileId)
    if (profile.provider === 'mock') return proposeDemoBlueprint(history)
    const result = await this.ai.chat(profile.provider, buildBlueprintMessages(history, current), {
      caller: 'fourfive-blueprint',
      profile: profile.id,
      model: profile.model,
      maxTokens: opts.maxTokens,
      verify: { verify: 'off' },
    })
    return extractJson(result.text)
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
