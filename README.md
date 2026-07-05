# nunc-stans

**Nunc Stans** — a local-first personal system: AI reads the world and
proposes futures worth committing to (nunc-fluens); you choose or write your
own future and put resources behind it (the nunc-stans engine — the self
ledger); together you turn the path into small apps (fourfive) that human
and agent use side by side. The integrated UI where that forming happens is
**Nunc Stans Formans** (`frontend/nunc-stans-formans/`, arrives in Phase B).

Local-first, BYOL (bring your own models and keys), one vault per user.
Targets Ubuntu (native/WSL2), Windows 11, and macOS.

## Quickstart

```sh
just bootstrap            # doctor + data-store init (or: sh tools/bootstrap.sh)
export NS_DATA=~/nunc-stans-data
just up                   # build + serve on http://127.0.0.1:8720
```

## Layout

| Path | What |
|---|---|
| `engines/nunc-stans` | Rust self-scope engine (append-only ledger + vault guard) |
| `engines/nunc-fluens` | Nunc Fluens — the news pipeline (world scope). Code canonical here; `~/news` holds the live data + publishing until Phase C. **Code-frozen there since 2026-07 — code changes land here.** |
| `engines/fourfive` | FourFive design tool (artifact scope) |
| `frontend/` | ME view / world view (Vue 3 + TS); becomes **Nunc Stans Formans** in Phase B |
| `contracts/` | scope IDs, edge schema, glossary, agent ABI |
| `design/` | design corpus, plans, stories, verification records |

The data store lives outside the repo at `NS_DATA` (default
`~/nunc-stans-data`); the `self/` vault is a git repo with **no remote**
(rule F11). See `CONTRIBUTING.md` for conventions,
[design/naming.md](design/naming.md) for the naming map, and
[design/development/2026-07-04-nuncstans-v1-plan.md](design/development/2026-07-04-nuncstans-v1-plan.md)
for the roadmap.
