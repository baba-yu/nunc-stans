<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Badge } from 'nunc-ui'
import { useSessionStore } from './stores/session'
import ChatPanel from './components/ChatPanel.vue'
import TempAppPanel from './components/TempAppPanel.vue'
import MarkdownModal from './components/MarkdownModal.vue'
import NewSessionModal from './components/NewSessionModal.vue'

const store = useSessionStore()
// Profiles name nunc-ai providers now (ollama / anthropic-api /
// claude-code / mock); every non-mock provider is a real model.
const isRealLlm = computed(() => store.provider !== 'mock' && store.provider !== '…' && store.provider !== 'offline')

function onMaxTokens(e: Event) {
  store.setMaxTokens(Number((e.target as HTMLInputElement).value))
}
function onVerifyGoal(e: Event) {
  store.setVerifyGoal((e.target as HTMLInputElement).value)
}

onMounted(() => store.init())
</script>

<template>
  <div class="app">
    <header class="topbar">
      <a class="home" href="/" title="Back to Nunc Stans">⌂ Nunc Stans</a>
      <div class="brand">FourFive</div>
      <div class="topbar__meta">
        <button
          v-if="store.provider === 'ollama'"
          class="think"
          :class="{ 'think--on': store.thinking }"
          :title="
            store.thinking
              ? 'Thinking on: higher quality but slower (generates reasoning)'
              : 'Thinking off: faster (skips reasoning)'
          "
          @click="store.setThinking(!store.thinking)"
        >
          <span class="think__dot" />
          Thinking {{ store.thinking ? 'ON' : 'OFF' }}
        </button>
        <div v-if="isRealLlm" class="numctl" :class="{ 'numctl--on': store.maxTokensOn }">
          <button
            class="numctl__toggle"
            :title="store.maxTokensOn ? 'Output token cap on' : 'Output token cap off (model default)'"
            @click="store.setMaxTokensOn(!store.maxTokensOn)"
          >
            Token cap {{ store.maxTokensOn ? 'ON' : 'OFF' }}
          </button>
          <input
            v-if="store.maxTokensOn"
            class="numctl__input"
            type="number"
            min="64"
            step="64"
            :value="store.maxTokens"
            @change="onMaxTokens"
          />
        </div>
        <div class="numctl" :class="{ 'numctl--on': store.verifyOn }">
          <button
            class="numctl__toggle"
            :title="
              store.verifyOn
                ? 'Goal-verify on: a judge checks each reply against the goal and retries (≤ max iterations); token cost shown per iteration'
                : 'Goal-verify off (default): one call, no judge'
            "
            @click="store.setVerifyOn(!store.verifyOn)"
          >
            Verify {{ store.verifyOn ? 'ON' : 'OFF' }}
          </button>
          <input
            v-if="store.verifyOn"
            class="numctl__input numctl__input--goal"
            type="text"
            placeholder="goal for the judge"
            :value="store.verifyGoal"
            @change="onVerifyGoal"
          />
        </div>
        <Badge
          v-if="store.usage.total > 0"
          :title="`input ${store.usage.input} / output ${store.usage.output} tokens`"
        >
          {{ store.usage.total }} tok
        </Badge>
        <Badge :title="store.profile ? `profile: ${store.profile}` : 'no profile configured — offline demo'">
          LLM: {{ store.provider }}{{ store.profile ? ` · ${store.profile}` : '' }}
        </Badge>
      </div>
    </header>
    <main class="panes">
      <ChatPanel class="panes__left" />
      <TempAppPanel class="panes__right" />
    </main>
    <MarkdownModal />
    <NewSessionModal />
  </div>
</template>

<style scoped>
/* Back to the Nunc Stans home (Formans) — FourFive is served at
   /fourfive/ behind the gate, so `/` is the single-origin home. Every
   gate-fronted surface carries this affordance so no surface is a
   one-way island (the /apps host inherits it in Phase E). */
.home {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-right: 0.75rem;
  color: inherit;
  text-decoration: none;
  opacity: 0.65;
  font-size: 0.9rem;
  white-space: nowrap;
}
.home:hover {
  opacity: 1;
}
.numctl__input--goal {
  width: 16rem;
}
</style>
