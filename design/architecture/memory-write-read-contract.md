# Memory WRITE / READ Contract v0.2 — Nunc Stans-aware Edition

Status: Draft v0.2  
Scope: Human Thought Augmentation System / the contracts layer / News / Nunc Stans / FourFive  
Purpose: Fix the implementation boundary for Memory WRITE / READ / Reconnection, and define the contract that keeps AI output, external knowledge, user understanding, self-prediction, and deliverables from being conflated.

---

## 0. Positioning

This document is not a PRD. It is the **Memory I/O Contract** to be fixed before implementation.

Its goals are as follows.

1. Define WRITE not as "save" but as "commit"
2. Define READ not as "search" but as "reconnection to the current INTENT"
3. Do not conflate AIResponse / ExternalKnowledge / UserUnderstanding / Nunc Stans SoR
4. Do not let the respective sources of truth (canonical records) of News / Nunc Stans / FourFive collide with the Memory Core on the HTAS side
5. Separate the responsibilities of Thin Agent Harness / Policy Layer / Contracts-Layer Adapter

The WRITE/READ defined here is not CRUD against a single DB.

```text
WRITE = an operation that determines which semantic layer's source of truth the information is treated as
READ  = an operation that reconnects past assets to the current UserState / INTENT / cognitive load
```

---

## 1. Core decisions

1. WRITE is commit, not save.
2. Separate appending raw events from committing to Domain Memory.
3. All Domain WRITEs default to candidate.
4. Only user-origin / user-approved / user-modified / user-rejected may be committed to UserUnderstanding.
5. AIResponse is not UserUnderstanding.
6. ExternalKnowledge is not UserUnderstanding.
7. News world prediction does not commit directly to the self-side UserHypothesis.
8. The user peer of Nunc Stans / SPL is the source of truth of the self domain.
9. The ai peer / superposition_state of Nunc Stans / SPL is a transparent hypothesis on the AI side, not UserUnderstanding.
10. FourFive's artifact_version is the source of truth of fixed deliverables, not a possession of the Memory Core.
11. The contracts-layer Edge is the source of truth of inter-system connections, kept separate from BeliefGraphEdge.
12. The Continuity Kernel's artifact is a cache, not the source-of-truth.
13. READ returns a ReconnectionResult.
14. surfaced_items is at most 3.
15. The final decision on surface / suppress / defer is made by the Policy Layer.
16. The LLM emits candidates but holds no commit authority.
17. App Core owns MemoryWritePolicy / ReconnectionPolicy / UserState / IntentFrame / CognitiveLoadGovernor / ACCPolicy / InterventionLog / Audit.
18. Each Nunc Stans engine owns its own source of truth, and HTAS does not store them in a unified way.

---

## 2. Terminology

### WRITE

An operation that fixes information into a semantic layer.

```text
AI said X
→ recorded as AIResponse

User says "I think X"
→ UserHypothesis candidate / committed

User chooses X
→ DecisionRecord committed

User bets resources on X
→ Nunc Stans commitment
```

WRITE is not adding a row to the DB. It is **determining what that row is treated as**.

### append / capture

An operation that appends so as not to lose raw events or logs.

```text
user_message append
assistant_message append
tool_result append
edge append
```

append is not commit.

### commit

An operation that promotes a candidate or raw input to the source of truth of a specific semantic layer.

### candidate

A record that the LLM or external processing proposed but that is not yet a source of truth.

### committed

A record that, by the authority rules of the Policy Layer or the target engine, can be treated as a source of truth.

### Reconnection

Not returning search results, but reconnecting past understanding, hypotheses, judgments, action results, world predictions, and deliverables to the current UserState / INTENT / cognitive load.

### Nunc Stans SoR

The respective sources of truth owned by News / Nunc Stans / FourFive.

```text
world    = News
self     = Nunc Stans / SPL
artifact = FourFive
```

---

## 3. Source of Truth structure

### 3.1 Four kinds of source / quasi-source of truth

```text
1. Continuity Raw Event Log
   the source-of-truth for conversation / tool call / branch / frame

2. Domain Memory
   structured memory such as UserUnderstanding / Decision / Action / Result / Actor

3. Nunc Stans SoR
   the respective sources of truth for world / self / artifact

4. Artifact / Projection / Cache
   active frame, summary, derived view, read model
```

### 3.2 Continuity Kernel

What it owns:

