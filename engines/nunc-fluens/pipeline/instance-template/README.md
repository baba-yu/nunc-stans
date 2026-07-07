# nunc-fluens instance

This directory is a nunc-fluens data instance — one profile's inputs and
published outputs, accumulating as plain local files. It was created by
`nunc-fluens init` from the engine's instance template.

- `instance.json` — the birth stamp (created date + import record)
- `data/sourcedata/` — the pipeline's daily JSON artifacts (one dir per date)
- `data/daily-news/`, `data/future-prediction/` — rendered daily reports
- `data/history/` — dormant pool, theme reviews, weekly snapshots, and the
  citation ledger `reference-history.log`
- `data/reference/` — editorial policy files (seeded; edit to taste)
- `data/exports/` — dashboard data exports
- `store/` — disposable runtime state (analytics DB, run logs, config override)

Daily runs rewrite this README as a 3-day report window:

    NS_INSTANCE=<this dir> nunc-fluens run

Bring an existing news-shaped checkout's data over with
`nunc-fluens import <src> <this dir>`.

Versioning and backup are yours to choose — the pipeline never creates
or requires a git repository here. If you version the instance
yourself, ignore `store/` and `data/archives/` (disposable runtime
state and aged-out snapshots).
