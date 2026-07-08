# Agent ABI Contract

Status: v0 Draft (Phase D, 2026-07-07 — was Reserved per constitution
§13-D; drafted after the manda lane and the profile record were proven
in code, honoring "write contracts late")

This defines the **Nunc Stans-side intake** for agents, resident
programs, schedulers, butlers, and tool workers: how one registers,
what it may declare it can do, and where its execution records live.
Intake only — the agent's internal design, skill format, and runtime
are FourFive's jurisdiction (§13-A) and are deliberately not decided
here. The rule the Reserved stub carried still governs everything
below: **a resident program does not run without a commitment + a
mandate + a fixed version reference.**

## 1. Registration

A registration is three things together (constitution, Pre-v1 Phase 5
registration form):

1. **A commitment** — written by the user, never by the agent (F3).
   Registering an agent is itself an act the user commits to in the
   self scope.
2. **A mandate** — a time-boxed, scoped grant of authority declaring:
   - target scope(s),
   - read / write access,
   - whether external side effects are permitted,
   - `expires_at` (**required** — a mandate without expiry is invalid;
     no response at expiry means lapse; continuation is a fresh grant).
3. **A frozen version reference** (F7) — the agent runs a fixed, named
   version; an update is a NEW registration, never a silent swap.

In v0 the mandate object is a **manda mandate** — one JSON line in the
manda data dir's `mandates.jsonl`, appended by the principal out of
band (see the manda spec's mandate format; the gateway deliberately
exposes no tool that can create one). It is *not yet* a self-scope
`self/mandate/*` record — see §5.

## 2. Capability declaration

An agent declares what it can do with the §2.6 capability vocabulary,
the same set every nunc-ai provider/runtime declares:

    { chat, stream, tools, structured, web_search: native|none,
      thinking, memory }

The declaration is carried by the agent's **profile** (the v1 plan
§2.7 record: id, name, provider, model, system_prompt, skills = tool
allowlist, memory_scope {read[], write[]}, goal_verify defaults, ui).
Profile rails are enforced in code on both validators (gate Rust +
nunc-ai TS):

- **F3**: no profile may grant write access to self-scope
  commitments — such a profile cannot even be saved, and the agent
  refuses the write again at its own layer.
- **BYOL**: profiles name providers/models, never credentials.

## 3. Startup and suspension check

At startup (and before any committed-lane write) the agent calls
manda's `mandate_list` and treats its registration as active only when
a covering, unexpired, unrevoked write mandate exists. Expired or
revoked ⇒ the agent runs read-only and says so; writes are refused at
`memory_commit` by the gateway regardless (defense in depth).

**Interim substitute, named:** the constitution (F14) places the
source of truth for this check in **nunc-stans-engine** — "the
scheduler refuses launches under an expired / revoked registration."
That engine mandate lane does not exist yet (SPL v3 territory); until
it does, manda's mandate file is the operative authority record and
`mandate_list` is the check.

## 4. Execution records

Every model call an agent makes is one line in the run log the audit
substrate requires (v1 plan §2.6):

    <data store>/runs/ai-runs.jsonl
    { ts, caller, provider, model, inputTokens, outputTokens,
      durationMs, verify, outcome, error?, profile?, verdicts? }

- `caller` names the call site (`nunc-stans-agent`, `fourfive-chat`, a
  pipeline step id); `profile` names the registration's profile.
- `verdicts` carries the goal-verify chain (one `{met, gaps[],
  tokensIn, tokensOut}` per iteration) when the loop ran.
- Memory operations are additionally audited by manda in its own data
  dir (append/candidate/committed lanes + audit) — the user can read
  both records at any time.
- The Formans `/runs` view serves these read-only; neither the log nor
  the view carries prompt text.

## 5. Known enforcement gaps (v0, named deliberately)

1. **No caller authentication on the self engine** — any local process
   could write the vault; F3 is enforced in the profile validators and
   the agent's own guard, not server-side, until SPL v3.
2. **No engine-side mandate lane** — the F14 check's designated source
   of truth (nunc-stans-engine) is not built; manda's mandate file is
   the interim authority record (§3).

## 6. Out of scope (FourFive's jurisdiction, §13-A/§13-D)

- The agent's internal design, skill format, and runtime.
- MCP tool surfaces beyond manda (generated-app CRUD arrives with
  Phase E's apps-host).
