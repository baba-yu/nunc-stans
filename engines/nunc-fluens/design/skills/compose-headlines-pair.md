# Skill: compose-headlines-pair

LLM sub-agent that emits `app/sourcedata/<date>/headlines.json` (5 paired plain + technical headlines). Called from `1_daily_update` Step 3.

## Sub-agent context (parent supplies)

- The just-written `app/sourcedata/<date>/news_section.json` (the headline content draws from the same news cycle).
- The schema for `headlines.json` from `design/sourcedata-layout.md §JSON schemas (canonical)`.
- The forbidden-token list (no scope prefix; ≤ 60 chars per plain bullet; ≤ 2 proper-noun tokens per plain bullet).
- A target output path: `app/sourcedata/<date>/headlines.json`.

## Required output

A JSON object matching `headlines.json` schema:

```json
{
  "date": "YYYY-MM-DD",
  "technical": [
    {
      "lead": "<short phrase, ≤ 80 chars>",
      "body": "<detailed prose, citation-rich>",
      "citations": [{"label": "...", "url": "..."}]
    }
  ],
  "plain": [
    "<≤ 60 chars; ≤ 2 proper-noun tokens; same fact as technical[i]>"
  ]
}
```

Both arrays MUST have exactly 5 entries; `plain[i]` pairs 1:1 with `technical[i]` (same fact, plain wording).

## Parent post-processing

Parent validates the JSON against `app/skills/sourcedata_schemas.py:HeadlinesFile.from_dict()`, then writes atomically. On schema failure, parent re-prompts.

Parent collects every `technical[].citations[].url` and runs `citation-restriction-check`. On RESTRICT hit, substitute and re-run.

## Reply contract

Sub-agent reply: one-line `OK <path>` or `FAIL <reason>`. Do NOT paste content back.
