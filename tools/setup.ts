#!/usr/bin/env node
// nunc-stans setup: batteries-included first run (task ③, 2026-07-08).
// Runs bootstrap, then ensures the two runtime dependencies the agent and
// the local-model UI need — manda (the memory gateway) and llama.cpp's
// `llama-server` (the local model backend, PE9') — selects + downloads a
// GGUF model, validates it (chat smoke + tool-calling probe), resolves the
// manda memory home, and grants the FIRST mandate interactively.
//
// A1: mandates are granted by the PRINCIPAL out of band. This script never
// grants one on its own — the interactive terminal y/N IS the out-of-band
// grant, typed by the human at the machine. `--help` for flags.
//
// Idempotent: every step no-ops when already satisfied, so re-running is
// safe. llama.cpp auto-install targets Linux/macOS (the WSL path, §5
// note 12); on native Windows it prints guidance and continues.
import { spawn, spawnSync } from 'node:child_process'
import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync,
} from 'node:fs'
import { createInterface } from 'node:readline'
import { delimiter, join } from 'node:path'
import { homedir, platform } from 'node:os'
import { resolveDataDir, resolveMandaDataDir, writeConfigKey } from './lib/data-dir.ts'
import { mandateJsonl } from './lib/mandate.ts'

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`usage: node tools/setup.ts [--skip-llama] [--skip-model] [--skip-mandate]
  Ensures manda + llama.cpp, downloads/validates a model, seeds the first
  mandate. Re-runnable; each step no-ops when already done.`)
  process.exit(0)
}
const skipLlama = args.includes('--skip-llama')
const skipModel = args.includes('--skip-model')
const skipMandate = args.includes('--skip-mandate')

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, a => res(a.trim())))
const say = (s: string): void => console.log(s)
const step = (s: string): void => console.log(`\n=== ${s} ===`)

/** Run a command inheriting stdio (for long/interactive ops); true on exit 0. */
function run(cmd: string, cmdArgs: string[], cwd?: string): boolean {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd })
  return r.status === 0
}
/** Run capturing stdout; '' on any failure. */
function capture(cmd: string, cmdArgs: string[]): string {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8' })
  return r.status === 0 && r.stdout ? r.stdout.trim() : ''
}
function has(bin: string): boolean {
  const exe = platform() === 'win32' ? `${bin}.exe` : bin
  for (const dir of (process.env.PATH ?? '').split(delimiter))
    if (dir && existsSync(join(dir, exe))) return true
  return false
}
/** Recursively find the first file named `name` under `dir` (depth-capped). */
function findFile(dir: string, name: string, depth = 6): string | null {
  if (depth < 0 || !existsSync(dir)) return null
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isFile() && e.name === name) return p
    if (e.isDirectory()) {
      const hit = findFile(p, name, depth - 1)
      if (hit) return hit
    }
  }
  return null
}
const isWin = platform() === 'win32'

// --- manda -----------------------------------------------------------
// MANDA_BIN > `manda` on PATH > the local release build (mirrors the
// agent's resolveMandaBin — duplicated here to avoid a tools→agents import).
function resolveMandaBin(): string | null {
  const envBin = process.env.MANDA_BIN
  if (envBin && existsSync(envBin)) return envBin
  const exe = isWin ? 'manda.exe' : 'manda'
  for (const dir of (process.env.PATH ?? '').split(delimiter))
    if (dir && existsSync(join(dir, exe))) return join(dir, exe)
  const local = join(homedir(), 'manda', 'target', 'release', 'manda')
  return existsSync(local) ? local : null
}

function ensureManda(): void {
  step('manda (memory gateway)')
  const bin = resolveMandaBin()
  if (bin) { say(`ok   manda: ${bin}`); return }
  if (!has('cargo')) {
    say('MISS cargo not found — install Rust (https://rustup.rs), then re-run.')
    return
  }
  const dir = join(homedir(), 'manda')
  if (!existsSync(dir)) {
    say(`… cloning manda into ${dir}`)
    if (!run('git', ['clone', '--depth', '1', 'https://github.com/baba-yu/manda', dir])) {
      say('NG   git clone failed — clone manda manually or set MANDA_BIN.'); return
    }
  }
  say('… cargo build --release (first build is slow)')
  if (run('cargo', ['build', '--release'], dir)) say(`ok   built ${join(dir, 'target/release/manda')}`)
  else say('NG   cargo build failed — see output above.')
}

