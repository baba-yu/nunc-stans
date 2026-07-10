import type { ChatMessage } from '../../shared/types'
import type { Blueprint } from '../../shared/blueprint'

// Builds the prompt that asks a real LLM (Ollama / Claude) to emit a blueprint
// JSON object matching shared/blueprint.ts. Kept provider-agnostic.

const SCHEMA_HINT = `The JSON shape is:
{
  "app": { "name": string, "description"?: string },
  "mock_ui": { "screens": [ { "id": string, "name": string,
      "fields": [ { "id": string, "label": string,
        "type": "text"|"number"|"select"|"checkbox"|"radio"|"date"|"textarea",
        "maps_to": string[], "description"?: string, "options"?: string[], "required"?: boolean } ] } ] },
  "entities": [ { "name": string, "description"?: string,
      "columns": [ { "name": string, "type": string, "pk"?: boolean, "fk"?: string,
        "nullable"?: boolean, "unique"?: boolean, "description"?: string } ] } ],
  "business_logic": [ { "id": string, "name": string, "inputs": string[], "outputs": string[],
      "related_db": string[], "related_api": string[], "description"?: string } ],
  "terminology": [ { "term": string, "definition": string, "aliases": string[],
      "related_objects": string[], "status": "confirmed"|"tentative" } ],
  "apis": [ { "method": string, "path": string, "summary"?: string,
      "related_db": string[], "related_ui": string[] } ],
  "open_questions": string[],
  "state_transitions": [ { "subject"?: string, "from": string, "to": string, "trigger"?: string, "description"?: string } ],
  "metrics": [ { "name": string, "label": string, "sql": string } ],
  "stories": [ { "id": string, "title": string, "scenario": string } ]
}
"maps_to" links a UI field to "table.column". Reuse ids so UI/DB/API/logic cross-reference.
"state_transitions" describes status lifecycles (e.g. an invoice: draft -> sent -> paid). Omit if the app has no meaningful states.
"metrics" are the app's DECLARED measurements — what the user wants this app to measure. Each is one SQLite SELECT statement over the app's own tables returning a single value; "name" is a snake_case identifier. Only declared metrics can ground strategy discussion later, so capture what the user says they want to watch.
"stories" are the user stories the app must satisfy, in the user's own terms (one sentence each).`

// The conversation the extractor sees is BOUNDED so the blueprint prompt
// cannot outgrow the serving window (llama-server splits its context into
// ctx/parallel slots; an oversized prompt gets HTTP 400 or truncates at the
// slot boundary — live 2026-07-10). Old turns are redundant context, not
// lost decisions: the current blueprint below the transcript carries the
// accumulated design. ~16k chars ≈ 4k tokens, sized so system + blueprint +
// convo fit the input half of the smallest sane slot (8k of 16k).
export const BLUEPRINT_MAX_TURNS = 16
export const BLUEPRINT_MAX_CONVO_CHARS = 16_000
const OMISSION_MARKER = '[earlier turns omitted — the current blueprint carries the accumulated design]'

/** Last-N-turns window under a character budget. The newest turn always
 * survives, clipped if it alone busts the budget (a pasted document). */
function boundTurns(turns: ChatMessage[]): { kept: ChatMessage[]; omitted: boolean } {
  const recent = turns.slice(-BLUEPRINT_MAX_TURNS)
  let omitted = recent.length < turns.length
  const kept: ChatMessage[] = []
  let used = 0
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i]
    const cost = m.role.length + m.content.length + 3 // "role: content\n"
    if (kept.length === 0 && cost > BLUEPRINT_MAX_CONVO_CHARS) {
      kept.unshift({ ...m, content: `${m.content.slice(0, BLUEPRINT_MAX_CONVO_CHARS)} …[clipped]` })
      omitted = true
      break
    }
    if (used + cost > BLUEPRINT_MAX_CONVO_CHARS) {
      omitted = true
      break
    }
    kept.unshift(m)
    used += cost
  }
  return { kept, omitted }
}

export function buildBlueprintMessages(
  history: ChatMessage[],
  current: Blueprint | null,
): ChatMessage[] {
  // System-role entries (e.g. dependency context) must arrive as instructions,
  // not as quoted transcript text, so split them out before building the convo.
  const systemExtras = history.filter((m) => m.role === 'system').map((m) => m.content)
  const { kept, omitted } = boundTurns(history.filter((m) => m.role !== 'system'))

  const system = [
    "You are FourFive's design extractor. From the conversation, infer the app being designed and output ONLY a single JSON object — no prose, no code fences.",
    SCHEMA_HINT,
    'If there is not yet enough information to design anything, output exactly: null',
    'Match the language of the conversation for human-facing strings (labels, definitions).',
    ...systemExtras,
  ].join('\n\n')

  const lines = kept.map((m) => `${m.role}: ${m.content}`)
  if (omitted) lines.unshift(OMISSION_MARKER)
  const convo = lines.join('\n')
  const currentStr = current
    ? `\n\nCurrent blueprint (refine it; keep prior detail unless contradicted):\n${JSON.stringify(current)}`
    : ''

  return [
    { role: 'system', content: system },
    { role: 'user', content: `Conversation:\n${convo}${currentStr}\n\nReturn the blueprint JSON now (or null).` },
  ]
}

export interface DependencyContextInput {
  name: string
  slug: string
  pinned_version: number
  blueprint: Blueprint | null
}

/**
 * Read-only context describing the apps this session's app composes. Prepended
 * to the LLM history as a system message for BOTH chat and blueprint
 * generation, so the model references dependency entities/APIs instead of
 * redefining them. Returns null when there is nothing to include.
 */
export function buildDependencyContext(deps: DependencyContextInput[]): ChatMessage | null {
  const withBp = deps.filter((d) => d.blueprint != null)
  if (withBp.length === 0) return null
  const sections = withBp.map(
    (d) => `### ${d.name} (namespace: ${d.slug}, pinned v${d.pinned_version})\n${JSON.stringify(d.blueprint)}`,
  )
  return {
    role: 'system',
    content: [
      'This app COMPOSES the following existing apps. Their blueprints are READ-ONLY context:',
      ...sections,
      [
        'Rules:',
        '- Reference their entities/APIs/terms with namespaced notation `<namespace>.<name>` (e.g. `inventory.products`); never redefine them.',
        "- This app's own blueprint may only contain new screens, glue logic, and entities the integration itself requires.",
      ].join('\n'),
    ].join('\n\n'),
  }
}

// Tolerant JSON extraction from a model's text response.
export function extractJson(text: string): unknown {
  const t = text.trim()
  if (t === 'null' || t === '') return null
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : t
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}
