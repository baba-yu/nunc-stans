# Documentation Reading Order

Scope: Human Thought Augmentation System / Federation / News / NuncStans / FourFive  
Purpose: Organize the reading order and placement of related documents, and the documents to hand off at implementation time.

---

## 1. Basic route

The documents for this project are read in the following order.

```text
1. What we are building
2. What must not be mixed together
3. Where the source of truth lives
4. What WRITE / READ do
5. What each engine owns
6. How to implement it
7. What counts as passing
```

The shortest reading order is as follows.

```text
design/product/htas-integrated-prd.md
↓
design/architecture/htas-positioning-in-federation.md
↓
design/federation/federation-constitution.md
↓
design/architecture/memory-write-read-contract.md
↓
design/development/development-plan.md
↓
design/development/setup-phase0.md
↓
design/federation/test-spec-journey.md
```

---

## 2. Recommended placement

```text
federation/
├── design/
│   ├── documentation-reading-order.md
│   │
│   ├── product/
│   │   ├── htas-integrated-prd.md
│   │   └── archive/
│   │       ├── htas-prd-round1.md
│   │       └── htas-round2-output.md
│   │
│   ├── architecture/
│   │   ├── htas-positioning-in-federation.md
│   │   ├── memory-write-read-contract.md
│   │   ├── memory-io-contract-mvp-decisions.md
│   │   ├── actor-model.md
│   │   ├── continuity-kernel.md
│   │   ├── microservice-readiness.md
│   │   └── ip-server-readiness.md
│   │
│   ├── federation/
│   │   ├── federation-constitution.md
│   │   ├── journey-examples.md
│   │   └── test-spec-journey.md
│   │
│   └── development/
│       ├── development-plan.md
│       └── setup-phase0.md
│
├── contracts/
│   ├── edge.schema.json
│   ├── federation-id.md
│   ├── glossary.md
│   └── agent-abi.md
│
├── engines/
│   ├── news/
│   │   └── docs/
│   ├── nuncstans/
│   │   └── docs/
│   │       ├── prd-override.md
│   │       └── spl-plan.md
│   └── fourfive/
│       └── docs/
│
├── frontend/
├── tools/
└── tests/
    └── journey/
```

---

## 3. Current placement table

| Placement | Original file |
|---|---|
| `design/documentation-reading-order.md` | generated |
| `design/product/htas-integrated-prd.md` | `第3回統合PRD.txt` |
| `design/product/archive/htas-prd-round1.md` | `第1回PRD.txt` |
| `design/product/archive/htas-round2-output.md` | `第2回成果物.txt` |
| `design/architecture/htas-positioning-in-federation.md` | `HTAS_Positioning_in_Federation_v0.1.md` |
| `design/architecture/memory-write-read-contract.md` | `Memory_WRITE_READ_Contract_v0.2_Federation.md` |
| `design/architecture/memory-io-contract-mvp-decisions.md` | `Memory_IO_Contract_MVP_Decisions_v0.1.md` |
| `design/architecture/actor-model.md` | `Actor Model Specification.docx` converted |
| `design/architecture/continuity-kernel.md` | `Continuity Kernel 設計書.docx` converted |
| `design/architecture/microservice-readiness.md` | `Microservice_Readiness_Development_Principles_v0.1.md` |
| `design/architecture/ip-server-readiness.md` | `IP_Server_Readiness_Development_Principles_v0.1.md` |
| `design/federation/federation-constitution.md` | `federation-constitution-v0.3.1.md` |
| `design/federation/journey-examples.md` | `journey-examples.md` |
| `design/federation/test-spec-journey.md` | `test-spec-journey-v2.3.md` |
| `design/development/development-plan.md` | `開発進行ドキュメント v0.1.docx` converted |
| `design/development/setup-phase0.md` | `SETUP-phase0.md` |
| `engines/nuncstans/docs/prd-override.md` | `prd-override-nuncstans.md` |
| `engines/nuncstans/docs/spl-plan.md` | `SPL_v3_Plan.docx` converted |
| `contracts/edge.schema.json` | generated from Federation:Phase 0 setup |
| `contracts/federation-id.md` | generated from Federation Constitution |
| `contracts/glossary.md` | generated project glossary |
| `contracts/agent-abi.md` | reserved contract |

---

## 4. Shortest route

This is the minimal route; the tree in §2 is the complete inventory.

| Order | Document | Reading purpose |
|---:|---|---|
| 1 | `design/product/htas-integrated-prd.md` | Read the product definition of HTAS |
| 2 | `design/architecture/htas-positioning-in-federation.md` | Read what HTAS owns on top of the Federation |
| 3 | `design/federation/federation-constitution.md` | Read the world / self / artifact boundaries and the permission table |
| 4 | `design/architecture/memory-write-read-contract.md` | Read the WRITE / READ / Reconnection contract |
| 5 | `design/development/development-plan.md` | Read in what order to build |
| 6 | `design/development/setup-phase0.md` | Read the starting procedure for the monorepo / data location / check |
| 7 | `design/federation/test-spec-journey.md` | Read the acceptance criteria for the whole system |

---

## 5. Implementation route

### Federation:Phase 0

```text
design/federation/federation-constitution.md
design/development/setup-phase0.md
contracts/edge.schema.json
contracts/federation-id.md
contracts/glossary.md
contracts/agent-abi.md
engines/nuncstans/docs/prd-override.md
```

### Memory WRITE / READ

```text
design/architecture/memory-write-read-contract.md
design/architecture/memory-io-contract-mvp-decisions.md
design/development/development-plan.md
design/architecture/actor-model.md
design/architecture/continuity-kernel.md
```

### Federation Journey

```text
design/federation/journey-examples.md
design/federation/test-spec-journey.md
engines/nuncstans/docs/spl-plan.md
```

### Boundary / Extraction Readiness

```text
design/architecture/htas-positioning-in-federation.md
design/architecture/microservice-readiness.md
design/architecture/ip-server-readiness.md
```
