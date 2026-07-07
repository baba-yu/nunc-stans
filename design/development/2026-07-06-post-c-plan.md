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

### Task 1: Plan + branch
- [x] Recon map (6 parallel readers + adversarial gap-check) — this session.
- [ ] This plan committed on `phase/post-c` (design:).

### Task 2: NUL-byte hygiene (pre-req)
- [ ] Strip the four NUL bytes from `src/export/export.ts` (byte-identical
      otherwise); prove suite-neutral (121 tests). Grep now sees the file.

### Task 3: Prompts re-home (P4 — item 2)
- [ ] `git mv` the 16 runtime files → `pipeline/prompts/`; `designDir()` →
      `promptsDir()`; wire `locale-fanout-calques.md` into the locale-fanout
      prompt; move the remaining corpus → `design/archive/` + README
      provenance rewrite; keep ADRs + `sourcedata-layout.md` under `design/`.
- [ ] New `test/prompts-resolution.test.ts`: all 16 loads resolve non-empty;
      the memory-policy split marker exists.
- [ ] Link sweep: INTEGRATION.md, code comments citing `design/skills|scheduled`.

### Task 4: glossary_audit retention (P7 — item 4b)
- [ ] `pruneGlossaryAudit(db, todayIso)` in `validate-glossary-terms.ts`,
      called first in `runValidateGlossary`; count logged by the step.
- [ ] Unit tests in `glossary-lifecycle.test.ts`: 30d boundary, semantic
      pass/fail exemption, warn-prune re-scoping. No golden regen expected.

### Task 5: Subtheme removal (P6 — item 4a)
- [ ] Schema + code + dashboard removals per P6; goldens `synthesize.ts all`
      in the same commit; suite green; export diff reviewed (key-removals only).

### Task 6: Layout renames (P1/P2/P3/P10 — item 1)
- [ ] `world-paths.ts`: new rel constants (`data/daily-news` etc.,
      `data/exports`, `data/archives/snapshots`) + old-shape constants for
      detection/migration; helper fns.
- [ ] Fix every bypass literal (daily-flow-check memory/app-db/dashboard
      literals; theme-review archive + commit paths; export.ts:132 dormant;
      steps.ts `'app/sourcedata'` stays by design (P1)).
- [ ] README window prompt + post-write-integrity regexes → `data/daily-news`
      links; readme-checks stays constant-derived.
- [ ] Publish add-list, instance `.gitignore` writing, citation-ledger text.
- [ ] `sandbox` migration + `migrate-layout` CLI + `requireSandbox` old-shape
      guard (P3); systemd/install.sh untouched (structure-only checks).
- [ ] Dashboard relocation `engines/nunc-fluens/docs/` → `dashboard/`;
      engine `docs/` becomes real docs home (README + deploy note).
- [ ] `tools/build-world.ts`: dashboard from engine, data probe
      new-then-old (tool: commit).
- [ ] Engine-root hygiene (P10).
- [ ] Goldens: synthesize writes the new shape; `all` regen; the 6 test
      files' literals updated; suite green.

### Task 7: Locale model (P5 — item 3)
- [ ] Pipeline: effective-set threading (RunCtx + run.json snapshot + replay
      fallback), fan-outs + gates + export bags + README suffixes derived;
      unit tests for subset/EN-only gate behavior (nf:).
- [ ] Gate: `locales` key + validation + tests (422 path) (gate:).
- [ ] Drawer: three checkboxes (fe:).
- [ ] Goldens: default set preserves bytes — regen only if gate-text changed.

### Task 8: Close-out
- [ ] Full suite: pipeline typecheck+test, gate cargo, formans, nunc-ai,
      engines/nunc-stans cargo, `just check`; commit-scope per commit.
- [ ] `design/verification/post-c.md` with evidence + explained golden diffs.
- [ ] naming.md / INTEGRATION.md consistency sweep; owner handoff note
      (timer/sandbox migration, merge order).

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

## Exit criteria

1. Suite green everywhere (pipeline, gate, formans, nunc-ai, ns engine,
   `just check`), 3-OS CI green on `phase/post-c` after owner push.
2. Goldens regenerated in the new shape; every diff class traced to a
   decision (P1/P5/P6/P8) in the verification doc.
3. Replay E2E (orchestrator-replay incl. Sunday chain) green in the new
   shape; migration routine proven by unit test on an old-shape fixture tree.
4. View side proven on both shapes: build-world stages the owner-shape
   checkout (fallback path) and a new-shape tree (probe path) — test or
   recorded manual evidence.
5. `design/verification/post-c.md` written; owner handoff note lists: merge
   order (newstack → dev, then phase/post-c), `~/nf-sandbox` migration
   choice, deleted engine-root files for review.

## Self-review (done at write time)

- Every backlog item (1-4) maps to a task; every recon risk is either fixed
  in a task or recorded as a follow-up (app/sourcedata under data/; arbitrary
  locales; NEWS-view "all"; physical subtheme drop for old DBs).
- Constitution: no self-scope surfaces touched; commits stay area-scoped
  (`nf`/`tool`/`gate`/`fe`/`design`); FD-3.2/FD-7.4 unaffected (build-world
  references engine paths from tools/, which the boundary check permits).
- Redirection honored: nothing writes the real `~/news`; old-shape support
  is view-only; migration only ever touches disposable sandboxes.
