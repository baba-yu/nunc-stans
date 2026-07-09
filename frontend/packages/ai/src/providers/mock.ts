import type {
  Capabilities, ChatMessage, ChatOptions, ChatResult, Provider,
  StreamHandler, ToolCall,
} from '../types.ts';

export type MockResponder =
  (messages: ChatMessage[], opts: ChatOptions) => string;

export interface MockConfig {
  /** Fixed reply, per-caller replies, or a responder function. */
  reply?: string;
  byCaller?: Record<string, string>;
  responder?: MockResponder;
  /** Scripted thinking text emitted (in chunks) before the content when
   * chatStream is used — the S-11/S-6 rehearsal path, zero live tokens. */
  thinking?: string;
  /** Scripted tool rounds (PE9/T8, the S-7 zero-token rehearsal): when
   * tools are offered, each chat call pops the next batch of tool calls;
   * once the script is exhausted the reply text answers normally. */
  toolScript?: ToolCall[][];
}

/** Deterministic fixture provider — used by unit tests and pipeline dry
 * runs. Never touches the network. Streams scripted deltas (chunked
 * reply + optional scripted thinking) so streaming surfaces are testable
 * without a live model. */
export function mockProvider(cfg: MockConfig = {}): Provider {
  const capabilities: Capabilities = {
    chat: true, stream: true, tools: true, structured: true,
    webSearch: 'none', thinking: true, memory: false,
  };
  const toolScript = [...(cfg.toolScript ?? [])];

  function reply(messages: ChatMessage[], opts: ChatOptions): string {
    return cfg.responder?.(messages, opts) ??
      (opts.caller && cfg.byCaller?.[opts.caller]) ??
      cfg.reply ??
      `mock:${messages[messages.length - 1]?.content ?? ''}`;
  }

  function result(text: string, opts: ChatOptions): ChatResult {
    return {
      text,
      usage: { inputTokens: 0, outputTokens: 0 },
      model: opts.model ?? 'mock',
      provider: 'mock',
    };
  }

  const chunk = (s: string): string[] => s.match(/.{1,8}/gs) ?? [];

  return {
    name: 'mock',
    capabilities,
    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
      if (opts.tools?.length && toolScript.length) {
        const calls = toolScript.shift()!;
        return { ...result('', opts), toolCalls: calls };
      }
      return result(reply(messages, opts), opts);
    },
    async chatStream(messages: ChatMessage[], opts: ChatOptions = {}, onEvent: StreamHandler): Promise<ChatResult> {
      for (const delta of chunk(cfg.thinking ?? '')) onEvent({ type: 'thinking', delta });
      const text = reply(messages, opts);
      for (const delta of chunk(text)) onEvent({ type: 'content', delta });
      const r = result(text, opts);
      onEvent({ type: 'done', result: r });
      return r;
    },
  };
}

/** A provider that throws on any call — replay mode (S-4) installs this
 * to prove a run performed zero LLM calls. */
export function forbidProvider(reason = 'LLM calls are forbidden in this mode'): Provider {
  return {
    name: 'forbid',
    capabilities: {
      chat: false, stream: false, tools: false, structured: false,
      webSearch: 'none', thinking: false, memory: false,
    },
    async chat(): Promise<ChatResult> {
      throw new Error(`forbid: ${reason}`);
    },
  };
}
