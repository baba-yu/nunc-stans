<script setup lang="ts">
import { useSessionStore } from '../stores/session'

// The interactive opening patrol (Phase F, F-2 B): on session open, when the
// session's app has a served bundle, the AI sweeps rows + metrics and opens
// with ONE status question. EPHEMERAL like the strategy card — dismiss and it
// is gone; answering happens in the normal chat box (the reply rides the
// tool-enabled turn, so confirmed answers become creates). The unattended /
// scheduled form stays out (F14 / SPL v3).
const store = useSessionStore()
</script>

<template>
  <div v-if="store.patrol" class="patrol">
    <div class="patrol__bar">
      <span class="patrol__title">Opening patrol</span>
      <code class="patrol__version">{{ store.patrol.app.slug }}@v{{ store.patrol.app.version }}</code>
      <button
        class="patrol__close"
        title="Dismiss — the patrol is ephemeral; reply in the chat box to act on it"
        @click="store.dismissPatrol()"
      >
        ×
      </button>
    </div>
    <p class="patrol__text">{{ store.patrol.text }}</p>
    <div class="patrol__sweep">
      <span v-for="r in store.patrol.rows" :key="r.entity" class="patrol__chip" :title="r.latest ?? 'empty'">
        {{ r.entity }} · {{ r.count }}
      </span>
      <span
        v-for="m in store.patrol.metrics"
        :key="m.name"
        class="patrol__chip patrol__chip--metric"
        :title="m.name"
      >
        {{ m.label }} · {{ m.error ? 'unavailable' : (m.value ?? '—') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.patrol {
  flex: none;
  margin: 8px 0;
  border: 1px solid var(--border, #2a2f3a);
  border-left: 3px solid var(--accent, #18c7d8);
  border-radius: 8px;
  background: var(--elev-1, #171a21);
  font-size: 13px;
  overflow: hidden;
}
.patrol__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #2a2f3a);
}
.patrol__title {
  font-weight: 600;
}
.patrol__version {
  font-size: 11px;
  color: var(--text-dim, #9aa3b2);
}
.patrol__close {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--text-dim, #9aa3b2);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.patrol__close:hover {
  color: var(--text, #e6e8ec);
}
.patrol__text {
  margin: 0;
  padding: 8px 10px;
  white-space: pre-wrap;
}
.patrol__sweep {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 10px 8px;
}
.patrol__chip {
  padding: 1px 8px;
  font-size: 11px;
  border: 1px solid var(--border, #2a2f3a);
  border-radius: 999px;
  color: var(--text-dim, #9aa3b2);
  background: var(--elev-2, #1d212b);
}
.patrol__chip--metric {
  color: var(--text, #e6e8ec);
}
</style>
