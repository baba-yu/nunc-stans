# HTAS Positioning in Nunc Stans v0.1

Status: Draft v0.1  
Scope: Human Thought Augmentation System / the contracts layer / News / Nunc Stans / FourFive / Continuity Kernel  
Purpose: Define which layer HTAS should be treated as on Nunc Stans.

---

## 0. Conclusion

HTAS is not a giant DB that absorbs News / Nunc Stans / FourFive.

HTAS is the **cognitive control / reconnection / Memory I/O Policy layer** that sits on Nunc Stans.

```text
News owns world.
Nunc Stans owns self.
FourFive owns artifact.
Continuity Kernel owns session continuity.
HTAS owns cognitive control, Memory I/O policy, and reconnection.
```

HTAS does not consolidate and store the source of truth (canonical record). HTAS reads each source of truth through typed references and the Edge, and reconnects them to the current UserState / INTENT / cognitive load.

---

## 1. Why this document is needed

The existing design has four streams.

1. HTAS / second brain
   - Separate AI external knowledge from UserUnderstanding
   - READ according to UserState / INTENT / cognitive load
   - Cognitive control via DMN / CEN / SN / ACC

2. SPL / Nunc Stans
   - self prediction / outcome / revision
   - user peer / ai peer
   - commitment
   - mandate / butler / intervention
   - append-only ledger

3. News
   - world prediction / observation
   - AI-driven world prediction and verification
   - The source of truth on the world side

4. FourFive
   - Tactical apps built together with AI
   - artifact_version
   - app metrics
   - produced outputs

These do not collide. However, **if HTAS is built as the source-of-truth DB for everything, it does collide**.

This document fixes where HTAS should be placed.

---

## 2. Basic definitions

### 2.1 Nunc Stans

Nunc Stans is a configuration that connects the three scopes world / self / artifact.

```text
world    = News
self     = Nunc Stans / SPL
artifact = FourFive
```

What Nunc Stans shares is the following.

- vocabulary
- scope ID
- contracts-layer Edge
- permission table
- contracts
- read-time join

What Nunc Stans does not do.

- A consolidated DB
- Joined storage of data
- Overriding each engine's internal rules
- Direct commit from News to self
- Turning FourFive artifact into Memory Core

### 2.2 HTAS

HTAS is the Human Thought Augmentation System.

Its purpose is to augment the act of human thinking.

What HTAS handles.

- UserState
- IntentFrame
- MemoryWritePolicy
- ReconnectionPolicy
- CognitiveLoadGovernor
- SN Router
- ACC Monitor
- DMN Batch
- CEN response constraints
- InterventionLog
- Feedback
- Audit

What HTAS does not own.

- News world SoR
- Nunc Stans self ledger
- FourFive artifact_version
- The source of truth of the Continuity raw event log
- The source of truth of the Nunc Stans joined view

---

## 3. Layer structure

```text
[User / Local UI]
        ↓
[HTAS Cognitive Control Layer]
  - UserState
  - IntentFrame
  - MemoryWritePolicy
  - ReconnectionPolicy
  - CognitiveLoadGovernor
  - SN Router
  - ACC Monitor
  - InterventionLog
        ↓
[Integration / Contracts-Layer Adapter]
  - scope ID resolver
  - Edge reader/writer
  - NewsAdapter
  - Nunc StansAdapter
  - FourFiveAdapter
        ↓
[System of Record]
  - News       = world
  - Nunc Stans  = self
  - FourFive   = artifact
        ↓
[Continuity Kernel]
  - Event / Branch / Artifact / FrameLog
  - Active Frame construction
```

Note: in the diagram above, the Continuity Kernel is also a cross-cutting foundation. It handles raw events of conversation and work continuity, but it does not own UserUnderstanding or the Nunc Stans SoR.

---

## 4. Responsibilities HTAS owns

### 4.1 Memory WRITE Policy

