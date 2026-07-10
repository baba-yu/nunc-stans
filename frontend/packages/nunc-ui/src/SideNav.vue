<script setup lang="ts">
// The shared shell rail: every gate-fronted surface (Formans, FourFive, …)
// mounts this on the left. Collapsed state persists per storageKey so the
// choice carries across reloads — and across apps, since they share the key.
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{ brand?: string; storageKey?: string }>(), {
  brand: 'Nunc Stans',
  storageKey: 'ns-sidebar-collapsed',
})

const collapsed = ref(localStorage.getItem(props.storageKey) === '1')
watch(collapsed, (v) => localStorage.setItem(props.storageKey, v ? '1' : '0'))
</script>

<template>
  <header class="nui-sidenav" :class="{ 'nui-sidenav--collapsed': collapsed }">
    <button
      type="button"
      class="nui-sidenav__toggle"
      :title="collapsed ? 'メニューを開く' : 'メニューを畳む'"
      @click="collapsed = !collapsed"
    >
      {{ collapsed ? '»' : '«' }}
    </button>
    <template v-if="!collapsed">
      <div class="nui-sidenav__brand">{{ brand }}</div>
      <nav class="nui-sidenav__nav">
        <slot name="nav" />
      </nav>
      <div class="nui-sidenav__meta">
        <slot name="meta" />
      </div>
    </template>
  </header>
</template>

<!-- Unscoped on purpose: the nav links arrive through the slot, so scoped
     styles could not reach them. Everything is namespaced under .nui-sidenav. -->
<style>
.nui-sidenav {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 168px;
  flex-shrink: 0;
  padding: 12px;
  border-right: 1px solid var(--nui-border);
  background: var(--nui-elev1);
  position: sticky;
  top: 0;
  height: 100vh;
  box-sizing: border-box;
  z-index: 10;
}
.nui-sidenav--collapsed {
  width: 40px;
  padding: 12px 6px;
  align-items: center;
}
.nui-sidenav__toggle {
  font: inherit;
  align-self: flex-end;
  width: 26px;
  height: 26px;
  line-height: 1;
  padding: 0;
  background: transparent;
  color: var(--nui-dim);
  border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-s);
  cursor: pointer;
}
.nui-sidenav--collapsed .nui-sidenav__toggle {
  align-self: center;
}
.nui-sidenav__toggle:hover {
  color: var(--nui-text);
  border-color: var(--nui-accent);
}
.nui-sidenav__brand {
  font-weight: 700;
  letter-spacing: 0.5px;
}
.nui-sidenav__nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.nui-sidenav__meta {
  margin-top: auto;
}
.nui-sidenav__link {
  font-size: 12px;
  color: var(--nui-dim);
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: var(--nui-radius-pill);
  padding: 4px 12px;
}
.nui-sidenav__link:hover {
  color: var(--nui-text);
  border-color: var(--nui-accent);
}
.nui-sidenav__link--active {
  color: var(--nui-bg);
  background: var(--nui-accent);
  border-color: var(--nui-accent);
}
</style>
