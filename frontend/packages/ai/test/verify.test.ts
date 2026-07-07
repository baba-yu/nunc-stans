// T3 (Phase D): the §2.6 goal-verify loop — scripted judge, hard caps,
// verdict chain in the run log, and streamed boundary events (PD5).
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createAi } from '../src/index.ts';
import type { ChatMessage, ChatOptions, ChatResult, Provider, StreamEvent } from '../src/types.ts';

const tmp: string[] = [];
function tmpLog(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nunc-ai-'));
  tmp.push(d);
  return path.join(d, 'runs', 'ai-runs.jsonl');
}
afterEach(() => { for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

/** A scripted judge: returns the queued verdicts in order. */
function scriptedJudge(verdicts: Array<{ met: boolean; gaps: string[] }>): Provider {
  let i = 0;
  return {
    name: 'scripted-judge',
    capabilities: {
      chat: true, stream: false, tools: false, structured: true,
      webSearch: 'none', thinking: false, memory: false,
    },
    async chat(): Promise<ChatResult> {
      const v = verdicts[Math.min(i++, verdicts.length - 1)];
      return {
        text: JSON.stringify(v),
        usage: { inputTokens: 10, outputTokens: 5 },
        model: 'judge', provider: 'scripted-judge',
      };
    },
  };
}

/** A model that records the conversations it was given. */
function recordingModel(replies: string[], tokens = { inputTokens: 100, outputTokens: 50 }): Provider & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  return {
    name: 'rec', calls,
    capabilities: {
      chat: true, stream: false, tools: false, structured: false,
      webSearch: 'none', thinking: false, memory: false,
    },
    async chat(messages: ChatMessage[], _opts?: ChatOptions): Promise<ChatResult> {
      calls.push(messages);
      return {
        text: replies[Math.min(calls.length - 1, replies.length - 1)],
        usage: { ...tokens }, model: 'rec-model', provider: 'rec',
      };
    },
  };
}

function ai(log: string, model: Provider, judge: Provider) {
  return createAi({ runLogFile: log, providers: { rec: model, 'scripted-judge': judge } });
}

const VERIFY = { verify: 'on' as const, goal: 'answer in exactly zero words', judge: { provider: 'scripted-judge' } };

describe('goal-verify loop (§2.6 / PD5)', () => {
  it('stops at maxIters on a never-met goal, feeds gaps back, logs the chain', async () => {
    const log = tmpLog();
    const model = recordingModel(['first answer', 'second answer']);
    const judge = scriptedJudge([{ met: false, gaps: ['still has words'] }]);
    const a = ai(log, model, judge);

    const r = await a.chat('rec', [{ role: 'user', content: 'q' }], { caller: 's6', verify: VERIFY });
    expect(r.text).toBe('second answer');       // last attempt returned
    expect(model.calls).toHaveLength(2);        // maxIters default 2
    // the retry conversation carried the goal + gap feedback
    const retry = model.calls[1].map(m => m.content).join('\n');
    expect(retry).toMatch(/did not meet the goal/);
    expect(retry).toMatch(/still has words/);

    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect(entry).toMatchObject({ caller: 's6', verify: 'on', outcome: 'ok' });
    expect(entry.verdicts).toHaveLength(2);
    expect(entry.verdicts[0]).toMatchObject({ met: false, gaps: ['still has words'] });
    // per-iteration tokens = model + judge
    expect(entry.verdicts[0].tokensIn).toBe(110);
    expect(entry.verdicts[0].tokensOut).toBe(55);
    // entry totals aggregate the whole loop
    expect(entry.inputTokens).toBe(220);
    expect(entry.outputTokens).toBe(110);
  });

  it('stops early when the goal is met', async () => {
    const log = tmpLog();
    const model = recordingModel(['first', 'never used']);
    const judge = scriptedJudge([{ met: true, gaps: [] }]);
    const a = ai(log, model, judge);
    const r = await a.chat('rec', [{ role: 'user', content: 'q' }], { caller: 'c', verify: { ...VERIFY, maxIters: 5 } });
    expect(r.text).toBe('first');
    expect(model.calls).toHaveLength(1);
    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect(entry.verdicts).toHaveLength(1);
    expect(entry.verdicts[0].met).toBe(true);
  });

  it('aborts on the token budget before exhausting maxIters', async () => {
    const log = tmpLog();
    const model = recordingModel(['a', 'b', 'c'], { inputTokens: 1000, outputTokens: 500 });
    const judge = scriptedJudge([{ met: false, gaps: ['no'] }]);
    const a = ai(log, model, judge);
    await a.chat('rec', [{ role: 'user', content: 'q' }], {
      caller: 'budget', verify: { ...VERIFY, maxIters: 5, tokenBudget: 2000 },
    });
    // first iteration already spends 1515 >= would-exceed on second: loop
    // brakes after iteration 1's verdict (1515 < 2000? no: 1000+500+10+5
    // = 1515 < 2000 → continues; iteration 2 → 3030 >= 2000 → stops)
    expect(model.calls).toHaveLength(2);
    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect(entry.verdicts).toHaveLength(2);
  });

  it('verify on without a goal is a config error', async () => {
    const log = tmpLog();
    const a = createAi({ runLogFile: log, mock: { reply: 'x' } });
    await expect(a.chat('mock', [{ role: 'user', content: 'q' }], { verify: { verify: 'on' } }))
      .rejects.toThrow(/goal is required/);
  });

  it('a broken judge ends the loop honestly: gap recorded, answer returned', async () => {
    const log = tmpLog();
    const model = recordingModel(['answer']);
    const judge: Provider = {
      name: 'scripted-judge',
      capabilities: {
        chat: true, stream: false, tools: false, structured: false,
        webSearch: 'none', thinking: false, memory: false,
      },
      async chat(): Promise<ChatResult> { throw new Error('judge down'); },
    };
    const a = ai(log, model, judge);
    const r = await a.chat('rec', [{ role: 'user', content: 'q' }], { caller: 'jd', verify: VERIFY });
    expect(r.text).toBe('answer');
    expect(model.calls).toHaveLength(1); // no blind retries without a verdict
    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect(entry.verdicts[0].met).toBe(false);
    expect(entry.verdicts[0].gaps[0]).toMatch(/judge error: judge down/);
  });

  it('streams each iteration with verify boundary events and exactly one done (PD5)', async () => {
    const log = tmpLog();
    const model = recordingModel(['first answer', 'second answer']);
    const judge = scriptedJudge([{ met: false, gaps: ['g1'] }, { met: true, gaps: [] }]);
    const a = ai(log, model, judge);
    const events: StreamEvent[] = [];
    const r = await a.chatStream('rec', [{ role: 'user', content: 'q' }], { caller: 's', verify: { ...VERIFY, maxIters: 3 } }, e => events.push(e));
    expect(r.text).toBe('second answer');
    const kinds = events.map(e => e.type);
    // content (iter 1) → verify → content (iter 2) → verify → done
    expect(kinds).toEqual(['content', 'verify', 'content', 'verify', 'done']);
    const boundaries = events.filter(e => e.type === 'verify') as Array<Extract<StreamEvent, { type: 'verify' }>>;
    expect(boundaries[0]).toMatchObject({ iteration: 1, verdict: { met: false, gaps: ['g1'] } });
    expect(boundaries[1]).toMatchObject({ iteration: 2, verdict: { met: true } });
    expect(kinds.filter(k => k === 'done')).toHaveLength(1);
  });

  it('default stays off: no verdicts key, single call', async () => {
    const log = tmpLog();
    const model = recordingModel(['plain']);
    const a = ai(log, model, scriptedJudge([{ met: false, gaps: ['x'] }]));
    await a.chat('rec', [{ role: 'user', content: 'q' }], { caller: 'off' });
    expect(model.calls).toHaveLength(1);
    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect(entry.verify).toBe('off');
    expect('verdicts' in entry).toBe(false);
  });

  it('judge output wrapped in a code fence still parses', async () => {
    const log = tmpLog();
    const model = recordingModel(['x']);
    const judge: Provider = {
      ...scriptedJudge([]),
      async chat(): Promise<ChatResult> {
        return {
          text: '```json\n{"met": true, "gaps": []}\n```',
          usage: { inputTokens: 1, outputTokens: 1 }, model: 'j', provider: 'scripted-judge',
        };
      },
    };
    const a = ai(log, model, judge);
    await a.chat('rec', [{ role: 'user', content: 'q' }], { caller: 'fence', verify: VERIFY });
    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect(entry.verdicts[0].met).toBe(true);
  });
});
