# Continuity Kernel Design Document

## 1. Overview

The Continuity Kernel is the intermediate layer responsible for long-running session continuity, history compaction, branching, restoration, and evidence-backed context construction in LLM applications.

The goal is not to pass the full conversation to the LLM. The goal is to select only the information needed at each LLM call and construct it as an active frame in a verifiable form.

The Continuity Kernel is not a memory system.  
The memory system is a separate layer that stores user settings, project knowledge, long-term facts, external knowledge, preferences, the state of the working target, and so on.

The Continuity Kernel reconstructs the continuity needed for the current turn from multiple information sources, including those.

## 2. Design Goals

### 2.1 Problems to Solve

- The practical context window of a local LLM is finite
- In long conversations, dumping the full text is costly, slow, and unstable
- A rolling summary alone causes summary drift
- Making the summary the source of truth makes it impossible to verify later
- As a conversation grows long, decisions, constraints, open items, and working state scatter
- To handle forks and rollbacks naturally, conversation history must be treated as a DAG rather than a linear log
- Even a chat that looks continuous on the surface must be able to branch internally as a separate branch

### 2.2 Non-goals

- Improving the LLM's own long-text performance
- Becoming a general-purpose memory database that stores all memory
- Solving long-term context with a vector DB alone
- Compacting conversation history into a single summary
- Implementing an entire autonomous agent framework
- Becoming a UI state management framework

## 3. Terminology

### Continuity Kernel

The intermediate layer that maintains conversation and work continuity.

### Event

An immutable log unit such as a user utterance, assistant response, tool call, tool result, file diff, system note, or branch operation.

### Branch

A unit of branching for conversation or work.  
Close to a Git branch. Has a parent branch and a fork point.

### Active Frame

The final input context passed to a single LLM call.  
It corresponds to the conventional "context," but this design avoids the word context and calls it a frame.

### Artifact

Derived information generated from the raw event log.  
Summary, decision, constraint, task state, open question, entity state, and so on.

### Evidence Pointer

A reference to the raw event or span that an artifact is grounded in.

### Source of Truth

Always the raw event log.  
Not artifacts or summaries.

### Compaction

The process of generating and updating typed artifacts from raw events and converting them into a form usable for building the active frame.

### Frame Builder

The component that collects, ranks, validates, and packs the information needed for the current turn to produce the active frame.

## 4. Overall Architecture

    Chat UI / API
      ↓
    Continuity Kernel
      ├─ Event Store
      ├─ Branch Manager
      ├─ Artifact Store
      ├─ Retriever
      ├─ Compactor
      ├─ Validator
      ├─ Frame Builder
      └─ Budgeter
      ↓
    LLM Runtime
      ↓
    Model Output
      ↓
    Continuity Kernel
      ↓
    Event Store / Artifact Store

The Continuity Kernel operates both before and after the LLM call.

Before the call, it builds the active frame.  
After the call, it stores the assistant response as an event and updates artifacts as needed.

## 5. Core Principles

### 5.1 The raw log is append-only

Every utterance and operation is stored as a raw event.  
Past events are not modified.

When deletion is necessary, a tombstone event is added rather than a physical delete.

### 5.2 Artifacts are cache

Summary, decision, constraint, task state, and the like are not the source of truth.  
They must always be regeneratable from the raw event log.

### 5.3 Every important artifact has grounding

Artifacts must always carry source_event_ids or source_span_ids.

An artifact without grounding is not put into the active frame.

### 5.4 Branches are handled as a DAG

Session history is treated not as a linear array but as a branch DAG.

On fork, the entire conversation is not copied.  
It is resolved with the parent branch, fork event, and branch-local events.

### 5.5 The active frame is rebuilt every turn

The context passed to the LLM is not a fixed history but an active frame generated every turn.

### 5.6 Compaction does not produce a single summary

The output of compaction is decomposed into a set of typed artifacts.

- rolling summary
- task state
- decisions
- constraints
- open questions
- entities
- tool results
- file state
- user directives
- retrieval hints

## 6. Module Design

## 6.1 Event Store

### Role

Stores immutable raw events.

### Storage targets

- user message
- assistant message
- system note
- tool call
- tool result
- file edit
- branch fork
- branch merge
- artifact creation
- artifact invalidation
- user correction
- model error
- external document reference

