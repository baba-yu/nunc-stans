# Additional Specification: Actor Model

## 1. Positioning

The Actor Model is the subject model of the Human Thought Augmentation System.

In this system, an Actor is an acting subject that appears in the user’s world.

An Actor is not merely a contact, a person record, a CRM customer, or a document author.  
An Actor is a subject about whom the user forms hypotheses, makes predictions, observes behavior, and updates their understanding.

The purpose of the Actor Model is to augment the user’s thinking through the following loop:

    There are actors in my world
    ↓
    I form hypotheses about their background, constraints, goals, and tendencies
    ↓
    Those hypotheses generate predictions about their next actions or reactions
    ↓
    I observe their actual actions, statements, and reactions
    ↓
    I compare observations against hypotheses and predictions
    ↓
    I update my model of that Actor
    ↓
    I reconnect that updated model to current decisions and actions

## 2. Design Principles

### 2.1 An Actor is a subject, not a hypothesis

Do not place hypotheses, predictions, or observations directly inside the Actor record.

An Actor is a long-lived subject.  
ActorHypothesis, ActorPrediction, ActorObservation, and ActorModelUpdate accumulate around the Actor over time.

    Actor
    ├── ActorHypothesis[]
    │   └── ActorPrediction[]
    ├── ActorObservation[]
    └── ActorModelUpdate[]

### 2.2 An Actor exists inside the user’s world

An Actor is not necessarily a fully objective entity in the external world.

In this system, an Actor is a subject as represented inside the user’s world model.

Therefore, records about an Actor should generally be treated as one of the following:

- A hypothesis held by the user
- A prediction made by the user
- A behavior observed by the user
- An understanding accepted, modified, or rejected by the user
- Reference information stored as external knowledge

### 2.3 Inferences about Actors are hypotheses, not facts

Statements about an Actor’s background, intent, constraints, personality, capability, preferences, strategy, or relationships should generally be stored as ActorHypothesis, not as facts.

Example:

    Bad:
    Customer A is not price-sensitive.

    Good:
    The user currently holds the hypothesis that Customer A cares more about implementation burden than price.

### 2.4 AI and external actors do not directly become User Understanding

AI systems, external people, organizations, documents, and tools can all be Actors.

However, their statements and outputs do not directly enter the User Understanding Layer.

They can connect to User Understanding only when the user accepts, modifies, or rejects them.

### 2.5 Separate created_at, generated_at, observed_at, and evaluated_at

The Actor Model must separate time fields clearly.

- `created_at`
  - When the record was created in the system
- `generated_at`
  - When a hypothesis or prediction was generated
- `observed_at`
  - When the behavior, statement, or reaction was actually observed
- `evaluated_at`
  - When a hypothesis, prediction, and observation were compared

This separation allows the system to handle delayed observation entry and retrospective evaluation.

## 3. Data Model

### 3.1 Actor

    Actor {
      id
      type: self | ai | person | organization | team | tool | system | document_source
      name
      aliases
      relationship_to_user
      description
      privacy_level
      status: active | inactive | archived
      created_at
      updated_at
    }

#### Field Notes

- `self`
  - The user
- `ai`
  - AI assistant, AI agent, or AI system
- `person`
  - Customer, cofounder, investor, friend, candidate, etc.
- `organization`
  - Company, customer organization, competitor, investor organization, etc.
- `team`
  - Internal team, project team, customer-side team, etc.
- `tool`
  - A tool with which the user interacts
- `system`
  - A product, business system, market structure, or other entity treated as behaviorally relevant
- `document_source`
  - The issuing subject behind a document, article, report, or external information source

## 4. ActorRelation

ActorRelation represents relationships between Actors.

    ActorRelation {
      id
      from_actor_id
      to_actor_id
      relation_type: knows | works_with | reports_to | manages | sells_to | buys_from | competes_with | influences | trusts | distrusts | depends_on | blocks | supports | unknown
      description
      confidence
      source_utterance_ids
      created_at
      updated_at
    }

Example:

    ActorRelation {
      from_actor_id: self
      to_actor_id: investor_A
      relation_type: sells_to
      description: "In a fundraising context, the user is presenting the company as an investment opportunity."
      confidence: 0.8
    }

## 5. ActorHypothesis

ActorHypothesis represents a hypothesis the user holds about an Actor.

    ActorHypothesis {
      id
      subject_actor_id
      held_by_actor_id
      statement
      hypothesis_type: motive | preference | constraint | capability | belief | strategy | risk | relationship | incentive | attention | communication_style
      background_assumptions
      evidence
      counter_evidence
      confidence
      status: active | supported | contradicted | weakened | abandoned | superseded
      source_utterance_ids
      generated_at
      created_at
      updated_at
    }

