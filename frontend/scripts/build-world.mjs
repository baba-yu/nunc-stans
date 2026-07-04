// Federation-side world adapter (constitution §13-B: conversion is written on
// the federation side; News is never asked to change its output format).
//
// News's export.py writes a heavy node/link graph (graph-mix.json, ~26 MB) as
// the world source of truth (a rebuildable cache, external to this monorepo —
// see the News engine's FEDERATION note). Federation:Phase 3 drops the GitHub
// Pages target and serves that output locally: this script reads the graph,
// flattens the prediction nodes into the minimal headline shape the ME world
// view needs, and writes it under the served static dir.
//
// Input path comes from $NEWS_WORLD (a graph JSON file, or a dir containing
// graph-mix.json). If unset or missing, we write an empty list so `just up`
// still works and the world view degrades gracefully rather than failing.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = join(here, '..', 'public', 'world-headlines.json')

function resolveInput() {
  const p = process.env.NEWS_WORLD
  if (!p) return null
  if (!existsSync(p)) return null
  return statSync(p).isDirectory() ? join(p, 'graph-mix.json') : p
}

function write(list) {
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify(list, null, 2) + '\n')
}

const input = resolveInput()
if (!input || !existsSync(input)) {
  console.warn(
    `[build-world] NEWS_WORLD not set or graph not found; writing empty world list.\n` +
      `             Set NEWS_WORLD to News's exported graph (e.g. ~/news/docs/data/graph-mix.json) to populate the world view.`,
  )
  write([])
  process.exit(0)
}

// A file that exists but is corrupt/truncated (e.g. read mid-write while News
// is exporting) must degrade like the missing-file case, not crash `just up`.
let graph
try {
  graph = JSON.parse(readFileSync(input, 'utf8'))
} catch (e) {
  console.warn(`[build-world] could not parse ${input} (${e.message}); writing empty world list.`)
  write([])
  process.exit(0)
}
const nodes = Array.isArray(graph.nodes) ? graph.nodes : []

// First non-blank string among the candidates, trimmed. The engine requires a
// non-empty to_label, so the flattened label must never be blank; n.id (a
// non-empty content hash) is the guaranteed fallback.
function firstLabel(...candidates) {
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
      // The stable, content-hash prediction id becomes the world federation id
      // `world/prediction/<id>` on the informed_by edge (contracts/federation-id.md).
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
console.log(`[build-world] wrote ${headlines.length} headlines from ${input}`)
