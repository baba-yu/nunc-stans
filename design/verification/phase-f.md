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

## Lane status

| Lane | Status | Evidence |
|------|--------|----------|
| F-1 Topics T7 | **owner-supervised** (live llama + linked instance) | runbook §F-1 below |
| F-2 App-operation delegation A+B | **partial / owner-supervised** | §F-2 below |
| F-3 superposition_state + informed_by | **DONE (autonomous)** | §F-3 |
| F-4 Journey `just journey` | **DONE (autonomous)** | §F-4 |
| F-5 4-week live gate | **mechanism DONE; clock owner-run** | §F-5 |
| PF11 vocabulary amendment | **drafted (owner ratifies)** | §PF11 |

Baselines on the base (620b6f3): engine `ns` 11, fourfive 75/ suites green,
`just check` ok. Post-Phase-F autonomous work below.

## F-3 — superposition_state + informed_by (DONE) [01f7d40 ns, a3d2ace ff]

The `/strategy` card was ephemeral (its own tooltip: "not saved anywhere").
F-3 gives it a save-path so a read-out becomes **grounds for a decision**
(journey T11's full form; F9 world→self provenance becomes the working loop).

- **F-3a engine (`ns`, 01f7d40):** new self-scope lane
  `POST/GET /self/superposition_state`, file-backed + append-only like every
  lane (`me/superposition_state/<id>.json`). On save the engine draws the
  **canonical `informed_by` edge** to the `artifact_version` it read (and a
  `supersedes` edge when re-authored). `author=ai`; validates that
  `informed_by` names a well-formed artifact. **Engine tests 11 → 17** (5
  superposition validate cases + the generic doc-lane append-only test).
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
- **`run.ts` (`just journey`)** — replays a representative path against a
  **fresh mktemp vault** (git-init, no remote, hard fresh-temp guard), driving
  the **real nunc-stans engine over HTTP** (commitments / outcomes / edges /
  superposition_state — so enforcement is exercised, not a direct-store bypass)
  and injecting mandate/intervention **test data** (journey §4; those lanes are
  SPL v3). **Checks 1–11 held at every one of 10 steps** (T0/T1/T2/T3/T5/T9/
  T10/T11/T13/T14); the T11 superposition save drew the informed_by edge
  end-to-end; the §5 metrics were emitted (provenance mix, divergence at T14).
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
Needs a running llama and a linked writable scratch instance; do NOT run blind
(touches instance data; fork rule stands — never a production `~/news` write,
PUT refuses non-instances 409).

1. `just news-init t7-scratch` → `just news-link t7-scratch`.
2. `just up` (or `just llama`) — confirm the model backend is live.
3. World view → "Research topics": author a topic in NL → "Structure with AI"
   → review the diff → Apply → Save.
4. Run today (World "Run today" or `NS_INSTANCE=t7-scratch node
   engines/nunc-fluens/pipeline/src/cli.ts run`) — confirm the run honors the
   authored intent weights (deep/broad/watch fan-out).
5. Record evidence in `design/verification/topics-authoring.md` (exit item 8);
   CI green.

## F-2 — App-operation delegation A+B (partial / owner-supervised)

Decision **PF7 (grant rule):** the design session gets an **implicit
`apps:<own-slug>` grant** for its OWN app (you already have full UI CRUD on the
app you are designing — an explicit skill adds friction, no security). Cross-app
operation still needs an explicit `apps:<slug>` skill (PE10 unchanged).

Scope tonight vs owner-supervised:
- **Offline-buildable (not yet built — remaining):** the `design ‖ app`
  right-pane toggle (App view embeds the served `/apps/<slug>/` shell
  same-origin behind the gate); the chat tool-surface wiring (the session chat
  offers the app's five verbs via the existing nunc-ai tool loop + apps-host
  MCP under the PF7 grant); the T10 shell gaps (row-edit affordance, FK-select
  population).
- **Owner-supervised:** the live co-use demo (「受注1件入れといて」 creating a
  row through the tool loop) and the interactive opening patrol (needs a served
  app + a live model). **C — unattended patrol stays OUT** (F14/SPL v3+;
  handoff — do not smuggle it in).

F-2 is the one lane not advanced in code tonight (it is UI + live-model heavy);
its design decision (PF7) is settled and its build is scoped above.

## PF11 — vocabulary amendment (drafted; owner ratifies)

`design/development/2026-07-11-phase-f-vocabulary-amendment.md` lays out the
exact ratifiable diffs: constitution §3 (add `superposition_state` node type;
extend the informed_by + dismisses edge-table endpoints), §4 permission row,
`contracts/scope-id.md`, `contracts/glossary.md`. Not applied unilaterally
(the constitution is the owner's; silent revision forbidden). Ratifying it
closes the gap between the engine's `superposition_state` token and the named
vocabulary.

## Exit checklist

1. [x] F-3 superposition_state lane + informed_by edge, unit-proven; strategy
       card saves through it (server-tested). [01f7d40, a3d2ace]
2. [~] F-2 `design ‖ app` toggle + chat CRUD — PF7 decided; build scoped;
       owner-supervised live legs. [§F-2]
3. [x] F-4 `just journey` green (10 steps, checks 1–11); `just journey-verify`
       read-only proven. [6c95973]
4. [ ] F-1 Topics T7 executed live, evidence + CI. [owner-supervised, §F-1]
5. [~] PF11 vocabulary amendment drafted; **owner ratifies**.
6. [x] This verification doc; F-5 procedure documented.
7. [ ] F-5 4-week gate run; the week-4 answer written. [owner clock]
8. [x] `just check` + ns (17) + fourfive (78) suites green; one-commit-one-area.

## Owner gates (the morning one-pass list)

1. Ratify PF1–PF12 (the single §7 OK for the whole phase).
2. Review the deliverables: F-3 (engine + save), F-4 (`just journey`), this doc.
3. Run F-1 Topics T7 together (live llama + linked instance).
4. Demo F-2 co-use live; confirm PF7's grant rule; build the toggle + wiring.
5. Ratify the PF11 vocabulary amendment.
6. Start the F-5 4-week clock; write the week-4 answer.
7. Push/merge `phase/f` per your call (WSL can't push https — Windows git can).
