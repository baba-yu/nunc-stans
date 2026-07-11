# Phase F Implementation Plan — v1's final phase (the ONE plan, five lanes)

**Status: DRAFT for the single owner OK (handoff §0.2 — one approval
satisfies §7 for the whole phase). Written autonomously 2026-07-11 while
the owner sleeps, on the standing instruction "proceed without plan
approval; I'll review the deliverables directly." Grounded in
`design/development/2026-07-11-phase-f-handoff.md` (dev = 620b6f3), not
reconstructed. Owner reviews this plan AND the executed deliverables in
one pass; no per-lane review loop (handoff §0.2).**

Base: `phase/f` off `origin/dev` **620b6f3**, tag `pre-phase-f`. (A first
draft was mistakenly cut off a stale local `dev` at 95448db, 29 commits
behind — re-rooted; noted here for honesty, nothing from the stale base
survives.)

---

## 0. The five lanes (from the handoff — this plan does not re-scope them)

| Lane | What | Area | Tonight (autonomous) | Owner-supervised |
|------|------|------|-----------|------------------|
| **F-1** | Topics T7 authoring story | nf/gate/fe (built) | runbook only | live run (llama + linked instance) |
| **F-2** | App-operation delegation A+B (C out) | ff/apps/fe | design‖app toggle + CRUD tool-surface wiring + grant decision | the live co-use + interactive patrol (needs a served app + live model) |
| **F-3** | superposition_state + informed_by (strategy save-path) | **ns** + ff | **engine lane (full, tested) + strategy save wiring** | live save through the running stack |
| **F-4** | Journey automation `just journey` (T0–T18, checks 1–11) | tests/tools | **full runner, CI mode (mock/temp vault)** | — |
| **F-5** | 4-week live gate (real calendar) | design/tools | `just journey:verify` mechanism + procedure doc | the 4-week clock + the week-4 written answer |

v1 is DONE at F's exit: `just journey` green in CI **and** the week-4
answer written (handoff §4). The code can finish weeks before the phase
can (F-5 is calendar-bound).

---

## 1. Decisions (PF1–PF12) — proposed; owner ratifies in the one-pass review

