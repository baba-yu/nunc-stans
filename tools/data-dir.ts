#!/usr/bin/env node
// Resolve the user's data store (workspace model). Prints the path, or
// nothing if no store is configured. Resolution order:
//   1. NS_DATA env (per-invocation override — scripts, CI, tests)
//   2. FED_DATA env (deprecated, warns; kept for one phase)
//   3. the app config: <config-home>/nunc-stans/config.json { "data_dir" }
// The store itself lives wherever the user designated it (FD-3.2: no path
// convention exists in code or docs). `just bootstrap [dir]` writes the config.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const ns = process.env.NS_DATA
if (ns) { console.log(ns); process.exit(0) }
const fed = process.env.FED_DATA
if (fed) {
  console.error('warning: FED_DATA is deprecated; use NS_DATA or just bootstrap')
  console.log(fed)
  process.exit(0)
}
const configHome = process.platform === 'win32'
  ? (process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
  : (process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'))
try {
  const cfg = JSON.parse(readFileSync(join(configHome, 'nunc-stans', 'config.json'), 'utf8'))
  if (typeof cfg.data_dir === 'string' && cfg.data_dir) console.log(cfg.data_dir)
} catch { /* not configured yet — print nothing */ }
