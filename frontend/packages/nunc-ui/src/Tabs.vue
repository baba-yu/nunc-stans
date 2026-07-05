<script setup lang="ts">
defineProps<{ tabs: { id: string; label: string }[]; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
</script>

<template>
  <nav class="nui-tabs" role="tablist">
    <button
      v-for="t in tabs"
      :key="t.id"
      type="button"
      role="tab"
      class="nui-tab"
      :class="{ 'nui-tab--active': t.id === modelValue }"
      :aria-selected="t.id === modelValue"
      @click="emit('update:modelValue', t.id)"
    >
      {{ t.label }}
    </button>
  </nav>
</template>

<style scoped>
.nui-tabs {
  display: flex;
  gap: 6px;
}
.nui-tab {
  font: inherit;
  font-size: 12px;
  color: var(--nui-dim);
  background: transparent;
  border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-pill);
  padding: 4px 12px;
  cursor: pointer;
}
.nui-tab:hover {
  color: var(--nui-text);
  border-color: var(--nui-accent);
}
.nui-tab--active {
  color: var(--nui-bg);
  background: var(--nui-accent);
  border-color: var(--nui-accent);
}
</style>
