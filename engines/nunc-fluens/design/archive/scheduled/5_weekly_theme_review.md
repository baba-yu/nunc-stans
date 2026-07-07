# 5_weekly_theme_review — orchestrator

Sunday-only flow. Diagnostic + advisory: reads the current state of the taxonomy, snapshots the 3-time state for rollback + reader-facing time series, proposes edits, applies the schema diff via the `apply-schema-edit` skill (manual approval default), rebuilds the dashboard, and pushes. Phase 3 rewrite (≤ 80 lines).

Pre-condition: `app/update_pages.bat` has run for today (or `docs/data/graph-*.json` is up to date). The principle that schema is a *current-time view* (no `status='retired'`, no alias table) lives in `design/memory-policy.md` §2.0.

> **Driven by `design/scheduled/0_daily_master.md`.** Sunday ordering is 1→2→4→5→3 — this task runs **after** `4_weekly_memory` (so the dormant snapshot is fresh) and **before** `3_daily_briefing` (so the dashboard rebuild picks up any schema edit). `app/skills/daily_flow_check.py` is the universal completion gate.

## Skills called (in order)

1. **`bindfs-safe-git-preflight`** *(inline shell)* — set up the `/tmp` gitdir mirror so subsequent commits don't leave bindfs lock-ghosts. Sources `design/skills/clear-stale-git-locks.sh` + the env helper at `/tmp/git-bindfs-env.sh` that Steps 4/7 source.
2. **snapshot-3-time-state** *(deterministic)* — write `memory/snapshots/<YYYYMMDD>-pre-review/` (rollback target: 3 graph JSONs + manifest + `app/src/schema.sql`) and `docs/data/snapshots/<YYYYMMDD>/` (reader-facing time series: 3 graph JSONs + manifest, no schema). 5-week retention; regenerate `docs/data/snapshots/index.json` for the SNAP dropdown. Commit "Snapshot pre-review state YYYYMMDD" — no push.
3. **read-theme-review-inputs** *(deterministic)* — read `docs/data/graph-{tech,business,mix}.json`, `app/data/analytics.sqlite` (read-only `theme_candidates` query), `app/src/schema.sql`. Don't scan history.
4. **find-theme-pain-points** *(LLM)* — per the rules in `design/memory-policy.md` §2.1: empty/underused themes (child_ids ∈ {0, 1}), overpopulated themes (child_ids ≥ 6), candidate themes (≥ 3 pending hits in `theme_candidates`), category-level dominance (≥ 50% of scope's predictions).
5. **compose-theme-proposal** *(LLM)* — write `memory/theme-review/theme-review-YYYYMMDD.md` per the format in `design/memory-policy.md` §2.1. Empty/underused → propose deprecate / rewrite description / merge. Overpopulated → propose split (only when children genuinely cluster). Theme candidates → propose new theme. Recommended actions ≤ 5.
6. **`post-write-integrity`** *(shared, kind=theme-review)* on the proposal.
7. **commit-proposal** *(deterministic)* — `git add memory/theme-review/theme-review-YYYYMMDD.md; git commit -m "Theme review YYYYMMDD (proposal)"`. No push.
8. **`apply-schema-edit`** *(shared, auto by default)* — `python3 -m app.skills.apply_schema_edit --proposal <proposal> --schema app/src/schema.sql --snapshot memory/snapshots/<YYYYMMDD>-pre-review/`. Reads the fenced JSON action blocks under each `## Recommended actions` item and applies the schema edit directly. Pass `--mode manual` to force interactive `[y/N]` confirmation per operation. Auto-rolls back from the Step 2 snapshot on validation failure. Proposal authors MUST embed a `` ```action `` (or `` ```json ``) fenced block under each schema-editing recommendation — see `design/memory-policy.md §2.1` for the block schema.
9. **`run-update-pages-bat`** *(shared)* — `python3 -m app.skills.run_update_pages`. Rebuilds DB + graph JSONs against the new schema.
10. **dashboard-integrity-check** *(shared, kind=dashboard-asset)* — `python3 -m app.skills.post_write_integrity --kind dashboard-asset --path docs/index.html --path docs/assets/app.js --path docs/assets/styles.css`. Plus the `manifest.json` 4-locale shape check + `PRAGMA integrity_check`.
11. **`bindfs-safe-commit-push`** *(shared)* — `source design/skills/bindfs-safe-commit-push.sh; bindfs_safe_commit_push "Theme review YYYYMMDD: <one-line description>"`. **This is the final push for Sunday** — flushes the dormant commit from Task 4 + the proposal commit from Step 7 + this step's schema-refresh commit.

## Inputs / outputs

- Reads: `docs/data/graph-{tech,business,mix}.json`, `app/data/analytics.sqlite` (theme_candidates), `app/src/schema.sql`.
- Writes: `memory/theme-review/theme-review-YYYYMMDD.md`, `memory/snapshots/.../`, `docs/data/snapshots/.../`, `app/src/schema.sql` (via apply-schema-edit), refreshed `app/data/analytics.sqlite` + `docs/data/graph-*.json` (via run-update-pages).
- Pushes to `dev`.

## Failure modes (skill-localized)

- **post-write-integrity fails on the proposal (Step 6)** → resume generation per `design/skills/post-write-integrity.md`. Don't commit a partial proposal — Step 8 reading it would silently apply the wrong subset of recommendations.
- **apply-schema-edit validates and rolls back** → the skill auto-restores from the Step 2 snapshot. Continue with the rebuild (Step 9 produces the same dashboard the morning task already built; nothing breaks). Note the rollback in the Step 11 commit message.
- **run-update-pages-bat fails after auto-retry** → abort and surface the work log. The proposal commit from Step 7 stays; no schema change has been applied; the repo is consistent.
- **bindfs lock ghosts** → inert under this flow. The skill never invokes git directly on bindfs `.git`. Don't abort the job because they exist; don't try to remove them.

## DRY_RUN

`DRY_RUN=1`: Step 8 runs in `--mode auto` with `DRY_RUN=1` env (plan + diff only, no write). Step 11 prints the planned commit + push without executing.

## Acceptance — this run is "done" when

1. `memory/snapshots/<YYYYMMDD>-pre-review/schema.sql` exists (rollback target).
2. `docs/data/snapshots/<YYYYMMDD>/` exists with the 3 graph JSONs + manifest; `docs/data/snapshots/index.json` lists the new directory.
3. `memory/theme-review/theme-review-YYYYMMDD.md` exists, ends with newline, passes `post-write-integrity --kind theme-review`. Recommended actions ≤ 5.
4. `app/src/schema.sql` either matches the proposal-applied state (success) or matches the pre-review snapshot (rollback after failure).
5. `docs/index.html` ends with `</html>`; `docs/assets/app.js` ends with `})();`; `docs/assets/styles.css` ends with `}`.
6. `sqlite3 app/data/analytics.sqlite 'PRAGMA integrity_check'` returns `ok`.
7. `git push` to `dev` succeeded — flushes Task 4's dormant commit + the proposal commit + this run's schema refresh.

The detailed snapshot format, the apply-schema-edit operation vocabulary, and the bindfs `/tmp` gitdir mirror logic all live in `design/memory-policy.md` §2, `design/skills/apply-schema-edit.md`, and `design/skills/bindfs-safe-commit-push.{md,sh}` respectively.
