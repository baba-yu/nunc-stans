# IP Server Readiness Development Principles v0.1

Development principles for being able to move Prompt / Source / AI Usage IP to the server side in the future

## 1. Purpose

This document, on the premise that fully concealing prompts and source code is difficult in a distributed desktop / local-first configuration, defines development principles so that protected targets can later be assembled on an **IP Server**.

## 2. Decision

In the initial stage, do not make concealment of prompts / source code the primary defense. Instead, ensure that the protected AI usage methods, prompt chains, policy, evaluation, and forecast logic can always be identified, classified, and separated as **IP Server Candidate**s.

```text
What to do:
- Always make the IP targets explicit
- Classify prompt / policy / scoring / fixtures
- Separate what can be distributed to the client from what should be kept server-side
- Design the PromptRegistry / PolicyRegistry / FixtureRegistry
- Keep prompt hashes, not full prompt text, in the RunLog
- Tag targets to be moved to the IP Server in the future at PR time

What not to do:
- Do not assume full concealment of local distributables
- Do not make source obfuscation the primary IP protection measure
- Do not make the system prompt alone the moat
- Do not put credential / license secret / permission rule into the prompt
```

## 3. Core Principle

**Rather than hiding prompts and source, make explicit the IP targets that should be assembled on the server side in the future.**

In fully local distribution, the client bundle, the local Python package, prompt fragments, and policy code can be analyzed. Therefore, the main battleground of IP protection is the following.

- What not to distribute to the client
- What to move to server-side assembly
- What to explain as publicly disclosable principles
- What to keep as a trade secret / hosted capability

## 4. Protected IP Scope

The protected target is not the system prompt alone.

```text
Protected AI Usage IP =
  prompt chain
  + Memory W/R policy
  + Reconnection policy
  + State / Intent classifier logic
  + ACC / DMN / SN routing logic
  + evaluation fixtures
  + scoring heuristics
  + tool orchestration
  + forecast generation pipeline
  + source reliability weights
  + user feedback learning loop
  + proprietary datasets
```

## 5. IP Classification

| Level | Name | Distributable? | Examples |
|---|---|---:|---|
| IP-0 | Public / Distributable | OK | UI text, simple formatting prompts, public principles |
| IP-1 | Internal | Caution | generic extraction prompt, generic schema docs |
| IP-2 | IP Server Candidate | Avoid client if possible | Memory W/R prompt chain, Reconnection prompt, ACC prompt, ranking formula |
| IP-3 | Server-only / Secret | Never client | credentials, license secrets, exact authorization logic, exploit mitigation details |

## 6. IP Server Candidate

The following are always treated as **IP Server Candidate**s.

- production Memory W/R prompt chain
- Reconnection ranking / suppression / defer rules
- ACC thresholds and correction policy
- DMN insight generation policy
- World Intelligence source reliability weights
- Forecast scoring / calibration
- evaluation fixtures and gold labels
- model routing logic
- proprietary failure-case corpus
- user feedback learning heuristics

## 7. Prompt Handling Rules

### 7.1 PromptRegistry

```text
PromptRegistry {
  prompt_id
  version
  purpose
  ip_level: IP-0 | IP-1 | IP-2 | IP-3
  owner
  allowed_call_sites
  client_distributable: boolean
  content_ref
  content_hash
  created_at
  updated_at
}
```

### 7.2 AgentRun Logging

Do not keep full prompt text in the RunLog.

```text
AgentRun {
  run_id
  prompt_id
  prompt_version
  prompt_hash
  model
  input_refs
  output_ref
  created_at
}
```

### 7.3 Never in Prompt

Do not put the following into the prompt.

- API key
- credentials
- license secret
- exact permission logic
- irreversible action authorization
- security bypass / exploit mitigation detail
- customer secret

## 8. Policy / Code Handling Rules

Implement the following as policy code rather than as prompts.

- UserUnderstanding commit eligibility
- MemoryWritePolicy final decision
- Reconnection surface / suppress / defer final decision
- irreversible tool execution approval
- source trust decision
- privacy level decision
- IP export decision

The LLM proposes candidates. App Core / the policy layer decides.

