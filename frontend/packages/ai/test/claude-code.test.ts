import { describe, expect, it } from 'vitest';
import { claudeCodeRuntime, type ExecResult } from '../src/runtimes/claude-code.ts';

function capturingExec(replies: ExecResult[]) {
  const calls: { bin: string; args: string[] }[] = [];
  return {
    calls,
    exec: (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return replies[Math.min(calls.length - 1, replies.length - 1)];
    },
  };
}

const okEnvelope: ExecResult = {
  status: 0,
  stdout: JSON.stringify({
    type: 'result', result: 'hello',
    usage: { input_tokens: 11, output_tokens: 7 },
    modelUsage: { 'claude-sonnet-5': {} },
  }),
  stderr: '',
};

describe('claude-code runtime', () => {
  it('builds headless args and parses the JSON envelope', async () => {
    const { calls, exec } = capturingExec([okEnvelope]);
    const rt = claudeCodeRuntime({ exec, bin: 'claude-test' });
    const r = await rt.chat([{ role: 'user', content: 'ping' }], { caller: 's', webSearch: true });
    expect(r.text).toBe('hello');
    expect(r.usage).toEqual({ inputTokens: 11, outputTokens: 7 });
    expect(r.model).toBe('claude-sonnet-5');
    const args = calls[0].args;
    expect(calls[0].bin).toBe('claude-test');
    expect(args[0]).toBe('-p');
    expect(args).toContain('--output-format');
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('WebSearch,WebFetch');
  });

  it('disables tools when webSearch is off and retries once on failure', async () => {
    const { calls, exec } = capturingExec([
      { status: 1, stdout: '', stderr: 'transient' },
      okEnvelope,
    ]);
    const rt = claudeCodeRuntime({ exec });
    const r = await rt.chat([{ role: 'user', content: 'x' }]);
    expect(r.text).toBe('hello');
    expect(calls).toHaveLength(2);
    expect(calls[0].args[calls[0].args.indexOf('--allowedTools') + 1]).toBe('');
  });

  it('surfaces stderr after retries are exhausted', async () => {
    const { exec } = capturingExec([{ status: 2, stdout: '', stderr: 'auth missing' }]);
    const rt = claudeCodeRuntime({ exec, retries: 1 });
    await expect(rt.chat([{ role: 'user', content: 'x' }]))
      .rejects.toThrow(/exit 2.*auth missing/s);
  });

  it('tolerates plain-text output from older CLIs', async () => {
    const { exec } = capturingExec([{ status: 0, stdout: 'raw text', stderr: '' }]);
    const rt = claudeCodeRuntime({ exec });
    const r = await rt.chat([{ role: 'user', content: 'x' }]);
    expect(r.text).toBe('raw text');
  });
});
