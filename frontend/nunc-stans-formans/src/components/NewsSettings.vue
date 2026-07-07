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
}

const RUNTIMES = ['claude-code', 'anthropic-api', 'ollama']
const ENGINES = ['brave', 'searxng', 'tavily', 'perplexity']

const open = ref(false)
const loading = ref(true)
const status = ref<{ ok: boolean; message: string } | null>(null)
const cfg = reactive<Required<NewsConfig>>({
  runtime: 'claude-code',
  search: 'native',
  searchEngine: 'brave',
  synthModel: '',
})

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
  }
  if (cfg.search === 'external') body.searchEngine = cfg.searchEngine
  if (cfg.synthModel.trim()) body.synthModel = cfg.synthModel.trim()
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
.toggle {
  margin-left: 0.6rem;
}
</style>
