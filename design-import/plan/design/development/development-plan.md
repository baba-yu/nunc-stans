# Development Progress Document v0.1

## Human Thought Augmentation System / Second Brain development policy

## 1. Purpose of this document

This document defines in what order the development of the Human Thought Augmentation System proceeds.

The scope is as follows.

- Phasing
  - When to build what
  - At what scale to build it
  - What to defer
- Memory W/R development policy
  - Whether to build the DB first
  - Whether to nail down the business logic first
  - How to validate WRITE / READ / Reconnection
- Agent Harness policy
  - Where to use the LLM
  - How far to make it agentic
  - How to use OpenHands
- Software stack policy
  - How to build it as a desktop app
  - How to use Python / Django / TS / Vue / Pinia
  - When to decide Rust / Tauri / Electron
  - When to bring in Celery / Redis

This document is not a PRD.  
It is not a product spec; it is an independent document that defines how to proceed with development.

## 2. Basic judgments

### 2.1 Do not finish building only the DB first

The essence of this product is not the DB itself.

The essence is as follows.

    User utterance
    ↓
    Extraction of User Understanding
    ↓
    Separation from AI external knowledge
    ↓
    commit to hypothesis / judgment / action / result
    ↓
    Reconnection according to the current INTENT
    ↓
    Output with controlled cognitive load

Therefore, completing only the DB schema first tends to lead to failure.

Typical failures are as follows.

- The schema is impressive, but what to WRITE and when is undecided
- AI output and user understanding get mixed
- RAG search works, but "should it surface now" cannot be judged
- Search results are many, but they are not reconnection
- source-of-truth and LLM inference artifacts get mixed
- Memory becomes an "AI output warehouse" rather than a "thinking asset"

### 2.2 But do not defer the DB too much

Nailing down only the business logic in the abstract cannot be validated.

In this product, without an actual data structure the following cannot be evaluated.

- Where to store AI output
- How to extract hypotheses from user utterances
- What to keep as candidate
- What can be committed to User Understanding
- What to READ depending on the current state
- What to surface and what to suppress
- What to leave in InterventionLog

Therefore, the correct way to proceed is as follows.

    Not "complete the DB first, then build W/R"

    but rather advance the following simultaneously:
    Memory I/O Contract
    + minimal source-of-truth DB
    + Thin Agent Harness
    + fixture evaluation

## 3. Development principles

### 3.1 Build Memory for reconnection, not for search

READ is not a search API.

The purpose of READ is to appropriately reconnect past understanding, hypotheses, judgments, and action results to the current UserState / INTENT / cognitive load.

Therefore, the return value of READ should not be a mere search result, but the following.

    ReconnectionResult {
      surfaced_items
      suppressed_items
      deferred_items
      reason_for_surface
      intended_intervention
      cognitive_load_budget
    }

### 3.2 WRITE is commit, not save

WRITE is not a mere save.

In particular, a WRITE to the User Understanding Layer must satisfy the following conditions.

- It is user-origin
- The user accepted / modified / rejected it
- It can be traced to a source
- AI output is not mixed in as-is
- candidate and committed are separated

The basic rules are as follows.

    AI said X
    → AIResponse

    External source says X
    → ExternalKnowledgeItem

    User says "I think X"
    → UserHypothesis candidate or committed UserHypothesis

    User accepts AI suggestion X
    → can commit to UserHypothesis / DecisionRecord

    User chooses X
    → DecisionRecord

    User acts based on X
    → ActionRecord

    Observed result Y
    → ResultRecord / Hypothesis Update

### 3.3 The LLM is an operator, but not the final authority

The LLM is used as part of the Memory W/R control apparatus.

However, the LLM is not entrusted directly with the following.

- Direct commit to User Understanding
- Confirmation of source-of-truth
- irreversible tool execution
- Final judgment of suppression / defer
- Final policy decision on ACC risk
- Asserting the user's hypotheses / intent

The LLM's role is as follows.

- Extract candidates
- Propose classification options
- Build a READ plan
- Summarize reconnection candidates
- Create a response draft
- Propose guardrail options

The final judgment is made by the domain policy layer.

    LLM proposes
    Policy validates
    User confirms when needed
    Memory service commits
    Everything is traced

