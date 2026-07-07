import type {
  Capabilities, ChatMessage, ChatOptions, ChatResult, FetchLike, Provider,
  StreamHandler,
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
    webSearch: 'none', thinking: true, memory: false,
  };

  // Streamed NDJSON, both paths: with stream:false a long generation sends
  // no bytes for minutes and undici's 300s header/body idle timeouts kill
  // the socket ("fetch failed" — found by exit run (b) on a 27B model).
  // Streaming keeps bytes flowing; the overall cap is the AbortSignal.
  // chat() consumes the same stream with no handler — behavior identical.
  async function run(
    messages: ChatMessage[], opts: ChatOptions = {}, onEvent?: StreamHandler,
  ): Promise<ChatResult> {
    if (opts.webSearch)
      throw new Error('ollama: no native web search — pair it with an external SearchSource');
    const model = opts.model ?? cfg.defaultModel ?? 'qwen3.6:27b';
    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    };
    if (opts.system) body.messages = [{ role: 'system', content: opts.system }, ...(body.messages as unknown[])];
    // Ollama structured outputs: `format` takes a JSON schema object.
    if (opts.jsonSchema) body.format = opts.jsonSchema;
    if (opts.temperature !== undefined) body.options = { temperature: opts.temperature };

    const res = await fetchImpl(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 1_800_000),
    });
    if (!res.ok)
      throw new Error(`ollama: HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);

    let text = '';
    let last: {
      message?: { content?: string; thinking?: string };
      prompt_eval_count?: number; eval_count?: number; model?: string;
      done_reason?: string;
    } = {};
    const handleLine = (line: string) => {
      const t = line.trim();
      if (!t) return;
      const j = JSON.parse(t) as typeof last;
      const content = j.message?.content ?? '';
      const thinking = j.message?.thinking ?? '';
      if (thinking && onEvent) onEvent({ type: 'thinking', delta: thinking });
      if (content) {
        text += content;
        onEvent?.({ type: 'content', delta: content });
      }
      last = j;
    };

    if (res.body && onEvent) {
      // Incremental: parse each NDJSON line as it arrives so deltas reach
      // the caller live (S-11 streaming render).
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          handleLine(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
      }
      buf += decoder.decode();
      if (buf.trim()) handleLine(buf);
    } else {
      for (const line of (await res.text()).split('\n')) handleLine(line);
    }

    const result: ChatResult = {
      text,
      usage: {
        inputTokens: last.prompt_eval_count ?? 0,
        outputTokens: last.eval_count ?? 0,
      },
      model: last.model ?? model,
      provider: 'ollama',
      stopReason: last.done_reason,
    };
    onEvent?.({ type: 'done', result });
    return result;
  }

  return {
    name: 'ollama',
    capabilities,
    chat: (messages, opts) => run(messages, opts),
    chatStream: (messages, opts, onEvent) => run(messages, opts ?? {}, onEvent),
  };
}
