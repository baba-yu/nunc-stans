# Nunc Fluens — lineage note

There is no integration relationship to document here: **nunc-stans has
no relationship to any particular news project** (Phase C redirection,
owner decision 2026-07-06). This engine is a self-contained product; what
it consumes is a *news-shaped data checkout* — a directory the user
designates with `just news-link <dir>` (config `news_repo`, env override
`NS_NEWS_REPO`), read strictly read-only for the Formans world view. The
stable contract is the data **shape**, held by the schemas in
`pipeline/src/schemas/` and exercised by the test fixtures. Post-C the
dashboard is product code (`dashboard/` in this engine — instances carry
data only), and the view side reads the exported graphs from either
layout: the product's `data/exports/graph-*.json` or the legacy
`docs/data/graph-*.json` of old news-shaped checkouts (supported
forever), plus `app/sourcedata/` day files in both.

## Lineage

The pipeline is a TypeScript port of a personal news-research prototype
(the owner's `~/news`, a conversational-agent + Python stack). That
prototype keeps running independently as the owner's news board; it and
this product diverged permanently at Phase C — no cutover, no rename, no
resync (the re-sync recipe that used to live in this file is retired).
This engine's job going forward is different in kind: investigation
targets are configurable rather than a fixed daily routine, and its data
exists to ground decisions (fourfive sessions, strategy-making — the
constitution's world→self provenance loop, F9).

- `pipeline/` — the product: DAG orchestrator (`bin nunc-fluens`),
  deterministic steps, LLM step contracts, schemas, goldens, systemd
  units. See the Phase C plan
  (`design/development/2026-07-05-phase-c-plan.md`).
- `pipeline/prompts/` — the runtime LLM prompt sources (skill contracts,
  writer rules, `memory-policy.md`), read by the orchestrator on live
  runs; normally-editable behavior files (post-C reorganization).
- `design/` — living engine design docs (`decisions/` ADRs,
  `sourcedata-layout.md`); `design/archive/` holds the rest of the frozen
  spec corpus the port was written against (imported at Phase C T0,
  provenance in `design/README.md`).
- `app/` — the frozen Python oracle the port was validated against,
  byte-for-byte via `pipeline/goldens/`. Frozen at upstream `17682e9`
  plus two recorded determinism fixes; **deleted at Phase C T12** (git
  history keeps it). No further drift-sync happens.

## Running it

The pipeline never writes the view checkout. Runs target a disposable
**sandbox instance** (`just news-sandbox <dir>` — a local clone of the
view checkout plus its own seeded data store); see the `justfile`
recipes `news-daily` / `news-schedule`. The `analytics.sqlite` working
cache lives in the run target's data store
(`<store>/world/analytics.sqlite`), never in this repo.
