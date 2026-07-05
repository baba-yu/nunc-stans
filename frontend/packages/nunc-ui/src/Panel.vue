<script setup lang="ts">
defineProps<{ title?: string; cold?: boolean }>()
</script>

<template>
  <section class="nui-panel" :class="{ 'nui-panel--cold': cold }">
    <header v-if="title" class="nui-panel-title">{{ title }}</header>
    <slot />
  </section>
</template>

<style scoped>
.nui-panel {
  background: var(--nui-elev1);
  border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-m);
  padding: 14px 16px;
}
.nui-panel--cold {
  background: var(--nui-cold-panel);
  border-color: var(--nui-cold-border);
}
.nui-panel-title {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 8px;
}
</style>
