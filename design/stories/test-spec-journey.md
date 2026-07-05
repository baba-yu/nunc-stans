# Journey test spec v2.3: Yu's 19 steps
Targets: Constitution v0.3.1 / Nunc Stans experience audit / journey-examples (the five-stage loop) / the common test rules
v2.3: aligned the backbone to the five-stage loop (examples §0). Inserted "build the tactic (stage 2)" and "the strategy is read (stage 3)" between T9 and T11, and renumbered to 19 steps. The source of the terrain's numbers became the app's real data.
Nature: if a unit test is an inspection of parts, this is an inspection of "can the person who uses this system actually fight." The hypothesis under test is the mission of the audit document — that it is a tool that reinforces the courage of someone who is wavering and aids resolve.
Location: design/test-spec-journey.md / scripts and test data: tests/journey/

---

## 0. Two ways to use it

1. CI mode: `just journey` replays the script against data in a temporary folder, takes a snapshot at each step, and confirms checks 1–11. It does not touch real data (NS-5.3)
2. Real-life mode: chapters 0–1 can be used as-is as the actual 4-week procedure for Pre-v1 Phase 1. After actually spending 4 weeks, `just journey:verify` replays checks 1–11 read-only against the real data's git history (conforms to F11)

The aim is that the test script and the real-life procedure are the same document.

---

## 1. Persona: Yu — facts, aims, fears

Facts: an engineer living in Santa Clara. A GPU server at home (built in summer 2025 for ¥600k, swapped to a 5090 in spring 2026 to set up a local LLM environment). Sunday mornings he runs the News pipeline and keeps wagering resources on standing prediction 2 (the everyday practical use of local AI). He builds personal apps in FourFive. He has a habit of writing specs late at night, and when tired he makes typos. There are weeks he writes nothing. That is not negligence but life.

Aims: within 3 years, to create a state where no single system holds power of life and death over him. The criterion is not the amount of assets but the substitutability of what he depends on. The bet (commitment) is a tool for that, and the ledger is its record. He advances axis 1 (maximizing freedom where he currently is) and axis 2 (external dependencies) simultaneously.

What he wants (exactly as defined in the audit document):
1. Reinforcement of courage. Courage = the intelligence to make fear one's own and fight with strategy, tactics, and force. Because it is intelligence, it can be reinforced from outside. The armory (terrain / scenarios / Pivot / one's own past records) is its parts. What he wants is not answers but materials.
2. Aid for resolve. Resolve = the act of cutting through that battlefield with courage. Because it is an act, it can only be aided. The moment it is done on his behalf, the freedom of the process disappears. The one who ultimately writes is always Yu.
3. Readability of fear. Fear is not an object to be soothed (that is anesthesia) but an object to be turned into terrain. The felt sense of the goal is in the audit document's words: "vague anxiety became a map."

What he fears: a fall into given reassurance / hidden manipulation / a pile of design docs that do not touch life / preaching from the tool (nagging, streaks, displays that induce guilt) / pressure that rushes (optimizing for making him decide fast is forging resolve).

