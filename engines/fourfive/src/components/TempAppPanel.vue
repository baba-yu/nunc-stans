<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Tabs } from 'nunc-ui'
import type { BlueprintOutcome } from '../../shared/types'
import { useSessionStore } from '../stores/session'
import MockUiView from './MockUiView.vue'
import EntitiesView from './EntitiesView.vue'
import LogicView from './LogicView.vue'
import StateView from './StateView.vue'
import ApiView from './ApiView.vue'
import TerminologyView from './TerminologyView.vue'
import MetricsView from './MetricsView.vue'
import StoriesView from './StoriesView.vue'

const store = useSessionStore()
const tabs = ['Mock UI', 'ERD', 'Logic', 'State', 'API', 'Terminology', 'Metrics', 'Stories'] as const
type Tab = (typeof tabs)[number]
const active = ref<Tab>('Mock UI')
const tabItems = tabs.map((t) => ({ id: t, label: t }))
const bp = computed(() => store.blueprint)

// F-2 A: the design‖app toggle. Design view = the cognition surface; App
// view = the inspection surface (the served shell embedded same-origin
// behind the gate). Available once a bundle is served — probed on session
// open (appStatus) or freshly frozen this session (bundleResult).
const view = ref<'design' | 'app'>('design')
const servedSlug = computed(() => {
  if (store.appStatus?.served && store.appStatus.slug) return store.appStatus.slug
  return store.bundleResult?.slug ?? null
})
// The SPA runs under /fourfive/, so the iframe src must be ORIGIN-absolute:
// /apps/<slug>/ goes through the gate to apps-host on the same origin.
const appUrl = computed(() => (servedSlug.value ? `/apps/${servedSlug.value}/` : null))
// The panel is mounted once (no :key): when a session switch drops the served
// slug, snap back to design — otherwise the 'app'-lit toggle hides the tab
// bar over design content (review-found 2026-07-11).
watch(servedSlug, (v) => {
  if (!v) view.value = 'design'
})
// Read-only slices of each dependency's pinned blueprint for the merged views.
const depEntities = computed(() =>
  store.dependencies
    .filter((d) => d.blueprint)
    .map((d) => ({ name: d.name, slug: d.slug, entities: d.blueprint!.entities })),
)
const depApis = computed(() =>
  store.dependencies
    .filter((d) => d.blueprint)
    .map((d) => ({ name: d.name, slug: d.slug, apis: d.blueprint!.apis })),
)
// A compose session has dependencies before its first own blueprint — still show content.
const hasContent = computed(() => !!bp.value || store.dependencies.length > 0)

// Warn-worthy blueprint-step outcomes get a one-line hint (the old behavior
// was a silently unchanged pane); 'ok'/'empty' stay quiet.
const BP_WARN_TEXT: Partial<Record<BlueprintOutcome, string>> = {
  'length-truncated': 'the model hit its output budget mid-JSON',
  'context-overflow': "the conversation no longer fits the model's serving window",
  'parse-failed': 'the model returned unparseable JSON',
  invalid: 'the proposed blueprint failed validation',
  error: 'the blueprint call failed',
}
const bpWarn = computed(() => {
  const s = store.blueprintStatus
  if (!s) return null
  const text = BP_WARN_TEXT[s.outcome]
  return text ? { text, detail: s.detail } : null
})
</script>

