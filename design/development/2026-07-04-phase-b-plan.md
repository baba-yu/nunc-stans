# Phase B Implementation Plan — Nunc Stans Formans + nunc-ui

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans to
> implement this plan task-by-task once the task section below exists.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One localhost origin (`127.0.0.1:8720`) serves the integrated UI
**Nunc Stans Formans** — ME view, world view (restyled list + the News D3
dashboard wrapped as-is), and a new timeline view — plus FourFive mounted at
`/fourfive/`, all speaking the new `nunc-ui` design language; a new Rust
gate fronts everything while the ledger engine stays untouched; stories
S-1, S-2, S-9 pass; S-10 passes on pristine Ubuntu **and native Windows**;
the 3-OS CI matrix stays green; a screenshot set lands in
`design/ui/phase-b/`.

**Architecture:** a new small Rust crate `gate/` becomes the single origin:
static serving for the UI surfaces plus loopback reverse proxies to the
unmodified ledger engine (moved to an internal port) and to the FourFive
Hono server (SSE pass-through). The TS side becomes a pnpm workspace rooted
at the repo root (`frontend/nunc-stans-formans/`, `frontend/packages/nunc-ui/`,
`engines/fourfive`), so FourFive can consume `nunc-ui` via `workspace:*`.

**Tech stack:** Rust (axum + tower-http ServeDir + a streaming HTTP client)
for the gate; Vue 3 + TS + Vite + Pinia + vue-router for Formans; CSS custom
properties + Vue SFC primitives for nunc-ui; pnpm workspace; just; GitHub
Actions 3-OS matrix.

**Plan doc convention:** the repo keeps plans in `design/development/`
(overrides the skill default location).

---

## Design decisions (owner-approved 2026-07-04)

| # | Decision | Choice |
|---|---|---|
| B1 | Front door | **Independent Rust gate crate** — top-level `gate/`, crate `nunc-stans-gate`. Not the ledger (its crate stays pure, §2.4), not Hono. Entry point in Rust was an explicit owner call for trust at the door. Phase E mounts apps-host **behind** the gate at `/apps/`. This is a deviation from the v1-plan §2.2 layout (no gate exists there) — recorded by an in-place v1-plan update. |
| B2 | FourFive visual depth | **Full nunc-ui adoption now**: tokens + primitives; the primary accent flips to News cyan `#18c7d8` (D6); FourFive blue `#5b8cff` survives as a secondary token. |
| B3 | World view scope | **Restyled list + the News D3 dashboard wrapped now** (iframe, dashboard kept as-is); data stays on the `NEWS_WORLD` export — moving News itself is Phase C. |
| B4 | Timeline v0 | **Real lanes from existing vault data, plus reserved empty lanes** for interventions and mandate windows, labeled "no records yet (Phase D+)" — the future look is fixed now, the data arrives with manda integration. |

Derived decisions:

- **Ports:** gate `:8720` (`NS_PORT`, user-facing — S-0/S-10 texts stay
  true); engine internal `:8721` (`NS_ENGINE_PORT`); FourFive server `:8787`
  (its existing `PORT`). Everything binds `127.0.0.1`. The gate carries the
  same Host-allowlist guard (DNS-rebinding) as the engine; the engine keeps
  its own guard — defense in depth.
- **Process model:** `just up` = engine + fourfive server + gate, bundled
  with `concurrently -k` (root devDependency; cross-platform, needed for the
  Windows story). The engine keeps its `--static-dir` flag but `just up`
  stops passing it; engine solo run still works (F12).
- **Workspace:** `pnpm-workspace.yaml` at the repo root listing
  `frontend/nunc-stans-formans`, `frontend/packages/*`, `engines/fourfive`;
  one lockfile at the root. CI installs once at the root.
- **Routing in Formans:** vue-router, history mode: `/` (home = ME),
  `/world`, `/timeline`. FourFive is a plain `<a href="/fourfive/">` (it is
  its own SPA). The gate serves the Formans SPA fallback for client routes.
