// Types shared between the Vue frontend and the Hono server.

import type { Blueprint } from './blueprint'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface Session {
  id: string
  app_id: string | null
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  role: ChatRole
  content: string
  created_at: string
  input_tokens?: number | null
  output_tokens?: number | null
}

export interface TemporaryApp {
  id: string
  name: string
  slug: string
  description: string | null
  current_version: number
  workspace_path: string
  created_at: string
  updated_at: string
}

// --- API DTOs ---

export interface HealthResponse {
  ok: boolean
  provider: string
  model: string
  /** The resolved fourfive-chat default profile id (Phase D). */
  profile?: string
  version: string
}

/** One goal-verify loop boundary on the chat stream (S-6): the judge's
 * verdict for that iteration plus its token cost. */
export interface VerifyStep {
  iteration: number
  met: boolean
  gaps: string[]
  tokensIn: number
  tokensOut: number
}

export interface CreateSessionBody {
  title?: string
  mode?: 'new' | 'compose'
  /** compose: name of the new composite app (also the session title). */
  name?: string
  /** compose: apps the new app depends on; pinned at their current version. */
  dependencies?: { app_id: string }[]
}

export interface SendMessageBody {
  content: string
  think?: boolean
  maxTokens?: number
}

export interface SendMessageResponse {
  userMessage: Message
  assistantMessage: Message
  blueprint: Blueprint | null
}

export interface UsageResponse {
  input: number
  output: number
  total: number
}

export interface AppListItem {
  id: string
  name: string
  slug: string
  description: string | null
  current_version: number
  updated_at: string
}

// --- strategy read-out (Phase E, plan PE12) ---

/** One declared metric with its current value, exactly as apps-host's
 * published API serves it (contracts/app-bundle.md §6). */
export interface ServedMetric {
  name: string
  label: string
  value: number | string | null
  error?: string
}

/** The stage-3 card. `grounding` must be a subset of the declared metric
 * names — enforced server-side in code, not prose (S-7). */
export interface StrategyCard {
  win: string
  constraint: string
  risk_to_watch: string
  grounding: string[]
}

export interface StrategyResponse {
  card: StrategyCard
  /** The SERVED app version the metrics came from (may trail the session's
   * rolling blueprint version) — the card's `<slug>@v<N>` stamp. */
  app: { slug: string; version: number; name: string }
  metrics: ServedMetric[]
}

/** One dependency of the current session's app, with its pinned blueprint. */
export interface DependencyInfo {
  app_id: string
  name: string
  slug: string
  pinned_version: number
  current_version: number
  blueprint: Blueprint | null
}

export interface SessionBlueprintResponse {
  blueprint: Blueprint | null
  dependencies: DependencyInfo[]
}
