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
| ~/news (external repo) | **keeps its name and leaves the picture** — the Phase C rename was superseded by the 2026-07-06 redirection: the news project and nunc-stans are unrelated; `~/news` runs on independently as the owner's news board. The product only knows "a news-shaped data checkout" (`just news-link <dir>`, read-only) — that the owner points it at ~/news today is user config, not architecture. "nunc-fluens" names the engine only. |
| NEWS_WORLD (env) | retired 2026-07-06 — `tools/build-world.ts` resolves the checkout via `news_repo` config / `NS_NEWS_REPO` |
| nuncstans-agent | nunc-stans-agent (`agents/nunc-stans-agent`, Phase D) |
| integrated UI ("shell") | Nunc Stans Formans — `frontend/nunc-stans-formans` (Phase B) |
| GitHub remote (new, monorepo) | baba-yu/nunc-stans |
| engines/news/FEDERATION.md | engines/nunc-fluens/INTEGRATION.md |
| design/federation/ | design/constitution/ (journeys moved to design/stories/) |
| htas-positioning-in-federation.md | htas-positioning-in-nunc-stans.md |

Rule IDs (`F1`–`F15`, `FD-x.y`, `NS-x`, `Inv N`) are retained as opaque
historical identifiers; the letters no longer expand to anything.

Permanent exception: the commitment slug `federation-local`
(`self/commitment/2026-06-federation-local` in the vault) is historical,
append-only data and is never renamed; documents may quote it.
