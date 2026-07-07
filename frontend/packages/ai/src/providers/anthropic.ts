import type {
  Capabilities, ChatMessage, ChatOptions, ChatResult, FetchLike, Provider,
} from '../types.ts';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export interface AnthropicConfig {
  apiKey?: string;
  defaultModel?: string;
  fetchImpl?: FetchLike;
}

export function anthropicProvider(cfg: AnthropicConfig = {}): Provider {
  const fetchImpl = cfg.fetchImpl ?? globalThis.fetch;
  const capabilities: Capabilities = {
    chat: true, stream: true, tools: true, structured: true,
    webSearch: 'native', thinking: true, memory: false,
  };
  return {
    name: 'anthropic-api',
    capabilities,
    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
      const apiKey = cfg.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('anthropic-api: ANTHROPIC_API_KEY is not set');
      const model = opts.model ?? cfg.defaultModel ?? 'claude-sonnet-5';
      const system = [opts.system, ...messages.filter(m => m.role === 'system').map(m => m.content)]
        .filter(Boolean).join('\n\n');
      const body: Record<string, unknown> = {
        model,
        max_tokens: opts.maxTokens ?? 4096,
        messages: messages.filter(m => m.role !== 'system')
          .map(m => ({ role: m.role, content: m.content })),
      };
      if (system) body.system = system;
      if (opts.temperature !== undefined) body.temperature = opts.temperature;
      if (opts.webSearch)
        body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }];

      const res = await fetchImpl(API, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
      });
      if (!res.ok)
        throw new Error(`anthropic-api: HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      const data = await res.json() as {
        content: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string; stop_reason?: string;
      };
      const text = data.content.filter(b => b.type === 'text' && b.text)
        .map(b => b.text).join('');
      return {
        text,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
        },
        model: data.model ?? model,
        provider: 'anthropic-api',
        stopReason: data.stop_reason,
      };
    },
  };
}
