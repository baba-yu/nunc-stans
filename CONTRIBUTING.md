# Contributing conventions

- English for all documents and commit messages.
- Commit style: `area: lowercase description`, one sentence, no AI
  attribution. Areas: `design`, `contracts`, `ns` (engines/nunc-stans),
  `nf` (engines/nunc-fluens), `ff` (engines/fourfive), `fe` (frontend),
  `tool` (justfile, tools/, CI).
- One commit = one area unless `contracts/` is touched
  (`node tools/commit-scope.ts` enforces).
- `node tools/check.ts` (= `just check`) must be green before pushing.
- Phases run on `phase/<x>` branches; stories in `design/stories/` gate
  phase closure, with evidence in `design/verification/`.
- Data lives under `NS_DATA` (never inside the repo — FD-3.2). The self
  vault has no git remote (F11).
- Repo tooling is TypeScript run by Node (`tools/*.ts`); the one exception
  is `tools/bootstrap.sh`, which must run before the toolchain exists.
