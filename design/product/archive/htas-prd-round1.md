The following summarizes the discussion so far as **PRD v0.1**.
There are still many research hypotheses, so this is less a specification than an **initial PRD for an exploratory product**.

# PRD v0.1: Second Brain with External Salience Control

## 1. Product Name

Working names:

* **External Brain**
* **State-Aware Second Brain**
* **Intent-Attached Memory**
* **Cognitive Router**
* **Second Brain OS**

In this PRD it is tentatively called **External Brain**.

---

## 2. One-liner

**External Brain is a state-adaptive decision-support system that, based on the user's current state, goals, and past context, selects the minimum necessary information from a memory DB, the Web, and agent functionality, and presents it at the appropriate timing and in the appropriate form.**

---

## 3. Problem

Existing second brains, PKMs, AI agents, and AI chat mainly suffer from the following problems.

### 3.1 Problems of existing second brains

* Obsidian, Notion, Mem, Logseq, and the like are mainly oriented toward **accumulation, organization, and search**
* Value emerges not at the moment of accumulation but at the moment a memory is connected to the current intent at the appropriate timing
* Yet existing tools do not adequately handle "when, what, at what granularity, and what should not be surfaced"

### 3.2 Problems of existing AI chat

* ChatGPT and Claude surface related information too broadly
* The following are mixed within a single answer

  * execution support
  * research support
  * caveats
  * alternatives
  * prompts for introspection
  * risk flagging
* As a result, even when the information is correct, the user's cognitive load increases
* The user has to re-integrate "so what should I actually do" on their own

### 3.3 Problems of existing agents

* OpenClaw and typical frontier-model agents are oriented toward execution capability
* They do not adequately observe the user's state, receptivity, defensiveness, hesitation, fatigue, or cognitive load
* There is a risk of rapidly assisting, in the wrong direction, a user who has entered execution mode pointed in the wrong direction

---

## 4. Core Insight

For humans, the same information is received differently depending on the current state.

### 4.1 Hypotheses about user states

* When wanting to execute

  * What is needed is an affirmative plan and a next action
  * Too many points of discussion get in the way

* When wanting to research

  * What is needed is affirmative exploration, points of discussion, and future branches
  * Conclusions that come too early narrow the field of view

* When hesitating

  * What is needed is compression of decision criteria, reversibility, and a recommendation
  * Adding too many options causes a halt

* When defensive

  * What is needed is not sound argument but safe-making and low-risk forward progress
  * Saying something too hard to hear triggers an ignore mode

* When overloaded

  * What is needed is not adding information but reducing it
  * Only "the next single thing" works

### 4.2 Hypothesis about the aha experience

An aha experience is not merely new information.

**An aha experience is when, relative to the current intent, latently relevant context is connected in a low-cognitive-load form, and the next question or action arises naturally.**

In other words, the product value is not the following.

* Surfacing a lot of information
* Comprehensively covering what is correct
* Increasing options
* Having the agent execute anything

The value lies in the following.

* Selecting what should be surfaced now
* Suppressing what should not be surfaced now
* Converting it into a form that fits the user's state
* Lightening the next state transition

---

## 5. Product Hypothesis

The core hypothesis of External Brain:

**If we estimate the user's current state and control DMN-like background insight, CEN-like execution support, the memory DB, Web search, and external tool execution with an SN-like router and an ACC-like mismatch-detection mechanism, then we can support research, judgment, execution, and introspection at a lower cognitive load than existing AI.**

---

## 6. Brain Metaphor

This product is not "a substitute for the whole brain."
It is designed as the following external cognitive loop.

### 6.1 DMN Engine

Default Mode Network–like background processing.

Role:

* Runs in the background independently of will
* Recombines past notes, conversations, actions, searches, and judgments
* Finds unconnected themes
* Produces insights as periodic batches
* Generates questions the user has not explicitly asked but that will matter in the future

Example outputs:

* "Your recent interests look separate, but they are actually converging on X"
* "A and B are hitting the same constraint"
* "Over these three weeks, you have been avoiding Y"
* "The next branch to investigate is Z"

Trigger timing:

