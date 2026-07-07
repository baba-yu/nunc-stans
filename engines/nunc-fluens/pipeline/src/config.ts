// Pipeline configuration: the data store (workspace model) and the news
// data+publish checkout (`newsRepo`, replacing the retired NEWS_WORLD
// env). Resolution logic is shared with the repo tooling via
// tools/lib/data-dir.ts.
import { join } from 'node:path'
import {
  configFile, resolveDataDir, resolveNewsRepo, writeConfigKey,
} from '../../../../tools/lib/data-dir.ts'

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
// its own gitignored store/ for runtime state. The store reuses the
// main-store shapes (world/analytics.sqlite, runs/ai-runs.jsonl), so
// worldDbFile / runLogFile apply to both; news-config.json sits at the
// store root as the optional per-instance override.
export const instanceStoreDir = (instanceRoot: string) => join(instanceRoot, 'store')

// Checkout app/ subtree — DELIBERATELY untouched by the post-C data/
// layout rename (P1): source_files.path stores `app/sourcedata/…` rel
// paths that participate in row identity, so moving app/ is a
// DB-content migration with its own risks. Recorded follow-up; both
// layouts share these two paths.
export const newsDbFile = (newsRepo: string) => join(newsRepo, 'app', 'data', 'analytics.sqlite')
export const sourcedataDir = (newsRepo: string) => join(newsRepo, 'app', 'sourcedata')
