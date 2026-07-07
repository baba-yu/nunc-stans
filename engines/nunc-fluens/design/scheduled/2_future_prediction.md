# 2_future_prediction — orchestrator

Daily flow that produces today's `future-prediction/{en,ja,es,fil}/future-prediction-YYYYMMDD.md`. Phase 3 rewrite (≤ 80 lines): all heavy LLM steps emit JSON sourcedata to `app/sourcedata/<date>/`, deterministic Jinja2 renderers turn that JSON into markdown. The LLM never writes markdown directly. Schemas + rendered shape live in `design/sourcedata-layout.md`.

Inputs come from `report/en/news-*.md` (last 7 days inclusive) and `memory/dormant/dormant-*.md` (latest snapshot). EN is canonical; **only the URLs cited in `report/en/news-YYYYMMDD.md` may be used for investigation** — no extra research.

## Skills called (in order)

1. **`compose-validation-rows`** *(LLM, sub-agent)* — read last-week + dormant snapshot; emit `app/sourcedata/<date>/bridges.json` with the `validation_rows[].prediction_ref` + `today_relevance` + `evidence_summary` + `reference_links` populated, leaving each `bridge` object as a placeholder with `narrative=""`, `support_dimension="none"`, `coherence=0`, `remaining_gap=""`. Includes the **2-layer dormant longshot detection** (Layer 1 keyword via `Signals` column; Layer 2 semantic via Headlines + sub-headings). Spec: `design/skills/compose-validation-rows.md`.
2. **`compose-bridge` × N** *(LLM, one sub-agent per validation row)* — for each row in `bridges.json`, fill `bridge.narrative` (single-paragraph prose; no `Pred ID #N` reference, no `Coherence N/5` token, no `Remaining gap:` token), `bridge.support_dimension` (one of `because`/`given`/`so_that`/`landing`/`none`), `bridge.coherence` (1–5 integer), and `bridge.remaining_gap` (short prose). Each sub-agent emits the JSON for its single row; parent merges into `bridges.json`. Spec: `design/skills/compose-bridge.md`.
3. **`compose-summary`** *(LLM, sub-agent)* — emit `app/sourcedata/<date>/summary.json` with `plain_language` (≤ 200 chars, ≤ 3 sentences), `findings` (multi-paragraph prose), and `relation_to_my_preds` (multi-paragraph prose). The renderer treats `summary.json` as optional — its absence renders without those three trailing sections.
4. **`citation-restriction-check`** *(deterministic, on JSON union)* — walks every `bridges.validation_rows[].reference_links[].url`; substitutes or drops on `RESTRICT` hit (explicit denylist, parent-inherited, or ToS-unconfirmed) and re-runs. Pass `--unclassified-out reference/citation-policy-review.md` so unclassified hosts upsert into the review ledger. **Critical to run before locale fan-out** so a denylisted URL doesn't multiply 4×. Spec: `design/skills/citation-restriction-check.md`.
5. **`translate-sourcedata` × 3** *(LLM, one sub-agent per non-EN locale)* — each sub-agent reads `bridges.json` + `summary.json` + the locale-fanout contract in `design/skills/locale-fanout.md`, and writes locale-specific JSON under `app/sourcedata/locales/<date>/{ja,es,fil}/{bridges,summary}.json`. Translates only field values; section H2 headers + the validation-table `prediction_ref.short_label` (the identity key for dormant-pool match) stay English.
6. **`render-future-prediction-md` × 4** *(deterministic, inline)* — `python -m app.skills.render_future_prediction_md --date <date> --locale <L> --write` for each of `en, ja, es, fil`. Writes atomically (`tmp` + `os.replace`) to `future-prediction/<L>/future-prediction-YYYYMMDD.md` and runs `post-write-integrity --kind future-prediction`. Spec: `design/skills/render-future-prediction-md.md`.
7. **`ingest-sourcedata`** *(deterministic, inline)* — `python -m app.src.cli ingest-sourcedata --date <date>`. Populates `validation_rows.bridge_text` + `support_dimension` + `bridge_text_<locale>` from JSON. Idempotent.
8. **`lint-markdown-clean`** *(deterministic, Phase 3 gate)* — `python -m app.skills.lint_markdown_clean --date <date>`. Greps every per-locale `future-prediction-YYYYMMDD.md` for forbidden tokens (`Pred ID #N`, `Coherence N/5`, `Remaining gap:`, `**Bridge (...)**`, etc.). Exits 1 on any hit; abort. Spec: `design/skills/lint-markdown-clean.md`.
9. **`post-update-validation`** *(shared, runtime DB gate)* — `python -m app.skills.post_update_validation --check future-prediction --date $(date +%Y-%m-%d)`. Confirms today's `validation_rows` rows have `bridge_text` + every `bridge_text_{ja,es,fil}` populated, and `support_dimension` is one of `because/given/so_that/landing/none`. Exits 1 on silent NULL — abort. Spec: `design/skills/post-update-validation.md`.

