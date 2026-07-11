<script setup lang="ts">
// Manual pipeline run from the World view (world-run plan W-R1/W-R3):
// POST /api/world/run starts ONE run against the linked instance; this
// panel polls the gate's job state and shows the log tail honestly —
// including gate failures (e.g. lint-news), which are the pipeline
// telling the truth, not UI noise. On success the gate restages the
// world exports, so a reload shows the new day.
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface RunStatus {
  state: string // idle | running | staging | done | error: <msg>
  seconds?: number
  tail?: string[]
}

const status = ref<RunStatus>({ state: 'idle' })
const message = ref<string | null>(null)
const showTail = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const active = () => status.value.state === 'running' || status.value.state === 'staging'

async function poll() {
  try {
    const r = await fetch('/api/world/run')
    if (r.ok) status.value = await r.json()
  } catch { /* transient */ }
  if (!active() && timer) {
    clearInterval(timer)
    timer = null
  }
}

async function start() {
  message.value = null
  const r = await fetch('/api/world/run', { method: 'POST' })
  if (!r.ok) {
    message.value = `run refused (${r.status}): ${await r.text()}`
    return
  }
  status.value = { state: 'running', seconds: 0 }
  showTail.value = true
  if (!timer) timer = setInterval(poll, 3000)
}

onMounted(() => { poll().then(() => { if (active() && !timer) timer = setInterval(poll, 3000) }) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="run">
    <div class="run__row">
      <button type="button" :disabled="active()" @click="start">
        {{ active() ? `running… ${status.seconds ?? 0}s` : 'Run today' }}
      </button>
      <span class="meta">
        <template v-if="status.state === 'idle'">runs the daily chain against the linked instance</template>
        <template v-else-if="status.state === 'staging'">pipeline OK — restaging world exports…</template>
        <template v-else-if="status.state === 'done'">done — reload the page for the new day</template>
        <template v-else-if="status.state.startsWith('error')">{{ status.state }}</template>
        <template v-else>step output below</template>
      </span>
      <button v-if="(status.tail ?? []).length" type="button" @click="showTail = !showTail">
        {{ showTail ? 'hide log' : 'show log' }}
      </button>
    </div>
    <p v-if="message" class="meta warn">{{ message }}</p>
    <pre v-if="showTail && (status.tail ?? []).length" class="run__tail">{{ (status.tail ?? []).join('\n') }}</pre>
  </div>
</template>

<style scoped>
.run__row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}
.run__tail {
  margin-top: 0.5rem;
  max-height: 14rem;
  overflow: auto;
  font-size: 0.75rem;
  line-height: 1.35;
  background: color-mix(in srgb, currentColor 6%, transparent);
  padding: 0.5rem;
  border-radius: 4px;
  white-space: pre-wrap;
}
.warn {
  color: #b23;
}
</style>
