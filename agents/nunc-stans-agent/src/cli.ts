#!/usr/bin/env node
// nunc-stans-agent — first-party terminal agent (Phase D, v1 plan §2.11).
// chat: streaming REPL, profile-driven, memory EXCLUSIVELY through the
// manda MCP gateway (commit approval is interactive — manda's elicitation
// lands here as a real terminal prompt). doctor: environment check.
// mandate-template: prints a grant line for the PRINCIPAL to append —
// never writes it (mandates are out-of-band only).
import { createInterface } from 'node:readline'
import { mkdirSync } from 'node:fs'
import * as path from 'node:path'
import { MandaMemory, acceptContentFor, resolveMandaBin } from './memory.ts'
import { resolveMandaDataDir } from '../../../tools/lib/data-dir.ts'
import { mandateJsonl } from '../../../tools/lib/mandate.ts'
import { HELP, describeMandates, runTurn } from './chat.ts'
import type { AgentSession, TurnIO } from './chat.ts'

const [cmd, ...rest] = process.argv.slice(2)

function usage(): never {
  console.log('usage: nunc-stans-agent <chat [--profile <id>] | doctor | mandate-template [scope]>')
  process.exit(2)
}

async function loadDataLayer() {
  const { createAi, resolveProfile } = await import('../../../frontend/packages/ai/src/index.ts')
  const { resolveDataDir } = await import('../../../tools/lib/data-dir.ts')
  const resolved = resolveDataDir()
  if (resolved.warning) console.error(resolved.warning)
  if (!resolved.dir) throw new Error('no data store resolvable — set NS_DATA or run just bootstrap')
  return { createAi, resolveProfile, dataDir: resolved.dir }
}

async function cmdChat(argv: string[]): Promise<number> {
  let explicitProfile: string | undefined
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile') explicitProfile = argv[++i]
    else { console.error(`chat: unknown flag ${argv[i]}`); return 2 }
  }
  const { createAi, resolveProfile, dataDir } = await loadDataLayer()
  const profile = resolveProfile(dataDir, 'agents', explicitProfile)
    ?? { id: 'adhoc-mock', name: 'Ad-hoc mock', provider: 'mock' as const }
  const ai = createAi({ runLogFile: path.join(dataDir, 'runs', 'ai-runs.jsonl') })

  // Line-queued input: readline drops lines that arrive while no
  // question is pending (exactly what piped/scripted stdin does — the
  // S-11 transcript runs that way), so queue them and hand them to the
  // next ask. Interactive TTY behavior is unchanged. A closed stdin
  // answers '/exit' so both the main loop and any pending approval
  // prompt terminate safely (an approval that reads '/exit' declines).
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const pendingLines: string[] = []
  const waiters: Array<(s: string) => void> = []
  let stdinClosed = false
  rl.on('line', l => {
    const w = waiters.shift()
    if (w) w(l)
    else pendingLines.push(l)
  })
  rl.on('close', () => {
    stdinClosed = true
    while (waiters.length) waiters.shift()!('/exit')
  })
  const nextLine = (prompt: string): Promise<string> => {
    process.stdout.write(prompt)
    const queued = pendingLines.shift()
    if (queued !== undefined) { process.stdout.write(`${queued}\n`); return Promise.resolve(queued) }
    if (stdinClosed) return Promise.resolve('/exit')
    return new Promise(res => waiters.push(res))
  }

  const io: TurnIO = {
    out: s => process.stdout.write(s),
    thinking: s => process.stdout.write(`\x1b[2m${s}\x1b[0m`),
    meta: s => console.log(`\x1b[36m${s}\x1b[0m`),
    ask: q => nextLine(q),
  }

  // Memory: the manda gateway, ON by default whenever a binary resolves
  // (the data dir always resolves — <data store>/manda unless overridden).
  // OFF only when no binary is found. Elicitation (manda asking the
  // principal to approve a commit) rides the same terminal: an explicit
  // yes approves, anything else declines.
  let memory: MandaMemory | null = null
  const bin = resolveMandaBin()
  const mandaDataDir = resolveMandaDataDir()
  if (bin) {
    mkdirSync(mandaDataDir, { recursive: true })
    memory = await MandaMemory.connect({
      dataDir: mandaDataDir,
      bin,
      approver: async ({ message, requestedSchema }) => {
        const q = `${message ?? 'manda asks: approve this commit?'} [y/N] `
        const a = (await io.ask(q)).trim().toLowerCase()
        return a === 'y' || a === 'yes'
          ? { action: 'accept', content: acceptContentFor(requestedSchema) }
          : { action: 'decline' }
      },
    })
  }

  console.log(`nunc-stans-agent — profile ${profile.id} → ${profile.provider}${profile.model ? ` / ${profile.model}` : ''}`)
  if (memory) {
    io.meta(describeMandates(await memory.mandateList()))
  } else {
    io.meta('memory OFF: no manda binary (run `just setup`, or set MANDA_BIN — see the README)')
  }
  io.meta(HELP)

  const session: AgentSession = { ai, profile, memory, history: [], io }
  try {
    for (;;) {
      const line = await nextLine('\x1b[1myou ▸\x1b[0m ')
      let keep: boolean
      try {
        keep = await runTurn(session, line)
      } catch (e) {
        io.meta(`error: ${e instanceof Error ? e.message : e}`)
        keep = true
      }
      if (!keep) break
      if (stdinClosed && pendingLines.length === 0) break
    }
  } finally {
    rl.close()
    await memory?.close()
  }
  return 0
}

async function cmdDoctor(): Promise<number> {
  const bin = resolveMandaBin()
  const dataDir = resolveMandaDataDir()
  console.log(`manda binary : ${bin ?? 'NOT FOUND (run just setup, or set MANDA_BIN)'}`)
  console.log(`data dir     : ${dataDir}`)
  console.log(`approval mode: ${process.env.MANDA_APPROVAL ?? 'elicit (default)'}`)
  if (bin) {
    mkdirSync(dataDir, { recursive: true })
    try {
      const memory = await MandaMemory.connect({ dataDir, bin })
      console.log(describeMandates(await memory.mandateList()))
      await memory.close()
    } catch (e) {
      console.log(`mandate check: FAILED — ${e instanceof Error ? e.message : e}`)
      return 1
    }
  }
  return bin ? 0 : 1
}

switch (cmd) {
  case 'chat':
    cmdChat(rest).then(c => process.exit(c), e => { console.error(`chat: ${e instanceof Error ? e.message : e}`); process.exit(1) })
    break
  case 'doctor':
    cmdDoctor().then(c => process.exit(c), e => { console.error(`doctor: ${e instanceof Error ? e.message : e}`); process.exit(1) })
    break
  case 'mandate-template': {
    // Prints a filled mandates.jsonl line for the PRINCIPAL to append by
    // hand. Never writes it — mandates are granted out-of-band only (A1).
    const scope = rest[0] ?? 'notes/*'
    console.log('# append this ONE line to $MANDA_DATA_DIR/mandates.jsonl yourself (expiry: 30 days):')
    console.log(mandateJsonl(scope, new Date()))
    process.exit(0)
    break
  }
  default:
    usage()
}
