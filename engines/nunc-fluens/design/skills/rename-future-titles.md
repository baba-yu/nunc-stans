
Date range is hard-coded to 2026-04-19..2026-05-04 (this is a one-shot backfill, not parameterized for general use). The `--replies-file` for `dry-run` is a plain text file: 48 lines, each in the EN reply contract format (`OK <pid> ...` / `KEEP <pid>` / `FAIL <pid> <reason>`).

### Typical execution sequence (parent-driven)

1. Parent: `python -m app.skills.rename_future_titles scan` → 48 targets.
2. Parent: for each of 16 dates, `bundle --kind en --date <D>` → 3 bundles, dispatched as 3 parallel Task sub-agents. Total 48 sub-agents (across 16 dates, batched per harness limit, e.g. 16 parallel × 3 rounds).
3. Parent: collect 48 reply lines into a temp file.
4. Parent: `dry-run --replies-file <tmp>` → `.tmp/rename-titles-dryrun.json` + console table. **User review gate.**
5. Parent: `apply-en --from-file .tmp/rename-titles-dryrun.json` (after user approval). Commit 2.
6. Parent: for each (date, locale) — 48 cells — `bundle --kind locale --date <D> --locale <L>` → bundle, dispatch sub-agent, get JSON reply, `apply-locale --date <D> --locale <L> --json-file <reply>`. Commit 3.
7. Parent: `rerender` → all rerender + ingest + export. Commit 4.
8. Parent: `verify` → all gates green. (Tests already shipped in commit 1.)

## Validation gates (parent-enforced)

| Gate | Command / check | When |
|---|---|---|
| Schema (per file) | `PredictionsFile.from_dict(payload)` | After every JSON write |
| ID round-trip | SHA-1(`prediction_date` + `summary`)[:16] == JSON `id` for all 48 entries | After EN apply |
| Markdown lint | `python -m app.skills.lint_markdown_clean report/` | After rerender |
| Markdown integrity | `python -m app.skills.post_write_integrity --kind news` per file | After rerender |
| Daily flow check | `python -m app.skills.daily_flow_check --date 2026-05-04 --strict` | After full pipeline |

## Commit boundaries (4 atomic commits)

| # | Scope | Suggested message |
|---|---|---|
| 1 | Orchestrator module + full test file (TDD-first; tests pass against orchestrator before any data changes) | `rename-future-titles: orchestrator + tests` |
| 2 | EN 48 entries `app/sourcedata/<date>/predictions.json` × 16 | `rename-future-titles: en titles applied (48 entries)` |
| 3 | Locale 144 entries `app/sourcedata/locales/<date>/<L>/predictions.json` × 48 | `rename-future-titles: locale titles applied (144 entries)` |
| 4 | Rerender outputs + DB + graph | `rename-future-titles: rerender + db reingest + graph export` |

`design/skills/rename-future-titles.md` (this file) is gitignored by project convention; the tracked design rationale is `moushiokuri-rename-future-titles.md` at repo root. Commit 1 ships the full orchestrator module + tests (TDD); commits 2–4 ship data and rerender artifacts.

## Tests (`app/tests/test_rename_future_titles.py`)

| Test | Asserts |
|---|---|
| `test_parse_en_reply` | `OK <pid> <title>` / `KEEP <pid>` / `FAIL <pid> <reason>` parser; malformed → `ValueError` |
| `test_parse_locale_reply` | JSON object parsed; missing/extra pids → `ValueError`; non-JSON → `ValueError` |
| `test_dry_run_idempotent` | Two `dry-run --replies-file <fixture>` invocations on the same fixture produce byte-identical `.tmp/rename-titles-dryrun.json` (modulo `generated_at`, which is mocked or excluded from the diff) |
| `test_apply_preserves_id` | Mutate title in real-corpus fixture; re-hash via `_hash_id`; assert `id` unchanged for all 48 entries |
| `test_apply_preserves_summary_and_body` | After apply, `summary` and `body` strings are byte-identical to pre-apply |
| `test_rerender_uses_new_title` | Fixture sourcedata with rewritten title; run `render_news_md`; assert `## Future` numbered list line 1 contains new title verbatim |

## Out of scope (explicit non-goals)

- Changing `scope_id` / theme assignment (separate `moushiokuri` task — see "並列タスク" section in `moushiokuri-rename-future-titles.md`).
- Rewriting `summary` / `body` / `reasoning` (would destroy `prediction_id`).
- Updating `docs/data/snapshots/<date>/graph-*.json` (point-in-time history, intentionally frozen).
- Building `app/skills/translate_sourcedata.py` (this skill is one-shot backfill; that skill is for the recurring daily flow and will be built lazily on its own moushiokuri).
- Touching `prediction_short_label` (derived from `summary` via `app/skills/backfill_short_labels.py`; orthogonal to title rules).
- Touching `app/sourcedata/<date>/bridges.json` / `needs.json` (reference predictions by `id` / `short_label`, both unchanged).
