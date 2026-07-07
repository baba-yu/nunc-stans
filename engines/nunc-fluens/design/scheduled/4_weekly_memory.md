# 4_weekly_memory — orchestrator

Sunday-only flow. Updates the persistent dormant snapshot of older predictions so the daily flow can keep evaluating them without re-scanning all of project history. **Bounded at 15 reads, 1 write.** Phase 3 rewrite (≤ 80 lines).

Pre-condition: today is Sunday. The 3-orthogonal-concepts vocabulary (Hot/Lukewarm vs Window-filter vs Dormant) lives in `design/memory-policy.md` §1.

> **Driven by `design/scheduled/0_daily_master.md`.** That orchestrator owns the day-of-week branching (Sunday → 1→2→4→5→3) and runs `app/skills/daily_flow_check.py` as the universal completion gate. Don't run this task in isolation; the dormant snapshot is consumed by the next-day `2_future_prediction` so a missed Sunday cascades.

## Skills called (in order)

1. **`clear-stale-git-locks`** *(shared)* — `source design/skills/clear-stale-git-locks.sh; clear_stale_git_locks`. Falls back to `/tmp/<task>-<timestamp>/` and chdirs there if bindfs blocks unlink.
2. **read-bounded-inputs** *(deterministic)* — read previous `memory/dormant/dormant-{prev sunday YYYYMMDD}.md` (1 file), `future-prediction/en/future-prediction-*.md` for last 7 days (≤ 7 files), `## Future` of `report/en/news-*.md` for last 7 days (≤ 7 files). EN-only — siblings are translations.
3. **compute-tier-transitions** *(LLM-supervised)* — for each prediction in the previous snapshot, decide stay/exit/advance per the rules in `design/memory-policy.md` §1.3 (`max_rel ≥ 4` → exit pool; otherwise advance interval 14 → 30 → 60 days). For predictions older than the 7-day origin window AND not in previous snapshot, apply the **force-dormant rule** (`max_rel < 4` → enter pool with starting interval 14 days).
4. **extract-dormant-signals** *(LLM)* — for each new dormant entrant, open `report/en/news-{first seen date}.md`, locate the `## Future` numbered item by its index suffix, and extract distinctive terms (proper nouns, product names, technical terms, plausible synonyms). 5–12 signals is typical. Aim wide. **Freeze on first entry.**
5. **write-dormant-snapshot** *(deterministic)* — write `memory/dormant/dormant-YYYYMMDD.md` per the format in `design/memory-policy.md` §1.4. Always emit (even with empty table) — file existence is the signal that the weekly job ran.
6. **`post-write-integrity`** *(shared, kind=dormant)* on the new snapshot. NUL-tail strip + structural completeness (top-level header, `## Tier: Dormant` header, table consistency, trailing newline).
7. **commit only** *(deterministic)* — `git add memory/dormant/dormant-YYYYMMDD.md; git commit -m "Memory rolling YYYYMMDD"`. **No push** — Sunday flow runs 1→2→3→4→5; Step 7 of `5_weekly_theme_review` is the final push that flushes this commit.

## Inputs / outputs

- Reads (bounded): 1 dormant snapshot + ≤ 7 future-prediction files + ≤ 7 news files = 15 files max, regardless of project age.
- Writes: 1 `memory/dormant/dormant-YYYYMMDD.md`.

## Failure modes

- **clear-stale-git-locks falls back to `/tmp` workspace** → continue inside the fallback. The remaining steps + final `git push` (in `5_weekly_theme_review`) execute there. After push, the original dir can `git fetch && git reset --hard origin/dev` to resync.
- **previous dormant snapshot malformed** → log the path + parse error, abort. Resolve the previous snapshot before retrying. Don't silently drop entries.
- **origin news file missing for a dormant ID** → keep the entry; leave `Signals` as-is (it was frozen at first dormant entry). Note the missing file in the commit message.
- **post-write-integrity REPAIRED twice** → abort.

## DRY_RUN

`DRY_RUN=1`: Step 5 prints the planned snapshot text to stdout instead of writing; Step 7 skips the commit. Useful for sanity-checking the tier transitions before the snapshot is committed.

## Acceptance — this run is "done" when

1. `memory/dormant/dormant-YYYYMMDD.md` exists, ends with newline, passes `post-write-integrity --kind dormant`.
2. Top-level header is `# Dormant pool — week ending YYYY-MM-DD`; tier header is `## Tier: Dormant — interval ≥ 14 days`.
3. Tier table column count is consistent; every row's `Signals` column is non-empty for new entrants (frozen on first entry; legacy rows preserve their signals).
4. The commit "Memory rolling YYYYMMDD" exists in `git log` (push deferred to `5_weekly_theme_review` Step 7).

The detailed format spec, the why-this-exists narrative, and the Hot/Warm/Lukewarm/Dormant tier table all live in `design/memory-policy.md`. The bindfs / `/tmp` gitdir mirror logic lives in `design/skills/clear-stale-git-locks.{md,sh}` and `design/skills/bindfs-safe-commit-push.{md,sh}`.
