# Phase D verification — Profiles + goal-loop surfaces + nunc-stans-agent v0

Running record; completed as the exit items execute. Plan:
`design/development/2026-07-07-phase-d-plan.md`.

## Gate record (§7 two-step)

- Decisions PD1–PD15 ratified by the owner in session: **2026-07-07**.
- Plan approved by the owner in session: **2026-07-07**.
- PD1 resolved the same day: owner ran the merge train (`phase/post-c` →
  `dev` via PR #3, `newstack` included as ancestor); `phase/d` branches
  off `dev`; the fallback branch point was not used.

## Baseline (T0, 2026-07-07)

- Branch **`phase/d`** off `dev` at **0224a44** (merge of PR #3 =
  post-C V2 REDO + V3 close-out 90f948b); tag **`pre-phase-d`** = 0224a44.
- Plan committed: a0b889c `design: open phase d with the approved
  implementation plan`.
- Suite baselines — **re-measured on 0224a44**, not copied from the
  post-C record (which predates the V3 tail; pipeline moved 188→187,
  gate 10→9 since that record):

      pipeline  187 passed / 20 files   (vitest)
      nunc-ai    12 passed / 3 files    (vitest)
      fourfive   24 passed / 3 files    (vitest)
      Formans    16 passed / 3 files    (vitest)
      gate        9 passed              (cargo test)
      ns engine  11 passed              (cargo test)
      tools/check.ts: ok (FD-3.2 vault-path, import boundary,
      edge.schema.json)

## Environment probes (T0, 2026-07-07)

- **Ollama (risk 5):** `ollama list` shows `qwen3.6:27b` (17 GB) —
  the S-6/S-11 model, proven in Phase C exit run (b); `qwen3.6:35b`
  on disk as the recorded fallback.
- **manda remote/tag state (PD8):** local `~/manda` HEAD **d0b61e2**
  (2026-07-03) == `origin/main` at `github.com/baba-yu/manda`;
  `git ls-remote --tags origin` returns **zero tags** — the `v0.2.0`
  tag remains the owner prerequisite; nothing in-phase blocks on it.
- **manda release build (PD8):** `cargo build --release` in `~/manda`
  succeeded (manda v0.2.0, 19 s; previously only a debug build
  existed). Built at commit **d0b61e2** — the hash Phase D develops
  against; re-record if the owner adds commits before tagging.

## Constraints carried (from the plan)

- nunc-fluens instance-lifecycle internals receive **zero commits**
  this phase — proven at T12 by an empty
  `git log phase/d --not pre-phase-d -- engines/nunc-fluens/pipeline/src/instance.ts`
  (and the init/import modules).
- The owner's live data store (`~/nunc-stans/data`) and live manda dir
  are never written by tests or stories — scratch `NS_DATA` /
  `MANDA_DATA_DIR` only.
- Production `~/news`: zero contact (Phase C redirection stands).

## Evidence log

- **2026-07-07 — T0 done.** Branch + tag cut, plan committed (a0b889c),
  baselines re-measured (above), probes logged (above). Owner WIP
  observed in the working tree and left untouched: modified `justfile`
  + untracked `tools/down.sh`.
- **2026-07-07 — T1 done** (a6373e8, dc4b5b7, e56ccfe, 8a1047a).
  `agent` area registered (commit-scope, CONTRIBUTING, workspace, CI,
  FD-7.4 → agents/); S-5/S-6/S-11 written as executable specs;
  `agents/nunc-stans-agent/` scaffolded (doctor + print-only
  mandate-template working under raw node). **manda spike PASSED on the
  live release binary (d0b61e2)** — full lane, and the risk-8
  elicitation probe is CLOSED on the elicit path: rmcp elicited through
  the TS `@modelcontextprotocol/sdk` client, the approval yielded
  `"origin_verified":true` (probe log in `test/manda-live.test.ts`
  output), an explicit decline denied with nothing committed. Suite
  12/12 (fake-manda stub 3-OS-safe + self-skipping live suite).
  **Bug found+fixed in-phase:** TS parameter property broke raw
  `node` strip-only execution while vitest's esbuild masked it —
  removed, and `erasableSyntaxOnly` added to the agent tsconfig so the
  class of bug fails typecheck from now on.
- **2026-07-07 — owner tagged manda `v0.2.0`** (== d0b61e2, the exact
  commit the T0 release build used — no drift). `git ls-remote --tags`
  verified. PD8's pending-tag machinery flips at T11: doctor hard-pass,
  setup line unmarked, S-10 extension asserts it.
- **2026-07-07 — T2 done** (ea913b8). nunc-ai gained `chatStream`
  (ollama incremental NDJSON + thinking; anthropic SSE; mock scripted;
  one-delta fallback for streamless providers), `ChatOptions.verify`
  (per-call merge) / `.profile`, `RunLogEntry.profile`/`verdicts`.
  **Model-id hygiene (plan derived decision): `claude-sonnet-5` default
  verified current against the `claude-api` skill 2026-07-07.**
  Acceptance: nunc-ai 20/20; pipeline 187/187 untouched; ff 24/24;
  typecheck green.
- **2026-07-07 — T3 done** (c3641b4). Goal-verify judge/retry loop live
  in `createAi` (PD5): verdict chain + per-iteration tokens in one
  run-log entry, maxIters/tokenBudget brakes, judge-failure honest-stop,
  streamed iterations with `verify` boundary events + single `done`.
  nunc-ai 28/28; pipeline 187/187 untouched.
- **2026-07-07 — T4 done** (f838fc0 gate, 1bde665 fe). Profile store
  live end-to-end: gate CRUD+defaults API with the F3 and no-credential
  rails enforced server-side (unit + integration tested), TS mirror +
  loader in nunc-ai, Formans /profiles screen with per-context default
  pickers. **Constitutional check item 1 evidence (partial): the F3
  rejection test output exists on both validator sides** (gate unit
  `f3_rejects_commitment_write_scope`, HTTP-level 422 in
  `profiles_crud_defaults_and_rails`; TS `validateProfile` F3 spec).
  **Bug found+fixed:** pre-existing gate test-helper race (shared
  index.html rewritten per test) made the static-mount test flaky —
  per-call dirs now, 6 clean runs. Suites: gate 6+10, nunc-ai 35,
  Formans 20 + build.
- **2026-07-07 — T5 done** (5417ee4 fe, d32f261 ff). FourFive migrated
  onto nunc-ai profiles: per-message resolution (no boot singleton — the
  no-restart mechanics), streaming stub + stale `claude-sonnet-4-6` died
  with the deleted provider files, verify toggle + verdict/cost surfaces
  in the chat UI, offline invoice demo preserved via
  `server/llm/offline-demo.ts` (recorded refinement — product logic, not
  provider glue). **Live E2E smoke ALL_VERIFY_OK** and the main-store
  run log carries fourfive-chat rows with `"profile":"offline-demo"` —
  the S-5 substrate proven. Suites: ff typecheck + 24/24 + build.
  In passing: a mid-work `git rm` had pre-staged the four deletions and
  leaked them into the fe commit — caught by `tools/commit-scope.ts`
  exactly as designed; commits rebuilt per-area.
- **2026-07-07 — T6 done** (9cc83cf gate, 6ece8ba fe, 3e50813 nf —
  the PD14 adjacent-commit train). news-config now names an AI profile
  (step defaults) + per-step verify overrides; pipeline threads them
  into the LLM helpers and stamps `profile` into run.json/ai-runs;
  the R3 per-instance follow-up stays recorded (comment updated).
  Suites: gate 6+11, pipeline 193/193. **Baseline drift, recorded:**
  the pipeline count moved 187→193/22 mid-phase because the post-C
  session's real-data validation landed two ride-along `nf:` fixes
  with tests on this branch (780e9c7, 892c7e0) — the shared checkout
  now lives on phase/d, so that session's commits interleave here.
  Legitimate fixes, no conflicts with the T6 diff.
- **2026-07-07 — T7 done** (cfcf7f3 gate, 80c1ce0 tool, 56e5fc1 fe).
  Run-log viewer live: gate tail API (main store + per-instance via the
  explicit `--instances-dir` handoff) + Formans /runs view with the
  verdict-chain expansion. The justfile `--instances-dir` line was
  committed as a plumbing-built blob so the owner's uncommitted
  down/restart WIP never entered a commit (working tree carries both;
  committed and working justfiles both parse). Suites: gate 6+12,
  Formans 20 + build.

## Stories (executed at T10; specs written at T1)

- S-5 — **EXECUTED 2026-07-07, PASS (API core; screen pass rides T11)**
- S-6 — **EXECUTED 2026-07-07, PASS** (mock + live)
- S-11 — **EXECUTED 2026-07-07, PASS** (see below)

### S-5 / S-6 — EXECUTED 2026-07-07 (scratch store, curl through the gate)

Setup: scratch `NS_DATA=/tmp/s5-store-*`; fourfive (tsx, :8797) + the
release gate (:8730, `--data-dir` scratch, `--instances-dir`
engines/nunc-fluens/instances) — offset ports so the dev stack is
untouched; no engine (neither story touches /self).

S-5 verdicts:

1. Two profiles created through the one door (`live-ollama` =
   qwen3.6:27b with scopes+verify defaults; `offline-mock`);
   round-trip + the atomic file on disk. PASS
2. **F3 at the HTTP surface**: the rogue profile → 422 "F3: no profile
   may grant write access to self-scope commitments…" —
   constitutional check item 1's surface-level half. PASS
3. defaults PUT `{"fourfive-chat":"live-ollama"}` → a real FourFive
   chat message under the default answered by ollama via the gate;
   the run log stamped `"profile":"live-ollama"` on BOTH callers
   (fourfive-chat and fourfive-blueprint). PASS
4. Default switched to `offline-mock` → `/api/health` reports the new
   resolution immediately and the NEXT message stamps
   `"profile":"offline-mock"` — **no server restart** (per-message
   resolution proven live). PASS

S-6 verdicts:

1. Mock pass (zero live tokens): verify ON + "answer in exactly zero
   words" under the offline scripted judge → run-log entry
   `verify:"on"` with a 2-entry verdict chain (maxIters=2), scripted
   never-met gaps, per-iteration token fields. PASS
2. Off-by-default: the next message logged one call, **no verdicts
   key**. PASS
3. Live confirmation (ollama model + ollama judge): SSE `verify`
   events — iteration 1 unmet with the judge's articulated gap ("The
   response contains words (3), but the goal requires exactly zero
   words."), iteration 2 **met** (the retry actually achieved the
   goal — gap feedback works); loop ≤ maxIters; cost visible per
   iteration (927/231, 1228/1160 tok) and in entry totals
   (2155/1391). PASS
