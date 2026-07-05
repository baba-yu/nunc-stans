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

## File map

Create: `pnpm-workspace.yaml`, `frontend/packages/nunc-ui/**` (package.json,
vite/vitest config, `src/tokens.css`, `src/index.ts`, 8 SFCs + smoke tests),
`gate/**` (Cargo.toml, `src/main.rs`, `src/proxy.rs`, `src/guard.rs`, tests),
`tools/build-world.ts`, `frontend/nunc-stans-formans/src/router.ts`,
`frontend/nunc-stans-formans/src/views/{HomeView,WorldView,TimelineView}.vue`,
`frontend/nunc-stans-formans/src/timeline.ts` (+ `timeline.test.ts`),
`design/stories/{S-1,S-2,S-9}.md`, `design/verification/phase-b.md`,
`design/ui/phase-b/*.png`.
Modify: everything under `frontend/` moves to `frontend/nunc-stans-formans/`
(git mv), root `package.json` (devDeps), `.gitignore`, `justfile`,
`.github/workflows/ci.yml`, `tools/commit-scope.ts`, `CONTRIBUTING.md`,
`README.md` (Windows prerequisites), `engines/fourfive/{vite.config.ts,
package.json, src/api/client.ts, src/main.ts, src/style.css, src/App.vue,
src/components/{NewSessionModal,MarkdownModal,TempAppPanel}.vue,
server/index.ts}`,
`design/development/2026-07-04-nuncstans-v1-plan.md` (in-place update),
`design/documentation-reading-order.md`.
Delete: `frontend/scripts/build-world.mjs` (absorbed by
`tools/build-world.ts`), `frontend/pnpm-lock.yaml` +
`engines/fourfive/pnpm-lock.yaml` (replaced by the root lockfile).

## Tasks

Conventions for every task: run builds/tests **inside WSL**
(`wsl.exe -e sh -c 'cd ~/nunc-stans && …'` from a Windows-side session);
after each commit run `node tools/commit-scope.ts` and `node tools/check.ts`
(both must say ok); evidence lines append to
`design/verification/phase-b.md` as separate `design:` commits.

### Task 0: Preflight

- [ ] Working tree clean on `dev`; `git tag pre-phase-b`.
- [ ] Record baselines in a new `design/verification/phase-b.md` (format of
  phase-a.md): HEAD hash, engine tests (expect 11 pass), gate n/a,
  frontend tests (expect 10 pass), fourfive tests (expect 24 pass),
  `node tools/check.ts` 3× ok.
- [ ] Commit: `design: open the phase-b verification record`.

### Task 1: Workspace + directory move

- [ ] `git mv` the app: for each of `src public scripts index.html
  package.json pnpm-lock.yaml tsconfig.json vite.config.ts README.md` do
  `git mv frontend/<x> frontend/nunc-stans-formans/<x>` (two-step mv via a
  temp name is fine since `frontend/` keeps existing).
- [ ] Create `pnpm-workspace.yaml` at the root:

```yaml
packages:
  - frontend/nunc-stans-formans
  - frontend/packages/*
  - engines/fourfive
```

- [ ] Root `package.json`: keep `packageManager`, add
  `"devDependencies": { "concurrently": "^9.1.0" }`.
- [ ] Delete the two per-package lockfiles; run `pnpm install` at the root
  once → one root `pnpm-lock.yaml`.
- [ ] `.gitignore`: replace `frontend/dist/` and
  `frontend/public/world-headlines.json` with
  `frontend/nunc-stans-formans/dist/`,
  `frontend/nunc-stans-formans/public/world-headlines.json`,
  `frontend/nunc-stans-formans/public/world-graph/`.
- [ ] justfile: every `-C frontend` becomes `-C frontend/nunc-stans-formans`;
  `--static-dir frontend/nunc-stans-formans/dist` (old topology stays for
  now); `build-world` still calls the old script at its moved path
  (`node frontend/nunc-stans-formans/scripts/build-world.mjs` — the tools/
  port happens in Task 8).
