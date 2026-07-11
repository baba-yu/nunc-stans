// nunc-ai — the one place that talks to models (v1 plan §2.6).
// Two tiers: model providers (anthropic-api, ollama, mock, …) and agent
// runtimes (claude-code). Search is two axes: a search source × a
// synthesis model; local models get search through external adapters.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Tool calls this assistant message requested (tool loop, PE9/T8). */
  toolCalls?: ToolCall[];
  /** For role 'tool': which call this message answers. */
  toolCallId?: string;
}

/** A tool the model may call (PE9/T8). `inputSchema` is a JSON Schema —
 * the same shape MCP serves, passed through to the provider verbatim. */
export interface ToolSpec {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** One tool invocation the model requested. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
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
  /** Provider-side reasoning toggle where one exists (ollama's `think`
   * for qwen-class models). Providers without the knob ignore it. */
  think?: boolean;
  /** Step / call-site id stamped into the run log. */
  caller?: string;
  /** Per-call goal-verify override, merged over the Ai-level config
   * (§2.6: per-message toggle in chat, per-step config in pipelines). */
  verify?: Partial<VerifyConfig>;
  /** Active profile id, stamped into the run log (S-5). Resolution from
   * the profile store happens at the call site; nunc-ai only records it. */
  profile?: string;
  /** Tools the model may call this turn (capability `tools: true`
   * required). Execution happens OUTSIDE the provider — use
   * Ai.chatWithTools for the bounded loop; a bare chat() with tools
   * returns the requested calls in ChatResult.toolCalls unexecuted. */
  tools?: ToolSpec[];
}

/** One streamed chunk from a chatStream-capable provider. `thinking`
 * deltas only occur when the provider/model emits reasoning (capability
 * `thinking: true`); `done` always carries the final assembled result.
 * Under goal-verify (PD5), each iteration streams its content and the
 * middleware emits one `verify` boundary event per judge verdict — the
 * chat UI renders those as the visible loop (S-6); exactly one `done`
 * fires, after the loop settles. */
export type StreamEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'content'; delta: string }
  | { type: 'verify'; iteration: number; verdict: { met: boolean; gaps: string[] }; tokensIn: number; tokensOut: number }
  | { type: 'done'; result: ChatResult };

export type StreamHandler = (event: StreamEvent) => void;

export interface ChatResult {
  text: string;
  usage: Usage;
  model: string;
  provider: string;
  stopReason?: string;
  /** Tool calls the model requested (present only when opts.tools were
   * offered and the model chose to call — the loop in index.ts executes
   * them and calls the model again). */
  toolCalls?: ToolCall[];
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
  /** Streamed chat with thinking deltas where the model emits them.
   * Optional: providers without it declare `stream: false` and callers
   * fall back to chat + a single final `content` delta (PD6 — honest
   * capability declaration instead of a hidden stub). Returns the same
   * final result the `done` event carries. */
  chatStream?(messages: ChatMessage[], opts: ChatOptions | undefined, onEvent: StreamHandler): Promise<ChatResult>;
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

/** One judge verdict in a goal-verify chain (§2.6): whether the goal was
 * met, the gaps fed back on retry, and the iteration's token cost. */
export interface VerdictEntry {
  met: boolean;
  gaps: string[];
  tokensIn: number;
  tokensOut: number;
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
  /** The provider's finish reason for the final result ('stop', 'length',
   * …) when it reports one. 'length' is the truncation fingerprint —
   * without it a capped-off reply and a complete one log identically. */
  stopReason?: string;
  /** Active profile id (S-5 stamp). */
  profile?: string;
  /** Goal-verify verdict chain, one entry per iteration (populated by the
   * T3 loop; absent when verify is off). */
  verdicts?: VerdictEntry[];
  /** Tool-loop audit (PE9/T8): how many times each tool ran in this call.
   * The names are the declared MCP tool names — no arguments are logged
   * (the log carries no prompt text; same rule). */
  toolCalls?: { name: string; count: number }[];
}

export type FetchLike = typeof globalThis.fetch;
