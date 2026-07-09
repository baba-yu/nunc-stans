<script setup lang="ts">
// Run-log viewer (Phase D, v1 plan §2.6/§2.7): the audit substrate,
// read-only through the gate — the main store's ai-runs.jsonl (FourFive
// chat + the agent) and each data instance's store log (pipeline runs).
// The log carries no prompt text, so neither does this screen.
import { computed, onMounted, ref, watch } from 'vue'
import { Panel } from 'nunc-ui'

interface Verdict {
  met: boolean
  gaps: string[]
  tokensIn: number
  tokensOut: number
}

interface RunRow {
  ts: string
  caller: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  verify: 'on' | 'off'
  outcome: 'ok' | 'error'
  error?: string
  profile?: string
  verdicts?: Verdict[]
}

const source = ref<'main' | string>('main')
const instances = ref<string[]>([])
const rows = ref<RunRow[]>([])
const status = ref<string | null>(null)
const loading = ref(false)
const expanded = ref<Record<number, boolean>>({})

const sourceLabel = computed(() =>
  source.value === 'main' ? 'main store (chat + agent)' : `instance: ${source.value}`)

async function load() {
  loading.value = true
  status.value = null
  expanded.value = {}
  try {
    const url = source.value === 'main'
      ? '/api/runs?limit=200'
      : `/api/runs?source=instance&instance=${encodeURIComponent(source.value)}&limit=200`
    const r = await fetch(url)
    if (!r.ok) {
      status.value = `run log unavailable (${r.status}): ${await r.text()}`
      rows.value = []
      return
    }
    rows.value = ((await r.json()) as RunRow[]).reverse() // newest first
    if (rows.value.length === 0) status.value = 'no runs recorded yet'
  } catch (e) {
    status.value = `run log unavailable: ${e}`
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const r = await fetch('/api/runs/instances')
    if (r.ok) instances.value = await r.json()
  } catch { /* instance list is optional */ }
  await load()
})
watch(source, load)

const fmtTs = (ts: string) => ts.replace('T', ' ').replace(/\.\d+Z?$/, '')
const cost = (r: RunRow) => `${r.inputTokens}/${r.outputTokens}`
</script>

<template>
  <main class="page">
    <Panel title="AI run log">
      <p class="meta">
        Every model call, audited: caller, profile, provider/model, tokens,
        and the goal-verify verdict chain. Source: {{ sourceLabel }}.
      </p>
      <p class="controls">
        <label>
          source
          <select v-model="source">
            <option value="main">main store</option>
            <option v-for="i in instances" :key="i" :value="i">instance: {{ i }}</option>
          </select>
        </label>
        <button type="button" @click="load">refresh</button>
      </p>
      <p v-if="status" class="meta">{{ status }}</p>
      <p v-if="loading" class="meta">loading…</p>

      <table v-if="rows.length" class="runs">
        <thead>
          <tr>
            <th>time (utc)</th><th>caller</th><th>profile</th><th>provider · model</th>
            <th>tok in/out</th><th>ms</th><th>verify</th><th>outcome</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(r, i) in rows" :key="i">
            <tr :class="{ 'runs__row--error': r.outcome === 'error' }">
              <td>{{ fmtTs(r.ts) }}</td>
              <td>{{ r.caller }}</td>
              <td>{{ r.profile ?? '—' }}</td>
              <td>{{ r.provider }} · {{ r.model || '—' }}</td>
              <td>{{ cost(r) }}</td>
              <td>{{ r.durationMs }}</td>
              <td>
                <button
                  v-if="r.verdicts?.length"
                  type="button"
                  class="runs__verify"
                  @click="expanded[i] = !expanded[i]"
                >
                  on · {{ r.verdicts.length }} iter {{ expanded[i] ? '▲' : '▼' }}
                </button>
                <span v-else>{{ r.verify }}</span>
              </td>
              <td>{{ r.outcome }}{{ r.error ? ` — ${r.error}` : '' }}</td>
            </tr>
            <tr v-if="expanded[i] && r.verdicts" class="runs__chain">
              <td colspan="8">
                <div v-for="(v, n) in r.verdicts" :key="n">
                  iteration {{ n + 1 }}: {{ v.met ? 'goal met' : `unmet — ${v.gaps.join('; ') || 'no gaps reported'}` }}
                  ({{ v.tokensIn }}/{{ v.tokensOut }} tok)
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </Panel>
  </main>
</template>

<style scoped>
.page {
  padding: 1rem;
}
.controls {
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
}
.controls label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
}
.runs {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.runs th,
.runs td {
  text-align: left;
  padding: 0.25rem 0.55rem 0.25rem 0;
  border-bottom: 1px solid var(--line, #ddd);
  white-space: nowrap;
}
.runs td:last-child {
  white-space: normal;
}
.runs__row--error td {
  color: #b23;
}
.runs__chain td {
  font-size: 0.78rem;
  opacity: 0.85;
  white-space: normal;
}
.runs__verify {
  font-size: 0.78rem;
}
</style>