* Morning
* Weekly review
* After meetings
* After completing large work
* After moving
* On detecting stagnation over a set period

### 6.2 CEN Engine

Central Executive Network–like foreground execution processing.

Role:

* Responds to the user's explicit intent
* Plans
* Judges
* Drafts
* Compares
* Turns things into tasks
* Converts things into executable artifacts

Example outputs:

* "You may proceed as is. The next three things are these"
* "Criterion A alone is sufficient for the decision"
* "This email can be answered like this"
* "The minimum action to do now is X"

Trigger timing:

* When the user asks a question
* When the user explicitly requests execution
* When the user requests a judgment

### 6.3 SN Router

Salience Network–like control system.

Role:

* Judges whether to activate CEN now
* Judges whether to surface DMN output now or later
* Decides what not to surface
* Decides at what granularity to surface
* Decides whether to interrupt or stay silent
* Selects the intervention form based on the user's state

The SN Router is not a generative system but a control system.

### 6.4 ACC Monitor

Anterior Cingulate Cortex–like error/conflict/mismatch detection system.

Role:

* Detects when the user has entered execution mode while still pointed in the wrong direction
* Detects mismatches between local intent and higher-level goals
* Detects premise errors
* Detects constraint violations
* Detects premature transition to irreversible actions
* Detects states where avoidance looks like execution

Important:

* The ACC Monitor must not stop the user's execution every time
* Its role is not a brake but lane-keeping
* Intervention should be minimal

---

## 7. Core Architecture

```text
External Brain
├─ Memory DB
│  ├─ episodic memory
│  ├─ semantic memory
│  ├─ decisions
│  ├─ preferences
│  ├─ goals
│  ├─ relationships
│  ├─ projects
│  └─ constraints
│
├─ DMN Engine
│  ├─ background synthesis
│  ├─ latent theme detection
│  ├─ unresolved loop detection
│  ├─ weak signal detection
│  └─ periodic insight batch
│
├─ CEN Engine
│  ├─ answer
│  ├─ plan
│  ├─ draft
│  ├─ compare
│  ├─ decide
│  └─ execute
│
├─ SN Router
│  ├─ user state estimation
│  ├─ salience scoring
│  ├─ interruption policy
│  ├─ disclosure control
│  ├─ suppression policy
│  └─ routing decision
│
├─ ACC Monitor
│  ├─ goal mismatch detection
│  ├─ premise error detection
│  ├─ constraint violation detection
│  ├─ irreversibility detection
│  ├─ avoidance detection
│  └─ local optimum trap detection
│
├─ World Model
│  ├─ web search
│  ├─ external facts
│  ├─ market/context updates
│  └─ source reliability
│
├─ Tool / Agent Layer
│  ├─ email
│  ├─ calendar
│  ├─ documents
│  ├─ tasks
│  ├─ browser
│  └─ external APIs
│
└─ Feedback Loop
   ├─ accepted
   ├─ ignored
   ├─ revised
   ├─ executed
   ├─ delayed
   └─ rejected
```

---

## 8. User State Model

The Triple Network Model alone is insufficient for classifying user states.
For that reason, a separate User State Model is maintained.

### 8.1 Primary States

#### Execution

The user already wants to move.

Characteristics:

* Wants short replies
* Prioritizes execution over judgment
* Wants a next action
* Dislikes added points of discussion

Desirable intervention:

* Affirmation
* Minimal grounds
* Next action
* A light guardrail if needed

Things to avoid:

* Presenting a large number of alternatives
* Digging up fundamental premises
* Long explanations
* Adding research points of discussion

#### Research

The user still wants to explore.

Characteristics:

* Wants to see branches
* Wants to know existing categories and competitors
* Wants to deepen the hypothesis
* Does not want to close on a conclusion right away

Desirable intervention:

* Organizing points of discussion
* A branch map
* Future branches
* Research ordering
* Surfacing oversights

Things to avoid:

* Premature recommendations
* Excessive conversion into execution items
* Being too assertive

#### Decision

The user wants to decide but is hesitating.

Characteristics:

