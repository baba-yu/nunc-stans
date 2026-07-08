<script setup lang="ts">
import type { Story } from '../../shared/blueprint'

defineProps<{ stories: Story[] }>()
</script>

<template>
  <div class="view">
    <p v-if="!stories.length" class="view__empty">
      No user stories yet. Stories are what the app must satisfy, in your
      own words; they travel with the bundle for traceability.
    </p>
    <table v-else class="tbl">
      <thead>
        <tr><th>ID</th><th>Story</th><th>Scenario</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in stories" :key="s.id">
          <td class="tbl__strong">{{ s.id }}</td>
          <td>{{ s.title }}</td>
          <td>{{ s.scenario }}</td>
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
</style>
