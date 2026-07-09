import { anthropicProvider } from './providers/anthropic.ts';
import { ollamaProvider } from './providers/ollama.ts';
import { llamaCppProvider } from './providers/llamacpp.ts';
import { forbidProvider, mockProvider, type MockConfig } from './providers/mock.ts';
import { claudeCodeRuntime, type ClaudeCodeConfig } from './runtimes/claude-code.ts';
import { getSearchSource } from './search/adapters.ts';
import { appendRunLog } from './runlog.ts';
import { normalizeVerify, runVerified } from './verify.ts';
import type {
  ChatMessage, ChatOptions, ChatResult, FetchLike, Provider,
  SearchOptions, SearchResult, StreamHandler, ToolCall, ToolSpec, VerifyConfig,
} from './types.ts';

export * from './types.ts';
export { anthropicProvider } from './providers/anthropic.ts';
export { ollamaProvider } from './providers/ollama.ts';
export { llamaCppProvider } from './providers/llamacpp.ts';
export { mockProvider, forbidProvider } from './providers/mock.ts';
export { claudeCodeRuntime } from './runtimes/claude-code.ts';
export {
  SEARCH_ADAPTERS, getSearchSource, braveSearch, searxngSearch,
  tavilySearch, perplexitySearch,
} from './search/adapters.ts';
export { appendRunLog } from './runlog.ts';
export { normalizeVerify, runVerified } from './verify.ts';
export {
  loadDefaults, loadProfile, profilesDir, resolveProfile, validateProfile,
} from './profile.ts';
export type { Profile, ProfileContext, ProfileDefaults } from './profile.ts';

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

/** One tool execution request surfaced by the loop; the executor returns
 * the tool's text result (errors/refusals go back VERBATIM as the result
 * — the model sees them, the caller renders them). */
export type ToolExecutor = (call: ToolCall) => Promise<string>;

export interface ToolLoopOptions extends ChatOptions {
  tools: ToolSpec[];
  onToolCall: ToolExecutor;
  /** Hard budget across the whole loop (default 8): past it, remaining
   * requested calls are answered with a refusal and the model is called
   * once more WITHOUT tools so it must answer with what it has. */
  maxToolCalls?: number;
}

