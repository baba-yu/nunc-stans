<template>
  <div class="nui-card">
    <slot />
    <div v-if="$slots.meta" class="nui-card-meta"><slot name="meta" /></div>
  </div>
</template>

<style scoped>
.nui-card {
  background: var(--nui-elev1);
  border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-s);
  padding: 0.7rem 0.9rem;
  margin: 0.5rem 0;
}
.nui-card-meta {
  font-size: 0.82rem;
  color: var(--nui-dim);
  margin-top: 0.3rem;
}
</style>
