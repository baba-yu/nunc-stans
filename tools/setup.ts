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
  appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync,
} from 'node:fs'
import { createInterface } from 'node:readline'
import { delimiter, join } from 'node:path'
import { homedir, platform } from 'node:os'
import { readConfig, resolveDataDir, resolveMandaDataDir, writeConfigKey } from './lib/data-dir.ts'
import { mandateJsonl } from './lib/mandate.ts'

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`usage: node tools/setup.ts [--skip-llama] [--skip-model] [--skip-mandate] [--cuda|--no-cuda]
  Ensures manda + llama.cpp, downloads/validates a model, seeds the first
  mandate. Re-runnable; each step no-ops when already done.
  On an NVIDIA machine, offers a CUDA source build of llama-server (asks
  first; --cuda builds without asking, --no-cuda never asks) after
  validating the toolkit (nvcc <= driver CUDA version, cmake, compiler).`)
  process.exit(0)
}
const skipLlama = args.includes('--skip-llama')
const skipModel = args.includes('--skip-model')
const skipMandate = args.includes('--skip-mandate')
// CUDA source build: --cuda builds without prompting, --no-cuda never asks;
// otherwise setup ASKS interactively (and defaults to no on a non-TTY run).
const cudaChoice: 'yes' | 'no' | 'ask' = args.includes('--cuda') ? 'yes' : args.includes('--no-cuda') ? 'no' : 'ask'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, a => res(a.trim())))
const say = (s: string): void => console.log(s)
const step = (s: string): void => console.log(`\n=== ${s} ===`)

/** Run a command inheriting stdio (for long/interactive ops); true on exit 0. */
function run(cmd: string, cmdArgs: string[], cwd?: string, env?: NodeJS.ProcessEnv): boolean {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd, env })
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

// Build-flavor policy. The machine decides:
// - NVIDIA GPU present (nvidia-smi works, WSL2 included) => a GPU-offload
//   asset: cuda when the release ships one for this OS, else vulkan (the
//   ubuntu releases carry no cuda prebuilt — vulkan is the NVIDIA path
//   there). A CPU build on a GPU box wastes the hardware (a 27B runs
//   ~2.6 tok/s on CPU; found the hard way 2026-07-09).
// - No GPU => the plain CPU asset (portable default).
// - The remaining accelerator flavors are never auto-picked AND an
//   installed one is replaced: the OpenVINO asset hard-links
//   libggml-openvino.so (no plugin to remove) and cannot run
//   hybrid/recurrent models — Qwen3.6's DeltaNet cache tensors abort in
//   ggml_backend_sched_split_graph (llama.cpp #22333, closed not-planned).
// LLAMACPP_BIN / PATH picks are always the user's own choice, never vetted.
//
// Flavor detection parses the backend TOKEN out of libggml-<backend>[-.]…
// filenames — a substring regex once matched Huawei 'cann' inside the CPU
// variant lib 'libggml-cpu-CANNonlake.so' and re-quarantined healthy CPU
// builds on every setup run.
const OTHER_ACCEL_BACKENDS = new Set(['hip', 'rocm', 'sycl', 'kompute', 'openvino', 'opencl', 'blas', 'openblas', 'musa', 'cann'])
// Asset-name filter (hyphen-delimited words — 'cannonlake' never appears here).
const ACCEL_ASSET = /-(cuda|vulkan|hip|rocm|sycl|kompute|openvino|opencl|blas|openblas|musa|cann)\b/i

const hasNvidiaGpu: boolean = (() => {
  const r = spawnSync('nvidia-smi', ['-L'], { encoding: 'utf8' })
  return r.status === 0 && /GPU/i.test(r.stdout ?? '')
})()

