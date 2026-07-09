<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Panel, Badge } from 'nunc-ui'

// The generic shell: everything below is driven by the served manifest —
// no per-app code exists anywhere (contract §6). Served at /apps/<slug>/,
// all fetches are relative so the gate prefix never appears in code.

interface Column {
  name: string
  type: string
  pk?: boolean
  fk?: string
  notNull?: boolean
  audit?: boolean
}
interface Entity {
  name: string
  description?: string
  columns: Column[]
}
interface MockUiField {
  id: string
  label: string
  type: string
  maps_to: string[]
  options?: string[]
  required?: boolean
}
interface Screen {
  id: string
  name: string
  fields: MockUiField[]
}
interface Manifest {
  slug: string
  version: number
  name: string
  description?: string
  entities: Entity[]
  metrics: { name: string; label: string }[]
  ui: { screens: Screen[] }
}
interface MetricValue {
  name: string
  label: string
  value: number | string | null
  error?: string
}

const manifest = ref<Manifest | null>(null)
const status = ref<{ readOnly: boolean; reason: string | null } | null>(null)
const metrics = ref<MetricValue[]>([])
const rows = reactive<Record<string, Record<string, unknown>[]>>({})
const showArchived = reactive<Record<string, boolean>>({})
const forms = reactive<Record<string, Record<string, string>>>({})
const banner = ref<string | null>(null)

interface FormField {
  column: string
  label: string
  input: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox'
  options?: string[]
  required: boolean
}
interface FormSpec {
  key: string
  title: string
  entity: string
  fields: FormField[]
}

function writable(e: Entity): Column[] {
  return e.columns.filter((c) => !c.pk && !c.audit)
}

function inputFor(c: Column): FormField['input'] {
  return c.type === 'INTEGER' || c.type === 'REAL' || c.type === 'NUMERIC' ? 'number' : 'text'
}

// Screens drive the forms where they can (fields grouped by their maps_to
// table); entities no screen covers get a default form from their columns.
const formSpecs = computed<FormSpec[]>(() => {
  const m = manifest.value
  if (!m) return []
  const specs: FormSpec[] = []
  const covered = new Set<string>()
  for (const screen of m.ui.screens) {
    const byTable = new Map<string, FormField[]>()
    for (const f of screen.fields) {
      const target = f.maps_to[0]?.split('.')
      if (!target || target.length !== 2) continue
      const entity = m.entities.find((e) => e.name === target[0])
      const col = entity && writable(entity).find((c) => c.name === target[1])
      if (!entity || !col) continue
      const list = byTable.get(entity.name) ?? []
      list.push({
        column: col.name,
        label: f.label,
        input:
          f.type === 'select' || f.type === 'radio'
            ? 'select'
            : f.type === 'textarea'
              ? 'textarea'
              : f.type === 'number'
                ? 'number'
                : f.type === 'date'
                  ? 'date'
                  : inputFor(col),
        ...(f.options ? { options: f.options } : {}),
        required: f.required === true || col.notNull === true,
      })
      byTable.set(entity.name, list)
    }
    for (const [entity, fields] of byTable) {
      covered.add(entity)
      specs.push({ key: `${screen.id}:${entity}`, title: screen.name, entity, fields })
    }
  }
  for (const e of m.entities) {
    if (covered.has(e.name)) continue
    specs.push({
      key: `default:${e.name}`,
      title: `New ${e.name}`,
      entity: e.name,
      fields: writable(e).map((c) => ({
        column: c.name,
        label: c.name,
        input: inputFor(c),
        required: c.notNull === true,
      })),
    })
  }
  return specs
})

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

async function loadRows(entity: string): Promise<void> {
  rows[entity] = await get<Record<string, unknown>[]>(
    `api/${entity}${showArchived[entity] ? '?archived=1' : ''}`,
  )
}

async function refresh(): Promise<void> {
  const m = manifest.value
  if (!m) return
  metrics.value = await get<MetricValue[]>('api/metrics')
  await Promise.all(m.entities.map((e) => loadRows(e.name)))
}

