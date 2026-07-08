# Naming map (2026-07)

The product is **Nunc Stans**; the monorepo is `~/nunc-stans`. The
integrated UI is **Nunc Stans Formans** (`frontend/nunc-stans-formans/`,
assembled in Phase B; never abbreviated to "formans"). The self-scope engine
is `engines/nunc-stans` (crate `nunc-stans-engine`); the news engine is
`engines/nunc-fluens` — *nunc fluens*, the flowing now, paired with *nunc
stans*, the standing now. manda and fourfive keep their names. The name
"federation" is retired.

| Old | New |
|---|---|
| federation (the system) | Nunc Stans |
| the federation layer / agreement | the contracts layer |
| federation edge / FederationEdge | edge / Edge |
| federation ID / federation-id / `valid_federation_id` | scope ID / scope-id / `valid_scope_id` |
| Federation Constitution | Nunc Stans Constitution (`design/constitution/constitution.md`) |
| Federation:Phase N | Pre-v1 Phase N |
| FED_DATA | NS_DATA override, or the app-configured store (deprecated fallback kept one phase) |
| ~/federation-data (fixed path) | a **user-designated data store** (workspace model: `just bootstrap <dir>` initializes any folder and the app config remembers it; no path convention exists) |
| ~/federation (repo) | ~/nunc-stans |
| ~/nuncstans (design repo) | absorbed; archived at ~/old/nuncstans-design-repo |
| nuncstans / NuncStans | nunc-stans / Nunc Stans (hyphenation) |
| engines/nuncstans, crate nuncstans-engine | engines/nunc-stans, crate nunc-stans-engine |
| News (the stack), engines/news | Nunc Fluens, engines/nunc-fluens (commit area `nf`) |
| ~/news (external repo) | **keeps its name and leaves the picture** — the Phase C rename was superseded by the 2026-07-06 redirection: the news project and nunc-stans are unrelated; `~/news` runs on independently as the owner's news board. Since the 2026-07-07 template/instance split the product's only news-shaped contact surface is `nunc-fluens import` (a one-time, read-only copy into a data instance). "nunc-fluens" names the engine only. |
| NEWS_WORLD (env) | retired 2026-07-06 — `tools/build-world.ts` resolves the view source via `news_repo` config / `NS_NEWS_REPO` |
| `news_repo` (config key) = "the news checkout (read-only view source)" | **same key, new semantics 2026-07-07**: the nunc-fluens data instance shown in the world view — build-world reads its `data/exports/` only; the old-shape `docs/data` view fallback is removed (import is the only news-shaped contact surface) |
| NS_SANDBOX (env) | NS_INSTANCE — the run target is a data instance (post-C REDO V2, 2026-07-07) |
| `nunc-fluens sandbox` / `migrate-layout` / `migrate-db` (commands) | retired 2026-07-07 — `nunc-fluens init` stamps an instance from the engine template (`pipeline/instance-template/`); `nunc-fluens import <src> <instance>` absorbs the old-shape mapping and the DB seed |
| `just news-sandbox` / `just news-migrate-db` (recipes) | `just news-init` / `just news-import`; `news-daily` and `news-schedule` now take an instance |
| nuncstans-agent | nunc-stans-agent (`agents/nunc-stans-agent`, Phase D) |
| integrated UI ("shell") | Nunc Stans Formans — `frontend/nunc-stans-formans` (Phase B) |
| GitHub remote (new, monorepo) | baba-yu/nunc-stans |
| engines/news/FEDERATION.md | engines/nunc-fluens/INTEGRATION.md |
| design/federation/ | design/constitution/ (journeys moved to design/stories/) |
| htas-positioning-in-federation.md | htas-positioning-in-nunc-stans.md |
| the external user-designated store ("no path convention exists") | **defaults to in-repo `<repo>/data/`** (gitignored — FD-3.2's no-data-in-git intent holds via the ignore; R13 2026-07-07). `NS_DATA` / config `data_dir` still designate a store kept elsewhere; `just bootstrap <dir>` writes the config |
| `publish` step (git add/commit/push in daily runs) + Sunday `commitOnly` | retired 2026-07-07 (R9/R10) — instances are git-less plain data directories; steps just write files, and `run.json` is written once by the dag at end of run |
| `data/memory/` + `data/references.txt` (instance layout) | `data/history/` + the citation ledger `data/history/reference-history.log` (R12, 2026-07-07) |
| "profile" = a nunc-fluens data instance (old engine docs, instances/<profile>/) | **profile = an AI configuration record** (provider/model/prompt/skills/memory-scope/verify — Phase D); a data instance is an *instance*, `instances/<name>/` (PD4, 2026-07-07) |
| (new area) | `agent` = `agents/**` (agents/nunc-stans-agent, Phase D) — commit-scope + CI registered |

Rule IDs (`F1`–`F15`, `FD-x.y`, `NS-x`, `Inv N`) are retained as opaque
historical identifiers; the letters no longer expand to anything.

Permanent exception: the commitment slug `federation-local`
(`self/commitment/2026-06-federation-local` in the vault) is historical,
append-only data and is never renamed; documents may quote it.
