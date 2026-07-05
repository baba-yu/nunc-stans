```

The result is the **review queue**: per-prediction, with at least one stream-relevant change since last week. Glossary candidates are computed separately (TTL: terms with no `glossary_audit` row in the last 14 days).

Health check assertion: `prediction_date < today - 90 days AND not dormant` should return zero rows. If it doesn't, dormant detection has a leak — escalate, but continue the maintenance run.

Per-prediction weekly cap: ≤ 30 predictions. Glossary cap: ≤ 20 terms. If exceeded, rank by `confidence_drift_score` (count of distinct change-signals × magnitude) and trim; remainder spills into `memory/maintenance/queue.md` for next Sunday.

### Step 1 — Judge

**One sub-agent per candidate prediction** — that sub-agent looks at all 4 streams (Reasoning, Bridge, Needs, Readings) for that prediction together and returns judgements per stream in a single JSON. Glossary candidates use a separate parallel sub-agent batch (since glossary entries are not prediction-keyed).

LLM sub-agent receives:
- The candidate prediction's full state (`predictions.json` row + Needs + Bridges + Readings).
- **The last 7 days of changes that triggered the gate** — explicit list of: new bridges, new contradict signals, related prediction landings, new chain/relation edges.
- The last 7 days of news headlines + change-log (from sourcedata) for context.
- A judging prompt asking: "Given this week's developments, which of {reasoning, bridge, needs, readings} need updating? Use cross-stream evidence freely."

#### Cross-stream correlation (explicit guidance)

The Judge MUST consider how a change in one stream may invalidate another stream of the SAME prediction. Examples to include in the prompt:

- **Bridge → Reasoning**: A new bridge with `support_direction='contradict'` undermines the prediction's `reasoning.because` precondition. The bridge entry itself stays as historical record; what changes is whether `reasoning.because` should be reframed (e.g., "the cited Apr 29 event no longer holds — the May 2 follow-up retracted it"). The Judge should flag `reasoning` for update, not just `bridge`.
- **Needs → Reasoning**: A Need's actor delivered (`task.status` flipped to `done` because a Bridge documents the deliverable shipped). That part of `reasoning.because/given` is now historical fact. Reasoning may need to be reframed forward — what's the NEXT precondition, given the prior one is satisfied?
- **Readings → Reasoning**: An upstream prediction in `prediction_chain.source_prediction_id` just landed. The downstream prediction's `reasoning.landing` window may shorten because the upstream's landing was the precondition. Conversely, if the upstream got CONTRADICTED, the downstream's reasoning chain weakens.
- **Bridge → Needs**: A bridge cited an actor delivering on a Need's `task.what`. The Need's `task.status` should flip to `done` and the actor coalition for the NEXT phase may need refresh.
- **Readings → Bridge**: A new `prediction_relations.relation_type='equivalent'` entry says the current prediction is equivalent to another. Bridges from the equivalent prediction may now be transferable evidence for this one — surface them.
- **Needs → Readings**: A Need being achieved opens up a new chain edge candidate (the achieved prediction enables a downstream prediction). Readings should add the edge.

The Judge is encouraged to write reasons that name the cross-stream correlation explicitly:

```json
{
  "verdict": "stale",
  "stream": "reasoning",
  "reason": "Bridge added 2026-05-08 (support='contradict') invalidates the `because` precondition that cited the Apr 29 NSA Mythos benchmarking; reframe to acknowledge the May 6 retraction",
  "cross_stream_evidence": ["bridge:vr_id_xxx"],
  "proposed_action": "rewrite",
  "confidence": 0.9
}
```

Output: `app/sourcedata/<date>/maintenance-judgements.json`:

```json
{
  "date": "2026-05-10",
  "judgements": [
    {
      "prediction_id": "prediction.adb89416691d7587",
      "stream": "reasoning|bridge|needs|readings|glossary",
      "entry_id": "...",
      "verdict": "fresh|stale|broken|retire",
      "reason": "...",
      "cross_stream_evidence": ["..."],
      "proposed_action": "rewrite|retire|noop",
      "confidence": 0.85
    }
  ]
}
```

One prediction may produce multiple judgements (e.g., reasoning=stale, needs=fresh, bridge=fresh, readings=stale).

`fresh` = no action. `stale` = re-write. `broken` = data inconsistency, escalate to human. `retire` = mark as retired.

#### Sub-agent emission shape (writer rule — non-negotiable)

`MaintenanceJudgement.from_dict` requires **`prediction_id` AND `entry_id` ON EVERY ENTRY** in the inner `judgements[]` list — wrapper-level keys do NOT propagate. The merge step (`weekly_maintenance merge-judgements`) calls `from_dict` per record and rejects the file with `judgement #N invalid: missing required key 'prediction_id'` if either field is missing on any entry. Observed regression on the 2026-05-05 first live run: sub-agents emitted the wrapper shape `{"prediction_id": "...", "judgements": [{"stream": "...", "verdict": "...", ...}]}` and the orchestrator had to inline-patch all 30 files before the merge would accept them.

The orchestrator MUST tell each sub-agent to emit either:

