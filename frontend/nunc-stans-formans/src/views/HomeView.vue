<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Panel } from 'nunc-ui'
import AuthorForm from '../components/AuthorForm.vue'
import CommitmentList from '../components/CommitmentList.vue'
import EdgeList from '../components/EdgeList.vue'
import { useMeStore } from '../stores/me'

const store = useMeStore()
const route = useRoute()

// F9: the one-line provenance mix — of my own bets, the proportion prompted by
// AI-routed information. Recomputed from edges, never asserted (§10-C).
const provenance = computed(() => {
  if (!store.reachable) return 'engine unreachable — is `just up` running?'
  const { aiPrompted, total, percent } = store.mix
  const skipped = store.malformed ? ` · ${store.malformed} malformed record(s) skipped` : ''
  return `provenance: ${aiPrompted}/${total} of my bets were AI-prompted (${percent}%) · ${store.edges.length} edges${skipped}`
})

// Jump-to-record: /?focus=<id> scrolls to and highlights the record —
// how the timeline (S-9) lands on the underlying entry.
async function focusRecord() {
  const id = route.query.focus
  if (typeof id !== 'string' || !id) return
  await nextTick()
  const el = document.querySelector(`[data-record-id="${CSS.escape(id)}"]`)
  if (el) {
    el.scrollIntoView({ block: 'center' })
    el.classList.add('focused')
    setTimeout(() => el.classList.remove('focused'), 2400)
  }
}

onMounted(async () => {
  await store.load()
  await focusRecord()
})
</script>

<template>
  <main class="page">
    <h1>ME</h1>
    <div id="provenance">{{ provenance }}</div>

    <h2>Commitments</h2>
    <CommitmentList :commitments="store.commitments" />

    <Panel title="Author a commitment">
      <AuthorForm />
    </Panel>

    <h2>Edges</h2>
    <EdgeList :edges="store.edges" />
  </main>
</template>