### event schema

    {
      "id": "evt_01J...",
      "branch_id": "br_01J...",
      "parent_event_id": "evt_01J...",
      "event_type": "user_message",
      "role": "user",
      "content": "...",
      "metadata": {
        "model": null,
        "tool_name": null,
        "token_count": 512,
        "content_hash": "sha256:..."
      },
      "created_at": "2026-06-18T12:34:56Z"
    }

### event_type candidates

    user_message
    assistant_message
    system_note
    tool_call
    tool_result
    file_snapshot
    file_diff
    branch_fork
    branch_merge
    artifact_created
    artifact_superseded
    artifact_invalidated
    user_correction
    model_error
    external_reference

## 6.2 Branch Manager

### Role

Manages branching, rollback, comparison, and re-execution of conversation and work history.

### branch schema

    {
      "id": "br_01J...",
      "parent_branch_id": "br_01J_parent",
      "fork_event_id": "evt_01J_fork",
      "title": "alternate implementation strategy",
      "status": "active",
      "created_at": "2026-06-18T12:40:00Z"
    }

### branch operations

    create_branch()
    fork_branch(parent_branch_id, at_event_id)
    list_branches()
    resolve_visible_events(branch_id)
    compare_branches(branch_a, branch_b)
    archive_branch(branch_id)

### visible event resolution

    visible_events(branch) =
      parent lineage up to fork point
      + branch-local events
      + explicitly shared artifacts
      + branch-local artifacts

### Handling of forks

A fork is not a physical copy.  
It uses the parent pointer and fork point to resolve the visible history.

    main:
    evt1 → evt2 → evt3 → evt4

    fork from evt2:
    evt1 → evt2 → evt5 → evt6

## 6.3 Artifact Store

### Role

Stores derived information generated from raw events.

### artifact schema

    {
      "id": "art_01J...",
      "branch_id": "br_01J...",
      "artifact_type": "decision",
      "content": {
        "text": "Summary is not treated as source of truth.",
        "status": "active"
      },
      "source_event_ids": ["evt_01J_a", "evt_01J_b"],
      "source_span_ids": [],
      "confidence": 0.96,
      "created_by": {
        "model": "qwen3.6-27b",
        "prompt_version": "compactor_v1"
      },
      "source_hash": "sha256:...",
      "supersedes_id": null,
      "created_at": "2026-06-18T12:45:00Z"
    }

### artifact_type

    rolling_summary
    task_state
    decision
    constraint
    open_question
    entity
    user_directive
    user_preference
    project_fact
    tool_result_summary
    file_state
    error_history
    retrieval_hint

### artifact lifecycle

    candidate
      ↓
    validated
      ↓
    active
      ↓
    superseded / invalidated / archived

### Basic rules for artifacts

- Do not store an artifact whose source_event_ids is empty
- Always carry a confidence
- Always carry a branch_id
- If it contradicts an older artifact, set supersedes_id
- If the raw source is updated, deleted, or invalidated, re-validate the artifact too

## 6.4 Compactor

### Role

Generates and updates typed artifacts from raw events.

### Compaction targets

- the most recent new events
- the portion exceeding the token budget
- ranges explicitly marked for compaction
- the state at the branch fork point
- tool result
- file diff
- user correction

### compaction output

    {
      "task_state_delta": {},
      "decisions": [],
      "constraints": [],
      "open_questions": [],
      "entities": [],
      "user_directives": [],
      "file_state_updates": [],
      "obsolete_artifact_ids": []
    }

### Compaction prompt policy

    Extract durable working context from the provided events.

    Rules:
    - Extract only information directly supported by the events.
    - Do not infer missing facts.
    - Every extracted item must include source_event_ids.
    - Prefer omission over speculation.
    - Separate decisions, constraints, task state, open questions, and preferences.
    - Mark uncertainty explicitly.
    - Identify artifacts that are superseded by newer information.

### Kinds of compaction

#### Rolling Summary Compaction

Maintains an outline of older conversation.  
Lower importance. Used as a supplement in the active frame.

#### Decision Compaction

Extracts decisions.  
High priority in the active frame.

#### Constraint Compaction

Extracts user constraints, technical constraints, and environmental constraints.  
High priority in the active frame.

#### Task State Compaction

Updates the current working state.  
Close to top priority in the active frame.

#### Entity Compaction

Extracts and updates entities such as people, projects, files, services, models, and environments.

#### Tool Result Compaction

Shortens and structures large tool output.

#### File State Compaction

Records the change state of code and documents.

## 6.5 Validator

### Role

Validates artifacts generated by the LLM.