```json
// Form A — full self-contained per-judgement (preferred)
{
  "prediction_id": "prediction.<sha>",
  "judgements": [
    {
      "prediction_id": "prediction.<sha>",   // required ON the entry, not just wrapper
      "stream": "reasoning|bridge|needs|readings|glossary",
      "entry_id": "<see table below>",       // required ON the entry
      "verdict": "fresh|stale|broken|retire",
      "reason": "...",
      "cross_stream_evidence": ["..."],
      "proposed_action": "rewrite|retire|noop",
      "confidence": 0.0-1.0
    }
  ]
}
```

`entry_id` per stream (use these defaults unless a finer-grained id is meaningful):

| Stream | `entry_id` default |
|---|---|
| `reasoning` | `prediction_id` (only one reasoning bundle per prediction) |
| `readings` | `prediction_id` (chain edges keyed back to prediction) |
| `bridge` | the `validation_rows.id` of the specific bridge being judged, OR `prediction_id` if the verdict applies to all of the prediction's bridges |
| `needs` | the specific Need's `actor` field, OR `prediction_id` if the verdict applies to the whole Need-set |
| `glossary` | the glossary `term` string |

The merge dedupes by the tuple `(prediction_id, stream, entry_id)`, so distinct entries under the same prediction+stream MUST carry distinct `entry_id` values.

Sub-agent dispatch: **one sub-agent per candidate prediction** (parallel, capped at 6 concurrent). Plus 1-2 batched sub-agents for glossary (≤ 20 terms each). Each sub returns its partial `maintenance-judgements.json` fragment; parent merges deterministically.

### Step 2 — Update

For each `verdict ∈ {stale, broken-with-clear-fix, retire}` from Step 1, dispatch a sub-agent to apply the change:

- `stale`: re-write skill — produces a new JSON delta. Schema-validated. Atomic write to sourcedata.
- `retire`: deterministic — set `status='retired'` + `reviewed_by_human=1` in DB.
- `broken`: log to `memory/maintenance/<date>/broken.md` for human review; do NOT auto-fix.

After all updates, run `cli ingest-sourcedata` to fold changes into the DB, then `cli score + cli export` to refresh derived columns and the dashboard JSON.

### Step 3 — Validate

Deterministic gate after updates:

- `python -m app.skills.post_update_validation --check all --date <today>` exits 0
- `python -m app.skills.lint_markdown_clean --date <today>` exits 0
- `python -m app.skills.daily_flow_check --date <today> --strict` exits 0
- New: `python -m app.skills.maintenance_validate --week-ending <today>` — checks that all judgements from Step 1 were either applied or escalated; verifies no entry-id orphaned; verifies updated entries pass schema.

If any gate fails, the maintenance run aborts and `bindfs-safe-commit-push` does not run. The week's daily-briefing still ships, but on a degraded DB state. Operator review required before next Sunday.

## Sub-agent dispatch shape

| Step | Sub-agents | Notes |
|---|---|---|
| 0 (select) | inline (SQL, deterministic) | No sub-agents |
| 1 (judge) | **One sub-agent per candidate prediction** (parallel, ≤ 6 concurrent); judges all 4 streams together with cross-stream awareness. Plus 1-2 batched sub-agents for glossary terms (≤ 20 each). | Each sub returns its `maintenance-judgements.json` fragment; parent merges deterministically |
| 2 (update) | One sub-agent **per stale judgement** (per `(prediction, stream)` pair, parallel, ≤ 6 concurrent) | Each sub writes the JSON delta for that one stream + locale fanout |
| 3 (validate) | inline (deterministic) | No sub-agents |

Per `0_daily_master.md §Sub-agent dispatch policy`. Every sub-agent prompt includes "reply with one-line OK status, do NOT paste content back".

## Inputs / outputs

- Reads: full `app/sourcedata/`, `app/data/analytics.sqlite`, last 7 days `report/en/news-*.md` + `future-prediction/en/future-prediction-*.md` (for context).
- Writes: `app/sourcedata/<today>/maintenance-judgements.json`, updated entries in `app/sourcedata/<various>/*.json`, DB rows, `memory/maintenance/<today>/{broken,summary}.md`.

## Failure modes

- **Step 0 health check fires** (predictions older than 90 days that aren't dormant) → log to `memory/maintenance/<today>/health.md`, continue. The leak is a dormant-detection bug, separate ticket.
- **Step 1 LLM judges everything as `stale`** (over-eager) → already capped at Step 0 (≤ 30 predictions); the per-prediction Judge can still mark all 4 streams `stale` for one prediction. If a single prediction comes back with 4 `stale` verdicts and `confidence < 0.7` on all of them, downgrade to `broken` and escalate (likely a Judge prompt regression).
- **Step 2 sub-agent writes JSON that fails schema** → revert that single (prediction, stream) pair's JSON, log to `memory/maintenance/<today>/broken.md`, continue.
- **Step 3 strict daily-flow-check fails** → the maintenance run did not converge. Restore the pre-maintenance DB backup (`app/data/analytics.sqlite.pre-maintenance-<date>`), surface logs.
- **Same prediction is in `memory/maintenance/queue.md` for 4 consecutive weeks** without being judged → Step 0 priority ranking is starving it. Force-promote next week regardless of cap, or escalate as design issue.
