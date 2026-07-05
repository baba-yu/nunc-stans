# Skill: super-backfill

One-shot maintenance task that walks the markdown corpus oldest→newest and **regenerates** every day's structured sourcedata fresh from the existing markdown bodies. Heavier than Phase 4's mechanical backfill — this one is allowed to call LLMs to fill structured fields that the legacy markdown lacks.

## Why this is its own skill

Phase 4 migrated existing markdown into `app/sourcedata/<date>/*.json` using the legacy parser. Predictions authored before Stream J/C/K landed (~roughly pre-2026-05-02) end up with `reasoning = null`, `summary = null`, and incomplete Needs because the source markdown never carried those fields. The dashboard renders them in a degraded state (title shows the first 80 chars of the body, Reasoning tab empty, no `plain_language`).

`super-backfill` is the catch-up pass. v1 walks `report/<L>/news-YYYYMMDD.md` and `future-prediction/<L>/future-prediction-YYYYMMDD.md` oldest-to-newest, regenerating LLM-derived structured fields fresh per day. The chronological walk lets each day reference the prior day's complete predictions for bridge narratives, mirroring production daily-master behavior.

## Inputs

| Name | Source | Required |
|---|---|---|
| `repo-root` | repo working tree | yes |
| `db` | `app/data/analytics.sqlite` | yes |
| `dates` | ISO date range or `all` (default: `all` — every date with EN news/FP markdown) | no |

## Outputs

For each date in scope:

- `app/sourcedata/<date>/predictions.json` — full `PredictionsFile` (regenerated fresh).
- `app/sourcedata/<date>/bridges.json` — full `BridgesFile` (regenerated fresh, only when FP markdown exists).
- `app/sourcedata/<date>/needs.json` — full `NeedsFile` (regenerated fresh).
- `app/sourcedata/locales/<date>/<L>/{predictions,bridges,needs}.json` — locale fan-out for ja, es, fil.

**Preserved-unless-empty** (v1 does NOT regenerate these unless missing or empty — Phase 4 produced reasonable shapes):

- `app/sourcedata/<date>/headlines.json`
- `app/sourcedata/<date>/change_log.json`
- `app/sourcedata/<date>/news_section.json`

