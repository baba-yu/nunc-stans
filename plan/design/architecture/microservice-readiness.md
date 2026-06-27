# Microservice Readiness Development Principles v0.1

Extractable Modular Monolith / development principles for validating split boundaries

## 1. Purpose

This document defines the development principles for designing and validating the backend of the second-brain AI Agent / Human Thought Augmentation System so that it is built monolithically at first while being able to withstand future microservice extraction.

## 2. Decision

The initial implementation is a **single deployable Django backend**. However, the internal structure is designed as an **extractable modular monolith**.

```text
What to do right now:
- single Django backend
- single primary DB
- module-owned tables
- strict internal APIs
- forbidden import rules
- boundary tests
- outbox / run log seams
- service extraction readiness validation

What not to do now:
- full microservices
- per-service DB separation
- service mesh
- distributed transaction
- design premised on Kafka/gRPC
```

## 3. Core Principle

**Service splitting can come later. But split-ability is validated from now on.**

The likelihood that microservice extraction becomes necessary is high. Therefore, validate the following continuously from the start.

- whether module ownership is clear
- whether there is direct cross-module DB access
- whether business logic is scattered across views / models / prompts
- whether cross-module dependency is cyclic
- whether a service-extraction candidate can be carved out behind a typed API
- whether fixture evaluation can be maintained after distribution

## 4. Non-goals

- do not microservice every feature from the start
- do not distribute Memory Core / Reconnection Core / Intent Core
- do not split the DB by service before the boundaries stabilize
- do not leave the split boundary as something to "think about in the future"

## 5. App Core: the area not to split

The following stay inside App Core for the time being.

```text
App Core
├─ MemoryWritePolicy
├─ ReconnectionPolicy
├─ UserState / IntentFrame
├─ CognitiveLoadGovernor
├─ ACCPolicy
├─ InterventionLog
├─ Feedback
└─ Audit
```

Reasons:

- the commit authority for User Understanding is here
- the separation of AIResponse and UserUnderstanding is here
- the final decision on surface / suppress / defer is here
- auditability is here

## 6. Service-extraction candidates

The following have a high likelihood of being carved out in the future.

| Component | Initial form | Future split likelihood | Notes |
|---|---|---:|---|
| World Intelligence | module + worker | High | news ingestion / forecasting / source reliability |
| Forecast Engine | worker | High | batch reasoning / evaluation / calibration |
| Dev Workbench | sidecar / worker | High | repo scan / test execution / patch proposal |
| OpenHands Adapter | sidecar | High | coding-agent subsystem |
| Indexing | worker | Medium | embeddings / FTS / vector retrieval |
| LLM Runner | package + worker | Medium | retry / timeout / provider abstraction |
| External Tooling | adapter | Medium | email / calendar / docs / browser |

## 7. Module Ownership Matrix

| Module | Owns | Cannot own |
|---|---|---|
| core_memory | UserHypothesis, DecisionRecord, ActionRecord, ResultRecord, IntentFrame | ForecastCandidate, DevRun, raw news corpus |
| reconnection | ReconnectionResult, suppression/defer policy | raw ingestion, prompt registry internals |
| cognitive_control | UserState, ACC hooks, cognitive load policy | external tool execution |
| world_intel | RawNewsItem, WorldEvent, ForecastCandidate, ForecastEvaluation | UserHypothesis commit, DecisionRecord commit |
| dev_workbench | DevRun, RepoSnapshot, ToolResult, PatchProposal | Memory commit authority |
| agent_harness | AgentRun, StepTrace, StructuredOutput, PromptVersion | MemoryWritePolicy final decision |
| continuity | Event, Branch, Span, Artifact, FrameLog | UserUnderstanding domain truth |

## 8. Cross-module Rules

### 8.1 Direct ORM Access

Forbidden:

```python
# world_intel writes a core_memory table directly
UserHypothesis.objects.create(...)
```

Allowed:

```python
memory_write_policy.propose_candidate(
    source="world_intel",
    candidate_type="external_forecast",
    payload=forecast_payload,
    source_refs=[...],
)
```

