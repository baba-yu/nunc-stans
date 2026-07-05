<script setup lang="ts">
// Interim route wrapper (T6): the full cold-surface restyle plus the wrapped
// News dashboard arrive with T8 of the phase-b plan.
import { onMounted } from 'vue'
import WorldList from '../components/WorldView.vue'
import { useMeStore } from '../stores/me'

const store = useMeStore()
onMounted(() => store.loadWorld())
</script>

<template>
  <main class="page">
    <h2>World (News)</h2>
    <WorldList />
  </main>
</template>
