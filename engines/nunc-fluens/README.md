# Nunc Fluens

The news pipeline engine of the nunc-stans monorepo: a TypeScript DAG
orchestrator (`nunc-fluens`) that researches, writes, translates (en +
ja/es/fil), renders, gates, and publishes a daily news board — future
predictions plus their day-by-day validation — into a git **data
checkout** it owns. Formerly the port of a personal news-research
prototype; the two diverged permanently at Phase C (see
[INTEGRATION.md](INTEGRATION.md) for the lineage note).

## Quickstart

From the monorepo root (see `justfile`):

```
just news-link <dir>       # designate the read-only view checkout
just news-sandbox <dir>    # create a disposable run instance
just news-daily <sandbox>  # run today's DAG against it
just news-schedule <sandbox>  # install the daily systemd user timer
```

Tests: `pnpm -C engines/nunc-fluens/pipeline test` (self-regression
against the synthetic golden corpus under `pipeline/goldens/`).

## Data-shape guarantee

Instances use the product layout — the publish tree under `data/`
(`daily-news/`, `future-prediction/`, `memory/`, `reference/`,
`exports/`, `archives/`), `README*.md` + `references.txt` at the root,
and `app/sourcedata/` + `app/data/` unmoved. The pipeline's run side is
single-shape: `sandbox` migrates old-shape clones at creation and
`nunc-fluens migrate-layout <dir>` converts existing instances.

The **view side reads both shapes, forever**: an OLD news-shaped
checkout (`report/`, `docs/data/`) remains a first-class world-view
source — `tools/build-world.ts` probes `data/exports/` and falls back
to `docs/data/`. That compatibility is a product guarantee, not a
transition aid.

## More

- [docs/README.md](docs/README.md) — engine documentation index
  (layout, running, deploying an instance dashboard).
- [INTEGRATION.md](INTEGRATION.md) — lineage note.
- `dashboard/` — the reader-facing dashboard, shipped as engine code
  (instances carry data only).
