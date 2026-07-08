# Phase E Implementation Plan — FourFive app factory (bundle generator + apps-host + agent co-use)

**Status: PROPOSED — awaiting the §7 two-step (decisions PE1–PE14
ratified, then the plan approved) plus the Phase E round-3 precondition:
the Design spec section below (bundle format, apps-host API, MCP
surface, codegen approach, security rails) is the design spec the v1
plan requires owner-approved before code. No code before all of it.**

**Goal:** FourFive stops stopping at a markdown spec. From a frozen
blueprint version it emits a **runnable app bundle**; a new **apps-host**
process serves every bundle under the single origin at `/apps/<slug>/`
(generated UI for the human, REST + MCP tools for agents) with per-app
user data in `<data store>/apps/<slug>/data.sqlite`; `app.json` declares
**named metrics** (SQL views) and the stage-3 strategy read-out consumes
*only* those; `nunc-stans-agent` gains the general MCP tool client Phase
D deferred and operates the same app the human uses (the co-use loop).
First bundle: **runway-tracker@v1** (journey T10). Exit: runway-tracker
usable by human (generated UI) and agent (MCP) with data in the store; a
second, unrelated small app generated end-to-end in one sitting; S-7 and
S-8 pass; S-10 re-run; 3-OS CI green.

**Architecture:** generation and hosting are split on the §13 boundary.
The **generator lives in FourFive** (artifact jurisdiction): a
deterministic, LLM-free transform from a frozen blueprint version to
`versions/<N>/bundle/` — generating a bundle is also the act that
freezes the version (F7 becomes mechanical; today every save rolls a new
version but `setSoftwareStack` patches the current one in place,
`server/workspace.ts:159-172` — exactly the BL-1 shape the constitution
warns about, closed here for the factory path). The **host lives on the
Nunc Stans side** (new top-level `apps-host/`, Hono, loopback :8788
behind the gate at `/apps/`): it *interprets* bundles — no generated
code is ever executed (v1 plan §5 note 8) — mounting generic CRUD
routes, compiling declared metrics into SQLite views, serving one
manifest-driven UI shell built on nunc-ui, and exposing the declared MCP
tool surface. The two sides meet only through the new
**`contracts/app-bundle.md`** (bundle manifest, tool naming, metrics
contract, apps-host published API) — engines never touch each other's
internals (§13-A). The FourFive workspace moves from its repo-anchored
location (`server/db.ts:13`) into `<data store>/artifact/`, fulfilling
§2.9 and giving apps-host one data root to scan read-only.