// --- llama.cpp -------------------------------------------------------
const LLAMA_DIR = join(homedir(), '.local', 'share', 'nunc-stans', 'llama.cpp')

function resolveLlamaServer(): string | null {
  const envBin = process.env.LLAMACPP_BIN
  if (envBin && existsSync(envBin)) return envBin
  if (has('llama-server')) return 'llama-server'
  return findFile(LLAMA_DIR, isWin ? 'llama-server.exe' : 'llama-server')
}

/** Pick the CPU prebuilt asset for this platform from a release's assets. */
function pickLlamaAsset(assets: Array<{ name: string; browser_download_url: string }>): { name: string; browser_download_url: string } | null {
  const p = platform(), a = process.arch
  // Skip accelerator-specific builds — they need a vendor runtime the box
  // may lack (openvino cost a wasted download on this machine, 2026-07-08).
  // CPU is the portable default; GPU is a manual opt-in.
  const bad = /cuda|vulkan|hip|sycl|kompute|openvino|openblas|musa|cann/i
  let rx: RegExp
  if (p === 'linux') rx = /(ubuntu|linux).*(x64|amd64)/i
  else if (p === 'darwin') rx = a === 'arm64' ? /macos-arm64/i : /macos-x64/i
  else rx = /win.*(x64|amd64)/i
  const matches = assets
    .filter(x => rx.test(x.name) && !bad.test(x.name) && /\.(zip|tar\.gz|tgz)$/i.test(x.name))
    .sort((x, y) => x.name.length - y.name.length) // plainest (shortest) name = the portable CPU build
  return matches[0] ?? null
}

