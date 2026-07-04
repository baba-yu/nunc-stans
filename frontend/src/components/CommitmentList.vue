<script setup lang="ts">
import type { Commitment } from '../types'

defineProps<{ commitments: Commitment[] }>()

function yen(n: number | null): string | null {
  return n == null ? null : '¥' + n.toLocaleString('en-US')
}

function meta(c: Commitment): string {
  const r = c.resources ?? { money_jpy: null, hours: null }
  return [c.id, c.started_at, yen(r.money_jpy), r.hours != null ? r.hours + 'h' : null]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <div v-if="commitments.length">
    <div v-for="c in commitments" :key="c.id" class="card">
      <div class="title">{{ c.title || c.id }}</div>
      <div class="meta">{{ meta(c) }}</div>
      <div v-if="c.note" class="note">{{ c.note }}</div>
    </div>
  </div>
  <p v-else class="meta">no commitments yet</p>
</template>