**Tech stack:** TypeScript on node 24 throughout; Hono +
`@hono/node-server` (apps-host — same as fourfive); better-sqlite3
(WAL, one process owns all app DBs); `@modelcontextprotocol/sdk`
(server side this time; Streamable HTTP first, stdio bridge fallback —
spiked at T1 like Phase D's elicitation probe); Vue 3 + nunc-ui for the
generic UI shell (one vite build, not per-app); vitest; Rust only for
the gate's `/apps/` mount. Ollama `qwen3.6:27b` for live tool-calling
(tool support probed at T0); `mock` provider scripted for CI.

---

## Design spec (the round-3 owner gate)

### 1. Bundle format

`<data store>/artifact/apps/<slug>/versions/<NNN>/bundle/`, five files,
all deterministic functions of the frozen `blueprint.json` beside them:

```
app.json          manifest: {slug, version, name, description,
                  entities[], metrics[], stories[], ui{screens[]},
                  generated_at, blueprint_hash}
schema.sql        SQLite DDL: one table per entity (typed columns from
                  EntityColumn; id pk added if absent; created_at,
                  updated_at, archived_at appended to every table) +
                  CREATE VIEW metric_<name> per declared metric
mcp-tools.json    the declared tool surface, verbatim JSON Schemas:
                  <slug>_<entity>_{list,get,create,update,archive}
ui.json           screen manifest derived from mock_ui (screens, fields,
                  maps_to bindings) — consumed by the generic UI shell
tests/scenarios.json  data-driven scenario specs (see §4)
```

- The blueprint (`engines/fourfive/shared/blueprint.ts`) gains two
  fields Phase E needs: `metrics: {name, label, sql}[]` and
  `stories: {id, title, scenario}[]` — elicited by the chat extractor,
  validated by the zod schema, shown as tabs.
- **Generating a bundle freezes the version**: `app_versions` gains
  `frozen_at` + `bundle_hash`; a frozen version refuses every in-place
  patch (`setSoftwareStack` on it rolls a new version instead).
  Regeneration of a frozen version must be byte-identical (asserted by
  test) or is refused — F7 and the permission table's "a cut version is
  immutable" become code.
- App user data is NOT in the bundle: `<data store>/apps/<slug>/`
  holds `data.sqlite` plus `installed.json` (`{slug, version,
  schema_hash, installed_at}` — appended per version switch, never
  rewritten), created lazily on first serve (S-8's "data file created
  in the vault").

### 2. apps-host API

One Hono process, loopback `127.0.0.1:8788` (fixed, like fourfive's
8787), fronted by the gate at `/apps/` (new `--apps-url` flag, same
nested-proxy pattern as `/fourfive`, `gate/src/lib.rs:62-103`). It
discovers bundles by scanning `<data store>/artifact/apps/*/versions/*`
on request (stat-cheap, no fourfive→apps-host runtime call — S-8's
same-session use needs zero coupling), serving the **latest frozen
version** per app.

```
GET  /apps/api                      installed apps [{slug, version, name}]
GET  /apps/<slug>/api/manifest      the served app.json
GET  /apps/<slug>/api/metrics       [{name, label, value}] — computed from
                                    the metric_<name> views, nothing else
GET  /apps/<slug>/api/<entity>          list (archived excluded; ?archived=1)
POST /apps/<slug>/api/<entity>          create
GET  /apps/<slug>/api/<entity>/<id>     get
PATCH /apps/<slug>/api/<entity>/<id>    update
POST /apps/<slug>/api/<entity>/<id>/archive   soft-delete (no DELETE route)
GET  /apps/<slug>/                  generic UI shell (one static Vue build)
/apps/mcp                           MCP endpoint (transport per PE6 spike)
```

- Every write is parameterized SQL against the entity's declared
  columns; unknown fields 400 (the gate's deny-unknown discipline).
- `updated_at` maintained by the host on every write; archive sets
  `archived_at` — full CRUD on working data per §2.8, never the ledger.
- Version skew: if `data.sqlite`'s recorded `schema_hash` doesn't match
  the served bundle, the app mounts read-only with an instructive error
  (migrations are deferred, named in Non-goals).
- The UI shell is ONE manifest-driven Vue app (nunc-ui Panels, tables,
  forms rendered from `ui.json` + entity schemas): no per-app build
  step, so a bundle generated mid-session is usable seconds later
  (S-8), and every generated app shares the design system.

### 3. MCP surface

- Tool naming: **`<slug>_<entity>_{list,get,create,update,archive}`**.
  The v1 plan §2.8 sketch used dots (`<slug>.<entity>.list`);
  superseded here because provider tool-name charsets are
  underscore/dash alphabets (re-verified against the `claude-api` skill
  at implementation time, the PD precedent for model ids); slugs
  already slugify to dash-safe.
- The tool list served is exactly the frozen `mcp-tools.json` — the
  declared surface is the served surface (reviewable, F7-frozen).
  Tool handlers call the same REST routes (one write path, one
  enforcement point; "agents operate the same app the human uses" is
  literal).
- Transport: **T1 spike** — TS SDK Streamable HTTP server in apps-host
  ↔ the agent's existing SDK client. Fallback if it fights: a thin
  `apps-host mcp-stdio` bridge process whose handlers hit the REST API
  (reuses the agent's proven stdio transport; still one writer).
  Decision recorded at T1 either way, nothing built on the loser.
- Agent side: `nunc-stans-agent` gains the general MCP tool client
  (Phase D's named deferral). The profile's `skills` array is the tool
  allowlist (agent-abi §2): **no app tools unless the profile grants
  them** — grant by `apps:<slug>` (all five verbs) or full tool name.
  nunc-ai gains the tool-calling contract: `ChatOptions.tools`,
  provider-side tool_use for `ollama` + `anthropic-api` (+ scripted
  `mock`), and a bounded tool loop (`maxToolCalls`, default 8) beside
  the verify middleware; tools+verify composed in one call is a config
  error in v0 (named). Run-log entries gain `toolCalls?: {name,
  count}[]` — additive, like every Phase D field.

### 4. Codegen approach

**Deterministic templates, no LLM, no emitted executable code.** The
generator (`engines/fourfive/server/bundle/`) is a pure function
blueprint → five files; same input, same bytes (golden test). The
LLM's contribution ends at the blueprint (already schema-validated);
everything runnable is the host's generic, tested-once runtime
interpreting manifests. This supersedes §2.8's sketch of generated
`crud.ts` / per-app Vue screens — recorded, with reasons: (a) §5 note
8's rail "no arbitrary generated logic execution" is strongest when
there is nothing to execute; (b) S-8's same-session use forbids a
per-app build step; (c) one runtime bug-fix upgrades every app.
`business_logic` rules do NOT become code in v1 — they remain spec
prose carried in the blueprint (Non-goals).

Scenario tests v0: `tests/scenarios.json` is generated from the
entities (per entity: create → list → get → update → archive → list
excludes) plus one metrics assertion block (seed declared rows, assert
each `metric_<name>` view executes and returns a number). apps-host
ships the runner (`apps-host/test/bundle-runner`) executing any
bundle's scenarios against a temp store — runway-tracker's bundle runs
in CI. Deriving richer scenarios from `stories[]` (LLM work) is
deferred; stories ride the manifest for traceability (S-7/T11 need the
metrics, not story compilation).

### 5. Security rails

1. **No generated code execution** (§4 above) — the whole class is out.
2. **Loopback-only** apps-host, plain HTTP behind the gate like the
   engine and fourfive; no TLS, no external listener.
3. **Metrics SQL is the only owner/LLM-authored SQL that runs**: the
   generator AND the host both validate it (defense in depth, the F3
   pattern): a single `SELECT` statement (no `;`, no
   ATTACH/PRAGMA/write verbs), compiled as `CREATE VIEW`, queried on a
   **read-only** connection (`{readonly: true}` + `query_only`).
4. **CRUD is parameterized** against declared columns only;
   deny-unknown 400s; payload size capped.
5. **Per-app isolation**: one SQLite file per slug; handlers resolve
   strictly `<data store>/apps/<slug>/`; no cross-app reads in v0
   (metrics views see their own DB only).
6. **F3/self untouched by construction**: app tools reach app DBs, not
   the self engine; the agent's F3 guard and profile rails from Phase D
   stand unchanged. App data is working data (full CRUD, soft-delete
   audit trail); the ledger's permission table is not in this path.
7. **F11**: everything lands under the local data store; no remotes, no
   telemetry. (`just backup`, when D8 lands, must include `apps/` —
   noted, not built here.)
8. **No external side effects from apps**: the host's runtime makes no
   network calls; a generated app cannot call out (there is no code to
   do it) — the agent-abi mandate question for *resident* operation
   stays out of scope (F14 enforcement is SPL v3 / Phase F+ territory).

---

## Design decisions (proposed — owner ratification required before code, per §7)

| # | Decision | Choice |
|---|---|---|
| PE1 | Branch point | `phase/e` off `dev` at fd7d5d4 (post PR #4 — already cut; the `just down`/`restart` WIP recovered onto it as `tool:` 6aed042). Phase D's owner gates (S-10 re-run, CI push, screenshots, **agent-abi review**, close commit) remain open on `dev`'s record; Phase E does not block on them, but the agent-abi review becomes **load-bearing here** (PE9 extends the agent's tool surface it describes) — listed first under Owner actions. |
| PE2 | Generator jurisdiction & determinism | Generator inside FourFive (`server/bundle/`), pure blueprint→bundle templates, zero LLM, byte-stable (golden-tested). Host never generates; fourfive never hosts. Alternative — LLM-assisted codegen per app (rejected: §5 note 8, un-testable surface, breaks S-8's instant use). |
| PE3 | No emitted executable code | Bundle = data (`app.json`, `schema.sql`, `mcp-tools.json`, `ui.json`, `scenarios.json`); apps-host interprets. **Supersedes** the §2.8 sketch's `crud.ts` + generated Vue screens (recorded in the v1 plan at close, PD-style). The sketch's intent (CRUD at `/apps/<slug>/api`, generated UI, MCP tools) is delivered — as interpretation, not emission. |
| PE4 | apps-host placement | New top-level **`apps-host/`** (product side, §13: FourFive-made programs run ON Nunc Stans), Hono on fixed loopback :8788, gate-fronted at `/apps/` via `--apps-url`. New commit area **`apps`** (PD15 precedent: commit-scope regex + CONTRIBUTING + workspace glob + enumerated CI steps). Alternative — mount inside fourfive's server (rejected: design-time vs runtime jurisdictions blur; gate already composes processes cleanly). |
| PE5 | Workspace → data store | `WORKSPACE_DIR` resolution moves from repo-anchored (`server/db.ts:13`) to `<data store>/artifact/` via the shared data-dir resolver (env `FOURFIVE_WORKSPACE` override for tests). Fulfills §2.9 ("artifact/ moves out of the repo"); gives apps-host one root; keeps per-user data out of the repo. One-time owner migration: move `engines/fourfive/workspace/` → `<store>/artifact/` (doctor prints the exact `mv`; absent dir = fresh start, not an error). Alternative — defer the move and point apps-host at the repo path (rejected: institutionalizes the wrong home and a second `--instances-dir`-style special case). |
| PE6 | MCP transport | Streamable HTTP endpoint on apps-host, **spiked at T1** against the agent's TS SDK client before anything rides it (the PD10 pattern). Fallback: `apps-host mcp-stdio` bridge → REST (agent's proven transport; single writer preserved). Tools always call the REST layer, never SQLite directly. |
| PE7 | Tool naming | `<slug>_<entity>_{list,get,create,update,archive}` — underscores, not the sketch's dots (provider tool-name charsets; id verified against the `claude-api` skill at implementation time). The served list is exactly the frozen `mcp-tools.json`. |
| PE8 | Metrics contract | `metrics[] = {name, label, sql}` in the blueprint → `CREATE VIEW metric_<name>` in `schema.sql` → `GET /apps/<slug>/api/metrics` values. The stage-3 strategy read-out consumes **only that endpoint**, and its card must carry `grounding ⊆ declared metric names` — checked in code, not prose (S-7's mechanical criterion; constitution "metrics the app does not measure are not grounds"). Cross-app / cross-store metric SQL: refused in v0. |
| PE9 | nunc-ai tool-calling | `ChatOptions.tools` + provider tool_use (`ollama`, `anthropic-api`, scripted `mock`) + a bounded tool loop (`maxToolCalls` default 8) in nunc-ai — the reusable middleware home, like the verify loop (PD5's logic). tools+verify in one call = config error in v0. All fields additive; pipeline/fourfive suites must stay green untouched (the PD compatibility rule). |
| PE10 | Agent tool gating | Profile `skills` is the allowlist (agent-abi §2 finally has teeth): `apps:<slug>` grants an app's five verbs; default profiles grant none. The agent lists connected app tools at startup (`/tools`), logs every call in the run-log entry (`toolCalls`), and S-7 executes both a granted and a refused path. No mandate object for app CRUD in v0: mandates govern memory (manda) and future resident operation (F14) — app working-data writes are gated by profile + the host's rails; recorded honestly in the abi cross-reference at T5. |
| PE11 | Freeze semantics | Bundle generation freezes the blueprint version (`frozen_at`, `bundle_hash`); frozen versions refuse in-place patches; regeneration must reproduce bytes or refuse. Closes the factory path's BL-1 shape (`setSoftwareStack` in-place patch, `workspace.ts:159-172`) without touching the rolling-save UX for unfrozen versions. |
| PE12 | Strategy read-out scope | A FourFive stage-3 card (`/strategy` in a session bound to an app with a served bundle): fetches `GET /api/metrics` (published API, §13-A-legal), prompts the profile's model with declared metrics ONLY, renders `{win, constraint, risk_to_watch, grounding[]}` with the version reference (`<slug>@v<N>`), dismissable, **ephemeral**. Persistence into `superposition_state` + the `informed_by` edge (journey T11's full form) needs the SPL lane that does not exist (`engines/nunc-stans` has no superposition record) — deferred and **named as a Phase F prerequisite**, not silently absorbed. |
| PE13 | contracts/app-bundle.md | New contract: bundle manifest schema, tool naming, metrics contract, apps-host published API, freeze semantics. Drafted **after** the generator + host prove the shapes (T5, mid-phase — §13-D write-late, the agent-abi T8 precedent), owner-reviewed at close. Glossary gains bundle / generated app / metric / apps-host. |
| PE14 | Exit generality proof | The second app is designed live in one sitting at T10 (chat → blueprint → freeze → bundle → CRUD via UI and agent), deliberately not pre-designed in this plan — pre-designing it would fake the generality it proves. runway-tracker@v1 itself is built through the real chat flow at T9 (journey T10's path), not hand-authored JSON. |

Derived decisions:

- **Mock-degradation rule (§2.10) holds:** bundle generation is
  LLM-free; the UI shell and CRUD need no model; S-7's agent leg runs
  scripted on `mock` in CI (tool_use scripted) with the live Ollama
  pass at story execution; the strategy card demos on `mock` via the
  offline-demo pattern.
- **Blueprint compatibility:** `metrics`/`stories` are optional
  collections defaulting to `[]` — every existing blueprint parses;
  fourfive's 24 tests stay green before their extension.
- **`just down`/`restart` learn :8788** with the apps-host recipe
  (down.ts port list).
- **Import rules:** `apps-host/` may import `contracts/` and
  `frontend/packages/*` (nunc-ui for the shell, nothing engine-internal)
  — `tools/check.ts` FD-7.4 extended to cover `apps-host/` at T1.
- **Screenshots** land under `design/ui/phase-e/` (generated UI, agent
  co-use terminal, strategy card) per the B/C/D precedent.

---

## Execution notes

- Execute inside WSL (§5 note 12); scratch stores via `NS_DATA` for
  every test and story run; the owner's live store is never written by
  tests; production `~/news`: zero contact (standing).
- The workspace move (PE5) lands **before** apps-host consumes it
  (T3 before T6); the owner's existing `engines/fourfive/workspace/`
  is migrated by hand with the doctor's printed `mv` — the code never
  auto-moves user data.
- Commit areas: `ff` (blueprint, generator, strategy card), `apps`
  (apps-host — new), `fe` (nunc-ai tools, Formans link), `agent` (tool
  client), `gate` (/apps mount), `contracts` (app-bundle, glossary),
  `tool` (justfile, CI, check.ts, doctor), `design`. One commit = one
  area; `node tools/commit-scope.ts` + `node tools/check.ts` after
  each.
- Rollback: every piece is additive (new dirs, optional fields, new
  routes); PE5 is the one move — revert = point the resolver back and
  `mv` again; frozen-version rows are new columns, nullable.

## Risks

1. **Largest-item risk (§5 note 8) — scope inflation.** Mitigated by
   PE2/PE3 (nothing executable, one generic runtime), the narrow REST
   surface, and stories as the only acceptance bar.
2. **MCP Streamable HTTP interop unproven** (TS SDK server ↔ the
   agent's client). T1 spike before anything rides it; stdio-bridge
   fallback recorded (PE6) — the PD10/risk-8 playbook, which worked.
3. **Ollama tool-calling quality** (`qwen3.6:27b` tools support probed
   at T0; the S-7 agent leg accepts any tool-capable local model, with
   `mock` keeping CI deterministic). Structural acceptance, not
   model-brilliance acceptance.
4. **Workspace move breaks fourfive's relative-path discipline.** The
   DB stores WORKSPACE_DIR-relative paths precisely so the root can
   move (`workspace.ts:11-23`); tests re-anchor via env override; the
   migration is a directory move, not a rewrite. Fourfive's suite is
   the gate.
5. **Freeze semantics vs existing UX**: saves roll versions freely
   today; only frozen versions harden. Watch for hidden in-place
   writers besides `setSoftwareStack` (audit at T2 — `saveMarkdown`
   writes beside, not into, the blueprint).
6. **Metrics SQL is user/LLM-authored SQL.** Double validation +
   read-only execution (rail 3); worst case is a broken view, surfaced
   as a readable metric error, never a write.
7. **SQLite concurrency**: one process (apps-host) owns app DBs; WAL +
   busy_timeout; the MCP path goes through REST (PE6) so there is no
   second writer. If the stdio bridge is used, it also calls REST —
   still one writer.
8. **Gate proxy + SSE/streaming**: the existing `forward()` never
   buffers (proven for fourfive SSE); `/apps` reuses it unchanged.
9. **3-OS**: better-sqlite3 prebuilds cover all three (standing since
   Phase A); apps-host CI steps enumerated (PD15 lesson); Windows path
   handling rides the shared data-dir resolver.

## File map (new/changed)

- Create: `apps-host/**` (server, mcp, ui shell, bundle-runner tests) ·
  `engines/fourfive/server/bundle/**` (generator + goldens) ·
  `contracts/app-bundle.md` · `design/stories/S-7.md`, `S-8.md` ·
  `design/verification/phase-e.md` · `design/ui/phase-e/**`
- Modify: `engines/fourfive/shared/blueprint.ts` +
  `server/blueprint-schema.ts` (metrics, stories) · `server/db.ts`
  (WORKSPACE_DIR via data-dir resolver) · `server/workspace.ts` (freeze
  columns + refusals) · `server/index.ts` (bundle endpoint, strategy
  card route) · `server/llm/blueprint-prompt.ts` (elicit metrics/
  stories) · fourfive Vue (`src/**`: metrics/stories tabs, Generate
  bundle button, strategy card) · `frontend/packages/ai/src/{types,
  index}.ts` + providers (tools) · `agents/nunc-stans-agent/src/**`
  (tool client, /tools, gating) · `gate/src/{main,lib}.rs`
  (`--apps-url`, `/apps` nest) · `justfile` (`_up-apps`, up, gate flag)
  · `tools/down.ts` (:8788) · `tools/check.ts` (import scope) ·
  `tools/commit-scope.ts` + `CONTRIBUTING.md` (area `apps`) ·
  `pnpm-workspace.yaml` · `.github/workflows/ci.yml` (apps-host steps)
  · `tools/bootstrap.sh` (artifact/ migration hint in doctor) ·
  `contracts/glossary.md` · `contracts/agent-abi.md` (tool-surface
  cross-reference note, PE10) · v1 plan in-place supersede notes at
  close (PE3, PE7; §2.9 artifact note)

## Tasks

Dependency-first: the two unproven externals (MCP HTTP transport,
Ollama tools) are spiked/probed before anything is built on them; the
workspace move lands before its consumer; stories are written at T1 as
executable specs. Session guide (3–5 sessions): **S1** = T0+T1+T2 ·
**S2** = T3+T4 · **S3** = T5+T6 · **S4** = T7+T8 · **S5** = T9+T10 ·
**S6** = T11+T12 (five if T5 folds into S3's tail).

### Task 0: Preflight (design)
- [ ] Verification doc opened: re-measured baselines (all suites),
      Ollama tool-support probe (`qwen3.6:27b` tools smoke via nunc-ai),
      Phase D owner-gate status recorded (open items listed, non-blocking
      rationale), workspace dir contents inventoried.
- [ ] Plan commit + `pre-phase-e` tag.

### Task 1: Registration, stories, MCP spike (tool, design, apps)
- [ ] Area `apps` registered (commit-scope, CONTRIBUTING, workspace
      glob, CI steps, check.ts import scope).
- [ ] S-7 / S-8 written as executable specs with mechanical verdicts
      (S-7 includes the refused-tool path and the grounding⊆declared
      check; S-8 includes the same-session clock).
- [ ] apps-host scaffolded; **T1 spike**: SDK Streamable HTTP server ↔
      agent SDK client round-trip (list tools, call one) — PE6 decided
      on evidence; result recorded in the verification doc.

### Task 2: Blueprint metrics + stories (ff)
- [ ] `metrics[]`/`stories[]` in shared type + zod (+ default `[]`),
      extractor prompt elicits both, tabs render them; in-place-writer
      audit (risk 5) recorded.

### Task 3: Workspace → data store (ff, tool)
- [ ] `WORKSPACE_DIR` via data-dir resolver → `<store>/artifact/`
      (`FOURFIVE_WORKSPACE` test override); doctor prints the migration
      `mv` when the old repo dir is non-empty; fourfive suite green
      re-anchored.

### Task 4: Bundle generator + freeze (ff)
- [ ] `server/bundle/`: blueprint → five files, deterministic
      (golden byte-equality test); DDL/type map; metric view SQL
      validation (rail 3, generator side); `POST
      /api/apps/:id/versions/:n/bundle` + UI button; freeze columns +
      in-place patch refusal + regeneration identity.

### Task 5: contracts/app-bundle.md (contracts)
- [ ] Drafted from the proven shapes (PE13); glossary entries;
      agent-abi cross-reference note (PE10). Owner review at close.

### Task 6: apps-host v0 (apps)
- [ ] Bundle discovery (scan, latest-frozen); per-app DB init
      (idempotent schema apply, `installed.json`, schema-hash guard);
      REST CRUD + `/api/metrics` (read-only conn) + manifest; host-side
      SQL validation (rail 3, host side); UI shell (nunc-ui,
      manifest-driven forms/tables/metrics panel); scenario runner
      executes any bundle's `scenarios.json`; vitest suite incl. a
      fixture bundle.

### Task 7: Gate mount + stack wiring (gate, tool, fe)
- [ ] Gate `--apps-url` + `/apps` nest (proxy tests); justfile
      `_up-apps` + 4-way `up`; down.ts learns :8788; Formans topbar
      "Apps" link. Live check: `curl /apps/api` through the gate.

### Task 8: nunc-ai tools + agent tool client (fe, agent)
- [ ] `ChatOptions.tools` + tool loop + provider tool_use
      (ollama/anthropic/mock scripted); run-log `toolCalls`; suites
      green untouched (PD compatibility rule).
- [ ] Agent: connect to apps-host MCP per PE6, `/tools`, profile
      `skills` gating (`apps:<slug>`), refusal surfaced verbatim,
      every call logged.

### Task 9: runway-tracker@v1 + strategy card (ff, design)
- [ ] Built through the real chat flow (T10 journey path): entities
      (deals, income entries, cash snapshots), the four T10 metrics
      (monthly_external_income, deals_in_discussion, cash_runway,
      income_concentration); freeze + bundle; live CRUD via UI.
- [ ] `/strategy` card per PE12 (grounding⊆declared enforced in code);
      dismissable; version-stamped.

### Task 10: Stories S-7 / S-8 execute + second app (design)
- [ ] S-7: human row + agent row (granted path), refused path, both
      visible both ways, metrics update, strategy card grounded-only —
      numbered verdicts + transcripts.
- [ ] S-8: new tiny app designed→frozen→bundled→used in ONE session
      (PE14), data file in the store — the generality proof.

### Task 11: S-10 re-run + exit sweep (tool, design) — owner-gated
- [ ] Pristine Ubuntu + native Windows: clone → bootstrap → up →
      home screen; `/apps/` reachable; doctor output archived; push
      for 3-OS CI; screenshots → `design/ui/phase-e/`.

### Task 12: Plan updates + close (design)
- [ ] v1 plan in-place supersede notes (PE3, PE7, §2.9 artifact);
      naming/reading-order/CONTRIBUTING rows; verification doc exit
      checklist; owner gates: app-bundle contract review, merge
      `phase/e` → `dev`, PR, close commit.

## Exit criteria (phase closes when all hold)

1. runway-tracker@v1: frozen version, bundle, human CRUD via the
   generated UI at `/apps/runway-tracker/`, data in
   `<store>/apps/runway-tracker/data.sqlite`. [T4, T6, T9]
2. `nunc-stans-agent` operates the same app through MCP under a
   profile grant; each side sees the other's rows; a non-granted tool
   is refused. [T8, T10]
3. Declared metrics served at `/api/metrics`; the strategy card quotes
   only declared metrics (mechanical check) with the version
   reference. [T6, T9]
4. A second, unrelated app generated end-to-end in one sitting. [T10]
5. S-7, S-8 written (T1), executed, passing with evidence in
   `design/verification/phase-e.md`. [T10]
6. `contracts/app-bundle.md` drafted and owner-reviewed; glossary
   updated. [T5]
7. Bundle generation is deterministic and freezing (byte-identity +
   refusal tests); no generated code is executed anywhere. [T4, T6]
8. Standing: S-10 re-run passes (incl. `/apps/`), 3-OS CI green,
   screenshots under `design/ui/phase-e/`. [T11]
9. `design/verification/phase-e.md` complete; v1 plan/naming/
   reading-order updated in place; owner merge/push/PR gate. [T12]

## Owner action items

1. **Close Phase D's open gates** — S-10 re-run, CI push, screenshots,
   the phase-d close commit, and above all the **agent-abi v0 review**:
   PE10 extends exactly the surface it describes (do this before or
   alongside ratifying PE9/PE10).
2. **Ratify PE1–PE14, then approve this plan** (the §7 two-step; the
   Design spec section is the round-3 precondition artifact — say so
   explicitly in the approval).
3. **Workspace migration** (one `mv`, printed by the doctor after T3
   lands) at a moment of your choosing before T6 story runs.
4. At close: review `contracts/app-bundle.md`; merge/PR gate.

## Non-goals (deliberate, named)

- **Arbitrary generated logic execution** — no emitted code runs;
  `business_logic` stays spec prose (v1 plan §5 note 8).
- **External deployment / remote access** — loopback behind the gate
  only; distribution stays §2.10's per-user instance.
- **Schema migrations between app versions** — mismatch = read-only +
  instructive error; migration tooling is future work.
- **Cross-app data access / cross-app metrics** — per-slug isolation.
- **Story-compiled scenario tests** (LLM-generated tests) — v0 derives
  scenarios from entities; `stories[]` ride for traceability.
- **superposition_state persistence + informed_by edge** for the
  strategy card — SPL lane, named Phase F prerequisite (PE12).
- **Resident/scheduled agent operation & F14 mechanical enforcement**
  — interactive co-use only; registration enforcement is SPL v3+.
- **App-delete API, transitive dependency composition, token
  compression** — the 2026-06-09 composition design's own deferrals
  stand.
- **tools+verify composition in one call** — config error in v0 (PE9).
- **openai/google providers** — still no story needs them.

## Verification plan (`design/verification/phase-e.md` must contain)

- Header: start date, `pre-phase-e` tag, branch, plan link with both
  approval dates; Phase D open-gate status snapshot.
- Preflight: re-measured baselines; Ollama tools probe; T1 spike
  verdict (transport decision evidence).
- Evidence log per task with commit hashes, suite counts, bugs
  found-in-phase in bold; EXECUTED sections for S-7/S-8 with
  transcripts and numbered mechanical verdicts (phase-c/d style).
- Determinism record: the byte-identity test + one manual double-run.
- **Constitutional check record:** freeze/F7 refusal output; the
  grounding⊆declared check output; F3 rails untouched (agent suite);
  F11 locality (no remotes, no telemetry, apps data local);
  §13 one-path (fourfive↔apps-host only via contract + published API
  — import check extended and green).
- S-10 re-run record incl. `/apps/`; CI link; screenshot index.
- Exit checklist mirroring the nine items with owner-gate lines.

## Self-review (done at write time)

- The v1-plan Phase E paragraph is fully covered: bundle generator ✓
  (T4, shapes per §2.8 with PE3's recorded supersession), apps-host at
  `/apps/` ✓ (T6/T7), metrics contract + strategy read-out ✓ (PE8/PE12,
  T9), `runway-tracker@v1` ✓ (T9), agent co-use via MCP ✓ (T8/T10),
  second app + S-7/S-8 exit ✓ (T10).
- Deviations from the §2.8 sketch are decisions, not drift: crud.ts/
  per-app Vue → declarative + generic runtime (PE3); dot tool names →
  underscores (PE7); scenario tests narrowed to entity-derived v0
  (Design spec §4). Each gets a supersede note at close.
- The five round-3 spec areas the precondition names are each a
  headed section under Design spec.
- Constitution: §13-A honored (contract + published API only, both
  directions); §13-D write-late honored (T5 after shapes proven); F7
  made mechanical (PE11); F3/F11 untouched and re-verified; §10-B one
  origin holds (/apps behind the gate).
- Facts this plan stands on, verified 2026-07-08: fourfive workspace
  repo-anchored (`server/db.ts:13`) with rolling versions +
  `setSoftwareStack` in-place patch (`workspace.ts:100-123,159-172`);
  blueprint type has no metrics/stories (`shared/blueprint.ts`); gate
  routes/proxy pattern (`gate/src/lib.rs:62-103`); agent MCP client is
  manda-only stdio; nunc-ai declares `tools` capability but has no
  tools contract; CI enumerates per-package steps; no superposition
  record in `engines/nunc-stans` (docs only); S-7/S-8 exist only as v1
  plan §4 lines; `contracts/app-bundle.md` does not exist.
