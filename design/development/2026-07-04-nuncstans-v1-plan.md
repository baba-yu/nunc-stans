# NuncStans v1 — Consolidation and Rebuild Plan

- Date: 2026-07-04
- Status: DRAFT — awaiting owner approval before any execution
- Executor: Claude (Fable), phase by phase, with an owner review gate per phase
- Relation to existing docs: extends `design/development/development-plan.md`
  (the HTAS M-milestones remain the product-side roadmap). The old
  "Federation:Phase 0–5" numbering is retired; Phases A–F below replace the
  unfinished Phase 4–5 and add the owner's 2026-07-04 requirements.

## 0. What this plan is

Owner direction (2026-07-04), restated as requirements:

1. The product is **NuncStans**. The name "federation" is retired everywhere
   (repo name, env vars, document vocabulary). One monorepo holds every stack.
2. News and FourFive keep their look and feel — their visual language becomes
   the design system for **all** UI.
3. News must have an explicit, coded deterministic flow; today it is too
   Claude-dependent. It also needs a selectable AI for web search.
4. Every AI integration (cloud and local) gets an optional goal-verification
   auto-retry loop, switchable on/off.
5. Agent profiles (model, prompt, skills, memory) become manageable objects.
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
| Both use the app; data accumulates | per-app SQLite in the vault (new) | `~/nuncstans-data/apps/` |
| AI remembers *why* the app exists | `serves` / `produced` / `informed_by` edges + stage-3 strategy read-out | edges + shell |

The "indirect goal" example is exactly the edge chain
`app --serves--> commitment --informed_by--> prediction` that the constitution
already defines. What is missing is not the concept but the runnable-app layer
and the discipline of reading the chain back. This plan builds both.

## 1. Verified current state (surveyed 2026-07-04)

| Location | What it is | State |
|---|---|---|
| `~/federation` | The real build. `engines/nuncstans` (Rust ledger v0, append-only, loopback-only, hardened), `engines/fourfive` (subtree copy), `engines/news` (subtree copy, code only), `frontend/` ME view (Vue 3 + TS + Pinia), `contracts/`, `design/`, justfile, boundary checks | Active. Local-only (no remote), single `main`. Federation Phases 0–3 done. |
| `~/news` | Standalone News product: deterministic Python pipeline (SQLite cache, 134 tests, Jinja2 render) + static D3 dashboard on GitHub Pages. Content authored daily by Claude via Cowork Routines (`design/scheduled/*.md`) | Active, **evolving daily outside the monorepo** |
| `~/fourfive` | Standalone FourFive: Vue 3 + Hono + better-sqlite3; chat → blueprint → markdown export; LLM providers mock/ollama/claude behind an interface | **Frozen since 2026-06-10** (superseded by the monorepo copy) |
| `~/nuncstans` | Design corpus (`plan/**`: PRD, constitution, contracts, journeys) + scratch Rust bin; GitHub remote `baba-yu/nuncstans` | Design docs **duplicated** with `~/federation/design` |
| `~/federation-data` | The vault. `self/` is a git repo (no remote, rule F11) holding 3 commitments + 3 edges; `world/` and `artifact/` empty | Active. One commitment is literally "consolidate News/NuncStans/FourFive locally" — this plan serves it. |
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
# The daily CONTENT (news, predictions) is generated by Claude Cowork
# Routines per design/scheduled/*.md — not runnable without Claude today.
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
3. **News content generation is 100% Claude-and-Cowork.** The Python layer is
   deterministic and tested, but the *orchestrator* is markdown instructions
   executed by Claude Cowork, web search is Claude's built-in tool, and there
   is no provider abstraction and no replay path without Claude.
4. **FourFive has the provider abstraction News lacks** (mock/ollama/claude),
   but its Claude streaming is a one-shot stub, its default model id is stale,
   and it has no agent-facing surface (no MCP tools, no CRUD generation).
5. **The vault has no backup.** F11 forbids remotes and nothing replaces them.
6. **Naming collision.** The product name NuncStans currently belongs to the
   self-scope engine; "federation" is burned into the repo name, `FED_DATA`,
   and the document vocabulary.

## 2. Target shape

### 2.1 One repository, one history

Decision: a **single-git monorepo named `nuncstans`**, evolved in place from
`~/federation` (it already contains every stack, imported with history).

Considered and rejected:

- *Meta-repo with nested independent git repos* (the literal reading of
  "independent repos per stack under one monorepo"): nested `.git` directories
  forbid atomic cross-stack changes, confuse tooling and agents, and recreate
  today's drift the moment one nested repo moves without the others. The
  isolation actually wanted — each stack independently runnable, clearly
  bounded — comes from directory boundaries plus `tools/check.sh` import
  rules, not from separate histories.
- *Git submodules*: maximal ceremony, worst day-to-day experience for a solo,
  agent-driven workflow.

Escape hatch: if a piece later needs its own public life (as manda did),
`git subtree split` extracts it *with history* at that moment. Merging later
is hard; splitting later is easy — so default to one repo now.

