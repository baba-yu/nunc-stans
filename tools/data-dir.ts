#!/usr/bin/env node
// Resolve the user's data store (workspace model). Prints the path, or
// nothing if no store is configured. Resolution order:
//   1. NS_DATA env (per-invocation override — scripts, CI, tests)
//   2. FED_DATA env (deprecated, warns; kept for one phase)
//   3. the app config: <config-home>/nunc-stans/config.json { "data_dir" }
// The store itself lives wherever the user designated it (FD-3.2: no path
// convention exists in code or docs). `just bootstrap [dir]` writes the
// config. The logic lives in tools/lib/data-dir.ts (shared with the
// nunc-fluens pipeline).
import { resolveDataDir } from './lib/data-dir.ts'

const { dir, warning } = resolveDataDir()
if (warning) console.error(warning)
if (dir) console.log(dir)