## 4. Overall phasing picture

Development proceeds in the following order.

    HTAS:M0: Memory I/O Contract
    HTAS:M1: Minimal Source-of-truth DB
    HTAS:M2: Thin Agent Harness
    HTAS:M3: WRITE Pipeline
    HTAS:M4: READ / Reconnection Pipeline
    HTAS:M5: Mode-aware Chat Prototype
    HTAS:M6: Desktop Shell Spike
    HTAS:M7: Actor Model MVP
    HTAS:M8: ACC Monitor MVP
    HTAS:M9: DMN Batch MVP
    HTAS:M10: OpenHands Integration
    HTAS:M11: External Tooling / Full Agent Harness

PRD Phase 2 "Memory-aware Responses" has no standalone milestone; it is delivered across `HTAS:M1 + M4 + M5`. Positioning Phase F (FourFive strategy integration) is an integration item layered on `HTAS:M5+`.

What matters is building the product's core in HTAS:M0–M4.

Desktop shell, OpenHands, external tooling, and Full Agent are important, but bringing them in early muddies the W/R validation.

# 5. HTAS:M0: Memory I/O Contract (= Positioning Phase A)

## 5.1 Purpose

Before building the DB or Agent, define the Memory W/R contract.

This is not a detailed implementation, but defines the following boundaries.

- What to WRITE
- What not to WRITE
- What to keep as candidate
- What can be promoted to User Understanding
- In which state to READ what
- What to surface
- What to suppress
- What to defer

## 5.2 What to build

### Memory I/O Contract v0.1

Contents:

- WRITE destination rules
- candidate / committed rules
- AIResponse / ExternalKnowledge / UserUnderstanding separation rules
- READ mode rules
- ReconnectionResult schema
- source traceability rules
- suppression / defer rules
- fixture evaluation criteria

## 5.3 Scale

A small document is fine.

Guideline:

    Roughly 10–20 pages
    A spec read before implementation
    Updated together with the fixture

## 5.4 Completion criteria

It is enough if the following are written.

- Where to store AI output
- Where to store user hypotheses
- How to turn AI proposals into candidates
- Conditions for committing to User Understanding
- The memory types to look at per UserState at READ time
- The shape of ReconnectionResult
- What counts as passing in the fixtures

# 6. HTAS:M1: Minimal Source-of-truth DB (= Positioning Phase B)

## 6.1 Purpose

Build a minimal DB to validate W/R.

The DB at this stage is not the finished version.  
It is merely a thin persistence layer to support source-of-truth and traceability.

## 6.2 What to build

Minimal tables:

    Actor
    Session
    Utterance
    AIResponse
    ExternalKnowledgeItem

    UserBelief
    UserHypothesis
    Question
    Distinction

    Goal
    IntentFrame
    DecisionRecord
    ActionRecord
    ResultRecord

    InterventionLog
    Feedback

Minimal support for the Actor Model:

    ActorHypothesis
    ActorObservation

## 6.3 What not to build

At this stage, do not over-build the following.

    BeliefGraph full taxonomy
    ActorPrediction
    ActorModelUpdate
    DMN Insight schema full version
    Graph DB
    Dedicated vector DB
    Complex salience scoring
    Decay policy
    Full privacy control

## 6.4 Design policy

The initial DB prioritizes the following over the beauty of normalization.

- append-only raw event
- source_ref required
- schema_version required
- LLM extraction results stored as candidate
- only user-approved records treated as committed
- keep JSON metadata as an escape hatch
- start graph edges from the minimum

## 6.5 Completion criteria

It is enough if the following can be done.

- User utterances can be stored
- AI responses can be stored separately from User Knowledge
- UserHypothesis can be stored with a source
- DecisionRecord / ActionRecord / ResultRecord can be stored
- Actor / ActorHypothesis / ActorObservation can be stored at a minimum
- InterventionLog can record which memory was used

# 7. HTAS:M2: Thin Agent Harness (= Positioning Phase D)

## 7.1 Purpose

Run LLM processing as a controlled pipeline.

What is built here is not an Agent that acts autonomously and freely.  
It is a fixed-workflow runner for Memory W/R.