- Event
- Branch
- Span
- Artifact
- FrameLog
- ActiveFrame

What it does not own:

- the source of truth of UserUnderstanding
- the source of truth of Nunc Stans commitment
- the source of truth of News world prediction
- the source of truth of FourFive artifact_version

The Continuity artifact is a cache. The source-of-truth is the raw event log.

### 3.3 Domain Memory

What it owns:

- UserBelief
- UserHypothesis
- Question
- Distinction
- Goal
- IntentFrame
- DecisionRecord
- ActionRecord
- ResultRecord
- Actor
- ActorHypothesis
- ActorObservation
- InterventionLog
- Feedback

However, anything belonging to the Nunc Stans SoR is treated in Domain Memory as a read model or typed reference.

### 3.4 Nunc Stans SoR

```text
News
- world observation
- world prediction
- forecast evaluation
- source reliability

Nunc Stans / SPL
- self prediction
- user/ai peer track
- commitment
- outcome
- revision
- mandate
- suspension
- intervention under mandate
- edge

FourFive
- artifact_version
- app metrics
- produced artifact
- fixed version state
```

### 3.5 Projection / Cache

The following are not sources of truth.

- UI view
- ME view
- active frame
- rolling summary
- derived strategy card
- Nunc Stans joined view
- search index
- embeddings
- ranking output

---

## 4. Basic structure of WRITE

WRITE is handled in three stages.

```text
1. EventWrite
   append a raw event

2. ProposalWrite
   create a candidate

3. Domain / Nunc Stans Commit
   commit to the correct layer
```

### 4.1 EventWrite

Targets:

- user message
- assistant response
- tool call
- tool result
- file diff
- branch operation
- user correction
- contracts-layer adapter event

Properties:

- append-only
- in principle, may be recorded broadly
- but this alone is not UserUnderstanding

### 4.2 ProposalWrite

Candidates emitted by the LLM / extractor / adapter.

Targets:

- UserHypothesis candidate
- DecisionRecord candidate
- ActionRecord candidate
- ResultRecord candidate
- ActorHypothesis candidate
- Edge candidate
- commitment candidate
- mandate candidate
- strategy model candidate

Properties:

- candidate
- source_ref required
- not a source of truth before policy_decision

### 4.3 Domain / Nunc Stans Commit

Promote to source of truth according to the authority rules of the target layer.

```text
UserUnderstanding commit
→ App Core MemoryWritePolicy

self prediction / commitment / outcome / revision commit
→ Nunc Stans authority

world prediction / observation commit
→ News authority

artifact_version commit
→ FourFive authority

edge commit
→ Nunc Stans edge ledger authority
```

---

## 5. WRITE Destination Rules

| Input | Correct destination | Initial state | Treated as UserUnderstanding |
|---|---|---|---|
| user raw message | Continuity Event / Utterance | append | No |
| assistant response | AIResponse / Continuity Event | committed log | No |
| AI proposal | WriteProposal | candidate | No |
| user understanding inferred by AI | WriteProposal | candidate | No |
| external material / Web / News source | ExternalKnowledgeItem / News | committed external | No |
| News world prediction | News world/prediction | committed world | No |
| world prediction made by the user | Nunc Stans self prediction(scope=world) | committable | Yes, self-side |
| belief stated by the user | UserBelief | committable | Yes |
| hypothesis stated by the user | UserHypothesis | candidate or committed | Yes |
| question posed by the user | Question | committable | Yes |
| distinction placed by the user | Distinction | committable | Yes |
| judgment adopted/rejected by the user | DecisionRecord | committable | Yes |
| action the user takes / has taken | ActionRecord | committable | Yes |
| action on which the user wagered resources | Nunc Stans commitment | committable | Yes, self-side |
| observable close of a commitment | Nunc Stans outcome(component=observable) | committed | self SoR |
| subjective close of a commitment | Nunc Stans outcome(component=subjective) | committed | self SoR |
| observed result after action | ResultRecord / Nunc Stans outcome | committable | Yes |
| revision | Nunc Stans revision / HypothesisUpdate | committable | Yes |
| FourFive app version | FourFive artifact_version | committed artifact | No, but referenceable |
| app metric | FourFive artifact data | committed artifact data | No |
| AI's strategy understanding | superposition_state / StrategyModelCandidate | candidate / transparent AI track | No |
| user adopts/modifies strategy understanding | UserHypothesis / Goal / IntentFrame / DecisionRecord | committable | Yes |
| edge | Nunc Stans edge ledger | append-only | Edge, not belief |
| Actor container | Actor | committed container | No by itself |
| user's Actor hypothesis | ActorHypothesis | candidate or committed | Yes |
| AI's Actor inference | ActorHypothesis proposal | candidate | No |
| Actor's observed behavior | ActorObservation | committable | observation |
| mandate | Nunc Stans mandate | committed only by user | permission record |
| intervention under mandate | SPL/Nunc Stans intervention + HTAS InterventionLog | committed log | No |

