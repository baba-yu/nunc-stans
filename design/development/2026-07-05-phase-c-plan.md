# Phase C Implementation Plan — News newstack (pipeline as code + packages/ai)

**Goal:** the News daily DAG runs as **TypeScript code** — steps are functions,
I/O is the existing sourcedata JSON schemas, gates are the existing
deterministic checks — orchestrated by a CLI that a systemd timer starts and
finishes **with no conversational step**. `frontend/packages/ai` exists as the
one place that talks to models (providers + the claude-code runtime + the
search-source × synthesis-model split). The Python compute is ported to TS
against golden-master fixtures (Python is the oracle until parity, then
retired — D4). `analytics.sqlite` moves to `<data store>/world/`. `~/news` is
split into a data+publish remnant renamed `nunc-fluens` (D3). Exit: one full
daily run each on (a) claude-code, (b) a local provider + external search,
(c) replay with zero LLM calls; ported tests green against goldens; stories
S-3 and S-4 pass; S-10 re-run; 3-OS CI green.

**Architecture:** a new workspace package `engines/nunc-fluens/pipeline/`
(bin `nunc-fluens`) implements the day-of-week DAG from
`design/scheduled/0_daily_master.md` as a typed step graph: LLM steps call
`frontend/packages/ai` and are schema-validated at the boundary; deterministic
steps are TS ports of the `app/` Python (renderers via nunjucks reusing the
Jinja2 templates). Read/write topology after C: **run inputs and published
outputs live in the remnant repo checkout** (sourcedata, report/, FP,
README, docs/, memory/, reference/, references.txt — the world SoR per the
constitution), **the DB cache and run logs live in the data store**
(`world/analytics.sqlite`, `runs/ai-runs.jsonl`). `NEWS_WORLD` is retired: the
remnant checkout location becomes app config (`newsRepo`), env override
`NS_NEWS_REPO`.

**Tech stack:** TypeScript on node 24 (type-stripping, as `tools/*.ts`
already runs); nunjucks (Jinja2-compatible) for renderers; better-sqlite3
(^12); zod or ajv against `design/sourcedata-layout.md` schemas; vitest;
pnpm workspace; systemd user timer (cron fallback documented); Rust (gate)
only if C5 lands on the gate endpoint.

**Plan doc convention:** plans live in `design/development/` (repo rule).
Work runs on branch **`newstack`** off `dev` (v1 plan §3); owner pushes for
CI; merge back to `dev` at phase close.

---

## Design decisions (owner-approved 2026-07-05)

| # | Decision | Choice |
|---|---|---|
| C1 | Pipeline home | `engines/nunc-fluens/pipeline/`, workspace package, bin `nunc-fluens`. The Python `app/` stays beside it as oracle until the T12 parity gate, then is deleted. |
| C2 | Renderer parity strategy | nunjucks consuming the existing two `.j2` templates (minimal syntax edits, byte-identical goldens). Alternative: hand-rolled string builders (rejected: parity risk). |
| C3 | External search adapters | **Owner: make them interchangeable, not one blessed engine.** `SearchSource` is a first-class plugin interface; Phase C implements **Brave** (owner holds a key — the S-3 exercise pair), **SearXNG** (keyless path for users without accounts), **Tavily**, and **Perplexity Search** (keyed) as thin HTTP adapters. **DuckDuckGo has no official search API** — recorded as a wanted adapter, deferred until a ToS-clean route exists (their HTML endpoint is scraping). |
| C4 | Exit-run (b) provider | ollama + `qwen3.6:27b` (already installed on this box) + an external adapter. Acceptance is structural validity, not content quality (v1 plan §3 Phase C). |
| C5 | S-3 settings surface | **Owner: gate gains a minimal config API** (`GET/PUT /api/world/news-config` → atomic JSON at `<data store>/world/news-config.json`) + a settings drawer in the Formans world view. No new process; the gate stays the one door (B1 continuity). |
| C6 | Exit-run publish policy | **Owner: all three runs publish.** (a) is the timer-launched real day; (b) publishes its local-model day as real data — provider differences are allowed to show on the public dashboard; (c) replays an already-published day, so its push is naturally a no-op on content and lands only the run manifest/evidence. |
| C7 | Python retirement timing | At T12, in-phase (per D4): after goldens are green and runs (a)(b)(c) pass, delete `engines/nunc-fluens/app/` (git history keeps it) and swap the CI news job pytest → vitest. The remnant repo drops its `app/` too. |
| C8 | Taxonomy edits in the persistent-store arch (owner-approved 2026-07-06) | `apply-schema-edit` targets **DB rows directly** (`themes`/`categories`/`theme_candidates` in `analytics.sqlite`), not `schema.sql`. Rationale: the DB is now the persistent store and `schema.sql` is monorepo code — a user's weekly run must not mutate shared source. `schema.sql` remains the first-boot seed only. Manual approval mode stays the default; the pre-edit rollback target becomes a DB snapshot instead of a schema.sql copy. Recorded deviation from oracle behavior (architecturally forced; the replay path is unaffected — committed corpus already embodies applied edits, proven by the DB parity gate). |

