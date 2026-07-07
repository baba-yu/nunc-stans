import type {
  Capabilities, ChatMessage, ChatOptions, ChatResult, Provider,
} from '../types.ts';

export type MockResponder =
  (messages: ChatMessage[], opts: ChatOptions) => string;

export interface MockConfig {
  /** Fixed reply, per-caller replies, or a responder function. */
  reply?: string;
  byCaller?: Record<string, string>;
  responder?: MockResponder;
}

/** Deterministic fixture provider — used by unit tests and pipeline dry
 * runs. Never touches the network. */
export function mockProvider(cfg: MockConfig = {}): Provider {
  const capabilities: Capabilities = {
    chat: true, stream: false, tools: false, structured: true,
    webSearch: 'none', thinking: false, memory: false,
  };
  return {
    name: 'mock',
    capabilities,
    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
      const text =
        cfg.responder?.(messages, opts) ??
        (opts.caller && cfg.byCaller?.[opts.caller]) ??
        cfg.reply ??
        `mock:${messages[messages.length - 1]?.content ?? ''}`;
      return {
        text,
        usage: { inputTokens: 0, outputTokens: 0 },
        model: opts.model ?? 'mock',
        provider: 'mock',
      };
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