HTAS judges which semantic layer the information extracted from input should be sent to.

```text
AI said X
→ AIResponse

External source says X
→ ExternalKnowledge / News

User says "I think X"
→ UserHypothesis

User bets resources on X
→ Nunc Stans commitment

User builds app X
→ FourFive artifact_version
```

However, rather than rewriting the source of truth of Nunc Stans or FourFive, HTAS sends a proposal / command to the relevant engine.

### 4.2 Reconnection Policy

For the current UserState / INTENT / cognitive load, HTAS decides what to read from which source of truth.

```text
Execution
→ active IntentFrame / related Decision / current commitment / target Actor / next action

Decision
→ UserHypothesis / past Decision / commitment outcomes / News world context / FourFive metrics

Research
→ Question / Distinction / News prediction / superposition_state / unresolved loop

Overload
→ one next step only
```

### 4.3 Cognitive Control

HTAS controls the amount, timing, and format of output.

- What to surface
- What to suppress
- What to defer
- When to stay silent
- When to guardrail
- When to pause
- When to send to DMN batch

### 4.4 Intervention Policy

HTAS judges whether intervention is needed.

However, active intervention requires a Nunc Stans mandate.

```text
intervention without mandate = forbidden
```

### 4.5 Audit

HTAS records what it read, what it output, and what it suppressed into the InterventionLog / Audit.

---

## 5. Responsibilities HTAS does not own

### 5.1 The source of truth of News

News owns the source of truth of world.

HTAS can read News, but it does not directly commit News's world predictions to UserHypothesis.

```text
News prediction
→ world context
→ informed_by edge
→ user-authored prediction / commitment
```

### 5.2 The source of truth of Nunc Stans

Nunc Stans owns the source of truth of self.

- self prediction
- commitment
- outcome
- revision
- mandate
- suspension
- intervention under mandate
- Edge

HTAS does not copy Nunc Stans as a consolidated DB. It references it at READ time.

### 5.3 The source of truth of FourFive

FourFive owns the source of truth of artifact.

- artifact_version
- app state
- app metrics
- produced output

HTAS does not store FourFive artifact as UserUnderstanding. It references it and, if necessary, uses it for strategic understanding limited to "what is being measured."

### 5.4 The source of truth of the Continuity Kernel

The Continuity Kernel owns session continuity.

- Event
- Branch
- Artifact
- FrameLog
- ActiveFrame

However, the Continuity artifact is a cache, not the HTAS UserUnderstanding source of truth.

---

## 6. The meaning of each system

### 6.1 News = world intelligence

News is the system that predicts and observes the movements of the world.

The role of News as seen from HTAS:

- ExternalKnowledge / World Model
- premise check
- future context
- decision material
- guardrail material

What News must not do:

- Direct commit to self memory
- Finalizing a user decision
- Writing a user commitment
- Asserting the user's psychology or strategy

### 6.2 Nunc Stans = self ledger / consent rail

Nunc Stans is the source of truth of self prediction / commitment / outcome / revision / mandate / edge.

The role of Nunc Stans as seen from HTAS:

- The source of truth of User-authored prediction
- The source of truth of Commitment
- The source of truth of Outcome / revision
- The source of truth of Edge
- The source of truth of Mandate / intervention permission
- The transparent advisor track of AI peer / superposition_state

What Nunc Stans must not do:

- Auto-committing world AI predictions to self
- Treating an AI peer as a user peer
- Having AI stand in for the user's subjective outcome

### 6.3 FourFive = tactical artifact engine

FourFive is the source of truth of the apps / deliverables that the user builds together with AI based on future predictions and strategy.

The role of FourFive as seen from HTAS:

- Tactical apps
- strategy instrument
- The measurement instrument of app metrics
- produced artifact
- fixed version reference

What FourFive must not do:

- Inferring metrics not measured from app metrics
- Storing artifact directly as UserUnderstanding
- silent update of a version

