# Nunc Fluens — lineage note

There is no integration relationship to document here: **nunc-stans has
no relationship to any particular news project** (Phase C redirection,
owner decision 2026-07-06). This engine is a self-contained product with
its own data model: the engine is a TEMPLATE, and all data lives in
**instances** — per-profile git repos stamped by `nunc-fluens init`
(post-C REDO V2, 2026-07-07). The one remaining news-shaped contact
surface is **`nunc-fluens import <src> <instance>`**, a one-time,
read-only copy of a news-shaped checkout's data into an instance; the
mapping of the old layout lives only inside that command. The Formans
world view reads a designated instance (`just news-link <instance>`,
config `news_repo`, env override `NS_NEWS_REPO`) strictly read-only,
`data/exports/` only — the old-shape view fallback was removed with the
V2 split. The stable contract is the data **shape**, held by the schemas
in `pipeline/src/schemas/` and exercised by the test fixtures. Post-C
the dashboard is product code (`dashboard/` in this engine — instances
carry data only).

(Deletion proposal D2 in
`design/development/2026-07-06-post-c-plan.md` suggests folding this
file into the engine README/docs and deleting it — the owner's call.)

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

The pipeline never writes any news-shaped checkout. Runs target a
**data instance** (`just news-init <name|dir>`, optionally seeded from
a news checkout with `just news-import <src> <instance>`); see the
`justfile` recipes `news-daily` / `news-schedule` (both take the
instance; the CLI honors `--instance` / `NS_INSTANCE`). The
`analytics.sqlite` working cache and the AI run log live in the
instance's gitignored `store/`, never in this repo. Instance model
summary: one git repo per profile (default home the gitignored
`instances/<profile>/` in this engine), `data/{sourcedata, daily-news,
future-prediction, memory, reference, exports, archives}` +
`data/references.txt`, `README*.md` at the root, runtime state in
`store/` (`world/analytics.sqlite`, `runs/ai-runs.jsonl`, optional
`news-config.json` override).
