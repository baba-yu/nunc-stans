#!/usr/bin/env node
// Resolve the local model backend for `_up-llama` / `just llama` (T4, plan
// 2026-07-08-topics-authoring §T4 / exit #6). Two subcommands, each printing
// ONE line — or nothing (exit 0) when unresolved, so the justfile recipe can
// degrade honestly (W11) instead of tearing the stack down:
//
//   node tools/llama.ts bin    -> the llama-server executable
//   node tools/llama.ts model  -> the GGUF to serve
//   node tools/llama.ts url    -> an EXTERNAL OpenAI-compatible backend
//                                 (NS_LLAMA_URL > config llama_url), e.g. a
//                                 GPU-resident ollama at :11434. When set,
//                                 `just up` exports it as LLAMACPP_HOST for
//                                 every consumer and does NOT start a local
//                                 llama-server.
//
// bin:   LLAMACPP_BIN > `llama-server` on PATH > the newest build under
//        ~/.local/share/nunc-stans/llama.cpp (where `just setup` installs it).
// model: NS_LLAMA_MODEL > config `llama_model` > the GGUF named by the
//        fourfive-chat default profile > the newest *.gguf in <store>/models.
//        Coupling to the default profile keeps one source of truth: the model
//        the FourFive badge names is the model that actually loads.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { readConfig, resolveDataDir } from './lib/data-dir.ts'

// Mirrors tools/setup.ts LLAMA_DIR — the install home is module-independent
// (always the XDG data home), never the data store, so moving the store
// never orphans the binary.
const LLAMA_HOME = join(homedir(), '.local', 'share', 'nunc-stans', 'llama.cpp')

function isFile(p: string): boolean {
  try { return statSync(p).isFile() } catch { return false }
}

function mtimeSafe(p: string): number {
  try { return statSync(p).mtimeMs } catch { return 0 }
}

function findAllUnder(dir: string, name: string): string[] {
  const out: string[] = []
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()!
    let entries
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isDirectory()) stack.push(full)
      else if (e.name === name) out.push(full)
    }
  }
  return out
}

function onPath(name: string): string | null {
  const sep = process.platform === 'win32' ? ';' : ':'
  for (const d of (process.env.PATH ?? '').split(sep)) {
    if (d && isFile(join(d, name))) return join(d, name)
  }
  return null
}

function resolveBin(): string | null {
  const env = process.env.LLAMACPP_BIN
  if (env) {
    if (isFile(env)) return env
    // An explicit override that dangles must fail loudly, never fall
    // through to a different binary.
    console.error(`[llama] LLAMACPP_BIN=${env} does not exist - fix or unset it`)
    return null
  }
  const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
  const hit = onPath(exe)
  if (hit) return hit
  // Multiple extracted builds may coexist; newest mtime wins (the
  // documented "newest build" contract), not readdir order.
  const all = findAllUnder(LLAMA_HOME, exe)
  if (!all.length) return null
  return all.sort((a, b) => mtimeSafe(b) - mtimeSafe(a))[0]
}

function ggufs(modelsDir: string): string[] {
  try {
    return readdirSync(modelsDir).filter((f) => f.toLowerCase().endsWith('.gguf'))
  } catch { return [] }
}

function newestGguf(modelsDir: string, files: string[]): string | null {
  let best: { f: string; m: number } | null = null
  for (const f of files) {
    const m = mtimeSafe(join(modelsDir, f)) // 0 for broken symlinks — skipped, never thrown
    if (m > 0 && (!best || m > best.m)) best = { f, m }
  }
  return best ? join(modelsDir, best.f) : null
}

/** The `model` string of the fourfive-chat default profile, if any. */
function defaultProfileModel(dataDir: string): string | null {
  try {
    const defaults = JSON.parse(readFileSync(join(dataDir, 'profiles', 'defaults.json'), 'utf8'))
    const id = defaults['fourfive-chat']
    if (!id) return null
    const prof = JSON.parse(readFileSync(join(dataDir, 'profiles', `${id}.json`), 'utf8'))
    return typeof prof.model === 'string' && prof.model ? prof.model : null
  } catch { return null }
}

function resolveModel(): string | null {
  const dir = resolveDataDir().dir
  if (!dir) return null
  const modelsDir = join(dir, 'models')

  const env = process.env.NS_LLAMA_MODEL
  if (env) {
    if (existsSync(env)) return env
    const inDir = join(modelsDir, env)
    if (existsSync(inDir)) return inDir
    // Explicit override that resolves to nothing: fail loudly rather than
    // silently serving a different model.
    console.error(`[llama] NS_LLAMA_MODEL=${env} not found (checked as path and under ${modelsDir}) - fix or unset it`)
    return null
  }

  const cfg = readConfig().llama_model
  if (typeof cfg === 'string' && cfg) {
    if (existsSync(cfg)) return cfg
    const inDir = join(modelsDir, cfg)
    if (existsSync(inDir)) return inDir
    console.error(`[llama] config llama_model=${cfg} not found - falling back to profile/newest`)
  }

  const files = ggufs(modelsDir)
  const want = defaultProfileModel(dir)
  if (want) {
    const w = want.toLowerCase().replace(/\.gguf$/, '')
    const hit = files.find((f) => f.toLowerCase().replace(/\.gguf$/, '') === w)
      ?? files.find((f) => f.toLowerCase().startsWith(w))
    if (hit) return join(modelsDir, hit)
  }
  return newestGguf(modelsDir, files)
}

function resolveUrl(): string | null {
  const env = process.env.NS_LLAMA_URL
  if (env) return env
  const cfg = readConfig().llama_url
  return typeof cfg === 'string' && cfg ? cfg : null
}

const cmd = process.argv[2]
if (cmd === 'bin') {
  const b = resolveBin()
  if (b) console.log(b)
} else if (cmd === 'model') {
  const m = resolveModel()
  if (m) console.log(m)
} else if (cmd === 'url') {
  const u = resolveUrl()
  if (u) console.log(u)
} else {
  console.error('usage: node tools/llama.ts <bin|model|url>')
  process.exit(2)
}