- [ ] CI web job: the two `install --frozen-lockfile` lines collapse into one
  root `corepack pnpm install --frozen-lockfile`; test/build lines keep
  their `-C` forms with the new frontend path.
- [ ] Verify: `pnpm -r test` (frontend 10 + fourfive 24 pass),
  `just up` boots and serves home on :8720, `node tools/check.ts` ok.
- [ ] Commits: `fe: move the app to frontend/nunc-stans-formans` (the mv +
  its README), then `tool: root pnpm workspace, lockfile, ci install, path
  sweep` (workspace/package/lockfile/.gitignore/justfile/ci).

### Task 2: nunc-ui package

**Files:** `frontend/packages/nunc-ui/{package.json,vite.config.ts,src/…}`.

- [ ] `package.json`: name `nunc-ui`, `"type": "module"`, main/module via a
  plain `src/index.ts` export (consumed source-direct inside the workspace —
  no build step; vite in the consumers compiles SFCs), peerDependency
  `vue ^3.5`, devDeps `vitest @vue/test-utils @vitejs/plugin-vue happy-dom
  typescript vue-tsc` (versions matching the formans package),
  scripts `test: vitest run`, `typecheck: vue-tsc --noEmit`.
- [ ] `src/tokens.css` — the design-system contract, verbatim:

```css
:root {
  --nui-bg: #0f1115; --nui-elev1: #171a21; --nui-elev2: #1e222b;
  --nui-border: #2a2f3a; --nui-text: #e6e8ec; --nui-dim: #9aa3b2;
  --nui-accent: #18c7d8; --nui-accent-press: #12a8b7;
  --nui-secondary: #5b8cff;
  --nui-radius-s: 8px; --nui-radius-m: 10px; --nui-radius-l: 12px;
  --nui-radius-pill: 999px;
  --nui-font: system-ui, -apple-system, 'Segoe UI', Roboto,
    'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
  --nui-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --nui-heat-0: #203047; --nui-heat-1: #2464a8; --nui-heat-2: #18c7d8;
  --nui-heat-3: #ffb84d; --nui-heat-4: #ff4d2e; --nui-heat-5: #fff3c4;
  --nui-success: #5fd99f; --nui-warn: #d9c47f; --nui-error: #e08f8f;
  --nui-contradiction: #c74bd8;
  --nui-cold-bg: #07111f; --nui-cold-grid: rgba(130, 170, 210, 0.08);
  --nui-cold-panel: rgba(10, 22, 38, 0.92);
  --nui-cold-border: rgba(130, 170, 210, 0.18);
  --nui-cold-text: #d8e7f7; --nui-cold-dim: #8fa8c2;
  color-scheme: dark;
}
.nui-cold {
  background-color: var(--nui-cold-bg);
  background-image:
    linear-gradient(var(--nui-cold-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--nui-cold-grid) 1px, transparent 1px);
  background-size: 56px 56px;
  color: var(--nui-cold-text);
}
```

- [ ] Eight SFCs, each with scoped styles referencing only `--nui-*` tokens:

| Component | Props / emits | Notes |
|---|---|---|
| `Panel` | `title?: string`, `cold?: boolean` | section container; `.nui-cold` glass surface when cold |
| `Card` | — (slots: default, `meta`) | elev1 bg, border, radius-s |
| `Badge` | `variant?: 'default'\|'accent'\|'success'\|'warn'\|'error'` | inline status chip (fourfive `.badge` shape) |
| `Pill` | `active?: boolean` | radius-pill toggle chip |
| `Tabs` | `tabs: {id,label}[]`, `modelValue: string` / `update:modelValue` | pill-row switcher |
| `Modal` | `open: boolean`, `title?: string` / `close` | Teleport + backdrop; `@click.self` closes |
| `DataChip` | `label: string`, `value: string` | mono value chip (IDs, metrics) |
| `HeatDot` | `level: 0\|1\|2\|3\|4\|5`, `title?: string` | 8px dot on the heat scale |

  Exemplar (Modal — the others follow the same SFC shape):

