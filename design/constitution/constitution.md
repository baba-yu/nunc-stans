# Nunc Stans Constitution v0.3.1 — world / self / artifact
The agreements and implementation plan for connecting the three systems News / Nunc Stans / FourFive.
v0.3.1: Content is the same as v0.3. The wording was made plainer and coined terms were removed.
Status: Pre-v1 Phase 0 ready to start

---

## 0. What this is / what it is not

This is not a plan to dissolve the three systems into one. The only things shared are vocabulary, IDs, edges, the permission table, and contracts (contracts/). Each system's internal rules (SPL v2's Inv 1–20, News's "the DB is a rebuildable cache" approach, FourFive's version-freezing rule) remain in force as-is. What this document decides is only the behavior at the boundaries between systems.

Out of scope: a unified DB / joined persistent storage / automatic edge generation (until Pre-v1 Phase 4) / an intervention feature toward News / preemptive changes to SPL's DB design / references to engine-internal design (§13).

---

## 1. Scopes (the three domains)

| scope | System | Nature | Decision authority |
|---|---|---|---|
| world | News | World prediction and verification. The AI writes, the AI scores. The DB may be a rebuildable cache | none (which is why AI self-scoring is permitted) |
| self | Nunc Stans (formerly SPL) | Personal prediction / outcome / revision + commitment. Append-only, AI self-scoring forbidden | user |
| artifact | FourFive | What was made. Frozen by version | user (the AI is a co-author) |

New type: **commitment** = a record of action. "Which prediction, what, and how much was wagered." Belongs to the self scope. It is not a prediction (not a subject of right/wrong judgment).

