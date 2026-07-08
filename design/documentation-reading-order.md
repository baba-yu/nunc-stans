# Documentation Reading Order

Scope: Nunc Stans (product) / the contracts layer / Nunc Fluens / FourFive / HTAS
Purpose: the reading order and placement of the design corpus, and which
documents are operative today versus historical.
Updated: 2026-07-04 (post Phase A — monorepo consolidated, naming settled).

---

## 1. Start here (the operative route)

```text
1. What this repo is and how to run it
2. What we are building next, and every decision taken (D1–D10)
3. What every name means (and used to mean)
4. What must not be mixed together (the constitution)
5. What WRITE / READ mean for memory
6. What counts as passing
7. What has actually been built and verified
```

```text
README.md                                            (repo root)
↓
design/development/2026-07-04-nuncstans-v1-plan.md   (the operative plan, Phases A–F, D1–D10)
↓
design/naming.md                                     (the naming map — read before any older doc)
↓
design/constitution/constitution.md                  (world / self / artifact boundaries, F-rules)
↓
design/architecture/memory-write-read-contract.md    (WRITE / READ / Reconnection)
↓
design/stories/                                      (journeys + S-0..S-11 — the acceptance bar)
↓
design/verification/phase-a.md                       (what is done, with evidence)
```

For the product's philosophy and origin, add
`design/product/htas-integrated-prd.md` and
`design/architecture/htas-positioning-in-nunc-stans.md` after step 4.

---

## 2. Current inventory

```text
nunc-stans/
├── README.md                        ← run instructions (bootstrap / up)
├── CONTRIBUTING.md                  ← commit style, areas, dev workflow, checks
├── design/
│   ├── README.md                    ← what this tree is
│   ├── documentation-reading-order.md
│   ├── naming.md                    ← the naming map (federation → Nunc Stans era)
│   │
│   ├── development/                 ← operative plans live here
│   │   ├── 2026-07-04-nuncstans-v1-plan.md    ← THE plan (Phases A–F, decisions D1–D10)
│   │   ├── 2026-07-04-phase-a-plan.md         ← Phase A implementation plan (executed)
│   │   ├── 2026-07-04-phase-b-plan.md         ← Phase B implementation plan (executed; decisions B1–B4)
│   │   ├── development-plan.md                ← HISTORICAL (HTAS M-milestones; product-side reference)
│   │   └── setup-phase0.md                    ← HISTORICAL (superseded by `just bootstrap` + README)
│   │
│   ├── product/
│   │   ├── htas-integrated-prd.md   ← HTAS product definition (v0.2)
│   │   └── archive/                 ← earlier PRD rounds
│   │
│   ├── architecture/
│   │   ├── htas-positioning-in-nunc-stans.md
│   │   ├── memory-write-read-contract.md
│   │   ├── memory-io-contract-mvp-decisions.md
│   │   ├── actor-model.md
│   │   ├── continuity-kernel.md
│   │   ├── microservice-readiness.md
│   │   └── ip-server-readiness.md
│   │
│   ├── constitution/
│   │   └── constitution.md          ← §13 amended 2026-07 (engines are product organs)
│   │
│   ├── stories/                     ← acceptance: executed per phase, evidence required
│   │   ├── journey-examples.md      ← the five-stage loop, four personas
│   │   ├── test-spec-journey.md     ← Yu's 19 steps (T0–T18, checks 1–11) — Phase F
│   │   ├── S-0.md                   ← cold start (PASS, Phase A)
│   │   ├── S-1.md / S-2.md / S-9.md ← one origin / headline commit / timeline (PASS, Phase B)
│   │   └── S-10.md                  ← pristine environment (PASS, Phases A+B)
│   │
│   ├── ui/
│   │   └── phase-b/                 ← screenshot set (home, world, timeline, fourfive)
│   │
│   └── verification/
│       ├── phase-a.md               ← Phase A evidence, decisions, exit criteria
│       └── phase-b.md               ← Phase B evidence, decisions, exit criteria
│
├── contracts/                       ← the only cross-engine coupling surface
│   ├── edge.schema.json
│   ├── scope-id.md
│   ├── glossary.md
│   └── agent-abi.md                 ← v0 draft (Phase D): registration, capabilities, run records
│
├── engines/
│   ├── nunc-stans/docs/             ← spl-plan.md, prd-override.md (self-engine plans)
│   ├── nunc-fluens/                 ← news pipeline; INTEGRATION.md = code/data split
│   └── fourfive/docs/               ← specs and plans of the design tool
│
├── frontend/                        ← ME view / world view → Nunc Stans Formans (Phase B)
├── tools/                           ← check.ts, commit-scope.ts, data-dir.ts, bootstrap.sh
└── tests/journey/                   ← arrives with Phase F
```

Planned additions: `frontend/nunc-stans-formans/` and
`frontend/packages/{nunc-ui,ai}` (Phase B–C), `agents/nunc-stans-agent/`
(Phase D), `apps-host/` (Phase E).

---

## 3. Role-based routes

| I want to… | Read |
|---|---|
| Run the thing | `README.md`, then `CONTRIBUTING.md` |
| Know what happens next | `design/development/2026-07-04-nuncstans-v1-plan.md` (§3 phases, §6 decisions) |
| Understand a name (old doc, new doc) | `design/naming.md` |
| Understand the governance and boundaries | `design/constitution/constitution.md`, then `contracts/` |
| Understand the memory model | `design/architecture/memory-write-read-contract.md` → `memory-io-contract-mvp-decisions.md` → `actor-model.md` → `continuity-kernel.md` |
| Understand the product philosophy | `design/product/htas-integrated-prd.md` → `design/architecture/htas-positioning-in-nunc-stans.md` |
| Know what "done" means | `design/stories/` (S-* per phase; the journey spec for Phase F) |
| Audit what was actually built | `design/verification/phase-a.md` + git history |
| Work on the self engine | `engines/nunc-stans/docs/prd-override.md` → `spl-plan.md` |
| Work on the news engine | `engines/nunc-fluens/INTEGRATION.md` (code/data split, resync recipe) |

---

## 4. Historical documents

Kept unedited in meaning; read them through `design/naming.md` (vocabulary
was swept 2026-07, structure and old IDs preserved).

- `design/development/development-plan.md` — the HTAS M0–M11 milestone plan.
  Still the product-side reference for HTAS concepts (modes, ACC, DMN); the
  operative build order is the v1 plan.
- `design/development/setup-phase0.md` — the Pre-v1 Phase 0 setup procedure.
  Superseded by `just bootstrap` and the root README; the data-location
  rules it introduced (FD-3.2, F11) live on in the constitution and
  `tools/check.ts`.
- `design/product/archive/` — earlier PRD rounds.
- The "original file" import map of the pre-monorepo corpus lives in git
  history (this document's earlier revisions), not maintained here anymore.
