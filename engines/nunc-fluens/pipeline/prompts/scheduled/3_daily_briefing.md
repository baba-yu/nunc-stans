# 3_daily_briefing — orchestrator

Daily flow that updates all 4 README files (3-day window) and rebuilds the dashboard. Phase 3 rewrite (≤ 80 lines): the inline checks live in skill READMEs.

Pre-condition: `future-prediction/<L>/future-prediction-YYYYMMDD.md` exists for at least one locale (`en` is canonical). Without it, abort — the readers' lead-with-validation pattern depends on it.

## Skills called (in order)

1. **verify-future-prediction-exists** *(deterministic)* — check `future-prediction/en/future-prediction-$(date +%Y%m%d).md` exists. If not, abort the run (don't ship a stale README).
2. **update-readme-3day-window** *(LLM)* — for each locale `<L>` ∈ `{en, ja, es, fil}`, update `README<.L>.md` with the last 3 days (today + 2 prior). Yesterday's section can be copy-pasted from previous run; the day before that gets pushed out. **Locale-link routing rule**: link to `report/<L>/news-…md` and `future-prediction/<L>/future-prediction-…md` when those files exist on disk; fall back to `…/en/…` only when the locale file is genuinely missing. Section H2 / H3 headers stay English in every README; only bullet text + link labels translate. **Dispatch shape: one sub-agent per locale** (4 sub-agents in parallel); see `0_daily_master.md §Sub-agent dispatch policy`. The parent only holds the 4 returned status lines — never all four READMEs in working memory.

3. **link-routing check** *(deterministic)* — see `design/scheduled/3_daily_briefing-checks.md` for the bash one-liner that walks every link and flags `/en/` references that should have been the locale's own file.
4. **structural completeness check** *(deterministic)* — same file. Walks `## YYYY-MM-DD` blocks; each must have `### News` + `### Predictions check` with their terminating `[…](report/<L>/…)` and `[…](future-prediction/<L>/…)` links. File ends in `\n---\n*\Z`.
5. **`run-update-pages-bat`** *(shared)* — `python3 -m app.skills.run_update_pages`. Rebuilds `app/data/analytics.sqlite` + `docs/data/graph-*.json`. On `database disk image is malformed` it auto-deletes + retries. On non-zero exit, abort.
6. **`post-write-integrity`** *(shared, kind=dashboard-asset)* on `docs/index.html`, `docs/assets/app.js`, `docs/assets/styles.css`. Also on each `README<.L>.md` (kind=readme).
7. **manifest shape check** *(deterministic, inline)* — `python -c "import json; m=json.load(open('docs/data/manifest.json')); assert len(m['locales'])==4 and m['default_locale']=='en'"`.
8. **SQLite integrity** *(deterministic)* — `sqlite3 app/data/analytics.sqlite 'PRAGMA integrity_check;'` returns `ok`. On failure, delete the DB + re-run `run-update-pages-bat` once.
8.5. **`post-update-validation`** *(shared, runtime export gate)* — `python3 -m app.skills.post_update_validation --check exports --date $(date +%Y-%m-%d)`. Confirms each prediction node in `docs/data/graph-*.json` for today carries `labels.title`, `detail.title_locales`, `detail.reasoning_locales`, every `bridges[*].text_locales`, and every `needs[*]` + `needs[*].task` locale bag with all 4 locales non-empty. Exits 1 on any silent dropped column — abort before push (a regressed export shipped to `dev` is what `gh-pages` will deploy). Spec: `design/skills/post-update-validation.md`.
9. **`bindfs-safe-commit-push`** *(shared)* — sources `design/skills/bindfs-safe-commit-push.sh`, calls `bindfs_safe_commit_push "$(date +%Y-%m-%d)"`. Stages `README*.md` + `docs/data/` + `report/` + `future-prediction/` + `memory/dormant/` + `memory/theme-review/` (covers the safety-net catches for tasks 4 & 5). PowerShell host-side runs use plain `git`.

## Inputs / outputs

- Reads: `future-prediction/<L>/future-prediction-YYYYMMDD.md`, `report/<L>/news-YYYYMMDD.md`, previous `README<.L>.md` files.
- Writes: 4 `README<.L>.md`, refreshed `docs/data/*.json` (via `update_pages.bat`), refreshed `app/data/analytics.sqlite`.
- Pushes to `dev` (never to `main` per user's hygiene rule).

## Failure modes (skill-localized)

- **`verify-future-prediction-exists` fails** → abort. Do not run an incomplete README day.
- **link-routing check fails** → fix the README and re-run. The check was added because legacy README.ja.md shipped dead `/news/news-….md` links (no locale segment).
- **structural completeness check fails** → resume generation per the failing locale. Re-prompt with "the previous run was truncated; continue from after the `<last good date>` block."
- **`run-update-pages-bat` fails after the auto-retry** → abort and surface the work log.
- **integrity check fails twice** → bridge degraded; abort.

## DRY_RUN

`DRY_RUN=1`: skip Step 9 (the commit + push). All earlier checks run; the local working tree carries the README + dashboard updates without flushing to remote.

## Acceptance — this run is "done" when

1. All 4 READMEs end in `\n---\n` and pass the link-routing + structural completeness checks.
2. `docs/data/manifest.json` has 4 locales and `default_locale='en'`.
3. `docs/index.html` ends with `</html>`, `docs/assets/app.js` ends with `})();`, `docs/assets/styles.css` ends with `}`.
4. `sqlite3 app/data/analytics.sqlite 'PRAGMA integrity_check'` returns `ok`.
5. `cd app && python -m pytest -q` returns 0 (run inside `run-update-pages-bat`).
6. `post-update-validation --check exports` exits 0: every prediction node in today's `docs/data/graph-*.json` carries `labels.title` + `detail.title_locales` + `detail.reasoning_locales` + `bridges[*].text_locales` (where present) + `needs[*].*_locales` + `needs[*].task.*_locales` populated for all 4 locales.
7. `git push` to `dev` succeeded.

The detailed link-routing + structural completeness check scripts live in `design/scheduled/3_daily_briefing-checks.md`. The bindfs / `/tmp` gitdir mirror logic lives in `design/skills/bindfs-safe-commit-push.{md,sh}`.