---

## 6. Status lifecycle

```text
candidate
↓
committed
↓
superseded / invalidated / archived
```

Additional states:

```text
rejected
log_only
store_only
needs_confirmation
policy_blocked
```

### candidate

Not a source of truth. In principle not included as a READ target. However, it may be displayed in the confirmation UI, DMN batch, review, and proposal comparison.

### committed

Can be a READ target as the source of truth of the target layer.

### rejected

Normally excluded from READ. However, surfacing it as a "previously rejected option" during a Decision is an exception, when reconnecting it.

### superseded

Replaced by a newer record. No silent update.

### invalidated

No longer valid due to error, withdrawal, or premise collapse.

### archived

Removed from the normal reconnection targets, but retained as history.

---

## 7. WriteProposal schema

```text
WriteProposal {
  id
  run_id
  source_event_ids
  source_span_ids

  proposed_destination:
    AIResponse
    | ExternalKnowledgeItem
    | UserBelief
    | UserHypothesis
    | Question
    | Distinction
    | Goal
    | IntentFrame
    | DecisionRecord
    | ActionRecord
    | ResultRecord
    | Actor
    | ActorHypothesis
    | ActorObservation
    | Edge
    | Nunc StansPrediction
    | Nunc StansCommitment
    | Nunc StansOutcome
    | Nunc StansRevision
    | Mandate
    | StrategyModelCandidate

  payload

  provenance:
    user_origin
    | user_accepted_ai
    | user_modified_ai
    | user_rejected_ai
    | ai_generated
    | external_source
    | tool_result
    | news_world
    | fourfive_artifact
    | mixed

  user_act:
    asserted
    | asked
    | distinguished
    | hypothesized
    | accepted
    | modified
    | rejected
    | decided
    | acted
    | committed_resources
    | observed
    | corrected
    | closed
    | revised
    | none

  confidence
  ambiguity
  privacy_level
  risk_level
  requires_user_confirmation

  policy_decision:
    commit_now
    | keep_candidate
    | ask_user
    | reject
    | log_only
    | route_to_nunc_stans_engine

  policy_reason
  created_at
}
```

---

## 8. WRITE Pipeline

```text
1. Append raw event
2. Extract WriteProposal[]
3. Classify destination
4. Attach source refs
5. Determine authority
6. Apply MemoryWritePolicy / ContractsLayerWritePolicy
7. Decide: commit_now / keep_candidate / ask_user / reject / log_only / route_to_engine
8. Commit or store candidate
9. Append audit log
10. Update InterventionLog if response used memory or intervention
```

### 8.1 Authority determination

```text
if destination in UserUnderstanding:
  authority = AppCore.MemoryWritePolicy

if destination in self ledger:
  authority = Nunc Stans

if destination in world:
  authority = News

if destination in artifact:
  authority = FourFive

if destination is Edge:
  authority = Nunc Stans edge ledger

if destination is Continuity Event/Artifact:
  authority = Continuity Kernel
```

### 8.2 Cross-module write rule

Other modules do not write core_memory directly.

```text
OK:
world_intel submits WriteProposal
AppCore validates
Memory service commits

NG:
world_intel directly creates UserHypothesis
```

---

## 9. Auto-commit rules

The following may be auto-committed.

1. raw event append
2. assistant response as AIResponse
3. external document as ExternalKnowledgeItem, if source exists
4. explicit user belief
5. explicit user hypothesis
6. explicit user question
7. explicit user distinction
8. explicit user decision
9. explicit user action
10. explicit observed result
11. Actor container when subject is explicitly referenced
12. ActorObservation when observed behavior has source_ref
13. Edge authored by user
14. Nunc Stans commitment authored by user
15. Nunc Stans outcome authored by user/sensor according to component rule
16. FourFive artifact_version when version is explicitly cut