## 7.2 Definition of the Thin Agent Harness

    Thin Agent Harness =
      LLM call orchestration
      structured output validation
      run trace
      prompt versioning
      model versioning
      retry / error handling
      memory read/write boundary
      fixture runner

## 7.3 What to build

Fixed workflow:

    User input
    ↓
    State classifier
    ↓
    Intent extractor
    ↓
    WRITE candidate extractor
    ↓
    Memory write policy
    ↓
    Retrieval planner
    ↓
    Memory retrieval
    ↓
    Reconnection selector
    ↓
    Response generator
    ↓
    InterventionLog / Feedback

Initial tools:

    MemoryReadTool
    MemoryWriteProposalTool
    InterventionLogTool
    FixtureRunner

What matters is making it `MemoryWriteProposalTool`, not `MemoryWriteTool`.

## 7.4 What not to build

At this stage, do not build the following.

- autonomous planner
- multi-agent system
- external tool execution
- email sending
- calendar changes
- file edit
- web automation
- OpenHands deep integration
- long-running background autonomy

## 7.5 Completion criteria

It is enough if the following can be done.

- A run_id is issued for one input
- The input/output of each step is traced
- LLM structured output is schema-validated
- WRITE candidates are extracted
- A READ plan is generated
- A final response is generated
- It can be run reproducibly with fixtures

# 8. HTAS:M3: WRITE Pipeline (= Positioning Phase C, write)

## 8.1 Purpose

From user input, AI responses, and external information, generate memory candidates to the correct storage destination and commit them as needed.

## 8.2 Pipeline

    Raw input
    ↓
    Candidate extraction
    ↓
    Destination classification
    ↓
    Commit / candidate / ignore decision
    ↓
    User confirmation if needed
    ↓
    Write
    ↓
    Audit log

## 8.3 WRITE destinations

    AI output
    → AIResponse

    External source
    → ExternalKnowledgeItem

    User hypothesis
    → UserHypothesis

    User question
    → Question

    User distinction
    → Distinction

    User decision
    → DecisionRecord

    User action
    → ActionRecord

    Observed result
    → ResultRecord

    Actor-related hypothesis
    → ActorHypothesis

    Actor-related observation
    → ActorObservation

## 8.4 Initial policy

Avoid automatic commit.

In particular, keep the following at candidate only.

- hypotheses proposed by the AI
- user understanding inferred by the AI
- an Actor's motives inferred by the AI
- generalities extracted from external materials
- judgments the user has not explicitly accepted

## 8.5 Completion criteria

The following can be validated against fixtures.

- AIResponse does not get mixed into UserHypothesis
- UserHypothesis gets a source_utterance attached
- AI proposals stay at candidate only
- they can be committed after user acceptance
- ActorHypothesis is also not committed directly
- DecisionRecord / ActionRecord / ResultRecord are correctly separated
- every commit is auditable

# 9. HTAS:M4: READ / Reconnection Pipeline (= Positioning Phase C, read)

## 9.1 Purpose

Rather than returning stored memory as search results, reconnect it to the current INTENT.

## 9.2 Pipeline

    User input
    ↓
    UserState detection
    ↓
    IntentFrame extraction / retrieval
    ↓
    Retrieval plan
    ↓
    Candidate retrieval
    ↓
    Ranking
    ↓
    Suppression / defer
    ↓
    1〜3 surfaced memories
    ↓
    CEN / ACC / DMN output

## 9.3 READ policy

### Execution

Retrieval candidates:

- active IntentFrame
- related DecisionRecord
- related ActionRecord
- high-risk constraints
- ActorHypothesis related to target_actor_ids
- pending Action / Result

Output policy:

- answer first
- at most 1 caveat
- state the next action explicitly
- do not do long exploration

### Decision

Retrieval candidates:

- related UserHypothesis
- past DecisionRecord
- rejected options
- assumptions
- reversibility
- ActorPrediction / ActorObservation

Output policy:

- compress the decision criteria
- separate reversible / irreversible
- recommend in principle a single option
- defer non-critical uncertainty

### Research / Exploration

Retrieval candidates:

- Question
- UserHypothesis
- Distinction
- unresolved loop
- related ActorHypothesis
- past discomfort

