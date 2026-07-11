# Phase E verification record — FourFive app factory

- Start: 2026-07-08. Branch `phase/e` off `dev` at **fd7d5d4** (post
  PR #4); tag `pre-phase-e` = fd7d5d4.
- Plan: `design/development/2026-07-08-phase-e-plan.md` — decisions
  PE1–PE14 ratified AND plan approved (incl. the round-3 design spec
  section) by the owner in session, 2026-07-08.
- Constraints carried: scratch stores (`NS_DATA`) for every test/story
  run — the owner's live store is never written by tests; production
  `~/news` zero contact (standing); execute inside WSL (§5 note 12).

## Preflight (T0, 2026-07-08)

Re-measured suite baselines (WSL, this box):

| suite | count |
|---|---|
| nunc-fluens pipeline | 193 passed |
| nunc-ai (frontend/packages/ai) | 35 passed |
| fourfive | 24 passed + typecheck green |
| Formans | 20 passed |
| agent (nunc-stans-agent) | 22 passed |
| gate (Rust) | 6 unit + 12 integration |
| ns engine (Rust) | 11 |
| tools/check.ts | ok (FD-3.2, import scope, edge schema) |

Environment probes:

- **Ollama tools probe PASSED** (plan risk 3): `qwen3.6:27b` given a
  `get_weather` tool over `/api/chat` returned a well-formed
  `tool_calls` block (`{"name":"get_weather","arguments":{"city":
  "Tokyo"}}`) plus thinking, `done_reason:"stop"`, ~1.8s. 35b remains
  the on-disk fallback (`ollama list` archived).
- FourFive workspace inventory (pre-PE5 move, repo-anchored
  `engines/fourfive/workspace/`): `codev.db` (+wal/shm) and
  `apps/{invoice-app, invoice-app-2..4, composite-smoke-app}` — Phase
  B–D dev/test artifacts; the owner's one-time `mv` migrates them at
  T3+ (doctor prints the line).
- Phase D owner-gate snapshot (open, non-blocking for E per PE1):
  S-10 re-run, CI push, screenshots → `design/ui/phase-d/`,
  **agent-abi v0 review** (load-bearing for PE10 — flagged), phase-d
  close commit.

Mid-session note (pre-plan): the owner committed the down/restart WIP
as 567469c (`ci:` — unregistered area, left as history); the next
commit 6aed042 ported it to `tools/down.ts` per the TS-tooling
convention (same port-based semantics + Windows netstat path); the
owner accepted in session.

## Evidence log

- **2026-07-08 — T0 done**: plan proposed (d13b7ca), approved in
  session, status flipped in place; `pre-phase-e` tagged; baselines
  above re-measured (not copied); Ollama tools probe green.
- **2026-07-08 — T1 done** (e20ddd3 tool, faf4d24 apps, this commit
  design — the PD15 registration pattern): area `apps` registered
  (commit-scope regex, FD-7.4 widened to `apps-host/` and green,
  workspace glob, two enumerated CI steps); S-7/S-8 written as
  executable specs (S-7 pins the allowlist refusal + the
  grounding⊆declared code check; S-8 pins the same-session clock and
  the freeze refusal); apps-host scaffolded (Hono skeleton on :8788,
  strict tsconfig incl. `erasableSyntaxOnly`, typecheck + 1 test
  green). **T1 spike PASSED (PE6 decided on evidence): the TS SDK
  1.13 Streamable HTTP transport round-trips initialize → tools/list
  → tools/call in-process (48ms), stateful session mode,
  `enableJsonResponse` — the MCP surface rides HTTP; the stdio bridge
  fallback is NOT needed.** Spike tool named in the PE7 shape
  (`spike-app_echo_create`).
- **2026-07-08 — T2 done** (04be461 ff): blueprint gained `metrics[]`
  (name snake_case-railed at the zod boundary, label, sql) and
  `stories[]`, both defaulting to `[]` — the pre-E shape parses
  untouched (regression-tested); extractor prompt elicits both;
  Metrics/Stories tabs in the temp-app panel; the offline invoice demo
  carries two metrics + a story (and the `invoices.status` column its
  own state transitions implied). fourfive 24→28 green, typecheck
  (vue-tsc + server tsc) green. **Risk-5 audit done**: the only
  in-place writer of a version's `blueprint.json` is `setSoftwareStack`
  (`workspace.ts:167`) — T4's freeze refusal targets exactly it;
  `saveMarkdown` writes the derived `output.md` beside the blueprint
  (allowed on frozen versions v0 — a render, not the source; noted for
  T4's test).
- **2026-07-08 — Amendment PE9' noted in this record** (owner-ratified
  in session, written into the plan by the parallel onboarding lane):
  local backend Ollama → llama.cpp; T0's Ollama probe stands as
  historical evidence, and the PE9'/T0 retarget (llama-server GGUF tool
  probe) is owed before T8 rides it. The parallel lane's WIP
  (tools/setup.ts, llamacpp provider, mandate helper) is untouched by
  this lane's commits.
