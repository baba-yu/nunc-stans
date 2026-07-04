# Memory I/O Contract & MVP Decision Record v0.1

Human Thought Augmentation System / Second-brain AI Agent

## 0. Positioning

This document is not the PRD itself, but the contract for Memory WRITE / READ / Reconnection / Thin Agent Harness that is fixed before entering MVP implementation. Its purpose is to prevent contamination between AI external knowledge and user understanding, and to make reconnection to the current INTENT verifiable.

## 1. Core Decisions

1. Make Memory I/O Contract v0.1 the first formal specification.
2. WRITE is commit, not save.
3. All WRITEs are candidate default.
4. Only user-approved / user-origin can be committed.
5. Do not mix AIResponse and UserUnderstanding.
6. The minimal DB separates Domain Memory and Event Log.
7. Artifact is cache. Not the source of truth.
8. UserState has two axes: thought_phase / interaction_mode.
9. IntentFrame allows missing values.
10. READ returns ReconnectionResult.
11. surfaced_items is at most 3.
12. Reconnection ranking starts heuristic.
13. The Thin Agent Harness is a fixed workflow runner.
14. The Fixture set v0.1 is 12 items.
15. ActorPrediction is not included in the MVP.
16. Only ACC hooks are added first; the body is HTAS:M8.
17. For the Continuity Kernel, only Event/Branch/Artifact/FrameLog are added first.
18. Desktop / OpenHands / Celery / Rust / Graph DB are deferred.

## 2. WRITE Destination Rules

| Input | Destination | Initial state |
|---|---|---|
| What the AI said | AIResponse | response history |
| External materials / Web / documents / research results | ExternalKnowledgeItem | committed external |
| A belief the user stated | UserBelief | can be committed |
| A hypothesis the user stated | UserHypothesis | can be committed |
| A question the user raised | Question | can be committed |
| A distinction the user drew | Distinction | can be committed |
| A judgment the user adopted / rejected | DecisionRecord | can be committed |
| An action the user takes / took | ActionRecord | can be committed |
| A result observed after the action | ResultRecord | can be committed |
| A user hypothesis about an Actor | ActorHypothesis | candidate or committed |
| An Actor's statement / action / reaction / inaction | ActorObservation | can be committed |

## 3. ReconnectionResult

```text
ReconnectionResult {
  user_state_id
  intent_frame_id
  route
  surfaced_items      // max 3
  suppressed_items
  deferred_items
  reason_for_surface
  intended_intervention
  cognitive_load_budget
  response_constraints
  memory_used
  external_knowledge_used
  tools_allowed
  tools_blocked
}
```

## 4. What We Build Next

1. Django models / migration
2. Fixture set v0.1
3. Thin Agent Harness
4. WRITE Pipeline
5. READ / Reconnection Pipeline
6. Mode-aware Chat Prototype