### validation pipeline

    artifact candidate
      ↓
    schema validation
      ↓
    source_event_ids existence check
      ↓
    source hash check
      ↓
    claim-source entailment check
      ↓
    contradiction check
      ↓
    deduplication
      ↓
    commit

### validation rules

- Discard an artifact that does not conform to the schema
- Discard an artifact whose source_event_ids do not exist
- If there is a proper noun not contained in the grounding span, set it to low confidence
- If it contradicts an existing artifact, keep both and treat it as a supersession candidate
- An artifact based on a user correction takes priority over existing artifacts
- Do not store model-generated inference as fact
- Do not store a preference without a source

## 6.6 Retriever

### Role

Retrieves candidate information to put into the active frame.

### retrieval families

#### Recency Retrieval

Retrieves recent events.

    last N user/assistant turns
    last M tool results
    branch-local recent events

#### Lexical Retrieval

Searches by BM25, keyword, file path, symbol name, and so on.

#### Semantic Retrieval

Retrieves related artifacts and event spans via embedding search.

#### Structural Retrieval

Retrieves from branch lineage, entity relation, decision graph, and temporal relation.

#### Pinned Retrieval

Retrieves artifacts that must always be included.

    active task_state
    active user directives
    active constraints
    branch-local decisions

### retrieval result schema

    {
      "target_type": "artifact",
      "target_id": "art_01J...",
      "score": 0.87,
      "retrieval_type": "semantic",
      "reason": "matches current task goal",
      "token_count": 420
    }

## 6.7 Budgeter

### Role

Decides the composition ratio of the active frame within a limited token budget.

### budget example: 64k tokens

    system / developer:        2k
    current user request:      2k
    recent turns:             10k
    task state:                4k
    constraints:               4k
    decisions:                 6k
    retrieved raw evidence:   24k
    summaries:                 6k
    tool scratch:              6k

### priority

    P0: system / developer rules
    P1: current user request
    P2: active task state
    P3: explicit user constraints
    P4: recent turns
    P5: branch-local decisions
    P6: raw evidence snippets
    P7: open questions
    P8: summaries
    P9: long-term memory candidates

### drop policy

The first to be dropped.

    low-confidence artifacts
    old assistant prose
    low-relevance summaries
    duplicate retrieval hits
    stale tool outputs
    generic discussion

The last to remain.

    current request
    user constraints
    active task state
    recent correction
    branch identity
    decision log

## 6.8 Frame Builder

### Role

Builds the active frame passed to the LLM.

### build flow

    1. Load branch metadata
    2. Load current user event
    3. Load pinned artifacts
    4. Load recent events
    5. Generate retrieval queries
    6. Retrieve candidate events/artifacts
    7. Validate candidate relevance
    8. Rank by priority and evidence quality
    9. Apply token budget
    10. Render active frame

### active frame structure

    [System Instructions]

    [Branch]
    - branch id
    - fork point
    - current goal

    [Current Request]
    - latest user message

    [Task State]
    - current goal
    - progress
    - known constraints
    - active assumptions

    [Recent Turns]
    - last N turns

    [Decisions]
    - durable decisions with source ids

    [Constraints]
    - explicit constraints with source ids

    [Evidence]
    - raw snippets relevant to the current request

    [Open Questions]
    - unresolved questions

    [Summaries]
    - compact background only when needed

### Rendering policy

- Separate artifacts and raw evidence
- Do not place summaries at the top
- Preserve evidence pointers
- Do not duplicate the current request
- Make explicit to the LLM that "there may be information outside this frame"
- Attach an uncertain label to uncertain artifacts

## 7. Boundary with the Memory System

The Continuity Kernel is not memory.

### What the Continuity Kernel handles

- session continuity
- branch continuity
- active frame construction
- compaction artifacts
- evidence pointers
- turn-level state
- working context
- task-local decisions
- task-local constraints

### What the Memory System handles

- long-term user profile
- user preference
- project-level knowledge
- organization knowledge
- document knowledge
- reusable facts
- embeddings over external corpora
- temporal knowledge graph
- persistent entity graph

### Connection method

The Continuity Kernel queries the Memory System but does not own the Memory System's contents.

    Frame Builder
      ↓
    Memory Adapter
      ↓
    Memory System
      ├─ user memory
      ├─ project memory
      ├─ document index
      └─ temporal graph

Information returned from the Memory System is not put into the active frame as-is.  
It is put in only after evaluating relevance, confidence, source, and recency.

## 8. Storage Design