- **2026-07-08 — T3 done** (5ef2fa8 ff): `WORKSPACE_DIR` resolves via
  the shared data-dir resolver → `<store>/artifact/` (PE5;
  `FOURFIVE_WORKSPACE` override; vitest injects a throwaway dir so no
  test can touch a real store); boot-time migration aid prints the
  exact one-time `mv` when the legacy repo workspace still holds a
  `codev.db` and the new home is empty (the move stays owner-manual).
  The bootstrap-doctor variant of the hint is DEFERRED to when the
  parallel lane's `tools/bootstrap.sh` WIP lands (file avoided on
  purpose); the boot warning covers the gap. fourfive 28 green,
  typecheck green. Owner `mv` still pending (legacy workspace holds the
  B–D invoice/composite test apps).
- **2026-07-08 — T4 done** (d78ac82 ff): `server/bundle/generate.ts` —
  pure blueprint→bundle transform (no LLM, no clock: `generated_at`
  DROPPED from the planned app.json shape for byte-determinism, a
  recorded refinement; the freeze timestamp lives in `app_versions`).
  Emits app.json (normalized entities incl. injected `id` pk + audit
  columns, metrics, stories, ui, blueprint_hash), schema.sql (typed
  DDL + `metric_<name>` views, PROVEN to apply on an in-memory DB at
  generation time — a broken metric is a 422 at the button),
  mcp-tools.json (PE7 names, JSON Schemas, NOT-NULL-driven required),
  ui.json, tests/scenarios.json (per-entity CRUD walks with NOT-NULL
  fk ancestors threaded via `$id` tokens + a metrics scenario).
  Entity/column names identifier-railed; `metrics`/`manifest`/`api`
  etc. reserved; metric SQL double-railed (single SELECT, no writes) —
  generator side of rail 3. **Freeze (PE11)**: `freezeAndBundle` stamps
  `frozen_at`+`bundle_hash` (schema migration added); re-freeze is
  idempotent; a mutated frozen blueprint is refused with code `drift`
  (409 at the API); `setSoftwareStack` on a frozen version now ROLLS a
  new version — the risk-5 BL-1 shape is closed. Routes: session-scoped
  `POST /api/sessions/:id/bundle` (the S-8 button) + direct
  `POST /api/apps/:slug/versions/:version/bundle`. UI: Generate-bundle
  button + frozen/drift notes in the temp-app panel. fourfive 28→43
  green (10 generator + 5 freeze), typecheck + vite build green.

- **2026-07-08 — T5 done** (bb01a31 contracts): `contracts/app-bundle.md`
  v0 Draft — the FourFive↔apps-host boundary: bundle location + "bundle
  presence IS the freeze marker" (consumers never read fourfive's DB),
  the five file shapes with the NormalizedEntity guarantee, identifier/
  reserved-name rails, the metrics contract (single-SELECT rail both
  sides, read-only execution, grounding⊆declared), PE7 tool naming +
  declared-surface-is-served-surface, the published REST API, app data
  layout (installed.jsonl append-only), scenario vocabulary, named v0
  deferrals. agent-abi §6 now cross-references it for the `apps:<slug>`
  skills gating; glossary gained bundle / generated app / metric /
  apps-host; reading-order updated. **Owner review at close (it is a
  contract).**
