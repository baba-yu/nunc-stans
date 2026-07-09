// Intent-weighted topic search (topics-authoring W3): `watch` spends one
// query, `broad` a light deterministic multi-angle pass, and `deep` runs a
// goal-driven loop — the MODEL decides the next queries and judges
// coverage (structured JSON via the injected planner), but the SEARCH
// itself is deterministic code: the orchestrator executes every query
// through the adapter, dedups by URL, and stops on convergence (a round
// that surfaces no new domain and no new URL) or on the code-enforced
// guards. The model proposes; the stop is never left to it (risk 8).
// Pure of run-context concerns: search/planner/log arrive as deps, so the
// loop is unit-testable with zero live calls.
import type { Topic } from '../topics.ts';

export interface TopicSearchHit {
  title: string;
  url: string;
  snippet?: string;
}

export interface DeepPlan {
  queries: string[];
  goal_met: boolean;
  reason: string;
}

export interface TopicSearchDeps {
  /** One adapter query (rate limiting lives inside the dep). */
  search: (query: string) => Promise<TopicSearchHit[]>;
  /** The deep-search planner/judge (LLM, structured output — llmJson at
   * the call site). Receives the topic, its note, and a summary of what
   * the loop has already seen. */
  plan: (topic: Topic, round: number, seenSummary: string) => Promise<DeepPlan>;
  log: (s: string) => void;
}

// Code-enforced brakes for `deep` (W3/risk 8): the agent judges coverage,
// the orchestrator enforces termination.
export const DEEP_MAX_ROUNDS = 4;
export const DEEP_MAX_QUERIES = 12;

/** One round's audit record — written to search_plan.json (the capture
 * side of the capture/replay discipline; replay never re-searches). */
export interface TopicSearchRound {
  queries: string[];
  newUrls: number;
  newDomains: number;
  judgment?: { goal_met: boolean; reason: string };
}

export interface TopicSearchRecord {
  topic: string;
  intent: Topic['intent'];
  rounds: TopicSearchRound[];
  urls: string[];
  stopped: 'single' | 'angles' | 'goal-met' | 'converged' | 'budget';
}

/** Strip parentheticals for the query string, as the flat fan-out did. */
const queryBase = (t: Topic): string => t.name.replace(/\(.*?\)/g, '').trim();

const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function formatChunk(topic: Topic, hits: TopicSearchHit[]): string | null {
  if (!hits.length) return null;
  return `### ${topic.name}\n` + hits.map(r =>
    `- ${r.title} — ${r.url}\n  ${(r.snippet ?? '').slice(0, 300)}`).join('\n');
}

export async function searchTopic(
  topic: Topic, deps: TopicSearchDeps,
): Promise<{ chunk: string | null; record: TopicSearchRecord }> {
  const seenUrls = new Set<string>();
  const seenDomains = new Set<string>();
  const hits: TopicSearchHit[] = [];
  const rounds: TopicSearchRound[] = [];

  async function runRound(queries: string[]): Promise<TopicSearchRound> {
    const round: TopicSearchRound = { queries, newUrls: 0, newDomains: 0 };
    for (const q of queries) {
      let results: TopicSearchHit[] = [];
      try {
        results = await deps.search(q);
      } catch (e) {
        deps.log(`  search '${q}' failed: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
      }
      for (const r of results) {
        if (seenUrls.has(r.url)) continue;
        seenUrls.add(r.url);
        round.newUrls += 1;
        const d = domainOf(r.url);
        if (!seenDomains.has(d)) {
          seenDomains.add(d);
          round.newDomains += 1;
        }
        hits.push(r);
      }
    }
    rounds.push(round);
    return round;
  }

  const base = queryBase(topic);
  let stopped: TopicSearchRecord['stopped'];

  if (topic.intent === 'watch') {
    await runRound([`${base} AI news`]);
    stopped = 'single';
  } else if (topic.intent === 'broad') {
    // The light multi-angle pass: deterministic, no model in the loop.
    await runRound([`${base} AI news`, `${base} latest developments`]);
    stopped = 'angles';
  } else {
    // deep: plan → execute → judge, until the goal is met, the results
    // converge, or the code-enforced budget trips.
    stopped = 'budget';
    let spentQueries = 0;
    for (let round = 1; round <= DEEP_MAX_ROUNDS; round++) {
      const summary = hits.length
        ? hits.slice(-15).map(h => `- ${h.title} (${domainOf(h.url)})`).join('\n')
        : '(nothing found yet)';
      const plan = await deps.plan(topic, round, summary);
      const queries = plan.queries
        .map(q => q.trim()).filter(Boolean)
        .slice(0, Math.max(0, DEEP_MAX_QUERIES - spentQueries));
      if (plan.goal_met || queries.length === 0) {
        rounds.push({ queries: [], newUrls: 0, newDomains: 0, judgment: { goal_met: plan.goal_met, reason: plan.reason } });
        stopped = plan.goal_met ? 'goal-met' : 'budget';
        break;
      }
      spentQueries += queries.length;
      const r = await runRound(queries);
      r.judgment = { goal_met: plan.goal_met, reason: plan.reason };
      if (r.newUrls === 0 && r.newDomains === 0) {
        // Convergence: the world had nothing new for this topic today.
        stopped = 'converged';
        break;
      }
      if (spentQueries >= DEEP_MAX_QUERIES) {
        stopped = 'budget';
        break;
      }
    }
  }

  return {
    chunk: formatChunk(topic, hits),
    record: { topic: topic.name, intent: topic.intent, rounds, urls: [...seenUrls], stopped },
  };
}

/** Validator for the planner's structured output (llmJson `validate`). */
export function validateDeepPlan(raw: unknown): DeepPlan {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') throw new Error('deep-search plan must be a JSON object');
  if (!Array.isArray(o.queries) || o.queries.some(q => typeof q !== 'string'))
    throw new Error('deep-search plan needs queries: string[]');
  if (typeof o.goal_met !== 'boolean') throw new Error('deep-search plan needs goal_met: boolean');
  return {
    queries: (o.queries as string[]).slice(0, 6),
    goal_met: o.goal_met,
    reason: typeof o.reason === 'string' ? o.reason : '',
  };
}