Note: world predictions that the user themselves makes go in self (SPL's prediction.scope='world' column already exists). News's AI world predictions go in world.

---

## 2. ID

scope ID = `<scope>/<type>/<original-id>`

- The original ID uses each system's own ID as-is. Do not rename. Only add the prefix.
- Examples: `world/prediction/prediction.3f9a…` / `self/commitment/2025-08-gpu-server`
- Retroactive past registrations may use any free-form string. It only needs to be stable; it does not yet need to resolve as a reference.

---

## 3. Vocabulary

Node types: observation / prediction / outcome / revision / dismissal / mandate / artifact_version + **commitment** + **knowledge** (notes and the like born from a commitment)

Edge types:

| type | from → to | Meaning |
|---|---|---|
| informed_by | commitment / prediction → observation / prediction | What prompted this bet / prediction |
| serves | commitment → prediction (either world / self) | Which prediction this action wagered on |
| produced | commitment → artifact_version / knowledge | What was produced |
| closes | outcome → prediction / commitment | Existing |
| supersedes | between nodes of the same type | Existing (revision linkage) |
| dismisses | user → AI's prediction or edge | self scope only |

Edge record: `{ id, type, from, to, to_label(required), from_label(optional), author: user|ai|sensor, created_at, note(optional) }`

**Why to_label is required**: News IDs are content hashes, so when the summary text changes the ID breaks. If a human-readable label is left on the edge, the record can still be read after the ID breaks. The screen displays by label when ID resolution fails (§10-A).

**How to close a commitment (schema is linked to SPL)**: closing a commitment = appending two outcomes.
- 1st, component=observable (external form): result uses SPL's result_type vocabulary as-is (confirmed / contradicted / partially_confirmed / became_irrelevant / still_open [non-terminal: a status, not a result] / refused_to_judge, etc. — vocabulary is extensible; not a fixed enum yet)
- 2nd, component=subjective (felt sense): result ∈ { happy / unhappy / unchanged } (refused_to_judge is also allowed. An existing SPL term)
- The felt sense can be rewritten later. But the rewrite is done by appending (supersedes), and the original record is not erased.
- A closing in which external form and felt sense diverge (lost but it was good, won but it was bad) happens routinely. That divergence is important information.

**Where the AI's understanding of strategy is placed**: how the AI understands the user's strategy is recorded in SPL's superposition_state (transparent / versioned / readable by user / dismissable by user), and an informed_by edge is drawn to the underlying app (artifact_version). Metrics the app does not measure are not used as grounds for understanding or proposals. No hidden understanding is held.

---

## 4. Permission table

| Operation | world (News) | self (Nunc Stans) | artifact (FourFive) |
|---|---|---|---|
| Write an observation | AI (daily ingest) | sensor / user | — |
| Write a prediction | AI | user's predictions by user only / AI's predictions by AI only | — |
| Close a prediction | AI self-scoring permitted. But the method must be published and verifiable | user's predictions by user only. AI's predictions: external form=sensor, felt sense=user | — |
| Write a commitment | not allowed (no decision authority) | user only. AI may only propose | — |
| Close a commitment | — | user only | — |
| Cut a version | — | — | made by user+AI. A cut version is immutable |
| Write an edge | AI may propose. author record required | user / AI. author record required. user may dismiss AI's edges | same as left |
| Delete | rebuilding the cache is allowed. Silent rewriting of source data (git-managed) is not allowed | only cryptographic erasure of the body is allowed. The existence of the record is not erased | versions are immutable (BL-1 is a violation → an entry condition for Pre-v1 Phase 5) |

---

## 5. Rules (F1–F14)

| # | Content |
|---|---|
| F1 | Do not change IDs. The scope ID is prefix + original ID. |
| F2 | Edges are append-only across all scopes. author record required. No deletion (cancellation is also written as an edge). |
| F3 | Only the user can write a commitment. The AI may only propose. |
| F4 | Permissions do not cross scopes. world's AI scoring cannot be written to self. self's rules do not impede world's rebuilds. |
| F5 | Cross-scope joining happens only at read time (view / export). Do not persist the joined state. |
| F6 | Each scope holds one non-rebuildable source of truth (self: ledger / world: git-managed source data / artifact: version folders). Caches may be rebuilt. Silent rewriting of the source of truth is not allowed. |
| F7 | Do not change a frozen version reference. When changing it, write a new record. |
| F8 | Only one routine per week. The weekly review is added to the existing Sunday flow. A design that demands a second routine is rejected. |
| F9 | The provenance mix must be computable from edges alone. "Of my own bets, the proportion prompted by AI-routed information." |
| F10 | The premise of this mechanism itself (standing prediction 2 = the everyday practical use of local AI) is also registered as a prediction, and if it misses, it is recorded as a miss. |
| F11 | self's data does not leave this machine unless the user explicitly acts. Do not place the self source of truth in a location that has a remote. |
| F12 | Even if the screen is dead, the weekly review can be completed with only the CLI and files. |
| F13 | Requests from Nunc Stans to an engine go only through documents in contracts/. Conversion when the shapes do not match is written on the Nunc Stans side. See §13. |
| F14 | A resident program does not run without registration (commitment + mandate + a frozen version reference). Launching after expiry / revocation is refused. |

---

## 6. Handling News's editorial authority

News's editorial features (headline selection, relevance scoring) sit upstream of self's action records. Since changing what you see changes what you bet on, this is a kind of intervention.

Response: not an extension of mandate, but make it traceable through records (F9).
1. Treat `reference/news-topics.md` (planned — not yet created) and `reference/standing-predictions.md` (planned — not yet created) formally as editorial-policy documents. The user writes them, they have a git history, and changes are user edits only. If the AI silently widens the coverage, verify-topic-coverage detects it.
2. Always show a one-line provenance mix on the screen's home (§10-C).

The mix is not used for restriction. Visibility itself is the countermeasure.

---

## 7. Weekly review (the content of F8)

Just add one step to the existing Sunday flow:
1. Write 0–2 commitments for this week
2. Attach edges (informed_by / serves / produced)
3. Check the one-line provenance mix

Within 10 minutes. If it goes over, cut items. If there is no screen, it must be completable with `just ritual` (CLI) (F12).

---

## 8. Order of starting work

(Merged into the §12 implementation plan. The criterion "did a decision change even once after seeing the edges" is in §12 Pre-v1 Phase 1.)

---

## 9. Open issues

- The granularity of resources (start with money_jpy / hours, two of them. As long as the order of magnitude matches, it is enough)
- When to unlock AI edge proposals (Pre-v1 Phase 4 onward. author=ai record + dismissable)
- Where to place the knowledge type (leave it as notes, or move it toward the FourFive side)
- The language for nunc-stans-engine (decided at the start of Pre-v1 Phase 2. Candidate: Hono)
- The change procedure for contracts/ (for now, git history + revisions of this document)
- Whether to keep the world public page (optional. If kept, as a job of the data-side repository, decoupled from Nunc Stans)
- Where to place the commit-rule check (pre-commit / CI / `just check`. Start with `just check`)
- Where to place the execution log of resident programs (decided when drafting the ABI)
- The criterion for "prototype established" (start from one working demo)

---

## 10. Screen rules (A–D)

The unified screen could become the strongest intervention device within Nunc Stans. So SPL Inv 20 (the treasure box is guaranteed by screen reachability) carries over to this screen.

### A. The source of truth for connections is the data
The screen persists nothing as source of truth (F6). The source of truth for edges is nunc-stans-engine. The screen reads nodes from the three engines' APIs and edges from nunc-stans, and joins them at display time (F5). If ID resolution fails, display by to_label. A broken link is shown not as a broken screen but as a readable record.

### B. One origin, local, works even without a screen
The screen is a single origin on localhost (F11). GitHub Pages is dropped from the product configuration. The engines can keep running without a screen (F12). Launch is a single `just up`.

### C. Intervention limits
1. The screen's ordering is determined by settings the user wrote. The AI neither reorders nor recommends (if it does, that is mandate's jurisdiction).
2. The provenance / intervention-record view (equivalent to the treasure box) can be opened from any screen with one tap, no confirmation. The AI does not impede opening it.
3. Buttons like "create a commitment from this headline" may be placed. This is both an inducement and an automatic informed_by edge attacher (handwriting forgets, but the button does not). Placement condition: always show a one-line provenance mix on home.

