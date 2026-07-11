# Phase F vocabulary amendment — `superposition_state` (owner ratifies)

**Status: APPLIED 2026-07-11 after the owner's in-session plan OK (「プラン
OK」 + 「全部終わらせておいて」 — the handoff §0.2 single approval covers the
phase; the diffs below are exactly what was applied, and the branch merge
remains the final ratification point). Originally drafted as a PROPOSAL:**

**Original: PROPOSAL for owner ratification (PF11). Phase F's F-3 lane lands
records of a new self-scope node type, `superposition_state`, and draws an
`informed_by` edge whose endpoints the constitution's §3 edge-table does not
yet name. Per §11 ("adding a new word is a deliberate commit") and the
constitution's own ethos (silent revision forbidden), these edits are NOT
applied unilaterally — they are laid out here as exact diffs for the owner to
ratify and commit. The engine already uses the `superposition_state` token
(engines/nunc-stans, F-3a), so this closes the gap between the code and the
named vocabulary.**

The plan-review found the gap: `self/superposition_state/*` is absent from
constitution §3 (node types), the §4 permission table, `contracts/scope-id.md`,
and `contracts/glossary.md`; and the `superposition_state → artifact_version`
`informed_by` edge falls outside §3's edge-table row (`commitment/prediction →
observation/prediction`) — the §3 *prose* blesses it, the table does not.

---

## 1. `design/constitution/constitution.md` §3 — node types

**Before:**
> Node types: observation / prediction / outcome / revision / dismissal /
> mandate / artifact_version + **commitment** + **knowledge** (notes and the
> like born from a commitment)

**After (add `superposition_state`):**
> Node types: observation / prediction / outcome / revision / dismissal /
> mandate / artifact_version + **commitment** + **knowledge** (notes and the
> like born from a commitment) + **superposition_state** (the AI's
> transparent, versioned understanding of the user's strategy; §3 "Where the
> AI's understanding of strategy is placed")

## 2. §3 — edge-type table (informed_by, dismisses endpoints)

**Before (informed_by row):**
> | informed_by | commitment / prediction → observation / prediction | What prompted this bet / prediction |

**After (admit the strategy-grounds form):**
> | informed_by | commitment / prediction → observation / prediction; **superposition_state → artifact_version** | What prompted this bet / prediction; or the app a strategy understanding reads |

**Before (dismisses row):**
> | dismisses | user → AI's prediction or edge | self scope only |

**After (admit the new AI-authored records):**
> | dismisses | user → AI's prediction, edge, **intervention, or superposition_state** | self scope only |

*(Rationale: prd-override §1.5 and journey T11 already require the
`superposition_state → artifact_version` informed_by edge — a cross-scope FK
cannot be drawn, so the edge carries the target id as text + a to_label, the
same treatment every edge gets. The §3 prose already sanctions it; this makes
the table agree. `intervention` is named in the dismisses row for the journey's
T9/T11 dismissals even though the intervention lane itself is SPL v3 — it keeps
the vocabulary honest for the injected journey test-data.)*

## 3. §4 — permission table (new row)

**Add after the "Write an edge" / "Delete" rows:**
> | Write a superposition_state | — | AI only (transparent, versioned; user reads and dismisses, never authors) | — |

## 4. `contracts/scope-id.md` — self types

**Before:**
> - `self`: self-prediction, commitment, outcome, revision, mandate, and edge owned by Nunc Stans; user-authored world predictions are stored in self with scope=world

**After:**
> - `self`: self-prediction, commitment, outcome, revision, mandate, superposition_state, and edge owned by Nunc Stans; user-authored world predictions are stored in self with scope=world

**And add to the examples block:**
> ```text
> self/superposition_state/<uuid>
> ```

## 5. `contracts/glossary.md` — new entry + self update

**Update the `## self` entry (line 9) to include superposition_state** (mirror §4).

**Add a new entry:**
> ## superposition_state
>
> The AI's transparent, versioned understanding of the user's strategy
> (constitution §3). Authored by the AI, readable and dismissable by the user,
> never user-authored. Holds an `informed_by` edge to the `artifact_version`
> whose declared metrics ground it (the FourFive strategy read-out saved as
> grounds — journey T11). Reuses SPL's existing `superposition_state`; no new
> location is created (prd-override §1.5).

---

## 6. What is NOT amended here (deliberate)

- **`intervention` / `mandate` as engine-built lanes** — the butler/mandate
  machinery is SPL v3 (handoff §3, plan Non-goals). The journey injects them as
  test data; the `dismisses`-row mention (§2) is only so a journey dismissal of
  an injected intervention is contractually expressible. No permission-table
  row or engine lane for intervention lands in Phase F.
- **F15** (mandate-external interventions = 0) — stays a proposed rule; the
  journey's check 9 enforces "names a mandate active at the intervention's
  timestamp" over injected data, not an engine gate. Do not ratify F15 as
  "mechanical" (plan honesty ledger; no caller auth on the self engine).

## 7. Owner action

Apply §§1–5 as one `contracts`-area commit (constitution + scope-id + glossary;
`design/` and contracts are exempt from the one-area rule, but keeping the
vocabulary change atomic is cleaner). Ratifying this satisfies the PF11 gate.