### 2.2 Layout

```
nuncstans/                      (monorepo root; was ~/federation)
  justfile                      just up / news-run / journey / check / backup
  contracts/                    scope-id, edge schema, glossary, agent-abi v0 (new)
  design/                       canonical design corpus (deduped; ~/nuncstans/plan absorbed)
  engines/
    ledger/                     Rust self-scope engine (was engines/nuncstans)
    news/                       News pipeline (canonical here after Phase C)
    fourfive/                   FourFive server + app factory
  apps-host/                    host server for generated app bundles (new, Phase E)
  frontend/
    shell/                      single-origin shell: ME + world + /fourfive/ + /apps/ + profiles
    packages/
      nunc-ui/                  design tokens + shared Vue primitives (new)
      ai/                       provider registry + search adapters + goal-loop + run log (new)
  tests/journey/                executable 19-step journey, CI mode (new)
  tools/                        check.sh, commit-scope.sh, migration scripts
```

pnpm workspace across the TS packages; Cargo stays per-engine.

### 2.3 Naming migration

- Directory: `~/federation` → `~/nuncstans`. The current `~/nuncstans` design
  repo is absorbed first (subtree merge, history preserved), then archived to
  `~/old/`.
- Engine: `engines/nuncstans` → `engines/ledger`, crate/binary `ledger`.
  The product owns the name; the engine's essence is an append-only ledger.
- Env: `FED_DATA` → `NS_DATA` (both read for one phase; warn on the old name).
- Data dir: `~/federation-data` → `~/nuncstans-data`.
- Vocabulary: "federation edge" → "edge", "federation ID" → "scope ID",
  "federation constitution" → "NuncStans constitution". Documents are renamed
  in place; `design/naming.md` records the mapping (the Rosetta stone) so
  historical text stays interpretable without rewriting history.
- GitHub: the `baba-yu/nuncstans` remote is repurposed to the monorepo
  (owner pushes — see D2; git identity check first).

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
  `~/nuncstans-data`, never inside the repo.

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

### 2.6 AI layer: `frontend/packages/ai`

One place where models are called; nothing else talks to a provider directly.

- **Provider registry:** `anthropic-api`, `claude-code` (headless CLI — rides
  the subscription, no API key), `openai`, `google`, `ollama`, `mock`. Each
  declares capabilities: `{chat, stream, tools, structured, web_search:
  native|none, thinking}`.
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
  verdict chain) appends to `~/nuncstans-data/runs/ai-runs.jsonl` — the audit
  substrate agent-abi needs.

### 2.7 Agent profiles + agent-abi v0 (requirement 5)

