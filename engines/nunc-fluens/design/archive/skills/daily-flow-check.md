# Skill: daily-flow-check

Universal "is today's scheduled flow done?" gate. Wraps the day-of-week branching from `0_daily_master.md` into a single CLI that enumerates every required artifact for the date, checks each one, and exits 0 (all green) or 1 (anything missing).

## Why this is its own skill

Two reasons. First, the prior architecture had no completion gate. Each scheduled task had its own acceptance section; nothing aggregated them. Phase 4b's first run silently shipped without `4_weekly_memory`, `5_weekly_theme_review`, the README 3-day window, the dashboard snapshot dir, the manifest shape check, and the SQLite PRAGMA — every one of those is a separate spec that an agent driving the day in isolation could miss.

Second, this is the operative rule for "are we ready to push?" Make the gate machine-checkable, run it twice (pre-flight + post-flight), and "Phase 4b complete" becomes either provable or provably wrong.

## Inputs

| Name | Source | Required |
|---|---|---|
| `--date` | ISO date (default: today) | no |
| `--repo-root` | repo root containing `app/`, `docs/`, `memory/`, `report/`, `future-prediction/` | no |
| `--strict` (default) | exit non-zero on any missing artifact | no |
| `--report-missing` | always exit 0 — use as pre-flight survey | no |

## Outputs

Stdout: one line per check group (`OK <group>` or `FAIL <group>: N issue(s)` followed by `  - <error>` per issue). Final line: `ALL GREEN — today is done` or `NOT DONE — see FAIL lines above`.

Exit 0 on full pass (or under `--report-missing`); 1 on any failure under `--strict`.

## What it checks (5 buckets)

### 1. News + future-prediction markdown files

For both `news-YYYYMMDD.md` and `future-prediction-YYYYMMDD.md`, in all 4 locales (`en`, `ja`, `es`, `fil`): exists, non-empty.

### 2. DB population via `post_update_validation`

Delegates to `python3 -m app.skills.post_update_validation --check all --date <date>`. That skill itself enumerates every locale column on `predictions`, `validation_rows`, `prediction_needs`, `needs_tasks`, plus the `*_locales` bags on the JSON exports. A failure here means an underlying `1_daily_update` / `2_future_prediction` / `3_daily_briefing` step left a column NULL.

### 3. Sunday-only artifacts (skipped Mon-Sat)

If `--date` is a Sunday:

- `memory/dormant/dormant-YYYYMMDD.md` exists (4_weekly_memory Step 5)
- `memory/theme-review/theme-review-YYYYMMDD.md` exists (5_weekly_theme_review Step 5)
- `memory/snapshots/<YYYYMMDD>-pre-review/` exists with `schema.sql` + 3 graph JSONs + manifest (5_weekly_theme_review Step 2 rollback target)
- `docs/data/snapshots/<YYYYMMDD>/` exists with 3 graph JSONs + manifest (5_weekly_theme_review Step 2 reader-facing snapshot)
- `docs/data/snapshots/index.json` lists `<YYYYMMDD>` in its `snapshots` array (so the dashboard SNAP dropdown surfaces today's snapshot)

### 4. READMEs (3-day window)

For each of `README.md` / `README.ja.md` / `README.es.md` / `README.fil.md`:

- Today's `## YYYY-MM-DD` header is present.
- Exactly 3 `## YYYY-MM-DD` headers exist, matching `[today, today-1d, today-2d]`.
- Today's block contains the locale-specific links: `[news-YYYYMMDD.md](report/<L>/news-YYYYMMDD.md)` and `[future-prediction-YYYYMMDD.md](future-prediction/<L>/future-prediction-YYYYMMDD.md)`.

### 5. Dashboard hygiene

- `docs/data/manifest.json` has 4 locales and `default_locale="en"`.
- `docs/index.html` ends with `</html>`, `docs/assets/app.js` ends with `})();`, `docs/assets/styles.css` ends with `}` (the `post-write-integrity --kind dashboard-asset` rule, but inline so the gate doesn't shell out).
- `app/data/analytics.sqlite` `PRAGMA integrity_check` returns `ok`.

## Reference invocation

```bash
# Pre-flight survey (does not abort):
python3 -m app.skills.daily_flow_check --date 2026-05-03 --report-missing

# Post-flight strict gate (blocks push on failure):
python3 -m app.skills.daily_flow_check --date 2026-05-03 --strict
```

Inside `0_daily_master.md`, the gate runs **twice**: Step 1 (`--report-missing`) to enumerate gaps before re-running anything, and Step 7 (`--strict`) as the final gate before the dashboard push.

## Failure modes — what each FAIL line means + how to fix

| FAIL line pattern | Likely cause | Fix |
|---|---|---|
| `news+FP markdown files: missing report/<L>/news-…md` | locale-fanout did not write that locale | re-run `1_daily_update` Step 11 for that locale |
| `news+FP markdown files: missing future-prediction/<L>/…` | locale-fanout did not write FP locale | re-run `2_future_prediction` Step 11 |
| `DB population via post_update_validation: FAIL …` | a locale column or 5W1H cell or target_*_date is NULL | see the `post-update-validation` failure-mode table in its own spec |
| `Sunday artifacts: missing memory/dormant/dormant-…md` | `4_weekly_memory` was skipped | run it (Sunday only) |
| `Sunday artifacts: missing memory/theme-review/theme-review-…md` | `5_weekly_theme_review` was skipped | run it (Sunday only) |
| `Sunday artifacts: missing memory/snapshots/<YYYYMMDD>-pre-review/…` | `5_weekly_theme_review` Step 2 did not snapshot the rollback target | re-run Step 2 |
| `Sunday artifacts: missing docs/data/snapshots/<YYYYMMDD>/…` | `5_weekly_theme_review` Step 2 did not snapshot the dashboard | re-run Step 2 |
| `Sunday artifacts: index.json does not list <YYYYMMDD>` | snapshot dir written but index.json not updated | append the date to `index.json` `snapshots` array |
| `READMEs: missing ## YYYY-MM-DD header` | `3_daily_briefing` Step 2 did not add today | re-run Step 2 (locale-specific) |
| `READMEs: window is […], expected […]` | wrong number of day-blocks in README — likely 4-day or 2-day | drop the oldest extra block or add the missing one |
| `READMEs: missing today's link [news-…md](report/<L>/…)` | locale-link routing rule violated | edit the today-block to point at the locale's own news file |
| `dashboard hygiene: docs/data/manifest.json …` | manifest broken — most likely export.py wrote partial output | re-run `python3 -m app.src.cli export` |
| `dashboard hygiene: docs/index.html: tail does not match` | dashboard asset truncated | re-build via `update_pages` skill |
| `dashboard hygiene: sqlite PRAGMA integrity_check: …` | DB corruption | rebuild from a recent snapshot or re-ingest |

## DRY_RUN behaviour

Read-only against the filesystem + DB; `DRY_RUN=1` has no effect. The only side effect is stdout.

## Implementation

`app/skills/daily_flow_check.py`. The 5 bucket functions (`_check_files`, `_check_db_population`, `_check_sunday_artifacts`, `_check_readmes`, `_check_dashboard_hygiene`) encode the contract from `0_daily_master.md` row-by-row. When a new scheduled task is added, append a check function and call it from `main()`.
