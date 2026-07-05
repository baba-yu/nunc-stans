<script setup lang="ts">
import { Card } from 'nunc-ui'
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
    <!-- data-record-id: the /?focus=<id> jump target (timeline S-9). -->
    <Card v-for="c in commitments" :key="c.id" :data-record-id="c.id">
      <div class="title">{{ c.title || c.id }}</div>
      <div v-if="c.note" class="note">{{ c.note }}</div>
      <template #meta>{{ meta(c) }}</template>
    </Card>
  </div>
  <p v-else class="meta">no commitments yet</p>
</template>
