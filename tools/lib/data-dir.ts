// Shared resolution for the user-designated data store and the linked
// nunc-fluens data instance (the world-view source). Single source of
// truth for the config file shape (<config-home>/nunc-stans/config.json)
// — consumed by tools/data-dir.ts, tools/build-world.ts, and the
// nunc-fluens pipeline. FD-3.2: no data path convention exists in code
// or docs; everything here reads the user's designation.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export function configHome(): string {
  return process.platform === 'win32'
    ? (process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
    : (process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'))
}

export function configFile(): string {
  return join(configHome(), 'nunc-stans', 'config.json')
}

export function readConfig(): Record<string, unknown> {
  try {
    const cfg = JSON.parse(readFileSync(configFile(), 'utf8'))
    return cfg && typeof cfg === 'object' ? cfg as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** Merge one key into the config, preserving everything else. */
export function writeConfigKey(key: string, value: string): string {
  const file = configFile()
  const cfg = readConfig()
  cfg[key] = value
  mkdirSync(dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n')
  renameSync(tmp, file)
  return file
}

export interface Resolved {
  dir: string | null
  warning?: string
}

/** Data store resolution: NS_DATA > FED_DATA (deprecated, warns) > config. */
export function resolveDataDir(): Resolved {
  const ns = process.env.NS_DATA
  if (ns) return { dir: ns }
  const fed = process.env.FED_DATA
  if (fed) return { dir: fed, warning: 'warning: FED_DATA is deprecated; use NS_DATA or just bootstrap' }
  const v = readConfig().data_dir
  return { dir: typeof v === 'string' && v ? v : null }
}

/** Linked-instance resolution: NS_NEWS_REPO > config news_repo
 * (unchanged key, instance semantics — points at a v2 nunc-fluens data
 * instance; see tools/build-world.ts and design/naming.md). Set via
 * `just news-link <instance>` (Phase C replaces the retired NEWS_WORLD
 * env). */
export function resolveNewsRepo(): string | null {
  const env = process.env.NS_NEWS_REPO
  if (env) return env
  const v = readConfig().news_repo
  return typeof v === 'string' && v ? v : null
}