```vue
<script setup lang="ts">
defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <Teleport to="body">
    <div v-if="open" class="nui-modal-backdrop" @click.self="emit('close')">
      <div class="nui-modal" role="dialog" aria-modal="true">
        <header v-if="title" class="nui-modal-title">{{ title }}</header>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.nui-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55);
  display: grid; place-items: center; z-index: 100; }
.nui-modal { background: var(--nui-elev1); border: 1px solid var(--nui-border);
  border-radius: var(--nui-radius-l); padding: 18px; min-width: 320px;
  max-width: min(680px, 92vw); max-height: 86vh; overflow: auto; }
.nui-modal-title { font-weight: 700; margin-bottom: 10px; }
</style>
```

- [ ] `src/index.ts` exports all eight + imports `tokens.css` (side effect).
- [ ] One vitest smoke per component (mount, assert root class / emitted
  event; Modal: `open=false` renders nothing, `open=true` renders dialog,
  backdrop click emits `close`).
- [ ] Verify: `pnpm -C frontend/packages/nunc-ui test` → 8+ pass;
  `pnpm -r test` still green.
- [ ] Commit: `fe: add the nunc-ui package (tokens + eight primitives)`.

### Task 3: gate crate

**Files:** `gate/Cargo.toml`, `gate/src/{main.rs,proxy.rs,guard.rs}`,
`gate/tests/gate.rs`.

- [ ] `Cargo.toml`: package `nunc-stans-gate`; axum / tokio / tower-http
  (`fs` feature) / tracing / tracing-subscriber / clap / serde_json at the
  same versions as `engines/nunc-stans/Cargo.toml`, plus
  `reqwest = { version = "0.12", default-features = false, features = ["stream"] }`
  (loopback http only — no TLS features on purpose).
- [ ] `main.rs`: clap Args `--port` (default 8720), `--engine-url`
  (default `http://127.0.0.1:8721`), `--fourfive-url` (default
  `http://127.0.0.1:8787`), `--formans-dist`, `--fourfive-dist`; bind
  `127.0.0.1` only (same rationale comment as the engine); router:

```rust
let ff = Router::new()
    .route("/api/{*path}", any(proxy_fourfive))       // sees OriginalUri
    .fallback_service(ServeDir::new(&args.fourfive_dist));
let app = Router::new()
    .route("/gate/health", get(gate_health))          // {"ok":true,"gate":"nunc-stans-gate","version":...}
    .route("/health", any(proxy_engine))              // S-10 keeps proving gate→engine
    .route("/self/{*path}", any(proxy_engine))
    .nest("/fourfive", ff)
    .fallback_service(
        ServeDir::new(&args.formans_dist)
            .fallback(ServeFile::new(args.formans_dist.join("index.html"))), // SPA routes /world /timeline
    )
    .layer(middleware::from_fn(require_local_host));
```

- [ ] `guard.rs`: `require_local_host` — copy of the engine's Host
  allowlist middleware (`127.0.0.1` / `localhost`), same 403 message.
- [ ] `proxy.rs`: one streaming forwarder used by both routes. Target =
  upstream base + **original** path+query (`OriginalUri` extension — inside
  `nest` the request URI is prefix-stripped); for fourfive strip the
  leading `/fourfive`. Stream both directions; never buffer (SSE):

```rust
const HOP: &[&str] = &["connection", "transfer-encoding", "host",
    "keep-alive", "proxy-connection", "te", "trailer", "upgrade"];

pub async fn forward(client: &reqwest::Client, target: String, req: Request) -> Response {
    let (parts, body) = req.into_parts();
    let mut rb = client.request(parts.method, target)
        .body(reqwest::Body::wrap_stream(body.into_data_stream()));
    for (k, v) in &parts.headers {
        if !HOP.contains(&k.as_str()) { rb = rb.header(k, v); }
    }
    match rb.send().await {
        Ok(up) => {
            let mut out = Response::builder().status(up.status());
            for (k, v) in up.headers() {
                if !HOP.contains(&k.as_str()) { out = out.header(k, v); }
            }
            out.body(Body::from_stream(up.bytes_stream())).unwrap()
        }
        Err(e) => (StatusCode::BAD_GATEWAY, Json(json!({
            "error": format!("upstream unreachable ({e}) — is `just up` running all three processes?")
        }))).into_response(),
    }
}
```

