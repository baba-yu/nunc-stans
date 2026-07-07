import { anthropicProvider } from './providers/anthropic.ts';
import { ollamaProvider } from './providers/ollama.ts';
import { forbidProvider, mockProvider, type MockConfig } from './providers/mock.ts';
import { claudeCodeRuntime, type ClaudeCodeConfig } from './runtimes/claude-code.ts';
import { getSearchSource } from './search/adapters.ts';
import { appendRunLog } from './runlog.ts';
import { normalizeVerify } from './verify.ts';
import type {
  ChatMessage, ChatOptions, ChatResult, FetchLike, Provider,
  SearchOptions, SearchResult, StreamHandler, VerifyConfig,
} from './types.ts';

export * from './types.ts';
export { anthropicProvider } from './providers/anthropic.ts';
export { ollamaProvider } from './providers/ollama.ts';
export { mockProvider, forbidProvider } from './providers/mock.ts';
export { claudeCodeRuntime } from './runtimes/claude-code.ts';
export {
  SEARCH_ADAPTERS, getSearchSource, braveSearch, searxngSearch,
  tavilySearch, perplexitySearch,
} from './search/adapters.ts';
export { appendRunLog } from './runlog.ts';
export { normalizeVerify } from './verify.ts';

export interface AiConfig {
  /** JSONL run log path (e.g. `<data store>/runs/ai-runs.jsonl`). Every
   * chat call appends one entry (§2.6). */
  runLogFile: string;
  fetchImpl?: FetchLike;
  mock?: MockConfig;
  claudeCode?: ClaudeCodeConfig;
  /** Extra/override providers keyed by name (tests, replay's forbid). */
  providers?: Record<string, Provider>;
  verify?: Partial<VerifyConfig>;
}

export interface Ai {
  provider(name: string): Provider;
  chat(providerName: string, messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  /** Streamed chat. Providers without chatStream (capability-declared,
   * e.g. claude-code in v0) fall back to chat() and emit the full reply
   * as one final content delta — honest, not hidden (PD6). Logged to the
   * run log exactly like chat(). */
  chatStream(providerName: string, messages: ChatMessage[], opts: ChatOptions | undefined, onEvent: StreamHandler): Promise<ChatResult>;
  search(sourceName: string, query: string, opts?: SearchOptions): Promise<SearchResult[]>;
}

export function createAi(cfg: AiConfig): Ai {
  const verify = normalizeVerify(cfg.verify);
  const builtin: Record<string, () => Provider> = {
    'anthropic-api': () => anthropicProvider({ fetchImpl: cfg.fetchImpl }),
    'ollama': () => ollamaProvider({ fetchImpl: cfg.fetchImpl }),
    'mock': () => mockProvider(cfg.mock),
    'forbid': () => forbidProvider(),
    'claude-code': () => claudeCodeRuntime(cfg.claudeCode),
  };
  const cache = new Map<string, Provider>();

  function provider(name: string): Provider {
    const custom = cfg.providers?.[name];
    if (custom) return custom;
    let p = cache.get(name);
    if (!p) {
      const make = builtin[name];
      if (!make) throw new Error(
        `ai: unknown provider '${name}' (have: ${[...Object.keys(builtin), ...Object.keys(cfg.providers ?? {})].join(', ')})`);
      p = make();
      cache.set(name, p);
    }
    return p;
  }

  /** Effective verify config for one call: per-call override merged over
   * the Ai-level defaults (§2.6 — per-message toggle / per-step config). */
  function effectiveVerify(opts: ChatOptions): VerifyConfig {
    return opts.verify ? normalizeVerify({ ...verify, ...opts.verify }) : verify;
  }

  async function logged(
    providerName: string,
    opts: ChatOptions,
    call: (p: Provider) => Promise<ChatResult>,
  ): Promise<ChatResult> {
    const p = provider(providerName);
    const callVerify = effectiveVerify(opts);
    const started = Date.now();
    try {
      const result = await call(p);
      appendRunLog(cfg.runLogFile, {
        ts: new Date(started).toISOString(),
        caller: opts.caller ?? 'unknown',
        provider: p.name,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        durationMs: Date.now() - started,
        verify: callVerify.verify,
        outcome: 'ok',
        ...(opts.profile ? { profile: opts.profile } : {}),
      });
      return result;
    } catch (err) {
      appendRunLog(cfg.runLogFile, {
        ts: new Date(started).toISOString(),
        caller: opts.caller ?? 'unknown',
        provider: providerName,
        model: opts.model ?? '',
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - started,
        verify: callVerify.verify,
        outcome: 'error',
        error: err instanceof Error ? err.message.slice(0, 300) : String(err),
        ...(opts.profile ? { profile: opts.profile } : {}),
      });
      throw err;
    }
  }

  async function chat(providerName: string, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    return logged(providerName, opts, p => p.chat(messages, opts));
  }

  async function chatStream(
    providerName: string, messages: ChatMessage[], opts: ChatOptions = {}, onEvent: StreamHandler,
  ): Promise<ChatResult> {
    return logged(providerName, opts, async p => {
      if (p.chatStream) return p.chatStream(messages, opts, onEvent);
      // Capability-declared fallback (stream:false providers): one final
      // content delta — exactly the old FourFive stub behavior, honest.
      const result = await p.chat(messages, opts);
      if (result.text) onEvent({ type: 'content', delta: result.text });
      onEvent({ type: 'done', result });
      return result;
    });
  }

  async function search(sourceName: string, query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    return getSearchSource(sourceName, cfg.fetchImpl).search(query, opts);
  }

  return { provider, chat, chatStream, search };
}
