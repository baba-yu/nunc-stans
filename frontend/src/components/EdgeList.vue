<script setup lang="ts">
import type { Edge } from '../types'

defineProps<{ edges: Edge[] }>()
</script>

<template>
  <ul class="edges">
    <template v-if="edges.length">
      <!-- Fallback display by to_label: the target store may be unreachable,
           the label always is (constitution Phase 1). -->
      <li v-for="e in edges" :key="e.id">
        <span>{{ e.from_label || e.from }}</span>
        <span class="etype">{{ e.type }} →</span>
        <span>{{ e.to_label }}</span>
        <span class="toid">{{ e.to }} · by {{ e.author }}</span>
      </li>
    </template>
    <li v-else class="meta">no edges yet</li>
  </ul>
</template>
