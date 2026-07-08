# Phase D Implementation Plan — Profiles + goal-loop surfaces + nunc-stans-agent v0

**Status: APPROVED — decisions PD1–PD15 ratified and plan approved by the
owner in session, 2026-07-07 (the §7 two-step). PD1 resolved the same day:
the owner runs the merge train first (`newstack`→`dev`, `phase/post-c`→`dev`,
push); `phase/d` branches off `dev` — the fallback branch point is not used.**

**Goal:** every AI-calling context (FourFive chat, News pipeline steps, the new
agent) selects its runtime/provider/model **through a profile** the user
creates and switches in Nunc Stans Formans. The goal-verify loop (§2.6) becomes real:
a judge/retry middleware inside `frontend/packages/ai` with a per-message
toggle in chat and per-step config in pipelines, hard-capped and fully logged.
A run-log viewer lands in Formans. `contracts/agent-abi.md` moves from
Reserved to a drafted v0 (intake-only per constitution §13-D). And
`agents/nunc-stans-agent/` ships v0: a TypeScript terminal chat with streaming
and visible thinking, Ollama first-class, whose memory goes **exclusively
through the manda MCP gateway** with mandate-gated writes — the first real
consumer of manda. In passing, FourFive's Claude streaming stub and stale
default model id are fixed. Exit: profiles created/switched from the UI; a
verify-on message visibly loops (≤ max_iters), reports unmet gaps, shows cost;
a local model via Ollama works under a profile; `nunc-stans-agent chat` works
in a terminal with mandate-gated memory ops through manda; stories S-5, S-6,
S-11 pass; S-10 re-run (incl. the manda doctor check); 3-OS CI green.

**Architecture:** profiles are JSON files in `<data store>/profiles/`
(post-R13 default: repo-local `data/`, gitignored — a directory
`tools/bootstrap.sh` has scaffolded in every store since Phase A), served by
a new gate API that copies the `gate/src/news_config.rs` pattern (validate +
atomic tmp+rename, deny-unknown-fields, loopback-guarded). `nunc-ai`
(`frontend/packages/ai`) grows three contract extensions: a streaming method
with thinking deltas, a `profile` stamp (+ verdict chain) in `RunLogEntry`,
and a per-call `verify` override — then the judge/retry loop itself as
middleware inside `createAi`. FourFive's parallel provider layer
(`engines/fourfive/server/llm/*`) is retired in favor of nunc-ai + a profile
lookup, which is also where the streaming stub and the stale model id die
(the blueprint prompt builder in that directory is **kept** — it is product
logic, not provider glue). The News pipeline keeps its per-run config file
contract (`engines/nunc-fluens/pipeline/src/cli.ts:162-183` precedence:
instance `store/news-config.json` > main store > defaults) — Phase D adds
**AI-profile reference/per-step keys** to the news-config surface, riding
that **stable surface only**. (Careful with the word: the post-C R3 /
`cli.ts:165-166` recorded "per-profile gate API" follow-up uses "profile"
in nunc-fluens's old sense — a data *instance* — and means gate-side
editing of an instance's config file; that follow-up is explicitly
**deferred**, see PD14 and Non-goals, not delivered under a new label.)
nunc-fluens instance-lifecycle internals (in flight in the post-C V3
session) are not touched. The agent talks to manda over stdio MCP (`~/manda`,
Apache-2.0; seven tools in `manda/src/gateway.rs` covering the
append/candidate/committed memory lanes, edges, and mandate listing);
mandates are granted out-of-band by the owner in `mandates.jsonl` per
`manda/spec/mandate.md` (expiry required).

**Tech stack:** TypeScript on node 24 (tsx for the agent CLI — plain `node`
cannot type-strip TS under `node_modules`, the pipeline's relative-import
lesson at `cli.ts:205`); `@modelcontextprotocol/sdk` stdio client; vitest;
Rust (gate: profile + run-log endpoints); manda 0.2.0 as an **external
runtime dependency, never vendored** (v1 plan §2.11 / §5 note 13); Ollama
`qwen3.6:27b` (proven in Phase C exit run (b), 40 calls —
`design/verification/phase-c.md:145`).

**Plan doc convention:** plans live in `design/development/`. Proposed
working branch **`phase/d`** off `dev` **after the owner's merge train
clears** (`newstack` → `dev`, then `phase/post-c` PR — both pending owner);
owner pushes for CI; merge back to `dev` at phase close. If the merge train
is delayed, T0 offers the fallback of branching off the `phase/post-c` tip
with a recorded rebase point (owner picks — PD1).

**Decision-ID note:** phases letter their decisions (B1–B4, C1–C8), but the
v1 plan already owns `D1–D10` as global decisions and the post-C plan uses
`D1–D5` for the deletion proposal. This plan uses **PD1…** to stay
collision-free.

---

## Design decisions (proposed — owner ratification required before code, per §7)

