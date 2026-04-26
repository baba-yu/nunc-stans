# Future Prediction Dashboard — Reader's Guide

This is a guided tour of what the dashboard shows, where its numbers come
from, and the small set of rules that turn raw daily reports into the
clusters and grass-level meters you see on screen. It is descriptive
rather than prescriptive — read it once and the visuals stop being a
black box.

## What the dashboard shows

The graph view is a three-layer tree: **categories** sit at the top,
**themes** sit underneath their parent category, and individual
**predictions** hang off the themes they best match. Each node carries a
small panel of per-window metrics and a status colour. Edges are the
parent-child links plus optional secondary-parent links when a
prediction also fits a sibling theme well enough to be worth showing in
both places. Three windows are computed in parallel — `7d`, `30d`,
`90d` — so the same node can read "hot this week, cooling over the
quarter" simply by switching the window selector.

## Where the data comes from

Two daily artefact streams feed the dashboard. The first is the
news log at `report/<locale>/news-YYYYMMDD.md`, which contains the
day's curated articles plus a `## Future` section with three numbered
predictions. The second is the validation log at
`future-prediction/<locale>/future-prediction-YYYYMMDD.md`, which
re-cites past predictions with a 1-5 relevance score and reference
URLs. The English files (`report/en/`, `future-prediction/en/`) are
the canonical source — they drive identity, matching, and metric
computation. Sibling-locale files only fill localized label columns.

## How predictions get clustered into themes

When a prediction enters the system, the matcher tokenizes its English
summary and computes an **IDF-weighted overlap** against each theme's
English description plus keyword set. Tokens that show up in many
themes (e.g. *agent*, *ai*) are downweighted so a prediction can't pile
into whichever theme has the longest description. The theme with the
highest score wins as the **primary parent**. Any other theme whose
score is at least 0.55× the primary's score becomes a **secondary
parent**, so genuinely cross-cutting predictions surface in more than
one cluster instead of being shoehorned into one. See
`SECONDARY_THEME_THRESHOLD` in `app/src/export.py`.

## How metrics are computed

Per window (`7d` / `30d` / `90d`) and per theme/category, the dashboard
shows a bundle of scores derived from the validation tables. The
formulas live in `app/src/analytics/scoring.py`:

```
new_signal        = min(1, Σ relevance_normalized for new evidence / 3.0)
continuing_signal = min(1, Σ relevance_normalized for continuing evidence / 5.0)
attention_score   = min(1, new_signal + 0.5 × continuing_signal)
realization_score = 0.65 × mean(new_relevance) + 0.35 × mean(continuing_relevance)
grass_level       ∈ {0,1,2,3,4} by attention_score breakpoints 0.05 / 0.25 / 0.50 / 0.75
status            ∈ {new, active, continuing, dormant}
```

`relevance_normalized` is the 1-5 score divided by 5 (so a 5 contributes
1.0 to the sum, a 1 contributes 0.2). `new` evidence is a row whose
prediction first appeared inside the window; `continuing` evidence is a
re-cite of an older prediction.

## What relevance means

Relevance is a 1-5 judgement on each validation row: **5** = today's
news clearly confirms the prediction; **3** = adjacent or partial
match; **1** = no signal, the prediction is being kept alive only by
the periodic re-check. The same number drives the dormant-pool tier
transitions described in `design/memory-policy.md` — a relevance-4
hit pulls a prediction out of dormancy, two consecutive low pings push
it deeper.

## Why frequency matters

Both `new_signal` and `continuing_signal` **sum** their inputs before
clamping to 1. So three relevance-5 hits read stronger than one — the
sum reaches 3.0 and saturates the new-signal cap, dragging
`attention_score` to its ceiling. One relevance-5 hit only contributes
1.0 / 3.0 ≈ 0.33. This is by design: the dashboard's earlier `max`-based
attention saturated everything to 1.0 after a single hit, which made
"a topic is dominating this week" indistinguishable from "a topic was
mentioned once". Replacing `max` with a sum-and-cap restored the
ranking.

## Snapshot navigation

The dashboard's **SNAP** dropdown lets readers compare the live
clusters against past Sundays. Each Sunday's pre-review job captures
the post-Job-3 dashboard state into `docs/data/snapshots/<YYYYMMDD>/`,
and `docs/data/snapshots/index.json` lists which dates are available.
Only the latest five Sundays are kept on disk; the rest age out. This
is enough to scrub through a month of history and see how a theme
moved week over week without re-running anything.

## Locale awareness

Text labels (theme names, prediction summaries, category labels) are
translated. Numeric values are not — matching, clustering, and metric
computation all run on English summaries, so a Japanese reader and an
English reader see the same numbers. If a translation for a given node
isn't present, the English label shows in its place rather than a
blank.

## Where to look in the codebase

- `app/src/analytics/scoring.py` — the scoring functions referenced above.
- `app/src/ingest.py` — the IDF token-overlap matcher and the
  prediction-identity logic.
- `app/src/export.py` — produces `docs/data/graph-{tech,business,mix}.json`,
  including the secondary-parent expansion at the 0.55 threshold.
- `docs/assets/app.js` — the dashboard renderer that consumes those graph
  JSONs and draws the tree, panel, and SNAP control.
