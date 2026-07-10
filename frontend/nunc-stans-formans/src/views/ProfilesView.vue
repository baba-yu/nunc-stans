<script setup lang="ts">
// Profiles screen (Phase D, v1 plan §2.7 / S-5): create, edit, duplicate,
// delete agent profiles and pick the default per calling context. All
// writes go through the gate's /api/profiles — the F3 and no-credential
// rails live server-side; this screen just surfaces their errors.
import { computed, onMounted, reactive, ref } from 'vue'
import { Panel } from 'nunc-ui'
import {
  CONTEXTS, PROVIDERS, blankForm, duplicateForm, toForm, toPayload,
} from '../profiles'
import type { ContextKey, ProfileForm, ProfilePayload } from '../profiles'
import {
  downloadLabel, perSlotCtx, toForm as backendToForm, toPayload as backendToPayload,
} from '../model-backend'
import type { DownloadStatus, ModelBackendForm, ModelBackendState } from '../model-backend'

const profiles = ref<ProfilePayload[]>([])
const defaults = reactive<Partial<Record<ContextKey, string>>>({})
const status = ref<{ ok: boolean; message: string } | null>(null)
const editing = ref<ProfileForm | null>(null)
const editingExisting = ref(false)
const loading = ref(true)

const sorted = computed(() => [...profiles.value].sort((a, b) => a.id.localeCompare(b.id)))

async function load() {
  loading.value = true
  try {
    const [pr, dr] = await Promise.all([fetch('/api/profiles'), fetch('/api/profiles/defaults')])
    if (!pr.ok || !dr.ok) {
      status.value = { ok: false, message: `profiles unavailable (${pr.status}/${dr.status})` }
      return
    }
    profiles.value = await pr.json()
    const d = await dr.json()
    for (const c of CONTEXTS) defaults[c.key] = d[c.key]
  } catch (e) {
    status.value = { ok: false, message: `profiles unavailable: ${e}` }
  } finally {
    loading.value = false
  }
}

function startCreate() {
  editing.value = blankForm()
  editingExisting.value = false
  status.value = null
}
function startEdit(p: ProfilePayload) {
  editing.value = toForm(p)
  editingExisting.value = true
  status.value = null
}
function startDuplicate(p: ProfilePayload) {
  editing.value = duplicateForm(p)
  editingExisting.value = false
  status.value = null
}

