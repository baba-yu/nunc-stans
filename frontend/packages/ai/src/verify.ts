import type {
  ChatMessage, ChatOptions, ChatResult, Provider, StreamHandler,
  VerdictEntry, VerifyConfig,
} from './types.ts';

/** Normalize a partial verify config. Off by default everywhere; per-call
 * overrides merge over the Ai-level defaults (§2.6). */
export function normalizeVerify(cfg?: Partial<VerifyConfig>): VerifyConfig {
  return {
    verify: cfg?.verify ?? 'off',
    goal: cfg?.goal,
    judge: cfg?.judge,
    maxIters: cfg?.maxIters ?? 2,
    tokenBudget: cfg?.tokenBudget,
  };
}

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    met: { type: 'boolean' },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['met', 'gaps'],
  additionalProperties: false,
} as const;

function judgeMessages(goal: string, answer: string): ChatMessage[] {
  return [{
    role: 'user',
    content: [
      'You are a strict goal judge. Decide whether the RESPONSE meets the GOAL.',
      'Answer ONLY with JSON: {"met": <boolean>, "gaps": [<unmet requirements, empty when met>]}.',
      '',
      `GOAL:\n${goal}`,
      '',
      `RESPONSE:\n${answer}`,
    ].join('\n'),
  }];
}

function parseVerdict(text: string): { met: boolean; gaps: string[] } {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const j = JSON.parse(stripped) as { met?: unknown; gaps?: unknown };
  return {
    met: Boolean(j.met),
    gaps: Array.isArray(j.gaps) ? j.gaps.map(String) : [],
  };
}

function feedbackTurns(goal: string, answer: string, gaps: string[]): ChatMessage[] {
  return [
    { role: 'assistant', content: answer },
    {
      role: 'user',
      content: [
        'Your previous response did not meet the goal.',
        `GOAL:\n${goal}`,
        'Unmet gaps:',
        ...gaps.map(g => `- ${g}`),
        'Revise your response to close every gap. Reply with the revised response only.',
      ].join('\n'),
    },
  ];
}

export interface VerifiedOutcome {
  result: ChatResult;
  verdicts: VerdictEntry[];
  /** Cumulative tokens across model + judge calls, all iterations. */
  totalIn: number;
  totalOut: number;
}

/** The §2.6 judge/retry loop (PD5). Calls the model (streaming when
 * `onEvent` is given — each iteration streams; per-iteration provider
 * `done` events are swallowed so exactly one final `done` reaches the
 * caller, emitted by Ai), judges the result against the goal, feeds the
 * gaps back, and retries while iterations < maxIters and the token
 * budget holds. A judge failure ends the loop honestly: the verdict
 * chain records the error as a gap and the last model answer is
 * returned. Every verdict carries that iteration's token cost. */
export async function runVerified(
  model: Provider,
  judge: Provider,
  messages: ChatMessage[],
  opts: ChatOptions,
  cfg: VerifyConfig,
  onEvent?: StreamHandler,
): Promise<VerifiedOutcome> {
  if (!cfg.goal) throw new Error('verify: goal is required when verify is on');
  const maxIters = Math.max(1, cfg.maxIters ?? 2);
  const verdicts: VerdictEntry[] = [];
  let convo = messages;
  let result: ChatResult | undefined;
  let totalIn = 0;
  let totalOut = 0;

  for (let iteration = 1; iteration <= maxIters; iteration++) {
    result = onEvent && model.chatStream
      ? await model.chatStream(convo, opts, e => { if (e.type !== 'done') onEvent(e); })
      : await model.chat(convo, opts);
    if (onEvent && !model.chatStream && result.text)
      onEvent({ type: 'content', delta: result.text });
    let iterIn = result.usage.inputTokens;
    let iterOut = result.usage.outputTokens;

    let verdict: { met: boolean; gaps: string[] };
    let judgeBroke = false;
    try {
      const judged = await judge.chat(judgeMessages(cfg.goal, result.text), {
        caller: `${opts.caller ?? 'unknown'}#judge`,
        model: cfg.judge?.model,
        jsonSchema: JUDGE_SCHEMA,
        timeoutMs: opts.timeoutMs,
      });
      iterIn += judged.usage.inputTokens;
      iterOut += judged.usage.outputTokens;
      verdict = parseVerdict(judged.text);
    } catch (err) {
      verdict = {
        met: false,
        gaps: [`judge error: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`],
      };
      judgeBroke = true;
    }

    totalIn += iterIn;
    totalOut += iterOut;
    verdicts.push({ met: verdict.met, gaps: verdict.gaps, tokensIn: iterIn, tokensOut: iterOut });
    onEvent?.({ type: 'verify', iteration, verdict, tokensIn: iterIn, tokensOut: iterOut });

    if (verdict.met || judgeBroke) break;
    if (cfg.tokenBudget && totalIn + totalOut >= cfg.tokenBudget) break; // hard brake (§5 note 6)
    if (iteration < maxIters) convo = [...convo, ...feedbackTurns(cfg.goal, result.text, verdict.gaps)];
  }

  return { result: result!, verdicts, totalIn, totalOut };
}
