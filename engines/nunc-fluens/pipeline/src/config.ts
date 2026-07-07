// Pipeline configuration: the data store (workspace model) and the
// designated view source (`newsRepo` — a data instance checkout).
// Resolution logic is shared with the repo tooling via
// tools/lib/data-dir.ts.
import { join } from 'node:path'
import {
  configFile, resolveDataDir, resolveNewsRepo, writeConfigKey,
} from '../../../../tools/lib/data-dir.ts'
import { SOURCEDATA_REL } from './world-paths.ts'

export { configFile, resolveDataDir, resolveNewsRepo }

export interface PipelineConfig {
  dataDir: string
  newsRepo: string
}

export function requireDataDir(): string {
  const { dir, warning } = resolveDataDir()
  if (warning) console.error(warning)
  if (!dir) throw new Error(
    'no data store configured - run: just bootstrap <dir>  (or set NS_DATA)')
  return dir
}

export function requireNewsRepo(): string {
  const repo = resolveNewsRepo()
  if (!repo) throw new Error(
    'no news checkout configured - run: just news-link <dir>  (or set NS_NEWS_REPO)')
  return repo
}

export function requireConfig(): PipelineConfig {
  return { dataDir: requireDataDir(), newsRepo: requireNewsRepo() }
}

export function linkNewsRepo(dir: string): string {
  return writeConfigKey('news_repo', dir)
}

// Data-store layout (§2.9): world/ is the rebuildable News cache.
export const worldDir = (dataDir: string) => join(dataDir, 'world')
export const worldDbFile = (dataDir: string) => join(worldDir(dataDir), 'analytics.sqlite')
export const runLogFile = (dataDir: string) => join(dataDir, 'runs', 'ai-runs.jsonl')

// Instance layout (post-C REDO V2, R2/R3): each data instance carries
// its own disposable store/ for runtime state. The store reuses the
// main-store shapes (world/analytics.sqlite, runs/ai-runs.jsonl), so
// worldDbFile / runLogFile apply to both; news-config.json sits at the
// store root as the optional per-instance override.
export const instanceStoreDir = (instanceRoot: string) => join(instanceRoot, 'store')
export const sourcedataDir = (instanceRoot: string) => join(instanceRoot, SOURCEDATA_REL)