### Field Notes

- `subject_actor_id`
  - The Actor the hypothesis is about
- `held_by_actor_id`
  - The Actor who holds the hypothesis
  - Usually `self`
- `background_assumptions`
  - Background assumptions that make the hypothesis plausible
  - These are also treated as hypotheses, not facts
- `hypothesis_type`
  - The aspect of the Actor being hypothesized about

Example:

    ActorHypothesis {
      subject_actor_id: customer_A
      held_by_actor_id: self
      statement: "This customer cares more about implementation burden than price."
      hypothesis_type: preference
      background_assumptions: [
        "The operational cost of workflow change is blocking adoption.",
        "The decision-maker is more afraid of internal rollout failure than price."
      ]
      evidence: [
        "In the previous sales call, they asked about operations rather than price.",
        "They repeatedly asked about integration with existing tools."
      ]
      confidence: 0.62
      status: active
      generated_at: 2026-06-18T10:00:00
    }

## 6. ActorPrediction

ActorPrediction represents a prediction about an Actor’s future behavior, reaction, or decision derived from an ActorHypothesis.

    ActorPrediction {
      id
      actor_hypothesis_id
      subject_actor_id
      predicted_behavior
      predicted_context
      expected_observation
      time_horizon
      confidence
      status: pending | observed | missed | contradicted | expired
      created_at
      due_at
      observed_at
    }

### Field Notes

- `predicted_behavior`
  - How the Actor is expected to behave
- `predicted_context`
  - The context in which the predicted behavior is expected to occur
- `expected_observation`
  - What must be observed for the prediction to be considered supported
- `status`
  - Whether the prediction is pending, supported, missed, contradicted, or expired

Example:

    ActorPrediction {
      actor_hypothesis_id: hyp_123
      subject_actor_id: customer_A
      predicted_behavior: "They will ask about implementation steps and integration with existing tools rather than price."
      predicted_context: "When shown the demo in the next sales call."
      expected_observation: "They ask at least two questions about operational burden rather than pricing."
      time_horizon: "next_meeting"
      confidence: 0.7
      status: pending
      created_at: 2026-06-18T10:05:00
    }

## 7. ActorObservation

ActorObservation represents an actually observed statement, action, reaction, non-action, decision, or result from an Actor.

    ActorObservation {
      id
      subject_actor_id
      observed_behavior
      observation_type: utterance | action | reaction | non_action | decision | result
      observed_at
      source_type: chat | email | meeting | calendar | document | manual_note | tool_event
      source_ref_id
      related_action_id
      related_result_id
      reliability
      created_at
    }

### Field Notes

- `observed_behavior`
  - What was actually observed
- `observation_type`
  - Statement, action, reaction, silence, decision, result, etc.
- `observed_at`
  - When the observed behavior actually occurred
- `created_at`
  - When the observation was recorded in the system
- `source_ref_id`
  - Reference to the original email, meeting note, chat, document, or tool event

Example:

    ActorObservation {
      subject_actor_id: customer_A
      observed_behavior: "They did not react to price, but asked about CRM integration and training cost for frontline staff."
      observation_type: utterance
      observed_at: 2026-06-25T14:00:00
      source_type: meeting
      reliability: high
      created_at: 2026-06-25T15:10:00
    }

## 8. ActorModelUpdate

ActorModelUpdate represents the evaluation result from comparing ActorHypothesis, ActorPrediction, and ActorObservation.

    ActorModelUpdate {
      id
      actor_hypothesis_id
      actor_prediction_id
      actor_observation_id
      evaluation: supported | contradicted | partially_supported | inconclusive
      update_summary
      confidence_delta
      new_hypothesis_id
      evaluated_at
      created_at
    }

### Field Notes

- `evaluation`
  - Whether the observation supported, contradicted, partially supported, or failed to evaluate the hypothesis/prediction
- `confidence_delta`
  - How much the hypothesis confidence should change
- `new_hypothesis_id`
  - Reference to a new hypothesis generated from the observation, if any

Example:

    ActorModelUpdate {
      actor_hypothesis_id: hyp_123
      actor_prediction_id: pred_456
      actor_observation_id: obs_789
      evaluation: supported
      update_summary: "The hypothesis that implementation friction matters more than price became stronger."
      confidence_delta: +0.18
      evaluated_at: 2026-06-25T15:20:00
    }

