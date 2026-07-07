# Post-C Refactoring Plan — product data layout, prompts re-home, locale config, ledger items

**Goal:** execute the four-item post-C refactoring backlog recorded in the
Phase C plan (owner decisions 2026-07-06, `2026-07-05-phase-c-plan.md`
§"Post-C refactoring backlog"): (1) the product's own data-checkout layout
(`report/` → `data/daily-news/`, the publish quartet under `data/`, the
dashboard out of `docs/`), (2) the engine `design/` reorganization (runtime
prompts out of the frozen spec corpus), (3) the locale model (EN + an
owner-configured set), and (4) the owner's upstream refactor-ledger items
(subtheme-layer removal, `glossary_audit` 30-day retention,
`cleanPredictionTitle` prefix-token sharing, LIST-view "all scopes").
Exit: full monorepo suite green (pipeline vitest, gate cargo, formans,
nunc-ai, `just check`), synthetic goldens regenerated in the new shape with
per-item explained diffs, and old-shape compatibility proven where the
redirection requires it (view side reads the owner's `~/news` shape forever;
run side migrates sandboxes on creation).

**Provenance:** the four backlog items and their target shapes are owner
decisions (2026-07-06). The decisions below marked **[proposed]** are new
judgment calls made to execute those items; they are recorded here for
review at the PR gate. Everything runs on branch **`phase/post-c`** off
`newstack` (CI covers `phase/**`); owner merges `newstack` → `dev` first,
then this branch follows the normal PR flow.

**Grounding:** a 6-area recon map with file:line references plus an
adversarial gap-check was produced before this plan (2026-07-06, this
session). Key load-bearing facts it established:

- All LLM prompts are read **at runtime** from `engines/nunc-fluens/design/`
  (`core.ts:87-105`; 16 files: 12 skills, 2 writer-rules, `3_daily_briefing`,
  `memory-policy.md`). The vitest suite never exercises these reads —
  replay short-circuits before prompt building — so a bad move breaks the
  next live run, not the suite. The reorganization therefore ships with a
  prompt-resolution test.
- `src/export/export.ts` contains four NUL bytes (offsets ~48934, 49037,
  53620, 53723) that make grep/ripgrep treat it as binary — grep-based
  "no references remain" sweeps silently skip it. The bytes are stripped
  first, as a hygiene commit.
- The subtheme layer is fully inert: no `INSERT INTO subthemes` exists,
  every write binds `subtheme_id = NULL`, golden dump has 0 rows.
- `schema.sql` is a first-boot seed only (`CREATE IF NOT EXISTS`); there is
  no migration runner. Existing DBs (main store, sandboxes) keep whatever
  shape they were born with.
- `daily-flow-check.ts` bypasses the `world-paths.ts` constants with literal
  `memory/…`, `app/data/…`, and `docs/index.html`/`docs/assets/*` strings;
  `theme-review.ts` and `export.ts:132` have similar bypasses — the rename
  must fix these, not just the constants.
- The dashboard source is git-tracked in this repo at
  `engines/nunc-fluens/docs/` (index.html, assets/app.js, styles.css),
  byte-identical today to the copy build-world stages from the owner's
  checkout.

## Design decisions

