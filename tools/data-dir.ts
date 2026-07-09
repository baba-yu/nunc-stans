#!/usr/bin/env node
// Resolve the data store and print its path. Resolution order:
//   1. NS_DATA env (per-invocation override — scripts, CI, tests)
//   2. FED_DATA env (deprecated, warns; kept for one phase)
//   3. the app config: <config-home>/nunc-stans/config.json { "data_dir" }
//   4. the in-repo default <repo>/data/ (gitignored; R13 2026-07-07)
// `just bootstrap [dir]` writes the config for stores kept elsewhere.
// The logic lives in tools/lib/data-dir.ts (shared with the
// nunc-fluens pipeline).
import { resolveDataDir } from './lib/data-dir.ts'

const { dir, warning } = resolveDataDir()
if (warning) console.error(warning)
if (dir) console.log(dir)
