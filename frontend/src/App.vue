<script setup lang="ts">
import { computed, onMounted } from 'vue'
import CommitmentList from './components/CommitmentList.vue'
import EdgeList from './components/EdgeList.vue'
import AuthorForm from './components/AuthorForm.vue'
import { useMeStore } from './stores/me'

const store = useMeStore()

// F9: the one-line provenance mix — of my own bets, the proportion prompted by
// AI-routed information. Recomputed from edges, never asserted.
const provenance = computed(() => {
  if (!store.reachable) return 'engine unreachable — is `just up` running?'
  const { aiPrompted, total, percent } = store.mix
  const skipped = store.malformed ? ` · ${store.malformed} malformed record(s) skipped` : ''
  return `provenance: ${aiPrompted}/${total} of my bets were AI-prompted (${percent}%) · ${store.edges.length} edges${skipped}`
})

onMounted(() => store.load())
</script>

<template>
  <main>
    <h1>ME</h1>
    <div id="provenance">{{ provenance }}</div>

    <h2>Commitments</h2>
    <CommitmentList :commitments="store.commitments" />

    <AuthorForm />

    <h2>Edges</h2>
    <EdgeList :edges="store.edges" />
  </main>
</template>