- [ ] Tests (`gate/tests/gate.rs`): spawn two stub axum servers on ephemeral
  ports (one returning JSON at `/self/commitments` and `/health`; one with
  `/api/health` and an SSE `/api/stream` emitting two `data:` events), spawn
  the gate against them, then assert: (1) `/health` and `/self/commitments`
  round-trip the JSON; (2) `/fourfive/api/health` reaches the stub with the
  prefix stripped; (3) `/fourfive/api/stream` yields `content-type:
  text/event-stream` and both events; (4) a request with `Host: evil.example`
  gets 403; (5) unknown path serves `index.html` from a temp formans dist
  (SPA fallback). Unit-test the prefix-strip helper separately.
- [ ] Verify: `cargo test --manifest-path gate/Cargo.toml` → all pass.
- [ ] CI: engine job gains `- run: cargo test --manifest-path gate/Cargo.toml`.
- [ ] `tools/commit-scope.ts`: area regex gains `|gate`;
  `CONTRIBUTING.md` areas line gains `gate` (gate/, the single-origin front
  door).
- [ ] Commits: `gate: add the single-origin front door crate`,
  `tool: register the gate area and its ci test step` (ci + commit-scope),
  `design: add the gate area to the contributing areas`.

### Task 4: FourFive mount adaptation

**Files:** `engines/fourfive/{vite.config.ts,src/api/client.ts,server/index.ts}`.

- [ ] `vite.config.ts`: add `base: '/fourfive/'`; dev proxy key becomes
  `'/fourfive/api'` with `rewrite: (p) => p.replace(/^\/fourfive/, '')` so
  standalone `pnpm dev` keeps working against its own server.
- [ ] `src/api/client.ts`: `const API = import.meta.env.BASE_URL + 'api'`
  (→ `/fourfive/api` mounted, `/fourfive/api` in dev too); replace every
  literal `'/api` with `` `${API}`` (12 call sites + the SSE
  `streamMessage` fetch).
- [ ] `server/index.ts`: remove the `cors()` middleware and its import
  (single origin in production; the dev path goes through Vite's proxy and
  never needed CORS).
- [ ] Verify: `pnpm -C engines/fourfive test` (24 pass), `typecheck` clean,
  `pnpm -C engines/fourfive build` → `dist/` assets reference
  `/fourfive/…`; standalone dev smoke: `pnpm -C engines/fourfive dev`,
  create a session, send one mock message, streaming works.
- [ ] Commit: `ff: serve under /fourfive on the single origin`.

### Task 5: Wire the topology — `just up` = engine + fourfive + gate

**Files:** `justfile`, root `package.json` (concurrently already added).

- [ ] New justfile core (rest of the file unchanged):

```make
set shell := ["bash", "-uc"]
set windows-shell := ["sh", "-cu"]

# One origin (the gate, :8720) fronts everything: ledger engine :8721 and
# the fourfive server :8787 stay loopback-internal. NS_PORT moves the gate;
# NS_ENGINE_PORT moves the engine.
up: _require_data build
    pnpm exec concurrently -k -n engine,fourfive,gate -c yellow,blue,cyan \
      "cargo run --manifest-path engines/nunc-stans/Cargo.toml --release -- --self-dir '{{data_dir}}/self' --port ${NS_ENGINE_PORT:-8721}" \
      "PORT=8787 pnpm -C engines/fourfive start:server" \
      "cargo run --manifest-path gate/Cargo.toml --release -- --port ${NS_PORT:-8720} --engine-url http://127.0.0.1:${NS_ENGINE_PORT:-8721} --fourfive-url http://127.0.0.1:8787 --formans-dist frontend/nunc-stans-formans/dist --fourfive-dist engines/fourfive/dist"

build: build-world
    pnpm install --frozen-lockfile || pnpm install
    pnpm -r build
    cargo build --release --manifest-path engines/nunc-stans/Cargo.toml
    cargo build --release --manifest-path gate/Cargo.toml

