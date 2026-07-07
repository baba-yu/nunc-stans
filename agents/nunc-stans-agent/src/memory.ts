// manda MCP client — the agent's ONLY memory path (v1 plan §2.11).
// Speaks stdio MCP to the manda gateway: propose/commit/read on the three
// lanes, edge append/list, mandate_list. Commit approval rides MCP
// elicitation when the server asks (MANDA_APPROVAL=elicit, the default);
// the probe for that handshake is test/manda-live.test.ts (plan risk 8).
//
// NB (manda README): the server handles requests concurrently — every call
// here is awaited before the next is issued, which restores ordering.
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { homedir } from 'node:os'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'

/** F3: no agent writes self-scope commitments — enforced here BEFORE manda
 * is even asked, regardless of what any profile or mandate says. */
export function assertWritableScope(scope: string): void {
  if (/^self\/commitment(\/|$)/.test(scope)) {
    throw new Error(`F3: agents never write ${scope} — commitments are user-only`)
  }
}

/** MANDA_BIN > `manda` on PATH > the local release build. Null when none. */
export function resolveMandaBin(): string | null {
  const envBin = process.env.MANDA_BIN
  if (envBin && existsSync(envBin)) return envBin
  const exe = process.platform === 'win32' ? 'manda.exe' : 'manda'
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (dir && existsSync(join(dir, exe))) return join(dir, exe)
  }
  const local = join(homedir(), 'manda', 'target', 'release', 'manda')
  return existsSync(local) ? local : null
}

export type ElicitDecision =
  | { action: 'accept'; content: Record<string, unknown> }
  | { action: 'decline' }
  | { action: 'cancel' }

/** Called when manda elicits approval for a commit. Receives the server's
 * message + requested schema; returns the principal's decision. */
export type Approver = (params: {
  message?: string
  requestedSchema?: { properties?: Record<string, { type?: string; default?: unknown }> }
}) => Promise<ElicitDecision>

/** Best-effort acceptance content for an unknown elicitation schema:
 * booleans true, strings their default or "approve". */
export function acceptContentFor(schema?: {
  properties?: Record<string, { type?: string; default?: unknown }>
}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(schema?.properties ?? {})) {
    if (prop.type === 'boolean') out[key] = true
    else if (prop.default !== undefined) out[key] = prop.default
    else if (prop.type === 'string') out[key] = 'approve'
    else if (prop.type === 'number' || prop.type === 'integer') out[key] = 1
  }
  return out
}

export interface ToolResult {
  ok: boolean
  /** Parsed JSON body when the text content parses, else undefined. */
  body?: Record<string, unknown>
  /** Raw text of the first content block. */
  text: string
}

export interface MandaOptions {
  dataDir: string
  bin?: string
  args?: string[]
  approval?: 'elicit' | 'strict' | 'attest'
  approver?: Approver
}

export class MandaMemory {
  /** True once the server actually elicited during this session. */
  elicited = false
  private client: Client

  // No TS parameter properties anywhere in this package: node runs it in
  // strip-only mode (vitest's esbuild would mask the breakage — the
  // pipeline's Phase C lesson).
  private constructor(client: Client) {
    this.client = client
  }

  static async connect(opts: MandaOptions): Promise<MandaMemory> {
    const bin = opts.bin ?? resolveMandaBin()
    if (!bin) throw new Error('manda binary not found: set MANDA_BIN or install manda (see plan PD8)')
    const client = new Client(
      { name: 'nunc-stans-agent', version: '0.1.0' },
      { capabilities: { elicitation: {} } },
    )
    const memory = new MandaMemory(client)
    const approver: Approver =
      opts.approver ?? (async ({ requestedSchema }) => ({ action: 'accept', content: acceptContentFor(requestedSchema) }))
    client.setRequestHandler(ElicitRequestSchema, async (req) => {
      memory.elicited = true
      return approver(req.params as Parameters<Approver>[0])
    })
    const env: Record<string, string> = { MANDA_DATA_DIR: opts.dataDir }
    if (process.env.PATH) env.PATH = process.env.PATH
    if (opts.approval) env.MANDA_APPROVAL = opts.approval
    const transport = new StdioClientTransport({ command: bin, args: opts.args ?? [], env })
    await client.connect(transport)
    return memory
  }

  private async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const res = await this.client.callTool({ name, arguments: args })
    const first = (res.content as Array<{ type: string; text?: string }> | undefined)?.[0]
    const text = first?.type === 'text' && first.text ? first.text : ''
    let body: Record<string, unknown> | undefined
    try { body = JSON.parse(text) } catch { /* non-JSON tool text stays raw */ }
    return { ok: !res.isError, body, text }
  }

  async listTools(): Promise<string[]> {
    const res = await this.client.listTools()
    return res.tools.map(t => t.name)
  }

  append(scope: string, kind: string, content: string): Promise<ToolResult> {
    return this.call('memory_append', { scope, kind, content })
  }

  async propose(scope: string, kind: string, content: string): Promise<ToolResult> {
    assertWritableScope(scope) // async: an F3 violation REJECTS, never throws sync
    return this.call('memory_propose', { scope, kind, content })
  }

  commit(candidateId: string, origin: string): Promise<ToolResult> {
    return this.call('memory_commit', { candidate_id: candidateId, origin })
  }

  read(scope: string): Promise<ToolResult> {
    return this.call('memory_read', { scope })
  }

  edgeAppend(args: Record<string, unknown>): Promise<ToolResult> {
    return this.call('edge_append', args)
  }

  edgeList(): Promise<ToolResult> {
    return this.call('edge_list', {})
  }

  mandateList(): Promise<ToolResult> {
    return this.call('mandate_list', {})
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}
