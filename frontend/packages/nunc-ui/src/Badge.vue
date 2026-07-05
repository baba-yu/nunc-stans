<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'default' | 'accent' | 'success' | 'warn' | 'error' }>(),
  { variant: 'default' },
)
</script>

<template>
  <span class="nui-badge" :class="`nui-badge--${variant}`"><slot /></span>
</template>

<style scoped>
.nui-badge {
  display: inline-block;
  font-size: 12px;
  color: var(--nui-dim);
  border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-pill);
  padding: 3px 10px;
}
.nui-badge--accent { color: var(--nui-accent); border-color: var(--nui-accent); }
.nui-badge--success { color: var(--nui-success); border-color: var(--nui-success); }
.nui-badge--warn { color: var(--nui-warn); border-color: var(--nui-warn); }
.nui-badge--error { color: var(--nui-error); border-color: var(--nui-error); }
</style>