| # | Decision | Choice |
|---|---|---|
| PD1 | Branch point | `phase/d` off `dev` after `newstack`→`dev` and `phase/post-c` merge (owner gate). Fallback if the train stalls: branch off the `phase/post-c` close-out commit and rebase onto `dev` when it lands — recorded as an explicit sync step in T0. Alternative: start on stale `dev` now (rejected: R13/V3 moved the data-store default and instance layout under us; planning against V2 shapes guarantees rework). **RESOLVED 2026-07-07: owner picked the merge train; fallback not used.** |
| PD2 | Profile storage | JSON files `<data store>/profiles/<id>.json` (post-R13 default `<repo>/data/`, gitignored; `NS_DATA` override respected via `tools/lib/data-dir.ts`; `tools/bootstrap.sh` has created the empty `profiles/` dir in every bootstrapped store since Phase A — the location is already the bootstrap contract's). **No git versioning** — the v1 plan §2.7 claim "versioned by the vault's own git" no longer holds (only `self/` is a git vault; `data/` is gitignored), and the owner's V3 direction (git-less product surfaces) points the same way; recorded as a superseding note in the v1 plan at close. **No secrets in profile files** (BYOL, §2.10/D9): profiles name providers/models; keys stay in env — and the validator **rejects credential-shaped fields** (`*key*`, `*token*`, `*secret*`) so the rule is code, not prose. Served via a gate API copying `gate/src/news_config.rs` (validate, atomic write, deny-unknown-fields). |
| PD3 | Default-per-context pointer | `<data store>/profiles/defaults.json` — `{ "fourfive-chat": <id>, "news-steps": <id>, "agents": <id> }`, written by the same gate API. Alternative: `<config-home>/nunc-stans/config.json` (rejected: that file is machine config; profile defaults are data-store state that should travel with the store). |
| PD4 | Profiles vs nunc-fluens instances | **Distinct concepts.** A profile answers "which runtime/model/prompt/verify defaults"; an instance (`engines/nunc-fluens/instances/<name>/`) is a data world selected by `NS_INSTANCE`. The News wiring applies a profile's model/runtime/verify defaults to steps; it never selects or manages instances. The word collision is resolved at close in `design/naming.md` **and** in the two places that still say "profile" for an instance: `instance.ts:4-6` ("one … directory per profile") and `CONTRIBUTING.md:19-20` (`instances/<profile>/` → `instances/<name>/`). |
| PD5 | Goal-verify loop location | Inside `createAi` (`frontend/packages/ai/src/index.ts`) as chat middleware, per §2.6: judge verdict `{met, gaps[]}` per iteration, gaps fed back, retry within `maxIters` (default 2) and `tokenBudget`; every verdict + retry logged with token counts. Per-call override lands as `ChatOptions.verify`; defaults come from the active profile. Judge provider/model come from `VerifyConfig.judge`, defaulting to the calling profile's provider; a **scripted mock judge** makes S-6 deterministic with zero live tokens. **Verify-on composes with streaming**: each iteration streams its content, and the middleware emits a verify boundary event (`{iteration, verdict, tokens}`) between iterations — the chat UI renders those as the visible loop (S-6); providers without `chatStream` emit one delta per iteration. Alternative: call-site loops in fourfive + pipeline (rejected: two implementations of a cost machine; §2.6 says middleware). |
| PD6 | Streaming API shape | Extend `Provider` with optional `chatStream(messages, opts, onEvent)` emitting `{type: 'thinking'|'content'|'done', …}` deltas, capability-gated by the existing `stream`/`thinking` flags (`types.ts:41-55`). Implemented for `ollama` and `anthropic-api`; `mock` emits scripted deltas for tests; `claude-code` stays `stream:false` in v0 (callers fall back to one final delta — exactly FourFive's current stub behavior, now honest and capability-declared instead of hidden; spawn-based `--output-format stream-json` is a recorded follow-up, forced by no D story). Alternative: a separate runtime-tier interface (rejected for v0: one method + capability flags covers S-11; the tier split can come with Phase E if needed). |
| PD7 | FourFive wiring | **Migrate** `engines/fourfive/server/llm/*` onto nunc-ai: `getProvider()`/`CODEV_LLM_PROVIDER`/boot singleton (`provider.ts:47-66`, `index.ts:25`) replaced by a per-message profile resolution (default from `defaults.json`, overridable per session). Deletion is **precise**: `{provider,claude,ollama,mock}.ts` go; `blueprint-prompt.ts` + its test stay (prompt construction is FourFive product logic) and `proposeBlueprint` is reimplemented as a nunc-ai structured call. The Claude streaming stub (`claude.ts:71-80`) and stale `claude-sonnet-4-6` default (`claude.ts:17`, `.env.example:16`) die with the deleted files (`docs/guides/local-llm.md` needs a rewrite too, but for the `CODEV_LLM_PROVIDER`→profile wiring, not a model id) — one Anthropic implementation remains, in nunc-ai; its default model id is verified against the `claude-api` skill at implementation time, one source of truth. Alternative: bridge profile→env var and patch the stub in place (rejected: leaves two half-implementations of providers and of run logging — fourfive's sqlite `llm_runs` vs `ai-runs.jsonl`; fourfive keeps `llm_runs` rows for its UI but the canonical audit row is the nunc-ai run log). |
| PD8 | manda consumption path | **All Phase D development and story execution run against the local `~/manda` checkout** (release build — today only a debug build exists at `~/manda/target/debug/manda`, so T0 makes `cargo build --release` an explicit step and records the built commit hash; the agent resolves the binary via `MANDA_BIN` env, falling back to `manda` on PATH). Verified 2026-07-07: `github.com/baba-yu/manda` **is pushed** (ls-remote: `main` == `d0b61e2`) but **no `v0.2.0` tag exists** — the owner prerequisite is exactly `git tag v0.2.0 && git push origin v0.2.0` (Cargo.toml already says 0.2.0, Cargo.lock committed, so `cargo install --locked --git https://github.com/baba-yu/manda --tag v0.2.0` works the moment the tag lands). Until then: the setup line ships in docs marked "pending tag", the bootstrap doctor `manda` check **warns** if missing rather than failing, and the S-10 extension asserts the doctor check's presence, flipping to hard-pass when the owner tags. Nothing in Phase D blocks on the tag. |
| PD9 | manda data dir | `MANDA_DATA_DIR = <data store>/agent/manda/` — one writer per dir (manda has no cross-process locking, `manda/README.md:84-87`), and the agent is that dir's only writer. Stories use scratch dirs. The first mandate is granted by the **owner** appending to `mandates.jsonl` per `manda/spec/mandate.md` (expiry required); the agent's `mandate-template` subcommand **prints** a filled example line for the owner to append — it never writes it (A1: mandates only out-of-band, principal-only). |
| PD10 | Elicitation vs attest | The agent's MCP client implements the **elicitation** capability (terminal approve/decline prompt) so `memory_commit` yields `origin_verified: true`; `MANDA_APPROVAL=attest` is documented for non-interactive test paths only. Whether the TS `@modelcontextprotocol/sdk` ↔ manda (rmcp 2.1, elicitation feature flag) handshake actually interoperates is **probed at T1, before anything is built on it** (risk 8); the fallback is attest-mode for v0 with the elicitation handler as a recorded fast-follow. S-11's commit step exercises the interactive approval (or the recorded fallback). |
| PD11 | agent-abi v0 scope | Intake-only, per constitution §13-D (constitution.md:277-287): decide the **registration form** (commitment — user-written per F3 — + mandate declaring scope/read/write/external side effects with mandatory expiry + frozen version reference), the **capability-declaration vocabulary** (the §2.6 set `{chat, stream, tools, structured, web_search, thinking, memory}`), and the **execution-record form and location** (`ai-runs.jsonl` entry shape with `caller` = agent id, plus manda's audit lane). Startup/suspension check in v0 = `mandate_list` through manda — recorded as an **interim substitute**: the constitution places the check's source of truth in nunc-stans-engine (constitution.md:245, F14), and the registration's mandate reference resolves to a **manda mandate** (memory-write authority in `MANDA_DATA_DIR`), not a self-scope `self/mandate/*` record, until the engine mandate lane (`engines/nunc-stans/docs/spl-plan.md` DDL) lands in SPL v3 — deferred and referenced, not built. The draft **names both enforcement gaps**: no caller auth on the self engine (engine README:48-53), so F3 is enforced in agent/profile code, not server-side; and the engine-side mandate source of truth (constitution.md:245) not yet existing. Drafted at T8 — after the T1 manda spike proves the semantics and T4 freezes the profile shape — honoring §13-D's "write contracts late". Agent internals, skill format, runtime design stay out (FourFive's jurisdiction, §13-A). |
| PD12 | Hermes/Honcho comparison runtime | **Out of Phase D.** The v1 plan marks it optional (line 613); nothing in the exit line needs it, and the license-verification-before-integration gate (v1 plan lines 318-324) plus an external-process boundary is real work with no story attached. Recorded as a Phase E+ option; if ever picked up, the license record lands in `design/verification/phase-d.md` (or the then-current phase's record) **before** integration. The stale `honcho-sim-*` containers on this machine (phase-a.md:123-126) are unrelated leftovers, listed for the owner's disposal. |
| PD13 | Run-log aggregation | `RunLogEntry` gains `profile?: string` and `verdicts?: {met, gaps, tokensIn, tokensOut}[]` (S-5 stamp + §2.6 verdict chain). The gate gains `GET /api/runs?source=main|instance&instance=<name>&limit=N` — `source=main` reads the **main store** `<data store>/runs/ai-runs.jsonl` (via existing `GateCfg.data_dir`, `gate/src/lib.rs:30`), `source=instance` reads `<instances-dir>/<name>/store/runs/ai-runs.jsonl` — plus `GET /api/runs/instances` (enumeration). The instances dir arrives as an explicit **`--instances-dir` flag** (the justfile passes `engines/nunc-fluens/instances`) — the gate never re-derives nf's path resolution in Rust and never hardcodes engine layout. Read-only, enumerating, never writing. The viewer shows both sources with a source column. **S-5 asserts the main-store log** (FourFive chat and the agent both write there); pipeline runs stay per-instance per R3. |
| PD14 | Per-profile News step config | Scope for D: the gate news-config API gains an optional `profile` reference and per-step override keys; because `NewsConfig` is deny-unknown-fields (`news_config.rs:21-42`; skew rule in `design/verification/post-c.md:125-127`), **gate binary + Formans drawer + pipeline reader ship as three adjacent commits (`gate:`/`fe:`/`nf:`) on the branch and deploy together** — the recorded rule requires deploying together; one-commit-one-area (`tools/commit-scope.ts`) forbids a single tri-area commit. The pipeline consumes the resolved values through its existing config-file precedence — no instance-lifecycle internals change, honoring the V3 no-touch rule (threading per-step verify into the pipeline's LLM helpers is a contained orchestrator-side change, listed in the file map). Instance-targeted config editing from the UI (gate writing into an instance's `store/news-config.json`) is **deferred** — and named honestly: that is the post-C R3 / `cli.ts:165-166` recorded "per-profile gate API" follow-up (where "profile" meant a data instance), which stays open; Phase D's AI-profile keys are a different feature and do not close it. v0 resolves profile defaults at the main-store level, and the hand-placed instance override file keeps winning as today (`cli.ts:164-166`); T6 updates the cli.ts comment so the recorded follow-up is not silently re-labeled. |
| PD15 | New commit area + workspace | Register area **`agent`** for `agents/**`: `tools/commit-scope.ts` regex + `CONTRIBUTING.md` areas line + a `design:` commit (the Phase B `gate` precedent). Add `agents/*` to `pnpm-workspace.yaml`; add explicit agent typecheck/test steps to `.github/workflows/ci.yml` (steps are enumerated, not globbed — forgetting this means silently untested on 3 OSes). |

Derived decisions:

- **F3 in code, twice:** (1) the profile schema validator (gate + shared TS
  validator) **rejects** any `memory_scope.write` entry matching
  `self/commitment/*` — a profile that grants it cannot be saved; (2) the
  agent refuses commitment-writing tool paths regardless of profile content.
  This is defense in depth for §5 note 7; the server-side gap is named in
  agent-abi v0 (PD11).
- **F11:** profiles, run logs, and `MANDA_DATA_DIR` all live under the local
  data store; nothing new gains a remote. The agent has no telemetry.
- **Mock-degradation rule (§2.10):** every Phase D feature works with the
  `mock` provider and zero credentials — profiles can name `mock`, the verify
  loop runs with a mock judge, the agent chats against `mock` +
  `MANDA_APPROVAL=attest` in CI. Agent memory tests run against a
  **fake-manda stdio stub** (a small JSON-RPC fixture server modeled on
  `manda/scripts/smoke.sh` flows) so refusal/lapse paths execute on all
  3 OSes with no manda binary; the live-binary integration suite self-skips
  when `MANDA_BIN` and a local binary are both absent.
- **Verify-loop cost brakes (§5 note 6):** `maxIters` hard cap (default 2),
  `tokenBudget` abort, verdicts + retries logged with token counts,
  per-profile defaults, chat default **off**. Loop output never faces the
  self scope in Phase D (no intervention surfaces built), so journey checks
  9-10 are noted, not exercised.
- **Model-id hygiene:** default model ids are validated against the
  `claude-api` skill at implementation time (both the nunc-ai anthropic
  default and the id replacing fourfive's stale one), and exist in exactly
  one place afterward.
- **Timeline reserved lanes** (S-9.md:5-6, "Phase D+"): explicitly **not
  populated** in Phase D — no story requires it; manda's audit lane is the
  substrate a later phase surfaces. Declared here to prevent silent scope
  creep either direction.

---

## Component specs

### `frontend/packages/ai` extensions (fe)

- `types.ts`: `Provider.chatStream?(messages, opts, onEvent)`;
  `ChatOptions.verify?: VerifyConfig` (per-call override);
  `ChatOptions.profile?: string` (stamp-through);
  `RunLogEntry.profile?`, `RunLogEntry.verdicts?`.
- `verify.ts` → the loop: `runVerified(chat, judge, cfg)` — call, judge
  (`{met, gaps[]}` structured), on unmet append gaps as feedback and retry
  while `iters < maxIters` and budget holds; return
  `{result, verdicts[], totalTokens}`. Wired inside `createAi.chat` so every
  caller (fourfive, pipeline, agent) gets it for free.
- `providers/ollama.ts`, `providers/anthropic.ts`: implement `chatStream`
  (NDJSON / SSE respectively) with thinking deltas where the model emits
  them; `mock.ts`: scripted deltas + scripted judge verdicts;
  `runtimes/claude-code.ts`: untouched (`stream:false` — spawn-based
  streaming is a recorded later extension).
- Compatibility rule: the pipeline's suite and nunc-ai's 12 tests stay green
  with **zero call-site changes** — all new fields optional, defaults
  preserve Phase C behavior.

### Profile store + gate API + Profiles screen (gate, fe)

- Profile JSON (v1 plan §2.7): `{id, name, provider, model, system_prompt,
  skills: string[], memory_scope: {read: string[], write: string[]},
  goal_verify: VerifyConfig-shaped defaults, ui: {…}}`. Validator enforces
  the F3 rejection rule, scope-id syntax (`contracts/scope-id.md`), and the
  no-credential-fields rule (PD2).
- Gate: `GET /api/profiles`, `GET|PUT|DELETE /api/profiles/{id}`,
  `GET|PUT /api/profiles/defaults` — new module `gate/src/profiles.rs`
  beside `news_config.rs`, same atomic-write + deny-unknown discipline,
  routes added at `gate/src/lib.rs:66-78`, reusing `GateCfg.data_dir`.
- Formans: new route `/profiles` (`src/router.ts` currently has only
  `/`, `/world`, `/timeline`), view with create/edit/duplicate/delete +
  default-per-context pickers, built from nunc-ui primitives. Screenshots
  to `design/ui/phase-d/`.

### Run-log viewer (gate, fe)

- Gate: `GET /api/runs?source=main|instance&instance=<name>&limit=N` —
  tail-read of the JSONL(s) per PD13, plus `GET /api/runs/instances`
  (list instance names that have a `store/runs/ai-runs.jsonl`). The
  instances root comes from the `--instances-dir` flag (justfile), never
  hardcoded (PD13).
- Formans: route `/runs`, table (ts, caller, profile, provider, model,
  tokens, duration, verify outcome, verdict count), source switcher,
  expandable verdict chain. Respects the ip-server-readiness smell
  (`design/architecture/ip-server-readiness.md:104-118`): the log holds no
  full prompt text, so neither does the viewer.

### `agents/nunc-stans-agent/` (agent — new area PD15)

```
agents/nunc-stans-agent/
  package.json         name nunc-stans-agent, bin via tsx; type module
  src/
    cli.ts             chat [--profile <id>] ; doctor ; mandate-template
    chat.ts            REPL loop: streaming render, thinking pane, /commands
    profile.ts         load <data store>/profiles/, defaults.json fallback
    memory.ts          manda MCP stdio client (memory lanes, edges,
                       mandate_list), elicitation handler, F3 refusal guard
    runlog.ts          appendRunLog(<data store>/runs/ai-runs.jsonl, …)
                       via nunc-ai
  test/                vitest: mock-provider chat, scripted verify loop,
                       fake-manda stdio stub (refusal/lapse/decline paths,
                       3-OS-safe), live-manda integration suite (self-skips
                       when MANDA_BIN and the local binary are both absent)
```

- Model calls exclusively through nunc-ai (`chatStream` when the provider
  has it, fallback otherwise); Ollama first-class; profile-driven; verify
  loop applies per the profile's `goal_verify` defaults.
- Memory **exclusively** through manda: `memory_read` (committed lane only,
  surfaced ≤ 3 by contract — the agent refines scope/query rather than
  bulk-reading), `memory_propose` for writes, `memory_commit` only on
  explicit user approval (elicitation, PD10), `mandate_list` at startup (the
  agent-abi startup check). An out-of-mandate `memory_commit` is refused
  with the denial surfaced (proposals always land in the candidate lane,
  which carries no authority — the refusal point is commit, by manda
  design) — S-11's refusal case.
- `mandate-template` prints a filled `mandates.jsonl` line (scope, expiry,
  version reference) for the owner to append by hand — never writes (PD9).
- Not in v0: autonomous coding loops, MCP tools beyond manda (the general
  MCP tool client proves out in Phase E with generated-app CRUD, S-7).

### `contracts/agent-abi.md` v0 (contracts)

Replaces the 21-line Reserved stub, keeping its reserved-scope list as the
section skeleton (identity, fixed version reference, mandate reference,
startup check, suspension/revocation check, run log, output reference),
content per PD11. Cross-references `contracts/scope-id.md` (`self/mandate/`
— self owns "mandate", scope-id.md:12), `manda/spec/mandate.md` for the
grant format, and the constitution's registration form (constitution.md:243).

---

## Execution notes

- Execute inside WSL (pnpm, cargo, Ollama, the manda binary all live there);
  repo convention per §5 note 12.
- **Data safety:** stories and dev runs use scratch data stores
  (`NS_DATA=<tmp>`) and scratch `MANDA_DATA_DIR`s; the owner's live store
  (`~/nunc-stans/data` post-R13) and live manda dir are never written by
  tests. The production `~/news` rule from the Phase C redirection stands:
  zero contact.
- **V3 no-touch rule:** Phase D reads nunc-fluens only through stable
  surfaces — the config-file precedence contract, `store/runs/ai-runs.jsonl`
  paths, and the gate API. No edits inside `pipeline/src/instance.ts` or the
  init/import lifecycle. T0 records the V3 close-out commit as the baseline;
  the verification doc proves the rule mechanically at close:
  `git log phase/d --not <base> -- engines/nunc-fluens/pipeline/src/instance.ts`
  (and the import/init modules) is **empty**.
- **Adjacent-commits rule:** where the deny-unknown skew rule demands the
  gate, drawer, and pipeline reader deploy together (PD14), they land as
  adjacent per-area commits on the branch — one commit = one area
  (`tools/commit-scope.ts`) is never violated.
- Commit areas this phase: `fe` (packages/ai, Formans), `gate`, `ff`
  (fourfive), `nf` (pipeline config-consumption only), `contracts`, `tool`
  (workspace/CI/doctor/check.ts), `agent` (new, registered at T1),
  `design`. One commit = one area; `node tools/commit-scope.ts` +
  `node tools/check.ts` after each commit.
- `tools/check.ts` FD-7.4 (engine-internals grep) currently scans only
  `frontend/` (check.ts:25) — extended at T1 to cover `agents/` so the
  agent may reference `contracts/` but never engine internals.
- Rollback: each task is independently revertable; the profile store is
  additive (no existing file formats change); fourfive's `llm_runs` table
  is kept, so reverting T5 restores the old layer from git without data
  loss; nunc-ai extensions are optional-field additive.

## Risks

1. **manda tag missing (external prerequisite):** push is done, tag is not
   (verified 2026-07-07). Mitigated by PD8: everything runs against the
   local checkout via `MANDA_BIN`; only the `cargo install` doc line, the
   doctor hard-pass, and the S-10 extension gate on the tag — all flipped
   by a one-line owner action, called out below. The verification doc
   records the exact manda commit hash built against, hedging drift if the
   owner adds commits before tagging.
2. **Concurrent post-C V3 session:** nunc-fluens internals are being
   rewritten on `phase/post-c` right now; file/line facts in this plan may
   drift, and the post-C suite counts will change before the merge train
   clears. Mitigated by PD1 (branch after the merge train), the T0
   re-measure step (baselines re-measured, never copied), and the
   stable-surfaces rule with its mechanical close-out proof.
3. **nunc-ai contract changes ripple:** the pipeline suite and its replay
   `forbid` provider consume the interface. Mitigated: all extensions
   optional-field/optional-method; T2's acceptance signal is the full
   existing suite green untouched.
4. **Goal-verify is a cost machine (§5 note 6):** judge + retries multiply
   tokens by (1+iters). Mitigated: maxIters/tokenBudget hard caps in the
   middleware, chat default off, per-profile defaults, every verdict
   logged with counts, S-6 executed on the scripted mock judge (zero live
   tokens) plus one small live confirmation.
5. **Ollama variability:** S-6/S-11 need a local model. `qwen3.6:27b`
   proved out in Phase C but availability is re-probed at T0 (one
   `ollama list` + one nunc-ai smoke call); 35b remains the on-disk
   fallback; acceptance stays structural.
6. **Deny-unknown gate skew:** any news-config field addition 422s stale
   gates. Mitigated: PD14's adjacent-commits + deploy-together rule,
   inherited from post-C.
7. **FourFive migration scope creep:** replacing the provider files touches
   the SSE endpoint and 24 tests. Mitigated: the SSE event protocol
   (user/thinking/content/assistant/blueprint/done) is kept byte-compatible
   so the Vue client needs no protocol change; `blueprint-prompt.ts` stays;
   `proposeBlueprint` is reimplemented as a nunc-ai structured call;
   fourfive tests are the acceptance gate.
8. **Elicitation protocol compatibility:** manda is built on rmcp 2.1 with
   the elicitation feature flag; whether the TS `@modelcontextprotocol/sdk`
   handshake + elicitation round-trip interoperate with it is **unverified
   until probed** — the T1 spike proves it before the agent is built on it
   (PD10); fallback is attest-mode for v0 with the elicitation handler
   landing as a fast-follow — recorded, not silent.
9. **Agent portability (Windows/macOS):** the agent is a TTY program
   spawning a child process (manda) — line editing, ANSI rendering, and
   process spawn semantics differ off Linux. CI runs the mock+attest suite
   on 3 OSes from T1; the interactive path is exercised on native Windows
   at the S-10 re-run; WSL remains the primary documented environment.
10. **Constitution §13-D timing:** the drafting cue there is "FourFive
    reaches an agent-form prototype" (Phase E), while the v1 plan pulls
    agent-abi v0 to D via profiles as the forcing function (§2.7). The
    draft stays strictly intake-only (PD11) so no amendment is needed; if
    owner review disagrees, the draft parks as `Status: Draft (pre-cue)`.
11. **F3 enforceability:** the self engine has no caller auth, so a
    malicious local process could still write the vault. Phase D enforces
    F3 at the profile validator and agent layers and **names the gap** in
    agent-abi v0; server-side enforcement is SPL v3's (recorded, not
    fixed here).

## File map (new/changed)

- Create: `agents/nunc-stans-agent/**` · `gate/src/profiles.rs` ·
  `gate/src/runs.rs` · `frontend/nunc-stans-formans/src/views/ProfilesView.vue`,
  `RunsView.vue` (+ router entries) · `design/stories/S-5.md`, `S-6.md`,
  `S-11.md` · `design/verification/phase-d.md` · `design/ui/phase-d/**`
- Modify: `frontend/packages/ai/src/{types,index,verify,runlog}.ts` +
  providers (`ollama`, `anthropic`, `mock`) · `engines/fourfive/server/**`
  (provider files replaced by nunc-ai glue; `blueprint-prompt.ts` kept) ·
  `engines/fourfive/.env.example` · `engines/fourfive/docs/guides/local-llm.md`
  · `engines/fourfive/src/**` (per-message verify toggle + cost display) · `gate/src/lib.rs` (routes,
  `--instances-dir`) + `news_config.rs` (PD14 fields) ·
  `gate/src/main.rs` (clap
  `Args` + `GateCfg` wiring for `--instances-dir`) ·
  `frontend/nunc-stans-formans/src/components/NewsSettings.vue` ·
  `engines/nunc-fluens/pipeline/src/cli.ts` +
  `engines/nunc-fluens/pipeline/src/orchestrator/core.ts` (profile-default
  consumption + per-step verify threading through the LLM helpers — config
  surface only, no lifecycle internals) · `pnpm-workspace.yaml` ·
  `.github/workflows/ci.yml` · `tools/commit-scope.ts` · `tools/check.ts`
  (FD-7.4 scope) · `tools/bootstrap.sh` (doctor manda check) ·
  `CONTRIBUTING.md` (area) · `contracts/agent-abi.md` (Reserved → v0) ·
  `contracts/glossary.md` (profile/agent vocabulary, §11) ·
  `justfile` (agent target; gate `--instances-dir`) ·
  `design/stories/S-10.md` (manda doctor extension, T11) ·
  `design/naming.md`, `design/documentation-reading-order.md`,
  `CONTRIBUTING.md:19-20` (PD4 rewording, T12), v1 plan (in-place updates
  at T12)
- Delete: `engines/fourfive/server/llm/{provider,claude,ollama,mock}.ts`
  (no dedicated tests exist for these four; `blueprint-prompt.test.ts` is
  kept with its module; replaced by nunc-ai glue; git history keeps them)

## Tasks

Sequencing is dependency-first: the two external risks (manda, the V3
session) are de-risked at T0–T1 before any surface work; nunc-ai contract
changes (T2–T3) land before their three consumers; the story docs are
written at T1 as executable specs so S-5/S-6/S-11 are the phase's
acceptance tests, not close-out paperwork.

Session-size guide (v1 plan: 3–5 focused sessions):
**S1** = T0+T1+T2 · **S2** = T3+T4 · **S3** = T5+T7 · **S4** = T6+T8+T9 ·
**S5** = T10+T11+T12.

### Task 0: Preflight + sync point (design) — DONE 2026-07-07
- [x] V3 close-out confirmed (90f948b); owner merged via **PR #3**
      (`phase/post-c` → `dev`, newstack included as ancestor). Base
      commit recorded: **0224a44**.
- [x] Branch `phase/d`; tag `pre-phase-d` (= 0224a44).
- [x] `design/verification/phase-d.md` opened: re-measured baselines
      (pipeline 187/20, nunc-ai 12, fourfive 24, Formans 16, gate 9,
      ns 11, check.ts ok — pipeline 188→187 and gate 10→9 moved vs the
      post-c record, vindicating re-measure-not-copy); probes logged
      (qwen3.6:27b + 35b fallback on disk; manda d0b61e2, zero tags;
      **release build built** — only debug existed, as predicted).
- [x] Commits: a0b889c (plan), 2c95de0 (verification record).
- Verify: tree carries only the owner's WIP (justfile, tools/down.sh) —
  untouched.

### Task 1: Registration, story specs + manda de-risk spike (tool, design, agent) — DONE 2026-07-07
- [x] Area `agent` registered: commit-scope regex, CONTRIBUTING line,
      `agents/*` workspace glob, CI typecheck/test steps, FD-7.4 widened
      to `agents/` (a6373e8 tool, dc4b5b7 design — the Phase B two-commit
      precedent).
- [x] S-5 / S-6 / S-11 written as executable specs (8a1047a). One
      refinement vs this task's original text, recorded: the
      `First executed:` line is ADDED at T10 when it becomes true
      (matching how S-0/1/2/9/10 got theirs); the specs close with the
      evidence pointer meanwhile. S-11 pins the commit-is-the-refusal-
      point semantics.
- [x] `agents/nunc-stans-agent/` scaffolded (package, strict tsconfig
      incl. `verbatimModuleSyntax` + `erasableSyntaxOnly`, cli stubs:
      working `doctor` + print-only `mandate-template`, `chat` pointing
      at T9) — e56ccfe.
- [x] **Spike PASSED against the live release binary** (e56ccfe,
      `src/memory.ts` + `test/manda-live.test.ts`): full lane green —
      append → propose → agent-origin commit refused ("no commit
      authority") → user-origin commit without mandate refused → hand
      grant → **elicitation round-trip works** (rmcp asked, the TS SDK
      client answered, committed record carries
      `"origin_verified":true` + the approval note) → read ≤3 →
      out-of-mandate commit refused → **explicit decline denies**
      (nothing committed). Risk 8 CLOSED on the elicit path — no attest
      fallback needed. F3 guard rejects `self/commitment/*` before manda
      is asked.
- [x] fake-manda stdio stub + 3-OS-safe suite (10 tests: refusal, lapse,
      ≤3 cap, F3) + live suite self-skips without a binary. 12/12 green;
      node-strip trap found+fixed (TS parameter property — vitest's
      esbuild masked it; `erasableSyntaxOnly` now catches it at
      typecheck).
- Acceptance MET: S-11's hardest edge proven first, on the real binary.

### Task 2: nunc-ai contract extensions (fe) — DONE 2026-07-07 (ea913b8)
- [x] `chatStream` + thinking deltas: ollama (incremental NDJSON incl.
      `message.thinking`, shared reader with chat()), anthropic (SSE
      `thinking_delta`/`text_delta`, usage from message_start +
      message_delta), mock (scripted thinking + chunked content —
      capabilities now honestly `stream:true, thinking:true`);
      `Ai.chatStream` with the capability-declared one-delta fallback for
      streamless providers (claude-code untouched). `ChatOptions.verify`
      (per-call merge over Ai defaults) + `ChatOptions.profile`;
      `RunLogEntry.profile` + `verdicts` (typed; populated at T3).
- [x] Anthropic default model id verified against the `claude-api` skill
      2026-07-07: `claude-sonnet-5` is a current active alias — kept, one
      source of truth in `providers/anthropic.ts`.
- Acceptance MET: nunc-ai 12→20 tests green; **pipeline 187/187 green
  with zero call-site changes**; fourfive 24/24; typecheck green.

### Task 3: Goal-verify loop (fe) — DONE 2026-07-07 (c3641b4)
- [x] `runVerified` in `verify.ts`, wired inside `createAi.chat`/`chatStream`
      per PD5: judge verdict `{met, gaps[]}` (schema-prompted, code-fence
      tolerant), gaps fed back as conversation turns, maxIters (default 2)
      + tokenBudget hard brakes, judge-failure ends the loop honestly
      (gap recorded, answer returned, no blind retries). ONE run-log entry
      per loop: aggregated tokens + the verdict chain; judge rides the
      caller's provider unless `verify.judge` names another. Streaming:
      each iteration streams, `verify` boundary events between iterations,
      exactly one `done` (StreamEvent gained the `verify` variant).
      Verify-on without a goal is a config error.
- [x] Scripted judge = any provider via `cfg.providers` (tests ship one);
      the mock provider's scripted thinking/content covers the S-6
      zero-token rehearsal.
- Acceptance MET: 8 loop tests (never-met stops at maxIters + feedback
  carried; met stops early; budget brake; judge-down; fence parse;
  boundary-event order content→verify→content→verify→done; off-default
  unchanged). nunc-ai 28/28; pipeline 187/187 untouched.

### Task 4: Profile store + gate API + Profiles screen (gate, fe) — DONE 2026-07-07 (f838fc0, 1bde665)
- [x] Validators on both sides, rails unit-tested twice: Rust
      `gate/src/profiles.rs` (5 unit tests) + TS mirror
      `nunc-ai/src/profile.ts` (+ loader/resolver for the agent; 7
      tests). **F3** rejects every write-scope spelling that reaches
      commitments (`self/commitment{,/x,/*}`, `self`, `self/*`); **BYOL**
      rejects credential-shaped keys recursively in `ui`; slug ids only
      ('defaults' reserved).
- [x] Gate CRUD + defaults: `GET /api/profiles`,
      `GET|PUT|DELETE /api/profiles/{id}`, `GET|PUT
      /api/profiles/defaults` (pointers must name existing profiles;
      DELETE scrubs dangling pointers) — news_config discipline
      (deny-unknown 400, validation 422, atomic tmp+rename, 503 without
      a store). Integration test covers the full round trip incl. both
      rails at the HTTP surface. **Bug found+fixed in-phase:** the gate
      test helper `make_dists` shared one index.html across concurrently
      running tests and rewrote it per call (fs::write truncates) — the
      pre-existing static-mount test was intermittently served an empty
      file; per-call unique dirs now (6 consecutive clean full runs).
- [x] Formans `/profiles` route + topbar tab + view (list/create/edit/
      duplicate/delete + default-per-context pickers; server-side rail
      errors surfaced verbatim); form↔payload logic extracted to
      `src/profiles.ts` with tests. Screenshots land with the T10/T11
      UI pass (the screen needs a running gate + store).
- Acceptance MET (API level; UI round-trip re-proven at S-5): gate
  16/16 (6 unit + 10 integration), nunc-ai 35/35, Formans 20/20 +
  build, check.ts ok.

### Task 5: FourFive on profiles (ff) — DONE 2026-07-07 (5417ee4 fe, d32f261 ff)
- [x] `server/llm/{provider,claude,ollama,mock}.ts` deleted;
      `server/llm/nunc-ai.ts` resolves a profile PER MESSAGE (explicit
      `profileId` > fourfive-chat default > offline demo) and calls
      through nunc-ai — run log to the main store with the profile stamp
      (proven live: smoke rows carry `"profile":"offline-demo"`),
      `llm_runs` kept for the UI. `blueprint-prompt.ts` kept;
      `proposeBlueprint` = extractor prompt via nunc-ai + `extractJson`
      (verify off by design — zod is the gate). **Recorded refinement:**
      the retired MockProvider's canned invoice demo is PRODUCT logic —
      moved verbatim to `server/llm/offline-demo.ts` and wired through
      nunc-ai's mock responder, so a fresh checkout still demos offline.
      `/api/health` + the boot line report the RESOLVED default (per
      request — the no-restart mechanics). think/maxTokens ride new
      nunc-ai passthroughs (ollama `think`, `num_predict` — 5417ee4).
- [x] Verify toggle (+ goal input) in the topbar; SSE gains an additive
      `verify` event; the transcript renders one verdict line per
      iteration (met/unmet + gaps) and a cost line (per-iteration + total
      tokens, model + judge), live and on completed messages. The toggle
      sends explicit on/off with every message so chat stays
      off-by-default regardless of profile defaults (§2.6).
- [x] Stub + stale `claude-sonnet-4-6` died with the deleted files;
      `.env.example` (BYOL-only), `docs/guides/local-llm.md` (profile
      flow, no-restart), `scripts/verify.sh` updated.
- Acceptance: typecheck (vue-tsc + server tsc incl. the relative nunc-ai
  source imports) green; 24/24 tests; **live E2E smoke ALL_VERIFY_OK**
  (chat + canned blueprint + persist + compose + vite build). The Ollama
  streaming + no-restart switch re-proven at S-5/S-6 execution (T10).

### Task 6: News step config on profiles (gate + fe + nf, adjacent commits per PD14) — DONE 2026-07-07 (9cc83cf gate, 6ece8ba fe, 3e50813 nf)
- [x] `NewsConfig` gained `profile` (slug-validated) + `stepVerify`
      (per-step `{verify, goal, maxIters, tokenBudget}`, deny-unknown,
      value-validated) — gate integration test covers round-trip + all
      three 422s + the nested-unknown 400. Drawer gained the
      profile-defaults dropdown (fed by /api/profiles) and passes an
      existing `stepVerify` through untouched. Three adjacent per-area
      commits, deploy together.
- [x] Pipeline: news-config's `profile` loads from the MAIN store
      (refusal on unloadable, never a silent fallback); provider/model
      become step DEFAULTS (explicit keys win); `goal_verify` becomes
      the every-LLM-step default with `stepVerify` overriding per step
      — threaded via `stepAiOptions()` into the three LLM helpers
      (config surface only; DAG/lifecycle untouched). `run.json` gains
      the `profile` stamp; ai-runs rows carry profile + verdicts via
      nunc-ai.
- [x] `cli.ts` comment updated: the per-INSTANCE gate-config follow-up
      stays recorded; PD14's keys don't close it.
- Acceptance MET: gate 6+11; pipeline typecheck + **193/193** (the
  count moved 187→193 mid-phase: the post-C session's live-run
  validation landed two ride-along `nf:` fixes with tests — 780e9c7
  mid-2027 modifier-year parse, 892c7e0 readme link-check anchoring —
  interleaved on this branch; recorded, not mine). Formans 20 + build.

### Task 7: Run-log viewer (gate, fe) — DONE 2026-07-07 (cfcf7f3 gate, 80c1ce0 tool, 56e5fc1 fe)
- [x] Gate `GET /api/runs?source=main|instance&instance=<name>&limit=N`
      + `GET /api/runs/instances` — tail-parse (limit clamped ≤1000,
      malformed lines skipped, oldest-first), slug-guarded instance
      names, missing log = empty view; instances root ONLY via the new
      `--instances-dir` flag (`just up` passes
      `engines/nunc-fluens/instances`) — never derived in Rust.
      Integration test: main tail + limit + malformed-skip, instance
      source, enumeration (dir without a log excluded), the three 400s,
      ghost instance = []. NB: the justfile hunk was committed via a
      plumbing blob so the owner's uncommitted down/restart WIP stayed
      out of the commit; both versions `just`-parse.
- [x] Formans `/runs` route + topbar tab: newest-first table (ts,
      caller, profile, provider·model, tokens, ms, verify, outcome),
      source switcher fed by /api/runs/instances, expandable verdict
      chain per verify-on row. No prompt text log-to-screen.
      Screenshots land with the T10/T11 UI pass.
- Acceptance MET at the API level (real fourfive smoke rows render the
  main source; instance rows proven by the gate test); the live
  two-source UI pass happens at S-5/T11. Suites: gate 6+12, Formans
  20 + build.

### Task 8: agent-abi.md v0 (contracts) — DONE 2026-07-07 (1fd7b57) — OWNER REVIEW PENDING
- [x] Drafted per PD11 (Reserved → v0 Draft): the three-part
      registration (user-written commitment F3 + mandate with mandatory
      expiry/lapse + frozen version reference F7), the §2.6 capability
      vocabulary carried by the profile record (both code rails cited),
      startup/suspension = manda `mandate_list` **named as the interim
      substitute** for the F14 engine-side source of truth, execution
      records = the ai-runs.jsonl shape + manda's audit lanes, BOTH
      enforcement gaps named, §13-A out-of-scope kept. The Reserved
      stub's rule survives verbatim as the governing sentence.
- [x] `contracts/glossary.md` gained `profile` (incl. the
      instance-collision note), `agent`, `agent runtime` (§11
      deliberate-commit rule).
- [x] Reading-order entry updated.
- Acceptance: `tools/check.ts` green; **owner review pending (it is a
  contract — owner action item 5)**.

### Task 9: nunc-stans-agent v0 (agent) — DONE 2026-07-07 (6d89d8c agent, bbd4d80 tool)
- [x] `chat` REPL (`src/chat.ts` turn engine, terminal-free for tests +
      `cli.ts` readline shell): streaming content + dimmed visible
      thinking via `Ai.chatStream`; profile-driven (agents default via
      `resolveProfile`, `--profile` override, ad-hoc mock fallback
      stated); goal-verify rides the profile with `verify` boundary
      events rendered as meta lines; every call logged to the main-store
      `ai-runs.jsonl` with the profile stamp (proven in tests).
- [x] Memory commands on the T1 client: `/remember` = propose (candidate
      lane) → interactive confirm → commit, with manda's ELICITATION as
      a real terminal y/N prompt (cli approver; declines deny);
      `/recall` renders ≤3 + the suppression count; `/mandates` +
      startup check render the readable no-mandate state; refusals shown
      verbatim; the F3 guard fires before manda is asked. Memory-OFF
      states are explicit, never silent.
- [x] `doctor` now also runs a live `mandate_list` when configured;
      `mandate-template` prints-never-writes (PD9).
- [x] `just agent` recipe (plumbing-committed around the owner's
      justfile WIP again); README with the REAL setup line — **the
      owner tagged v0.2.0 mid-phase, so the pending-tag marking never
      shipped** — plus the MANDA_BIN local path and the out-of-band
      first-mandate flow.
- Acceptance: agent suite 12→22 green (chat turns, approve/decline/
  refusal/F3/recall-cap flows on fake-manda; live-manda suite green on
  this box incl. elicitation). The Ollama-live terminal pass is S-11's
  execution (T10). CI runs mock+attest+fake-manda on 3 OSes.

### Task 10: Stories S-5 / S-6 / S-11 — execute (design) — depends: T4/T5 (S-5), T3/T5/T6 (S-6), T9 (S-11); specs written at T1
- [ ] Execute all three against the built surfaces; evidence (command
      transcripts, numbered verdicts, bugs-found-by-execution) appended to
      `design/verification/phase-d.md` as separate `design:` commits. Any
      spec refinement since T1 is visible in the story file's git history.
- Acceptance: three PASS records with evidence in the verification doc.

### Task 11: Doctor, setup line, S-10 + exit sweep (tool, design) — depends: T9; tag flip depends: OWNER
- [ ] `just bootstrap` doctor gains the `manda` check (warn-if-missing;
      hard-pass flag flipped when the owner tag lands — PD8). S-10.md
      extended to cover it.
- [ ] S-10 re-run: pristine Ubuntu container + native Windows (incl. the
      agent's interactive TTY path — risk 9); 3-OS CI green on `phase/d`
      (owner push).
- [ ] Verify exit-line items 1–4 end-to-end on the real UI (profile
      create/switch; verify-on loop visible with gaps + cost; Ollama under
      a profile; agent chat with mandate-gated memory).
- Acceptance: S-10 PASS recorded; CI green; doctor output archived.

### Task 12: Plan updates + close (design) — depends: all
- [ ] v1 plan in-place updates: §2.7 profile-versioning claim superseded
      (PD2), §2.6/§2.11 run-log paths retargeted to the R13 store, the
      line-523 "no AI attribution" clause noted as superseded by
      CONTRIBUTING.md (trailer allowed since 2026-07-04), Phase D section
      checked off; `design/naming.md` (profile-vs-instance note, PD4;
      `agent` area); `design/documentation-reading-order.md` refresh
      (agents/, agent-abi v0, new Formans routes).
- [ ] Verification doc exit checklist filled (incl. the mechanical V3
      no-touch proof and the manda commit/tag state at close); assistant
      memory updated.
- [ ] Commit: `design: close phase d with the verification record`.
- [ ] OWNER gate: push `phase/d`, watch 3-OS CI, merge `phase/d` → `dev`;
      PR `dev` → `main` at the review gate.

## Exit criteria (phase closes when all hold)

Items 1–5 map 1:1 to the v1 plan's exit line (617-621); 6–7 are Work-item
obligations from the Phase D paragraph (606-615); 8–9 carry the standing
rules (513-523: stories gate closure + verification evidence, owner
push/PR), the §2.10/S-10 CI-matrix obligation, and the Phase B/C closure
precedent of screenshots under `design/ui/` (v1 plan line 571):

1. Profiles can be created and switched from the UI (Profiles screen;
   default-per-context takes effect without restarts). [T4, T5]
2. A verify-on message visibly loops (≤ max_iters), reports the unmet
   gaps, and the cost is visible. [T3, T5]
3. A local model via Ollama works under a profile (FourFive chat and the
   agent). [T5, T9]
4. `nunc-stans-agent chat` works in a terminal with mandate-gated memory
   operations through manda (in-mandate propose+commit succeeds,
   out-of-mandate commit refused). [T9]
5. Stories S-5, S-6, S-11 written (T1), executed, and passing with
   evidence in `design/verification/phase-d.md`. [T10]
6. `contracts/agent-abi.md` is v0 Draft (Reserved retired) and
   owner-reviewed. [T8]
7. FourFive's Claude streaming stub and stale default model id are gone
   (one provider implementation, one model-id source of truth). [T5]
8. Standing: S-10 re-run passes (pristine Ubuntu + native Windows) with
   the manda doctor check present; 3-OS CI green; new UI surfaces
   screenshotted under `design/ui/phase-d/`. [T11]
9. `design/verification/phase-d.md` complete; v1 plan + naming +
   reading-order updated in place; **owner merge/push/PR gate**. [T12]

## Owner action items

1. **Approve the design decisions (PD1–PD15), then this plan** — the §7
   two-step; dates recorded in the decisions heading and the verification
   header. No code before both.
2. **Merge train:** merge `newstack` → `dev` (Phase C exit item 7), then
   PR/merge `phase/post-c` → `dev` once the V3 session closes; or approve
   the PD1 fallback branch point.
3. **manda tag:** in `~/manda`, `git tag v0.2.0 && git push origin v0.2.0`
   (the push of `main` is already done — verified 2026-07-07,
   `d0b61e2`). This unblocks the `cargo install` setup line, the doctor
   hard-pass, and the S-10 extension; nothing else waits on it.
4. **Grant the first agent mandate** by appending a line to the agent
   data dir's `mandates.jsonl` per `manda/spec/mandate.md` (expiry
   required) — the agent's `mandate-template` subcommand prints the line
   for you; mandates are principal-only, out-of-band by contract.
5. Review the `contracts/agent-abi.md` v0 draft (T8) — it is a contract
   and constitutionally scoped (§13-D).
6. (Unrelated cleanup, no phase dependency): the stale `honcho-sim-*` /
   langfuse containers from archived experiments are still running
   (phase-a.md:123-126).

## Non-goals (Phase E boundaries and explicit deferrals)

- **Hermes/Honcho comparison runtime** — out (PD12); license-verification
  gate documented for whenever it returns.
- **MCP tool client beyond manda** (generated-app CRUD tools, S-7) —
  Phase E; Phase D fixes the shapes E targets (profile schema, agent MCP
  client, run-log format — v1 plan lines 625-634).
- **Autonomous coding-agent loops** — not in v0 (§2.11); coding tasks stay
  on the `claude-code` runtime.
- **Engine mandate lane** (`me/mandates/` + `/self/mandates`, SPL v3 DDL)
  and **server-side caller auth/F3 enforcement** — deferred to SPL v3;
  named in agent-abi v0.
- **claude-code streaming** — remains `stream:false`; spawn-based
  stream-json is a recorded later extension (PD6).
- **Instance-targeted config editing from the UI** (gate writing an
  instance's `store/news-config.json`) — deferred; the hand-placed
  override keeps winning (PD14). This is the post-C R3 recorded
  "per-profile gate API" follow-up ("profile" = data instance in that
  vocabulary) — still open after Phase D, deliberately.
- **Timeline intervention/mandate lanes** stay "no records yet (Phase D+)"
  (S-9.md:5-6) — not populated this phase.
- **openai/google providers** (§2.6 list) — not required by any D story;
  deferred until a story needs them.
- **nunc-fluens instance-lifecycle internals** — post-C V3's territory,
  untouched (mechanical proof at close).

## Verification plan (`design/verification/phase-d.md` must contain)

- Header: start date, `pre-phase-d` tag + base commit (post-merge-train),
  branch, plan link with both approval dates (decisions, then §7 plan).
- Preflight: **re-measured** suite baselines; environment probes (Ollama
  model list; manda remote/tag state + the release-build commit hash);
  constraints carried ("nunc-fluens instance internals receive zero
  commits, proven at T12 by the empty `git log` over
  `pipeline/src/instance.ts` and the init/import modules"; "owner's live
  data store and manda dir never written by tests").
- Evidence log: one dated entry per task T0–T12 with commit hashes, suite
  counts, and bugs found-and-fixed in-phase in bold (phase-b ledger style),
  plus per-story EXECUTED sections with literal command transcripts and
  numbered mechanical verdicts (phase-c style) for S-5/S-6/S-11.
- S-10 re-run record (Ubuntu container + native Windows, incl. the agent
  TTY path) including the doctor manda check output; 3-OS CI link.
- **Constitutional check record** (numbered, first-class section): the F3
  rejection test output on both validator sides; the agent's refusal
  transcript; the statement that no loop output faces the self scope this
  phase; the F11 locality check (no new remotes, no telemetry).
- Decisions log for in-flight engineering deviations; a **license
  section** that either records "Hermes/Honcho not integrated (PD12)" or,
  if that decision is reversed mid-phase, the full license verification
  **dated before** any integration commit.
- Screenshot index for `design/ui/phase-d/` (Profiles screen, run-log
  viewer, FourFive verify-toggle + cost surface).
- Exit-criteria checklist mirroring the nine items above, with
  `[ ] PENDING owner:` lines for the merge/push/PR gate and (if still
  open) the manda tag flip.

## Self-review (done at write time)

- The v1-plan Phase D paragraph (606-615) is fully covered: profile store +
  Profiles screen ✓ (T4), FourFive chat wired ✓ (T5), News step config
  wired ✓ (T6, retargeted to the post-V3 NS_INSTANCE/init-import world per
  naming.md rows 28-31 — the v1 wording predates the template/instance
  redo), goal-verify toggle per message and per step ✓ (T3/T5/T6), run-log
  viewer ✓ (T7), agent-abi v0 ✓ (T8), nunc-stans-agent v0 per §2.11 ✓
  (T1/T9), Hermes/Honcho optional → explicitly declined with the license
  gate documented ✓ (PD12), FourFive streaming stub + stale model id fixed
  ✓ (T5, by file deletion — with the blueprint prompt builder preserved).
- Known deviations from the v1 plan, recorded as PDs rather than silently:
  profile git-versioning claim superseded (PD2, post-R13); run-log paths
  retargeted to the R13 store and split per R3 (PD13); §2.11's
  `~/nunc-stans-data/runs/` read as the data store's `runs/` under the new
  default; the "MCP tool client" work item narrowed to the manda stdio
  client in v0 (no D story exercises another server; the general tool
  client is Phase E's S-7 territory, and Phase D fixes the client shape E
  reuses); the post-C R3 per-instance gate-config follow-up deferred, not
  absorbed (PD14 — the AI-profile keys are a different feature).
- Constitution: F3 enforced in code twice with the server-side gap named
  (PD11, risk 11); F11 honored (all new state local, no remotes, no
  telemetry); §13-D drafting scope respected (intake-only, drafted after
  the semantics are proven); the manda contract's mandate/audit rules are
  the agent's operating rules, not reinvented.
- Cross-session safety: the plan interfaces with nunc-fluens only through
  stable surfaces, starts after the V3/post-C merge train (PD1, risk 2),
  and proves the no-touch rule mechanically at close.
- Honest current-state facts this plan stands on (verified 2026-07-07):
  manda pushed but untagged (`d0b61e2`), local build debug-only; no
  streaming method or profile field in nunc-ai
  (`frontend/packages/ai/src/types.ts:41-96`); verify loop absent by
  design (`verify.ts`); fourfive on its own env-singleton layer
  (`server/llm/provider.ts:47-66`) with the stub at `claude.ts:71-80` and
  stale id at `claude.ts:17`; gate has zero profile/instance awareness
  (`gate/src/lib.rs:66-78`); no `agents/` workspace glob, CI step, or
  commit area; `design/stories/S-5.md`/`S-6.md`/`S-11.md` do not exist;
  `contracts/agent-abi.md` is a 21-line Reserved stub.
