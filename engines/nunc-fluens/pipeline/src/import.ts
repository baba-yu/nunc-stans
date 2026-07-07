// `nunc-fluens import <news-shaped-src> <instance>` (post-C REDO V2,
// R4): copy a news-shaped checkout's data into an init-born v2
// instance. Replaces the retired clone+migrate machinery (R5) — the
// source is READ-ONLY (the owner's checkout is never written, moved,
// or mutated); news data comes over at the owner's own timing, by copy.
//
// OLD-SHAPE KNOWLEDGE LIVES ONLY HERE (module-local constants): the
// news-era checkout kept sourcedata under app/sourcedata, the publish
// quartet at the root (report/, future-prediction/, memory/,
// reference/), exports and snapshot archives under docs/,
// references.txt at the root, and the analytics DB at
// app/data/analytics.sqlite. No .gitignore translation is needed — the
// instance keeps the template .gitignore it was born with.
//
// DB provenance (R4): source_files.path stores repo-relative paths and
// source_file_id = sha1(rel path) — FK-referenced row identity. Rows
// arriving with the imported DB keep their news-era `app/sourcedata/…`
// strings; new ingests write `data/sourcedata/…`. Mixed provenance is
// accepted — nothing joins on the path prefix.
import { copyFileSync, cpSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { integrityCheck } from './migrate.ts';
import { git, gitSynthetic } from './instance.ts';
import { instanceStoreDir, worldDbFile } from './config.ts';
import {
  DAILY_NEWS_REL, EXPORTS_REL, FP_REL, MEMORY_REL, REFERENCE_REL,
  REFERENCES_TXT_REL, SOURCEDATA_REL,
} from './world-paths.ts';

export const IMPORT_COMMIT_PREFIX = 'import: news-shaped checkout ';

// Old rel path -> v2 rel path (forward-slash; join() normalizes).
const DIR_MAP: Array<[string, string]> = [
  ['app/sourcedata', SOURCEDATA_REL],
  ['report', DAILY_NEWS_REL],
  ['future-prediction', FP_REL],
  ['memory', MEMORY_REL],
  // Real editorial files OVERWRITE the template seeds file-by-file;
  // seeds without a source counterpart survive (cpSync merges).
  ['reference', REFERENCE_REL],
  ['docs/data', EXPORTS_REL],
  // Snapshot retention archives: plain copy, ignored by the template
  // .gitignore — carried but never committed.
  ['docs/archives', 'data/archives'],
];
const OLD_DB_REL = 'app/data/analytics.sqlite';

function p(root: string, rel: string): string {
  return join(root, ...rel.split('/'));
}

/** The one old-shape probe the rest of the pipeline may use (via this
 * module): does `dir` look like a news-shaped checkout? */
export function looksNewsShaped(dir: string): boolean {
  return existsSync(join(dir, 'report')) || existsSync(join(dir, 'app', 'sourcedata'));
}

export interface ImportResult {
  log: string[];
}

/** Copy a news-shaped checkout's data into an existing init-born
 * instance and commit it there (synthetic identity). Refuses a
 * non-virgin instance (data/sourcedata already populated) — no --force
 * in v1 of this command. */
export function importNewsCheckout(src: string, instance: string): ImportResult {
  const log: string[] = [];
  if (!existsSync(src)) throw new Error(`no such source directory: ${src}`);
  if (!looksNewsShaped(src))
    throw new Error(`${src} does not look like a news-shaped checkout `
      + '(neither report/ nor app/sourcedata/ present)');
  const storeDb = worldDbFile(instanceStoreDir(instance));
  if (!existsSync(join(instance, '.git'))
    || !existsSync(p(instance, SOURCEDATA_REL))
    || !existsSync(storeDb))
    throw new Error(`${instance} is not an initialized v2 instance — `
      + 'create one first with: nunc-fluens init <dir|name>');
  if (resolve(src) === resolve(instance))
    throw new Error('source and instance are the same directory');
  const staged = readdirSync(p(instance, SOURCEDATA_REL)).filter(f => f !== '.gitkeep');
  if (staged.length)
    throw new Error(`${instance} already carries sourcedata (${staged.length} entr`
      + `${staged.length === 1 ? 'y' : 'ies'}) — import targets a fresh init-born `
      + 'instance only (no --force in v1)');

  // Copy + map. The dashboard copies news-era checkouts carried under
  // docs/ (index.html, assets/) are deliberately NOT imported — the
  // dashboard is engine code now.
  for (const [from, to] of DIR_MAP) {
    const s = p(src, from);
    if (!existsSync(s)) continue;
    cpSync(s, p(instance, to), { recursive: true });
    log.push(`copied ${from} -> ${to}`);
  }
  if (existsSync(join(src, 'references.txt'))) {
    copyFileSync(join(src, 'references.txt'), p(instance, REFERENCES_TXT_REL));
    log.push(`copied references.txt -> ${REFERENCES_TXT_REL}`);
  }
  for (const f of readdirSync(src))
    if (/^README(\.[A-Za-z-]+)?\.md$/.test(f)) {
      copyFileSync(join(src, f), join(instance, f));
      log.push(`copied ${f} (root)`);
    }

  // DB seed: integrity-checked copy of the source analytics DB into the
  // instance store. Absent source DB = the instance keeps the empty
  // schema-initialized store it was born with. An existing instance DB
  // is backed up, never clobbered.
  const srcDb = p(src, OLD_DB_REL);
  if (existsSync(srcDb)) {
    integrityCheck(srcDb);
    if (existsSync(storeDb)) {
      const bak = `${storeDb}.bak-${new Date().toISOString().slice(0, 10)}`;
      renameSync(storeDb, bak);
      log.push(`instance db backed up to ${bak}`);
    }
    copyFileSync(srcDb, storeDb);
    integrityCheck(storeDb);
    log.push(`store db seeded from ${OLD_DB_REL} (integrity ok)`);
  } else {
    log.push(`source carries no ${OLD_DB_REL} — instance keeps its empty store db`);
  }

  // One import commit in the instance repo. data/archives/ and store/
  // are ignored by the template .gitignore and stay out of it.
  git(instance, 'add', '-A');
  let stagedAny = true;
  try {
    git(instance, 'diff', '--cached', '--quiet');
    stagedAny = false;
  } catch { /* non-zero exit = staged changes exist */ }
  if (stagedAny) {
    const msg = `${IMPORT_COMMIT_PREFIX}${basename(resolve(src))}`;
    gitSynthetic(instance, 'commit', '--quiet', '-m', msg);
    log.push(`committed: ${msg}`);
  } else {
    log.push('nothing staged — no import commit');
  }
  return { log };
}
