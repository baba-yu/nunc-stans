// Instance lifecycle (post-C REDO V2, R1/R2): the engine ships a
// TEMPLATE (pipeline/instance-template/ — skeleton, synthetic editorial
// seeds, instance .gitignore, README seed) and `nunc-fluens init`
// stamps DATA INSTANCES from it: one git repo per profile, default
// home engines/nunc-fluens/instances/<name>/ (gitignored). An instance
// carries the data/ tree (sourcedata, publish quartet, exports,
// references.txt) plus a gitignored store/ for runtime state
// (world/analytics.sqlite, runs/ai-runs.jsonl, optional
// news-config.json override).
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initDb } from './db/db.ts';
import { instanceStoreDir, worldDbFile } from './config.ts';

export const INIT_COMMIT_MESSAGE = 'init: nunc-fluens instance';

export function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

/** Machine-generated commits inside instances must not depend on host
 * git config (a fresh machine or CI runner may have no identity at
 * all) — every instance commit carries the synthetic identity. */
export function gitSynthetic(repo: string, ...args: string[]): string {
  return execFileSync('git', [
    '-C', repo,
    '-c', 'user.name=nunc-fluens', '-c', 'user.email=nunc-fluens@localhost',
    ...args,
  ], { encoding: 'utf8' });
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
  mkdirSync(dir, { recursive: true });
  cpSync(template, dir, { recursive: true });
  log.push(`template copied from ${template}`);
  execFileSync('git', ['init', '-q', dir]);
  git(dir, 'add', '-A');
  gitSynthetic(dir, 'commit', '--quiet', '-m', INIT_COMMIT_MESSAGE);
  log.push(`committed: ${INIT_COMMIT_MESSAGE}`);
  // Runtime state: store/ is ignored by the template .gitignore — the
  // DB is born schema-initialized but never committed.
  const dbFile = worldDbFile(instanceStoreDir(dir));
  initDb(dbFile);
  log.push(`store db initialized at ${dbFile}`);
  return { dir, dbFile, log };
}