Output policy:

- branches over conclusions
- counter-hypotheses
- higher-level concepts
- future decision point

### Overload

Retrieval candidates:

- active IntentFrame
- immediate next action
- critical blocker only

Output policy:

- only the next one
- park everything else
- avoid tables and exhaustive explanations

## 9.4 Completion criteria

The following can be validated against fixtures.

- does not surface all related memory
- can narrow to 1–3 items
- can prioritize the memory type matching the UserState
- can record suppression / defer
- can prioritize the user's own hypotheses / judgments / utterances over AI external knowledge
- the response does not break INTENT

# 10. HTAS:M5: Mode-aware Chat Prototype (= PRD Phase 1 / Positioning Phase E)

## 10.1 Purpose

Validate whether, compared to a standard LLM chat, state-specific output control makes it feel lighter.

## 10.2 What to build

- Chat UI
- UserState classifier
- 5 modes
  - Execution
  - Research
  - Decision
  - Defense
  - Overload
- mode-specific response constraints
- Feedback buttons
  - useful
  - too much
  - wrong mode
  - ignored
  - acted on
- InterventionLog viewer

## 10.3 What not to build

- a perfect memory editor
- full graph UI
- autonomous agent
- external tool execution
- full desktop packaging

## 10.4 Completion criteria

The following can be evaluated manually.

- can reply briefly during Execution
- can avoid premature conclusions during Research
- can compress the decision criteria during Decision
- can return only the next one item during Overload
- can collect wrong mode feedback
- can hold suppressed_items per response

# 11. HTAS:M6: Desktop Shell Spike

## 11.1 Purpose

Validate the outer shell as a desktop app.

Decide Tauri or Electron here.

## 11.2 Candidates

### First choice

    Tauri + Vue + Pinia
    Python backend as local sidecar
    Django API
    SQLite or PostgreSQL
    Agent Harness in Python

### Alternative

    Electron + Vue + Pinia
    Python backend as local process
    Django API
    SQLite or PostgreSQL
    Agent Harness in Python

## 11.3 Reasons to prefer Tauri

- easy to build a lightweight desktop shell
- can use a Vue / TS frontend
- there may be a possibility of bundling the Python backend as a sidecar
- Rust can be limited to the shell / native boundary

## 11.4 Conditions to fall back to Electron

Fall back to Electron if any of the following is heavy.

- Tauri sidecar packaging is too complex
- Python backend lifecycle management is unstable
- Node/Electron is faster for OpenHands integration
- dev iteration is slow
- desktop integration gets stuck

## 11.5 What to look at in the Spike

- can the Python backend be started from the desktop shell
- can the backend lifecycle be controlled
- can stdout / stderr / log be captured
- can it connect stably to the local API
- does packaging not break
- can OpenHands be isolated as a separate process
- can the local DB path / user data path be handled

## 11.6 Completion criteria

Decide whether it is Tauri or Electron.

Deciding criteria:

    Tauri:
      adopt if sidecar operation is acceptable

    Electron:
      adopt if prioritizing the speed and stability of local process / OpenHands integration

# 12. HTAS:M7: Actor Model MVP

## 12.1 Purpose

Connect the subjects that appear in the user's world to memory.

The Actor Model is a subject model for handling "who a hypothesis / observation / judgment is about" in Memory W/R.

## 12.2 What to build

Must Have:

    Actor
    ActorHypothesis
    ActorObservation

    UserHypothesis.subject_actor_ids
    ActionRecord.target_actor_ids
    ResultRecord.observed_actor_ids

## 12.3 Deferred

    ActorPrediction
    ActorModelUpdate
    ActorRelation
    Actor Card full UI
    Prediction Review
    Actor pattern detection via DMN

## 12.4 WRITE policy

- creating an Actor is not creating a hypothesis
- an Actor is a container for a subject
- ActorHypothesis is a hypothesis placed by the user
- an Actor hypothesis inferred by the AI stays at candidate only
- commit it only after the user accepts / modifies / rejects it

## 12.5 READ policy

Execution:

- read ActorHypothesis tied to target_actor_ids

Decision:

- read hypotheses / past observations about the Actor under judgment

Exploration:

- read discomfort, unevaluated hypotheses, and observations about the Actor

