import type {
  Capabilities, ChatMessage, ChatOptions, ChatResult, FetchLike, Provider,
  StreamHandler, ToolCall,
} from '../types.ts';

export interface LlamaCppConfig {
  host?: string;
  defaultModel?: string;
  fetchImpl?: FetchLike;
}

// llama.cpp's `llama-server` speaks the OpenAI-compatible surface at
// /v1/chat/completions (PE9', 2026-07-08 — the first-class local backend
// replacing Ollama; the provider seam in ../index.ts stays identical).
// One server hosts one loaded model, so `model` is passed through but the
// server's own id wins in the response.
export function llamaCppProvider(cfg: LlamaCppConfig = {}): Provider {
  const fetchImpl = cfg.fetchImpl ?? globalThis.fetch;
  const host = cfg.host
    ?? process.env.LLAMACPP_HOST
    ?? process.env.LLAMA_SERVER_URL
    ?? 'http://127.0.0.1:8080';
  const capabilities: Capabilities = {
    // tools: OpenAI-shaped `tools` + `tool_calls` (PE9/T8); the loop
    // executing them lives in ../index.ts (chatWithTools).
    chat: true, stream: true, tools: true, structured: true,
    webSearch: 'none', thinking: true, memory: false,
  };

  // Always stream (stream:true): a long generation over a non-streamed
  // request sends no bytes for minutes and trips undici's idle timeouts —
  // the exact failure the Ollama provider documents. chat() consumes the
  // same SSE with no handler; behavior is identical.
  async function run(
    messages: ChatMessage[], opts: ChatOptions = {}, onEvent?: StreamHandler,
  ): Promise<ChatResult> {
    if (opts.webSearch)
      throw new Error('llama-cpp: no native web search — pair it with an external SearchSource');
    const model = opts.model ?? cfg.defaultModel ?? 'local';
    // OpenAI message mapping incl. the tool-loop shapes: an assistant
    // message that requested calls carries `tool_calls` (arguments as a
    // JSON string), a role:'tool' message answers one call by id.
    const msgs = messages.map(m => {
      if (m.role === 'tool')
        return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId ?? '' };
      if (m.role === 'assistant' && m.toolCalls?.length)
        return {
          role: 'assistant' as const,
          content: m.content || null,
          tool_calls: m.toolCalls.map(c => ({
            id: c.id, type: 'function' as const,
            function: { name: c.name, arguments: JSON.stringify(c.arguments) },
          })),
        };
      return { role: m.role, content: m.content };
    });
    const body: Record<string, unknown> = {
      model,
      messages: opts.system ? [{ role: 'system', content: opts.system }, ...msgs] : msgs,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description ?? '', parameters: t.inputSchema },
      }));
    }
    // llama-server structured output: response_format with a json_schema
    // (constrained decoding via the GBNF the schema compiles to).
    if (opts.jsonSchema)
      body.response_format = { type: 'json_schema', json_schema: { name: 'response', schema: opts.jsonSchema, strict: true } };
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;

    const res = await fetchImpl(`${host}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 1_800_000),
    });
    if (!res.ok)
      throw new Error(`llama-cpp: HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);

    let text = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    let finish: string | undefined;
    let modelId: string | undefined;
    // Streamed tool calls arrive as partial deltas keyed by index — the id
    // and name land first, the JSON argument string accumulates after.
    const toolAcc = new Map<number, { id: string; name: string; args: string }>();
    const handleLine = (line: string) => {
      const t = line.trim();
      // OpenAI SSE: `data: {json}` frames, terminated by `data: [DONE]`.
      if (!t.startsWith('data:')) return;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      const j = JSON.parse(payload) as {
        choices?: Array<{ delta?: {
          content?: string; reasoning_content?: string; reasoning?: string;
          tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
        }; finish_reason?: string | null }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };
      const choice = j.choices?.[0];
      for (const tc of choice?.delta?.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        const acc = toolAcc.get(idx) ?? { id: '', name: '', args: '' };
        if (tc.id) acc.id = tc.id;
        if (tc.function?.name) acc.name = tc.function.name;
        if (tc.function?.arguments) acc.args += tc.function.arguments;
        toolAcc.set(idx, acc);
      }
      // Reasoning field name diverges across OpenAI-compatible servers:
      // llama.cpp emits `reasoning_content` (the PE9' target, with
      // --reasoning-format), ollama emits `reasoning` — verified live
      // 2026-07-08. Accept either so the provider is correct against both.
      const reasoning = choice?.delta?.reasoning_content ?? choice?.delta?.reasoning ?? '';
      if (reasoning && onEvent) onEvent({ type: 'thinking', delta: reasoning });
      const content = choice?.delta?.content ?? '';
      if (content) {
        text += content;
        onEvent?.({ type: 'content', delta: content });
      }
      if (choice?.finish_reason) finish = choice.finish_reason;
      if (j.usage) usage = j.usage;
      if (j.model) modelId = j.model;
    };

    if (res.body && onEvent) {
      // Incremental: emit deltas live as each SSE frame arrives.
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

    let toolCalls: ToolCall[] | undefined;
    if (toolAcc.size) {
      toolCalls = [...toolAcc.entries()]
        .sort(([a], [b]) => a - b)
        .map(([i, acc]) => {
          let args: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(acc.args || '{}') as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
              args = parsed as Record<string, unknown>;
          } catch {
            throw new Error(`llama-cpp: tool call ${acc.name || i} emitted unparseable arguments: ${acc.args.slice(0, 200)}`);
          }
          return { id: acc.id || `call_${i}`, name: acc.name, arguments: args };
        });
    }

    const result: ChatResult = {
      text,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
      },
      model: modelId ?? model,
      provider: 'llama-cpp',
      stopReason: finish,
      ...(toolCalls ? { toolCalls } : {}),
    };
    onEvent?.({ type: 'done', result });
    return result;
  }

  return {
    name: 'llama-cpp',
    capabilities,
    chat: (messages, opts) => run(messages, opts),
    chatStream: (messages, opts, onEvent) => run(messages, opts ?? {}, onEvent),
  };
}
