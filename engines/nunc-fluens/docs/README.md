# Nunc Fluens — engine documentation

Nunc Fluens is the news pipeline engine of the nunc-stans monorepo: a
TypeScript DAG orchestrator that researches, writes, translates,
renders, gates, and publishes a daily news board into a **data
checkout** it owns (a git repo of markdown + JSON + a SQLite working
cache). It is a self-contained product; the monorepo's Formans world
view reads its exports strictly read-only.

## Where things live

- `pipeline/` — the product: CLI (`nunc-fluens`), orchestrator steps,
  deterministic renderers, gates, schemas, goldens, systemd units.
- `pipeline/prompts/` — runtime LLM prompt sources (skill contracts,
  writer rules, `memory-policy.md`); normally-editable behavior files.
- `dashboard/` — the reader-facing dashboard (static `index.html` +
  `assets/`), shipped as **engine code**. Instances carry data only
  (post-C P2); the dashboard is combined with an instance's exports at
  deploy/stage time.
- `design/` — living design docs (`decisions/` ADRs,
  `sourcedata-layout.md`); `design/archive/` is the frozen spec corpus
  the port was written against (provenance in `design/README.md`).
- `INTEGRATION.md` — lineage note (what this engine is a port of, and
  why there is no integration relationship to document).

## Running it

```
just news-link <dir>        # designate the read-only view checkout
just news-sandbox <dir>     # disposable run instance (clone + seeded store)
just news-daily <sandbox>   # one pipeline run against the sandbox
nunc-fluens migrate-layout <dir>   # convert an old-shape instance to data/
just news-schedule <sandbox> [oncalendar]  # systemd user timer
```

Runs never write the view checkout (redirection): they target sandbox
instances, which are migrated to the product data layout at creation.

## The data-checkout layout

New instances use the product layout: `data/daily-news/`,
`data/future-prediction/`, `data/memory/`, `data/reference/`,
`data/exports/` (graphs + manifest + snapshots + prefix-tokens),
`data/archives/snapshots/` (gitignored), with `README*.md` and
`references.txt` at the root and `app/sourcedata/` + `app/data/`
deliberately unmoved (DB rel-path identity). The **view side supports
both shapes forever**: `tools/build-world.ts` probes `data/exports/`
first and falls back to the legacy `docs/data/` of old news-shaped
checkouts.

## Deploying an instance dashboard

An instance is data-only. To publish a reader-facing dashboard,
combine this engine's `dashboard/` (as the site root) with the
instance's `data/exports/` mounted at `data/` — that is exactly the
layout `tools/build-world.ts` stages locally under
`frontend/nunc-stans-formans/public/world-graph/`. Hosting it (e.g.
GitHub Pages via an Actions artifact deploy of those two pieces) is
the deployer's concern post-fork; this repo ships no Pages workflow.
