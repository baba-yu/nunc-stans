# World-run plan — nunc-fluens driven from the World view (2026-07-10, DRAFT for §7)

Owner intent (verbatim direction, 2026-07-10): 「newsでやってたことを nunc
stans 上の World で nunc-fluens をバックエンドにしてぶん回したい」。
Terminal/systemd runbooks are a stopgap, not the product. The World view
becomes the pipeline's cockpit: run, watch, and read the results in one
place, on the local GPU model (35B-A3B @ ~236 tok/s, tool_calls proven).

## Decisions to ratify (W-R)

- **W-R1 run trigger**: gate `POST /api/world/run` starts one pipeline run
  against the LINKED instance (`news_repo`), spawning the existing CLI
  (`NS_INSTANCE=<linked> node engines/nunc-fluens/pipeline/src/cli.ts run`).
  Gate-managed job, one at a time — the same pattern as the model-download
  job (in-memory state + progress GET; a gate restart orphans the child or
  kills it — decide: process-group kill on drop).
- **W-R2 progress**: `GET /api/world/run` = state + step progress tailed
  from the run's artifacts/log (the pipeline already writes per-step
  artifacts; no pipeline changes for v1 — the gate parses the stream).
- **W-R3 UI**: WorldView gains a run panel — "Run today", live step list,
  last-run verdict (run.json), honest failure surface (stderr tail). On
  completion the world exports are re-staged (build-world) so the view
  refreshes without a manual `just up`.
- **W-R4 scheduling**: systemd timers RETIRE for this box; the gate gains a
  minimal scheduler (config key `world_run_at`, e.g. "06:30"; fires W-R1 if
  no run succeeded today). Alternative kept on the table: keep systemd and
  only surface its status in the UI — rejected by default because the unit
  already rotted once (NS_SANDBOX remnant, 2026-07-10 failure).
- **W-R5 fork rule unchanged**: the run target is the linked INSTANCE
  (instance.json required); view-source/~/news refusal stays in the CLI.
- **W-R6 model backend**: runs use news-config (runtime/profile) as today —
  with the llama-cpp profile the whole chain rides the local 35B; no new
  model plumbing.

## Tasks

- T1 gate run-job (spawn/status/kill, tests with a fake CLI)
- T2 WorldView run panel (+ export re-stage on success)
- T3 gate scheduler (W-R4; config + fire-once-per-day + tests)
- T4 story: author topics in the UI → Run today → World shows the new day;
  evidence in design/verification/world-run.md. Retire the systemd units
  for this box (docs updated; install.sh stays for headless users).

## Non-goals (v1)

- Multi-instance run orchestration; run queueing beyond "one at a time".
- Editing news-config beyond what the existing drawer already does.
- Windows-native process management (WSL is the runtime).

Status: DRAFT — awaiting owner ratification of W-R1..R6 (§7 two-step).
Today's data gap was bridged by a one-off `just news-daily news` (option B),
no timer installed.
