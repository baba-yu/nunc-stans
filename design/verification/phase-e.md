# Phase E verification record — FourFive app factory

- Start: 2026-07-08. Branch `phase/e` off `dev` at **fd7d5d4** (post
  PR #4); tag `pre-phase-e` = fd7d5d4.
- Plan: `design/development/2026-07-08-phase-e-plan.md` — decisions
  PE1–PE14 ratified AND plan approved (incl. the round-3 design spec
  section) by the owner in session, 2026-07-08.
- Constraints carried: scratch stores (`NS_DATA`) for every test/story
  run — the owner's live store is never written by tests; production
  `~/news` zero contact (standing); execute inside WSL (§5 note 12).

## Preflight (T0, 2026-07-08)

Re-measured suite baselines (WSL, this box):

| suite | count |
|---|---|
| nunc-fluens pipeline | 193 passed |
| nunc-ai (frontend/packages/ai) | 35 passed |
| fourfive | 24 passed + typecheck green |
| Formans | 20 passed |
| agent (nunc-stans-agent) | 22 passed |
| gate (Rust) | 6 unit + 12 integration |
| ns engine (Rust) | 11 |
| tools/check.ts | ok (FD-3.2, import scope, edge schema) |

Environment probes:

- **Ollama tools probe PASSED** (plan risk 3): `qwen3.6:27b` given a
  `get_weather` tool over `/api/chat` returned a well-formed
  `tool_calls` block (`{"name":"get_weather","arguments":{"city":
  "Tokyo"}}`) plus thinking, `done_reason:"stop"`, ~1.8s. 35b remains
  the on-disk fallback (`ollama list` archived).
- FourFive workspace inventory (pre-PE5 move, repo-anchored
  `engines/fourfive/workspace/`): `codev.db` (+wal/shm) and
  `apps/{invoice-app, invoice-app-2..4, composite-smoke-app}` — Phase
  B–D dev/test artifacts; the owner's one-time `mv` migrates them at
  T3+ (doctor prints the line).
- Phase D owner-gate snapshot (open, non-blocking for E per PE1):
  S-10 re-run, CI push, screenshots → `design/ui/phase-d/`,
  **agent-abi v0 review** (load-bearing for PE10 — flagged), phase-d
  close commit.

Mid-session note (pre-plan): the owner committed the down/restart WIP
as 567469c (`ci:` — unregistered area, left as history); the next
commit 6aed042 ported it to `tools/down.ts` per the TS-tooling
convention (same port-based semantics + Windows netstat path); the
owner accepted in session.

## Evidence log

- **2026-07-08 — T0 done**: plan proposed (d13b7ca), approved in
  session, status flipped in place; `pre-phase-e` tagged; baselines
  above re-measured (not copied); Ollama tools probe green.

## Story executions

(S-7 / S-8 written at T1; executed at T10 with transcripts and
numbered verdicts.)

## Constitutional check record

(Filled through the phase: F7 freeze refusal output, grounding⊆declared
check output, F3 rails untouched, F11 locality, §13 one-path proof.)

## Exit criteria checklist

1. [ ] runway-tracker@v1 frozen + bundled + human CRUD via generated UI,
       data in the store [T4, T6, T9]
2. [ ] agent operates the same app via MCP under a profile grant;
       mutual visibility; non-granted tool refused [T8, T10]
3. [ ] declared metrics served; strategy card quotes only declared
       metrics with version reference [T6, T9]
4. [ ] second, unrelated app end-to-end in one sitting [T10]
5. [ ] S-7 / S-8 written, executed, passing with evidence [T1, T10]
6. [ ] contracts/app-bundle.md drafted + owner-reviewed [T5]
7. [ ] deterministic + freezing generation proven; no generated code
       executed [T4, T6]
8. [ ] S-10 re-run (incl. /apps/), 3-OS CI green, screenshots under
       design/ui/phase-e/ [T11]
9. [ ] verification doc complete; v1 plan/naming/reading-order updated;
       owner merge/push/PR gate [T12]