## Writer constraints (no scope prefix — applies in every JSON field, every locale)

The forbidden-token list in `design/sourcedata-layout.md §Naming hygiene` applies to JSON sourcedata fields in addition to rendered markdown. Specifically: `(Tech)` / `(Non-Tech)` / `(Business)` / `(Mix)` / `(技術)` / `(ビジネス)` / `(Tecnología)` / `(Teknikal)` etc. must NOT appear in any `bridge.narrative`, `evidence_summary`, `summary.findings`, `summary.plain_language`, or `summary.relation_to_my_preds` field. The renderer renders these through verbatim — writer-side avoidance is the single source of truth.

**Exception:** the `prediction_ref.short_label` cell stays as the EN canonical text from the source news file — that is the identity key the dormant-pool match logic and the historical scan rely on. If the source prediction was authored with a legacy prefix it is **already** stripped at ingest time by `app/src/parsers/news_parser.py:_strip_scope_prefix_anywhere`, so this exception is now narrowly historical.

Per-skill prompt regulations (JSON schema constraints + tone rules) live in `design/scheduled/2_future_prediction-writer-rules.md`.

## Sub-agent dispatch (per `0_daily_master.md §Sub-agent dispatch policy`)

| Step | Dispatch shape |
|---|---|
| 1 (compose-validation-rows) | 1 sub-agent |
| 2 (compose-bridge)          | N sub-agents in parallel (1 per validation row) |
| 3 (compose-summary)         | 1 sub-agent |
| 5 (translate-sourcedata)    | 3 sub-agents in parallel (one per non-EN locale) |

Every sub-agent prompt MUST include "reply with one-line OK status, do NOT paste content back".

## Inputs / outputs

- Reads: `report/en/news-*.md` (last 7 days), `memory/dormant/dormant-*.md` (latest), `reference/citation-restrictions.md`, `app/data/analytics.sqlite` (predictions + needs_tasks).
- Writes: `app/sourcedata/<date>/{bridges,summary}.json`, `app/sourcedata/locales/<date>/{ja,es,fil}/{bridges,summary}.json`, `future-prediction/{en,ja,es,fil}/future-prediction-YYYYMMDD.md`, `app/data/analytics.sqlite` (validation_rows.bridge_text + support_dimension + locale columns).

## Failure modes (skill-localized)

- **citation pre-check stops eligible cells** — substitute to a non-denylist alternative; if no alternative, drop the row rather than ship.
- **compose-bridge sub-agent emits malformed JSON** — schema-validate at write time; re-prompt the failing sub only.
- **`citation-restriction-check` exits 1 between Step 4 and Step 5** — substitute and re-run **before** locale fan-out (a denylisted EN citation multiplied 4× is the worst-case violation).
- **render-future-prediction-md fails post-write-integrity** — abort.
- **lint-markdown-clean exits 1** — a prompt regression let a forbidden token leak. Abort; fix the writer prompt before re-running.

## DRY_RUN

`DRY_RUN=1`: Step 6 prints planned paths and exits 0. All earlier skills run idempotently.

## Acceptance — this run is "done" when

1. `app/sourcedata/<date>/{bridges,summary}.json` validate against their schemas.
2. `future-prediction/en/future-prediction-YYYYMMDD.md` exists, ends with newline, passes `post-write-integrity --kind future-prediction`.
3. The 3 sibling-locale files exist, each passing `post-write-integrity --kind future-prediction`.
4. `lint-markdown-clean --date <date>` exits 0 — no forbidden tokens in any locale.
5. `validation_rows.bridge_text` populated; `support_dimension` is one of `because/given/so_that/landing/none`.
6. `post-update-validation --check future-prediction` exits 0.

The dormant-pool 2-layer longshot detection rules + per-skill prompt regulations live in `design/scheduled/2_future_prediction-writer-rules.md`. Schema definitions live in `design/sourcedata-layout.md §JSON schemas (canonical)`.