## 9. Extensions to Existing Schemas

### 9.1 UserHypothesis

Add Actor connections to UserHypothesis.

    UserHypothesis {
      ...
      subject_actor_ids
      affected_actor_ids
    }

- `subject_actor_ids`
  - Actors the hypothesis is about
- `affected_actor_ids`
  - Actors affected if the hypothesis is true

### 9.2 DecisionRecord

Add related Actors to DecisionRecord.

    DecisionRecord {
      ...
      subject_actor_ids
      affected_actor_ids
    }

- `subject_actor_ids`
  - Actors that are the object of the decision
- `affected_actor_ids`
  - Actors affected by the decision

### 9.3 ActionRecord

Add target Actors to ActionRecord.

    ActionRecord {
      ...
      target_actor_ids
    }

- `target_actor_ids`
  - Actors targeted by the action
  - Example: emailing a customer, sending a deck to an investor, assigning a task to an AI agent

### 9.4 ResultRecord

Add observed Actors to ResultRecord.

    ResultRecord {
      ...
      observed_actor_ids
    }

- `observed_actor_ids`
  - Actors whose reaction or result was observed after the action

### 9.5 AIResponse

Add Assistant Actor and User Actor to AIResponse.

    AIResponse {
      ...
      assistant_actor_id
      user_actor_id
      session_id
    }

### 9.6 ExternalKnowledgeItem

Add source Actor to ExternalKnowledgeItem.

    ExternalKnowledgeItem {
      ...
      source_actor_id
    }

### 9.7 BeliefGraphNode

Add Actor-related node types to BeliefGraphNode.

    BeliefGraphNode {
      ...
      node_type:
        belief
        hypothesis
        question
        distinction
        evidence_standard
        decision_ref
        action_ref
        actor_ref
        actor_hypothesis_ref
        actor_prediction_ref
        actor_observation_ref
    }

### 9.8 BeliefGraphEdge

Add Actor Model edge types to BeliefGraphEdge.

    BeliefGraphEdge {
      ...
      edge_type:
        supports
        contradicts
        assumes
        derived_from
        tested_by
        updated_by
        led_to_decision
        about_actor
        predicts
        observed_as
        updates_actor_model
        affects_actor
    }

## 10. WRITE Policy

### 10.1 Actor WRITE

An Actor is created when:

- The user explicitly refers to a subject
- A recurring external person, organization, AI, or tool appears
- A subject is needed as the target of a DecisionRecord, ActionRecord, or ResultRecord
- A source subject is needed for an external document or meeting log

Creating an Actor does not mean creating a hypothesis.

The Actor is only the container for a subject.

### 10.2 ActorHypothesis WRITE

An ActorHypothesis is created when:

- The user explicitly states a hypothesis about an Actor
- The user interprets an Actor’s intent, constraints, preferences, capabilities, strategy, or risk
- The user accepts, modifies, or rejects an AI-proposed hypothesis
- An Actor-related hypothesis is needed as an assumption in a DecisionRecord or ActionRecord

An AI-generated inference about an Actor must not be committed directly as an ActorHypothesis.

AI inference is first treated as a candidate.

    AI-proposed Actor Hypothesis
    ↓
    User accepts / modifies / rejects
    ↓
    Commit to ActorHypothesis

### 10.3 ActorPrediction WRITE

An ActorPrediction is created when:

- A future behavior is explicitly predicted from an ActorHypothesis
- The user says that an Actor is likely to react in a specific way
- The expected outcome of an ActionRecord depends on a specific Actor’s reaction
- The reconsideration conditions of a DecisionRecord depend on an Actor’s behavior

### 10.4 ActorObservation WRITE

An ActorObservation is created when:

- An Actor’s statement is observed
- An Actor’s action is observed
- An Actor’s reaction is observed
- An Actor fails to take an expected action
- An Actor’s decision or result is observed

Non-action is also an observation.

Example:

    The expected reply did not arrive.

This can be stored as:

    observation_type = non_action

### 10.5 ActorModelUpdate WRITE

An ActorModelUpdate is created when:

- An ActorPrediction reaches its due point
- An ActorObservation corresponds to an ActorPrediction
- An observation supports, contradicts, or modifies an ActorHypothesis
- A ResultRecord after an action updates an ActorHypothesis

## 11. READ / Reconnection Policy

The Actor Model enables the following reconnections during READ / Retrieve.

### 11.1 Exploration Mode

During exploration, return questions, hypotheses, and discomforts related to Actors.