4. The viewer API (`/api/runs`) returns the rows with verdict chains
   and profile stamps. PASS

Spec refinement, recorded: S-6's mock-pass line expected non-zero mock
token counts; the mock provider's counts are zero by nature — the
FIELDS are asserted present, real cost is the live pass's job (story
doc updated). The Profiles-SCREEN interaction + screenshots ride the
T11 UI pass; the APIs the screen calls are what this execution proved.

### S-11 — EXECUTED 2026-07-07 (scripted stdin; scratch stores)

Setup: `NS_DATA=/tmp/s11-store-*`, `MANDA_DATA_DIR=/tmp/s11-manda-*`,
`MANDA_BIN=~/manda/target/release/manda` (v0.2.0 == d0b61e2); profile
`agents-live` = ollama `qwen3.6:27b`, `ui.think: true`, agents default;
one mandate granted by hand from `mandate-template` output
(`m-2026-07-08-notes`, scope `notes/*`, 30-day expiry). The REPL was
driven by piped stdin (the line-queue added for exactly this — found
live: readline drops lines with no pending question; fixed in cedbea8).

Mechanical verdicts:

1. Startup banner named the profile and the mandate (scope + expiry);
   the empty-mandate state was proven separately in the chat test
   suite ("no active mandate — memory is read-only…"). PASS
