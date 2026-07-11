<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { HeatDot, Panel } from 'nunc-ui'
import NewsSettings from '../components/NewsSettings.vue'
import TopicEditor from '../components/TopicEditor.vue'
import WorldRun from '../components/WorldRun.vue'
import { useMeStore } from '../stores/me'
import { slugFor } from '../slug'
import type { WorldPrediction } from '../types'

const store = useMeStore()

// Which headline's inline commit form is open, and its editable draft.
const openId = ref<string | null>(null)
const draft = reactive({ slug: '', title: '', started_at: '' })
// The last commit outcome, keyed to a headline so it renders in that row
// independently of whether the form is still open.
const result = ref<{ id: string; ok: boolean; message: string } | null>(null)
// Whether a staged dashboard exists (build-world ran with an instance linked).
const graphAvailable = ref(false)

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function open(h: WorldPrediction) {
  openId.value = h.id
  draft.slug = slugFor(h)
  draft.title = h.label
  draft.started_at = today()
  if (result.value?.id === h.id) result.value = null
}

function cancel() {
  openId.value = null
}

async function commit(h: WorldPrediction) {
  const res = await store.commitFromHeadline(
    { slug: draft.slug, title: draft.title, started_at: draft.started_at, money_jpy: '', hours: '', note: '' },
    h,
  )
  result.value = { id: h.id, ok: res.ok, message: res.message }
  if (res.ok) openId.value = null // full success: close the form; message stays
}

// Recency accent on the heat scale: this week hot, this month mid, older cold.
function heat(h: WorldPrediction): 0 | 2 | 4 {
  if (!h.date) return 0
  const days = (Date.now() - new Date(h.date).getTime()) / 86400000
  return days < 7 ? 4 : days < 30 ? 2 : 0
}

onMounted(async () => {
  store.loadWorld()
  try {
    // The gate 404s file-like misses (no SPA fallback), so ok is truthful;
    // the content-type check keeps dev-proxy setups honest too.
    const r = await fetch('/world-graph/data/manifest.json', { method: 'HEAD' })
    graphAvailable.value = r.ok && (r.headers.get('content-type') ?? '').includes('json')
  } catch {
    graphAvailable.value = false
  }
})
</script>

<template>
  <div class="world nui-cold">
    <main class="page">
      <h2>World (News)</h2>

      <Panel cold>
        <p class="meta">
          From News (world scope) · read-only · newest first (the AI does not rank or
          recommend, §10-C). {{ store.world.length }} headlines.
        </p>
        <ul class="headlines">
          <li v-for="h in store.world" :key="h.id">
            <HeatDot :level="heat(h)" :title="h.date ?? undefined" />
            <span v-if="h.scope" class="etype">{{ h.scope }}</span>
            <span class="label">{{ h.label }}</span>
            <span class="toid">{{ h.date }}<template v-if="h.summary"> · {{ h.summary }}</template></span>
            <div style="margin-top: 0.35rem">
              <button v-if="openId !== h.id" type="button" @click="open(h)">
                Commit from this headline
              </button>
              <form v-else @submit.prevent="commit(h)">
                <input v-model="draft.slug" placeholder="slug (a-z, 0-9, -)" required pattern="[a-z0-9-]+" />
                <input v-model="draft.title" placeholder="title" required />
                <input v-model="draft.started_at" placeholder="started_at (YYYY-MM-DD)" required />
                <div>
                  <button type="submit">Author (user peer) + link</button>
                  <button type="button" @click="cancel">Cancel</button>
                </div>
              </form>
            </div>
            <div
              v-if="result && result.id === h.id"
              :class="{ warn: !result.ok }"
              style="font-size: 0.85rem; margin-top: 0.3rem"
            >
              {{ result.message }}
            </div>
          </li>
          <li v-if="!store.world.length" class="meta">
            no world headlines — link a nunc-fluens instance (<code>just news-link &lt;instance&gt;</code>; create one with <code>just news-init</code>) and run <code>just build-world</code>
          </li>
        </ul>
      </Panel>

      <Panel cold title="Research topics">
        <p class="meta">
          What the pipeline investigates — the single topic authority
          (<code>news-topics.json</code>) the search fan-out and the coverage
          gate both read. You author these; the AI only proposes (§6, F6).
        </p>
        <TopicEditor />
      </Panel>

      <Panel cold title="News pipeline">
        <WorldRun />
        <NewsSettings />
      </Panel>

      <Panel cold title="Prediction dashboard" class="graph-panel">
        <iframe
          v-if="graphAvailable"
          src="/world-graph/index.html"
          class="graph-frame"
          title="News prediction dashboard (wrapped as-is)"
        />
        <p v-else class="meta">
          no staged dashboard — link a nunc-fluens instance (<code>just news-link &lt;instance&gt;</code>; create one with <code>just news-init</code>) and run <code>just build-world</code>
        </p>
      </Panel>
    </main>
  </div>
</template>