### 6.4 Continuity Kernel = working continuity

The Continuity Kernel is the continuity foundation for LLM conversation and work context.

The role of the Continuity Kernel as seen from HTAS:

- raw event log
- branch DAG
- active frame construction
- evidence pointer
- typed artifact cache

What the Continuity Kernel must not do:

- Owning the UserUnderstanding source of truth
- Owning the Nunc Stans SoR
- Turning a summary into a source-of-truth

---

## 7. The position of HTAS in the 5-stage loop

The Nunc Stans experience loop is the following.

```text
1. Have AI present future predictions and action options
2. The human chooses, creates their own prediction / commitment, and builds a tactical app in FourFive
3. AI understands the human's strategy through the app
4. AI makes executable proposals toward strategy achievement
5. The human acts in the real world and closes the commitment
```

HTAS is not the source of truth of this 5-stage loop.

HTAS handles the following between each stage.

| Stage | Source of truth | HTAS role |
|---|---|---|
| 1. World prediction / options | News / AIResponse | Turn into material, do not rank, control cognitive load |
| 2. Prediction / commitment / app | Nunc Stans / FourFive | WRITE classification, confirm user-authored commit, artifact reference |
| 3. Strategic understanding | superposition_state / FourFive refs | Make transparent as an AI-side understanding candidate, make it dismissible |
| 4. Proposal | HTAS InterventionLog / Nunc Stans mandate | Confirm mandate, present material only, surface/suppress/defer |
| 5. Action / close | Nunc Stans outcome / ResultRecord | Separate observable/subjective, reconnect to the next READ |

---

## 8. HTAS and UserUnderstanding

The core of HTAS is the protection of UserUnderstanding.

### 8.1 What goes into UserUnderstanding

- Beliefs the user stated
- Hypotheses the user stated
- Questions the user raised
- Distinctions the user placed
- Judgments the user adopted / rejected
- Actions the user took
- Results the user observed
- prediction / commitment / revision the user wrote
- AI proposals the user accepted / modified / rejected

### 8.2 What does not go into UserUnderstanding

- AI responses themselves
- News world predictions themselves
- External materials themselves
- FourFive artifacts themselves
- app metrics themselves
- The AI's StrategyModel itself
- The AI's Actor inference itself

### 8.3 Connectable but not mixed

```text
ExternalKnowledge / News / FourFive / AIResponse
↓
user accepts / modifies / rejects
↓
can commit to UserUnderstanding
```

---

## 9. Edge and BeliefGraphEdge

### 9.1 Edge

Connections between systems.

```text
informed_by
serves
produced
closes
supersedes
dismisses
```

Example:

```text
self/commitment/2026-06-federation-local
  serves
world/prediction/local-ai-daily-use
```

### 9.2 BeliefGraphEdge

Connections inside user understanding.

```text
supports
contradicts
assumes
derived_from
tested_by
updated_by
led_to_decision
```

Example:

```text
[Hypothesis] Local AI's everyday practical use advances
  tested_by
[Commitment] GPU server investment
```

### 9.3 Separation principle

Do not convert Edge into BeliefGraphEdge and store it.

When needed, handle it with a read model.

---

## 10. Handling of StrategyModel

How the AI understands the user's strategy is not UserUnderstanding.

```text
StrategyModel / superposition_state
= a transparent AI-side understanding candidate
```

Conditions:

1. Versioned
2. Grounded
3. Holds an informed_by edge to a FourFive artifact_version
4. The user can read it
5. The user can dismiss it
6. Do not commit to UserUnderstanding until the user adopts or modifies it
7. Do not ground it in metrics the app is not measuring

Example:

```text
AI StrategyModelCandidate:
win = external income of 200,000 yen per month
constraint = do not drop below 12 months of runway
risk = concentration of income-dependency sources
basis = artifact/runway-tracker@v1 metrics
```

This is not a user belief.

