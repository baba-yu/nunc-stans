Below, I reconstruct this using only the discussion up to this point.

# 1. Problem statement

## 1.1 The hollowing-out of the second brain

* The original second brain is an external memory device that supports thinking

* In practice, however, it is often operated as follows

  * Saving articles
  * Clipping social-media posts
  * Pasting YouTube summaries
  * Saving AI answers
  * Logging research results as-is

* This is not "knowledge management" but merely an information warehouse

* With AI in particular, the saving of un-digested research results is increasing

* Even if you save an AI's output as-is, it is not the user's knowledge

## 1.2 The problem of calling something you did not think through yourself a "second brain"

* Many second brains are, in reality, not a "second brain" but a "second hard disk"

* The problem is not storage

* The problem is that the following are missing

  * Why you paid attention to that information
  * How you interpreted it yourself
  * What you set down as a hypothesis (≈ tentative claim)
  * What you adopted or rejected
  * What you intend to use it for
  * When it should be reconnected

## 1.3 Confusing AI output with user knowledge

* What an AI explained is not, as-is, the user's knowledge

* AI output is, at most, external knowledge or an AI-response history

* What can be observed as user knowledge is basically only what appears in the user's own utterances

* In particular, the following are candidates for user knowledge

  * Hypotheses the user set up
  * The sense of unease the user felt
  * The distinctions the user made
  * The questions the user asked
  * The judgments the user adopted or rejected
  * The utterances the user made in trying to reach the truth

## 1.4 ADR alone is insufficient

* ADR is effective as a decision log

* ADR can record the following

  * What was decided
  * Why it was decided
  * What options there were
  * What was discarded
  * On which premises the judgment was made

* But ADR is the memory of a judgment result, not knowledge itself

* Recording only judgments is insufficient for augmenting human knowledge

* The hypotheses, questions, understanding, and unease that precede a judgment must also be recorded

## 1.5 Merely recording does not amount to use

* Merely recording information, hypotheses, judgments, and action results is not enough

* Use means that, at the appropriate timing, records are reconnected to the user, who is the acting subject

* What matters is not "saving" but "re-appearance"

* The essential problem of the second brain is not how to save, but how to reconnect

## 1.6 The flood of AI information and the loss of INTENT

* Human thinking is accompanied by embodiment

* A human's hypothesis-building and understanding-formation are subject to bodily and temporal constraints

* AI greatly accelerates the generation of deliverables

* But its speed and volume of information exceed human embodiment

* As a result, the user becomes unable to maintain INTENT

* INTENT here is not a mere objective but an action state such as the following

  * What you are trying to do
  * Why you are doing it
  * Which hypothesis it is based on
  * What you take as your criterion
  * What you will do next

## 1.7 "Appropriate cognitive load" rather than "speed" is the essence

* At first, this was conceived as a mismatch between AI's generation speed and human cognitive speed

* More precisely, however, it is a problem of "appropriate cognitive load," not "speed"

* The problem is less that AI is too fast and more that AI breaks the load allocation that humans need for hypothesis-formation, evaluation, and connection to action

* AI should not reduce human cognitive load to zero

* It is necessary to separate the load that should be lowered from the load that should remain

# 2. Claims

## 2.1 The second brain is not a memory device

* The second brain is not merely a memory device

* In the AI era in particular, defining it as an information-storage device breaks down

* The second brain in the AI era should be redefined as a system that strengthens the human act of thinking

## 2.2 The core is "augmenting human thinking"

* The purpose of the device is not cognitive-load control itself

* The purpose of the device is the augmentation of human thinking

* Cognitive-load control is one mechanism for that

* Augmenting human thinking does not mean AI thinking on the human's behalf

* What should be strengthened is the user's own following

  * Exploration
  * Understanding
  * Hypothesis-formation
  * Judgment
  * Action
  * Learning recovery

## 2.3 Separate AI external knowledge from user understanding

* AI output and user knowledge must be separated

* If external knowledge and user understanding are mixed, the second brain becomes an AI-output warehouse

* The domains to be distinguished are the following

  * AI Response Memory
  * External Knowledge
  * User Knowledge / Belief Graph
  * Hypothesis Log
  * ADR / Decision Memory
  * Action / Result Log

## 2.4 User knowledge is observed in user utterances

* A user's hypothesis appears only in output that is built on the user's understanding

* Therefore, user knowledge is basically observed from the user's own utterances

* When the user judges content that the AI assisted with, that can become an ADR

* But that alone cannot be called user knowledge

## 2.5 The hypothesis log must stand on the human side

* The hypothesis log must stand on the human side, not the AI side