### MVP configuration

    SQLite
      - events
      - branches
      - artifacts
      - spans
      - frame_logs

    sqlite-vec or external vector index
      - event embeddings
      - artifact embeddings

    FTS5
      - lexical search

### Production-leaning configuration

    Postgres
      - events
      - branches
      - artifacts
      - spans
      - frame_logs

    pgvector
      - embeddings

    tsvector / BM25 engine
      - lexical search

    object storage
      - large tool outputs
      - file snapshots

### tables

    CREATE TABLE branches (
      id TEXT PRIMARY KEY,
      parent_branch_id TEXT,
      fork_event_id TEXT,
      title TEXT,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      parent_event_id TEXT,
      event_type TEXT NOT NULL,
      role TEXT,
      content TEXT,
      metadata_json JSONB,
      content_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE spans (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      start_char INTEGER NOT NULL,
      end_char INTEGER NOT NULL,
      text TEXT NOT NULL,
      token_count INTEGER,
      content_hash TEXT NOT NULL
    );

    CREATE TABLE artifacts (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      status TEXT NOT NULL,
      content_json JSONB NOT NULL,
      source_event_ids TEXT[] NOT NULL,
      source_span_ids TEXT[],
      confidence REAL NOT NULL,
      source_hash TEXT NOT NULL,
      supersedes_id TEXT,
      created_by_json JSONB,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE frame_logs (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      user_event_id TEXT NOT NULL,
      frame_json JSONB NOT NULL,
      token_count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

## 9. API Design

### Python interface

    class ContinuityKernel:
        def append_event(self, branch_id: str, event: EventInput) -> Event:
            ...

        def fork_branch(
            self,
            branch_id: str,
            at_event_id: str,
            title: str | None = None,
        ) -> Branch:
            ...

        def build_frame(
            self,
            branch_id: str,
            user_message: str,
            token_budget: int,
            options: FrameOptions | None = None,
        ) -> ActiveFrame:
            ...

        def commit_assistant_response(
            self,
            branch_id: str,
            response: str,
            metadata: dict,
        ) -> Event:
            ...

        def compact(
            self,
            branch_id: str,
            since_event_id: str | None = None,
            mode: str = "incremental",
        ) -> list[Artifact]:
            ...

        def search(
            self,
            branch_id: str,
            query: str,
            filters: SearchFilters | None = None,
        ) -> list[RetrievalHit]:
            ...

        def get_evidence(self, artifact_id: str) -> list[EvidenceSpan]:
            ...

### build_frame output

    {
      "branch_id": "br_01J...",
      "token_count": 42120,
      "messages": [
        {
          "role": "system",
          "content": "..."
        },
        {
          "role": "user",
          "content": "..."
        }
      ],
      "included_items": [
        {
          "type": "artifact",
          "id": "art_01J...",
          "reason": "active constraint",
          "tokens": 120
        }
      ],
      "dropped_items": [
        {
          "type": "artifact",
          "id": "art_01J...",
          "reason": "low relevance under budget"
        }
      ]
    }

## 10. Per-turn Processing

### before LLM call

    1. Store the user message as an event
    2. Resolve the branch state
    3. Get pinned artifacts
    4. Build the retrieval query
    5. Get event/artifact/memory candidates
    6. Filter candidates with the validator
    7. Allocate tokens with the budgeter
    8. Generate the active frame with the frame builder
    9. Send to the LLM

### after LLM call

    1. Store the assistant response as an event
    2. Store the frame log
    3. Enqueue the compaction job
    4. Enqueue the embeddings update
    5. Enqueue the artifact validation job

## 11. Asynchronous Jobs

### jobs

    compact_recent_events
    extract_decisions
    extract_constraints
    update_task_state
    update_open_questions
    summarize_tool_results
    embed_new_spans
    validate_artifacts
    detect_contradictions
    refresh_branch_snapshot

### Job queue policy

- Do not wait for heavy compaction before returning the LLM response
- Run only the minimum synchronous processing needed for the active frame
- Make compaction idempotent by specifying an event id range
- Store job results as events too

## 12. Branch Snapshot

To read a branch's current state quickly, hold a snapshot.

### snapshot contents

    {
      "branch_id": "br_01J...",
      "head_event_id": "evt_01J...",
      "current_goal": "...",
      "active_constraints": [],
      "active_decisions": [],
      "open_questions": [],
      "recent_entities": [],
      "last_compacted_event_id": "evt_01J..."
    }

A snapshot is a cache.  
If it breaks, rebuild it from the event log and the artifact store.

## 13. Contradiction / Supersession

### Handling contradictions

Do not immediately delete a contradicting artifact.  
Keep both and manage them with status and a supersession relation.

    {
      "old_artifact_id": "art_old",
      "new_artifact_id": "art_new",
      "relation": "supersedes",
      "reason": "user correction",
      "source_event_ids": ["evt_correction"]
    }

### Priority

    user correction
      > explicit user message
      > tool result
      > external source
      > assistant inference
      > old summary

## 14. Security / Privacy

### Principles

- The raw log may contain confidential information
- Confidential information may also be derived into artifacts
- A mechanism is needed so that unnecessary information is not carried over on branch fork
- Writes to an external memory system are restricted by explicit policy

### redaction

Pass through a redaction hook before storage or before frame construction.

    PII
    API keys
    tokens
    credentials
    private URLs
    customer data

### audit

Store the frame log so that which information was passed to the LLM is traceable.

## 15. Observability

### Metrics to store

    active frame token count
    retrieval hit count
    artifact count by type
    artifact validation failure rate
    compaction latency
    frame build latency
    dropped item count
    branch count
    fork depth
    summary drift alerts
    contradiction count

### debug UI

At minimum, make the following visible.

    current branch
    visible event lineage
    active artifacts
    included frame items
    dropped frame items
    source evidence for each artifact
    fork tree
    compaction jobs

## 16. MVP Scope

### Continuity:Phase 0: Event log only

- events table
- branches table
- append_event
- fork_branch
- visible_events
- recent-turn frame builder

### Continuity:Phase 1: Typed artifact compaction

- task_state
- decisions
- constraints
- open_questions
- artifact schema validation
- make source_event_ids required

### Continuity:Phase 2: Retrieval

- FTS/BM25
- embeddings
- hybrid ranking
- artifact retrieval
- raw span retrieval

### Continuity:Phase 3: Branch-aware frame building

- branch-local artifacts
- parent lineage resolution
- fork-specific active frame
- frame logs

### Continuity:Phase 4: Validation and supersession

- contradiction detection
- user correction handling
- artifact supersession
- confidence management

### Continuity:Phase 5: External memory adapter

- user memory adapter
- project memory adapter
- document index adapter
- temporal graph adapter

## 17. What the MVP Does Not Implement

- full automation of branch merge
- fully autonomous memory writing
- a custom implementation of an external knowledge graph
- multi-agent orchestration
- the entire UI
- an end-to-end agent framework
- a complex permission model

## 18. Proposed Directory Structure

    continuity_kernel/
      __init__.py

      models/
        event.py
        branch.py
        artifact.py
        frame.py
        retrieval.py

      stores/
        event_store.py
        branch_store.py
        artifact_store.py
        frame_log_store.py

      retrieval/
        lexical.py
        semantic.py
        structural.py
        ranker.py

      compaction/
        compactor.py
        prompts.py
        artifact_extractors.py

      validation/
        schema_validator.py
        evidence_validator.py
        contradiction_detector.py

      frame/
        builder.py
        budgeter.py
        renderer.py

      memory_adapters/
        base.py
        user_memory.py
        project_memory.py
        document_index.py

      jobs/
        queue.py
        workers.py

      observability/
        traces.py
        metrics.py

## 19. Minimal Code Skeleton

    from dataclasses import dataclass
    from typing import Literal, Any


    @dataclass
    class Event:
        id: str
        branch_id: str
        event_type: str
        role: str | None
        content: str
        metadata: dict[str, Any]


    @dataclass
    class Artifact:
        id: str
        branch_id: str
        artifact_type: str
        content: dict[str, Any]
        source_event_ids: list[str]
        confidence: float
        status: Literal["candidate", "active", "superseded", "invalidated"]


    @dataclass
    class ActiveFrame:
        branch_id: str
        messages: list[dict[str, str]]
        included_items: list[dict[str, Any]]
        dropped_items: list[dict[str, Any]]
        token_count: int


    class ContinuityKernel:
        def __init__(
            self,
            event_store,
            branch_store,
            artifact_store,
            retriever,
            compactor,
            validator,
            frame_builder,
        ):
            self.event_store = event_store
            self.branch_store = branch_store
            self.artifact_store = artifact_store
            self.retriever = retriever
            self.compactor = compactor
            self.validator = validator
            self.frame_builder = frame_builder

        def append_user_message(self, branch_id: str, content: str) -> Event:
            event = Event(
                id=self.event_store.next_id(),
                branch_id=branch_id,
                event_type="user_message",
                role="user",
                content=content,
                metadata={},
            )
            self.event_store.append(event)
            return event

        def build_frame(
            self,
            branch_id: str,
            current_event: Event,
            token_budget: int,
        ) -> ActiveFrame:
            branch = self.branch_store.get(branch_id)
            recent_events = self.event_store.get_recent_visible_events(branch_id)
            pinned_artifacts = self.artifact_store.get_pinned(branch_id)
            retrieval_hits = self.retriever.retrieve(
                branch_id=branch_id,
                query=current_event.content,
                recent_events=recent_events,
                pinned_artifacts=pinned_artifacts,
            )

            return self.frame_builder.build(
                branch=branch,
                current_event=current_event,
                recent_events=recent_events,
                pinned_artifacts=pinned_artifacts,
                retrieval_hits=retrieval_hits,
                token_budget=token_budget,
            )

        def commit_assistant_response(
            self,
            branch_id: str,
            content: str,
            metadata: dict[str, Any],
        ) -> Event:
            event = Event(
                id=self.event_store.next_id(),
                branch_id=branch_id,
                event_type="assistant_message",
                role="assistant",
                content=content,
                metadata=metadata,
            )
            self.event_store.append(event)
            return event

## 20. Active Frame Rendering Example

    SYSTEM:
    You are operating with a reconstructed active frame. Treat artifact sections as derived context, not source of truth. Prefer evidence snippets when available.

    BRANCH:
    - branch_id: br_local_qwen_context
    - forked_from: br_main at evt_102
    - current_goal: Design a continuity layer for local LLM sessions.

    CURRENT USER REQUEST:
    Give me a design doc, assuming I'll build it myself...

    TASK STATE:
    - Goal: Define a self-hosted continuity mechanism for long-running local LLM chat.
    - Constraint: Do not treat summaries as source of truth.
    - Constraint: Memory system is a separate layer.

    RECENT TURNS:
    ...

    DECISIONS:
    - Use append-only raw event log as source of truth.
      source: evt_118
    - Use branch DAG rather than copying full logs on fork.
      source: evt_119

    EVIDENCE:
    [evt_118 span 0]
    ...

    OPEN QUESTIONS:
    - Should external memory be Graph-based or simple artifact store in MVP?

    BACKGROUND SUMMARY:
    ...

## 21. Failure Modes

### Summary Drift

Countermeasures:

- make summaries low-priority artifacts
- make evidence pointers required
- run periodic re-compaction from raw events

### Retrieval Pollution

Countermeasures:

- filter by branch lineage
- drop low-confidence artifacts
- use BM25 and structural retrieval alongside semantic search, not semantic search alone

### False Artifact

Countermeasures:

- schema validation
- source-event entailment check
- user correction priority
- confidence threshold

### Context Overpacking

Countermeasures:

- fix the token budget allocation
- prioritize decision/constraint/task_state over summaries
- store included/dropped logs

### Fork Contamination

Countermeasures:

- separate branch-local artifacts
- treat parent artifacts as read-only
- do not mix post-fork decisions into shared artifacts

## 22. Design Decisions

### Why not call it Context Engine

"context" is too broad.  
It readily evokes Notion-style information organization, RAG, document workspace, prompt assembly, and so on.

What this design handles is not document management but the continuity of LLM interaction.

### Why not call it Memory

memory is a broader concept and includes user memory, project memory, external knowledge, and long-term facts.  
The Continuity Kernel is not memory itself, but constructs the frame needed for the current turn from multiple information sources, including memory.

### Why Kernel

A kernel is the low-layer core that controls session, branch, artifact, and frame construction beneath the UI and agent framework.  
It is called from the application via a small API, and internally it arbitrates among multiple stores, retrievers, validators, and budgeters.

### Why Frame

The input passed to the LLM is not "all context."  
It is a limited working frame needed for the current turn.

## 23. Recommended Initial Implementation

At first, build only the following.

    Event Store
    Branch Manager
    Artifact Store
    Frame Builder
    Budgeter
    basic Compactor
    basic Validator
    FTS search

Vector search, temporal graph, and external memory adapter can come later.

The success condition for the first MVP is being able to do the following in long conversations.

    - Retain not only recent history but also past explicit constraints
    - Bring old decisions back into the active frame
    - Fork and continue a conversation with a different approach
    - Go back from an artifact to the raw event
    - Regenerate from the raw log even after deleting a summary
    - Audit what went into the active frame
