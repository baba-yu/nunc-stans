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
- T4 (2026-07-05): fourfive under the mount — vite `base: '/fourfive/'`,
  API client base-relative, `cors()` removed. 24 tests + typecheck + build
  green; dist assets reference `/fourfive/assets/*`; live server smoke
  (mock): health, session create, SSE stream events. Workspace-warning
  cleanup: per-package `pnpm.onlyBuiltDependencies` dropped (root owns it).
- T5 (2026-07-05): `just up` = engine(:8721) + fourfive(:8787) +
  gate(:8720) via concurrently sub-recipes (see Decisions). Verified
  through :8720: /gate/health, /health (engine JSON via proxy),
  /self/commitments (real vault, read-only), /fourfive/api/health (mock,
  prefix strip), /fourfive/ HTML, / formans HTML, foreign-Host 403;
  teardown clean; engine solo boot on :8731 (F12). `windows-shell` set.
- T6 (2026-07-05): formans shell — vue-router (/ /world /timeline), topbar
  chrome + engine chip, ME on Card/Panel, `?focus=` jump, title "Nunc
  Stans", dev proxy → gate. Tests 10 green, build green; /timeline 200 via
  the gate SPA fallback (c945034).
- T7 (2026-07-05): fourfive on nunc-ui — tokens aliased (accent → cyan;
  `.btn--primary` text flips dark for contrast), Modal (shell; primitive
  gained a `wide` variant since the markdown modal is 900px-class),
  Badge ×2, Tabs (switcher). 24 tests + typecheck + build + mock smoke
  green (3 commits: nunc-ui variant, ff tokens, ff swaps).
- T8 (2026-07-05): world view on the cold surface + the dashboard wrap.
  `tools/build-world.ts` stages dashboard + data with mtime/size skip
  (51 copied first run, 0 on rerun of 47 checked) and vendors d3 locally
  (no CDN in the staged html); 237 live headlines flattened; through the
  gate: /world-graph/index.html serves the dashboard, manifest 200
  `application/json`. **Bug found and fixed in-phase:** the gate's SPA
  fallback answered 200/index.html for ANY missing path, which would have
  fooled the manifest probe (and any curl check) — file-like misses now
  stay 404 (bf3f5f4, regression-tested in gate/tests).
- T9 (2026-07-05): timeline — pure week model (`timeline.ts`: isoWeekKey
  incl. the 2026-W53 year boundary, buildWeeks with contiguous gap weeks,
  weekly mix over opened commitments, subjective outcomes excluded from
  close markers) with 6 unit tests; SVG view on the 56px cold grid with
  lanes commitments/edges/provenance + the two reserved lanes labeled
  "no records yet (Phase D+)"; markers jump to `/?focus=<id>`. Formans:
  3 test files (16 tests) green, build green.
- T10 (2026-07-05): stories executed against a scratch vault
  (`NS_DATA=/tmp/phaseb-vault`, git-initialized self/, no remote; real
  store untouched), NEWS_WORLD set, headless Chromium (Playwright) since
  the Chrome-extension bridge was offline.
  - **S-1 PASS** (mechanical): /health engine JSON, /gate/health,
    /fourfive/api/health provider JSON, `<title>Nunc Stans</title>`,
    /fourfive/ FourFive HTML, /timeline 200 — all through :8720; visual
    pass over the four surfaces (screenshot set).
  - **S-2 PASS** (click-through): provenance before `1/2 (50%) · 1 edges`;
    "Commit from this headline" on a live News headline → `authored
    self/commitment/news-138d13eb-… + informed_by → News (provenance
    updated)`; after: `2/3 (67%) · 2 edges`.
  - **S-9 PASS** (click-through): W27 with ○×3 / ●×1, edges count 2,
    provenance heat step, both reserved lanes labeled; marker click →
    `/?focus=<id>` → home highlights the record (home-focused.png). Two
    defects found by execution and fixed in-phase: (1) `fill:none` SVG
    circles were clickable only on their hairline stroke —
    `pointer-events: all`; (2) the outcome's `recorded_at` is
    server-assigned, so S-9's pass text was made date-independent (the
    multi-week spread stays pinned by timeline.test.ts).
  - Screenshots: `design/ui/phase-b/{home,world,timeline,home-focused,
    fourfive}.png` (fourfive pre-restyle look lives in git history at
    feced16^ — no separate 'before' capture).
