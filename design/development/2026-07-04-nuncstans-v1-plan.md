# Nunc Stans v1 — Consolidation and Rebuild Plan

- Date: 2026-07-04
- Status: DRAFT — awaiting owner approval before any execution
- Updated 2026-07-04 (owner feedback round 1): monorepo named per owner
  (naming superseded by round 4), agent-runtime selection
  added, orchestrator reality corrected (manual daily prompt, not Cowork),
  timeline view + S-9 added, git identity directive recorded, monorepo
  rationale re-examined at owner request (§2.1).
- Updated 2026-07-04 (owner feedback round 2): portability and
  reproducibility made an explicit requirement — the product must reproduce
  on any WSL2/Linux environment, real data excluded (§2.10, S-10, D9).
- Updated 2026-07-04 (owner feedback round 3): D9 confirmed (BYOL noted;
  start signal still pending); portability targets widened to Ubuntu +
  Windows + macOS (§2.10); `nunc-stans-agent` added as a first-party CLI
  agent stack (§2.11, Phase D, S-11); the per-phase implementation-plan
  gate made explicit (§7, Phase E precondition).
- Updated 2026-07-04 (owner feedback round 4, naming): hyphenation across
  the board — monorepo `nunc-stans-formans`, engine `engines/nunc-stans`
  (crate `nunc-stans-engine`), agent `nunc-stans-agent`, data
  `~/nunc-stans-data`, prose "Nunc Stans"; the news stack becomes
  **Nunc Fluens** (`engines/nunc-fluens`; the external `~/news` repo is
  renamed at Phase C). manda and fourfive keep their names.
- Updated 2026-07-04 (owner feedback round 5, naming): *formans* belongs to
  the integrated UI, not the repo — the monorepo simplifies to `~/nunc-stans`
  (remote `baba-yu/nunc-stans`); the single-origin UI is **Nunc Stans
  Formans** (`frontend/nunc-stans-formans/`, never abbreviated to "formans").
- Executor: Claude (Fable), phase by phase, with an owner review gate per phase
- Relation to existing docs: extends `design/development/development-plan.md`
  (the HTAS M-milestones remain the product-side roadmap). The old
  "Federation:Phase 0–5" numbering is retired; Phases A–F below replace the
  unfinished Phase 4–5 and add the owner's 2026-07-04 requirements.

## 0. What this plan is

Owner direction (2026-07-04), restated as requirements:

1. The product is **Nunc Stans**; the monorepo is `~/nunc-stans` (product
   name = repo name). **Nunc Stans Formans** — never abbreviated — names the
   *integrated UI* where the forming happens
   (`frontend/nunc-stans-formans/`, assembled in Phase B). The name
   "federation" is retired everywhere (repo name, env vars, document
   vocabulary). One monorepo holds every stack.
2. News and FourFive keep their look and feel — their visual language becomes
   the design system for **all** UI.
3. News must have an explicit, coded deterministic flow; today it is too
   Claude-dependent. It also needs a selectable AI for web search.
4. Every AI integration (cloud and local) gets an optional goal-verification
   auto-retry loop, switchable on/off.
5. Agent profiles (model, prompt, skills, memory) become manageable objects,
   and the executing **agent runtime** (claude-code, a local-LLM coding agent
   with manda retrieval, a Honcho-backed agent such as Hermes) is selectable
   per context.
6. FourFive's job-to-be-done expands from "DB schema design" to **Agentic UX
   design**: schema + CRUD skills + tests, producing apps that human and agent
   use together while data accumulates.
7. The enumerated user stories must actually be executed; passing them is the
   termination condition. New features get new stories first.
8. Data stays in local per-user SQLite. News keeps its DB.

The product vision is unchanged: AI reads the world and proposes futures worth
committing to; the human chooses one or writes their own; human and AI turn the
path toward it into small apps; both live with those apps and the data they
accumulate. An app may serve a goal only indirectly — an app that increases
outings, in service of a relationship goal — and the system records that chain
explicitly instead of forgetting it.

| Vision stage | Mechanism (already designed) | Where it lives |
|---|---|---|
| AI presents predicted futures and options | world predictions + mandate-scoped intervention cards (L1–L3) | News + ledger mandates |
| Human selects or writes a future | self predictions + commitments (append-only, user-authored — rule F3) | ledger (self scope) |
| Human + AI turn the path into an app | FourFive blueprint → **runnable app bundle (new)** | FourFive + apps-host |
| Both use the app; data accumulates | per-app SQLite in the vault (new) | `~/nunc-stans-data/apps/` |
| AI remembers *why* the app exists | `serves` / `produced` / `informed_by` edges + stage-3 strategy read-out | edges + shell |

The "indirect goal" example is exactly the edge chain
`app --serves--> commitment --informed_by--> prediction` that the constitution
already defines. What is missing is not the concept but the runnable-app layer
and the discipline of reading the chain back. This plan builds both.

## 1. Verified current state (surveyed 2026-07-04)

