# Skill: compose-prediction-backfill

LLM sub-agent that regenerates **one prediction's `reasoning` + `summary` + `plain_language`** for `app/sourcedata/<date>/predictions.json`. Called from `super-backfill` per prediction (3 predictions/day → 3 sub-agents in parallel).

Differs from `compose-prediction` in one way: input is the *existing markdown body + title* of the prediction (not a fresh news synthesis). The sub-agent regenerates the reasoning trace and summary *consistent with the existing body*, not from scratch.

## Sub-agent context (parent supplies)

- The full prediction `title` + `body` from the legacy markdown (`report/en/news-YYYYMMDD.md` `## Future` section).
- The `prediction_date` (the news date — drives the `landing` field's anchoring).
- `scope_hint` (tech / business / cross) — inferred from the body or pre-existing JSON when available.
- The schema for one entry of `predictions.predictions[]` from `design/sourcedata-layout.md §JSON schemas (canonical)`.
- The full forbidden-token list (same as `compose-prediction`).
- The full per-skill writer-rules from `design/scheduled/1_daily_update-writer-rules.md §compose-prediction`.
- A target output path: `app/sourcedata/<date>/predictions.<pid>.json`.

## Required output

A single JSON object (NOT an array, NOT wrapped) matching `predictions.predictions[]`:

```json
{
  "id": "prediction.<sha16>",
  "scope_hint": "tech | business | cross",
  "title": "<copied from input — do not rewrite>",
  "body": "<copied from input — do not rewrite>",
  "reasoning": {
    "because":         "<≤ 100 chars; derived from body>",
    "given":           "<≤ 100 chars; derived from body>",
    "so_that":         "<≤ 120 chars; derived from body>",
    "landing":         "<≤ 80 chars; date-anchored when body says so>",
    "plain_language":  "<≤ 25 words; 14-year-old level>"
  },
  "summary": "<≤ 300 chars; 2-3 sentences typical, 4 hard cap>"
}
```

## Editorial guidance

- Treat the existing body as the canonical claim. The reasoning fields explain *why this body's prediction follows from its premises*.
- `landing` should reflect the body's claimed time anchor; if the body says "by Q4 2026" then landing carries that anchor.
- `plain_language` is the 14-year-old paraphrase of the body, not of the reasoning. The legacy body sometimes has a tail "In plain language: …" sentence — you may take that as a starting point but rewrite to the ≤ 25 word constraint and strip duplicates (legacy markdown sometimes has "In plain language: In plain language: In plain language:" at the end — that's a known bug, ignore the duplicates).
- Reuse spec from compose-prediction: no scope prefix, no forbidden tokens, no parser anchors.
- `id` derivation: SHA-1 of `(prediction_date + body)` first 16 hex chars, prefixed with `prediction.`. The Python wrapper can supply this if asked; if you generate it, use the same recipe.

## Parent post-processing

Parent collects all 3 sub-agent outputs, wraps them in `{"date": ..., "predictions": [...]}`, validates against `app/skills/sourcedata_schemas.py:PredictionsFile.from_dict()`, and writes atomically to `app/sourcedata/<date>/predictions.json` via `python -m app.skills.super_backfill apply --stream predictions --json-file <merged>`. On schema failure for any entry, parent re-prompts the failing sub-agent only.

## Reply contract

Sub-agent reply: one-line `OK <path>` or `FAIL <reason>`. Do NOT paste content back.
