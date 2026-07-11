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
    <!-- Collapsed: the favicon mark IS the expand button. -->
    <button
      v-if="collapsed"
      type="button"
      class="nui-sidenav__markbtn"
      title="メニューを開く"
      @click="collapsed = false"
    >
      <span class="nui-sidenav__mark">
        <svg viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="brand">
          <defs>
            <filter id="ns-mark-blue" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="wide" />
              <feGaussianBlur stdDeviation="1" in="SourceGraphic" result="tight" />
              <feMerge>
                <feMergeNode in="wide" />
                <feMergeNode in="tight" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ns-mark-orange" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="8" result="wide" />
              <feGaussianBlur stdDeviation="3" in="SourceGraphic" result="tight" />
              <feMerge>
                <feMergeNode in="wide" />
                <feMergeNode in="tight" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#ns-mark-blue)">
            <circle cx="170" cy="170" r="141.421" stroke="#7cc8ff" stroke-width="5" fill="none" />
            <g stroke="#7cc8ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <line x1="85.15" y1="56.86" x2="85.15" y2="283.14" />
              <line x1="85.15" y1="56.86" x2="170" y2="283.14" />
              <line x1="170" y1="56.86" x2="254.85" y2="56.86" />
              <line x1="170" y1="56.86" x2="170" y2="170" />
              <line x1="170" y1="170" x2="254.85" y2="170" />
              <line x1="254.85" y1="170" x2="254.85" y2="283.14" />
              <line x1="254.85" y1="283.14" x2="170" y2="283.14" />
            </g>
          </g>
          <g fill="#e09538" filter="url(#ns-mark-orange)">
            <circle cx="254.85" cy="56.86" r="7" />
            <circle cx="170" cy="170" r="7" />
            <circle cx="85.15" cy="283.14" r="7" />
          </g>
        </svg>
      </span>
    </button>
    <template v-else>
      <!-- Head row: the wordmark, and the collapse button to its RIGHT. -->
      <div class="nui-sidenav__head">
      <div class="nui-sidenav__brand" role="img" :aria-label="brand">
        <svg viewBox="-20 -20 680 300" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="ns-wm-blue" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="b1" />
              <feGaussianBlur stdDeviation="4" in="SourceGraphic" result="b2" />
              <feMerge>
                <feMergeNode in="b2" />
                <feMergeNode in="b1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ns-wm-orange" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="8" result="w" />
              <feGaussianBlur stdDeviation="3" in="SourceGraphic" result="t" />
              <feMerge>
                <feMergeNode in="w" />
                <feMergeNode in="t" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g
            filter="url(#ns-wm-blue)"
            stroke="#5aa9ee"
            stroke-width="10"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <g transform="translate(64,0) scale(1,0.6)">
              <path
                d="M12,24 L12,192 L0,192 L0,0 L12,0 L114,192 L128,192 L128,0 L140,0 L140,192 L244,192 L244,0 L256,0 L256,192 L256,0 L256,192 L268,192 L268,0 L280,0 L372,192 L384,192 L384,0 L512,0 L512,12 L396,12 L396,180 L512,180 L512,192 L396,192"
              />
            </g>
            <g transform="translate(-576,145) scale(1,0.6)">
              <path
                d="M588,12 L704,12 L704,0 L576,0 L576,96 L704,96 L704,180 L576,180 L576,192 L792,192 L792,12 L716,12 L716,0 L878,0 L832,192 L844,192 L890,0 L902,0 L924,90 L880,90 L880,102 L926,102 L948,192 L960,192 L960,0 L972,0 L1052,192 L1064,192 L1064,0 L1076,0 L1076,192 L1216,192 L1216,96 L1088,96 L1088,0 L1216,0 L1216,12 L1100,12"
              />
            </g>
          </g>
          <g fill="#e09538" filter="url(#ns-wm-orange)">
            <circle cx="390" cy="57.6" r="7" />
            <circle cx="436" cy="202.6" r="7" />
          </g>
        </svg>
      </div>
        <button
          type="button"
          class="nui-sidenav__toggle"
          title="メニューを畳む"
          @click="collapsed = true"
        >
          «
        </button>
      </div>
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
  width: 48px;
  padding: 12px 8px;
  align-items: center;
}
.nui-sidenav__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.nui-sidenav__toggle {
  font: inherit;
  flex-shrink: 0;
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
.nui-sidenav__toggle:hover {
  color: var(--nui-text);
  border-color: var(--nui-accent);
}
.nui-sidenav__markbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--nui-radius-s);
  cursor: pointer;
}
.nui-sidenav__markbtn:hover {
  border-color: var(--nui-accent);
}
.nui-sidenav__brand {
  min-width: 0;
}
.nui-sidenav__brand svg {
  display: block;
  width: 76px;
  height: auto;
}
.nui-sidenav__mark {
  display: flex;
  flex-shrink: 0;
}
.nui-sidenav__mark svg {
  display: block;
  width: 26px;
  height: 26px;
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