```text
LLM proposes
Policy validates
User confirms when needed
Memory service commits
Everything is traced
```

## 9. Future IP Server Architecture

The future separated form is assumed to be the following.

```text
Local Desktop / Client
├─ UI
├─ user config
├─ local notes / cache
├─ local low-sensitivity prompt fragments
└─ redacted / abstracted request
      ↓
IP Server / Hosted Core
├─ PromptRegistry
├─ Policy Engine
├─ Reconnection ranking
├─ ACC / DMN / SN routing
├─ Forecast Engine
├─ Evaluation Harness
├─ proprietary datasets
└─ Model Router
      ↓
LLM Provider / Local Model Runtime
```

## 10. Local-first Constraint

Even when maintaining local-first, minimize the information sent to the IP Server.

```text
Client sends:
- abstracted state
- redacted metadata
- candidate summaries
- schema-level signals
- hashed references when possible

Server returns:
- prompt plan
- policy decision
- ranking plan
- intervention constraints
- forecast intelligence
```

## 11. Packaging / Export Audit

Inspect the following before distribution.

```text
- Whether IP-2 / IP-3 prompt content is included in the client package
- Whether evaluation fixtures are included in the client package
- Whether forecast scoring weights are included in the client package
- Whether source reliability tables are included in the client package
- Whether full prompt text is included in logs / snapshots / support exports
- Whether high-sensitivity policy text is included in the frontend bundle
```

## 12. Public Documentation Rules

What may be explained in public documentation:

- The principle of separating AIResponse and UserUnderstanding
- The concepts of candidate / committed
- The concept of source traceability
- user control / auditability
- high-level architecture

What to avoid in public documentation:

- exact ranking formula
- ACC thresholds
- full production prompt text
- evaluation fixtures
- source reliability weights
- forecast calibration details
- proprietary orchestration logic

## 13. PR Review Checklist

- Does this change include an IP target
- Is the ip_level made explicit
- Is client_distributable made explicit
- Is anything IP-2 or above entering the client path
- Is full prompt text being kept in the RunLog
- Are evaluation fixtures included in the public repo / distributable build
- Is the interface for moving to the IP Server in the future visible
- Are user data and IP logic unnecessarily mixed

## 14. CI Checks

```text
- prompt files require ip_level metadata
- IP-2 / IP-3 files cannot be imported by client package
- AgentRun must store prompt_hash, not prompt body
- known secret patterns fail build
- support log export redacts prompt content
- package scan fails if protected fixtures are included
- policy code cannot be embedded into prompt text
```

## 15. ADR

```text
ADR: Maintain IP Server Readiness Instead of Relying on Local Prompt or Source Secrecy

Decision:
The project will not rely on prompt or source code secrecy in distributed local builds. Instead, all protected AI usage methods will be classified and designed so that they can later be assembled server-side by an IP Server or hosted core.

Rationale:
For local-first or desktop-distributed software, production prompts, source code, and orchestration logic are difficult to fully hide. The defensible IP is the full AI usage loop: prompt chains, Memory W/R policy, Reconnection policy, cognitive routing, evaluation fixtures, forecast logic, proprietary datasets, and feedback-learning heuristics. These must be identifiable and separable from distributable client code.

Rules:
- Do not treat local source or prompt obfuscation as the primary IP protection mechanism.
- Every prompt, policy, fixture, scoring rule, and orchestration component receives an ip_level.
- IP-2 and IP-3 components must be designed so they can move to IP Server.
- RunLogs store prompt hashes, not full prompt bodies.
- Policy decisions are enforced in code, not only in prompts.
- Client builds include only low-sensitivity prompts and logic unless explicitly approved.
- Public documentation explains principles, not exact thresholds or production prompt chains.
```

## 16. Definition of Done

The state in which this development principle is working:

- The protected IP targets are always identified
- What can be distributed to the client and the server-side candidates are distinguished
- The production prompt chain is managed in the PromptRegistry
- Full prompt text does not remain in the RunLog
- Evaluation fixtures do not get mixed into the client
- The targets to move to the IP Server are made explicit at PR time
- Room is left for coexistence of local-first and hosted IP capability
