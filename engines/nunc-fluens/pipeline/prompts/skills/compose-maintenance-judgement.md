# Skill: compose-maintenance-judgement

LLM sub-agent that judges the freshness of one candidate prediction's
four streams (Reasoning, Bridge, Needs, Readings) for the weekly
maintenance pass. Called from `6_weekly_maintenance` Step 1 — one
sub-agent per candidate prediction (≤ 30 in parallel, capped at 6
concurrent). A separate batched variant judges 1-20 glossary terms per
sub-agent.

## Sub-agent context (parent supplies)

- The candidate prediction's full state: `predictions` row + attached
  `prediction_needs` + `validation_rows` (bridges) + outgoing
  `prediction_chain` + `prediction_relations` rows.
- The change-signal evidence that triggered the gate: explicit list of
  new bridges (last 7 days), new contradict links, related-prediction
  landings, new chain/relation edges, week-over-week relevance drift.
- Last 7 days of `data/daily-news/en/news-*.md` headlines and
  `change_log.json` items for cross-prediction context.
- Cross-stream correlation guidance (copy verbatim from
  `design/scheduled/6_weekly_maintenance.md §Cross-stream correlation`):
  Bridge→Reasoning, Needs→Reasoning, Readings→Reasoning,
  Bridge→Needs, Readings→Bridge, Needs→Readings.
- Target output path:
  `app/sourcedata/<week_ending>/maintenance-judgements.<prediction_id>.json`.

## Required output

A single JSON object matching `MaintenanceJudgementsFile` (per-pred shape):

```json
{
  "prediction_id": "prediction.adb89416691d7587",
  "judgements": [
    {
      "prediction_id": "prediction.adb89416691d7587",
      "stream": "reasoning|bridge|needs|readings",
      "entry_id": "prediction.adb89416691d7587 | need.xxx | vr_yyy | chain.zzz",
      "verdict": "fresh|stale|broken|retire",
      "reason": "Bridge added 2026-05-08 (support='contradict') invalidates the `because` precondition that cited the Apr 29 NSA Mythos benchmarking; reframe to acknowledge the May 6 retraction.",
      "cross_stream_evidence": ["bridge:vr_id_xxx"],
      "proposed_action": "rewrite|retire|noop",
      "confidence": 0.85
    }
  ]
}
```

One prediction may produce up to 4 judgements (one per stream). Glossary
batches emit `stream="glossary"` rows where `prediction_id=""` and
`entry_id=<term>`.

## Editorial guidance

- `verdict="fresh"` → action is `noop` and `reason` may be brief.
- `verdict="stale"` → `proposed_action` MUST be `rewrite`; `reason` MUST
  cite the cross-stream evidence by id.
- `verdict="broken"` → reserved for unrecoverable inconsistencies; the
  parent escalates to `data/memory/maintenance/<date>/broken.md` rather than
  re-prompting.
- `verdict="retire"` → `proposed_action="retire"`; only the parent's
  Step 2 deterministically applies the DB flip.
- `confidence` ∈ [0, 1]. If a single prediction returns 4 `stale`
  verdicts all with `confidence < 0.7`, the parent downgrades the bundle
  to `broken` (over-eager Judge guard).
- Never write to `app/sourcedata/` or the DB directly; only the JSON
  payload at the supplied path.

## Parent post-processing

Parent validates against
`app/skills/sourcedata_schemas.py:MaintenanceJudgementsFile.from_dict()`.
After all N per-pred and 1-2 glossary subs return, parent calls
`weekly_maintenance.merge_judgements_files(<date_dir>)` to produce the
canonical `maintenance-judgements.json`.

## Reply contract

Sub-agent reply: one-line `OK <path>` or `FAIL <reason>`. Do NOT paste
JSON content back.