export interface Ai {
  provider(name: string): Provider;
  chat(providerName: string, messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  /** Streamed chat. Providers without chatStream (capability-declared,
   * e.g. claude-code in v0) fall back to chat() and emit the full reply
   * as one final content delta — honest, not hidden (PD6). Logged to the
   * run log exactly like chat(). */
  chatStream(providerName: string, messages: ChatMessage[], opts: ChatOptions | undefined, onEvent: StreamHandler): Promise<ChatResult>;
  /** The bounded tool loop (PE9/T8): offer tools, execute what the model
   * requests through `onToolCall`, feed results back, repeat until the
   * model answers or the budget trips. ONE run-log entry for the whole
   * loop (aggregated tokens + per-tool call counts, no arguments).
   * tools+verify in one call is a config error in v0 (PE9). */
  chatWithTools(providerName: string, messages: ChatMessage[], opts: ToolLoopOptions): Promise<ChatResult>;
  search(sourceName: string, query: string, opts?: SearchOptions): Promise<SearchResult[]>;
}

export function createAi(cfg: AiConfig): Ai {
  const verify = normalizeVerify(cfg.verify);
  const builtin: Record<string, () => Provider> = {
    'anthropic-api': () => anthropicProvider({ fetchImpl: cfg.fetchImpl }),
    'ollama': () => ollamaProvider({ fetchImpl: cfg.fetchImpl }),
    'llama-cpp': () => llamaCppProvider({ fetchImpl: cfg.fetchImpl }),
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

  /** The §2.6 judge/retry loop (PD5), one run-log entry for the whole
   * loop: aggregated tokens + the verdict chain. Judge calls go through
   * the provider directly, so they don't double-log. */
  async function verified(
    providerName: string, messages: ChatMessage[], opts: ChatOptions,
    callVerify: VerifyConfig, onEvent?: StreamHandler,
  ): Promise<ChatResult> {
    const p = provider(providerName);
    const judgeP = provider(callVerify.judge?.provider ?? providerName);
    const started = Date.now();
    try {
      const out = await runVerified(p, judgeP, messages, opts, callVerify, onEvent);
      onEvent?.({ type: 'done', result: out.result });
      appendRunLog(cfg.runLogFile, {
        ts: new Date(started).toISOString(),
        caller: opts.caller ?? 'unknown',
        provider: p.name,
        model: out.result.model,
        inputTokens: out.totalIn,
        outputTokens: out.totalOut,
        durationMs: Date.now() - started,
        verify: 'on',
        outcome: 'ok',
        verdicts: out.verdicts,
        ...(opts.profile ? { profile: opts.profile } : {}),
      });
      return out.result;
    } catch (err) {
      appendRunLog(cfg.runLogFile, {
        ts: new Date(started).toISOString(),
        caller: opts.caller ?? 'unknown',
        provider: providerName,
        model: opts.model ?? '',
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - started,
        verify: 'on',
        outcome: 'error',
        error: err instanceof Error ? err.message.slice(0, 300) : String(err),
        ...(opts.profile ? { profile: opts.profile } : {}),
      });
      throw err;
    }
  }

  async function chat(providerName: string, messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const callVerify = effectiveVerify(opts);
    if (callVerify.verify === 'on') return verified(providerName, messages, opts, callVerify);
    return logged(providerName, opts, p => p.chat(messages, opts));
  }

  async function chatStream(
    providerName: string, messages: ChatMessage[], opts: ChatOptions = {}, onEvent: StreamHandler,
  ): Promise<ChatResult> {
    const callVerify = effectiveVerify(opts);
    if (callVerify.verify === 'on') return verified(providerName, messages, opts, callVerify, onEvent);
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

  async function chatWithTools(
    providerName: string, messages: ChatMessage[], opts: ToolLoopOptions,
  ): Promise<ChatResult> {
    const { tools, onToolCall, maxToolCalls, ...chatOpts } = opts;
    if (effectiveVerify(chatOpts).verify === 'on')
      throw new Error('ai: tools and goal-verify cannot combine in one call (v0 — run them separately)');
    const p = provider(providerName);
    if (!p.capabilities.tools)
      throw new Error(`ai: provider '${p.name}' does not declare tool support`);
    const budget = maxToolCalls ?? 8;
    const msgs = [...messages];
    const counts = new Map<string, number>();
    let executed = 0;
    let totalIn = 0;
    let totalOut = 0;
    const started = Date.now();
    try {
      for (;;) {
        // Past the budget the model must answer from what it has: tools
        // are withdrawn rather than silently ignored.
        const offer = executed < budget ? tools : undefined;
        const result = await p.chat(msgs, { ...chatOpts, ...(offer ? { tools: offer } : {}) });
        totalIn += result.usage.inputTokens;
        totalOut += result.usage.outputTokens;
        if (!result.toolCalls?.length) {
          appendRunLog(cfg.runLogFile, {
            ts: new Date(started).toISOString(),
            caller: chatOpts.caller ?? 'unknown',
            provider: p.name,
            model: result.model,
            inputTokens: totalIn,
            outputTokens: totalOut,
            durationMs: Date.now() - started,
            verify: 'off',
            outcome: 'ok',
            ...(counts.size ? { toolCalls: [...counts].map(([name, count]) => ({ name, count })) } : {}),
            ...(chatOpts.profile ? { profile: chatOpts.profile } : {}),
          });
          return { ...result, usage: { inputTokens: totalIn, outputTokens: totalOut } };
        }
        msgs.push({ role: 'assistant', content: result.text, toolCalls: result.toolCalls });
        for (const call of result.toolCalls) {
          let output: string;
          if (executed >= budget) {
            output = `refused: the tool budget (${budget} calls) is exhausted — answer with what you have`;
          } else {
            executed += 1;
            counts.set(call.name, (counts.get(call.name) ?? 0) + 1);
            output = await onToolCall(call);
          }
          msgs.push({ role: 'tool', toolCallId: call.id, content: output });
        }
      }
    } catch (err) {
      appendRunLog(cfg.runLogFile, {
        ts: new Date(started).toISOString(),
        caller: chatOpts.caller ?? 'unknown',
        provider: providerName,
        model: chatOpts.model ?? '',
        inputTokens: totalIn,
        outputTokens: totalOut,
        durationMs: Date.now() - started,
        verify: 'off',
        outcome: 'error',
        error: err instanceof Error ? err.message.slice(0, 300) : String(err),
        ...(counts.size ? { toolCalls: [...counts].map(([name, count]) => ({ name, count })) } : {}),
        ...(chatOpts.profile ? { profile: chatOpts.profile } : {}),
      });
      throw err;
    }
  }

  async function search(sourceName: string, query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    return getSearchSource(sourceName, cfg.fetchImpl).search(query, opts);
  }

  return { provider, chat, chatStream, chatWithTools, search };
}
