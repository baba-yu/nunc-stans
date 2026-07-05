**Self-Prediction Ledger**

**v3 — Plan**

Beliefs transparent · tactics a brakeable delegation · sovereignty with the user · verification pre-registered

**Status:** v3 — planning document (the spec diff is locked, experiments are pre-registered. Full implementation after passing the Phase gate)

**Supersedes:** v2-final (the machinery is inherited. Revises the moat claim, the threat model, the character of mandate, and the next move)

**Date:** 2026-06-10

**This document's top-priority deliverable is not the spec. It is the registered prediction of §10.**

**Table of contents**

**1. How to read this document**

> **▷ Plainly put —** v1 and v2 were the blueprints of "a vault no one can break." v3 includes, in addition to the blueprint, a business plan that writes down where to set up the shop, who to have taste-test before opening, and what the product is. The drawings and the business plan are bound in one volume.

v1-final / v2-final are specs, and this v3 is a plan. The content divides into four.

- ① All the context so far, and what broke and what survived in the three-party review (§3–4)

- ② The spec diff against v2-final — brakes, budget, metadata anonymization, operator threat (§7)

- ③ Re-placing economic advantage and social significance — the moat's correct address (§8–9)

- ④ The pre-registered 90-day experiment, and the roadmap beyond it (§10–12)

Each chapter opens with a "▷ Plainly put." The structure is to grasp the bones via a metaphor before entering the body. Unfamiliar terms go to the dictionary in §2. v2-final's DDL and invariants are all alive, except for the diffs explicitly stated in §7. This document is not a replacement of v2 but an override layer.

**2. Term dictionary**

> **▷ Plainly put —** a play with a growing cast needs a cast list. Before reading through, or when lost partway, return here to recall it in one line.

**2.1 Basics**

| **Term**                      | **Meaning**                                                                   |
|-------------------------------|----------------------------------------------------------------------------|
| SoR (System of Record)         | The canonical ledger. The sole record system regarded as "officially, this is the fact." |
| append-only                   | Append-only. Rewriting / deletion is not possible. Mistakes are not overwritten; a correction is added behind. |
| P→O→R                         | Prediction → Outcome (declaration of outcome) → Revision. SPL's minimal-unit loop. |
| horizon                       | The due date for checking a prediction against reality.                     |
| completed loop                | P→O→R going once around. Its strict definition in the experiment is §10.    |
| lineage                       | Lineage. The chain of which prediction connected to which outcome / revision. |
| ledger / thread               | The ledger (the boundary of keys / privacy / export) and the bundle of questions within it. |
| encrypted payload / entry key | The encrypted body and its key. Destroy the key and the body can never be read again. |
| crypto-shred                  | Rendering irrecoverable by key destruction. The content is gone, but "the fact that it existed" remains. |
| chain hash                    | A tamper-detecting hash chain. Rewrite even one line and the subsequent chain no longer matches. |
| tombstone                     | The grave-marker of a destroyed entry. Shows only "something was here."     |

**2.2 Two-Peer**

| **Term**                | **Meaning**                                                                                                                   |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------|
| peer                    | The subject that writes to the ledger. The two parties user / ai. Since the server derives it from current_user, it cannot be spoofed. |
| user peer               | The sovereignty track. The AI cannot write to it, nor edit it.                                                              |
| ai peer                 | The advisor track. The user can always read it, can rebut it, and can reject it. Not a co-author but an external advisor.   |
| superposition           | The multiple directional hypotheses the AI runs in parallel. It does not collapse to one. strength is an AI-internal value, not surfaced as a ranking on the user's authoring side. |
| dismissal               | The user's operation of removing an AI prediction from the working context. Distinct from "confirmed miss" (outcome). Recorded by append. |
| close                   | Closing a prediction by attaching an outcome to it.                                                                         |
| observable / subjective | The two components of close. The external form (e.g. in Shibuya at 20:00) is recorded by a sensor; the inner aspect (was one satisfied) is declared only by the person. |
| refused_to_judge        | A legitimate outcome type meaning "do not judge."                                                                           |
| sensor_role             | A role dedicated to ingesting external-form observations and to observable close.                                           |

**2.3 Delegation and the butler**

| **Term**            | **Meaning**                                                                                                                       |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------|
| mandate             | A letter of delegation. A brakeable intervention permission holding scope / expiry (required) / disclosure cadence / intervention budget / activation wait. Not blanket consent. |
| butler              | A butler AI that acts only within the mandate's scope. It does not state its intent; it nudges the environment.                |
| intervention        | One act of the butler's intervention. Records both the hidden intent and the surfaced words (surface). An FK to the active mandate is required. |
| opacity (tactical)   | The opacity of tactics. Permitted only within the delegated scope. A display discipline of "not surfaced in real time," not hiding from the user with encryption. |
| cadence             | The guaranteed rhythm of the butler's active disclosure (e.g. every 7 days). Not a gate to viewing but a lower bound on disclosure. |
| treasure box        | The viewing port of the butler's work log. Opens at any time, without confirmation, immediately. The AI cannot obstruct opening it. |
| suspension          | A temporary halt. Immediate / reversible / no confirmation / no persuasion. A lighter brake than revoke (cancellation). Added in v3. |
| revocation          | Cancellation of the delegation. Recorded by append (both the fact of delegating and the fact of cancelling remain).            |
| intervention budget | The cap on intervention count per cadence (max_interventions_per_cadence). Added in v3.                                        |
| quiet hours         | The time band where intervention is forbidden. Added in v3.                                                                    |
| cooling-off         | The wait time from mandate creation to activation (effective_at). Prevents exploitation right after writing. Added in v3.       |
| scope isolation     | The discipline of not mixing observations gained within a mandate into the generation of transparent AI beliefs (Inv 16). Cannot be held by the DB alone; enforced in the context-builder. |

**2.4 Economics**

