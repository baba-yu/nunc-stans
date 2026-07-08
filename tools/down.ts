#!/usr/bin/env node
// nunc-stans down: stop the stack started by `just up`.
// Terminates whatever is LISTENING on the gate, engine, and fourfive ports,
// honoring the same NS_PORT / NS_ENGINE_PORT overrides `just up` uses
// (fourfive is fixed at :8787). SIGTERM first, then SIGKILL any survivor
// (on Windows both terminate unconditionally — there is no graceful signal).
// Idempotent: a no-op (exit 0) when nothing is running. Port-based on purpose
// so it also stops individually-started sub-recipes, not just a concurrent up.
import { execFileSync } from 'node:child_process'

const GATE_PORT = Number(process.env.NS_PORT ?? 8720)
const ENGINE_PORT = Number(process.env.NS_ENGINE_PORT ?? 8721)
const FOURFIVE_PORT = 8787
const PORTS = [GATE_PORT, ENGINE_PORT, FOURFIVE_PORT]
const PORTS_LABEL = PORTS.join('/')

function run(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

// PIDs LISTENING on a TCP port. Linux: ss, else lsof (also macOS);
// Windows: netstat -ano (the only built-in that maps ports to PIDs).
function pidsOn(port: number): number[] {
  if (process.platform === 'win32') {
    const out = run('netstat', ['-ano', '-p', 'TCP'])
    return out
      .split(/\r?\n/)
      .filter((l) => l.includes('LISTENING'))
      .map((l) => l.trim().split(/\s+/))
      .filter((f) => f[1]?.endsWith(`:${port}`))
      .map((f) => Number(f[f.length - 1]))
      .filter((pid) => Number.isInteger(pid) && pid > 0)
  }
  const ss = run('ss', ['-ltnpH', `sport = :${port}`])
  if (ss) return [...ss.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]))
  const lsof = run('lsof', ['-tnP', `-iTCP:${port}`, '-sTCP:LISTEN'])
  return lsof
    .split(/\r?\n/)
    .map((l) => Number(l))
    .filter((pid) => Number.isInteger(pid) && pid > 0)
}

function allPids(): number[] {
  return [...new Set(PORTS.flatMap(pidsOn))]
}

function signalAll(sig: 'SIGTERM' | 'SIGKILL'): void {
  for (const pid of allPids()) {
    try {
      process.kill(pid, sig)
      console.log(`down: ${sig} -> pid ${pid}`)
    } catch {
      // already gone, or not ours to kill — the port re-check decides
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

if (allPids().length === 0) {
  console.log(`down: nothing on ${PORTS_LABEL} - already down`)
  process.exit(0)
}

signalAll('SIGTERM')

// Wait up to ~5s for a graceful exit, then SIGKILL any survivor.
for (let i = 0; i < 10 && allPids().length > 0; i++) await sleep(500)

if (allPids().length > 0) {
  console.log('down: survivors after SIGTERM - sending SIGKILL')
  signalAll('SIGKILL')
  await sleep(500)
}

const left = allPids()
if (left.length === 0) {
  console.log(`down: stopped (${PORTS_LABEL} free)`)
  process.exit(0)
}
console.log(`down: WARNING - still bound: ${left.join(' ')}`)
process.exit(1)
