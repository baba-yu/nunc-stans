# Skill: compose-validation-rows

LLM sub-agent that emits the placeholder `app/sourcedata/<date>/bridges.json` (validation rows + evidence summaries; bridge narratives left blank for `compose-bridge` to fill). Called from `2_future_prediction` Step 1.

## Sub-agent context (parent supplies)

- Last 7 days of `data/daily-news/en/news-*.md` (the source predictions).
- The latest `data/memory/dormant/dormant-*.md` (dormant longshot pool).
- Today's `data/daily-news/en/news-YYYYMMDD.md` (the evidence side; ONLY URLs from this file may be used).
- The schema for `bridges.json` from `design/sourcedata-layout.md §JSON schemas (canonical)`.
- The 2-layer dormant longshot detection rules from `design/scheduled/2_future_prediction-writer-rules.md §Dormant pool re-check`.
- A target output path: `app/sourcedata/<date>/bridges.json`.

## Required output

A JSON object matching `bridges.json` schema:

```json
{
  "date": "YYYY-MM-DD",
  "validation_rows": [
    {
      "prediction_ref": {
        "id": "prediction.<sha16>",
        "short_label": "<EN canonical short text — DO NOT translate>",
        "prediction_date": "YYYY-MM-DD"
      },
      "today_relevance": 1-5,
      "evidence_summary": "<multi-line prose synthesizing today's signals; reference by lead phrase, not Pred ID>",
      "reference_links": [{"label": "...", "url": "..."}],
      "bridge": {
        "support_dimension": "none",
        "narrative": "",
        "coherence": 0,
        "remaining_gap": ""
      }
    }
  ]
}
```

The `bridge` object is intentionally a placeholder; `compose-bridge` (next step) fills it.

## Editorial guidance

- One row per standing prediction matched by today's news (Layer 1 keyword + Layer 2 semantic).
- `[REVIVED]` prefix on `evidence_summary` for dormant-pool revivals.
- Every `reference_links[].url` MUST already appear in today's `data/daily-news/en/news-YYYYMMDD.md`. No external research.
- `prediction_ref.short_label` is the EN identity key; never translate, never modify.

## Parent post-processing

Parent validates against `app/skills/sourcedata_schemas.py:BridgesFile.from_dict()` (which accepts the placeholder `bridge` because every field is present, just initialized). Writes atomically. On schema failure, re-prompt.

Parent then dispatches one `compose-bridge` sub-agent per row (Step 2 of the orchestrator).

## Reply contract

Sub-agent reply: one-line `OK <path>` or `FAIL <reason>`. Do NOT paste content back.
