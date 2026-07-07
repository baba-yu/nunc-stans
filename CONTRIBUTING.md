# Contributing conventions

- English for all documents and commit messages.
- Commit style: `area: lowercase description`, one sentence; the default AI
  co-author trailer is fine. Areas: `design`, `contracts`, `ns`
  (engines/nunc-stans), `nf` (engines/nunc-fluens), `ff` (engines/fourfive),
  `fe` (frontend), `gate` (gate/, the single-origin front door),
  `tool` (justfile, tools/, CI).
- One commit = one area unless `contracts/` is touched
  (`node tools/commit-scope.ts` enforces).
- `node tools/check.ts` (= `just check`) must be green before pushing.
- Work lands on `dev`; the owner pushes and merges to `main` via PR at the
  review gates. Stories in `design/stories/` gate phase closure, with
  evidence in `design/verification/`.
- Data lives under `NS_DATA` (never inside the repo — FD-3.2). The self
  vault has no git remote (F11). One owner-decided exception (2026-07-07):
  nunc-fluens data instances live at gitignored
  `engines/nunc-fluens/instances/<profile>/` — each is its own git repo,
  never tracked by this one, so FD-3.2's intent (no data in *this git
  repo*) is preserved via the gitignore.
- Repo tooling is TypeScript run by Node (`tools/*.ts`); the one exception
  is `tools/bootstrap.sh`, which must run before the toolchain exists.
