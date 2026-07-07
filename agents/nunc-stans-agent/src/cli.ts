#!/usr/bin/env node
// nunc-stans-agent — first-party terminal agent (Phase D).
// v0 surface: chat (T9), doctor, mandate-template. Memory goes exclusively
// through the manda MCP gateway (contracts/agent-abi.md).
import { resolveMandaBin } from './memory.ts'

const [cmd, ...rest] = process.argv.slice(2)

function usage(): never {
  console.log('usage: nunc-stans-agent <chat [--profile <id>] | doctor | mandate-template [scope]>')
  process.exit(2)
}

switch (cmd) {
  case 'doctor': {
    const bin = resolveMandaBin()
    console.log(`manda binary : ${bin ?? 'NOT FOUND (set MANDA_BIN or install manda on PATH)'}`)
    console.log(`data dir     : ${process.env.MANDA_DATA_DIR ?? '(unset — the chat command will refuse)'}`)
    console.log(`approval mode: ${process.env.MANDA_APPROVAL ?? 'elicit (default)'}`)
    process.exit(bin ? 0 : 1)
  }
  case 'mandate-template': {
    // Prints a filled mandates.jsonl line for the PRINCIPAL to append by
    // hand. Never writes it — mandates are granted out-of-band only (A1).
    const scope = rest[0] ?? 'notes/*'
    const now = new Date()
    const expires = new Date(now.getTime() + 30 * 24 * 3600 * 1000)
    const line = {
      id: `m-${now.toISOString().slice(0, 10)}-${scope.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
      scope,
      access: ['read', 'write'],
      external_side_effects: false,
      granted_at: now.toISOString(),
      expires_at: expires.toISOString(),
    }
    console.log('# append this ONE line to $MANDA_DATA_DIR/mandates.jsonl yourself (expiry: 30 days):')
    console.log(JSON.stringify(line))
    process.exit(0)
  }
  case 'chat':
    console.error('chat lands at T9 (see design/development/2026-07-07-phase-d-plan.md)')
    process.exit(1)
  default:
    usage()
}
