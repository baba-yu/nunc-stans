// W3: the intent-weighted search — watch/broad deterministic counts, the
// deep plan/judge loop with dedup, convergence, and the code-enforced
// budget. All deps scripted: zero live searches, zero live tokens.
import { describe, expect, it } from 'vitest';
import {
  DEEP_MAX_QUERIES, DEEP_MAX_ROUNDS, searchTopic, validateDeepPlan,
} from '../src/orchestrator/topic-search.ts';
import type { DeepPlan, TopicSearchDeps, TopicSearchHit } from '../src/orchestrator/topic-search.ts';
import type { Topic } from '../src/topics.ts';

const topic = (intent: Topic['intent'], name = 'Agent Harness (OpenClaw, etc.)'): Topic =>
  ({ name, intent, mandatory: false });

function deps(over: Partial<TopicSearchDeps> & { hitsFor?: (q: string) => TopicSearchHit[] } = {}) {
  const queries: string[] = [];
  const planCalls: number[] = [];
  const d: TopicSearchDeps & { queries: string[]; planCalls: number[] } = {
    queries, planCalls,
    search: async (q) => {
      queries.push(q);
      return over.hitsFor?.(q) ?? [{ title: `hit for ${q}`, url: `https://ex.com/${queries.length}`, snippet: 's' }];
    },
    plan: async (_t, round) => {
      planCalls.push(round);
      return { queries: [], goal_met: true, reason: 'default met' };
    },
    log: () => {},
    ...(over.search ? { search: over.search } : {}),
    ...(over.plan ? { plan: over.plan } : {}),
  };
  return d;
}

describe('searchTopic intent weights (W3)', () => {
  it('watch spends exactly one query, no planner', async () => {
    const d = deps();
    const { record, chunk } = await searchTopic(topic('watch'), d);
    expect(d.queries).toEqual(['Agent Harness AI news']); // parenthetical stripped
    expect(d.planCalls).toEqual([]);
    expect(record.stopped).toBe('single');
    expect(chunk).toContain('### Agent Harness (OpenClaw, etc.)'); // full name in the block
  });

  it('broad runs the deterministic multi-angle pair, no planner', async () => {
    const d = deps();
    const { record } = await searchTopic(topic('broad'), d);
    expect(d.queries).toEqual(['Agent Harness AI news', 'Agent Harness latest developments']);
    expect(d.planCalls).toEqual([]);
    expect(record.stopped).toBe('angles');
  });

  it('deep loops plan→execute→judge and stops when the model judges met', async () => {
    const plans: DeepPlan[] = [
      { queries: ['q1', 'q2'], goal_met: false, reason: 'opening angles' },
      { queries: ['q3'], goal_met: true, reason: 'covered' },
    ];
    const d = deps({ plan: async () => plans.shift()! });
    const { record } = await searchTopic(topic('deep'), d);
    expect(d.queries).toEqual(['q1', 'q2']); // round-2 judged met BEFORE searching q3
    expect(record.stopped).toBe('goal-met');
    expect(record.rounds.at(-1)?.judgment).toMatchObject({ goal_met: true });
  });

  it('deep stops on convergence: a round with nothing new ends the loop', async () => {
    let round = 0;
    const d = deps({
      plan: async () => ({ queries: [`q${++round}`], goal_met: false, reason: 'more' }),
      // Every query returns the SAME url — round 2 adds nothing new.
      hitsFor: () => [{ title: 't', url: 'https://same.com/one' }],
    });
    const { record } = await searchTopic(topic('deep'), d);
    expect(record.stopped).toBe('converged');
    expect(record.urls).toEqual(['https://same.com/one']);
    expect(record.rounds.filter(r => r.queries.length)).toHaveLength(2); // round 2 converged
  });

  it('deep trips the code-enforced budget even when the model never says met', async () => {
    let n = 0;
    const d = deps({
      plan: async () => ({
        queries: ['a', 'b', 'c', 'd'].map(x => `${x}${n++}`), goal_met: false, reason: 'never enough',
      }),
      hitsFor: (q) => [{ title: q, url: `https://${q}.example.com/` }], // always new
    });
    const { record } = await searchTopic(topic('deep'), d);
    expect(record.stopped).toBe('budget');
    expect(d.queries.length).toBeLessThanOrEqual(DEEP_MAX_QUERIES);
    expect(record.rounds.length).toBeLessThanOrEqual(DEEP_MAX_ROUNDS + 1);
  });

  it('dedups repeated urls across rounds and keeps a per-round audit', async () => {
    const plans: DeepPlan[] = [
      { queries: ['first'], goal_met: false, reason: 'r1' },
      { queries: ['second'], goal_met: false, reason: 'r2' },
    ];
    const d = deps({
      plan: async () => plans.shift() ?? { queries: [], goal_met: true, reason: 'end' },
      hitsFor: (q) => [
        { title: 'shared', url: 'https://shared.com/x' },
        { title: q, url: `https://uniq.com/${q}` },
      ],
    });
    const { record } = await searchTopic(topic('deep'), d);
    expect(record.urls).toHaveLength(3); // shared counted once
    expect(record.rounds[0]).toMatchObject({ newUrls: 2 });
    expect(record.rounds[1]).toMatchObject({ newUrls: 1, newDomains: 0 });
  });

  it('a failing query is logged and skipped, never fatal', async () => {
    const d = deps({
      search: async (q) => {
        if (q.endsWith('AI news')) throw new Error('rate limited');
        return [{ title: 'ok', url: 'https://ok.com/' }];
      },
    });
    const { record } = await searchTopic(topic('broad'), d);
    expect(record.urls).toEqual(['https://ok.com/']);
  });
});

describe('validateDeepPlan', () => {
  it('accepts the schema and caps queries', () => {
    const p = validateDeepPlan({ queries: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], goal_met: false });
    expect(p.queries).toHaveLength(6);
    expect(p.reason).toBe('');
  });
  it('refuses malformed plans', () => {
    for (const bad of [null, {}, { queries: 'x', goal_met: true }, { queries: [], goal_met: 'yes' }]) {
      expect(() => validateDeepPlan(bad)).toThrow();
    }
  });
});
