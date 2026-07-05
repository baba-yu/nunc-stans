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

- T0 (2026-07-04): branch + tag created; baselines above.

## Decisions log

- Design-repo absorption source branch: `dev` (plan said `main`; `main` is a stub).

## Exit criteria

(filled at close — see Task 11)
