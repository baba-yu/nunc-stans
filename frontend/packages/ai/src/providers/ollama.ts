import type {
  Capabilities, ChatMessage, ChatOptions, ChatResult, FetchLike, Provider,
} from '../types.ts';

export interface OllamaConfig {
  host?: string;
  defaultModel?: string;
  fetchImpl?: FetchLike;
}

export function ollamaProvider(cfg: OllamaConfig = {}): Provider {
  const fetchImpl = cfg.fetchImpl ?? globalThis.fetch;
  const host = cfg.host ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
  const capabilities: Capabilities = {
    chat: true, stream: true, tools: false, structured: true,
    webSearch: 'none', thinking: false, memory: false,
  };
  return {
    name: 'ollama',
    capabilities,
    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
      if (opts.webSearch)
        throw new Error('ollama: no native web search — pair it with an external SearchSource');
      const model = opts.model ?? cfg.defaultModel ?? 'qwen3.6:27b';
      const body: Record<string, unknown> = {
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
      };
      if (opts.system) body.messages = [{ role: 'system', content: opts.system }, ...(body.messages as unknown[])];
      // Ollama structured outputs: `format` takes a JSON schema object.
      if (opts.jsonSchema) body.format = opts.jsonSchema;
      if (opts.temperature !== undefined) body.options = { temperature: opts.temperature };

      const res = await fetchImpl(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 600_000),
      });
      if (!res.ok)
        throw new Error(`ollama: HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      const data = await res.json() as {
        message?: { content?: string };
        prompt_eval_count?: number; eval_count?: number; model?: string;
        done_reason?: string;
      };
      return {
        text: data.message?.content ?? '',
        usage: {
          inputTokens: data.prompt_eval_count ?? 0,
          outputTokens: data.eval_count ?? 0,
        },
        model: data.model ?? model,
        provider: 'ollama',
        stopReason: data.done_reason,
      };
    },
  };
}
