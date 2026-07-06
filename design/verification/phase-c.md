# Phase C verification — News newstack

Running record; completed as the exit items execute. Plan:
`design/development/2026-07-05-phase-c-plan.md` (including the
2026-07-06 REDIRECTION: the dev repo never operates production news —
all runs target sandbox instances).

## Test / parity state

Two phases of the suite:

- **During the port (oracle parity, git history):** the TS pipeline
  reproduced the Python oracle byte-for-byte over the real-content
  golden corpus — 132 pipeline tests + oracle pytest 140/1skip at the
  drift-fold (upstream 17682e9 + two recorded determinism fixes).
  Byte-identical render parity (32/32), normalized DB dump parity,
  parsed-equal export parity, gate output parity, Sunday replay E2E.
- **After T12 (self-regression, current):** the Python oracle and the
  real corpus are deleted. `goldens/synthesize.ts` generates a
  schema-shaped synthetic micro-world and freezes the TS pipeline's own
  outputs as `expected/`; the suite is **121 tests green, TS-only, on
  the 3-OS CI matrix** — no Python, no personal editorial data in the
  repo. The parity evidence above is the git-history record that the
  port was faithful before the oracle was retired.

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

## Story S-3 — switch EXECUTED 2026-07-06 (run = exit run (b), below)

Via the gate (the same endpoint the Formans drawer reads/writes — the
drawer UI itself was integration-tested at T7):

    GET  /api/world/news-config → {"runtime":"claude-code","search":"native"}
    PUT  {"runtime":"ollama","search":"external","searchEngine":"brave",
          "synthModel":"qwen3.6:27b"}     → echoed back
    (a PUT carrying an unknown field `synthProvider` was REJECTED —
     deny-unknown works)
    GET  → the switched pair; <data store>/world/news-config.json
    matches byte-for-byte (atomic write).

The next run picked the pair up with no flags (exit run (b)). Switch-back
to claude-code/native recorded below after the run.

Executing the pair surfaced one integration gap, fixed in the pipeline:
the external-search adapters existed in `nunc-ai` but nothing CALLED
them — `compose-news-section` now runs the topic fan-out through the
configured adapter parent-side (one query per news-topics.md topic,
rate-limited, results inlined into the writer prompt) when
search≠native. Verified live: brave answered every topic and the local
model produced a schema-valid news_section.json from the inlined
research.

## S-10 re-run — PASS 2026-07-06

Pristine `ubuntu:24.04` container (repo mounted read-only, cloned
inside; apt + Node 24 + rustup 1.96.1 + `cargo install just`):
`git clone /src` → `sh tools/bootstrap.sh /root/my-data` → `just up` →
through :8720 `/health`, `/gate/health`, `/fourfive/api/health`, and
the `Nunc Stans` title all answered — `S-10-PASS`, exit 0. (Two launch
mistakes were harness-side, not product-side: the script wasn't mounted
into the container, then `safe.directory` for the read-only mount.)

## Exit run (a) — timer-launched live day — EXECUTED 2026-07-06

`just news-schedule ~/nf-sandbox` installed + enabled the user units
(OnCalendar `*-*-* 06:30:00`, Persistent=true); the run was launched
with `systemctl --user start nunc-fluens-daily.service` — the same unit
the timer fires — and completed the full Mon–Sat chain for 2026-07-06
**with no conversational step**: headless claude-code under systemd
(risk 3 closed: auth + spawn + WebSearch all work from a user unit).

    run 2026-07-06: OK — 32 steps ok (run.json mode=live,
    runtime=claude-code, search=native)
    sandbox git log: d125e91 "daily-master 2026-07-06: news +
    future-prediction + 3-day README + dashboard" (local commit;
    no remote by design — publish push skipped, logged)
    DB: 31 validation rows for 2026-07-06, 0 empty bridges
    dashboard manifest latest_report_date: 2026-07-06
    ai-runs.jsonl: 55 headless calls across the attempts

The run needed three attempts, each catching a live-path bug that the
replay/golden validation could not see (all fixed in the pipeline, each
now failing at the step instead of a later gate):

1. **Headless steps have no file access** — three prompts NAMED their
   input files instead of carrying content; compose-validation-rows
   honestly returned an empty table. Inputs are now inlined (last-7-days
   predictions, dormant due/revival material with the layer-1 signal
   scan computed deterministically, news-topics list + references tail,
   today's rendered files for the READMEs).
2. **Empty bridge narratives on no-signal rows** — schema-valid,
   rejected row-by-row by the puv gate. The writer contract (a
   no-signal day still gets a bridge stating what today's news did not
   touch) is now enforced by the step validator.
3. **`git add` of an ignored path aborts the publish commit** —
   upstream keeps references.txt untracked; the publish step now adds
   only existing, non-ignored paths.

## Exit run (b) — local model + external search — EXECUTED 2026-07-06

The S-3 pair (ollama `qwen3.6:27b` synthesis + `brave` external search)
in the same sandbox, `--date 2026-07-07`. Acceptance is structural
validity, not content quality (C4): a local model's day is allowed to
look different from a frontier model's. Three live-path bugs the pair
surfaced (all fixed):

1. **The external SearchSource adapters existed but nothing called
   them** — `native` search rode the runtime's own web tool, so a local
   model (no web tool) had no research. `compose-news-section` now runs
   the topic fan-out through the configured adapter parent-side (one
   brave query per news-topics.md topic, rate-limited, results inlined).
2. **ollama `stream:false` + undici idle timeouts** = "fetch failed" on
   long 27B generations; the provider streams NDJSON now. Locale
   fan-outs also serialize on non-claude runtimes (a local server does
   one request at a time).
3. **A parent-restricted citation** (the model chose tomshardware.com /
   Future plc) failed the citation gate three steps downstream;
   compose-news-section now runs the restriction check on its own
   composed URLs and re-prompts on a hit (spec-faithful).

## T12 — Python retired, goldens synthetic — DONE 2026-07-06

- `engines/nunc-fluens/app/` (the frozen Python oracle) and
  `goldens/capture.ts` (its real-corpus staging tool) deleted; the
  real-content corpus is gone from the repo.
- `goldens/synthesize.ts` generates the synthetic micro-world and
  freezes `expected/` from the TS pipeline itself; 121 tests green.
- CI news job swapped pytest → vitest (pipeline typecheck + test +
  nunc-ai test) on the 3-OS matrix; no Python on the runners.
- `NEWS_WORLD` retired in code (build-world resolves `news_repo`);
  remaining references are retirement documentation. naming.md + the v1
  plan updated (D3 superseded, D4 executed).