* Many options
* Wavering decision criteria
* Searching for the correct answer
* Concerned about reversibility and regret

Desirable intervention:

* Compression of decision criteria
* Organizing reversibility
* A recommended option
* Separating points to defer from points to decide

Things to avoid:

* Increasing options
* Producing a comprehensive table
* Excessively emphasizing uncertainty

#### Defense

The user is defensive, avoidant, or feeling threatened.

Characteristics:

* Has difficulty receiving sound arguments
* Tends to ignore hard-to-hear points
* Feels the cost of failure to be large
* Self-justification readily occurs

Desirable intervention:

* First rationalize the current reaction
* Convert into a low-risk step
* Merge into the user's higher-level goal
* Lower the guard gradually

Things to avoid:

* Saying "you are wrong"
* Stabbing with the painful truth in one shot
* Pushing the ideal behavior
* Engaging in rebuttal mode

#### Overload

The user is in a state of information overload, fatigue, or confusion.

Characteristics:

* Cannot read long text
* Cannot process options
* Does not know where to start
* Wants to avoid the load of judgment

Desirable intervention:

* Information reduction
* Presenting only the next single thing
* Turning things into a hold list
* Making explicit what need not be thought about now

Things to avoid:

* Adding explanation
* Comparison tables
* Expanding points of discussion
* Abstraction

---

## 9. State Signals

The user state is estimated from the following signals.

### 9.1 Explicit Signals

* "What should I do?"
* "I want to research this"
* "I'm hesitating"
* "I want to just proceed with this now"
* "Tedious"
* "Scary"
* "Something feels off"
* "Too long"
* "Skimmed over it"

### 9.2 Linguistic Signals

* Many assertions
* Many questions
* High level of abstraction
* Many concrete execution words
* Much negation or sense of discomfort
* Many uses of "but" / "that said"
* Many uses of "maybe" / "I feel like"

### 9.3 Behavioral Signals

* Response rate to long text
* Adoption rate of proposals
* Revision requests
* Ignoring
* Re-asking
* Repetition on the same theme
* Returning after execution
* Completion status of schedule items and tasks

### 9.4 Contextual Signals

* Time of day
* Calendar status
* Deadlines
* Before/after meetings
* App in use
* Past judgments
* Current project
* Incomplete tasks

---

## 10. Intervention Policy

### 10.1 Core Principle

```text
1 turn = 1 mode = 1 transition
```

Do not mix multiple modes in a single response.

### 10.2 Suppression First

This product's differentiator is not "what to say" but **what not to say now**.

Each response internally holds the following.

```text
Intervention {
  detected_state
  target_transition
  payload_type
  max_cognitive_load
  disclosure_level
  included_items
  suppressed_items
  deferred_items
}
```

### 10.3 Intervention Types

#### Answer

Resolves a question.

States used:

* Execution
* Decision

#### Branch Map

Shows exploration branches.

States used:

* Research

#### Plan

Lands things into execution.

States used:

* Execution
* Decision

#### Reframe

Changes the perspective.

States used:

* Defense
* Decision
* Research

#### Guardrail

Without stopping execution, lightly indicates only the danger.

States used:

* Execution with risk

#### Pause

Stops only when irreversible risk is high.

States used:

* Execution with severe misalignment

#### Insight Card

Presents an insight generated in the background.

States used:

* DMN batch delivery
* Low urgency
* Reflection window

---

## 11. Misalignment Detection

Detects cases where the user enters Execution while still pointed in the wrong direction.

### 11.1 Misalignment Types

#### Goal Mismatch

The local intent is satisfied, but it deviates from the higher-level goal.

Examples:

* Wants to reply quickly, but the true goal is repairing the relationship
* Wants to advance the spec, but the true goal is customer validation

#### Premise Error

The premised facts are wrong.

Examples:

* Judging based on outdated information
* Misreading the other party's intent
* A skewed understanding of the market

#### Constraint Violation

Violates a known constraint.

Examples:

* Budget
* Time
* Contract
* Team circumstances
* Ethics
* Legal
* The user's own past policy

#### Irreversibility Error

Advancing too quickly toward an irrecoverable action.

Examples:

