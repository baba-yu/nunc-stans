<script setup lang="ts">
import type { Metric } from '../../shared/blueprint'

defineProps<{ metrics: Metric[] }>()
</script>

<template>
  <div class="view">
    <p v-if="!metrics.length" class="view__empty">
      No declared metrics yet. Metrics are the numbers this app measures —
      the only grounds the strategy read-out may quote.
    </p>
    <table v-else class="tbl">
      <thead>
        <tr><th>Name</th><th>Label</th><th>SQL</th></tr>
      </thead>
      <tbody>
        <tr v-for="m in metrics" :key="m.name">
          <td class="tbl__strong">
            <code>{{ m.name }}</code>
          </td>
          <td>{{ m.label }}</td>
          <td><code class="sql">{{ m.sql }}</code></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.view__empty {
  color: var(--text-dim, #9aa3b2);
  font-size: 13px;
}
.sql {
  font-size: 12px;
  word-break: break-word;
}
</style>