## 12.6 Completion criteria

The following loop runs.

    User places a hypothesis about an Actor
    ↓
    Saved as ActorHypothesis
    ↓
    Observe the Actor's behavior
    ↓
    Saved as ActorObservation
    ↓
    Reconnected at the time of current judgment / action

# 13. HTAS:M8: ACC Monitor MVP (= PRD Phase 3)

## 13.1 Purpose

Detect when the user enters Execution still facing the wrong direction.

The ACC Monitor is not a brake but lane keeping.

## 13.2 What to build

- ActionFrame extraction
- Misalignment risk scoring
- Correction level decision
- Guardrail output
- Pause output
- InterventionLog integration

## 13.3 What to detect

    Goal Mismatch
    Premise Error
    Constraint Violation
    Irreversibility Error
    Avoidance-disguised Execution
    Local Optimum Trap

## 13.4 Initial Correction Levels

    Level 0: Silent
    Level 1: Guardrail
    Level 2: One-question Checkpoint
    Level 3: Low-risk Experiment
    Level 4: Pause

## 13.5 Completion criteria

The following can be evaluated with fixtures.

- does not over-stop reversible actions
- can warn strongly on irreversible actions
- does not break Execution momentum
- can cross-check against user goal / hypothesis / constraint
- can detect actions that contradict ActorHypothesis

# 14. HTAS:M9: DMN Batch MVP (= PRD Phase 4)

## 14.1 Purpose

Rather than synchronous chat, surface InsightCards as background integration.

## 14.2 What to build

- DMN batch runner
- InsightCandidateGenerator
- InsightSurfacePolicy
- InsightCard
- deferred_items resurfacing
- Feedback integration

## 14.3 Initial inputs

- recent Utterance
- UserHypothesis
- DecisionRecord
- ActionRecord
- ResultRecord
- unresolved Question
- ActorHypothesis
- ActorObservation
- suppressed_items / deferred_items

## 14.4 Output policy

- at most 3 items per batch
- do not interrupt during execution
- surface only when judged "worth surfacing now"
- by default, a deferred InsightCard

## 14.5 Celery / Redis adoption decision

In this Phase, bring in Celery / Redis if needed.

Conditions to bring it in:

- LLM reasoning jobs are long
- you want to queue-manage batch jobs
- retry / timeout is needed
- embedding / indexing updates are heavy
- it conflicts with OpenHands jobs
- scheduled DMN is needed

A simple worker is fine at first.

    v0:
      synchronous runner
      simple background process
      append-only RunLog

    v1:
      Celery + Redis

    v2:
      job priority
      cancellation
      scheduled DMN
      OpenHands job queue

# 15. HTAS:M10: OpenHands Integration

## 15.1 Purpose

Use OpenHands for codebase operations such as glob / grep / file read / file edit / test execution.

OpenHands is not the memory brain.  
OpenHands is a coding-agent subsystem.

## 15.2 Scope of use

Good:

    OpenHands:
      glob
      grep
      file read
      file edit
      repo inspection
      test execution
      codebase-local automation

Bad:

    OpenHands:
      commit directly to UserUnderstanding
      confirm ActorHypothesis on its own
      make the final judgment on Reconnection
      own the Memory W/R policy
      confirm INTENT

## 15.3 Integration method

Isolate OpenHands in one of the following ways.

    sidecar process
    local server
    subprocess
    containerized worker

It does not couple directly with the Memory core.

    App Core
    ↓
    OpenHands Adapter
    ↓
    OpenHands process / SDK / server

## 15.4 Completion criteria

It is enough if the following can be done.

- can glob in a specified workspace
- can grep
- can file read
- can dry-run file edit
- can store the result as ActionObservation
- the memory commit is done by App Core, not by OpenHands

# 16. HTAS:M11: External Tooling / Full Agent Harness (= PRD Phase 5)

## 16.1 Purpose

Handle external tool execution such as email, calendar, documents, tasks, and browser.

Only at this stage is a Full Agent Harness considered.

## 16.2 What to build

- tool registry
- permission model
- human approval
- irreversible action guard
- durable run state
- pause / resume
- tool result capture
- action-result learning loop

