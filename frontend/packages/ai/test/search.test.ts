import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSearchSource, SEARCH_ADAPTERS } from '../src/search/adapters.ts';
import type { FetchLike } from '../src/types.ts';

function fakeFetch(payload: unknown, capture: { url?: string; init?: RequestInit } = {}): FetchLike {
  return (async (url: unknown, init?: RequestInit) => {
    capture.url = String(url);
    capture.init = init;
    return new Response(JSON.stringify(payload), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }) as FetchLike;
}

const KEYS = ['BRAVE_API_KEY', 'TAVILY_API_KEY', 'PERPLEXITY_API_KEY', 'SEARXNG_URL'];
const saved: Record<string, string | undefined> = {};
beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; process.env[k] = k === 'SEARXNG_URL' ? 'http://x.local' : 'test-key'; } });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe('search adapters', () => {
  it('registry knows all four adapters', () => {
    expect(Object.keys(SEARCH_ADAPTERS).sort()).toEqual(['brave', 'perplexity', 'searxng', 'tavily']);
    expect(() => getSearchSource('duckduckgo')).toThrow(/unknown source/);
  });

  it('brave maps web.results and sends the token header', async () => {
    const cap: { url?: string; init?: RequestInit } = {};
    const src = getSearchSource('brave', fakeFetch({
      web: { results: [{ title: 't', url: 'https://u', description: 'd', age: '2d' }] },
    }, cap));
    const out = await src.search('q', { count: 3 });
    expect(out).toEqual([{ title: 't', url: 'https://u', snippet: 'd', published: '2d' }]);
    expect(cap.url).toContain('count=3');
    expect((cap.init?.headers as Record<string, string>)['X-Subscription-Token']).toBe('test-key');
  });

  it('searxng maps results from the configured instance', async () => {
    const cap: { url?: string } = {};
    const src = getSearchSource('searxng', fakeFetch({
      results: [{ title: 't', url: 'https://u', content: 'c' }],
    }, cap));
    const out = await src.search('q');
    expect(out[0]).toMatchObject({ title: 't', snippet: 'c' });
    expect(cap.url).toContain('http://x.local/search?');
    expect(cap.url).toContain('format=json');
  });

  it('tavily and perplexity POST with bearer auth and map results', async () => {
    for (const name of ['tavily', 'perplexity'] as const) {
      const cap: { url?: string; init?: RequestInit } = {};
      const payload = name === 'tavily'
        ? { results: [{ title: 't', url: 'https://u', content: 'c' }] }
        : { results: [{ title: 't', url: 'https://u', snippet: 'c' }] };
      const out = await getSearchSource(name, fakeFetch(payload, cap)).search('q');
      expect(out[0]).toMatchObject({ title: 't', url: 'https://u', snippet: 'c' });
      expect(cap.init?.method).toBe('POST');
      expect((cap.init?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    }
  });

  it('missing key errors name the variable', async () => {
    delete process.env.BRAVE_API_KEY;
    await expect(getSearchSource('brave', fakeFetch({})).search('q'))
      .rejects.toThrow(/BRAVE_API_KEY/);
  });
});