* What the hypothesis log should record is not the hypotheses the AI presented

* What it should record is the tentative claims the user set down based on their own understanding

* A hypothesis is not information but a stance toward the world

## 2.6 Use means "reconnection to the current state"

* Use is not being able to search saved information later

* Use means that past understanding, hypotheses, judgments, and action results are appropriately reconnected to the user's current state

* Unless reconnected, a record does not become a knowledge asset

## 2.7 Reconnect based on salience

* It is insufficient for the second brain merely to do a simple search over past logs

* It is necessary to look at which cognitive state the user is in now and choose what to reconnect

* The assumed states are the following

  * Exploration
  * Decision-making
  * Action

* The support needed in each differs

## 2.8 Control appropriate cognitive load to maintain INTENT

* The second brain in the AI era must adjust AI output and memory re-presentation to a load at which the user can maintain INTENT

* If the load is too high, the user is swept up in the flood of AI information

* If the load is too low, the user stops thinking

* Appropriate load is the load at which the user can form, adopt, and reject hypotheses and connect them to action on their own

## 2.9 Redefinition

```text
The second brain in the AI era,
without confusing AI's external knowledge with human knowledge,
models the user's own understanding, hypotheses, judgments, and actions,
and by reconnecting them according to the current cognitive state,
is a system that strengthens the human act of thinking.

To that end, it controls AI output and memory re-presentation
toward an appropriate cognitive load at which INTENT can be maintained.
```

Put more briefly,

```text
The second brain is not a memory device;
it is, after separating AI external knowledge from user understanding,
a human-thought-augmentation system that reconnects
the user's hypotheses, judgments, and actions to the current state.
```

# 3. Device overview

## 3.1 Purpose of the device

* The purpose is the augmentation of the human act of thinking

* The targets of augmentation are the following

  * Exploration
  * Understanding
  * Hypothesis-formation
  * Decision-making
  * Action
  * Learning recovery

## 3.2 Basic structure of the device

```text
Human Thought Augmentation System
├── User Understanding Model
│   ├── Belief Graph
│   ├── Hypothesis Log
│   ├── Question Log
│   ├── Distinction Log
│   └── Evidence Standard
│
├── External Knowledge Layer
│   ├── AI Response Memory
│   └── External Knowledge
│
├── Decision Layer
│   └── ADR / Decision Memory
│
├── Action Layer
│   ├── Action Log
│   └── Result Log
│
├── Reconnection Engine
│   ├── Salience Detection
│   ├── State Detection
│   └── Context Retrieval
│
└── Cognitive Load Governor
    └── Intent Maintenance Control
```

## 3.3 Entities surrounding the device

### AI Response Memory

* What the AI answered in the past

* Not user knowledge

* When used later, it is treated as a history of "the AI answered this way in the past"

### External Knowledge

* External materials

* Research results

* General knowledge

* Knowledge the AI presented

* This too is not user knowledge

### User Knowledge / Belief Graph

* A model of how the user understands the world

* Observed in user utterances

* Includes the following

  * Beliefs
  * Hypotheses
  * Questions
  * Distinctions
  * Rejections
  * Evidence criteria
  * Commitments

### Hypothesis Log

* A record of hypotheses the user set down based on their own understanding

* Not something that saves the AI's hypothesis candidates as-is

### ADR / Decision Memory

* A record of judgments the user adopted

* Not knowledge but a judgment history

* However, it becomes effective by being connected to hypotheses and premises

### Action / Result Log

* A record of what was executed and its results

* Material for hypothesis updates

* Used after action to recover "which hypothesis was updated"

### Reconnection Engine

* A mechanism that reconnects past records according to the current user state

* Performs contextual re-surfacing rather than search

### Cognitive Load Governor

* A mechanism that controls the load of AI output and memory re-presentation so that INTENT can be maintained

* Not the device itself, but flow control for thought augmentation

## 3.4 Terminology

### Belief Graph

```text
A graph structure representing how the user understands the world,
what they treat as hypotheses,
what they doubt,
what they accept as evidence,
and which judgments they connect to
```

* Different from a Knowledge Graph

* A Knowledge Graph represents facts about the world

* A Belief Graph represents the user's structure of understanding

### Hypothesis

```text
A tentative claim that the user, based on their understanding at that point,
set down about the world, an object, the future, or causal relationships
```

### ADR

```text
Architecture Decision Record.
A decision log that records what was decided, why it was decided, what options there were, and what was discarded
```

### INTENT

```text
The action state that holds what the user is currently trying to do
```

Its constituents are the following.

* Goal
* Why
* Hypothesis
* Criterion
* Next Action

