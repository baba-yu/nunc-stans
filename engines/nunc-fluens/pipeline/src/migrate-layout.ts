// Post-C layout migration (P3): convert an old-news-shaped instance
// checkout to the product's data/ layout, in place, as one git commit.
// Run side is single-shape — `sandbox` migrates fresh clones at
// creation and `migrate-layout <dir>` converts existing instances; the
// view side never migrates (the owner's old-shape checkout is read-only
// and supported forever). Idempotent: a tree with nothing old left is a
// no-op, and a PARTIALLY migrated tree (interrupted run) is completed
// rather than skipped — every move is existsSync-guarded and the
// .gitignore translation is idempotent.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DAILY_NEWS_REL, DATA_DIR, EXPORTS_REL, FP_REL, MEMORY_REL,
  OLD_DOCS_DATA_REL, OLD_DOCS_DIR, OLD_FP_DIR, OLD_MEMORY_DIR,
  OLD_REFERENCE_DIR, OLD_REPORT_DIR, REFERENCE_REL,
} from './world-paths.ts';

const MIGRATION_COMMIT_MESSAGE = 'layout migration: post-c product data layout';

/** Old rel path → new rel path (forward-slash git pathspecs). */
const DIR_MOVES: Array<[string, string]> = [
  [OLD_REPORT_DIR, DAILY_NEWS_REL],
  [OLD_FP_DIR, FP_REL],
  [OLD_MEMORY_DIR, MEMORY_REL],
  [OLD_REFERENCE_DIR, REFERENCE_REL],
  [OLD_DOCS_DATA_REL, EXPORTS_REL],
  // Snapshot retention archives (theme-review: MOVE, never delete).
  // Ignored/untracked, so this takes moveDir's plain-rename branch and
  // stays out of the migration commit, ignored again via the translated
  // /data/archives/ line. Must precede the docs/ cleanup below, which
  // would otherwise rmSync the archives away with the other leftovers.
  ['docs/archives', 'data/archives'],
];

// .gitignore line-prefix mapping (conservative: only these known
// prefixes, only at a path-segment boundary — `references.txt` must NOT
// match the `reference` prefix). Everything else passes through.
const IGNORE_PREFIX_MAP: Array<[string, string]> = [
  ['docs/data', EXPORTS_REL],
  ['docs/archives', 'data/archives'],
  [OLD_REPORT_DIR, DAILY_NEWS_REL],
  [OLD_FP_DIR, FP_REL],
  [OLD_MEMORY_DIR, MEMORY_REL],
  [OLD_REFERENCE_DIR, REFERENCE_REL],
];

export function translateIgnoreLine(line: string): string {
  const m = /^(\s*!?\/?)(.*)$/.exec(line)!;
  const [, head, rest] = m;
  for (const [oldPrefix, newPrefix] of IGNORE_PREFIX_MAP) {
    if (rest === oldPrefix || rest.startsWith(`${oldPrefix}/`))
      return `${head}${newPrefix}${rest.slice(oldPrefix.length)}`;
  }
  return line;
}

export interface MigrationResult {
  migrated: boolean;
  log: string[];
}

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

/** git mv when the source is tracked; plain rename otherwise (an
 * untracked-but-present dir still has to reach its new home so the
 * runtime finds it). */
function moveDir(repo: string, from: string, to: string, log: string[]): void {
  // Future-proof: a destination under a not-yet-created parent must not
  // ENOENT (renameSync does not mkdir, and git mv needs the parent too).
  mkdirSync(dirname(join(repo, to)), { recursive: true });
  const tracked = git(repo, 'ls-files', '--', from).trim() !== '';
  if (tracked) {
    git(repo, 'mv', from, to);
    log.push(`git mv ${from} ${to}`);
  } else {
    renameSync(join(repo, from), join(repo, to));
    log.push(`mv ${from} ${to} (untracked)`);
  }
}

/** Convert an old-shape instance checkout in place. `repo` is the git
 * work tree (a sandbox's news/ dir). Refuses on a non-git dir; no-op on
 * a tree that is already new-shape or has nothing to migrate. */
export function migrateLayout(repo: string): MigrationResult {
  const log: string[] = [];
  if (!existsSync(repo)) throw new Error(`migrate-layout: no such directory: ${repo}`);
  try {
    if (git(repo, 'rev-parse', '--is-inside-work-tree').trim() !== 'true')
      throw new Error('not a work tree');
  } catch {
    throw new Error(`migrate-layout: ${repo} is not a git work tree — `
      + 'the migration commits into the instance repo and refuses to run without one');
  }
  // No-op only when nothing OLD remains. detectShape's 'new'-wins rule
  // (kept for read-side callers) would misclassify a half-migrated tree
  // as done here: the migration is not atomic, so a crash between moves
  // leaves data/ AND old dirs coexisting — re-running must complete the
  // remaining moves, not refuse.
  const oldRemains = DIR_MOVES.some(([from]) => existsSync(join(repo, from)))
    || existsSync(join(repo, OLD_DOCS_DIR));
  if (!oldRemains) {
    log.push('already new shape — nothing to do');
    return { migrated: false, log };
  }

  mkdirSync(join(repo, DATA_DIR), { recursive: true });
  for (const [from, to] of DIR_MOVES)
    if (existsSync(join(repo, from))) moveDir(repo, from, to, log);

  // Instances carry no dashboard (P2): drop the tracked docs/ remnants
  // (index.html, assets/, favicon, …) and plain-delete whatever ignored
  // leftovers remain so docs/ disappears (docs/archives was already
  // carried to data/archives by the moves above).
  const docs = join(repo, OLD_DOCS_DIR);
  if (existsSync(docs)) {
    if (git(repo, 'ls-files', '--', OLD_DOCS_DIR).trim() !== '') {
      git(repo, 'rm', '-r', '--quiet', '--', OLD_DOCS_DIR);
      log.push(`git rm -r ${OLD_DOCS_DIR} (instance dashboard copy retired)`);
    }
    if (existsSync(docs)) {
      rmSync(docs, { recursive: true, force: true });
      log.push(`rm -r ${OLD_DOCS_DIR} (ignored leftovers)`);
    }
  }

  // Translate the instance .gitignore (inherited from the old-shape
  // clone source) line by line; unknown lines — including
  // references.txt — pass through untouched.
  const ignorePath = join(repo, '.gitignore');
  if (existsSync(ignorePath)) {
    const before = readFileSync(ignorePath, 'utf8');
    const after = before.split('\n').map(translateIgnoreLine).join('\n');
    if (after !== before) {
      writeFileSync(ignorePath, after, 'utf8');
      git(repo, 'add', '--', '.gitignore');
      log.push('.gitignore translated to the data/ layout');
    }
  }

  // Single migration commit — only when something was staged (an empty
  // old-shape-less tree migrates to nothing).
  let staged = true;
  try {
    git(repo, 'diff', '--cached', '--quiet');
    staged = false;
  } catch { /* non-zero exit = staged changes exist */ }
  if (!staged) {
    log.push('nothing staged — no migration commit');
    return { migrated: false, log };
  }
  // Synthetic identity: this is a machine-generated commit inside a
  // disposable instance — it must not depend on host git config (a
  // local clone copies no repo-local identity; a fresh machine/CI
  // runner may have no global one either).
  git(repo, '-c', 'user.name=nunc-fluens', '-c', 'user.email=nunc-fluens@localhost',
    'commit', '--quiet', '-m', MIGRATION_COMMIT_MESSAGE);
  log.push(`committed: ${MIGRATION_COMMIT_MESSAGE}`);
  return { migrated: true, log };
}
