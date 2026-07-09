// W10: export-graph vocabulary accumulates into the instance glossary as
// candidate entries — textual append (the user's own yaml stays
// byte-untouched), dedup against terms AND aliases, per-run cap surfaced,
// non-instances refused (the write goes into the reference tree).
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { accumulateGlossary, MAX_NEW_TERMS_PER_RUN } from '../src/ingest/glossary-accumulate.ts';

function makeInstance(): string {
  const root = mkdtempSync(join(tmpdir(), 'nf-accum-'));
  mkdirSync(join(root, 'data', 'reference'), { recursive: true });
  mkdirSync(join(root, 'data', 'exports'), { recursive: true });
  writeFileSync(join(root, 'instance.json'), JSON.stringify({ nunc_fluens: 1, created: '2026-07-08', imports: [] }));
  writeFileSync(join(root, 'data', 'reference', 'glossary.yml'),
    '# user comment that must survive byte-for-byte\n'
    + 'terms:\n'
    + '  - term: KnownTerm\n'
    + '    aliases: [KTM]\n'
    + '    status: active\n');
  return root;
}

function writeGraph(root: string, name: string, labels: string[]): void {
  writeFileSync(join(root, 'data', 'exports', name), JSON.stringify({
    nodes: labels.map((label, i) => ({ id: `n${i}`, label })),
  }));
}

describe('accumulateGlossary (W10)', () => {
  it('appends new vocabulary as candidates, keeping the existing yaml bytes', () => {
    const root = makeInstance();
    const before = readFileSync(join(root, 'data', 'reference', 'glossary.yml'), 'utf8');
    // Repeated across graphs so the extractor's counts rank them.
    writeGraph(root, 'graph-tech.json', ['LlamaEdge', 'KnownTerm', 'LlamaEdge']);
    writeGraph(root, 'graph-mix.json', ['LlamaEdge', 'KTM']);
    const r = accumulateGlossary(root);
    expect(r.added).toEqual(['LlamaEdge']); // KnownTerm + alias KTM deduped
    expect(r.skippedExisting).toBeGreaterThan(0);
    const after = readFileSync(join(root, 'data', 'reference', 'glossary.yml'), 'utf8');
    expect(after.startsWith(before)).toBe(true); // textual append only
    const parsed = parseYaml(after) as { terms: Array<{ term: string; status?: string }> };
    expect(parsed.terms.find(t => t.term === 'LlamaEdge')).toMatchObject({ status: 'candidate' });
    // Idempotent: a second run adds nothing.
    expect(accumulateGlossary(root).added).toEqual([]);
  });

  it('caps a flood of new terms and reports the deferral', () => {
    const root = makeInstance();
    const labels = Array.from({ length: 30 }, (_, i) => `NovelTerm${String(i).padStart(2, '0')}`);
    writeGraph(root, 'graph-tech.json', labels);
    const r = accumulateGlossary(root);
    expect(r.added).toHaveLength(MAX_NEW_TERMS_PER_RUN);
    expect(r.deferred).toBe(labels.length - MAX_NEW_TERMS_PER_RUN);
  });

  it('refuses a non-instance target (W7: never write a view source)', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-accum-noinst-'));
    expect(() => accumulateGlossary(root)).toThrow(/not an init-born instance/);
  });

  it('no exports yet = a clean zero, not an error', () => {
    const root = makeInstance();
    const r = accumulateGlossary(root);
    expect(r.added).toEqual([]);
  });
});
