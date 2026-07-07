# 3_daily_briefing — orchestrator

Daily flow that updates all 4 README files (3-day window) and rebuilds the dashboard data. Phase 3 rewrite (≤ 80 lines): the inline checks live in skill READMEs.

Pre-condition: `data/future-prediction/<L>/future-prediction-YYYYMMDD.md` exists for at least one locale (`en` is canonical). Without it, abort — the readers' lead-with-validation pattern depends on it.

## Skills called (in order)

1. **verify-future-prediction-exists** *(deterministic)* — check `data/future-prediction/en/future-prediction-$(date +%Y%m%d).md` exists. If not, abort the run (don't ship a stale README).
2. **update-readme-3day-window** *(LLM)* — for each locale `<L>` ∈ `{en, ja, es, fil}`, update `README<.L>.md` with the last 3 days (today + 2 prior). Yesterday's section can be copy-pasted from previous run; the day before that gets pushed out. **Locale-link routing rule**: link to `data/daily-news/<L>/news-…md` and `data/future-prediction/<L>/future-prediction-…md` when those files exist on disk; fall back to `…/en/…` only when the locale file is genuinely missing. Section H2 / H3 headers stay English in every README; only bullet text + link labels translate. **Dispatch shape: one sub-agent per locale** (4 sub-agents in parallel); see `0_daily_master.md §Sub-agent dispatch policy`. The parent only holds the 4 returned status lines — never all four READMEs in working memory.

3. **link-routing check** *(deterministic)* — see `design/archive/scheduled/3_daily_briefing-checks.md` for the bash one-liner that walks every link and flags `/en/` references that should have been the locale's own file.
4. **structural completeness check** *(deterministic)* — same file. Walks `## YYYY-MM-DD` blocks; each must have `### News` + `### Predictions check` with their terminating `[…](data/daily-news/<L>/…)` and `[…](data/future-prediction/<L>/…)` links. File ends in `\n---\n*\Z`.
5. **`update-pages`** *(shared)* — score + export. Rebuilds `data/exports/graph-*.json` from `app/data/analytics.sqlite`. On `database disk image is malformed` it auto-deletes + retries. On non-zero exit, abort.
6. **`post-write-integrity`** *(shared, kind=dashboard-asset)* on the engine dashboard (`engines/nunc-fluens/dashboard/{index.html,assets/app.js,assets/styles.css}` — product code; instances carry data only). Also on each `README<.L>.md` (kind=readme).
7. **manifest shape check** *(deterministic, inline)* — `data/exports/manifest.json` has 4 `locales` and `default_locale='en'`.
8. **SQLite integrity** *(deterministic)* — `sqlite3 app/data/analytics.sqlite 'PRAGMA integrity_check;'` returns `ok`. On failure, delete the DB + re-run the export once.
8.5. **`post-update-validation`** *(shared, runtime export gate)* — `--check exports --date $(date +%Y-%m-%d)`. Confirms each prediction node in `data/exports/graph-*.json` for today carries `labels.title`, `detail.title_locales`, `detail.reasoning_locales`, every `bridges[*].text_locales`, and every `needs[*]` + `needs[*].task` locale bag with all 4 locales non-empty. Exits 1 on any silent dropped column — abort before publish (a regressed export is what any deployed dashboard will serve). Spec: `design/archive/skills/post-update-validation.md`.
9. **publish** *(shared)* — plain git. Stages `README*.md` + `data/exports/` + `data/daily-news/` + `data/future-prediction/` + `data/memory/` (covers the safety-net catches for tasks 4 & 5) + `app/sourcedata/`.

## Inputs / outputs

- Reads: `data/future-prediction/<L>/future-prediction-YYYYMMDD.md`, `data/daily-news/<L>/news-YYYYMMDD.md`, previous `README<.L>.md` files.
- Writes: 4 `README<.L>.md`, refreshed `data/exports/*.json`, refreshed `app/data/analytics.sqlite`.
- Pushes to `dev` (never to `main` per user's hygiene rule); instances without a remote commit locally.

## Failure modes (skill-localized)

- **`verify-future-prediction-exists` fails** → abort. Do not run an incomplete README day.
- **link-routing check fails** → fix the README and re-run. The check was added because legacy README.ja.md shipped dead `/news/news-….md` links (no locale segment).
- **structural completeness check fails** → resume generation per the failing locale. Re-prompt with "the previous run was truncated; continue from after the `<last good date>` block."
- **`update-pages` fails after the auto-retry** → abort and surface the work log.
- **integrity check fails twice** → bridge degraded; abort.

## DRY_RUN

`DRY_RUN=1`: skip Step 9 (the commit + push). All earlier checks run; the local working tree carries the README + export updates without flushing to remote.

## Acceptance — this run is "done" when

1. All 4 READMEs end in `\n---\n` and pass the link-routing + structural completeness checks.
2. `data/exports/manifest.json` has 4 locales and `default_locale='en'`.
3. The engine dashboard is whole: `index.html` ends with `</html>`, `assets/app.js` ends with `})();`, `assets/styles.css` ends with `}`.
4. `sqlite3 app/data/analytics.sqlite 'PRAGMA integrity_check'` returns `ok`.
5. `post-update-validation --check exports` exits 0: every prediction node in today's `data/exports/graph-*.json` carries `labels.title` + `detail.title_locales` + `detail.reasoning_locales` + `bridges[*].text_locales` (where present) + `needs[*].*_locales` + `needs[*].task.*_locales` populated for all 4 locales.
6. The publish commit landed (push where a remote exists).

The detailed link-routing + structural completeness check scripts live in `design/archive/scheduled/3_daily_briefing-checks.md`.
