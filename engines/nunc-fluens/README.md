# Nunc Fluens

The news pipeline engine of the nunc-stans monorepo: a TypeScript DAG
orchestrator (`nunc-fluens`) that researches, writes, translates (en +
a configured subset of ja/es/fil), renders, gates, and publishes a
daily news board — future predictions plus their day-by-day validation
— into a git **data instance** it owns. Formerly the port of a
personal news-research prototype; the two diverged permanently at
Phase C (see [INTEGRATION.md](INTEGRATION.md) for the lineage note).

## Template and instances

The engine is a TEMPLATE; your data lives in INSTANCES. The engine
ships `pipeline/instance-template/` (directory skeleton, synthetic
editorial seeds, instance `.gitignore`, README seed) and
`nunc-fluens init` stamps instances from it — one git repo per
profile. A bare name lands under the gitignored
`engines/nunc-fluens/instances/<name>/`; multiple profiles are
expected. Existing news-shaped data comes over once via
`nunc-fluens import` (the only news-shaped contact surface).

## Quickstart

From the monorepo root (see `justfile`):

```
just news-init <name|dir>          # stamp a fresh data instance from the template
just news-import <src> <instance>  # optional: copy a news-shaped checkout's data in
just news-link <instance>          # point the monorepo world view at it
just news-daily <instance>         # run today's DAG against it (NS_INSTANCE)
just news-schedule <instance>      # install the daily systemd user timer
```

`nunc-fluens run` also takes `--instance <dir>` directly and honors
`NS_INSTANCE`. Tests: `pnpm -C engines/nunc-fluens/pipeline test`
(self-regression against the synthetic golden corpus under
`pipeline/goldens/`, itself built through the real `init` routine).

## Instance layout (v2)

```
<instance>/                    one git repo per profile
  README*.md                   the product face (en + published locales)
  data/
    sourcedata/                per-day research inputs (+ locales/)
    daily-news/                the publish quartet …
    future-prediction/
    memory/
    reference/                 editorial policy (topics, glossary, restrictions)
    exports/                   graphs + manifest + snapshots + prefix-tokens
    archives/                  aged-out snapshots (gitignored)
    references.txt
  store/                       runtime state (gitignored, never committed):
    world/analytics.sqlite     the SQLite working cache
    runs/ai-runs.jsonl         the AI call log
    news-config.json           optional per-instance config override
```

The run side accepts only this shape (`init`/`import`-born); the view
side (`tools/build-world.ts`) reads only an instance's `data/exports/`.

## More

- [docs/README.md](docs/README.md) — engine documentation index
  (layout, running, deploying an instance dashboard).
- [INTEGRATION.md](INTEGRATION.md) — lineage note.
- `dashboard/` — the reader-facing dashboard, shipped as engine code
  (instances carry data only).
