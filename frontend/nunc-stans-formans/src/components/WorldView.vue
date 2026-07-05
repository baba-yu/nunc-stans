<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useMeStore } from '../stores/me'
import { slugFor } from '../slug'
import type { WorldPrediction } from '../types'

const store = useMeStore()

// Which headline's inline commit form is open, and its editable draft.
const openId = ref<string | null>(null)
const draft = reactive({ slug: '', title: '', started_at: '' })
// The last commit outcome, keyed to a headline so it renders in that row
// independently of whether the form is still open. Persisting it here (rather
// than gating on openId) is what makes a success — or a partial failure —
// actually visible.
const result = ref<{ id: string; ok: boolean; message: string } | null>(null)

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
</script>

<template>
  <div>
    <p class="meta">
      From News (world scope) · read-only · newest first (the AI does not rank or
      recommend, §10-C). {{ store.world.length }} headlines.
    </p>
    <ul class="edges">
      <li v-for="h in store.world" :key="h.id">
        <span v-if="h.scope" class="etype">{{ h.scope }}</span>
        <span>{{ h.label }}</span>
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
        no world headlines — run <code>just build-world</code> with <code>NEWS_WORLD</code> set
      </li>
    </ul>
  </div>
</template>