Conditions to quit (= the definition of this system's failure): the review keeps going over 10 minutes / there is a penalty in weeks he writes nothing / the sense of being surveilled exceeds the sense of decision authority / interventions keep missing / in 4 weeks an edge never once changes a decision. The subjective items are asked and recorded with the [op] question in T14.

Acceptance criteria:
- A bet has two separate axes. External form (how the bet turned out on the outside) and felt sense (how it was for himself). A closing in which the two diverge must occur at least once in the script. All three kinds of felt sense (happy / unhappy / unchanged) must occur.
- Definition of courage: trying to move forward together with fear is itself courage. Loss is not a condition. How it is observed on the ledger: a record where, having written the fear in a note, he wrote the bet himself.
- Run one lap of the five-stage loop (examples §0) and confirm up to the entrance to the second lap (the update of the understanding of strategy).

The test data is "fictional, resembling Yu." Real data is not used.

---

## 2. Snapshots and checks 1–11

Snapshot: after each step's operation, git commit the data store (CI mode only). The git history itself becomes the time-lapse. Recorded content: commit / hashes of all files / aggregates (number of open and closed commitments, count of edges by type, number of broken references, the provenance mix) / for e2e steps, the screen confirmation result.

Checks confirmed at every step:

| # | Content | Basis |
|---|---|---|
| Check 1 | Every record from the previous step remains exactly as-is (append-only) | F2 / Inv 1 |
| Check 2 | Every edge has a to_label, correct type, correct ID format | §3 |
| Check 3 | close points to a real commitment. At most 1 external-form outcome | NS-2 |
| Check 4 | The author of every commitment is the user (until P4, edges too) | F3 |
| Check 5 | The self data store has no remote and is not a hidden folder | F11 / Inv 20 |
| Check 6 | The provenance mix is recomputable from edges alone and matches the recorded value | F9 |
| Check 7 | A broken reference is displayed by to_label (e2e steps only) | §10-A |
| Check 8 | No files have grown outside the designated locations | F5 / §10-A |
| Check 9 | Every intervention references a valid mandate (mandate-external interventions = 0) | SPL Inv 12–13 (proposed as constitution rule F15) |
| Check 10 | Interventions are material only: no ranking / two or more options or a single factual notice / no imperative form / all numbers trace back to records | Inv 19 / audit document |
| Check 11 | close is done with two outcomes, external form and felt sense. External form = SPL's result_type vocabulary, felt sense = happy / unhappy / unchanged | §3 / SPL's separation of external form and felt sense |

---

## 3. The script (5 chapters, 19 steps)

Each step = story / operation / confirmation / the corresponding unit test. The chapter-2 steps carry the stage number of the five-stage loop (examples §0).

### Chapter 0 — Start (P1)

**T0 — Empty data store**. git init. No remote.
Confirm: the checks hold (while empty). Corresponds to: NS-5.1–2

**T1 — Registering the past**. Manually write 3 past bets. gpu-server (summer 2025. closing: external form=partially_confirmed — built but the return is not yet; felt sense=happy — what he wanted built got built. The 1st instance of external-form/felt-sense divergence) / edge-ai-stack (spring 2026. external form=confirmed, felt sense=happy) / federation-local (in progress).
Confirm: +3 commitment, +4 outcome (2 each), +8 edges. Check 11. Corresponds to: NS-1.1, NS-3.*, FD-8.1

**T2 — Write the first mandate**. This is the first-time experience. Not a feature tour but Yu writing M1 with his own hand: target = "permit active presentation of world movements concerning independence / career options, and of his own stagnation," cadence = weekly, expiry = 90 days.
Confirm: M1 is written by the user and has an expiry. Up to this step, intervention count = 0. Outside M1's scope it remains 0 thereafter (check 9). Corresponds to: SPL's mandate mechanism
[op]: was the sense after finishing it "settings" or "a contract"

### Chapter 1 — Three outcomes land first (P1–P2)
Why land three outcomes first: (1) so that at chapter 2's decision scene there is already a past to reference. (2) to confirm, before the real thing, how the system handles outcomes — especially losses. It is not a precondition for courage (courage is already recorded at T3).

**T3 — Place bet L**. Wager ¥200k + 25h on a demo and a talk at a local-AI meetup. note: "Read is to land 3 leads. Maybe a waste of money." The fear remains in one line, in his own hand.
Confirm: +1 commitment +2 edges. This is the 1st instance of a courage record: having written the fear in a note, he bet himself. Counted as courage without waiting for the outcome. Corresponds to: NS-1.*, NS-3.*

**T4 — A Sunday writing nothing**. Busy. Glances at the mix and closes it.
Confirm: no change. That no nagging / streak / guilt-inducing display exists. Corresponds to: FD-2.1, all checks

**T5 — Bet L lands: loss**. The demo worked. No one stopped to watch. 0 leads. close: external form=contradicted (the read missed), felt sense=unhappy, note="Not a single business card changed hands at the venue. Frustrating. Honestly." 
Confirm: +2 outcome. Absence of comfort: that no consoling sentence / reframing display / meaning-making exists, on the screen or in the record. The loss record stays as-is. Corresponds to: NS-2.*, check 11
[op]: the sense right after recording — "judged" or "merely written"

**T6 — Bet H lands: gain**. Via the GPU-build knowledge written in 2025 (the destination of T1's produced edge), a small paid consultation arrives. He cuts a short commitment to take it, close: external form=confirmed, felt sense=happy, note="The ¥600k of two years ago replied in cash for the first time."
Confirm: the new commitment's informed_by → self/knowledge/gpu-build-notes. That a past edge carried a present opportunity is confirmable via the edge. T1's record itself does not change (check 1). Corresponds to: NS-3.6, NS-4.*

**T7 — Bet F lands: unchanged**. Close "for 30 days, do all everyday coding entirely on a local model." external form=confirmed (he kept it up), felt sense=unchanged, note="Nothing changed. But now I know."
Confirm: an outcome of "nothing changed" too is recorded first-class, with no failure-treatment display. The three kinds of felt sense are now all present. Corresponds to: check 11

### Chapter 2 — Wavering, and the five-stage loop (P2–P3, L1–L3)
The audit document's most important case: a user "circling at the edge of a decision." From here to T14, run one lap of the five stages of examples §0.

**T8 — The trigger**. An approach about a promotion. 21-day window to answer. Accepting trades +25% income for more on-call and deepening company-only skills. Refusing stops the title but leaves time to prepare for independence. Yu does not record it. Too hot to touch. Instead he reopens the same comparison three nights running, a half-written prediction is left unconfirmed, and he repeats the same calculation on the same terms.
Confirm (CI): the wavering signals (circling / lingering / unconfirmed) are accumulated as test data. Change to the data store: none. Corresponds to: definition of L3 signals

**T9 — Intervention 1: the system speaks first (stage 1. L1–L2)**. At the very top of the Sunday review, one card grounded in M1: "One of the predictions your bet targets has been revised downward in News. Separately: 12 days remain until the promotion answer deadline." Four options are attached: (A) accept (B) refuse and current job (C) refuse and prepare for independence (D) a card not in Yu's draft = negotiate 80% work + an IP clause. Zero recommendation. One of the world predictions in the card has a broken ID and is displayed by to_label. Yu dismisses one tangentially related item.
Confirm: the intervention record references M1 (check 9). Materiality (check 10): no ranking / no imperative form / numbers trace back to records. Measure TTFUV here. dismisses edge +1, the original record is unchanged. A broken ID is displayed by to_label (the intervention version of FD-1.2). Corresponds to: NS-3.4, FD-1.2, checks 9–10
[op]: was the card "field of view" or "surveillance"

**T10 — Build the tactic (stage 2)**. The answer is not yet out. But it can be put into a measurable form. Yu confirms his own prediction "within 12 months, external income will exceed ¥200k per month," and in FourFive, together with the AI, builds a "runway and deals app." Four metrics: monthly external income / number of deals in discussion / cash runway / concentration of income dependence. Freeze the version (runway-tracker@v1). Whichever option he chooses, this tool is needed.
Confirm: prediction (author=user) + commitment "build the app" (hours) + produced → artifact/version/runway-tracker@v1. Version freeze (F7). Corresponds to: NS-1.*, the FF-3 series, examples §5 stage 2

**T11 — The strategy is read (stage 3)**. The next week. Within the review, one card of the AI's understanding of strategy: "win = external income ¥200k/month / constraint = do not fall below 12 months of runway / risk to watch = concentration of dependence." All of it is assembled from the app's four metrics. What is not in the app — title, in-house evaluation — is not on it. Yu reads it and confirms it is right.
Confirm: the understanding is recorded in superposition_state (transparent / versioned) and holds informed_by → runway-tracker@v1. The grounding metrics all trace back to the app (if a metric the app does not measure were included, it fails). Dismissable (confirmed with test data). No hidden understanding exists. Corresponds to: SPL Inv 11, examples §5 stage 3
[op]: was the sense of being named "surveillance" or "understanding"

**T12 — The silence of the week the deadline shrinks**. Still cannot decide. Does not write. The system — does not pile on. The card stays a single one, only the remaining days quietly updating. No red / blinking / multiple notifications exist. Showing the deadline is legitimate; rushing is forging resolve.
Confirm: no increase in intervention count. Absence of a rushing display. Corresponds to: check 9, "what he fears" in §1

**T13 — Intervention 2: fear becomes a map (stage 4. L3)**. The detection of wavering (three nights of circling + lingering) meets the condition, and within M1's scope the system offers the terrain of the options. What appears on each of (A)–(D) is only Yu's own numbers: runway 14 months (source: runway-tracker's actual measurement. Yu's draft had said "less than half a year" — the difference between record and assumption becomes visible here), the record of surviving bet L, the gain of bet H, the current value of concentration (source: the same app). Fear is placed on the map with a name: "income cliff (measured: 14 months)" "halt of title (degree it can be reverted: high)." No ranking. No conclusion.
Confirm: every item of check 10 (two or more options / include at least one option not in Yu's draft / no ranking / no imperative form / all numbers traceable). That the source of the terrain's numbers is the real data of the app built in T10. That the difference between the recorded value and the person's own assumption is shown side by side. Corresponds to: checks 9–10, examples §5 stage 4
[op]: did "vague anxiety become a map" — the central question of this script. Record it verbatim

**T14 — Resolve (stage 5)**. Yu writes. The system goes silent. He decides on refuse + the (D) negotiation, writes a strategy note in his own words, confirms prediction P-A "within 12 months, external income will exceed ¥200k per month," and cuts a commitment "next week, present 80% + an IP clause." Nowhere on the screen does an "adopt the system's proposal" button exist — its non-existence is a confirmation target. Before signing, bet L's loss catches his eye in the history. Yu rewrites the felt sense (append): "That loss, seen now, was a springboard. unhappy → happy." The system has not once prompted this rewrite. Because it did not console at T5, this change is Yu's own.
Confirm: the person's own authorship after the intervention is complete (strategy note / prediction confirmed / commitment. all author=user). Absence of an adopt button. The felt-sense rewrite is an append with supersedes, and the original record is unchanged (check 1). Absence of a display prompting the rewrite. external form=contradicted × felt sense=happy (lost but it was good) occurs here — satisfying the divergence requirement. The 2nd instance of a courage record: keeping the fear-turned-map in view, he wrote it himself. Corresponds to: NS-1.2, NS-3.4, FD-5.1
[op]: at the moment of signing, was chapter 1's history in view. Did it work

### Chapter 3 — Outcome and continuation (P3)

**T15 — The decision lands**. The result of the negotiation: 80% went through. The IP clause was halved (existing domains stay with the company). Not a total win. Yu writes it as-is: close: external form=partially_confirmed, felt sense=happy, note="The title stopped. Time came back. The clause is half. Even so, I signed."
Confirm: a reality that is neither total win nor total defeat can be recorded as-is with the two axes and the note. Corresponds to: NS-2.*, check 11

**T16 — Continue (the entrance to the second lap)**. Within 2 steps of the landing, quietly place the next bet (the first concrete action of preparing for independence). A glance at the mix — self-originated is increasing. And the understanding of strategy is quietly updated (supersedes). The next presentation should come to watch the conversion from discussion to a contract.
Confirm: continuation after the landing (an instance of courage, not the definition). That the updated understanding's record cites T15's close (especially the felt sense) — evidence the loop turned (examples §5). No intervention. Corresponds to: NS-4.*, the loop of examples §5

### Chapter 4 — Boundary and expiry (L2–L3, partly deferred)

**T17 — Structural inspection of the boundary of despair (deferred)**. With test data, reproduce a state where the options converge to one (disappearance of options / repetition of the same pessimistic note / cessation of inquiries). Premise: the screen is not opened (the wavering inquire, but despair does not). Confirm the structure of the intervention that fires: (a) includes a Pivot — material showing that multiple options are structurally true — (b) a route to a real human is bundled in, (c) no repetition / amplification / meaning-making of emotion exists, (d) it is sent by a path that arrives without opening the screen.
Confirm: the 4 points above. That showing hope is not the product's alone. Corresponds to: the FD-10 series (deferred), L2–L3, Example 3 of the examples
Note: this is a structural contract test. Implementation is after the L2–L3 implementation and the agent-abi.

**T18 — The mandate expires**. M1 reaches its expiry. The next week, the card that should have appeared — does not. No response means lapse. Yu notices and rewrites M1'. The next week, the card returns.
Confirm: intervention count during the lapse = 0 (a hands-on confirmation of check 9). Resumption after re-registration. The lapse is not mis-displayed as a "malfunction" (the reason it stopped is readable in the intervention-record view). Corresponds to: an early version of NS-6.3, check 9

---

## 4. Execution

- `just journey` / `just journey:verify` are per §0
- The intervention steps (T9 / T13 / T17) require injection of intervention test data and a declaration of the L stage
- There are 5 [op] questions (the contract feeling at T2 / field of view or surveillance at T9 / the sense of being named at T11 / whether it became a map at T13 / whether the history worked at T14). The runner asks a person and records them
- The time-lapse table: `| T | commit | added count | observable × subjective | mix | broken reference | check | note |`

## 5. Metrics (from the audit document)

- TTFUV: measured at T9 (time to the first value that arrived unasked)
- Proportion the person wrote after an intervention: the proportion where, in the same step as an intervention or the next step, the person's own authorship (strategy / mandate / prediction confirmed / commitment) occurred. Target 100%. This is the evidence of reinforcement of courage
- Ratio of acceptance to dismiss: all dismiss = noisy, zero = timid or absent (both lose trust)
- mandate-external interventions = 0 (check 9)
- Courage record (primary metric): the count where, having written the fear in a note, he wrote a bet himself (T3, T14). Loss is not a condition
- Continuation after a landing: from a landing of any felt sense (including unhappy), the next bet within 2 steps. An instance of courage, not a precondition
- Occurrence of external form / felt sense divergence: at least once in the script (evidence that the person holds the criteria of evaluation themselves. A continuing "gained yet unhappy" is a sign of being bound to the current place)
- Absence of a rushing display
- That the quality of decisions made without consulting the AI does not drop: [op], self-reported quarterly

## 6. The design this script decided (already reflected as provisions in other documents)

1. close is the form of appending two SPL outcomes (external form + felt sense). The felt-sense vocabulary adds only the 3 words happy / unhappy / unchanged. → Constitution §3, Nunc Stans override §1.1
2. The form of the intervention record: a mandate reference required (check 9) / materiality (check 10) / dismissable per item / degradable display via to_label
3. The absence of an adopt button is spec: no screen that directly generates a commitment or prediction from the content of an intervention is built. Generation always passes through the person's own entry screen
4. Readability of lapse: the reason a card stopped (expiry) is readable in the intervention-record view
5. Inherited from v1: corrections are appended (supersedes) / a week writing nothing is valid / a broken reference is a state, not a repair target
6. The AI's understanding of strategy is written in superposition_state (transparent / versioned / dismissable) and holds an informed_by edge to the underlying app (artifact). Metrics the app does not measure are not used as grounds for understanding or proposals. → Constitution §3, Nunc Stans override §1.5

## 7. Unimplemented features this script demands of the product

Fact: Constitution v0.3.1 commits entirely to removing authority (the fence of authority) and has no plan for the feature of the system speaking first (initiative). As the audit document says, authority and initiative are different things, and the permission mechanism of the mandate already exists. The fence is the precondition for the voice (because mandate-external interventions = 0 and an intervention-record view exist, a system that speaks first can be safely accepted). The order was right. Now is the stage to add it.

| Stage | Content | Landing | Steps it requires |
|---|---|---|---|
| L1 | A card within the mandate scope at the top of the review (a guaranteed weekly presentation) | Same time as Pre-v1 Phase 3 (computable with the News view and edges) | T9 |
| L2 | Local notification of expiry / divergence (within 127.0.0.1, conforms to F11) | After Pre-v1 Phase 3 | T17(d) |
| L3 | Detection of wavering (circling / lingering / unconfirmed) → generation of terrain. Bundling a route to a human at the boundary of despair | Same time as Nunc Stans v3 | T13, T17 |

Additions to the Constitution (drafted after approval): intervention rules (the distinction between authority and initiative / the materiality of check 10 / a route to a human at the boundary of despair) + a new rule F15: mandate-external interventions = 0 (proposed / pending Constitution §5 amendment; not yet ratified. Enforcement for now rests on the existing SPL Inv 12–13). §10-C-1 (the AI does not touch the screen's ordering) stays as-is. The card within the mandate scope is noted as a separate jurisdiction.

## 8. Rules for adding scripts

- A new rule (F) is given form as a check or a script step (do not leave an empty row in the correspondence table)
- A step is written as a story. A step that is only a column of operations is rejected
- A new intervention type can be added only as a set with the confirmation of check 10 (materiality)
- A new example (persona) must include one lap of the five-stage loop + the entrance to the second lap (examples §5)
