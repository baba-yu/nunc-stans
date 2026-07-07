// Single home for the data-checkout (instance) directory names and the
// locale set. Post-C: the product's own layout puts the publish quartet
// and the exports under data/ (report/ became data/daily-news/) and the
// dashboard left the checkout entirely (it is product code under
// engines/nunc-fluens/dashboard/). Path *construction* routes through
// here; the OLD_* constants exist only for shape detection, sandbox
// migration, and the view-side fallback (the owner's news-shaped
// checkout keeps the old layout forever — view support is a product
// guarantee). app/sourcedata and app/data deliberately did NOT move
// (source_files.path rel-path identity; see config.ts).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// --- new shape (what the pipeline reads/writes) -----------------------------
// Forward-slash rel strings: node's join() normalizes them per-OS, and
// git pathspecs use them verbatim.
export const DATA_DIR = 'data';
export const DAILY_NEWS_REL = 'data/daily-news';
export const FP_REL = 'data/future-prediction';
export const MEMORY_REL = 'data/memory';
export const REFERENCE_REL = 'data/reference';
export const EXPORTS_REL = 'data/exports';
export const ARCHIVE_SNAPSHOTS_REL = 'data/archives/snapshots';
export const REFERENCES_TXT = 'references.txt';

/** The dashboard's data exports (graph-*.json, manifest, snapshots,
 * prefix-tokens.json). */
export const exportsDir = (repoRoot: string) => join(repoRoot, EXPORTS_REL);

// --- old shape (detection / migration / view fallback only) -----------------
export const OLD_REPORT_DIR = 'report';
export const OLD_FP_DIR = 'future-prediction';
export const OLD_MEMORY_DIR = 'memory';
export const OLD_REFERENCE_DIR = 'reference';
export const OLD_DOCS_DIR = 'docs';
export const OLD_DOCS_DATA_REL = 'docs/data';
export const OLD_ARCHIVE_SNAPSHOTS_REL = 'docs/archives/snapshots';

export type CheckoutShape = 'new' | 'old' | 'empty';

/** Which layout a checkout carries. 'new' wins when both somehow
 * coexist (a half-migrated tree should be treated as migrated, not
 * re-migrated). */
export function detectShape(root: string): CheckoutShape {
  if (existsSync(join(root, DAILY_NEWS_REL)) || existsSync(join(root, EXPORTS_REL)))
    return 'new';
  if (existsSync(join(root, OLD_REPORT_DIR)) || existsSync(join(root, OLD_DOCS_DATA_REL)))
    return 'old';
  return 'empty';
}

// The four rendered locales. Hardcoded upstream and therefore hardcoded
// in the port (behavior changes are out of port scope); the post-C locale
// model replaces this with en + config.
export const LOCALES = ['en', 'ja', 'es', 'fil'] as const;
export const NON_EN_LOCALES = ['ja', 'es', 'fil'] as const;
export type Locale = (typeof LOCALES)[number];
