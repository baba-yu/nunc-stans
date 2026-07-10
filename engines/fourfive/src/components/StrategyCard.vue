<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '../stores/session'

// The /strategy stage-3 card (Phase E, plan PE12): a metrics-grounded
// read-out stamped with the SERVED version. Dismissable and EPHEMERAL —
// nothing here is persisted; a refusal (grounding violation, no served
// bundle, apps-host down) renders verbatim as the failure state.
const store = useSessionStore()
const res = computed(() => store.strategy)

// Grounding chips: only the QUOTED metrics, each with its live value.
const grounds = computed(() => {
  if (!res.value) return []
  return res.value.card.grounding.map((name) => {
    const m = res.value!.metrics.find((x) => x.name === name)
    return {
      name,
      label: m?.label ?? name,
      value: m?.error ? 'unavailable' : (m?.value ?? '—'),
    }
  })
})
</script>

<template>
  <div v-if="store.strategyLoading" class="strategy strategy--muted">
    Strategy read-out — reading the served app's declared metrics…
  </div>

  <div v-else-if="store.strategyError" class="strategy strategy--err">
    <div class="strategy__bar">
      <span class="strategy__title">Strategy read-out failed</span>
      <button class="strategy__close" title="Dismiss" @click="store.dismissStrategy()">×</button>
    </div>
    <p class="strategy__errmsg">{{ store.strategyError }}</p>
  </div>

  <div v-else-if="res" class="strategy">
    <div class="strategy__bar">
      <span class="strategy__title">Strategy read-out</span>
      <code class="strategy__version">{{ res.app.slug }}@v{{ res.app.version }}</code>
      <button
        class="strategy__close"
        title="Dismiss — the card is ephemeral and is not saved anywhere"
        @click="store.dismissStrategy()"
      >
        ×
      </button>
    </div>
    <dl class="strategy__body">
      <dt>Win</dt>
      <dd>{{ res.card.win }}</dd>
      <dt>Constraint</dt>
      <dd>{{ res.card.constraint }}</dd>
      <dt>Risk to watch</dt>
      <dd>{{ res.card.risk_to_watch }}</dd>
    </dl>
    <div class="strategy__grounds">
      <span class="strategy__grounds-label">Grounded in:</span>
      <span v-for="g in grounds" :key="g.name" class="strategy__chip" :title="g.name">
        {{ g.label }} · {{ g.value }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.strategy {
  margin: 8px 0;
  border: 1px solid var(--accent, #18c7d8);
  border-radius: 8px;
  background: var(--elev-1, #171a21);
  font-size: 13px;
  overflow: hidden;
}
.strategy--muted {
  padding: 8px 12px;
  color: var(--text-dim, #9aa3b2);
  border-color: var(--border, #2a2f3a);
}
.strategy--err {
  border-color: var(--error, #e08f8f);
}
.strategy__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #2a2f3a);
}
.strategy__title {
  font-weight: 600;
}
.strategy--err .strategy__title {
  color: var(--error, #e08f8f);
}
.strategy__version {
  font-size: 11px;
  color: var(--text-dim, #9aa3b2);
}
.strategy__close {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--text-dim, #9aa3b2);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.strategy__close:hover {
  color: var(--text, #e6e8ec);
}
.strategy__errmsg {
  margin: 0;
  padding: 8px 10px;
  color: var(--error, #e08f8f);
  white-space: pre-wrap;
}
.strategy__body {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0;
  padding: 8px 10px;
}
.strategy__body dt {
  color: var(--text-dim, #9aa3b2);
  white-space: nowrap;
}
.strategy__body dd {
  margin: 0;
}
.strategy__grounds {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 8px;
  border-top: 1px solid var(--border, #2a2f3a);
}
.strategy__grounds-label {
  font-size: 11px;
  color: var(--text-dim, #9aa3b2);
}
.strategy__chip {
  padding: 1px 8px;
  font-size: 11px;
  border: 1px solid var(--border, #2a2f3a);
  border-radius: 999px;
  color: var(--text, #e6e8ec);
  background: var(--elev-2, #1d212b);
}
</style>
