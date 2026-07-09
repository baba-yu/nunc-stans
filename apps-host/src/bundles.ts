import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppManifest, ScenarioSpec, ToolDef } from './bundle-types.ts'
import { BUNDLE_FILES, IDENT, SLUG } from './bundle-types.ts'

// Bundle discovery (contract §1): scan <artifact root>/apps/*/versions/* and
// serve, per app, the HIGHEST version whose bundle/ is complete — bundle
// presence IS the freeze marker; there is no producer→host runtime call.
// Malformed bundles are skipped loudly, never fatal (a broken freeze must not
// take down the neighbors).

export interface ServedApp {
  slug: string
  version: number
  dir: string // the bundle dir
  manifest: AppManifest
  schemaSql: string
  tools: ToolDef[]
  scenarios: ScenarioSpec
}

function isCompleteBundle(dir: string): boolean {
  return BUNDLE_FILES.every((f) => existsSync(join(dir, f)))
}

// Entity/column names flow into SQL and URLs: refuse any manifest whose
// identifiers do not match the contract rails (defense in depth — the
// generator already enforces this on its side).
function manifestError(m: AppManifest): string | null {
  if (!Array.isArray(m.entities) || m.entities.length === 0) return 'no entities'
  for (const e of m.entities) {
    if (!IDENT.test(e.name)) return `entity name ${JSON.stringify(e.name)} violates the identifier rail`
    if (e.columns.filter((c) => c.pk).length !== 1) return `entity ${e.name} must have exactly one pk`
    for (const c of e.columns) {
      if (!IDENT.test(c.name)) return `column name ${JSON.stringify(c.name)} violates the identifier rail`
    }
  }
  return null
}

function loadBundle(slug: string, version: number, dir: string): ServedApp | null {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'app.json'), 'utf8')) as AppManifest
    if (manifest.slug !== slug || manifest.version !== version) {
      console.warn(`apps-host: ${dir} manifest names ${manifest.slug}@v${manifest.version}, path says ${slug}@v${version} — skipped`)
      return null
    }
    const bad = manifestError(manifest)
    if (bad) {
      console.warn(`apps-host: ${dir} refused: ${bad}`)
      return null
    }
    const tools = (JSON.parse(readFileSync(join(dir, 'mcp-tools.json'), 'utf8')) as { tools: ToolDef[] }).tools
    const scenarios = JSON.parse(readFileSync(join(dir, 'tests/scenarios.json'), 'utf8')) as ScenarioSpec
    return { slug, version, dir, manifest, schemaSql: readFileSync(join(dir, 'schema.sql'), 'utf8'), tools, scenarios }
  } catch (err) {
    console.warn(`apps-host: unreadable bundle at ${dir}: ${(err as Error).message} — skipped`)
    return null
  }
}

function listDir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

export function discoverApps(artifactRoot: string): ServedApp[] {
  const out: ServedApp[] = []
  for (const slug of listDir(join(artifactRoot, 'apps')).sort()) {
    if (!SLUG.test(slug)) continue
    const versionsDir = join(artifactRoot, 'apps', slug, 'versions')
    const versions = listDir(versionsDir)
      .filter((v) => /^\d+$/.test(v))
      .map((v) => Number(v))
      .sort((a, b) => b - a)
    for (const v of versions) {
      const bundleDir = join(versionsDir, String(v).padStart(3, '0'), 'bundle')
      if (!isCompleteBundle(bundleDir)) continue
      const app = loadBundle(slug, v, bundleDir)
      if (app) {
        out.push(app)
        break // highest complete + loadable version wins
      }
    }
  }
  return out
}

export function findApp(artifactRoot: string, slug: string): ServedApp | null {
  if (!SLUG.test(slug)) return null
  return discoverApps(artifactRoot).find((a) => a.slug === slug) ?? null
}