**Deferred to v2** (out of scope — daily-master doesn't produce them yet, so v1 mirrors actual production):

- `app/sourcedata/<date>/readings.json` (cross-prediction relations + chain edges + cluster pointers).

Stdout summary at the end of a run:

```
super-backfill: dates=16 predictions=48 bridges=78 needs=48 locales=144 ingest_ok=16
```

## Algorithm — chronological walker

```
dates = scan_markdown_dates(repo_root)        # [(date_iso, has_news, has_fp), ...]
for (date_iso, has_news, has_fp) in dates:    # oldest → newest
  bundle = prepare_context(repo_root, date_iso)
    # bundle has:
    #   predictions_to_compose: list of {title, body} from news markdown
    #   validation_rows_to_bridge: list from FP markdown (empty when has_fp=False)
    #   prior_predictions: last 7 days of complete sourcedata predictions

  # Parent-agent dispatch (parallel within the day):
  for pred in bundle.predictions_to_compose:
    sub-agent (compose-prediction-backfill): regenerate reasoning + summary + plain_language
    -> writes app/sourcedata/<date>/predictions.<pid>.json
  for row in bundle.validation_rows_to_bridge:
    sub-agent (compose-bridge): regenerate bridge object
    -> writes app/sourcedata/<date>/bridges.<idx>.json
  for pred in bundle.predictions_to_compose:
    sub-agent (extract-needs): regenerate needs
    -> writes app/sourcedata/<date>/needs.<pid>.json

  # Parent merges + applies:
  apply_predictions(repo_root, date_iso, merged_payload)
  apply_bridges(repo_root, date_iso, merged_payload) if has_fp
  apply_needs(repo_root, date_iso, merged_payload)

  # Locale fan-out (3 sub-agents in parallel: ja/es/fil):
  for locale in (ja, es, fil):
    sub-agent (translate-sourcedata): translate predictions + bridges + needs
    -> writes app/sourcedata/locales/<date>/<L>/{predictions,bridges,needs}.json
  apply_locale(...) for each (locale, stream)

  commit_day(repo_root, date_iso)             # ingest into DB

  daily_flow_check --strict --date <date_iso>  # gate
  if gate fails: stop, report which date+stream failed
```

**Chronological matters because:**

- Bridge narratives reference prior predictions ("On the X prediction (Apr 27): …"). If 2026-04-26's predictions are regenerated before 2026-04-27, then 2026-04-27's bridges can correctly cite the now-complete 2026-04-26 entries.
- Needs target windows depend on `task.when` parsing which is anchored to `prediction_date`.
- The walker matches production daily-master's per-day shape — the run is effectively a 16-day re-play of the daily flow, sub-agent dispatch and all.

## Sub-agent dispatch shape

| Stream | Per-day work | Sub-agent skill |
|---|---|---|
| predictions (reasoning + summary + plain_language) | One sub-agent per prediction body in news markdown | `compose-prediction-backfill` (mirrors `compose-prediction` but fed the existing markdown body instead of a fresh news synthesis) |
| bridges | One sub-agent per validation row in FP markdown | existing `compose-bridge` |
| needs | One sub-agent per prediction | existing `extract-needs` |
| locale fanout | After EN fill is complete for a day, 3 sub-agents in parallel (ja/es/fil) translate predictions + bridges + needs | existing `translate-sourcedata` |

Total LLM dispatches per day: 3 predictions + ~5 bridges (FP days only) + 3 needs + 3 locales = ~14 sub-agents per FP day, ~9 sub-agents per news-only day. For the 2026-04-19 → 2026-05-04 corpus (3 news-only + 13 full days): ~205 sub-agents total. Wall time estimate: 1.5–2 hours.

## Idempotency + safety

- Every JSON write is atomic (`tmp + os.replace`).
- DB writes go through existing `ingest_sourcedata.ingest_day` and `ingest_day_locales` (idempotent by spec).
- A run that aborts mid-corpus can be resumed: re-running with the same dates argument produces the same final state because each apply step overwrites atomically and `commit_day` is idempotent.
- A single sub-agent failure does not block the rest of the day; the parent re-prompts the failing sub-agent only. End-of-run summary reports any unfilled streams for human triage.

## Reference invocation

The Python module exposes deterministic building blocks; the parent agent (Claude) drives the LLM-call orchestration per the Operator runbook below.

```bash
# List corpus dates
python -m app.skills.super_backfill scan

# Print per-day context bundle (predictions to compose, FP rows to bridge, prior context)
python -m app.skills.super_backfill prepare --date 2026-04-22

# Apply a sub-agent's stream output (after schema-validating it)
python -m app.skills.super_backfill apply \
  --date 2026-04-22 --stream predictions --json-file /tmp/preds.json

# Apply a locale stream
python -m app.skills.super_backfill apply \
  --date 2026-04-22 --stream predictions --locale ja --json-file /tmp/preds.ja.json

# Ingest the date's sourcedata into the analytics DB
python -m app.skills.super_backfill commit-day --date 2026-04-22
```

## Why not roll into `1_daily_update`

`1_daily_update` runs once per day, processes only today's predictions, has a strict time budget, and writers are stateless. Super-backfill is a multi-day chronological walk with cross-day data dependencies — fundamentally different shape. It runs on operator demand, not on a schedule.

The Sunday `6_weekly_maintenance` task (separate spec at `design/scheduled/6_weekly_maintenance.md`) does a similar update-on-staleness pass but for already-complete entries; super-backfill is for entries that were never complete in the first place.

## Implementation note

`app/skills/super_backfill.py` is the entry point. It composes existing skills (`compose-prediction-backfill`, `compose-bridge`, `extract-needs`, `translate-sourcedata`) and a new chronological-walker scaffold. No new LLM prompt contracts beyond the per-skill specs; the only new sub-skill spec is `compose-prediction-backfill.md`, which differs from `compose-prediction.md` only in its input shape (existing markdown body vs. fresh news synthesis).

## Operator runbook (chronological-walker)

For the parent agent (Claude) executing the corpus backfill. Follows the sub-agent dispatch policy in `design/scheduled/0_daily_master.md`: every LLM-heavy step is dispatched to a sub-agent, sub-agents reply with one-line OK status only.

1. Pre-flight:
   - `cd app && python -m pytest -q` — must pass.
   - `python -m app.skills.super_backfill scan` → list of `(date, has_news, has_fp)`.
   - DB integrity check: `python -c "import sqlite3; assert sqlite3.connect('app/data/analytics.sqlite').execute('PRAGMA integrity_check').fetchone()[0] == 'ok'"`.

2. For each date oldest → newest:
   - `python -m app.skills.super_backfill prepare --date <D> > /tmp/ctx.<D>.json`
   - Dispatch sub-agents in parallel within the day:
     - **predictions**: 1 sub-agent per prediction in `predictions_to_compose`, using `compose-prediction-backfill` skill spec. Each writes `app/sourcedata/<D>/predictions.<pid>.json`.
     - **bridges** (if FP exists): 1 sub-agent per row in `validation_rows_to_bridge`, using `compose-bridge` skill spec. Each writes `app/sourcedata/<D>/bridges.<idx>.json`.
     - **needs**: 1 sub-agent per prediction, using `extract-needs` skill spec. Each writes `app/sourcedata/<D>/needs.<pid>.json`.
   - Parent merges per-item files into stream files (predictions list, bridges list, needs by_prediction map), then applies:
     - `python -m app.skills.super_backfill apply --date <D> --stream predictions --json-file <merged>`
     - `... --stream bridges ...` (FP days only)
     - `... --stream needs ...`
   - Locale fan-out: 3 sub-agents in parallel (ja/es/fil), each translates predictions + bridges + needs JSON. Each writes `app/sourcedata/locales/<D>/<L>/<stream>.json`.
   - Apply locale outputs via `--locale <L>` flag.
   - `python -m app.skills.super_backfill commit-day --date <D>`.
   - Validation gates:
     - `python -m app.skills.daily_flow_check --date <D> --strict` — must be GREEN.
     - `python -m app.skills.lint_markdown_clean --date <D>` — must be 0-hit.

3. After all dates:
   - `python -m app.skills.daily_flow_check --date <last> --strict`.
   - `cd app && python -m pytest -q` — must still pass.
   - Single squashed commit. No "Claude" / "Co-Authored-By" attribution per `~/.claude/CLAUDE.md` Git Hygiene.
   - User pushes manually to `dev` (never `main`).

### Failure modes

| Failure | Recovery |
|---|---|
| Sub-agent JSON fails schema validation | Re-prompt the failing sub-agent only; don't restart the day |
| `commit-day` fails | Stop, leave dev tree dirty, ask user |
| `daily-flow-check --strict` red after a date | Stop, leave dev tree dirty, ask user — do not continue |
| pytest regression mid-walk | Stop immediately; the implementation has a bug |
