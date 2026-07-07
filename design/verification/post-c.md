# Post-C verification — product layout, prompts re-home, locale config, ledger items

Record for the post-C refactoring effort; plan:
`design/development/2026-07-06-post-c-plan.md`. Executed 2026-07-06 on branch
`phase/post-c` (off `newstack`), 18 commits; **superseded in part by the
V2 REDO below (2026-07-07)** — the owner rejected the news-conformant
framing and the layout/sandbox work was redone as a template/instance
separation. Sections below describe the 07-06 state; the V2 section at the
end is current. Owner actions are listed at the bottom of the V2 section.

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

`app/sourcedata`+`app/data` under `data/` (DB path-identity migration —
**executed in V2**, see below); locales beyond {ja,es,fil}
(column-per-locale schema migration); NEWS-view "all scopes"; physical
subtheme drop for pre-existing DBs; dashboard `REPO_BLOB_URL` fork-coupled
link base; per-profile gate news-config API.

# V2 REDO — template/instance separation (2026-07-07)

Owner correction (plan REDO section): the product is a different piece of
software from news; what item 1 meant was an app TEMPLATE cleanly separated
from DATA INSTANCES. 11 commits redid the model:
d72aa2b/1b70d46/d722df1/c03187e (core), c624aee/f6e752c (periphery),
9a32ebd/c4efdde/1eee9f6/7368a03/f38e087 (review fixes) + design commits.

## The model as shipped

- **Template** (engine, tracked): pipeline code + `pipeline/instance-template/`
  (instance `.gitignore`, README seed, synthetic `data/reference/` editorial
  seeds, empty `data/references.txt`, `.gitkeep` skeleton).
- **Instance** (one git repo per profile; default home = gitignored
  `engines/nunc-fluens/instances/<name>/`, CONTRIBUTING FD-3.2 amended):
  `data/{sourcedata,daily-news,future-prediction,memory,reference,exports,
  archives}` + `data/references.txt` + `README*.md` + ignored `store/`
  (`world/analytics.sqlite`, `runs/ai-runs.jsonl`, optional
  `news-config.json` override; main-store config is the fallback default).
- **CLI**: `init <dir|name>` stamps an instance from the template
  (synthetic git identity seeded into the instance's local config;
  hermetic against gpgsign/hooks hosts; rollback on failure);
  `import <news-shaped-src> <instance>` copies a news-shaped checkout in
  read-only fashion into the v2 layout (archives carried, DB seeded with
  integrity check + timestamped .bak, symlinks dereferenced, re-import
  refused via the import-commit marker, recovery hints in refusals);
  `run --instance/NS_INSTANCE` (requireInstance re-creates a missing
  store DB — fresh-clone recovery); bare names resolve to the instances
  home everywhere (link/run/schedule incl. install.sh).
- **Retired**: `sandbox`, `migrate-layout`, `migrate-db`, `NS_SANDBOX`,
  and the old-shape VIEW fallback in build-world (owner decision — the
  world view reads an instance's `data/exports` only; the sole remaining
  news-shaped contact surface is `import`). Old-shape knowledge lives
  only inside `src/import.ts`.

## Verification

- Suites all green 2026-07-07: pipeline **188/19 files** (typecheck clean;
  +init/import/run-config-refusal/bare-name/hermeticity tests), gate 10,
  ns engine 11, formans 16 (+build), nunc-ai 12, fourfive 24,
  `node tools/check.ts` ok, tree clean, commit-scope ok on all commits.
- Goldens: rebuilt **through the real `init` routine** (template seeds are
  the goldens' reference fixtures; `synthesize.ts inputs` also emits
  `fixture-manifest.json` from the corpus constants, proven byte-identical).
  Regen audit: renders byte-identical; DB dump/export hashed ids changed
  wholesale with the `app/sourcedata`→`data/sourcedata` rel-path identity
  (legitimate; reviewer-audited); flow gate text differs only in the DB
  probe line.
- Real smokes outside vitest: init→import→run-guard round trip in /tmp;
  build-world staged the goldens instance (`data/exports` probe, 9
  headlines) and produced the empty state + init/import/link guidance on
  an empty source.
- Adversarial review: 4 reviewers + refute-by-default verification; 16
  confirmed findings (3 major), all fixed same day (see plan V2-3).

## Owner actions (current)

1. Merge order unchanged: `newstack` → `dev` first, then push
   `phase/post-c` (CI `phase/**`) and PR into `dev`.
2. First instance when you want it: `just news-init <name>` →
   `just news-import ~/news <name>` (source is never modified) →
   `just news-link <name>`; timer: `just news-schedule <name>` (or
   `systemctl --user disable --now nunc-fluens-daily.timer`).
   `~/nf-sandbox` stays refused by the run guard and is disposable (D4).
3. The world view currently shows the empty state until an instance is
   linked (the owner's config still points `news_repo` at `~/news`,
   whose direct viewing was removed by decision R6).
4. **Deletion proposal D1-D5 in the plan's REDO section awaits your
   per-item decision — nothing was deleted.**
