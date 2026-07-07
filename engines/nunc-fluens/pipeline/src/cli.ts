#!/usr/bin/env node
// nunc-fluens — the news pipeline CLI (Phase C).
//   link <dir>           designate the read-only news-shaped checkout (news_repo)
//   status               show resolved config and world-cache state
//   migrate-db           copy analytics.sqlite into <data store>/world/ (verified)
//   validate <date>      schema-validate a day's sourcedata (incl. locales)
//   sandbox <dir>        create a disposable run instance (clone + seeded store)
//   migrate-layout <dir> convert an old-shape instance to the data/ layout
//   run                  the daily DAG — always against a sandbox, never
//                        the view checkout (Phase C redirection)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  configFile, linkNewsRepo, newsDbFile, requireConfig, requireNewsRepo,
  resolveDataDir, resolveNewsRepo, runLogFile, sourcedataDir,
  worldDbFile, worldDir,
} from './config.ts'
import { integrityCheck, migrateDb } from './migrate.ts'
import { CANONICAL_FILES } from './schemas/sourcedata.ts'
import {
  DAILY_NEWS_REL, detectShape, OLD_DOCS_DIR, OLD_FP_DIR, OLD_MEMORY_DIR,
  OLD_REFERENCE_DIR, OLD_REPORT_DIR, resolveLocaleSet,
} from './world-paths.ts'
import { migrateLayout } from './migrate-layout.ts'

function cmdLink(dir: string | undefined): number {
  if (!dir) { console.error('usage: nunc-fluens link <dir>'); return 2 }
  if (!existsSync(dir)) { console.error(`link: no such directory: ${dir}`); return 1 }
  // Both layouts are legitimate view sources: the owner's checkout keeps
  // the old news shape forever; product checkouts carry the data/ shape.
  if (detectShape(dir) === 'empty')
    console.error(`warning: ${dir} has neither ${OLD_REPORT_DIR}/ nor `
      + `${DAILY_NEWS_REL}/ — is this really a news data checkout?`)
  const file = linkNewsRepo(dir)
  console.log(`news_repo = ${dir}`)
  console.log(`written to ${file}`)
  return 0
}

function cmdStatus(): number {
  const { dir } = resolveDataDir()
  const repo = resolveNewsRepo()
  console.log(`config file : ${configFile()}`)
  console.log(`data store  : ${dir ?? '(not configured - just bootstrap <dir>)'}`)
  console.log(`news repo   : ${repo ?? '(not configured - just news-link <dir>)'}`)
  if (dir) {
    const db = worldDbFile(dir)
    console.log(`world db    : ${existsSync(db) ? `${db} (${statSync(db).size} bytes)` : '(not migrated - just news-migrate-db)'}`)
  }
  return 0
}

function cmdMigrateDb(): number {
  const cfg = requireConfig()
  const r = migrateDb(cfg, new Date().toISOString().slice(0, 10))
  console.log(`migrated ${r.source}`)
  console.log(`      -> ${r.target} (${r.bytes} bytes, integrity ok)`)
  if (r.backedUp) console.log(`previous target backed up to ${r.backedUp}`)
  console.log('note: the upstream copy stays in place until the T9 cutover')
  return 0
}

function validateDir(dir: string, label: string): { checked: number; failed: number } {
  let checked = 0, failed = 0
  for (const name of Object.keys(CANONICAL_FILES)) {
    const f = join(dir, name)
    if (!existsSync(f)) continue
    checked++
    try {
      CANONICAL_FILES[name].parse(JSON.parse(readFileSync(f, 'utf8')))
      console.log(`OK   ${label}/${name}`)
    } catch (err) {
      failed++
      console.error(`FAIL ${label}/${name}: ${err instanceof Error ? err.message : err}`)
    }
  }
  return { checked, failed }
}

function cmdValidate(date: string | undefined): number {
  if (!date) { console.error('usage: nunc-fluens validate <YYYY-MM-DD>'); return 2 }
  const repo = requireNewsRepo()
  const sd = sourcedataDir(repo)
  const dayDir = join(sd, date)
  if (!existsSync(dayDir)) { console.error(`validate: no sourcedata for ${date} under ${sd}`); return 1 }
  let checked = 0, failed = 0
  const add = (r: { checked: number; failed: number }) => { checked += r.checked; failed += r.failed }
  add(validateDir(dayDir, date))
  const localesRoot = join(sd, 'locales', date)
  if (existsSync(localesRoot))
    for (const L of readdirSync(localesRoot).sort())
      add(validateDir(join(localesRoot, L), `${date}/${L}`))
  console.log(`${checked} file(s) checked, ${failed} failure(s)`)
  return failed === 0 ? 0 : 1
}

const [cmd, arg] = process.argv.slice(2)

/** Create a disposable run instance: a local clone of the (read-only)
 * view checkout plus its own data store seeded with the checkout's
 * analytics.sqlite. Runs only ever target such an instance — the
 * Phase C redirection forbids writing the real checkout. */