Derived decisions:

- **Data placement (§2.9 applied):** `analytics.sqlite` →
  `<data store>/world/analytics.sqlite` (same file, same schema; the
  `.partial/.dud/.bak` junk siblings in `~/news/app/data/` are *not*
  migrated; `PRAGMA integrity_check` gates the copy). AI run log →
  `<data store>/runs/ai-runs.jsonl`. Sourcedata **stays committed in the
  remnant repo** (it is world SoR and the replay input; 2 982 files already
  tracked there today).
- **Config resolution:** the pipeline resolves the data store exactly as
  `tools/data-dir.ts` does (NS_DATA > FED_DATA-warn > app config). The
  resolver is extracted to `tools/lib/data-dir.ts` and imported by both
  callers (node 24 runs TS relative imports fine). New config key `newsRepo`
  (path to the remnant checkout), env override `NS_NEWS_REPO`; set via
  `just news-link <dir>`. Unset ⇒ Formans world view keeps its Phase-B
  empty state; the pipeline refuses to run with a clear message.
- **`NEWS_WORLD` retired:** `tools/build-world.ts` stages the dashboard from
  the `newsRepo` checkout (`docs/` + `docs/data/`) instead of the env var.
  Grep-clean at T12 (naming.md updated).
- **LLM step boundary:** every LLM step = prompt asset + expected JSON
  schema + re-prompt-on-schema-error policy (the existing failure-mode
  rules). Prompts are ported from `~/news/design/skills/compose-*.md` and
  writer-rules into `engines/nunc-fluens/pipeline/prompts/` with provenance
  headers. The sub-agent dispatch policy becomes per-step concurrency
  (promise pools): 3× predictions, 3× locales, N× bridges, 4× READMEs.
- **claude-code runtime:** one headless `claude -p` invocation per LLM step
  (fresh context = the old sub-agent shape), `--output-format json`,
  WebSearch allowed only for steps that search, timeout + one retry.
  Headless-under-systemd auth is verified early (T2 risk probe).
- **Run manifest (S-3 record):** every run writes
  `sourcedata/<date>/run.json` — provider, model, search source×model pair
  per step, tokens, durations, verdicts, replay flag. Committed with the
  day's data (public: names no secrets). `ai-runs.jsonl` gets the per-call
  detail.
- **Replay (S-4):** `nunc-fluens run --date D --replay` reads the stored
  sourcedata JSON instead of calling any provider (asserted: the AI layer is
  handed a `forbid` provider that throws on use), re-runs the deterministic
  chain, and diffs against the published day. Allowed diffs: run metadata
  only (timestamps, run ids) — enumerated in the story spec.
- **Weekly tasks are in scope:** the DOW table (Sun: 4_weekly_memory,
  5_weekly_theme_review, 6_weekly_maintenance before 3_daily_briefing) is
  part of the DAG. `apply-schema-edit` stays in `manual` mode by default.
