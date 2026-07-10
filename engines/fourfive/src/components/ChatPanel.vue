<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useSessionStore } from '../stores/session'
import StrategyCard from './StrategyCard.vue'
import type { Session, VerifyStep } from '../../shared/types'

const store = useSessionStore()
const input = ref('')
const listEl = ref<HTMLElement | null>(null)
// Per-completed-message expand state for the thinking box (collapsed default).
const openThinking = ref<Record<string, boolean>>({})

// Inline rename of the current session title.
const editing = ref(false)
const editTitle = ref('')
const editEl = ref<HTMLInputElement | null>(null)
function startRename() {
  editTitle.value = store.current?.title ?? ''
  editing.value = true
  void nextTick(() => editEl.value?.focus())
}
async function commitRename() {
  if (!editing.value) return
  editing.value = false
  await store.renameSession(editTitle.value)
}

async function submit() {
  const text = input.value
  if (!text.trim() || store.sending) return
  input.value = ''
  await store.send(text)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void submit()
  }
}

function onSelect(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  const s: Session | undefined = store.sessions.find((x) => x.id === id)
  if (s) void store.openSession(s)
}

function toggleThinking(id: string) {
  openThinking.value[id] = !openThinking.value[id]
}
function toggleStreamThinking() {
  if (store.streamingMsg) store.streamingMsg.thinkingOpen = !store.streamingMsg.thinkingOpen
}

// Goal-verify loop rendering (S-6): one line per judge verdict + a cost
// line summing every iteration (model + judge tokens).
function verifyCost(steps: VerifyStep[]): string {
  const tokensIn = steps.reduce((n, s) => n + s.tokensIn, 0)
  const tokensOut = steps.reduce((n, s) => n + s.tokensOut, 0)
  return `${steps.length} iteration${steps.length === 1 ? '' : 's'} · in ${tokensIn} / out ${tokensOut} tok (model + judge)`
}
function verdictLine(s: VerifyStep): string {
  const cost = `in ${s.tokensIn} / out ${s.tokensOut} tok`
  return s.met
    ? `iteration ${s.iteration}: goal met (${cost})`
    : `iteration ${s.iteration}: unmet — ${s.gaps.length ? s.gaps.join('; ') : 'no gaps reported'} (${cost})`
}

watch(
  () => [
    store.messages.length,
    store.streamingMsg?.content,
    store.streamingMsg?.thinking,
    store.strategy,
    store.strategyError,
    store.strategyLoading,
  ],
  async () => {
    await nextTick()
    listEl.value?.scrollTo({ top: listEl.value.scrollHeight })
  },
)
</script>

<template>
  <section class="chat">
    <header class="chat__bar">
      <input
        v-if="editing"
        ref="editEl"
        v-model="editTitle"
        class="chat__session"
        @keydown.enter="commitRename"
        @keydown.esc="editing = false"
        @blur="commitRename"
      />
      <select v-else class="chat__session" :value="store.current?.id ?? ''" @change="onSelect">
        <option v-for="s in store.sessions" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select>
      <button class="btn" :disabled="editing || !store.current" title="Rename session" @click="startRename">✎</button>
      <button class="btn" @click="store.showNewSessionModal = true">+ New</button>
      <button
        class="btn"
        :disabled="!store.blueprint || store.markdownLoading"
        :title="!store.blueprint ? 'No blueprint yet' : 'Generate & save the Markdown blueprint'"
        @click="store.generateMarkdown()"
      >
        {{ store.markdownLoading ? 'Generating…' : 'Export Markdown' }}
      </button>
    </header>

    <div ref="listEl" class="chat__list">
      <p v-if="store.messages.length === 0 && !store.streamingMsg" class="chat__empty">
        Describe the app you want to build.<br />
        e.g. "I want to build an invoice app"
      </p>

      <div v-for="m in store.messages" :key="m.id" class="msg" :class="`msg--${m.role}`">
        <div class="msg__role">{{ m.role === 'user' ? 'You' : 'FourFive' }}</div>
        <div v-if="store.thinkingById[m.id]" class="think-box">
          <button class="think-box__head" @click="toggleThinking(m.id)">
            💭 Thinking <span class="think-box__chev">{{ openThinking[m.id] ? '▲' : '▼' }}</span>
          </button>
          <div v-if="openThinking[m.id]" class="think-box__body">{{ store.thinkingById[m.id] }}</div>
        </div>
        <div v-if="store.verifyById[m.id]" class="verify-box">
          <div v-for="s in store.verifyById[m.id]" :key="s.iteration" class="verify-box__line" :class="{ 'verify-box__line--met': s.met }">
            {{ verdictLine(s) }}
          </div>
          <div class="verify-box__cost">{{ verifyCost(store.verifyById[m.id]) }}</div>
        </div>
        <div class="msg__body">{{ m.content }}</div>
      </div>

      <div v-if="store.streamingMsg" class="msg msg--assistant">
        <div class="msg__role">FourFive</div>
        <div v-if="store.streamingMsg?.thinking" class="think-box">
          <button class="think-box__head" @click="toggleStreamThinking">
            💭 Thinking{{ store.streamingMsg?.content ? '' : '…' }}
            <span class="think-box__chev">{{ store.streamingMsg?.thinkingOpen ? '▲' : '▼' }}</span>
          </button>
          <div v-if="store.streamingMsg?.thinkingOpen" class="think-box__body">{{ store.streamingMsg?.thinking }}</div>
        </div>
        <div v-if="store.streamingMsg?.verify.length" class="verify-box">
          <div v-for="s in store.streamingMsg.verify" :key="s.iteration" class="verify-box__line" :class="{ 'verify-box__line--met': s.met }">
            {{ verdictLine(s) }}
          </div>
          <div class="verify-box__cost">{{ verifyCost(store.streamingMsg.verify) }}</div>
        </div>
        <div class="msg__body">
          <span v-if="!store.streamingMsg?.content && !store.streamingMsg?.thinking" class="msg__body--typing">…</span>
          <span>{{ store.streamingMsg?.content }}</span><span v-if="store.sending" class="cursor">▍</span>
        </div>
      </div>

      <!-- /strategy stage-3 card (PE12): ephemeral, dismissable, version-stamped -->
      <StrategyCard />
    </div>

    <footer class="chat__input">
      <textarea
        v-model="input"
        rows="3"
        placeholder="Type a message (Ctrl / Cmd + Enter to send)"
        @keydown="onKeydown"
      />
      <button class="btn btn--primary" :disabled="store.sending || !input.trim()" @click="submit">
        Send
      </button>
    </footer>
  </section>
</template>