// Under WSL2 the vulkan prebuilt goes through Mesa's Dozen (Vulkan-on-D3D12)
// and is SLOWER than plain CPU (measured 2026-07-09: 27B 0.7 tok/s vulkan vs
// 2.6 CPU vs ~54 via ollama's native CUDA). So on WSL the local binary stays
// CPU and the GPU path is an external backend (config llama_url — see
// detectExternalBackend below).
const isWsl: boolean = (() => {
  try { return /microsoft/i.test(readFileSync('/proc/version', 'utf8')) } catch { return false }
})()

const wantGpuBuild = hasNvidiaGpu && !isWsl

/** A GPU-resident ollama serves an OpenAI-compatible /v1 — on WSL that is
 * the only prebuilt way to use an NVIDIA card, and it beats the local CPU
 * server everywhere. Detect it and remember it as `llama_url` (only when
 * the key is absent — an explicit choice is never overwritten). */
async function detectExternalBackend(): Promise<void> {
  if (!hasNvidiaGpu) return
  const cfg = readConfig()
  // A PRESENT key is an explicit choice — including an explicitly empty
  // one ("use the local server"), which auto-detection must not override.
  if ('llama_url' in cfg) {
    say(typeof cfg.llama_url === 'string' && cfg.llama_url
      ? `ok   external model backend (config llama_url): ${cfg.llama_url}`
      : 'ok   local llama-server chosen (config llama_url explicitly empty)')
    return
  }
  const url = 'http://127.0.0.1:11434'
  try {
    const res = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return
    writeConfigKey('llama_url', url)
    say(`ok   NVIDIA GPU + ollama detected — llama_url=${url} remembered (GPU-served models; unset the config key to go back to the local llama-server)`)
  } catch { /* no ollama — the local server stays the backend */ }
}

type Flavor = 'cuda' | 'vulkan' | 'accel-other' | 'cpu'

function buildFlavor(bin: string): Flavor {
  try {
    const dir = bin.slice(0, bin.lastIndexOf('/'))
    const backends = readdirSync(dir)
      .map(f => /^libggml-([a-z0-9]+)[.-]/i.exec(f)?.[1]?.toLowerCase())
      .filter((b): b is string => !!b)
    if (backends.includes('cuda')) return 'cuda'
    if (backends.includes('vulkan')) return 'vulkan'
    if (backends.some(b => OTHER_ACCEL_BACKENDS.has(b))) return 'accel-other'
    return 'cpu'
  } catch { return 'cpu' }
}

/** Does an installed build fit this machine? cuda fits ANY NVIDIA box
 * (WSL CUDA is native-speed — a source-built server lives here too);
 * vulkan only fits native Linux (Dozen on WSL is slower than CPU); cpu
 * fits wherever a GPU prebuilt isn't wanted (incl. WSL, as the fallback
 * beside a source-built cuda dir — tools/llama.ts picks the newest). */
function flavorFits(flavor: Flavor): boolean {
  if (flavor === 'cuda') return hasNvidiaGpu
  if (flavor === 'vulkan') return hasNvidiaGpu && !isWsl
  if (flavor === 'cpu') return !wantGpuBuild
  return false
}

/** Pick the prebuilt asset for this platform per the flavor policy above. */
function pickLlamaAsset(assets: Array<{ name: string; browser_download_url: string }>): { name: string; browser_download_url: string } | null {
  const p = platform(), a = process.arch
  let rx: RegExp
  if (p === 'linux') rx = /(ubuntu|linux).*(x64|amd64)/i
  else if (p === 'darwin') rx = a === 'arm64' ? /macos-arm64/i : /macos-x64/i
  else rx = /win.*(x64|amd64)/i
  const archived = (n: string) => /\.(zip|tar\.gz|tgz)$/i.test(n)
  const shortest = (m: typeof assets) => [...m].sort((x, y) => x.name.length - y.name.length)[0] ?? null
  const plat = assets.filter(x => rx.test(x.name) && archived(x.name))
  if (wantGpuBuild) {
    for (const want of ['cuda', 'vulkan']) {
      const hit = shortest(plat.filter(x => new RegExp(`-${want}\\b`, 'i').test(x.name)))
      if (hit) return hit
    }
    say('WARN NVIDIA GPU detected but no cuda/vulkan asset in this release — falling back to the CPU build.')
  }
  return shortest(plat.filter(x => !ACCEL_ASSET.test(x.name))) // plainest = the portable CPU build
}