| Location | What it is | State |
|---|---|---|
| `~/federation` | The real build. `engines/nunc-stans` (Rust ledger v0, append-only, loopback-only, hardened), `engines/fourfive` (subtree copy), `engines/nunc-fluens` (subtree copy, code only), `frontend/` ME view (Vue 3 + TS + Pinia), `contracts/`, `design/`, justfile, boundary checks | Active. Local-only (no remote), single `main`. Federation Phases 0–3 done. |
| `~/news` | Standalone News product: deterministic Python pipeline (SQLite cache, 134 tests, Jinja2 render) + static D3 dashboard on GitHub Pages. Content authored daily by Claude via Cowork Routines (`design/scheduled/*.md`) | Active, **evolving daily outside the monorepo** |
| `~/fourfive` | Standalone FourFive: Vue 3 + Hono + better-sqlite3; chat → blueprint → markdown export; LLM providers mock/ollama/claude behind an interface | **Frozen since 2026-06-10** (superseded by the monorepo copy) |
| `~/nuncstans` | Design corpus (`plan/**`: PRD, constitution, contracts, journeys) + scratch Rust bin; GitHub remote `baba-yu/nuncstans` | Design docs **duplicated** with `~/federation/design` |
| `~/federation-data` | The vault. `self/` is a git repo (no remote, rule F11) holding 3 commitments + 3 edges; `world/` and `artifact/` empty | Active. One commitment is literally "consolidate News/Nunc Stans/FourFive locally" — this plan serves it. |
| `~/manda` | OSS memory-governance MCP gateway (Rust; append/candidate/committed lanes, mandates, audit) | Separate product. Stays out (see §5.13). |
| Others | `old/` (superseded prototypes: hermes stack, SPL v2 backend, agent), `nuncstans-hermes-stack` remnant, `multi-stakeholder-simulater`, `second_brain`, `llmsec`, `honeypot`, stray pptx/js at `~` | Dormant or junk — archive in Phase A |

"Phase 3 is done" is confirmed and means **Federation:Phase 3** (read-only News
world view in the shell, headline→commitment button with `informed_by` edge,
F9 provenance line). Phase 4 (mount FourFive) and Phase 5 (resident programs)
were never started. Separately, News has its own internal phase numbering
(unrelated). Phases A–F below retire both numbering systems.

### How to run each piece today

```bash
# Federation shell (ME view + world view), from ~/federation:
export FED_DATA=~/federation-data     # vault must exist; self/ is a git repo
just up                               # builds frontend, serves on 127.0.0.1:8720

# FourFive (standalone), from ~/fourfive (or engines/fourfive):
corepack pnpm install
corepack pnpm dev                     # server :8787 + web :5173; LLM = mock by default
# CODEV_LLM_PROVIDER=ollama|claude via .env for real models

# News deterministic pipeline, from ~/news:
python -m src.cli update              # init+ingest+score+export (app/ dir)
app/update_pages.sh                   # same, from repo root
# The daily CONTENT (news, predictions) is generated by Claude executing
# design/scheduled/*.md — today started by hand ("run today's scheduled
# tasks" to Claude Code). Not runnable without Claude, nor without asking.
```

### The gaps that matter