- **2026-07-08 — T6 done** (c679dfd + 1269b77 apps): apps-host v0.
  Server: bundle discovery by scan (highest complete bundle wins,
  malformed skipped loudly, manifest identifiers re-validated — SQL
  injection through names impossible), per-app data
  (`<store>/apps/<slug>/data.sqlite` lazy, WAL, FK ON;
  `installed.jsonl` append-only; **schema drift ⇒ read-only mount with
  the instructive reason, writes 409**), single service layer (deny-
  unknown 400, host-maintained audit columns, archive-not-delete,
  payload cap, metric views on a `query_only` read-only connection,
  broken metric = readable error never a crash), REST per contract §6,
  **MCP over Streamable HTTP at /mcp** (per-session transports; tool
  list recomputed per tools/list so a mid-session freeze is offered
  without restart; only declared tools dispatch; refusals verbatim
  with isError), scenario runner (fresh throwaway store per scenario,
  $id threading). UI shell: ONE vite build (Vue + nunc-ui tokens,
  74KB) served at `/:slug/` — manifest-driven forms (mock_ui screens
  grouped by target table; uncovered entities get column-driven
  forms), tables with archive + archived toggle, metrics panel,
  read-only banner; all fetches RELATIVE so no mount prefix is
  hardcoded; trailing-slash redirect is relative too. Fixture bundle
  hand-authored per the contract (an independent shape check).
  apps-host tests 1→12 (REST walk incl. drift 409 + fk enforcement,
  MCP live round-trip via the real SDK client against startHost,
  runner green on the fixture), typecheck (tsc + vue-tsc) green,
  `pnpm -r build` now covers the shell.

- **2026-07-08 — T7 done** (0ade52a gate, 30e1546 tool, 9b37126 apps,
  e765654 fe, + the fix commit): gate `--apps-url` + `/apps` proxy
  (prefix-stripped, streaming `forward()` reused); justfile `up` runs
  4 processes (`_up-apps`), gate gets `--apps-url`, `down.ts` learns
  :8788 — the justfile hunks landed via a plumbing blob so the
  parallel lane's uncommitted `setup` WIP stayed out of the commit
  (the Phase D precedent); apps-host gained a human-facing index at
  `/`; Formans topbar gained the Apps tab. **Bug found BY the live
  check (and now pinned by a gate test): the axum wildcard
  `/apps/{*path}` does not match an empty segment, so `/apps/` fell
  through to the formans SPA fallback and served the wrong app —
  bare `/apps` and `/apps/` now have literal routes.** Live E2E
  through the gate (fixture bundle in a scratch store): `/apps/api`
  lists, POST create returns the audited row, `/api/metrics` computes
  `deal_count: 1`, `/apps/` serves the index, `/apps/fixture-app/`
  serves the shell. gate 13 integration tests green; apps-host 12;
  Formans 20 + build.

