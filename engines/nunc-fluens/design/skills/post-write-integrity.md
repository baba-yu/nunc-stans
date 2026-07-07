# Skill: post-write-integrity

Strip trailing-NUL bridge corruption + flag mid-content writer-cap truncation. Shared by `1_daily_update`, `2_future_prediction`, `4_weekly_memory`, `5_weekly_theme_review`.

## Why this is its own skill

Both corruption modes (NUL-tail from the Windows ⇄ sandbox bridge re-write, and mid-content truncation when `max_tokens` fires) have repeatedly bitten the project (`report/ja/news-20260422.md`, `report/en/news-20260426.md`, the README failure in commit `35b7a64`). Inlining the same Python in 4 different orchestrators creates 4 places where a fix has to land. One skill, one fix.

## Inputs / outputs

| Name | Source | Required |
|---|---|---|
| `path` | path to the file just written (one or many; pass repeatedly or via `--paths-file`) | yes |
| `kind` | `news` \| `future-prediction` \| `dormant` \| `theme-review` \| `readme` \| `dashboard-asset` (sets the structural-completeness rule) | yes |

Stdout: one line per file: `OK <path>`, `REPAIRED <path>: stripped N trailing NUL byte(s)`, or `FAIL structural completeness: <path>` followed by one error line per detected issue. Exit 1 on any structural failure or on second-repair-in-a-row. Exit 0 on OK or single repair.

## Two-stage check

1. **Bridge integrity** — read the file as bytes; if it ends in NUL or has NULs in the last 512 bytes, atomically truncate them via `path.tmp` + `os.replace`. Print `REPAIRED`.
2. **Structural completeness** — apply the `kind`-specific check:

| Kind | Required H2 sections | Tail rule |
|---|---|---|
| `news` | `## Headlines`, `## Future`, `## Change Log`, `## News`; `## Future` ≥ 3 numbered items | trailing newline; no unclosed `[…](` link, balanced `**` |
| `future-prediction` | `## Checking Predictions Against Reality`, `## Summary of Findings`, `## Relation to My Own Predictions` | validation table consistent column count + closing blank line; trailing newline; balanced `**` |
| `dormant` | `# Dormant pool — week ending YYYY-MM-DD`, `## Tier: Dormant …`; tier table consistent column count | tail tells (unclosed table row, balanced `**`); trailing newline |
| `theme-review` | `## Empty / underused themes`, `## Overpopulated themes`, `## Theme candidates`, `## Recommended actions`; ≤ 5 items in `## Recommended actions` | last action item ≥ 20 chars and not ending in `(` `[` `→`; balanced `**`/`` ` `` |
| `readme` | each `## YYYY-MM-DD` block has `### News` and `### Predictions check` with terminating `[news-…](report/<L>/…)` and `[future-prediction-…]` links | file ends with `\n---\n*\Z`; balanced `**`; no unclosed link |
| `dashboard-asset` | `docs/index.html` ends with `</html>`; `docs/assets/app.js` ends with `})();` (allow optional `;`); `docs/assets/styles.css` ends with `}` | (no NUL via stage 1) |

## Repair-twice abort

If stage 1 produces a `REPAIRED` outcome **twice in a row for the same path within one run**, exit 1. The bridge is in a degraded state and the orchestrator should escalate to a human rather than write a third time.

## Reference invocation

```bash
python3 -m app.skills.post_write_integrity \
  --kind news \
  --path "report/en/news-$(date +%Y%m%d).md"

python3 -m app.skills.post_write_integrity \
  --kind dashboard-asset \
  --path docs/index.html \
  --path docs/assets/app.js \
  --path docs/assets/styles.css
```

The implementation is in `app/skills/post_write_integrity.py`. Existing inline Python blocks in `1_daily_update.md`, `2_future_prediction.md`, `4_weekly_memory.md`, `5_weekly_theme_review.md` (and the `## Post-Write Structural Completeness Check` blocks therein) should be replaced with a call to this skill once Phase 3 H1/H2 lands.