/** Validate the CUDA build prerequisites BEFORE offering the source build:
 * nvcc present, its release not newer than what the driver supports
 * (nvidia-smi "CUDA Version"), cmake + a C++ compiler available. */
function cudaToolkitStatus(): { ok: boolean; why: string; nvcc?: string } {
  const nvcc = has('nvcc') ? 'nvcc'
    : ['/usr/local/cuda/bin/nvcc', '/opt/cuda/bin/nvcc'].find(p => existsSync(p)) ?? null
  if (!nvcc) return { ok: false, why: 'nvcc not found — install the CUDA toolkit (WSL: https://docs.nvidia.com/cuda/wsl-user-guide/)' }
  const toolkit = /release (\d+\.\d+)/.exec(capture(nvcc, ['--version']))?.[1]
  if (!toolkit) return { ok: false, why: `could not parse \`${nvcc} --version\`` }
  const driver = /CUDA Version:\s*(\d+\.\d+)/.exec(capture('nvidia-smi', []))?.[1]
  if (driver && parseFloat(toolkit) > parseFloat(driver)) {
    return { ok: false, why: `CUDA toolkit ${toolkit} is newer than the driver supports (${driver}) — update the driver or install a toolkit <= ${driver}` }
  }
  if (!has('cmake')) return { ok: false, why: 'cmake not found — install cmake' }
  if (!has('g++') && !has('c++') && !has('clang++')) return { ok: false, why: 'no C++ compiler — install build-essential' }
  return { ok: true, why: `toolkit ${toolkit}${driver ? ` <= driver CUDA ${driver}` : ''}`, nvcc }
}

/** Clone (pinned to the release tag) + cmake-build llama-server with CUDA,
 * installed as its own build dir under LLAMA_DIR so tools/llama.ts picks it
 * (newest mtime). Returns the built binary or null. */
async function buildCudaServer(tag: string): Promise<string | null> {
  const src = join(homedir(), '.local', 'share', 'nunc-stans', 'llama.cpp-src')
  if (!existsSync(join(src, 'CMakeLists.txt'))) {
    say(`… cloning llama.cpp ${tag} into ${src}`)
    if (!run('git', ['clone', '--depth', '1', '--branch', tag, 'https://github.com/ggml-org/llama.cpp', src])) {
      say('NG   clone failed.'); return null
    }
  } else {
    say(`ok   reusing source checkout ${src} (delete it to re-clone at ${tag})`)
  }
  const env = { ...process.env, PATH: `/usr/local/cuda/bin:${process.env.PATH ?? ''}` }
  say('… cmake configure (CUDA)')
  if (!run('cmake', ['-B', 'build', '-DGGML_CUDA=ON', '-DCMAKE_BUILD_TYPE=Release',
    '-DLLAMA_BUILD_TESTS=OFF', '-DLLAMA_BUILD_EXAMPLES=OFF', '-DLLAMA_BUILD_SERVER=ON'], src, env)) {
    say('NG   cmake configure failed.'); return null
  }
  say('… building llama-server (10-20 min the first time)')
  if (!run('cmake', ['--build', 'build', '--target', 'llama-server', '-j', String(Math.max(2, (await import('node:os')).cpus().length - 2))], src, env)) {
    say('NG   build failed.'); return null
  }
  const binDir = join(src, 'build', 'bin')
  const dest = join(LLAMA_DIR, `llama-${tag}-cuda-local`)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  for (const f of readdirSync(binDir)) {
    if (f === 'llama-server' || /\.so(\.|$)/.test(f)) copyFileSync(join(binDir, f), join(dest, f))
  }
  const bin = join(dest, 'llama-server')
  run('chmod', ['+x', bin])
  say(`ok   CUDA llama-server: ${bin}`)
  return bin
}