test:
    cargo test --manifest-path engines/nunc-stans/Cargo.toml
    cargo test --manifest-path gate/Cargo.toml
    pnpm -r test
```

  (`web` recipe: formans dev via Vite with proxy `/self /health /fourfive
  /world-graph → http://127.0.0.1:8720` — added to the formans vite config
  in Task 6; the engine's `--static-dir` is simply no longer passed.)
- [ ] Verify the chain (scratch vault): `just up`, then
  `curl -s 127.0.0.1:8720/health` → engine JSON;
  `…/gate/health` → gate JSON; `…/self/commitments` → JSON;
  `…/fourfive/api/health` → provider JSON; `…/fourfive/` → HTML;
  `curl -s -H 'Host: evil.example' 127.0.0.1:8720/health` → 403;
  engine solo (`cargo run … --self-dir … --port 8721`) still answers
  directly (F12). Ctrl-C tears all three down (`-k`).
- [ ] Commit: `tool: front everything with the gate in just up`.

### Task 6: Formans shell — router, nav chrome, ME restyle

**Files:** `frontend/nunc-stans-formans/src/{main.ts,router.ts,App.vue,
views/HomeView.vue,style.css,vite.config.ts,index.html}`, package.json
(`vue-router@4`, `nunc-ui workspace:*`).

- [ ] `router.ts`: history mode; routes `/` → HomeView, `/world` →
  WorldView (Task 8), `/timeline` → TimelineView (Task 9). Register in
  `main.ts`; import nunc-ui (tokens land globally).
- [ ] `App.vue` becomes the shell: topbar (brand **Nunc Stans**, tabs ME /
  World / Timeline via `RouterLink`, FourFive as `<a href="/fourfive/">`,
  right side an engine-status chip fed by `store.reachable`), then
  `<RouterView/>`. Topbar shape mirrors fourfive's (48px, elev1, border).
- [ ] `HomeView.vue`: today's ME content (provenance line, commitments on
  `Card`, `AuthorForm` in a `Panel`, edges list) — components restyled with
  nunc-ui, logic untouched. Honors `?focus=<id>`: on mount scroll to
  `[data-record-id="<id>"]` and apply a highlight class (records get
  `data-record-id` = commitment id / edge id).
- [ ] `style.css`: page baseline moves to nunc-ui tokens (dark neutral bg,
  `--nui-font`); the old ad-hoc rules shrink to layout-only.
- [ ] `index.html`: `<title>Nunc Stans</title>`.
- [ ] `vite.config.ts`: dev proxy `/self /health /fourfive /world-graph` →
  `http://127.0.0.1:8720`.
- [ ] Verify: `pnpm -C frontend/nunc-stans-formans test` (10 pass; tests
  are pure modules, untouched), build, `just up`, visual pass on home;
  `?focus=` smoke by URL hand-edit.
- [ ] Commit: `fe: formans shell with router, nav chrome, and the restyled me view`.

### Task 7: FourFive adopts nunc-ui

**Files:** `engines/fourfive/{package.json,src/main.ts,src/style.css,
src/App.vue,src/components/{NewSessionModal,MarkdownModal,TempAppPanel}.vue}`.

- [ ] `package.json`: `"nunc-ui": "workspace:*"`; `main.ts` imports nunc-ui.
- [ ] `style.css`: the `:root` block becomes aliases onto the tokens — the
  whole app reskins in one move, accent flips to cyan (D6):

```css
:root {
  --bg: var(--nui-bg); --bg-elev: var(--nui-elev1); --bg-elev2: var(--nui-elev2);
  --border: var(--nui-border); --text: var(--nui-text); --text-dim: var(--nui-dim);
  --accent: var(--nui-accent); --accent-press: var(--nui-accent-press);
  --user: #243150; --assistant: var(--nui-elev2);   /* chat bubbles stay local */
  font-family: var(--nui-font);
  color-scheme: dark;
}
```

