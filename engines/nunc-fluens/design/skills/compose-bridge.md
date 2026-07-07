# Skill: compose-bridge

LLM sub-agent that fills **one bridge object** for one validation row in `app/sourcedata/<date>/bridges.json`. Called from `2_future_prediction` Step 2 — one sub-agent per validation row (N rows, N sub-agents in parallel).

## Sub-agent context (parent supplies)

- The single validation row's full data (`prediction_ref`, `evidence_summary`, `reference_links`).
- The full prediction body (from DB or `app/sourcedata/<prediction_date>/predictions.json`) so the sub-agent knows what's being validated.
- Today's relevant signals from `report/en/news-YYYYMMDD.md` (the same evidence the parent's `compose-validation-rows` summarized).
- The schema for the `bridge` object.
- The full forbidden-token list (`Pred ID #N`, `Coherence N/5`, `Remaining gap:`, `**Bridge (...)**` parser anchors are all forbidden in the narrative field).
- A target output path: `app/sourcedata/<date>/bridges.<row_idx>.json` (a per-row temp file).

## Required output

A single JSON object (NOT wrapped) matching the `bridge` field of `validation_rows[]`:

```json
{
  "support_dimension": "because | given | so_that | landing | none",
  "narrative": "<single-paragraph prose; ≤ 60 words; explains why today's evidence supports/refutes that dimension>",
  "coherence": 1-5,
  "remaining_gap": "<short prose; ≤ 30 words; what's missing for higher confidence>"
}
```

## Editorial guidance

- **No `Pred ID #N`** in `narrative`; the renderer references the prediction by `short_label + date`.
- **No `Coherence N/5`** in `narrative`; the renderer uses `coherence` (the integer field) to render a prose qualifier.
- **No `Remaining gap:`** in `narrative`; that's a separate field.
- **No `**Bridge (...)**`** anywhere; the renderer composes the surrounding prose.
- **No scope prefix** in any field.
- Use `support_dimension="none"` when no news today touches the prediction; the renderer still emits a paragraph for that row.

## Parent post-processing

Parent validates against `app/skills/sourcedata_schemas.py:Bridge.from_dict()`. After all N sub-agents return, parent merges per-row JSON files back into `bridges.json` (preserving row order). On schema failure for any row, re-prompt the failing sub-agent only.

## Reply contract

Sub-agent reply: one-line `OK <path>` or `FAIL <reason>`. Do NOT paste content back.
