# Skill: extract-needs

For a fresh prediction, generate one or more `prediction_needs` rows + matching `needs_tasks` 5W1H breakdowns. Called from `1_daily_update` (after `compose-prediction`) so the Needs land at the same time as the prediction.

## What "Needs" mean here

A **Need** captures *what the prediction needs from its driver coalition* — the role-abstract actors whose ongoing work pushes the world toward the predicted state. Each Need carries a 5W1H breakdown (`needs_tasks`) of the specific runway task the actor is doing.

(Historical note: this skill was originally `extract-jtbd-tasks`. Renamed because "Jobs-To-Be-Done" framed the actor as someone who reacts AFTER landing — opposite of the system's intent. "Need" expresses "what the prediction needs to succeed" without the after-the-fact connotation.)

## Phase 3 output relocation

Pre-Phase-3 output path was `.jtbd-tmp/today-needs-pred-prediction.<pid>.json`. Phase 3 moves this to:

  `data/sourcedata/<date>/needs.<pid>.json`  (per-prediction temp file)

The orchestrator (`1_daily_update`) dispatches one sub-agent per fresh prediction, each writing its own per-prediction file. After all 3 sub-agents return, the parent runs:

  `python -m app.skills.extract_needs merge --date-dir data/sourcedata/<date>/`

which deterministically merges the per-prediction files into the canonical `data/sourcedata/<date>/needs.json` matching the `NeedsFile` schema. The merge step is order-stable (per-prediction keys sorted by id; per-need rows preserved in source order).

The legacy `.jtbd-tmp/today-needs-pred-*.json` files are **not deleted** in Phase 3 — Phase 4's backfill migrates them. Phase 3 only stops writing new ones to that path.

## Why this is its own skill

Needs extraction is **LLM-only** work and depends on the writer's full context (the prediction body + reasoning fields). Inlining it inside `1_daily_update` would re-pay the cost on every retry of any other failing step. Splitting lets the orchestrator retry just Needs extraction without regenerating News + Future + Headlines.

## Inputs

| Name | Source | Required |
|---|---|---|
| `db` | `store/world/analytics.sqlite` | yes |
| `prediction-id` | the just-ingested prediction's ID | yes |
| `prediction-body` | the prose body (not the title) — drives the LLM extraction | yes |
| `needs-json-file` | path to write the per-prediction temp file (e.g. `data/sourcedata/<date>/needs.<pid>.json`) | yes |

## Outputs

- One per-prediction JSON file at `--needs-json-file` (a list of need records).
- 1+ rows in `prediction_needs` (one per Need the LLM extracts).
- 1 row in `needs_tasks` per Need with the 5W1H cells filled.
- `status='blocked'` on any task whose 5W1H has missing cells; the weekly review surfaces them for human triage.

JSON summary on stdout: `{"prediction_id": "...", "need_count": N, "tasks_count": M, "blocked": [task_id…]}`.

## LLM prompt template (writer-side)

> Given a prediction's body text, identify each role-abstract actor whose **ongoing or planned work drives the prediction toward realization**. Frame these as the people whose actions in the runway between today and the prediction's `landing` field cause the predicted state to come about. **Not** people who react to it after the fact.
>
> Drivers, not responders:
>
> - Include: an actor whose product roadmap, contract drafting, court filing, book-build, or deployment work is what makes the prediction land.
> - Exclude: an actor whose work only begins after the prediction has landed (downstream consumers, post-event observers, equity analysts who track but don't move the world).
> - Exclude: an actor working *against* the prediction (counter-actors trying to prevent it).
>
> If the prediction's `landing` already names the actor (e.g. "≥1 IR firm publishes a post-mortem"), the IR firm IS the driver — their investigation + publication work IS what realizes the prediction.
>
> For each actor, produce:
>
> 1. `actor` — the role (NOT a specific company; e.g. "hyperscaler agent-platform product manager", not "Andy Jassy").
> 2. `job` — what they're working on now (or in the runway period) that drives the prediction toward landing. ≤ 25 words.
> 3. `outcome` — the concrete deliverable that realizes the prediction's claim. ≤ 25 words.
> 4. `motivation` — why this actor pushes this work forward. ≤ 25 words.
> 5. `task` — a 5W1H breakdown of the most concrete in-progress (or runway) task:
>    - `who`: which sub-team / function inside the actor's organization is doing the work.
>    - `what`: the action verb + object (≤ 12 words).
>    - `where`: the system / process / venue where the work happens (≤ 12 words).
>    - `when`: the **runway period** during which the actor is doing this work — NOT the prediction's `landing` field.
>    - `why`: the link to motivation (≤ 12 words).
>    - `how`: a tool / vendor / standard / process used to do the work (≤ 12 words). Acceptable to be `null` when the path is open.
>
> Refuse to fabricate. If the prediction body doesn't support a Need beyond a single hand-wave driver, return one Need with `task.status = 'blocked'` so a human can review.
>
> Output a JSON list of `{actor, actor_ja, actor_es, actor_fil, job, job_ja, ..., task: {who, who_ja, who_es, who_fil, what, what_ja, ...}}` objects. Locale fields are optional — when omitted the frontend falls back to EN.

## Schema constraints

- `actor` is required.
- 5W1H cells are nullable in the schema, but the orchestrator marks `task.status='blocked'` whenever any cell is null.
- `prediction_needs.reviewed_by_human` defaults to 0; the weekly `5_weekly_theme_review` surfaces unreviewed rows in its proposal.
- Locale fields (`actor_ja`, `job_es`, `task.who_fil`, …) are nullable; missing → frontend EN fallback.

### Per-prediction-file naming + locale ingest pairing

The on-disk per-prediction temp file is `data/sourcedata/<date>/needs.prediction.<sha>.json` (i.e. the **full** prediction id WITH the `prediction.` prefix is in the filename). `merge_needs_files` derives the by-prediction key from the filename stem after stripping `needs.`, so the merged `by_prediction[<pid>]` keys are always `prediction.<sha>`.

For locale needs files (`data/sourcedata/locales/<date>/<L>/needs.json`), `_ingest_locale_needs` pairs each locale need to the EN need by **position within the per-prediction list** (rowid order in DB = source order in EN file = expected source order in the locale file). The locale file's translated `actor` is NOT a join key — historically that pairing was actor-based and broke as soon as the locale-fanout contract started translating `actor`. Sub-agents producing a locale needs file MUST preserve the EN canonical's per-prediction list order; reordering or adding/removing entries silently breaks the pairing.

## Reference invocation

```bash
# Per-prediction sub-agent writes its temp file:
python -m app.skills.extract_needs \
  --db store/world/analytics.sqlite \
  --prediction-id <pid> \
  --needs-json-file data/sourcedata/$(date +%Y-%m-%d)/needs.<pid>.json

# Parent merges per-prediction files into the canonical needs.json:
python -m app.skills.extract_needs merge \
  --date-dir data/sourcedata/$(date +%Y-%m-%d)/
```

Implementation: `app/skills/extract_needs.py` (`commit_need` + `merge_needs_files`).
