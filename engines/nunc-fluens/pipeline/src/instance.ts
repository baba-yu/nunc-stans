// Instance lifecycle (post-C REDO V2/V3, R1/R2/R9): the engine ships a
// TEMPLATE (pipeline/instance-template/ — skeleton, synthetic editorial
// seeds, README seed) and `nunc-fluens init` stamps DATA INSTANCES from
// it: one plain local data directory per profile (git-less — the
// product runs entirely locally; versioning/backup is the user's own
// concern), default home engines/nunc-fluens/instances/<name>/
// (gitignored in the monorepo). An instance carries the data/ tree
// (sourcedata, daily quartet, exports, the history ledger), an
// instance.json stamp at the root, plus a disposable store/ for
// runtime state (world/analytics.sqlite, runs/ai-runs.jsonl, optional
// news-config.json override).
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { initDb } from './db/db.ts';
import { instanceStoreDir, worldDbFile } from './config.ts';
import { SOURCEDATA_REL } from './world-paths.ts';
import { looksNewsShaped } from './import.ts';

// --- instance.json (the birth stamp) -----------------------------------------
// `nunc_fluens` is the stamp-format version; `created` is the init
// date; `imports` records every `nunc-fluens import` run against the
// instance (the re-import guard reads it). The date is injectable so
// goldens/tests stay deterministic.

export interface ImportRecord {
  source: string;
  date: string;
}

export interface InstanceStamp {
  nunc_fluens: number;
  created: string;
  imports: ImportRecord[];
}

export function instanceStampFile(dir: string): string {
  return join(dir, 'instance.json');
}

/** Parse the instance stamp, or null when absent/invalid/foreign. */
export function readInstanceStamp(dir: string): InstanceStamp | null {
  try {
    const raw = JSON.parse(readFileSync(instanceStampFile(dir), 'utf8')) as
      Record<string, unknown>;
    if (!raw || typeof raw !== 'object' || typeof raw.nunc_fluens !== 'number')
      return null;
    return {
      nunc_fluens: raw.nunc_fluens,
      created: typeof raw.created === 'string' ? raw.created : '',
      imports: Array.isArray(raw.imports) ? raw.imports as ImportRecord[] : [],
    };
  } catch {
    return null;
  }
}

export function writeInstanceStamp(dir: string, stamp: InstanceStamp): void {
  writeFileSync(instanceStampFile(dir), JSON.stringify(stamp, null, 2) + '\n', 'utf8');
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The template bundled with this package, resolved relative to this
 * module like promptsDir() (core.ts). */
export function instanceTemplateDir(): string {
  return join(import.meta.dirname, '..', 'instance-template');
}

/** Default instance home: engines/nunc-fluens/instances/ (gitignored
 * in the monorepo; multiple profiles are expected). */
export function instancesRoot(): string {
  return join(import.meta.dirname, '..', '..', 'instances');
}

/** A bare name (no path separator) is a profile under the engine's
 * instances/ home; anything with a separator is a path, used as-is. */
export function resolveInstanceDir(nameOrPath: string): string {
  return /[/\\]/.test(nameOrPath) ? nameOrPath : join(instancesRoot(), nameOrPath);
}

// Seeds the template must carry — init refuses to stamp from a broken
// checkout rather than producing a hollow instance.
const TEMPLATE_REQUIRED = [
  'README.md',
  'data/history/reference-history.log',
  'data/reference/news-topics.json', // topics-authoring W1: json is the authority
  'data/reference/citation-restrictions.md',
  'data/reference/glossary.yml',
];

export interface InitResult {
  dir: string;
  dbFile: string;
  log: string[];
}

/** Create a v2 instance at `dir` (already resolved — see
 * resolveInstanceDir): copy the template, write the instance.json
 * stamp, and initDb the (disposable) store. No git anywhere (R9): an
 * instance is a plain directory. Refuses an existing non-empty
 * directory. `createdDate` is injectable so goldens/tests pin it. */
export function initInstance(dir: string, createdDate?: string): InitResult {
  const log: string[] = [];
  if (existsSync(dir) && readdirSync(dir).length > 0)
    throw new Error(`init: ${dir} already exists and is not empty — `
      + 'instances are stamped into fresh directories only');
  const template = instanceTemplateDir();
  for (const f of TEMPLATE_REQUIRED)
    if (!existsSync(join(template, ...f.split('/'))))
      throw new Error(`init: instance template is incomplete — missing ${f} under ${template}`);
  // Rollback bookkeeping: a failed stamp must not leave debris that the
  // non-empty-dir guard above would then refuse on retry.
  const created = !existsSync(dir);
  try {
    mkdirSync(dir, { recursive: true });
    // The no-op filter forces node's JS cp path: the native fast path
    // ABORTS the process (uncaught std::filesystem_error) on e.g. a
    // read-only destination instead of throwing a catchable error —
    // the rollback below must be reachable (same trick as import.ts).
    cpSync(template, dir, { recursive: true, filter: () => true });
    log.push(`template copied from ${template}`);
    writeInstanceStamp(dir, {
      nunc_fluens: 1,
      created: createdDate ?? todayIso(),
      imports: [],
    });
    log.push('instance.json stamped');
    // Runtime state: store/ is disposable and never part of the data
    // tree — the DB is born schema-initialized.
    const dbFile = worldDbFile(instanceStoreDir(dir));
    initDb(dbFile);
    log.push(`store db initialized at ${dbFile}`);
    return { dir, dbFile, log };
  } catch (e) {
    if (created) {
      // init made the dir: remove the partial stamp so a retry is clean.
      rmSync(dir, { recursive: true, force: true });
      throw e;
    }
    // The (empty) dir pre-existed — it is the owner's to remove, so say so.
    throw new Error(`${e instanceof Error ? e.message : e} — init left a `
      + `partial instance behind: remove ${dir} and re-run init`);
  }
}

export interface InstancePaths { root: string; storeDir: string }

/** Resolve and validate a run target: an init/import-born v2 instance
 * (instance.json stamp + data/sourcedata + a store DB). Bare names are
 * CLI-level sugar and resolve under the engine's instances/ home, the
 * same as init/import (resolveInstanceDir). Running on the instance
 * you also view is normal product mode. */
export function requireInstance(dirArg: string | null): InstancePaths {
  const raw = dirArg ?? process.env.NS_INSTANCE ?? null;
  if (!raw)
    throw new Error(
      'run refuses to start without an instance: pass --instance <dir|name> (or set NS_INSTANCE).\n'
      + 'Create one with: nunc-fluens init <dir|name>');
  const dir = resolveInstanceDir(raw);
  if (looksNewsShaped(dir))
    throw new Error(
      `${dir} is a news-shaped checkout, not a v2 instance — create an instance `
      + 'with nunc-fluens init and bring data over with nunc-fluens import');
  const storeDir = instanceStoreDir(dir);
  if (readInstanceStamp(dir) === null
    || !existsSync(join(dir, ...SOURCEDATA_REL.split('/'))))
    throw new Error(
      `instance at ${dir} is missing instance.json or ${SOURCEDATA_REL}/ — `
      + 'create it with: nunc-fluens init <dir|name>');
  const dbFile = worldDbFile(storeDir);
  if (!existsSync(dbFile)) {
    // store/ is disposable runtime state: a copied/restored instance
    // (or a cleaned one) may lack it. Recreate the schema instead of
    // refusing — historical DB content replays back in per day via
    // `run --replay`.
    initDb(dbFile);
    console.error('store db initialized (copied instance?)');
  }
  return { root: dir, storeDir };
}