* Sending
* Publishing
* Firing
* Contracting
* Large-scale investment
* Rebranding

#### Avoidance-disguised Execution

Looks like execution but essentially avoids the core problem.

Examples:

* Should ask the customer but polishes the deck instead
* Should conduct hiring interviews but keeps refining the job description
* Should put out a price but keeps doing competitor research

#### Local Optimum Trap

The work at hand is correct, but it is weak as overall strategy.

Examples:

* Feature implementation is progressing, but the thing that should be built is wrong in the first place
* Doing conversion improvement, but the target is wrong

### 11.2 Misalignment Score

```text
Misalignment Risk =
  goal_drift
  + premise_uncertainty
  + constraint_violation
  + irreversibility
  + opportunity_cost
  + avoidance_signal
  - reversibility
  - user_confidence_calibration
```

### 11.3 Correction Levels

#### Level 0: Silent

Conditions:

* Risk is low
* Reversible
* Has learning value
* The cost of intervention is higher

Output:

* Say nothing

#### Level 1: Guardrail

Conditions:

* The direction is broadly correct
* Only one part needs attention

Example output:

* "You may proceed as is. But before sending, just check whether the other party might read it defensively"

#### Level 2: One-question Checkpoint

Conditions:

* There is a possibility of mismatch with the higher-level goal
* But not enough to stop execution

Example output:

* "Just one point before you proceed. The goal is not 'sending quickly' but 'getting a Yes from the other party' — is that right?"

#### Level 3: Low-risk Experiment

Conditions:

* The direction is questionable
* But a full stop is too heavy

Example output:

* "Rather than full execution, it seems best to try small first. Before sending to 10 people, hit just one person and see the reaction"

#### Level 4: Pause

Conditions:

* Irreversible
* Clearly conflicts with the higher-level goal
* The premise is uncertain
* The cost of failure is high

Example output:

* "This is better stopped for now. The current plan is likely optimizing not higher-level goal A but short-term anxiety relief B"

---

## 12. Memory DB Requirements

### 12.1 Memory Types

#### Episodic Memory

* Past conversations
* Meetings
* Judgments
* Experiences
* Failures
* Successes
* Reactions

#### Semantic Memory

* Concepts
* Knowledge
* Summaries
* Industry information
* User-specific abstractions

#### Goal Memory

* Long-term goals
* Mid-term goals
* Current projects
* Declared goals
* Inferred goals

#### Preference Memory

* Preferred output formats
* Disliked output formats
* Cognitive load tolerance
* Decision-making style
* Areas where the user tends to become defensive

#### Decision Memory

* Past decisions
* Decision criteria
* Adopted options
* Rejected options
* Hypotheses to evaluate later

#### Constraint Memory

* Time
* Budget
* Relationships
* Contracts
* Team structure
* Technical constraints
* Non-goals decided in the past

#### Relationship Memory

* Stakeholders
* The other party's personality
* Communication history
* Past friction
* Trust level

### 12.2 Memory Attributes

Each Memory item holds the following.

```text
MemoryItem {
  id
  type
  content
  source
  created_at
  updated_at
  confidence
  salience
  emotional_valence
  related_goals
  related_projects
  related_people
  decay_policy
  privacy_level
  retrieval_contexts
}
```

---

## 13. DMN Engine Requirements

### 13.1 Inputs

* Memory DB
* Incomplete tasks
* Calendar
* Recent conversations
* Recent searches
* Recent decisions
* Neglected questions
* Themes that recur repeatedly

### 13.2 Processing

* latent theme detection
* unresolved loop detection
* contradiction detection
* repeated avoidance detection
* weak signal clustering
* cross-project pattern matching
* future question generation

### 13.3 Outputs

```text
InsightCard {
  title
  why_now
  evidence
  suggested_question
  suggested_action_optional
  confidence
  urgency
  defer_until
}
```

### 13.4 DMN Output Policy

* As a rule, do not mix into the synchronous chat
* Surface as periodic batches
* At most 3 items at a time
* Do not interrupt during execution
* Present only when the SN Router judges "it is worth surfacing now"

---

## 14. CEN Engine Requirements