<template>
  <section class="temp">
    <header class="temp__bar">
      <span class="temp__title">
        Temp app<template v-if="bp">: {{ bp.app.name }}</template>
      </span>
      <span class="temp__view-toggle" role="group" aria-label="design or app view">
        <button
          class="temp__view-btn"
          :class="{ 'temp__view-btn--on': view === 'design' }"
          @click="view = 'design'"
        >
          design
        </button>
        <button
          class="temp__view-btn"
          :class="{ 'temp__view-btn--on': view === 'app' }"
          :disabled="!servedSlug"
          :title="servedSlug
            ? 'The served app: live records + metrics (the inspection surface)'
            : 'Serve a bundle first (Generate bundle) — then the live app appears here'"
          @click="view = 'app'"
        >
          app
        </button>
      </span>
      <button
        v-if="bp"
        class="temp__bundle-btn"
        :disabled="store.bundling"
        title="Freeze this blueprint version and generate its runnable bundle (F7: a frozen version is immutable)"
        @click="store.generateBundle()"
      >
        {{ store.bundling ? 'Generating…' : 'Generate bundle' }}
      </button>
      <Tabs v-if="view === 'design'" :tabs="tabItems" :model-value="active" @update:model-value="active = $event as Tab" />
    </header>

    <div v-if="store.bundleResult" class="temp__bundle-note temp__bundle-note--ok">
      Frozen {{ store.bundleResult.slug }}@v{{ store.bundleResult.version }} — bundle
      {{ store.bundleResult.bundle_hash.slice(0, 12) }}… ({{ store.bundleResult.frozen_at }})
    </div>
    <div v-else-if="store.bundleError" class="temp__bundle-note temp__bundle-note--err">
      {{ store.bundleError }}
    </div>

    <div v-if="bpWarn" class="temp__bundle-note temp__bundle-note--warn" :title="bpWarn.detail">
      Blueprint not updated this turn — {{ bpWarn.text }}. Showing the last saved version.
    </div>

    <div v-if="store.dependencies.length" class="temp__deps">
      <span class="temp__deps-label">Depends on:</span>
      <span v-for="d in store.dependencies" :key="d.app_id" class="dep-chip">
        {{ d.name }} v{{ d.pinned_version }}
        <button
          v-if="d.current_version > d.pinned_version"
          class="dep-chip__bump"
          :title="`Update pin from v${d.pinned_version} to v${d.current_version}`"
          @click="store.bumpDependency(d)"
        >
          → v{{ d.current_version }} available
        </button>
      </span>
    </div>

    <div v-if="view === 'app' && appUrl" class="temp__appview">
      <!-- F-2 A: the served shell, same origin behind the gate. Inspection
           surface — the primary operation path is the chat (F-2 B). -->
      <iframe class="temp__appframe" :src="appUrl" :title="`served app ${servedSlug}`" />
    </div>
    <div v-else class="temp__body" :class="{ 'temp__body--filled': hasContent }">
      <div v-if="!hasContent" class="temp__placeholder">
        <p class="temp__ph-title">{{ active }}</p>
        <p class="temp__ph-desc">
          "{{ active }}" will appear here.<br />
          FourFive generates it automatically once the spec takes shape in chat.
        </p>
      </div>
      <template v-else>
        <MockUiView v-if="active === 'Mock UI'" :screens="bp?.mock_ui.screens ?? []" />
        <EntitiesView v-else-if="active === 'ERD'" :entities="bp?.entities ?? []" :deps="depEntities" />
        <LogicView v-else-if="active === 'Logic'" :rules="bp?.business_logic ?? []" />
        <StateView v-else-if="active === 'State'" :transitions="bp?.state_transitions ?? []" />
        <ApiView v-else-if="active === 'API'" :apis="bp?.apis ?? []" :deps="depApis" />
        <TerminologyView v-else-if="active === 'Terminology'" :terms="bp?.terminology ?? []" />
        <MetricsView v-else-if="active === 'Metrics'" :metrics="bp?.metrics ?? []" />
        <StoriesView v-else-if="active === 'Stories'" :stories="bp?.stories ?? []" />
      </template>
    </div>
  </section>
</template>

<style scoped>
.temp__view-toggle {
  display: inline-flex;
  margin-right: 10px;
  border: 1px solid var(--border, #2a2f3a);
  border-radius: 6px;
  overflow: hidden;
}
.temp__view-btn {
  padding: 3px 10px;
  font-size: 12px;
  color: var(--text-dim, #9aa3b2);
  background: none;
  border: none;
  cursor: pointer;
}
.temp__view-btn--on {
  color: var(--text, #e6e8ec);
  background: var(--elev-2, #1d212b);
}
.temp__view-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.temp__appview {
  flex: 1;
  display: flex;
  min-height: 0;
}
.temp__appframe {
  flex: 1;
  width: 100%;
  border: 0;
  background: var(--elev-0, #101218);
}
.temp__bundle-btn {
  margin-left: auto;
  margin-right: 10px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--text, #e6e8ec);
  background: var(--elev-1, #171a21);
  border: 1px solid var(--border, #2a2f3a);
  border-radius: 6px;
  cursor: pointer;
}
.temp__bundle-btn:hover:not(:disabled) {
  border-color: var(--accent, #18c7d8);
}
.temp__bundle-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.temp__bundle-note {
  padding: 4px 12px;
  font-size: 12px;
}
.temp__bundle-note--ok {
  color: var(--success, #5fd99f);
}
.temp__bundle-note--err {
  color: var(--error, #e08f8f);
  white-space: pre-wrap;
}
.temp__bundle-note--warn {
  color: var(--warning, #d9b45f);
}
</style>
