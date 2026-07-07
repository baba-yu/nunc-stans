# Skill: compose-news-section

LLM sub-agent that emits `data/sourcedata/<date>/news_section.json` from the day's research. Called from `1_daily_update` Step 1.

## Sub-agent context (parent supplies)

- The day's news topics from `data/reference/news-topics.md`.
- The trusted-source list (`arxiv.org`, `simonwillison.net`, `news.ycombinator.com`, plus topic-specific sources).
- The full citation-ledger URL list (`data/history/reference-history.log`; sub-agent must SKIP URLs already cited).
- The schema for `news_section.json` from the canonical sourcedata schemas (`pipeline/src/schemas/sourcedata.ts`).
- The forbidden-token list from `lint-markdown-clean` (`pipeline/src/render/lint-markdown-clean.ts`) — no scope prefix in any field; no lifecycle metadata per the anti-inertia rules below.
- A target output path: `data/sourcedata/<date>/news_section.json`.
- A **structured prior-storyline summary** (per ADR-002 Rule 4): a short JSON list of `{storyline_label, last_seen_date, last_state_change_kind}` covering storylines active in the prior 3 days. The parent does **not** pass the prior days' news prose bodies — only this structured digest — to keep the sub-agent from latching onto prior phrasing.

## Required output

A JSON object matching `news_section.json` schema:

```json
{
  "date": "YYYY-MM-DD",
  "sections": [
    {
      "category": "<H3 sub-header text>",
      "bullets": [
        {
          "body": "<prose with embedded citations>",
          "citations": [{"label": "...", "url": "..."}]
        }
      ]
    }
  ]
}
```

## Per-section coverage requirement

Sections must collectively cover the topic list in `data/reference/news-topics.md`. Specifically:

- **Unsloth must be searched every run** (not just when news-driven).
- **Multica only when news-driven** (it is not a constant-coverage topic).

## Anti-inertia rules (per ADR-002)

These rules exist because between 2026-05-08 and 2026-05-25 the news section drifted from concrete-event-driven prose into a fixed 5-storyline template extended by lifecycle metadata (`day-N`, `triply-aged`, `Nth consecutive non-trading day`). The drift is corrected at three layers; this file carries the writer-facing instruction.

1. **Continuation cap.** At most 2 of the 5 bullets may extend a storyline that already appeared in `data/daily-news/en/news-*.md` for any of the prior 3 calendar days. The remaining 3+ bullets must come from `data/reference/news-topics.md` topics not covered in any of the prior 3 days, or be net-new events on a covered topic. Use the parent-supplied prior-storyline digest to identify what counts as a continuation.

2. **State-change requirement on continuations.** Each continuation bullet must center on a fresh state-change event observed on this date. Qualifying state changes: new named entrant joins a cohort; numeric threshold crossed in either direction; new actor takes a public position; new artifact ships (arxiv ID, release tag, M&A, IPO); scheduled event reaches its catalyst date. A bullet whose only content is "hold steady" / "unchanged" / "settled into Nth consecutive day" must be **dropped** from the JSON — under-filling (3 or 4 bullets) is preferred to filler.

3. **No lifecycle metadata in any field.** Forbidden in `category`, `body`, and `citations[].label`: `day-N` storyline numbering, `weekend-aged` / `doubly-aged` / `triply-aged` / `N-day-old artifact` / `holiday-equivalent day` aging vocabulary, and `Nth consecutive {day,session,non-trading day,weekend day,holiday-equivalent day}` framings used as the bullet's main anchor. The full token list lives in `lint-markdown-clean` (`pipeline/src/render/lint-markdown-clean.ts`), which enforces it post-render. The parent schema-validates JSON pre-render and re-prompts the sub-agent on a hit.

4. **Bullet count is a soft 5, not a hard 5.** If applying Rules 1–2 leaves only 3 or 4 qualifying bullets, ship the shorter section. Empty `bullets[]` is still a schema error — a section must have ≥ 1 bullet — but a 3-bullet `news_section.json` is acceptable.

5. **Events-topic carry-forward exception (Rules 1 + 2 waived for `Bay Area / SV AI meet-up events` ONLY).** The events bullet is allowed and expected to repeat still-upcoming events from yesterday's events bullet, even when there is no fresh state-change today. The user wants a stable, accumulating reference of upcoming events to plan attendance against. Process:
   1. Read yesterday's events bullet from `data/sourcedata/<yesterday>/news_section.json` (find the section matching the `Bay Area / SV AI meet-up events` topic).
   2. For each event mentioned, parse its date(s). If today's date ≥ the event's end date (or for single-day events, today > event date), DROP that event from the carry-forward set.
   3. Carry forward every remaining still-upcoming event verbatim or with minor consolidation (e.g. merge two AI Tinkerers SF dates into one bullet phrase).
   4. ADD any newly-discovered upcoming events found in today's research on top.
   5. Past events from yesterday's bullet may still appear as **citation context** in today's bullet (e.g. "following last week's ACM CAIS 2026"), but must NOT be the bullet's center.
   6. This rule applies to the events topic ONLY. All other topics (Stock prices, AI Security, Hardware, etc.) remain bound by Rules 1 + 2.
   The auditor (`verify-topic-coverage`) recognizes this exception and will mark a carry-forward as `consistent`, not as `search_log_overreports`. If yesterday had no events bullet (e.g. truly no upcoming events surfaced yet), the events topic for today follows the normal forward-search-only path.

## Parent post-processing

Parent validates the JSON against `app/skills/sourcedata_schemas.py:NewsSectionFile.from_dict()`, then writes atomically. On schema failure, parent re-prompts the sub-agent with the explicit error message.

Parent collects the union of every `bullets[].citations[].url` and runs `citation-restriction-check` on it. On RESTRICT hit, parent substitutes the URL in the JSON and re-runs.

## Reply contract

Sub-agent reply: a one-line `OK <path>` or `FAIL <reason>`. Do NOT paste the JSON content back to the parent — the parent reads it from the file.
