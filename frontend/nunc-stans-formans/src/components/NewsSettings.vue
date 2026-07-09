<script setup lang="ts">
// News pipeline settings (S-3): the search-source × synthesis-model
// pair and the runtime, persisted through the gate's config API into
// <data store>/world/news-config.json — the same file the nunc-fluens
// pipeline reads at run start.
import { computed, onMounted, reactive, ref } from 'vue'

interface NewsConfig {
  runtime?: string
  search?: 'native' | 'external'
  searchEngine?: string
  synthModel?: string
  locales?: string[]
  /** AI profile whose provider/model/verify act as step DEFAULTS (Phase D). */
  profile?: string
  /** Per-step verify overrides — hand-edited/advanced; the drawer only
   * preserves what it finds. */
  stepVerify?: Record<string, unknown>
}

const RUNTIMES = ['claude-code', 'anthropic-api', 'ollama']
const ENGINES = ['brave', 'searxng', 'tavily', 'perplexity']
// The supported non-EN universe (post-C P5): the pipeline's DB schema
// is column-per-locale, so this list is fixed. EN always renders.
const LOCALES = ['ja', 'es', 'fil']

const open = ref(false)
const loading = ref(true)
const status = ref<{ ok: boolean; message: string } | null>(null)
const cfg = reactive({
  runtime: 'claude-code',
  search: 'native' as 'native' | 'external',
  searchEngine: 'brave',
  synthModel: '',
  locales: [...LOCALES],
  profile: '',
})
// Available AI profiles for the defaults dropdown (Phase D).
const profileIds = ref<string[]>([])
// Advanced per-step overrides pass through the drawer untouched.
let stepVerify: Record<string, unknown> | undefined

const summary = computed(() =>
  `${cfg.runtime} · ${cfg.search === 'native' ? 'native search' : `external: ${cfg.searchEngine}`}`
  + (cfg.synthModel ? ` · ${cfg.synthModel}` : ''))

async function load() {
  loading.value = true
  status.value = null
  try {
    const r = await fetch('/api/world/news-config')
    if (!r.ok) {
      status.value = { ok: false, message: `settings unavailable (${r.status}): ${await r.text()}` }
      return
    }
    const got: NewsConfig = await r.json()
    cfg.runtime = got.runtime ?? 'claude-code'
    cfg.search = got.search ?? 'native'
    cfg.searchEngine = got.searchEngine ?? 'brave'
    cfg.synthModel = got.synthModel ?? ''
    // Absent key = the default full set (all three checked); an empty
    // array is a deliberate EN-only choice and stays empty.
    cfg.locales = got.locales ?? [...LOCALES]
    cfg.profile = got.profile ?? ''
    stepVerify = got.stepVerify
    // Profile choices come from the same store the pipeline reads.
    try {
      const pr = await fetch('/api/profiles')
      if (pr.ok) profileIds.value = ((await pr.json()) as Array<{ id: string }>).map(p => p.id)
    } catch { /* profile list is optional decoration for the dropdown */ }
  } catch (e) {
    status.value = { ok: false, message: `settings unavailable: ${e}` }
  } finally {
    loading.value = false
  }
}

async function save() {
  status.value = null
  const body: NewsConfig = {
    runtime: cfg.runtime,
    search: cfg.search,
    // Always sent explicitly — an empty array means EN-only; omitting
    // the key would mean "the default trio" to the pipeline. Universe
    // order regardless of click order.
    locales: LOCALES.filter(l => cfg.locales.includes(l)),
  }
  if (cfg.search === 'external') body.searchEngine = cfg.searchEngine
  if (cfg.synthModel.trim()) body.synthModel = cfg.synthModel.trim()
  if (cfg.profile) body.profile = cfg.profile
  if (stepVerify) body.stepVerify = stepVerify
  const r = await fetch('/api/world/news-config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (r.ok) {
    status.value = { ok: true, message: 'saved — the next pipeline run records this pair in its run.json' }
  } else {
    status.value = { ok: false, message: `save failed (${r.status}): ${await r.text()}` }
  }
}

onMounted(load)
</script>

<template>
  <div class="news-settings">
    <p class="meta">
      Pipeline: <span>{{ loading ? 'loading…' : summary }}</span>
      <button type="button" class="toggle" @click="open = !open">
        {{ open ? 'close settings' : 'settings' }}
      </button>
    </p>
    <form v-if="open" class="drawer" @submit.prevent="save">
      <label>
        runtime
        <select v-model="cfg.runtime">
          <option v-for="r in RUNTIMES" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
      <label>
        web search
        <select v-model="cfg.search">
          <option value="native">native (provider tool)</option>
          <option value="external">external engine</option>
        </select>
      </label>
      <label v-if="cfg.search === 'external'">
        engine
        <select v-model="cfg.searchEngine">
          <option v-for="e in ENGINES" :key="e" :value="e">{{ e }}</option>
        </select>
      </label>
      <label>
        model (optional)
        <input v-model="cfg.synthModel" placeholder="e.g. qwen3.6:27b" />
      </label>
      <label>
        profile defaults (optional)
        <select v-model="cfg.profile">
          <option value="">—</option>
          <option v-for="p in profileIds" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
      <div class="locales">
        <span>locales (besides EN)</span>
        <span class="boxes">
          <label v-for="l in LOCALES" :key="l">
            <input type="checkbox" :value="l" v-model="cfg.locales" />
            {{ l }}
          </label>
        </span>
      </div>
      <div>
        <button type="submit">Save</button>
      </div>
    </form>
    <p v-if="status" class="meta" :class="{ warn: !status.ok }">{{ status.message }}</p>
  </div>
</template>

<style scoped>
.drawer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  margin: 0.5rem 0;
}
.drawer label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
}
.locales {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
}
.locales .boxes {
  display: flex;
  gap: 0.6rem;
}
.locales .boxes label {
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
}
.toggle {
  margin-left: 0.6rem;
}
</style>
