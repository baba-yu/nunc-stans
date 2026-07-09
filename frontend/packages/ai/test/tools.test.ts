import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAi } from '../src/index.ts';
import { llamaCppProvider } from '../src/providers/llamacpp.ts';
import { anthropicProvider } from '../src/providers/anthropic.ts';
import type {
  ChatMessage, ChatOptions, ChatResult, Provider, ToolCall, ToolSpec,
} from '../src/types.ts';

const TOOLS: ToolSpec[] = [
  { name: 'app_items_list', description: 'list items', inputSchema: { type: 'object', properties: {} } },
  { name: 'app_items_create', description: 'create item', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
];

const tmpLog = () => join(mkdtempSync(join(tmpdir(), 'ai-tools-')), 'runs.jsonl');

/** A provider scripted per call: each entry is either tool calls to
 * request or a final text. Records every message list it was given. */
function scriptedProvider(script: Array<ToolCall[] | string>): Provider & { seen: ChatMessage[][] } {
  const seen: ChatMessage[][] = [];
  return {
    name: 'scripted',
    capabilities: { chat: true, stream: false, tools: true, structured: false, webSearch: 'none', thinking: false, memory: false },
    seen,
    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
      void opts;
      seen.push(messages.map(m => ({ ...m })));
      const next = script.shift() ?? 'fell off the script';
      const base: ChatResult = {
        text: typeof next === 'string' ? next : '',
        usage: { inputTokens: 10, outputTokens: 5 },
        model: 'scripted-1', provider: 'scripted',
      };
      return typeof next === 'string' ? base : { ...base, toolCalls: next };
    },
  };
}

describe('chatWithTools (PE9/T8)', () => {
  it('executes requested tools, threads results back, aggregates the run log', async () => {
    const p = scriptedProvider([
      [{ id: 'c1', name: 'app_items_list', arguments: {} }],
      [{ id: 'c2', name: 'app_items_create', arguments: { name: 'x' } }],
      'done: one item named x',
    ]);
    const logFile = tmpLog();
    const ai = createAi({ runLogFile: logFile, providers: { scripted: p } });
    const executed: string[] = [];
    const result = await ai.chatWithTools('scripted', [{ role: 'user', content: 'go' }], {
      tools: TOOLS,
      caller: 'test', profile: 'agents-test',
      onToolCall: async (call) => { executed.push(call.name); return `ok:${call.name}`; },
    });
    expect(result.text).toBe('done: one item named x');
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 15 }); // 3 calls aggregated
    expect(executed).toEqual(['app_items_list', 'app_items_create']);
    // The second provider call saw the assistant tool request + the tool result.
    const second = p.seen[1];
    expect(second.at(-2)?.toolCalls?.[0]?.name).toBe('app_items_list');
    expect(second.at(-1)).toMatchObject({ role: 'tool', toolCallId: 'c1', content: 'ok:app_items_list' });
    // ONE log entry, with per-tool counts and the profile stamp.
    const entries = readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(entries).toHaveLength(1);
    expect(entries[0].toolCalls).toEqual([
      { name: 'app_items_list', count: 1 },
      { name: 'app_items_create', count: 1 },
    ]);
    expect(entries[0].profile).toBe('agents-test');
  });

  it('trips the budget: refusal results, then a final tool-less call', async () => {
    const always: Provider & { offers: (ToolSpec[] | undefined)[] } = {
      name: 'greedy',
      capabilities: { chat: true, stream: false, tools: true, structured: false, webSearch: 'none', thinking: false, memory: false },
      offers: [],
      async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
        this.offers.push(opts.tools);
        const base: ChatResult = { text: '', usage: { inputTokens: 1, outputTokens: 1 }, model: 'g', provider: 'greedy' };
        // Keep requesting while tools are on the table; answer once withdrawn.
        if (opts.tools?.length) return { ...base, toolCalls: [{ id: 'x', name: 'app_items_list', arguments: {} }] };
        return { ...base, text: 'forced answer' };
      },
    };
    const ai = createAi({ runLogFile: tmpLog(), providers: { greedy: always } });
    let executed = 0;
    const result = await ai.chatWithTools('greedy', [{ role: 'user', content: 'go' }], {
      tools: TOOLS, maxToolCalls: 3,
      onToolCall: async () => { executed += 1; return 'rows'; },
    });
    expect(result.text).toBe('forced answer');
    expect(executed).toBe(3); // the budget, exactly
    expect(always.offers.at(-1)).toBeUndefined(); // final call had tools withdrawn
  });

  it('refuses tools+verify in one call (v0 config error)', async () => {
    const ai = createAi({ runLogFile: tmpLog() });
    await expect(
      ai.chatWithTools('mock', [{ role: 'user', content: 'x' }], {
        tools: TOOLS, onToolCall: async () => '',
        verify: { verify: 'on', goal: 'g' },
      }),
    ).rejects.toThrow(/tools and goal-verify/);
  });

  it('runs the scripted mock end-to-end (the S-7 zero-token rehearsal path)', async () => {
    const ai = createAi({
      runLogFile: tmpLog(),
      mock: {
        reply: 'the list shows one deal',
        toolScript: [[{ id: 'm1', name: 'app_items_list', arguments: {} }]],
      },
    });
    const calls: string[] = [];
    const result = await ai.chatWithTools('mock', [{ role: 'user', content: 'list items' }], {
      tools: TOOLS,
      onToolCall: async (c) => { calls.push(c.name); return '[{"id":"1"}]'; },
    });
    expect(calls).toEqual(['app_items_list']);
    expect(result.text).toBe('the list shows one deal');
  });
});

