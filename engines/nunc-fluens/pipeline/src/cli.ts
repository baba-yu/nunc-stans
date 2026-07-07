#!/usr/bin/env node
// nunc-fluens — the news pipeline CLI (Phase C; instance model V2).
//   link <dir|name>         designate the read-only view source (an instance)
//   status                  show resolved config and world-cache state
//   validate <date>         schema-validate a day's sourcedata (incl. locales)
//   init <dir|name>         create a data instance from the engine template
//   import <src> <instance> copy a news-shaped checkout's data into an instance
//   run                     the daily DAG — always against a data instance
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  configFile, linkNewsRepo, requireNewsRepo,
  resolveDataDir, resolveNewsRepo, runLogFile, sourcedataDir,
  worldDbFile, worldDir,
} from './config.ts'
import { CANONICAL_FILES } from './schemas/sourcedata.ts'
import {
  DAILY_NEWS_REL, EXPORTS_REL, resolveLocaleSet,
} from './world-paths.ts'
import {
  initInstance, requireInstance, resolveInstanceDir, type InstancePaths,
} from './instance.ts'
import { importNewsCheckout } from './import.ts'

function cmdLink(arg: string | undefined): number {
  if (!arg) { console.error('usage: nunc-fluens link <dir|name>'); return 2 }
  // Bare names are CLI-level sugar for the engine's instances/ home —
  // the same resolution init/import/run use (resolveInstanceDir).
  const dir = resolveInstanceDir(arg)
  if (!existsSync(dir)) { console.error(`link: no such directory: ${dir}`); return 1 }
  // The view source is an instance checkout (R6: old-shape view support
  // removed — news-shaped checkouts are brought over via `import`).
  if (!existsSync(join(dir, DAILY_NEWS_REL)) && !existsSync(join(dir, EXPORTS_REL)))
    console.error(`warning: ${dir} has neither ${DAILY_NEWS_REL}/ nor `
      + `${EXPORTS_REL}/ — is this really a nunc-fluens instance?`)
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
    console.log(`world db    : ${existsSync(db) ? `${db} (${statSync(db).size} bytes)` : '(absent)'}`)
  }
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

/** Create a v2 data instance from pipeline/instance-template/ (R1). A
 * bare name resolves under engines/nunc-fluens/instances/. */
function cmdInit(arg: string | undefined): number {
  if (!arg) { console.error('usage: nunc-fluens init <dir|name>'); return 2 }
  const dir = resolveInstanceDir(arg)
  try {
    const r = initInstance(dir)
    for (const l of r.log) console.log(`  ${l}`)
    console.log(`instance ready at ${dir}`)
    console.log('')
    console.log('run with:')
    console.log(`  NS_INSTANCE="${dir}" nunc-fluens run [--date D] [--replay] …`)
    console.log(`bring existing news data over with: nunc-fluens import <src> "${dir}"`)
    return 0
  } catch (e) {
    console.error(`init: ${e instanceof Error ? e.message : e}`)
    return 1
  }
}

/** Copy a news-shaped checkout's data into an init-born instance (R4).
 * The source is read-only; the instance gets one import commit. */
function cmdImport(src: string | undefined, instArg: string | undefined): number {
  if (!src || !instArg) {
    console.error('usage: nunc-fluens import <news-shaped-src> <instance-dir|name>')
    return 2
  }
  const instance = resolveInstanceDir(instArg)
  try {
    const r = importNewsCheckout(src, instance)
    for (const l of r.log) console.log(`  ${l}`)
    console.log(`imported ${src} into ${instance} (source untouched)`)
    return 0
  } catch (e) {
    console.error(`import: ${e instanceof Error ? e.message : e}`)
    return 1
  }
}

/** Refusal-style JSON read for the hand-placed news-config files:
 * invalid content is a refusal naming the offending file, not a raw
 * JSON.parse stack (mirrors the locales refusal in cmdRun). */
function readNewsConfig(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch (e) {
    console.error(`run: refusing to start — ${path} is not valid JSON: `
      + `${e instanceof Error ? e.message : e}`)
    return null
  }
}

async function cmdRun(argv: string[]): Promise<number> {
  const opts = {
    date: new Date().toISOString().slice(0, 10), replay: false, dryRun: false,
    only: null as string | null, instance: null as string | null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--date') opts.date = argv[++i]
    else if (a === '--replay') opts.replay = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--only') opts.only = argv[++i]
    else if (a === '--instance') opts.instance = argv[++i]
    else { console.error(`run: unknown flag ${a}`); return 2 }
  }
  let box: InstancePaths
  try {
    box = requireInstance(opts.instance)
  } catch (e) {
    console.error(`run: ${e instanceof Error ? e.message : e}`)
    return 1
  }
  // Runtime/search/locale settings (S-3): the instance's own
  // store/news-config.json wins when present (R3); otherwise the MAIN
  // store's copy — the defaults the gate API and Formans drawer edit.
  // A per-profile gate API is a recorded follow-up; until then the
  // override file is hand-placed. Defaults apply when neither exists.
  let newsCfg: Record<string, unknown> = {}
  const instanceCfg = join(box.storeDir, 'news-config.json')
  if (existsSync(instanceCfg)) {
    const parsed = readNewsConfig(instanceCfg)
    if (parsed === null) return 1
    newsCfg = parsed
  } else {
    const mainStore = resolveDataDir().dir
    if (mainStore) {
      const mainCfg = join(worldDir(mainStore), 'news-config.json')
      if (existsSync(mainCfg)) {
        const parsed = readNewsConfig(mainCfg)
        if (parsed === null) return 1
        newsCfg = parsed
      }
    }
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
  // The AI call log rides the INSTANCE store (R3): store/runs/ai-runs.jsonl.
  const ai = opts.replay ? null : createAi({ runLogFile: runLogFile(box.storeDir) })
  const r = await runDay({
    date: opts.date,
    dataDir: box.storeDir,
    newsRepo: box.root,
    ai, runtime, search, synthModel, locales,
    replay: opts.replay,
    dryRun: opts.dryRun,
    only: opts.only,
  })
  console.log(`run ${opts.date}: ${r.ok ? 'OK' : `FAILED at ${r.failedStep}`} — manifest ${r.manifestPath}`)
  return r.ok ? 0 : 1
}

const [cmd, arg, arg2] = process.argv.slice(2)
const argvRest = process.argv.slice(3)
let code: number
switch (cmd) {
  case 'link': code = cmdLink(arg); break
  case 'status': code = cmdStatus(); break
  case 'validate': code = cmdValidate(arg); break
  case 'init': code = cmdInit(arg); break
  case 'import': code = cmdImport(arg, arg2); break
  case 'run': code = await cmdRun(argvRest); break
  default:
    console.error('usage: nunc-fluens link <dir|name> | status | validate <date> | init <dir|name> | import <src> <instance> | run --instance <dir|name> [--date D] [--replay] [--dry-run] [--only step]')
    code = 2
}
process.exit(code)
