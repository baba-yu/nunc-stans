// T2 (Phase D): chatStream contract — thinking/content deltas, the
// capability-declared fallback, and the profile/verify run-log stamps.
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createAi } from '../src/index.ts';
import { mockProvider } from '../src/providers/mock.ts';
import { ollamaProvider } from '../src/providers/ollama.ts';
import { anthropicProvider } from '../src/providers/anthropic.ts';
import type { ChatResult, Provider, StreamEvent } from '../src/types.ts';

const tmp: string[] = [];
function tmpLog(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nunc-ai-'));
  tmp.push(d);
  return path.join(d, 'runs', 'ai-runs.jsonl');
}
afterEach(() => { for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

function collect(): { events: StreamEvent[]; on: (e: StreamEvent) => void } {
  const events: StreamEvent[] = [];
  return { events, on: e => events.push(e) };
}

/** A fetch that answers with `lines` streamed as separate body chunks. */
function chunkedFetch(lines: string[], expect?: (body: string) => void): typeof fetch {
  return (async (_url: unknown, init?: { body?: string }) => {
    expect?.(init?.body ?? '');
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of lines) controller.enqueue(encoder.encode(line));
        controller.close();
      },
    });
    return new Response(stream, { status: 200 });
  }) as typeof fetch;
}

describe('mock chatStream (scripted deltas)', () => {
  it('emits scripted thinking, chunked content, then done with the assembled result', async () => {
    const p = mockProvider({ reply: 'a scripted reply body', thinking: 'let me think about it' });
    const { events, on } = collect();
    const result = await p.chatStream!([{ role: 'user', content: 'q' }], {}, on);
    const kinds = events.map(e => e.type);
    expect(kinds[0]).toBe('thinking');
    expect(kinds).toContain('content');
    expect(kinds[kinds.length - 1]).toBe('done');
    const thinking = events.filter(e => e.type === 'thinking').map(e => (e as { delta: string }).delta).join('');
    expect(thinking).toBe('let me think about it');
    const content = events.filter(e => e.type === 'content').map(e => (e as { delta: string }).delta).join('');
    expect(content).toBe('a scripted reply body');
    expect(result.text).toBe('a scripted reply body');
    expect(p.capabilities.stream).toBe(true);
    expect(p.capabilities.thinking).toBe(true);
  });
});

describe('Ai.chatStream fallback for stream:false providers', () => {
  it('falls back to chat() and emits one final content delta + done', async () => {
    const noStream: Provider = {
      name: 'nostream',
      capabilities: {
        chat: true, stream: false, tools: false, structured: false,
        webSearch: 'none', thinking: false, memory: false,
      },
      async chat(): Promise<ChatResult> {
        return { text: 'whole reply at once', usage: { inputTokens: 1, outputTokens: 2 }, model: 'x', provider: 'nostream' };
      },
    };
    const ai = createAi({ runLogFile: tmpLog(), providers: { nostream: noStream } });
    const { events, on } = collect();
    const r = await ai.chatStream('nostream', [{ role: 'user', content: 'q' }], { caller: 't' }, on);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'content', delta: 'whole reply at once' });
    expect(events[1].type).toBe('done');
    expect(r.text).toBe('whole reply at once');
  });
});

describe('ollama chatStream (incremental NDJSON)', () => {
  it('parses split chunks into live thinking/content deltas and usage', async () => {
    const lines = [
      '{"message":{"thinking":"hmm "},"model":"qwen3.6:27b"}\n',
      '{"message":{"content":"Hel"',                       // chunk split mid-line
      ',"thinking":""},"model":"qwen3.6:27b"}\n{"message":{"content":"lo"},"model":"qwen3.6:27b"}\n',
      '{"message":{"content":""},"done":true,"done_reason":"stop","model":"qwen3.6:27b","prompt_eval_count":7,"eval_count":9}\n',
    ];
    const p = ollamaProvider({ fetchImpl: chunkedFetch(lines) });
    const { events, on } = collect();
    const r = await p.chatStream!([{ role: 'user', content: 'q' }], {}, on);
    expect(events.filter(e => e.type === 'thinking')).toHaveLength(1);
    const content = events.filter(e => e.type === 'content').map(e => (e as { delta: string }).delta);
    expect(content).toEqual(['Hel', 'lo']);
    expect(r.text).toBe('Hello');
    expect(r.usage).toEqual({ inputTokens: 7, outputTokens: 9 });
    expect(r.stopReason).toBe('stop');
  });

  it('chat() behavior is unchanged by the shared stream reader', async () => {
    const lines = [
      '{"message":{"content":"He"},"model":"m"}\n',
      '{"message":{"content":"y"},"done":true,"model":"m","prompt_eval_count":1,"eval_count":2}\n',
    ];
    const p = ollamaProvider({ fetchImpl: chunkedFetch(lines) });
    const r = await p.chat([{ role: 'user', content: 'q' }]);
    expect(r.text).toBe('Hey');
    expect(r.usage).toEqual({ inputTokens: 1, outputTokens: 2 });
  });
});

describe('anthropic chatStream (SSE)', () => {
  it('parses thinking_delta/text_delta and assembles usage from start+delta events', async () => {
    const sse = [
      'event: message_start\ndata: {"type":"message_start","message":{"model":"claude-sonnet-5","usage":{"input_tokens":11}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"pondering"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hi "}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"there"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];
    const p = anthropicProvider({
      apiKey: 'test-key',
      fetchImpl: chunkedFetch(sse, body => {
        expect(JSON.parse(body)).toMatchObject({ stream: true });
      }),
    });
    const { events, on } = collect();
    const r = await p.chatStream!([{ role: 'user', content: 'q' }], {}, on);
    expect(events[0]).toEqual({ type: 'thinking', delta: 'pondering' });
    expect(r.text).toBe('Hi there');
    expect(r.usage).toEqual({ inputTokens: 11, outputTokens: 5 });
    expect(r.model).toBe('claude-sonnet-5');
    expect(r.stopReason).toBe('end_turn');
  });
});

describe('run-log stamps (S-5 profile, §2.6 per-call verify)', () => {
  it('stamps the profile id on chat and chatStream entries', async () => {
    const log = tmpLog();
    const ai = createAi({ runLogFile: log, mock: { reply: 'ok' } });
    await ai.chat('mock', [{ role: 'user', content: 'a' }], { caller: 'c1', profile: 'prof-1' });
    await ai.chatStream('mock', [{ role: 'user', content: 'b' }], { caller: 'c2', profile: 'prof-2' }, () => {});
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(lines[0]).toMatchObject({ caller: 'c1', profile: 'prof-1' });
    expect(lines[1]).toMatchObject({ caller: 'c2', profile: 'prof-2' });
  });

  it('omits the profile key entirely when no profile is active', async () => {
    const log = tmpLog();
    const ai = createAi({ runLogFile: log, mock: { reply: 'ok' } });
    await ai.chat('mock', [{ role: 'user', content: 'a' }], { caller: 'c' });
    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect('profile' in entry).toBe(false);
  });

  it('per-call verify override is logged; defaults stay off', async () => {
    const log = tmpLog();
    const ai = createAi({ runLogFile: log, mock: { reply: 'ok' } });
    await ai.chat('mock', [{ role: 'user', content: 'a' }], { caller: 'on', verify: { verify: 'on', goal: 'g' } });
    await ai.chat('mock', [{ role: 'user', content: 'b' }], { caller: 'off' });
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(lines[0]).toMatchObject({ caller: 'on', verify: 'on' });
    expect(lines[1]).toMatchObject({ caller: 'off', verify: 'off' });
  });
});