## 16.3 Target tools

    Email
    Calendar
    Documents
    Tasks
    Browser
    External APIs
    OpenHands

## 16.4 Rules

Irreversible operations must always interpose human approval.

    Draft email
    → OK

    Send email
    → approval required

    Read calendar
    → OK

    Create / move meeting
    → approval required

    Read file
    → OK

    Edit file
    → approval or sandbox required

    Commit UserUnderstanding
    → policy + user confirmation when needed

## 16.5 Completion criteria

The following hold.

- the Agent can use external tools
- tool calls are traced
- it stops before an irreversible action
- the action result enters ResultRecord
- ResultRecord is connected to Hypothesis Update
- the Full Agent does not break the Memory W/R policy

# 17. Software stack policy

## 17.1 What to decide now

It is fine to decide the following at this point.

    Backend / Domain Core:
      Python

    Package / project management:
      uv

    Web framework:
      Django

    Frontend:
      TypeScript
      Vue
      Pinia

    Agent Harness:
      Python fixed workflow runner

    Memory W/R:
      Python domain services

    OpenHands:
      external coding-agent subsystem

## 17.2 What not to decide yet

    Desktop shell:
      Tauri vs Electron

    DB:
      SQLite-first vs PostgreSQL-first

    Worker:
      simple worker vs Celery + Redis

    Vector DB:
      built-in / pgvector / dedicated vector DB

    Graph DB:
      not yet

    Rust:
      Tauri shell / native boundary only

## 17.3 Recommended initial setup

    Frontend:
      TypeScript
      Vue
      Pinia

    Backend:
      Python 3.12+
      uv
      Django

    DB:
      SQLite or PostgreSQL behind repository interface

    Agent Harness:
      Python
      structured output validation
      run trace
      fixture runner

    Desktop:
      Tauri-first spike
      Electron fallback

    Async:
      simple local worker first
      Celery + Redis later

    OpenHands:
      sidecar / local server / subprocess

## 17.4 Rust policy

Do not bring Rust into the domain core for now.

Areas where it is fine to bring in Rust:

- Tauri shell
- native integration
- sidecar management
- file watcher
- local indexing performance
- encryption / secure storage
- performance-critical boundary

Areas to avoid Rust:

- Memory W/R policy
- User Understanding extraction
- Reconnection policy
- ACC policy
- DMN logic
- Agent Harness orchestration

Reasons:

- the hard part right now is not performance
- the hard part is W/R policy
- the hard part is separating AI external knowledge from User Understanding
- the hard part is reconnection and suppression
- the hard part is traceability
- Python has higher exploration speed

## 17.5 Django policy

It is fine to adopt Django initially.

Reasons:

- easy to manage schema
- admin / migration / ORM are available
- can be steered toward both SQLite and PostgreSQL
- easy to turn into an API
- handled in the same language as the Python Agent Harness

However, do not cram too much domain logic into Django.

    Django models:
      persistence

    Domain services:
      MemoryWritePolicy
      ReconnectionPolicy
      StatePolicy
      IntentPolicy
      ACCPolicy
      CognitiveLoadPolicy

    Agent Harness:
      workflow execution
      trace
      LLM calls

## 17.6 Tauri / Electron policy

Initial judgment:

    Tauri-first spike
    Electron fallback

Conditions to adopt Tauri:

- can start the Python backend stably as a sidecar
- packaging is acceptable
- log / lifecycle management is possible
- can isolate OpenHands integration as an external process

Conditions to fall back to Electron:

- sidecar management is too much trouble
- local process orchestration is faster with Electron
- OpenHands integration is easier to implement with Electron
- want to prioritize dev iteration speed

## 17.7 Celery / Redis policy

Do not bring it in at first.

Adoption conditions:

- DMN batch is needed
- long-running LLM jobs increase
- retry / timeout / queue management is needed
- embedding updates are heavy
- want to run OpenHands jobs in the background
- scheduled task is needed

Until then, a simple worker / local process / in-process queue is fine.

# 18. Architecture boundaries