- [ ] Primitive swaps, one commit each group, tests between:
  `NewSessionModal` / `MarkdownModal` → wrap content in nunc-ui `Modal`
  (keep their internal forms); `.badge` spans in `App.vue` → `Badge`;
  the right-pane view switcher in `TempAppPanel.vue` → `Tabs`. The
  `.think` / `.numctl` bespoke controls and chat internals stay.
- [ ] Verify after each: 24 tests, typecheck, mock-provider dev smoke
  (session + message + stream); rebuild; visual pass at `/fourfive/`
  through the gate.
- [ ] Commits: `ff: alias the style tokens onto nunc-ui (accent to cyan)`,
  `ff: adopt the nunc-ui modal, badge, and tabs primitives`.

### Task 8: World view — cold surface + wrapped dashboard

**Files:** `tools/build-world.ts` (new; delete
`frontend/nunc-stans-formans/scripts/build-world.mjs`),
`frontend/nunc-stans-formans/src/views/WorldView.vue` (from
`components/WorldView.vue`), root `package.json` (devDep `d3@^7` — vendored
asset only), `justfile` (`build-world: node tools/build-world.ts`).

- [ ] `tools/build-world.ts` (repo-root anchored paths):
  1. Flatten `NEWS_WORLD` → `frontend/nunc-stans-formans/public/world-headlines.json`
     (port the .mjs logic verbatim, including the corrupt-file and unset
     degradation paths and the §10-C no-ranking sort comment).
  2. Stage the dashboard when `NEWS_WORLD` is set: copy
     `engines/nunc-fluens/docs/{index.html,assets/,favicon.svg}` →
     `…/public/world-graph/`, rewriting the jsdelivr d3 `<script src>` to
     `assets/d3.min.js` and copying `node_modules/d3/dist/d3.min.js` there
     (local-first: no CDN inside the product, §10-B); copy
     `dirname(NEWS_WORLD)/` → `…/public/world-graph/data/` (manifest,
     graph-*.json, glossary, evidence-reverse, snapshots/) skipping files
     whose mtime+size are unchanged (the mix graph is ~26 MB).
  3. `NEWS_WORLD` unset → write the empty headline list and **remove** any
     stale `world-graph/` staging so the view degrades honestly.
- [ ] `WorldView.vue`: route view on the `.nui-cold` surface — glass `Panel`
  over the headline list (HeatDot by recency: <7d level 4, <30d 2, else 0),
  commit-from-headline flow byte-identical in behavior; below, the wrapped
  dashboard: `fetch('/world-graph/data/manifest.json', {method:'HEAD'})` →
  200 renders `<iframe src="/world-graph/index.html">` (full-width panel,
  ~70vh), else an empty-state panel quoting the `NEWS_WORLD` hint.
- [ ] Verify: with `NEWS_WORLD=~/news/docs/data/graph-mix.json`:
  `just build-world` stages (first run copies, second run skips unchanged —
  log says so); `just up` → world view shows list + live dashboard, zero
  requests leave the origin (network tab); with `NEWS_WORLD` unset →
  empty states, no stale iframe. `node tools/check.ts` still ok (FD-7.4:
  the engines/ reference lives in `tools/`, not `frontend/`).
- [ ] Commits: `tool: port build-world to typescript and stage the wrapped
  dashboard`, `fe: world view on the cold surface with the dashboard wrap`.

### Task 9: Timeline view (S-9)

**Files:** `frontend/nunc-stans-formans/src/{timeline.ts,timeline.test.ts,
views/TimelineView.vue,api.ts}` (add `getOutcomes(slug)` →
`GET /self/outcomes/{slug}`).

- [ ] `timeline.ts` — pure module, no DOM:

```ts
export function isoWeekKey(dateISO: string): string {
  const d = new Date(dateISO.length === 10 ? dateISO + 'T00:00:00Z' : dateISO)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)          // this week's Thursday
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export interface WeekRow {
  key: string                       // '2026-W27'
  opened: string[]                  // commitment ids, by started_at
  closed: string[]                  // commitment ids, week of the observable outcome
  edges: { user: number; ai: number; sensor: number }   // by created_at
  mix: ProvenanceMix                // over commitments OPENED this week
}
export function buildWeeks(commitments, edges, outcomesBySlug): WeekRow[]
// contiguous weeks, oldest → newest, spanning min..max event week
```

  Weekly mix definition (pinned): for the commitments **opened** in week W,
  the fraction having an `informed_by → world/*` edge (any time) — reuses
  `provenanceMix` on the week's subset.