- **2026-07-08 — T8 done** (8647160 fe, 0be96b0 ff, a6e0489 agent):
  nunc-ai gained the tool contract (`ToolSpec`/`ToolCall`,
  `ChatMessage` role `tool` + `toolCalls`/`toolCallId`,
  `ChatOptions.tools`, `ChatResult.toolCalls`,
  `RunLogEntry.toolCalls` counts — no arguments logged, same
  no-prompt-text rule) and `Ai.chatWithTools`: the bounded loop
  (default 8; past budget the remaining requests get a refusal result
  and tools are WITHDRAWN so the model must answer), ONE aggregated
  run-log entry, tools+goal-verify = config error (PE9). Provider
  mappings: `llama-cpp` (OpenAI tools + streamed tool_call delta
  reassembly by index — PE9' first-class local), `anthropic-api`
  (input_schema tools, tool_use blocks, tool_result threading),
  `mock` (scripted toolScript rounds — the S-7 zero-token rehearsal).
  Agent: `src/tools.ts` MCP client to apps-host over Streamable HTTP
  (`NS_APPS_URL`), **PE10 allowlist enforced twice** (offer-time
  filter + call-time recheck; `apps:<slug>` prefix grant can't leak
  into lookalike slugs — tested), honest degrade when apps-host is
  down, `/tools` command, tool turns render every call + refusal
  verbatim as meta lines (non-streamed in v0, recorded). Suites:
  nunc-ai 41 (6 new), agent 27 (4 new incl. a fixture Streamable-HTTP
  host + the full tool-turn with run-log assertion), fourfive
  43 + typecheck (the offline-demo responder now types against
  nunc-ai's wider message shape), pipeline typecheck green — zero
  call-site changes (the PD compatibility rule held). **Still owed
  before S-7's live leg: the llama-server GGUF tool probe (PE9'
  retarget — lands with the topics lane's T4 `_up-llama`).**

- **2026-07-10 — T9 done** (owner build + 941dea9/ae5eaf9/2bf3934 ff on
  `phase-e-finish`): `runway-tracker` was designed by the owner through
  the REAL FourFive chat flow (four iterations; the 4th froze + bundled
  → the served app is **`runway-tracker-4@v3`** — slugs -2/-3 are
  abandoned drafts, recorded honestly rather than renamed). En route the
  extractor kept dead-ending on reserved names / SQL dialect — the
  proposal-time rails earlier on this branch (6cbe0f2, aad1e39, 4ef6463)
  came from that. **Strategy card (PE12)**: `server/strategy.ts` fetches
  the served version + metric values from apps-host's published API
  ONLY, prompts the profile's model with the declared metrics and
  NOTHING else, and `parseStrategyCard` THROWS on any grounding outside
  the declaration (422, render fails — S-7's mechanical criterion; 14
  unit tests incl. the violation naming the offender). `/strategy` in
  chat renders the ephemeral, dismissable, version-stamped card;
  persistence (superposition_state + informed_by) stays the named
  Phase F prerequisite. Found live while shipping it: the card rendered
  2px tall in long chats (flex column squeeze — 2bf3934), `/strategy
  <words>` fell through to chat + no command discoverability (popup +
  prefix match — ae5eaf9), model-down = honest 502 in the card
  (ae5eaf9). Merge with dev's blueprint-hardening lane: 7430fba (both
  lanes' semantics kept; ff suite 75 green).

## Story executions

(S-7 / S-8 written at T1; executed at T10 with transcripts and
numbered verdicts.)

### S-7 executed 2026-07-11 (UTC; 2026-07-10 evening PDT) — PASS (8/8 mechanical checks)

Environment: the LIVE stack (`just up` legs on :8720/:8787/:8788 + a
manually re-armed llama-server 35B on :8080 after the leg went inert),
app **`runway-tracker-4@v3`** in the owner's store.
**Recorded deviation from the runbook setup:** executed against the
live store, NOT a scratch `NS_DATA` — the story's subject app is T9's
chat-built artifact, which lives there; rebuilding it in a scratch
store would have replaced the real T9 artifact with a re-run. Writes
were ordinary app working data (deals/income/cash rows, all
archivable) + two `s7-*` agent profiles; no ledger/vault surface was
touched. Owner may archive the S7 rows at will.

1. **Human leg — generated UI form**: PASS. `S7 human deal` (Beta LLC,
   discussion, 800) + cash snapshots + a dated income entry created
   through the manifest-driven forms at `/apps/runway-tracker-4/`;
   rows confirmed in `<store>/apps/runway-tracker-4/data.sqlite` and
   via the published API. **Defect found BY this leg, fixed+committed
   (01251e6 apps):** Vue auto-casts `type=number` inputs, so a numeric
   UI field mapped to a TEXT column posted a JS number the host rightly
   400'd — the form could never create the row. Shell now serializes to
   the DECLARED column type.
2. **Agent /tools surface**: PASS. Profile `s7-granted` (llama-cpp /
   Qwen3.6-35B, `skills:["apps:runway-tracker-4"]`) lists EXACTLY the
   15 declared tools (5 verbs × 3 entities), nothing else.
3. **Agent reads the human's row**: PASS. `runway-tracker-4_deals_list`
   fired; the reply enumerated `S7 human deal | Beta LLC | discussion`.
4. **Agent writes; run-log carries toolCalls**: PASS.
   `runway-tracker-4_deals_create` fired with the exact arguments;
   `ai-runs.jsonl` rows `2026-07-11T01:00:33/35Z` carry
   `toolCalls:[{name:runway-tracker-4_deals_list,count:1}]` and
   `[...deals_create,count:1}]` under profile `s7-granted`.
   (The PE9' llama tool-probe debt is settled by this live leg.)
5. **Mutual visibility**: PASS. Generated UI reload shows the agent's
   `S7 agent deal | Gamma KK` beside the human's row.
6. **Metrics from both writes**: PASS. `GET /apps/runway-tracker-4/api/
   metrics` returns exactly the four declared names, nothing
   undeclared; `deals_in_discussion` reflects both rows (3). Final
   values: 2500 / 3 / 2.4 / 1. App-authoring observation (not a
   platform gate, S-11 rule): the app's own metric SQL is
   format-sensitive — `strftime('%Y-%m', month)` returns NULL for a
   bare `2026-07` string, so script-seeded rows without full dates
   don't count; UI date fields produce full dates and compute fine.
7. **Refusal — allowlisted, not ambient**: PASS. Profile `s7-refused`
   (`skills:["apps:invoice-app"]` — a second app, not served): startup
   + `/tools` report "connected to apps-host, but this profile grants
   no served tool"; asked to add a deal, the model answers "I lack the
   tool to add a new deal to the runway tracker." — surfaced verbatim,
   no silent retry, and the deals table is unchanged (no `S7 refused
   deal`).
8. **Strategy read-out grounded only in declared metrics**: PASS.
   `/strategy` → HTTP 200 card `{win, constraint, risk_to_watch}`,
   version reference `runway-tracker-4@v3`,
   `grounding = [deals_in_discussion, cash_runway,
   monthly_external_income, income_concentration]` ⊆ (here =) the
   declared set. The subset check is code (`parseStrategyCard` throws,
   422, render fails), unit-tested incl. the undeclared-name case;
   live 2px-collapse and model-down failure modes were found and fixed
   during this leg (2bf3934, ae5eaf9).

Screenshots for both UI directions ride the T11 screenshot pass
(`design/ui/phase-e/`). Terminal transcripts, metrics JSON, and the
run-log rows are reproduced above verbatim from the session.

### S-8 executed 2026-07-11 (UTC) — PASS (clean run after a bug-find run)

**Run 1 (bug find, plant-care-log):** designed in ONE 40s chat turn
(35B live), frozen+bundled 65s after session start, discovered by scan
and served WITHOUT any restart — but the generated UI could not create
a single row: the chat blueprint declared `id INTEGER PRIMARY KEY` and
the host forced UUID strings into it (datatype mismatch on every
insert, surfaced verbatim in the shell banner). **Fixed + regression-
tested (c6565c8 apps):** INTEGER pks now take SQLite's rowid; TEXT pks
keep UUIDs. plant-care-log@v1 stays frozen as the bug-find artifact;
its freeze checks passed live (re-generate = 200 same hash
`bcde7361…`; tampered blueprint = 409 F7 verbatim; restored = 200).

**Run 2 (clean, home-library-lending-log):** after the stack restart
that loaded the fix, the full story in one sitting, stack untouched
throughout — wall clock **01:33:15Z → 01:36:46Z (3m31s)**:

- One FourFive session, one design turn (18s from session create to
  frozen+bundled+served): entities `books`/`loans`, declared metrics
  `books_count`/`loans_total`, 2 screens; `blueprintStatus: ok` (the
  hardening lane's classified outcome, live).
- `POST /sessions/:id/bundle` → `home-library-lending-log@v1`, hash
  `b25b1027…`, all five files on disk; in the served list by scan,
  no restart.
- Generated UI: "Snow Country" created via the form (INTEGER-pk fix
  live), row in
  `<store>/apps/home-library-lending-log/data.sqlite`; loan archived
  via the UI button — leaves the default list, `?archived=1` shows it
  with `archived_at` stamped.
- Edit + the loan create ran via the published REST surface (PATCH
  books/1 author change 200 + updated_at bump; POST loans 201):
  **recorded shell gaps** — the generated UI has no row-edit
  affordance and FK selects are not populated from rows; both fold
  into the app-operation-delegation lane
  (design/development/2026-07-10-app-operation-delegation.md), where
  the human UI demotes to inspection anyway.
- Metrics answer with values: `books_count 1`, `loans_total 1`,
  nothing undeclared.
- Freeze held while in use: re-generate = 200 with the identical
  hash; tampered `blueprint.json` = **409 "frozen but app.json does
  not reproduce byte-for-byte — the frozen source or bundle was
  modified (F7)"**; byte-restored = 200.

**Recorded deviations:** live store, not scratch (S-7's rationale
stands); the model leg was re-armed manually BEFORE the session
started (the leg had gone inert at `just up` — root-caused to the
previous server's VRAM still releasing when the new leg starts;
backoff fix a949ca2 tool — takes effect next `just up`); no stack
process was touched between design and use, which is the criterion.

**PE14 generality:** beyond runway-tracker-4, THREE further apps went
chat→freeze→bundle→served on this stack: plant-care-log (this story),
home-library-lending-log (this story), and the owner's own
発言記録アプリ (`app-1af0ddc5@v2`, bundled by the owner independently —
the strongest generality signal: the factory worked without the
implementer driving).

- **2026-07-11 — T11 (in progress → completed below)**: full local
  suite green post-merge (`just test`: ns 11 + gate 13/21, ai 42,
  agent 27, nunc-ui 9, formans 40, fourfive 75, apps-host 13, pipeline
  214). **3-OS CI GREEN on 9f958e9**: all 10 jobs succeeded —
  engine/web/nunc-fluens on ubuntu+windows+macos, plus invariants
  (the branch was mirrored to `phase/e-finish` to hit the push-CI
  matcher; PR #9 re-open is an owner click). Screenshots + the S-7
  agent transcript committed under `design/ui/phase-e/` (bfb6c4b):
  apps index, both generated UIs, FourFive design view, the /strategy
  card live on the S-8 app.
- **2026-07-11 — T12 doc sweep**: v1 plan §2.8 got the close-time
  supersede note (declarative bundle / underscore tool names /
  entity-derived scenarios — PE3/PE7/spec-§4) and §2.9's artifact/
  move marked done (PE5); naming.md gained the `apps` area row;
  reading-order's repo map moved apps-host from planned to landed.

- **2026-07-11 — S-10 re-run PASS (T11 complete)**: pristine
  `ubuntu:24.04` container, documented prerequisites only (git,
  Node 24 tarball + corepack, rustup, just prebuilt) → `git clone /src`
  (repo mounted ro; `safe.directory` needed as in phase C) →
  `sh tools/bootstrap.sh /root/my-data` (doctor all-ok; store
  remembered in config; self vault no-remote F11 line verified) →
  `just up` → through :8720: `/health`, `/fourfive/api/health`,
  **`/apps/` ("Generated apps" index) and `/apps/api`** (the Phase E
  extension), and the home title all answered — `S-10-PASS`, exit 0.
  The llama leg degraded honestly ("no GGUF in the store") — the
  pristine home screen needs no model. Two harness-side retries were
  needed (safe.directory on the ro mount; per-leg boot timing needed
  retrying checks), no product-side fixes.

## Constitutional check record (filled at T10–T12, 2026-07-11)

- **F7 (a cut version is immutable) — live refusal output**, twice, on
  two different apps: "<slug> v1 is frozen but app.json does not
  reproduce byte-for-byte — the frozen source or bundle was modified
  (F7)" (HTTP 409; plant-care-log and home-library-lending-log, S-8
  records above). Determinism: freeze.test.ts byte-identity suite +
  the manual double-runs — re-generating each frozen version returned
  200 with the identical bundle_hash (`bcde7361…`, `b25b1027…`).
- **Grounding⊆declared ("metrics the app does not measure are not
  grounds") — enforced in code**: parseStrategyCard throws on any
  undeclared grounding entry (render fails, 422; unit test names the
  offender, strategy.test.ts). Live: the S-7 card's grounding equalled
  the declared set exactly; the metrics-only prompt carries nothing
  else (buildStrategyMessages test).
- **F3 rails untouched**: the agent suite (27) is green; app CRUD rides
  profile-skills gating (PE10), memory still goes exclusively through
  manda; no commitment-scope surface was touched this phase.
- **F11 locality**: everything serves loopback behind the gate; app
  data lives in `<store>/apps/<slug>/data.sqlite`; no remote, no
  telemetry; bundles carry no user data.
- **§13 one-path**: fourfive↔apps-host touch ONLY through the bundle
  contract (filesystem, discovery-by-scan) and the published API (the
  /strategy fetch — §13-A-legal); FD-7.4 import check green
  (`apps-host/` may import contracts/ + frontend/packages/* only).

## Determinism record

- generate.test.ts: bundle bytes are a pure function of blueprint.json
  (no clock, no LLM); bundleHash pinned.
- Manual double-runs at T10: two POSTs against each frozen version
  reproduced identical hashes (see S-8); a tampered source refused
  rather than regenerated — determinism enforced, not assumed.

## Exit criteria checklist

1. [x] runway-tracker frozen + bundled + human CRUD via generated UI,
       data in the store [T4, T6, T9 — served as `runway-tracker-4@v3`,
       chat-built; S-7 leg 1]
2. [x] agent operates the same app via MCP under a profile grant;
       mutual visibility; non-granted tool refused [T8, T10 — S-7 legs
       2–5, 7]
3. [x] declared metrics served; strategy card quotes only declared
       metrics with version reference [T6, T9 — S-7 legs 6, 8]
4. [x] second, unrelated app end-to-end in one sitting [T10 — S-8:
       home-library-lending-log 3m31s; plus plant-care-log and the
       owner's 発言記録アプリ]
5. [x] S-7 / S-8 written, executed, passing with evidence [T1, T10 —
       records above; 3 execution-found defects fixed with tests]
6. [x] contracts/app-bundle.md drafted [T5]; **owner decision at close
       (2026-07-11, verbatim: 「契約はオープンのままでいい」): the
       app-bundle + agent-abi reviews stay OPEN past the phase close —
       a standing owner item, deliberately deferred, not waived
       silently.** The contracts remain v0 Draft until reviewed.
7. [x] deterministic + freezing generation proven; no generated code
       executed [T4, T6 — plus two live tamper→409-F7 proofs at T10]
8. [x] S-10 re-run (incl. /apps/), 3-OS CI green, screenshots under
       design/ui/phase-e/ [T11 — S-10-PASS ubuntu:24.04; CI 10/10 jobs
       on 9f958e9; 5 PNGs + agent transcript committed]
9. [x] verification doc complete; v1 plan/naming/reading-order updated;
       merged to dev on the owner's close instruction (2026-07-11
       「クローズして」— the 2026-07-09 direct-merge precedent); close
       commit is this one [T12]

**Phase E CLOSED 2026-07-11.** Standing post-close owner items:
contracts/app-bundle.md + agent-abi.md review (deferred above); the
Phase D open gates unchanged. Next lanes: Topics T7; the
app-operation-delegation lane
(design/development/2026-07-10-app-operation-delegation.md).
