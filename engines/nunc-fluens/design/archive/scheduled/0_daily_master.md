# 0_daily_master — top-level day-orchestrator

Single entry point for "what scheduled tasks must run today, in what order, and how do I know I'm done." Wraps `1_daily_update`, `2_future_prediction`, `3_daily_briefing`, and the Sunday-only `4_weekly_memory` + `5_weekly_theme_review`.

This file exists because the prior design assumed an external cron + a human reading multiple specs. Without a single master, any LLM/agent driving the day silently misses tasks (most often the Sunday-only ones). Phase 4b's redo surfaced exactly this gap — see "Why this exists" below.

## Pre-flight

```bash
TODAY=$(date +%Y-%m-%d)
DOW=$(date +%u)  # 1=Mon ... 7=Sun
```

## Required tasks for today (day-of-week table)

| Day | Tasks (in order) |
|---|---|
| Mon-Sat | `1_daily_update` → `2_future_prediction` → `3_daily_briefing` |
| **Sun** | `1_daily_update` → `2_future_prediction` → **`4_weekly_memory`** → **`5_weekly_theme_review`** → **`6_weekly_maintenance`** → `3_daily_briefing` |

Note the Sunday ordering: `4_weekly_memory` writes the new dormant snapshot (which `2_future_prediction` will read tomorrow); `5_weekly_theme_review` writes the schema proposal (and may apply it via `apply-schema-edit`); `3_daily_briefing` rebuilds the dashboard against the post-review schema. Running 3 before 5 means rebuilding twice.

## Skills called (in order, with day-of-week gates)

1. **`daily-flow-check`** *(shared, pre-flight)* — `python3 -m app.skills.daily_flow_check --date $TODAY --report-missing`. Lists today's required artifacts and which already exist. Use this to decide whether the run is fresh, partial, or already complete. Does **not** abort — just reports.

2. **`1_daily_update`** *(every day)* — see `design/scheduled/1_daily_update.md`.

3. **`2_future_prediction`** *(every day)* — see `design/scheduled/2_future_prediction.md`.

4. **`4_weekly_memory`** *(Sunday only — `[ "$DOW" = "7" ]`)* — see `design/scheduled/4_weekly_memory.md`. Writes `memory/dormant/dormant-YYYYMMDD.md`. Skip on Mon-Sat.

5. **`5_weekly_theme_review`** *(Sunday only)* — see `design/scheduled/5_weekly_theme_review.md`. Writes `memory/theme-review/theme-review-YYYYMMDD.md` + `memory/snapshots/<YYYYMMDD>-pre-review/` + `docs/data/snapshots/<YYYYMMDD>/`. Skip on Mon-Sat.

6. **`3_daily_briefing`** *(every day, runs LAST so it picks up any schema edit from Step 5)* — see `design/scheduled/3_daily_briefing.md`. Updates `README{,.ja,.es,.fil}.md` with the 3-day window, refreshes dashboard, runs all integrity checks, commits + pushes.

7. **`daily-flow-check`** *(shared, post-flight gate)* — `python3 -m app.skills.daily_flow_check --date $TODAY --strict`. Exits **non-zero if any required artifact for today is missing**. This is the universal "are we done?" gate. Block any push / "complete" claim on this passing.

## Sub-agent dispatch policy

The orchestrator running this flow (Cowork Routine, Claude Cowork desktop, or an interactive Claude Code session) **must dispatch the LLM-heavy steps below to fresh-context sub-agents** rather than running them inline. Each sub-agent gets its own context window (200K), and the parent receives only the final output (file paths, JSON content, or a 1-line status). Without this, the master context overflows on a normal-volume day (~80–150k tokens of generated text per run between locale fan-out, validation tables, and READMEs).

| Skill (in this orchestrator) | Dispatch shape |
|---|---|
| `1_daily_update` Step 7 — `extract-needs` | One sub-agent **per fresh prediction** (typically 3/day). Each receives the prediction body + reasoning trace, returns a JSON file path. |
| `1_daily_update` Step 11 — `locale-fanout` | One sub-agent **per non-EN locale** (`ja`, `es`, `fil`). Each receives the EN canonical + the translation contract in `design/skills/locale-fanout.md`, writes the sibling file. |
| `2_future_prediction` Step 4 — `compose-bridge-narratives` | One sub-agent **per validation-table row** when there are >5 rows (otherwise inline is fine). Each writes one `**Bridge (Pred ID #N):**` paragraph. |
| `2_future_prediction` Step 11 — `locale-fanout` | Same shape as `1_daily_update` Step 11 — one sub-agent per non-EN locale. |
| `1_daily_update` Step 14.5 — `verify-topic-coverage` | 1 sub-agent. Inputs: `news_section.json` + `search_log.json` + `reference/news-topics.md` + date. Reads each bullet, applies §Topic scope clarifications rubric, emits structured per-topic verdict + alignment to `verification.json`. Reply: `OK <path>` only. |
| `3_daily_briefing` Step 2 — `update-readme-3day-window` | One sub-agent **per locale** (`en`, `ja`, `es`, `fil`). Each rolls the 3-day window forward and emits its single README; the parent never holds all four bodies in context. |