- T11 (2026-07-05): S-10 both legs.
  - **Ubuntu PASS**: pristine `ubuntu:24.04` container (repo mounted
    read-only, cloned inside): apt + Node 24 + rustup + `cargo install
    just` → `sh tools/bootstrap.sh /root/my-data` → `just up` → through
    :8720: /health, /gate/health, /fourfive/api/health, Nunc Stans title —
    S-10-PASS, exit 0.
  - **Native Windows 11 PASS** (this machine, git-bash `sh`, scratch
    APPDATA + scratch store, `RUSTUP_TOOLCHAIN=1.96.1-x86_64-pc-windows-msvc`):
    doctor all ok (git/just/node/corepack/pnpm/cargo), store initialized at
    a SPACED path (`C:/Users/Yuki Baba/.s10w/store`), config written to
    %APPDATA% in Windows form, `just up` built and served natively, same
    four checks green — S-10-NATIVE-PASS. **Two portability defects found
    and fixed by this story:** (1) bootstrap wrote its config to the XDG
    path everywhere while `tools/data-dir.ts` reads %APPDATA% on win32, and
    wrote MSYS-form paths node cannot open — bootstrap now targets APPDATA
    on Windows and canonicalizes with `pwd -W` (7d1076e); (2) the justfile
    passed `{{dir}}` unquoted, splitting spaced Windows paths (5d0250d).
  - README documents the three-process topology and the Windows
    prerequisites (f48fdda).
- T12 (2026-07-05): final suite green — engine 11, gate 7 (1 unit + 6
  integration), workspace 3 suites (formans 16 incl. timeline, fourfive 24,
  nunc-ui 9), `node tools/check.ts` 3× ok. Ledger constraint proven:
  `git log pre-phase-b..HEAD -- engines/nunc-stans/` is empty. 32 commits,
  every one `commit-scope` clean. v1-plan updated in place (gate deviation,
  B1–B4 pointer); reading order refreshed.

## Machine notes (this Windows box, not product requirements)

- Native `just` was installed via `cargo install just` (proves the MSVC
  linker); this machine's rustup default host is unusually
  `x86_64-pc-windows-gnu`, so the S-10 run pinned
  `RUSTUP_TOOLCHAIN=1.96.1-x86_64-pc-windows-msvc` per invocation — a
  fresh Windows rustup defaults to msvc and needs no override.
- The clone-source `safe.directory` entries for the UNC repo path are
  test-harness plumbing on this machine only.

## Decisions log

- T5: the plan's `up` recipe put full command strings (env prefixes, quoted
  paths) inside the `concurrently` arguments; on Windows concurrently
  spawns via cmd.exe where `PORT=x` prefixes and single quotes break. The
  three commands moved into just sub-recipes (`_up-engine`, `_up-fourfive`,
  `_up-gate`) and concurrently runs `just <name>` — quoting and env
  expansion stay inside just's sh on every OS. Same processes, same ports.
- T3: axum `nest()` drops a nested router's fallback; the fourfive mount
  uses `nest_service()` (found by the gate's own integration test).

## Exit criteria

- [x] One origin (`127.0.0.1:8720`, the gate) serves ME + world + timeline
      + FourFive with the shared nunc-ui language (S-1 evidence, T10)
- [x] S-1 PASS (mechanical checks + visual pass, T10)
- [x] S-2 PASS (headline → commitment + informed_by; provenance 1/2 50% →
      2/3 67%, T10)
- [x] S-9 PASS (lanes + reserved lanes + heat strip + record jump, T10)
- [x] S-10 PASS on pristine ubuntu:24.04 (exit 0) AND native Windows 11
      (T11; two portability defects fixed in-phase)
- [x] Screenshot set in `design/ui/phase-b/` (5 images, T10)
- [x] Full suite green at close: engine 11 / gate 7 / formans 16 /
      fourfive 24 / nunc-ui 9; `just check` ok (T12)
- [x] Ledger engine untouched all phase (git-proven, T12)
- [x] v1-plan updated in place (gate deviation B1; B2–B4 pointers) and the
      reading order refreshed (T12)
- [ ] PENDING owner: push `dev` → the 3-OS CI matrix proves itself on the
      new workspace layout + gate job (any failures are in-phase fixes)
- [ ] PENDING owner review gate: PR `dev` → `main` after reviewing this
      record
