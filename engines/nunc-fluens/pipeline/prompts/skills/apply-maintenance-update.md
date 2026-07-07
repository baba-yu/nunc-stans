# Skill: apply-maintenance-update

LLM sub-agent that rewrites ONE (prediction, stream) pair flagged
`stale` by the Judge. Called from `6_weekly_maintenance` Step 2 — one
sub-agent per stale judgement (≤ 6 concurrent). Retire and broken
judgements bypass this skill (the orchestrator handles them
deterministically).

## Sub-agent context (parent supplies)

- The current entry's full state for the targeted stream:
  - `reasoning` → the `predictions` row's `reasoning_*` fields.
  - `bridge`    → the `validation_rows` row's `bridge_text` +
                  `support_dimension`.
  - `needs`     → the `prediction_needs` + `needs_tasks` rows.
  - `readings`  → the `prediction_chain` and `prediction_relations`
                  rows touching this prediction.
- The Judge's verdict + `reason` + `cross_stream_evidence` for this
  one (prediction, stream) pair.
- The supporting last-7-days context the parent already supplied to the
  Judge: news headlines, change_log items, the new bridges /
  contradicts / chain edges that triggered the gate.
- Locale fan-out targets — for streams whose schema includes locale
  siblings (reasoning, bridge_text, needs.actor/job/outcome/motivation,
  task 5W1H), the sub-agent rewrites all 4 locales (en/ja/es/fil).
- Target output path:
  `app/sourcedata/<week_ending>/<filename>.<prediction_id>.json`
  where `<filename>` is one of:
    * `predictions` (reasoning + readings, since chain edges are stored
      with the prediction)
    * `bridges`
    * `needs`

## Required output

A JSON delta conforming to the relevant sourcedata schema. Examples:

- `reasoning` rewrite → a partial `PredictionsFile` with one entry
  whose `reasoning` block is fully populated (because/given/so_that/
  landing/plain_language, all locales).
- `bridge` rewrite → a partial `BridgesFile` with one
  `validation_rows[]` entry whose `bridge` object is rewritten.
- `needs` rewrite → a partial `NeedsFile` `by_prediction[<pid>]` list.

The delta MUST validate against the matching dataclass in
`app/skills/sourcedata_schemas.py`. Atomic write: write to a temp file
in the same dir, then `os.replace` onto the final name.

## Editorial guidance

- Do NOT change the prediction's `id`, `title`, or `summary` — only the
  targeted stream's fields. (Title rewrites are a separate skill.)
- Cite the Judge's `cross_stream_evidence` ids in the rewrite where
  applicable (e.g. the new `because` text references the contradicting
  bridge by short label + date).
- Preserve the field's editorial style (≤ word counts, no
  markdown asterisks, no scope prefix) per the existing
  `design/skills/compose-*.md` contracts.
- For `needs.task.status` flips (a Need that just landed), set
  `task.status="done"` directly in the JSON; the parent's
  `cli ingest-sourcedata` propagates to the DB.

## Parent post-processing

Parent validates the JSON delta. On schema failure, the parent
reverts that single (prediction, stream) pair's JSON, logs to
`data/memory/maintenance/<week_ending>/broken.md`, and continues. After all
sub-agents finish, parent runs `cli ingest-sourcedata` + `cli score` +
`cli export` to fold changes into the DB and refresh the dashboard.

## Reply contract

Sub-agent reply: one-line `OK <path>` or `FAIL <reason>`. Do NOT paste
JSON content back.