- [ ] `timeline.test.ts` vectors: `isoWeekKey('2026-06-29') === '2026-W27'`,
  `isoWeekKey('2026-07-06') === '2026-W28'`, year-boundary
  `isoWeekKey('2026-01-01') === '2026-W01'`,
  `isoWeekKey('2027-01-01') === '2026-W53'`; buildWeeks fixture — c1
  started 2026-06-29 with an informed_by→world edge, c2 started 2026-07-01,
  c1's observable outcome recorded 2026-07-06 ⇒ W27 {opened:[c1,c2],
  mix 1/2 = 50%}, W28 {closed:[c1]}; contiguity (an empty W between events
  still appears).
- [ ] `TimelineView.vue`: cold surface; hand-rolled SVG — x = weeks;
  lanes top→bottom: commitments (open ○ / close ● markers), edges
  (stacked count dots by author), provenance strip (one `rect` per week,
  fill = heat level from percent: 0→heat-0, 1–25→1, 26–50→2, 51–75→3,
  76–100→4), then two reserved lanes rendered dim with the label
  "no records yet (Phase D+)" (interventions; mandate windows). Every
  marker is an `<a>` → `/?focus=<id>` (close markers target their
  commitment). Outcomes fetched per commitment in parallel on mount.
- [ ] Verify: `pnpm -C frontend/nunc-stans-formans test` (10 + new ≈ 6
  pass); seeded-vault visual pass (S-9 script below).
- [ ] Commits: `fe: timeline week model with tests`,
  `fe: timeline view with reserved lanes and record jump`.

### Task 10: Stories S-1 / S-2 / S-9 — write and execute

- [ ] Write `design/stories/S-1.md`:

```markdown
# S-1 — One origin (Phase B)
With `just up` running: http://127.0.0.1:8720 reaches home (ME); the topbar
reaches World and Timeline with no port change; the FourFive tab opens
/fourfive/ whose API answers through the same origin; every surface speaks
the nunc-ui language.
Pass (mechanical):
  curl -s 127.0.0.1:8720/health           → engine JSON
  curl -s 127.0.0.1:8720/fourfive/api/health → provider JSON
  curl -s 127.0.0.1:8720/ | grep -q '<title>Nunc Stans</title>'
plus a visual pass over home / world / timeline / fourfive.
First executed: Phase B close.
```

- [ ] Write `design/stories/S-2.md` (Phase-3 behavior re-verified under the
  new shell): scratch vault + `NEWS_WORLD` set; world view lists headlines;
  "Commit from this headline" → engine answers `authored … + informed_by →
  News (provenance updated)`; `/self/edges` count +1; home provenance line
  moves. Pass: the response line + the F9 line's percent change, captured.
- [ ] Write `design/stories/S-9.md`: seed a scratch vault —

```bash
curl -s -X POST 127.0.0.1:8720/self/commitments -H 'content-type: application/json' \
  -d '{"slug":"tl-a","title":"timeline A","started_at":"2026-06-29"}'
curl -s -X POST 127.0.0.1:8720/self/commitments -H 'content-type: application/json' \
  -d '{"slug":"tl-b","title":"timeline B","started_at":"2026-07-01"}'
curl -s -X POST 127.0.0.1:8720/self/edges -H 'content-type: application/json' \
  -d '{"type":"informed_by","from":"self/commitment/tl-a","to":"world/prediction/x","to_label":"seed headline","author":"user"}'
curl -s -X POST 127.0.0.1:8720/self/outcomes -H 'content-type: application/json' \
  -d '{"commitment_slug":"tl-a","component":"observable","result":"confirmed"}'
```

  Open `/timeline` → two weeks appear (W27: two opens, mix 50%; the outcome
  week: one close); the provenance strip shows the heat step; the two
  reserved lanes show their "no records yet (Phase D+)" label; clicking the
  tl-a open marker lands on home with tl-a highlighted. Pass: all observed.