### Appropriate cognitive load

```text
The load band in which the user can perform hypothesis-formation, judgment, and connection to action
while maintaining INTENT
```

### Reconnection

```text
Re-presenting past understanding, hypotheses, judgments, and action results
according to the user's current cognitive state
```

### Use

```text
Saved records influencing the current or future user's
judgment, action, or update of understanding
```

## 3.5 Basic processing flow

```text
1. Receive a user utterance
   ↓
2. Separate AI external knowledge from user-originated knowledge
   ↓
3. Extract understanding, hypotheses, questions, and distinctions from the user utterance
   ↓
4. Record into the Belief Graph / Hypothesis Log
   ↓
5. If a judgment occurs, turn it into an ADR
   ↓
6. If an action occurs, connect it to the Action Log
   ↓
7. When a result comes out, record it in the Result Log
   ↓
8. Determine the current state
   - Exploration
   - Decision-making
   - Action
   ↓
9. Reconnect past logs according to the state
   ↓
10. Control cognitive load so that INTENT can be maintained
```

## 3.6 The three states of exploration, decision-making, and action

### Exploration

```text
Don't know
↓
Want to understand
↓
Want to form a hypothesis
```

* Support needed

  * Hypothesis-generation support
  * Visualization of questions
  * Estimation of the understanding model
  * Reconnection of similar past unease
  * Presentation of counter-hypotheses and higher-level hypotheses

### Decision-making

```text
There is a hypothesis
↓
There are options
↓
You need to decide
```

* Support needed

  * Making premises explicit
  * Matching against past judgments
  * Recognizing the wager (≈ bet)
  * Turning into an ADR
  * Making the adopted and rejected options explicit
  * Setting reconsideration conditions

### Action

```text
Decided
↓
Do it
↓
A result comes out
↓
Update the hypothesis
```

* Support needed

  * Reconnection of intent
  * Returning links to hypotheses and ADRs rather than TODOs
  * Detection of premise collapse
  * Post-action learning recovery
  * Confirming which hypothesis was updated

## 3.7 Correspondence with DMN / CEN / SN

### DMN-type support

* Exploration
* Introspection
* Sense-making
* Future simulation
* Hypothesis-formation
* Verbalizing unease

On the second brain,

* Save questions
* Expand hypotheses
* Produce counter-hypotheses
* Reconnect past unease
* Make the user's stance explicit

### CEN-type support

* Decision-making
* Comparative consideration
* Prioritization
* Execution planning
* Creating ADRs
* Verification design

On the second brain,

* Make options explicit
* Extract premises
* Turn into ADRs
* Break down into action units
* Set reconsideration conditions

### SN-equivalent support

* Determine which state the current user is in

* Switch between DMN-type and CEN-type support according to that state

* Judge what should be interrupted in now

# 4. Details of each step and mechanism of the device

## 4.1 Input separation mechanism

### Purpose

* Do not confuse AI output with user knowledge

### Separation targets

```text
AI Response Memory
≠
External Knowledge
≠
User Knowledge Memory
≠
Decision Memory
≠
Action Memory
```

### Determination

* What the AI said

  * AI Response Memory

* External materials and research results

  * External Knowledge

* Hypotheses, unease, and distinctions the user voiced

  * User Knowledge / Belief Graph

* Judgments the user adopted or rejected

  * ADR / Decision Memory

* Execution and results

  * Action / Result Log

## 4.2 User Knowledge Modeling

### Recording targets

* What the user believes
* What they set down as a hypothesis
* What they see as an unresolved problem
* What they distinguish
* What they see as different
* What they wager on
* What they accept as evidence

### Schema

```text
User Knowledge Model
- Beliefs: what the user believes
- Hypotheses: what they set down as a hypothesis
- Questions: what they see as an unresolved problem
- Distinctions: what they distinguish
- Rejections: what they see as different
- Commitments: what they wager on
- Evidence Standards: what they accept as evidence
```

## 4.3 Belief Graph

### Nodes

```text
Belief
- A proposition the user believes relatively strongly

Hypothesis
- An unverified causal hypothesis the user has tentatively set down

Question
- A question the user is pursuing

Distinction
- A distinction the user considers important

Evidence Standard
- What they accept as evidence

Decision
- An adoption judgment based on that understanding

Action
- An action based on the judgment
```

### Edges

```text
supports
- A supports B

contradicts
- A contradicts B

assumes
- A presupposes B

derived_from
- From which user utterance A was extracted

tested_by
- By which action or experiment A is verified

updated_by
- By which result A is updated

led_to_decision
- Which ADR A led to
```

