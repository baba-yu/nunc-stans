# Nunc Fluens — engine documentation

Nunc Fluens is the news pipeline engine of the nunc-stans monorepo: a
TypeScript DAG orchestrator that researches, writes, translates,
renders, gates, and publishes a daily news board into a **data
instance** it owns (a git repo of markdown + JSON, with a gitignored
`store/` for the SQLite working cache and run logs). It is a
self-contained product; the monorepo's Formans world view reads one
instance's exports strictly read-only.

## Where things live

- `pipeline/` — the product: CLI (`nunc-fluens`), orchestrator steps,
  deterministic renderers, gates, schemas, goldens, systemd units.
- `pipeline/instance-template/` — the instance TEMPLATE: directory
  skeleton (`data/…` + `.gitkeep`s), synthetic editorial seeds
  (`news-topics.md`, `citation-restrictions.md`, `glossary.yml`),
  the instance `.gitignore` (`store/`, `data/archives/`), and the
  README seed. `nunc-fluens init` stamps data instances from it.
- `pipeline/prompts/` — runtime LLM prompt sources (skill contracts,
  writer rules, `memory-policy.md`); normally-editable behavior files.
- `dashboard/` — the reader-facing dashboard (static `index.html` +
  `assets/`), shipped as **engine code**. Instances carry data only
  (post-C P2); the dashboard is combined with an instance's exports at
  deploy/stage time.
- `instances/` — the default (gitignored) home for data instances:
  one git repo per profile, stamped by `nunc-fluens init`.
- There is no engine `design/` corpus anymore (retired 2026-07-07; git
  history keeps it) — the living contracts are the schemas
  (`pipeline/src/schemas/`) and the runtime prompts (`pipeline/prompts/`).
- `INTEGRATION.md` — lineage note (what this engine is a port of, and
  why there is no integration relationship to document).

## Running it

```
just news-init <name|dir>          # stamp an instance from the template
just news-import <src> <instance>  # optional: copy news-shaped data in (once)
just news-link <instance>          # point the world view at an instance
just news-daily <instance>         # one pipeline run (NS_INSTANCE)
just news-schedule <instance> [oncalendar]  # systemd user timer
```

`nunc-fluens run` refuses to start without an instance (`--instance`
flag or `NS_INSTANCE`) and accepts only init/import-born v2 shapes.
News-shaped checkouts are never run directly: `nunc-fluens import`
copies their data into an instance (source read-only, one import
commit) — that command is the only place old-shape knowledge survives.

## The instance layout (v2)

An instance carries `data/sourcedata/` (per-day research inputs, incl.
locale fan-outs and each day's `run.json`), the publish quartet
`data/daily-news/`, `data/future-prediction/`, `data/memory/`,
`data/reference/`, plus `data/exports/` (graphs + manifest + snapshots
+ prefix-tokens), `data/archives/` (aged-out snapshots, gitignored),
`data/references.txt`, and `README*.md` at the root. Runtime state
lives in a gitignored `store/`: `world/analytics.sqlite`,
`runs/ai-runs.jsonl`, and an optional `news-config.json` override
(when present it wins over the main store's copy that the gate/drawer
edit). The view side reads `data/exports/` only.

## Deploying an instance dashboard

An instance is data-only; the publish root is a combination of the two
pieces. To publish a reader-facing dashboard, take this engine's
`dashboard/` as the site root and mount the instance's `data/exports/`
at `data/` — that is exactly the layout `tools/build-world.ts` stages
locally under `frontend/nunc-stans-formans/public/world-graph/`.
Hosting it (e.g. GitHub Pages via an Actions artifact deploy of those
two pieces) is the deployer's concern post-fork; this repo ships no
Pages workflow.
