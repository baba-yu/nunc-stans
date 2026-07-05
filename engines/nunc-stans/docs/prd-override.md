# NuncStans (formerly SPL) PRD override v1.1
Target: SPL v2-final spec + v3 plan
Basis: Federation Constitution v0.3.1. When the constitution is revised, review this document too.
Nature: not a request document from the federation, but a diff reflecting the constitution into this engine's own plan. Additional requests go only through contracts/ (Constitution §13).
v1.1: changed how a commitment is closed from inventing new fields to reusing SPL's outcome. Made the wording plainer.
Location: engines/nuncstans/docs/prd-override.md

---

## 0. Positioning

NuncStans holds the source of truth (canonical record) for edges (Constitution §10-A) and the source of truth for mandates (F14), so it is the heaviest of the three overrides. SPL v2's internal rules (Inv 1–20, two-peer, butler/mandate, opacity design) are not changed.

---

## 1. What to do (constitutional obligations)

### 1.1 Add the commitment type [for now: NuncStans:Phase 1 files / permanently: v3 DB]
- Only the user can write it (F3). AI proposals use v2's proposal mechanism as-is (multiple / discardable / not the source of truth. An extension of Inv 10)
- Not a subject of right/wrong judgment. Its connection to a prediction is expressed by a serves edge
- **The closing reuses SPL's outcome**: close means appending two outcomes.
  - External form (component=observable): result is SPL's result_type vocabulary (confirmed / contradicted / partially_confirmed / became_irrelevant / still_open [non-terminal: a status, not a result] / refused_to_judge, etc. — vocabulary is extensible; not a fixed enum yet)
  - Felt sense (component=subjective): result ∈ { happy / unhappy / unchanged } (refused_to_judge is also allowed)
  - A rewrite of the felt sense is by appending (supersedes). The original record is not erased (Inv 1)
- Fields: id / title / started_at / resources{money_jpy, hours} / note
- Add commitment_authored / commitment_closed to ledger_event.event_type

### 1.2 Manage the source of truth for edges [NuncStans:Phase 1: jsonl / NuncStans:Phase 2: API / v3: DB]
- Edges are append-only / author record required / to_label required / no deletion (F2). Cancellation is by a dismisses edge
- F2 applies to the interim form (edges.jsonl) too: only adding lines. Editing existing lines is forbidden. The git history of the self data store (git init with no remote) is the interim audit record
- v3 DB: author is derived from current_user (the same construction as v2's `_derive_peer()`. Inv 5). from/to are federation IDs (text). FKs cannot be drawn to other scopes, so to_label stands in
- Cancellation is unified into a dismisses edge (a generalization of v2's prediction_dismissal. The existing table remains)
- v3: edge writes are also connected to ledger_event (event_type=edge_appended)

### 1.3 Keep mandate generic [a design constraint of v3]
- In Federation:Phase 5, mandate is also used for registration of resident programs (F14). In v3, do not build it out for butler only
- Keep `_assert_mandate_active()` in a form reusable as the scheduler's launch check
- Do not decide the content of registration until the agent-abi drafting (after FourFive's prototype) (§13-D)

### 1.4 Placement and operation [NuncStans:Phase 0–]
- The source of truth is `~/federation-data/self/`. remote forbidden (F11). Not a hidden folder (Inv 20)
- At the v3 migration, an importer that ingests the interim files (me/*.json + edges.jsonl) keeping their order and dates is mandatory
- NuncStans:Phase 2 API: read/write of commitments and edges. Append-only verification at the API layer (until DB trigger-ization)

### 1.5 Where the AI's understanding of strategy is placed [at the same time as the L1 implementation]
- Do not create a new location. Reuse v2's existing superposition_state (transparent / versioned / dismissable)
- The understanding's record holds an informed_by edge to the underlying app (FKs cannot be drawn to other scopes, so federation ID as text + to_label. Same treatment as edges)
- Do not include a metric the app does not measure, neither in the understanding nor as grounds for a proposal (consistent with journey check 10)
- Updates by supersedes. Updated by citing the close content (especially the felt sense) (evidence the loop is turning)

---

## 2. v2 open issues resolved by the constitution

- §19 "where to place world predictions" → resolved: world predictions made by the user go in self + scope='world' (existing column). The AI's world predictions go in world (News). Joining only at read time (F5)
- Extending the treasure-box concept to the federation → implemented as §10-C (the screen's intervention limits) and F9 (the provenance mix). The treasure-box spec inside SPL is unchanged

---

## 3. What need not be done

- two-peer / butler・intervention / superposition / opacity design: no change
- Internal adoption of the federation ID format: unneeded (internally it stays UUID. The prefix is added at the boundary = F1)
- Ingesting / retaining world's data: unneeded (the edge's to_label suffices)
- Starting work on v3: no obligation until the 4-week NuncStans:Phase 1 verdict is Yes