Only when the user explicitly states "yes, this strategic understanding is correct" can it be connected to Goal / IntentFrame / UserHypothesis / DecisionRecord.

---

## 11. The role of HTAS READ

HTAS READ is not an API that searches each Nunc Stans source of truth.

HTAS READ decides the following.

1. What the current UserState is
2. What the current IntentFrame is
3. From which source of truth candidates should be read
4. Which to surface
5. Which to suppress
6. Which to defer
7. In which format to output
8. If a proactive intervention, whether a mandate exists

---

## 12. The role of HTAS WRITE

HTAS WRITE is not about saving each piece of data to one DB.

HTAS WRITE judges which authority it should be sent to.

```text
User writes prediction
→ Nunc Stans

User writes commitment
→ Nunc Stans

News produces forecast
→ News

User creates app version
→ FourFive

AI responds
→ AIResponse

User adopts AI proposal
→ UserUnderstanding commit

AI proposes edge
→ Edge candidate
```

HTAS is the policy layer that prevents misplacing commit authority.

---

## 13. The positioning of the UI

The unified screen is not the source of truth.

The unified screen is a view that reads the source of truth of the three engines and the HTAS ReconnectionResult.

UI rules:

1. The UI does not store the source of truth
2. It does not store the joined result on the screen
3. News / self / artifact are joined at read-time
4. On ID resolution failure, display by to_label
5. The provenance / intervention-record view can be opened with one tap
6. AI does not hinder opening the treasure box / audit view
7. Reordering / recommendation / nudging are under mandate jurisdiction
8. Prioritize the ME view, then transition in the order of the News view, the FourFive screen

---

## 14. Module ownership

```text
apps/
  htas_core/
    memory_write_policy
    reconnection_policy
    user_state
    intent_frame
    cognitive_load_governor
    acc_policy
    intervention_log
    audit

  contracts_layer_adapter/
    scope_id_resolver
    edge_reader
    edge_writer
    news_adapter
    nunc-stans_adapter
    fourfive_adapter

  continuity/
    event
    branch
    span
    artifact
    frame_log

  world_intel/
    news_integration
    forecast_context

  self_ledger/
    nunc-stans_client

  artifact_engine/
    fourfive_client

  frontend/
    me_view
    news_view
    artifact_view
    treasure_box
```

### Areas not to split

For the time being, do not split from App Core.

- MemoryWritePolicy
- ReconnectionPolicy
- UserState / IntentFrame
- CognitiveLoadGovernor
- ACCPolicy
- InterventionLog
- Audit

Reasons:

- The commit authority of UserUnderstanding is here
- The separation of AIResponse and UserUnderstanding is here
- The final judgment of surface / suppress / defer is here
- Auditability is here

---

## 15. Reflection into development order

### HTAS:M0 (was Positioning Phase A): Contract preparation

- Place the Nunc Stans-aware Memory WRITE / READ Contract
- Place the HTAS Positioning document
- Confirm the scope ID / Edge schema / authority table

### HTAS:M1 (was Positioning Phase B): Minimal read model

- Read Nunc Stans self JSON / edges.jsonl
- Surface in the ME view
- Compute the provenance breakdown from edges

### HTAS:M3 & M4 (was Positioning Phase C): HTAS thin policy

- UserState detection
- IntentFrame extraction
- WriteProposal extraction
- ReconnectionRequest / Result
- surfaced / suppressed / deferred logging

### HTAS:M2 (was Positioning Phase D): Contracts-Layer Adapter

- NewsAdapter
- Nunc StansAdapter
- FourFiveAdapter
- Edge resolver

### HTAS:M5 (was Positioning Phase E): Mode-aware response

- Execution / Decision / Research / Overload
- max 3 surfaced items
- proactive intervention requires mandate

### HTAS:M5+ integration item (was Positioning Phase F — FourFive strategy integration)

