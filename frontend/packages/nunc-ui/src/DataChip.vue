<script setup lang="ts">
defineProps<{ label: string; value: string }>()
</script>

<template>
  <span class="nui-datachip">
    <span class="nui-datachip-label">{{ label }}</span>
    <code class="nui-datachip-value">{{ value }}</code>
  </span>
</template>

<style scoped>
.nui-datachip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: var(--nui-elev2);
  border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-s);
  padding: 2px 8px;
}
.nui-datachip-label {
  color: var(--nui-dim);
}
.nui-datachip-value {
  font-family: var(--nui-mono);
  color: var(--nui-text);
  background: none;
}
</style>