describe('provider tool mappings', () => {
  it('llama-cpp sends OpenAI tools/messages and reassembles streamed tool_call deltas', async () => {
    let sentBody: any;
    const sse = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_9","function":{"name":"app_items_list","arguments":"{\\"arch"}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ived\\": true}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":7,"completion_tokens":3}}',
      'data: [DONE]', '',
    ].join('\n');
    const fetchImpl = (async (_url: any, init: any) => {
      sentBody = JSON.parse(init.body);
      return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }) as typeof fetch;
    const p = llamaCppProvider({ fetchImpl });
    const result = await p.chat(
      [
        { role: 'user', content: 'list' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'prev', name: 'app_items_list', arguments: {} }] },
        { role: 'tool', toolCallId: 'prev', content: '[]' },
      ],
      { tools: TOOLS },
    );
    expect(sentBody.tools).toHaveLength(2);
    expect(sentBody.tools[0]).toMatchObject({ type: 'function', function: { name: 'app_items_list' } });
    expect(sentBody.messages.at(-2)).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'prev' }] });
    expect(sentBody.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'prev', content: '[]' });
    expect(result.toolCalls).toEqual([
      { id: 'call_9', name: 'app_items_list', arguments: { archived: true } },
    ]);
  });

  it('anthropic-api sends input_schema tools and parses tool_use blocks', async () => {
    let sentBody: any;
    const fetchImpl = (async (_url: any, init: any) => {
      sentBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        content: [
          { type: 'text', text: 'let me check' },
          { type: 'tool_use', id: 'toolu_1', name: 'app_items_list', input: { archived: false } },
        ],
        usage: { input_tokens: 5, output_tokens: 2 },
        model: 'claude-sonnet-5', stop_reason: 'tool_use',
      }), { status: 200 });
    }) as typeof fetch;
    process.env.ANTHROPIC_API_KEY ??= 'test-key';
    const p = anthropicProvider({ fetchImpl });
    const result = await p.chat(
      [
        { role: 'user', content: 'list' },
        { role: 'assistant', content: 'checking', toolCalls: [{ id: 'toolu_0', name: 'app_items_list', arguments: {} }] },
        { role: 'tool', toolCallId: 'toolu_0', content: '[]' },
      ],
      { tools: TOOLS },
    );
    expect(sentBody.tools[0]).toMatchObject({ name: 'app_items_list', input_schema: { type: 'object' } });
    expect(sentBody.messages.at(-2).content).toMatchObject([
      { type: 'text', text: 'checking' },
      { type: 'tool_use', id: 'toolu_0', name: 'app_items_list' },
    ]);
    expect(sentBody.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_0' });
    expect(result.toolCalls).toEqual([
      { id: 'toolu_1', name: 'app_items_list', arguments: { archived: false } },
    ]);
    expect(result.stopReason).toBe('tool_use');
  });
});
