// W10 (topics-authoring): accumulate the World's export-graph vocabulary
// into the instance glossary — the scheduled background step that keeps
// authoring's OFFLINE grounding rich without touching the authoring
// prompt. Terms land in data/reference/glossary.yml as `candidate`
// entries; the existing machinery takes it from there (initGlossarySeed
// inserts them on the next run, glossary-define fills them, validate
// gates them). Mechanical vocabulary distillation, never definitions —
// nothing here calls a model.
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { extractCandidates } from './glossary-extract.ts';
import { exportsDir, REFERENCE_REL } from '../world-paths.ts';
import { readInstanceStamp } from '../instance.ts';

const GRAPHS = ['graph-tech.json', 'graph-business.json', 'graph-mix.json'];
// A guard, surfaced in the result — never a silent truncation.
export const MAX_NEW_TERMS_PER_RUN = 20;

export interface AccumulateResult {
  added: string[];
  skippedExisting: number;
  /** Candidates beyond the per-run cap, left for the next run. */
  deferred: number;
}

function graphLabels(root: string): string[] {
  const labels: string[] = [];
  for (const g of GRAPHS) {
    const file = join(exportsDir(root), g);
    if (!existsSync(file)) continue;
    try {
      const data = JSON.parse(readFileSync(file, 'utf8')) as {
        nodes?: Array<{ label?: string; short_label?: string }>;
      };
      for (const n of data.nodes ?? []) {
        if (n.label) labels.push(n.label);
        if (n.short_label) labels.push(n.short_label);
      }
    } catch {
      /* a malformed export is the exporter's problem, not this step's */
    }
  }
  return labels;
}

function existingGlossaryTerms(root: string): Set<string> {
  const file = join(root, ...REFERENCE_REL.split('/'), 'glossary.yml');
  const existing = new Set<string>();
  if (!existsSync(file)) return existing;
  const data = (parseYaml(readFileSync(file, 'utf8')) ?? {}) as {
    terms?: Array<{ term?: string; aliases?: string[] | null }>;
  };
  for (const t of data.terms ?? []) {
    if (t.term) existing.add(t.term.toLowerCase());
    for (const a of t.aliases ?? []) existing.add(a.toLowerCase());
  }
  return existing;
}

/**
 * Distill export-graph vocabulary into the instance glossary. Refuses a
 * non-instance target (the write goes into data/reference/ — view
 * sources and news-shaped checkouts are never written, W7's rule).
 */
export function accumulateGlossary(root: string): AccumulateResult {
  if (readInstanceStamp(root) === null)
    throw new Error(`${root} is not an init-born instance (no instance.json) — `
      + 'glossary accumulation writes the instance reference tree and refuses anything else');

  const labels = graphLabels(root);
  const counts = extractCandidates(labels.join('\n'));
  const existing = existingGlossaryTerms(root);

  const fresh = [...counts.entries()]
    .filter(([term]) => !existing.has(term.toLowerCase()))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term);

  const added = fresh.slice(0, MAX_NEW_TERMS_PER_RUN);
  if (added.length) {
    const file = join(root, ...REFERENCE_REL.split('/'), 'glossary.yml');
    // Textual append keeps the user's own entries (and their comments)
    // byte-untouched — a yaml re-serialize would eat them.
    const lines = added.map(t =>
      `  - term: ${JSON.stringify(t)}\n    status: candidate\n    reviewed_by_human: false\n`).join('');
    appendFileSync(file, lines);
  }
  return {
    added,
    skippedExisting: counts.size - fresh.length,
    deferred: fresh.length - added.length,
  };
}
