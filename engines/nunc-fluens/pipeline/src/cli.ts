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
  resolveDataDir, resolveNewsRepo, sourcedataDir, worldDbFile,
} from './config.ts'
import { migrateDb } from './migrate.ts'
import { CANONICAL_FILES } from './schemas/sourcedata.ts'

function cmdLink(dir: string | undefined): number {
  if (!dir) { console.error('usage: nunc-fluens link <dir>'); return 2 }
  if (!existsSync(dir)) { console.error(`link: no such directory: ${dir}`); return 1 }
  if (!existsSync(join(dir, 'report')))
    console.error(`warning: ${dir} has no report/ — is this really the news checkout?`)
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
let code: number
switch (cmd) {
  case 'link': code = cmdLink(arg); break
  case 'status': code = cmdStatus(); break
  case 'migrate-db': code = cmdMigrateDb(); break
  case 'validate': code = cmdValidate(arg); break
  case 'run':
    console.error('run: not implemented yet - the orchestrator lands with Phase C T5')
    code = 2
    break
  default:
    console.error('usage: nunc-fluens link <dir> | status | migrate-db | validate <date> | run')
    code = 2
}
process.exit(code)