1. **User stories have never been executed.** `test-spec-journey.md` v2.3
   (Yu's 19 steps, 11 mechanical checks per step) exists; `just journey` is
   not wired; there is no VERIFICATION artifact for any phase. The four
   journey examples are design fiction so far.
2. **Two sources of truth, already drifting.** News and FourFive live both as
   standalone repos and as subtree copies; the design corpus lives in both
   `~/nuncstans/plan` and `~/federation/design`. `~/news` changes daily while
   its monorepo copy ages; `~/fourfive` is frozen while its copy is live.
3. **News content generation is 100% Claude, orchestrated conversationally.**
   The Python layer is deterministic and tested, but the *orchestrator* is
   markdown instructions executed by Claude — historically as Cowork
   Routines, today by the owner manually telling Claude Code "run today's
   scheduled tasks" each day. Web search is Claude's built-in tool; there is
   no provider abstraction, no replay path without Claude, and nothing runs
   unless a conversation starts it.
4. **FourFive has the provider abstraction News lacks** (mock/ollama/claude),
   but its Claude streaming is a one-shot stub, its default model id is stale,
   and it has no agent-facing surface (no MCP tools, no CRUD generation).
5. **The vault has no backup.** F11 forbids remotes and nothing replaces them.
6. **Naming collision.** The product name Nunc Stans currently belongs to the
   self-scope engine; "federation" is burned into the repo name, `FED_DATA`,
   and the document vocabulary.

## 2. Target shape

### 2.1 One repository, one history

Decision: a **single-git monorepo named `nunc-stans`**, evolved in
place from `~/federation` (it already contains every stack, imported with
history).

The owner challenged this (feedback round 1): News and FourFive are
unfinished concept vehicles — divergence is natural while specs are unfixed —
and the current separation is *deliberate*, for separation of concerns and of
development. Re-examined honestly:

- **Two different things diverge.** Spec churn (each app evolving freely) is
  healthy, and a monorepo does not restrict it. What §1 flags is *storage
  duplication*: the same artifact living in two places (standalone repo and
  subtree copy), so a fix lands in one and not the other. That failure mode
  exists no matter how unfixed the specs are, and it disappears only when
  each artifact has exactly one home.
- **What separate repos genuinely buy:** separate issue/PR spaces (unused on
  these private repos), independent visibility and licensing per stack (the
  real criterion — see below), and small focused contexts for agent sessions.
  The last one survives the merge: a session opened at `engines/fourfive/`
  sees a small world, and the boundary checks stop it from wandering.
- **What one history buys now:** the entire next milestone — design system,
  `packages/ai`, profiles, app factory, journey tests — is cross-cutting by
  nature, exactly the work that multi-repo setups make painful.
- **Separation of development is kept by mechanism, not by repo walls:** each
  engine keeps its own README, tests, and justfile targets (independently
  runnable); `tools/check.sh` enforces import boundaries; `commit-scope.sh`
  keeps one commit in one area; phases run on branches.

Placement criterion: **things that are products for others live outside**
(manda as OSS; the published News dashboard as the public remnant). **Organs
of this one product live inside** (nunc-fluens, fourfive, the nunc-stans engine, the
shell) — the constitution itself frames them as three scopes of one system.

Also considered and rejected:

- *Meta-repo with nested independent git repos*: nested `.git` directories
  forbid atomic cross-stack changes, confuse tooling and agents, and
  permanently institutionalize the two-homes problem observed in §1.
- *Git submodules*: maximal ceremony, worst day-to-day experience for a solo,
  agent-driven workflow.

Escape hatch: if a piece later needs its own public life (as manda did),
`git subtree split` extracts it *with history* at that moment. Merging later
is hard; splitting later is easy — so default to one repo now.

### 2.2 Layout

```
nunc-stans/                     (monorepo root; was ~/federation)
  justfile                      just up / news-run / journey / check / backup
  contracts/                    scope-id, edge schema, glossary, agent-abi v0 (new)
  design/                       canonical design corpus (deduped; ~/nuncstans/plan absorbed)
  engines/
    nunc-stans/                 Rust self-scope engine (crate nunc-stans-engine)
    nunc-fluens/                the news pipeline (canonical here after Phase C)
    fourfive/                   FourFive server + app factory
  apps-host/                    host server for generated app bundles (new, Phase E)
  agents/
    nunc-stans-agent/            first-party CLI agent (new, Phase D — §2.11)
  frontend/
    nunc-stans-formans/         the integrated UI (Nunc Stans Formans): ME + world + /fourfive/ + /apps/ + profiles + timeline
    packages/
      nunc-ui/                  design tokens + shared Vue primitives (new)
      ai/                       provider registry + search adapters + goal-loop + run log (new)
  tests/journey/                executable 19-step journey, CI mode (new)
  tools/                        check.sh, commit-scope.sh, migration scripts
```

pnpm workspace across the TS packages; Cargo stays per-engine.

### 2.3 Naming migration

- Directory: `~/federation` → `~/nunc-stans` (round 5: *formans* belongs to
  the integrated UI, not the monorepo). No collision remains — the old
  `~/nuncstans` design repo differs as a string and is archived in this very
  phase: it is absorbed first (subtree merge, history preserved), then moved
  to `~/old/`.
- Integrated UI: the single-origin UI is named **Nunc Stans Formans**,
  directory `frontend/nunc-stans-formans/` (assembled in Phase B from
  today's `frontend/`); never abbreviated to "formans".
- Engine: `engines/nuncstans` → `engines/nunc-stans`, crate
  `nuncstans-engine` → `nunc-stans-engine` (round-4 hyphenation). News:
  `engines/news` → `engines/nunc-fluens` — *nunc fluens*, the flowing now,
  paired with *nunc stans*, the standing now. The external `~/news` repo is
  renamed to `nunc-fluens` at Phase C (its daily routine and Pages URL live
  there until then; `NEWS_WORLD` keeps its name until Phase C). In prose:
  "Nunc Stans" is the product; "the nunc-stans engine" is the self-scope
  core. manda and fourfive keep their names.
- Env: `FED_DATA` → `NS_DATA` (both read for one phase; warn on the old name).
- Data dir: `~/federation-data` → `~/nunc-stans-data`.
- Vocabulary: "federation edge" → "edge", "federation ID" → "scope ID",
  "federation constitution" → "Nunc Stans constitution". Documents are renamed
  in place; `design/naming.md` records the mapping (the Rosetta stone) so
  historical text stays interpretable without rewriting history.
- Git identity: the monorepo (and later the `~/news` remnant) get repo-local
  `user.email = yukibaba3912@gmail.com` (owner directive, feedback round 1;
  existing history stays untouched). Already applied to `~/federation`.
- GitHub: a new private repo `baba-yu/nunc-stans` (owner creates and
  pushes — D2). The old `baba-yu/nuncstans` design repo is archived as is.

### 2.4 Stack policy

End state: **TypeScript for every app and pipeline; Rust for the ledger.**

- Frontend: Vue 3 + TS + Vite + Pinia (already true for ME view and FourFive).
- Servers: Hono on Node ≥ 24 (already true for FourFive; apps-host joins).
- Ledger: Rust axum, unchanged — hardened, append-only; the vault guard
  deserves the strictest component. Two languages total is the floor, not a
  failure of convergence.
- News pipeline: the Cowork-markdown orchestrator is replaced by a TS
  orchestrator (Phase C). The Python compute (parsers, scoring, export; 134
  tests) is ported to TS **against golden-master fixtures generated by the
  Python suite**; Python remains as a parity oracle until goldens match, then
  retires (fallback: D4).
- DB: SQLite everywhere, one file per concern, always under
  `~/nunc-stans-data`, never inside the repo.

### 2.5 Design system: `nunc-ui`

One dark, cold, instrument-panel language extracted from the two apps the
owner wants everything to feel like:

- **Neutral base (from FourFive):** bg `#0f1115`, elevations `#171a21` /
  `#1e222b`, border `#2a2f3a`, text `#e6e8ec`, dim `#9aa3b2`; radii 8/10/12
  (999 for pills); `system-ui` + `Noto Sans JP`; `ui-monospace` for IDs,
  metrics, and API chips.
- **Cold identity (from News):** deep-navy immersive background `#07111f` for
  data views, faint 56 px grid `rgba(130,170,210,.08)`, glass panels
  `rgba(10,22,38,.92)`.
- **One primary accent:** News cyan `#18c7d8` for interactive and active
  states; FourFive blue `#5b8cff` becomes a secondary link color or retires
  (D6).
- **Semantics:** News heat scale `#203047 → #2464a8 → #18c7d8 → #ffb84d →
  #ff4d2e → #fff3c4`; success `#5fd99f`; warn `#d9c47f`; error `#e08f8f`;
  contradiction `#c74bd8`; FourFive's method/status badge patterns.
- Deliverable: `frontend/packages/nunc-ui` exposing CSS variables plus a small
  set of Vue primitives (Panel, Card, Badge, Pill, Tabs, Modal, DataChip,
  HeatDot). Every screen — ME view, world view, FourFive, generated apps,
  profile manager — consumes it. The News D3 canvas graph is kept as-is and
  wrapped in a shell view.
- Single localhost origin for everything (constitution §10-B), one `just up`.
  The integrated UI itself is named **Nunc Stans Formans**
  (`frontend/nunc-stans-formans/`, never abbreviated); where this document
  says "the shell", it means Nunc Stans Formans.

### 2.6 AI layer: `frontend/packages/ai`

One place where models are called; nothing else talks to a provider directly.

- **Two tiers: model providers and agent runtimes.** Model providers:
  `anthropic-api`, `openai`, `google`, `ollama`, `mock`. **Agent runtimes**
  are selectable executors that bring their own tooling and memory:
  `claude-code` (headless CLI — rides the subscription, no API key),
  **`nunc-stans-agent`** (first-party, local-LLM-first, manda-gated memory —
  §2.11), and optionally external runtimes such as a Honcho-backed agent
  (Hermes) for comparison. Per the owner: News may want claude-code, while
  sparring and custom agents (DB, skills, memory, MCP) run on
  `nunc-stans-agent`. Every
  context that calls AI — News steps, FourFive chat, app agents — selects a
  runtime or provider through its profile. Each entry declares capabilities:
  `{chat, stream, tools, structured, web_search: native|none, thinking,
  memory}`.
- **License boundary:** runtimes integrate as *external processes* behind an
  API/MCP boundary — no copyleft code is ever linked into the monorepo.
  claude-code is proprietary freeware (no copyleft — acceptable per owner).
  Honcho and Hermes Agent licenses are verified at integration time (Phase D
  gate) and recorded in `design/verification/phase-d.md`; personal local use
  does not trigger AGPL-style network-service obligations, but verification
  happens before, not after, integration.
- **Web search is two axes, not one.** "Which AI searches" decomposes into
  *search source* × *synthesis model*: a native provider search tool
  (Anthropic / OpenAI / Gemini), or an external engine adapter (self-hosted
  SearXNG, Brave, Tavily) feeding **any** chat model — this is what makes
  local models usable for News. Config selects the pair per pipeline step;
  the News settings UI exposes it.
- **Goal-verification loop (requirement 4):** middleware on every call:
  `{verify: on|off, goal, judge: {provider, model}, max_iters (default 2),
  token_budget}`. Each iteration produces a structured judge verdict
  `{met, gaps[]}`; unmet → gaps appended as feedback → retry within caps.
  Off by default for chat (toggle per message), per-step config in pipelines,
  defaults from the active profile. Every verdict and retry is logged with
  token counts.
- **Run log:** every call (provider, model, profile, tokens, duration,
  verdict chain) appends to `~/nunc-stans-data/runs/ai-runs.jsonl` — the audit
  substrate agent-abi needs.

### 2.7 Agent profiles + agent-abi v0 (requirement 5)

Profile = `{id, name, provider, model, system_prompt, skills (tool
allowlist), memory_scope {read[], write[]}, goal_verify defaults, ui prefs}`,
stored as files in `~/nunc-stans-data/profiles/` (versioned by the vault's own
git). The shell gets a Profiles screen: create, edit, duplicate, and set the
default profile per context (FourFive chat / News steps / app agents).

Constitutional constraint carried into code: **no profile may grant write
access to self-scope commitments** (F3 — user-only), regardless of its
`memory_scope`. This feature finally gives `contracts/agent-abi.md` its v0
content (registration, mandate reference, run-log pointer, suspension) —
which was the entry condition the old Phase 5 was waiting for.

### 2.8 FourFive: from blueprint to app factory (requirement 6)

Today FourFive stops at a markdown spec. Phase E teaches it to emit a
**runnable app bundle**:

```
workspace/apps/<slug>/versions/<N>/   (design-time, as today)
→ bundle/
   app.json        manifest {slug, version, entities, metrics[], stories[]}
   schema.sql      generated SQLite DDL
   crud.ts         generated CRUD handlers, mounted by apps-host at /apps/<slug>/api
   mcp-tools.json  the same CRUD exposed as MCP tools (<slug>.<entity>.{list,get,create,update,archive})
   ui/             generated Vue screens from mock_ui (forms, tables) on nunc-ui
   tests/          scenario tests generated from the app's user stories
data: ~/nunc-stans-data/apps/<slug>/data.sqlite   (per-user, local — requirement 8)
```

- **apps-host** (one Hono server) serves every bundle under the single origin
  and exposes the MCP tool surface, so *agents operate the same app the human
  uses* — the co-use loop. One host process, not one process per app.
- **Metrics contract:** `app.json` declares named metrics (SQL views). The
  stage-3 strategy read-out reads *only* these — the constitution's rule that
  what the app does not measure is not grounds for proposals becomes
  mechanical.
- App data is working data, not the self ledger: full CRUD is allowed, with
  soft-delete (`archive`) and `updated_at` audit columns by default.
- **First bundle: `runway-tracker@v1`** — the exact app from journey step T10,
  which turns the journey test from fiction into an executable path.

### 2.9 Data topology (requirement 8)

```
~/nunc-stans-data/
  self/         ledger vault (git, NO remote — F11 unchanged)
  world/        News DB cache (analytics.sqlite moves here; rebuildable from report/ markdown)
  artifact/     FourFive workspace (blueprints, versions) — moves out of the repo
  apps/<slug>/  per-app user data (SQLite)
  profiles/     agent profiles
  runs/         AI run logs
  models/       optional local model files (when not managed by Ollama)
```

Single-user today; the layout is per-user-shardable (one data root = one
user), so multi-user later is a directory question, not a schema question.
Do not build tenancy now (D9: v1 ships personal instances; hosted
multi-tenancy would be its own plan).

**Backup (new obligation):** F11 forbids remotes for `self/`, which today
means zero copies of the most irreplaceable data. `just backup` produces an
encrypted archive (age or 7z-AES) of `~/nunc-stans-data` to a second disk
and/or an owner-chosen offsite target (D8). F11's intent is "no plaintext
ledger on someone else's server"; an encrypted bundle you carry yourself is
compatible with that intent.

### 2.10 Portability and reproducibility (owner requirement, rounds 2–3)

The product is not for this machine only. Development happens in WSL, but the
product targets **three operating systems: Ubuntu (native or WSL2), Windows
11 (native), and macOS** — each must reproduce the whole system from the repo
plus one bootstrap step, real data excluded. The Windows/MSIX/UNC quirks in
§5 note 12 concern the *development tool* driving this particular machine;
nothing in the product may depend on them.

- **Runtime surface (cross-platform):** git, `just`, Rust (pinned via
  `rust-toolchain.toml`; axum/tokio are OS-portable), Node ≥ 24 with corepack
  (pnpm pinned in `package.json`; better-sqlite3 ships prebuilds for all
  three OSes), Python 3.10+ (until Phase C retires it — one more reason to
  finish D4), SQLite. Optional: Ollama (available on all three OSes) for
  local models; Docker Desktop only for optional runtimes (e.g. Honcho).
- **Cross-platform tooling policy:** repo tooling is written in TypeScript
  run by Node (or Rust), not bash — `tools/check.sh` and `commit-scope.sh`
  get ported when touched; justfile recipes stay thin wrappers. Unix-only
  code paths (e.g. the engine's 600/700 vault permissions) get explicit
  Windows equivalents or documented degradation. Scheduling is documented
  per OS: systemd timer / cron (Linux), Task Scheduler (Windows), launchd
  (macOS) — the CLI is the contract; the OS scheduler is an adapter.
- **`just bootstrap` (new, Phase A):** verifies or installs the toolchain,
  initializes the `NS_DATA` skeleton (`self/` as a git repo with no remote,
  `world/`, `artifact/`, `profiles/`, `runs/`), and prints a doctor report.
  Setup lives in a script, not in prose.
- **No machine-specific state in the repo:** all paths flow through `NS_DATA`
  and config — no user-specific or absolute paths (the run-summary WSL path
  hardcoded into `~/news` and this machine's corepack shim workaround are
  exactly what this rule bans); ports configurable; every AI feature must
  degrade to `mock` (zero credentials) and must run fully local via `ollama`
  — `claude-code` is a convenience default, never a requirement.
- **Distribution assumption (D9, confirmed round 3):** v1 targets *each user
  running their own instance* — local-first, **BYOL** (users bring their own
  models and API keys; no bundled credentials), one vault per user, per-user
  SQLite. Monetization (experience + accumulated-data moat) is a future
  concern, not a v1 constraint. A hosted multi-tenant service is explicitly
  out of scope for v1 (it forks the architecture: auth, isolation, sync) and
  would be its own plan.
- **Proof, not promise:**
  - CI matrix on GitHub Actions (`ubuntu-latest`, `windows-latest`,
    `macos-latest`): bootstrap + build + unit tests, running from the moment
    the D2 remote exists, green as a standing phase-exit condition.
  - Story S-10 (full boot to the home screen): Ubuntu — pristine WSL distro
    or container, at every phase close from A. Windows native — from Phase B
    close (once the shell exists). macOS — continuously via the CI matrix;
    a full manual pass before v1 is called done (hardware-dependent).
  - Phase F extends S-10 with `just journey`.

### 2.11 `nunc-stans-agent`: the first-party agent (owner requirement, round 3)

The owner wants a Hermes-Agent-like experience — a conversational agent in
the terminal — built from this project's own parts: **manda plus a self-made
agent, tryable from the CLI.** No such stack exists today (`~/manda` is a
gateway with no agent attached; `old/nunc-stans-agent` is a superseded
prototype), so it becomes a first-class deliverable:
`agents/nunc-stans-agent/` (TypeScript).

v0 scope (built in Phase D):

- Terminal chat with streaming and visible thinking; model via `packages/ai`
  (Ollama first-class, any provider or runtime selectable).
- **Memory exclusively through the manda MCP gateway** — append / candidate /
  committed lanes, mandate-gated writes, audited. manda stays a separate OSS
  dependency (§5 note 13); this agent is its first real consumer.
- MCP client for tools — including, from Phase E, the CRUD tools of generated
  apps: this agent is how "the agent co-uses the app" is proven (S-7).
- Profile-driven (model, prompt, skills, memory scope) and subject to the
  goal-verify loop (§2.6); every run logged to `~/nunc-stans-data/runs/`.

Not in v0: autonomous coding-agent behavior (file-editing loops). That is a
later extension; until then, coding tasks go through the `claude-code`
runtime. The constitutional line holds for every runtime: no agent writes
self-scope commitments (F3).

## 3. Phases

| Phase | Name | Depends on | Size (focused Fable sessions) |
|---|---|---|---|
| A | Consolidation and naming | — | 1–2 |
| B | Nunc Stans Formans (the integrated UI) + nunc-ui | A | 2–3 |
| C | News newstack: coded pipeline + provider layer | A (B can run in parallel) | 4–6 |
| D | Profiles + goal-loop + agent-abi v0 + nunc-stans-agent v0 | C (`packages/ai`) | 3–5 |
| E | FourFive app factory + apps-host | B, D | 5–8 |
| F | Journey validation: CI + 4-week live gate | E | 2 + 4 weeks calendar |

Rules that apply to every phase:

- **A phase closes only when its user stories run and pass** (§4). Each
  closure writes `design/verification/<phase>.md` with the evidence — fixing
  the Phase 0–3 pattern of undocumented completion.
- Each phase runs on a branch (`phase/a-consolidation`, …; Phase C uses
  `newstack`), merged to `main` at the review gate.
- Execution happens inside WSL (native modules, pnpm, cargo). Commit style
  follows the repo convention (`area: message`, English, no AI attribution).

### Phase A — Consolidation and naming

Work: absorb the `~/nuncstans` design repo via subtree merge (diff `plan/`
against `design/`, keep the newest of each file, record choices in the merge
commit); **verify subtree parity** — confirm `engines/fourfive` contains the
tip of `~/fourfive` `dev` (the June app-composition work) and subtree-pull the
delta if not, and note the `~/news` commit the news subtree corresponds to;
declare a **code freeze on `~/news`** (data-only commits from the daily
routine are fine; any code fix lands in the monorepo copy) until Phase C
retires it; apply §2.3 renames (dirs, crate, env, vocabulary,
`design/naming.md`); amend the constitution's engine-independence clause
(§13: "engine changes only for the engine's own reasons") to match the
unified-product direction — engines are now internal components of one
product and may be modified freely, while the contracts keep defining the
scope boundaries;
move `~/federation` → `~/nunc-stans`; rename `~/federation-data` →
`~/nunc-stans-data` (engine flags, justfile, env shim); archive `~/fourfive`,
`nuncstans-hermes-stack`, `multi-stakeholder-simulater`, and the stray `~`
junk into `~/old/` (nothing deleted); carry LICENSE/NOTICE (Apache-2.0) to the
monorepo root; write a `README.md` per stack with a working one-command run; write
`just bootstrap` and purge machine-specific paths per §2.10; set the
repo-local git identity (`yukibaba3912@gmail.com`; history untouched);
prepare the new private remote `baba-yu/nunc-stans` (owner creates
and pushes).

Exit: `just up` works from `~/nunc-stans`; `just check` green;
`git grep -iI federation -- ':!design/naming.md' ':!design/development'
':!design/verification'` returns nothing except the historical commitment
slug `federation-local` (migration docs may reference the old name
historically); every stack README has a verified run command; stories S-0
and S-10 pass (S-10 in a pristine WSL distro or container).

### Phase B — Nunc Stans Formans (the integrated UI) + nunc-ui

Work: assemble the integrated UI **Nunc Stans Formans**
(`frontend/nunc-stans-formans/`, evolving from today's `frontend/`); create
`frontend/packages/nunc-ui` (§2.5 tokens + primitives); restyle
ME and world views; mount FourFive under `/fourfive/` behind the single
origin (the old Phase-4 item); navigation chrome; the F9 provenance line stays on
home; add a **timeline view** (owner request, feedback round 1) — the self
scope as a time series: commitments opened, outcomes closed, interventions,
mandate windows, and the weekly provenance mix, rendered on the nunc-ui heat
scale, with jump-to-record from any point. Phase F uses it as the live-gate
companion (week counter, ritual log).

Exit: one origin serves ME + world + FourFive with the shared language;
stories S-1, S-2, and S-9 pass; a screenshot set is saved under `design/ui/`.

### Phase C — News newstack

Work: branch `newstack`; build the TS orchestrator that executes the daily
DAG as code (steps = functions, I/O = the existing sourcedata JSON schemas,
gates = the existing deterministic checks); build `packages/ai` (§2.6);
port the Python compute to TS against golden-master fixtures (Python stays as
the oracle until parity); sync the news subtree to the `~/news` tip before
any code change here (follow the re-sync recipe in `engines/nunc-fluens/INTEGRATION.md`); move `analytics.sqlite` out of the repo to
`~/nunc-stans-data/world/` (same file, same schema, same data — new location);
split `~/news` into a data+publishing remnant
(report/, docs/ Pages) fed by the monorepo pipeline (D3), renaming that repo
to `nunc-fluens` at this point (GitHub Pages URLs change and do not
redirect — update links deliberately); schedule via a WSL
systemd timer (or cron) calling the CLI — the daily run must start and finish
with **no conversational step**; the current manual "run today's scheduled
tasks" prompt to Claude Code is retired.

Exit: one full daily run each of — (a) `claude-code` provider, (b) a
non-Anthropic or local provider with an external search adapter, (c) a replay
from stored artifacts with **zero LLM calls** — all producing a valid
dashboard (replay output identical except run metadata such as timestamps);
ported tests green against goldens; stories S-3 and S-4 pass. Content quality
across providers will differ; acceptance is structural validity, and quality
tuning is ongoing operations, not a phase gate.

### Phase D — Profiles + goal-loop surfaces + nunc-stans-agent v0

Work: profile store and Profiles screen; wire FourFive chat and News step
config to profiles; goal-verify toggle per chat message and per pipeline
step; run-log viewer in the shell; draft `contracts/agent-abi.md` v0; build
**`nunc-stans-agent` v0** (§2.11) — terminal chat on `packages/ai`,
manda-gated memory, MCP tool client, profile-driven; Hermes/Honcho remains
an optional comparison runtime (external process; license verified and
recorded first if integrated); while touching that code, fix FourFive's
Claude streaming stub and stale default model id.

Exit: profiles can be created and switched from the UI; a verify-on message
visibly loops (≤ max_iters), reports unmet gaps, and shows cost; a local
model via Ollama works under a profile; `nunc-stans-agent chat` works in a
terminal with mandate-gated memory operations through manda; stories S-5,
S-6, and S-11 pass.

### Phase E — FourFive app factory

Precondition (owner gate, round 3): Phase E starts only after its own design
spec and implementation plan — bundle format, apps-host API, MCP surface,
codegen approach, security rails — are written and owner-approved. It is
deliberately written after Phases C–D exist, because `packages/ai`, profiles,
and `nunc-stans-agent` fix the shapes it must target.

Work: bundle generator (DDL, CRUD, MCP tools, UI, scenario tests — §2.8);
apps-host mounted at `/apps/`; metrics contract consumed by the strategy
read-out; generate `runway-tracker@v1`; prove agent co-use with
`nunc-stans-agent` doing CRUD through MCP alongside the human UI.

Exit: runway-tracker usable by human (generated UI) and agent (MCP) with data
in the vault; a second, unrelated small app generated end-to-end in one
sitting to prove generality; stories S-7 and S-8 pass.

### Phase F — Journey validation (the termination condition)

Work: implement `tests/journey/` running T0–T18 in CI mode (mock or local
provider, temp vault, the 11 checks scripted per step); wire `just journey`;
then start the **real-life 4-week gate**: real vault entries, the weekly
ritual, the five [op] subjective questions answered by the owner.

Exit: `just journey` green in CI; the live gate started with week-1 entries
recorded; at week 4, the original Phase-1 question — "did seeing the edges
change a decision at least once?" — answered in writing in
`design/verification/phase-f.md`.

## 4. User stories — existing and new

Existing (design corpus): journey examples 1–4 (Yu / Ken / Ryo / Aya) and
test-spec-journey T0–T18 with checks 1–11. **Never executed to date; Phase F
automates T0–T18 and starts the live run.**

New stories for the new requirements. Each is written into `design/stories/`
during its phase and executed before the phase closes:

- **S-0 (A):** From a clean checkout plus an empty `NS_DATA`, `just up`
  reaches the home screen in at most 3 commands.
- **S-1 (B):** One origin reaches ME view, world view, and FourFive without
  changing port or losing the shared look.
- **S-2 (B):** From a world headline I create a commitment; the `informed_by`
  edge and the provenance line update (Phase-3 behavior re-verified under the
  new shell).
- **S-3 (C):** I switch News web search from Anthropic-native to an external
  engine + a local model in settings; the next run completes; the day records
  which pair produced it.
- **S-4 (C):** With the network and all LLMs disabled, I replay yesterday
  from stored artifacts and get an identical dashboard (modulo run metadata).
- **S-5 (D):** I create a profile (model + prompt + skills + memory scope),
  set it as FourFive's default, and see it stamped in the run log.
- **S-6 (D):** I send a message with goal-verify ON and an unmeetable goal;
  the loop stops at max_iters, reports the unmet gaps, and the cost is
  visible.
- **S-7 (E):** Human (generated UI) and `nunc-stans-agent` (MCP) both add rows
  to runway-tracker; each sees the other's rows; the metrics view updates;
  the strategy read-out quotes only declared metrics.
- **S-8 (E):** I design a new tiny app in FourFive chat and use its generated
  UI in the same session, with its data file created in the vault.
- **S-9 (B):** I open the timeline view and see my recent weeks as a time
  series of commitments, outcomes, and interventions, and can jump from any
  point to the underlying record.
- **S-10 (A; re-run at every phase close):** On a pristine WSL2/Ubuntu (or a
  container), `git clone` + `just bootstrap` + `just up` reaches the home
  screen with no manual steps beyond documented prerequisites; from Phase B
  the same passes on native Windows; at Phase F the run also passes
  `just journey`. The 3-OS CI matrix stays green throughout.
- **S-11 (D):** In a terminal I start `nunc-stans-agent chat` under a profile
  with a local model; the agent answers with streaming and visible thinking,
  reads and writes memory only through manda within its mandate and refuses a
  write outside it; the run appears in the run log.

## 5. Things the owner may not have accounted for (critical notes)

1. **The duplication being fixed has already bitten.** `~/news` moved on daily
   while its monorepo copy froze at import; `~/fourfive` froze while its copy
   became the live one. Any topology that keeps "one monorepo plus independent
   per-stack repos" *recreates this permanently*. That is why §2.1 insists on
   one git history — the strongest opinion in this document.
2. **News is public; the monorepo is private.** The dashboard publishes via
   GitHub Pages from `~/news`. Folding News *code* into the private monorepo
   means the public artifact needs an explicit channel — the remnant publish
   repo (D3). Going fully local instead is a legitimate choice, but it kills
   the public dashboard; decide it consciously, not by accident.
3. **"Deterministic" has a reachable meaning and a myth version.** LLM output
   is never bit-reproducible. What is achievable: orchestration as code (no
   more prompt-markdown-as-program), schema-validated artifacts at every LLM
   boundary (already exists), deterministic everything-after (already exists),
   and replay from artifacts (S-4). The deepest Claude lock-in today is that
   the *orchestrator itself is Claude Cowork*, more than the model calls.
4. **"Choose the web-search AI" is two choices.** Search source × synthesis
   model (§2.6). Local models cannot search natively; without an external
   engine adapter, "including local LLMs" is unsatisfiable.
5. **Leaving Cowork Routines changes the cost model.** Today's daily content
   rides the subscription. An API-driven pipeline meters every token. Keeping
   `claude-code` (headless) as a first-class provider preserves the
   subscription path; expect it to stay the default with API and local
   providers selected deliberately.
6. **The goal-verify loop is a cost machine if unguarded.** Judge plus retries
   multiply tokens by (1 + iterations). Hard caps, logged verdicts, and
   per-profile defaults are specified in §2.6. Where loop output faces the
   self scope it must also respect intervention materiality (journey checks
   9–10: mandate scope, no imperatives, numbers trace to records).
7. **Profiles intersect the memory constitution.** A profile's `memory_scope`
   could quietly grant an agent write access the constitution forbids. Hard
   rule in code: only the user writes self-scope commitments (F3), regardless
   of profile. Profiles are also the forcing function that finally drafts
   `agent-abi.md` — which was the old Phase-5 entry condition.
8. **The app factory is the largest, riskiest item.** It is a code generator,
   a hosting model, a data contract, and a security surface at once. The MVP
   boundary in §2.8 (SQLite DDL + CRUD + MCP + plain generated UI + one real
   app) is deliberately narrow. No arbitrary generated logic execution, no
   external deployment, until runway-tracker has lived for a while.
9. **Phase F contains real calendar time.** The live gate is four weeks of
   actual use with real decisions. No amount of engineering compresses it.
   Without scheduling it, the stories stay "tested" only in the CI sense.
10. **Naming has a blast radius.** "nuncstans" currently names the design
    repo, the Rust engine, a GitHub remote, and (in docs) the self system.
    The owner's rounds 4–5 naming settles it: monorepo `~/nunc-stans`,
    integrated UI **Nunc Stans Formans**, engine `engines/nunc-stans`, news
    `nunc-fluens`. A mild echo remains (`engines/nunc-stans` inside
    `~/nunc-stans`) — accepted; renaming the engine to a functional name
    (e.g. `ledger`) stays available if it ever grates. Historical documents
    will still read oddly in places, and `design/naming.md` is the Rosetta
    stone rather than rewriting history.
11. **The vault has zero backup today,** and F11 (no remote) is the reason.
    Encrypted offline bundles square the circle (§2.9); pick a destination
    (D8). Losing `self/` loses the product's point.
12. **Execution environment matters for Fable — and only for Fable.** This
    note is about the *development tool*, not the product: better-sqlite3
    (native module), pnpm, and cargo builds must run inside WSL, and driving
    them over the Windows UNC path is slow and fragile, so execution sessions
    should run Claude Code inside WSL (or at minimum execute builds via
    `wsl.exe`). The product itself is Linux-native with no Windows/MSIX/UNC
    dependency — and because the owner intends this to be usable beyond one
    person, §2.10 turns reproducibility on any WSL2/Linux box into a
    story-tested requirement (S-10) rather than an accident. Git identity for
    this project is `yukibaba3912@gmail.com` (owner directive, repo-local;
    past commits stay untouched — already applied to `~/federation`).
13. **Out of scope on purpose:** `manda` stays a separate OSS repo (the
    public/private boundary is why it was carved out); the monorepo *depends*
    on it — `nunc-stans-agent` is its first real consumer (§2.11) — but never
    absorbs it. `work/`, `obsidian-vault`, and `second_brain` are untouched.
    `old/` remains the graveyard and receives the newly archived items.
14. **Three-OS portability has a real cost.** Windows and macOS as targets
    mean: repo tooling in TypeScript instead of bash, Windows handling for
    the engine's unix-permission guards, three scheduling adapters, and a CI
    matrix as a standing gate. Accepted deliberately — distribution is the
    goal — but it is paid mostly in Phases A–C, not free. Development itself
    stays in WSL.

## 6. Open decisions

Defaults are chosen so execution can start immediately; say the word to flip
any of them.

| # | Decision | Default | Alternative |
|---|---|---|---|
| D1 | Repo topology | Single git monorepo — re-examined at owner request, analysis in §2.1 | Nested per-stack repos (institutionalizes the two-homes problem; not recommended) |
| D2 | GitHub remote | **Decided (rounds 1+5):** new private repo `baba-yu/nunc-stans`; owner creates and pushes | Stay local-only |
| D3 | Public News dashboard | Keep: `~/news` becomes a data+publish remnant fed by the monorepo pipeline | Go fully local; retire Pages |
| D4 | Python pipeline | Port to TS with golden-master parity, then retire Python | Keep Python permanently as a pinned CLI |
| D5 | Naming | **Decided (rounds 1–5):** monorepo `~/nunc-stans`; integrated UI **Nunc Stans Formans** (`frontend/nunc-stans-formans/`, no abbreviation); engine `engines/nunc-stans` (crate `nunc-stans-engine`); news → `nunc-fluens` (external repo renamed at Phase C); agent `nunc-stans-agent`; manda and fourfive unchanged | — |
| D6 | Primary accent | News cyan `#18c7d8` | FourFive blue `#5b8cff` |
| D7 | Default pipeline provider | **Approved (round 1**, condition: no GPL-style copyleft — claude-code is proprietary freeware**):** `claude-code`; runtimes and providers selectable per profile | API-first |
| D8 | Vault backup destination | Encrypted weekly bundle to a second local disk; owner adds an offsite copy | Owner-specified (e.g., encrypted cloud object storage) |
| D9 | v1 distribution target | **Confirmed (round 3):** personal instances, BYOL — each user runs their own local-first instance with their own vault (portable per §2.10); monetization deferred (experience + data moat) | Hosted multi-tenant service — out of scope for v1; would be its own plan |

## 7. Execution protocol

- Executor: Fable, one phase per stretch. **Every phase opens with a written
  implementation plan approved by the owner before code is touched** (Phase E
  additionally requires its design spec approved — see the Phase E
  precondition). Then implement → verify → owner review gate. Stories are
  executed and evidenced before a phase closes.
- Owner actions that Claude cannot perform on this machine: GitHub pushes
  (credential manager auth), and the D2 remote repurpose.
- This plan document is updated (not rewritten) as decisions D1–D8 are
  confirmed; each phase closure links its verification file.
