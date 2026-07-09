import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ServedApp } from './bundles.ts'
import type { ScenarioStep } from './bundle-types.ts'
import { resetAppDataCache } from './appdb.ts'
import { archiveRow, createRow, getRow, listRows, metricValues, updateRow } from './service.ts'

// The scenario runner (contract §8): executes a bundle's data-driven
// tests/scenarios.json against THROWAWAY stores — one fresh store per
// scenario — through the same service layer the REST/MCP surfaces use.
// This is how a generated app proves its CRUD walk and its declared
// metrics without a single line of generated test code.

export interface ScenarioFailure {
  scenario: string
  step: number
  error: string
}

function resolveTokens(
  app: ServedApp,
  payload: Record<string, unknown>,
  lastIds: Map<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (v !== null && typeof v === 'object' && '$id' in (v as object)) {
      const target = String((v as { $id: unknown }).$id)
      if (!lastIds.has(target)) throw new Error(`$id token: no ${target} row created yet`)
      out[k] = lastIds.get(target)
    } else {
      out[k] = v
    }
  }
  return out
}

function pkName(app: ServedApp, entity: string): string {
  const e = app.manifest.entities.find((x) => x.name === entity)
  if (!e) throw new Error(`unknown entity in scenario: ${entity}`)
  return e.columns.find((c) => c.pk)!.name
}

function lastIdOf(lastIds: Map<string, unknown>, entity: string): string {
  if (!lastIds.has(entity)) throw new Error(`no ${entity} row created yet`)
  return String(lastIds.get(entity))
}

function runStep(dataRoot: string, app: ServedApp, step: ScenarioStep, lastIds: Map<string, unknown>): void {
  switch (step.op) {
    case 'create': {
      const row = createRow(dataRoot, app, step.entity!, resolveTokens(app, step.payload ?? {}, lastIds))
      lastIds.set(step.entity!, row[pkName(app, step.entity!)])
      return
    }
    case 'list': {
      const rows = listRows(dataRoot, app, step.entity!, { archived: step.archived === true })
      if (step.expect?.count !== undefined && rows.length !== step.expect.count) {
        throw new Error(`expected ${step.expect.count} ${step.entity} rows, got ${rows.length}`)
      }
      return
    }
    case 'get': {
      getRow(dataRoot, app, step.entity!, lastIdOf(lastIds, step.entity!))
      return
    }
    case 'update': {
      updateRow(dataRoot, app, step.entity!, lastIdOf(lastIds, step.entity!), step.payload ?? {})
      return
    }
    case 'archive': {
      archiveRow(dataRoot, app, step.entity!, lastIdOf(lastIds, step.entity!))
      return
    }
    case 'metric': {
      const metric = metricValues(dataRoot, app).find((m) => m.name === step.name)
      if (!metric) throw new Error(`metric ${step.name} is not declared`)
      if (step.expect?.ok && metric.error) throw new Error(`metric ${step.name} errored: ${metric.error}`)
      return
    }
    default:
      throw new Error(`unknown scenario op: ${(step as { op: string }).op}`)
  }
}

export function runScenarios(app: ServedApp): { passed: number; failures: ScenarioFailure[] } {
  let passed = 0
  const failures: ScenarioFailure[] = []
  for (const scenario of app.scenarios.scenarios) {
    resetAppDataCache()
    const dataRoot = mkdtempSync(join(tmpdir(), 'apps-host-scenario-'))
    const lastIds = new Map<string, unknown>()
    let failed = false
    for (const [i, step] of scenario.steps.entries()) {
      try {
        runStep(dataRoot, app, step, lastIds)
      } catch (err) {
        failures.push({ scenario: scenario.name, step: i, error: (err as Error).message })
        failed = true
        break
      }
    }
    if (!failed) passed++
  }
  resetAppDataCache()
  return { passed, failures }
}
