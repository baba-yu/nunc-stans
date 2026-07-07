# Skill: compose-change-log

LLM sub-agent that emits `app/sourcedata/<date>/change_log.json` (diff against the previous day). Called from `1_daily_update` Step 4.

## Sub-agent context (parent supplies)

- The just-written `app/sourcedata/<date>/news_section.json` (today's content).
- The previous day's `data/daily-news/en/news-<prev-date>.md` (or, post-Phase-4, `app/sourcedata/<prev-date>/news_section.json`) for diffing.
- The schema for `change_log.json`.
- The forbidden-token list.
- A target output path: `app/sourcedata/<date>/change_log.json`.

## Required output

A JSON object matching `change_log.json` schema:

```json
{
  "date": "YYYY-MM-DD",
  "vs_date": "YYYY-MM-DD",  // previous day
  "items": [
    {
      "kind": "new | updated | continuing",
      "headline": "<short reference to the news item>",
      "diff_narrative": "<prose explaining how today differs from prior day>"
    }
  ]
}
```

## Editorial guidance

- Standout shifts only. Do not omit duplicate articles — flag them as `kind="continuing"` if structurally important; otherwise drop.
- One-paragraph diff narrative per item.
- Reference items by their lead phrase, not by hashed ID.

## Parent post-processing

Parent validates against `app/skills/sourcedata_schemas.py:ChangeLogFile.from_dict()`, writes atomically. On schema failure, re-prompt.

## Reply contract

Sub-agent reply: one-line `OK <path>` or `FAIL <reason>`. Do NOT paste content back.