### D. Phased migration
ME (the new value, top priority) → News view (read-only. Just change the output target from Pages to local) → FourFive's screen (the heaviest, so last). During migration, mount FourFive's existing Vue build at `/fourfive/` on the same origin as-is. The goal of the ME view is, on a Sunday night, to look at the history and think "I can bet again." It is not a management dashboard lined with numbers.

---

## 11. Where repositories and data are placed

Policy: **The boundary of decision authority is drawn by where data is placed. The boundary of code is drawn by headcount.** There is one developer, so the code is one repository (monorepo). "Each engine can be reinforced independently" is guaranteed not by splitting repositories but by contracts/ and the three rules below. Splitting out later is cheap (git filter-repo), but integrating later is expensive. On the day the team grows or it is open-sourced, split out just that engine.

### Code (monorepo. remote allowed — because it contains no self data)

```
nunc-stans/
├── design/
│   └── constitution/constitution.md ← this document (source of truth)
├── contracts/                        ← shared agreements. the only place you may touch multiple domains at once
│   ├── edge.schema.json
│   ├── scope-id.md
│   ├── glossary.md                   ← allowed-word list. adding a new word is a deliberate commit
│   └── agent-abi.md                  ← reserved only. contents empty (§13-D)
├── engines/
│   ├── nunc-fluens/                  ← existing news code moved with its history (Python)
│   ├── nunc-stans/                    ← new. manages the source of truth for edges / commitment / mandate
│   └── fourfive/                     ← existing (Hono + Vue)
├── frontend/                         ← unified screen
├── justfile                          ← up / ritual / check / test
└── compose.yml
```

The three rules (mechanization in §13-C):
1. Engines do not import each other's code. Exchanges are HTTP API and edges only
2. Only a change to contracts/ is a reason to touch multiple engines at once
3. frontend depends only on contracts/

### Data (separated from code)