### 14.1 Inputs

* The user's explicit intent
* Current project
* Related Memory
* Web search results
* Constraints
* Past judgments
* Executable tools

### 14.2 Outputs

* answer
* plan
* draft
* checklist
* comparison
* recommendation
* task
* email
* calendar action
* document edit
* research brief

### 14.3 CEN Output Policy

* Keep it short in execution mode
* As a rule, do not surface superfluous alternatives
* At most 1 caveat
* Make the next action clear
* Compress decision criteria
* Insert correction by the ACC Monitor only when necessary

---

## 15. SN Router Requirements

### 15.1 Responsibilities

* user state estimation
* cognitive load estimation
* interruption decision
* salience scoring
* disclosure level selection
* response length control
* DMN/CEN routing
* silence/defer decision
* suppressed item management

### 15.2 Routing Options

```text
Route {
  CEN_NOW
  DMN_BATCH_LATER
  DMN_INSIGHT_NOW
  ACC_GUARDRAIL
  ACC_PAUSE
  ASK_ONE_QUESTION
  SILENCE
  STORE_ONLY
}
```

### 15.3 Example Routing

#### User says:

"Is this OK to send?"

Detected:

* Execution: high
* Decision: medium
* Cognitive load: low-medium

Route:

* CEN_NOW
* ACC_GUARDRAIL if needed

Output:

* "You may send it. Just one point: soften this sentence so the other party does not read it as being blamed"

#### User says:

"Something feels off"

Detected:

* Research: medium
* Decision: high
* Uncertainty: high

Route:

* ASK_ONE_QUESTION or BRANCH_MAP

Output:

* "I think the core of the discomfort is not the quality of the plan but 'what you are optimizing for.' There are two branches"

#### User is executing wrong direction

Detected:

* Execution: high
* Misalignment: high
* Irreversibility: medium-high

Route:

* ACC_PAUSE

Output:

* "This is better stopped for now. The current plan works for short-term anxiety relief, but it may be counterproductive for the higher-level goal"

---

## 16. UX Principles

### 16.1 Do not answer everything

Even correct information is not surfaced if it does not fit the current state.

### 16.2 One intervention per turn

Only one state transition is targeted in a single response.

### 16.3 Default to low cognitive load

Compression over long text.
Selection over comprehensiveness.
Connection over explanation.

### 16.4 Preserve execution momentum

When the user is in execution mode, as a rule do not stop them.
Stop only at high risk.

### 16.5 Be a lane-keeping system, not a critic

Do not negate the user.
Adjust the direction slightly.

### 16.6 Treat silence as an action

Make not surfacing, surfacing later, and only saving into explicit options.

### 16.7 Convert memory into present intent

Memory is used not to be quoted but to be connected to the current intent.

---

## 17. Key User Flows

### 17.1 Execution Flow

```text
User asks for action
↓
SN detects Execution state
↓
CEN generates minimal plan/action
↓
ACC checks misalignment
↓
If low risk: answer directly
If medium risk: add guardrail
If high risk: pause or checkpoint
↓
User acts
↓
Feedback captured
```

### 17.2 Research Flow

```text
User explores topic
↓
SN detects Research state
↓
CEN/World Model retrieves relevant facts
↓
Memory DB adds user-specific context
↓
Output branch map, not conclusion
↓
DMN may store unresolved loops for later batch
```

### 17.3 Decision Flow

```text
User is choosing
↓
SN detects Decision state
↓
Memory retrieves past similar decisions
↓
CEN compresses criteria
↓
ACC checks irreversible risks
↓
Output recommendation + reversibility frame
```

### 17.4 Defense Flow

```text
User resists or avoids
↓
SN detects Defense state
↓
Threat score estimated
↓
Output validates current reaction
↓
Reframe around user's own goal
↓
Offer low-risk next step
```

### 17.5 DMN Batch Flow

```text
Background schedule triggers
↓
DMN scans memory/project/task history
↓
Finds latent patterns
↓
SN decides if/when to surface
↓
User receives 1-3 insight cards
↓
User accepts, ignores, saves, or acts
↓
Memory updates salience weights
```