### 8.2 Cross-module References

References that cross modules avoid hard FK from the start.

```text
OK:
ExternalKnowledgeItem.source_ref = "world_intel:forecast_candidate:fc_123"

NG:
ExternalKnowledgeItem.forecast_candidate = ForeignKey(ForecastCandidate)
```

### 8.3 Owned Table Rule

- a module can directly write only its own owned table
- data of other modules is read via a service interface
- a cross-module write is in principle treated as candidate submission
- commit authority stays in App Core

## 9. Outbox / Job Boundary

Candidates for async-ification / service extraction create a boundary via job / outbox from the start.

```text
OutboxEvent {
  id
  event_type
  payload_json
  status
  created_at
  processed_at
}

JobRun {
  id
  module
  job_type
  input_ref
  output_ref
  status
  error
  created_at
  completed_at
}
```

Targets:

- news ingestion
- forecast generation
- indexing
- repo scan
- test execution
- OpenHands job
- DMN batch

## 10. Service Extraction Triggers

If 4 or more of the following are satisfied, consider service extraction.

```text
1. you want to scale only that module separately
2. you want to deploy only that module separately
3. you want to isolate that module's failures from the Core
4. that module naturally has an independent DB
5. the API contract has barely changed for 3 months or more
6. Core functions work even if that module is down
7. fixture evaluation does not break even when run as a separate process
```

## 11. Do-not-split Signals

If any of the following apply, do not split yet.

- the API changes every week
- data ownership is ambiguous
- the transaction with Core memory is tightly coupled
- the domain policy changes every time in fixtures
- the chat response does not hold without that module
- it ends up sharing commit authority

## 12. Boundary Validation

Validate the following in PR / CI.

```text
- forbidden imports fail CI
- direct cross-module ORM write fails CI
- module dependency graph has no cycles
- cross-module references use typed refs, not hard FK by default
- service interface tests exist
- fixture runner passes core W/R and READ cases
- extraction readiness score is updated for service candidates
```

## 13. Recommended Directory Layout

```text
second_brain/
  apps/
    core_memory/
    intent/
    reconnection/
    cognitive_control/
    intervention/
    continuity/
    agent_harness/
    world_intel/
    dev_workbench/
    integrations/
    security/
```

## 14. PR Review Checklist

- which module does this change belong to
- is it touching directly only that module's owned table
- is the write to other modules a candidate submission
- is it making future separation impossible via a hard FK
- are prompt / policy / tool execution / commit authority mixed
- is the API boundary for future service extraction visible
- are there cases that should be added to fixture evaluation

## 15. ADR

```text
ADR: Use Extractable Modular Monolith with Continuous Microservice Boundary Validation

Decision:
The initial backend will be implemented as a single deployable Django backend. However, the codebase will be structured as an extractable modular monolith with strict module ownership, service-like internal APIs, typed cross-module references, boundary tests, and extraction readiness checks.

Rationale:
The product may need microservices in the future, especially for World Intelligence, Forecasting, Dev Workbench, OpenHands, and Indexing. However, the current hard problem is Memory W/R correctness, Reconnection, INTENT preservation, and source traceability. Premature microservices would add distributed data and deployment complexity before domain boundaries stabilize.

Rules:
- Service split is deferred, but split readiness is validated from the beginning.
- App Core owns commit authority, ReconnectionPolicy, IntentFrame, InterventionLog, and audit.
- Service candidates may run as workers or sidecars but cannot commit UserUnderstanding.
- Cross-module data access must go through service interfaces.
- Cross-module references use typed references rather than hard FK by default.
- CI must validate forbidden imports, owned table boundaries, and dependency cycles.
```

## 16. Definition of Done

The state in which this development principle is working:

- App Core runs as a single backend
- service candidates have clear module boundaries
- there is no direct cross-module DB write
- World Intelligence / Dev Workbench / Indexing can be made into workers
- Memory Core / Reconnection Core / Intent Core are not separated
- boundary violations are detected in CI or PR review
- the decision criteria for when to do service extraction are written down
