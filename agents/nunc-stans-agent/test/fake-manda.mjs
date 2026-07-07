#!/usr/bin/env node
// fake-manda: a stdio JSON-RPC stub mirroring the manda gateway's contract
// closely enough to exercise the agent's client logic on all 3 CI OSes with
// no Rust binary: lane writes, origin refusal ("no commit authority"),
// mandate refusal ("no active write mandate"), expiry lapse, and the ≤3
// read surface. Semantics per ~/manda README + scripts/smoke.sh. The REAL
// elicitation handshake is deliberately not simulated here — that is the
// live-binary probe's job (test/manda-live.test.ts).
import { createInterface } from 'node:readline'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dataDir = process.env.MANDA_DATA_DIR
if (!dataDir) { console.error('fake-manda: MANDA_DATA_DIR required'); process.exit(2) }
mkdirSync(dataDir, { recursive: true })

const lane = name => join(dataDir, `${name}.jsonl`)
const readLane = name => !existsSync(lane(name)) ? [] :
  readFileSync(lane(name), 'utf8').split('\n').filter(Boolean).flatMap(l => {
    try { return [JSON.parse(l)] } catch { return [] } // malformed lines skipped, like manda
  })
const writeLane = (name, obj) => appendFileSync(lane(name), JSON.stringify(obj) + '\n')

const scopeCovers = (grant, scope) =>
  grant === scope || (grant.endsWith('/*') && (scope === grant.slice(0, -2) || scope.startsWith(grant.slice(0, -1))))

const activeWriteMandate = scope => readLane('mandates').find(m =>
  m.scope && scopeCovers(m.scope, scope) &&
  (m.access ?? []).includes('write') && !m.revoked_at &&
  m.expires_at && new Date(m.expires_at).getTime() > Date.now())

const TOOLS = ['memory_append', 'memory_propose', 'memory_commit', 'memory_read',
  'edge_append', 'edge_list', 'mandate_list']

let candSeq = readLane('candidates').length

function callTool(name, args = {}) {
  const text = (obj, isError = false) =>
    ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], isError })
  switch (name) {
    case 'memory_append':
      writeLane('events', { scope: args.scope, kind: args.kind, content: args.content, ts: new Date().toISOString() })
      return text({ status: 'appended' })
    case 'memory_propose': {
      const id = `cand-${++candSeq}`
      writeLane('candidates', { id, scope: args.scope, kind: args.kind, content: args.content })
      return text({ status: 'proposed', id })
    }
    case 'memory_commit': {
      const cand = readLane('candidates').find(c => c.id === args.candidate_id)
      if (!cand) return text('unknown candidate', true)
      if (!/^user_(origin|approved|modified|rejected)$/.test(args.origin ?? ''))
        return text('denied: no commit authority for a non-principal origin', true)
      const mandate = activeWriteMandate(cand.scope)
      if (!mandate) return text('denied: no active write mandate covers ' + cand.scope, true)
      writeLane('committed', { id: cand.id, scope: cand.scope, content: cand.content, origin: args.origin, origin_verified: false, mandate: mandate.id })
      return text({ status: 'under_mandate', id: cand.id, mandate: mandate.id, origin_verified: false })
    }
    case 'memory_read': {
      const rows = readLane('committed').filter(r => r.scope === args.scope)
      return text({ surfaced: rows.slice(0, 3), suppressed: Math.max(0, rows.length - 3) })
    }
    case 'edge_append':
      writeLane('edges', { ...args, author: 'agent' })
      return text({ status: 'appended', author: 'agent' })
    case 'edge_list':
      return text({ edges: readLane('edges') })
    case 'mandate_list':
      return text({ mandates: readLane('mandates').map(m => ({ ...m, active: Boolean(activeWriteMandate(m.scope)) })) })
    default:
      return text(`unknown tool ${name}`, true)
  }
}

const rl = createInterface({ input: process.stdin })
const send = obj => process.stdout.write(JSON.stringify(obj) + '\n')
rl.on('line', line => {
  if (!line.trim()) return
  let msg
  try { msg = JSON.parse(line) } catch { return }
  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: {
      protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'fake-manda', version: '0.0.1' },
    } })
  } else if (msg.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS.map(name => ({ name, inputSchema: { type: 'object' } })) } })
  } else if (msg.method === 'tools/call') {
    send({ jsonrpc: '2.0', id: msg.id, result: callTool(msg.params?.name, msg.params?.arguments) })
  } else if (msg.id !== undefined) {
    send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `unhandled ${msg.method}` } })
  }
})