| # | Decision | Choice |
|---|----------|--------|
| PF1 | Base & gate | `phase/f` off `620b6f3`, tag `pre-phase-f`. Local commits only; **push/merge/ratify are owner gates**. One commit = one area (`node tools/commit-scope.ts`; design/ + justfile exempt); `just check` + suites green before any push. |
| PF2 | F-3 storage | New self-scope lane in the ns engine, **file-backed** like commitment/outcome/edge: `me/superposition_state/<id>.json` (create_new, append-only). No Postgres/triggers (SPL v3). The spl-plan DDL is the semantic reference only. |
| PF3 | F-3 node type & author | Node type token **`superposition_state`** (matches constitution §3 / glossary; not the bare "superposition"). `author = ai` (the AI's transparent understanding; the user's authority is to READ and DISMISS — permission table). Versioned via `supersedes`; dismissable via a `dismisses` edge. |
| PF4 | F-3 informed_by edge | On create, the engine draws **one `informed_by` edge**: `from = self/superposition_state/<id>` → `to = artifact/artifact_version/<slug>@v<N>`, `author = ai`, `to_label` = `<slug>@v<N>` (degradable display, F1/§10-A). The **edge is the source of truth** for the link (§10-A); the record also carries the target for convenience but the edge is canonical. **Contract gap (PF11):** this edge's endpoints fall outside the §3 edge-table's `informed_by` row (commitment/prediction → observation/prediction) — the §3 *prose* blesses it; the table must be amended. |
| PF5 | F-3 grounding enforcement | `grounding ⊆ declared metrics` is enforced where the declared list is known: **fourfive's `parseStrategyCard`** (already does this, refusing undeclared — strategy.ts). The engine stores `grounding[]` for audit and validates only that `informed_by` is a well-formed `artifact/*` id. **Honesty ledger:** the engine does NOT re-verify grounding⊆declared (it has no cross-scope metric read). Journey F-4 asserts it against a seeded metric fixture (a runner check), not the engine. |
| PF6 | F-3 save wiring | The `/strategy` card gains a **"Save as grounds"** action (dismiss stays the default; ephemeral stays the no-action behavior — handoff). Save POSTs the card + `slug@vN` to the ns engine's published API through a fourfive server endpoint (`POST /api/sessions/:id/strategy/save` → `NS_ENGINE_URL` default `127.0.0.1:8721`), a published-API→published-API hop (§13-A legal, mirrors the existing apps-host calls). Server-side unit-tested with a fake engine (the strategy.test.ts pattern). |
| PF7 | F-2 grant rule | **Implicit `apps:<own-slug>` grant for the design session's OWN app** (the handoff's open question, decided): a FourFive design session already owns its app; requiring an explicit profile skill to operate the app you are designing is friction with no security gain (the human already has full UI CRUD on it). Cross-app operation still needs an explicit `apps:<slug>` skill (PE10 unchanged). Recorded as the one-rule exception, reasoned. |
| PF8 | F-2 scope tonight | Build the offline-safe parts: the **`design ‖ app` right-pane toggle** (App view embeds the served shell same-origin behind the gate) and the **chat tool-surface wiring** (the session chat offers the app's five verbs via the existing nunc-ai tool loop + apps-host MCP, PF7 grant). The **interactive opening patrol** and the live co-use demo are owner-supervised (need a served app + live model). Shell gaps (no row-edit affordance, FK selects unpopulated) folded into the App view where cheap. **C (unattended patrol) stays OUT** (handoff — do not smuggle it in). |
| PF9 | F-4 runner | `just journey` (CI) drives the **HTTP API** of a freshly-built engine (mandate/intervention steps inject test-data records per journey §4 — those lanes are v3, NOT built here), git-snapshots a **fresh mktemp vault** after each step, and asserts checks 1–11 as pure functions over the snapshot. `just journey:verify` runs the checks **read-only against a real vault via `git show`/`git log` only** — it never constructs a SelfStore or launches the engine on the real vault (SelfStore::open mutates: create_dir_all + chmod). Checks are **structural/ID-agnostic** (no byte or commit-SHA assertions — UUIDs and vault_commit dates are non-deterministic and are not asserted). |
| PF10 | F-4 check-11 & metrics | **check 11 = two-outcome close, enforced by the EXISTING outcome lane** (not the new F-3 lane — a review correction). The runner also emits the journey §5 metrics (TTFUV, courage count, post-intervention authorship %, external/felt divergence) alongside checks 1–11, so the gate evidences the real success criteria. The 5 `[op]` answers are canned from `tests/journey/op-answers.json` in CI, asked in real mode. |
| PF11 | Vocabulary amendment (owner-gated) | A **contracts/design commit** amends: constitution §3 (add `superposition_state` node type; extend the `informed_by` edge-row endpoints to admit `superposition_state → artifact_version`; extend `dismisses` targets to include superposition_state), the §4 permission-table row (superposition_state: author=ai, user-dismissable), `contracts/scope-id.md` (self types list), and `contracts/glossary.md`. **Drafted here; the owner ratifies** (constitution changes are the owner's, §9). This is the third contract touchpoint the review surfaced; without it the phase would land records of a type the constitution does not name. |
| PF12 | F-5 mechanism vs clock | `just journey:verify` (PF9) is the 4-week mechanism. The procedure = journey chapters 0–1 as the real Sunday ritual + the 5 [op] questions. **Phase F delivers the mechanism + the procedure doc + a save-path-live F-3 so provenance is exercisable; the owner runs the 4-week clock and writes the week-4 answer** in `design/verification/phase-f.md` (handoff §4 — "did seeing the edges change a decision at least once?"). |

Derived / honesty ledger (carried from the plan review, still applicable to F-3/F-4):

- **No caller auth on the self engine** (agent-abi §5 gap 1): `author=ai`
  on a superposition is an asserted field, not an authenticated identity.
  A save wiring that posts `author=ai` is honest labeling, not a guard.
  Unchanged v0 limitation; stated, not overclaimed.
- **Journey determinism**: checks are structural; commit identity and
  UUIDs are recorded (the time-lapse) but never asserted equal across
  runs. check 1 (append-only) is verified *within* a run (snapshot N-1 ⊆
  snapshot N), which needs no id stability.
- **F5 (no persisted cross-scope join)**: the superposition's stored
  `grounding[]`/read-out strings are a point-in-time **audit snapshot** of
  surfaced content (like `to_label`), not a live relational join; the live
  value join still happens only at read time. No artifact record is
  mirrored wholesale into self.

---

## 2. Tasks

Sequencing (handoff §2): F-1 → open F-5 → F-2 ‖ F-3 → F-4 → close.
Tonight's autonomous order is dependency-first: F-3 engine (F-4 T11 needs
it) → F-4 runner → F-2 offline parts → contracts + verification.

### Task F3a — superposition_state engine lane (ns)
- [ ] `superposition.rs`: type {id, win, constraint, risk_to_watch,
      grounding[], informed_by, informed_by_label, author=ai, created_at,
      supersedes?, cites_close?, note?}; validate (author=ai, non-empty
      readout, grounding non-empty, informed_by is `artifact/*`).
- [ ] store generic helpers (`create_doc`/`list_docs`/`read_doc`) —
      additive, leave existing methods untouched.
- [ ] api: `POST/GET /self/superposition_state`; on POST draw the
      `informed_by` edge (+ a `supersedes` edge when versioning); vault
      audit commit. Unit tests: informed_by drawn, versioning, bad target
      refused, author guard, dismissable (via the existing edge lane).

### Task F3b — strategy card save-path (ff)
- [ ] `POST /api/sessions/:id/strategy/save` → forwards the card +
      `slug@vN` to `NS_ENGINE_URL` `/self/superposition_state`; server
      unit test with a fake engine (fake fetch, strategy.test.ts pattern).
- [ ] StrategyCard.vue: a "Save as grounds" button (dismiss stays
      default); on save, chips show a saved state; tooltip text updated
      from "not saved anywhere" to the honest save affordance.

### Task F2 — app-operation delegation A+B (ff/apps/fe, offline parts)
- [ ] `design ‖ app` toggle in the FourFive right pane; App view embeds
      the served app shell (`/apps/<slug>/`) same-origin behind the gate
      when a served bundle exists; honest empty-state otherwise.
- [ ] Chat tool-surface wiring: the design session offers the app's five
      verbs via the nunc-ai tool loop (PF7 implicit `apps:<own-slug>`
      grant); the interactive patrol prompt scaffold (owner runs it live).
- [ ] Fold the T10 shell gaps into the App view where cheap (row-edit
      affordance; FK select population).

### Task F4 — journey runner (tests/tools/justfile)
- [ ] `tests/journey/checks.ts`: checks 1–11 as pure functions over a
      vault snapshot (append-only within-run, edge shape, close
      cardinality, author until P4, no-remote, provenance-mix recompute,
      broken-ref-by-to_label headless form, no stray files,
      intervention→mandate reference, materiality shape, two-outcome
      close). Plus the §5 metrics pass.
- [ ] `tests/journey/script.ts`: T0–T18 driving the engine over HTTP
      (commitments/edges/outcomes/superposition_state) and injecting
      mandate/intervention **test-data** records (journey §4); snapshot +
      checks after each step; `[op]` from `op-answers.json`.
- [ ] `just journey` (CI, fresh mktemp vault, hard fresh-temp guard) +
      `just journey:verify` (read-only git-history reader).

### Task F1 — Topics T7 runbook (design) — owner-supervised live run
- [ ] Runbook in `design/verification/topics-authoring.md` for the live
      authoring story (running llama + `just news-init`/`news-link`
      scratch instance). Executed with the owner; fork rule stands.

### Task PF11 — contract/vocabulary amendment drafts (contracts/design) — owner-gated
- [ ] Draft the constitution §3/§4 + scope-id.md + glossary amendments
      for `superposition_state` and the informed_by/dismisses endpoint
      extensions. Owner ratifies.

### Task F5 — live-gate procedure + verification doc (design)
- [ ] `design/verification/phase-f.md`: header, baselines, evidence per
      lane, checks-1–11 output, the T11 informed_by proof, the journey
      run, the F-5 procedure + the week-4 written-answer placeholder,
      owner-gate list.

## 3. Exit criteria (phase closes when all hold)

1. F-3: superposition_state lane (author=ai, versioned, dismissable,
   draws informed_by → artifact_version) unit-proven; the strategy card
   saves through it (server-tested). [F3a, F3b]
2. F-2: `design ‖ app` toggle + chat CRUD tool-surface on existing rails
   (PF7 grant); interactive co-use demonstrated with the owner. [F2]
3. F-4: `just journey` replays T0–T18 green with checks 1–11 + §5 metrics;
   `just journey:verify` reads a real vault read-only. [F4]
4. F-1: Topics T7 authoring story executed live, evidence + CI. [F1]
5. Vocabulary amendment drafted (constitution §3/§4, scope-id, glossary);
   owner-ratified. [PF11]
6. `design/verification/phase-f.md` complete; F-5 procedure documented.
7. F-5: the 4-week gate run; the week-4 answer written. [owner clock]
8. Standing: `just check` + all suites green; one-commit-one-area held.

## 4. Non-goals (deliberate — handoff §3/§4)

- **C — unattended/scheduled patrol** (F14 / SPL v3+). A/B must not
  smuggle it in; only the in-session opening sweep is v0.
- **The full butler/mandate engine** (suspension/budget/quiet-hours/
  cooling-off, Inv 21–23) — SPL v3; the journey injects mandate/
  intervention as test data (journey §4), not engine-enforced.
- **SPL v3 Postgres/triggers/crypto-shred/roles**, sensor pipeline,
  schema migrations, cross-app access, app-delete, multi-user,
  tools+verify composition, openai/google providers — all inherited
  deferrals, still out.
- **The 4-week wait itself** — Phase F delivers the mechanism; the clock
  is the owner's (F-5).
- **New self-engine auth** — agent-abi §5 gap 1 stays; loopback + Host
  guard + single-writer are the v0 rails.

## 5. Risks

1. **F-3 cross-engine hop** (fourfive → ns engine). Kept to published-API
   only (PF6/§13-A); server-side, fake-engine tested; the frontend never
   reaches an engine's internals.
2. **Journey is a broad harness.** Mitigated: checks 1–11 as pure
   functions first (isolated tests), steps drive the HTTP API the lanes
   already unit-test, mandate/intervention are injected test data.
3. **journey:verify touching the real vault.** Mitigated: pure
   git-history reader; a test proves it leaves the real vault's tree +
   mode bits untouched (PF9).
4. **Overnight autonomous volume.** Mitigated by the split (§0 table):
   only offline, tested, additive work is built blind; every live-model /
   real-clock / UI-click / remote leg is owner-supervised.
5. **Scope reconstruction risk is now LOW** — grounded in the real
   handoff (620b6f3), not memory.

## 6. Owner action items (the morning one-pass list)

1. **Ratify PF1–PF12** (or amend) — the single §7 OK for the whole phase.
2. **Review the executed deliverables**: F-3 engine + strategy save, F-4
   `just journey`, F-2 toggle + wiring, `design/verification/phase-f.md`.
3. **Run F-1 Topics T7 with me** (live llama + linked instance).
4. **Demo F-2 co-use** live (served app + model); confirm PF7's grant rule.
5. **Ratify the PF11 vocabulary amendment** (constitution §3/§4, scope-id,
   glossary).
6. **Start the F-5 4-week clock** and write the week-4 answer when it
   lands; the `journey:verify` mechanism is ready.
7. **Push/merge** `phase/f` per your call.
