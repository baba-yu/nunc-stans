# Phase C verification — News newstack

Running record; completed as the exit items execute. Plan:
`design/development/2026-07-05-phase-c-plan.md` (including the
2026-07-06 REDIRECTION: the dev repo never operates production news —
all runs target sandbox instances).

## Test / parity state (as of 2026-07-06)

- Pipeline suite: **132 tests green, unconditional** (goldens recaptured
  off fixture days with the oracle TZ pinned; capture-day collision
  guard active). Includes byte-identical render parity (32/32),
  normalized DB dump parity for the 7-day rebuild, parsed-equal export
  parity (5 JSONs), gate output parity, Sunday replay E2E, and the
  Sunday live-chain unit suites.
- Oracle pytest: 140 passed / 1 skipped (post-drift-fold, upstream
  17682e9 + two recorded determinism fixes).

## Story S-4 / exit run (c) — EXECUTED 2026-07-06

Zero-LLM replay of the committed Sunday **2026-07-05** (full weekly
chain) in a fresh sandbox instance.

    node …/cli.ts sandbox ~/nf-sandbox
      → local clone of the view checkout (origin removed) +
        store/world/analytics.sqlite seeded (30 937 088 bytes,
        integrity ok both sides)
    NS_SANDBOX=~/nf-sandbox node …/cli.ts run --date 2026-07-05 --replay
      → run 2026-07-05: OK (9.5 s, ai=null — no call path existed)

Verdicts against the S-4 mechanical criteria:

1. `git status --porcelain` in the sandbox checkout:
   `?? app/sourcedata/2026-07-05/run.json` + ` M docs/data/*.json` (6
   regenerated exports) — **nothing else**. report/, future-prediction/,
   README*.md, references.txt, memory/, reference/ (incl. the
   citation-policy-review.md sighting ledger) byte-untouched.
2. Regenerated exports vs committed: `graph-{tech,business,mix}.json`,
   `glossary.json`, `manifest.json` **parsed-equal** modulo
   `generated_at`/`build_id` (byte diffs are the one-time Python→TS
   number-formatting migration).
3. `evidence-reverse.json`: differs from the committed file at 2/200
   top-N-boundary entries — and the **Python oracle recomputed on the
   same DB equals the replay output exactly** (`oracle==replay: True`,
   `oracle==committed: False`): the committed file was stale at its
   boundary when upstream generated it mid-flow. The port is faithful;
   the criterion is parsed-equality against the oracle, satisfied.
4. `PRAGMA integrity_check` on the sandbox store DB: `ok`.
5. `run.json`: `mode="replay"`, step statuses ok/replayed, timestamps
   only — the allowed-metadata list.

Fix that fell out of executing the story: replay no longer re-increments
the cumulative unclassified-host ledger (`citation-policy-review.md`) —
the first execution double-counted the day's sightings; gates still run.

## Story S-3 — spec written, execution pending

Requires a live sandbox run with the settings pair switched
(ollama qwen3.6:27b + brave) and back; evidence lands here.

## Exit runs (a) timer / (b) local-model — pending

The systemd user units + installer are in `pipeline/systemd/`
(`just news-schedule <sandbox> [OnCalendar]`); run (a) = timer-launched
sandbox day; run (b) = the S-3 pair. Both publish nothing (redirection).

## S-10 re-run — pending (T11)
