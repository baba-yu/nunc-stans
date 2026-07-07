# nunc-fluens instance

This directory is a nunc-fluens data instance — one profile's inputs and
published outputs, tracked as its own git repository. It was created by
`nunc-fluens init` from the engine's instance template.

- `data/sourcedata/` — the pipeline's daily JSON artifacts (one dir per date)
- `data/daily-news/`, `data/future-prediction/` — rendered daily reports
- `data/memory/` — dormant pool, theme reviews, weekly snapshots
- `data/reference/` — editorial policy files (seeded; edit to taste)
- `data/exports/` — dashboard data exports
- `store/` — runtime state (ignored: analytics DB, run logs, config override)

Daily runs rewrite this README as a 3-day report window:

    NS_INSTANCE=<this dir> nunc-fluens run

Bring an existing news-shaped checkout's data over with
`nunc-fluens import <src> <this dir>`.