function cmdSandbox(dir: string | undefined): number {
  if (!dir) { console.error('usage: nunc-fluens sandbox <dir>'); return 2 }
  const src = requireNewsRepo()
  const news = join(dir, 'news')
  const store = join(dir, 'store')
  if (existsSync(news)) {
    console.error(`sandbox: ${news} already exists — pick a fresh dir (sandboxes are disposable)`)
    return 1
  }
  mkdirSync(dir, { recursive: true })
  console.log(`cloning ${src} -> ${news} (local clone; objects are shared read-only)`)
  execFileSync('git', ['clone', '--local', src, news], { stdio: 'inherit' })
  // A sandbox must not be able to push back into the source checkout.
  execFileSync('git', ['-C', news, 'remote', 'remove', 'origin'])
  // Run side is single-shape (P3): old-shape clones are converted to the
  // product data/ layout right here, before anything reads them. The
  // store seed below reads the clone's app/data DB — unaffected (P1:
  // app/ did not move).
  try {
    const migration = migrateLayout(news)
    for (const l of migration.log) console.log(`  migrate-layout: ${l}`)
  } catch (e) {
    // A mid-migration failure leaves a half-created instance behind.
    // Never auto-delete — surface the state and let the user dispose of
    // it (the exists-guard above would otherwise block a silent retry).
    console.error(`sandbox: layout migration failed: ${e instanceof Error ? e.message : e}`)
    console.error(`sandbox: ${dir} is half-created (unmigrated clone, no seeded store) — `
      + `remove it and retry: rm -rf ${dir}`)
    return 1
  }
  // Seed the sandbox DB. The checkout's own DB is gitignored upstream
  // (a rebuildable cache), so the clone won't carry one — fall back to
  // the source checkout's working tree, then to the main store's copy.
  const mainStore = resolveDataDir().dir
  const seedCandidates = [
    newsDbFile(news),                                    // clone carried one
    newsDbFile(src),                                     // source working tree
    mainStore ? worldDbFile(mainStore) : null,           // migrated main copy
  ].filter((p): p is string => p !== null && existsSync(p))
  if (!seedCandidates.length) {
    console.error('sandbox: no analytics.sqlite to seed from (checkout carries none, '
      + 'main store has none) — run `just news-migrate-db` first or provide a DB')
    return 1
  }
  const seed = seedCandidates[0]
  integrityCheck(seed)
  const target = worldDbFile(store)
  mkdirSync(join(store, 'world'), { recursive: true })
  copyFileSync(seed, target)
  integrityCheck(target)
  console.log(`seeded ${target} from ${seed} (${statSync(target).size} bytes, integrity ok)`)
  console.log('')
  console.log('sandbox ready. Run with either:')
  console.log(`  just news-daily "${dir}"`)
  console.log(`  NS_SANDBOX="${dir}" nunc-fluens run [--date D] [--replay] …`)
  return 0
}

interface SandboxPaths { newsRepo: string; dataDir: string }

/** Resolve and validate the run target. Never the view checkout. */
function requireSandbox(dirArg: string | null): SandboxPaths {
  const dir = dirArg ?? process.env.NS_SANDBOX ?? null
  if (!dir)
    throw new Error(
      'run refuses to start without a sandbox: pass --sandbox <dir> (or set NS_SANDBOX).\n'
      + 'The pipeline never runs against the view checkout (Phase C redirection) — '
      + 'create an instance with: just news-sandbox <dir>')
  const newsRepo = join(dir, 'news')
  const dataDir = join(dir, 'store')
  if (!existsSync(newsRepo) || !existsSync(worldDbFile(dataDir)))
    throw new Error(
      `sandbox at ${dir} is missing news/ or store/world/analytics.sqlite — `
      + 'create it with: just news-sandbox <dir>')
  const view = resolveNewsRepo()
  if (view && existsSync(view)
    && realpathSync(view) === realpathSync(newsRepo))
    throw new Error(
      `refusing to run: the sandbox news dir resolves to the view checkout (${view}). `
      + 'The view source is read-only; runs target disposable copies only.')
  // Run side is single-shape (P3): refuse pre-refactor instances instead
  // of half-reading them.
  if (detectShape(newsRepo) === 'old')
    throw new Error(
      `sandbox at ${dir} still carries the old news layout (report/, docs/data) — `
      + `convert it first with: nunc-fluens migrate-layout ${dir} `
      + '(or recreate it: just news-sandbox <fresh-dir>)')
  // A MIXED tree (data/ present but old-shape dirs left behind) is an
  // interrupted migration — detectShape says 'new', but a run would
  // ENOENT on the unmoved classes (or worse, silently skip them).
  // Refuse and point at the finisher.
  if (detectShape(newsRepo) === 'new') {
    const leftovers = [OLD_REPORT_DIR, OLD_FP_DIR, OLD_MEMORY_DIR, OLD_REFERENCE_DIR, OLD_DOCS_DIR]
      .filter(d => existsSync(join(newsRepo, d)))
    if (leftovers.length)
      throw new Error(
        `sandbox at ${dir} is only half-migrated: old-shape ${leftovers.join(', ')} `
        + 'still present beside data/ — finish the conversion with: '
        + `nunc-fluens migrate-layout ${dir}`)
  }
  return { newsRepo, dataDir }
}

