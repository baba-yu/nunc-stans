# Phase F verification — v1's final phase

Start: 2026-07-11. Branch `phase/f` off `origin/dev` **620b6f3**, tag
`pre-phase-f`. Plan: `design/development/2026-07-11-phase-f-plan.md` (the ONE
plan, handoff-grounded). Handoff: `design/development/2026-07-11-phase-f-handoff.md`.

**Execution posture (owner asleep, standing instruction "proceed without plan
approval; review deliverables directly"):** the offline, unit-testable lanes
were built and verified autonomously tonight; every live-model / real-clock /
UI-click / remote leg is left owner-supervised and marked so. Normal evidence
discipline held (one-commit-one-area, `just check` green, suites green) — only
the review *ceremony* was cut (handoff §0.2).

**Base correction (recorded for honesty):** the first plan draft was cut off a
stale local `dev` (95448db, 29 commits behind origin/dev), where the handoff
doc was absent — leading to a wrong F-2 reconstruction (butler/mandate) and two
throwaway engine modules. Re-rooted onto `620b6f3`; nothing from the stale base
survives. The memory's "dev=620b6f3" was correct; the local checkout was not.

---

## Lane status (updated after the owner's plan OK — 「プランOK。全部終わらせておいて」)

| Lane | Status | Evidence |
|------|--------|----------|
| F-1 Topics T7 | **owner-supervised** (live llama + linked instance) | runbook §F-1 below |
| F-2 App-operation delegation A+B | **CODE-COMPLETE + smoke 13/13** (live-model demo owner-run) | §F-2 |
| F-3 superposition_state + informed_by | **DONE + live-proven in the smoke** | §F-3, §Smoke |
| F-4 Journey `just journey` | **DONE — FULL script, 18 steps** | §F-4 |
| F-5 4-week live gate | **mechanism DONE; clock owner-run** | §F-5 |
| PF11 vocabulary amendment | **APPLIED** (cf3080c; merge = final ratification) | §PF11 |

Baselines on the base (620b6f3): engine `ns` 11, fourfive 75, suites green,
`just check` ok. Full-sweep after all Phase F work: **ns 18 · gate 13+21 ·
nunc-ai 42 · agent 27 · nunc-ui 9 · formans 40 · fourfive 92 · apps-host 14 ·
pipeline 214 — all green**, `just check` green.

## F-3 — superposition_state + informed_by (DONE) [01f7d40 ns, a3d2ace ff]

The `/strategy` card was ephemeral (its own tooltip: "not saved anywhere").
F-3 gives it a save-path so a read-out becomes **grounds for a decision**
(journey T11's full form; F9 world→self provenance becomes the working loop).

- **F-3a engine (`ns`, 01f7d40):** new self-scope lane
  `POST/GET /self/superposition_state`, file-backed + append-only like every
  lane (`me/superposition_state/<id>.json`). On save the engine draws the
  **canonical `informed_by` edge** to the `artifact_version` it read (and a
  `supersedes` edge when re-authored). `author=ai`; validates that
  `informed_by` names a well-formed artifact. **Engine tests 11 → 18**
  (superposition validate cases incl. supersedes-shape, + the generic doc-lane
  append-only test).
- **F-3b FourFive (`ff`, a3d2ace):** a **"Save as grounds"** button on the
  card (dismiss stays default; ephemeral stays the no-action behavior). Save
  POSTs to the ns engine's published API through
  `POST /api/sessions/:id/strategy/save` → `NS_ENGINE_URL` (§13-A published-API
  hop; fourfive never opens the vault). `grounding ⊆ declared` is
  **re-validated server-side against the live served metrics** before
  persisting (defense in depth — the save endpoint is a fresh untrusted entry
  point). **fourfive tests 75 → 78** (forward+derive informed_by ref; refuse
  undeclared before the engine; surface an engine refusal). Typecheck green.
- **Honesty ledger:** `author=ai` is an asserted field, not an authenticated
  identity (no caller auth on the self engine — agent-abi §5 gap 1). The engine
  does not re-verify `grounding ⊆ declared` (no cross-scope metric read); that
  is enforced upstream at generation + re-checked in the save endpoint.
- **Owner-supervised leg:** a live save through the running stack (engine +
  fourfive + apps-host + a served bundle + a model producing a real card).

## F-4 — `just journey` (DONE) [6c95973 tool]

The 19-step journey (`design/stories/test-spec-journey.md`) had **never been
executed**. It is v1's termination test. `tests/journey/` now makes it runnable:

- **`checks.ts`** — the eleven invariants as pure functions (append-only, edge
  shape, close cardinality, authorship-until-P4, locality/F11, provenance mix,
  broken-ref-by-to_label headless form, no stray files, mandate-external=0,
  materiality, two-outcome close). **`checks.selftest.ts`: 27 assertions**, a
  clean snapshot passing all eleven and each targeted violation failing exactly
  its check. Run: `node tests/journey/checks.selftest.ts` → 27 passed.
- **`run.ts` (`just journey`)** — replays the **FULL script, 18 steps**
  (T0–T16 + T18; T17 stays deferred by the spec itself — it needs L2–L3)
  against a **fresh mktemp vault** (git-init, no remote, hard fresh-temp
  guard), driving the **real nunc-stans engine over HTTP** and injecting
  mandate/intervention **test data** (journey §4; those lanes are SPL v3).
  Includes the silence steps (T4/T8 assert the store did NOT move; T12
  asserts no pile-on), all three felt senses (T5/T6/T7), the T9 dismisses
  edge, the T11 save + T16 second-lap supersede, the T15 partial close, and
  **T18's lapse** (0 interventions in [M1 expiry, M1′ effective), asserted
  positively; the card returns under the re-registration). The 5 **[op]
  questions** are canned from `op-answers.json` in CI (real mode asks) and
  echoed in the report; the **§5 metrics** block covers the provenance mix
  (recomputed from edges alone), courage records, post-intervention
  authorship 100%, external/felt divergence, felt-sense coverage, and the
  lapse count. **Checks 1–11 held at every one of 18 steps.**
- **`verify.ts` (`just journey-verify`)** — replays checks 1–11 **read-only**
  against a real vault's git history (`git show`/`git ls-tree` only). Proven
  non-mutating: a two-commit fixture vault's HEAD + working-tree + mode bits
  were byte-identical before/after (`READ-ONLY CONFIRMED`). This is the F-5
  4-week-gate mechanism.
- **Determinism (honesty):** checks are structural / ID-agnostic — UUIDs and
  `vault_commit` dates are recorded (the time-lapse) but never asserted equal
  across runs; check 1 (append-only) compares record content *within* a run.
- **Next increment (documented, not blocking):** the full verbatim T0–T18 with
  the [op] questions from `op-answers.json` and the wavering/despair steps
  (T8/T12/T17). The harness + checks are proven; adding the remaining steps is
  more injected data + engine POSTs of the same shapes.

`just check` green (FD-3.2 no-vault-leak, import scope, edge.schema valid).

## Self-review (adversarial, before handoff)

The F-3/F-4 code was built autonomously, so an adversarial correctness review
was run over the diff before handoff. It found one MAJOR and several MINOR
issues, addressed in [a14951b, 5fc3ca5]:
- **MAJOR (fixed):** `create_superposition` persisted the record + informed_by
  edge before validating the `supersedes` edge → a malformed `supersedes`
  returned 422 after leaving an orphan + wedging the slug. Now validated up
  front (nothing persisted on a bad value).
- **MINOR (fixed):** check 1 now compares outcomes by their raw json (catches a
  note/recorded_at tamper), uses a positional fallback for id-less records;
  check 11 matches the engine's extensible observable shape (no false-fail on a
  future result_type); `mandateStatusAt` fails closed on a NaN timestamp.