2. `What is 2+2?` streamed the qwen reasoning **through the dimmed
   thinking pane, delta by delta** (ollama think mode via the
   profile's `ui.think`), then the clean one-sentence answer.
   `[ollama · qwen3.6:27b · 31/244 tok]`. PASS
3. `/remember notes …` → candidate lane → interactive confirm →
   **manda's real elicitation prompt** (untrusted-content framing) →
   approve → `committed under mandate (origin verified
   interactively)`; committed.jsonl carries
   `"origin_verified":true`, `"mandate_id":"m-2026-07-08-notes"`. PASS
4. `/recall notes` surfaced the committed fact (≤3 cap exercised in
   the suite: 5 commits → 3 surfaced + "+2 suppressed"). PASS
5. `/remember drafts …` → propose landed (candidate lane, by manda
   design), commit **REFUSED** with manda's denial verbatim ("no
   active write mandate covers scope 'drafts'…"). PASS
6. `/remember self/commitment/x …` → refused by the agent's own F3
   guard before manda was asked ("commitments are user-only") —
   **constitutional check item 2 evidence**. PASS
7. The run appears in the main-store run log with the stamp:
   `{"caller":"nunc-stans-agent","provider":"ollama",
   "model":"qwen3.6:27b","profile":"agents-live",…}` — readable in
   the Formans /runs view (same API the gate test covers). PASS

## S-10 re-run (T11)

PENDING (pristine Ubuntu container + native Windows, incl. the agent
TTY path and the doctor manda check).

## Constitutional check record (filled through the phase)

1. F3 rejection test output (profile validator, both TS and Rust sides) — PENDING
2. Agent out-of-mandate `memory_commit` refusal transcript — PENDING
3. No goal-verify loop output faces the self scope this phase — statement to be confirmed at close
4. F11 locality: no new remotes, no telemetry — to be confirmed at close

## License section

Hermes/Honcho **not integrated** (PD12) — no license verification
required. If that decision is reversed mid-phase, the full verification
lands here **dated before** any integration commit.

## Screenshot index (`design/ui/phase-d/`)

PENDING (Profiles screen, run-log viewer, FourFive verify toggle + cost
surface).

## Exit criteria checklist (mirrors the plan's nine items)

1. [ ] Profiles created/switched from the UI, defaults take effect without restarts
2. [ ] Verify-on message visibly loops (≤ max_iters), gaps reported, cost visible
3. [ ] Local model via Ollama works under a profile (FourFive chat + agent)
4. [ ] `nunc-stans-agent chat` with mandate-gated memory (in-mandate propose+commit ok, out-of-mandate commit refused)
5. [ ] S-5 / S-6 / S-11 written, executed, passing with evidence here
6. [ ] `contracts/agent-abi.md` v0 Draft, owner-reviewed
7. [ ] FourFive streaming stub + stale model id gone
8. [ ] S-10 re-run passes (Ubuntu + native Windows) with the manda doctor check; 3-OS CI green; screenshots saved
9. [ ] Verification doc complete; v1 plan/naming/reading-order updated; **PENDING owner: push `phase/d`, merge → `dev`, PR gate**
   - [ ] PENDING owner: manda `v0.2.0` tag (flips the doctor hard-pass + setup line)