| # | Decision | Choice |
|---|---|---|
| P1 | Layout rename scope (owner-decided targets; boundaries [proposed]) | Publish quartet moves: `report/` → `data/daily-news/`, `future-prediction/` → `data/future-prediction/`, `memory/` → `data/memory/`, `reference/` → `data/reference/`. Exports move `docs/data/` → `data/exports/` (snapshots under `data/exports/snapshots/`); snapshot retention archives `docs/archives/snapshots/` → `data/archives/snapshots/` (gitignored in instances). `README*.md` and `references.txt` stay at the checkout root; README links point into `data/daily-news/…`. **`app/sourcedata/` and `app/data/` do NOT move** — `source_files.path` stores `app/sourcedata/…` rel paths that participate in row identity; moving them is a DB-content migration with its own risks, deferred as a recorded follow-up. |
| P2 | Dashboard becomes product code [proposed] | `engines/nunc-fluens/docs/` (dashboard) → `engines/nunc-fluens/dashboard/`; the engine's `docs/` is freed to become real engine documentation. Instances carry **data only** (`data/exports/`); migrated sandboxes drop their `docs/` dashboard copies. `tools/build-world.ts` stages the dashboard **from the engine** and the data from the checkout (probe `data/exports/`, fall back to `docs/data/` for old-shape checkouts). `dashboard-integrity` and `daily-flow-check`'s dashboard-hygiene checks re-point at engine dashboard presence + `data/exports` manifest shape. Pages deployment is the deployer's concern post-fork (redirection): a deploy recipe note lands in engine docs, no Actions workflow in this repo. |
| P3 | Old-shape compatibility split [proposed] | **View side supports both shapes** (the product guarantee covers the owner's news-shaped `~/news` forever): build-world probes new then old; `link` sanity warning probes both. **Run side is single-shape (new):** `nunc-fluens sandbox` migrates old-shape clones at creation (`git mv` quartet + exports, remove instance dashboard files, update instance `.gitignore`, one "layout migration" commit); a new `nunc-fluens migrate-layout <dir>` exposes the same routine for existing sandboxes; `requireSandbox` refuses old-shape instances with a message naming it. Replay of committed old days keeps working because `git mv` moves the dated artifacts with the tree. |
| P4 | Prompts re-home (item 2) | The 16 runtime-read files move to `engines/nunc-fluens/pipeline/prompts/` preserving subpaths (`prompts/skills/*.md`, `prompts/scheduled/*.md`, `prompts/memory-policy.md`); `designDir()` → `promptsDir()` (`core.ts:87-89`, one path change). `memory-policy.md` moves wholesale (its `'## 2. Taxonomy maintenance'` heading is a prompt-split marker — content untouched). The other 30 corpus files move to `engines/nunc-fluens/design/archive/` with the README rewritten as a provenance note; ADR-001/002 and `sourcedata-layout.md` stay as living design. The moved prompts shed the "verbatim frozen" rule (the freeze rationale expired at T12) and become normally-editable behavior files. A resolution vitest asserts all 16 loads resolve. **Port-gap fix ridealong:** `locale-fanout-calques.md` (mandated by `locale-fanout.md` §36, never loaded by the TS port) moves to `prompts/` and is appended to the locale-fanout prompt. |
| P5 | Locale model scope + default (item 3) [proposed] | Config key `locales: string[]` in news-config, validated as a **subset of {ja, es, fil}** — the schema is column-per-locale (`*_ja/_es/_fil` + a CHECK on `source_files.locale`), so arbitrary new locales are a schema migration, out of scope (recorded follow-up). **Default = `["ja","es","fil"]`** (behavior-preserving; the owner shrinks the set via the drawer). The **effective** set is snapshotted into `run.json` (`RunManifest.locales`); replay prefers run.json's set and falls back to enumerating `sourcedata/locales/<date>/` for pre-refactor days. Gates (`daily-flow-check`, `post-update-validation`, `dashboard-integrity`) take the set as an explicit parameter defaulting to ja/es/fil (they are also called outside `RunCtx`). `manifest.locales` = `['en', …configured]`; dashboard locale buttons render from the manifest (hardcoded-4 fallback). Non-uniform fan-outs (glossary `_ja/_es/_fil` fills, export bags, README suffix literals) derive from the set. Gate `NewsConfig` gains `locales` (deny-unknown means gate+drawer+pipeline ship together — same repo, noted); invalid values are a 422. Drawer gains three checkboxes. |
| P6 | Subtheme removal depth (item 4a) [proposed] | **Full removal for fresh DBs:** `subthemes` table + index, `subtheme_id` columns on `prediction_scope_assignments`, `evidence_scope_assignments`, `topic_daily_activity` (+ its CHECK and partial index), the `'subtheme'` member of `graph_node_layouts.node_type` CHECK and `activity_level` CHECK, both views' subtheme joins, §14 headers. Code: export queries/node-emission/vestigial keys (`export.ts`), INSERT column lists (`score.ts`, `ingest-core.ts`), `TAXONOMY_TABLES` (`apply-schema-edit.ts`), dashboard subtheme branches (18 sites in `app.js`). **Existing DBs are left vestigial** — no migration runner exists, every remaining write is NULL-safe against the old CHECKs, and no code reads the table afterwards; a physical drop would need a 12-step rebuild for zero data. Old taxonomy snapshots with a `subthemes` key are ignored by `restoreTaxonomy` (iterates `TAXONOMY_TABLES`) — acceptable, table empty everywhere. Goldens regenerated (`synthesize.ts all`) in the same commit; export diff = key removals only (values were always null). |
| P7 | glossary_audit retention semantics (item 4b) [proposed] | Prune rows older than 30 days **except semantic pass/fail rows**: `DELETE FROM glossary_audit WHERE checked_at < date(:today,'-30 days') AND NOT (check_type='semantic' AND verdict IN ('pass','fail'))`. Rationale: the semantic anti-join (`listPendingSemantic`) exists to avoid re-judging terms (the ledger's own §2.6 cost concern) — pruning those rows would re-queue every term for the LLM judge each month. Form/dedupe rows and semantic `warn`s are size hygiene and prune freely; `theme-review`'s repeat-warning input becomes a rolling ~30d window (aligned with "recent pain" intent, recorded behavior change). Runs first in `runValidateGlossary` (the daily `glossary-validate` step — replay/dry-run-skipped, so parity-safe by construction), keyed on the passed `todayIso`, never `CURRENT_TIMESTAMP`. |
| P8 | Prefix-token sharing (item 4c) | Single source `pipeline/src/export/prefix-tokens.json`; `short-label.ts` builds its regexes from it (behavior-identical); `runExport` emits it to `<exports>/prefix-tokens.json`; the dashboard fetches it at init and rebuilds `cleanPredictionTitle`'s regexes, keeping the inline list as the synchronous fallback (no-build static app; file:// safety). The known drift (`no-negocio`, full `no-tecnología` forms missing in app.js) is reconciled — an intended visible change for some legacy titles. The new file joins the export-parity set (goldens regenerated anyway). `lint-markdown-clean`'s violation-detector regexes stay independent (different purpose: detect, not strip). |
| P9 | LIST "all scopes" mechanics (item 4d) [proposed] | `#list-scope` gains `value="all"` implemented as an alias of the **mix graph** — `buildMixGraph` already unions tech+business deduped by node id with each node's true `scope_id` preserved, so "all" = mix with the scope column already correct per row. No double-count semantics. The NEWS sibling (`#news-scope`) is unchanged (recorded follow-up if wanted). No JS test harness exists for the dashboard; verification is manual via the staged world view. |
| P10 | Engine-root hygiene (ridealong) [proposed] | Delete `engines/nunc-fluens/reference/` (6 files — the owner's real editorial policy/topics; same personal-data class T12 removed; instances carry their own copies, goldens carry synthetic ones) and the imported `README.{ja,es,fil}.md` snapshots; rewrite `README.md` as a real engine README (what the pipeline is, how to run it, lineage pointer to INTEGRATION.md). Fix the stale `stage-ci` comment in `engines/nunc-fluens/.gitignore` and align its entries with the new layout. Untracked on-disk leftovers (`app/sourcedata/` — real data, `report/`, `memory/`, pycache dirs) are **left in place for the owner** to remove. |

## Sequencing note (live timer)

`~/nf-sandbox` has a user systemd timer (06:30) running `cli.ts run` from
this working tree. After T6 lands, that sandbox is old-shape and the guard
in `requireSandbox` will refuse it with a clear message naming
`nunc-fluens migrate-layout`. That failure is clean (no partial writes) but
the owner should either run `migrate-layout ~/nf-sandbox`, recreate the
sandbox, or stop the timer until review. Flagged in the close-out summary.

## Tasks

### Task 1: Plan + branch — DONE 2026-07-06
- [x] Recon map (6 parallel readers + adversarial gap-check) — this session.
- [x] This plan committed on `phase/post-c` (design:, 59b7f0a + 8c34ee0).

### Task 2: NUL-byte hygiene (pre-req) — DONE 2026-07-06 (3413823)
- [x] Strip the four NUL bytes from `src/export/export.ts` (they were
      literal NUL separators in template strings — replaced with `\0`
      escapes, behavior identical); suite-neutral (121 tests). Grep now
      sees the file. (T6 later found and fixed the same disease in
      `weekly/maintenance.ts`.)
- [x] Ridealong: raise the `db-dump.test.ts` schema-objects test timeout —
      it exceeds vitest's 5s default under full-suite parallel load
      (observed 5117 ms flake at baseline, passes in isolation).

### Task 3: Prompts re-home (P4 — item 2) — DONE 2026-07-06 (6404b92)
- [x] `git mv` 17 runtime files (16 + calques) → `pipeline/prompts/` (R100
      renames); `designDir()` → `promptsDir()`; calques appended to the
      locale-fanout spec via `skillSpecForPrompt` (covers all 3 call
      sites); 25 retired files → `design/archive/` + README provenance
      rewrite; ADRs + `sourcedata-layout.md` stay living.
- [x] `test/prompts-resolution.test.ts` (18 tests): all loads resolve
      non-empty; memory-policy split marker; calques-append assertions.
- [x] Link sweep: INTEGRATION.md, code comments. (schema.sql comment
      deferred to T5's regen by golden coupling — landed there.)

### Task 4: glossary_audit retention (P7 — item 4b) — DONE 2026-07-06 (8312cc4)
- [x] `pruneGlossaryAudit(db, todayIso)` in `validate-glossary-terms.ts`,
      called first in `runValidateGlossary`; count surfaced by the step.
- [x] 6 unit tests: 30d boundary both timestamp forms, semantic pass/fail
      exemption, warn pruning, count, anti-join preservation, integration.
      Zero golden changes (verified).

### Task 5: Subtheme removal (P6 — item 4a) — DONE 2026-07-06 (e2acf9f + 5d59513)
- [x] Schema + export + ingest + weekly snapshot + dashboard removals per
      P6 (28 files, −791 lines); goldens `all` regen in the same commit;
      export diff = null-key removals only; activity_level kept
      theme-only (minimal DDL diff, activity ids stable); runtime prompts
      swept of subtheme instructions (5d59513).

### Task 5b: Prefix-token JSON + LIST all-scopes (P8/P9 — items 4c/4d) — DONE 2026-07-06 (08b9b63)
- [x] `prefix-tokens.json` single source (readFileSync pattern, schema.sql
      precedent) + export emit + dashboard fetch with reconciled inline
      fallback; joined the export-parity set; goldens regen.
- [x] `#list-scope` gains `all` (mix alias; lookupProbeNode + syncFromPrefix
      wired); manual staged-view check recorded as owner follow-up in the
      verification doc.

### Task 6: Layout renames (P1/P2/P3/P10 — item 1) — DONE 2026-07-06 (75a8baf + 9879d82 + aa2d19b)
- [x] `world-paths.ts` rewritten: `data/…` rel constants + `exportsDir()` +
      OLD_* detection constants + `detectShape()`.
- [x] Every bypass literal fixed — incl. two found beyond the recon map:
      `checkDashboardHygiene`'s literal docs/ asset checks (now
      exports-hygiene) and a NUL-byte-masked `memory/maintenance` literal
      in `weekly/maintenance.ts`.
- [x] README prompt + post-write-integrity regexes → `data/daily-news`;
      readme-checks followed by construction.
- [x] Publish add-list, instance `.gitignore` translation, ledger text.
- [x] `sandbox` migrates old-shape clones; `migrate-layout <dir>` CLI;
      `requireSandbox` refuses old-shape (and, post-review, mixed) trees;
      systemd untouched. Unit-tested on synthetic old-shape git repos.
- [x] Dashboard `git mv` → `engines/nunc-fluens/dashboard/`; engine
      `docs/` = real docs home (README + instance-deploy note).
- [x] `tools/build-world.ts` stages the engine dashboard + probes
      `data/exports` → falls back to `docs/data`; proven against the real
      `~/news` (243 headlines, fallback) and the synthetic new-shape tree
      (probe). (tool: 9879d82)
- [x] Engine-root hygiene (P10): reference/ + README.{ja,es,fil}.md
      deleted, README rewritten, .gitignore cleaned.
- [x] Goldens: input tree R100-renamed + `all` regen; a dormant-pool
      fixture row added so dormant styling is regression-visible; suite
      green (150). Deliberate extra: prompt corpus path-shape sweep
      (aa2d19b) so live prompts and gates agree.

### Task 7: Locale model (P5 — item 3) — DONE 2026-07-06 (4462527 + d4f39de + 1bd8f0e)
- [x] Pipeline: `resolveLocaleSet` + `replayLocaleSet` (run.json >
      locale-dir listing > default), RunCtx threading, every fan-out/gate/
      export bag/README suffix derived; 16 unit tests incl. EN-only and
      subset behavior; goldens byte-untouched (default trio preserved).
- [x] Gate: `locales` key, subset-of-{ja,es,fil} validation (422), tests.
- [x] Drawer: three checkboxes; explicit empty-array save.
- [x] Goldens: zero regen needed (verified per-commit).

### Task 8: Close-out — DONE 2026-07-06
- [x] Full suite green: pipeline 174/17 files, gate 10, ns 11, formans 16
      + build, nunc-ai 12, fourfive 24, `just check` ok; commit-scope ok
      on all 18 commits.
- [x] Adversarial review (6 reviewers + refute-by-default verification):
      11 findings → 1 refuted, 10 confirmed, 10 fixed
      (6e380df / 4e0b20d / 645912c / cd15979).
- [x] `design/verification/post-c.md` written (suite state, golden audit,
      review record, both-shape proofs, owner handoff).
- [x] naming.md checked (already current — redirection wording covers the
      fork); INTEGRATION.md updated in T6; owner handoff note in the
      verification doc.

## Risks

- **Goldens freeze trap:** `freeze` blesses current behavior. Rule: per
  item, run the suite against OLD expected first; only regenerate after
  targeted failures are each explained by the intended change; re-run green;
  diff-review expected/.
- **Live-run-only surfaces:** prompt loads and sandbox creation aren't
  covered by replay tests. Mitigations: resolution test (T3), migration unit
  test on a synthetic old-shape tree (T6).
- **Renames that half-land:** publish add-list existsSync-filters silently —
  a missed path means an artifact class stops being committed. T6 includes a
  publish-list unit assertion against the new constants.
- **Timer vs branch:** see Sequencing note.
- **grep blindness:** fixed at T2 before any sweeps.

## Exit criteria (all met 2026-07-06 except the CI-push half of 1)

1. ✅ Suite green everywhere (pipeline 174, gate 10, formans 16, nunc-ai 12,
   ns engine 11, fourfive 24, `just check`); ⏳ 3-OS CI green on
   `phase/post-c` after owner push.
2. ✅ Goldens regenerated in the new shape; every diff class traced to a
   decision (P1/P6/P8; P5/P7 zero-diff) in the verification doc.
3. ✅ Replay E2E (orchestrator-replay incl. Sunday chain) green in the new
   shape; migration routine proven by unit test on old-shape fixture trees.
4. ✅ View side proven on both shapes: build-world staged the owner-shape
   checkout (fallback, 243 headlines) and a new-shape tree (probe) —
   evidence in the verification doc.
5. ✅ `design/verification/post-c.md` written; owner handoff note lists:
   merge order (newstack → dev, then phase/post-c), `~/nf-sandbox`
   migration choice, deleted engine-root files for review.

## Self-review (done at write time)

- Every backlog item (1-4) maps to a task; every recon risk is either fixed
  in a task or recorded as a follow-up (app/sourcedata under data/; arbitrary
  locales; NEWS-view "all"; physical subtheme drop for old DBs).
- Constitution: no self-scope surfaces touched; commits stay area-scoped
  (`nf`/`tool`/`gate`/`fe`/`design`); FD-3.2/FD-7.4 unaffected (build-world
  references engine paths from tools/, which the boundary check permits).
- Redirection honored: nothing writes the real `~/news`; old-shape support
  is view-only; migration only ever touches disposable sandboxes.

## REDO 2026-07-07 (owner) — template/instance separation, not news-conformant renames

Owner review of the executed tasks rejected the framing: **what item 1
actually asked for was a clean separation of the app TEMPLATE from DATA
INSTANCES** — the executed work renamed paths while still conforming the
instance shape to the existing news checkout (keeping `app/sourcedata`,
creating instances only by cloning a news-shaped checkout). Corrections,
stated by the owner 2026-07-07:

- The product is a **different piece of software** from news. `~/nf-sandbox`
  was only a dev-time verification artifact — the owner will not update it
  again; news data comes over **at the owner's own timing via an import**
  (possibly AI-assisted), not by cloning.
- Instances live under **`engines/nunc-fluens/instances/<profile>/`**
  (gitignored; multiple profiles are expected). This amends FD-3.2's
  "data never inside the repo" for gitignored instance checkouts —
  CONTRIBUTING note required (owner decision 2026-07-07).
- Instance-ization was insufficient: `app/sourcedata` (and everything else
  news-era) belongs to the instance layout proper.
- Deletions are to be **proposed, not executed** — see the Deletion
  proposal below.

### V2 decisions (owner-approved in session, 2026-07-07)

| # | Decision |
|---|---|
| R1 | **Template**: the engine ships `pipeline/instance-template/` — directory skeleton + synthetic seed editorial files (news-topics.md, citation-restrictions.md, glossary.yml, …) + instance `.gitignore` + README seed. New CLI **`nunc-fluens init <dir>`** creates an instance from it (git init, skeleton, seeds, `initDb` store). |
| R2 | **Instance layout v2 (no `app/`)**: `data/{sourcedata, daily-news, future-prediction, memory, reference, exports, archives}` + `data/references.txt`; `README*.md` at the root (product face); `run.json` at `data/sourcedata/<date>/run.json`; runtime state in a gitignored `store/` inside the instance (analytics.sqlite, `runs/ai-runs.jsonl`, optional `news-config.json` override). |
| R3 | **Per-instance config**: the pipeline reads the instance `store/news-config.json` when present, falling back to the main store's (which the gate/drawer edit as defaults). A per-profile gate API is a recorded follow-up. `ai-runs.jsonl` moves into the instance store. |
| R4 | **`nunc-fluens import <news-shaped-src> <instance>`** replaces the clone+migrate machinery: copies a news-shaped checkout's data into the v2 layout (report→data/daily-news, …, app/sourcedata→data/sourcedata, docs/data→data/exports, docs/archives→data/archives, references.txt→data/references.txt), seeds the store DB from the source DB (integrity-checked), commits in the instance repo. Existing DB rows keep their `app/sourcedata/…` provenance strings (source_file_id = sha1(rel path), FK-referenced — new ingests write `data/sourcedata/…`; mixed provenance documented). |
| R5 | **Retired**: `sandbox` (clone) and `migrate-layout` commands (mapping absorbed into `import`); `requireSandbox` → `requireInstance` (init/import-born, v2 shape); `NS_SANDBOX` → `NS_INSTANCE`; systemd units/justfile updated (`news-init` / `news-import` / `news-daily <instance>`). |
| R6 | **Old-shape view support REMOVED** (owner): build-world reads an instance's `data/exports` only; the `docs/data` fallback and `detectShape` general plumbing go away (old-shape knowledge survives only inside `import`). The world view source config points at an instance. |
| R7 | **Goldens = init-born**: `synthesize.ts` builds its fixture instance through the real `init` routine + synthetic data (init is thereby tested); all path literals/tests move to v2 (`data/sourcedata` — hashed rel paths change wholesale; legitimate regen). |
| R8 | Deletion proposal below is a PROPOSAL — the owner decides and executes. |

### Deletion proposal (owner to approve/execute per item; nothing deleted by the assistant)

| Item | What | Why it can go | Note |
|---|---|---|---|
| D1 | `engines/nunc-fluens/design/archive/` (25 tracked files) | Port-source history; git history retains it | `git rm -r` when desired |
| D2 | `engines/nunc-fluens/INTEGRATION.md` | Lineage note can fold into the engine README/docs | fold, then delete |
| D3 | Engine-dir untracked residue: `app/` (~29 days real sourcedata + pycache), `memory/`, `references.txt` | Python-oracle-era working data; not part of the repo | owner `rm -rf` (real data — assistant won't); then the old-shape `.gitignore` entries can be swept |
| D4 | `~/nf-sandbox` + the 06:30 timer | Dev verification artifact; owner said it won't be updated | delete after v2 verification; re-point or disable the timer (`just news-schedule <instance>` / `systemctl --user disable --now nunc-fluens-daily.timer`) |
| D5 | `~/nunc-stans-data/world/analytics.sqlite` (+ `.bak-*`) | Phase-C dev-validation copy | KEEP if it will seed the first `import`; otherwise delete |

### V2 tasks

- [ ] V2-1 (nf): world-paths v2 (`data/sourcedata`, `data/references.txt`),
      instance-template/ + `init`, `import` (absorbs migrate-layout incl.
      archives carry + ignore translation), retire sandbox/migrate-layout,
      `requireInstance` + `NS_INSTANCE`, per-instance config/log resolution,
      flow-check DB probe → store, publish list + run.json path, goldens
      init-born + regen, tests overhauled.
- [ ] V2-2 (tool/design ride): build-world instance-only (R6), justfile
      recipes, systemd, CONTRIBUTING FD-3.2 amendment, naming.md,
      engine README/docs updates, `.gitignore` gains `/instances/`.
- [ ] V2-3: adversarial review over the v2 diff; fixes; verification doc
      update; owner handoff.
