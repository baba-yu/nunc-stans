<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useSessionStore } from '../stores/session'
import PatrolCard from './PatrolCard.vue'
import StrategyCard from './StrategyCard.vue'
import type { Session, VerifyStep } from '../../shared/types'

const store = useSessionStore()
const input = ref('')

// Slash commands: a leading '/' pops completions above the input (the
// command surface must be discoverable, not memorized). Tab or click
// completes; the popup hides once the command (or trailing text) is typed.
const SLASH_COMMANDS = [
  { cmd: '/strategy', hint: 'strategy read-out grounded in the served app’s declared metrics' },
]
const slashMatches = computed(() => {
  const text = input.value
  const head = text.split(/\s/, 1)[0]
  if (!head.startsWith('/') || text !== head) return []
  return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(head) && c.cmd !== head)
})
function completeSlash(cmd: string) {
  input.value = cmd
}
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
  if (e.key === 'Tab' && slashMatches.value.length) {
    e.preventDefault()
    completeSlash(slashMatches.value[0].cmd)
    return
  }
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
    // The patrol card lands seconds after open (bg probe + LLM call) — keep
    // "the AI speaks first" above the fold (review-found 2026-07-11).
    store.patrol,
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
      <!-- opening patrol (F-2 B): the AI speaks first over the served app's
           record state; ephemeral — answers go through the normal chat box -->
      <PatrolCard />
    </div>

    <footer class="chat__input">
      <div v-if="slashMatches.length" class="slash-pop">
        <button
          v-for="c in slashMatches"
          :key="c.cmd"
          class="slash-pop__item"
          title="Tab or click to complete"
          @mousedown.prevent="completeSlash(c.cmd)"
        >
          <code class="slash-pop__cmd">{{ c.cmd }}</code>
          <span class="slash-pop__hint">{{ c.hint }}</span>
        </button>
      </div>
      <textarea
        v-model="input"
        rows="3"
        placeholder="Type a message (Ctrl / Cmd + Enter to send) — “/” for commands"
        @keydown="onKeydown"
      />
      <button class="btn btn--primary" :disabled="store.sending || !input.trim()" @click="submit">
        Send
      </button>
    </footer>
  </section>
</template>

<style scoped>
.chat__input {
  position: relative;
}
.slash-pop {
  position: absolute;
  left: 12px;
  bottom: 100%;
  margin-bottom: 4px;
  display: flex;
  flex-direction: column;
  min-width: 320px;
  border: 1px solid var(--border, #2a2f3a);
  border-radius: 8px;
  background: var(--elev-1, #171a21);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  z-index: 5;
}
.slash-pop__item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 12px;
  border: none;
  background: none;
  color: var(--text, #e6e8ec);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.slash-pop__item:hover {
  background: var(--elev-2, #1d212b);
}
.slash-pop__cmd {
  color: var(--accent, #18c7d8);
}
.slash-pop__hint {
  color: var(--text-dim, #9aa3b2);
  font-size: 12px;
}
</style>