### Example

```text
[Distinction]
AI output logs ≠ user knowledge
    supports
[Belief]
User knowledge is observed in user utterances
    supports
[Hypothesis]
The hypothesis log should be made to stand on the human side
    led_to_decision
[Decision]
Design the Belief Graph as User Knowledge Memory
```

## 4.4 Hypothesis Log

### Recording conditions

What may go into the hypothesis log is what satisfies the following.

```text
A tentative claim that the user, based on their understanding at that point,
set down about the world, an object, the future, or causal relationships
```

### What should be recorded

* Hypotheses the user set up
* The sense of unease the user felt
* The questions the user chose
* The predictions the user made
* The premises the user set down
* The explanations the user rejected

### What should not be recorded

* AI summaries
* Pasted research results
* Generalities
* Explanations of frameworks
* Claims grounded only on "because the AI said so"

### Example

Information:

```text
Generative AI makes research faster
```

Hypothesis:

```text
The faster research becomes with generative AI,
the more un-digested information saving increases,
and might the quality of knowledge management actually decline
```

## 4.5 ADR / Decision Memory

### What ADR records

```text
Decision
Reason
Considered options
Adopted option
Rejected option
Premise
Result
Reconsideration condition
```

### Positioning of ADR

* ADR is a judgment log

* Not a knowledge log

* However, by connecting it to the Belief Graph and Hypothesis Log, it can retain the background of a judgment

### Example

```text
Decision:
Do not introduce an AI agent for sales support

Reason:
The data-preparation cost is high

Considered options:
1. Full introduction
2. Partial introduction
3. No introduction

Result:
Chose 3
```

### Important additional element

```text
On which preconditions this judgment holds
```

Example:

```text
This judgment holds

・fewer than 100 customer companies
・three or fewer sales staff

on the above preconditions
```

## 4.6 Action / Result Log

### Action Log

* Records what was done based on a judgment

* Connected to hypotheses and ADRs rather than a standalone TODO

### Result Log

* Records execution results

* Records not merely "what happened" but which hypothesis was updated

### Learning recovery

```text
Questions to ask after action:
- What happened
- Which hypothesis was supported
- Which hypothesis was rejected
- Which premise collapsed
- Which judgment should be reconsidered
```

## 4.7 Reconnection Engine

### Role

* Reconnect past logs to the current user state

* Performs salience-based re-surfacing rather than simple search

### Reconnection targets

* Past questions
* Past hypotheses
* Past distinctions
* Past rejection reasons
* Past ADRs
* Past premises
* Past action results
* Signs of premise collapse

### Reconnection example

```text
Previously you
distinguished that "AI output logs are not user knowledge."

In the current design proposal,
because you are about to put AI output directly into the Belief Graph,
it contradicts that distinction.
```

Or,

```text
The previous ADR
assumed fewer than 100 customer companies.

Because there are now 300 customer companies,
the reconsideration condition is satisfied.
```

## 4.8 State Detection

### States to determine

```text
Exploration
Decision-making
Action
```

### Signals of the exploration state

* "I have a feeling that"
* "Something feels off"
* "How should I think about this"
* "As a hypothesis"
* "I want to think a bit more"
* "What is this"

### Signals of the decision-making state

* "Which one should I adopt"
* "What do we implement in the MVP"
* "I want to decide"
* "What do I discard"
* "I want to judge"

### Signals of the action state

* "What do I build first"
* "What do I do next"
* "Implement it"
* "Try it"
* "Verify it"

## 4.9 Exploration-phase support

### Processing flow

```text
1. Receive a user utterance
   ↓
2. Detect unease, questions, distinctions, and hypotheses
   ↓
3. Update the Belief Graph
   ↓
4. Reconnect similar past questions and unease
   ↓
5. Present the main hypothesis, counter-hypotheses, and higher-level hypotheses
   ↓
6. Make the user's structure of understanding explicit
```

### Support content

* Hypothesis-generation support
* Visualization of questions
* Estimation of the understanding model
* Presentation of counter-hypotheses
* Abstraction to higher-level concepts
* Reconnection of past unease

## 4.10 Decision-making-phase support

### Processing flow

```text
1. Detect the user's decision-making mode
   ↓
2. Extract the current options
   ↓
3. Extract the judgment premises
   ↓
4. Match against the past Belief Graph / ADRs
   ↓
5. Generate an ADR draft
   ↓
6. Convert into the next action
```

### Support content

* Making options explicit
* Extracting premises
* Matching against past judgments
* Recognizing the wager
* Organizing adopted and rejected options
* Turning into an ADR
* Setting reconsideration conditions