async function save() {
  if (!editing.value) return
  const payload = toPayload(editing.value)
  const r = await fetch(`/api/profiles/${encodeURIComponent(payload.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (r.ok) {
    status.value = { ok: true, message: `saved ${payload.id}` }
    editing.value = null
    await load()
  } else {
    status.value = { ok: false, message: `save failed (${r.status}): ${await r.text()}` }
  }
}

async function remove(id: string) {
  const r = await fetch(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (r.ok) {
    status.value = { ok: true, message: `deleted ${id}` }
    await load()
  } else {
    status.value = { ok: false, message: `delete failed (${r.status}): ${await r.text()}` }
  }
}

async function saveDefaults() {
  const body: Record<string, string> = {}
  for (const c of CONTEXTS) {
    const v = defaults[c.key]
    if (v) body[c.key] = v
  }
  const r = await fetch('/api/profiles/defaults', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  status.value = r.ok
    ? { ok: true, message: 'defaults saved — the next call in each context uses them (no restart)' }
    : { ok: false, message: `defaults save failed (${r.status}): ${await r.text()}` }
}

// --- Model backend (local llama-server serving knobs / external URL) ---
const backend = ref<ModelBackendForm | null>(null)
const backendState = ref<ModelBackendState | null>(null)
const backendStatus = ref<{ ok: boolean; message: string } | null>(null)

async function loadBackend() {
  try {
    const r = await fetch('/api/model-backend')
    if (!r.ok) {
      backendStatus.value = { ok: false, message: `model backend unavailable (${r.status})` }
      return
    }
    backendState.value = await r.json()
    backend.value = backendToForm(backendState.value!)
  } catch (e) {
    backendStatus.value = { ok: false, message: `model backend unavailable: ${e}` }
  }
}

async function saveBackend() {
  if (!backend.value) return
  const r = await fetch('/api/model-backend', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(backendToPayload(backend.value)),
  })
  if (r.ok) {
    backendState.value = await r.json()
    backend.value = backendToForm(backendState.value!)
    backendStatus.value = { ok: true, message: `saved — applies on ${backendState.value!.applies_on}` }
  } else {
    backendStatus.value = { ok: false, message: `save failed (${r.status}): ${await r.text()}` }
  }
}

// --- Model install (catalog / custom URL, gate-managed download) ---
const installChoice = ref('')
const customUrl = ref('')
const download = ref<DownloadStatus>({ state: 'idle' })
let pollTimer: ReturnType<typeof setInterval> | null = null

async function pollDownload() {
  try {
    const r = await fetch('/api/model-backend/download')
    if (r.ok) download.value = await r.json()
  } catch { /* transient */ }
  if (download.value.state !== 'running' && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    if (download.value.state === 'done') await loadBackend() // new GGUF appears
  }
}

async function startInstall() {
  const body = installChoice.value === 'custom'
    ? { url: customUrl.value.trim() }
    : { id: installChoice.value }
  const r = await fetch('/api/model-backend/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    backendStatus.value = { ok: false, message: `install failed (${r.status}): ${await r.text()}` }
    return
  }
  backendStatus.value = { ok: true, message: await r.text() }
  download.value = { state: 'running' }
  if (!pollTimer) pollTimer = setInterval(pollDownload, 2000)
}

async function applyNow() {
  const r = await fetch('/api/model-backend/restart', { method: 'POST' })
  backendStatus.value = r.ok
    ? { ok: true, message: 'model backend restarting with the saved settings (a few seconds to reload)' }
    : { ok: false, message: `restart failed (${r.status}): ${await r.text()}` }
}

onMounted(() => { load(); loadBackend(); pollDownload() })
</script>

<template>
  <main class="page">
    <Panel title="Agent profiles">
      <p class="meta">
        A profile names the runtime/model, prompt, skills, memory scope, and
        goal-verify defaults for one calling context. Providers/models only —
        never credentials (keys stay in the environment).
      </p>
      <p v-if="status" class="meta" :class="{ warn: !status.ok }">{{ status.message }}</p>
      <p v-if="loading" class="meta">loading…</p>

      <table v-else-if="sorted.length" class="profiles">
        <thead>
          <tr><th>id</th><th>name</th><th>provider</th><th>model</th><th>verify</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in sorted" :key="p.id">
            <td><code>{{ p.id }}</code></td>
            <td>{{ p.name }}</td>
            <td>{{ p.provider }}</td>
            <td>{{ p.model ?? '—' }}</td>
            <td>{{ p.goal_verify?.verify ?? 'off' }}</td>
            <td class="row-actions">
              <button type="button" @click="startEdit(p)">edit</button>
              <button type="button" @click="startDuplicate(p)">duplicate</button>
              <button type="button" class="danger" @click="remove(p.id)">delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="meta">No profiles yet.</p>
      <p><button type="button" @click="startCreate">new profile</button></p>

      <form v-if="editing" class="editor" @submit.prevent="save">
        <label>
          id (slug)
          <input v-model="editing.id" :disabled="editingExisting" placeholder="local-chat" />
        </label>
        <label>
          name
          <input v-model="editing.name" placeholder="Local chat" />
        </label>
        <label>
          provider / runtime
          <select v-model="editing.provider">
            <option v-for="p in PROVIDERS" :key="p" :value="p">{{ p }}</option>
          </select>
        </label>
        <label>
          model (optional)
          <input v-model="editing.model" placeholder="e.g. qwen3.6:27b" />
        </label>
        <label class="wide">
          system prompt (optional)
          <textarea v-model="editing.systemPrompt" rows="3" />
        </label>
        <label>
          skills (comma-separated)
          <input v-model="editing.skills" placeholder="memory" />
        </label>
        <label>
          memory read scopes
          <input v-model="editing.memoryRead" placeholder="notes/*, self/commitment/*" />
        </label>
        <label>
          memory write scopes
          <input v-model="editing.memoryWrite" placeholder="notes/* (never self/commitment — F3)" />
        </label>
        <label>
          goal-verify default
          <select v-model="editing.verify">
            <option value="off">off</option>
            <option value="on">on</option>
          </select>
        </label>
        <label v-if="editing.verify === 'on'">
          default goal
          <input v-model="editing.verifyGoal" />
        </label>
        <label>
          max iterations
          <input v-model.number="editing.maxIters" type="number" min="1" max="10" />
        </label>
        <div class="editor-actions">
          <button type="submit">save</button>
          <button type="button" @click="editing = null">cancel</button>
        </div>
      </form>
    </Panel>

    <Panel title="Default profile per context">
      <p class="meta">Which profile each surface uses when none is named. Takes effect on the next call — no restart.</p>
      <form class="defaults" @submit.prevent="saveDefaults">
        <label v-for="c in CONTEXTS" :key="c.key">
          {{ c.label }}
          <select v-model="defaults[c.key]">
            <option :value="undefined">—</option>
            <option v-for="p in sorted" :key="p.id" :value="p.id">{{ p.id }}</option>
          </select>
        </label>
        <div><button type="submit">save defaults</button></div>
      </form>
    </Panel>

    <Panel title="Model backend">
      <p class="meta">
        The local llama-server's serving knobs — parallel slots let several
        tasks (code generation, web search, …) share the one loaded model
        concurrently; context is the TOTAL split across slots. Changes apply
        when the model backend restarts (<code>just up</code> / <code>just llama</code>).
      </p>
      <p v-if="backendStatus" class="meta" :class="{ warn: !backendStatus.ok }">{{ backendStatus.message }}</p>
      <form v-if="backend" class="defaults" @submit.prevent="saveBackend">
        <label>
          model (GGUF in the store)
          <select v-model="backend.model">
            <option value="">automatic (newest / profile)</option>
            <option v-for="m in backendState?.available_models ?? []" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
        <label>
          context (total tokens)
          <input v-model.number="backend.ctx" type="number" min="1024" step="1024" />
        </label>
        <label>
          parallel slots
          <input v-model.number="backend.parallel" type="number" min="1" max="32" />
        </label>
        <label>
          external backend URL (empty = local server)
          <input v-model="backend.url" placeholder="http://127.0.0.1:11434" />
        </label>
        <div class="editor-actions">
          <button type="submit">save</button>
          <button type="button" @click="applyNow">apply now (restart model)</button>
          <span class="meta">
            {{ backendState?.effective_backend === 'external' ? 'external backend' : `≈ ${perSlotCtx(backend).toLocaleString()} tokens per slot` }}
          </span>
        </div>
      </form>
      <p v-else-if="!backendStatus" class="meta">loading…</p>

      <p class="meta" style="margin-top: 0.75rem"><strong>Install a model</strong> — downloads into the store; pick it above once installed.</p>
      <form class="defaults" @submit.prevent="startInstall">
        <label>
          catalog
          <select v-model="installChoice">
            <option value="" disabled>choose…</option>
            <option v-for="c in backendState?.catalog ?? []" :key="c.id" :value="c.id" :disabled="c.installed">
              {{ c.label }} {{ c.approx }}{{ c.installed ? ' — installed' : '' }}
            </option>
            <option value="custom">custom .gguf URL…</option>
          </select>
        </label>
        <label v-if="installChoice === 'custom'">
          https URL to a .gguf
          <input v-model="customUrl" placeholder="https://huggingface.co/…/resolve/main/….gguf" />
        </label>
        <div class="editor-actions">
          <button type="submit" :disabled="!installChoice || download.state === 'running'">download</button>
          <span v-if="download.state !== 'idle'" class="meta">{{ downloadLabel(download) }}</span>
        </div>
      </form>
    </Panel>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}
.profiles {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.profiles th,
.profiles td {
  text-align: left;
  padding: 0.3rem 0.6rem 0.3rem 0;
  border-bottom: 1px solid var(--line, #ddd);
}
.row-actions {
  display: flex;
  gap: 0.4rem;
}
.editor,
.defaults {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  margin-top: 0.75rem;
}
.editor label,
.defaults label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
}
.editor .wide {
  flex-basis: 100%;
}
.editor textarea,
.editor input,
.defaults select {
  min-width: 14rem;
}
.editor-actions {
  display: flex;
  gap: 0.4rem;
}
.danger {
  color: #b23;
}
</style>