Return candidates:

- ActorHypothesis
- ActorRelation
- ActorObservation
- Unevaluated ActorPrediction

Example output:

    Previously, you held the hypothesis that Customer A cares more about implementation burden than price.

    Your current discomfort may be connected to that hypothesis.

### 11.2 Decision Mode

During decision-making, return assumptions, past decisions, and predictions related to the target Actor.

Return candidates:

- ActorHypothesis
- ActorPrediction
- DecisionRecord
- Past ActorModelUpdate

Example output:

    This decision depends on the hypothesis that Customer A cares more about implementation burden than price.

    Since this is based on only one observation, it may be safer to run a smaller confirmation before a full rollout.

### 11.3 Action Mode

During action, return what the user expects from the target Actor.

Return candidates:

- ActorHypothesis linked to `target_actor_ids`
- Pending ActorPrediction
- ActionRecord expected outcome
- Assumption-collapse conditions

Example output:

    The purpose of this email is to test whether Customer A reacts to implementation burden.

    Before sending, adjust the wording so that it elicits operational concerns rather than pricing feedback.

### 11.4 Connection to ACC Monitor

The ACC Monitor uses `target_actor_ids` in ActionRecord to retrieve hypotheses, predictions, and observations related to the target Actor.

Misalignment risk increases when:

- The current action contradicts an ActorHypothesis
- The user is taking an irreversible action based on an untested ActorPrediction
- Recent ActorObservation contradicts the old hypothesis being relied on
- The user is relying on an outdated ActorHypothesis
- ActorRelation indicates large side effects on another Actor

### 11.5 Connection to DMN Engine

The DMN Engine scans ActorModelUpdate records to detect:

- Changes in hypotheses about the same Actor
- Behavioral patterns shared across multiple Actors
- Repeated user mispredictions about a specific Actor
- Relationship changes
- Unevaluated ActorPrediction records
- ActorHypothesis records that have observations but no update

## 12. UX Requirements

### 12.1 Actor Card

Each Actor should have an Actor Card.

    Actor Card {
      actor
      current_hypotheses
      active_predictions
      recent_observations
      model_updates
      related_decisions
      related_actions
    }

### 12.2 Prediction Review

The system should allow periodic review of unevaluated ActorPrediction records.

Example:

    You previously predicted that Customer A would react to implementation burden.

    In the June 25 sales call, they asked about CRM integration and training cost for frontline staff.

    Should this prediction be considered supported?

### 12.3 Pre-commit Friction

Before saving an ActorHypothesis, the system may ask:

- Is this a hypothesis rather than a fact?
- What evidence supports it?
- What would contradict it?
- What should be observed next?

### 12.4 Privacy

The Actor Model contains inferences about other people and organizations, so it must support higher privacy levels than ordinary memory records.

Handle the following with particular care:

- Inferred motives
- Personality inference
- Capability evaluation
- Trust or distrust
- Relationship dynamics
- Risk evaluation
- Inferred defensiveness or vulnerabilities

## 13. Non-goals

The Actor Model is not intended to:

- Permanently label people
- Treat inferred inner states as facts
- Fully replace CRM
- Fully manage organization charts
- Perform psychological diagnosis
- Support manipulative persuasion
- Automatically finalize AI-generated personality judgments

## 14. MVP Scope

### Must Have

- Actor
- ActorHypothesis
- ActorObservation
- Add `subject_actor_ids` to UserHypothesis
- Add `target_actor_ids` to ActionRecord
- Add `observed_actor_ids` to ResultRecord
- Treat AI-proposed ActorHypothesis as candidates
- Commit only after user acceptance

### Should Have

- ActorPrediction
- ActorModelUpdate
- Actor Card
- Prediction Review
- ACC Monitor integration

### Could Have

- ActorRelation
- Relationship graph across multiple Actors
- Actor pattern detection by DMN
- Actor-specific salience decay
- Actor-specific privacy controls

## 15. Definition of Done

The Actor Model is working when the user can complete this loop:

    The user forms a hypothesis about an Actor
    ↓
    The hypothesis generates a prediction
    ↓
    The Actor’s actual behavior, statement, or reaction is observed
    ↓
    The hypothesis and prediction are compared against the observation
    ↓
    The user’s understanding of the Actor is updated
    ↓
    That updated understanding is reconnected to current exploration, decision, or action

The value of the Actor Model is not storing Actors.

Its value is that hypotheses, predictions, observations, and updates about Actors are reconnected to the user’s current decisions and actions.
