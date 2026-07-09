<script setup lang="ts">
// World topic authoring (topics-authoring T6, W4/W5/W7/W9): the panel that
// edits the linked instance's news-topics.json through the gate. Manual
// editing works with no model; the natural-language "structure with AI"
// leg needs a running local model (just setup / T4) and degrades honestly.
// Nothing is saved until the user reviews and approves (W5 — F6: the AI
// never writes topics unattended).
import { computed, onMounted, ref } from 'vue'
import {
  cleanTopic, mergeProposal, parseProposal, validateTopics, TOPIC_INTENTS,
} from '../topics'
import type { Topic, TopicChange, TopicsResponse } from '../topics'

const open = ref(false)
const loading = ref(true)
const writable = ref(false)
const readOnlyReason = ref<string | null>(null)
const status = ref<{ ok: boolean; message: string } | null>(null)
const topics = ref<Topic[]>([])
const referenceSites = ref('') // one per line in the textarea

// Natural-language authoring (W4/W9): type a request, the local model
// proposes structured topics, the merge is shown for review before save.
const nlText = ref('')
const nlBusy = ref(false)
const pendingChanges = ref<TopicChange[] | null>(null)
let pendingMerged: Topic[] = []

const summary = computed(() =>
  loading.value ? 'loading…' : `${topics.value.length} topic${topics.value.length === 1 ? '' : 's'}`
  + (writable.value ? '' : ' · read-only'))

async function load() {
  loading.value = true
  status.value = null
  try {
    const r = await fetch('/api/world/topics')
    if (!r.ok) {
      status.value = { ok: false, message: `topics unavailable (${r.status}): ${await r.text()}` }
      return
    }
    const got: TopicsResponse = await r.json()
    topics.value = got.topics.map((t) => ({ ...t }))
    referenceSites.value = (got.reference_sites ?? []).join('\n')
    writable.value = got.writable
    readOnlyReason.value = got.read_only_reason ?? null
  } catch (e) {
    status.value = { ok: false, message: `topics unavailable: ${e}` }
  } finally {
    loading.value = false
  }
}

function addTopic() {
  topics.value.push({ name: '', intent: 'broad', mandatory: false })
}
function removeTopic(i: number) {
  topics.value.splice(i, 1)
}

async function save() {
  status.value = null
  const cleaned = topics.value.map(cleanTopic)
  const err = validateTopics(cleaned)
  if (err) {
    status.value = { ok: false, message: err }
    return
  }
  const sites = referenceSites.value.split('\n').map((s) => s.trim()).filter(Boolean)
  const body: { topics: Topic[]; reference_sites?: string[] } = { topics: cleaned }
  if (sites.length) body.reference_sites = sites
  const r = await fetch('/api/world/topics', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (r.ok) {
    status.value = { ok: true, message: 'saved — the next pipeline run searches these topics' }
    topics.value = cleaned
  } else {
    status.value = { ok: false, message: `save failed (${r.status}): ${await r.text()}` }
  }
}

// W4: send the sentence to the local model for structuring, then stage the
// merge for review. The endpoint is llama-backed (T4); until it runs, the
// gate answers unavailable and we say so plainly — manual editing is
// unaffected.
async function structure() {
  if (!nlText.value.trim()) return
  nlBusy.value = true
  status.value = null
  try {
    const r = await fetch('/api/world/topics/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request: nlText.value.trim(), existing: topics.value.map((t) => t.name) }),
    })
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      status.value = {
        ok: false,
        message: r.status === 503
          ? 'local model offline — run `just setup` to enable AI structuring (manual editing works now)'
          : `structuring failed (${r.status}): ${detail}`,
      }
      return
    }
    const proposed = parseProposal(await r.json())
    if (!proposed.length) {
      status.value = { ok: false, message: 'the model returned no topics — try rephrasing' }
      return
    }
    const { merged, changes } = mergeProposal(topics.value.map(cleanTopic), proposed)
    if (!changes.length) {
      status.value = { ok: true, message: 'nothing new — the proposal matched your current topics' }
      return
    }
    pendingMerged = merged
    pendingChanges.value = changes
  } catch (e) {
    status.value = { ok: false, message: `structuring failed: ${e}` }
  } finally {
    nlBusy.value = false
  }
}

// W5/F6: the merge only lands when the user accepts the diff. Applying it
// stages the edit in the form — the user still presses Save to persist.
function applyProposal() {
  topics.value = pendingMerged.map((t) => ({ ...t }))
  pendingChanges.value = null
  nlText.value = ''
  status.value = { ok: true, message: 'merged into the form — review and press Save to persist' }
}
function discardProposal() {
  pendingChanges.value = null
}

onMounted(load)
</script>

