// Model-backend settings logic (pure parts of the Profiles-view panel,
// kept out of the component so they unit-test without mounting Vue).
// Server counterpart: gate/src/model_backend.rs — GET/PUT /api/model-backend
// edits the app-config keys the llama runtime reads at start; values apply
// when the model backend restarts (just up / just llama).

export interface CatalogEntry {
  id: string
  label: string
  file: string
  approx: string
  note: string
  installed: boolean
}

export interface DownloadStatus {
  state: string // idle | running | done | error: <msg>
  file?: string
  done_bytes?: number
  total_bytes?: number | null
  percent?: number | null
}

export interface ModelBackendState {
  catalog: CatalogEntry[]
  llama_model: string | null
  llama_ctx: number
  llama_parallel: number
  llama_url: string
  defaults: { llama_ctx: number; llama_parallel: number }
  available_models: string[]
  effective_backend: 'local' | 'external'
  applies_on: string
}

/** Human progress line for the download poller. */
export function downloadLabel(d: DownloadStatus): string {
  if (d.state === 'idle') return ''
  if (d.state === 'done') return `${d.file} installed`
  if (d.state.startsWith('error')) return `${d.file ?? ''} failed — ${d.state}`
  const gb = (n?: number | null) => (n ? (n / 1e9).toFixed(1) : '?')
  return `${d.file}: ${gb(d.done_bytes)} / ${gb(d.total_bytes)} GB${d.percent != null ? ` (${d.percent}%)` : ''}`
}

export interface ModelBackendForm {
  model: string // '' = unset (newest GGUF / profile-coupled resolution)
  ctx: number
  parallel: number
  url: string // '' = local llama-server (explicit)
}

export interface ModelBackendPayload {
  llama_model?: string
  llama_ctx?: number
  llama_parallel?: number
  llama_url?: string
}

export function toForm(s: ModelBackendState): ModelBackendForm {
  return {
    model: s.llama_model ?? '',
    ctx: s.llama_ctx,
    parallel: s.llama_parallel,
    url: s.llama_url,
  }
}

/** Form → PUT body. An absent field RESETS that key to its default on the
 * server, so: model '' is omitted (unset = automatic resolution); ctx and
 * parallel are always sent (explicit is honest); url is always sent —
 * an empty string is the explicit "local server" choice that also stops
 * setup's ollama auto-detection from re-pointing it. */
export function toPayload(form: ModelBackendForm): ModelBackendPayload {
  const payload: ModelBackendPayload = {
    llama_ctx: Math.round(form.ctx),
    llama_parallel: Math.round(form.parallel),
    llama_url: form.url.trim(),
  }
  if (form.model.trim()) payload.llama_model = form.model.trim()
  return payload
}

/** Per-slot effective context (the -c value is TOTAL across slots). */
export function perSlotCtx(form: ModelBackendForm): number {
  return form.parallel > 0 ? Math.floor(form.ctx / form.parallel) : form.ctx
}
