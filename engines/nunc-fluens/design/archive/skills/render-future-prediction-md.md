# Skill: render-future-prediction-md

Deterministic Jinja2 renderer that turns the per-date sourcedata JSON files into `future-prediction/<locale>/future-prediction-YYYYMMDD.md`. **No LLM.** The renderer is the single producer of the rendered FP markdown post-Phase-3.

## When to call

After these are written for the day:

  * `app/sourcedata/<date>/bridges.json`  (validation rows + bridge narratives)
  * `app/sourcedata/<date>/summary.json`  (optional; the three trailing prose blocks)

…and (for non-EN locales) the locale variants under `app/sourcedata/locales/<date>/<locale>/`.

## Inputs

| Name | Source | Required |
|---|---|---|
| `repo_root` | repo root path | yes |
| `date` | ISO date YYYY-MM-DD | yes |
| `locale` | `en` \| `ja` \| `es` \| `fil` | yes (default `en`) |

## Outputs

`future-prediction/<locale>/future-prediction-YYYYMMDD.md`. Atomic (`tmp` + `os.replace`). Includes the AI-notice header keyed by locale.

## Public API

```python
from app.skills.render_future_prediction_md import render_day, render_and_write

md = render_day(repo_root, "2026-05-04", "en")
out_path = render_and_write(repo_root, "2026-05-04", "en")
```

CLI:

```bash
python -m app.skills.render_future_prediction_md --date 2026-05-04 --locale en --write
```

## Output structure (per `design/sourcedata-layout.md §Markdown rendered shape`)

```
# Future Prediction Validation Report YYYY-MM-DD

<!-- ai-notice -->
> **Note:** ... (locale-localized)

Coverage window: predictions from <start> through <end> ...

## Validation findings

| Prediction (summary) | Prediction date | Today's relevance | Evidence summary | Reference link(s) |
| --- | --- | --- | --- | --- |
| <short_label> | <prediction_date> | N | <summary> | [<label>](<url>), ... |

## Bridge

On the "<short_label>" prediction (<prediction_date>): <narrative>

On the "<short_label>" prediction (<prediction_date>): <narrative>

## Summary (Plain Language)
<plain_language prose>

## Summary of Findings
<findings prose>

## Relation to My Own Predictions
<relation_to_my_preds prose>
```

The `## Validation findings` section keeps the structured table (it's a structured datum that markdown handles natively) but renames the legacy `## Checking Predictions Against Reality` header. The `## Bridge` paragraphs reference predictions by `short_label + date`, never by `Pred ID #N`. The `Coherence N/5` integer + `Remaining gap:` field live in `bridges.json` only — the renderer does NOT emit them in markdown.

## Forbidden tokens

Same as `render-news-md`: never produces `Pred ID #N`, `Coherence N/5`, `Remaining gap:`, `**Bridge (...)**` parser anchor, `Stream A/B/C/D/E/F/J/K`, etc. The lint check (`lint-markdown-clean`) is the post-render gate.

## Summary file shape

`app/sourcedata/<date>/summary.json` is a sibling of `bridges.json` carrying the three trailing prose blocks. Schema (all keys optional; missing keys → renderer skips that section):

```json
{
  "plain_language":       "<short prose>",
  "findings":             "<multi-paragraph prose>",
  "relation_to_my_preds": "<multi-paragraph prose>"
}
```

This sibling shape (rather than extending `bridges.json`) keeps the per-row bridge data separable from the report-level summary.

## Implementation

`app/skills/render_future_prediction_md.py` + `app/templates/future_prediction.md.j2`. Soft-imports `jinja2` (same rationale as `render-news-md`).
