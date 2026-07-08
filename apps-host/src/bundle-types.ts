// The consumer-side mirror of contracts/app-bundle.md. apps-host never
// imports the producer's code (FD-7.4) — the contract file shapes below ARE
// the coupling surface.

export interface NormalizedColumn {
  name: string
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'NUMERIC' | 'BLOB'
  pk?: boolean
  fk?: string
  notNull?: boolean
  unique?: boolean
  audit?: boolean
}

export interface NormalizedEntity {
  name: string
  description?: string
  columns: NormalizedColumn[]
}

export interface MetricDecl {
  name: string
  label: string
  sql: string
}

export interface AppManifest {
  slug: string
  version: number
  name: string
  description?: string
  entities: NormalizedEntity[]
  metrics: MetricDecl[]
  stories: { id: string; title: string; scenario: string }[]
  ui: { screens: unknown[] }
  blueprint_hash: string
}

export interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ScenarioStep {
  op: 'create' | 'list' | 'get' | 'update' | 'archive' | 'metric'
  entity?: string
  name?: string
  payload?: Record<string, unknown>
  archived?: boolean
  expect?: { count?: number; ok?: boolean }
}

export interface ScenarioSpec {
  scenarios: { name: string; steps: ScenarioStep[] }[]
}

export const BUNDLE_FILES = ['app.json', 'schema.sql', 'mcp-tools.json', 'ui.json', 'tests/scenarios.json'] as const

export const IDENT = /^[a-z][a-z0-9_]*$/
export const SLUG = /^[a-z][a-z0-9-]*$/
export const VERBS = ['list', 'get', 'create', 'update', 'archive'] as const
export type Verb = (typeof VERBS)[number]