However, even for auto-commit, source_ref / provenance / author / created_at are required.

---

## 10. Candidate-only rules

The following stay at candidate.

1. a hypothesis proposed by AI
2. user understanding inferred by AI
3. an Actor's motive / constraint / preference / strategy inferred by AI
4. a user hypothesis derived from a News world prediction
5. generalizations extracted from external material
6. a judgment not explicitly adopted by the user
7. a commitment proposal on which the user has not explicitly wagered resources
8. a Goal inferred by AI
9. an IntentFrame inferred by AI
10. AI's strategy understanding
11. psychological inference from a FourFive app metric
12. ActorHypothesis in a high-privacy domain
13. low-confidence but valuable inference
14. a record with weak source_ref

---

## 11. WRITE hard rules

### W1. AIResponse is not UserUnderstanding

What AI said is recorded in AIResponse. Do not commit it directly to UserBelief / UserHypothesis.

### W2. ExternalKnowledge is not UserUnderstanding

External material, News, Web, and documents are placed in ExternalKnowledge or the world-side source of truth. They do not enter UserUnderstanding until the user adopts, modifies, or rejects them.

### W3. UserUnderstanding requires a source_ref

UserBelief / UserHypothesis / DecisionRecord / ActionRecord / ResultRecord hold source_event_ids or a source_ref.

### W4. Only user-origin / user-approved may be committed

Only things based on the user's own utterances, choices, adoptions, modifications, rejections, actions, and observations can be committed.

### W5. News world prediction is not written directly to self

News prediction stays in world. It connects to the self side via an informed_by edge or a user-authored prediction / commitment.

### W6. Only the user can write a Nunc Stans commitment

AI goes only as far as proposing. It becomes a commitment only when the user writes it.

### W7. Separate the observable and subjective of a Nunc Stans outcome

observable is sensor/user observation; subjective is user only. The subjective can supersedes by appending.

### W8. FourFive artifact_version is immutable

A fixed version is not changed. Changes are recorded as a new version.

### W9. StrategyModel is not UserUnderstanding

superposition_state / AIModelOfUser is a transparent, versioned, dismissible AI-side hypothesis. It does not become UserUnderstanding until the user adopts or modifies it.

### W10. Actor is not a hypothesis

Creating an Actor is creating a subject container, not creating an ActorHypothesis.

### W11. AI Actor inference is candidate

An ActorHypothesis inferred by AI is candidate. It can be committed only once the user accepts / modifies / rejects it.

### W12. Edge is not BeliefGraphEdge

Edge is an inter-system connection. BeliefGraphEdge is the user-understanding structure. Do not mix them.

### W13. Do not store the joined state

A view that joins world / self / artifact is not stored. Join only at read time.

### W14. Append-only

Do not silently update an existing record. Corrections, deletions, rejections, and replacements are appended as a new event / edge / supersession.

### W15. Resident intervention without a mandate is forbidden

Resident programs and active intervention do not run without a mandate + commitment + fixed artifact reference.

### W16. The LLM holds no commit authority

The LLM does candidate extraction, classification, summarization, and drafting. Commit is done by Policy / user / engine authority.

---

## 12. Definition of READ

READ is not search.

```text
Bad:
return lots of memory related to the query

Good:
for the current UserState / IntentFrame / cognitive load,
surface at most 3 past assets, and
suppress / defer the rest
```

The purpose of READ is to reconnect past understanding, hypotheses, judgments, actions, world predictions, and deliverables to the present while preserving the user's INTENT.

---

## 13. ReconnectionRequest schema

```text
ReconnectionRequest {
  user_id
  branch_id
  session_id
  current_event_id
  user_input

  user_state {
    thought_phase: exploration | decision | action
    interaction_mode: research | decision | execution | defense | overload
    cognitive_load: low | medium | high
    uncertainty_level: low | medium | high
    urgency: low | medium | high
    confidence
    threat_level
    agency_level
  }

  intent_frame {
    goal_id?
    why?
    hypothesis_id?
    criterion?
    next_action_id?
    confidence
  }

  nunc_stans_context {
    world_refs[]
    self_refs[]
    artifact_refs[]
    edge_refs[]
  }

  target_actor_ids[]
  project_ids[]
  token_budget
  max_surface_items = 3
}
```

---

## 14. ReconnectionResult schema

