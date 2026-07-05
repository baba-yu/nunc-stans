<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <button type="button" class="nui-pill" :class="{ 'nui-pill--active': active }">
    <slot />
  </button>
</template>

<style scoped>
.nui-pill {
  font: inherit;
  font-size: 12px;
  color: var(--nui-dim);
  background: var(--nui-elev2);
  border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-pill);
  padding: 4px 11px;
  cursor: pointer;
}
.nui-pill:hover {
  border-color: var(--nui-accent);
  color: var(--nui-text);
}
.nui-pill--active {
  color: var(--nui-bg);
  background: var(--nui-accent);
  border-color: var(--nui-accent);
}
</style>