/** Convert an existing instance to the data/ layout. Accepts either the
 * sandbox dir (operates on its news/ clone) or a checkout dir directly.
 * The linked view checkout is refused — it is never written. */
function cmdMigrateLayout(dir: string | undefined): number {
  if (!dir) { console.error('usage: nunc-fluens migrate-layout <sandbox-or-checkout-dir>'); return 2 }
  if (!existsSync(dir)) { console.error(`migrate-layout: no such directory: ${dir}`); return 1 }
  const target = existsSync(join(dir, 'news', '.git')) ? join(dir, 'news') : dir
  const view = resolveNewsRepo()
  if (view && existsSync(view) && realpathSync(view) === realpathSync(target)) {
    console.error(`migrate-layout: ${target} is the linked view checkout — read-only, `
      + 'never migrated (the view side supports the old shape as-is)')
    return 1
  }
  try {
    const r = migrateLayout(target)
    for (const l of r.log) console.log(`  ${l}`)
    console.log(r.migrated
      ? `migrated ${target} to the data/ layout`
      : `${target}: nothing to migrate`)
    return 0
  } catch (e) {
    console.error(`migrate-layout: ${e instanceof Error ? e.message : e}`)
    return 1
  }
}

async function cmdRun(argv: string[]): Promise<number> {
  const opts = {
    date: new Date().toISOString().slice(0, 10), replay: false, dryRun: false,
    only: null as string | null, sandbox: null as string | null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--date') opts.date = argv[++i]
    else if (a === '--replay') opts.replay = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--only') opts.only = argv[++i]
    else if (a === '--sandbox') opts.sandbox = argv[++i]
    else { console.error(`run: unknown flag ${a}`); return 2 }
  }
  let box: SandboxPaths
  try {
    box = requireSandbox(opts.sandbox)
  } catch (e) {
    console.error(`run: ${e instanceof Error ? e.message : e}`)
    return 1
  }
  // Runtime/search pair from the settings file in the MAIN data store
  // (S-3; the gate API and Formans drawer read/write that file) — the
  // pair is user preference, not sandbox state. Defaults apply when no
  // main store is configured.
  const mainStore = resolveDataDir().dir
  let newsCfg: Record<string, unknown> = {}
  if (mainStore) {
    const newsConfigFile = join(worldDir(mainStore), 'news-config.json')
    if (existsSync(newsConfigFile)) newsCfg = JSON.parse(readFileSync(newsConfigFile, 'utf8'))
  }
  const runtime = (newsCfg.runtime as string) ?? 'claude-code'
  const search = (newsCfg.search as string) === 'external'
    ? (newsCfg.searchEngine as string) ?? 'brave'
    : 'native'
  const synthModel = (newsCfg.synthModel as string) ?? null
  // Locale model (post-C P5): EN + the configured subset of ja/es/fil.
  // Absent key = the full trio (today's behavior). Invalid content is a
  // refusal, not a guess — the drawer/gate validate writes, but the
  // file is hand-editable.
  let locales: readonly string[]
  try {
    locales = resolveLocaleSet(newsCfg.locales)
  } catch (e) {
    console.error(`run: refusing to start — news-config.json 'locales' is invalid: `
      + `${e instanceof Error ? e.message : e}`)
    return 1
  }

  // Relative source import: node refuses to type-strip files under
  // node_modules, so the workspace-linked 'nunc-ai' specifier only
  // works in vitest. The relative path bypasses node_modules entirely.
  const { createAi } = await import('../../../../frontend/packages/ai/src/index.ts') as
    typeof import('nunc-ai')
  const { runDay } = await import('./orchestrator/dag.ts')
  const ai = opts.replay ? null : createAi({ runLogFile: runLogFile(box.dataDir) })
  const r = await runDay({
    date: opts.date,
    dataDir: box.dataDir,
    newsRepo: box.newsRepo,
    ai, runtime, search, synthModel, locales,
    replay: opts.replay,
    dryRun: opts.dryRun,
    only: opts.only,
  })
  console.log(`run ${opts.date}: ${r.ok ? 'OK' : `FAILED at ${r.failedStep}`} — manifest ${r.manifestPath}`)
  return r.ok ? 0 : 1
}

const argvRest = process.argv.slice(3)
let code: number
switch (cmd) {
  case 'link': code = cmdLink(arg); break
  case 'status': code = cmdStatus(); break
  case 'migrate-db': code = cmdMigrateDb(); break
  case 'validate': code = cmdValidate(arg); break
  case 'sandbox': code = cmdSandbox(arg); break
  case 'migrate-layout': code = cmdMigrateLayout(arg); break
  case 'run': code = await cmdRun(argvRest); break
  default:
    console.error('usage: nunc-fluens link <dir> | status | migrate-db | validate <date> | sandbox <dir> | migrate-layout <dir> | run --sandbox <dir> [--date D] [--replay] [--dry-run] [--only step]')
    code = 2
}
process.exit(code)
