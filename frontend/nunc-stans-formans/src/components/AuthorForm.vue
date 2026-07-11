<script setup lang="ts">
// Commitment authoring: describe it in a sentence and the local model
// prefills the fields (the TopicEditor W4 pattern) — or fill them by hand.
// Either way the user reviews and presses Author; the LLM only proposes,
// never writes (constitution F3/F6).
import { reactive, ref } from 'vue'
import { localToday, parseCommitmentProposal } from '../commitment-extract'
import { useMeStore } from '../stores/me'

const store = useMeStore()

const form = reactive({
  slug: '',
  title: '',
  started_at: '',
  money_jpy: '',
  hours: '',
  note: '',
})
const msg = ref('')
const isError = ref(false)

// Natural-language leg: needs a running local model (just setup) and
// degrades honestly — the manual fields work without it.
const nlText = ref('')
const nlBusy = ref(false)

async function structure() {
  if (!nlText.value.trim()) return
  nlBusy.value = true
  msg.value = ''
  isError.value = false
  try {
    const r = await fetch('/api/self/commitment/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request: nlText.value.trim(), today: localToday() }),
    })
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      msg.value =
        r.status === 503
          ? 'local model offline — run `just setup` to enable AI structuring (manual authoring works now)'
          : `structuring failed (${r.status}): ${detail}`
      isError.value = true
      return
    }
    const draft = parseCommitmentProposal(await r.json())
    if (!draft) {
      msg.value = 'the model returned nothing usable — try rephrasing'
      isError.value = true
      return
    }
    Object.assign(form, draft)
    nlText.value = ''
    msg.value = 'prefilled from your sentence — review, edit, and press Author'
  } catch (e) {
    msg.value = `structuring failed: ${e}`
    isError.value = true
  } finally {
    nlBusy.value = false
  }
}

async function submit() {
  const res = await store.authorCommitment({ ...form })
  msg.value = res.message
  isError.value = !res.ok
  if (res.ok) {
    form.slug = ''
    form.title = ''
    form.started_at = ''
    form.money_jpy = ''
    form.hours = ''
    form.note = ''
  }
}
</script>

<template>
  <!-- The heading comes from the surrounding Panel's title. -->
  <form @submit.prevent="submit">
    <div class="nl">
      <textarea
        v-model="nlText"
        rows="2"
        placeholder="Describe the commitment in plain words, e.g. 「6月から月3万円で英会話を始めた」 — the local model prefills the fields, you review before authoring"
      ></textarea>
      <button type="button" :disabled="nlBusy || !nlText.trim()" @click="structure">
        {{ nlBusy ? 'structuring…' : 'Structure with AI' }}
      </button>
    </div>

    <input v-model="form.slug" placeholder="slug (a-z, 0-9, -)" required pattern="[a-z0-9-]+" />
    <input v-model="form.title" placeholder="title" required />
    <input v-model="form.started_at" placeholder="started_at (YYYY-MM-DD)" required />
    <input v-model="form.money_jpy" placeholder="money_jpy (optional)" inputmode="numeric" />
    <input v-model="form.hours" placeholder="hours (optional)" inputmode="decimal" />
    <textarea v-model="form.note" placeholder="note (optional)" rows="2"></textarea>
    <button type="submit">Author (user peer)</button>
    <div id="msg" :class="{ warn: isError }">{{ msg }}</div>
  </form>
</template>

<style scoped>
.nl {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}
.nl textarea {
  flex: 1;
}
</style>
