#!/usr/bin/env node
// nunc-fluens — the news pipeline CLI (Phase C).
//   link <dir>     designate the news data+publish checkout (config news_repo)
//   status         show resolved config and world-cache state
//   migrate-db     copy analytics.sqlite into <data store>/world/ (verified)
//   validate <date> schema-validate a day's sourcedata (incl. locales)
//   run            the daily DAG — lands with T5 (orchestrator)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  configFile, linkNewsRepo, requireConfig, requireNewsRepo,
  resolveDataDir, resolveNewsRepo, runLogFile, sourcedataDir,
  worldDbFile, worldDir,
} from './config.ts'
import { migrateDb } from './migrate.ts'
import { CANONICAL_FILES } from './schemas/sourcedata.ts'
import { REPORT_DIR } from './world-paths.ts'

function cmdLink(dir: string | undefined): number {
  if (!dir) { console.error('usage: nunc-fluens link <dir>'); return 2 }
  if (!existsSync(dir)) { console.error(`link: no such directory: ${dir}`); return 1 }
  if (!existsSync(join(dir, REPORT_DIR)))
    console.error(`warning: ${dir} has no ${REPORT_DIR}/ — is this really the news checkout?`)
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
async function cmdRun(argv: string[]): Promise<number> {
  const opts = { date: new Date().toISOString().slice(0, 10), replay: false, dryRun: false, only: null as string | null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--date') opts.date = argv[++i]
    else if (a === '--replay') opts.replay = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--only') opts.only = argv[++i]
    else { console.error(`run: unknown flag ${a}`); return 2 }
  }
  const cfg = requireConfig()
  // Runtime/search pair from the settings file (S-3; the gate API and
  // Formans drawer read/write the same file), CLI-overridable later.
  const newsConfigFile = join(worldDir(cfg.dataDir), 'news-config.json')
  let newsCfg: Record<string, unknown> = {}
  if (existsSync(newsConfigFile)) newsCfg = JSON.parse(readFileSync(newsConfigFile, 'utf8'))
  const runtime = (newsCfg.runtime as string) ?? 'claude-code'
  const search = (newsCfg.search as string) === 'external'
    ? (newsCfg.searchEngine as string) ?? 'brave'
    : 'native'
  const synthModel = (newsCfg.synthModel as string) ?? null

  // Relative source import: node refuses to type-strip files under
  // node_modules, so the workspace-linked 'nunc-ai' specifier only
  // works in vitest. The relative path bypasses node_modules entirely.
  const { createAi } = await import('../../../../frontend/packages/ai/src/index.ts') as
    typeof import('nunc-ai')
  const { runDay } = await import('./orchestrator/dag.ts')
  const ai = opts.replay ? null : createAi({ runLogFile: runLogFile(cfg.dataDir) })
  const r = await runDay({
    date: opts.date,
    dataDir: cfg.dataDir,
    newsRepo: cfg.newsRepo,
    ai, runtime, search, synthModel,
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
  case 'run': code = await cmdRun(argvRest); break
  default:
    console.error('usage: nunc-fluens link <dir> | status | migrate-db | validate <date> | run [--date D] [--replay] [--dry-run] [--only step]')
    code = 2
}
process.exit(code)
