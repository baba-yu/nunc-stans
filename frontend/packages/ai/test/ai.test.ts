import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createAi } from '../src/index.ts';
import type { ChatResult, Provider } from '../src/index.ts';

const tmp: string[] = [];
function tmpLog(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nunc-ai-'));
  tmp.push(d);
  return path.join(d, 'runs', 'ai-runs.jsonl');
}
afterEach(() => { for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe('createAi + mock provider + run log', () => {
  it('returns the mock reply and appends one ok entry', async () => {
    const log = tmpLog();
    const ai = createAi({ runLogFile: log, mock: { byCaller: { 'step-x': 'canned' } } });
    const r = await ai.chat('mock', [{ role: 'user', content: 'hi' }], { caller: 'step-x' });
    expect(r.text).toBe('canned');
    expect(r.provider).toBe('mock');
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ caller: 'step-x', provider: 'mock', outcome: 'ok', verify: 'off' });
    // The mock reports no finish reason — the key must be absent, not ''.
    expect(lines[0]).not.toHaveProperty('stopReason');
  });

  it('records the provider stopReason in the run-log row', async () => {
    const log = tmpLog();
    const truncating: Provider = {
      name: 'trunc',
      capabilities: {
        chat: true, stream: false, tools: false, structured: false,
        webSearch: 'none', thinking: false, memory: false,
      },
      async chat(): Promise<ChatResult> {
        return {
          text: '{"partial":', usage: { inputTokens: 5, outputTokens: 7 },
          model: 'm', provider: 'trunc', stopReason: 'length',
        };
      },
    };
    const ai = createAi({ runLogFile: log, providers: { trunc: truncating } });
    await ai.chat('trunc', [{ role: 'user', content: 'x' }], { caller: 'step-y' });
    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect(entry).toMatchObject({ caller: 'step-y', outcome: 'ok', stopReason: 'length' });
  });

  it('logs an error entry and rethrows for the forbid provider', async () => {
    const log = tmpLog();
    const ai = createAi({ runLogFile: log });
    await expect(ai.chat('forbid', [{ role: 'user', content: 'x' }], { caller: 'replay' }))
      .rejects.toThrow(/forbid/);
    const entry = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    expect(entry).toMatchObject({ caller: 'replay', outcome: 'error' });
  });

  it('rejects unknown providers with the available list', async () => {
    const ai = createAi({ runLogFile: tmpLog() });
    expect(() => ai.provider('nope')).toThrow(/unknown provider 'nope'.*mock/);
  });
});
