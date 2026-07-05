# Phase B verification record

Started: 2026-07-05. Baseline tag: `pre-phase-b` (167c10e). Work lands on
`dev` directly (post-Phase-A rule; the owner pushes and PRs to `main` at the
review gate). Plan: `design/development/2026-07-04-phase-b-plan.md`
(design approved 2026-07-04, full plan §7-approved 2026-07-05).

## Preflight

- Working tree clean at 167c10e (the two plan commits 2ee8957 + 167c10e).
- Baselines (run inside WSL, 2026-07-05):
  - engine: `cargo test` — 11 passed, 0 failed
  - formans (`frontend/`): `pnpm test` — 2 files, 10 passed
  - fourfive: `pnpm test` — 3 files, 24 passed
  - `node tools/check.ts` — 3× ok
- gate crate: does not exist yet (created in T3).
- Constraint carried through the phase: `engines/nunc-stans/src/**` receives
  zero commits (verified at T12 by `git log`).

## Evidence log

- T0 (2026-07-05): tag + baselines above.
- T1 (2026-07-05): app moved to `frontend/nunc-stans-formans/` (897a1db);
  per-package lockfiles retired (897a1db, d3ae7c9); root pnpm workspace +
  single lockfile + justfile/CI path sweep (df0465e). Workspace lists 3
  members; `pnpm -r test` green (formans 2 files, fourfive 3 files);
  `better-sqlite3` builds under the root `onlyBuiltDependencies`; `just up`
  from the new layout serves `/health`, home HTML, and the real vault's
  commitments on :8720 (old topology retained until T5). check.ts 3× ok.
  Stale pre-move `frontend/{dist,public}` artifacts removed (untracked).
- T2 (2026-07-05): `frontend/packages/nunc-ui` — tokens.css (§2.5 values),
  8 primitives, 8 vitest smokes green, vue-tsc clean; workspace now runs 3
  suites green (formans 2 files / fourfive 3 / nunc-ui 1).
- T3 (2026-07-05): `gate/` crate (lib + bin `nunc-stans-gate`): static
  mounts, streaming proxy (reqwest, no-TLS), Host guard. Tests: 1 unit
  (mount strip) + 6 integration (engine round-trip, prefix strip, SSE
  content-type + both events, static + SPA fallback, foreign-Host 403,
  upstream-down 502) — all pass. Deviation caught by the tests: axum
  `nest()` discards a nested router's fallback, so the fourfive static
  mount uses `nest_service()` instead. CI engine job gains the gate test
  step; commit-scope gains the `gate` area.

## Decisions log

(appended as deviations arise)

## Exit criteria

(filled at close — see plan Task 12)
