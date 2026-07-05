import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as api from '../api'
import { provenanceMix } from '../provenance'
import type { Commitment, Edge, NewCommitment, WorldPrediction } from '../types'

export const useMeStore = defineStore('me', () => {
  const commitments = ref<Commitment[]>([])
  const edges = ref<Edge[]>([])
  const malformed = ref(0)
  const reachable = ref(true)
  const world = ref<WorldPrediction[]>([])

  const mix = computed(() => provenanceMix(commitments.value, edges.value))

  async function load() {
    try {
      const [cr, er] = await Promise.all([api.getCommitments(), api.getEdges()])
      commitments.value = cr.commitments
      edges.value = er.edges
      malformed.value = (cr.malformed_skipped ?? 0) + (er.malformed_skipped ?? 0)
      reachable.value = true
    } catch {
      reachable.value = false
    }
  }

  async function loadWorld() {
    world.value = await api.getWorld()
  }

  interface CommitInput {
    slug: string
    title: string
    started_at: string
    money_jpy: string
    hours: string
    note: string
  }

  // money_jpy is an integer count of yen on the server (Option<i64>); validate
  // it here so a stray decimal is a clean client-side error, not a server 422.
  function buildBody(input: CommitInput): NewCommitment | string {
    const rawMoney = input.money_jpy.trim()
    if (rawMoney && !/^\d+$/.test(rawMoney)) {
      return 'money_jpy must be a whole number of yen'
    }
    const rawHours = input.hours.trim()
    return {
      slug: input.slug,
      title: input.title,
      started_at: input.started_at,
      resources: {
        money_jpy: rawMoney ? Number(rawMoney) : null,
        hours: rawHours ? Number(rawHours) : null,
      },
      note: input.note || null,
    }
  }

  async function authorCommitment(input: CommitInput): Promise<{ ok: boolean; message: string }> {
    const body = buildBody(input)
    if (typeof body === 'string') return { ok: false, message: body }
    const res = await api.createCommitment(body)
    if (!res.ok) return { ok: false, message: `refused: ${res.error}` }
    await load()
    return {
      ok: true,
      message: `authored ${res.id}` + (res.vault_committed ? ' (vault committed)' : ' (vault commit FAILED)'),
    }
  }

  // §10-C-3: "create a commitment from this headline" — the user authors the
  // commitment (F3), and an informed_by edge is auto-attached to the News
  // prediction. The edge is user-authored (author=ai edges are gated to
  // Phase 4) and stores only a reference to the world node — the id plus the
  // required to_label — never a copy of the headline body (F5/F6). This edge,
  // targeting world/*, is what moves the F9 provenance mix.
  async function commitFromHeadline(
    input: CommitInput,
    headline: WorldPrediction,
  ): Promise<{ ok: boolean; message: string }> {
    const body = buildBody(input)
    if (typeof body === 'string') return { ok: false, message: body }
    const res = await api.createCommitment(body)
    if (!res.ok) return { ok: false, message: `refused: ${res.error}` }

    // The engine requires a non-empty to_label; guard here too so a blank
    // headline label can never silently drop the provenance edge.
    const toLabel = headline.label?.trim() || headline.id
    const edge = await api.appendEdge({
      type: 'informed_by',
      from: res.id!, // self/commitment/<slug>, returned by the engine
      to: `world/prediction/${headline.id}`,
      to_label: toLabel,
      author: 'user',
      note: 'created from News headline',
    })
    await load()
    if (!edge.ok) {
      // The commitment is written (append-only, cannot be rolled back) but the
      // provenance link failed, so the F9 mix did NOT move. Report this as a
      // failure — the "commit from headline" intent is commitment + link.
      return {
        ok: false,
        message: `commitment ${res.id} was written, but its informed_by → News link failed (${edge.error}); provenance was NOT updated`,
      }
    }
    return { ok: true, message: `authored ${res.id} + informed_by → News (provenance updated)` }
  }

  return {
    commitments,
    edges,
    malformed,
    reachable,
    world,
    mix,
    load,
    loadWorld,
    authorCommitment,
    commitFromHeadline,
  }
})
