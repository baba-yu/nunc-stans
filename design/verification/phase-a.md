# Phase A verification record

Started: 2026-07-04. Baseline tag: `pre-phase-a` (5650a9d). Work branch:
`phase/a-consolidation` (per the v1-plan rule that phases run on branches;
merged to `main` at the review gate).

## Preflight

- Working tree clean at 5650a9d.
- fourfive dev tip: cfaac3564e969b2388d6b7c984f08332a9ff4b84
- fourfive subtree split (import 75dd9be): cfaac3564e969b2388d6b7c984f08332a9ff4b84 — **parity confirmed, no pull needed**
- news dev tip: 9e86e018718159ce18ee4b3a85738dda04432cc6
- news subtree base (import 63e9cd5): a80060d18a4e79698284c633977f10300efb016e — news is ahead externally, as expected; code freeze declared, resync happens in Phase C
- design repo (`~/nuncstans`) tip: 217ff39a1a5d2082a020706aad334682550f078c on **dev** — NOTE/deviation: the corpus lives on `dev`, not `main` (`main` stops at "first commit."); Task 2 subtree-adds `dev` instead of the plan's `main`.
- Shell profiles contain no FED_DATA export (checked 2026-07-04): true.

## Evidence log

- T0 (2026-07-04): branch + tag created; baselines above. Commit 9d3a92f.
- T1: fourfive subtree split == standalone dev tip (cfaac35) — parity
  confirmed, no pull needed. The June app-composition work is already in.
- T2: design repo absorbed from `dev` (subtree 6b101c1); reconcile found
  every file byte-identical except `plan/README-plan.md` (adopted into
  `design/`); LICENSE/NOTICE carried to the root. Commit e50a139.
- T3: renames (a74ace6) + vocabulary sweep in 6 commits (961daf0..89ae141).
  107 contextual replacements in the 4 large docs done by a review agent;
  `valid_federation_id` → `valid_scope_id` in the engine; frontend package
  renamed to `nunc-stans-formans`; §13 amended (engine-independence retired,
  boundary discipline kept). Verification: engine 11/11 tests, frontend
  10/10 + build, fourfive 24/24, checks 3× ok, final grep clean except the
  exempted slug `federation-local`.
- T4: justfile NS_DATA shim (c9ae1ce); `~/federation-data` →
  `~/nunc-stans-data` moved with the vault intact (3 commitments served,
  `/health` reports `nunc-stans-engine`); FED_DATA prints a deprecation
  warning; F11 re-verified (no remote).
- T5: check.ts + commit-scope.ts replace the shell originals (055133a);
  rust-toolchain.toml pins 1.96.1, .node-version pins 24. The engine's
  unix-permission code was ALREADY `#[cfg(unix)]`-guarded with a
  `#[cfg(not(unix))]` no-op — no change needed. FD-3.2 exclusion
  generalized to `tools/` (the tooling legitimately names the string).
- T6: `just bootstrap` (b0565dc) — doctor + NS_DATA skeleton
  (self/world/artifact/profiles/runs, self git-init, no-remote check,
  chmod 700); verified fresh + idempotent; root package.json added
  (type: module).
- T7: root README + CONTRIBUTING (380c183), frontend README (02ba8bc),
  engine README → NS_DATA (74910e7), nunc-fluens code-freeze banner
  (7892647). Commands verified live: `just up` (T4), `just web` (Vite
  served :5173), engine `scripts/smoke.sh` — all checks passed.
- T8: news suite in-monorepo: 121 passed / 12 data-dependent failures
  (test_rename_future_titles.py entirely + 2 others needing live
  report/prediction data that stays in `~/news` until Phase C). Scoped
  subset passes 110/110 (+1 skip); the same scope is wired into CI
  (1b9ecdd). CI proves itself after the owner pushes (pending).
- T9: archived to `~/old/`: fourfive, nuncstans-hermes-stack-remnant
  (root-owned — moved via WSL root, chowned back), multi-stakeholder-
  simulater, and home junk into `~/old/home-junk-2026-07/` (pptx/js decks,
  root package.json + lockfiles + node_modules, honeypot, llmsec,
  tmp_pptx). Nothing deleted. **Caveat for the owner:** the
  `honcho-sim-deriver-1` Docker container (plus a langfuse/litellm/
  clickhouse stack) is still running from the archived experiments and
  Docker recreates `~/multi-stakeholder-simulater` as an empty root-owned
  mount skeleton; stopping those containers is the owner's call — until
  then the skeleton dir may reappear.

- T10: `~/federation` → `~/nunc-stans`; `~/nuncstans` →
  `~/old/nuncstans-design-repo`. Repo-local git identity survived the move;
  checks, tests, and a live boot re-verified from the new path (e82ba5c).
- T11 / S-0: fresh vault at /tmp/s0-vault — `just bootstrap` → "bootstrap
  ok"; `just up` → `/health` `{"engine":"nunc-stans-engine","ok":true}`;
  home HTML served; `/self/commitments` returned the clean empty state
  (`{"commitments":[],"malformed_skipped":0}`). PASS in 3 commands.
- T11 / S-10: pristine `ubuntu:24.04` container (Docker, repo mounted
  read-only, cloned inside): apt just + Node 24 (nodesource) + rustup →
  `sh tools/bootstrap.sh` ok → `NS_DATA=$HOME/nunc-stans-data just up` →
  `/health` answered, home HTML served — **S-10-PASS, exit 0**. Two real
  portability defects were found and fixed by this story:
  1. container-side `git clone /src` needs `safe.directory` (documented in
     the story context; not a repo defect), and
  2. the repo-root package.json lacked a `packageManager` pin, so corepack
     on a pristine machine fetched latest pnpm (11.x) and refused the
     frontend's 10.33.0 pin — fixed in 7dbaa52 (this would have broken the
     CI web job on every runner).

## Decisions log

- Design-repo absorption source branch: `dev` (plan said `main`; `main` is a stub).
- FD-3.2 refined at T10: the leak check now covers code/config only
  (`*.md` documentation excluded, like design/ and tools/). Rationale:
  `just bootstrap` made `~/nunc-stans-data` an official default, so READMEs
  must be able to name it; the rule's intent — no code path-coupling to the
  vault — is unchanged and still enforced.

## Exit criteria

- [x] `just up` works from `~/nunc-stans` (T10 + S-0 evidence above)
- [x] `just check` green (`node tools/check.ts`, 3× ok — FD-3.2 refined to
      code-scope, see Decisions)
- [x] Vocabulary grep clean: `git grep -iI federation` outside
      naming.md/development/verification returns only the exempted slug
      `federation-local`
- [x] Every stack README verified by running its commands (`just up`,
      `just web`, engine `scripts/smoke.sh` all-pass, pnpm test suites,
      `just bootstrap`)
- [x] S-0 pass (cold start, 3 commands)
- [x] S-10 pass (pristine ubuntu:24.04, exit 0)
- [ ] PENDING owner: create private `baba-yu/nunc-stans`, push
      `phase/a-consolidation` + `main` + tags → the 3-OS CI matrix proves
      itself (any Windows/macOS failures are in-phase fixes)
- [ ] PENDING owner review gate: merge `phase/a-consolidation` → `main`
- Caveat: `honcho-sim-deriver-1` (+ langfuse/litellm/clickhouse) containers
  still run from archived experiments; Docker recreates an empty
  `~/multi-stakeholder-simulater` mount skeleton until they are stopped
  (owner's call).
