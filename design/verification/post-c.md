# Post-C verification — product layout, prompts re-home, locale config, ledger items

Record for the post-C refactoring effort; plan:
`design/development/2026-07-06-post-c-plan.md`. Executed 2026-07-06 on branch
`phase/post-c` (off `newstack`), 18 commits. Owner actions remaining are
listed at the bottom.

## Suite state — 2026-07-06, all green

| Suite | Result |
|---|---|
| nunc-fluens pipeline (vitest) | **174 passed / 17 files** (typecheck clean). Baseline at branch start: 121/13. Growth: +18 prompts-resolution (T3), +6 glossary retention (T4), +5 layout/migration (T6), +16 locale set (T7), +8 review fixes (migration hardening, run-json snapshot semantics). |
| gate (cargo) | 10 (1 lib + 9 integration; +1 locales roundtrip/validation) |
| nunc-stans engine (cargo) | 11 |
| formans (vue-tsc + vitest + build) | 16, build green |
| nunc-ai (vitest) | 12 |
| fourfive (typecheck + vitest) | 24 |
| `node tools/check.ts` | FD-3.2 / FD-7.4 / edge.schema.json all ok |

Working tree clean; every commit passes `node tools/commit-scope.ts`
(areas: nf ×13, tool ×1, gate ×1, fe ×1, design ×2).
3-OS CI proof pending owner push (branch matches the `phase/**` trigger).

## Golden regeneration audit (exit criterion 2)

Only 3 of the 16 code commits touch `pipeline/goldens/`, each pairing the
regen with its behavior change; an independent reviewer categorized every
changed golden file against the plan decisions:

- **e2acf9f (P6 subtheme removal):** DB dump DDL removals + the two
  affected tables' rows losing only `subtheme_id`; export graphs lose the
  always-null `subtheme_id`/`parent_subtheme_id` keys (19/23/39 + 3/9/9
  removals in tech/business/mix); no value-level changes; renders untouched.
- **08b9b63 (P8 prefix tokens):** `expected/export/prefix-tokens.json` +
  its `input/` staging copy added (byte-identical to the source JSON,
  includes the reconciled `no-negocio`/`no-tecnología` drift tokens).
- **75a8baf (P1/P2 layout):** input tree R100-renames
  (`report/`→`data/daily-news/` etc., `docs/data`→`data/exports`);
  README link shapes; `expected/gates/*.flow.txt` path strings + the
  dashboard-hygiene→exports-hygiene bucket rename (exit codes unchanged);
  **one deliberate value flip** — `dormant: true` on
  `prediction.653d833667c2e642`, from the new dormant-pool fixture row
  (`20260102-1`) added so dormant styling can never again be silently
  empty after a path move (disclosed in the commit body).
- **P5 locale model and P7 glossary retention: zero golden changes**,
  verified per-commit — the default locale trio is behavior-preserving by
  construction, and the retention prune runs in the replay-skipped
  glossary-validate step.
- Render goldens (`expected/render/*`) byte-unchanged across the branch.

## Adversarial review — 2026-07-06

Two multi-agent passes over the full diff (`newstack..HEAD`):

1. **Recon before planning:** 6 parallel readers mapped every touchpoint
   (layout constants + bypass literals, locale couplings, subtheme layer,
   ledger items, runtime prompt reads, harness) + a gap critic that
   spot-checked ~60 file:line claims. Its two material catches (runtime
   prompt reads invisible to the suite; NUL bytes making `export.ts`
   grep-blind) shaped the plan (resolution test; hygiene commit first).
2. **Review after implementation:** 6 domain reviewers produced 11
   findings; each was adversarially verified (refute-by-default) — 1
   refuted, **10 confirmed (2 major, 8 minor), all fixed** in
   6e380df / 4e0b20d / 645912c / cd15979:
   - major: `migrate-layout` deleted `docs/archives/snapshots` instead of
     carrying it to `data/archives` (now moved, with test);
     `--dry-run`/`--only` runs overwrote the day's `run.json` locale
     snapshot (writes now gated to full live + replay runs).
   - minor: partial migrations now complete on re-run and mixed trees are
     refused; migration commits use a synthetic git identity; day D's
     `run.json` now rides D's own publish commit; the runtime prompt
     corpus speaks configured-set language and has no dead self-paths;
     dashboard `all`-alias round trip, boot-time snapshot manifest, and
     stale contract comments fixed.

## Old-shape / new-shape proof (exit criteria 3 and 4)

- **View side, old shape (the guarantee):** `tools/build-world.ts` against
  the owner's real `~/news` (read-only) resolved the legacy
  `docs/data/graph-mix.json` fallback — 243 headlines staged, dashboard
  staged **from the engine copy** (`cmp` byte-identical, carries the
  `value="all"` marker), checkout-era favicon dropped.
- **View side, new shape:** `NS_NEWS_REPO=<goldens/input>` resolved the
  `data/exports/graph-mix.json` probe — 9 synthetic headlines, 12 export
  files staged incl. `prefix-tokens.json`.
- **Run side:** replay E2E (weekday + Sunday chain incl. weekly artifacts)
  green in the new shape; `migrate-layout` proven by unit tests on
  synthetic old-shape git repos (moves + archives carry + `.gitignore`
  translation + single commit + idempotency + partial-migration completion
  + no-identity hermetic commit + non-git refusal); `requireSandbox`
  refuses old-shape and mixed trees with a message naming
  `nunc-fluens migrate-layout`.

## Remaining manual verification (recorded, not blocking)

- Dashboard visuals via the staged world view (`just up` → /world-graph):
  locale buttons rendered from `manifest.locales`, LIST "all scopes"
  option, snapshot-mode locale buttons.
- Formans drawer: locales checkboxes load (absent key ⇒ all three
  checked) and an all-unchecked save sends `"locales": []`.
- First **live** sandbox day on the new layout — prompt loads are covered
  by the resolution test, but live LLM steps with a non-default locale set
  only prove out on a real run.

## Owner actions

1. Merge order: `newstack` → `dev` first (Phase C gate), then push
   `phase/post-c` (CI on `phase/**`) and PR it into `dev`.
2. `~/nf-sandbox` is old-shape; the 06:30 timer's next run will be
   **cleanly refused** with a migrate message. Choose one:
   `just news-migrate-layout` equivalent
   (`node engines/nunc-fluens/pipeline/src/cli.ts migrate-layout ~/nf-sandbox`),
   recreate the sandbox, or pause the timer
   (`systemctl --user disable --now nunc-fluens-daily.timer`).
3. Review the P10 deletions (git history keeps them):
   `engines/nunc-fluens/reference/` (6 files of real editorial data) and
   the imported `README.{ja,es,fil}.md`; the engine README is rewritten,
   `docs/` is now the engine documentation home.
4. On-disk untracked leftovers under `engines/nunc-fluens/`
   (`app/sourcedata/` real data, `report/`, `memory/`, pycache dirs) were
   deliberately left for you to remove.
5. Version skew note: the gate's `news-config` uses deny-unknown-fields —
   gate binary, drawer, and pipeline must deploy together (same repo, so
   the PR satisfies this; just avoid running a stale gate build).

## Recorded follow-ups (out of scope, from plan decisions)

`app/sourcedata`+`app/data` under `data/` (DB path-identity migration);
locales beyond {ja,es,fil} (column-per-locale schema migration);
NEWS-view "all scopes"; physical subtheme drop for pre-existing DBs;
dashboard `REPO_BLOB_URL` fork-coupled link base.