- **Noted, out of scope (not fixed):** the engine outcome lane does not cap
  observable count server-side (check 3 catches it — pre-existing lane, not
  F-3); `mandateStatusAt` reads inline `m.events`, not a `mandate_events.jsonl`
  (mandates are SPL v3 / injected-only in Phase F); `/strategy/save` maps an
  engine 4xx to 502 (the error text is surfaced verbatim — a status cosmetic).

**Round 2 (after the F-2 build + full journey; 3 lenses over
035fa02..HEAD):** no blockers; 4 majors + minors, ALL addressed
[98e0a85 ff, c0a270f apps, 3a96359 tool, 561b8a3 contracts]:
- an explicit S-6 **verify toggle was silently dropped** on served-app
  sessions (tools forced verify off) → verify now WINS over ambient tools;
- **bundleResult leaked across sessions** (session B could iframe and operate
  session A's app) → per-session reset;
- a **cleared edit field silently kept its old value** → surfaced in the
  banner;
- **silence steps compared record counts only** (a stray file/event line
  passed) → the file list is compared too;
- plus: T14's rewrite now draws the documented outcome→outcome supersedes
  edge; T18's lapse window derives from the vault's mandates; §5 metrics are
  derived-and-asserted (or labeled narrative); sweep no longer claims a wrong
  'newest' at the 1000-row cap; live-empty patrol doesn't leak 'Mock' framing;
  ids URL-encoded; FK empty-target fallback; NaN guard; the contract's tools
  row says ARRAY; 'intervention' dropped from the dismisses row (undeclared);
  informed_by admits commitment→knowledge (the journey spec's own T6).
- **Left, pre-existing/by-design (named):** scope-id/glossary omit
  dismissal/knowledge (predates F); check 4's commitment-authorship arm is
  vacuous against engine-written commitments (they carry no author field —
  by the engine's own design); saveEdit PATCHes a full snapshot (single-user
  v0); the SSE parser's multi-line data joining (pre-existing, unreachable).

Final after both rounds: ns **18** · ff **92** · apps **14** · journey
self-test **28** · `just journey` **18 steps green** (now with derived §5
assertions + file-level silence checks) · full sweep + `just check` green ·
live smoke **13/13**.

## F-5 — 4-week live gate (mechanism DONE; clock owner-run)

`just journey-verify [vault]` runs the checks read-only over the real vault's
git history — the gate's mechanism, proven above. **Procedure (owner runs):**
use journey chapters 0–1 as the real Sunday ritual for 4 weeks (real vault
entries, the weekly review, the 5 [op] subjective questions), then at week 4
answer **in writing here**: *"did seeing the edges change a decision at least
once?"* (constitution §12 Pre-v1 Phase 1 / handoff §4). Start it as early as
possible — it is calendar-bound and parallelizes with everything; F-3's
save-path is live so at least part of the gate runs with provenance.

> **Week-4 answer (to be written by the owner):** _____

## F-1 — Topics T7 (owner-supervised) — runbook

The last task of the already-approved topics-authoring plan (no new approval).
Needs a running llama and a linked writable scratch instance.

**Why this one lane stayed owner-run even under 「全部終わらせておいて」
(recorded honestly):** executing it autonomously requires `just news-link`,
which rewrites the OWNER's `news_repo` config — his World view would point at
a scratch instance until restored — followed by a 30–60 min GPU pipeline run.
An interruption mid-flight would leave his working state silently mutated;
and the story's own value ("author in NL → review the diff → save") is the
owner's authoring experience, not a headless replay. The entire infrastructure
below it is built and green (topics-authoring T0–T6); this is a ~15-minute
do-together task. Fork rule stands — never a production `~/news` write; PUT
refuses non-instances 409.

1. `just news-init t7-scratch` → `just news-link t7-scratch`.
2. `just up` (or `just llama`) — confirm the model backend is live.
3. World view → "Research topics": author a topic in NL → "Structure with AI"
   → review the diff → Apply → Save.
4. Run today (World "Run today" or `NS_INSTANCE=t7-scratch node
   engines/nunc-fluens/pipeline/src/cli.ts run`) — confirm the run honors the
   authored intent weights (deep/broad/watch fan-out).
5. Record evidence in `design/verification/topics-authoring.md` (exit item 8);
   CI green.

## F-2 — App-operation delegation A+B (CODE-COMPLETE) [0d823dc contracts, c1c1940 ff, 612f1cf ff, 6a72b40 apps]

Decision **PF7 (grant rule, coded):** the design session holds an **implicit
`apps:<own-slug>` grant** for its OWN app (you already have full UI CRUD on the
app you are designing); offer-time filter + call-time recheck, the agent's
prefix-leak rule mirrored (`app` never matches `app-one_…`). Cross-app
operation still needs an explicit `apps:<slug>` skill (PE10 unchanged) and is
NOT offered in the design chat.

Built (the earlier WIP-overlap caution was stale — SideNav had landed as
218a3ce; corrected at approval):

- **Substrate [0d823dc]:** `GET /:slug/api/tools` — the frozen mcp-tools.json
  verbatim over the published REST API (the same list `/mcp` serves).
  `tools` AND `status` join the reserved entity names (status was an
  unrecorded pre-existing static route). Contract §2/§6 + producer rail +
  host route + test (apps-host 13→14).
- **B server [c1c1940]:** both message routes branch to
  `FourfiveLlm.chatWithTools` (nunc-ai bounded loop; non-streamed v0, the
  agent precedent; verify forced OFF per PE9; capability-refusal falls back
  to plain chat). Execution calls the same REST routes the human UI and MCP
  use — one write path; refusals surface verbatim as tool results. SSE gains
  an additive `tool` event. **Interactive opening patrol**:
  `POST /api/sessions/:id/patrol` — the sweep is DETERMINISTIC server code
  over the published API; the model only phrases ≤3 sentences + ONE status
  question (check-10 discipline: no commands, no invented numbers); ephemeral
  like the strategy card; the mock profile short-circuits to a canned patrol
  phrased from the real sweep. `GET /api/sessions/:id/app-status` probes
  served-ness. ff 78→92.
- **A + UI [612f1cf]:** the right pane's `design ‖ app` segmented toggle;
  App view embeds the served shell at `/apps/<slug>/` (origin-absolute — the
  SPA lives under `/fourfive/`); served-ness probed in the background on
  session open, or known immediately after Generate bundle. PatrolCard at the
  chat tail (dismiss = gone; answering rides the tool-enabled chat). `tool`
  SSE events render as dimmed lines in the existing thinking pane.
- **Shell gaps [6a72b40]:** row **edit** (PATCH; the T10 gap — the verb
  existed server-side but was unreachable) with the same declared-type
  coercion as create (one `coerce()` rule); **FK selects** sourced from the
  target entity's already-loaded rows (pick a row, post the pk), winning over
  static mock-ui options on fk columns. apps-host 14 green.
- **C stays OUT** (unattended/scheduled patrol — F14/SPL v3; handoff).

**Owner-run:** the live-model co-use demo (「受注1件入れといて」 with the 35B)
and patrol phrasing quality — the mechanics are smoke-proven below.

## Live smoke — the F-2/F-3 loop over HTTP (13/13 PASS)

Scratch stores only (the strategy-card smoke precedent): real fourfive server
(mock profile), real ns engine on a scratch git vault, fake apps-host serving
invoice-app@v1. Proven end-to-end over HTTP:

1. mock blueprint autosave births the session's app → **app-status
   served=true**;
2. **patrol** returns the sweep + one question, and saw the empty invoices
   table;
3. a **tool-enabled turn** (tools offered) answers cleanly;
4. **/strategy** produces the grounded mock card;
5. **strategy/save** persists `self/superposition_state/<id>` in the vault,
   the engine **draws the informed_by edge** to
   `artifact/artifact_version/invoice-app@v1`, and the vault git history gains
   the `ns: superposition_saved` audit commit — **journey T11's full form,
   live through the product surfaces.**

## PF11 — vocabulary amendment (APPLIED after the plan OK) [cf3080c]

Applied exactly as drafted in
`design/development/2026-07-11-phase-f-vocabulary-amendment.md` after the
owner's in-session plan OK + 「全部終わらせておいて」: constitution §3
(`superposition_state` node type; informed_by row admits `superposition_state
→ artifact_version`, matching the prose; dismisses row admits intervention/
superposition_state), §4 permission row (AI-only, user dismisses),
`contracts/scope-id.md`, `contracts/glossary.md`. The branch merge remains the
final ratification point — one revert if the owner disagrees.

## Exit checklist

1. [x] F-3 superposition_state lane + informed_by edge, unit-proven; strategy
       card saves through it; **live-proven in the smoke** (13/13).
       [01f7d40, a3d2ace, §Smoke]
2. [x] F-2 `design ‖ app` toggle + chat CRUD + patrol + shell gaps —
       CODE-COMPLETE, smoke-proven; the live-model co-use demo is the one
       owner-run leg. [0d823dc, c1c1940, 612f1cf, 6a72b40]
3. [x] F-4 `just journey` green — **FULL script, 18 steps**, checks 1–11 at
       every step, [op] + §5 metrics; `just journey-verify` read-only proven.
       [6c95973, 6dd4d13, a304410]
4. [ ] F-1 Topics T7 executed live, evidence + CI. [owner-supervised, §F-1]
5. [x] PF11 vocabulary amendment APPLIED; branch merge = final ratification.
       [cf3080c]
6. [x] This verification doc; F-5 procedure documented.
7. [ ] F-5 4-week gate run; the week-4 answer written. [owner clock]
8. [x] Full-sweep green (ns 18 · gate 34 · ai 42 · agent 27 · ui 9 ·
       formans 40 · ff 92 · apps 14 · pipeline 214) + `just check`;
       one-commit-one-area; TWO adversarial review rounds run, findings
       addressed (round 2 in progress at write time — outcome recorded below
       when it lands).

## Owner gates (the morning one-pass list)

1. Ratify PF1–PF12 (the single §7 OK for the whole phase).
2. Review the deliverables: F-3 (engine + save), F-4 (`just journey`), this doc.
3. Run F-1 Topics T7 together (live llama + linked instance).
4. Demo F-2 co-use live; confirm PF7's grant rule; build the toggle + wiring.
5. Ratify the PF11 vocabulary amendment.
6. Start the F-5 4-week clock; write the week-4 answer.
7. Push/merge `phase/f` per your call (WSL can't push https — Windows git can).
