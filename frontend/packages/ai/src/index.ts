import { anthropicProvider } from './providers/anthropic.ts';
import { ollamaProvider } from './providers/ollama.ts';
import { forbidProvider, mockProvider, type MockConfig } from './providers/mock.ts';
import { claudeCodeRuntime, type ClaudeCodeConfig } from './runtimes/claude-code.ts';
import { getSearchSource } from './search/adapters.ts';
import { appendRunLog } from './runlog.ts';
import { normalizeVerify } from './verify.ts';
import type {
  ChatMessage, ChatOptions, ChatResult, FetchLike, Provider,
  SearchOptions, SearchResult, VerifyConfig,
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

  async function chat(providerName: string, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const p = provider(providerName);
    const started = Date.now();
    try {
      const result = await p.chat(messages, opts);
      appendRunLog(cfg.runLogFile, {
        ts: new Date(started).toISOString(),
        caller: opts.caller ?? 'unknown',
        provider: p.name,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        durationMs: Date.now() - started,
        verify: verify.verify,
        outcome: 'ok',
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
        verify: verify.verify,
        outcome: 'error',
        error: err instanceof Error ? err.message.slice(0, 300) : String(err),
      });
      throw err;
    }
  }

  async function search(sourceName: string, query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    return getSearchSource(sourceName, cfg.fetchImpl).search(query, opts);
  }

  return { provider, chat, search };
}