- **News dashboard wrap:** `tools/build-world.ts` (today's
  `frontend/scripts/build-world.mjs`, moved to `tools/` and ported to TS per
  §2.10 while touched) keeps producing `world-headlines.json` **and** stages
  the dashboard (`engines/nunc-fluens/docs/`) plus the `NEWS_WORLD` graph
  data into `frontend/nunc-stans-formans/public/world-graph/` (gitignored);
  Vite ships it inside the Formans dist; the world view iframes
  `/world-graph/index.html`. Placing the script under `tools/` keeps FD-7.4
  (frontend must not reference engine internals) green. `NEWS_WORLD` unset ⇒
  an empty-state panel instead of the iframe.
- **Timeline data:** existing endpoints only — `/self/commitments`,
  `/self/edges`, `/self/outcomes/{slug}` fetched per commitment in parallel.
  No engine changes this phase; a bulk outcomes endpoint is future work if
  scale ever demands it.
- **Timeline rendering:** hand-rolled SVG (no D3 dependency), weekly
  buckets on the nunc-ui heat scale. Lanes: commitments (open markers from
  `started_at`, close markers from outcomes), edges by author, a weekly
  provenance-mix heat strip, plus the two reserved lanes (B4). Clicking any
  point navigates to `/?focus=<id>`; home scrolls to and highlights that
  record. The F9 provenance line stays on home (§10-C).
- **Commit areas:** new area `gate` (`gate/**`); `fe` keeps covering all of
  `frontend/` including `packages/`. `CONTRIBUTING.md` and
  `tools/commit-scope.ts` updated.
- **FourFive mount details:** Vite `base: '/fourfive/'`; the API client goes
  base-relative (`/fourfive/api`); the server's `cors()` middleware is
  removed (single origin in production; standalone dev keeps the Vite proxy,
  which never needed CORS).
- **Branch:** work lands on `dev` directly (owner pushes; PR to `main` at
  the review gate).

## Component specs

### gate/ — crate `nunc-stans-gate`

Route table (first match wins):