Profile = `{id, name, provider, model, system_prompt, skills (tool
allowlist), memory_scope {read[], write[]}, goal_verify defaults, ui prefs}`,
stored as files in `~/nuncstans-data/profiles/` (versioned by the vault's own
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
data: ~/nuncstans-data/apps/<slug>/data.sqlite   (per-user, local — requirement 8)
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
~/nuncstans-data/
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
Do not build tenancy now.

**Backup (new obligation):** F11 forbids remotes for `self/`, which today
means zero copies of the most irreplaceable data. `just backup` produces an
encrypted archive (age or 7z-AES) of `~/nuncstans-data` to a second disk
and/or an owner-chosen offsite target (D8). F11's intent is "no plaintext
ledger on someone else's server"; an encrypted bundle you carry yourself is
compatible with that intent.

## 3. Phases

| Phase | Name | Depends on | Size (focused Fable sessions) |
|---|---|---|---|
| A | Consolidation and naming | — | 1–2 |
| B | Single-origin shell + nunc-ui | A | 2–3 |
| C | News newstack: coded pipeline + provider layer | A (B can run in parallel) | 4–6 |
| D | Profiles + goal-loop surfaces + agent-abi v0 | C (`packages/ai`) | 2–3 |
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
move `~/federation` → `~/nuncstans`; rename `~/federation-data` →
`~/nuncstans-data` (ledger flags, justfile, env shim); archive `~/fourfive`,
`nuncstans-hermes-stack`, `multi-stakeholder-simulater`, and the stray `~`
junk into `~/old/` (nothing deleted); carry LICENSE/NOTICE (Apache-2.0) to the
monorepo root; write a `README.md` per stack with a working one-command run;
prepare the remote repurpose (owner pushes).

Exit: `just up` works from `~/nuncstans`; `just check` green;
`rg -i federation` hits only `design/naming.md` and git history; every stack
README has a verified run command; story S-0 passes.

### Phase B — Single-origin shell + nunc-ui

Work: create `frontend/packages/nunc-ui` (§2.5 tokens + primitives); restyle
ME and world views; mount FourFive under `/fourfive/` behind the shell origin
(the old Phase-4 item); navigation chrome; the F9 provenance line stays on
home.

Exit: one origin serves ME + world + FourFive with the shared language;
stories S-1 and S-2 pass; a screenshot set is saved under `design/ui/`.

### Phase C — News newstack

Work: branch `newstack`; build the TS orchestrator that executes the daily
DAG as code (steps = functions, I/O = the existing sourcedata JSON schemas,
gates = the existing deterministic checks); build `packages/ai` (§2.6);
port the Python compute to TS against golden-master fixtures (Python stays as
the oracle until parity); sync the news subtree to the `~/news` tip before
any code change here (follow the re-sync recipe in `engines/news/FEDERATION.md`); move `analytics.sqlite` out of the repo to
`~/nuncstans-data/world/` (same file, same schema, same data — new location);
split `~/news` into a data+publishing remnant
(report/, docs/ Pages) fed by the monorepo pipeline (D3); schedule via WSL
cron/systemd calling the CLI; the Cowork Routine becomes an optional trigger
or retires.

Exit: one full daily run each of — (a) `claude-code` provider, (b) a
non-Anthropic or local provider with an external search adapter, (c) a replay
from stored artifacts with **zero LLM calls** — all producing a valid
dashboard (replay output identical except run metadata such as timestamps);
ported tests green against goldens; stories S-3 and S-4 pass. Content quality
across providers will differ; acceptance is structural validity, and quality
tuning is ongoing operations, not a phase gate.

### Phase D — Profiles + goal-loop surfaces

Work: profile store and Profiles screen; wire FourFive chat and News step
config to profiles; goal-verify toggle per chat message and per pipeline
step; run-log viewer in the shell; draft `contracts/agent-abi.md` v0; while
touching that code, fix FourFive's Claude streaming stub and stale default
model id.

Exit: profiles can be created and switched from the UI; a verify-on message
visibly loops (≤ max_iters), reports unmet gaps, and shows cost; a local
model via Ollama works under a profile; stories S-5 and S-6 pass.

### Phase E — FourFive app factory

Work: bundle generator (DDL, CRUD, MCP tools, UI, scenario tests — §2.8);
apps-host mounted at `/apps/`; metrics contract consumed by the strategy
read-out; generate `runway-tracker@v1`; prove agent co-use with a
profile-driven agent doing CRUD through MCP alongside the human UI.

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
- **S-7 (E):** Human and agent both add rows to runway-tracker; each sees the
  other's rows; the metrics view updates; the strategy read-out quotes only
  declared metrics.
- **S-8 (E):** I design a new tiny app in FourFive chat and use its generated
  UI in the same session, with its data file created in the vault.

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
    §2.3 resolves all four; historical documents will read oddly in places,
    and `design/naming.md` is the Rosetta stone rather than rewriting
    history.
11. **The vault has zero backup today,** and F11 (no remote) is the reason.
    Encrypted offline bundles square the circle (§2.9); pick a destination
    (D8). Losing `self/` loses the product's point.
12. **Execution environment matters for Fable.** better-sqlite3 (native
    module), pnpm, and cargo builds must run *inside WSL*; driving them over
    the Windows UNC path is slow and fragile. Execution sessions should run
    Claude Code inside WSL, or at minimum execute builds via `wsl.exe`. Also:
    the machine has different git identities on the WSL and Windows sides —
    confirm identity before the first push to the repurposed remote.
13. **Out of scope on purpose:** `manda` stays a separate OSS repo (the
    public/private boundary is why it was carved out); the monorepo may later
    *depend* on it for the mandate rail, not absorb it. `work/`,
    `obsidian-vault`, and `second_brain` are untouched. `old/` remains the
    graveyard and receives the newly archived items.

## 6. Open decisions

Defaults are chosen so execution can start immediately; say the word to flip
any of them.

| # | Decision | Default | Alternative |
|---|---|---|---|
| D1 | Repo topology | Single git monorepo | Nested per-stack repos (recreates drift; not recommended) |
| D2 | GitHub remote | Repurpose `baba-yu/nuncstans` (private) for the monorepo; owner pushes after an identity check | New repo name, or stay local-only |
| D3 | Public News dashboard | Keep: `~/news` becomes a data+publish remnant fed by the monorepo pipeline | Go fully local; retire Pages |
| D4 | Python pipeline | Port to TS with golden-master parity, then retire Python | Keep Python permanently as a pinned CLI |
| D5 | Engine rename | `engines/ledger` | `engines/self`, or keep `nuncstans-engine` and accept the collision |
| D6 | Primary accent | News cyan `#18c7d8` | FourFive blue `#5b8cff` |
| D7 | Default pipeline provider | `claude-code` (subscription), others selectable | API-first |
| D8 | Vault backup destination | Encrypted weekly bundle to a second local disk; owner adds an offsite copy | Owner-specified (e.g., encrypted cloud object storage) |

## 7. Execution protocol

- Executor: Fable, one phase per stretch, plan → implement → verify → owner
  review gate. Stories are executed and evidenced before a phase closes.
- Owner actions that Claude cannot perform on this machine: GitHub pushes
  (credential manager auth), and the D2 remote repurpose.
- This plan document is updated (not rewritten) as decisions D1–D8 are
  confirmed; each phase closure links its verification file.