async function ensureLlamaServer(): Promise<string | null> {
  step('llama.cpp (local model backend)')
  const existing = resolveLlamaServer()
  if (existing) { say(`ok   llama-server: ${existing}`); return existing }
  if (isWin) {
    say('info native Windows: download a llama.cpp release and put llama-server.exe on PATH')
    say('     https://github.com/ggml-org/llama.cpp/releases  (or set LLAMACPP_BIN)')
    return null
  }
  if (!has('unzip') && !has('tar')) { say('MISS need `unzip` or `tar` to extract — install one, then re-run.'); return null }
  say('… fetching latest llama.cpp release metadata')
  let asset: { name: string; browser_download_url: string } | null = null
  try {
    const res = await fetch('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest', {
      headers: { 'user-agent': 'nunc-stans-setup', accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rel = await res.json() as { tag_name?: string; assets?: Array<{ name: string; browser_download_url: string }> }
    asset = pickLlamaAsset(rel.assets ?? [])
    if (!asset) {
      say(`NG   no prebuilt asset matched ${platform()}/${process.arch}. Available:`)
      for (const x of rel.assets ?? []) say(`       ${x.name}`)
      say('     Pick one manually, extract into ' + LLAMA_DIR + ', or set LLAMACPP_BIN.')
      return null
    }
    say(`… ${rel.tag_name}: ${asset.name}`)
  } catch (e) {
    say(`NG   could not reach the GitHub releases API (${e instanceof Error ? e.message : e}).`)
    return null
  }
  mkdirSync(LLAMA_DIR, { recursive: true })
  const archive = join(LLAMA_DIR, asset.name)
  say(`… downloading ${asset.name}`)
  if (!(has('curl') ? run('curl', ['-fL', '-o', archive, asset.browser_download_url])
    : run('wget', ['-O', archive, asset.browser_download_url]))) {
    say('NG   download failed.'); return null
  }
  say('… extracting')
  const ok = /\.zip$/i.test(archive) ? run('unzip', ['-o', archive, '-d', LLAMA_DIR])
    : run('tar', ['-xzf', archive, '-C', LLAMA_DIR])
  if (!ok) { say('NG   extraction failed.'); return null }
  const bin = findFile(LLAMA_DIR, 'llama-server')
  if (!bin) { say('NG   llama-server not found in the archive.'); return null }
  run('chmod', ['+x', bin])
  say(`ok   llama-server: ${bin}`)
  return bin
}

// --- model -----------------------------------------------------------
interface ModelChoice { label: string; url: string; approx: string }
const MODELS: ModelChoice[] = [
  // Qwen family = PE9' tool-calling target. URLs are VERIFIED by download;
  // if one 404s, pick another or paste a custom resolve URL.
  { label: 'Qwen2.5-3B-Instruct (Q4_K_M, small/fast)', approx: '~2.0 GB', url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf' },
  { label: 'Qwen2.5-7B-Instruct (Q4_K_M, balanced)', approx: '~4.7 GB', url: 'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf' },
  { label: 'Qwen2.5-14B-Instruct (Q4_K_M, strongest)', approx: '~9.0 GB', url: 'https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF/resolve/main/qwen2.5-14b-instruct-q4_k_m.gguf' },
]

async function selectAndDownloadModel(): Promise<string | null> {
  step('local model (GGUF)')
  const modelsDir = join(resolveDataDir().dir ?? '.', 'models')
  mkdirSync(modelsDir, { recursive: true })
  const already = existsSync(modelsDir) ? readdirSync(modelsDir).filter(f => f.endsWith('.gguf')) : []
  if (already.length) {
    say(`found existing model(s): ${already.join(', ')}`)
    if ((await ask('download another? [y/N] ')).toLowerCase() !== 'y') return join(modelsDir, already[0])
  }
  say('choose a model (Qwen = tool-calling target, PE9\'):')
  MODELS.forEach((m, i) => say(`  ${i + 1}) ${m.label}  ${m.approx}`))
  say('  c) custom Hugging Face resolve URL')
  say('  s) skip (choose later)')
  const choice = (await ask('selection [2]: ')).toLowerCase() || '2'
  if (choice === 's') { say('skipped — set a model URL later and re-run.'); return null }
  let url: string
  if (choice === 'c') url = await ask('paste .gguf resolve URL: ')
  else {
    const idx = Number(choice) - 1
    if (!MODELS[idx]) { say('invalid selection — skipping.'); return null }
    url = MODELS[idx].url
  }
  if (!/^https?:\/\/.+\.gguf(\?.*)?$/i.test(url)) { say('NG   not a .gguf URL — skipping.'); return null }
  const dest = join(modelsDir, url.split('/').pop()!.split('?')[0])
  if (existsSync(dest) && statSync(dest).size > 0) { say(`ok   already downloaded: ${dest}`); return dest }
  say(`… downloading to ${dest} (this can take a while)`)
  const ok = has('curl') ? run('curl', ['-fL', '-o', dest, url]) : run('wget', ['-O', dest, url])
  if (!ok) { say('NG   model download failed (bad URL? try another).'); return null }
  say(`ok   model: ${dest}`)
  return dest
}

// --- validation ------------------------------------------------------
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function validateModel(llamaBin: string, modelPath: string): Promise<void> {
  step('validate the model (chat smoke + tool probe)')
  const port = 8791
  const base = `http://127.0.0.1:${port}`
  say('… starting llama-server (--jinja for tool support)')
  const srv = spawn(llamaBin, ['-m', modelPath, '--host', '127.0.0.1', '--port', String(port), '-c', '4096', '--jinja'], { stdio: 'ignore' })
  try {
    let up = false
    for (let i = 0; i < 120; i++) { // model load can be slow; ~120s budget
      await sleep(1000)
      try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).ok) { up = true; break } } catch { /* not ready */ }
    }
    if (!up) { say('NG   server did not come up in time — validation inconclusive.'); return }

    const chat = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with the single word: ready' }], max_tokens: 16 }),
      signal: AbortSignal.timeout(60_000),
    })
    const chatBody = await chat.json() as { choices?: Array<{ message?: { content?: string } }> }
    say(chat.ok && chatBody.choices?.[0]?.message?.content ? `ok   chat: "${chatBody.choices[0].message!.content!.trim().slice(0, 40)}"` : 'WARN chat smoke returned no content')

    const tool = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What time is it in Tokyo? Use the tool.' }],
        max_tokens: 128,
        tools: [{ type: 'function', function: { name: 'get_time', description: 'Get the current time in a city', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } } }],
      }),
      signal: AbortSignal.timeout(60_000),
    })
    const toolBody = await tool.json() as { choices?: Array<{ message?: { tool_calls?: unknown[] } }> }
    const calls = toolBody.choices?.[0]?.message?.tool_calls
    say(Array.isArray(calls) && calls.length
      ? `ok   tool-calling: model emitted ${calls.length} tool_call(s) — PE9' target confirmed`
      : 'WARN tool probe: no tool_calls (model may not be tool-tuned; PE9/T0 must re-check)')
  } finally {
    srv.kill('SIGTERM')
    await sleep(500)
  }
}

