// Single home for the INSTANCE layout's directory names and the locale
// set. Post-C REDO V2/V3: the engine is a TEMPLATE (pipeline code +
// pipeline/instance-template/) and every run target is a DATA INSTANCE
// stamped from it by `nunc-fluens init` — a plain local data directory
// per profile (git-less, R9) carrying everything under data/
// (sourcedata, the daily quartet, exports, the history ledger),
// README*.md at the root, an instance.json stamp, and runtime state in
// a disposable store/ (see config.ts instanceStoreDir). Path
// *construction* routes through here. The news-era old shape is not a
// pipeline concept anymore — that knowledge lives ONLY inside
// `nunc-fluens import` (src/import.ts, module-local constants).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// --- instance layout (what the pipeline reads/writes) -----------------------
// Forward-slash rel strings: node's join() normalizes them per-OS.
export const SOURCEDATA_REL = 'data/sourcedata';
export const DAILY_NEWS_REL = 'data/daily-news';
export const FP_REL = 'data/future-prediction';
export const HISTORY_REL = 'data/history';
export const REFERENCE_REL = 'data/reference';
export const EXPORTS_REL = 'data/exports';
export const ARCHIVE_SNAPSHOTS_REL = 'data/archives/snapshots';
export const REFERENCE_HISTORY_REL = 'data/history/reference-history.log';

/** The dashboard's data exports (graph-*.json, manifest, snapshots,
 * prefix-tokens.json). */
export const exportsDir = (repoRoot: string) => join(repoRoot, EXPORTS_REL);

// --- locale model (post-C P5) ------------------------------------------------
// These constants are the supported UNIVERSE, not the per-run render
// set: the DB schema is column-per-locale (*_ja/_es/_fil + a CHECK on
// source_files.locale), so anything outside {ja, es, fil} is a schema
// migration (recorded follow-up). The EFFECTIVE render set is EN plus
// an owner-configured subset of NON_EN_LOCALES (news-config `locales`
// key, default = the full trio), resolved by resolveLocaleSet() below
// and threaded through RunCtx; replay derives it per day via
// replayLocaleSet() so recorded days reproduce exactly.
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
 * Precedence: (a) the day's recorded run.json `locales` field (the
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
