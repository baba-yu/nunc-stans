# nunc-stans

**Nunc Stans** — a local-first personal system: AI reads the world and
proposes futures worth committing to (nunc-fluens); you choose or write your
own future and put resources behind it (the nunc-stans engine — the self
ledger); together you turn the path into small apps (fourfive) that human
and agent use side by side. The integrated UI where that forming happens is
**Nunc Stans Formans** (`frontend/nunc-stans-formans/`).

Local-first, BYOL (bring your own models and keys), one vault per user.
Targets Ubuntu (native/WSL2), Windows 11, and macOS.

## Quickstart

```sh
just bootstrap <folder-of-your-choice>   # doctor + designate your data store (asks if omitted)
just up                                  # build + serve on http://127.0.0.1:8720
```

`just up` runs three loopback processes behind one origin: the gate
(`:8720`, the address you open — `NS_PORT` moves it), the ledger engine
(`:8721` internal, `NS_ENGINE_PORT`), and the fourfive server (`:8787`
internal).

Prerequisites (what `just bootstrap` doctors): git, `just`, Node ≥ 24 with
corepack, Rust via rustup. On **Windows 11 (native)** additionally:
Git for Windows supplies the `sh` that `just` uses (`windows-shell`), and
rustup needs the MSVC Build Tools (Visual Studio Build Tools → "Desktop
development with C++") for linking. Python 3.10+ is needed only for the
news pipeline until Phase C retires it.

## Layout

| Path | What |
|---|---|
| `engines/nunc-stans` | Rust self-scope engine (append-only ledger + vault guard) |
| `engines/nunc-fluens` | Nunc Fluens — the news pipeline (world scope). Code canonical here; `~/news` holds the live data + publishing until Phase C. **Code-frozen there since 2026-07 — code changes land here.** |
| `engines/fourfive` | FourFive design tool (artifact scope) |
| `frontend/nunc-stans-formans/` | **Nunc Stans Formans** — the integrated UI (ME / world / timeline; Vue 3 + TS) |
| `frontend/packages/nunc-ui` | the design system: tokens + Vue primitives every screen consumes |
| `gate/` | Rust single-origin front door: static UI + loopback proxies to the engine and fourfive |
| `contracts/` | scope IDs, edge schema, glossary, agent ABI |
| `design/` | design corpus, plans, stories, verification records |

The data store is **a folder you designate** (workspace model, like an
Obsidian vault): `just bootstrap <dir>` initializes it and the app remembers
it in its per-user config (`~/.config/nunc-stans/config.json`; `%APPDATA%`
on Windows). `NS_DATA` overrides it per invocation (scripts, CI). The store
always lives outside this repository; its `self/` vault is a git repo with
**no remote** (rule F11). See `CONTRIBUTING.md` for conventions,
[design/naming.md](design/naming.md) for the naming map, and
[design/development/2026-07-04-nuncstans-v1-plan.md](design/development/2026-07-04-nuncstans-v1-plan.md)
for the roadmap.
