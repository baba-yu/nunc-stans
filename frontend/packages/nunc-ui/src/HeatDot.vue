<script setup lang="ts">
defineProps<{ level: 0 | 1 | 2 | 3 | 4 | 5; title?: string }>()
</script>

<template>
  <span class="nui-heatdot" :class="`nui-heatdot--${level}`" :title="title" />
</template>

<style scoped>
.nui-heatdot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  vertical-align: middle;
}
.nui-heatdot--0 { background: var(--nui-heat-0); }
.nui-heatdot--1 { background: var(--nui-heat-1); }
.nui-heatdot--2 { background: var(--nui-heat-2); }
.nui-heatdot--3 { background: var(--nui-heat-3); }
.nui-heatdot--4 { background: var(--nui-heat-4); }
.nui-heatdot--5 { background: var(--nui-heat-5); }
</style>