| Source of truth | Location | remote | Notes |
|---|---|---|---|
| world | change the existing news repo to data-only (delete the code, leave source data and git history as-is) | allowed (public page optional) | git history is the F6 source of truth. Not moving it is safest |
| self | `~/nunc-stans-data/self/` (git init, no remote) | forbidden (F11) | me/*.json + edges.jsonl → in future a ledger DB. Not a hidden folder (discoverability is also part of Inv 20) |
| artifact | FourFive's existing data folder | — | reference it via configuration. No move needed |

---

## 12. Implementation plan Pre-v1 Phase 0–5

### Pre-v1 Phase 0 — Foundation (half a day to 2 days)
1. Create the monorepo, place this document in design/
2. Move the code portion of the news repo into engines/news/ via subtree merge. Change the original repo to data-only (source data and history stay as-is = F6)
3. Move fourfive into engines/fourfive/ via subtree merge
4. Place edge.schema.json / scope-id.md / glossary.md / agent-abi.md (empty) in contracts/
5. git init `~/nunc-stans-data/self/` (no remote)
6. justfile: `just up` / `just ritual` / `just check`

### Pre-v1 Phase 1 — First operation check (4 weeks)
1. Manually register 3 past items into self (summer 2025 / spring 2026 / `self/commitment/2026-06-federation-local` — register the decision to consolidate locally itself as a bet on standing prediction 2. The execution of F10)
2. Skeleton of the screen: a single ME view (read self's JSON, display the edges. Also fallback display by to_label)
3. A one-line provenance mix on home
4. Run for 4 weeks on the Sunday flow. Verdict: **did a decision change even once after seeing the edges?** Yes → Pre-v1 Phase 2 / No → revise this document or discard it

### Pre-v1 Phase 2 — nunc-stans-engine v0
- Read/write API for me/*.json + edges.jsonl (thin). Append-only verification at the API layer (DB trigger-ization in SPL v3)
- A commitment entry form on the screen (the CLI remains = F12)

### Pre-v1 Phase 3 — News view integration
- Change export.py's output target from Pages to local serving
- A world view on the screen (read-only). headline → create-commitment button + automatic informed_by attachment (§10-C-3)

### Pre-v1 Phase 4 — Mounting the FourFive screen
- Mount the Vue build at `/fourfive/` (no modification. §13-C)
- Unlock AI-proposed produced edges (author=ai, dismissable)

### Pre-v1 Phase 5 — Resident programs
The chapter after FourFive reaches agent form on its own (app + API + skill + operating agent). What is decided here is only the Nunc Stans-side intake. The agent's internals / skill format / runtime are not touched (§13-D).

Entry conditions (do not open until all are met):
1. BL-1 fixed. On the premise of running resident programs, a bug where a frozen version is rewritten behind the scenes becomes an attack path against oneself.
2. FourFive-side prototype established
3. Drafting and agreement of contracts/agent-abi.md (after the prototype)

Form of registration: resident registration = commitment (the user writes it. F3) + the form of a mandate (declaration of the target scope, read / write / external side effects, expiry required, no response means lapse, continuation requires re-registration) + a reference to a frozen version (F7. updates as a new registration).

At runtime (F14): the scheduler refuses launches under an expired / revoked registration (the same form as SPL's `_assert_mandate_active()`). The source of truth for the check is nunc-stans-engine. The user can read the execution records at any time.

Include "the weekly review keeps running" in each Phase's completion condition (F8 / F12).

---

## 13. Engine boundaries (A–D) — amended 2026-07

(Amendment, 2026-07 Phase A: the engines are internal components of one
product and may be modified freely by product work. The original
anti-interference clause assumed independently evolving engines; what
survives is the boundary discipline below. See design/naming.md.)

In the final form, FourFive-made programs run on Nunc Stans, so zero contact is impossible. The way to keep the boundaries honest is to fix the cross-engine path to a single one and check it by machine.

### A. One path — for cross-engine coupling
Product work may modify any engine directly (the former "engine changes only
for the engine's own reasons" rule is retired by the 2026-07 amendment).
What remains fixed: engines do not couple to each other's internals.
Anything one engine needs from another goes through documents in contracts/
(vocabulary, scope IDs, edges, schemas), and an engine's published API is
the only runtime surface other parts may touch.

### B. Conversion is written on the Nunc Stans side
When the shapes do not match, the conversion code is written on the Nunc Stans side (frontend or a thin conversion layer). Do not make the engine change its output format. When adding a new requirement to contracts/, always also note "why this cannot be solved by conversion on the Nunc Stans side." The default answer is no. The reason this works best: if writing it yourself is cheaper than asking, you stop asking.

### C. Machine checks (consolidated into `just check`)
1. commit check: a single commit touches at most one of {engines/nunc-fluens, engines/nunc-stans, engines/fourfive, frontend}. Only commits including contracts/ are exempt. design/ and the justfile are free
2. import check: mechanization of the three rules in §11
3. served-asset match check: files served at `/fourfive/` are byte-identical to FourFive's own build artifacts (direct serving of dist or a symlink recommended). Injecting CSS or scripts, or overriding the theme, is forbidden

### D. Write contracts late
A contract written early constrains the design. agent-abi.md reserves only the location and is left empty. The cue to draft it is FourFive's prototype being established. The text to place:

```markdown
# contracts/agent-abi.md
Status: reserved only. Deliberately empty (constitution §13-D)

Cue to draft: when FourFive reaches an agent-form prototype on its own.
What to decide when drafting (intake only): the form of registration (commitment + mandate + frozen version reference) /
  the vocabulary for declaring what is possible / the form and location of execution records.
What not to decide: the agent's internal design / skill format / runtime (FourFive's jurisdiction. §13-A).
```
