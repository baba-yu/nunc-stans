# Phase D verification — Profiles + goal-loop surfaces + nunc-stans-agent v0

Running record; completed as the exit items execute. Plan:
`design/development/2026-07-07-phase-d-plan.md`.

## Gate record (§7 two-step)

- Decisions PD1–PD15 ratified by the owner in session: **2026-07-07**.
- Plan approved by the owner in session: **2026-07-07**.
- PD1 resolved the same day: owner ran the merge train (`phase/post-c` →
  `dev` via PR #3, `newstack` included as ancestor); `phase/d` branches
  off `dev`; the fallback branch point was not used.

## Baseline (T0, 2026-07-07)

- Branch **`phase/d`** off `dev` at **0224a44** (merge of PR #3 =
  post-C V2 REDO + V3 close-out 90f948b); tag **`pre-phase-d`** = 0224a44.
- Plan committed: a0b889c `design: open phase d with the approved
  implementation plan`.
- Suite baselines — **re-measured on 0224a44**, not copied from the
  post-C record (which predates the V3 tail; pipeline moved 188→187,
  gate 10→9 since that record):

      pipeline  187 passed / 20 files   (vitest)
      nunc-ai    12 passed / 3 files    (vitest)
      fourfive   24 passed / 3 files    (vitest)
      Formans    16 passed / 3 files    (vitest)
      gate        9 passed              (cargo test)
      ns engine  11 passed              (cargo test)
      tools/check.ts: ok (FD-3.2 vault-path, import boundary,
      edge.schema.json)

## Environment probes (T0, 2026-07-07)

- **Ollama (risk 5):** `ollama list` shows `qwen3.6:27b` (17 GB) —
  the S-6/S-11 model, proven in Phase C exit run (b); `qwen3.6:35b`
  on disk as the recorded fallback.
- **manda remote/tag state (PD8):** local `~/manda` HEAD **d0b61e2**
  (2026-07-03) == `origin/main` at `github.com/baba-yu/manda`;
  `git ls-remote --tags origin` returns **zero tags** — the `v0.2.0`
  tag remains the owner prerequisite; nothing in-phase blocks on it.
- **manda release build (PD8):** `cargo build --release` in `~/manda`
  succeeded (manda v0.2.0, 19 s; previously only a debug build
  existed). Built at commit **d0b61e2** — the hash Phase D develops
  against; re-record if the owner adds commits before tagging.

## Constraints carried (from the plan)

- nunc-fluens instance-lifecycle internals receive **zero commits**
  this phase — proven at T12 by an empty
  `git log phase/d --not pre-phase-d -- engines/nunc-fluens/pipeline/src/instance.ts`
  (and the init/import modules).
- The owner's live data store (`~/nunc-stans/data`) and live manda dir
  are never written by tests or stories — scratch `NS_DATA` /
  `MANDA_DATA_DIR` only.
- Production `~/news`: zero contact (Phase C redirection stands).

## Evidence log

- **2026-07-07 — T0 done.** Branch + tag cut, plan committed (a0b889c),
  baselines re-measured (above), probes logged (above). Owner WIP
  observed in the working tree and left untouched: modified `justfile`
  + untracked `tools/down.sh`.

## Stories (executed at T10; specs written at T1)

- S-5 — PENDING
- S-6 — PENDING
- S-11 — PENDING

## S-10 re-run (T11)

PENDING (pristine Ubuntu container + native Windows, incl. the agent
TTY path and the doctor manda check).

## Constitutional check record (filled through the phase)

1. F3 rejection test output (profile validator, both TS and Rust sides) — PENDING
2. Agent out-of-mandate `memory_commit` refusal transcript — PENDING
3. No goal-verify loop output faces the self scope this phase — statement to be confirmed at close
4. F11 locality: no new remotes, no telemetry — to be confirmed at close

## License section

Hermes/Honcho **not integrated** (PD12) — no license verification
required. If that decision is reversed mid-phase, the full verification
lands here **dated before** any integration commit.

## Screenshot index (`design/ui/phase-d/`)

PENDING (Profiles screen, run-log viewer, FourFive verify toggle + cost
surface).

## Exit criteria checklist (mirrors the plan's nine items)

1. [ ] Profiles created/switched from the UI, defaults take effect without restarts
2. [ ] Verify-on message visibly loops (≤ max_iters), gaps reported, cost visible
3. [ ] Local model via Ollama works under a profile (FourFive chat + agent)
4. [ ] `nunc-stans-agent chat` with mandate-gated memory (in-mandate propose+commit ok, out-of-mandate commit refused)
5. [ ] S-5 / S-6 / S-11 written, executed, passing with evidence here
6. [ ] `contracts/agent-abi.md` v0 Draft, owner-reviewed
7. [ ] FourFive streaming stub + stale model id gone
8. [ ] S-10 re-run passes (Ubuntu + native Windows) with the manda doctor check; 3-OS CI green; screenshots saved
9. [ ] Verification doc complete; v1 plan/naming/reading-order updated; **PENDING owner: push `phase/d`, merge → `dev`, PR gate**
   - [ ] PENDING owner: manda `v0.2.0` tag (flips the doctor hard-pass + setup line)
