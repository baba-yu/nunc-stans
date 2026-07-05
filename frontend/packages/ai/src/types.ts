// nunc-ai — the one place that talks to models (v1 plan §2.6).
// Two tiers: model providers (anthropic-api, ollama, mock, …) and agent
// runtimes (claude-code). Search is two axes: a search source × a
// synthesis model; local models get search through external adapters.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  /** Ask the model to emit JSON conforming to this schema (advisory —
   * callers must still validate; the pipeline re-prompts on failure). */
  jsonSchema?: object;
  /** Use the provider's native web search for this call (capability
   * `webSearch: 'native'` required). External search happens outside the
   * provider via a SearchSource. */
  webSearch?: boolean;
  timeoutMs?: number;
  /** Step / call-site id stamped into the run log. */
  caller?: string;
}

export interface ChatResult {
  text: string;
  usage: Usage;
  model: string;
  provider: string;
  stopReason?: string;
}

export interface Capabilities {
  chat: boolean;
  stream: boolean;
  tools: boolean;
  structured: boolean;
  webSearch: 'native' | 'none';
  thinking: boolean;
  memory: boolean;
}

export interface Provider {
  name: string;
  capabilities: Capabilities;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export interface SearchOptions {
  count?: number;
  timeoutMs?: number;
}

export interface SearchSource {
  name: string;
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
}

/** Goal-verification config (§2.6). Parsed and logged from Phase C;
 * the judge/retry loop itself is wired in Phase D (S-6). */
export interface VerifyConfig {
  verify: 'on' | 'off';
  goal?: string;
  judge?: { provider: string; model?: string };
  maxIters?: number;
  tokenBudget?: number;
}

export interface RunLogEntry {
  ts: string;
  caller: string;
  provider: string;
  model: string;
  search?: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  verify: 'on' | 'off';
  outcome: 'ok' | 'error';
  error?: string;
}

export type FetchLike = typeof globalThis.fetch;
