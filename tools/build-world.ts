#!/usr/bin/env node
// World adapter (constitution §13-B: conversion is written on the Nunc Stans
// side; News is never asked to change its output format). Two jobs:
//
// 1. Flatten News's exported prediction graph into the minimal headline list
//    the world view reads (world-headlines.json).
// 2. Stage the News dashboard (docs/ of the configured news checkout) plus
//    its data directory into the formans public dir so the world view can
//    wrap it as-is at /world-graph/ — with d3 vendored locally, because the
//    product allows no CDN dependency (§10-B: one origin, local).
//
// The source is the user-designated news checkout (`just news-link <dir>`,
// config key news_repo, env override NS_NEWS_REPO) — a READ-ONLY path: per
// the Phase C redirection the dev repo never writes the real checkout, but
// displaying its current data through the world view is a guaranteed,
// permanent feature (the owner's news board keeps living there). NEWS_WORLD
// is retired. Unset or missing ⇒ empty headline list and the stage is
// removed, so `just up` still works and the world view degrades honestly.
// This script lives in tools/ (not frontend/) because it legitimately names
// engine/tool paths — FD-7.4 keeps frontend/ itself engine-free.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveNewsRepo } from './lib/data-dir.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const formansPublic = join(root, 'frontend', 'nunc-stans-formans', 'public')
const outFile = join(formansPublic, 'world-headlines.json')
const stageDir = join(formansPublic, 'world-graph')

const newsRepo = resolveNewsRepo()
const dashboardSrc = newsRepo ? join(newsRepo, 'docs') : null

function resolveInput(): string | null {
  if (process.env.NEWS_WORLD)
    console.warn('[build-world] NEWS_WORLD is retired and ignored — the news '
      + 'checkout comes from `just news-link <dir>` (or NS_NEWS_REPO).')
  if (!dashboardSrc) return null
  const p = join(dashboardSrc, 'data', 'graph-mix.json')
  return existsSync(p) ? p : null
}

function write(list: unknown[]) {
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify(list, null, 2) + '\n')
}

// Copy src → dest only when missing or stale (size/mtime): the mix graph is
// ~26 MB and this runs on every `just up`. Returns 1 when a copy happened.
function copyFresh(src: string, dest: string): number {
  const s = statSync(src)
  try {
    const d = statSync(dest)
    if (d.size === s.size && d.mtimeMs >= s.mtimeMs) return 0
  } catch {
    /* dest missing */
  }
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest)
  return 1
}

function copyTreeFresh(srcDir: string, destDir: string): [number, number] {
  let copied = 0
  let total = 0
  for (const e of readdirSync(srcDir, { recursive: true, encoding: 'utf8' })) {
    const s = join(srcDir, e)
    if (statSync(s).isDirectory()) continue
    total++
    copied += copyFresh(s, join(destDir, e))
  }
  return [copied, total]
}

const input = resolveInput()
if (!input || !existsSync(input) || !dashboardSrc) {
  console.warn(
    '[build-world] no news checkout configured (or no exported graph in it); '
    + 'writing an empty world list and removing the stage.\n'
    + '             Run: just news-link <dir>  (or set NS_NEWS_REPO).',
  )
  write([])
  rmSync(stageDir, { recursive: true, force: true })
  process.exit(0)
}

// A file that exists but is corrupt/truncated (e.g. read mid-write while News
// is exporting) must degrade like the missing-file case, not crash `just up`.
// The stage is left as-is: yesterday's dashboard beats none.
let graph: { nodes?: unknown }
try {
  graph = JSON.parse(readFileSync(input, 'utf8'))
} catch (e) {
  console.warn(`[build-world] could not parse ${input} (${(e as Error).message}); writing an empty world list.`)
  write([])
  process.exit(0)
}
const nodes: any[] = Array.isArray(graph.nodes) ? graph.nodes : []

// First non-blank string among the candidates, trimmed. The engine requires a
// non-empty to_label, so the flattened label must never be blank; n.id (a
// non-empty content hash) is the guaranteed fallback.
function firstLabel(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

const headlines = nodes
  .filter((n) => n && n.type === 'prediction' && typeof n.id === 'string' && n.id)
  .map((n) => {
    const d = n.detail ?? {}
    return {
      // The stable, content-hash prediction id becomes the world scope id
      // `world/prediction/<id>` on the informed_by edge (contracts/scope-id.md).
      id: n.id,
      label: firstLabel(n.short_label, n.label, d.title, n.id) ?? n.id,
      scope: typeof n.scope_id === 'string' ? n.scope_id : null,
      summary: firstLabel(d.summary_short),
      date: typeof d.prediction_date === 'string' ? d.prediction_date : null,
    }
  })
  // Newest first. This is a factual, chronological order — NOT an AI relevance
  // ranking, which §10-C forbids ("the AI neither reorders nor recommends").
  .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))

write(headlines)
console.log(`[build-world] wrote ${headlines.length} headlines from ${input} (read-only source)`)

// --- stage the dashboard, as-is except the d3 script goes local ---
let copied = 0
const html = readFileSync(join(dashboardSrc, 'index.html'), 'utf8').replace(
  'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js',
  'assets/d3.min.js',
)
mkdirSync(join(stageDir, 'assets'), { recursive: true })
const destHtml = join(stageDir, 'index.html')
if (!existsSync(destHtml) || readFileSync(destHtml, 'utf8') !== html) {
  writeFileSync(destHtml, html)
  copied++
}
copied += copyFresh(join(root, 'node_modules', 'd3', 'dist', 'd3.min.js'), join(stageDir, 'assets', 'd3.min.js'))
copied += copyTreeFresh(join(dashboardSrc, 'assets'), join(stageDir, 'assets'))[0]
const favicon = join(dashboardSrc, 'favicon.svg')
if (existsSync(favicon)) copied += copyFresh(favicon, join(stageDir, 'favicon.svg'))
const [dataCopied, dataTotal] = copyTreeFresh(dirname(input), join(stageDir, 'data'))
copied += dataCopied
console.log(
  `[build-world] staged dashboard + data at public/world-graph/: ${copied} file(s) copied, ${dataTotal} data file(s) checked${copied === 0 ? ' (all fresh)' : ''}`,
)
