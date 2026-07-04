import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as api from '../api'
import { provenanceMix } from '../provenance'
import type { Commitment, Edge, NewCommitment } from '../types'

export const useMeStore = defineStore('me', () => {
  const commitments = ref<Commitment[]>([])
  const edges = ref<Edge[]>([])
  const malformed = ref(0)
  const reachable = ref(true)

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

  // money_jpy is an integer count of yen on the server (Option<i64>); validate
  // it here so a stray decimal is a clean client-side error, not a server 422.
  async function authorCommitment(input: {
    slug: string
    title: string
    started_at: string
    money_jpy: string
    hours: string
    note: string
  }): Promise<{ ok: boolean; message: string }> {
    const rawMoney = input.money_jpy.trim()
    if (rawMoney && !/^\d+$/.test(rawMoney)) {
      return { ok: false, message: 'money_jpy must be a whole number of yen' }
    }
    const rawHours = input.hours.trim()
    const body: NewCommitment = {
      slug: input.slug,
      title: input.title,
      started_at: input.started_at,
      resources: {
        money_jpy: rawMoney ? Number(rawMoney) : null,
        hours: rawHours ? Number(rawHours) : null,
      },
      note: input.note || null,
    }
    const res = await api.createCommitment(body)
    if (!res.ok) return { ok: false, message: `refused: ${res.error}` }
    await load()
    return {
      ok: true,
      message: `authored ${res.id}` + (res.vault_committed ? ' (vault committed)' : ' (vault commit FAILED)'),
    }
  }

  return { commitments, edges, malformed, reachable, mix, load, authorCommitment }
})