Inheritance: sub-agents inherit the orchestrator's model unless a step's writer-rules state otherwise. The default for this project is "inherit" — quality > token-cost.

Deterministic skills (`citation-restriction-check`, `post-write-integrity`, `post-update-validation`, `extract-glossary-candidates`, `run-update-pages-bat`, `bindfs-safe-commit-push`) are Python and run inline in the parent. They produce small structured output and don't consume LLM context.

### Sub-agent context shielding (per ADR-002)

The parent orchestrator does **not** pass the body of prior days' `report/en/news-*.md` files into the `compose-news-section` sub-agent prompt. The parent reads `last 7 report/en/news-*.md` (per `1_daily_update.md §Inputs / outputs`) for its own orchestration awareness, but the sub-agent receives only:

- the topic-coverage list (`reference/news-topics.md`),
- the trusted-source list,
- the full `references.txt` URL list (citation skip),
- the `news_section.json` schema,
- the forbidden-token list,
- the anti-inertia rules restated in `design/skills/compose-news-section.md`, and
- a **structured prior-storyline digest** — a short JSON list of `{storyline_label, last_seen_date, last_state_change_kind}` for each storyline active in the prior 3 days. This is how the sub-agent identifies continuations (Rule 1) and judges whether a continuation has a fresh state-change (Rule 2) without seeing prior prose.

This shielding rule was added 2026-05-26 after investigation showed that between 5/08 and 5/25 the news section locked onto a fixed 5-storyline template driven by parent-context leakage. Full diagnosis in `design/decisions/ADR-002-news-anti-inertia.md`.

## Inputs / outputs

- Reads: `$TODAY`, `$DOW`, the artifacts listed by each underlying scheduled task.
- Writes: every artifact each scheduled task writes, in dependency order.
- Pushes (final): the `3_daily_briefing` Step 9 push flushes everything (today's news, FP, dormant, theme-review, schema edits, dashboard).

## Failure modes

- **`daily-flow-check --strict` fails after all tasks have run** → an underlying task partially completed. Re-read its acceptance section, repair, re-run the check. Don't push until green.
- **Today is Sunday and `dormant-YYYYMMDD.md` is missing after step 4** → 4_weekly_memory was skipped. Re-run before 3.
- **Theme review proposal recommends schema edits but `apply-schema-edit` is in `manual` mode without a human reviewer** → the proposal commit lands but the schema is unchanged; that is the safe default. Note the deferred edits in next week's review.
- **Phase 4b-style ad-hoc runs**: when a prior run was interrupted, start by calling `daily-flow-check --date $TODAY --report-missing` to enumerate gaps before re-running anything.

## Acceptance — today is "done" when

`python3 -m app.skills.daily_flow_check --date $TODAY --strict` exits 0. The skill enumerates every required artifact for the day and the day-of-week (news/FP files in 4 locales, dormant snapshot if Sunday, theme review if Sunday, dashboard snapshot dir if Sunday, READMEs updated to a 3-day window including today, all post-write-integrity and post-update-validation checks pass, SQLite PRAGMA integrity ok, manifest 4-locale shape ok). One pass = today is done. One fail = not done.

## Why this exists

Phase 4b's first run treated the day as "execute `1_daily_update` + `2_future_prediction` only", which is the literal reading of `design/PHASE4-PLAN.md` Task 11+12. That spec did not reference the day-of-week branching or the daily-briefing chain, so an LLM/agent following the plan in isolation missed:

- the Sunday-only `4_weekly_memory` (dormant snapshot rotation)
- the Sunday-only `5_weekly_theme_review` (taxonomy review + 3-time snapshot)
- `3_daily_briefing` Step 2 (README 3-day window) for the locale READMEs
- `3_daily_briefing` Step 6 (post-write-integrity for dashboard assets + READMEs)
- `3_daily_briefing` Step 7-8 (manifest shape + SQLite PRAGMA integrity)
- the `docs/data/snapshots/<YYYYMMDD>/` snapshot dir (it lives in `5_weekly_theme_review` Step 2, not `3_daily_briefing`)

This master orchestrator is the single place to look. It sets the day-of-week table (Sunday-only tasks are explicit), names the dependency order (4 + 5 before 3 because the schema edit must precede the dashboard rebuild), and points at a single automated completion gate (`daily-flow-check`). The gate is the rule that prevents "Phase 4b complete" from being claimed before READMEs / dormant / theme-review / dashboard snapshot are all in place.

## DRY_RUN

`DRY_RUN=1` propagates to every underlying scheduled task. The completion check still runs in strict mode and reports — useful for pre-flight verification.