| Path | Behavior |
|---|---|
| `/health` | reverse proxy → engine (S-10's pass criterion keeps proving the whole chain gate→engine) |
| `/gate/health` | gate's own liveness (JSON, names the crate + version) |
| `/self/*` | reverse proxy → `http://127.0.0.1:8721`, path unchanged, request/response bodies streamed |
| `/fourfive/api/*` | reverse proxy → `http://127.0.0.1:8787/api/*` (strips the `/fourfive` prefix), SSE pass-through unbuffered |
| `/fourfive/` and assets | `ServeDir(engines/fourfive dist)` |
| everything else | `ServeDir(Formans dist)` with `index.html` fallback (SPA routes; `/world-graph/**` ships inside this dist so it needs no route of its own) |

Flags (no path is ever hardcoded — FD-3.2): `--port` (default 8720),
`--engine-url`, `--fourfive-url`, `--formans-dist`, `--fourfive-dist`.
Guards: binds `127.0.0.1` only; Host header allowlist `{localhost,
127.0.0.1}` exactly like the engine's `require_local_host`. Upstream down ⇒
`502` with a JSON body naming the upstream and the fix (mirrors the ME
view's "is `just up` running?" tone). Tests: unit (host guard, prefix
rewrite) + integration against stub upstreams covering streaming and SSE.

### frontend/packages/nunc-ui

Package name `nunc-ui`. Exports `tokens.css`, eight SFC primitives —
`Panel, Card, Badge, Pill, Tabs, Modal, DataChip, HeatDot` — and an
`index.ts`. Tokens verbatim from v1-plan §2.5:

- Neutral base (from FourFive): bg `#0f1115`, elevations `#171a21` /
  `#1e222b`, border `#2a2f3a`, text `#e6e8ec`, dim `#9aa3b2`; radii
  8/10/12, 999 for pills; `system-ui` + `Noto Sans JP`; `ui-monospace` for
  IDs, metrics, API chips.
- Cold data surface (from News), activated by a `.nui-cold` context class:
  bg `#07111f`, 56px grid `rgba(130,170,210,.08)`, glass panels
  `rgba(10,22,38,.92)`.
- Primary accent cyan `#18c7d8` (D6); secondary blue `#5b8cff`.
- Heat scale `#203047 → #2464a8 → #18c7d8 → #ffb84d → #ff4d2e → #fff3c4`;
  success `#5fd99f`; warn `#d9c47f`; error `#e08f8f`; contradiction
  `#c74bd8`.

Vitest render smoke test per primitive.

### frontend/nunc-stans-formans (moved from today's `frontend/`)

- Topbar chrome: brand "Nunc Stans", tabs ME | World | Timeline | FourFive
  (plain link), an engine-status chip.
- Home (`/`): provenance line (F9, §10-C), commitments, author form, edges —
  restyled on Card/Panel/Badge; behavior unchanged; honors `?focus=<id>`
  (scroll + highlight).
- World (`/world`): cold surface; glass panels over the headline list;
  HeatDot recency accents; the commit-from-headline flow unchanged (S-2
  re-verifies it under the new shell); below it, the wrapped dashboard
  iframe or its empty state.
- Timeline (`/timeline`): as specified above (S-9).
- Existing tests (provenance, slug) keep passing; the week-bucketing and
  lane-building logic is a pure module with its own unit tests.

### engines/fourfive

- `nunc-ui: workspace:*`; tokens imported in `main.ts`; the `:root` custom
  property block in `style.css` becomes references to nunc-ui tokens
  (accent → cyan; chat-bubble colors stay local).
- Primitive swaps only where 1:1: the two modals → `Modal`, badge/pill
  spots → `Badge`/`Pill`, the view switcher → `Tabs`, pane wrappers →
  `Panel`. Chat stream, mermaid, and editor internals untouched.
- Mount adaptation: Vite base, base-relative client, `cors()` removed.
- Gate: existing 24 tests + typecheck + a mock-provider smoke pass;
  before/after screenshots.

### Portability / CI / checks

- justfile gains `set windows-shell := ["sh", "-cu"]` (Git for Windows
  provides sh); recipes stay thin wrappers.
- Root README documents Windows prerequisites: Git for Windows (bash/sh),
  `just`, Node ≥ 24 + corepack, rustup **with MSVC Build Tools** (cargo
  linking on native Windows).
- CI: the web job switches to one root workspace install
  (`corepack pnpm install --frozen-lockfile`) + recursive test/build; the
  engine job gains `cargo test --manifest-path gate/Cargo.toml`; 3-OS
  matrix unchanged.
- `tools/check.ts`: FD-3.2 scope covers `gate/` code (paths only via
  flags); FD-7.4 unchanged.

### Stories and exit criteria

- Write `design/stories/S-1.md`, `S-2.md`, `S-9.md` (S-0/S-10 format);
  execute all three with evidence in `design/verification/phase-b.md`.
- S-10 re-run: pristine `ubuntu:24.04` container **and** native Windows 11
  on this machine (PowerShell, documented prerequisites only).
- Screenshot set to `design/ui/phase-b/`: home, world (list + graph),
  timeline, fourfive (before/after), navigation.
- v1-plan updated in place: §2.2 layout gains `gate/` with the B1 rationale;
  the Phase B section notes B2–B4 scope choices.
- CI 3-OS green as a standing exit condition.

## Execution notes

- Execute inside WSL (v1-plan §5 note 12): from a Windows-side session wrap
  every build/test/run in `wsl.exe -e sh -c 'cd ~/nunc-stans && …'`;
  document edits may travel over UNC, builds must not.
- The configured data store is live user data: stories and tests run only
  against scratch stores (`NS_DATA=<scratch>` + `XDG_CONFIG_HOME`
  isolation, exactly like S-0's isolation note).
- Commit per area (`fe`, `ff`, `gate`, `tool`, `design`);
  `node tools/commit-scope.ts` and `node tools/check.ts` after each;
  evidence appends are separate `design:` commits.
- Rollback: tag `pre-phase-b` at Task 0; the frontend directory move is a
  single `git mv` commit, reverted by `git revert` if needed.

## Risks

- **FourFive restyle regression** (largest touched surface): token mapping
  first, primitive swaps second, one commit per swap group, 24 tests +
  typecheck + smoke + screenshots as the net.
- **SSE through the gate:** proven by an integration test before any UI
  relies on it.
- **First native-Windows full boot** (S-10): CI already builds engine +
  web on `windows-latest`, so the exposure is justfile/bootstrap/gate
  runtime; budget for path and shell quirks.
- **Directory move churn** (`frontend/` → `frontend/nunc-stans-formans/`):
  one `git mv` commit plus the path sweep (justfile, CI, READMEs), verified
  by a full `just up` before anything else lands on top.

---

*Task breakdown follows below before execution (v1-plan §7 gate: the owner
approves the full plan before code is touched).*
