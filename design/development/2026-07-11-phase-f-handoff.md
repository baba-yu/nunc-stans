# Phase F handoff — ONE consolidated final phase (owner directive 2026-07-11)

The document to read when opening Phase F. Written at Phase E close
(dev = 6eba55f) on the owner's instruction.

## 0. Owner directives (2026-07-11, in session — these are the rulings)

1. **Everything remaining goes into ONE phase.** The two additional
   lanes discussed at E close — Topics T7 and the app-operation
   delegation note — fold INTO Phase F alongside its original scope
   (SPL prerequisite + journey validation + live gate). v1 ends with
   this phase.
2. **One review, not many.** Owner verbatim: 「レビューの繰り返しばかりで
   いやになってきた」. The next session writes ONE phase-f plan covering
   the five lanes below and gets ONE owner OK — that single approval
   satisfies §7 for the whole phase. Do NOT open per-lane discuss/plan
   cycles; do NOT come back for scope re-confirmation between lanes.
   Normal evidence discipline stays (stories executed, verification doc,
   one-commit-one-area, just check green) — it's the *ceremony* that is
   being cut, not the proof.
3. Standing decision carried from E close: contracts/app-bundle.md +
   agent-abi.md reviews stay OPEN (owner's explicit choice, recorded in
   design/verification/phase-e.md item 6). Do not re-ask.

## 1. The five lanes of Phase F

### F-1 Topics T7 — the authoring story (smallest; do first)
The last task of the ALREADY-APPROVED topics-authoring plan
(design/development/2026-07-08-topics-authoring-plan.md) — no new
approval needed. Author research topics in natural language → the live
llama structures them ({name, intent deep/broad/watch, mandatory,
note}) → merge-review → save → a run honors the intent weights.
Needs a linked writable instance (`just news-init` + `just news-link`).
Evidence → design/verification/topics-authoring.md. Fork rule stands:
never a production ~/news write; topics PUT refuses non-instances.

### F-2 App-operation delegation (from the recorded note, commit 81ac334)
Source: design/development/2026-07-10-app-operation-delegation.md —
the owner's principle: design visibility = human cognitive speed;
OPERATION is delegated to AI; hand-entry in the generated UI is toil.
- **A — FourFive right pane `design | app` toggle**: served bundle →
  an App view (live records + metrics; v0 may embed the served shell,
  same origin).
- **B — chat-operated CRUD**: the app's five verbs in the session chat
  via the EXISTING rails (nunc-ai tool loop PE9, apps-host MCP/REST,
  PE10 skills gating) — 「受注1件入れといて」 works in place. Plus the
  INTERACTIVE opening patrol: on session open the AI sweeps rows +
  metrics and opens with a status question; confirmed answers become
  creates. Decide in the plan: implicit `apps:<own-slug>` grant for the
  design chat vs explicit profile skills (one-rule-everywhere vs
  owner-surface convenience).
- Fold in the shell gaps recorded at T10: no row-edit affordance,
  FK selects not populated.
- **C stays OUT**: unattended/scheduled patrol is F14 / SPL v3+ —
  post-v1, do not smuggle it in.

### F-3 SPL lane — superposition_state + informed_by (the named PE12 prerequisite)
engines/nunc-stans (area `ns`, append-only ledger rules apply): a
superposition record + the `informed_by` edge so a strategy read-out
can be SAVED as grounds for a decision (journey T11's full form; F9
world→self provenance becomes the working loop). Strategy card gains
a save path (dismiss stays default; ephemeral remains the no-action
behavior). This must land before F-4's T11 step and before the live
gate can exercise it.

### F-4 Journey automation — tests/journey/
T0–T18 with checks 1–11 (design/stories/test-spec-journey.md), CI mode
= mock/local provider + temp vault; wire `just journey`; extends S-10.
This is v1's termination test and has NEVER been executed.

### F-5 The live gate — 4 weeks of real calendar time
Real vault entries, the weekly ritual, the five [op] subjective
questions; at week 4 the original question — "did seeing the edges
change a decision at least once?" — answered IN WRITING in
design/verification/phase-f.md. **Start it as early in the phase as
possible** (it is calendar-bound and parallelizes with everything);
F-3's save-path should land early so at least part of the gate runs
with provenance live.

## 2. Sequencing (recommendation, not a gate)

F-1 → open F-5 immediately after → F-2 and F-3 in parallel (disjoint
areas: ff/apps vs ns) → F-4 → close when `just journey` is green in CI
AND the week-4 answer is written. Phase F contains real calendar time
(v1 plan note 9) — the code can finish weeks before the phase can.

## 3. State snapshot (verified at write time — don't re-derive)

- dev = 6eba55f: Phase E closed, exit 9/9 (evidence:
  design/verification/phase-e.md). Suites all green; 3-OS CI 10/10.
- Three execution-found fixes are in: shell declared-type serialization
  (01251e6), INTEGER-pk rowid (c6565c8), llama-leg VRAM backoff
  (a949ca2 — active from the NEXT `just up`; until then a manually
  armed llama-server may be on :8080).
- Served apps on the owner's store: runway-tracker-4@v3,
  plant-care-log@v1, home-library-lending-log@v1, app-1af0ddc5@v2
  (発言記録アプリ, owner-built). S7/S8 rows are archivable working data.
- Owner WIP was in the tree at close (apps shell SideNav adoption,
  index.htmls, nunc-ui SideNav) — expect it as an owner commit; stage
  explicit paths only, never `git add -A`.
- Deferred-by-name (inherited, still out): F14 resident operation,
  schema migrations, cross-app access, app-delete API, multi-user,
  tools+verify composition, openai/google providers.
- Conventions: branch off dev, PR/merge per owner's call; one commit =
  one area (`node tools/commit-scope.ts`; design/ + justfile exempt);
  `just check` green before push; WSL run env (write scripts to /tmp,
  `wsl.exe bash -lc`); WSL can't push https — Windows git can; repo
  git identity yukibaba3912@gmail.com.

## 4. What closing Phase F means

v1 is DONE at F's exit: journey green + the live-gate answer. Anything
after (SPL v3, resident agents, multi-user, delegation lane C) is a
new plan against a shipped v1.