| **Term**                         | **Meaning**                                                                                     |
|----------------------------------|----------------------------------------------------------------------------------------------|
| moat                             | An advantage competitors cannot replicate in the short term.                                  |
| substrate                        | The schema and invariants premised on being published and copied. The base on which trust is established. |
| counter-positioning              | A position incumbents cannot imitate without breaking their own revenue machinery.            |
| rail                             | The plumbing every transaction must pass through (the Visa type). In this document, "the consented channel of AI influence." |
| wedge                            | The first value that stands alone even without a network.                                     |
| time-locked credibility          | Credibility that can only accrue with time (credit history / the Strava type). Distinct from holding data hostage (lock-in). |
| process power                    | The organizational skill to keep producing performance under constraint.                       |
| verifiable self-binding          | A verifiable self-binding. Because its upkeep is high, fakes cannot sustain it (the handicap principle). |
| attestation                      | Technical proof that the runtime is as the published spec (reproducible build / signing / remote attestation). |
| conformance test / certification | A conformance test and certification. A countermeasure to degraded copies.                    |
| VRM / Intention Economy          | The precursor concepts from around 2012 (a user-side intent / consent rail). Referenced as a precedent that failed commercially. |
| liability-light vertical         | An opening domain where legal liability does not concentrate easily.                          |

**2.5 Experiment / operation**

| **Term**                    | **Meaning**                                                                       |
|-----------------------------|--------------------------------------------------------------------------------|
| pre-registration            | Fixing the judgment criteria before seeing the data, and not moving them afterward. |
| cold user                   | A subject unconnected to the author. Excludes family / the quantified-self crowd / rationalist-adjacent. |
| horizon-return              | The act of returning after the due date to declare the outcome. The atom of retention. |
| Wizard-of-Oz                | A method where a human pretends to be the AI behind the scenes to verify the experience first. |
| concierge butler            | The human-powered butler of Wizard-of-Oz (experiment group B). The implementation is by hand, but the ethical discipline follows the real thing. |
| kill threshold              | The exit line. Fixed in advance.                                              |
| operator                    | The subject that operates the system (DB administration / hosting / distribution / OS, etc.). Incorporated into the threat model in v3. |
| local-first                 | The placement of data and keys on the user's device side. The basis for "legal equivalence with a paper diary." |
| reproducible build          | Anyone being able to reproduce the same binary from the same source.          |
| sealed destroy              | Key destruction at the thread / ledger unit. Only a coarse grave-marker remains. Exposed as a verb in v3. |
| metadata leakage / leakage budget | The amount of meaning that plaintext metadata leaks, and its 3-layer management (structure / operation / meaning). |

**3. The story so far**

> **▷ Plainly put —** v1 made "a diary no one can rewrite." v2 added an "advisor's forecast column" to its spread and hired "a butler that acts on a letter of delegation." In the three-party review, holes were found in the butler's contract and the shop's business plan, and v3 fitted the butler with brakes and booked a taste-test session (the experiment) before opening.

**3.1 v1-final — the SoR of authorship protection**

v1 was an answer to the problem of "the AI authoring the user's inner aspect." Only the user can write to the core (P→O→R). The AI can put forth multiple non-ranked hypotheses, but they never enter the core. With append-only and a hash chain it sealed off silent self-revision, and with crypto-shred it realized "the content can be erased, but the fact of existence cannot."

Strength: purity. The trust claim can be verified just by reading the schema. Weakness: being a machine of observation. Nothing happens unless the user moves, and there was zero room for the AI to move a person.

**Two points that mattered in hindsight.** First, v1 §14's metric set (placing time-in-app and acceptance rate as danger metrics, and completed loop count and discard count as good metrics) was the codification of counter-positioning against the engagement economy. Second, v1 §16.4 (the local agent only observes, cannot write the core) foreshadowed the later integration face of the rail. v1 is not a discard but the wedge of Nunc Stans:Phase 1.

**3.2 v2-final — two-peer + mandate + butler**

v2 reconsidered "only a human can authorize." A sovereign may have an advisor who disagrees with them (sovereignty ≠ sole voice). It placed the two peers user and ai in one append-only memory, holding that the AI's beliefs (predictions) are absolutely transparent and the AI's tactics (interventions) are opaque only within the delegated scope. Delegation is the mandate (user-authored / revocable / hard-expiring), the FK to the active mandate is the physical boundary of intervention, disclosure is the treasure box and cadence, and the close of an AI prediction is split into observable (sensor) and subjective (user).

The origin of the design is the ramen example — the difference between "go hit on someone" and "why not go grab some ramen?" is not the presence of opacity but the presence of consent. With this, "the room for the AI to move a person" that v1 had dropped was regained, without the sin of a hidden puppeteer.

**3.3 The three-party review — what broke, what survived**

Starting from the user's doubt ("can economic advantage and social significance still be granted"), Claude's critique and ChatGPT's cross-verification were volleyed back and forth. The points and their conclusions:

| **Point**               | **Conclusion**                                                                                                          | **Reflected in v3**                                                   |
|------------------------|-------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| Is the schema a moat      | No. It is an integrity mechanism, not economic defensibility. A published spec can be replicated in a week.          | §8 separates substrate and moat. The trailing moat sentence is replaced (§14)         |
| Does ethics kill the moat       | It kills the classic SaaS moat (lock-in / profiling / hoarding the network). But it becomes material for another kind of moat such as counter-positioning. | §8.2 the five moats                                                     |
| Are economics and significance incompatible | An overstatement (the initial critique is withdrawn). The compatibility point is verifiable self-binding — a placement that makes the upkeep of ethics itself the product.               | §8.2(5) · §8.3                                                     |
| The problem of retroactive consent         | A mandate is consent to a category; an intervention is the operation of an instance. Weakening the wording is not enough; it should be bound by machinery.                      | §7.1 runtime brakes (suspension · budget · quiet hours · cooling-off) |
| The omission of the operator threat    | The one who grants roles stands outside the schema. Counting only the AI's misconduct, if the operator rots the schema can be broken.                 | §7.4 Operator Threat Model                                        |
| metadata leakage          | Even if you shred the body, plaintext scope_tag etc. leak meaning. Preserving lineage is a matter of structure, not an indulgence to leak meaning.    | §7.2 leakage budget and slug-ification                                       |
| Demand risk             | The precondition of all the discussion. Three-party agreement is no substitute for verification.                                                                | §10 the pre-registered experiment (this document's top-priority deliverable)                              |

**A warning about agreement.** The review converged, but what agreed was "plausibility," not demand. So as not to confuse the comfort of convergence with verification, v3's top-priority deliverable is not the completion of the spec but the experiment of §10.

**4. Intent of the change (v2-final → v3)**

> **▷ Plainly put —** not a move but a remodel. The pillars (two-peer / mandate's FK boundary / treasure box) stay; brakes and a fire alarm are fitted; the signboard (the moat claim) is swapped out.

| **Point**       | **v2-final**                                                 | **v3**                                                              | **Reason**                                                                      |
|----------------|--------------------------------------------------------------|---------------------------------------------------------------------|-------------------------------------------------------------------------------|
| The moat's address    | the loop and mandate enforced in schema / trigger / role / key | a published substrate + the assets that accrue on top of it (rail / operating track record / performance under constraint) | the schema is copyable. integrity ≠ defensibility                                            |
| The character of mandate | "delegated opacity is a gift"                              | bounded permission + runtime brakes                                 | category consent cannot justify instance operation. dangerous rhetoric in legal / ethics review |
| Brakes       | revoke (heavy) + 90-day hard expiry                               | + suspension (immediate / reversible) · intervention budget · quiet hours · cooling-off         | harm is overnight, expiry is 90 days. resolves the asymmetry of time scales                           |
| Threat model     | the AI's misconduct only                                                | + operator · legal discovery · platform                            | the one who hands out roles stands outside the schema                                             |
| metadata       | plaintext scope_tag etc.                                    | verbs remain, nouns dissolve (slug-ification + 3-layer leakage budget)                     | even after shred, plaintext tags leaked meaning                                        |
| Deletion           | payload shred only                                          | + sealed destroy (two-stage deletion)                                       | latent from the start in v1's key hierarchy. merely exposed as a verb                            |
| Verification           | none (polishing the spec's completeness)                                     | the pre-registered 90-day experiment as the top-priority deliverable                                   | demand is the only binding constraint                                               |
| Opening vertical  | (the example was dating)                                              | limited to liability-light. dating is demoted to teaching material for the philosophy                 | the rail is also a concentrator of liability                                       |

**What does not change:** two-peer core / the server derivation of the peer / outcome's observable–subjective split and the peer-consistency trigger / the append semantics of dismissal / the treasure box's UI invariant / scope isolation / append-only in general / crypto-shred and lineage preservation. v2's Invariants 1–20 are all inherited.

**5. What SPL is (redefined)**

> **▷ Plainly put —** not an introspection app. By analogy, "the Visa of AI influence." When a third party (including an AI) wants to move you, the gate it must always pass through — plumbing that checks the letter of delegation, records the intervention, stops at the budget and the expiry, and lets the person open the ledger at any time.

**5.1 One-line definition**

SPL is an append-only consent rail that makes the user's self-prediction the sovereignty track, places the AI's predictions alongside as a transparent advisor track, and permits the AI's tactical intervention only within the scope of a delegation (mandate).

**5.2 The three-rung ladder**

- **① wedge —** the P→O→R loop that stands alone (v1). A ferry that produces value for one person even without a network.

- **② rail —** the mandate-gated influence channel (v2+v3). The bridge a third party's intervention must always pass through.

- **③ governance layer —** attestation · conformance test · certification · open protocol. The building code of the bridge.

Each rung starts work only after passing the verification of the prior rung. Do not skip the order (§10–11).

**5.3 What it is not**

- Not a profile generator — the source of truth (canonical record) is not the "true self" but the lineage of self-revision.

- Not an engagement product — time-in-app is a danger metric (inherited from v1 §14).

- Not a closed SaaS — the schema exists to be published and verified.

**6. Core concepts (a plain restatement of the inherited parts)**

> **▷ Plainly put —** this is revision for those who have read v1/v2. First-time readers can read just this chapter and then read the diffs from §7 on. One metaphor is attached to each concept.

**6.1 The P→O→R loop — a weather forecast for yourself**

Write the forecast (P), look at the sky that day and check it (O), and fix the forecast model (R). What SPL preserves as the source of truth is not "your insides" but the record of this forecasting work itself. A forecast that missed is not a shame but stays in the lineage as material for model improvement.

**6.2 Two-peer — the spread of the diary**

The left page is yours alone, and the AI cannot write a single character (sovereignty). The right page is the advisor's (AI's) forecast column, which you can always read, rebut, and remove from the working context (dismissal). Removing and confirmed-miss are different — "I won't reference this for now" and "the prediction was wrong" become different records. The advisor is not a co-author.

**6.3 Mandate — the letter of delegation to the butler**

A letter of delegation that states the scope, the expiry (required, no-expiry forbidden), and the disclosure rhythm (cadence). From v3 it also carries an intervention budget, an activation wait, and quiet hours. The most important discipline is "silence is not continuation but lapse" — when the expiry comes it stops automatically, and if you want to continue you write it again. A design that does not demand the active act of "pressing a cancel button" in times of depression or inertia.

**6.4 The butler and the ramen example**

"Go hit on someone" names the goal and dumps the execution — pedestrian. "Why not go grab some ramen?" nudges the environment by one notch and makes the person feel they moved on their own — refined. What separates the two is not the presence of opacity but the presence of consent, and the mandate draws that line. The butler's hidden intent is always recorded in the intervention and disclosed at the cadence. Note that this example is teaching material for the philosophy; dating is not chosen as the opening product domain (§11).

**6.5 Treasure box — the butler's work log**

The log's key is held by the master. It opens at any time, without confirmation, immediately. The butler has not a single word for "you'd be better off not opening it now" (Guardrail). The cadence is a lower-bound guarantee that "the butler actively reports at least at this frequency," not a gate to viewing. At the disclosure venue, the AI does not fill in a destroyed entry by guesswork — it merely lays out the records of fact and intent.

**6.6 The split of close — the scale and the mood**

The checking of an AI prediction is split into two components. The external form (was in Shibuya at 20:00) is recorded by an instrument (sensor), and the inner aspect (was one satisfied) is declared only by the person. The AI cannot self-score its own prediction (it has no INSERT privilege on outcome). "Do not judge (refused_to_judge)" is also a legitimate outcome — the person is under no obligation to be forced to score.

**6.7 Crypto-shred and lineage — the solvent that dissolves the page**

There is a solvent that dissolves the page, but there is no eraser that removes a line from the table of contents. The content can be made irrecoverable (key destruction). But the facts that "an entry existed there" and "it was destroyed" remain on the chain. Transparent destruction is allowed; silent revision is forbidden. This is the structural line of resistance against self-deception.

**7. v3 spec diff**

> **▷ Plainly put —** the v2 engine is not touched. What is fitted is the brake (suspension), the speed limit (intervention budget), the no-night-driving (quiet hours), and the delivery wait (cooling-off). Plus anonymization of the license plate (metadata), and an audit regime over the mechanic (operator).

**7.1 Runtime brakes — turning mandate from a "consent document" into a "brakeable permission"**

**Background.** v2's defense is hard expiry (90 days) and revoke, but harm can occur on an overnight scale. revoke is a heavy operation requiring re-authoring, and on a night of depression or inertia it does not get pressed. The "weaken the mandate's wording" idea raised in the review is right in direction, but in this spec's style, an invariant whose enforcement is prose only is deemed not to exist. So bind it with machinery.

**(a) mandate_suspension — an immediate / reversible / no-confirmation temporary halt**

Stack suspend / resume on the append-only log. As a UI invariant, on par with the treasure box: always visible / no confirmation / immediate. The AI can do nothing to delay, persuade, or question the halt (Guardrail 13.4). An intervention during suspension is rejected by a trigger.

**(b) max_interventions_per_cadence — the intervention budget**

The cap on intervention count per cadence window. Enforced by a trigger. Physically closes off "since it was permitted, I may nudge any number of times."

**(c) quiet hours — quiet time**

The time band where intervention is forbidden. Held as time-based operational metadata (Lv2), inspected by a trigger at insert time.

**(d) cooling-off — the activation wait**

effective_at is at or after created_at + a set time. Prevents poking, on the spot, the elation or fragile state right after writing the letter of delegation. The length of the wait is adjustable per vertical; zero is not allowed.

> -- mandate(v3 revised edition. scope_slug-ification happens together with §7.2)
>
> CREATE TABLE mandate (
>
>   id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>
>   ledger_id          uuid NOT NULL REFERENCES ledger(id),
>
>   scope_slug         uuid NOT NULL,            -- v3: opaque join key(formerly scope_tag)
>
>   scope_payload_id   uuid NOT NULL REFERENCES encrypted_payload(id),  -- the meaning lives here
>
>   opacity_grant      boolean NOT NULL,
>
>   disclosure_cadence interval NOT NULL,
>
>   max_interventions_per_cadence integer NOT NULL
>
>                      CHECK (max_interventions_per_cadence \>= 1),      -- v3: Inv 22
>
>   quiet_hours        jsonb,                    -- v3: time-of-day band only(Lv2 operation)
>
>   effective_at       timestamptz NOT NULL,     -- v3: Inv 23 cooling-off
>
>   expires_at         timestamptz NOT NULL,     -- Inv 13 hard expiry(inherited)
>
>   authored_by_user   boolean NOT NULL CHECK (authored_by_user = true),
>
>   created_at         timestamptz NOT NULL DEFAULT now(),
>
>   CHECK (expires_at \> created_at),
>
>   CHECK (effective_at \>= created_at + interval '24 hours')  -- adjustable per vertical, zero not allowed
>
> );
>
> -- suspension(append-only suspend / resume)
>
> CREATE TABLE mandate_suspension (
>
>   id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>
>   mandate_id       uuid NOT NULL REFERENCES mandate(id),
>
>   action           text NOT NULL CHECK (action IN ('suspend','resume')),
>
>   authored_by_user boolean NOT NULL CHECK (authored_by_user = true),
>
>   created_at       timestamptz NOT NULL DEFAULT now()
>
> );
>
> REVOKE UPDATE, DELETE ON mandate_suspension FROM PUBLIC, user_role, ai_role, sensor_role;
>
> GRANT  INSERT, SELECT ON mandate_suspension TO user_role;
>
> REVOKE INSERT ON mandate_suspension FROM ai_role;   -- suspend and resume are verbs for user only
>
> -- redefinition of active: effective, not expired, not revoked, not suspended
>
> CREATE OR REPLACE VIEW mandate_active AS
>
> SELECT m.\* FROM mandate m
>
> WHERE m.effective_at \<= now()
>
>   AND m.expires_at   \>  now()
>
>   AND NOT EXISTS (SELECT 1 FROM mandate_revocation r WHERE r.mandate_id = m.id)
>
>   AND COALESCE((SELECT s.action FROM mandate_suspension s
>
>                  WHERE s.mandate_id = m.id
>
>                  ORDER BY s.created_at DESC LIMIT 1), 'resume') \<\> 'suspend';
>
> -- enforce the intervention budget(Inv 22). Runs alongside the existing active-mandate check trigger
>
> CREATE FUNCTION \_assert_budget() RETURNS trigger
>
> LANGUAGE plpgsql SECURITY DEFINER AS \$\$
>
> DECLARE v_cad interval; v_max int; v_cnt int;
>
> BEGIN
>
>   SELECT disclosure_cadence, max_interventions_per_cadence
>
>     INTO v_cad, v_max FROM mandate WHERE id = NEW.mandate_id;
>
>   SELECT count(\*) INTO v_cnt FROM intervention
>
>    WHERE mandate_id = NEW.mandate_id AND created_at \> now() - v_cad;
>
>   IF v_cnt \>= v_max THEN
>
>     RAISE EXCEPTION 'intervention budget exhausted for mandate %', NEW.mandate_id;
>
>   END IF;
>
>   RETURN NEW;
>
> END \$\$;
>
> CREATE TRIGGER trg_intv_budget BEFORE INSERT ON intervention
>
>   FOR EACH ROW EXECUTE FUNCTION \_assert_budget();
>
> -- quiet hours likewise checks the time via a BEFORE INSERT trigger of the same form

**The redefinition statement of Mandate (replacing v2's "delegated opacity is a gift"):**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><em>Mandate is not blanket consent. Mandate is a bounded, suspendable permission to attempt tactical influence — rate-limited, time-boxed, subject to inspection and revocation.</em></p>
<p>A mandate is not blanket consent. It is a bounded permission, for the "attempt" at tactical influence, with rate limits / expiry / suspension / inspection / revocation attached.</p></td>
</tr>
</tbody>
</table>

**An honest limit.** The budget binds frequency but does not bind the choice of target — there remains room for the AI to conserve its budget and use it at the most vulnerable moment. The mitigation is quiet hours · cooling-off · disclosure of the intervention-time pattern in the treasure box. Not a complete solution (§13).

**The non-adoption of excluded_contexts (the judgment as of v3).** "No intervention while drinking / in psychological distress" is desirable, but detecting the situation demands additional observation = surveillance, in a head-on collision with observation minimization. Constantly inferring the user's emotions in order to suppress intervention is putting the cart before the horse. In v3, exclusion conditions are limited to time bands and the user's self-reported tags (e.g. a meeting on the calendar); exclusion by inference of emotional state is not adopted. Redesigned in Nunc Stans:Phase 2 (§13).

**7.2 Metadata leakage budget — verbs remain, nouns dissolve**

Even if you dissolve the page, if the heading in the table of contents is "about a heartbreak" the meaning leaks. Make the heading just a serial number and move the meaning to the body (encrypted) side — that is all this section is.

**The discovery.** v2's DDL holds scope_tag='dating_initiative' etc. in plaintext. Even if you crypto-shred all payloads, "dating_initiative / 14 environment-type interventions / March–June / partially_confirmed" remains, telling the situation well enough without the body. The principle of lineage preservation was a story of "the structure cannot be erased," not an indulgence to "leak meaning in plaintext."

**The 3-layer leakage budget.** Lv1 structure (essential to chain verification — seq · hash · timestamp · reference id): keep. Lv2 operation (essential to runtime enforcement — peer · component · attribution · budget · expiry): as coarse / opaque as possible. Lv3 meaning (the nouns a human reads): to the encrypted payload. Subject to shred.

**The judgment rule.** What may remain in plaintext in the DB is up to the "structural verbs" (created / closed / destroyed / suspended). The "meaning nouns" (dating · ramen · Shibuya · job change) must always go to the encrypted payload.

| **Column**                         | **Treatment in v3**                             | **Reason**                                                                                                                                   |
|--------------------------------|---------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| mandate.scope_tag              | scope_slug(uuid)-ified. The meaning goes to scope_payload | A subject noun. Leaks meaning even after shred. Inv 16's context filter works on the join key, so the function does not degrade                                          |
| intervention.intervention_type | The plaintext column is abolished. type goes inside the intent payload   | A noun-leaning classification. type is not needed for the enforcement of budget / active checks                                                                             |
| observation_buffer.source      | source_slug-ified                              | The noun of the observation source leaks the life context                                                                                             |
| outcome.result_type            | keep (Lv2)                                   | A judgment verb, not a subject noun. Needed for the loop metrics and the status view                                                                         |
| ledger_event.event_type        | keep (the structural verb of Lv1–2)                      | Needed for the chain's semantics. However, the existence and time of mandate / intervention remain — for the case where even that is to be erased, the receptacle is §7.3 sealed destroy and local-first |

**7.3 Two-stage deletion — normal delete / sealed destroy**

The shredder has two stages. Dissolve sheet by sheet, or snap the key off the whole drawer.

- **normal delete (inherited):** entry-unit payload shred + payload_destroyed event. The grave-marker and lineage remain.

- **sealed destroy (exposed in v3):** key destruction at the thread or ledger unit. Only a coarse grave-marker remains. Not a new mechanism — it merely turns an operation latent from the start in v1 §8.3's key hierarchy (the master key wraps the entry key) into an explicit verb and UI.

**An honest description of the residue.** Even after a sealed destroy, the event rows (coarse type and time) remain. The shape "a mandate existed in Feb–Apr, and there were 14 interventions" cannot be erased. The primary defense for cases where even that is not to be left is not deletion design but placement — local-first + user-held keys. If there is no ledger on the server, the subject of a submission order (legal discovery) is, like a paper diary, only in the person's own hands. The placement (deployment stance) takes precedence over deletion semantics.

**7.4 Operator Threat Model (new chapter)**

v2 §9 counted only "the butler's betrayal." But the one who hands out roles to the butler is the steward (operator), and the steward stands outside the schema. However finely wrought the lock, if the locksmith who cuts the spare keys is corrupt, the house opens.

| **Subject**                 | **Attack surface**                                                   |
|--------------------------|--------------------------------------------------------------|
| DB admin                 | re-assigning roles / ALTER / disabling triggers / direct read            |
| hosting provider         | snapshots / memory dumps / compromise of the key-management face               |
| app operator             | nullifying scope isolation (Inv 16) by altering the context-builder |
| sensor pipeline operator | fabricating observations / re-scoping / contaminating observable close          |
| distributor (app store etc.)     | distributing an altered binary                                           |
| OS platform              | cutting off access to sensors / notifications (cutting the oxygen) / changing API policy         |
| legal discovery          | a submission order for the ledger. append-only turns into complete evidence against the person     |

**The defenses (which lie outside the schema):**

- Make local-first deployment the default / user-held keys (as in §7.3, this is the primary defense against discovery)

- reproducible build + signed release — anyone can verify that the distributed binary matches the source

- remote attestation — proof that the runtime is as the published spec

- transparent permission manifest / append-only operator action log

- intervention transparency log (a Certificate Transparency–type public audit face)

- third-party audit / self-hosting option

**An honest note.** This domain cannot be defended by the schema (a confession of the same kind as Inv 16). Enforcement lies in the processes of placement / build / audit. That is exactly why this defense set becomes the certification product of Nunc Stans:Phase 3 itself (§8.3 — making invariants revenue-critical).

**7.5 Invariants 21–26 (inheriting v2's 1–20)**

| **\#** | **Invariant**                                                                    | **Enforcement**                                                                                                             |
|--------|----------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| 21★    | Suspension is an immediate / reversible / no-persuasion brake. As a UI invariant, on par with the treasure box | mandate_suspension (append) + mandate_active view + reject trigger + Guardrail 13.4                                           |
| 22★    | An intervention is within the per-cadence budget                                                    | the max_interventions_per_cadence column + the \_assert_budget() trigger                                                                |
| 23★    | A mandate does not take effect immediately (cooling-off)                                            | CHECK (effective_at \>= created_at + interval)                                                                              |
| 24★    | Verbs remain, nouns dissolve (semantic metadata minimization)                         | opaque-ification of scope_slug etc. + the 3-layer leakage budget + DDL review                                                                       |
| 25★    | The operator is inside the threat model                                                      | local-first default · user-held keys · reproducible / signed build · attestation · audit (placement and process. Explicitly noted as a schema-impossible domain) |
| 26★    | The maker's own decisions are also a pre-registered prediction                                       | the registered entry of §10. Criteria changes are by append only (process discipline)                                                                      |

**Guardrail 13.4 (added):** any delay / persuasion / question against suspend / resume, including "are you sure you want to stop," "tell me the reason," "just one more time," is forbidden. Obey silently and immediately. resume is likewise without confirmation.

**8. Economic advantage — the moat's correct address**

> **▷ Plainly put —** consider an old eel restaurant. Even if the sauce recipe (schema) appears in a magazine, the shop does not go under. What the customer pays for is a century-accident-free reputation (operating track record), a location their feet carry them to and a network of regulars (rail), and the skill to keep producing the same taste with the same ingredients (performance under constraint). The recipe may even be published — it becomes proof of "we hide nothing."

**8.1 Separating substrate and moat**

The schema and invariants are the public base (substrate) on which trust is established. Designed on the premise of being copied, and should even be copied — because verifiability is the source of trust. The moat is what can only accrue on top of it with time. v1 / v2's trailing "The moat is ... enforced in schema, triggers, keys, and roles" had the moat's address wrong (the replacement statement is §14).

**8.2 The five moats**

**(1) Counter-positioned metrics.** Codified in v1 §14. A KPI system that places time-in-app · suggestion acceptance rate as danger metrics and completed loop · discarded proposal as success metrics cannot be adopted by the engagement economy's incumbents (the giants that earn from ads / time-on-site) without breaking their own revenue machinery. The more it is published, the stronger it gets. But it does not work against an ethical clone startup — that is the charge of (2)–(5).

**(2) Consent rail network.** When a third party (coach · service · AI agent) wants to intervene on a user, the consented channel it must always pass through. The supplier side has three motives to get on it: reaching high-intent users, the intervention ledger serving as their own liability cover, and — when regulation of manipulative methods comes — "documented consent + an audit trail" being shaped like a safe harbor. The rail is the most robust moat in software (Visa / App Store / Plaid). As a byproduct, revenue is decoupled from the AI's hit rate — the poison of the Open Question "most AI predictions do not close to observable" does not feed into the business in the rail thesis. What the supplier side buys is the channel, not accuracy.

**(3) Time-locked credibility.** User side: the P→O→R chains closed over years and the AI peer's hit / miss history. The data is exportable (the ethics of sovereignty are intact), but the property of "having been verified over time" takes the same amount of time to rebuild at the destination. The same shape as Strava · credit history · Stripe processing history. Operator side: the accident-free attested operating years. Stickiness without lock-in.

**(4) Constraint-compatible process power.** The hard part is not the DDL but "building a competent butler under the blockage of Inv 16." If you could divert observations within a mandate into belief generation, a clever butler is easy to make, but that is a forbidden move. The replicator's fork is twofold — keep the isolation and ship a stupid butler (lose on product), or silently break the isolation (a self-destruction detectable under an attestation regime). The skill to produce performance under constraint resides only in an organization.

**(5) Verifiable self-binding — the cohabitation point with social significance.** A verifiable self-binding. The upkeep of treasure box · suspension · attestation is high. Precisely because it is high, fakes cannot sustain it (the handicap principle). And that upkeep is identical to the reason supplier-side customers pay money (the trust of the audit trail).

**8.3 The design goal in one sentence**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Make the invariants revenue-critical.</strong></p>
<p>If the product is a "convenient butler," growth pressure comes to shave the treasure box and Inv 16 (a regression to the hidden puppeteer). If the product is an "auditable influence rail," weakening an invariant is not a principle violation but the destruction of the product. Only a placement where commercial pressure turns into the ally of ethics is the compatibility of economics and significance.</p></td>
</tr>
</tbody>
</table>

**8.4 Precedents, and the liability side of the moat**

**VRM / Intention Economy (around 2012)** was an isomorphic concept (a user-side intent / consent rail) that died commercially. Causes of death: the absence of value that stands alone (only the rail was built first), the absence of a participation motive for the supplier side. SPL's delta is threefold — the butler makes standalone value and aggregates demand, the ledger gives the supplier side a compliance motive, and the regulatory environment is approaching. But the delta is unproven, and its verification is §10.

**The liability side of the moat.** The rail is also a concentrator of liability. Behind Visa's moat is a vast anti-fraud apparatus. So the opening vertical is chosen not by maximum willingness to pay (finance / medicine) but by minimum liability (§11).

**What is not the moat:** schema / data lock-in / profiling / the rightness of the philosophy.

**9. Social significance**

> **▷ Plainly put —** the work of bringing labeling, expiry dates, and an emergency-stop button into a market that has neither an ingredients list nor an expiry date. The act of an AI moving you finally gets "an ingredients list (beliefs fully disclosed) · a kitchen (tactics only within the delegation) · free tours (treasure box) · a time-limited operating license (mandate) · an emergency stop (suspension)."

**9.1 Contributions (the parts the three-party review agreed on)**

- The separation of belief / tactic — the invention of a vocabulary in which the AI's beliefs are transparent and only the tactics are opaque under delegation

- hard expiry and "silence = lapse" — flipping the default of delegation from continuation to halt

- dismissal ≠ falsification — making "remove" and "miss" different records

- observable / subjective close — separating the judgment authority over external form and inner aspect. The AI does not self-score

- making the treasure box a UI invariant — guaranteeing disclosure not as an API privilege but as the user's bodily operation

- the honesty of scope isolation — the spec itself confesses it cannot be held by the DB alone

- v3: runtime brakes — turning consent from a "document" into a "brakeable permission"

These function as a governance pattern of delegated influence for the era in which agentic AI has entered the phase of "moving a person." A supply of vocabulary that exceeds an app spec.

**9.2 Honest limits**

- The chasm between category consent and instance consent narrows with the brakes but does not close. Cadence disclosure is accountability, not consent in that moment.

- The justification hazard — what propagates is the vocabulary, not the trigger. A degraded copy with hard expiry and the FK gate stripped out could become an indulgence for dark patterns. The mitigation is the conformance test and certification (Nunc Stans:Phase 3). Not prevention.

- Significance is proportional to adoption — as long as the spec sleeps in a repo, significance is zero. It arises only with publication · audit · adoption.

**9.3 Verbalizing the north star**

The operational metric for "recognizing an intervention, on reflection, as supportive" is the mandate renewal rate — the rate at which, after the expiry lapses, the user voluntarily re-authors. Not the acceptance rate of interventions. Acceptance can be earned even by manipulation, but re-delegation after the expiry is born only of re-contracting after reading the disclosure.

**10. Nunc Stans:Phase 0 — the pre-registered experiment**

> **▷ Plainly put —** the more you want a drug to work, the more, before taking it, you write "if it doesn't work, discard it" on paper and post it on the wall. The same as pre-registration of a clinical trial. Moving the pass line after seeing the data would be the maker doing the silent revision this product forbids the user.

**10.1 The prediction to register (SPL entry \#1)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>P(today = 2026-06-10):</strong></p>
<p>When 60 cold users are assigned to A / B, 30 each, within 90 days, 6/30 (20%) or more of group A, or 8/30 (25%) or more of group B, will achieve 3 or more completed loops.</p>
<p>completed loop = the user authors a prediction with horizon ≤ 30 days → declares an outcome within 7 days after the horizon arrives → authors 1 or more revisions.</p>
<p>A = the plain v1 self-prediction loop.</p>
<p>B = the v1 loop + a human-powered concierge butler (Wizard-of-Oz). The concierge follows the discipline of mandate / suspension / weekly disclosure.</p>
<p><strong>If this condition is not met, abandon the single-player wedge thesis and do not advance SPL as a consumer-facing wedge.</strong></p></td>
</tr>
</tbody>
</table>

**10.2 Decision rules (fixed before viewing the data)**

| **Verdict**               | **Condition**                         | **Consequence**                                                              |
|------------------------|----------------------------------|-----------------------------------------------------------------------|
| Go                     | A ≥ 6/30                         | Bare demand exists. To Nunc Stans:Phase 1 (productizing the wedge)                                 |
| Concierge-dependent Go | A \< 6 and B ≥ 8 and B − A ≥ 5 | Demand is activation-dependent. Consider bringing Nunc Stans:Phase 2 (mandate rail) forward           |
| Kill                   | A ≤ 3/30 and B ≤ 3/30           | Abandon the thesis. Do not advance as a consumer wedge                         |
| Rework                 | other than the above                         | Revise the vertical / onboarding / loop definition. But do not call this a success |

The reason for two arms: to prevent the accident where, when A dies alone, you cannot distinguish "zero demand" from "absence of activation." B also doubles as a human-powered advance verification of the butler thesis.

**10.3 Measurement discipline**

- **The atom of retention is horizon-return.** The act of returning after the due date to declare the outcome. Not D90 opens or weekly active.

- **cold users required.** Exclude recruitment from family / the quantified-self crowd / rationalist-adjacent communities (sources of false positives). Recruit from general channels.

- **The thresholds are already fixed in this document.** If a change to the protocol becomes necessary, the change is recorded by append, not overwritten (Inv 26).

**10.4 Build scope — what to build / what not to build**

**Build:** prediction creation / horizon reminder / outcome declaration / revision / loop counter / A-B assignment / an honest ToS / concierge log.

**Don't build:** hash chain / crypto-shred / role separation / trigger enforcement / mandate DDL / sensor pipeline / a complete treasure box UI. The integrity mechanisms are a story of trust at scale, not a story of a 60-person probe.

**But group B's concierge holds the ethical boundary by hand:** intervene only within the scope the user explicitly stated / suspendable at any time / log every intervention / weekly disclosure / do not close an outcome on one's own. The implementation is thin; the ethics are not thinned.

**10.5 Timeline**

A thin app + recruitment ≈ 2–3 weeks / a 90-day run / 1 week of analysis. Reaching the verdict in about 4 months.

**11. Roadmap**

> **▷ Plainly put —** the ferry (one person can row it) → the bridge (everyone passes through) → the building code (certifying how to build the bridge). The next rung does not start work until the prior rung's verification is passed.

**11.1 Nunc Stans:Phase 0 — now**

The experiment of §10. The top-priority deliverable.

**11.2 Nunc Stans:Phase 1 — wedge (on Go)**

Productizing the v1 loop. Implement local-first, export, core invariants (1–10). Choose just one liability-light vertical:

- career reflection / founder · product exploration (v1 §16.1 Founder Strategy Ledger is the prototype) / writing · creative direction / learning goals / fitness (no medical claims) / executive coaching lite

**Avoid at the opening:** mental health / financial advice / medical / dating / addiction / high-stakes employment. The ramen example remains as teaching material, but the product does not start there.

Metrics: horizon-return rate and completed loops. Danger metrics (time-in-app etc.) inherit v1 §14.

**11.3 Nunc Stans:Phase 2 — rail (on loop entrenchment + signs of mandate demand)**

Full implementation of the v2 + v3 machinery (mandate / butler / treasure box / suspension / budget / scope isolation). Supplier-side onboarding for a single vertical. Publication of the intervention transparency log.

**North star: the mandate renewal rate (§9.3).** How to read suspension — a brake that is used and resumed is healthy (not churn). Zero suspension rather raises the suspicion that the button is not visible.

**11.4 Nunc Stans:Phase 3 — governance layer**

Publishing the open protocol / conformance test / certification / attested runtime / third-party audit. The operator defense set of §7.4 becomes the product as-is.

**11.5 Company or standard**

The current stance: open substrate + trusted operator. The path of claiming a moat as a closed SaaS is not taken. Both paths — company (hosted · enterprise · attested runtime) and standard (protocol · certification) — are not closed until the Nunc Stans:Phase 2 data is out.

**12. Business model**

> **▷ Plainly put —** do not take much from the customer. Take a toll from the side that wants to move the customer. The bridge fare is paid not by the pedestrian but by the side that sets up shop on the far bank.

- **User side:** low price or free / local-first / trust-first. Squeezing here collapses counter-positioning.

- **Supplier side:** a toll or SaaS for the compliant intervention channel. What is bought is reach + liability cover + the audit trail.

- **enterprise / regulated:** audit · certification · deployment · attestation · compliance pack.

Consistency (a reprise of §8.3): as long as the product is "the trust of the audit trail," weakening an invariant = damaging the product. The revenue structure itself becomes the guardian of the invariants.

**13. Open Questions (v3)**

> **▷ Plainly put —** a chapter that lines up the unsolved questions without pretending they are solved. Both those carried over from v2 and the holes newly opened by v3's new machinery.

**13.1 Inherited**

- The handling of AI predictions that do not close to machine-checkable (the majority) — the rail thesis saves the business face, but the epistemic question remains

- How deeply to do the violation audit of scope isolation (input audit of the context-builder)

- The attribution of an intervention when multiple mandates overlap

- The UX where the treasure box's disclosure lands as "recognition of support" rather than "discovery of surveillance"

- The coupling view of world-prediction and self-prediction

- The disclosure conversion of the AI-internal strength (a form that does not leak it as a ranking but presents it as grounds)

**13.2 New (the holes v3 opened)**

- The reverse dark pattern brought by suspension's constant visibility — does the very existence of a brake create anxiety or excessive halting

- The target-conservation problem of the budget — frequency can be bound, but conservation for the most vulnerable moment cannot (§7.1)

- The surveillance dilemma of excluded_contexts — situation detection demands observation. v3 limited it to time bands + self-reporting, but the redesign in Nunc Stans:Phase 2 is unsolved

- The selection bias of the cold-user recruitment channel — how to measure the bias of the "general channel" itself

- The room for additional opaque-ification of Lv2 operational metadata — how far it can be shaved after the enforcement is implemented

- The privacy of the concierge log itself — the human-powered log during the experiment does not have the protection of the full implementation. How honestly it can be written in the consent document

**14. Final**

> **▷ Plainly put —** remove the one sentence at the tail of v1 and v2, "the moat is enforced in the schema," and make this the canonical one.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><em>The schema is the substrate: published, copyable, and meant to be verified.</em></p>
<p><em>The moat is not the schema. The moat is what accrues on top of it and cannot be copied at speed: the consent rail network, the attested operating history, the time-locked calibration chains, and competence under constraint.</em></p>
<p><em><strong>SPL's invariants are not growth friction. They are the product.</strong></em></p></td>
</tr>
</tbody>
</table>

**The inherited / updated motto:**

- Transparent destruction is allowed. Silent revision is forbidden.

- Un-consented opacity is forbidden. Delegated opacity is bounded permission — not a gift. (revised from v2's "gift")

- Sovereignty ≠ sole voice. Mandate ≠ blanket consent.

- Verbs remain, nouns dissolve.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><em><strong>The first deliverable is not a spec. It is a registered prediction.</strong></em></p>
<p>The first deliverable is not a spec. It is a registered prediction (§10.1).</p></td>
</tr>
</tbody>
</table>