```text
ReconnectionResult {
  user_state_id
  intent_frame_id

  route:
    CEN_NOW
    | DMN_BATCH_LATER
    | DMN_INSIGHT_NOW
    | ACC_GUARDRAIL
    | ACC_PAUSE
    | ASK_ONE_QUESTION
    | SILENCE
    | STORE_ONLY

  surfaced_items      // max 3
  suppressed_items
  deferred_items
  reason_for_surface

  intended_intervention:
    answer
    | branch_map
    | plan
    | reframe
    | guardrail
    | pause
    | insight_card
    | material_card

  cognitive_load_budget {
    max_items
    max_tokens
    allow_table
    allow_alternatives
    max_caveats
  }

  response_constraints
  memory_used
  nunc_stans_refs_used
  external_knowledge_used
  tools_allowed
  tools_blocked
}
```

---

## 15. READ candidate universe

READ treats the following as candidates.

### Domain Memory

- UserBelief
- UserHypothesis
- Question
- Distinction
- Goal
- IntentFrame
- DecisionRecord
- ActionRecord
- ResultRecord
- ActorHypothesis
- ActorObservation
- Feedback
- InterventionLog

### Continuity

- recent events
- branch-local decisions
- constraints
- task_state
- open_questions
- active artifacts with source refs

### Nunc Stans engines

- News world prediction / observation
- Nunc Stans self prediction
- Nunc Stans commitment
- Nunc Stans outcome
- Nunc Stans revision
- Nunc Stans mandate
- Edge
- FourFive artifact_version
- FourFive app metrics
- FourFive produced outputs
- superposition_state / StrategyModelCandidate

### External Knowledge

- ExternalKnowledgeItem
- source reliability
- market / world context

---

## 16. READ hard filters

### R1. Do not normally READ anything other than committed

Candidates are not normally surfaced. The exceptions are confirmation UI / review / DMN / proposal comparison.

### R2. Exclude anything without a source_ref

An artifact / memory with no source does not enter the active frame.

### R3. Normally exclude rejected / invalidated

However, a "previously rejected option" during a Decision is an exception.

### R4. Do not treat AIResponse as UserUnderstanding

Do not present AIResponse as "you used to think this."

### R5. News does not take priority over user memory

News is world context. It does not overwrite the user's past commitment / decision / hypothesis.

### R6. StrategyModel is presented as a transparent AI hypothesis

When presented, it is explicitly marked as an "AI-side understanding candidate." It is not presented as a user belief.

### R7. Nunc Stans join only at read-time

A result that joins world / self / artifact is not stored as a source of truth.

### R8. suppress/defer anything that exceeds cognitive load

Even if correct, do not present it now.

### R9. Proactive intervention outside a mandate is forbidden

If the READ result entails active intervention, confirm a valid mandate.

### R10. UI recommendations are under mandate jurisdiction

Reordering, recommendation, and nudging of the screen are treated not as the output of READ but as intervention.

---

## 17. Ranking priority

READ candidates are ranked by the following.

1. state_fit
2. intent_fit
3. user_origin_priority
4. decision_action_relevance
5. contracts_layer_edge_relevance
6. commitment_relevance
7. result_learning_value
8. risk_relevance
9. actor_relevance
10. artifact_metric_relevance
11. recency_and_freshness
12. confidence_and_source_quality
13. cognitive_cost_penalty
14. redundancy_penalty

### Principle

```text
user-origin > user-approved > user-rejected > ai candidate > external context
```

However, when a premise error or an update to a world fact matters, News / ExternalKnowledge can be surfaced as a guardrail.

---

## 18. Mode-specific READ

### 18.1 Execution

Retrieval candidates:

- active IntentFrame
- related DecisionRecord
- related ActionRecord
- high-risk constraints
- target_actor_ids related ActorHypothesis
- pending ResultRecord
- related Nunc Stans commitment
- related FourFive artifact_version / app metric
- relevant mandate if intervention/tool action

Output:

- answer first
- at most 1 caveat
- next action explicit
- do not widen exploration
- only irreversible risk goes to ACC

### 18.2 Decision

Retrieval candidates:

- UserHypothesis
- past DecisionRecord
- rejected options
- assumptions
- reversibility
- ResultRecord
- Nunc Stans outcomes
- commitment history
- News world predictions as context
- FourFive metrics
- ActorObservation

Output:

- compress the judgment criteria
- separate reversible / irreversible
- in principle recommend one option
- defer non-critical uncertainty

### 18.3 Research / Exploration

Retrieval candidates:

- Question
- UserHypothesis
- Distinction
- unresolved loop
- past discomfort
- News prediction / world observation
- superposition_state
- FourFive artifacts as strategy instruments
- ActorHypothesis

Output:

- branches over conclusions
- counter-hypotheses
- higher-level concepts
- future decision point
- leave room for the user to think

### 18.4 Defense

Retrieval candidates:

- user-stated values
- past accepted framing
- low-risk action
- supportive commitment history
- mandate constraints
- prior rejected intrusive intervention

Output:

- do not raise the threat
- do not stab with correctness
- a low-risk step
- preserve user agency

### 18.5 Overload

Retrieval candidates:

- active IntentFrame
- immediate next action
- critical blocker only
- one relevant commitment / decision

Output:

- only the next one
- park everything else
- avoid tables, exhaustiveness, and long text

---

## 19. Nunc Stans-aware READ patterns

### 19.1 News → self

```text
News world prediction
↓
read-time context
↓
user may create prediction / commitment
↓
informed_by edge
```

News is not a user belief. News is presented as "the movement of the world."

### 19.2 self → artifact

```text
self prediction / commitment
↓
FourFive artifact_version produced
↓
produced edge
↓
artifact metric informs later strategy
```

### 19.3 artifact → strategy model

```text
FourFive app metrics
↓
AI StrategyModelCandidate / superposition_state
↓
informed_by edge to artifact_version
↓
user can dismiss / accept / modify
```

Do not include metrics the app does not measure in the strategy understanding.

### 19.4 commitment → outcome → revision

```text
commitment
↓
outcome observable + subjective
↓
revision
↓
future READ / Reconnection
```

When the observable and the subjective diverge, treat that very fact as important information.

---

## 20. SuppressedItem / DeferredItem

```text
SuppressedItem {
  item_ref
  reason:
    wrong_mode
    | too_many_items
    | low_confidence
    | stale
    | redundant
    | high_cognitive_cost
    | external_over_user_memory
    | privacy_risk
    | not_actionable_now
    | mandate_required
    | contracts_layer_scope_boundary
  could_surface_if
}
```

```text
DeferredItem {
  item_ref
  defer_until:
    later_in_conversation
    | next_decision_point
    | after_action_result
    | DMN_batch
    | weekly_review
    | mandate_disclosure
  reason
  trigger_condition
}
```

---

## 21. One-turn synchronous pipeline

```text
1. User message arrives
2. Continuity Kernel appends user_message event
3. Thin Agent Harness starts run_id
4. StateDetector detects UserState
5. IntentExtractor extracts / updates IntentFrame candidate
6. WriteCandidateExtractor extracts WriteProposal[]
7. MemoryWritePolicy applies explicit commit / candidate / ask_user / reject
8. ContractsLayerAdapter routes Nunc Stans-bound proposals
9. ReconnectionResolver builds ReconnectionRequest
10. MemoryRead retrieves Domain Memory candidates
11. ContractsLayerRead retrieves News / Nunc Stans / FourFive candidates by typed refs and edges
12. ReconnectionPolicy filters / ranks / suppresses / defers
13. ReconnectionResult generated
14. ResponseGenerator produces response under constraints
15. Continuity Kernel appends assistant_message event
16. AIResponse saved
17. InterventionLog saved
18. async compaction / indexing / artifact validation
```

---

## 22. API boundary

### App Core

```text
POST /api/memory/write/proposals
POST /api/memory/write/{proposal_id}/commit
POST /api/memory/write/{proposal_id}/reject
POST /api/memory/read/reconnect
GET  /api/memory/records/{id}
GET  /api/interventions/{id}
```

### Contracts-Layer Adapter

```text
GET  /api/contracts/resolve/{scope_id}
GET  /api/contracts/edges?from=&to=&type=
POST /api/contracts/edges/proposals
POST /api/contracts/edges/append
```

### Nunc Stans

```text
GET  /api/self/predictions
POST /api/self/predictions
GET  /api/self/commitments
POST /api/self/commitments
POST /api/self/outcomes
POST /api/self/revisions
GET  /api/self/mandates
POST /api/self/mandates
```

### News

```text
GET /api/world/predictions
GET /api/world/observations
GET /api/world/sources
```