## 18.1 Recommended setup

    Desktop UI
    ↓
    Local API
    ↓
    Agent Harness / Orchestrator
    ↓
    Domain Services
      - StateDetector
      - IntentExtractor
      - MemoryWritePolicy
      - ReconnectionResolver
      - ACCMonitor
      - CognitiveLoadGovernor
    ↓
    Memory Services
      - SourceOfTruthStore
      - VectorIndex
      - GraphIndex
      - AuditLog
    ↓
    External Subsystems
      - LLM Providers
      - OpenHands
      - Web Search
      - Tools

## 18.2 Responsibilities the Harness owns

Agent Harness should own:

    LLM call execution
    structured output validation
    step trace
    retry
    timeout
    tool invocation boundary
    human approval hooks
    fixture runner

## 18.3 Responsibilities the Harness does not own

Agent Harness should not own:

    what counts as User Understanding
    what can be committed
    what should be suppressed
    what INTENT means
    what ACC risk means
    what memory is source-of-truth

These are placed in domain services.

# 19. Fixture Strategy

## 19.1 Purpose

Before loading production data, evaluate the W/R policy by hand.

## 19.2 The first fixtures to build

    1. User tries to save AI output as-is
    2. User states a hypothesis
    3. User adopts an AI suggestion
    4. User makes a judgment
    5. User takes an action
    6. A result comes out
    7. A result contradicting a past hypothesis comes out
    8. User tries to take a divergent action in execution mode
    9. A hypothesis about an Actor turns out wrong
    10. A past ADR takes effect during Decision
    11. Surfacing too much memory during Overload causes failure
    12. Drawing a conclusion too early during Research causes failure

## 19.3 WRITE evaluation

    Did it go into the correct storage location
    Is AI output free of contamination into User Understanding
    Did it avoid committing what should stay at candidate
    Can it be traced to source_utterance
    Can it commit after User acceptance
    Is ActorHypothesis kept from being treated as fact

## 19.4 READ evaluation

    Did the 1–3 items that should surface now surface
    Were the items that should not surface suppressed
    Does it match UserState
    Did it avoid breaking INTENT
    Did it avoid breaking Execution momentum
    Could it compress the judgment criteria during Decision
    Could it surface branches during Research
    Could it return just one item during Overload

# 20. First implementation milestones

## Milestone 1: Memory I/O Contract complete

Deliverables:

    Memory I/O Contract v0.1
    Fixture set v0.1

## Milestone 2: Minimal DB

Deliverables:

    Django models
    migration
    seed fixtures
    admin or simple viewer

## Milestone 3: Thin Harness

Deliverables:

    Run trace
    LLM structured output
    fixture runner
    WriteCandidateExtractor
    RetrievalPlanner

## Milestone 4: WRITE validation

Deliverables:

    MemoryWritePolicy
    Candidate / committed split
    User confirmation mock
    AuditLog
    WRITE fixture pass

## Milestone 5: READ validation

Deliverables:

    ReconnectionResolver
    SuppressionDecider
    ReconnectionResult
    READ fixture pass

## Milestone 6: Mode-aware Chat

Deliverables:

    Chat UI
    UserState classifier
    mode-specific response
    Feedback buttons
    InterventionLog viewer

## Milestone 7: Desktop Shell Decision

Deliverables:

    Tauri spike result
    Electron fallback result
    desktop shell decision

# 21. Recommended judgment at this point

At this point, proceed with the following.

    Start with:
      Python
      uv
      Django
      TypeScript
      Vue
      Pinia

    Use:
      Thin Agent Harness
      MemoryWriteProposalTool
      ReconnectionResolver
      Fixture runner

    Do not start with:
      Full autonomous agent
      OpenHands deep integration
      Celery + Redis
      Rust domain core
      Graph DB
      Full DMN
      External tool execution

Validate the desktop shell Tauri-first.  
However, if Tauri sidecar operation is heavy, fall back to Electron.

Use OpenHands.  
However, use it as a coding-agent subsystem, not as the memory brain.

What should be built first is neither a smart Agent nor a finished DB.

    What should be built first:
      Memory I/O Contract
      Minimal source-of-truth DB
      Thin Agent Harness
      WRITE / READ fixture evaluation

In this order, the product's core — "separating AI external knowledge from user understanding," "reconnection to the current INTENT," and "cognitive load control" — can be validated from the early stage of implementation.
