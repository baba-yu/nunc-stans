import type {
  Capabilities, ChatMessage, ChatOptions, ChatResult, FetchLike, Provider,
  StreamHandler,
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

  function buildRequest(messages: ChatMessage[], opts: ChatOptions, stream: boolean) {
    const apiKey = cfg.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('anthropic-api: ANTHROPIC_API_KEY is not set');
    // Default verified against the claude-api skill 2026-07-07:
    // claude-sonnet-5 is a current, active alias.
    const model = opts.model ?? cfg.defaultModel ?? 'claude-sonnet-5';
    const system = [opts.system, ...messages.filter(m => m.role === 'system').map(m => m.content)]
      .filter(Boolean).join('\n\n');
    const body: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? 4096,
      messages: messages.filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content })),
    };
    if (stream) body.stream = true;
    if (system) body.system = system;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.webSearch)
      body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }];
    return {
      model,
      init: {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
      },
    };
  }

  return {
    name: 'anthropic-api',
    capabilities,
    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
      const { model, init } = buildRequest(messages, opts, false);
      const res = await fetchImpl(API, init);
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

    /** SSE streaming (`stream: true` on /v1/messages): thinking deltas
     * arrive as content_block_delta {type: thinking_delta}, text as
     * {type: text_delta}; input tokens ride message_start, output tokens
     * + stop_reason ride message_delta. */
    async chatStream(messages: ChatMessage[], opts: ChatOptions = {}, onEvent: StreamHandler): Promise<ChatResult> {
      const { model, init } = buildRequest(messages, opts, true);
      const res = await fetchImpl(API, init);
      if (!res.ok)
        throw new Error(`anthropic-api: HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      if (!res.body)
        throw new Error('anthropic-api: streaming response has no body');

      let text = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let servedModel = model;
      let stopReason: string | undefined;

      const handleData = (payload: string) => {
        if (!payload || payload === '[DONE]') return;
        const ev = JSON.parse(payload) as {
          type: string;
          message?: { model?: string; usage?: { input_tokens?: number } };
          delta?: { type?: string; text?: string; thinking?: string; stop_reason?: string };
          usage?: { output_tokens?: number };
        };
        if (ev.type === 'message_start') {
          servedModel = ev.message?.model ?? servedModel;
          inputTokens = ev.message?.usage?.input_tokens ?? 0;
        } else if (ev.type === 'content_block_delta') {
          if (ev.delta?.type === 'thinking_delta' && ev.delta.thinking) {
            onEvent({ type: 'thinking', delta: ev.delta.thinking });
          } else if (ev.delta?.type === 'text_delta' && ev.delta.text) {
            text += ev.delta.text;
            onEvent({ type: 'content', delta: ev.delta.text });
          }
        } else if (ev.type === 'message_delta') {
          stopReason = ev.delta?.stop_reason ?? stopReason;
          outputTokens = ev.usage?.output_tokens ?? outputTokens;
        }
      };

      // SSE framing: events separated by blank lines; take `data:` lines.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const handleChunk = (chunk: string) => {
        buf += chunk;
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line.startsWith('data:')) handleData(line.slice(5).trim());
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        handleChunk(decoder.decode(value, { stream: true }));
      }
      handleChunk(decoder.decode());
      if (buf.trim().startsWith('data:')) handleData(buf.trim().slice(5).trim());

      const result: ChatResult = {
        text,
        usage: { inputTokens, outputTokens },
        model: servedModel,
        provider: 'anthropic-api',
        stopReason,
      };
      onEvent({ type: 'done', result });
      return result;
    },
  };
}
