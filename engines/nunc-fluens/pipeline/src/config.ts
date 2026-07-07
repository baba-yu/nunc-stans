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

// News-checkout layout (upstream repo shape).
export const newsDbFile = (newsRepo: string) => join(newsRepo, 'app', 'data', 'analytics.sqlite')
export const sourcedataDir = (newsRepo: string) => join(newsRepo, 'app', 'sourcedata')
