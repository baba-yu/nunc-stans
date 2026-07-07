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
- Data is never tracked by this git repo (FD-3.2's intent). The store
  DEFAULTS to `<repo>/data/`, which is gitignored (owner decision R13,
  2026-07-07); `NS_DATA` / the app config `data_dir` designate a store
  kept elsewhere. The self vault has no git remote (F11). nunc-fluens
  data instances are plain local data directories (git-less) living at
  the gitignored `engines/nunc-fluens/instances/<profile>/`.
- Repo tooling is TypeScript run by Node (`tools/*.ts`); the one exception
  is `tools/bootstrap.sh`, which must run before the toolchain exists.