### FourFive

```text
GET /api/artifacts/versions
GET /api/artifacts/{id}/metrics
POST /api/artifacts/version-cut
```

---

## 23. Python interface sketch

```python
class MemoryWriteService:
    def propose(self, run_id, source_event_ids, proposals) -> list[WriteDecision]: ...
    def commit(self, proposal_id, user_confirmation=None) -> MemoryRecord: ...
    def reject(self, proposal_id, reason) -> None: ...

class ReconnectionService:
    def reconnect(self, request: ReconnectionRequest) -> ReconnectionResult: ...

class ContractsLayerReadAdapter:
    def resolve(self, scope_id: str) -> ContractsLayerNode: ...
    def get_edges(self, *, from_id=None, to_id=None, edge_type=None) -> list[Edge]: ...
    def retrieve_context(self, request: ReconnectionRequest) -> list[MemoryCandidate]: ...

class ContractsLayerWriteAdapter:
    def route_proposal(self, proposal: WriteProposal) -> ContractsLayerWriteDecision: ...
```

---

## 24. Fixture acceptance criteria

### WRITE fixtures

1. AI output is saved as AIResponse, not UserHypothesis.
2. User hypothesis receives source_utterance and can be committed.
3. AI hypothesis remains candidate until user accepts/modifies/rejects.
4. User decision becomes DecisionRecord.
5. User action becomes ActionRecord.
6. Observed result becomes ResultRecord.
7. News prediction does not become UserHypothesis directly.
8. User-authored world prediction goes to Nunc Stans self.
9. Commitment is user-authored only.
10. FourFive artifact_version is fixed and referenced, not copied.
11. StrategyModelCandidate is dismissible and not UserUnderstanding.
12. Actor AI inference is candidate only.
13. Edge is append-only and includes author/to_label.

### READ fixtures

1. Execution returns max 3 items and answer-first output.
2. Decision returns criteria compression and prior decision/commitment context.
3. Research returns branches, not premature recommendation.
4. Overload returns one next step.
5. News context appears as world context, not user belief.
6. FourFive metrics are used only when measured by the app.
7. superposition_state is labeled as AI understanding candidate.
8. rejected/dismissed items are only surfaced when useful as rejected history.
9. suppressed_items and deferred_items are logged.
10. Proactive intervention requires valid mandate.

---

## 25. MVP non-goals

In the MVP, the following are not done.

- fully autonomous memory writing
- Graph DB
- ActorPrediction / ActorModelUpdate as full implementation
- complex salience ML
- full Memory editor
- full Agent Harness
- external tool execution
- OpenHands deep integration
- Celery / Redis
- Rust domain core
- automatic edge generation before phase gate
- News intervention function
- FourFive full integration before ME / News view stabilization

---

## 26. ADR

```text
ADR: Fix Nunc Stans-aware Memory WRITE / READ Contract v0.2

Decision:
Memory WRITE is defined as commit, not storage. READ is defined as reconnection, not search. HTAS App Core owns MemoryWritePolicy, ReconnectionPolicy, UserState, IntentFrame, CognitiveLoadGovernor, ACCPolicy, InterventionLog, and Audit. Nunc Stans engines own their respective SoR: News owns world, Nunc Stans owns self, FourFive owns artifact. HTAS does not merge these into a unified database; it reads them through typed references and Edge at read time.

Rules:
- AIResponse is not UserUnderstanding.
- ExternalKnowledge is not UserUnderstanding.
- News world prediction does not directly become self memory.
- UserUnderstanding requires user-origin or user approval/modification/rejection.
- Nunc Stans commitment is user-authored only.
- FourFive artifact_version is immutable.
- StrategyModel / superposition_state is transparent AI hypothesis, not user belief.
- Edge is separate from BeliefGraphEdge.
- READ returns ReconnectionResult with max 3 surfaced items.
- surface / suppress / defer decisions are logged.
- LLM proposes; Policy validates; user confirms when needed; authority service commits; everything is traced.
```

---

## 27. Source references note

- nunc-stans-constitution-v0.3.1
- Nunc Stans PRD diff v1.1
- SPL v3 Plan
- Human Thought Augmentation System Integrated PRD v0.2
- Memory I/O Contract & MVP Decision Record v0.1
- Continuity Kernel design document
- Actor Model Specification
- Microservice Readiness Development Principles v0.1
