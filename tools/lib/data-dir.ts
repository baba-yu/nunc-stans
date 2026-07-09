// Shared resolution for the data store and the linked nunc-fluens data
// instance (the world-view source). Single source of truth for the
// config file shape (<config-home>/nunc-stans/config.json) — consumed
// by tools/data-dir.ts, tools/build-world.ts, and the nunc-fluens
// pipeline. The store DEFAULTS to <repo>/data/ (gitignored — R13,
// owner decision 2026-07-07; FD-3.2's no-data-in-git intent is
// preserved by the ignore); NS_DATA and the config `data_dir` override
// it for stores kept elsewhere.
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

/** The in-repo default store: <repo>/data/ (gitignored). Resolved
 * relative to THIS module (tools/lib/ → repo root), never the cwd —
 * every caller sees the same folder regardless of where it runs. */
export function defaultDataDir(): string {
  return join(import.meta.dirname, '..', '..', 'data')
}

/** Data store resolution: NS_DATA > FED_DATA (deprecated, warns) >
 * config `data_dir` > the in-repo default <repo>/data/. */
export function resolveDataDir(): Resolved {
  const ns = process.env.NS_DATA
  if (ns) return { dir: ns }
  const fed = process.env.FED_DATA
  if (fed) return { dir: fed, warning: 'warning: FED_DATA is deprecated; use NS_DATA or just bootstrap' }
  const v = readConfig().data_dir
  return { dir: typeof v === 'string' && v ? v : defaultDataDir() }
}

/** The manda memory home, sibling to self/world/artifact under the
 * store: <data_store>/manda. A directory the agent alone writes (the
 * nunc-stans-agent README's requirement). */
export function defaultMandaDataDir(): string {
  return join(resolveDataDir().dir ?? defaultDataDir(), 'manda')
}

/** Manda data-dir resolution: MANDA_DATA_DIR env > config
 * `manda_data_dir` > the in-repo default <data_store>/manda. Having a
 * default is what makes the agent's memory ON out of the box once a
 * manda binary resolves — no env var required (just setup writes the
 * config key + seeds the first mandate). */
export function resolveMandaDataDir(): string {
  const env = process.env.MANDA_DATA_DIR
  if (env) return env
  const v = readConfig().manda_data_dir
  return typeof v === 'string' && v ? v : defaultMandaDataDir()
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