---

## 18. MVP Scope

### 18.1 MVP Goal

Validate whether state-aware output control produces lower cognitive load and higher perceived usefulness than standard AI chat.

### 18.2 MVP User

Initial target:

* founder
* operator
* PM
* researcher
* executive
* builder with many open loops

Common traits:

* high agency
* many decisions
* many context switches
* existing notes/docs/chats
* dissatisfied with standard AI verbosity
* interested in using memory for decision-making

### 18.3 MVP Features

#### Must Have

* Chat interface
* User state classifier
* Response mode selector
* Memory DB
* Manual memory capture
* Basic RAG over user notes
* Web search integration
* Response length and disclosure control
* Suppressed items tracking
* ACC-style misalignment detection for high-risk execution
* Feedback buttons:

  * useful
  * too much
  * wrong mode
  * ignored
  * acted on

#### Should Have

* Daily/weekly DMN insight batch
* Project-level memory
* Goal memory
* Decision memory
* Intervention logs
* User preference learning
* Calendar/context ingestion

#### Could Have

* Email integration
* Task manager integration
* Browser context
* Slack/Discord integration
* Voice input
* Mobile push insight cards

#### Not MVP

* Fully autonomous agent
* Full OS-level ambient capture
* Always-on screen recording
* Complex workflow automation
* Team memory
* Medical/therapy claims
* Neuroscience-backed claims beyond metaphor

---

## 19. MVP Modes

MVP should support 5 user states.

```text
Execution
Research
Decision
Defense
Overload
```

For each state, MVP should enforce different output policies.

### Execution Policy

* Answer first
* Max 1 caveat
* Next action required
* No long exploration

### Research Policy

* Branches over conclusions
* Future decision points
* No premature recommendation unless asked

### Decision Policy

* Compress criteria
* Identify reversible vs irreversible
* Recommend one path
* Defer non-critical uncertainty

### Defense Policy

* Validate
* Reduce threat
* Offer low-risk step
* Avoid direct confrontation

### Overload Policy

* Reduce to one next step
* Explicitly park other issues
* No tables unless requested

---

## 20. Differentiation

### 20.1 Compared to Obsidian / Notion / Logseq

External Brain is not a storage-first PKM.

Difference:

* They optimize capture and organization
* External Brain optimizes retrieval timing, state fit, and intervention

### 20.2 Compared to Mem / Fabric

External Brain is not just AI-enhanced notes.

Difference:

* Mem surfaces relevant notes
* External Brain decides whether surfacing is appropriate, what to suppress, and how to attach memory to current intent

### 20.3 Compared to ChatGPT / Claude

External Brain is not a general-purpose conversational model.

Difference:

* General AI tends to answer comprehensively
* External Brain enforces mode purity and cognitive load control

### 20.4 Compared to OpenClaw / autonomous agents

External Brain is not primarily an executor.

Difference:

* Agents execute tasks
* External Brain determines whether the user is aiming correctly before helping execution

### 20.5 Compared to Honcho / Hermes / Letta / Zep

External Brain is not only memory infrastructure.

Difference:

* Memory infra stores and retrieves state
* External Brain turns memory into user-state-adaptive intervention

---

## 21. Metrics

### 21.1 Core Metrics

* Perceived cognitive load reduction
* Response adoption rate
* User-reported “that’s exactly it” rate
* Wrong-mode feedback rate
* Action conversion rate
* Saved/acted-on insight rate
* Misalignment correction acceptance rate
* User return frequency

### 21.2 Mode-specific Metrics

#### Execution

* Time to next action
* Action completion rate
* User edits required
* “Too much information” complaints

#### Research

* Follow-up depth
* Branch exploration rate
* Insight save rate
* Later decision conversion

#### Decision

* Decision completion rate
* Regret/reversal rate
* Confidence after response
* Criteria compression success

#### Defense

* Re-engagement after difficult prompt
* Low-risk action acceptance
* Avoidance loop reduction

#### DMN Batch

* Insight open rate
* Insight save rate
* “surprising but useful” rating
* Later reuse rate

### 21.3 Negative Metrics

