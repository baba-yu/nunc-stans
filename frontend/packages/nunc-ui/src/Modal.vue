<script setup lang="ts">
defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="nui-modal-backdrop" @click.self="emit('close')">
      <div class="nui-modal" role="dialog" aria-modal="true">
        <header v-if="title" class="nui-modal-title">{{ title }}</header>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.nui-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 100;
}
.nui-modal {
  background: var(--nui-elev1);
  border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-l);
  padding: 18px;
  min-width: 320px;
  max-width: min(680px, 92vw);
  max-height: 86vh;
  overflow: auto;
}
.nui-modal-title {
  font-weight: 700;
  margin-bottom: 10px;
}
</style>