- artifact_version reference
- app metrics read
- StrategyModelCandidate
- dismiss / accept / modify flow

---

## 16. Collision-avoidance rules

### H1. HTAS does not become a consolidated DB

HTAS does not copy each source of truth and store it joined.

### H2. HTAS does not override the Nunc Stans SoR

HTAS does not break the internal rules of News / Nunc Stans / FourFive.

### H3. HTAS protects UserUnderstanding

Do not put AIResponse / ExternalKnowledge / News / FourFive / StrategyModel directly into UserUnderstanding.

### H4. News is world context, not self-understanding

News prediction connects to self through an informed_by edge.

### H5. Nunc Stans protects the sovereignty track of self

commitment / subjective outcome / user prediction are user-authority.

### H6. FourFive grounds only on what is measured

Do not ground AI understanding or proposals in metrics the app is not measuring.

### H7. StrategyModel is an AI-side hypothesis

Until the user accepts / modifies / rejects it, it is not UserUnderstanding.

### H8. Edge is append-only

Cancellation is written with dismisses / supersedes. Do not delete or silent-update.

### H9. A view is not the source of truth

ME view / joined view / active frame are a cache or projection.

### H10. Proactive intervention requires a mandate

A resident program or active proposal requires a mandate + expiration + suspension possibility + audit.

---

## 17. Success conditions

The state in which HTAS is functioning correctly on Nunc Stans is the following.

1. The user can create a self commitment by looking at a News prediction
2. A self commitment can produce a FourFive artifact
3. An AI StrategyModelCandidate is created from FourFive artifact metrics
4. The StrategyModelCandidate is transparent and dismissible, and is separated from UserUnderstanding
5. The user acts in reality and can close a commitment with observable / subjective
6. The close result is reconnected at the next READ
7. HTAS surfaces at most 3 items and suppresses / defers the rest
8. Proactive intervention does not occur outside a mandate
9. The UI holds no source of truth and can always open the provenance and intervention log
10. Within 4 weeks, a decision changes at least once because of seeing an edge

---

## 18. ADR

```text
ADR: Position HTAS as Cognitive Control and Reconnection Layer over Nunc Stans

Decision:
HTAS will not be implemented as a unified database that absorbs News, Nunc Stans, and FourFive. News remains the world SoR, Nunc Stans remains the self ledger and consent rail, and FourFive remains the artifact SoR. HTAS sits above them as the cognitive control, Memory I/O policy, and reconnection layer. It reads Nunc Stans data through typed references and Edge, and it writes only through the correct authority boundary.

Rationale:
The hard problem is not data aggregation. The hard problem is preserving UserUnderstanding, keeping AI output separate from user knowledge, maintaining INTENT, and reconnecting the right past assets at the right cognitive load. Nunc Stans already gives the correct data boundaries: world / self / artifact. HTAS should use these boundaries rather than erase them.

Rules:
- HTAS owns MemoryWritePolicy, ReconnectionPolicy, UserState, IntentFrame, CognitiveLoadGovernor, ACCPolicy, InterventionLog, Feedback, and Audit.
- News owns world prediction and observation.
- Nunc Stans owns self prediction, commitment, outcome, revision, mandate, and Edge.
- FourFive owns artifact_version and app metrics.
- Continuity Kernel owns session event continuity and active frame construction.
- Joined views are read-time projections, not source-of-truth.
- AI strategy understanding is transparent, versioned, dismissible, and not UserUnderstanding until user acceptance or modification.
- Proactive interventions require valid mandate.
```

---

## 19. Reference-source notes

- nunc-stans-constitution-v0.3.1
- journey-examples.md
- prd-override-nunc-stans.md
- test-spec-journey-v2.3.md
- Human Thought Augmentation System Integrated PRD v0.2
- Memory I/O Contract & MVP Decision Record v0.1
- Continuity Kernel design document
- Microservice Readiness Development Principles v0.1