* Interruptions dismissed
* User says response is too long
* User says response is generic
* User ignores repeated insights
* User disables proactive features
* ACC false positives
* Excessive pausing during execution

---

## 22. Example Outputs

### 22.1 Execution

User:

> Is this wording OK to send?

Output:

> You may send it.
> If the goal is "getting a positive reply from the other party," it's good to soften just one sentence.
>
> Before: "Please respond urgently"
> After: "It would help if you could check this by the end of today, if possible"

### 22.2 Research

User:

> This market — what should I research first?

Output:

> There are two branches to look at first.
>
> * Is it a market that replaces existing tools
> * Or a market that creates new behavior
>
> For now, rather than competitor comparison, it's better to look at the cognitive cost users are already paying.

### 22.3 Decision

User:

> Which is better, A or B?

Output:

> For now it's A.
>
> The reason is that A can be undone, but once B is advanced the organizational cost is high.
> Rather than discarding B, it's good to move it to a verification item one week out.

### 22.4 Defense

User:

> No, I feel like this isn't the thing to do right now

Output:

> It's reasonable to want to avoid it now.
> The problem is probably not importance but that the pain of failure looks large.
>
> You don't have to do it head-on, so first land it into a form where failure doesn't hurt.
> Asking just one person next is enough.

### 22.5 Misalignment Correction

User:

> I'll send this to 100 people as is

Output:

> It's better to make this smaller first.
>
> The current wording is suited to "getting a quick reaction," but for the higher-level goal of "building trust" it's a bit too strong.
> Send to 5 people first, see the reaction, then expand — that's safe.

---

## 23. Data Model Sketch

### 23.1 UserState

```text
UserState {
  primary_mode: execution | research | decision | defense | overload
  confidence: float
  cognitive_load: low | medium | high
  threat_level: low | medium | high
  agency_level: low | medium | high
  uncertainty_level: low | medium | high
  urgency: low | medium | high
  evidence: string[]
}
```

### 23.2 Goal

```text
Goal {
  id
  title
  type: declared | inferred
  time_horizon: short | medium | long
  priority
  confidence
  related_projects
  updated_at
}
```

### 23.3 ActionFrame

```text
ActionFrame {
  user_goal
  local_intent
  proposed_action
  expected_outcome
  assumptions
  constraints
  reversibility
  risk
}
```

### 23.4 Intervention

```text
Intervention {
  detected_state
  target_transition
  route
  payload_type
  max_cognitive_load
  disclosure_level
  included_items
  suppressed_items
  deferred_items
  memory_used
  web_used
  tools_used
}
```

### 23.5 Feedback

```text
Feedback {
  intervention_id
  user_response
  explicit_rating
  adopted
  ignored
  revised
  acted_on
  wrong_mode
  too_long
  too_direct
  too_vague
}
```

---

## 24. Privacy and Trust Requirements

### 24.1 User Control

* The user can view, edit, and delete Memory
* Inferred goals and preferences are made visible
* The user can choose "do not use this memory"
* proactive intervention can be turned OFF

### 24.2 Transparency

* For important interventions, briefly show what they were grounded in
* But during Execution, do not surface too much of the grounds
* "Why this was surfaced now" can be disclosed as needed

### 24.3 Avoid Manipulation

* Support the user's goal achievement
* When the user's explicit goal and inferred goal conflict, handle it carefully
* Do not apply overly leading interventions to a user in defense mode
* When aiming for behavior change, it must be consistent with the user's interests

---

## 25. Risks

### 25.1 False Positive Misalignment

Problem:

* The AI stops an execution that is actually correct

Mitigation:

* Do not stop when irreversibility is low
* Use a guardrail first
* Forced stop only at high risk

### 25.2 Over-personalization

Problem:

* Being pulled too much by a past image of the user

Mitigation:

* Hold Memory confidence
* Decay old memories
* Allow the user to correct

### 25.3 Annoying Proactivity

Problem:

* DMN batches and SN interruptions are noisy

Mitigation:

* Control notification frequency
* At most 3 Insights
* Strongly learn the dismissed signal
* Treat silence as an explicit action

