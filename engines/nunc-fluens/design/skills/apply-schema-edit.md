# Skill: apply-schema-edit

Apply a `memory/theme-review/theme-review-YYYYMMDD.md` proposal to `app/src/schema.sql` as an atomic, **rollback-able** edit. Independent skill (extracted from `5_weekly_theme_review` Step 5) — runs by default in **manual approval mode**, never silently chains to the rebuild step.

## Why this is its own skill

`schema.sql` edits are **not** like prose edits. The `proposal → apply → rebuild → push` chain in `5_weekly_theme_review` previously ran inside one LLM context, so a logical mistake in the proposal would land in `schema.sql` and only surface on the next dashboard render — by which point the snapshot tier was already rotating. Splitting the apply step out lets the human (or a separate review pass) see the proposal first, run `apply-schema-edit` deliberately, and rely on the snapshot to roll back if anything is wrong.

## Inputs

| Name | Source | Required |
|---|---|---|
| `proposal_path` | `memory/theme-review/theme-review-YYYYMMDD.md` (latest by default) | yes |
| `schema_path` | `app/src/schema.sql` | yes |
| `snapshot_dir` | `memory/snapshots/<YYYYMMDD>-pre-review/` (rollback target) | yes |
| `mode` | `manual` (default) \| `auto` | yes |
| `DRY_RUN` (env) | `1` to plan only and skip writes | optional |

## Outputs

- Modified `app/src/schema.sql` (in-place, atomic temp+rename when not in DRY_RUN).
- Stdout summary listing each operation applied: `add | rewrite-description | rename | merge | split | promote-candidate | log-only`.
- Stderr `FAIL` line on any unrecoverable mismatch (proposal references a `theme_id` that doesn't exist in `schema.sql`, etc.).
- On failure: automatic restore from `snapshot_dir/schema.sql` and exit code 1.

## Operation vocabulary

The proposal's `## Recommended actions` section uses a small fixed vocabulary. This skill maps each phrase to a deterministic schema edit:

| Recommendation phrase | Schema operation |
|---|---|
| `Add <theme_id> theme under <category_id>` | `INSERT OR IGNORE INTO themes(...)` row + locale `UPDATE themes SET label_ja=…, short_label_ja=…, description_ja=…, label_es=…, short_label_es=…, description_es=…, label_fil=…, short_label_fil=…, description_fil=…` row in the file's tail. All nine locale fields (`label_*`, `short_label_*`, `description_*`) for `ja`, `es`, and `fil` are **required**. A new theme without locale fields is incomplete and must not be applied. |
| `Tighten descriptions on N themes` | `UPDATE themes SET description=…, description_ja=…, description_es=…, description_fil=…` for each named theme. The three locale description columns must be updated alongside the EN `description`. Do **not** alter `theme_id` / `canonical_label` / `short_label` / `category_id`. |
| `Rename <old_id> → <new_id>` | Rewrite `theme_id`, `canonical_label`, `short_label`, `description` in place. Rewrite all nine locale fields in the locale `UPDATE` row too. |
| `Merge <absorbed_id> into <survivor_id>` | Delete the absorbed theme's `INSERT` row and locale `UPDATE` row. Old prediction attachments orphan harmlessly; the matcher reattaches on rebuild. |
| `Split <theme_id>` | Modify the existing row to one new sub-topic; add an `INSERT` row for the other(s); add locale `UPDATE` rows (all nine locale fields) for new ids. If a split produces a new `subthemes` row, that row also requires `short_label_ja/es/fil` and `description_ja/es/fil`. |
| `Promote candidate <candidate_id>` | `INSERT` new theme + append `UPDATE theme_candidates SET status='promoted', promoted_theme_id='<new id>' WHERE candidate_id='<candidate_id>';`. |
| `Investigate matcher behaviour` / `No splits` / `out of scope for this proposal` | **Log only** — append a one-line note to the run log. No schema edit. |

If a recommendation cannot be mapped (ambiguous wording, missing keyword guidance, or an `theme_id` not present in `schema.sql`), **skip the single recommendation and log it**. Do not block the rest of the run.

## Manual mode (default)

```
1. Load proposal_path → parse `## Recommended actions` items.
2. For each item, plan the schema operation (see vocabulary above).
3. Print the planned diff to stdout (unified diff against schema_path).
4. If DRY_RUN=1, exit 0 without writing.
5. Otherwise, prompt the user: "apply N operations? [y/N]".
6. On 'y': perform an atomic write (write to schema_path.tmp, then os.replace).
7. On 'n' or non-tty: exit 0 with no write.
```

## Auto mode

Same as manual through step 4. Skips the prompt and applies the write unconditionally. Used inside the original `5_weekly_theme_review` flow when the operator explicitly asks for an end-to-end run. Even in auto mode, the snapshot at `memory/snapshots/<date>-pre-review/schema.sql` is the rollback target — Step 6's `update_pages.bat` or the integrity check at Step 6.5 of the parent task will detect a corrupt schema and trigger the restore in this skill.

## Atomicity & rollback

- The pre-write copy at `memory/snapshots/<YYYYMMDD>-pre-review/schema.sql` is created by `5_weekly_theme_review` Step 0.5. This skill **assumes** that snapshot exists; it errors out if it does not (so a human cannot accidentally run apply-schema-edit without the rollback target in place).
- Write is atomic: `schema_path.tmp` + `os.replace`.
- On any post-write failure (parse error during validation, `update_pages.bat` rebuild failure, integrity check failure), the caller is expected to restore from the snapshot:
  ```bash
  cp "memory/snapshots/$(date +%Y%m%d)-pre-review/schema.sql" app/src/schema.sql
  ```

## Validation pass (always runs after the write)

Before returning success, this skill re-reads `schema_path` and runs:

1. SQLite syntax check: `sqlite3 :memory: ".read app/src/schema.sql"` — non-zero exit ⇒ fail and rollback.
2. Idempotency: `INSERT OR IGNORE INTO themes(...)` rows — re-applying the same proposal must not error.
3. Foreign-key sanity: every `category_id` referenced by a new/renamed theme exists in the `categories` seed block.

If any of the three fails, restore from `snapshot_dir/schema.sql` and exit 1.

## Failure modes

| Failure | Recovery |
|---|---|
| Snapshot missing at `snapshot_dir/schema.sql` | Abort. Caller must run `snapshot-3-time-state` first. |
| Proposal references a `theme_id` not present in `schema.sql` | Log + skip that one operation; continue with the rest. |
| Proposal `## Recommended actions` parse fails (no numbered list) | Abort. Refuse to guess. |
| SQLite syntax error after write | Restore from snapshot, exit 1. |
| `os.replace` fails (filesystem error) | The temp file remains; caller can manually `mv schema.sql.tmp schema.sql` after inspection. |

## Reference invocation (from 5_weekly_theme_review Step 5)

```
# Manual (default for human review):
python3 -m skills.apply-schema-edit \
  --proposal "memory/theme-review/theme-review-$(date +%Y%m%d).md" \
  --schema   "app/src/schema.sql" \
  --snapshot "memory/snapshots/$(date +%Y%m%d)-pre-review/" \
  --mode manual

# Auto (chained run):
... --mode auto

# Plan-only (CI / sanity test):
DRY_RUN=1 ... --mode auto
```

The actual Python implementation lives at `app/skills/apply_schema_edit.py` (loaded as a stdlib module so the `5_weekly_theme_review` orchestrator can `import` it as a function call rather than spawning a subprocess).
