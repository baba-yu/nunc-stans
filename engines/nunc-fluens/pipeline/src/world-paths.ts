// Single home for the news-checkout (remnant) directory names and the
// locale set. Post-C refactoring backlog (phase plan): report/ becomes
// daily-news/ under data/, docs/ stops being the dashboard root, and the
// locale set becomes en + an owner-configured list — each of those should
// be one edit here plus a `git mv` and a deliberate prose/link sweep
// (prose, prompts-as-published-text, and generated markdown keep their
// literals on purpose; only path *construction* routes through here).
import { join } from 'node:path';

export const REPORT_DIR = 'report';
export const FP_DIR = 'future-prediction';
export const MEMORY_DIR = 'memory';
export const REFERENCE_DIR = 'reference';
export const REFERENCES_TXT = 'references.txt';
export const DOCS_DIR = 'docs';

/** The dashboard's data exports (graph-*.json, manifest, snapshots). */
export const docsDataDir = (repoRoot: string) => join(repoRoot, DOCS_DIR, 'data');

// The four rendered locales. Hardcoded upstream and therefore hardcoded
// in the port (behavior changes are out of port scope); the post-C locale
// model replaces this with en + config.
export const LOCALES = ['en', 'ja', 'es', 'fil'] as const;
export const NON_EN_LOCALES = ['ja', 'es', 'fil'] as const;
export type Locale = (typeof LOCALES)[number];