async function ensureLlamaServer(): Promise<string | null> {
  step('llama.cpp (local model backend)')
  const existing = resolveLlamaServer()
  const vetted = existing !== null && existing.startsWith(LLAMA_DIR) // PATH/LLAMACPP_BIN = user's choice
  if (existing && vetted && !flavorFits(buildFlavor(existing))) {
    // Wrong flavor for this machine: quarantine OUTSIDE LLAMA_DIR so no
    // resolver can find it again, then fall through to the download below.
    const why = buildFlavor(existing) === 'accel-other'
      ? 'an accelerator build that crashes on hybrid models (llama.cpp #22333)'
      : wantGpuBuild ? 'a CPU-only build on an NVIDIA machine (wastes the GPU)'
      : 'a GPU-flavored build this machine cannot use well (WSL vulkan runs via Dozen, slower than CPU)'
    say(`NG   ${existing} is ${why} — replacing with the ${wantGpuBuild ? 'GPU (cuda/vulkan)' : 'plain CPU'} build.`)
    const disabled = LLAMA_DIR + '-disabled'
    const top = existing.slice(LLAMA_DIR.length + 1).split('/')[0]
    mkdirSync(disabled, { recursive: true })
    // The same build name may already sit in quarantine (e.g. re-runs after
    // a flavor-policy change) — pick a free target instead of crashing.
    let target = join(disabled, top)
    for (let n = 2; existsSync(target); n++) target = join(disabled, `${top}-${n}`)
    renameSync(join(LLAMA_DIR, top), target)
    say(`     old build kept at ${target} (delete it when confident)`)
  } else if (existing) { say(`ok   llama-server: ${existing}`); return existing }
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
    // On an NVIDIA box, a CUDA SOURCE build beats every prebuilt this side
    // of native Linux (WSL: 70 tok/s CUDA vs 2.6 CPU vs 0.7 Dozen-vulkan,
    // measured 2026-07-10) — offer it, but only after validating the
    // toolchain, and never without asking (or the explicit --cuda flag).
    const tag = rel.tag_name ?? 'master'
    if (hasNvidiaGpu && cudaChoice !== 'no') {
      const tk = cudaToolkitStatus()
      if (!tk.ok) {
        say(`info CUDA source build unavailable: ${tk.why}`)
      } else {
        let yes = cudaChoice === 'yes'
        if (!yes && process.stdin.isTTY) {
          yes = (await ask(`NVIDIA GPU detected, ${tk.why}. Build llama.cpp ${tag} with CUDA from source (~10-20 min)? [y/N] `)).toLowerCase() === 'y'
        } else if (!yes) {
          say('info non-interactive run — CUDA build skipped (pass --cuda to build without asking)')
        }
        if (yes) {
          const built = await buildCudaServer(tag)
          if (built) return built
          say('WARN CUDA build failed — falling back to a prebuilt asset.')
        }
      }
    }
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

/** True only when the server came up AND answered a chat. A model that
 * cannot serve is a setup FAILURE (a broken 27B once passed as "done"
 * because this was a WARN) — main() exits nonzero on false. */
async function validateModel(llamaBin: string, modelPath: string): Promise<boolean> {
  step('validate the model (chat smoke + tool probe)')
  const port = 8791
  const base = `http://127.0.0.1:${port}`
  say('… starting llama-server (--jinja for tool support)')
  const srv = spawn(llamaBin, ['-m', modelPath, '--host', '127.0.0.1', '--port', String(port), '-c', '4096', '--jinja'], { stdio: 'ignore' })
  try {
    let up = false
    for (let i = 0; i < 120; i++) { // model load can be slow; ~120s budget
      await sleep(1000)
      if (srv.exitCode !== null) { say(`NG   llama-server exited (code ${srv.exitCode}) while loading — this model cannot be served by this build.`); return false }
      try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).ok) { up = true; break } } catch { /* not ready */ }
    }
    if (!up) { say('NG   server did not come up in time — the model backend is NOT usable.'); return false }

    // Reasoning models (Qwen3.6 with --jinja) may spend the whole budget on
    // reasoning_content; any generated text proves the backend serves.
    // Budgets/timeouts sized for CPU-speed 27B (~2-3 tok/s).
    const chat = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with the single word: ready' }], max_tokens: 128 }),
      signal: AbortSignal.timeout(180_000),
    })
    const chatBody = await chat.json() as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> }
    const msg = chatBody.choices?.[0]?.message
    const text = msg?.content?.trim() || msg?.reasoning_content?.trim() || ''
    if (!(chat.ok && text)) { say('NG   chat smoke returned no content — the model backend is NOT usable.'); return false }
    say(`ok   chat: "${text.slice(0, 40)}"${msg?.content?.trim() ? '' : ' (reasoning-only within budget — serving works)'}`)

    const tool = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What time is it in Tokyo? Use the tool.' }],
        max_tokens: 512, // reasoning models think before calling — leave room
        tools: [{ type: 'function', function: { name: 'get_time', description: 'Get the current time in a city', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } } }],
      }),
      signal: AbortSignal.timeout(360_000), // 512 tokens at CPU-27B speed
    })
    const toolBody = await tool.json() as { choices?: Array<{ message?: { tool_calls?: unknown[] } }> }
    const calls = toolBody.choices?.[0]?.message?.tool_calls
    say(Array.isArray(calls) && calls.length
      ? `ok   tool-calling: model emitted ${calls.length} tool_call(s) — PE9' target confirmed`
      : 'WARN tool probe: no tool_calls (model may not be tool-tuned; PE9/T0 must re-check)')
    return true
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
  // Mirror bootstrap's guard: a home derived from a per-invocation env
  // override (NS_DATA / MANDA_DATA_DIR / deprecated FED_DATA) is used for
  // this run only, never baked into the persistent config — a story
  // runbook's mktemp scratch must not become the agent's memory home.
  if (process.env.MANDA_DATA_DIR || process.env.NS_DATA || process.env.FED_DATA) {
    say(`ok   memory home (env override, not persisted): ${dir}`)
  } else {
    writeConfigKey('manda_data_dir', dir)
    say(`ok   memory home: ${dir}`)
  }
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

  step('model backend routing')
  await detectExternalBackend()

  let llamaBin: string | null = null
  if (skipLlama) say('\n(skipping llama.cpp per --skip-llama)')
  else llamaBin = await ensureLlamaServer()

  let modelPath: string | null = null
  if (skipModel) say('\n(skipping model per --skip-model)')
  else modelPath = await selectAndDownloadModel()

  let valOk: boolean | null = null
  if (llamaBin && modelPath) valOk = await validateModel(llamaBin, modelPath)
  else say('\n(model validation skipped — need both llama-server and a model)')

  const home = ensureMandaHome()
  if (skipMandate) say('\n(skipping mandate per --skip-mandate)')
  else if (resolveMandaBin()) await firstMandate(home)
  else say('\n(no manda binary — mandate step skipped; re-run once manda is built)')

  if (valOk === false) {
    step('FAILED')
    say('NG   the local model backend failed validation — `just up` would serve')
    say('     the offline demo only. Fix the model/build above, then re-run.')
    process.exitCode = 1
    return
  }
  step('done')
  say('next:')
  say('  just up         # start the stack (llama + gate + engine + fourfive + apps)')
  say('  just agent      # chat with the first-party agent (memory ON if manda + mandate)')
  say('  just llama      # (re)start only the local model backend')
}

main().then(() => { rl.close(); process.exit(0) }, e => { rl.close(); console.error(`setup: ${e instanceof Error ? e.message : e}`); process.exit(1) })
