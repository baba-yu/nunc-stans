// Instance lifecycle (post-C REDO V2, R1/R2): the engine ships a
// TEMPLATE (pipeline/instance-template/ — skeleton, synthetic editorial
// seeds, instance .gitignore, README seed) and `nunc-fluens init`
// stamps DATA INSTANCES from it: one git repo per profile, default
// home engines/nunc-fluens/instances/<name>/ (gitignored). An instance
// carries the data/ tree (sourcedata, publish quartet, exports,
// references.txt) plus a gitignored store/ for runtime state
// (world/analytics.sqlite, runs/ai-runs.jsonl, optional
// news-config.json override).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initDb } from './db/db.ts';
import { instanceStoreDir, worldDbFile } from './config.ts';
import { SOURCEDATA_REL } from './world-paths.ts';
import { looksNewsShaped } from './import.ts';

export const INIT_COMMIT_MESSAGE = 'init: nunc-fluens instance';

export function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

/** Machine-generated commits inside instances must not depend on host
 * git config (a fresh machine or CI runner may have no identity at
 * all; a developer host may force commit signing or global hooks) —
 * every instance commit carries the synthetic identity, signing off,
 * and no hooks path (the empty `core.hooksPath=` value disables hook
 * lookup entirely). */
export function gitSynthetic(repo: string, ...args: string[]): string {
  return execFileSync('git', [
    '-C', repo,
    '-c', 'user.name=nunc-fluens', '-c', 'user.email=nunc-fluens@localhost',
    '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false',
    '-c', 'core.hooksPath=',
    ...args,
  ], { encoding: 'utf8' });
}

/** Seed the synthetic identity into the instance repo's LOCAL config at
 * birth, so RUN-SIDE plain-git commits (publish in steps.ts, the Sunday
 * commitOnly) inherit it on identity-less or gpgsign-forcing hosts —
 * the invariant above covers every instance commit, not only the ones
 * init/import make themselves. Idempotent. */
export function seedInstanceGitConfig(repo: string): void {
  git(repo, 'config', 'user.name', 'nunc-fluens');
  git(repo, 'config', 'user.email', 'nunc-fluens@localhost');
  git(repo, 'config', 'commit.gpgsign', 'false');
}

/** The template bundled with this package, resolved relative to this
 * module like promptsDir() (core.ts). */
export function instanceTemplateDir(): string {
  return join(import.meta.dirname, '..', 'instance-template');
}

/** Default instance home: engines/nunc-fluens/instances/ (gitignored;
 * multiple profiles are expected). */
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
  '.gitignore',
  'README.md',
  'data/references.txt',
  'data/reference/news-topics.md',
  'data/reference/citation-restrictions.md',
  'data/reference/glossary.yml',
];

export interface InitResult {
  dir: string;
  dbFile: string;
  log: string[];
}

/** Create a v2 instance at `dir` (already resolved — see
 * resolveInstanceDir): copy the template, git init + one initial commit
 * with the synthetic identity, and initDb the (ignored, uncommitted)
 * store. Refuses an existing non-empty directory. */
export function initInstance(dir: string): InitResult {
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
    cpSync(template, dir, { recursive: true });
    log.push(`template copied from ${template}`);
    execFileSync('git', ['init', '-q', dir]);
    seedInstanceGitConfig(dir);
    git(dir, 'add', '-A');
    gitSynthetic(dir, 'commit', '--quiet', '-m', INIT_COMMIT_MESSAGE);
    log.push(`committed: ${INIT_COMMIT_MESSAGE}`);
    // Runtime state: store/ is ignored by the template .gitignore — the
    // DB is born schema-initialized but never committed.
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
 * (its own repo + data/sourcedata + a store DB). Running on the
 * instance you also view is normal product mode now — `import` never
 * touches a source checkout, so the old view-source refusal (a ~/news
 * protection) is gone with the clone machinery. */
export function requireInstance(dirArg: string | null): InstancePaths {
  const dir = dirArg ?? process.env.NS_INSTANCE ?? null;
  if (!dir)
    throw new Error(
      'run refuses to start without an instance: pass --instance <dir> (or set NS_INSTANCE).\n'
      + 'Create one with: nunc-fluens init <dir|name>');
  if (looksNewsShaped(dir))
    throw new Error(
      `${dir} is a news-shaped checkout, not a v2 instance — create an instance `
      + 'with nunc-fluens init and bring data over with nunc-fluens import');
  const storeDir = instanceStoreDir(dir);
  if (!existsSync(join(dir, '.git')) || !existsSync(join(dir, ...SOURCEDATA_REL.split('/'))))
    throw new Error(
      `instance at ${dir} is missing .git or ${SOURCEDATA_REL}/ — `
      + 'create it with: nunc-fluens init <dir|name>');
  const dbFile = worldDbFile(storeDir);
  if (!existsSync(dbFile)) {
    // store/ is disposable runtime state and gitignored: a fresh clone
    // of a legitimate instance repo (or a git clean -xdf) lacks it.
    // Recreate the schema instead of refusing — historical DB content
    // replays back in per day via `run --replay`.
    initDb(dbFile);
    console.error('store db initialized (fresh clone?)');
  }
  return { root: dir, storeDir };
}