- **Port scope rule:** everything the daily/weekly DAG invokes is ported;
  one-off backfills are retired un-ported (`backfill_*`,
  `build_evidence_reverse`, `migrate_to_sourcedata`, `super_backfill`,
  `migrations/01_*`, and — reclassified at T1 after confirming no
  scheduled/*.md invokes it — `rename_future_titles`, the applied
  historical title migration; its tests run in CI until T12 via staged
  fixtures). `fastembed` semantic matching is not ported — the
  in-code LCS fallback is the ported behavior (recorded as a documented
  degradation; revisit only if fuzzy-match quality regresses).
- **Commit areas:** `nf` (engines/nunc-fluens/**), `fe` (frontend/** incl.
  packages/ai), `gate`, `tool`, `design`. One commit = one area as usual.
- **Scheduling is Linux/WSL-only in v1** (the three-OS scheduling adapters
  of §5.14 are explicitly deferred; CI still tests the pipeline 3-OS).

---

## Component specs

### `frontend/packages/ai` (v0 — what Phase C needs, shaped for D)

- `Provider` interface: `chat(messages, opts) → {text|json, usage}`,
  streaming optional (not needed by the pipeline), `capabilities:
  {chat, stream, tools, structured, web_search: native|none, thinking,
  memory}` (§2.6).
- Providers: `anthropic-api` (native web_search tool), `ollama`
  (localhost:11434), `mock` (fixture-driven, used by tests and goldens).
- Agent runtime: `claude-code` — spawns headless CLI per call; maps
  step→allowed tools; parses JSON output envelope; surfaces token usage.
- Search axis: `SearchSource` = `native` (provider tool) | external adapter.
  Adapters (C3): `brave`, `searxng` (instance URL config), `tavily`,
  `perplexity` — one small module each behind the same
  `search(query, opts) → results[]` shape, keys via env/config, registry
  keyed by name so a future `duckduckgo` drops in without core changes.
  A step's config picks `{search: source, synth: provider+model}` — the
  pair S-3 switches and `run.json` records.
- Goal-verify middleware: config parsed and logged, **default off**
  (`{verify:off}`) — the full loop with judge/retry surfaces is Phase D
  (S-6); the call-site plumbing exists now so D wires UI, not internals.
- Run log: append JSONL `{ts, caller, provider, model, search, tokens_in,
  tokens_out, duration_ms, verify, outcome}` to
  `<data store>/runs/ai-runs.jsonl`.

### `engines/nunc-fluens/pipeline/`

```
pipeline/
  package.json          name nunc-fluens-pipeline, bin nunc-fluens
  src/
    cli.ts              run [--date D] [--replay] [--dry-run] [--only step]
                        status | migrate-db | link <dir>
    config.ts           data store + newsRepo resolution
    dag.ts              DOW table, step graph, resume (flow-check), gating
    steps/              one module per step (compose-*, render-*, ingest, checks…)
    ai/                 step→packages/ai glue (prompt loading, schemas, pools)
    db/                 schema.sql apply, better-sqlite3 access layer
    render/             nunjucks env + the two templates
    publish/            README window, commit+push to newsRepo (ported
                        bindfs-safe-commit-push logic; plain-git path)
  prompts/              ported compose-* prompt assets + writer rules
  schemas/              sourcedata JSON schemas (from design/sourcedata-layout.md)
  systemd/              nunc-fluens-daily.{service,timer} + install notes
  test/                 vitest: unit ports of the 122-test intent + golden suite
  goldens/              fixture days (inputs) + captured oracle outputs
```

### Orchestrator step map (source of truth: the three scheduled specs)

| Step (1_daily_update) | Kind | Port source |
|---|---|---|
| compose-news-section | LLM+search (1) | prompt asset |
| compose-prediction ×3 | LLM (pool 3) | prompt asset |
| compose-headlines-pair / compose-change-log | LLM | prompt assets |
| extract/define/validate glossary | det + LLM-fill | `extract_glossary_candidates.py`, `define_glossary_terms.py`, `validate_glossary_terms.py` |
| extract-needs ×3 + merge | LLM (pool 3) + det | `extract_needs.py` |
| citation-restriction-check | det | `citation_restriction_check.py` |
| append-references-txt | det | (inline) |
| translate-sourcedata ×3 | LLM (pool 3) | locale-fanout contract |
| render-news-md ×4 | det | `render_news_md.py` + `news.md.j2` |
| ingest-sourcedata | det | `ingest_sourcedata.py`, parsers |
| post-write-integrity / lint-markdown-clean | det | ports |
| verify-topic-coverage | LLM (1) | prompt asset |
| check-topic-coverage / post-update-validation | det | ports |

2_future_prediction (compose-validation-rows, compose-bridge ×N,
compose-summary, citation check, fan-out, render, ingest, lint, validation)
and 3_daily_briefing (FP-exists gate, README ×4 LLM, link/structural checks,
update-pages/export rebuild, integrity, export validation, commit+push) map
the same way; Sunday adds 4/5/6 (dormant snapshot LLM, theme review LLM +
apply-schema-edit, weekly-maintenance port).

### Settings surface (C5 default)

- Gate: `GET/PUT /api/world/news-config` — serde-validated
  `{search: "native"|"external", searchEngine, synthProvider, synthModel,
  runtime}` written atomically to `<data store>/world/news-config.json`.
  Loopback + Host-guard as everywhere; no other gate scope change.
- Formans: settings drawer on `/world` (nunc-ui controls) reading/writing
  that endpoint. The pipeline reads the same file at run start; CLI flags
  override per invocation.

### Scheduling

- `systemd/nunc-fluens-daily.timer` (OnCalendar= owner-chosen time,
  `Persistent=true` so a sleeping laptop catches up) → service runs
  `just news-daily` (which is `nunc-fluens run` with defaults: runtime
  claude-code per D7). `just news-schedule` installs user units;
  cron fallback line documented in the engine README.
- Proof of "no conversational step": exit run (a) is launched by
  `systemctl --user start nunc-fluens-daily.service` (same unit the timer
  fires), not by an interactive prompt.

---

## Execution notes

- Build/test inside WSL (better-sqlite3 native, pnpm, systemd all live
  there); drive via `wsl.exe` scripts per repo convention.
- **Oracle discipline:** the Python app is read-only reference until T12.
  Any bug found in it during the port is fixed **in the TS port** and
  recorded; the goldens capture current behavior, warts included (behavior
  changes are out of scope for the port).
- **`~/news` keeps running the old stack daily until T9 cutover.** Before
  T8 (remnant split), re-diff the subtree against upstream and fold in any
  drift (code freeze makes this unlikely but the check is cheap — today's
  diff: clean at upstream 9e86e01 / last code commit 529f2e1).
- Cutover day: old Cowork routine stops, timer starts. Pick a date with the
  owner at T9; keep one manual-run day in between if wanted.
- Cost: (a) rides the subscription (claude-code). (b) is local (ollama).
  Goal-verify stays off. API providers are configured but not exercised in
  exit runs unless the owner opts in.

## Risks

1. **Port surface** (~7 kLoC Python, 122 tests, 24 skills): mitigated by
   goldens-first ordering (T1 before any port), oracle-until-parity, and
   the T4 a/b/c split at session boundaries.
2. **Jinja2→nunjucks byte parity** (whitespace control, filter edge cases):
   goldens catch every divergence; target is byte-identical, any residual
   cosmetic diff needs explicit owner sign-off (default: fix, not waive).
3. **claude-code headless under systemd** (no TTY; auth store): probed at
   T2 with a one-call unit test; fallback for the timer is `anthropic-api`
   (owner key) while investigating — the DAG doesn't care.
4. **qwen3.6:27b JSON discipline**: schema-validate + bounded re-prompts
   (existing failure-mode policy); 35b is on disk as fallback; acceptance
   is structural.
5. **Public dashboard shows provider variance**: C6 — the owner chose to
   publish all three exit runs; (b)'s local-model day appears on Pages as
   real data. Accepted deliberately; `run.json` makes the provenance of
   every published day inspectable.
6. **Pages URL changes on rename** (no redirect): T8 updates links
   deliberately; owner announces where relevant.
7. **DB migration**: integrity-check gate + backup copy before move; junk
   siblings dropped consciously.
8. **Scope creep via settings UI**: C5 default is one endpoint + one
   drawer; run-log viewer and richer config are Phase D.

## File map (new/changed)

- `frontend/packages/ai/**` (new)
- `engines/nunc-fluens/pipeline/**` (new; includes prompts/, schemas/,
  goldens/, systemd/)
- `engines/nunc-fluens/design/**` (new: imported spec corpus —
  sourcedata-layout.md, scheduled/, the DAG-relevant skills/ specs — with
  provenance headers; the port's source of truth)
- `engines/nunc-fluens/app/**` (deleted at T12)
- `engines/nunc-fluens/INTEGRATION.md` (rewritten: direction reversal +
  the stale `engines/news` paths fixed)
- `gate/src/**` (C5 config endpoint) · `frontend/nunc-stans-formans/**`
  (world settings drawer) · `tools/build-world.ts` + `tools/lib/data-dir.ts`
  · `justfile` (news-daily, news-schedule, news-link, news-migrate-db)
  · `.github/workflows/*` (news job: exclusions removed at T1, pytest→vitest
  at T12) · `design/naming.md`, v1 plan (in-place updates at T12)
  · `design/stories/S-3.md`, `S-4.md` (new) ·
  `design/verification/phase-c.md` (new)

## Tasks

### Task 0: Preflight — DONE 2026-07-05
- [x] Branch `newstack` off `dev`; upstream tip `~/news` 9e86e01 recorded,
      subtree diff verified clean (src/skills/tests all identical).
- [x] Spec corpus imported to `engines/nunc-fluens/design/` (44 files:
      scheduled 10, skills 32, ADR 2, sourcedata-layout) + provenance
      README (commit 749fc08).
- [x] INTEGRATION.md stale `engines/news` paths fixed (b80a414).

### Task 1: Golden-master harness (before any port) — DONE 2026-07-05
- [x] Fixture days: 2026-07-03/04/05 + Sunday 2026-06-28 (weekly chain);
      DB range 06-22..28; inputs staged to `pipeline/goldens/input/`
      (11 MB) by `capture.ts stage`.
- [x] Oracle capture (`capture.ts run`): 32 rendered md (all 29 with a
      committed twin byte-match history), normalized DB dump, 4 export
      JSONs, gate exits all 0 (133e795). Volatile-field normalization:
      ISO timestamps, capture-day tokens, work-path.
- [x] Full pytest suite restored: `stage-ci` stages fixture data
      (+ 16 historical predictions.json days for the retired
      rename-future-titles tests); local run 133 passed / 1 skipped /
      0 excluded; CI news job exclusions removed.

### Task 2: packages/ai v0 — code DONE 2026-07-05 (probe open)
- [x] Package `nunc-ai` at `frontend/packages/ai` (workspace auto-joins
      via `frontend/packages/*`): types + capabilities; providers
      `anthropic-api`, `ollama`, `mock` (+ `forbid` for replay);
      runtime `claude-code` (headless spawn, JSON envelope, NS_CLAUDE_BIN,
      timeout + retry). Commit 4c0a4d2.
- [x] `SearchSource` registry: adapters `brave`, `searxng`, `tavily`,
      `perplexity` (env-keyed, shared result shape; fake-fetch unit
      tests — live smoke happens when S-3 exercises real keys).
- [x] Goal-verify config plumbing (off) + run-log JSONL writer.
- [x] 12 unit tests green (`pnpm --filter nunc-ai test`); typecheck green.
- [x] Headless probe (risk 3): owner installed + logged in the CLI in
      WSL (`~/.local/bin/claude`, not on non-login-shell PATH — the
      systemd unit will set PATH or NS_CLAUDE_BIN). `claude -p
      --output-format json` verified 2026-07-06: envelope `{result,
      usage}` parses exactly as the T2 runtime expects. systemd-launched
      verification remains at T9.

### Task 3: Pipeline scaffold + data moves — DONE 2026-07-06
- [x] Package `nunc-fluens-pipeline` at `engines/nunc-fluens/pipeline/`
      (workspace member; bin `nunc-fluens`: link/status/migrate-db/
      validate, `run` stubbed until T5). Config resolution extracted to
      `tools/lib/data-dir.ts` (tools/data-dir.ts is a thin wrapper,
      behavior verified identical); `news_repo` config key + NS_NEWS_REPO
      + `just news-link/news-status/news-validate/news-migrate-db`.
      Commits 3b3db80, 4fb00a1, 944f94a.
- [x] `sourcedata_schemas.py` ported one-to-one to
      `pipeline/src/schemas/sourcedata.ts` — **hand-rolled validators,
      not zod/ajv** (deviation, recorded: the oracle deliberately avoids
      a schema lib; porting its helpers keeps error-message parity,
      asserted by tests). 9 canonical file schemas; self-test parses +
      round-trips every canonical file of every fixture day (EN +
      locales); live `just news-validate 2026-07-04` = 24 files, 0
      failures. 14 tests green.
- [x] `migrate-db` executed for real: `~/news/app/data/analytics.sqlite`
      → `~/nunc-stans-data/world/analytics.sqlite` (30 937 088 bytes,
      integrity_check ok both sides, junk siblings excluded, re-run
      backs up). Upstream copy stays until the T9 cutover; INTEGRATION.md
      carries the interim note.

### Task 4a: Deterministic port — render chain — DONE 2026-07-06
- [x] nunjucks over the verbatim `.j2` templates; `render-news-md`,
      `render-future-prediction-md`, `post-write-integrity` (all six
      kinds), `lint-markdown-clean`. **All 32 golden renders
      byte-identical**; lint/pwi gate exits match; 63 pipeline tests
      green (96a8aa2, 77212a5). Oracle warts preserved deliberately:
      `indent_block` appends `\n` even to single-line input, the fil FP
      ai-notice carries a trailing newline the news copy lacks, and
      Jinja2's empty-list falsiness is shimmed (nunjucks uses JS
      truthiness). Fixture-drift lesson recorded: `capture.ts stage`
      and `run` always travel together. CI gitignore fix in-between:
      the engine's unanchored data-path ignores had swallowed the
      committed golden report/FP fixtures (772c887).

### Task 4b: Deterministic port — DB chain — core DONE 2026-07-06
- [x] `db/` (schema apply + a dump serializer shared by capture and
      pipeline — REAL formatting differs across libsqlite3 versions, so
      one serializer dumps both sides; round-trip proof green). 620568b.
- [x] `ingest-sourcedata` (predictions/needs/bridges/readings + locale
      fan-in), ingest core (idf theme matching, upserts, LCS
      match-or-create — no fastembed, matching the capture env),
      `commit_need`, glossary extract + seed (yaml dep), `timewindow`,
      `score` + `analytics/{scoring,windows}`. **Parity gate green: the
      full 7-day TS rebuild reproduces the oracle's normalized dump
      byte-for-byte** (53f2ed7, 16a3f36). Oracle determinism fix landed
      per the code-freeze rule (fixes live in the monorepo copy):
      `_idf_score` sums over sorted tokens — exact rational theme ties
      exist on the live corpus and were previously broken by
      hash-seed-dependent float ordering; capture pins PYTHONHASHSEED=0.
- [ ] Deferred into T4c/T5 where their consumers land: legacy md parsers
      (`news_parser`, `prediction_parser` — only if `run-update-pages`
      needs the markdown rebuild path), `glossary_link`,
      `validate-glossary-terms` form checks, `daily-flow-check`,
      `post-update-validation`.

### Task 4c: Deterministic port — export + gates + weekly — export core DONE 2026-07-07
- [x] `export.py` ported (scope graphs with evidence/bridges/needs/
      readings detail, mix merge, glossary, manifest) — **all five
      export JSONs parsed-equal against the goldens** (ac8106d,
      1714daf). Two recorded gates-of-comparison: JSON numbers compare
      parsed (python repr floats vs JS), and ring-layout x/y round to
      9 decimals (libm-vs-V8 sin/cos ULP). The export-side set-order
      nondeterminism got the same sorted-sum fix as ingest (oracle +
      TS + goldens recaptured; oracle pytest still 133).
- [x] Four step gates ported with golden output parity (114bb2c):
      `daily-flow-check`, `post-update-validation`,
      `check-topic-coverage`, `citation-restriction-check`. In passing,
      defused a goldens time bomb: capturing on a UTC day that IS a
      fixture day lets the capture-day token clobber real date strings
      (the corpus was captured on 2026-07-05, a fixture day).
      `capture.ts` now refuses colliding runs, gate reports skip the
      capture-day rule, and parity tests self-skip via
      `goldenCaptureCollision` until the corpus is **recaptured on a
      non-fixture UTC day (≥ 2026-07-06) — required next session**.
- [x] Remaining items ported inside the T5 orchestrator work
      (2026-07-06): `run-update-pages` (the T5 `update-pages` step),
      `validate-glossary-terms` + `define-glossary-terms` (daily-chain
      live steps; skipped under replay/dry-run — the golden capture
      never ran them, they were conversational-orchestrator calls
      upstream), `apply-schema-edit` (C8 DB rows, manual default),
      `weekly-maintenance` (full select/judge/apply/validate).

### Task 5: Orchestrator — core DONE 2026-07-05 (Sunday chain open)
- [x] DAG runner (`src/orchestrator/dag.ts`): DOW plan,
      artifact-presence replay/resume, DRY_RUN, `--only`; `run.json`
      manifest (S-3's provider/search record). CLI `nunc-fluens run
      [--date|--replay|--dry-run|--only]` wired (ef921a0).
- [x] Steps for the Mon–Sat chains as typed defs; generic LLM machinery
      (prompt = frozen skill spec + framing, schema validation, one
      re-prompt, replay-from-stored-artifact); readme link-routing
      check; `build_evidence_reverse` ported (misfiled as one-off at
      T1 — it runs daily via `cli update`).
- [x] **E2E gate green: orchestrator replay of golden 2026-06-27**
      (news+fp chains, zero LLM calls) — renders byte-match, DB effect
      identical to the golden dump. Deviations recorded in-code:
      glossary post-render (capture order), citation check on rendered
      md, update-pages = score+export+evidence-reverse on the
      persistent DB (full-rebuild retired), publish = plain git
      (bindfs workaround host-specific), replay skips the second
      live-incremental ingest pass.
- [x] Sunday chain live paths DONE 2026-07-06 (132 tests green; replay
      E2E unchanged). 4_weekly_memory: dormant tier transitions are
      deterministic code (the exact algorithm the oracle documented in
      the dormant-20260705.md preamble; interval decoded from the
      next-ping weekday); only entrant signal extraction stays LLM.
      5_weekly_theme_review: 3-time-state snapshot (+ taxonomy.json as
      the C8 rollback target, retention 5 + index regen), deterministic
      §2.1 pain-point analysis feeding the proposal LLM step,
      apply-schema-edit against DB rows (manual default;
      NF_SCHEMA_EDIT_MODE=auto opts in; ops: rewrite-description / add /
      promote-candidate / log-only; rename/merge/split refused pending a
      C8 design pass). 6_weekly_maintenance: Step 0 SQL port (merge
      proven parsed-equal vs the committed 06-28 file), per-candidate
      judge (≤6 pool, resumable artifacts), Step 2 apply (stale
      reasoning/bridge → DB columns; needs/readings deltas recorded as
      artifacts, escalated — recorded deviation), Step 3 validation.
      Glossary define/validate live steps landed in the daily chain.
- [ ] Live-mode plumbing check: `node` refuses to strip types inside
      node_modules, so the CLI's runtime `import('nunc-ai')` needs a
      launcher fix (tsx devDep or a tiny build) — resolve with T9.

**Port-time oracle findings (fixed in the TS port per the oracle
discipline, upstream untouched):**

1. **Upstream auto-apply was a silent no-op for 6+ Sundays:**
   `apply_schema_edit.py` only parsed `1.`-numbered recommendations, but
   proposals moved to `### Action N:` headings — zero ops parsed, exit
   0. theme-review-20260705.md itself documents the two never-applied
   rewrite blocks. The TS parser accepts both forms and the proposal
   validator refuses documents that parse to zero operations. The two
   pending rewrites (disclosure sharpening + cloud-vs-local widen) will
   finally land on the first live Sunday with auto mode (or via a
   deliberate manual apply).
2. **Dormant-id type mismatch:** `weekly_maintenance.py` compared the
   snapshot's short ids (`YYYYMMDD-i`) against sha prediction ids —
   dormant exclusion never fired; the 90d health check would have
   warned on every dormant row from mid-July on. TS resolves short ids
   via the committed predictions.json (origin date + 1-based index).
3. **Spillover queue intro duplication:** the oracle's section-preserving
   rewrite re-appended the intro paragraph weekly (visible in the live
   queue.md). TS keeps one intro.
4. **Spec corpus gaps found:** `memory-policy.md` was missing from the
   T0 import (added, upstream af344f1); `6_weekly_maintenance.md` is
   head-truncated on disk upstream (starts mid-fence; `design/` is
   gitignored upstream so no history exists) — the Step 0 selection was
   ported from `weekly_maintenance.py` directly, which is authoritative
   anyway.

### Task 6: Replay mode (S-4 substrate) — DONE 2026-07-05
- [x] `nunc-fluens run --replay`: every LLM step sources its stored
      artifact (missing ⇒ hard fail; `ai` is null so no call path
      exists). E2E proofs: weekday 06-27 and **Sunday 06-28 incl. the
      weekly chain** replay to byte-identical renders and the exact
      golden DB state (80f0fb2). S-4's diff report = run the replay on
      the real checkout and show `git status`: only `run.json` may
      change (the allowed-metadata list).

### Task 7: Settings surface (S-3 substrate) — DONE 2026-07-05
- [x] Gate config API `GET/PUT /api/world/news-config` (atomic write,
      unknown-field rejection, pair validation, 503 without a store;
      `--data-dir` flag wired through `just up`) + 2 integration tests
      (c805e0a, f600b94). Formans world view gains the settings drawer
      (runtime + search×model pair — 0204580); the pipeline CLI reads
      the same file at run start and stamps the pair into `run.json`.

### Task 8: Remnant split
- [ ] Re-diff subtree; then in `~/news`: remove `app/` + orchestration
      docs superseded by the pipeline (README pointer to the monorepo);
      keep data dirs, docs/ Pages, reference/, references.txt.
- [ ] Owner: rename GitHub repo → `nunc-fluens` (+ local dir
      `~/nunc-fluens`); `just news-link` re-point; deliberate link-update
      sweep (Pages URL changed, no redirect).
- [ ] Rewrite INTEGRATION.md (monorepo executes; remnant is data+publish;
      resync recipe retired).

### Task 9: Scheduling + cutover
- [ ] systemd user units + `just news-schedule`; cron fallback doc.
- [ ] Agree cutover date; stop the Cowork routine; timer-launched run
      lands a real day end-to-end (this is exit run (a)).

### Task 10: Stories S-3 / S-4 — write and execute
- [ ] Write `design/stories/S-3.md`, `S-4.md` (concrete steps, allowed
      replay diffs enumerated).
- [ ] Execute S-3: settings drawer native→external+local, next run
      completes, `run.json` records the pair. Evidence saved.
- [ ] Execute S-4: network+LLM disabled replay → identical dashboard
      modulo metadata. Evidence saved.

### Task 11: Exit runs + portability
- [ ] (a) timer-launched claude-code day — published (done in T9).
- [ ] (b) ollama qwen3.6:27b + external search — published as that day's
      real run (C6).
- [ ] (c) replay — published (content no-op; the run manifest/evidence
      lands). All three `run.json`s archived in the verification doc.
- [ ] S-10 re-run (container; native Windows unaffected but re-checked);
      CI 3-OS green on `newstack`.

### Task 12: Retire Python + close
- [ ] Delete `engines/nunc-fluens/app/`; CI news job → vitest; root README
      + engine README updated.
- [ ] **Shrink the goldens (owner decision 2026-07-06):** the real-content
      corpus exists only to validate the port against the oracle during
      this phase. Once the exit runs and stories pass, replace
      `pipeline/goldens/` with minimal synthetic fixtures (schema-shaped,
      no personal content) and drop the real corpus from the monorepo —
      its home is the owner's production `nunc-fluens` remnant. The
      redistributable repo must not carry one user's editorial data.
- [ ] `NEWS_WORLD` grep-clean; naming.md rows updated (~/news → executed);
      v1 plan in-place updates (D3/D4 executed; §2.2 layout note).
- [ ] `design/verification/phase-c.md` (stories, exit runs, goldens
      summary, deviations); merge `newstack` → `dev`; owner push + PR gate.

## Post-C refactoring backlog (owner decisions 2026-07-06 — NOT in phase)

Recorded here so the decisions survive; execution is a separate effort after
T12 (single implementation, synthetic goldens — rename cost is minimal then).
In-phase preparation only: path names centralized in one constants module
(`pipeline/src/world-paths.ts`) so each rename is one constant + `git mv`.

1. **Remnant repo layout** (after the split + rename; the remnant is free to
   diverge from the old `~/news` shape once nothing shares code with it):
   - `report/` → `daily-news/`; `future-prediction/` keeps its name.
   - `daily-news/`, `future-prediction/`, `memory/`, `reference/` move under
     `data/`.
   - The published dashboard leaves `docs/` (the name was a GitHub Pages
     branch-deploy constraint, root-or-`/docs` only): dashboard moves to the
     repo root or, more likely, Pages switches to **Actions-based deploy** so
     the publish root is arbitrary. `docs/` then becomes what it says:
     documentation for `nunc-fluens` itself. Pages deploy-mode switch is part
     of this item.
2. **Engine `design/` reorganization:** `engines/nunc-fluens/design/` mixes
   true design docs with `scheduled/` task specs and `skills/` (imported as
   the port's source of truth at T0). After T12 the specs that became code
   are history, not living design — re-home or archive them; scheduled task
   specs and operational skills should not sit under `design/`.
3. **Locale model:** hardcoded en+ja/es/fil does not scale and personal use
   does not need 4 languages. Target: **EN + an owner-configured set of
   languages**; translation/render/README fan-out runs only over the
   configured set. This is a behavior change (out of port scope); natural
   home is the news-config settings surface (per-user config), after C.
   In-phase code keeps the locale list as a single constant to ease this.

## Exit criteria (phase closes when all hold)

1. Runs (a) claude-code / (b) ollama+external / (c) zero-LLM replay each
   produce a valid dashboard; (c) identical modulo run metadata.
2. Golden suite green (byte-identical renders, row/export parity); the
   122-test intent ported; CI news job runs the TS suite with no
   exclusions, 3-OS matrix green.
3. S-3 and S-4 executed with evidence; S-10 re-run passes.
4. The timer (not a conversation) started run (a); the Cowork routine is
   retired.
5. `analytics.sqlite` lives in `<data store>/world/`; `NEWS_WORLD` is gone;
   `newsRepo` config governs; Formans world view works (and empty-states
   without it).
6. `~/news` → `nunc-fluens` remnant (data+publish, no app/); INTEGRATION.md
   rewritten; Python deleted from the monorepo.
7. `design/verification/phase-c.md` written; `newstack` merged to `dev`;
   owner pushed; PR gate per workflow.

## Self-review (done at write time)

- The v1-plan Phase C paragraph is fully covered: orchestrator-as-code ✓,
  packages/ai ✓, golden-master port ✓, subtree sync ✓ (verified clean
  today), analytics.sqlite move ✓, remnant split + rename ✓, scheduler with
  no conversational step ✓, exit runs (a)(b)(c) ✓, S-3/S-4 ✓.
- Constitution: world stays News's scope (§6); sourcedata remains in the
  News-side repo (SoR), the data store holds only the rebuildable cache —
  consistent with §2.9 and §11. No self-scope surface changes.
- F-rules: no remote for self/ untouched; the pipeline never writes
  self-scope (F3 irrelevant here but preserved by construction).
- Deviations from the v1 plan: none structural. Additions: the gate config
  endpoint (C5 — extends the B1 gate deliberately, recorded), prompts/spec
  corpus imported under the engine (the plan's "steps = functions" needs
  the specs in-repo).
