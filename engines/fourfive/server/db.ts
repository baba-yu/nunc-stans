import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { applySchema } from './schema'
import { resolveDataDir } from '../../../tools/lib/data-dir.ts'

// FourFive's own metadata lives in a single SQLite file inside the workspace
// dir. Per-app design artifacts (blueprint.json, versions/, bundles) live in
// <workspace>/apps/<slug>/ folders.
// Phase E (PE5): the workspace is DATA, so it lives in the data store —
// <store>/artifact/ (v1 plan §2.9) — resolved through the shared resolver
// (NS_DATA > config > in-repo default), never the cwd. FOURFIVE_WORKSPACE
// overrides for tests and special setups. Everything persisted (DB path
// columns) is stored RELATIVE to WORKSPACE_DIR — never absolute — which is
// exactly what lets the root move.
function resolveWorkspaceDir(): string {
  const override = process.env.FOURFIVE_WORKSPACE
  if (override) return resolve(override)
  const { dir, warning } = resolveDataDir()
  if (warning) console.error(warning)
  if (!dir) throw new Error('fourfive: no data store resolved (set NS_DATA or just bootstrap <dir>)')
  return resolve(dir, 'artifact')
}

export const WORKSPACE_DIR = resolveWorkspaceDir()
mkdirSync(WORKSPACE_DIR, { recursive: true })

// One-time migration aid (PE5): the pre-E workspace was repo-anchored at
// <engine>/workspace/. If it still holds content and the new home is empty,
// say so loudly on boot — the move itself is the owner's, never automatic.
const legacyDir = resolve(import.meta.dirname, '..', 'workspace')
if (
  !process.env.FOURFIVE_WORKSPACE &&
  legacyDir !== WORKSPACE_DIR &&
  existsSync(join(legacyDir, 'codev.db')) &&
  !existsSync(join(WORKSPACE_DIR, 'codev.db'))
) {
  console.error(
    `fourfive: legacy workspace found at ${legacyDir} — the workspace now lives in the data store.\n` +
      `  migrate once with:  mv '${legacyDir}'/* '${WORKSPACE_DIR}/'  (stop the stack first)`,
  )
}

const DB_PATH = resolve(WORKSPACE_DIR, 'codev.db')

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
applySchema(db)

export function nowIso(): string {
  return new Date().toISOString()
}

// Default title for a freshly-created session. Treated as "unnamed": the first
// blueprint auto-names the session after its app (see server/workspace.ts),
// unless the user has already renamed it.
export const DEFAULT_SESSION_TITLE = 'New session'
