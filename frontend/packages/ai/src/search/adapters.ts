import type { FetchLike, SearchOptions, SearchResult, SearchSource } from '../types.ts';

// External search adapters (owner decision C3: interchangeable, not one
// blessed engine). Each is a thin HTTP client behind the same shape;
// a future adapter (e.g. duckduckgo, once a ToS-clean route exists)
// registers here without core changes.

function need(name: string, v: string | undefined): string {
  if (!v) throw new Error(`search: ${name} is not set`);
  return v;
}

async function getJson(
  fetchImpl: FetchLike, url: string, init: RequestInit, timeoutMs: number,
): Promise<unknown> {
  const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok)
    throw new Error(`search: HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export function braveSearch(fetchImpl: FetchLike = globalThis.fetch): SearchSource {
  return {
    name: 'brave',
    async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
      const key = need('BRAVE_API_KEY', process.env.BRAVE_API_KEY);
      const u = new URL('https://api.search.brave.com/res/v1/web/search');
      u.searchParams.set('q', query);
      u.searchParams.set('count', String(opts.count ?? 10));
      const data = await getJson(fetchImpl, u.toString(), {
        headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
      }, opts.timeoutMs ?? 30_000) as {
        web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
      };
      return (data.web?.results ?? []).map(r => ({
        title: r.title ?? '', url: r.url ?? '', snippet: r.description ?? '', published: r.age,
      }));
    },
  };
}

export function searxngSearch(fetchImpl: FetchLike = globalThis.fetch): SearchSource {
  return {
    name: 'searxng',
    async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
      const base = need('SEARXNG_URL', process.env.SEARXNG_URL).replace(/\/$/, '');
      const u = new URL(`${base}/search`);
      u.searchParams.set('q', query);
      u.searchParams.set('format', 'json');
      const data = await getJson(fetchImpl, u.toString(), {}, opts.timeoutMs ?? 30_000) as {
        results?: Array<{ title?: string; url?: string; content?: string; publishedDate?: string }>;
      };
      return (data.results ?? []).slice(0, opts.count ?? 10).map(r => ({
        title: r.title ?? '', url: r.url ?? '', snippet: r.content ?? '', published: r.publishedDate ?? undefined,
      }));
    },
  };
}

export function tavilySearch(fetchImpl: FetchLike = globalThis.fetch): SearchSource {
  return {
    name: 'tavily',
    async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
      const key = need('TAVILY_API_KEY', process.env.TAVILY_API_KEY);
      const data = await getJson(fetchImpl, 'https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, max_results: opts.count ?? 10 }),
      }, opts.timeoutMs ?? 30_000) as {
        results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
      };
      return (data.results ?? []).map(r => ({
        title: r.title ?? '', url: r.url ?? '', snippet: r.content ?? '', published: r.published_date,
      }));
    },
  };
}

export function perplexitySearch(fetchImpl: FetchLike = globalThis.fetch): SearchSource {
  return {
    name: 'perplexity',
    async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
      const key = need('PERPLEXITY_API_KEY', process.env.PERPLEXITY_API_KEY);
      const data = await getJson(fetchImpl, 'https://api.perplexity.ai/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, max_results: opts.count ?? 10 }),
      }, opts.timeoutMs ?? 30_000) as {
        results?: Array<{ title?: string; url?: string; snippet?: string; date?: string }>;
      };
      return (data.results ?? []).map(r => ({
        title: r.title ?? '', url: r.url ?? '', snippet: r.snippet ?? '', published: r.date,
      }));
    },
  };
}

export type SearchFactory = (fetchImpl?: FetchLike) => SearchSource;

export const SEARCH_ADAPTERS: Record<string, SearchFactory> = {
  brave: braveSearch,
  searxng: searxngSearch,
  tavily: tavilySearch,
  perplexity: perplexitySearch,
};

export function getSearchSource(name: string, fetchImpl?: FetchLike): SearchSource {
  const f = SEARCH_ADAPTERS[name];
  if (!f) throw new Error(
    `search: unknown source '${name}' (have: ${Object.keys(SEARCH_ADAPTERS).join(', ')})`);
  return f(fetchImpl);
}
