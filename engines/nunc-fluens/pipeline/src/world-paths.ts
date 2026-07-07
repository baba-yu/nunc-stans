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
import { existsSync, readFileSync } from 'node:fs';
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

// --- locale model (post-C P5) ------------------------------------------------
// These constants are the supported UNIVERSE, not the per-run render
// set: the DB schema is column-per-locale (*_ja/_es/_fil + a CHECK on
// source_files.locale), so anything outside {ja, es, fil} is a schema
// migration (recorded follow-up). The EFFECTIVE render set is EN plus
// an owner-configured subset of NON_EN_LOCALES (news-config `locales`
// key, default = the full trio), resolved by resolveLocaleSet() below
// and threaded through RunCtx; replay derives it per day via
// replayLocaleSet() so committed days reproduce exactly.
export const LOCALES = ['en', 'ja', 'es', 'fil'] as const;
export const NON_EN_LOCALES = ['ja', 'es', 'fil'] as const;
export type Locale = (typeof LOCALES)[number];
export type NonEnLocale = (typeof NON_EN_LOCALES)[number];

/** Resolve the configured non-EN render set. Absent config (undefined/
 * null) means today's behavior: the full ja/es/fil trio. Anything but
 * an array of universe members throws — the caller (cmdRun) turns that
 * into a run refusal rather than guessing. Duplicates collapse;
 * universe order is preserved regardless of config order. */
export function resolveLocaleSet(configured?: unknown): NonEnLocale[] {
  if (configured === undefined || configured === null) return [...NON_EN_LOCALES];
  if (!Array.isArray(configured))
    throw new Error(
      `'locales' must be an array (a subset of {${NON_EN_LOCALES.join(', ')}}), `
      + `got ${JSON.stringify(configured)}`);
  for (const v of configured)
    if (typeof v !== 'string' || !(NON_EN_LOCALES as readonly string[]).includes(v))
      throw new Error(
        `unsupported locale ${JSON.stringify(v)} in 'locales' — the supported `
        + `non-EN set is {${NON_EN_LOCALES.join(', ')}} (the DB schema is `
        + 'column-per-locale; arbitrary locales are a recorded follow-up)');
  const want = new Set(configured as string[]);
  return NON_EN_LOCALES.filter(l => want.has(l));
}

/** The per-day effective set for REPLAY (a replayed day must reproduce
 * exactly the locales it originally ran with, not today's preference).
 * Precedence: (a) the day's committed run.json `locales` field (the
 * full render set incl. 'en'; recorded since the locale model landed),
 * else (b) the staged sourcedata/locales/<date>/ subdirs (pre-model
 * days: the siblings that exist ARE the set), else (c) the default. */
export function replayLocaleSet(sourcedataRoot: string, date: string): NonEnLocale[] {
  const runJson = join(sourcedataRoot, date, 'run.json');
  if (existsSync(runJson)) {
    let recorded: unknown;
    try {
      recorded = (JSON.parse(readFileSync(runJson, 'utf8')) as Record<string, unknown>).locales;
    } catch { recorded = undefined; /* unreadable manifest: fall through */ }
    if (recorded !== undefined && recorded !== null) {
      if (!Array.isArray(recorded))
        throw new Error(`${runJson}: 'locales' is not an array — cannot derive the replay set`);
      return resolveLocaleSet(recorded.filter(l => l !== 'en'));
    }
  }
  const localesRoot = join(sourcedataRoot, 'locales', date);
  if (existsSync(localesRoot))
    return NON_EN_LOCALES.filter(l => existsSync(join(localesRoot, l)));
  return [...NON_EN_LOCALES];
}

/** README filename suffixes for a non-EN set: README.md ('') plus one
 * README.<l>.md per configured locale. */
export function readmeSuffixes(nonEn: readonly string[]): string[] {
  return ['', ...nonEn.map(l => `.${l}`)];
}
