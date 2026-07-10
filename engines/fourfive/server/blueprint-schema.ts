import { z } from 'zod'
import type { Blueprint } from '../shared/blueprint'

// zod schema mirroring shared/blueprint.ts. LLM output is untrusted, so every
// proposed blueprint is parsed through this before persistence.

const fieldType = z.enum(['text', 'number', 'select', 'checkbox', 'radio', 'date', 'textarea'])

// Real models (T9, 2026-07-10) emit single links as bare strings
// ("maps_to": "deals.name") where the shape wants string[] — normalize
// instead of refusing the whole proposal; the parsed type stays string[].
const strArray = z.preprocess(
  (v) => (typeof v === 'string' ? [v] : v),
  z.array(z.string()).default([]),
)

const mockUiField = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: fieldType,
  maps_to: strArray,
  description: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
})

const mockUiScreen = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fields: z.array(mockUiField).default([]),
})

const entityColumn = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  pk: z.boolean().optional(),
  fk: z.string().optional(),
  nullable: z.boolean().optional(),
  unique: z.boolean().optional(),
  description: z.string().optional(),
})

const entity = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  columns: z.array(entityColumn).default([]),
})

const businessRule = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  inputs: strArray,
  outputs: strArray,
  related_db: strArray,
  related_api: strArray,
  description: z.string().optional(),
})

const term = z.object({
  term: z.string().min(1),
  definition: z.string().default(''),
  aliases: strArray,
  related_objects: strArray,
  status: z.enum(['confirmed', 'tentative']).default('tentative'),
})

const apiEndpoint = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  summary: z.string().optional(),
  related_db: strArray,
  related_ui: strArray,
})

const stateTransition = z.object({
  subject: z.string().optional(),
  from: z.string().min(1),
  to: z.string().min(1),
  trigger: z.string().optional(),
  description: z.string().optional(),
})

// Metric names become `metric_<name>` view names and API keys (plan PE8) —
// enforce identifier safety at the first trust boundary. The single-SELECT
// rule for `sql` is enforced where it is compiled (generator, then apps-host).
const metric = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'snake_case identifier'),
  label: z.string().min(1),
  sql: z.string().min(1),
})

const story = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  scenario: z.string().default(''),
})

export const blueprintSchema = z.object({
  app: z.object({ name: z.string().min(1), description: z.string().optional() }),
  mock_ui: z.object({ screens: z.array(mockUiScreen).default([]) }).default({ screens: [] }),
  entities: z.array(entity).default([]),
  business_logic: z.array(businessRule).default([]),
  terminology: z.array(term).default([]),
  apis: z.array(apiEndpoint).default([]),
  open_questions: strArray,
  state_transitions: z.array(stateTransition).default([]),
  metrics: z.array(metric).default([]),
  stories: z.array(story).default([]),
  software_stack: z.string().optional(),
})

export function validateBlueprint(data: unknown) {
  return blueprintSchema.safeParse(data)
}

// Compile-time only: ensures the validated output stays assignable to the
// shared Blueprint type (no runtime cost). Fails typecheck if the two drift.
export type ValidatedBlueprint = z.infer<typeof blueprintSchema>
const _assignable: Blueprint = {} as ValidatedBlueprint
void _assignable