## 4.11 Action-phase support

### Processing flow

```text
1. Confirm the decided ADR
   ↓
2. Take out the hypotheses and premises the judgment relies on
   ↓
3. Connect to the next action
   ↓
4. Obtain the execution result
   ↓
5. Update the hypotheses, premises, and ADR
```

### Support content

* Reconnection of intent
* Re-presentation of the judgment reason
* Detection of premise collapse
* Post-action learning recovery
* Feedback into the next judgment

## 4.12 Cognitive Load Governor

### Positioning

* Not the device itself

* Flow control for thought augmentation

* Within the Reconnection Engine, adjusts how much of what is returned

### Purpose

```text
Control AI output and memory re-presentation
to an appropriate cognitive load at which the user can maintain INTENT
```

### Load that should be lowered

* Exploration noise
* Duplicate information
* Reading load
* Formal organization
* Memory retention
* Irrelevant points of contention
* Overly long AI answers

### Load that should remain

* Unease
* Hypothesis generation
* Retention of judgment criteria
* Adoption
* Rejection
* Integration
* Conversion into next actions

### Appropriate load

```text
Too low:
- The AI organizes everything
- The user only reads
- No hypothesis is born
- It does not become knowledge

Too high:
- Too much AI output
- Too many options
- Judgment criteria cannot be retained
- You just save for now

Appropriate:
- A little difficult
- But you can handle it yourself
- You can form hypotheses
- You can reject
- You can retain judgment criteria
- You can connect to the next action
```

### Formulation

```text
L_total = L_intrinsic + L_extraneous + L_productive + L_intent
```

* `L_intrinsic`

  * The complexity of the problem itself

* `L_extraneous`

  * Extra load generated by AI output or the UI

* `L_productive`

  * Load used for hypothesis-formation, distinction, integration, and learning

* `L_intent`

  * Load to retain the objective, reason, judgment criteria, and next action

Appropriate cognitive load is the state that,

```text
L_total <= C_user
```

while satisfying this, maximizes

```text
L_productive + L_intent
```

.

## 4.13 INTENT Maintenance

### Composition of INTENT

```text
INTENT =
1. Goal        what you want to achieve
2. Why         why it is important
3. Hypothesis  which hypothesis you act on
4. Criterion   what you use to judge good vs. bad
5. Next Action what you do next yourself
```

### INTENT-maintained state

* The user can state the objective
* Can state the reason
* Can state the hypothesis
* Can state the judgment criteria
* Can state the next action
* Can adopt or reject AI output
* Can connect AI output to their own Belief Graph or ADR

### INTENT-lost state

* AI output decides the next question
* AI output decides the next judgment
* The user only ratifies, saves, or edits
* Cannot reject
* Judgment criteria are vague
* The next action becomes only an additional request to the AI

### Demarcation point

```text
If the user can connect what the AI generated
to their own hypotheses, judgment criteria, and next action,
INTENT is maintained.

If they cannot connect it,
and AI output is automatically deciding the next question, judgment, and action,
INTENT is lost.
```

## 4.14 Friction before saving

### Purpose

* Do not save AI output as-is

* Pass it through the user's understanding

### Necessary friction

* Avoid one-click saving

* Before saving, require "one sentence in your own words"

* Before an ADR, require the premises and the rejected options

* Before entering the hypothesis log, the user adopts, modifies, or rejects

## 4.15 Control at reconnection time

### Principles

* Do not output all related logs

* Return only the 1 to 3 items most effective for the current INTENT

* Prioritize the user's own past hypotheses, judgments, and utterances over AI external knowledge

* Choose output by connection value, not length

### By state

* During exploration

  * Return questions, hypotheses, unease, and counter-hypotheses

* During decision-making

  * Return premises, options, past ADRs, and rejection reasons

* During action

  * Return judgment reasons, next actions, and premise-collapse conditions

## 4.16 Minimal closed loop

The minimal unit of the device is the following.

```text
Input
↓
User Understanding Extraction
↓
Belief Graph / Hypothesis Log
↓
ADR
↓
Action
↓
Result
↓
Hypothesis Update
↓
Reconnection
```

Only when this loop holds does a record become use.

## 4.17 Final picture of the device

```text
Collecting AI external knowledge
  is not all there is

Observe user knowledge
  ↓
Record it as a hypothesis
  ↓
Turn it into an ADR as a judgment
  ↓
Connect it to action
  ↓
Update hypotheses from results
  ↓
Reconnect according to the current state
  ↓
Control to a load at which INTENT can be maintained
```

This is the picture of the second-brain device reached in the discussion up to this point.
