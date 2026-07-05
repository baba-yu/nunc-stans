<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Panel } from 'nunc-ui'
import { getOutcomes } from '../api'
import { useMeStore } from '../stores/me'
import { buildWeeks, type WeekRow } from '../timeline'
import type { Outcome } from '../types'

const store = useMeStore()
const router = useRouter()
const weeks = ref<WeekRow[]>([])
const loaded = ref(false)

// Layout: 56px per week — the cold grid rhythm (§2.5).
const GUTTER = 150
const CELL = 56
const LANE = { commitments: 34, edges: 84, provenance: 124, interventions: 158, mandates: 188 }
const HEIGHT = 214

const width = computed(() => GUTTER + weeks.value.length * CELL + 24)

function x(i: number): number {
  return GUTTER + i * CELL + CELL / 2
}

// Cluster markers sharing a week around its center.
function offset(j: number, n: number): number {
  return (j - (n - 1) / 2) * 12
}

/** Heat level for a week's provenance mix (0 when nothing opened). */
function heatVar(w: WeekRow): string {
  if (w.mix.total === 0) return 'var(--nui-heat-0)'
  const p = w.mix.percent
  const level = p === 0 ? 0 : p <= 25 ? 1 : p <= 50 ? 2 : p <= 75 ? 3 : 4
  return `var(--nui-heat-${level})`
}

function shortId(id: string): string {
  return id.split('/').pop() ?? id
}

// Jump to the underlying record: home scrolls to and highlights it (S-9).
function jump(id: string) {
  router.push({ path: '/', query: { focus: id } })
}

// Show the year only when it changes along the axis.
function weekLabel(w: WeekRow, i: number): string {
  const [year, wk] = w.key.split('-')
  if (i === 0) return w.key
  const prevYear = weeks.value[i - 1].key.split('-')[0]
  return year === prevYear ? wk : w.key
}

onMounted(async () => {
  await store.load()
  const results = await Promise.all(
    store.commitments.map((c) =>
      getOutcomes(shortId(c.id)).catch(() => null),
    ),
  )
  const outcomes: Outcome[] = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .flatMap((r) => r.outcomes)
  weeks.value = buildWeeks(store.commitments, store.edges, outcomes)
  loaded.value = true
})
</script>

<template>
  <div class="world nui-cold">
    <main class="page page--wide">
      <h2>Timeline</h2>
      <p class="meta">
        The self scope as a time series — weeks on the cold grid; click any
        marker to land on the underlying record.
      </p>

      <Panel v-if="weeks.length" cold>
        <div class="tl-scroll">
          <svg :width="width" :height="HEIGHT" class="tl" role="img" aria-label="weekly timeline">
            <!-- week axis -->
            <text v-for="(w, i) in weeks" :key="'ax' + w.key" :x="x(i)" y="14" class="tl-axis">
              {{ weekLabel(w, i) }}
            </text>
            <line
              v-for="(w, i) in weeks"
              :key="'gl' + w.key"
              :x1="x(i)"
              y1="20"
              :x2="x(i)"
              :y2="HEIGHT - 8"
              class="tl-grid"
            />

            <!-- lane: commitments (○ opened / ● closed) -->
            <text :x="8" :y="LANE.commitments + 4" class="tl-lane">commitments</text>
            <template v-for="(w, i) in weeks" :key="'c' + w.key">
              <circle
                v-for="(id, j) in w.opened"
                :key="'o' + id"
                :cx="x(i) + offset(j, w.opened.length)"
                :cy="LANE.commitments"
                r="5"
                class="tl-open"
                @click="jump(id)"
              >
                <title>opened: {{ shortId(id) }}</title>
              </circle>
              <circle
                v-for="(id, j) in w.closed"
                :key="'x' + id + i"
                :cx="x(i) + offset(j, w.closed.length)"
                :cy="LANE.commitments + 14"
                r="4.5"
                class="tl-close"
                @click="jump(id)"
              >
                <title>closed (observable): {{ shortId(id) }}</title>
              </circle>
            </template>

            <!-- lane: edges by author -->
            <text :x="8" :y="LANE.edges + 4" class="tl-lane">edges</text>
            <template v-for="(w, i) in weeks" :key="'e' + w.key">
              <g v-if="w.edges.user + w.edges.ai + w.edges.sensor > 0">
                <circle :cx="x(i)" :cy="LANE.edges" r="4" class="tl-edge" />
                <text :x="x(i) + 8" :y="LANE.edges + 3" class="tl-count">
                  {{ w.edges.user + w.edges.ai + w.edges.sensor }}
                </text>
                <title>
                  user {{ w.edges.user }} · ai {{ w.edges.ai }} · sensor {{ w.edges.sensor }}
                </title>
              </g>
            </template>

            <!-- lane: weekly provenance mix (heat strip) -->
            <text :x="8" :y="LANE.provenance + 4" class="tl-lane">provenance</text>
            <template v-for="(w, i) in weeks" :key="'p' + w.key">
              <rect
                v-if="w.mix.total > 0"
                :x="x(i) - (CELL - 12) / 2"
                :y="LANE.provenance - 5"
                :width="CELL - 12"
                height="10"
                rx="2"
                :fill="heatVar(w)"
              >
                <title>{{ w.key }}: {{ w.mix.aiPrompted }}/{{ w.mix.total }} AI-prompted ({{ w.mix.percent }}%)</title>
              </rect>
            </template>

            <!-- reserved lanes: records arrive with manda integration (Phase D+) -->
            <text :x="8" :y="LANE.interventions + 4" class="tl-lane tl-lane--reserved">interventions</text>
            <line :x1="GUTTER" :y1="LANE.interventions" :x2="width - 12" :y2="LANE.interventions" class="tl-reserved" />
            <text :x="GUTTER + 6" :y="LANE.interventions - 6" class="tl-reserved-note">no records yet (Phase D+)</text>

            <text :x="8" :y="LANE.mandates + 4" class="tl-lane tl-lane--reserved">mandate windows</text>
            <line :x1="GUTTER" :y1="LANE.mandates" :x2="width - 12" :y2="LANE.mandates" class="tl-reserved" />
            <text :x="GUTTER + 6" :y="LANE.mandates - 6" class="tl-reserved-note">no records yet (Phase D+)</text>
          </svg>
        </div>
      </Panel>

      <Panel v-else-if="loaded" cold>
        <p class="meta">no records yet — author a commitment on ME and the weeks appear here</p>
      </Panel>
    </main>
  </div>
</template>

<style scoped>
.page--wide {
  max-width: 72rem;
}
.tl-scroll {
  overflow-x: auto;
}
.tl-axis {
  fill: var(--nui-cold-dim);
  font-size: 10px;
  text-anchor: middle;
  font-family: var(--nui-mono);
}
.tl-grid {
  stroke: var(--nui-cold-grid);
}
.tl-lane {
  fill: var(--nui-cold-dim);
  font-size: 11px;
}
.tl-lane--reserved {
  opacity: 0.6;
}
.tl-open {
  fill: none;
  stroke: var(--nui-accent);
  stroke-width: 1.6;
  cursor: pointer;
}
.tl-close {
  fill: var(--nui-accent);
  cursor: pointer;
}
.tl-edge {
  fill: var(--nui-heat-1);
}
.tl-count {
  fill: var(--nui-cold-dim);
  font-size: 10px;
  font-family: var(--nui-mono);
}
.tl-reserved {
  stroke: var(--nui-cold-border);
  stroke-dasharray: 4 6;
}
.tl-reserved-note {
  fill: var(--nui-cold-dim);
  font-size: 9.5px;
  opacity: 0.7;
}
</style>
