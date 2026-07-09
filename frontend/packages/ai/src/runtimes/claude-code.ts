import { spawnSync } from 'node:child_process';
import type {
  Capabilities, ChatMessage, ChatOptions, ChatResult, Provider,
} from '../types.ts';

// Agent runtime tier (§2.6): claude-code rides the subscription via the
// headless CLI — one fresh invocation per call (the old sub-agent shape).

export interface ExecResult { status: number | null; stdout: string; stderr: string }
export type ExecLike = (bin: string, args: string[], opts: { timeoutMs: number }) => ExecResult;

const defaultExec: ExecLike = (bin, args, opts) => {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: opts.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
  if (r.error && (r.error as NodeJS.ErrnoException).code === 'ENOENT')
    throw new Error(`claude-code: binary not found (${bin}) — install the Claude Code CLI in WSL or set NS_CLAUDE_BIN`);
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

export interface ClaudeCodeConfig {
  bin?: string;
  defaultModel?: string;
  exec?: ExecLike;
  retries?: number;
}

export function claudeCodeRuntime(cfg: ClaudeCodeConfig = {}): Provider {
  const exec = cfg.exec ?? defaultExec;
  const bin = cfg.bin ?? process.env.NS_CLAUDE_BIN ?? 'claude';
  const retries = cfg.retries ?? 1;
  const capabilities: Capabilities = {
    chat: true, stream: false, tools: true, structured: true,
    webSearch: 'native', thinking: true, memory: true,
  };
  return {
    name: 'claude-code',
    capabilities,
    async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
      // One prompt per invocation: system + conversation flattened.
      const prompt = [
        ...(opts.system ? [opts.system] : []),
        ...messages.map(m => (m.role === 'system' ? m.content : `${m.role}: ${m.content}`)),
      ].join('\n\n');
      const args = ['-p', prompt, '--output-format', 'json'];
      if (opts.model ?? cfg.defaultModel) args.push('--model', (opts.model ?? cfg.defaultModel)!);
      // Tools are opt-in per call; search steps get WebSearch + WebFetch.
      args.push('--allowedTools', opts.webSearch ? 'WebSearch,WebFetch' : '');

      const timeoutMs = opts.timeoutMs ?? 900_000;
      let last: ExecResult = { status: null, stdout: '', stderr: '' };
      for (let attempt = 0; attempt <= retries; attempt++) {
        last = exec(bin, args, { timeoutMs });
        if (last.status === 0) break;
      }
      if (last.status !== 0)
        throw new Error(`claude-code: exit ${last.status}: ${(last.stderr || last.stdout).slice(0, 500)}`);

      // -p --output-format json envelope: {type:"result", result, usage:{...}, ...}
      let text = last.stdout;
      let inputTokens = 0, outputTokens = 0, model = opts.model ?? cfg.defaultModel ?? 'claude-code';
      try {
        const env = JSON.parse(last.stdout) as {
          result?: string;
          usage?: { input_tokens?: number; output_tokens?: number };
          modelUsage?: Record<string, unknown>;
        };
        if (typeof env.result === 'string') text = env.result;
        inputTokens = env.usage?.input_tokens ?? 0;
        outputTokens = env.usage?.output_tokens ?? 0;
        const models = env.modelUsage ? Object.keys(env.modelUsage) : [];
        if (models.length) model = models[0];
      } catch { /* tolerate non-JSON output — treat stdout as the text */ }

      return {
        text,
        usage: { inputTokens, outputTokens },
        model,
        provider: 'claude-code',
      };
    },
  };
}