// --- manda memory home + first mandate -------------------------------
function ensureMandaHome(): string {
  step('manda memory home')
  const dir = resolveMandaDataDir()
  mkdirSync(dir, { recursive: true })
  writeConfigKey('manda_data_dir', dir)
  say(`ok   memory home: ${dir}`)
  return dir
}

async function firstMandate(dataDir: string): Promise<void> {
  step('first mandate (granted by YOU, out of band — A1)')
  const file = join(dataDir, 'mandates.jsonl')
  if (existsSync(file) && readFileSync(file, 'utf8').trim()) {
    say('ok   a mandate already exists — leaving it untouched.'); return
  }
  say('The agent can read/propose freely, but committing a memory needs a')
  say('mandate authorizing a scope. Grant your first one now (or skip).')
  const purpose = await ask('What will you use the agent\'s memory for? (free text, optional): ')
  if (purpose) say(`(noted: ${purpose})`)
  const scope = (await ask('scope to authorize [notes/*]: ')) || 'notes/*'
  const line = mandateJsonl(scope, new Date())
  say('\nthis line will be appended to ' + file + ':')
  say('  ' + line)
  if ((await ask(`grant this mandate now? [y/N] `)).toLowerCase() === 'y') {
    appendFileSync(file, line + '\n')
    say(`ok   granted — ${scope} authorized for 30 days.`)
  } else {
    say('skipped — no mandate written. Grant one later with:')
    say(`  nunc-stans-agent mandate-template '${scope}' | tail -1 >> "${file}"`)
  }
}

// --- orchestration ---------------------------------------------------
async function main(): Promise<void> {
  say('nunc-stans setup — batteries-included first run\n')

  step('bootstrap (toolchain + data store)')
  if (!run('sh', ['tools/bootstrap.sh'])) say('WARN bootstrap reported issues (see above) — continuing.')

  ensureManda()

  let llamaBin: string | null = null
  if (skipLlama) say('\n(skipping llama.cpp per --skip-llama)')
  else llamaBin = await ensureLlamaServer()

  let modelPath: string | null = null
  if (skipModel) say('\n(skipping model per --skip-model)')
  else modelPath = await selectAndDownloadModel()

  if (llamaBin && modelPath) await validateModel(llamaBin, modelPath)
  else say('\n(model validation skipped — need both llama-server and a model)')

  const home = ensureMandaHome()
  if (skipMandate) say('\n(skipping mandate per --skip-mandate)')
  else if (resolveMandaBin()) await firstMandate(home)
  else say('\n(no manda binary — mandate step skipped; re-run once manda is built)')

  step('done')
  say('next:')
  say('  just up         # start the stack (gate + engine + fourfive)')
  say('  just agent      # chat with the first-party agent (memory ON if manda + mandate)')
  if (llamaBin) say(`  ${llamaBin} -m <model> --port 8080 --jinja   # run the local model for llama-cpp profiles`)
}

main().then(() => { rl.close(); process.exit(0) }, e => { rl.close(); console.error(`setup: ${e instanceof Error ? e.message : e}`); process.exit(1) })
