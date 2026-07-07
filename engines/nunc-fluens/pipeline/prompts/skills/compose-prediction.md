# Skill: compose-prediction

LLM sub-agent that emits **one prediction entry** for `app/sourcedata/<date>/predictions.json`. Called from `1_daily_update` Step 2 — one sub-agent per prediction (3 predictions/day, 3 sub-agents in parallel).

## Sub-agent context (parent supplies)

- The just-written `app/sourcedata/<date>/news_section.json` (the prediction draws on the same news cycle).
- The trace of the LLM's reasoning question (which scope: `tech` / `business` / `cross`).
- The schema for one entry of `predictions.predictions[]` from `design/sourcedata-layout.md §JSON schemas (canonical)`.
- The full forbidden-token list.
- The full per-skill writer-rules from `design/scheduled/1_daily_update-writer-rules.md §compose-prediction`.
- A target output path: `app/sourcedata/<date>/needs.<pid>.json` (where `<pid>` = the sub-agent's chosen prediction id).

## Required output

A single JSON object (NOT an array, NOT wrapped) matching `predictions.predictions[]`:

```json
{
  "id": "prediction.<sha16>",
  "scope_hint": "tech | business | cross",
  "title": "<one-line title; ≤ 80 chars; lead with the predicted subject + verb; no trigger event, observer, or date as the opening phrase; no scope prefix — full rule in design/scheduled/1_daily_update-writer-rules.md §compose-prediction title-format>",
  "body": "<long-form prose; multi-sentence>",
  "reasoning": {
    "because": "<≤ 100 chars>",
    "given": "<≤ 100 chars>",
    "so_that": "<≤ 120 chars>",
    "landing": "<≤ 80 chars>",
    "plain_language": "<≤ 25 words; 14-year-old level>"
  },
  "summary": "<≤ 300 chars; 2-3 sentences typical, 4 hard cap>"
}
```

## Parent post-processing

Parent collects all 3 sub-agent outputs, wraps them in `{"date": ..., "predictions": [...]}`, validates against `app/skills/sourcedata_schemas.py:PredictionsFile.from_dict()`, and writes atomically to `app/sourcedata/<date>/predictions.json`. On schema failure for any entry, parent re-prompts the failing sub-agent only.

## Reply contract

Sub-agent reply: one-line `OK <path>` or `FAIL <reason>`. Do NOT paste content back.