- [ ] Execute all three against a scratch vault
  (`XDG_CONFIG_HOME=<scratch>` isolation as in S-0); paste evidence into
  `design/verification/phase-b.md`.
- [ ] Screenshots → `design/ui/phase-b/`: home, world (list + dashboard),
  timeline, fourfive (plus the pre-restyle fourfive shot taken at Task 7
  start), any browser. Committed (binary, design area).
- [ ] Commits: `design: add stories s-1, s-2, s-9`,
  `design: record the phase-b story evidence and screenshots`.

### Task 11: Portability close — S-10 on Ubuntu and native Windows

- [ ] Root `README.md`: prerequisites gain the Windows column — Git for
  Windows (provides sh for `just`), `just` (winget/cargo), Node ≥ 24 +
  corepack, rustup **with the MSVC Build Tools**; note that `just up` runs
  three processes and NS_PORT/NS_ENGINE_PORT move them.
- [ ] S-10 (Ubuntu): the Phase-A pristine `ubuntu:24.04` container run,
  now asserting the gate chain: `/health`, `/`, `/fourfive/api/health`
  through :8720. Record transcript.
- [ ] S-10 (native Windows, this machine, PowerShell): isolate with a
  scratch `APPDATA`; `git clone` to a scratch dir → `just bootstrap
  <scratch-store>` → `just up` → the same three curls + browser home.
  Record transcript + any fixes (expected exposure: justfile
  `windows-shell`, bootstrap under Git-Bash sh, path handling in
  `tools/*.ts` — all fixes land as in-phase commits).
- [ ] CI matrix green on `dev` after the owner pushes (standing condition).
- [ ] Commit: `design: record the phase-b s-10 runs` (+ any fix commits in
  their own areas).

### Task 12: Plan-document updates and phase close

- [ ] `design/development/2026-07-04-nuncstans-v1-plan.md` — in-place
  updates: §2.2 layout gains `gate/` (one line + "(added Phase B, B1)");
  the Phase B section gains a sentence pointing at this plan and the B1–B4
  decisions; §5 note 12 unchanged.
- [ ] `design/documentation-reading-order.md`: inventory gains `gate/` and
  this plan file; the "planned additions" line drops the Phase B items.
- [ ] `design/verification/phase-b.md`: fill the exit-criteria checklist —
  S-1/S-2/S-9 pass, S-10 Ubuntu + Windows pass, CI green, screenshots
  saved, `just check` ok, fourfive tests/typecheck green, engine untouched
  (`git log --oneline engines/nunc-stans/src` shows no phase-b commits).
- [ ] Update the assistant memory (`federation-build.md`): Phase B state.
- [ ] Commit: `design: close phase b with the verification record`.
- [ ] OWNER gate: push `dev`, watch CI, review the verification record,
  merge to `main` via PR when satisfied.

## Self-review (done at write time)

Spec coverage: single origin + gate (T3/T5), workspace + move (T1), nunc-ui
tokens/primitives (T2), ME restyle + nav + router + focus jump (T6),
FourFive mount (T4) + adoption B2 (T7), world cold surface + dashboard wrap
B3 (T8), timeline B4 with reserved lanes + weekly mix (T9), stories +
screenshots (T10), S-10 Ubuntu + native Windows + README + windows-shell
(T5/T11), CI workspace install + gate step (T1/T3), commit areas (T3),
v1-plan deviation record (T12), engine untouched (verified at T12).
Type consistency: `WeekRow`/`provenanceMix` reuse checked against
`provenance.ts`; gate flag names match between T3 and T5; the staged
dashboard path (`public/world-graph/`) matches the WorldView HEAD probe and
the `.gitignore` entry (T1). Known deferrals: bulk outcomes endpoint (noted
in the design), fourfive package rename (`codev`) untouched, News data
source stays `NEWS_WORLD` until Phase C.