async function submit(spec: FormSpec): Promise<void> {
  banner.value = null
  const form = forms[spec.key] ?? {}
  const entity = manifest.value!.entities.find((e) => e.name === spec.entity)!
  const payload: Record<string, unknown> = {}
  for (const f of spec.fields) {
    const raw = form[f.column]
    if (raw === undefined || raw === '') continue
    const col = entity.columns.find((c) => c.name === f.column)!
    payload[f.column] =
      col.type === 'INTEGER' || col.type === 'REAL' || col.type === 'NUMERIC' ? Number(raw) : raw
  }
  const res = await fetch(`api/${spec.entity}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    banner.value = `create refused: ${(await res.json().catch(() => ({ error: res.statusText })) as { error?: string }).error}`
    return
  }
  forms[spec.key] = {}
  await refresh()
}

async function archive(entity: string, id: unknown): Promise<void> {
  banner.value = null
  const res = await fetch(`api/${entity}/${String(id)}/archive`, { method: 'POST' })
  if (!res.ok) {
    banner.value = `archive refused: ${(await res.json().catch(() => ({ error: res.statusText })) as { error?: string }).error}`
    return
  }
  await refresh()
}

async function toggleArchived(entity: string): Promise<void> {
  showArchived[entity] = !showArchived[entity]
  await loadRows(entity)
}

function pkOf(entity: string): string {
  const e = manifest.value!.entities.find((x) => x.name === entity)!
  return e.columns.find((c) => c.pk)!.name
}

function displayColumns(e: Entity): string[] {
  return e.columns.filter((c) => c.name !== 'archived_at' || showArchived[e.name]).map((c) => c.name)
}

onMounted(async () => {
  try {
    manifest.value = await get<Manifest>('api/manifest')
    status.value = await get<{ readOnly: boolean; reason: string | null }>('api/status')
    document.title = manifest.value.name
    await refresh()
  } catch (err) {
    banner.value = (err as Error).message
  }
})
</script>

<template>
  <main class="shell">
    <header class="shell__head">
      <h1>{{ manifest?.name ?? 'Loading…' }}</h1>
      <Badge v-if="manifest">{{ manifest.slug }}@v{{ manifest.version }}</Badge>
      <Badge v-if="status?.readOnly" variant="warn">read-only</Badge>
    </header>
    <p v-if="manifest?.description" class="shell__desc">{{ manifest.description }}</p>
    <p v-if="status?.readOnly" class="shell__banner">{{ status.reason }}</p>
    <p v-if="banner" class="shell__banner">{{ banner }}</p>

    <Panel v-if="metrics.length" title="Metrics">
      <div class="metrics">
        <div v-for="m in metrics" :key="m.name" class="metrics__item">
          <span class="metrics__label">{{ m.label }}</span>
          <span v-if="m.error" class="metrics__error" :title="m.error">error</span>
          <span v-else class="metrics__value">{{ m.value ?? '—' }}</span>
        </div>
      </div>
    </Panel>

    <Panel v-for="spec in formSpecs" :key="spec.key" :title="spec.title">
      <form class="form" @submit.prevent="submit(spec)">
        <label v-for="f in spec.fields" :key="f.column" class="form__field">
          <span>{{ f.label }}<span v-if="f.required"> *</span></span>
          <select
            v-if="f.input === 'select'"
            v-model="(forms[spec.key] ??= {})[f.column]"
            :required="f.required"
          >
            <option value="" disabled>choose…</option>
            <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
          </select>
          <textarea
            v-else-if="f.input === 'textarea'"
            v-model="(forms[spec.key] ??= {})[f.column]"
            :required="f.required"
          />
          <input
            v-else
            v-model="(forms[spec.key] ??= {})[f.column]"
            :type="f.input"
            :required="f.required"
          />
        </label>
        <button type="submit" :disabled="status?.readOnly">Create {{ spec.entity }}</button>
      </form>
    </Panel>

    <Panel v-for="e in manifest?.entities ?? []" :key="e.name" :title="e.name">
      <div class="tbl-bar">
        <button class="tbl-bar__toggle" @click="toggleArchived(e.name)">
          {{ showArchived[e.name] ? 'showing archived' : 'show archived' }}
        </button>
      </div>
      <table class="tbl">
        <thead>
          <tr>
            <th v-for="c in displayColumns(e)" :key="c">{{ c }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows[e.name] ?? []" :key="String(row[pkOf(e.name)])">
            <td v-for="c in displayColumns(e)" :key="c">{{ row[c] ?? '' }}</td>
            <td>
              <button
                v-if="!row.archived_at"
                :disabled="status?.readOnly"
                @click="archive(e.name, row[pkOf(e.name)])"
              >
                archive
              </button>
            </td>
          </tr>
          <tr v-if="!(rows[e.name] ?? []).length">
            <td :colspan="displayColumns(e).length + 1" class="tbl__empty">no rows</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  </main>
</template>

<style scoped>
.shell {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px 64px;
  display: grid;
  gap: 16px;
}
.shell__head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.shell__head h1 {
  font-size: 20px;
  margin: 0;
}
.shell__desc {
  color: var(--text-dim, #9aa3b2);
  margin: 0;
}
.shell__banner {
  color: var(--warn, #d9c47f);
  border: 1px solid var(--border, #2a2f3a);
  border-radius: 8px;
  padding: 8px 12px;
  margin: 0;
  white-space: pre-wrap;
}
.metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}
.metrics__item {
  display: grid;
  gap: 2px;
}
.metrics__label {
  font-size: 12px;
  color: var(--text-dim, #9aa3b2);
}
.metrics__value {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
.metrics__error {
  color: var(--error, #e08f8f);
}
.form {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  align-items: end;
}
.form__field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--text-dim, #9aa3b2);
}
.form input,
.form select,
.form textarea {
  background: var(--elev-1, #171a21);
  color: var(--text, #e6e8ec);
  border: 1px solid var(--border, #2a2f3a);
  border-radius: 6px;
  padding: 6px 8px;
  font: inherit;
}
.form button,
.tbl-bar__toggle,
.tbl button {
  background: var(--elev-2, #1e222b);
  color: var(--text, #e6e8ec);
  border: 1px solid var(--border, #2a2f3a);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}
.form button:hover:not(:disabled),
.tbl button:hover:not(:disabled) {
  border-color: var(--accent, #18c7d8);
}
.tbl-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th,
.tbl td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border, #2a2f3a);
}
.tbl th {
  color: var(--text-dim, #9aa3b2);
  font-weight: 500;
}
.tbl__empty {
  color: var(--text-dim, #9aa3b2);
}
</style>
