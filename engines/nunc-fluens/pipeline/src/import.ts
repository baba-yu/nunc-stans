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
import {
  copyFileSync, cpSync, existsSync, readdirSync, renameSync, statSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { integrityCheck } from './migrate.ts';
import { git, gitSynthetic, seedInstanceGitConfig } from './instance.ts';
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
  // A prior import is refused via its exact commit marker — the
  // sourcedata probe below alone would let a report-only source (no
  // app/sourcedata) re-import repeatedly.
  let subjects: string[] = [];
  try {
    subjects = git(instance, 'log', '--format=%s').split('\n');
  } catch { /* unborn HEAD: an init-born instance always has a commit */ }
  const priorImport = subjects.find(s2 => s2.startsWith(IMPORT_COMMIT_PREFIX));
  if (priorImport)
    throw new Error(`${instance} already carries an import commit (${priorImport}) — `
      + 'import targets a fresh init-born instance only (no --force in v1)');
  // Failed-run debris is not data: a full run writes run.json even when
  // a step failed (deliberate — the snapshot manifest), so a day dir
  // whose ONLY content is run.json must not brick the import.
  const sd = p(instance, SOURCEDATA_REL);
  const offenders = readdirSync(sd).filter(f => {
    if (f === '.gitkeep') return false;
    const fp = join(sd, f);
    if (statSync(fp).isDirectory()) {
      const inner = readdirSync(fp);
      if (inner.length === 1 && inner[0] === 'run.json') {
        log.push(`ignoring failed-run debris: ${f}/run.json (no sourcedata files)`);
        return false;
      }
    }
    return true;
  });
  if (offenders.length)
    throw new Error(`${instance} already carries sourcedata (${offenders.join(', ')}) — `
      + 'import targets a fresh init-born instance only (no --force in v1).\n'
      + 'If these are leftovers of a failed run: delete data/sourcedata/<date>/ '
      + 'and re-run import.\n'
      + 'If a previous import was interrupted: remove the instance dir, then '
      + 'nunc-fluens init + import — the source is never modified.');

  // Copy + map. The dashboard copies news-era checkouts carried under
  // docs/ (index.html, assets/) are deliberately NOT imported — the
  // dashboard is engine code now. dereference:true keeps the instance
  // self-contained (a symlink in the source arrives as file content,
  // never as a live pointer back into the checkout); the no-op filter
  // forces node's JS cp path, where dereference actually applies to
  // nested entries (the native fast path ignores it — verified on
  // node 24).
  for (const [from, to] of DIR_MAP) {
    const s = p(src, from);
    if (!existsSync(s)) continue;
    try {
      cpSync(s, p(instance, to), { recursive: true, dereference: true, filter: () => true });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT')
        throw new Error(`dangling symlink under ${from}: ${err.path ?? s} does `
          + 'not resolve — import copies content only (self-contained instance); '
          + 'fix or remove the link in the source');
      throw e;
    }
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
      // Full-timestamp suffix: collision-proof (a date-only name lets a
      // same-day rename clobber the previous backup — POSIX rename
      // overwrites silently).
      const bak = `${storeDb}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
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
  // Re-seed the local synthetic identity first (idempotent): instances
  // born before the birth-time seeding existed pick it up here, so
  // run-side plain-git commits work on identity-less hosts too.
  seedInstanceGitConfig(instance);
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
