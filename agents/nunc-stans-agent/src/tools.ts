// Generated-app tools (Phase E T8, plan PE10 + contracts/app-bundle.md §5):
// the agent's general MCP tool client. apps-host serves the declared tool
// surface over Streamable HTTP at /apps/mcp (behind the gate; we talk to
// the loopback host directly, like the other stack-internal clients); the
// profile's `skills` allowlist gates what THIS agent may call —
// `apps:<slug>` grants one app's five CRUD verbs, an exact tool name
// grants one tool, no grant means the tool is never offered (agent-abi §2).
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Profile, ToolCall, ToolSpec } from '../../../frontend/packages/ai/src/index.ts'

export interface AppsTools {
  /** The allowlisted tool surface, ready for ChatOptions.tools. */
  specs: ToolSpec[]
  /** Execute one call; refusals come back as text with isError. */
  call(c: ToolCall): Promise<{ text: string; isError: boolean }>
  close(): Promise<void>
}

export function appsToolAllowed(skills: string[], toolName: string): boolean {
  return skills.some(g =>
    g === toolName || (g.startsWith('apps:') && toolName.startsWith(`${g.slice('apps:'.length)}_`)))
}

export function defaultAppsUrl(): string {
  return process.env.NS_APPS_URL ?? 'http://127.0.0.1:8788/mcp'
}

/**
 * Connect and list the granted tools. Returns null — with the reason on
 * `meta` — when the profile grants nothing (no ambient tool surface) or
 * apps-host is unreachable (honest degrade, never a crash).
 */
export async function connectAppsTools(
  profile: Profile,
  meta: (s: string) => void,
  url = defaultAppsUrl(),
): Promise<AppsTools | null> {
  const skills = profile.skills ?? []
  if (!skills.some(g => g.startsWith('apps:') || g.includes('_'))) return null

  const client = new Client({ name: 'nunc-stans-agent', version: '0.1.0' })
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)))
  } catch (e) {
    meta(`app tools OFF: apps-host unreachable at ${url} (${e instanceof Error ? e.message.slice(0, 120) : e})`)
    return null
  }
  const listed = await client.listTools()
  const specs: ToolSpec[] = listed.tools
    .filter(t => appsToolAllowed(skills, t.name))
    .map(t => ({
      name: t.name,
      ...(t.description ? { description: t.description } : {}),
      inputSchema: t.inputSchema as Record<string, unknown>,
    }))

  return {
    specs,
    async call(c: ToolCall) {
      // The allowlist is re-checked at call time: the model can only see
      // granted tools, but defense in depth is the house style.
      if (!appsToolAllowed(skills, c.name)) {
        return { text: `refused: tool ${c.name} is not granted by this profile's skills`, isError: true }
      }
      const result = await client.callTool({ name: c.name, arguments: c.arguments })
      const content = (result.content ?? []) as Array<{ type: string; text?: string }>
      const text = content.filter(b => b.type === 'text' && b.text).map(b => b.text).join('\n')
      return { text: text || '(empty result)', isError: (result as { isError?: boolean }).isError === true }
    },
    close: () => client.close(),
  }
}