<template>
  <div class="topic-editor">
    <p class="meta">
      Topics: <span>{{ summary }}</span>
      <button type="button" class="toggle" @click="open = !open">
        {{ open ? 'close' : 'edit topics' }}
      </button>
    </p>

    <div v-if="open" class="body">
      <p v-if="!writable && readOnlyReason" class="meta warn">{{ readOnlyReason }}</p>

      <!-- Natural-language authoring (W4/W9) -->
      <div class="nl">
        <textarea
          v-model="nlText"
          :disabled="!writable"
          rows="2"
          placeholder="Describe what to track, e.g. &quot;follow newborn agent-harness ideas broadly, and watch RISC-V hardware&quot; — the local model structures it, you review before saving"
        />
        <button type="button" :disabled="!writable || nlBusy || !nlText.trim()" @click="structure">
          {{ nlBusy ? 'structuring…' : 'Structure with AI' }}
        </button>
      </div>

      <!-- Diff-merge review (W5): nothing lands without approval -->
      <div v-if="pendingChanges" class="review">
        <p class="meta">Proposed changes — review before applying:</p>
        <ul>
          <li v-for="(c, i) in pendingChanges" :key="i">
            <span class="tag" :class="c.kind">{{ c.kind }}</span>
            <strong>{{ c.after.name }}</strong>
            <span class="detail">
              {{ c.after.intent }}<template v-if="c.after.mandatory"> · mandatory</template>
              <template v-if="c.kind === 'refine' && c.before">
                (was {{ c.before.intent }}<template v-if="c.before.mandatory"> · mandatory</template>)
              </template>
            </span>
          </li>
        </ul>
        <div>
          <button type="button" @click="applyProposal">Apply to form</button>
          <button type="button" @click="discardProposal">Discard</button>
        </div>
      </div>

      <!-- Manual editor -->
      <table class="topics">
        <thead>
          <tr><th>Topic</th><th>Intent</th><th>Every run</th><th>Note</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="(t, i) in topics" :key="i">
            <td><input v-model="t.name" :disabled="!writable" placeholder="topic name" /></td>
            <td>
              <select v-model="t.intent" :disabled="!writable">
                <option v-for="opt in TOPIC_INTENTS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </td>
            <td class="center"><input type="checkbox" v-model="t.mandatory" :disabled="!writable" /></td>
            <td><input v-model="t.note" :disabled="!writable" placeholder="optional trace" /></td>
            <td><button type="button" :disabled="!writable" @click="removeTopic(i)">✕</button></td>
          </tr>
          <tr v-if="!topics.length"><td colspan="5" class="meta">no topics yet</td></tr>
        </tbody>
      </table>

      <div class="intent-help meta">
        <strong>watch</strong> = one query · <strong>broad</strong> = a light multi-angle pass ·
        <strong>deep</strong> = a goal-driven search loop
      </div>

      <label class="sites">
        Default reference sites (one per line)
        <textarea v-model="referenceSites" :disabled="!writable" rows="2" placeholder="https://…" />
      </label>

      <div class="actions">
        <button type="button" :disabled="!writable" @click="addTopic">+ add topic</button>
        <button type="button" class="save" :disabled="!writable" @click="save">Save</button>
      </div>
      <p v-if="status" class="meta" :class="{ warn: !status.ok }">{{ status.message }}</p>
    </div>
  </div>
</template>

<style scoped>
.body { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.6rem; }
.nl { display: flex; gap: 0.5rem; align-items: flex-start; }
.nl textarea { flex: 1; }
.topics { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.topics th, .topics td { text-align: left; padding: 0.25rem 0.4rem; border-bottom: 1px solid var(--nui-border, #2a2f3a); }
.topics th { color: var(--nui-dim, #9aa3b2); font-weight: 500; }
.topics input[type='text'], .topics input:not([type]), .topics select { width: 100%; }
.center { text-align: center; }
.review { border: 1px solid var(--nui-border, #2a2f3a); border-radius: 6px; padding: 0.5rem 0.75rem; }
.review ul { margin: 0.3rem 0; padding-left: 0.5rem; list-style: none; }
.review li { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.1rem 0; }
.tag { font-size: 0.72rem; padding: 0 0.4rem; border-radius: 4px; border: 1px solid var(--nui-border, #2a2f3a); }
.tag.add { color: var(--nui-success, #5fd99f); }
.tag.refine { color: var(--nui-accent, #18c7d8); }
.detail { color: var(--nui-dim, #9aa3b2); }
.sites { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.85rem; }
.sites textarea { width: 100%; }
.actions { display: flex; gap: 0.5rem; }
.actions .save { margin-left: auto; }
.intent-help { font-size: 0.78rem; }
.toggle { margin-left: 0.6rem; }
</style>