### 25.4 Generic AI Output

Problem:

* No difference emerges from existing ChatGPT/Claude

Mitigation:

* Enforce mode purity
* Hold suppressed_items internally
* Limit output length according to state
* Design "what not to say now"

### 25.5 Manipulative Feel

Problem:

* Feeling manipulated by having one's user state read

Mitigation:

* Make the reason for intervention explainable
* Make it configurable
* Explicitly confirm the user's higher-level goal
* Avoid strong leading

---

## 26. Open Questions

### 26.1 Product Definition

* Is this a Second Brain
* Is it a Decision Copilot
* Is it a Cognitive Router
* Is it a Personal OS

### 26.2 Interface

* Is chat-centric fine
* Or insight-card-centric
* Is a cross-cutting UI over editor/browser/calendar needed
* Are mobile notifications effective, or a nuisance

### 26.3 State Detection

* To what extent can the user state be estimated
* Will the user tolerate mis-estimation
* Should the user be made to explicitly select "the current mode"
* What should the balance between automatic estimation and manual switching be

### 26.4 DMN Batch

* What frequency is optimal
* Morning, weekly, or after work
* How much surprise is needed
* How much grounds should be shown

### 26.5 ACC Monitor

* At what level of risk should it stop
* To what extent should the user's execution be respected
* How to reduce the "stopped by the AI" feeling

### 26.6 Memory

* Which Memory really works
* Is conversation history alone enough
* Are calendar, email, documents, and even the browser needed
* How to handle long-term memory degradation and false memories

---

## 27. Suggested MVP Experiment

### 27.1 Experiment

Build the following thin control layer on top of an existing LLM.

```text
User input
↓
State classifier
↓
Intervention policy selector
↓
Memory/Web retrieval selector
↓
Response generator with mode-specific constraints
↓
Feedback capture
```

### 27.2 MVP does not need

* A perfect Memory DB
* A complete agent
* Always-on monitoring
* A complex UI
* Fully automatic DMN

### 27.3 MVP should test

* Whether narrowing output by state makes the user feel "light"
* Whether wrong-mode feedback decreases
* Whether the action rate rises in execution mode
* Whether good branches can be produced in research mode
* Whether ACC-style correction is accepted
* Whether DMN-batch insights are saved and reused

---

## 28. Initial Implementation Plan

### HTAS:M5 — Mode-aware Chat (archived round-1 PRD Phase 1)

* UserState classifier
* 5 modes:

  * Execution
  * Research
  * Decision
  * Defense
  * Overload
* Mode-specific response templates
* Feedback collection

### HTAS:M1 + M4 + M5 — Memory-aware Responses (archived round-1 PRD Phase 2; no standalone milestone)

* Project memory
* Goal memory
* Decision memory
* Preference memory
* RAG integration
* Memory edit UI

### HTAS:M8 — ACC Monitor (archived round-1 PRD Phase 3)

* ActionFrame extraction
* Misalignment risk scoring
* Guardrail / checkpoint / pause policy
* Irreversibility detection

### HTAS:M9 — DMN Batch (archived round-1 PRD Phase 4)

* Daily or weekly background synthesis
* Insight cards
* Deferred/suppressed item resurfacing
* Latent theme detection

### HTAS:M11 — External Tooling (archived round-1 PRD Phase 5)

* Calendar
* Email
* Docs
* Tasks
* Browser context
* Lightweight action execution

---

## 29. Product Positioning

External Brain is not:

* a note app
* a chatbot
* a generic AI agent
* a task manager
* a search engine
* a pure memory backend

External Brain is:

**a state-aware cognitive routing layer that connects memory, world knowledge, and execution support to the user's current intent with minimal cognitive load.**

More concise positioning:

**The second brain that knows when not to speak.**

Or:

**A personal cognitive router for research, decisions, and execution.**

---

## 30. Current Best Definition

**External Brain is an external cognitive system composed of a background insight engine, a foreground execution engine, a salience router, and an error-monitoring layer. It uses user memory, live context, and external information to provide only the intervention appropriate to the user's current cognitive state, while suppressing everything else.**
